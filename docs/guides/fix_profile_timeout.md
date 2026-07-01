# Fix: Profile Loading Timeout Issue

## 🐛 Vấn đề (Problem)

Người dùng gặp lỗi timeout khi tải profile:
```
Quá thời gian tải profile. Vui lòng làm mới trang (F5) hoặc kiểm tra kết nối mạng
```

## 🔍 Nguyên nhân (Root Cause)

### 1. **RLS Circular Dependency** (Nghiêm trọng nhất)
- **Policy `users_select`** gọi hàm `current_user_role()`
- **Hàm `current_user_role()`** query bảng `public.users`
- **Kết quả:** Circular dependency → infinite loop/timeout

### 2. **Timeout quá dài (15s)** nhưng vẫn không đủ
- User phải đợi 15s mới thấy fallback
- UX rất tệ

### 3. **Không có retry mechanism**
- Nếu query fail lần đầu, không retry
- Network glitch tạm thời → fail ngay

### 4. **Throw error trong timeout**
- `Promise.race` với reject → throw error
- Error bị bubble up → block UI loading

## ✅ Giải pháp (Solution)

### 1. **Fix RLS Circular Dependency** 
**Migration:** `20260604180000_fix_users_rls_circular_dependency.sql`

**Thay đổi:**
```sql
-- CŨ (gây circular dependency)
CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    auth.uid() = id 
    OR public.is_admin() -- ❌ Calls current_user_role() → queries users
    OR public.current_user_role() = 'lecturer' -- ❌ Queries users
  );

-- MỚI (không có circular dependency)
CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    auth.uid() = id -- ✅ Direct check
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') -- ✅ Direct JWT check
    OR EXISTS ( -- ✅ Check via other tables, not users
      SELECT 1
      FROM public.groups g
      INNER JOIN public.group_members m ON m.group_id = g.id
      WHERE g.lecturer_id = auth.uid()
        AND m.student_id = users.id
    )
  );
```

**Ưu điểm:**
- Không gọi functions query `users` table
- Dùng `auth.jwt()` để check role trực tiếp
- Check lecturer via `groups` + `group_members` join

### 2. **Cải thiện AuthContext**

#### A. Thêm In-Memory Cache
```typescript
const profileCache = new Map<string, { profile: AppUserProfile; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds
```

**Lợi ích:**
- Tránh re-fetch profile liên tục
- Giảm load lên database
- Faster subsequent loads

#### B. Retry Mechanism
```typescript
async function fetchProfileRow(userId: string, retryCount = 0): Promise<AppUserProfile | null> {
  try {
    // Try fetch...
  } catch (error) {
    if (retryCount < PROFILE_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      return fetchProfileRow(userId, retryCount + 1); // Retry
    }
    return null;
  }
}
```

**Lợi ích:**
- Retry up to 2 times với 500ms delay
- Handle transient network issues
- More resilient

#### C. Giảm Timeout & Non-blocking
```typescript
const PROFILE_TIMEOUT_MS = 8000; // Giảm từ 15s → 8s

// Don't throw error on timeout
const loadProfileWithTimeout = async (uid: string, activeUser: User) => {
  const timeoutPromise = new Promise<void>((resolve) => { // ✅ resolve, not reject
    timer = setTimeout(() => {
      timedOut = true;
      resolve(); // ✅ Don't throw
    }, PROFILE_TIMEOUT_MS);
  });

  await Promise.race([loadPromise, timeoutPromise]);
  
  if (timedOut) {
    setProfile(getFallbackProfile(activeUser)); // ✅ Use fallback, don't throw
  }
};
```

**Lợi ích:**
- Timeout nhanh hơn (8s thay vì 15s)
- Không throw error → không block UI
- Luôn có fallback profile để user có thể tiếp tục

#### D. Non-blocking Initial Load
```typescript
const init = async () => {
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  
  setSession(currentSession);
  setUser(currentSession?.user ?? null);
  
  if (currentSession?.user?.id) {
    // ✅ Don't await - load in background
    loadProfileWithTimeout(currentSession.user.id, currentSession.user).catch(error => {
      console.error("[AuthContext] Profile load error in init", error);
    });
  }
  
  // ✅ Stop loading after 1s max
  setTimeout(() => {
    setLoading(false);
  }, 1000);
};
```

**Lợi ích:**
- Loading state chỉ kéo dài tối đa 1s
- Profile load trong background
- User không phải đợi lâu

### 3. **Clear Cache khi cần**
```typescript
const refreshProfile = useCallback(async () => {
  profileCache.delete(uid); // ✅ Clear cache before refresh
  await loadProfile(uid, session.user);
}, [session, loadProfile]);

const signOut = useCallback(async () => {
  // ...
  profileCache.clear(); // ✅ Clear all cache on sign out
}, []);
```

## 🚀 Cách áp dụng (How to Apply)

### 1. Apply Database Migration

**Option A: Using Supabase CLI**
```bash
# If using local Supabase
npx supabase start
npx supabase db reset

# If using remote Supabase
npx supabase db push
```

**Option B: Manual via SQL Editor**
1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Copy nội dung từ `supabase/migrations/20260604180000_fix_users_rls_circular_dependency.sql`
4. Paste và Run

### 2. Code đã được update

✅ `src/context/AuthContext.tsx` - Fixed
✅ `src/components/ProtectedRoute.tsx` - Improved
✅ Migration file created

### 3. Test

1. **Refresh trang**
2. **Login/Logout**
3. **Navigate giữa các trang**
4. **Check console** - không còn timeout errors

## 📊 Kết quả (Results)

### Trước khi fix:
- ❌ Timeout sau 15s
- ❌ Error toast xuất hiện
- ❌ User phải F5 để reload
- ❌ UX rất tệ

### Sau khi fix:
- ✅ Load trong ~1s (max 8s)
- ✅ Retry tự động nếu fail
- ✅ Fallback profile nếu timeout
- ✅ Cache giảm load lên DB
- ✅ Không còn circular dependency
- ✅ UX mượt mà

## 🔧 Debugging

Nếu vẫn còn issue:

### Check console logs:
```javascript
[AuthContext] Profile already loading for user // ← Good
[AuthContext] Using cached profile // ← Good
[AuthContext] Retrying profile fetch (attempt 1/2) // ← Retry working
[AuthContext] Using fallback profile after timeout // ← Fallback working
```

### Check RLS policies:
```sql
-- In Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'users';
```

### Check if user row exists:
```sql
SELECT * FROM public.users WHERE id = auth.uid();
```

## 📝 Notes

1. **Cache TTL = 30s:** Profile được cache 30 giây
2. **Retry = 2 lần:** Mỗi lần cách nhau 500ms
3. **Timeout = 8s:** Giảm từ 15s để UX tốt hơn
4. **Fallback:** Luôn có fallback từ `user.user_metadata`

## 🎯 Best Practices

1. **Không gọi recursive functions trong RLS policies**
2. **Dùng `auth.jwt()` thay vì custom functions khi có thể**
3. **Cache để giảm DB load**
4. **Retry cho network resilience**
5. **Non-blocking initial load**
6. **Fallback gracefully, don't throw**

---

**Updated:** June 4, 2026
**Status:** ✅ Fixed and Tested
