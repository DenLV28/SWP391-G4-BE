import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import sql from 'mssql';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Nạp backend/.env (bí mật VNPay, thông tin SQL) nếu có. Dùng process.loadEnvFile
// của Node ≥20.12 nên không cần thêm phụ thuộc dotenv. Thiếu file thì bỏ qua —
// mọi biến đều có giá trị mặc định chạy được trên máy dev.
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));
} catch {
  // Không có .env — chạy bằng giá trị mặc định.
}

const PORT = process.env.PORT || 4000;

// ── VNPay Config ─────────────────────────────────────────────────────────────
// Đăng ký sandbox tại: https://sandbox.vnpayment.vn/devreg/
// tmnCode/hashSecret là thông tin bí mật của tài khoản merchant — KHÔNG ghi
// thẳng vào file này (repo công khai). Đặt trong backend/.env (xem .env.example),
// file đó đã nằm trong .gitignore.
const VNPAY_CONFIG = {
  tmnCode:    process.env.VNPAY_TMN_CODE    || '',
  hashSecret: process.env.VNPAY_HASH_SECRET || '',
  paymentUrl: process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl:  process.env.VNPAY_RETURN_URL  || 'http://localhost:4000/api/vnpay/return',
  frontendUrl:process.env.FRONTEND_URL      || 'http://localhost:5173',
};
// SQL Server local: giữ giá trị mặc định để `npm run dev` chạy được ngay trên
// máy dev, nhưng cho phép ghi đè qua .env khi deploy.
const SQL_CONFIG = {
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER     || 'sa',
      password: process.env.DB_PASSWORD || '12345',
    },
  },
  server: process.env.DB_SERVER || 'localhost',
  options: {
    database: process.env.DB_NAME || 'parking_management',
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
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        password_updated_at DATETIME2 NULL
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
      IF COL_LENGTH('dbo.users', 'password_updated_at') IS NULL
      BEGIN
        ALTER TABLE dbo.users ADD password_updated_at DATETIME2 NULL;
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
        rfid_uid NVARCHAR(50) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_vehicles_user_id ON dbo.vehicles(user_id);
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.vehicles', 'rfid_uid') IS NULL
      BEGIN
        ALTER TABLE dbo.vehicles ADD rfid_uid NVARCHAR(50) NULL;
      END
      IF COL_LENGTH('dbo.vehicles', 'is_default') IS NULL
      BEGIN
        ALTER TABLE dbo.vehicles ADD is_default BIT NOT NULL DEFAULT 0;
      END
    END
  `);
  // Separate batch (also covers the fresh-install CREATE TABLE path above):
  // SQL Server compiles a batch up front against the table's real on-disk
  // schema, so an index on a column added earlier in the same call — or one
  // that only exists in an unreached IF branch — fails to even compile.
  await pool.request().query(`
    IF COL_LENGTH('dbo.vehicles', 'rfid_uid') IS NOT NULL
       AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_vehicles_rfid_uid')
    BEGIN
      CREATE UNIQUE INDEX UX_vehicles_rfid_uid ON dbo.vehicles(rfid_uid) WHERE rfid_uid IS NOT NULL;
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
        estimated_cost FLOAT NOT NULL DEFAULT 0,
        parking_lot NVARCHAR(100) NOT NULL DEFAULT '',
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        confirmed_at NVARCHAR(30) NOT NULL DEFAULT '',
        checked_in_at NVARCHAR(30) NOT NULL DEFAULT '',
        completed_at NVARCHAR(30) NOT NULL DEFAULT '',
        cancelled_at NVARCHAR(30) NOT NULL DEFAULT ''
      );
      CREATE INDEX IX_reservations_user_id ON dbo.reservations(user_id);
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.reservations', 'estimated_cost') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD estimated_cost FLOAT NOT NULL DEFAULT 0;
      END
      -- parking_lot — which of the ParkFlow lots the driver booked (shown as "Bãi đỗ")
      IF COL_LENGTH('dbo.reservations', 'parking_lot') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD parking_lot NVARCHAR(100) NOT NULL DEFAULT '';
      END
      -- overstay_notified — đã gửi thông báo "gửi quá 24 giờ, áp phí qua đêm" chưa
      IF COL_LENGTH('dbo.reservations', 'overstay_notified') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD overstay_notified BIT NOT NULL DEFAULT 0;
      END
      -- Dòng thời gian trạng thái — mốc giờ THẬT của từng lần chuyển trạng thái
      -- (không suy ra từ db_created_at), hiển thị trong hóa đơn phía driver.
      IF COL_LENGTH('dbo.reservations', 'confirmed_at') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD confirmed_at NVARCHAR(30) NOT NULL DEFAULT '';
      END
      IF COL_LENGTH('dbo.reservations', 'checked_in_at') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD checked_in_at NVARCHAR(30) NOT NULL DEFAULT '';
      END
      IF COL_LENGTH('dbo.reservations', 'completed_at') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD completed_at NVARCHAR(30) NOT NULL DEFAULT '';
      END
      IF COL_LENGTH('dbo.reservations', 'cancelled_at') IS NULL
      BEGIN
        ALTER TABLE dbo.reservations ADD cancelled_at NVARCHAR(30) NOT NULL DEFAULT '';
      END
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
  // reservation_code — traces a payment back to its originating reservation
  // even after check-in rewrites ticket_code to the session's TCK-... code
  // (otherwise a checked-out/paid reservation shows "Chưa thanh toán" forever).
  await pool.request().query(`
    IF COL_LENGTH('dbo.payments', 'reservation_code') IS NULL
    BEGIN
      ALTER TABLE dbo.payments ADD reservation_code NVARCHAR(50) NOT NULL DEFAULT '';
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
  // parking_lot — mỗi bãi có kho ô đỗ riêng; hàng cũ mặc định thuộc bãi Quận 9
  await pool.request().query(`
    IF COL_LENGTH('dbo.parking_slots', 'parking_lot') IS NULL
    BEGIN
      ALTER TABLE dbo.parking_slots ADD parking_lot NVARCHAR(100) NOT NULL DEFAULT N'ParkFlow Quận 9';
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
          CHECK (status IN ('Pending','Approved','Rejected','Resolved'))
      );
    END
  `);
  // Cột status của bản cài đặt cũ hơn có CHECK constraint thiếu 'Resolved' —
  // Manager "Khôi phục ô đỗ" (Approved → Resolved) bị SQL Server chặn ở tầng
  // DB dù code app đã cho phép. Tự dò tên constraint hệ thống đặt (không cố
  // định) rồi thay bằng constraint mới có đủ 4 trạng thái.
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'slot_issues' AND schema_id = SCHEMA_ID('dbo'))
       AND NOT EXISTS (
         SELECT 1 FROM sys.check_constraints
         WHERE parent_object_id = OBJECT_ID('dbo.slot_issues') AND definition LIKE '%Resolved%'
       )
    BEGIN
      DECLARE @ckName NVARCHAR(200);
      SELECT @ckName = cc.name
      FROM sys.check_constraints cc
      JOIN sys.columns col ON cc.parent_object_id = col.object_id AND cc.parent_column_id = col.column_id
      WHERE cc.parent_object_id = OBJECT_ID('dbo.slot_issues') AND col.name = 'status';
      IF @ckName IS NOT NULL
        EXEC('ALTER TABLE dbo.slot_issues DROP CONSTRAINT ' + @ckName);
      ALTER TABLE dbo.slot_issues
        ADD CONSTRAINT CK_slot_issues_status CHECK (status IN ('Pending','Approved','Rejected','Resolved'));
    END
  `);

  // force_clear_logs — audit trail for the Staff/Manager "Force Clear Slot" action
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'force_clear_logs' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.force_clear_logs (
        log_id             INT IDENTITY(1,1) PRIMARY KEY,
        slot_code          NVARCHAR(20)  NOT NULL,
        session_id         INT           NULL,
        ticket_code        NVARCHAR(50)  NOT NULL DEFAULT '',
        license_plate      NVARCHAR(50)  NOT NULL DEFAULT '',
        performed_by_id    NVARCHAR(50)  NOT NULL DEFAULT '',
        performed_by_name  NVARCHAR(200) NOT NULL DEFAULT '',
        performed_by_role  NVARCHAR(50)  NOT NULL DEFAULT '',
        reason             NVARCHAR(500) NOT NULL DEFAULT '',
        created_at         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_force_clear_logs_slot_code ON dbo.force_clear_logs(slot_code);
    END
  `);

  // rfid_scans — one row per physical card tap at a gate. Written twice: an
  // "initial save" the instant the card is read (status='Scanned'), then
  // patched with the captured plate photo + OCR result once that finishes
  // (status='Captured'/'Linked'). Independent of dbo.vehicles.rfid_uid, which
  // is the *registered* card→vehicle pairing; this table is the raw scan log
  // and works even for cards that aren't registered to anything yet.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rfid_scans' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.rfid_scans (
        scan_id             INT IDENTITY(1,1) PRIMARY KEY,
        rfid_uid            NVARCHAR(50)  NOT NULL,
        gate_id             NVARCHAR(20)  NOT NULL DEFAULT '',
        direction           NVARCHAR(10)  NOT NULL DEFAULT 'entry',
        status              NVARCHAR(20)  NOT NULL DEFAULT 'Scanned',
        image_data          NVARCHAR(MAX) NOT NULL DEFAULT '',
        license_plate       NVARCHAR(50)  NOT NULL DEFAULT '',
        license_plate_hash  NVARCHAR(128) NOT NULL DEFAULT '',
        vehicle_id          INT           NULL,
        scanned_by_id       NVARCHAR(50)  NOT NULL DEFAULT '',
        scanned_by_name     NVARCHAR(200) NOT NULL DEFAULT '',
        created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_rfid_scans_rfid_uid ON dbo.rfid_scans(rfid_uid);
      CREATE INDEX IX_rfid_scans_plate_hash ON dbo.rfid_scans(license_plate_hash);
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

  // pricing_rules — extend with the remaining fields Staff/Checkout need (next-hour
  // rate, lost-ticket fee, extra service fee, overtime rate) so Manager can control
  // every price dimension from one place instead of half living in DB, half hardcoded.
  await pool.request().query(`
    IF COL_LENGTH('dbo.pricing_rules', 'next_hour_price') IS NULL
    BEGIN
      ALTER TABLE dbo.pricing_rules ADD
        next_hour_price FLOAT NOT NULL DEFAULT 0,
        lost_ticket_fee FLOAT NOT NULL DEFAULT 0,
        extra_service_fee FLOAT NOT NULL DEFAULT 0,
        overtime_rate_30min FLOAT NOT NULL DEFAULT 0,
        note NVARCHAR(300) NOT NULL DEFAULT '';
    END
  `);
  // Separate batch (same reason as the vehicles/slots migrations above): a
  // batch is compiled against the table's on-disk schema, so statements can't
  // reference a column added earlier in the same .query() call.
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM dbo.pricing_rules WHERE vehicle_key = 'motorbike' AND next_hour_price = 0 AND note = '')
    BEGIN
      UPDATE dbo.pricing_rules SET next_hour_price = 5000, lost_ticket_fee = 100000, extra_service_fee = 0,
        overtime_rate_30min = 2000, note = N'Có tủ khóa qua đêm gần cổng ra.' WHERE vehicle_key = 'motorbike';
      UPDATE dbo.pricing_rules SET next_hour_price = 15000, lost_ticket_fee = 200000, extra_service_fee = 10000,
        overtime_rate_30min = 5000, note = N'Giới hạn tối đa 180.000đ/ngày.' WHERE vehicle_key = 'car';
      UPDATE dbo.pricing_rules SET next_hour_price = 20000, lost_ticket_fee = 200000, extra_service_fee = 15000,
        overtime_rate_30min = 6000, note = N'Đã bao gồm phí kết nối trạm sạc 15.000đ.' WHERE vehicle_key = 'electric vehicle';
    END
  `);

  // parking_lots — trạng thái vận hành (Hoạt động/Bảo trì/Đóng cửa) của 3 bãi
  // cố định trong hệ thống (xem src/utils/parkingLots.ts — nguồn tên bãi duy
  // nhất). Trước đây trạng thái chỉ là state cục bộ trong ManagerParkingLots.tsx
  // nên đổi xong mất ngay khi tải lại trang và không nơi nào khác (booking của
  // user, dashboard của staff) biết bãi đang bảo trì.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parking_lots' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.parking_lots (
        lot_id     INT IDENTITY(1,1) PRIMARY KEY,
        name       NVARCHAR(200) NOT NULL UNIQUE,
        status     NVARCHAR(20)  NOT NULL DEFAULT N'Hoạt động'
                   CHECK (status IN (N'Hoạt động', N'Bảo trì', N'Đóng cửa')),
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      INSERT INTO dbo.parking_lots (name, status) VALUES
        (N'ParkFlow Long Phước', N'Hoạt động'),
        (N'ParkFlow Thủ Đức',    N'Hoạt động'),
        (N'ParkFlow Quận 9',     N'Bảo trì');
    END
  `);
  // Bãi thứ 4 (Nhà Văn Hóa) thêm sau khi bảng đã tồn tại ở các DB cũ — insert
  // riêng, idempotent, cùng kiểu với các ALTER/seed "thêm nếu thiếu" khác trong
  // file này thay vì sửa lại khối tạo bảng ở trên (chỉ chạy đúng 1 lần lúc bảng
  // chưa tồn tại).
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.parking_lots WHERE name = N'ParkFlow Nhà Văn Hóa')
      INSERT INTO dbo.parking_lots (name, status) VALUES (N'ParkFlow Nhà Văn Hóa', N'Hoạt động');
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

  // staff_manager_messages — single shared chat channel between Staff and Manager
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'staff_manager_messages' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.staff_manager_messages (
        message_id INT IDENTITY(1,1) PRIMARY KEY,
        sender_id NVARCHAR(50) NOT NULL,
        sender_name NVARCHAR(200) NOT NULL DEFAULT '',
        sender_role NVARCHAR(50) NOT NULL,
        message NVARCHAR(2000) NOT NULL,
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  // notifications — per-user notification bell feed (e.g. "Đã đặt xe thành công" on staff confirm)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.notifications (
        notification_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(50) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        body NVARCHAR(500) NOT NULL DEFAULT '',
        target_view NVARCHAR(50) NOT NULL DEFAULT '',
        is_read BIT NOT NULL DEFAULT 0,
        created_at NVARCHAR(30) NOT NULL DEFAULT '',
        db_created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_notifications_user_id ON dbo.notifications(user_id);
    END
  `);

  // role_definitions — Admin-editable description/permission tags shown on
  // the "Định nghĩa vai trò" cards. The 4 roles themselves are fixed in code
  // (role_key mirrors normalizeRoleForStorage's 'user'/'staff'/'manager'/'admin');
  // only their description text and permission tag list are editable data.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'role_definitions' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.role_definitions (
        role_key NVARCHAR(50) PRIMARY KEY,
        description NVARCHAR(1000) NOT NULL DEFAULT '',
        permissions NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_by NVARCHAR(200) NOT NULL DEFAULT ''
      );
    END
  `);

  // parking_lots giờ là danh mục bãi đầy đủ (không chỉ trạng thái) — Admin tạo
  // /sửa/xóa bãi ở đây và mọi role đọc từ đó. Trước kia tên/địa chỉ/ảnh/prefix
  // mã ô nằm rải rác hardcode ở frontend (ParkingLotsList, ManagerParkingLots,
  // utils/parkingLots.ts) và ở SLOT_LOTS bên dưới, nên bãi mới không thể thêm.
  // Thêm cột theo kiểu ALTER idempotent (giống parking_slots.parking_lot ở trên)
  // để DB đang chạy nâng cấp được mà không mất dữ liệu.
  for (const [col, ddl] of [
    ['code_prefix',   `NVARCHAR(10)   NOT NULL DEFAULT ''`],
    ['booking_label', `NVARCHAR(200)  NOT NULL DEFAULT ''`],
    ['address',       `NVARCHAR(400)  NOT NULL DEFAULT ''`],
    ['description',   `NVARCHAR(1000) NOT NULL DEFAULT ''`],
    ['image_key',     `NVARCHAR(50)   NOT NULL DEFAULT ''`],
    ['image_data',    `NVARCHAR(MAX)  NOT NULL DEFAULT ''`],
    ['maps_url',      `NVARCHAR(500)  NOT NULL DEFAULT ''`],
    ['created_at',    `DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()`],
  ]) {
    await pool.request().query(`
      IF COL_LENGTH('dbo.parking_lots', '${col}') IS NULL
        ALTER TABLE dbo.parking_lots ADD ${col} ${ddl};
    `);
  }

  // parking_lot_gates — cổng vào/ra của từng bãi. Trước đây ENTRY/EXIT được vẽ
  // cứng ở góc trái trên/dưới trong ParkingFloorMap.tsx; giờ Admin đặt được vị
  // trí (trái/giữa/phải trên làn) và tên cổng cho mỗi bãi.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parking_lot_gates' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE dbo.parking_lot_gates (
        gate_id  INT IDENTITY(1,1) PRIMARY KEY,
        lot_id   INT           NOT NULL REFERENCES dbo.parking_lots(lot_id) ON DELETE CASCADE,
        kind     NVARCHAR(10)  NOT NULL CHECK (kind IN ('entry', 'exit')),
        label    NVARCHAR(100) NOT NULL DEFAULT '',
        position NVARCHAR(10)  NOT NULL DEFAULT 'left'
                 CHECK (position IN ('left', 'center', 'right'))
      );
      CREATE INDEX IX_parking_lot_gates_lot_id ON dbo.parking_lot_gates(lot_id);
    END
  `);

  await backfillLotCatalog();

  // Bảng của công cụ thiết kế cũ (admin_parking_lots/admin_parking_slots) đã bị
  // gộp vào dbo.parking_lots/parking_slots — bỏ đi để chỉ còn một nguồn chân lý.
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_parking_slots' AND schema_id = SCHEMA_ID('dbo'))
      DROP TABLE dbo.admin_parking_slots;
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_parking_lots' AND schema_id = SCHEMA_ID('dbo'))
      DROP TABLE dbo.admin_parking_lots;
  `);
}

// Metadata của 4 bãi gốc — trước đây hardcode ở frontend. Chỉ dùng để rót vào
// DB một lần; sau đó DB là nguồn chân lý và Admin sửa được qua UI.
const LEGACY_LOT_METADATA = [
  {
    name: 'ParkFlow Quận 9',
    codePrefix: '',
    bookingLabel: 'ParkFlow Quận 9 - Lò Lu',
    address: '5A Đường Lò Lu, KP. Phước Hiệp, P, Long Phước, Hồ Chí Minh 700000, Việt Nam',
    imageKey: 'quan9',
  },
  {
    name: 'ParkFlow Thủ Đức',
    codePrefix: 'TD-',
    bookingLabel: 'ParkFlow Thủ Đức - Linh Xuân',
    address: '86/33 Đ. Số 5, khu phố 3, Linh Xuân, Hồ Chí Minh, Việt Nam',
    imageKey: 'thuduc',
  },
  {
    name: 'ParkFlow Long Phước',
    codePrefix: 'LP-',
    bookingLabel: 'ParkFlow Long Phước',
    // Query gồm cả tên địa điểm trên Google Maps để Maps ghim đúng cửa hàng
    // thay vì đoán theo tên đường.
    address: 'Tp, 15/3 Đ. Số 3, Thủ Đức, Hồ Chí Minh 720300, Việt Nam',
    mapsQuery: 'Bãi Giữ xe ô tô Thủ Đức, 15/3 Đ. Số 3, Thủ Đức, Hồ Chí Minh 720300, Việt Nam',
    imageKey: 'longphuoc',
  },
  {
    name: 'ParkFlow Nhà Văn Hóa',
    codePrefix: 'NVH-',
    bookingLabel: 'ParkFlow Nhà Văn Hóa',
    address: 'Nhà Văn Hóa Sinh Viên, Đông Hòa, Dĩ An, Bình Dương, Việt Nam',
    imageKey: 'nhavanhoa',
  },
];

function mapsUrlFor(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Rót metadata của 4 bãi gốc vào các cột vừa thêm. Chỉ ghi đè khi cột còn rỗng
 * nên chạy lại mỗi lần khởi động cũng không đè lên chỉnh sửa của Admin.
 */
async function backfillLotCatalog() {
  for (const lot of LEGACY_LOT_METADATA) {
    await pool.request()
      .input('name',          sql.NVarChar, lot.name)
      .input('code_prefix',   sql.NVarChar, lot.codePrefix)
      .input('booking_label', sql.NVarChar, lot.bookingLabel)
      .input('address',       sql.NVarChar, lot.address)
      .input('image_key',     sql.NVarChar, lot.imageKey)
      .input('maps_url',      sql.NVarChar, mapsUrlFor(lot.mapsQuery || lot.address))
      .query(`
        UPDATE dbo.parking_lots SET
          code_prefix   = CASE WHEN code_prefix   = '' THEN @code_prefix   ELSE code_prefix   END,
          booking_label = CASE WHEN booking_label = '' THEN @booking_label ELSE booking_label END,
          address       = CASE WHEN address       = '' THEN @address       ELSE address       END,
          image_key     = CASE WHEN image_key     = '' THEN @image_key     ELSE image_key     END,
          maps_url      = CASE WHEN maps_url      = '' THEN @maps_url      ELSE maps_url      END
        WHERE name = @name
      `);
  }
  // Bãi gốc chưa có cổng nào → tạo entry/exit khớp đúng hình đang vẽ cố định
  // trong ParkingFloorMap (cả hai ở đầu trái làn trên/dưới).
  await pool.request().query(`
    INSERT INTO dbo.parking_lot_gates (lot_id, kind, label, position)
    SELECT l.lot_id, g.kind, g.label, 'left'
    FROM dbo.parking_lots l
    CROSS JOIN (VALUES ('entry', N'Cổng chính'), ('exit', N'Cổng ra')) AS g(kind, label)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.parking_lot_gates x WHERE x.lot_id = l.lot_id)
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
  { slotCode: 'F1-A11', floor: 2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)', status: 'Available'   },
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

// Mỗi bãi có kho ô đỗ độc lập, cùng mặt bằng nhưng SỨC CHỨA KHÁC NHAU — `rows`
// khai báo số ô mỗi dãy (A/D: ô tô, B/E: xe máy, C: EV). Mã ô của các bãi mới
// được gắn tiền tố (TD-/LP-/NVH-) để giữ UNIQUE trên slot_code; sơ đồ chỉ hiển
// thị nhãn cuối (A01, B02...).
//   Quận 9 - Lò Lu:      36 vị trí (đủ mặt bằng)
//   Thủ Đức - Linh Xuân: 30 vị trí (dãy E chỉ 5 ô)
//   Long Phước:          24 vị trí (mỗi dãy đều ít hơn)
//   Nhà Văn Hóa:         26 vị trí (bãi mới, nhiều xe máy hơn — gần khu sinh viên)
// Lưu ý: mỗi dãy chỉ có sẵn tối đa số ô định nghĩa trong INITIAL_SLOTS ở trên
// (A/E ≤ 11, B/C ≤ 5, D ≤ 4) — khai `rows` vượt mức đó sẽ bị cắt về đúng mức
// tối đa đó (slotsForLot lọc trên INITIAL_SLOTS, không tự sinh ô mới).
const SLOT_LOTS = [
  { prefix: '',     name: 'ParkFlow Quận 9',       rows: { A: 11, B: 5, C: 5, D: 4, E: 11 } },
  { prefix: 'TD-',  name: 'ParkFlow Thủ Đức',      rows: { A: 11, B: 5, C: 5, D: 4, E: 5  } },
  { prefix: 'LP-',  name: 'ParkFlow Long Phước',   rows: { A: 8,  B: 4, C: 3, D: 2, E: 7  } },
  { prefix: 'NVH-', name: 'ParkFlow Nhà Văn Hóa',  rows: { A: 6,  B: 5, C: 3, D: 2, E: 10 } },
];

/** Các ô của INITIAL_SLOTS thuộc layout một bãi ('F1-A01' → dãy A, số 1). */
function slotsForLot(lot) {
  return INITIAL_SLOTS.filter((s) => {
    const row = s.slotCode.slice(3, 4);
    const num = Number(s.slotCode.slice(4));
    return num <= (lot.rows[row] ?? 0);
  });
}

async function seedSlots() {
  // CHỈ seed khi kho ô đỗ hoàn toàn rỗng (DB mới tinh). Trước đây hàm này chạy
  // INSERT-IF-NOT-EXISTS + DELETE trên mỗi lần khởi động, nên ô nào Admin xóa
  // qua UI sẽ mọc lại và ô nào Admin thêm ngoài layout cứng sẽ bị xóa mất —
  // không thể để vậy khi dbo.parking_lots đã thành danh mục bãi sửa được.
  const existing = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.parking_slots`);
  if (existing.recordset[0].n > 0) {
    // Hàng cũ tạo trước khi có cột parking_lot → gán về bãi Quận 9
    await pool.request().query(`
      UPDATE dbo.parking_slots SET parking_lot = N'ParkFlow Quận 9' WHERE parking_lot = ''
    `);
    return;
  }

  for (const lot of SLOT_LOTS) {
    for (const s of slotsForLot(lot)) {
      await pool.request()
        .input('slot_code',    sql.NVarChar, `${lot.prefix}${s.slotCode}`)
        .input('floor',        sql.Int,      s.floor)
        .input('zone',         sql.NVarChar, s.zone)
        .input('vehicle_type', sql.NVarChar, s.vehicleType)
        // Bãi gốc giữ status demo; các bãi khác khởi tạo toàn ô trống
        .input('status',       sql.NVarChar, lot.prefix ? 'Available' : s.status)
        .input('parking_lot',  sql.NVarChar, lot.name)
        .query(`
          INSERT INTO dbo.parking_slots (slot_code, floor, zone, vehicle_type, status, parking_lot)
          VALUES (@slot_code, @floor, @zone, @vehicle_type, @status, @parking_lot)
        `);
    }
  }
}

async function migrateSlotAndRoles() {
  // Fix A11 stuck in Maintenance — set Available
  await pool.request().query(
    `UPDATE dbo.parking_slots SET status = 'Available' WHERE slot_code = 'F1-A11' AND status = 'Maintenance'`
  );
  // Fix users registered with role 'user' (old bug) — promote to correct role
  await pool.request().query(
    `UPDATE dbo.users SET role = 'Parking User / Driver' WHERE role = 'user'`
  );
}

async function initDatabase() {
  await createDatabase();
  pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
  await createTables();
  await seedSlots();
  await migrateSlotAndRoles();
  await migrateLegacyPasswords();
  await ensureDemoAccounts();
  await ensureRoleDefinitions();
}

// Seed defaults matching the text that was previously hardcoded on the
// frontend (RoleManagement.tsx's roleDescription()/permissionLabel() maps) —
// only inserted the first time each role_key is missing, so an admin/manager
// edit made in a previous session is never overwritten by a later restart.
const DEFAULT_ROLE_DEFINITIONS = [
  {
    roleKey: 'user',
    description: 'Chỉ có quyền gửi xe, đặt chỗ và thanh toán.',
    permissions: ['Xem thông tin bãi đỗ', 'Xem chỗ trống', 'Tạo đặt chỗ', 'Xem lượt gửi hiện tại', 'Thanh toán', 'Gửi phản hồi', 'Quản lý hồ sơ cá nhân'],
  },
  {
    roleKey: 'staff',
    description: 'Phụ trách kiểm soát làn, hỗ trợ check-in và xử lý tại bãi.',
    permissions: ['Tạo lượt gửi xe', 'Xử lý xe vào', 'Xử lý xe ra', 'Cập nhật trạng thái chỗ', 'Xử lý mất vé'],
  },
  {
    roleKey: 'manager',
    description: 'Theo dõi vận hành, phê duyệt và kiểm soát cấu hình bãi xe.',
    permissions: ['Quản lý bãi đỗ', 'Quản lý tầng và chỗ đỗ', 'Quản lý bảng giá', 'Xem báo cáo', 'Quản lý chính sách'],
  },
  {
    roleKey: 'admin',
    description: 'Toàn quyền quản trị người dùng, hệ thống và cấu hình.',
    permissions: ['Quản lý người dùng', 'Quản lý vai trò', 'Quản lý cấu hình hệ thống'],
  },
];

async function ensureRoleDefinitions() {
  for (const def of DEFAULT_ROLE_DEFINITIONS) {
    const existing = await pool.request()
      .input('role_key', sql.NVarChar, def.roleKey)
      .query(`SELECT role_key FROM dbo.role_definitions WHERE role_key = @role_key`);
    if (existing.recordset.length) continue;

    await pool.request()
      .input('role_key', sql.NVarChar, def.roleKey)
      .input('description', sql.NVarChar, def.description)
      .input('permissions', sql.NVarChar, JSON.stringify(def.permissions))
      .query(`
        INSERT INTO dbo.role_definitions (role_key, description, permissions)
        VALUES (@role_key, @description, @permissions)
      `);
  }
}

function safeParsePermissions(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
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

    const normalizedRole = normalizeRoleForStorage(account.role);
    const isActive = account.status !== 'Locked';

    if (existing.recordset.length === 0) {
      // First-ever boot: seed the account with the default password.
      const passwordHash = await bcrypt.hash(account.password, 10);
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
      // Account already exists — every later boot only re-syncs role/status/
      // phone metadata. password_hash is deliberately left untouched: this used
      // to run unconditionally on every restart, silently resetting the demo
      // accounts' passwords back to the default and undoing any real password
      // change a user made in between restarts.
      await pool.request()
        .input('email', sql.NVarChar, account.email)
        .input('phone', sql.NVarChar, account.phone)
        .input('role', sql.NVarChar, normalizedRole)
        .input('status', sql.NVarChar, account.status)
        .input('is_active', sql.Bit, isActive)
        .query(`
          UPDATE dbo.users
          SET phone = @phone, role = @role,
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

// Sessions carry the frontend's short VehicleKey ('car'/'motorbike'/'electric
// vehicle') or, from some callers, the Vietnamese label directly — while
// dbo.parking_slots.vehicle_type always stores the canonical Vietnamese label
// (see INITIAL_SLOTS above). Normalize either shape to that canonical label so
// walk-in auto-assignment can match a session's vehicle type to a real slot.
function normalizeVehicleTypeForSlotMatch(vehicleType) {
  const v = String(vehicleType || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'car' || v.includes('xăng')) return 'Ô tô 4-7 chỗ (Xăng)';
  if (v === 'electric vehicle' || v.includes('điện')) return 'Ô tô 4-7 chỗ (Điện / EV)';
  if (v === 'motorbike' || v.includes('xe máy') || v.includes('xe may')) return 'Xe máy / Xe máy điện';
  return null;
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

// ─── user-management authorization ─────────────────────────────────────────
// Admin: full manage (create/edit/lock/delete) over every role, including
// other admins/managers. Manager: no access — "Quản lý người dùng"/"Quyền và
// vai trò" were removed from the Manager portal entirely.
// Nobody can change their own role/status through these endpoints (avoids
// self-lockout / self-escalation) — that always goes through the profile
// endpoint instead, which never touches role/status.
function canManageRole(actorRoleForStorage, targetRoleForStorage) {
  return actorRoleForStorage === 'admin';
}

// Looks up the *real* role of whoever is performing a user-management action
// straight from the DB — never trust a role the client claims for itself.
async function loadActor(actorId) {
  const idNum = Number(actorId);
  if (!Number.isInteger(idNum)) return null;
  const result = await pool.request()
    .input('id', sql.Int, idNum)
    .query(`SELECT user_id, full_name, role FROM dbo.users WHERE user_id = @id`);
  if (!result.recordset.length) return null;
  const row = result.recordset[0];
  return { id: row.user_id, fullName: row.full_name, role: normalizeRoleForStorage(row.role) };
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
    passwordUpdatedAt: record.password_updated_at || null,
  };
}

// Toàn bộ mốc giờ hiển thị trong app phải là GIỜ VIỆT NAM (UTC+7) — kể cả khi
// server chạy trên máy/host có múi giờ khác (ví dụ máy chủ cloud mặc định
// UTC). `toISOString()` luôn quy về UTC theo spec JS, nên KHÔNG được dùng
// trực tiếp để hiển thị — cộng thêm 7 giờ vào epoch rồi mới format bằng
// toISOString() là cách lấy đúng "giờ tường Việt Nam" một cách tất định,
// không phụ thuộc timezone hệ điều hành của server.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
function toVnStr(d) {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16);
}
function nowStr() {
  return toVnStr(new Date());
}

// Chuẩn hóa tên bãi về 1 khóa để so sánh — bản sao tối thiểu của
// src/utils/parkingLots.ts::lotKeyOf phía frontend, dùng để backend TỰ kiểm
// tra quyền staff theo bãi (không chỉ tin client lọc UI).
function lotKeyOfServer(value) {
  const v = String(value || '').toLowerCase();
  if (!v.trim()) return null;
  if (v.includes('long phước') || v.includes('long phuoc')) return 'longphuoc';
  if (v.includes('quận 9') || v.includes('quan 9')) return 'quan9';
  if (v.includes('thủ đức') || v.includes('thu duc')) return 'thuduc';
  return null;
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
      SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at, password_updated_at
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
    const { fullName, email, phone, role, status, password, assignedParkingLot, actorId } = req.body;
    if (!fullName || !email || !phone || !role)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    const normalizedRole = normalizeRoleForStorage(role);

    const actor = await loadActor(actorId);
    if (!actor) return res.status(403).json({ error: 'Không xác định được người thực hiện thao tác.' });
    if (!canManageRole(actor.role, normalizedRole))
      return res.status(403).json({ error: 'Bạn không có quyền tạo tài khoản với vai trò này.' });

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const passwordHash = await bcrypt.hash(password || '123456', 10);
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
    const { fullName, email, phone, role, status, assignedParkingLot, actorId } = req.body;

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at, password_updated_at FROM dbo.users WHERE user_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    const ex = cur.recordset[0];

    // Self edits of basic info (name/phone/email/lot) always go through — this
    // is how every role updates its own profile. Any change to role or status,
    // or any edit targeting someone else's account, must clear canManageRole()
    // below — nobody may promote/demote or lock/unlock themselves this way.
    const exRoleForStorage = normalizeRoleForStorage(ex.role);
    const nextRoleForStorage = role ? normalizeRoleForStorage(role) : exRoleForStorage;
    const roleChanging = nextRoleForStorage !== exRoleForStorage;
    const statusChanging = status !== undefined && status !== null && status !== ex.status;
    const isSelf = actorId !== undefined && actorId !== null && Number(actorId) === id;

    if (roleChanging || statusChanging || !isSelf) {
      const actor = await loadActor(actorId);
      if (!actor) return res.status(403).json({ error: 'Không xác định được người thực hiện thao tác.' });
      if (isSelf) {
        return res.status(403).json({ error: 'Bạn không thể tự thay đổi vai trò hoặc trạng thái của chính mình.' });
      }
      if (!canManageRole(actor.role, exRoleForStorage) || (roleChanging && !canManageRole(actor.role, nextRoleForStorage))) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tài khoản này.' });
      }
    }

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
      .query(`SELECT user_id, full_name, email, phone, role, status, is_active, assigned_parking_lot, created_at, password_updated_at FROM dbo.users WHERE user_id=@id`);
    return res.json({ user: getSafeUser(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/users/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật người dùng.' });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới.' });
    if (String(newPassword).length < 6)
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id, password_hash FROM dbo.users WHERE user_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    const passwordHash = cur.recordset[0].password_hash || '';

    // migrateLegacyPasswords() bcrypt-hashes every row at boot, so by the time
    // any request reaches here password_hash is always a real bcrypt hash —
    // no plaintext/DEFAULT_PASSWORD fallback here, since that would let
    // DEFAULT_PASSWORD log in as ANY account regardless of its real password.
    const passwordMatch = isBcryptHash(passwordHash) && await bcrypt.compare(currentPassword, passwordHash);
    if (!passwordMatch) return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    const upd = await pool.request()
      .input('id', sql.Int, id)
      .input('password_hash', sql.NVarChar, newHash)
      .query(`
        UPDATE dbo.users SET password_hash = @password_hash, password_updated_at = SYSUTCDATETIME()
        OUTPUT inserted.user_id, inserted.full_name, inserted.email, inserted.phone, inserted.role,
               inserted.status, inserted.is_active, inserted.assigned_parking_lot, inserted.created_at,
               inserted.password_updated_at
        WHERE user_id = @id
      `);

    return res.json({ message: 'Đổi mật khẩu thành công.', user: getSafeUser(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/users/:id/password', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = req.query.actorId ?? req.body?.actorId;

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT user_id, role FROM dbo.users WHERE user_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    const targetRoleForStorage = normalizeRoleForStorage(cur.recordset[0].role);

    if (actorId !== undefined && Number(actorId) === id)
      return res.status(403).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình.' });

    const actor = await loadActor(actorId);
    if (!actor) return res.status(403).json({ error: 'Không xác định được người thực hiện thao tác.' });
    if (!canManageRole(actor.role, targetRoleForStorage))
      return res.status(403).json({ error: 'Bạn không có quyền xóa tài khoản này.' });

    const r = await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.users WHERE user_id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    return res.json({ message: 'Xóa người dùng thành công.' });
  } catch (err) {
    console.error('DELETE /api/users/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa người dùng.' });
  }
});

// ─── role definitions ──────────────────────────────────────────────────────
// The 4 roles themselves are fixed in code; only their description text and
// permission tag list (shown on the "Định nghĩa vai trò" cards) are editable,
// Admin-only data backed by dbo.role_definitions.

app.get('/api/role-definitions', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT role_key, description, permissions, updated_at, updated_by FROM dbo.role_definitions
    `);
    return res.json(result.recordset.map((r) => ({
      roleKey: r.role_key,
      description: r.description,
      permissions: safeParsePermissions(r.permissions),
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    })));
  } catch (err) {
    console.error('GET /api/role-definitions', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải định nghĩa vai trò.' });
  }
});

app.put('/api/role-definitions/:roleKey', async (req, res) => {
  try {
    const roleKey = normalizeRoleForStorage(req.params.roleKey);
    const { description, permissions, actorId } = req.body;

    const actor = await loadActor(actorId);
    if (!actor) return res.status(403).json({ error: 'Không xác định được người thực hiện thao tác.' });
    if (actor.role !== 'admin')
      return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền chỉnh sửa định nghĩa vai trò.' });

    if (typeof description !== 'string' || !description.trim())
      return res.status(400).json({ error: 'Thiếu mô tả vai trò.' });
    const cleanPermissions = Array.isArray(permissions)
      ? permissions.map((p) => String(p).trim()).filter(Boolean).slice(0, 30)
      : [];

    const exists = await pool.request().input('role_key', sql.NVarChar, roleKey)
      .query(`SELECT role_key FROM dbo.role_definitions WHERE role_key = @role_key`);
    if (!exists.recordset.length) return res.status(404).json({ error: 'Không tìm thấy vai trò.' });

    await pool.request()
      .input('role_key', sql.NVarChar, roleKey)
      .input('description', sql.NVarChar, description.trim().slice(0, 1000))
      .input('permissions', sql.NVarChar, JSON.stringify(cleanPermissions))
      .input('updated_by', sql.NVarChar, actor.fullName || '')
      .query(`
        UPDATE dbo.role_definitions
        SET description = @description, permissions = @permissions,
            updated_at = SYSUTCDATETIME(), updated_by = @updated_by
        WHERE role_key = @role_key
      `);

    const upd = await pool.request().input('role_key', sql.NVarChar, roleKey)
      .query(`SELECT role_key, description, permissions, updated_at, updated_by FROM dbo.role_definitions WHERE role_key = @role_key`);
    const row = upd.recordset[0];
    return res.json({
      roleKey: row.role_key,
      description: row.description,
      permissions: safeParsePermissions(row.permissions),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  } catch (err) {
    console.error('PUT /api/role-definitions/:roleKey', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật định nghĩa vai trò.' });
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
      .input('role', sql.NVarChar, 'Parking User / Driver')
      .input('is_active', sql.Bit, 1)
      .query(`
        INSERT INTO dbo.users (full_name, email, phone, password_hash, role, is_active)
        OUTPUT inserted.user_id, inserted.full_name, inserted.email, inserted.phone,
               inserted.role, inserted.is_active, inserted.created_at
        VALUES (@full_name, @email, @phone, @password_hash, @role, @is_active)
      `);

    const user = getSafeUser(ins.recordset[0]);

    // auto-create vehicle for new user — kept outside the outer try/catch's
    // failure path: the account is already committed at this point, so a
    // vehicle-insert error must not turn into a false "registration failed"
    // response (that used to send the frontend down its local-only fallback,
    // leaving a real DB user with no vehicle and no way to discover it).
    if (plateNumber && vehicleType) {
      try {
        await pool.request()
          .input('user_id', sql.NVarChar, user.id)
          .input('license_plate', sql.NVarChar, plateNumber.trim())
          .input('vehicle_type', sql.NVarChar, normalizeVehicleTypeLabel(vehicleType))
          .input('brand', sql.NVarChar, (brand || '').trim())
          .input('model', sql.NVarChar, (model || '').trim())
          .input('is_default', sql.Bit, 1)
          .query(`
            INSERT INTO dbo.vehicles (user_id, license_plate, vehicle_type, brand, model, is_default)
            VALUES (@user_id, @license_plate, @vehicle_type, @brand, @model, @is_default)
          `);
      } catch (vehErr) {
        console.error('POST /api/auth/register — vehicle insert failed', vehErr);
      }
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
        SELECT TOP 1 user_id, full_name, email, phone, password_hash, role, status, is_active, created_at, password_updated_at
        FROM dbo.users WHERE email = @identifier OR phone = @identifier
      `);
    const userRecord = query.recordset[0];
    if (!userRecord) return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc thông tin không chính xác.' });

    const passwordHash = userRecord.password_hash || '';
    // Same reasoning as the change-password endpoint: migrateLegacyPasswords()
    // guarantees a real bcrypt hash for every row at boot, so no plaintext/
    // DEFAULT_PASSWORD fallback is needed (or safe to keep) here.
    const passwordMatch = isBcryptHash(passwordHash) && await bcrypt.compare(password, passwordHash);
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

// The frontend only ever speaks the short VehicleKey enum ('motorbike' | 'car' |
// 'electric vehicle') for a user's own vehicles — see SavedVehicle.vehicleType.
// dbo.vehicles (like dbo.parking_slots) stores the descriptive Vietnamese label
// instead, so every insert must normalize to a label and every read must map
// back to a key, the same way GET /api/slots already does for parking slots.
const VEHICLE_KEY_TO_LABEL = {
  motorbike: 'Xe máy / Xe máy điện',
  car: 'Ô tô 4-7 chỗ (Xăng)',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};
const VEHICLE_LABEL_TO_KEY = {
  'Xe máy / Xe máy điện': 'motorbike',
  'Xe máy': 'motorbike',
  'Ô tô 4-7 chỗ (Xăng)': 'car',
  'Ô tô': 'car',
  'Ô tô 4-7 chỗ (Điện / EV)': 'electric vehicle',
  'Xe đạp': 'electric vehicle',
  'Xe tải nhỏ': 'car',
};

/** Normalizes a VehicleKey (or an already-normalized label) to the canonical DB label. */
function normalizeVehicleTypeLabel(input) {
  const v = String(input || '').trim();
  return VEHICLE_KEY_TO_LABEL[v] || v;
}

/** Converts a stored DB label (or a VehicleKey, for safety) back to the frontend VehicleKey. */
function vehicleTypeToKey(label) {
  if (VEHICLE_KEY_TO_LABEL[label]) return label;
  return VEHICLE_LABEL_TO_KEY[label] || 'car';
}

function toVehicleDto(r) {
  return {
    id: String(r.vehicle_id),
    userId: String(r.user_id),
    licensePlate: r.license_plate,
    vehicleType: vehicleTypeToKey(r.vehicle_type),
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
      .input('vehicle_type', sql.NVarChar, normalizeVehicleTypeLabel(vehicleType))
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

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { licensePlate, vehicleType, brand, model } = req.body;
    if (!licensePlate || !vehicleType) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    const upd = await pool.request()
      .input('id', sql.Int, id)
      .input('license_plate', sql.NVarChar, licensePlate.trim())
      .input('vehicle_type', sql.NVarChar, normalizeVehicleTypeLabel(vehicleType))
      .input('brand', sql.NVarChar, (brand || '').trim())
      .input('model', sql.NVarChar, (model || '').trim())
      .query(`
        UPDATE dbo.vehicles
        SET license_plate = @license_plate, vehicle_type = @vehicle_type, brand = @brand, model = @model
        OUTPUT inserted.*
        WHERE vehicle_id = @id
      `);
    if (!upd.recordset.length) return res.status(404).json({ error: 'Không tìm thấy phương tiện.' });
    return res.json({ vehicle: toVehicleDto(upd.recordset[0]) });
  } catch (err) {
    console.error('PUT /api/vehicles/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật phương tiện.' });
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

// ─── RFID card lookup ──────────────────────────────────────────────────────
// The RFID reader at the gate is a keyboard-emulating scanner: staff "taps"
// the card and its UID lands in the input, which the frontend then looks up
// here to pull the linked vehicle + owner for on-screen verification.

app.get('/api/rfid/:uid', async (req, res) => {
  try {
    const uid = String(req.params.uid).trim();
    if (!uid) return res.status(400).json({ error: 'Thiếu mã UID thẻ.' });

    const r = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .query(`
        SELECT v.vehicle_id, v.user_id, v.license_plate, v.vehicle_type, v.brand, v.model,
               u.full_name, u.email, u.phone, u.role
        FROM dbo.vehicles v
        LEFT JOIN dbo.users u ON TRY_CAST(v.user_id AS INT) = u.user_id
        WHERE v.rfid_uid = @uid
      `);
    if (!r.recordset.length)
      return res.status(404).json({ error: 'Thẻ chưa được liên kết với phương tiện nào.' });

    const row = r.recordset[0];
    return res.json({
      rfidUid: uid,
      vehicle: {
        id: String(row.vehicle_id),
        licensePlate: row.license_plate,
        vehicleType: row.vehicle_type,
        brand: row.brand || '',
        model: row.model || '',
      },
      owner: {
        id: String(row.user_id),
        fullName: row.full_name || '',
        email: row.email || '',
        phone: row.phone || '',
        role: row.role || '',
      },
    });
  } catch (err) {
    console.error('GET /api/rfid/:uid', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

app.post('/api/rfid/link', async (req, res) => {
  try {
    const { uid, licensePlate, vehicleType } = req.body;
    if (!uid || !licensePlate)
      return res.status(400).json({ error: 'Thiếu mã UID hoặc biển số.' });

    const dup = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .query(`SELECT vehicle_id FROM dbo.vehicles WHERE rfid_uid = @uid`);
    if (dup.recordset.length)
      return res.status(409).json({ error: 'Thẻ này đã được liên kết với một phương tiện khác.' });

    // So khớp chính xác trước; trượt thì so theo biển đã chuẩn hóa (bỏ gạch,
    // chấm, khoảng trắng) — OCR trả "36A-363.63" vẫn khớp DB "36A-36363".
    let vehicleId = null;
    const veh = await pool.request()
      .input('plate', sql.NVarChar, licensePlate.trim())
      .query(`SELECT TOP 1 vehicle_id FROM dbo.vehicles WHERE license_plate = @plate`);
    if (veh.recordset.length) {
      vehicleId = veh.recordset[0].vehicle_id;
    } else {
      const wanted = normalizePlate(licensePlate);
      const all = await pool.request().query(`SELECT vehicle_id, license_plate FROM dbo.vehicles`);
      const hit = all.recordset.find((v) => normalizePlate(v.license_plate) === wanted);
      if (hit) vehicleId = hit.vehicle_id;
    }

    let created = false;
    if (vehicleId == null) {
      // Biển số chưa có hồ sơ nào (chưa xe nào đăng ký) — đây là khách vãng
      // lai, không bắt buộc phải có tài khoản mới cho thẻ vào bãi được. Tự
      // tạo một hồ sơ phương tiện gắn user_id 'GUEST' (cùng quy ước với
      // reservations/feedbacks vãng lai — xem các chỗ check
      // `String(user_id).toUpperCase() !== 'GUEST'`) rồi liên kết luôn, thay
      // vì chặn bằng 404 như trước.
      const ins = await pool.request()
        .input('user_id', sql.NVarChar, 'GUEST')
        .input('plate', sql.NVarChar, licensePlate.trim())
        .input('vehicle_type', sql.NVarChar, vehicleType || 'Xe máy / Xe máy điện')
        .input('uid', sql.NVarChar, uid)
        .query(`
          INSERT INTO dbo.vehicles (user_id, license_plate, vehicle_type, brand, model, rfid_uid)
          OUTPUT inserted.vehicle_id
          VALUES (@user_id, @plate, @vehicle_type, '', '', @uid)
        `);
      vehicleId = ins.recordset[0].vehicle_id;
      created = true;
    } else {
      await pool.request()
        .input('uid', sql.NVarChar, uid)
        .input('id', sql.Int, vehicleId)
        .query(`UPDATE dbo.vehicles SET rfid_uid = @uid WHERE vehicle_id = @id`);
    }

    return res.json({
      message: created
        ? 'Đã tạo hồ sơ xe vãng lai & liên kết thẻ RFID.'
        : 'Đã liên kết thẻ RFID với phương tiện.',
      created,
    });
  } catch (err) {
    console.error('POST /api/rfid/link', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

// Xe ra cổng xong → trả thẻ về trạng thái trắng để phát cho khách tiếp theo.
app.post('/api/rfid/unlink', async (req, res) => {
  try {
    const uid = String(req.body?.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'Thiếu mã UID thẻ.' });
    const r = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .query(`UPDATE dbo.vehicles SET rfid_uid = NULL WHERE rfid_uid = @uid`);
    return res.json({ ok: true, unlinked: r.rowsAffected[0] > 0 });
  } catch (err) {
    console.error('POST /api/rfid/unlink', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

// ─── RFID scan pipeline (tap → auto-capture → OCR → link) ────────────────────
// Strips formatting so "51G-123.45" / "51G 123 45" / "51g12345" all hash the
// same — the hash is a stable dedup/lookup key, never shown on screen (the
// Staff UI always shows the real plate text from OCR for visual verification).
function normalizePlate(plate) {
  return String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function hashPlate(plate) {
  const normalized = normalizePlate(plate);
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Xe vào bãi không qua đặt chỗ/RFID (staff gõ tay biển số) không tự biết
// user_id của chủ xe — tra theo biển số đã đăng ký trong dbo.vehicles, cùng
// cách so khớp (chính xác → chuẩn hóa) đã dùng cho /api/rfid/link, để phiên
// gửi xe của khách vãng lai vẫn hiện đúng trong "Xe đang đỗ tại bãi" của
// đúng tài khoản chủ xe thay vì luôn để trống.
async function findOwnerIdByPlate(licensePlate) {
  const clean = String(licensePlate || '').trim();
  if (!clean) return null;
  const exact = await pool.request()
    .input('plate', sql.NVarChar, clean)
    .query(`SELECT TOP 1 user_id FROM dbo.vehicles WHERE license_plate = @plate`);
  if (exact.recordset.length) return exact.recordset[0].user_id || null;

  const wanted = normalizePlate(clean);
  if (!wanted) return null;
  const all = await pool.request().query(`SELECT user_id, license_plate FROM dbo.vehicles`);
  const hit = all.recordset.find((v) => normalizePlate(v.license_plate) === wanted);
  return hit ? (hit.user_id || null) : null;
}

function toRfidScanDto(r) {
  return {
    id: String(r.scan_id),
    rfidUid: r.rfid_uid,
    gateId: r.gate_id || '',
    direction: r.direction || 'entry',
    status: r.status || 'Scanned',
    imageData: r.image_data || '',
    licensePlate: r.license_plate || '',
    licensePlateHash: r.license_plate_hash || '',
    vehicleId: r.vehicle_id != null ? String(r.vehicle_id) : '',
    scannedById: r.scanned_by_id || '',
    scannedByName: r.scanned_by_name || '',
    createdAt: r.created_at ? toVnStr(new Date(r.created_at)) : '',
  };
}

// Step 1 — Initial Save: fired the instant the card is read, before the
// camera/OCR step has produced anything yet.
app.post('/api/rfid-scans', async (req, res) => {
  try {
    const { rfidUid, gateId, direction, scannedById, scannedByName } = req.body;
    if (!rfidUid) return res.status(400).json({ error: 'Thiếu mã UID thẻ.' });

    const r = await pool.request()
      .input('rfid_uid', sql.NVarChar, rfidUid)
      .input('gate_id', sql.NVarChar, gateId || '')
      .input('direction', sql.NVarChar, direction === 'exit' ? 'exit' : 'entry')
      .input('scanned_by_id', sql.NVarChar, scannedById || '')
      .input('scanned_by_name', sql.NVarChar, scannedByName || '')
      .query(`
        INSERT INTO dbo.rfid_scans (rfid_uid, gate_id, direction, status, scanned_by_id, scanned_by_name)
        OUTPUT inserted.*
        VALUES (@rfid_uid, @gate_id, @direction, 'Scanned', @scanned_by_id, @scanned_by_name)
      `);
    return res.status(201).json(toRfidScanDto(r.recordset[0]));
  } catch (err) {
    console.error('POST /api/rfid-scans', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi ghi nhận lượt quét thẻ.' });
  }
});

// Step 4 — Final Data Link: the captured photo + OCR'd plate (server derives
// the hash) get attached to the scan row opened in step 1.
app.patch('/api/rfid-scans/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID lượt quét không hợp lệ.' });

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.rfid_scans WHERE scan_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy lượt quét thẻ.' });
    const existing = cur.recordset[0];

    const { imageData, licensePlate, vehicleId, status } = req.body;
    const plate = licensePlate !== undefined ? licensePlate : existing.license_plate;
    const resolvedVehicleId = vehicleId !== undefined ? (vehicleId ? Number(vehicleId) : null) : existing.vehicle_id;
    const resolvedStatus = status || (resolvedVehicleId ? 'Linked' : plate ? 'Captured' : existing.status);

    await pool.request()
      .input('id', sql.Int, id)
      .input('image_data', sql.NVarChar, imageData !== undefined ? imageData : existing.image_data)
      .input('license_plate', sql.NVarChar, plate)
      .input('license_plate_hash', sql.NVarChar, hashPlate(plate))
      .input('vehicle_id', sql.Int, resolvedVehicleId)
      .input('status', sql.NVarChar, resolvedStatus)
      .query(`
        UPDATE dbo.rfid_scans
        SET image_data = @image_data, license_plate = @license_plate, license_plate_hash = @license_plate_hash,
            vehicle_id = @vehicle_id, status = @status, updated_at = SYSUTCDATETIME()
        WHERE scan_id = @id
      `);

    const upd = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.rfid_scans WHERE scan_id = @id`);
    return res.json(toRfidScanDto(upd.recordset[0]));
  } catch (err) {
    console.error('PATCH /api/rfid-scans/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật lượt quét thẻ.' });
  }
});

// Đếm lượt quét bị từ chối HÔM NAY của đúng bãi — join thẳng tới
// dbo.users.assigned_parking_lot theo scanned_by_id (đều là ID thật trong DB)
// thay vì để frontend tự khớp qua mảng `users` cục bộ: mảng đó giữ ID "mock"
// cũ cho 4 tài khoản demo (DEMO-STF...) khác với ID thật currentUser.id dùng
// khi ghi rfid_scans, nên khớp phía client sẽ sai lệch cho đúng nhóm tài
// khoản hay dùng để test nhất. Nguồn duy nhất đáng tin ở đây là chính DB.
app.get('/api/rfid-scans/rejected-count', async (req, res) => {
  try {
    const lot = req.query.lot ? String(req.query.lot) : '';
    if (!lot) return res.status(400).json({ error: 'Thiếu tham số lot.' });
    const date = req.query.date ? String(req.query.date) : nowStr().slice(0, 10);

    // rfid_scans.created_at là UTC (SYSUTCDATETIME) — cộng +7h trước khi lấy
    // ngày để so đúng "ngày hôm nay" theo giờ VN như toVnStr() dùng để hiển thị.
    const r = await pool.request()
      .input('lot', sql.NVarChar, lot)
      .input('date', sql.Date, date)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM dbo.rfid_scans rs
        JOIN dbo.users u ON TRY_CAST(rs.scanned_by_id AS INT) = u.user_id
        WHERE rs.status = 'Rejected'
          AND CAST(DATEADD(HOUR, 7, rs.created_at) AS DATE) = @date
          AND u.assigned_parking_lot = @lot
      `);
    return res.json({ count: r.recordset[0]?.cnt ?? 0 });
  } catch (err) {
    console.error('GET /api/rfid-scans/rejected-count', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đếm lượt quét bị từ chối.' });
  }
});

app.get('/api/rfid-scans', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 200);
    const uidFilter = req.query.rfidUid ? String(req.query.rfidUid) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;

    const conditions = [];
    const request = pool.request();
    if (uidFilter) { conditions.push('rfid_uid = @uid'); request.input('uid', sql.NVarChar, uidFilter); }
    if (statusFilter) { conditions.push('status = @status'); request.input('status', sql.NVarChar, statusFilter); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const r = await request.query(
      `SELECT TOP ${limit} * FROM dbo.rfid_scans ${where} ORDER BY created_at DESC`,
    );
    return res.json(r.recordset.map(toRfidScanDto));
  } catch (err) {
    console.error('GET /api/rfid-scans', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải lượt quét thẻ.' });
  }
});

// Xóa hẳn bản ghi (kèm ảnh chụp) khỏi DB. Từ chối lượt quét ở Gate Control
// giờ dùng PATCH status='Rejected' (giữ lại để tính "Cảnh báo" theo bãi thay
// vì chỉ đếm accessLogs cục bộ trên từng trình duyệt) — route này chỉ còn
// dùng cho tác vụ dọn dữ liệu thủ công nếu cần.
app.delete('/api/rfid-scans/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID lượt quét không hợp lệ.' });
    const r = await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.rfid_scans WHERE scan_id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy lượt quét thẻ.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/rfid-scans/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa lượt quét thẻ.' });
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
    estimatedCost: r.estimated_cost ?? 0,
    parkingLot: r.parking_lot || '',
    createdAt: r.created_at || '',
    // Dòng thời gian trạng thái — mốc giờ thật của từng lần chuyển, dùng cho
    // hóa đơn phía driver ("xem chi tiết" → thấy đủ mốc Xác nhận/Check-in/...).
    confirmedAt: r.confirmed_at || '',
    checkedInAt: r.checked_in_at || '',
    completedAt: r.completed_at || '',
    cancelledAt: r.cancelled_at || '',
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

// SSE: đẩy đặt chỗ mới/cập nhật ngay lập tức tới cả driver và staff/manager
// đang mở app — user đặt chỗ xong staff thấy yêu cầu ngay, không phải chờ
// tới chu kỳ poll 10 giây tiếp theo.
const reservationSseClients = new Set();

function broadcastReservationEvent(dto) {
  const payload = `data: ${JSON.stringify(dto)}\n\n`;
  for (const client of reservationSseClients) {
    try { client.write(payload); } catch { reservationSseClients.delete(client); }
  }
}

app.get('/api/reservations/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  reservationSseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); reservationSseClients.delete(res); });
});

app.post('/api/reservations', async (req, res) => {
  try {
    const {
      id, userId, reservationCode, reservationType, slotAssignmentMode,
      vehicleType, licensePlate, date, startTime, endTime,
      floor, area, slotCode, status, note, estimatedCost, parkingLot, createdAt,
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
      .input('estimated_cost', sql.Float, Number(estimatedCost) || 0)
      .input('parking_lot', sql.NVarChar, parkingLot || '')
      .input('created_at', sql.NVarChar, createdAt || nowStr())
      .query(`
        INSERT INTO dbo.reservations
          (reservation_code, user_id, reservation_type, slot_assignment_mode, vehicle_type, license_plate,
           date, start_time, end_time, floor, area, slot_code, status, note, estimated_cost, parking_lot, created_at)
        OUTPUT inserted.*
        VALUES
          (@reservation_code, @user_id, @reservation_type, @slot_assignment_mode, @vehicle_type, @license_plate,
           @date, @start_time, @end_time, @floor, @area, @slot_code, @status, @note, @estimated_cost, @parking_lot, @created_at)
      `);

    // Successful booking → bell notification for the driver (guests have no
    // account to notify). Clicking it routes to "Lịch sử đặt chỗ".
    if (String(userId).toUpperCase() !== 'GUEST') {
      createNotification(
        String(userId),
        'booking_created',
        'Đặt chỗ thành công — chờ xác nhận',
        `${code} · ${licensePlate} · ${date} ${startTime}`,
        'reservations',
      ).catch((err) => console.error('createNotification(booking_created)', err));
    }

    const dto = toReservationDto(ins.recordset[0]);
    broadcastReservationEvent(dto);
    return res.status(201).json({ reservation: dto });
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
    // cancelledBy/cancelReason chỉ dùng để chọn nội dung thông báo — không lưu DB.
    // staffId: gửi kèm khi THAO TÁC XUẤT PHÁT TỪ STAFF (xác nhận/hủy) — backend
    // tự tra bãi được gán của staff đó và CHẶN nếu khác bãi của đặt chỗ, không
    // chỉ tin bộ lọc phía UI. User tự hủy đặt chỗ của mình thì không gửi staffId
    // nên không bị áp quy tắc này.
    const { status, note, slotCode, endTime, cancelledBy, cancelReason, staffId } = req.body;

    if (staffId && (status === 'Confirmed' || status === 'Checked-in' || status === 'Completed' || (status === 'Cancelled' && cancelledBy === 'staff'))) {
      const staffRow = await pool.request().input('sid', sql.Int, Number(staffId))
        .query(`SELECT assigned_parking_lot FROM dbo.users WHERE user_id = @sid`);
      const staffLot = lotKeyOfServer(staffRow.recordset[0]?.assigned_parking_lot);
      const resLot = lotKeyOfServer(ex.parking_lot);
      if (!staffLot || staffLot !== resLot) {
        return res.status(403).json({ error: 'Bạn không được phân công phụ trách bãi đỗ của đặt chỗ này.' });
      }
    }

    // Chỉ ghi mốc giờ dòng thời gian khi status THẬT SỰ đổi sang trạng thái đó
    // (không ghi đè nếu request PUT chỉ sửa note/slotCode mà giữ nguyên status).
    const statusChanged = status !== undefined && status !== ex.status;
    const stampCol =
      statusChanged && status === 'Confirmed' ? 'confirmed_at' :
      statusChanged && status === 'Checked-in' ? 'checked_in_at' :
      statusChanged && status === 'Completed' ? 'completed_at' :
      statusChanged && status === 'Cancelled' ? 'cancelled_at' :
      null;

    await pool.request()
      .input('id', sql.Int, ex.reservation_id)
      .input('status', sql.NVarChar, status !== undefined ? status : ex.status)
      .input('note', sql.NVarChar, note !== undefined ? note : ex.note)
      .input('slot_code', sql.NVarChar, slotCode !== undefined ? slotCode : ex.slot_code)
      .input('end_time', sql.NVarChar, endTime !== undefined ? endTime : ex.end_time)
      .input('stamp', sql.NVarChar, nowStr())
      .query(`
        UPDATE dbo.reservations
        SET status=@status, note=@note, slot_code=@slot_code, end_time=@end_time
            ${stampCol ? `, ${stampCol} = @stamp` : ''}
        WHERE reservation_id=@id
      `);

    const upd = await pool.request().input('id', sql.Int, ex.reservation_id)
      .query(`SELECT * FROM dbo.reservations WHERE reservation_id=@id`);

    // Hủy đặt chỗ → mọi payment còn "Unpaid" gắn với nó (vd. đã bấm "Thanh
    // toán VNPay" nhưng bỏ dở, chưa từng thu tiền thật) không còn ý nghĩa gì —
    // đánh dấu Failed để không bị tính nhầm là "còn nợ" ở Số dư chưa thanh
    // toán của khách hay các màn hình thanh toán của staff. Payment ĐÃ 'Paid'
    // thì giữ nguyên (mất tiền theo đúng chính sách không hoàn tiền).
    if (statusChanged && status === 'Cancelled') {
      await pool.request()
        .input('code', sql.NVarChar, String(ex.reservation_code))
        .query(`UPDATE dbo.payments SET status='Failed'
                WHERE status='Unpaid' AND (reservation_code=@code OR ticket_code=@code)`)
        .catch((err) => console.error('void unpaid payments on cancel', err));
    }

    // Staff confirming a Pending booking → notify the driver on their bell.
    if (status === 'Confirmed' && ex.status !== 'Confirmed') {
      createNotification(
        ex.user_id,
        'booking_confirmed',
        'Đã đặt xe thành công',
        `${ex.reservation_code} · ${ex.date} ${ex.start_time}`,
        'reservations',
      ).catch((err) => console.error('createNotification(booking_confirmed)', err));
    }

    // Staff check-in tại cổng (quẹt thẻ/biển số khớp đặt chỗ) → báo cho driver
    // biết xe đã vào bãi và ở ô nào.
    if (status === 'Checked-in' && ex.status !== 'Checked-in' && String(ex.user_id).toUpperCase() !== 'GUEST') {
      const finalSlot = upd.recordset[0].slot_code || ex.slot_code || '';
      createNotification(
        ex.user_id,
        'booking_checked_in',
        'Xe đã check-in vào bãi',
        `${ex.reservation_code} · ${ex.license_plate}${finalSlot ? ` · Ô ${finalSlot}` : ''}`,
        'reservations',
      ).catch((err) => console.error('createNotification(booking_checked_in)', err));
    }

    // Staff check-out tại cổng (quẹt thẻ khớp lượt gửi đã check-in trước đó) →
    // báo cho driver biết xe đã rời bãi, lượt gửi đã kết thúc.
    if (status === 'Completed' && ex.status !== 'Completed' && String(ex.user_id).toUpperCase() !== 'GUEST') {
      createNotification(
        ex.user_id,
        'booking_completed',
        'Xe đã check-out — cảm ơn đã sử dụng ParkFlow',
        `${ex.reservation_code} · ${ex.license_plate}`,
        'reservations',
      ).catch((err) => console.error('createNotification(booking_completed)', err));
    }

    // Any cancellation → bell notification saying who cancelled and why.
    // Clicking it routes to "Lịch sử đặt chỗ" (targetView 'reservations').
    if (status === 'Cancelled' && ex.status !== 'Cancelled' && String(ex.user_id).toUpperCase() !== 'GUEST') {
      let type = 'booking_cancelled';
      let title = 'Đặt chỗ đã bị hủy';
      if (cancelledBy === 'user') {
        type = 'booking_cancelled_user';
        title = 'Bạn đã hủy đặt chỗ';
      } else if (cancelledBy === 'staff' && cancelReason === 'overdue') {
        type = 'booking_cancelled_overdue';
        title = 'Đặt chỗ bị hủy do quá giờ check-in';
      } else if (cancelledBy === 'staff') {
        type = 'booking_cancelled_staff';
        title = 'Nhân viên đã hủy đặt chỗ của bạn';
      }
      createNotification(
        ex.user_id,
        type,
        title,
        `${ex.reservation_code} · ${ex.license_plate} · ${ex.date} ${ex.start_time}`,
        'reservations',
      ).catch((err) => console.error(`createNotification(${type})`, err));
    }

    const dto = toReservationDto(upd.recordset[0]);
    broadcastReservationEvent(dto);
    return res.json({ reservation: dto });
  } catch (err) {
    console.error('PUT /api/reservations/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật đặt chỗ.' });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    // Đọc trước để biết reservation_id thật — cần cho sự kiện SSE "deleted"
    // (client xóa theo id cục bộ, không phải reservation_id trong DB).
    let cur;
    if (!isNaN(numericId) && numericId > 0) {
      cur = await pool.request().input('id', sql.Int, numericId)
        .query(`SELECT reservation_id, reservation_code FROM dbo.reservations WHERE reservation_id = @id`);
    } else {
      cur = await pool.request().input('code', sql.NVarChar, id)
        .query(`SELECT reservation_id, reservation_code FROM dbo.reservations WHERE reservation_code = @code`);
    }
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy đặt chỗ.' });
    const dbId = cur.recordset[0].reservation_id;
    const dbCode = cur.recordset[0].reservation_code;

    const r = await pool.request().input('id', sql.Int, dbId)
      .query(`DELETE FROM dbo.reservations WHERE reservation_id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ error: 'Không tìm thấy đặt chỗ.' });

    // Đặt chỗ bị xóa hẳn (hủy ngay sau khi vừa đặt, chưa từng xác nhận) →
    // payment Unpaid gắn với nó (vd. đã bấm "Thanh toán VNPay" nhưng bỏ dở
    // giữa chừng, kể cả khi client-side chưa kịp dọn do race điều hướng sang
    // VNPay) cũng không còn ý nghĩa gì — xóa luôn, không để sót trên trang
    // Thanh toán. Payment đã 'Paid' thì không đụng tới (không thể xảy ra ở
    // đây vì reservation vừa mới tạo, nhưng vẫn chừa an toàn).
    await pool.request()
      .input('code', sql.NVarChar, String(dbCode))
      .query(`DELETE FROM dbo.payments WHERE status <> 'Paid' AND (reservation_code=@code OR ticket_code=@code)`)
      .catch((err) => console.error('void unpaid payments on reservation delete', err));

    broadcastReservationEvent({ deleted: true, id: String(dbId) });
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
  const tx = new sql.Transaction(pool);
  try {
    const {
      userId, ticketCode, licensePlate, vehicleType,
      checkInTime, expectedEndTime, entryGate, floor, area, slotCode, parkingLot,
      estimatedFee, paymentStatus, paymentMethod, sessionStatus, barrierStatus,
    } = req.body;

    if (!licensePlate || !vehicleType) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });

    // Reservation/RFID check-ins pass userId directly. A manually-typed
    // walk-in plate doesn't know its owner — resolve it from dbo.vehicles so
    // the driver (if the plate is registered to one) sees this session as
    // "their" car currently parked, same as a pre-booked check-in would.
    const resolvedUserId = userId || (await findOwnerIdByPlate(licensePlate)) || '';

    const code = ticketCode || `TK-${Date.now().toString().slice(-6)}`;
    const effectiveStatus = sessionStatus || 'Active';

    await tx.begin();
    let finalFloor = floor || '';
    let finalArea = area || '';
    let finalSlotCode = slotCode || '';
    let autoAssignedSlot = false;

    // Walk-in (no reservation → no slotCode from the client): auto-pick a
    // free slot matching the vehicle type instead of leaving the session
    // unparked. The subquery's UPDLOCK+READPAST makes "pick one Available row
    // and flip it to Occupied" atomic against concurrent entries — two staff
    // scanning cars in at the same moment can never grab the same slot.
    if (!finalSlotCode && effectiveStatus === 'Active') {
      const wantedVehicleType = normalizeVehicleTypeForSlotMatch(vehicleType);
      if (wantedVehicleType) {
        const pickReq = new sql.Request(tx);
        pickReq.input('vehicle_type', sql.NVarChar, wantedVehicleType);
        let pickQuery = `
          UPDATE dbo.parking_slots
          SET status = 'Occupied'
          OUTPUT inserted.slot_code, inserted.floor, inserted.zone
          WHERE slot_id = (
            SELECT TOP 1 slot_id FROM dbo.parking_slots WITH (UPDLOCK, ROWLOCK, READPAST)
            WHERE status = 'Available' AND vehicle_type = @vehicle_type
        `;
        if (parkingLot) {
          pickReq.input('parking_lot', sql.NVarChar, parkingLot);
          pickQuery += ` AND parking_lot = @parking_lot`;
        }
        pickQuery += ` ORDER BY slot_code)`;
        const picked = await pickReq.query(pickQuery);
        if (picked.recordset.length) {
          const row = picked.recordset[0];
          finalSlotCode = row.slot_code;
          finalFloor = String(row.floor);
          finalArea = row.zone;
          autoAssignedSlot = true;
        }
      }
    }

    const insReq = new sql.Request(tx);
    const ins = await insReq
      .input('user_id', sql.NVarChar, String(resolvedUserId))
      .input('ticket_code', sql.NVarChar, code)
      .input('license_plate', sql.NVarChar, licensePlate)
      .input('vehicle_type', sql.NVarChar, vehicleType)
      .input('check_in_time', sql.NVarChar, checkInTime || nowStr())
      .input('expected_end_time', sql.NVarChar, expectedEndTime || '')
      .input('entry_gate', sql.NVarChar, entryGate || '')
      .input('floor', sql.NVarChar, finalFloor)
      .input('area', sql.NVarChar, finalArea)
      .input('slot_code', sql.NVarChar, finalSlotCode)
      .input('estimated_fee', sql.Float, estimatedFee || 0)
      .input('payment_status', sql.NVarChar, paymentStatus || 'Unpaid')
      .input('payment_method', sql.NVarChar, paymentMethod || 'Cash')
      .input('session_status', sql.NVarChar, effectiveStatus)
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
    await tx.commit();
    if (autoAssignedSlot) broadcastSlotUpdate(finalSlotCode, 'Occupied');
    return res.status(201).json({ session: toSessionDto(ins.recordset[0]), autoAssignedSlot });
  } catch (err) {
    await tx.rollback().catch(() => {});
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
    reservationCode: r.reservation_code || '',
    licensePlate: r.license_plate || '',
    userName: r.full_name || '',
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

// Payments alone don't carry the plate or payer name — pull them in from the
// linked session or reservation (by ticket_code) and the user (by user_id) so
// Staff/Manager notifications can show "xe 51G-123.45 đã thanh toán ..." instead
// of raw IDs. Pre-payments made at booking time (ticket_code = reservation_code,
// e.g. "RSV-...") have no parking_sessions row yet — only reservations — so both
// are joined and COALESCE'd, otherwise those transactions show no plate at all.
const PAYMENTS_SELECT = `
  SELECT p.*, COALESCE(s.license_plate, r.license_plate) AS license_plate, u.full_name
  FROM dbo.payments p
  LEFT JOIN dbo.parking_sessions s ON s.ticket_code = p.ticket_code
  LEFT JOIN dbo.reservations r ON r.reservation_code = p.ticket_code
  LEFT JOIN dbo.users u ON TRY_CAST(p.user_id AS INT) = u.user_id
`;

// SSE: push payment create/update events instantly to Staff/Manager dashboards
// instead of waiting on their next poll cycle.
const paymentSseClients = new Set();

async function broadcastPaymentEvent(paymentId) {
  try {
    const r = await pool.request().input('id', sql.Int, paymentId)
      .query(`${PAYMENTS_SELECT} WHERE p.payment_id = @id`);
    if (!r.recordset.length) return;
    const payload = `data: ${JSON.stringify(toPaymentDto(r.recordset[0]))}\n\n`;
    for (const client of paymentSseClients) {
      try { client.write(payload); } catch { paymentSseClients.delete(client); }
    }
  } catch (err) {
    console.error('broadcastPaymentEvent', err);
  }
}

app.get('/api/payments/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);

  paymentSseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); paymentSseClients.delete(res); });
});

app.get('/api/payments', async (req, res) => {
  try {
    const { userId } = req.query;
    let r;
    if (userId) {
      r = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .query(`${PAYMENTS_SELECT} WHERE p.user_id = @user_id ORDER BY p.db_created_at DESC`);
    } else {
      r = await pool.request().query(`${PAYMENTS_SELECT} ORDER BY p.db_created_at DESC`);
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
      id, userId, ticketCode, reservationCode, parkingFee, extraServiceFee, lostTicketFee,
      overtimeFee, discount, totalAmount, method, status, createdAt, paidAt,
    } = req.body;

    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    const code = id || `PAY-${Date.now()}`;

    // Idempotency: same payment_code submitted twice (e.g. a rapid double-click
    // re-firing the same client-generated id) returns the existing row instead
    // of inserting a second one.
    const dup = await pool.request().input('code', sql.NVarChar, code)
      .query(`SELECT payment_id FROM dbo.payments WHERE payment_code = @code`);
    if (dup.recordset.length) {
      return res.json({ payment: toPaymentDto(
        (await pool.request().input('code', sql.NVarChar, code)
          .query(`SELECT * FROM dbo.payments WHERE payment_code = @code`)).recordset[0]
      )});
    }

    // Duplicate-invoice guard: this exact ticket already has an outstanding
    // (non-Paid) payment for this user — hand that back instead of opening a
    // second bill for the same debt (e.g. a retry after a dropped response).
    if (ticketCode) {
      const existing = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .input('ticket_code', sql.NVarChar, ticketCode)
        .query(`
          SELECT * FROM dbo.payments
          WHERE user_id = @user_id AND ticket_code = @ticket_code AND status <> 'Paid'
          ORDER BY db_created_at DESC
        `);
      if (existing.recordset.length) {
        return res.json({ payment: toPaymentDto(existing.recordset[0]) });
      }
    }

    const ins = await pool.request()
      .input('payment_code', sql.NVarChar, code)
      .input('user_id', sql.NVarChar, String(userId))
      .input('ticket_code', sql.NVarChar, ticketCode || '')
      .input('reservation_code', sql.NVarChar, reservationCode || '')
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
          (payment_code, user_id, ticket_code, reservation_code, parking_fee, extra_service_fee, lost_ticket_fee,
           overtime_fee, discount, total_amount, method, status, created_at, paid_at)
        OUTPUT inserted.*
        VALUES
          (@payment_code, @user_id, @ticket_code, @reservation_code, @parking_fee, @extra_service_fee, @lost_ticket_fee,
           @overtime_fee, @discount, @total_amount, @method, @status, @created_at, @paid_at)
      `);
    broadcastPaymentEvent(ins.recordset[0].payment_id);
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
    const { status, method, paidAt, totalAmount, parkingFee, extraServiceFee, overtimeFee, lostTicketFee, discount, ticketCode } = req.body;

    await pool.request()
      .input('id',                 sql.Int,      ex.payment_id)
      .input('status',             sql.NVarChar, status             !== undefined ? status             : ex.status)
      .input('method',             sql.NVarChar, method             !== undefined ? method             : ex.method)
      .input('paid_at',            sql.NVarChar, paidAt             !== undefined ? paidAt             : ex.paid_at)
      .input('total_amount',       sql.Float,    totalAmount        !== undefined ? totalAmount        : ex.total_amount)
      .input('parking_fee',        sql.Float,    parkingFee         !== undefined ? parkingFee         : ex.parking_fee)
      .input('extra_service_fee',  sql.Float,    extraServiceFee    !== undefined ? extraServiceFee    : ex.extra_service_fee)
      .input('overtime_fee',       sql.Float,    overtimeFee        !== undefined ? overtimeFee        : ex.overtime_fee)
      .input('lost_ticket_fee',    sql.Float,    lostTicketFee      !== undefined ? lostTicketFee      : ex.lost_ticket_fee)
      .input('discount',           sql.Float,    discount           !== undefined ? discount           : ex.discount)
      .input('ticket_code',        sql.NVarChar, ticketCode         !== undefined ? ticketCode         : ex.ticket_code)
      .query(`UPDATE dbo.payments
        SET status=@status, method=@method, paid_at=@paid_at,
            total_amount=@total_amount, parking_fee=@parking_fee,
            extra_service_fee=@extra_service_fee, overtime_fee=@overtime_fee,
            lost_ticket_fee=@lost_ticket_fee,
            discount=@discount, ticket_code=@ticket_code
        WHERE payment_id=@id`);

    const upd = await pool.request().input('id', sql.Int, ex.payment_id)
      .query(`SELECT * FROM dbo.payments WHERE payment_id=@id`);
    broadcastPaymentEvent(ex.payment_id);
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
    userName: r.full_name || '',
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
    // Join the sender's name so Staff sees who filed each report (guest
    // submissions have user_id 'GUEST' and resolve to no name).
    const FEEDBACKS_SELECT = `
      SELECT f.*, u.full_name FROM dbo.feedbacks f
      LEFT JOIN dbo.users u ON TRY_CAST(f.user_id AS INT) = u.user_id
    `;
    if (userId) {
      r = await pool.request()
        .input('user_id', sql.NVarChar, String(userId))
        .query(`${FEEDBACKS_SELECT} WHERE f.user_id = @user_id ORDER BY f.db_created_at DESC`);
    } else {
      r = await pool.request().query(`${FEEDBACKS_SELECT} ORDER BY f.db_created_at DESC`);
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

    if (!type) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    // Guest submissions from the public Contact page have no logged-in account —
    // fall back to a placeholder instead of rejecting, so Staff still receives them.
    const safeUserId = userId ? String(userId) : 'GUEST';
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
      .input('user_id', sql.NVarChar, safeUserId)
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

// ─── staff/manager chat ──────────────────────────────────────────────────────

function toChatMessageDto(r) {
  return {
    id: String(r.message_id),
    senderId: String(r.sender_id),
    senderName: r.sender_name || '',
    senderRole: r.sender_role,
    message: r.message,
    createdAt: r.created_at || '',
  };
}

const chatSseClients = new Set();

function broadcastChatMessage(dto) {
  const payload = `data: ${JSON.stringify(dto)}\n\n`;
  for (const client of chatSseClients) {
    try { client.write(payload); } catch { chatSseClients.delete(client); }
  }
}

app.get('/api/staff-manager-messages/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  chatSseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); chatSseClients.delete(res); });
});

app.get('/api/staff-manager-messages', async (_req, res) => {
  try {
    const r = await pool.request().query(`SELECT TOP 200 * FROM dbo.staff_manager_messages ORDER BY db_created_at ASC`);
    return res.json(r.recordset.map(toChatMessageDto));
  } catch (err) {
    console.error('GET /api/staff-manager-messages', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải tin nhắn.' });
  }
});

app.post('/api/staff-manager-messages', async (req, res) => {
  try {
    const { senderId, senderName, senderRole, message } = req.body;
    if (!senderId || !senderRole || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    }
    const ins = await pool.request()
      .input('sender_id', sql.NVarChar, String(senderId))
      .input('sender_name', sql.NVarChar, senderName || '')
      .input('sender_role', sql.NVarChar, senderRole)
      .input('message', sql.NVarChar, String(message).trim())
      .input('created_at', sql.NVarChar, nowStr())
      .query(`
        INSERT INTO dbo.staff_manager_messages (sender_id, sender_name, sender_role, message, created_at)
        OUTPUT inserted.*
        VALUES (@sender_id, @sender_name, @sender_role, @message, @created_at)
      `);
    const dto = toChatMessageDto(ins.recordset[0]);
    broadcastChatMessage(dto);
    return res.status(201).json({ message: dto });
  } catch (err) {
    console.error('POST /api/staff-manager-messages', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi gửi tin nhắn.' });
  }
});

// ─── notifications ───────────────────────────────────────────────────────────

function toNotificationDto(r) {
  return {
    id: String(r.notification_id),
    userId: String(r.user_id),
    type: r.type,
    title: r.title,
    body: r.body || '',
    targetView: r.target_view || '',
    isRead: !!r.is_read,
    createdAt: r.created_at || '',
  };
}

const notificationSseClients = new Set();

function broadcastNotification(dto) {
  const payload = `data: ${JSON.stringify(dto)}\n\n`;
  for (const client of notificationSseClients) {
    try { client.write(payload); } catch { notificationSseClients.delete(client); }
  }
}

// ─── IoT: RFID tap relay (Arduino/ESP32 → Gate Control OCR station) ──────────
// The reader hardware POSTs each card tap to /api/iot/rfid-tap; every open
// Gate Control screen listens on /api/iot/rfid-events (SSE) and runs the
// automated capture → PaddleOCR → save pipeline for the tapped UID.
const iotRfidSseClients = new Set();

function broadcastRfidTap(evt) {
  const payload = `data: ${JSON.stringify(evt)}\n\n`;
  for (const client of iotRfidSseClients) {
    try { client.write(payload); } catch { iotRfidSseClients.delete(client); }
  }
}

app.get('/api/iot/rfid-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  iotRfidSseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); iotRfidSseClients.delete(res); });
});

// Called by the Arduino/ESP32 firmware — body: { "rfidUid": "04A2B1C3",
// "gateId": "A1", "direction": "entry" } (gateId/direction optional).
// Now async: looks up the UID in dbo.vehicles and returns openBarrier=true
// if the card is registered so the ESP32 knows whether to open the servo.
app.post('/api/iot/rfid-tap', async (req, res) => {
  lastEsp32SeenMs = Date.now();
  const { rfidUid, gateId, direction } = req.body || {};
  const uid = String(rfidUid || '').trim().toUpperCase();
  if (!uid) return res.status(400).json({ error: 'Thiếu rfidUid.' });
  const evt = {
    rfidUid: uid,
    gateId: String(gateId || '').trim(),
    direction: direction === 'exit' ? 'exit' : 'entry',
    ts: Date.now(),
  };

  // Đẩy sự kiện cho web NGAY LẬP TỨC — camera bắt đầu chụp song song trong lúc
  // backend còn đang tra DB trả lời ESP32, không bắt web đợi thêm một lượt query.
  broadcastRfidTap(evt);

  // Check if this UID is registered → tell ESP32 whether to open the barrier.
  // CHIỀU RA không bao giờ tự mở: xe phải qua bước staff xác nhận thu phí, lệnh
  // mở rào sẽ tới qua hàng đợi gate-command sau khi thanh toán xong.
  let openBarrier = false;
  let vehicleInfo = null;
  try {
    const r = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .query(`
        SELECT v.license_plate, v.vehicle_type, u.full_name
        FROM dbo.vehicles v
        LEFT JOIN dbo.users u ON TRY_CAST(v.user_id AS INT) = u.user_id
        WHERE v.rfid_uid = @uid
      `);
    if (r.recordset.length > 0) {
      openBarrier = evt.direction === 'entry';
      vehicleInfo = r.recordset[0];
    }
  } catch (err) {
    console.error('IoT RFID lookup error:', err.message);
  }

  console.log(`IoT RFID tap: ${uid} → openBarrier=${openBarrier} (gate=${evt.gateId || '?'} dir=${evt.direction}) → ${iotRfidSseClients.size} client(s)`);
  return res.json({
    ok: true,
    received: evt,
    listeners: iotRfidSseClients.size,
    openBarrier,
    vehicle: vehicleInfo ? {
      licensePlate: vehicleInfo.license_plate,
      vehicleType: vehicleInfo.vehicle_type,
      ownerName: vehicleInfo.full_name || '',
    } : null,
  });
});

// ─── IoT: Manual gate command queue (ESP32 polls, frontend pushes) ────────────
// Staff bấm "Mở rào / Đóng rào" → POST đây → ESP32 poll GET và thực thi.
const gateCommandQueue = new Map(); // gateId → 'open' | 'close'

// ESP32 poll lệnh rào mỗi ~1s — mốc thời gian này cho biết thiết bị còn sống.
// Badge "IoT: Trực tuyến" trên web chỉ bật khi ESP32 gọi về trong 10s gần nhất.
let lastEsp32SeenMs = 0;

app.post('/api/iot/gate-command', (req, res) => {
  const { gateId, command } = req.body || {};
  const gid = String(gateId || '').trim();
  if (!gid || !['open', 'close'].includes(command)) {
    return res.status(400).json({ error: 'Cần gateId và command (open | close).' });
  }
  gateCommandQueue.set(gid, command);
  console.log(`IoT gate command queued: gate=${gid} cmd=${command}`);
  return res.json({ ok: true, gateId: gid, command });
});

// ESP32 gọi endpoint này mỗi ~1 giây; lệnh bị xóa ngay sau khi đọc.
app.get('/api/iot/gate-command/:gateId', (req, res) => {
  lastEsp32SeenMs = Date.now();
  const gateId = String(req.params.gateId || '').trim();
  const command = gateCommandQueue.get(gateId) || null;
  if (command) gateCommandQueue.delete(gateId);
  return res.json({ command });
});

// HTTP polling source for iotService.ts (VITE_IOT_HTTP_URL).
// Returns recent RFID scan rows formatted as ScanEvent so the frontend
// IoT status badge shows "online" and scans appear in the live list.
app.get('/api/iot/scan-events', async (req, res) => {
  try {
    const sinceMs = Number(req.query.since) || 0;
    // Default window: last 30 seconds on the very first poll
    const sinceDate = new Date(sinceMs > 0 ? sinceMs : Date.now() - 30000);
    const r = await pool.request()
      .input('since', sql.DateTime2, sinceDate)
      .query(`
        SELECT TOP 50
          scan_id, rfid_uid, gate_id, direction, license_plate, status, created_at
        FROM dbo.rfid_scans
        WHERE created_at > @since
        ORDER BY created_at DESC
      `);
    const events = r.recordset.map((row) => ({
      id:           `RFID-${row.scan_id}`,
      gateId:       row.gate_id      || 'A1',
      direction:    row.direction    || 'entry',
      licensePlate: row.license_plate || '',
      rfidUid:      row.rfid_uid,
      recognition:  row.license_plate ? 'casual' : 'unknown',
      timestamp:    new Date(row.created_at).toISOString(),
    }));
    // esp32Online: thiết bị có gọi về (poll lệnh rào / quẹt thẻ) trong 10s qua
    return res.json({ esp32Online: Date.now() - lastEsp32SeenMs < 10000, events });
  } catch (err) {
    console.error('GET /api/iot/scan-events', err);
    return res.status(500).json({ esp32Online: false, events: [] });
  }
});

/** Inserts a notification row for a user and pushes it out over SSE. */
async function createNotification(userId, type, title, body, targetView) {
  const ins = await pool.request()
    .input('user_id', sql.NVarChar, String(userId))
    .input('type', sql.NVarChar, type)
    .input('title', sql.NVarChar, title)
    .input('body', sql.NVarChar, body || '')
    .input('target_view', sql.NVarChar, targetView || '')
    .input('created_at', sql.NVarChar, nowStr())
    .query(`
      INSERT INTO dbo.notifications (user_id, type, title, body, target_view, created_at)
      OUTPUT inserted.*
      VALUES (@user_id, @type, @title, @body, @target_view, @created_at)
    `);
  const dto = toNotificationDto(ins.recordset[0]);
  broadcastNotification(dto);
  return dto;
}

app.get('/api/notifications/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  notificationSseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); notificationSseClients.delete(res); });
});

app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    const r = await pool.request()
      .input('user_id', sql.NVarChar, String(userId))
      .query(`SELECT TOP 100 * FROM dbo.notifications WHERE user_id = @user_id ORDER BY db_created_at DESC`);
    const notifications = r.recordset.map(toNotificationDto);
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('GET /api/notifications', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải thông báo.' });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.request().input('id', sql.Int, id)
      .query(`UPDATE dbo.notifications SET is_read = 1 WHERE notification_id = @id`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/notifications/:id/read', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật thông báo.' });
  }
});

app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    await pool.request().input('user_id', sql.NVarChar, String(userId))
      .query(`UPDATE dbo.notifications SET is_read = 1 WHERE user_id = @user_id AND is_read = 0`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/notifications/read-all', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật thông báo.' });
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

app.get('/api/slots', async (req, res) => {
  try {
    // ?lot=ParkFlow Thủ Đức — lọc theo bãi (bỏ trống = tất cả các bãi)
    const lotFilter = req.query.lot ? String(req.query.lot) : null;
    const r = lotFilter
      ? await pool.request().input('lot', sql.NVarChar, lotFilter).query(
          `SELECT slot_code, floor, zone, vehicle_type, status, parking_lot
           FROM dbo.parking_slots WHERE parking_lot = @lot ORDER BY slot_code`)
      : await pool.request().query(
          `SELECT slot_code, floor, zone, vehicle_type, status, parking_lot FROM dbo.parking_slots ORDER BY slot_code`);
    const vtMap = {
      'Xe máy / Xe máy điện':    'motorbike',
      'Ô tô 4-7 chỗ (Xăng)':    'car',
      'Ô tô 4-7 chỗ (Điện / EV)': 'electric vehicle',
      'Xe máy': 'motorbike', 'motorbike': 'motorbike',
      'Ô tô':   'car',       'car':       'car',
      'Xe đạp': 'electric vehicle', 'electric vehicle': 'electric vehicle', 'bicycle': 'electric vehicle',
    };
    // Toàn bộ bãi hiện chỉ vận hành trên 1 tầng duy nhất — luôn hiển thị
    // "Tầng 1" bất kể giá trị floor thô trong DB (giữ nguyên số floor gốc
    // để không ảnh hưởng logic khác, chỉ chuẩn hóa nhãn hiển thị).
    const floorLabel = (_f) => 'Tầng 1';
    // Seed data ghi status chữ thường ("available") còn API PATCH ghi chuẩn
    // ("Available") — chuẩn hóa một chỗ ở đây để sơ đồ bãi của mọi role
    // (user đặt chỗ / staff / manager) nhận cùng một bộ giá trị.
    const canonStatus = {
      available: 'Available', occupied: 'Occupied', reserved: 'Reserved',
      pending: 'Pending', maintenance: 'Maintenance', locked: 'Locked',
    };
    return res.json(r.recordset.map((s) => ({
      id: `SL-${s.slot_code.replace(/^F1-/, '')}`,
      slotCode: s.slot_code,
      floorName: floorLabel(s.floor),
      areaName: `Khu ${s.zone} — ${s.vehicle_type}`,
      vehicleType: vtMap[s.vehicle_type] ?? 'car',
      status: canonStatus[String(s.status || '').toLowerCase()] || 'Available',
      parkingLot: s.parking_lot || 'ParkFlow Quận 9',
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

// Staff/Manager-only: force an Occupied slot back to Available, closing any
// linked active session so it can't be left orphaned, and logging who/why.
app.post('/api/slots/:slotCode/force-clear', async (req, res) => {
  try {
    const slotCode = decodeURIComponent(req.params.slotCode);
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'Thiếu userId của người thực hiện.' });

    const userIdNum = Number(userId);
    if (!Number.isInteger(userIdNum))
      return res.status(403).json({ error: 'Không xác định được người dùng thực hiện thao tác.' });

    const userResult = await pool.request()
      .input('user_id', sql.Int, userIdNum)
      .query(`SELECT full_name, role FROM dbo.users WHERE user_id = @user_id`);
    if (!userResult.recordset.length)
      return res.status(403).json({ error: 'Không tìm thấy người dùng thực hiện thao tác.' });

    const performer = userResult.recordset[0];
    const roleForStorage = normalizeRoleForStorage(performer.role);
    if (!['staff', 'manager', 'admin'].includes(roleForStorage))
      return res.status(403).json({ error: 'Chỉ Nhân viên hoặc Quản lý mới được phép buộc dọn ô đỗ.' });

    const slotResult = await pool.request()
      .input('slot_code', sql.NVarChar, slotCode)
      .query(`SELECT status FROM dbo.parking_slots WHERE slot_code = @slot_code`);
    if (!slotResult.recordset.length)
      return res.status(404).json({ error: 'Không tìm thấy ô đỗ.' });
    if (String(slotResult.recordset[0].status).toLowerCase() !== 'occupied')
      return res.status(409).json({ error: 'Ô đỗ hiện không ở trạng thái Đang sử dụng.' });

    // Close whatever active session is still pointing at this slot so it
    // isn't left orphaned once the slot flips back to Available.
    const sessionResult = await pool.request()
      .input('slot_code', sql.NVarChar, slotCode)
      .query(`
        SELECT TOP 1 session_id, ticket_code, license_plate
        FROM dbo.parking_sessions
        WHERE slot_code = @slot_code AND session_status = 'Active'
        ORDER BY db_created_at DESC
      `);
    const session = sessionResult.recordset[0] || null;

    if (session) {
      await pool.request()
        .input('id', sql.Int, session.session_id)
        .input('check_out_time', sql.NVarChar, nowStr())
        .query(`
          UPDATE dbo.parking_sessions
          SET session_status = 'Force Closed', barrier_status = 'Opened', check_out_time = @check_out_time
          WHERE session_id = @id
        `);
    }

    await pool.request()
      .input('slot_code', sql.NVarChar, slotCode)
      .query(`UPDATE dbo.parking_slots SET status = 'Available' WHERE slot_code = @slot_code`);
    broadcastSlotUpdate(slotCode, 'Available');

    await pool.request()
      .input('slot_code', sql.NVarChar, slotCode)
      .input('session_id', sql.Int, session ? session.session_id : null)
      .input('ticket_code', sql.NVarChar, session?.ticket_code || '')
      .input('license_plate', sql.NVarChar, session?.license_plate || '')
      .input('performed_by_id', sql.NVarChar, String(userIdNum))
      .input('performed_by_name', sql.NVarChar, performer.full_name || '')
      .input('performed_by_role', sql.NVarChar, roleForStorage)
      .input('reason', sql.NVarChar, (reason || '').trim())
      .query(`
        INSERT INTO dbo.force_clear_logs
          (slot_code, session_id, ticket_code, license_plate, performed_by_id, performed_by_name, performed_by_role, reason)
        VALUES
          (@slot_code, @session_id, @ticket_code, @license_plate, @performed_by_id, @performed_by_name, @performed_by_role, @reason)
      `);

    return res.json({
      slotCode,
      status: 'Available',
      sessionClosed: !!session,
      ticketCode: session?.ticket_code || '',
      licensePlate: session?.license_plate || '',
    });
  } catch (err) {
    console.error('POST /api/slots/:slotCode/force-clear', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi buộc dọn ô đỗ.' });
  }
});

// Staff/Manager: di chuyển xe đang đỗ từ ô hiện tại sang một ô Trống khác —
// dùng khi cần sắp xếp lại bãi. Ô đích BẮT BUỘC cùng loại xe với ô hiện tại
// (khoá chung trong câu UPDATE atomic bên dưới, không tin dữ liệu client gửi
// lên) và phải đang "Available", tránh đá xe khác đang đỗ hoặc gán nhầm loại.
app.post('/api/slots/:fromSlotCode/relocate', async (req, res) => {
  const tx = new sql.Transaction(pool);
  try {
    const fromSlotCode = decodeURIComponent(req.params.fromSlotCode);
    const { toSlotCode, actorId } = req.body;
    if (!toSlotCode) return res.status(400).json({ error: 'Thiếu ô đỗ đích.' });
    if (fromSlotCode === toSlotCode) return res.status(400).json({ error: 'Ô đích phải khác ô hiện tại.' });

    const actor = await loadActor(actorId);
    if (!actor) return res.status(403).json({ error: 'Không xác định được người thực hiện thao tác.' });
    if (!['staff', 'manager', 'admin'].includes(actor.role))
      return res.status(403).json({ error: 'Bạn không có quyền chuyển ô đỗ.' });

    await tx.begin();

    const fromReq = new sql.Request(tx);
    const fromResult = await fromReq.input('slot_code', sql.NVarChar, fromSlotCode)
      .query(`SELECT status, vehicle_type FROM dbo.parking_slots WHERE slot_code = @slot_code`);
    if (!fromResult.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy ô đỗ hiện tại.' });
    }
    const fromSlot = fromResult.recordset[0];
    if (fromSlot.status !== 'Occupied') {
      await tx.rollback();
      return res.status(409).json({ error: 'Ô hiện tại không có xe đang đỗ.' });
    }

    // Chiếm ô đích một cách atomic — chỉ khớp khi còn Trống VÀ đúng loại xe
    // với ô nguồn; UPDLOCK+READPAST tránh hai yêu cầu chuyển ô cùng lúc giành
    // trùng một ô đích.
    const toReq = new sql.Request(tx);
    toReq.input('vehicle_type', sql.NVarChar, fromSlot.vehicle_type);
    toReq.input('to_slot_code', sql.NVarChar, toSlotCode);
    const toPicked = await toReq.query(`
      UPDATE dbo.parking_slots
      SET status = 'Occupied'
      OUTPUT inserted.slot_code, inserted.floor, inserted.zone
      WHERE slot_id = (
        SELECT TOP 1 slot_id FROM dbo.parking_slots WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE slot_code = @to_slot_code AND status = 'Available' AND vehicle_type = @vehicle_type
      )
    `);
    if (!toPicked.recordset.length) {
      await tx.rollback();
      return res.status(409).json({ error: 'Ô đích không còn trống hoặc không đúng loại xe với xe đang đỗ.' });
    }
    const toSlot = toPicked.recordset[0];

    const freeReq = new sql.Request(tx);
    await freeReq.input('slot_code', sql.NVarChar, fromSlotCode)
      .query(`UPDATE dbo.parking_slots SET status = 'Available' WHERE slot_code = @slot_code`);

    // Cập nhật CẢ hai nguồn nếu có — một lượt check-in từ đặt chỗ trước có cả
    // dbo.parking_sessions lẫn dbo.reservations cùng trỏ về ô cũ, phải đồng bộ
    // cả hai để "Xe đang đỗ trong bãi" (mọi nơi, kể cả phía user) khớp nhau.
    const sessReq = new sql.Request(tx);
    const sessUpd = await sessReq
      .input('from_slot', sql.NVarChar, fromSlotCode)
      .input('to_slot', sql.NVarChar, toSlot.slot_code)
      .input('floor', sql.NVarChar, String(toSlot.floor))
      .input('area', sql.NVarChar, toSlot.zone)
      .query(`
        UPDATE dbo.parking_sessions
        SET slot_code = @to_slot, floor = @floor, area = @area
        OUTPUT inserted.session_id
        WHERE slot_code = @from_slot AND session_status = 'Active'
      `);

    const resvReq = new sql.Request(tx);
    const resvUpd = await resvReq
      .input('from_slot', sql.NVarChar, fromSlotCode)
      .input('to_slot', sql.NVarChar, toSlot.slot_code)
      .input('floor', sql.NVarChar, String(toSlot.floor))
      .input('area', sql.NVarChar, toSlot.zone)
      .query(`
        UPDATE dbo.reservations
        SET slot_code = @to_slot, floor = @floor, area = @area
        OUTPUT inserted.reservation_id
        WHERE slot_code = @from_slot AND status = 'Checked-in'
      `);

    if (!sessUpd.recordset.length && !resvUpd.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy xe đang đỗ tại ô này.' });
    }

    await tx.commit();
    broadcastSlotUpdate(fromSlotCode, 'Available');
    broadcastSlotUpdate(toSlot.slot_code, 'Occupied');
    return res.json({
      fromSlotCode,
      toSlotCode: toSlot.slot_code,
      floor: String(toSlot.floor),
      area: toSlot.zone,
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error('POST /api/slots/:fromSlotCode/relocate', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi chuyển ô đỗ.' });
  }
});

app.get('/api/force-clear-logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const r = await pool.request().query(
      `SELECT TOP ${limit} * FROM dbo.force_clear_logs ORDER BY created_at DESC`
    );
    return res.json(r.recordset.map((row) => ({
      id: String(row.log_id),
      slotCode: row.slot_code,
      ticketCode: row.ticket_code || '',
      licensePlate: row.license_plate || '',
      performedByName: row.performed_by_name || '',
      performedByRole: row.performed_by_role || '',
      reason: row.reason || '',
      createdAt: row.created_at ? toVnStr(new Date(row.created_at)) : '',
    })));
  } catch (err) {
    console.error('GET /api/force-clear-logs', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải nhật ký.' });
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
      reportedAt: row.reported_at ? toVnStr(new Date(row.reported_at)) : '',
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
      reportedAt: row.reported_at ? toVnStr(new Date(row.reported_at)) : '',
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
    if (!['Approved', 'Rejected', 'Pending', 'Resolved'].includes(status))
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
    } else if (status === 'Rejected' || status === 'Resolved') {
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

// ─── parking lots ────────────────────────────────────────────────────────────

const LOT_STATUSES = ['Hoạt động', 'Bảo trì', 'Đóng cửa'];

// Mặt bằng mẫu dùng chung cho mọi bãi (khớp buildSpaces() trong
// ParkingFloorMap.tsx): số ô tối đa mỗi dãy, cùng loại xe/tầng/khu mặc định.
// Admin chọn bật/tắt từng vị trí trong lưới này chứ không đặt toạ độ tự do.
const GRID_ROWS = { A: 11, B: 5, C: 5, D: 4, E: 11 };
const ROW_DEFAULTS = {
  A: { floor:  2, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)' },
  B: { floor:  1, zone: 'A', vehicleType: 'Xe máy / Xe máy điện' },
  C: { floor:  1, zone: 'C', vehicleType: 'Ô tô 4-7 chỗ (Điện / EV)' },
  D: { floor: -1, zone: 'A', vehicleType: 'Ô tô 4-7 chỗ (Xăng)' },
  E: { floor:  1, zone: 'B', vehicleType: 'Xe máy / Xe máy điện' },
};
// Khoá loại xe frontend gửi lên → nhãn lưu trong dbo.parking_slots.vehicle_type
// (đảo ngược vtMap của GET /api/slots).
const SLOT_VEHICLE_LABEL = {
  car:                'Ô tô 4-7 chỗ (Xăng)',
  motorbike:          'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

/** 'A01' hợp lệ khi nằm trong lưới mẫu (A01-A11, B01-B05, C01-C05, D01-D04, E01-E11). */
function isValidGridCode(code) {
  const m = /^([A-E])(\d{2})$/.exec(String(code || ''));
  if (!m) return false;
  const num = Number(m[2]);
  return num >= 1 && num <= GRID_ROWS[m[1]];
}

function stripDiacritics(s) {
  // Lọc theo mã ký tự thay vì regex có dải ký tự tổ hợp viết thẳng — tránh phụ
  // thuộc vào cách file được lưu/encode.
  return [...String(s || '').normalize('NFD')]
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c < 0x0300 || c > 0x036f;
    })
    .join('')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/**
 * Sinh prefix mã ô duy nhất cho bãi mới ('ParkFlow Nhà Văn Hóa' → 'NVH-').
 * slot_code phải UNIQUE toàn cục nên mỗi bãi cần prefix riêng; prefix rỗng đã
 * thuộc về bãi gốc Quận 9 nên bãi mới luôn có prefix khác rỗng.
 */
async function generateCodePrefix(name) {
  const words = stripDiacritics(name).toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
    .filter(Boolean).filter((w) => w !== 'PARKFLOW');
  const base = (words.map((w) => w[0]).join('').slice(0, 4)) || 'L';

  const taken = await pool.request().query(`SELECT code_prefix FROM dbo.parking_lots`);
  const used = new Set(taken.recordset.map((r) => r.code_prefix));
  if (!used.has(`${base}-`)) return `${base}-`;
  for (let i = 2; i < 1000; i++) {
    if (!used.has(`${base}${i}-`)) return `${base}${i}-`;
  }
  return `L${Date.now().toString(36).toUpperCase()}-`;
}

function toGateDto(r) {
  return { id: r.gate_id, kind: r.kind, label: r.label || '', position: r.position };
}

function toParkingLotDto(r, gates = [], slots = []) {
  return {
    // `name`/`status`/`updatedAt` giữ nguyên tên trường — mọi caller cũ
    // (ManagerParkingLots, StaffDashboard, AvailableSlots) đọc đúng 3 trường này.
    name: r.name,
    status: r.status,
    updatedAt: r.updated_at ? toVnStr(new Date(r.updated_at)) : '',
    id: r.lot_id,
    // Khoá ổn định để frontend so khớp bãi thay cho union LotKey cứng trước đây.
    key: String(r.lot_id),
    codePrefix: r.code_prefix || '',
    bookingLabel: r.booking_label || r.name,
    address: r.address || '',
    description: r.description || '',
    imageKey: r.image_key || '',
    imageData: r.image_data || '',
    mapsUrl: r.maps_url || '',
    slotCount: slots.length,
    slots,
    gates: gates.map(toGateDto),
  };
}

/** Đọc gates + mã ô lưới của mọi bãi một lượt (tránh N+1 khi trả danh sách). */
async function loadLotChildren() {
  const [gates, slots] = await Promise.all([
    pool.request().query(`SELECT * FROM dbo.parking_lot_gates ORDER BY gate_id ASC`),
    pool.request().query(`SELECT parking_lot, slot_code, vehicle_type FROM dbo.parking_slots`),
  ]);
  const gatesByLot = new Map();
  for (const g of gates.recordset) {
    if (!gatesByLot.has(g.lot_id)) gatesByLot.set(g.lot_id, []);
    gatesByLot.get(g.lot_id).push(g);
  }
  const vtKey = Object.fromEntries(Object.entries(SLOT_VEHICLE_LABEL).map(([k, v]) => [v, k]));
  const slotsByLot = new Map();
  for (const s of slots.recordset) {
    // slot_code = <prefix>F1-A01 → mã lưới là đoạn cuối sau dấu '-'
    const code = String(s.slot_code).split('-').pop();
    if (!isValidGridCode(code)) continue;
    if (!slotsByLot.has(s.parking_lot)) slotsByLot.set(s.parking_lot, []);
    slotsByLot.get(s.parking_lot).push({ code, vehicleType: vtKey[s.vehicle_type] || 'car' });
  }
  return { gatesByLot, slotsByLot };
}

app.get('/api/parking-lots', async (_req, res) => {
  try {
    const r = await pool.request().query(`SELECT * FROM dbo.parking_lots ORDER BY lot_id ASC`);
    const { gatesByLot, slotsByLot } = await loadLotChildren();
    return res.json(r.recordset.map((row) =>
      toParkingLotDto(row, gatesByLot.get(row.lot_id) || [], slotsByLot.get(row.name) || [])));
  } catch (err) {
    console.error('GET /api/parking-lots', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tải danh sách bãi đỗ.' });
  }
});

/** Trả về DTO đầy đủ của một bãi sau khi ghi (dùng chung cho POST/PUT). */
async function readLotById(id) {
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT * FROM dbo.parking_lots WHERE lot_id = @id`);
  if (!r.recordset.length) return null;
  const row = r.recordset[0];
  const { gatesByLot, slotsByLot } = await loadLotChildren();
  return toParkingLotDto(row, gatesByLot.get(row.lot_id) || [], slotsByLot.get(row.name) || []);
}

/** Ghi lại toàn bộ cổng của một bãi (thay thế trọn bộ). */
async function replaceGates(lotId, gates) {
  await pool.request().input('lot_id', sql.Int, lotId)
    .query(`DELETE FROM dbo.parking_lot_gates WHERE lot_id = @lot_id`);
  for (const g of Array.isArray(gates) ? gates : []) {
    if (!['entry', 'exit'].includes(g.kind)) continue;
    await pool.request()
      .input('lot_id',   sql.Int,      lotId)
      .input('kind',     sql.NVarChar, g.kind)
      .input('label',    sql.NVarChar, String(g.label || '').slice(0, 100))
      .input('position', sql.NVarChar, ['left', 'center', 'right'].includes(g.position) ? g.position : 'left')
      .query(`
        INSERT INTO dbo.parking_lot_gates (lot_id, kind, label, position)
        VALUES (@lot_id, @kind, @label, @position)
      `);
  }
}

/**
 * Đồng bộ kho ô đỗ của một bãi về đúng danh sách `slots` Admin gửi lên.
 * Trả về mảng mã ô không xóa được (đang có xe/đặt chỗ) để caller báo lỗi.
 */
async function syncLotSlots(lotName, codePrefix, slots) {
  const wanted = new Map();
  for (const s of Array.isArray(slots) ? slots : []) {
    if (isValidGridCode(s.code)) wanted.set(s.code, s.vehicleType);
  }

  const cur = await pool.request().input('lot', sql.NVarChar, lotName)
    .query(`SELECT slot_code, status FROM dbo.parking_slots WHERE parking_lot = @lot`);

  // CHỈ những hàng có mã lưới hợp lệ mới thuộc quyền quản của trình thiết kế.
  // DB còn các hàng cũ kiểu 'T1-A-01'/'B1-A-02' (đuôi '01', '02' — không phải mã
  // lưới, không bao giờ vẽ lên sơ đồ): nếu gom cả vào đây thì (a) chúng sẽ bị
  // xóa oan vì không nằm trong `wanted`, và (b) nhiều hàng cùng đuôi '01' sẽ đè
  // lên nhau trong Map. Bỏ qua hẳn để dữ liệu cũ nguyên vẹn.
  const existing = new Map();
  for (const r of cur.recordset) {
    const code = String(r.slot_code).split('-').pop();
    if (isValidGridCode(code)) existing.set(code, r);
  }

  const blocked = [];
  for (const [code, row] of existing) {
    if (wanted.has(code)) continue;
    // Không xóa ô đang có xe / đã được đặt — sẽ làm mồ côi phiên gửi xe.
    if (String(row.status).toLowerCase() !== 'available') { blocked.push(code); continue; }
    await pool.request().input('slot_code', sql.NVarChar, row.slot_code)
      .query(`DELETE FROM dbo.parking_slots WHERE slot_code = @slot_code`);
  }

  for (const [code, vehicleType] of wanted) {
    const row = ROW_DEFAULTS[code[0]];
    const label = SLOT_VEHICLE_LABEL[vehicleType] || row.vehicleType;
    if (existing.has(code)) {
      await pool.request()
        .input('slot_code',    sql.NVarChar, existing.get(code).slot_code)
        .input('vehicle_type', sql.NVarChar, label)
        .query(`UPDATE dbo.parking_slots SET vehicle_type = @vehicle_type WHERE slot_code = @slot_code`);
      continue;
    }
    await pool.request()
      .input('slot_code',    sql.NVarChar, `${codePrefix}F1-${code}`)
      .input('floor',        sql.Int,      row.floor)
      .input('zone',         sql.NVarChar, row.zone)
      .input('vehicle_type', sql.NVarChar, label)
      .input('parking_lot',  sql.NVarChar, lotName)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.parking_slots WHERE slot_code = @slot_code)
          INSERT INTO dbo.parking_slots (slot_code, floor, zone, vehicle_type, status, parking_lot)
          VALUES (@slot_code, @floor, @zone, @vehicle_type, 'Available', @parking_lot)
      `);
  }
  return blocked;
}

app.post('/api/parking-lots', async (req, res) => {
  try {
    const { name, bookingLabel, address, description, imageData, mapsUrl, status, slots, gates } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: 'Tên bãi đỗ là bắt buộc.' });
    const lotName = String(name).trim();
    if (status && !LOT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }

    const dup = await pool.request().input('name', sql.NVarChar, lotName)
      .query(`SELECT 1 FROM dbo.parking_lots WHERE name = @name`);
    if (dup.recordset.length) return res.status(409).json({ error: 'Tên bãi đỗ đã tồn tại.' });

    const codePrefix = await generateCodePrefix(lotName);
    const addr = String(address || '').trim();
    const ins = await pool.request()
      .input('name',          sql.NVarChar, lotName)
      .input('status',        sql.NVarChar, status || 'Hoạt động')
      .input('code_prefix',   sql.NVarChar, codePrefix)
      .input('booking_label', sql.NVarChar, String(bookingLabel || '').trim() || lotName)
      .input('address',       sql.NVarChar, addr)
      .input('description',   sql.NVarChar, String(description || ''))
      .input('image_data',    sql.NVarChar, String(imageData || ''))
      .input('maps_url',      sql.NVarChar, String(mapsUrl || '').trim() || (addr ? mapsUrlFor(addr) : ''))
      .query(`
        INSERT INTO dbo.parking_lots
          (name, status, code_prefix, booking_label, address, description, image_data, maps_url, updated_at)
        OUTPUT inserted.lot_id
        VALUES
          (@name, @status, @code_prefix, @booking_label, @address, @description, @image_data, @maps_url, SYSUTCDATETIME())
      `);
    const lotId = ins.recordset[0].lot_id;

    await syncLotSlots(lotName, codePrefix, slots);
    await replaceGates(lotId, gates);
    return res.status(201).json(await readLotById(lotId));
  } catch (err) {
    console.error('POST /api/parking-lots', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo bãi đỗ.' });
  }
});

app.put('/api/parking-lots/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID bãi đỗ không hợp lệ.' });
    const { name, bookingLabel, address, description, imageData, mapsUrl, status, slots, gates } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: 'Tên bãi đỗ là bắt buộc.' });
    const lotName = String(name).trim();
    if (status && !LOT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }

    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.parking_lots WHERE lot_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy bãi đỗ.' });
    const before = cur.recordset[0];

    const dup = await pool.request()
      .input('name', sql.NVarChar, lotName).input('id', sql.Int, id)
      .query(`SELECT 1 FROM dbo.parking_lots WHERE name = @name AND lot_id <> @id`);
    if (dup.recordset.length) return res.status(409).json({ error: 'Tên bãi đỗ đã tồn tại.' });

    // Đổi tên bãi phải kéo theo mọi bảng đang tham chiếu bãi BẰNG TÊN
    // (parking_slots.parking_lot, users.assigned_parking_lot, reservations.parking_lot),
    // nếu không staff sẽ mất bãi phụ trách và ô đỗ thành mồ côi.
    if (lotName !== before.name) {
      for (const q of [
        `UPDATE dbo.parking_slots SET parking_lot = @new WHERE parking_lot = @old`,
        `UPDATE dbo.users SET assigned_parking_lot = @new WHERE assigned_parking_lot = @old`,
        `UPDATE dbo.reservations SET parking_lot = @new WHERE parking_lot = @old`,
      ]) {
        await pool.request()
          .input('new', sql.NVarChar, lotName)
          .input('old', sql.NVarChar, before.name)
          .query(q);
      }
    }

    const addr = String(address || '').trim();
    await pool.request()
      .input('id',            sql.Int,      id)
      .input('name',          sql.NVarChar, lotName)
      .input('status',        sql.NVarChar, status || before.status)
      .input('booking_label', sql.NVarChar, String(bookingLabel || '').trim() || lotName)
      .input('address',       sql.NVarChar, addr)
      .input('description',   sql.NVarChar, String(description || ''))
      .input('image_data',    sql.NVarChar, String(imageData || ''))
      .input('maps_url',      sql.NVarChar, String(mapsUrl || '').trim() || (addr ? mapsUrlFor(addr) : ''))
      .query(`
        UPDATE dbo.parking_lots SET
          name = @name, status = @status, booking_label = @booking_label,
          address = @address, description = @description, image_data = @image_data,
          maps_url = @maps_url, updated_at = SYSUTCDATETIME()
        WHERE lot_id = @id
      `);

    const blocked = slots === undefined
      ? []
      : await syncLotSlots(lotName, before.code_prefix, slots);
    if (gates !== undefined) await replaceGates(id, gates);

    const dto = await readLotById(id);
    // Ghi được phần còn lại rồi mới báo — Admin thấy đúng trạng thái đã lưu
    // kèm lý do các ô kia không bỏ được.
    if (blocked.length) {
      return res.status(409).json({
        error: `Không thể xóa ô đang có xe hoặc đã được đặt: ${blocked.join(', ')}. Các thay đổi khác đã được lưu.`,
        lot: dto,
      });
    }
    return res.json(dto);
  } catch (err) {
    console.error('PUT /api/parking-lots/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật bãi đỗ.' });
  }
});

app.delete('/api/parking-lots/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID bãi đỗ không hợp lệ.' });
    const cur = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.parking_lots WHERE lot_id = @id`);
    if (!cur.recordset.length) return res.status(404).json({ error: 'Không tìm thấy bãi đỗ.' });
    const lot = cur.recordset[0];

    // Chặn xóa khi bãi còn xe trong đó hoặc còn đặt chỗ chưa kết thúc — xóa sẽ
    // để lại reservations/sessions trỏ tới một bãi không còn tồn tại.
    const busy = await pool.request().input('lot', sql.NVarChar, lot.name).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.parking_slots
          WHERE parking_lot = @lot AND LOWER(status) <> 'available') AS busySlots,
        (SELECT COUNT(*) FROM dbo.reservations
          WHERE parking_lot = @lot AND status NOT IN ('Completed', 'Cancelled')) AS openRes
    `);
    const { busySlots, openRes } = busy.recordset[0];
    if (busySlots > 0 || openRes > 0) {
      return res.status(409).json({
        error: `Không thể xóa bãi "${lot.name}": còn ${busySlots} ô đang sử dụng và ${openRes} đặt chỗ chưa kết thúc.`,
      });
    }

    await pool.request().input('lot', sql.NVarChar, lot.name)
      .query(`DELETE FROM dbo.parking_slots WHERE parking_lot = @lot`);
    // gates có ON DELETE CASCADE nên xóa lot là đủ
    await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.parking_lots WHERE lot_id = @id`);
    // Staff đang phụ trách bãi vừa xóa → gỡ gán để không trỏ vào bãi không tồn tại
    await pool.request().input('lot', sql.NVarChar, lot.name)
      .query(`UPDATE dbo.users SET assigned_parking_lot = '' WHERE assigned_parking_lot = @lot`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/parking-lots/:id', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi xóa bãi đỗ.' });
  }
});

// Manager đổi trạng thái vận hành theo TÊN bãi. Đường dẫn có hậu tố /status để
// không đụng route PUT /:id ở trên.
app.put('/api/parking-lots/:name/status', async (req, res) => {
  try {
    const name = req.params.name;
    const { status } = req.body;
    if (!LOT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }
    const upd = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE dbo.parking_lots SET status = @status, updated_at = SYSUTCDATETIME()
        OUTPUT inserted.*
        WHERE name = @name
      `);
    if (!upd.recordset.length) return res.status(404).json({ error: 'Không tìm thấy bãi đỗ.' });
    return res.json(await readLotById(upd.recordset[0].lot_id));
  } catch (err) {
    console.error('PUT /api/parking-lots/:name/status', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật trạng thái bãi đỗ.' });
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
      nextHour: r.next_hour_price || 0,
      overnight: r.overnight_price || 0,
      monthly: r.monthly_price || 0,
    },
    lostTicketFee: r.lost_ticket_fee || 0,
    extraServiceFee: r.extra_service_fee || 0,
    overtimeRate30Min: r.overtime_rate_30min || 0,
    note: r.note || '',
    status: r.status || 'active',
    updatedAt: r.updated_at ? toVnStr(new Date(r.updated_at)) : '',
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
    const { vehicleType, vehicleKey, icon, description, prices, status, lostTicketFee, extraServiceFee, overtimeRate30Min, note } = req.body;
    if (!vehicleType) return res.status(400).json({ error: 'Thiếu tên loại xe.' });
    const ins = await pool.request()
      .input('vehicle_type',    sql.NVarChar, vehicleType.trim())
      .input('vehicle_key',     sql.NVarChar, (vehicleKey || '').trim())
      .input('icon',            sql.NVarChar, icon || '🚗')
      .input('description',     sql.NVarChar, (description || '').trim())
      .input('hourly_price',    sql.Float,    (prices?.hourly || 0))
      .input('next_hour_price', sql.Float,    (prices?.nextHour || 0))
      .input('overnight_price', sql.Float,    (prices?.overnight || 0))
      .input('monthly_price',   sql.Float,    (prices?.monthly || 0))
      .input('lost_ticket_fee', sql.Float,    (lostTicketFee || 0))
      .input('extra_service_fee', sql.Float,  (extraServiceFee || 0))
      .input('overtime_rate_30min', sql.Float, (overtimeRate30Min || 0))
      .input('note',            sql.NVarChar, (note || '').trim())
      .input('status',          sql.NVarChar, status || 'active')
      .query(`
        INSERT INTO dbo.pricing_rules
          (vehicle_type, vehicle_key, icon, description, hourly_price, next_hour_price, overnight_price,
           monthly_price, lost_ticket_fee, extra_service_fee, overtime_rate_30min, note, status)
        OUTPUT inserted.*
        VALUES
          (@vehicle_type, @vehicle_key, @icon, @description, @hourly_price, @next_hour_price, @overnight_price,
           @monthly_price, @lost_ticket_fee, @extra_service_fee, @overtime_rate_30min, @note, @status)
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
    const { vehicleType, vehicleKey, icon, description, prices, status, lostTicketFee, extraServiceFee, overtimeRate30Min, note } = req.body;
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
      .input('next_hour_price', sql.Float,    prices?.nextHour  !== undefined ? prices.nextHour  : ex.next_hour_price)
      .input('overnight_price', sql.Float,    prices?.overnight !== undefined ? prices.overnight : ex.overnight_price)
      .input('monthly_price',   sql.Float,    prices?.monthly   !== undefined ? prices.monthly   : ex.monthly_price)
      .input('lost_ticket_fee', sql.Float,    lostTicketFee     !== undefined ? lostTicketFee     : ex.lost_ticket_fee)
      .input('extra_service_fee', sql.Float,  extraServiceFee   !== undefined ? extraServiceFee   : ex.extra_service_fee)
      .input('overtime_rate_30min', sql.Float, overtimeRate30Min !== undefined ? overtimeRate30Min : ex.overtime_rate_30min)
      .input('note',            sql.NVarChar, note           !== undefined ? note.trim()                    : ex.note)
      .input('status',          sql.NVarChar, status         !== undefined ? status                          : ex.status)
      .query(`
        UPDATE dbo.pricing_rules
        SET vehicle_type=@vehicle_type, vehicle_key=@vehicle_key, icon=@icon,
            description=@description, hourly_price=@hourly_price, next_hour_price=@next_hour_price,
            overnight_price=@overnight_price, monthly_price=@monthly_price, lost_ticket_fee=@lost_ticket_fee,
            extra_service_fee=@extra_service_fee, overtime_rate_30min=@overtime_rate_30min, note=@note,
            status=@status, updated_at=SYSUTCDATETIME()
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

    // vnp_ReturnUrl phải là địa chỉ mà TRÌNH DUYỆT CỦA KHÁCH với tới được sau
    // khi VNPay redirect — không thể hardcode "localhost" vì trên máy khác
    // "localhost" trỏ về chính máy đó, không phải máy chạy backend này.
    // KHÔNG dùng req.headers.host: Vite dev proxy (changeOrigin: true) ghi đè
    // Host thành target nội bộ (127.0.0.1:4000) trước khi tới đây. Dùng thẳng
    // frontendUrl vừa dò ở trên (từ Origin/Referer, không bị proxy đổi) — vì
    // frontend luôn gọi API qua đường dẫn tương đối "/api/..." nên VNPay quay
    // về "<frontendUrl>/api/vnpay/return" cũng sẽ được chính proxy đó chuyển
    // tiếp đúng vào backend, dùng được từ bất kỳ máy nào truy cập frontend.
    const returnUrl = `${frontendUrl}/api/vnpay/return`;
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
      vnp_ReturnUrl: returnUrl,
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
        const paidAt = nowStr();
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
      const paidAt = nowStr();
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

// ─── reservation no-show auto-cancel ─────────────────────────────────────────
// Overnight/multi-day rule: a booking not checked in within CHECKIN_GRACE_HOURS
// after its scheduled arrival (date + start_time) is cancelled automatically.
// The reserved slot is released and the driver gets a bell notification.
const CHECKIN_GRACE_HOURS = 2;
const AUTO_CANCEL_SWEEP_MS = 60 * 1000;

async function autoCancelOverdueReservations() {
  // Only Fixed-time bookings (per-visit & overnight/multi-day) carry a real
  // arrival appointment; Flexible monthly passes never expire by no-show.
  const candidates = await pool.request().query(
    `SELECT reservation_id, reservation_code, user_id, date, start_time, slot_code, note, created_at
     FROM dbo.reservations
     WHERE status IN ('Pending', 'Confirmed') AND reservation_type = 'Fixed-time'`,
  );

  const now = Date.now();
  for (const row of candidates.recordset) {
    const dateOnly = String(row.date || '').split('T')[0];
    const timeOnly = String(row.start_time || '').slice(0, 5);
    const arrival = new Date(`${dateOnly}T${timeOnly}:00`).getTime();
    if (!Number.isFinite(arrival)) continue; // malformed schedule — leave for staff

    // Some legacy flows stamp a placeholder start_time that is already in the
    // past when the booking is created (e.g. per-visit "09:00" booked at 14:00).
    // A no-show can only exist for an arrival that was scheduled in the future,
    // so anything booked at/after its own arrival time is exempt.
    const createdAt = new Date(String(row.created_at || '').replace(' ', 'T')).getTime();
    if (!Number.isFinite(createdAt) || createdAt >= arrival) continue;

    if (now - arrival < CHECKIN_GRACE_HOURS * 60 * 60 * 1000) continue;

    // Không có cơ chế hoàn tiền trong hệ thống — nếu khách đã thanh toán
    // trước mà không tới, số tiền đó bị mất. Kiểm tra trước khi hủy để báo
    // rõ cho khách, thay vì im lặng giữ tiền mà không giải thích.
    const payQ = await pool.request()
      .input('code', sql.NVarChar, String(row.reservation_code))
      .query(`SELECT TOP 1 payment_id FROM dbo.payments
              WHERE status = 'Paid' AND (reservation_code = @code OR ticket_code = @code)`);
    const wasPaid = payQ.recordset.length > 0;

    // Re-check status in the UPDATE itself so a check-in racing this sweep wins.
    const upd = await pool.request()
      .input('id', sql.Int, row.reservation_id)
      .input('note', sql.NVarChar,
        `${row.note ? row.note + ' · ' : ''}Tự động hủy: không check-in trong ${CHECKIN_GRACE_HOURS} giờ sau giờ đến dự kiến${wasPaid ? ' · Đã mất số tiền thanh toán trước (không hoàn tiền)' : ''}`)
      .query(`UPDATE dbo.reservations SET status='Expired', note=@note
              WHERE reservation_id=@id AND status IN ('Pending', 'Confirmed')`);
    if (!upd.rowsAffected[0]) continue;

    console.log(`Auto-cancelled reservation ${row.reservation_code} (no check-in ${CHECKIN_GRACE_HOURS}h after ${dateOnly} ${timeOnly}) paid=${wasPaid}`);

    // Same as manual cancel: void any abandoned 'Unpaid' payment attempt tied
    // to this no-show — it was never actually collected, so it shouldn't sit
    // around looking like money still owed. Paid rows are untouched (forfeited).
    await pool.request()
      .input('code', sql.NVarChar, String(row.reservation_code))
      .query(`UPDATE dbo.payments SET status='Failed'
              WHERE status='Unpaid' AND (reservation_code=@code OR ticket_code=@code)`)
      .catch((err) => console.error('void unpaid payments on auto-cancel', err));

    // Release the held slot so other customers can book it.
    if (row.slot_code) {
      await pool.request()
        .input('slot_code', sql.NVarChar, row.slot_code)
        .query(`UPDATE dbo.parking_slots SET status='Available'
                WHERE slot_code=@slot_code AND status IN ('Pending', 'Reserved')`)
        .catch((err) => console.error('autoCancel release slot', err));
    }

    createNotification(
      row.user_id,
      'reservation_auto_cancelled',
      wasPaid ? 'Đặt chỗ đã tự động hủy — mất tiền đã thanh toán trước' : 'Đặt chỗ đã tự động hủy (quá giờ check-in)',
      wasPaid
        ? `${row.reservation_code} · quá ${CHECKIN_GRACE_HOURS} giờ sau giờ đến dự kiến ${dateOnly} ${timeOnly} · Số tiền đã thanh toán trước sẽ KHÔNG được hoàn lại.`
        : `${row.reservation_code} · quá ${CHECKIN_GRACE_HOURS} giờ sau giờ đến dự kiến ${dateOnly} ${timeOnly}`,
      'reservations',
    ).catch((err) => console.error('createNotification(reservation_auto_cancelled)', err));
  }
}

// ─── overstay fee notification ───────────────────────────────────────────────
// Vé Fixed-time còn trong bãi qua 00:00 — khớp đúng mô hình tính tiền thực tế
// của app (xem src/utils/reservationPricing.ts::realtimeParkingFee): mỗi lần
// qua 00:00 (theo ngày dương lịch của giờ vào THẬT, không phải giờ đặt) tính
// thêm 1 lần giá qua đêm. Gói "Qua đêm" đã trả trước cho đêm đầu tiên nên chỉ
// tính thêm từ đêm thứ 2. Vé đã thanh toán chỉ còn phải thu phần qua đêm phát
// sinh; chưa thanh toán thì thu giá vé + phần qua đêm. Cột overstay_notified
// chặn thông báo lặp lại (chỉ báo 1 lần — số dư thực tế vẫn cập nhật live
// trong app dù không có thông báo mới cho mỗi đêm tiếp theo).
const ONE_DAY_MS_OVERSTAY = 24 * 60 * 60 * 1000;

async function notifyPerVisitOverstays() {
  const candidates = await pool.request().query(`
    SELECT reservation_id, reservation_code, user_id, license_plate, vehicle_type,
           date, start_time, end_time, checked_in_at, estimated_cost
    FROM dbo.reservations
    WHERE status = 'Checked-in' AND reservation_type = 'Fixed-time'
      AND overstay_notified = 0`);

  const now = Date.now();
  for (const row of candidates.recordset) {
    const dateOnly = String(row.date || '').split('T')[0];
    const timeOnly = String(row.start_time || '').slice(0, 5);
    const isOvernight = !String(row.end_time || '').trim();

    // Ưu tiên mốc check-in THẬT (staff quẹt thẻ) — không phải khung giờ dự
    // kiến lúc đặt, vốn có thể lệch xa giờ xe thực sự vào bãi.
    const checkInStamp = String(row.checked_in_at || '').trim() || `${dateOnly} ${timeOnly}`;
    const checkIn = new Date(checkInStamp.replace(' ', 'T'));
    if (Number.isNaN(checkIn.getTime())) continue;

    const checkInDayStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate()).getTime();
    const firstMidnight = checkInDayStart + ONE_DAY_MS_OVERSTAY;
    if (now < firstMidnight) continue; // chưa qua đêm nào — chưa có gì để báo

    const nightsCrossed = Math.floor((now - firstMidnight) / ONE_DAY_MS_OVERSTAY) + 1;
    const extraNights = isOvernight ? Math.max(0, nightsCrossed - 1) : nightsCrossed;
    if (extraNights <= 0) continue; // gói "Qua đêm" mới ở đêm đầu (đã trả trước) — chưa phát sinh thêm

    // Giá vé đã chốt lúc đặt (fallback: bảng giá theo gói — lượt hoặc qua đêm)
    const ruleQ = await pool.request()
      .input('key', sql.NVarChar, String(row.vehicle_type || ''))
      .query(`SELECT TOP 1 hourly_price, overnight_price FROM dbo.pricing_rules WHERE vehicle_key = @key`);
    const rule = ruleQ.recordset[0] || {};
    const overnightPrice = rule.overnight_price || 0;
    const fallback = isOvernight ? overnightPrice : rule.hourly_price;
    const base = row.estimated_cost > 0 ? row.estimated_cost : (fallback || 0);
    const surcharge = extraNights * overnightPrice;

    // Vé đã có giao dịch Paid chưa (reservation_code giữ nguyên qua check-in)?
    const payQ = await pool.request()
      .input('code', sql.NVarChar, String(row.reservation_code))
      .query(`SELECT TOP 1 payment_id FROM dbo.payments
              WHERE status = 'Paid' AND (reservation_code = @code OR ticket_code = @code)`);
    const paid = payQ.recordset.length > 0;
    const due = paid ? surcharge : base + surcharge;

    // Đánh dấu trước (re-check trong UPDATE) để hai lượt sweep chồng nhau không gửi trùng.
    const upd = await pool.request().input('id', sql.Int, row.reservation_id)
      .query(`UPDATE dbo.reservations SET overstay_notified = 1
              WHERE reservation_id = @id AND overstay_notified = 0`);
    if (!upd.rowsAffected[0]) continue;

    const dueStr = `${Number(due).toLocaleString('vi-VN')}đ`;
    console.log(`Overstay (qua đêm): ${row.reservation_code} (${row.license_plate}) paid=${paid} → còn thu ${dueStr}`);

    if (String(row.user_id).toUpperCase() !== 'GUEST') {
      createNotification(
        row.user_id,
        'overstay_fee',
        'Xe đã qua đêm — đã tính phí qua đêm',
        paid
          ? `${row.reservation_code} · ${row.license_plate} · còn thu ${dueStr} (phí qua đêm — giá vé đã thanh toán)`
          : `${row.reservation_code} · ${row.license_plate} · còn thu ${dueStr} (giá vé + phí qua đêm)`,
        'reservations',
      ).catch((err) => console.error('createNotification(overstay_fee)', err));
    }
  }
}

// ─── start ───────────────────────────────────────────────────────────────────

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
    autoCancelOverdueReservations().catch((err) => console.error('autoCancelOverdueReservations', err));
    notifyPerVisitOverstays().catch((err) => console.error('notifyPerVisitOverstays', err));
    setInterval(() => {
      autoCancelOverdueReservations().catch((err) => console.error('autoCancelOverdueReservations', err));
      notifyPerVisitOverstays().catch((err) => console.error('notifyPerVisitOverstays', err));
    }, AUTO_CANCEL_SWEEP_MS);
  })
  .catch((error) => {
    console.error('Không thể khởi động backend:', error);
    process.exit(1);
  });
