import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import sql from 'mssql';
import crypto from 'crypto';
import os from 'os';

const PORT = process.env.PORT || 4000;

// ── VNPay Config ─────────────────────────────────────────────────────────────
// Đăng ký sandbox tại: https://sandbox.vnpayment.vn/devreg/
// Thay tmnCode và hashSecret bằng thông tin từ tài khoản sandbox của bạn
const VNPAY_CONFIG = {
  tmnCode:    'WHAC49QH',
  hashSecret: '3KA9IQPZ7ZYH73FJXBV9J650S4YQHLDK',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl:  'http://localhost:4000/api/vnpay/return',
  frontendUrl:'http://localhost:5173',
};
const SQL_CONFIG = {
  authentication: {
    type: 'default',
    options: {
      userName: 'sa',
      password: '12345',
    },
  },
  server: 'localhost',
  options: {
    database: 'parking_management',
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const app = express();
app.set('trust proxy', true);
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

const DEFAULT_PASSWORD = '123456';

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  }
  return next(err);
});

app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
      <head><title>ParkFlow API</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;padding:24px;">
        <h1>ParkFlow API</h1>
        <p>API đang chạy. Kiểm tra <a href="/api/health">/api/health</a> để xem trạng thái.</p>
      </body>
    </html>
  `);
});

let pool;

async function createDatabase() {
  const masterConfig = { ...SQL_CONFIG, database: 'master' };
  const masterPool = await new sql.ConnectionPool(masterConfig).connect();
  await masterPool.request().query(`
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${SQL_CONFIG.database}')
    BEGIN
      CREATE DATABASE ${SQL_CONFIG.database};
    END
  `);
  await masterPool.close();
}

async function createTables() {
  // users
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.users (
        user_id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(200) NOT NULL,
        email NVARCHAR(200) NOT NULL UNIQUE,
        phone NVARCHAR(50) NOT NULL UNIQUE,
        password_hash NVARCHAR(200) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'user',
        status NVARCHAR(20) NOT NULL DEFAULT 'Active',
        is_active BIT NOT NULL DEFAULT 1,
        assigned_parking_lot NVARCHAR(200) NOT NULL DEFAULT '',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.users', 'status') IS NULL
      BEGIN
        ALTER TABLE dbo.users
        ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT 'Active';
      END
      IF COL_LENGTH('dbo.users', 'assigned_parking_lot') IS NULL
      BEGIN
        ALTER TABLE dbo.users
        ADD assigned_parking_lot NVARCHAR(200) NOT NULL CONSTRAINT DF_users_assigned_parking_lot DEFAULT '';
      END
    END
  `);

  // vehicles — user_id stored as NVARCHAR to support both integer IDs and mock string IDs
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vehicles' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.vehicles (
        vehicle_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(50) NOT NULL,
        license_plate NVARCHAR(50) NOT NULL,
        vehicle_type NVARCHAR(50) NOT NULL,
        brand NVARCHAR(100) NOT NULL DEFAULT '',
        model NVARCHAR(100) NOT NULL DEFAULT '',
        is_default BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_vehicles_user_id ON dbo.vehicles(user_id);
    END
  `);

  // reservations
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'reservations' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.reservations (
        reservation_id INT IDENTITY(1,1) PRIMARY KEY,
        reservation_code NVARCHAR(50) NOT NULL UNIQUE,
        user_id NVARCHAR(50) NOT NULL,
        reservation_type NVARCHAR(50) NOT NULL DEFAULT 'Flexible',
        slot_assignment_mode NVARCHAR(20) NOT NULL DEFAULT 'Auto',
        vehicle_type NVARCHAR(50) NOT NULL,
        license_plate NVARCHAR(50) NOT NULL,
        date NVARCHAR(20) NOT NULL,
        start_time NVARCHAR(10) NOT NULL,
        end_time NVARCHAR(10) NOT NULL DEFAULT '',
        floor NVARCHAR(50) NOT NULL DEFAULT '',
        area NVARCHAR(50) NOT NULL DEFAULT '',
        slot_code NVARCHAR(50) NOT NULL DEFAULT '',
        status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        note NVARCHAR(500) NOT NULL DEFAULT '',
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_reservations_user_id ON dbo.reservations(user_id);
    END
  `);

  // parking_sessions
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parking_sessions' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.parking_sessions (
        session_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(50) NOT NULL,
        ticket_code NVARCHAR(50) NOT NULL UNIQUE,
        license_plate NVARCHAR(50) NOT NULL,
        vehicle_type NVARCHAR(50) NOT NULL,
        check_in_time NVARCHAR(30) NOT NULL DEFAULT '',
        check_out_time NVARCHAR(30) NOT NULL DEFAULT '',
        expected_end_time NVARCHAR(30) NOT NULL DEFAULT '',
        entry_gate NVARCHAR(50) NOT NULL DEFAULT '',
        floor NVARCHAR(50) NOT NULL DEFAULT '',
        area NVARCHAR(50) NOT NULL DEFAULT '',
        slot_code NVARCHAR(50) NOT NULL DEFAULT '',
        estimated_fee FLOAT NOT NULL DEFAULT 0,
        payment_status NVARCHAR(50) NOT NULL DEFAULT 'Unpaid',
        payment_method NVARCHAR(50) NOT NULL DEFAULT 'Cash',
        session_status NVARCHAR(50) NOT NULL DEFAULT 'Active',
        barrier_status NVARCHAR(20) NOT NULL DEFAULT 'Closed',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_sessions_user_id ON dbo.parking_sessions(user_id);
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.parking_sessions', 'payment_method') IS NULL
      BEGIN
        ALTER TABLE dbo.parking_sessions ADD payment_method NVARCHAR(50) NOT NULL DEFAULT 'Cash';
      END
    END
  `);

  // payments — drop old schema from parking.sql if present (different columns)
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'payments' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      IF COL_LENGTH('dbo.payments', 'payment_code') IS NULL
      BEGIN
        DROP TABLE dbo.payments;
      END
    END
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'payments' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.payments (
        payment_id INT IDENTITY(1,1) PRIMARY KEY,
        payment_code NVARCHAR(50) NOT NULL UNIQUE,
        user_id NVARCHAR(50) NOT NULL,
        ticket_code NVARCHAR(50) NOT NULL DEFAULT '',
        parking_fee FLOAT NOT NULL DEFAULT 0,
        extra_service_fee FLOAT NOT NULL DEFAULT 0,
        lost_ticket_fee FLOAT NOT NULL DEFAULT 0,
        overtime_fee FLOAT NOT NULL DEFAULT 0,
        discount FLOAT NOT NULL DEFAULT 0,
        total_amount FLOAT NOT NULL DEFAULT 0,
        method NVARCHAR(50) NOT NULL DEFAULT 'Cash',
        status NVARCHAR(50) NOT NULL DEFAULT 'Unpaid',
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        paid_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_payments_user_id ON dbo.payments(user_id);
    END
  `);

  // parking_slots — schema matches parking.sql (floor, zone, notes)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parking_slots' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.parking_slots (
        slot_id      INT IDENTITY(1,1) PRIMARY KEY,
        slot_code    NVARCHAR(20)  NOT NULL UNIQUE,
        floor        INT           NOT NULL DEFAULT 1,
        zone         NVARCHAR(10)  NOT NULL DEFAULT 'A',
        vehicle_type NVARCHAR(50)  NOT NULL DEFAULT N'Xe máy / Xe máy điện',
        status       NVARCHAR(20)  NOT NULL DEFAULT 'Available',
        notes        NVARCHAR(255) NOT NULL DEFAULT ''
      );
    END
    ELSE
    BEGIN
      -- Auto-migrate if table was created by old server.js (has floor_name instead of floor)
      IF COL_LENGTH('dbo.parking_slots', 'floor_name') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.parking_slots', 'floor') IS NULL
          ALTER TABLE dbo.parking_slots ADD floor INT NOT NULL DEFAULT 1;
        IF COL_LENGTH('dbo.parking_slots', 'zone') IS NULL
          ALTER TABLE dbo.parking_slots ADD zone NVARCHAR(10) NOT NULL DEFAULT 'A';
        ALTER TABLE dbo.parking_slots DROP COLUMN floor_name;
        ALTER TABLE dbo.parking_slots DROP COLUMN area_name;
        IF COL_LENGTH('dbo.parking_slots', 'nearest_gate') IS NOT NULL
          ALTER TABLE dbo.parking_slots DROP COLUMN nearest_gate;
        IF COL_LENGTH('dbo.parking_slots', 'updated_at') IS NOT NULL
          ALTER TABLE dbo.parking_slots DROP COLUMN updated_at;
      END
    END
  `);

  // slot_issues
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'slot_issues' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.slot_issues (
        issue_id     INT IDENTITY(1,1) PRIMARY KEY,
        slot_code    NVARCHAR(20)  NOT NULL,
        issue_type   NVARCHAR(50)  NOT NULL,
        description  NVARCHAR(500) NOT NULL DEFAULT '',
        image_url    NVARCHAR(MAX) NOT NULL DEFAULT '',
        reported_by  NVARCHAR(100) NOT NULL DEFAULT '',
        reported_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        status       NVARCHAR(20)  NOT NULL DEFAULT 'Pending'
          CHECK (status IN ('Pending','Approved','Rejected'))
      );
    END
  `);

  // pricing_rules
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'pricing_rules' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.pricing_rules (
        rule_id      INT IDENTITY(1,1) PRIMARY KEY,
        vehicle_type NVARCHAR(50)  NOT NULL UNIQUE,
        vehicle_key  NVARCHAR(50)  NOT NULL DEFAULT '',
        icon         NVARCHAR(20)  NOT NULL DEFAULT N'🚗',
        description  NVARCHAR(200) NOT NULL DEFAULT '',
        hourly_price FLOAT         NOT NULL DEFAULT 0,
        overnight_price FLOAT      NOT NULL DEFAULT 0,
        monthly_price FLOAT        NOT NULL DEFAULT 0,
        status       NVARCHAR(20)  NOT NULL DEFAULT 'active',
        updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      INSERT INTO dbo.pricing_rules (vehicle_type, vehicle_key, icon, description, hourly_price, overnight_price, monthly_price, status)
      VALUES
        (N'Xe máy / Xe máy điện',      'motorbike',        N'🏍️', N'Mô tô, tay ga, xe điện 2 bánh', 5000,  10000,  150000,  'active'),
        (N'Ô tô 4-7 chỗ (Xăng)',       'car',              N'🚗', N'Sedan, SUV, Hatchback',          25000, 80000,  1200000, 'active'),
        (N'Ô tô 4-7 chỗ (Điện / EV)',  'electric vehicle', N'⚡', N'EV + trạm sạc kèm theo',         30000, 100000, 1800000, 'active');
    END
  `);

  // feedbacks
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'feedbacks' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.feedbacks (
        feedback_id INT IDENTITY(1,1) PRIMARY KEY,
        feedback_code NVARCHAR(50) NOT NULL UNIQUE,
        user_id NVARCHAR(50) NOT NULL,
        type NVARCHAR(100) NOT NULL,
        ticket_code NVARCHAR(50) NOT NULL DEFAULT '',
        description NVARCHAR(1000) NOT NULL DEFAULT '',
        priority NVARCHAR(20) NOT NULL DEFAULT 'Low',
        status NVARCHAR(50) NOT NULL DEFAULT 'New',
        attachment_url NVARCHAR(MAX) NOT NULL DEFAULT '',
        staff_response NVARCHAR(1000) NOT NULL DEFAULT '',
        staff_responded_at NVARCHAR(30) NOT NULL DEFAULT '',
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_feedbacks_user_id ON dbo.feedbacks(user_id);
    END
  `);
}

const INITIAL_SLOTS = [
  // Row A — Ô tô 4-7 chỗ (Xăng), floor 2, zone A
  { slotCode: 'F1-A01', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available'   },
  { slotCode: 'F1-A02', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Occupied'    },
  { slotCode: 'F1-A03', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Occupied'    },
  { slotCode: 'F1-A04', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Maintenance' },
  { slotCode: 'F1-A05', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available'   },
  { slotCode: 'F1-A06', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Occupied'    },
  { slotCode: 'F1-A07', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Occupied'    },
  { slotCode: 'F1-A08', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Locked'      },
  { slotCode: 'F1-A09', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available'   },
  { slotCode: 'F1-A10', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Occupied'    },
  { slotCode: 'F1-A11', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Maintenance' },
  // Row B — Xe máy / Xe máy điện, floor 1, zone A
  { slotCode: 'F1-B01', floor: 1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện', status: 'Available'   },
  { slotCode: 'F1-B02', floor: 1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện', status: 'Occupied'    },
  { slotCode: 'F1-B03', floor: 1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện', status: 'Available'   },
  { slotCode: 'F1-B04', floor: 1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện', status: 'Available'   },
  { slotCode: 'F1-B05', floor: 1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện', status: 'Available'   },
  // Row C — Ô tô 4-7 chỗ (Điện / EV), floor 1, zone C
  { slotCode: 'F1-C01', floor: 1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)', status: 'Available' },
  { slotCode: 'F1-C02', floor: 1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)', status: 'Available' },
  { slotCode: 'F1-C03', floor: 1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)', status: 'Available' },
  { slotCode: 'F1-C04', floor: 1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)', status: 'Available' },
  { slotCode: 'F1-C05', floor: 1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)', status: 'Available' },
  // Row D — Ô tô 4-7 chỗ (Xăng), floor -1, zone A
  { slotCode: 'F1-D01', floor: -1, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available' },
  { slotCode: 'F1-D02', floor: -1, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available' },
  { slotCode: 'F1-D03', floor: -1, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available' },
  { slotCode: 'F1-D04', floor: -1, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available' },
  // Row E — Xe máy / Xe máy điện, floor 1, zone B
  { slotCode: 'F1-E01', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Occupied'  },
  { slotCode: 'F1-E02', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E03', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E04', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E05', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E06', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E07', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E08', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E09', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E10', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
  { slotCode: 'F1-E11', floor: 1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện', status: 'Available' },
];

async function seedSlots() {
  // INSERT-IF-NOT-EXISTS for every slot so missing rows are added on each server start.
  // Existing rows keep their current status (not overwritten).
  for (const s of INITIAL_SLOTS) {
    await pool.request()
      .input('slot_code',    sql.NVarChar, s.slotCode)
      .input('floor',        sql.Int,      s.floor)
      .input('zone',         sql.NVarChar, s.zone)
      .input('vehicle_type', sql.NVarChar, s.vehicleType)
      .input('status',       sql.NVarChar, s.status)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.parking_slots WHERE slot_code = @slot_code)
          INSERT INTO dbo.parking_slots (slot_code, floor, zone, vehicle_type, status)
          VALUES (@slot_code, @floor, @zone, @vehicle_type, @status)
      `);
  }
}

async function initDatabase() {
  await createDatabase();
  pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
  await createTables();
  await seedSlots();
  await migrateLegacyPasswords();
  await ensureDemoAccounts();
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

async function migrateLegacyPasswords() {
  const result = await pool.request().query(`
    SELECT user_id, email, password_hash
    FROM dbo.users
  `);

  for (const row of result.recordset) {
    if (!isBcryptHash(row.password_hash)) {
      const newHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      await pool.request()
        .input('id', sql.Int, row.user_id)
        .input('password_hash', sql.NVarChar, newHash)
        .query(`
          UPDATE dbo.users
          SET password_hash = @password_hash
          WHERE user_id = @id
        `);
    }
  }
}

async function ensureDemoAccounts() {
  const demoAccounts = [
    { fullName: 'Admin Hệ Thống', email: 'admin@parking.vn', phone: '0900000001', role: 'admin', status: 'Active', password: '123456' },
    { fullName: 'Nguyễn Văn Quản', email: 'manager@parking.vn', phone: '0900000002', role: 'manager', status: 'Active', password: '123456' },
    { fullName: 'Trần Thị Nhân Viên', email: 'staff@parking.vn', phone: '0900000003', role: 'staff', status: 'Active', password: '123456' },
    { fullName: 'Lái Xe Thử Nghiệm', email: 'driver@parking.vn', phone: '0900000004', role: 'user', status: 'Active', password: '123456' },
  ];

  for (const account of demoAccounts) {
    const existing = await pool.request()
      .input('email', sql.NVarChar, account.email)
      .query(`SELECT TOP 1 user_id FROM dbo.users WHERE email = @email`);

    const passwordHash = await bcrypt.hash(account.password, 10);
    const normalizedRole = normalizeRoleForStorage(account.role);
    const isActive = account.status !== 'Locked';

    if (existing.recordset.length === 0) {
      await pool.request()
        .input('full_name', sql.NVarChar, account.fullName)
        .input('email', sql.NVarChar, account.email)
        .input('phone', sql.NVarChar, account.phone)
        .input('password_hash', sql.NVarChar, passwordHash)
        .input('role', sql.NVarChar, normalizedRole)
        .input('status', sql.NVarChar, account.status)
        .input('is_active', sql.Bit, isActive)
        .query(`
          INSERT INTO dbo.users (full_name, email, phone, password_hash, role, status, is_active)
          VALUES (@full_name, @email, @phone, @password_hash, @role, @status, @is_active)
        `);
    } else {
      await pool.request()
        .input('email', sql.NVarChar, account.email)
        .input('phone', sql.NVarChar, account.phone)
        .input('password_hash', sql.NVarChar, passwordHash)
        .input('role', sql.NVarChar, normalizedRole)
        .input('status', sql.NVarChar, account.status)
        .input('is_active', sql.Bit, isActive)
        .query(`
          UPDATE dbo.users
          SET phone = @phone, password_hash = @password_hash, role = @role,
              status = @status, is_active = @is_active
          WHERE email = @email
        `);
    }
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeRole(roleValue) {
  if (!roleValue) return 'Parking User / Driver';
  const v = String(roleValue).trim().toLowerCase();
  switch (v) {
    case 'system administrator': case 'admin': case 'administrator': return 'System Administrator';
    case 'parking manager': case 'manager': return 'Parking Manager';
    case 'parking staff': case 'staff': return 'Parking Staff';
    default: return 'Parking User / Driver';
  }
}

function normalizeRoleForStorage(roleValue) {
  const v = String(roleValue || '').trim().toLowerCase();
  switch (v) {
    case 'system administrator': case 'admin': case 'administrator': return 'admin';
    case 'parking manager': case 'manager': return 'manager';
    case 'parking staff': case 'staff': return 'staff';
    default: return 'user';
  }
}

function normalizeStatus(record) {
  const explicit = (record.status || record.Status || '').toString().trim();
  if (explicit) {
    const n = explicit.toLowerCase();
    if (n === 'active' || n === 'inactive' || n === 'locked') {
      return explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
    }
  }
  const isActive = typeof record.is_active !== 'undefined' ? !!record.is_active : true;
  return isActive ? 'Active' : 'Locked';
}

function getSafeUser(record) {
  const status = normalizeStatus(record);
  return {
    id: String(record.user_id || record.Id || ''),
    fullName: record.full_name || record.FullName,
    email: record.email || record.Email,
    phone: record.phone || record.Phone,
    role: normalizeRole(record.role || record.Role),
    status,
    isActive: status === 'Active' || status === 'Inactive',
    assignedParkingLot: record.assigned_parking_lot || '',
    createdAt: record.created_at || record.CreatedAt || null,
  };
}

function nowStr() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

// ─── health ─────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const nets = os.networkInterfaces();
  const lanIPs = [];
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) lanIPs.push(iface.address);
    }
  }
  res.json({ status: 'ok', backend: 'ParkFlow API', database: SQL_CONFIG.database, lanIPs });
});

// ─── users ──────────────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at
      FROM dbo.users ORDER BY created_at DESC
    `);
    return res.json(result.recordset.map(getSafeUser));
  } catch (err) {
    console.error('GET /api/users', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải danh sách người dùng.' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { fullName, email, phone, role, status, password, assignedParkingLot } = req.body;
    if (!fullName || !email || !phone || !role)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const passwordHash = await bcrypt.hash(password || '123456', 10);
    const normalizedRole = normalizeRoleForStorage(role);
    const normalizedStatus = ['Active', 'Inactive', 'Locked'].includes(status) ? status : 'Active';
    const lotValue = (assignedParkingLot || '').trim();

    const dup = await pool.request()
      .input('email', sql.NVarChar, cleanEmail)
      .input('phone', sql.NVarChar, cleanPhone)
      .query(`SELECT email, phone FROM dbo.users WHERE email = @email OR phone = @phone`);
    if (dup.recordset.length > 0) {
      const c = dup.recordset[0];
      if ((c.email || '').toLowerCase() === cleanEmail.toLowerCase())
        return res.status(409).json({ error: 'Email này đã được đăng ký.' });
      return res.status(409).json({ error: 'Số điện thoại này đã được đăng ký.' });
    }

    const ins = await pool.request()
      .input('full_name', sql.NVarChar, fullName.trim())
      .input('email', sql.NVarChar, cleanEmail)
      .input('phone', sql.NVarChar, cleanPhone)
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, normalizedRole)
      .input('status', sql.NVarChar, normalizedStatus)
      .input('is_active', sql.Bit, normalizedStatus !== 'Locked')
      .input('assigned_parking_lot', sql.NVarChar, lotValue)
      .query(`
        INSERT INTO dbo.users (full_name, email, phone, password_hash, role, status, is_active, assigned_parking_lot)
        OUTPUT inserted.user_id, inserted.full_name, inserted.email, inserted.phone,
               inserted.role, inserted.status, inserted.is_active, inserted.assigned_parking_lot, inserted.created_at
        VALUES (@full_name, @email, @phone, @password_hash, @role, @status, @is_active, @assigned_parking_lot)
      `);
    return res.status(201).json({ user: getSafeUser(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/users', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo người dùng.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fullName, email, phone, role, status, assignedParkingLot } = req.body;

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at FROM dbo.users WHERE user_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    const ex = cur.recordset[0];

    const nextEmail = email ? email.trim() : ex.email;
    const nextPhone = phone ? phone.trim() : ex.phone;
    const nextStatus = ['Active', 'Inactive', 'Locked'].includes(status) ? status : ex.status || 'Active';
    const nextRole = role ? normalizeRoleForStorage(role) : ex.role;
    const nextLot = assignedParkingLot !== undefined ? assignedParkingLot.trim() : (ex.assigned_parking_lot || '');

    if (email || phone) {
      const dup = await pool.request()
        .input('id', sql.Int, id)
        .input('email', sql.NVarChar, nextEmail)
        .input('phone', sql.NVarChar, nextPhone)
        .query(`SELECT user_id FROM dbo.users WHERE (email = @email OR phone = @phone) AND user_id <> @id`);
      if (dup.recordset.length) return res.status(409).json({ error: 'Email hoặc số điện thoại đã tồn tại.' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('full_name', sql.NVarChar, fullName ? fullName.trim() : ex.full_name)
      .input('email', sql.NVarChar, nextEmail)
      .input('phone', sql.NVarChar, nextPhone)
      .input('role', sql.NVarChar, nextRole)
      .input('status', sql.NVarChar, nextStatus)
      .input('is_active', sql.Bit, nextStatus !== 'Locked')
      .input('assigned_parking_lot', sql.NVarChar, nextLot)
      .query(`UPDATE dbo.users SET full_name=@full_name, email=@email, phone=@phone, role=@role, status=@status, is_active=@is_active, assigned_parking_lot=@assigned_parking_lot WHERE user_id=@id`);

    const upd = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at FROM dbo.users WHERE user_id=@id`);
    return res.json({ user: getSafeUser(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/users/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật người dùng.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.users WHERE user_id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    return res.json({ message: 'Xóa người dùng thành công.' });
  } catch (err) {
    console.error('DELETE /api/users/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa người dùng.' });
  }
});

// ─── auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, plateNumber, vehicleType, brand, model, password } = req.body;
    if (!fullName || !email || !phone || !plateNumber || !vehicleType || !password)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc cho đăng ký.' });

    const existing = await pool.request()
      .input('email', sql.NVarChar, email.trim())
      .input('phone', sql.NVarChar, phone.trim())
      .query(`SELECT email, phone FROM dbo.users WHERE email = @email OR phone = @phone`);
    if (existing.recordset.length > 0) {
      const c = existing.recordset[0];
      if ((c.email || '').toLowerCase() === email.trim().toLowerCase())
        return res.status(409).json({ error: 'Email này đã được đăng ký.' });
      if ((c.phone || '') === phone.trim())
        return res.status(409).json({ error: 'Số điện thoại này đã được đăng ký.' });
      return res.status(409).json({ error: 'Thông tin đăng ký đã tồn tại.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ins = await pool.request()
      .input('full_name', sql.NVarChar, fullName.trim())
      .input('email', sql.NVarChar, email.trim())
      .input('phone', sql.NVarChar, phone.trim())
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, 'user')
      .input('is_active', sql.Bit, 1)
      .query(`
        INSERT INTO dbo.users (full_name, email, phone, password_hash, role, is_active)
        OUTPUT inserted.user_id, inserted.full_name, inserted.email, inserted.phone,
               inserted.role, inserted.is_active, inserted.created_at
        VALUES (@full_name, @email, @phone, @password_hash, @role, @is_active)
      `);

    const user = getSafeUser(ins.recordset[0]);

    // auto-create vehicle for new user
    if (plateNumber && vehicleType) {
      await pool.request()
        .input('user_id', sql.NVarChar, user.id)
        .input('license_plate', sql.NVarChar, plateNumber.trim())
        .input('vehicle_type', sql.NVarChar, vehicleType)
        .input('brand', sql.NVarChar, (brand || '').trim())
        .input('model', sql.NVarChar, (model || '').trim())
        .input('is_default', sql.Bit, 1)
        .query(`
          INSERT INTO dbo.vehicles (user_id, license_plate, vehicle_type, brand, model, is_default)
          VALUES (@user_id, @license_plate, @vehicle_type, @brand, @model, @is_default)
        `);
    }

    return res.status(201).json({ message: 'Đăng ký thành công.', user });
  } catch (err) {
    console.error('POST /api/auth/register', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo tài khoản. Vui lòng thử lại sau.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập.' });

    const query = await pool.request()
      .input('identifier', sql.NVarChar, identifier.trim())
      .query(`
        SELECT TOP 1 user_id, full_name, email, phone, password_hash, role, status, is_active, created_at
        FROM dbo.users WHERE email = @identifier OR phone = @identifier
      `);
    const userRecord = query.recordset[0];
    if (!userRecord) return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc thông tin không chính xác.' });

    const passwordHash = userRecord.password_hash || '';
    let passwordMatch = false;
    if (isBcryptHash(passwordHash)) {
      passwordMatch = await bcrypt.compare(password, passwordHash);
    } else {
      passwordMatch = password === passwordHash || password === DEFAULT_PASSWORD;
    }
    if (!passwordMatch) return res.status(401).json({ error: 'Mật khẩu không chính xác.' });

    const safeUser = getSafeUser(userRecord);
    if (safeUser.status !== 'Active') return res.status(403).json({ error: 'Tài khoản đã bị khóa hoặc bị vô hiệu hóa.' });

    return res.json({ message: 'Đăng nhập thành công.', user: safeUser });
  } catch (err) {
    console.error('POST /api/auth/login', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập. Vui lòng thử lại.' });
  }
});

// ─── vehicles ────────────────────────────────────────────────────────────────

function toVehicleDto(r) {
  return {
    id: String(r.vehicle_id),
    userId: String(r.user_id),
    licensePlate: r.license_plate,
    vehicleType: r.vehicle_type,
    brand: r.brand || '',
    model: r.model || '',
    isDefault: !!r.is_default,
  };
}

app.get('/api/vehicles', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    const r = await pool.request()
      .input('user_id', sql.NVarChar, String(userId))
      .query(`SELECT * FROM dbo.vehicles WHERE user_id = @user_id ORDER BY is_default DESC, created_at ASC`);
    return res.json(r.recordset.map(toVehicleDto));
  } catch (err) {
    console.error('GET /api/vehicles', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải phương tiện.' });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const { userId, licensePlate, vehicleType, brand, model, isDefault } = req.body;
    if (!userId || !licensePlate || !vehicleType) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    if (isDefault) {
      await pool.request().input('user_id', sql.NVarChar, String(userId))
        .query(`UPDATE dbo.vehicles SET is_default = 0 WHERE user_id = @user_id`);
    }

    const ins = await pool.request()
      .input('user_id', sql.NVarChar, String(userId))
      .input('license_plate', sql.NVarChar, licensePlate.trim())
      .input('vehicle_type', sql.NVarChar, vehicleType)
      .input('brand', sql.NVarChar, (brand || '').trim())
      .input('model', sql.NVarChar, (model || '').trim())
      .input('is_default', sql.Bit, isDefault ? 1 : 0)
      .query(`
        INSERT INTO dbo.vehicles (user_id, license_plate, vehicle_type, brand, model, is_default)
        OUTPUT inserted.*
        VALUES (@user_id, @license_plate, @vehicle_type, @brand, @model, @is_default)
      `);
    return res.status(201).json({ vehicle: toVehicleDto(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/vehicles', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo phương tiện.' });
  }
});

app.put('/api/vehicles/:id/default', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const veh = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id FROM dbo.vehicles WHERE vehicle_id = @id`);
    if (!veh.recordset.length) return res.status(404).json({ error: 'Không tìm thấy phương tiện.' });

    const userId = veh.recordset[0].user_id;
    await pool.request().input('user_id', sql.NVarChar, String(userId))
      .query(`UPDATE dbo.vehicles SET is_default = 0 WHERE user_id = @user_id`);
    await pool.request().input('id', sql.Int, id)
      .query(`UPDATE dbo.vehicles SET is_default = 1 WHERE vehicle_id = @id`);
    return res.json({ message: 'Đã đặt phương tiện mặc định.' });
  } catch (err) {
    console.error('PUT /api/vehicles/:id/default', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật phương tiện.' });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.vehicles WHERE vehicle_id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy phương tiện.' });
    return res.json({ message: 'Đã xóa phương tiện.' });
  } catch (err) {
    console.error('DELETE /api/vehicles/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa phương tiện.' });
  }
});

// ─── reservations ────────────────────────────────────────────────────────────

function toReservationDto(r) {
  return {
    id: String(r.reservation_id),
    userId: String(r.user_id),
    reservationCode: r.reservation_code,
    reservationType: r.reservation_type || 'Flexible',
    slotAssignmentMode: r.slot_assignment_mode || 'Auto',
    vehicleType: r.vehicle_type,
    licensePlate: r.license_plate,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time || '',
    floor: r.floor || '',
    area: r.area || '',
    slotCode: r.slot_code || '',
    status: r.status,
    note: r.note || '',
    createdAt: r.created_at || '',
  };
}

app.get('/api/reservations', async (req, res) => {
  try {
    const { userId } = req.query;
    let query;
    if (userId) {
      query = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .query(`SELECT * FROM dbo.reservations WHERE user_id = @user_id ORDER BY db_created_at DESC`);
    } else {
      query = await pool.request()
        .query(`SELECT * FROM dbo.reservations ORDER BY db_created_at DESC`);
    }
    return res.json(query.recordset.map(toReservationDto));
  } catch (err) {
    console.error('GET /api/reservations', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải đặt chỗ.' });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const {
      id, userId, reservationCode, reservationType, slotAssignmentMode,
      vehicleType, licensePlate, date, startTime, endTime,
      floor, area, slotCode, status, note, createdAt,
    } = req.body;

    if (!userId || !vehicleType || !licensePlate || !date || !startTime)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    const code = reservationCode || `RES-${Date.now()}`;
    const ins = await pool.request()
      .input('reservation_code', sql.NVarChar, code)
      .input('user_id', sql.NVarChar, String(userId))
      .input('reservation_type', sql.NVarChar, reservationType || 'Flexible')
      .input('slot_assignment_mode', sql.NVarChar, slotAssignmentMode || 'Auto')
      .input('vehicle_type', sql.NVarChar, vehicleType)
      .input('license_plate', sql.NVarChar, licensePlate)
      .input('date', sql.NVarChar, date)
      .input('start_time', sql.NVarChar, startTime)
      .input('end_time', sql.NVarChar, endTime || '')
      .input('floor', sql.NVarChar, floor || '')
      .input('area', sql.NVarChar, area || '')
      .input('slot_code', sql.NVarChar, slotCode || '')
      .input('status', sql.NVarChar, status || 'Pending')
      .input('note', sql.NVarChar, note || '')
      .input('created_at', sql.NVarChar, createdAt || nowStr())
      .query(`
        INSERT INTO dbo.reservations
          (reservation_code, user_id, reservation_type, slot_assignment_mode, vehicle_type, license_plate,
           date, start_time, end_time, floor, area, slot_code, status, note, created_at)
        OUTPUT inserted.*
        VALUES
          (@reservation_code, @user_id, @reservation_type, @slot_assignment_mode, @vehicle_type, @license_plate,
           @date, @start_time, @end_time, @floor, @area, @slot_code, @status, @note, @created_at)
      `);
    return res.status(201).json({ reservation: toReservationDto(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/reservations', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo đặt chỗ.' });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // id can be either the DB integer or the frontend string code — try both
    let cur;
    const numericId = Number(id);
    if (!isNaN(numericId) && numericId > 0) {
      cur = await pool.request().input('id', sql.Int, numericId)
        .query(`SELECT * FROM dbo.reservations WHERE reservation_id = @id`);
    }
    if (!cur || !cur.recordset.length) {
      cur = await pool.request().input('code', sql.NVarChar, id)
        .query(`SELECT * FROM dbo.reservations WHERE reservation_code = @code`);
    }
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy đặt chỗ.' });

    const ex = cur.recordset[0];
    const { status, note, slotCode, endTime } = req.body;

    await pool.request()
      .input('id', sql.Int, ex.reservation_id)
      .input('status', sql.NVarChar, status !== undefined ? status : ex.status)
      .input('note', sql.NVarChar, note !== undefined ? note : ex.note)
      .input('slot_code', sql.NVarChar, slotCode !== undefined ? slotCode : ex.slot_code)
      .input('end_time', sql.NVarChar, endTime !== undefined ? endTime : ex.end_time)
      .query(`UPDATE dbo.reservations SET status=@status, note=@note, slot_code=@slot_code, end_time=@end_time WHERE reservation_id=@id`);

    const upd = await pool.request().input('id', sql.Int, ex.reservation_id)
      .query(`SELECT * FROM dbo.reservations WHERE reservation_id=@id`);
    return res.json({ reservation: toReservationDto(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/reservations/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật đặt chỗ.' });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    let r;
    if (!isNaN(numericId) && numericId > 0) {
      r = await pool.request().input('id', sql.Int, numericId)
        .query(`DELETE FROM dbo.reservations WHERE reservation_id = @id`);
    } else {
      r = await pool.request().input('code', sql.NVarChar, id)
        .query(`DELETE FROM dbo.reservations WHERE reservation_code = @code`);
    }
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy đặt chỗ.' });
    return res.json({ message: 'Đã xóa đặt chỗ.' });
  } catch (err) {
    console.error('DELETE /api/reservations/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa đặt chỗ.' });
  }
});

// ─── parking sessions ────────────────────────────────────────────────────────

function toSessionDto(r) {
  return {
    id: String(r.session_id),
    userId: String(r.user_id),
    ticketCode: r.ticket_code,
    licensePlate: r.license_plate,
    vehicleType: r.vehicle_type,
    checkInTime: r.check_in_time || '',
    checkOutTime: r.check_out_time || '',
    expectedEndTime: r.expected_end_time || '',
    entryGate: r.entry_gate || '',
    floor: r.floor || '',
    area: r.area || '',
    slotCode: r.slot_code || '',
    estimatedFee: r.estimated_fee || 0,
    paymentStatus: r.payment_status || 'Unpaid',
    paymentMethod: r.payment_method || 'Cash',
    sessionStatus: r.session_status || 'Active',
    barrierStatus: r.barrier_status || 'Closed',
  };
}

app.get('/api/sessions', async (req, res) => {
  try {
    const { userId, active } = req.query;
    let qStr = `SELECT * FROM dbo.parking_sessions`;
    const req2 = pool.request();
    const conditions = [];
    if (userId) {
      conditions.push(`user_id = @user_id`);
      req2.input('user_id', sql.NVarChar, String(userId));
    }
    if (active === 'true') {
      conditions.push(`session_status = 'Active'`);
    }
    if (conditions.length) qStr += ` WHERE ` + conditions.join(' AND ');
    qStr += ` ORDER BY db_created_at DESC`;
    const r = await req2.query(qStr);
    return res.json(r.recordset.map(toSessionDto));
  } catch (err) {
    console.error('GET /api/sessions', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải phiên gửi xe.' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const {
      userId, ticketCode, licensePlate, vehicleType,
      checkInTime, expectedEndTime, entryGate, floor, area, slotCode,
      estimatedFee, paymentStatus, paymentMethod, sessionStatus, barrierStatus,
    } = req.body;

    if (!licensePlate || !vehicleType) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    const code = ticketCode || `TK-${Date.now().toString().slice(-6)}`;
    const ins = await pool.request()
      .input('user_id', sql.NVarChar, String(userId || ''))
      .input('ticket_code', sql.NVarChar, code)
      .input('license_plate', sql.NVarChar, licensePlate)
      .input('vehicle_type', sql.NVarChar, vehicleType)
      .input('check_in_time', sql.NVarChar, checkInTime || nowStr())
      .input('expected_end_time', sql.NVarChar, expectedEndTime || '')
      .input('entry_gate', sql.NVarChar, entryGate || '')
      .input('floor', sql.NVarChar, floor || '')
      .input('area', sql.NVarChar, area || '')
      .input('slot_code', sql.NVarChar, slotCode || '')
      .input('estimated_fee', sql.Float, estimatedFee || 0)
      .input('payment_status', sql.NVarChar, paymentStatus || 'Unpaid')
      .input('payment_method', sql.NVarChar, paymentMethod || 'Cash')
      .input('session_status', sql.NVarChar, sessionStatus || 'Active')
      .input('barrier_status', sql.NVarChar, barrierStatus || 'Closed')
      .query(`
        INSERT INTO dbo.parking_sessions
          (user_id, ticket_code, license_plate, vehicle_type, check_in_time, expected_end_time,
           entry_gate, floor, area, slot_code, estimated_fee, payment_status, payment_method,
           session_status, barrier_status)
        OUTPUT inserted.*
        VALUES
          (@user_id, @ticket_code, @license_plate, @vehicle_type, @check_in_time, @expected_end_time,
           @entry_gate, @floor, @area, @slot_code, @estimated_fee, @payment_status, @payment_method,
           @session_status, @barrier_status)
      `);
    return res.status(201).json({ session: toSessionDto(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/sessions', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo phiên gửi xe.' });
  }
});

app.put('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    let cur;
    if (!isNaN(numericId) && numericId > 0) {
      cur = await pool.request().input('id', sql.Int, numericId)
        .query(`SELECT * FROM dbo.parking_sessions WHERE session_id = @id`);
    }
    if (!cur || !cur.recordset.length) {
      cur = await pool.request().input('code', sql.NVarChar, id)
        .query(`SELECT * FROM dbo.parking_sessions WHERE ticket_code = @code`);
    }
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy phiên gửi xe.' });

    const ex = cur.recordset[0];
    const { sessionStatus, paymentStatus, paymentMethod, checkOutTime, estimatedFee, barrierStatus } = req.body;

    await pool.request()
      .input('id', sql.Int, ex.session_id)
      .input('session_status', sql.NVarChar, sessionStatus !== undefined ? sessionStatus : ex.session_status)
      .input('payment_status', sql.NVarChar, paymentStatus !== undefined ? paymentStatus : ex.payment_status)
      .input('payment_method', sql.NVarChar, paymentMethod !== undefined ? paymentMethod : ex.payment_method)
      .input('check_out_time', sql.NVarChar, checkOutTime !== undefined ? checkOutTime : ex.check_out_time)
      .input('estimated_fee', sql.Float, estimatedFee !== undefined ? estimatedFee : ex.estimated_fee)
      .input('barrier_status', sql.NVarChar, barrierStatus !== undefined ? barrierStatus : ex.barrier_status)
      .query(`
        UPDATE dbo.parking_sessions
        SET session_status=@session_status, payment_status=@payment_status, payment_method=@payment_method,
            check_out_time=@check_out_time, estimated_fee=@estimated_fee, barrier_status=@barrier_status
        WHERE session_id=@id
      `);

    const upd = await pool.request().input('id', sql.Int, ex.session_id)
      .query(`SELECT * FROM dbo.parking_sessions WHERE session_id=@id`);
    return res.json({ session: toSessionDto(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/sessions/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật phiên gửi xe.' });
  }
});

// ─── payments ────────────────────────────────────────────────────────────────

function toPaymentDto(r) {
  return {
    id: r.payment_code || String(r.payment_id),
    userId: String(r.user_id),
    ticketCode: r.ticket_code || '',
    parkingFee: r.parking_fee || 0,
    extraServiceFee: r.extra_service_fee || 0,
    lostTicketFee: r.lost_ticket_fee || 0,
    overtimeFee: r.overtime_fee || 0,
    discount: r.discount || 0,
    totalAmount: r.total_amount || 0,
    method: r.method || 'Cash',
    status: r.status || 'Unpaid',
    createdAt: r.created_at || '',
    paidAt: r.paid_at || '',
  };
}

app.get('/api/payments', async (req, res) => {
  try {
    const { userId } = req.query;
    let r;
    if (userId) {
      r = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .query(`SELECT * FROM dbo.payments WHERE user_id = @user_id ORDER BY db_created_at DESC`);
    } else {
      r = await pool.request().query(`SELECT * FROM dbo.payments ORDER BY db_created_at DESC`);
    }
    return res.json(r.recordset.map(toPaymentDto));
  } catch (err) {
    console.error('GET /api/payments', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải thanh toán.' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const {
      id, userId, ticketCode, parkingFee, extraServiceFee, lostTicketFee,
      overtimeFee, discount, totalAmount, method, status, createdAt, paidAt,
    } = req.body;

    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    const code = id || `PAY-${Date.now()}`;

    // check duplicate
    const dup = await pool.request().input('code', sql.NVarChar, code)
      .query(`SELECT payment_id FROM dbo.payments WHERE payment_code = @code`);
    if (dup.recordset.length) {
      return res.json({ payment: toPaymentDto(
        (await pool.request().input('code', sql.NVarChar, code)
          .query(`SELECT * FROM dbo.payments WHERE payment_code = @code`)).recordset[0]
      )});
    }

    const ins = await pool.request()
      .input('payment_code', sql.NVarChar, code)
      .input('user_id', sql.NVarChar, String(userId))
      .input('ticket_code', sql.NVarChar, ticketCode || '')
      .input('parking_fee', sql.Float, parkingFee || 0)
      .input('extra_service_fee', sql.Float, extraServiceFee || 0)
      .input('lost_ticket_fee', sql.Float, lostTicketFee || 0)
      .input('overtime_fee', sql.Float, overtimeFee || 0)
      .input('discount', sql.Float, discount || 0)
      .input('total_amount', sql.Float, totalAmount || 0)
      .input('method', sql.NVarChar, method || 'Cash')
      .input('status', sql.NVarChar, status || 'Unpaid')
      .input('created_at', sql.NVarChar, createdAt || nowStr())
      .input('paid_at', sql.NVarChar, paidAt || '')
      .query(`
        INSERT INTO dbo.payments
          (payment_code, user_id, ticket_code, parking_fee, extra_service_fee, lost_ticket_fee,
           overtime_fee, discount, total_amount, method, status, created_at, paid_at)
        OUTPUT inserted.*
        VALUES
          (@payment_code, @user_id, @ticket_code, @parking_fee, @extra_service_fee, @lost_ticket_fee,
           @overtime_fee, @discount, @total_amount, @method, @status, @created_at, @paid_at)
      `);
    return res.status(201).json({ payment: toPaymentDto(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/payments', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo thanh toán.' });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    let cur;
    if (!isNaN(numericId) && numericId > 0) {
      cur = await pool.request().input('id', sql.Int, numericId)
        .query(`SELECT * FROM dbo.payments WHERE payment_id = @id`);
    }
    if (!cur || !cur.recordset.length) {
      cur = await pool.request().input('code', sql.NVarChar, id)
        .query(`SELECT * FROM dbo.payments WHERE payment_code = @code`);
    }
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy thanh toán.' });

    const ex = cur.recordset[0];
    const { status, method, paidAt, totalAmount, parkingFee, extraServiceFee, lostTicketFee, discount } = req.body;

    await pool.request()
      .input('id',                 sql.Int,      ex.payment_id)
      .input('status',             sql.NVarChar, status             !== undefined ? status             : ex.status)
      .input('method',             sql.NVarChar, method             !== undefined ? method             : ex.method)
      .input('paid_at',            sql.NVarChar, paidAt             !== undefined ? paidAt             : ex.paid_at)
      .input('total_amount',       sql.Float,    totalAmount        !== undefined ? totalAmount        : ex.total_amount)
      .input('parking_fee',        sql.Float,    parkingFee         !== undefined ? parkingFee         : ex.parking_fee)
      .input('extra_service_fee',  sql.Float,    extraServiceFee    !== undefined ? extraServiceFee    : ex.extra_service_fee)
      .input('lost_ticket_fee',    sql.Float,    lostTicketFee      !== undefined ? lostTicketFee      : ex.lost_ticket_fee)
      .input('discount',           sql.Float,    discount           !== undefined ? discount           : ex.discount)
      .query(`UPDATE dbo.payments
        SET status=@status, method=@method, paid_at=@paid_at,
            total_amount=@total_amount, parking_fee=@parking_fee,
            extra_service_fee=@extra_service_fee, lost_ticket_fee=@lost_ticket_fee,
            discount=@discount
        WHERE payment_id=@id`);

    const upd = await pool.request().input('id', sql.Int, ex.payment_id)
      .query(`SELECT * FROM dbo.payments WHERE payment_id=@id`);
    return res.json({ payment: toPaymentDto(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/payments/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật thanh toán.' });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (!isNaN(numericId) && numericId > 0) {
      await pool.request().input('id', sql.Int, numericId)
        .query(`DELETE FROM dbo.payments WHERE payment_id = @id`);
    } else {
      await pool.request().input('code', sql.NVarChar, id)
        .query(`DELETE FROM dbo.payments WHERE payment_code = @code`);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/payments/:id', err);
    return res.status(500).json({ error: 'Lỗi xóa thanh toán.' });
  }
});

// ─── feedbacks ───────────────────────────────────────────────────────────────

function toFeedbackDto(r) {
  return {
    id: String(r.feedback_id),
    userId: String(r.user_id),
    feedbackCode: r.feedback_code,
    type: r.type,
    ticketCode: r.ticket_code || '',
    description: r.description || '',
    priority: r.priority || 'Low',
    status: r.status || 'New',
    attachmentUrl: r.attachment_url || '',
    staffResponse: r.staff_response || '',
    staffRespondedAt: r.staff_responded_at || '',
    createdAt: r.created_at || '',
  };
}

app.get('/api/feedbacks', async (req, res) => {
  try {
    const { userId } = req.query;
    let r;
    if (userId) {
      r = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .query(`SELECT * FROM dbo.feedbacks WHERE user_id = @user_id ORDER BY db_created_at DESC`);
    } else {
      r = await pool.request().query(`SELECT * FROM dbo.feedbacks ORDER BY db_created_at DESC`);
    }
    return res.json(r.recordset.map(toFeedbackDto));
  } catch (err) {
    console.error('GET /api/feedbacks', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải phản hồi.' });
  }
});

app.post('/api/feedbacks', async (req, res) => {
  try {
    const {
      id, userId, feedbackCode, type, ticketCode, description,
      priority, status, attachmentUrl, createdAt,
    } = req.body;

    if (!userId || !type) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    const code = feedbackCode || id || `FB-${Date.now()}`;

    const dup = await pool.request().input('code', sql.NVarChar, code)
      .query(`SELECT feedback_id FROM dbo.feedbacks WHERE feedback_code = @code`);
    if (dup.recordset.length) {
      return res.json({ feedback: toFeedbackDto(
        (await pool.request().input('code', sql.NVarChar, code)
          .query(`SELECT * FROM dbo.feedbacks WHERE feedback_code = @code`)).recordset[0]
      )});
    }

    const ins = await pool.request()
      .input('feedback_code', sql.NVarChar, code)
      .input('user_id', sql.NVarChar, String(userId))
      .input('type', sql.NVarChar, type)
      .input('ticket_code', sql.NVarChar, ticketCode || '')
      .input('description', sql.NVarChar, description || '')
      .input('priority', sql.NVarChar, priority || 'Low')
      .input('status', sql.NVarChar, status || 'New')
      .input('attachment_url', sql.NVarChar, attachmentUrl || '')
      .input('created_at', sql.NVarChar, createdAt || nowStr())
      .query(`
        INSERT INTO dbo.feedbacks
          (feedback_code, user_id, type, ticket_code, description, priority, status, attachment_url, created_at)
        OUTPUT inserted.*
        VALUES
          (@feedback_code, @user_id, @type, @ticket_code, @description, @priority, @status, @attachment_url, @created_at)
      `);
    return res.status(201).json({ feedback: toFeedbackDto(ins.recordset[0]) });
  } catch (err) {
    console.error('POST /api/feedbacks', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo phản hồi.' });
  }
});

app.put('/api/feedbacks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    let cur;
    if (!isNaN(numericId) && numericId > 0) {
      cur = await pool.request().input('id', sql.Int, numericId)
        .query(`SELECT * FROM dbo.feedbacks WHERE feedback_id = @id`);
    }
    if (!cur || !cur.recordset.length) {
      cur = await pool.request().input('code', sql.NVarChar, id)
        .query(`SELECT * FROM dbo.feedbacks WHERE feedback_code = @code`);
    }
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy phản hồi.' });

    const ex = cur.recordset[0];
    const { status, staffResponse, staffRespondedAt } = req.body;

    await pool.request()
      .input('id', sql.Int, ex.feedback_id)
      .input('status', sql.NVarChar, status !== undefined ? status : ex.status)
      .input('staff_response', sql.NVarChar, staffResponse !== undefined ? staffResponse : ex.staff_response)
      .input('staff_responded_at', sql.NVarChar, staffRespondedAt !== undefined ? staffRespondedAt : ex.staff_responded_at)
      .query(`
        UPDATE dbo.feedbacks
        SET status=@status, staff_response=@staff_response, staff_responded_at=@staff_responded_at
        WHERE feedback_id=@id
      `);

    const upd = await pool.request().input('id', sql.Int, ex.feedback_id)
      .query(`SELECT * FROM dbo.feedbacks WHERE feedback_id=@id`);
    return res.json({ feedback: toFeedbackDto(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/feedbacks/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật phản hồi.' });
  }
});

// ─── parking slots ───────────────────────────────────────────────────────────

// SSE: registry of connected browser clients waiting for slot updates
const sseClients = new Set();

function broadcastSlotUpdate(slotCode, status) {
  const payload = `data: ${JSON.stringify({ slotCode, status })}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// Long-lived GET — browsers subscribe here and receive push events
app.get('/api/slots/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
  res.flushHeaders();

  // Keep connection alive with a comment every 20 s (browsers time out SSE after ~45 s idle)
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);

  sseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

app.get('/api/slots', async (_req, res) => {
  try {
    const r = await pool.request().query(
      `SELECT slot_code, floor, zone, vehicle_type, status FROM dbo.parking_slots ORDER BY slot_code`
    );
    const vtMap = {
      'Xe máy / Xe máy điện':    'motorbike',
      'Ô tô 4-7 chỗ (Xăng)':    'car',
      'Ô tô 4-7 chỗ (Điện / EV)': 'electric vehicle',
      'Xe máy': 'motorbike', 'motorbike': 'motorbike',
      'Ô tô':   'car',       'car':       'car',
      'Xe đạp': 'electric vehicle', 'electric vehicle': 'electric vehicle', 'bicycle': 'electric vehicle',
    };
    const floorLabel = (f) => f < 0 ? `Tầng hầm B${Math.abs(f)}` : `Tầng ${f}`;
    return res.json(r.recordset.map((s) => ({
      id: `SL-${s.slot_code.replace(/^F1-/, '')}`,
      slotCode: s.slot_code,
      floorName: floorLabel(s.floor),
      areaName: `Khu ${s.zone} — ${s.vehicle_type}`,
      vehicleType: vtMap[s.vehicle_type] ?? 'car',
      status: s.status,
      nearestGate: 'Cổng chính',
    })));
  } catch (err) {
    console.error('GET /api/slots', err);
    return res.json([]);
  }
});

app.patch('/api/slots/:slotCode', async (req, res) => {
  try {
    const slotCode = decodeURIComponent(req.params.slotCode);
    const { status } = req.body;
    const valid = ['Available', 'Occupied', 'Reserved', 'Pending', 'Maintenance', 'Locked'];
    if (!valid.includes(status))
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });

    const r = await pool.request()
      .input('slot_code', sql.NVarChar, slotCode)
      .input('status',    sql.NVarChar, status)
      .query(`UPDATE dbo.parking_slots SET status = @status WHERE slot_code = @slot_code`);
    if (!r.rowsAffected[0])
      return res.status(404).json({ error: 'Không tìm thấy ô đỗ.' });

    broadcastSlotUpdate(slotCode, status);
    return res.json({ slotCode, status });
  } catch (err) {
    console.error('PATCH /api/slots/:slotCode', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật ô đỗ.' });
  }
});

// ── Slot Issues ───────────────────────────────────────────────────────────────

const issueClients = new Set();

function broadcastIssueEvent(issue) {
  const payload = `data: ${JSON.stringify(issue)}\n\n`;
  for (const client of issueClients) {
    try { client.write(payload); } catch { issueClients.delete(client); }
  }
}

app.get('/api/issues/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  issueClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); issueClients.delete(res); });
});

app.get('/api/issues', async (_req, res) => {
  try {
    const r = await pool.request().query(
      `SELECT issue_id, slot_code, issue_type, description, image_url, reported_by, reported_at, status
       FROM dbo.slot_issues ORDER BY reported_at DESC`
    );
    return res.json(r.recordset.map((row) => ({
      id: `ISS-${row.issue_id}`,
      slotCode: row.slot_code,
      issueType: row.issue_type,
      description: row.description,
      imageUrl: row.image_url || '',
      reportedBy: row.reported_by,
      reportedAt: row.reported_at
        ? new Date(row.reported_at).toISOString().replace('T', ' ').slice(0, 16)
        : '',
      status: row.status,
    })));
  } catch (err) {
    console.error('GET /api/issues', err);
    return res.json([]);
  }
});

app.post('/api/issues', async (req, res) => {
  try {
    const { slotCode, issueType, description, imageUrl, reportedBy } = req.body;
    if (!slotCode || !issueType)
      return res.status(400).json({ error: 'Thiếu thông tin sự cố.' });
    const r = await pool.request()
      .input('slot_code',   sql.NVarChar, slotCode)
      .input('issue_type',  sql.NVarChar, issueType)
      .input('description', sql.NVarChar, description || '')
      .input('image_url',   sql.NVarChar, imageUrl || '')
      .input('reported_by', sql.NVarChar, reportedBy || '')
      .query(`
        INSERT INTO dbo.slot_issues (slot_code, issue_type, description, image_url, reported_by)
        OUTPUT INSERTED.issue_id, INSERTED.reported_at
        VALUES (@slot_code, @issue_type, @description, @image_url, @reported_by)
      `);
    const row = r.recordset[0];
    const issue = {
      id: `ISS-${row.issue_id}`,
      slotCode, issueType,
      description: description || '',
      imageUrl: imageUrl || '',
      reportedBy: reportedBy || '',
      reportedAt: row.reported_at
        ? new Date(row.reported_at).toISOString().replace('T', ' ').slice(0, 16)
        : '',
      status: 'Pending',
    };
    broadcastIssueEvent(issue);
    return res.status(201).json(issue);
  } catch (err) {
    console.error('POST /api/issues', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

app.patch('/api/issues/:id', async (req, res) => {
  try {
    const issueId = parseInt(String(req.params.id).replace('ISS-', ''), 10);
    const { status } = req.body;
    if (!['Approved', 'Rejected', 'Pending'].includes(status))
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });

    const issueResult = await pool.request()
      .input('issue_id', sql.Int, issueId)
      .query(`SELECT slot_code FROM dbo.slot_issues WHERE issue_id = @issue_id`);
    if (!issueResult.recordset[0])
      return res.status(404).json({ error: 'Không tìm thấy sự cố.' });

    const slotCode = issueResult.recordset[0].slot_code;

    await pool.request()
      .input('issue_id', sql.Int, issueId)
      .input('status',   sql.NVarChar, status)
      .query(`UPDATE dbo.slot_issues SET status = @status WHERE issue_id = @issue_id`);

    if (status === 'Approved') {
      await pool.request()
        .input('slot_code', sql.NVarChar, slotCode)
        .query(`UPDATE dbo.parking_slots SET status = 'Maintenance' WHERE slot_code = @slot_code`);
      broadcastSlotUpdate(slotCode, 'Maintenance');
    } else if (status === 'Rejected') {
      await pool.request()
        .input('slot_code', sql.NVarChar, slotCode)
        .query(`UPDATE dbo.parking_slots SET status = 'Available' WHERE slot_code = @slot_code`);
      broadcastSlotUpdate(slotCode, 'Available');
    }

    const updated = { id: `ISS-${issueId}`, slotCode, status };
    broadcastIssueEvent(updated);
    return res.json(updated);
  } catch (err) {
    console.error('PATCH /api/issues/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

// ─── pricing rules ───────────────────────────────────────────────────────────

function toPricingRuleDto(r) {
  return {
    id: String(r.rule_id),
    vehicleType: r.vehicle_type,
    vehicleKey: r.vehicle_key || '',
    icon: r.icon || '🚗',
    description: r.description || '',
    prices: {
      hourly: r.hourly_price || 0,
      overnight: r.overnight_price || 0,
      monthly: r.monthly_price || 0,
    },
    status: r.status || 'active',
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().replace('T', ' ').slice(0, 16) : '',
  };
}

app.get('/api/pricing-rules', async (_req, res) => {
  try {
    const r = await pool.request().query(`SELECT * FROM dbo.pricing_rules ORDER BY rule_id ASC`);
    return res.json(r.recordset.map(toPricingRuleDto));
  } catch (err) {
    console.error('GET /api/pricing-rules', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải bảng giá.' });
  }
});

app.post('/api/pricing-rules', async (req, res) => {
  try {
    const { vehicleType, vehicleKey, icon, description, prices, status } = req.body;
    if (!vehicleType) return res.status(400).json({ error: 'Thiếu tên loại xe.' });
    const ins = await pool.request()
      .input('vehicle_type',    sql.NVarChar, vehicleType.trim())
      .input('vehicle_key',     sql.NVarChar, (vehicleKey || '').trim())
      .input('icon',            sql.NVarChar, icon || '🚗')
      .input('description',     sql.NVarChar, (description || '').trim())
      .input('hourly_price',    sql.Float,    (prices?.hourly || 0))
      .input('overnight_price', sql.Float,    (prices?.overnight || 0))
      .input('monthly_price',   sql.Float,    (prices?.monthly || 0))
      .input('status',          sql.NVarChar, status || 'active')
      .query(`
        INSERT INTO dbo.pricing_rules (vehicle_type, vehicle_key, icon, description, hourly_price, overnight_price, monthly_price, status)
        OUTPUT inserted.*
        VALUES (@vehicle_type, @vehicle_key, @icon, @description, @hourly_price, @overnight_price, @monthly_price, @status)
      `);
    return res.status(201).json(toPricingRuleDto(ins.recordset[0]));
  } catch (err) {
    console.error('POST /api/pricing-rules', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo quy tắc giá.' });
  }
});

app.put('/api/pricing-rules/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { vehicleType, vehicleKey, icon, description, prices, status } = req.body;
    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.pricing_rules WHERE rule_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy quy tắc giá.' });
    const ex = cur.recordset[0];
    await pool.request()
      .input('id',              sql.Int,      id)
      .input('vehicle_type',    sql.NVarChar, vehicleType    !== undefined ? vehicleType.trim()              : ex.vehicle_type)
      .input('vehicle_key',     sql.NVarChar, vehicleKey     !== undefined ? vehicleKey.trim()               : ex.vehicle_key)
      .input('icon',            sql.NVarChar, icon           !== undefined ? icon                            : ex.icon)
      .input('description',     sql.NVarChar, description    !== undefined ? description.trim()              : ex.description)
      .input('hourly_price',    sql.Float,    prices?.hourly    !== undefined ? prices.hourly    : ex.hourly_price)
      .input('overnight_price', sql.Float,    prices?.overnight !== undefined ? prices.overnight : ex.overnight_price)
      .input('monthly_price',   sql.Float,    prices?.monthly   !== undefined ? prices.monthly   : ex.monthly_price)
      .input('status',          sql.NVarChar, status         !== undefined ? status                          : ex.status)
      .query(`
        UPDATE dbo.pricing_rules
        SET vehicle_type=@vehicle_type, vehicle_key=@vehicle_key, icon=@icon,
            description=@description, hourly_price=@hourly_price, overnight_price=@overnight_price,
            monthly_price=@monthly_price, status=@status, updated_at=SYSUTCDATETIME()
        WHERE rule_id=@id
      `);
    const upd = await pool.request().input('id', sql.Int, id).query(`SELECT * FROM dbo.pricing_rules WHERE rule_id=@id`);
    return res.json(toPricingRuleDto(upd.recordset[0]));
  } catch (err) {
    console.error('PUT /api/pricing-rules/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật quy tắc giá.' });
  }
});

app.delete('/api/pricing-rules/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.request().input('id', sql.Int, id).query(`DELETE FROM dbo.pricing_rules WHERE rule_id=@id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy quy tắc giá.' });
    return res.json({ message: 'Đã xóa quy tắc giá.' });
  } catch (err) {
    console.error('DELETE /api/pricing-rules/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa quy tắc giá.' });
  }
});

// ── VNPay Routes ─────────────────────────────────────────────────────────────

// Map paymentId → frontendUrl để redirect đúng domain (ngrok hoặc localhost)
const pendingFrontendUrls = new Map();

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj).sort().forEach((key) => { sorted[key] = obj[key]; });
  return sorted;
}

app.post('/api/vnpay/create-payment', (req, res) => {
  try {
    const { paymentId, amount, orderInfo } = req.body;
    if (!paymentId || !amount)
      return res.status(400).json({ error: 'Thiếu thông tin thanh toán.' });

    // Detect frontend URL từ Origin header (hỗ trợ ngrok, localhost, etc.)
    const origin = req.headers.origin || req.headers.referer?.split('/api')[0] || VNPAY_CONFIG.frontendUrl;
    const frontendUrl = origin.startsWith('http') ? origin.replace(/\/$/, '') : VNPAY_CONFIG.frontendUrl;
    pendingFrontendUrls.set(String(paymentId), frontendUrl);
    // Tự xóa sau 30 phút để tránh memory leak
    setTimeout(() => pendingFrontendUrls.delete(String(paymentId)), 30 * 60 * 1000);

    const ipAddr = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .toString().split(',')[0].trim();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const params = {
      vnp_Version:   '2.1.0',
      vnp_Command:   'pay',
      vnp_TmnCode:   VNPAY_CONFIG.tmnCode,
      vnp_Locale:    'vn',
      vnp_CurrCode:  'VND',
      vnp_TxnRef:    paymentId,
      vnp_OrderInfo: orderInfo || `Thanh toan phi giu xe ${paymentId}`,
      vnp_OrderType: 'other',
      vnp_Amount:    String(Math.round(Number(amount)) * 100),
      vnp_ReturnUrl: VNPAY_CONFIG.returnUrl,
      vnp_IpAddr:    ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const signed = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
      .update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentUrl = `${VNPAY_CONFIG.paymentUrl}?${new URLSearchParams({ ...sortedParams, vnp_SecureHash: signed }).toString()}`;
    return res.json({ paymentUrl });
  } catch (err) {
    console.error('VNPAY CREATE PAYMENT ERROR', err);
    return res.status(500).json({ error: 'Lỗi tạo thanh toán VNPay.' });
  }
});

app.get('/api/vnpay/return', async (req, res) => {
  try {
    const vnpParams = { ...req.query };
    const secureHash = vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const signed = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
      .update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentId    = vnpParams['vnp_TxnRef'] || '';
    const responseCode = vnpParams['vnp_ResponseCode'] || '';
    const amount       = vnpParams['vnp_Amount'] ? Math.round(Number(vnpParams['vnp_Amount']) / 100) : 0;

    // Lấy frontendUrl đúng (ngrok / localhost) đã lưu khi tạo payment
    const frontendUrl = pendingFrontendUrls.get(String(paymentId)) || VNPAY_CONFIG.frontendUrl;
    pendingFrontendUrls.delete(String(paymentId));

    if (secureHash === signed) {
      if (responseCode === '00') {
        const paidAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
        await pool.request()
          .input('code',    sql.NVarChar, paymentId)
          .input('amount',  sql.Float,    amount)
          .input('paid_at', sql.NVarChar, paidAt)
          .query(`UPDATE dbo.payments
            SET status='Paid', method='VNPay', paid_at=@paid_at,
                total_amount=CASE WHEN total_amount = 0 THEN @amount ELSE total_amount END
            WHERE payment_code=@code`);
        return res.redirect(`${frontendUrl}/#/vnpay-return?status=success&paymentId=${encodeURIComponent(paymentId)}&amount=${amount}`);
      }
      return res.redirect(`${frontendUrl}/#/vnpay-return?status=failed&paymentId=${encodeURIComponent(paymentId)}&code=${responseCode}`);
    }
    return res.redirect(`${frontendUrl}/#/vnpay-return?status=invalid`);
  } catch (err) {
    console.error('VNPAY RETURN ERROR', err);
    return res.redirect(`${VNPAY_CONFIG.frontendUrl}/#/vnpay-return?status=error`);
  }
});

// VNPay IPN — server-to-server callback (VNPay gọi thẳng vào server, không qua browser)
app.get('/api/vnpay/ipn', async (req, res) => {
  try {
    const vnpParams = { ...req.query };
    const secureHash = vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const signed = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
      .update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return res.json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const paymentId    = vnpParams['vnp_TxnRef'] || '';
    const responseCode = vnpParams['vnp_ResponseCode'] || '';
    const amount       = vnpParams['vnp_Amount'] ? Math.round(Number(vnpParams['vnp_Amount']) / 100) : 0;

    const found = await pool.request()
      .input('code', sql.NVarChar, paymentId)
      .query(`SELECT payment_id, status FROM dbo.payments WHERE payment_code = @code`);

    if (!found.recordset.length) {
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }
    if (found.recordset[0].status === 'Paid') {
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (responseCode === '00') {
      const paidAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
      await pool.request()
        .input('code',    sql.NVarChar, paymentId)
        .input('amount',  sql.Float,    amount)
        .input('paid_at', sql.NVarChar, paidAt)
        .query(`UPDATE dbo.payments
          SET status='Paid', method='VNPay', paid_at=@paid_at,
              total_amount=CASE WHEN total_amount = 0 THEN @amount ELSE total_amount END
          WHERE payment_code=@code`);
    }
    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (err) {
    console.error('VNPAY IPN ERROR', err);
    return res.json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// ─── start ───────────────────────────────────────────────────────────────────

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Không thể khởi động backend:', error);
    process.exit(1);
  });
