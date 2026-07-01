<!-- API Authentication Setup & Migration Guide -->

# API Authentication Setup & Database Login Migration

## Overview
This document explains how the login system has been migrated from hardcoded mock data to API-based authentication using the SQL database.

## Changes Made

### 1. **New Authentication Service**
- **File**: `src/services/authService.ts`
- Provides `login()` and `register()` methods that call backend API endpoints
- Handles authentication token storage
- Manages error responses from the backend

### 2. **Updated Login Pages**
- **Files**: 
  - `src/pages/public/Login.tsx` - Main login page with database authentication
  - `src/pages/public/Register.tsx` - Registration page with database integration
  - `src/components/LoginView.tsx` - Alternative login view component with API integration

### 3. **Backend API Integration**
- **Login Endpoint**: `POST /api/auth/login`
  - Request: `{ identifier: string, password: string }`
  - Response: `{ message: string, user: { id, fullName, email, phone, role, status, isActive, createdAt } }`
  
- **Register Endpoint**: `POST /api/auth/register`
  - Request: `{ fullName, email, phone, plateNumber, vehicleType, password }`
  - Response: `{ message: string, user: {...} }`

### 4. **Environment Configuration**
- **File**: `.env` (newly created)
- Sets `VITE_API_URL=http://localhost:4000` for local development
- Can be changed to production URL as needed

## Setup Instructions

### Step 1: Ensure Backend is Running
```bash
cd backend
npm install
node server.js
# Server should run on http://localhost:4000
```

### Step 2: Set Up Test Data in SQL Server

The backend automatically creates the database and tables on first run. To add test users, run the SQL INSERT statements:

```sql
-- Direct insert with plain text passwords (for testing only)
INSERT INTO dbo.users (full_name, email, phone, password_hash, role, is_active)
VALUES 
  (N'Admin Hệ Thống', 'admin@parking.vn', '0900000001', 'admin123', 'admin', 1),
  (N'Quản Lý Bãi', 'manager@parking.vn', '0900000002', 'manager123', 'manager', 1),
  (N'Nhân Viên', 'staff@parking.vn', '0900000003', 'staff123', 'staff', 1),
  (N'Lái Xe Thử Nghiệm', 'driver@parking.vn', '0900000004', 'driver123', 'user', 1);
```

**OR** use bcrypt-hashed passwords (more secure). Example using Node.js bcrypt:

```bash
node -e "
const bcrypt = require('bcryptjs');
async function hash() {
  const pwd = process.argv[2];
  const h = await bcrypt.hash(pwd, 10);
  console.log(h);
}
hash();
" password123
```

### Step 3: Start Frontend Development Server
```bash
npm install
npm run dev
# Frontend will be available at http://localhost:5173
```

### Step 4: Test Login with Database

**Test Accounts** (after inserting test data):
- **Email**: `admin@parking.vn` | **Password**: `admin123` | **Role**: System Administrator
- **Email**: `manager@parking.vn` | **Password**: `manager123` | **Role**: Parking Manager
- **Email**: `driver@parking.vn` | **Password**: `driver123` | **Role**: Parking User / Driver

## Key Changes from Original Code

### Before (Hardcoded Mock Data)
```typescript
// Old LoginView.tsx
const user = users.find(
  (u: any) =>
    (u.email?.toLowerCase() === identifier.trim().toLowerCase() ||
      u.phone === identifier.trim()) &&
    u.password === password
);
if (user) {
  onLogin(user);
}
```

### After (API-Based Database Authentication)
```typescript
// New LoginView.tsx
const response = await authService.login({
  identifier: form.identifier,
  password: form.password,
});
onSuccess({
  ...form,
  identifier: form.identifier
});
```

## API Response Mapping

**Database Response** → **Frontend User Object**:
- `id` → `id`
- `full_name` → `fullName`
- `email` → `email`
- `phone` → `phone`
- `role` (normalized) → `role` 
  - "admin" → "System Administrator"
  - "manager" → "Parking Manager"
  - "staff" → "Parking Staff"
  - "user" → "Parking User / Driver"
- `status` → `status` ("Active" | "Inactive")

## Error Handling

### Login Errors
- **400 Bad Request**: Missing identifier or password
- **401 Unauthorized**: Invalid credentials or non-existent user
- **500 Server Error**: Database connection issues

Errors are displayed in user-friendly Vietnamese messages:
- "Email/Số điện thoại hoặc mật khẩu không chính xác."
- "Lỗi kết nối đến máy chủ. Vui lòng thử lại sau."

### Registration Errors
- **409 Conflict**: Email or phone already registered
- **400 Bad Request**: Missing required fields

## Security Notes

⚠️ **Important Security Recommendations**:

1. **Password Storage**: Never store plain text passwords
   - Backend should hash passwords with bcrypt before storing
   - Current backend (`server.js`) uses bcryptjs: `await bcrypt.hash(password, 10)`

2. **HTTPS in Production**: 
   - Change `.env` to use `https://` API URL
   - Implement SSL/TLS certificates

3. **Token Management**:
   - Consider implementing JWT tokens instead of localStorage strings
   - Add token expiration and refresh logic

4. **CORS**: Backend has CORS enabled for development
   - Restrict to specific domains in production

## Testing Checklist

- [ ] Backend server is running on port 4000
- [ ] Frontend server is running on port 5173
- [ ] SQL Server database is accessible
- [ ] Test user accounts are created in database
- [ ] Login works with valid email/phone and password
- [ ] Proper error messages display for invalid credentials
- [ ] User role-based redirects work correctly:
  - Admin → Admin Dashboard
  - Manager → Manager Dashboard
  - Driver → My Parking page
- [ ] Password fields are masked with asterisks
- [ ] Loading spinner appears during login
- [ ] Logout clears user session

## Troubleshooting

### "Lỗi kết nối đến máy chủ" Error
**Solution**: 
1. Check if backend server is running: `http://localhost:4000/api/health`
2. Verify `VITE_API_URL` in `.env` file is correct
3. Check CORS settings in `backend/server.js`

### Login Always Fails (Valid Credentials)
**Solution**:
1. Verify test users exist in SQL Server database
2. Check password hashing in backend - ensure passwords match storage format
3. Check browser console for detailed error messages
4. Verify SQL connection string in `backend/server.js`

### Password Not Hashing Correctly
**Solution**:
1. Backend uses bcryptjs: passwords are compared with `bcrypt.compare()`
2. For plain text testing only, disable hashing temporarily in `server.js`
3. Use proper bcrypt hashing in production

## Next Steps

1. **Implement JWT Tokens**: Replace localStorage with JWT for better security
2. **Add Multi-Factor Authentication**: Implement phone/email verification
3. **Password Reset Flow**: Add forgot password functionality with email verification
4. **Social Login**: Integrate Google/Microsoft authentication
5. **Session Management**: Add session timeout and auto-logout features
6. **Rate Limiting**: Add login attempt rate limiting to prevent brute force attacks

## Related Files

- Backend: `/backend/server.js` - API endpoints implementation
- Database: `/parking.sql` - Database schema and sample data
- Frontend Auth Service: `/src/services/authService.ts` - API communication
- Environment Config: `/.env` - API URL configuration
