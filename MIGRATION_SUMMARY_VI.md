# 🔐 Xóa Code Cứng (Hardcoded) và Kết Nối API Đăng Nhập

## Tóm Tắt Thay Đổi

Hệ thống đăng nhập đã được chuyển từ **dữ liệu cứng (hardcoded mock data)** sang **kết nối API với cơ sở dữ liệu SQL**.

## 📋 Danh Sách Thay Đổi Chi Tiết

### 1. **Tệp Mới Tạo**

| Tệp | Mục Đích |
|-----|---------|
| `src/services/authService.ts` | Dịch vụ xử lý API đăng nhập/đăng ký |
| `.env` | Biến môi trường (URL API) |
| `.env.example` | Mẫu tệp môi trường |
| `docs/guides/api_authentication_setup.md` | Hướng dẫn cài đặt chi tiết |

### 2. **Tệp Đã Cập Nhật**

#### `src/pages/public/Login.tsx`
- ❌ **Xóa**: Tìm kiếm user từ `users[]` (hardcoded)
- ✅ **Thêm**: Gọi API `authService.login()`
- ✅ **Thêm**: Xử lý lỗi từ server
- ✅ **Thêm**: Loading spinner khi đang đăng nhập

#### `src/pages/public/Register.tsx`
- ❌ **Xóa**: Tạo user trực tiếp vào mock data
- ✅ **Thêm**: Gọi API `authService.register()`
- ✅ **Thêm**: Thêm trường "Biển số xe" và "Loại phương tiện"
- ✅ **Thêm**: Xử lý lỗi từ server
- ✅ **Thêm**: Loading state trong quá trình đăng ký

#### `src/components/LoginView.tsx`
- ❌ **Xóa**: Hardcoded validation lấy user từ props
- ✅ **Thêm**: Import `authService`
- ✅ **Thêm**: Async login handler với API call
- ✅ **Thêm**: Error display component

## 🔧 Kiến Trúc API

### Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "email hoặc số điện thoại",
  "password": "mật khẩu"
}

Response (200):
{
  "message": "Đăng nhập thành công.",
  "user": {
    "id": "1",
    "fullName": "Tên người dùng",
    "email": "user@example.com",
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
  "fullName": "Tên đầy đủ",
  "email": "user@example.com",
  "phone": "0912345678",
  "plateNumber": "29A-12345",
  "vehicleType": "Xe máy",
  "password": "mật khẩu"
}

Response (201):
{
  "message": "Đăng ký thành công.",
  "user": { ... }
}
```

## 📊 So Sánh Trước/Sau

### ❌ Code Cũ (Hardcoded)
```typescript
// Login.tsx - Tìm user từ mock data
const user = users.find(
  (u: any) =>
    (u.email?.toLowerCase() === identifier.trim().toLowerCase() ||
      u.phone === identifier.trim()) &&
    u.password === password
);

if (user) {
  onLogin(user);
} else {
  setErrors({ general: 'Sai email/SĐT hoặc mật khẩu' });
}
```

### ✅ Code Mới (API)
```typescript
// Login.tsx - Gọi API đăng nhập
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

## 🚀 Cách Sử Dụng

### 1. Khởi Động Backend (SQL + API)
```bash
cd backend
npm install
node server.js
# Kết quả: Server chạy trên http://localhost:4000
```

### 2. Tạo Tài Khoản Test (SQL Server)
```sql
INSERT INTO dbo.users (full_name, email, phone, password_hash, role, is_active)
VALUES 
  (N'Trần Quản Lý', 'manager@parking.vn', '0900000001', 'manager123', 'manager', 1),
  (N'Nguyễn Lái Xe', 'driver@parking.vn', '0900000002', 'driver123', 'user', 1);
```

### 3. Khởi Động Frontend
```bash
npm install
npm run dev
# Frontend chạy trên http://localhost:5173
```

### 4. Đăng Nhập Thử Nghiệm
- **Email**: `driver@parking.vn`
- **Mật khẩu**: `driver123`

## 🔒 Bảo Mật

### Các Cải Tiến
✅ Không còn lưu mật khẩu plain text trong code  
✅ Xác minh tài khoản từ database SQL  
✅ Hỗ trợ bcrypt password hashing  
✅ Validation tất cả input từ client  

### Khuyến Cáo
- 🚨 **Sử dụng HTTPS** trong production
- 🚨 **Hash mật khẩu** với bcrypt trước khi lưu
- 🚨 **Implement JWT tokens** để thay thế localStorage
- 🚨 **Rate limiting** trên endpoint login

## 📝 File Cấu Hình

### `.env` (Tệp Biến Môi Trường)
```
VITE_API_URL=http://localhost:4000
```

Thay đổi URL tùy theo môi trường:
- **Dev**: `http://localhost:4000`
- **Production**: `https://api.parkflow.com`

## ✅ Kiểm Tra Hoạt Động

**Checklist Kiểm Thử**:
- [ ] Backend server chạy trên port 4000
- [ ] Frontend server chạy trên port 5173  
- [ ] SQL Server khả dụng
- [ ] Tài khoản test tồn tại trong database
- [ ] Đăng nhập thành công với thông tin đúng
- [ ] Lỗi hiển thị khi sai mật khẩu
- [ ] Chuyển hướng đúng theo role:
  - Admin → Admin Dashboard
  - Manager → Manager Dashboard
  - Driver → My Parking
- [ ] Loading spinner xuất hiện khi đăng nhập
- [ ] Logout xóa session

## 🐛 Khắc Phục Sự Cố

| Vấn Đề | Giải Pháp |
|--------|---------|
| "Lỗi kết nối máy chủ" | Check backend chạy ở `localhost:4000/api/health` |
| Đăng nhập luôn thất bại | Kiểm tra user tồn tại trong SQL database |
| Mật khẩu không đúng | Kiểm tra hashing trong backend/server.js |
| CORS error | Kiểm tra CORS config trong backend |

## 📚 Tài Liệu Thêm

Xem chi tiết: [`docs/guides/api_authentication_setup.md`](docs/guides/api_authentication_setup.md)

## 🎯 Các Bước Tiếp Theo

1. **JWT Tokens** - Thay thế localStorage bằng JWT
2. **Multi-Factor Auth** - Xác thực 2 yếu tố
3. **Password Reset** - Tính năng quên mật khẩu
4. **Session Management** - Auto-logout theo thời gian
5. **Rate Limiting** - Chặn brute force attacks

---

**Ngày cập nhật**: 2026-06-16  
**Trạng thái**: ✅ Hoàn thành
