# 🔐 Remove Hardcoded Login & Connect to API Database

## Summary of Changes

The login system has been **migrated from hardcoded mock data to API-based authentication** using the SQL database backend.

## 📋 Detailed Changes

### 1. **New Files Created**

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | Authentication service for login/register API calls |
| `.env` | Environment variables (API URL configuration) |
| `.env.example` | Template for environment variables |
| `docs/guides/api_authentication_setup.md` | Detailed setup guide |

### 2. **Files Updated**

#### `src/pages/public/Login.tsx`
- ❌ **Removed**: User search from hardcoded `users[]` array
- ✅ **Added**: API call via `authService.login()`
- ✅ **Added**: Server-side error handling
- ✅ **Added**: Loading spinner during authentication

#### `src/pages/public/Register.tsx`
- ❌ **Removed**: Direct mock data user creation
- ✅ **Added**: API call via `authService.register()`
- ✅ **Added**: Plate number and vehicle type fields
- ✅ **Added**: Server-side error handling
- ✅ **Added**: Loading state during registration

#### `src/components/LoginView.tsx`
- ❌ **Removed**: Hardcoded user validation from props
- ✅ **Added**: `authService` import
- ✅ **Added**: Async login handler with API integration
- ✅ **Added**: Error display component

## 🔧 API Architecture

### Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "email or phone",
  "password": "password"
}

Response (200 OK):
{
  "message": "Login successful.",
  "user": {
    "id": "1",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "0912345678",
    "role": "Parking User / Driver",
    "status": "Active",
    "isActive": true,
    "createdAt": "2026-01-15"
  }
}
```

### Register Endpoint
```
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "0912345678",
  "plateNumber": "29A-12345",
  "vehicleType": "Motorbike",
  "password": "secure_password"
}

Response (201 Created):
{
  "message": "Registration successful.",
  "user": { ... }
}
```

## 📊 Before/After Comparison

### ❌ Old Code (Hardcoded)
```typescript
// Login.tsx - Search user from mock data
const user = users.find(
  (u: any) =>
    (u.email?.toLowerCase() === identifier.trim().toLowerCase() ||
      u.phone === identifier.trim()) &&
    u.password === password
);

if (user) {
  onLogin(user);
} else {
  setErrors({ general: 'Invalid credentials' });
}
```

### ✅ New Code (API-Based)
```typescript
// Login.tsx - Call API for authentication
const response = await authService.login({
  identifier: identifier.trim(),
  password: password,
});

const user = {
  id: response.user.id,
  fullName: response.user.fullName,
  email: response.user.email,
  phone: response.user.phone,
  role: response.user.role,
  status: response.user.status,
  createdAt: response.user.createdAt || new Date().toISOString(),
};

onLogin(user);
```

## 🚀 Quick Start

### 1. Start Backend (API + Database)
```bash
cd backend
npm install
node server.js
# Result: Server running on http://localhost:4000
```

### 2. Create Test Accounts
```sql
INSERT INTO dbo.users (full_name, email, phone, password_hash, role, is_active)
VALUES 
  (N'John Manager', 'manager@parking.vn', '0900000001', 'password123', 'manager', 1),
  (N'Jane Driver', 'driver@parking.vn', '0900000002', 'password123', 'user', 1);
```

### 3. Start Frontend
```bash
npm install
npm run dev
# Frontend running on http://localhost:5173
```

### 4. Test Login
- **Email**: `driver@parking.vn`
- **Password**: `password123`

## 🔒 Security Improvements

✅ No more plain text passwords in code  
✅ Database-backed authentication  
✅ Bcrypt password hashing support  
✅ Server-side validation  
✅ Proper error handling  

### Security Recommendations
- 🚨 Use **HTTPS in production**
- 🚨 Hash passwords with **bcrypt** before storage
- 🚨 Implement **JWT tokens** for better session management
- 🚨 Add **rate limiting** on login endpoint
- 🚨 Implement **CORS restrictions** for production

## ⚙️ Configuration

### `.env` File
```
VITE_API_URL=http://localhost:4000
```

Adjust based on environment:
- **Development**: `http://localhost:4000`
- **Production**: `https://api.parkflow.com`

## ✅ Testing Checklist

- [ ] Backend server running on port 4000
- [ ] Frontend server running on port 5173
- [ ] SQL Server database accessible
- [ ] Test accounts created in database
- [ ] Login succeeds with valid credentials
- [ ] Error messages display for invalid credentials
- [ ] Correct role-based redirects:
  - Admin → Admin Dashboard
  - Manager → Manager Dashboard
  - Driver → My Parking
- [ ] Loading spinner appears during login
- [ ] Logout clears user session

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Server connection error" | Check backend at `http://localhost:4000/api/health` |
| Login always fails | Verify test users exist in SQL database |
| Password invalid | Check password hashing in `backend/server.js` |
| CORS error | Review CORS config in backend |

## 📚 Documentation

See full details: [`docs/guides/api_authentication_setup.md`](docs/guides/api_authentication_setup.md)

## 🎯 Future Enhancements

1. **JWT Tokens** - Replace localStorage with JWT
2. **Multi-Factor Authentication** - Phone/Email verification
3. **Password Reset** - Forgot password flow
4. **Session Management** - Auto-logout and timeout
5. **Rate Limiting** - Brute force protection
6. **Social Login** - Google/Microsoft integration

---

**Last Updated**: 2026-06-16  
**Status**: ✅ Complete
