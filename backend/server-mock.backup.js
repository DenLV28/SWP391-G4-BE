import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

// Mock database - usuários de teste
const mockUsers = [
  {
    user_id: 1,
    full_name: 'Admin Hệ Thống',
    email: 'admin@parking.vn',
    phone: '0900000001',
    password_hash: 'admin123', // Test only - plain text
    role: 'admin',
    is_active: 1,
    created_at: new Date(),
  },
  {
    user_id: 2,
    full_name: 'Quản Lý Bãi',
    email: 'manager@parking.vn',
    phone: '0900000002',
    password_hash: 'manager123',
    role: 'manager',
    is_active: 1,
    created_at: new Date(),
  },
  {
    user_id: 3,
    full_name: 'Nhân Viên Bãi',
    email: 'staff@parking.vn',
    phone: '0900000003',
    password_hash: 'staff123',
    role: 'staff',
    is_active: 1,
    created_at: new Date(),
  },
  {
    user_id: 4,
    full_name: 'Lái Xe Test',
    email: 'driver@parking.vn',
    phone: '0900000004',
    password_hash: 'driver123',
    role: 'user',
    is_active: 1,
    created_at: new Date(),
  },
];

app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
      <head><title>ParkFlow API</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;padding:24px;">
        <h1>🚗 ParkFlow API (Mock Mode)</h1>
        <p>API đang chạy ở <strong>Mock Mode</strong> (không cần SQL Server)</p>
        <h3>Test Endpoints:</h3>
        <ul>
          <li><a href="/api/health">/api/health</a> - Kiểm tra trạng thái</li>
        </ul>
        <h3>Test Accounts:</h3>
        <table border="1" cellpadding="10">
          <tr><th>Email</th><th>Password</th><th>Role</th></tr>
          <tr><td>admin@parking.vn</td><td>admin123</td><td>System Administrator</td></tr>
          <tr><td>manager@parking.vn</td><td>manager123</td><td>Parking Manager</td></tr>
          <tr><td>staff@parking.vn</td><td>staff123</td><td>Parking Staff</td></tr>
          <tr><td>driver@parking.vn</td><td>driver123</td><td>Parking User / Driver</td></tr>
        </table>
      </body>
    </html>
  `);
});

function normalizeRole(roleValue) {
  if (!roleValue) return 'Parking User / Driver';
  const normalized = String(roleValue).trim().toLowerCase();
  switch (normalized) {
    case 'admin':
    case 'system administrator':
      return 'System Administrator';
    case 'manager':
    case 'parking manager':
      return 'Parking Manager';
    case 'staff':
    case 'parking staff':
      return 'Parking Staff';
    case 'user':
    case 'parking user / driver':
      return 'Parking User / Driver';
    default:
      return String(roleValue);
  }
}

function getSafeUser(record) {
  const isActive = typeof record.is_active !== 'undefined' ? !!record.is_active : true;

  return {
    id: String(record.user_id || ''),
    fullName: record.full_name,
    email: record.email,
    phone: record.phone,
    role: normalizeRole(record.role),
    status: isActive ? 'Active' : 'Inactive',
    isActive,
    createdAt: record.created_at || null,
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'ParkFlow API (Mock Mode)',
    database: 'Mock Database (No SQL Server Required)',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng nhập.' });
    }

    // Find user by email or phone in mock database
    const userRecord = mockUsers.find(
      (u) =>
        u.email.toLowerCase() === identifier.trim().toLowerCase() ||
        u.phone === identifier.trim()
    );

    if (!userRecord) {
      return res.status(401).json({
        error: 'Tài khoản không tồn tại hoặc thông tin không chính xác.',
      });
    }

    // For mock mode, compare passwords directly (in production, use bcrypt.compare)
    const passwordMatch = userRecord.password_hash === password;

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác.' });
    }

    const safeUser = getSafeUser(userRecord);
    return res.json({ message: 'Đăng nhập thành công.', user: safeUser });
  } catch (error) {
    console.error('LOGIN ERROR', error);
    return res.status(500).json({
      error: 'Lỗi máy chủ khi đăng nhập. Vui lòng thử lại sau.',
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, plateNumber, vehicleType, password } = req.body;

    if (!fullName || !email || !phone || !plateNumber || !vehicleType || !password) {
      return res.status(400).json({
        error: 'Thiếu thông tin bắt buộc cho đăng ký.',
      });
    }

    // Check if email or phone already exists in mock database
    const existing = mockUsers.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() ||
        u.phone === phone.trim()
    );

    if (existing) {
      if (existing.email.toLowerCase() === email.trim().toLowerCase()) {
        return res.status(409).json({ error: 'Email này đã được đăng ký.' });
      }
      if (existing.phone === phone.trim()) {
        return res.status(409).json({ error: 'Số điện thoại này đã được đăng ký.' });
      }
      return res.status(409).json({ error: 'Thông tin đăng ký đã tồn tại.' });
    }

    // Create new user
    const newUser = {
      user_id: mockUsers.length + 1,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password_hash: password, // In production, hash this with bcrypt
      role: 'user',
      is_active: 1,
      created_at: new Date(),
    };

    // Add to mock database
    mockUsers.push(newUser);

    const safeUser = getSafeUser(newUser);
    return res.status(201).json({
      message: 'Đăng ký thành công.',
      user: safeUser,
    });
  } catch (error) {
    console.error('REGISTER ERROR', error);
    return res.status(500).json({
      error: 'Lỗi máy chủ khi tạo tài khoản. Vui lòng thử lại sau.',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚗 ParkFlow API - Mock Mode Ready    ║
╚════════════════════════════════════════╝

✅ Server running on http://0.0.0.0:${PORT}
📍 Local:   http://localhost:${PORT}
📍 Network: http://localhost:${PORT}

ℹ️  Mode: MOCK (No SQL Server Required)
ℹ️  Status: http://localhost:${PORT}/api/health

📝 Test Accounts:
   - admin@parking.vn / admin123
   - manager@parking.vn / manager123
   - staff@parking.vn / staff123
   - driver@parking.vn / driver123

Press Ctrl+C to stop the server
  `);
});
