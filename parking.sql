-- ============================================================
--  PARKING MANAGEMENT - CORE TABLES (SQL SERVER)
--  5 bảng chính + dữ liệu mẫu
-- ============================================================

USE master;
GO

-- Đóng tất cả kết nối đang mở vào parking_management trước khi xóa
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'parking_management')
BEGIN
    ALTER DATABASE parking_management SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE parking_management;
END
GO

CREATE DATABASE parking_management;
GO
USE parking_management;
GO

-- ============================================================
-- 1. NGƯỜI DÙNG & QUẢN LÝ (users)
-- ============================================================
CREATE TABLE users (
    user_id      INT IDENTITY(1,1) PRIMARY KEY,
    full_name    NVARCHAR(100) NOT NULL,
    email        NVARCHAR(150) NOT NULL UNIQUE,
    phone        NVARCHAR(20)  UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role         NVARCHAR(20)  NOT NULL DEFAULT 'user'
                 CHECK (role IN ('admin','manager','staff','guest','user')),
    is_active    BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 2. PHƯƠNG TIỆN (vehicles)
-- ============================================================
CREATE TABLE vehicles (
    vehicle_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id       INT          NOT NULL,
    vehicle_type  NVARCHAR(30) NOT NULL
                  CHECK (vehicle_type IN (N'Xe máy', N'Ô tô', N'Xe đạp', N'Xe tải nhỏ')),
    license_plate NVARCHAR(20) NOT NULL UNIQUE,
    brand         NVARCHAR(100),
    model         NVARCHAR(100),
    color         NVARCHAR(50),
    created_at    DATETIME2    NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
GO

-- ============================================================
-- 3. THẺ TỪ (cards)
-- ============================================================
CREATE TABLE cards (
    card_id      INT IDENTITY(1,1) PRIMARY KEY,
    card_number  NVARCHAR(50)  NOT NULL UNIQUE,
    card_type    NVARCHAR(20)  NOT NULL DEFAULT 'daily'
                 CHECK (card_type IN ('monthly','daily','staff')),
    user_id      INT,
    vehicle_id   INT,
    issued_date  DATE          NOT NULL,
    expire_date  DATE,
    status       NVARCHAR(20)  NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','lost','expired')),
    created_at   DATETIME2     NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
);
GO

-- ============================================================
-- 4. QUẢN LÝ CHỖ ĐỖ (parking_slots)
-- ============================================================
CREATE TABLE parking_slots (
    slot_id      INT IDENTITY(1,1) PRIMARY KEY,
    slot_code    NVARCHAR(20)  NOT NULL UNIQUE,
    floor        INT           NOT NULL,
    zone         NVARCHAR(10)  NOT NULL,
    vehicle_type NVARCHAR(50)
                 CHECK (vehicle_type IN (
                     N'Xe máy / Xe máy điện',
                     N'Ô tô 4-7 chỗ (Xăng)',
                     N'Ô tô 4-7 chỗ (Điện / EV)'
                 )),
    status       NVARCHAR(20)  NOT NULL DEFAULT 'Available'
                 CHECK (status IN ('Available','Occupied','Reserved','Pending','Maintenance','Locked')),
    notes        NVARCHAR(255)
);
GO

-- ============================================================
-- 5. THANH TOÁN (payments)
--    Ghi nhận mỗi lượt gửi xe + phí thanh toán
-- ============================================================
CREATE TABLE payments (
    payment_id      INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT,                          -- NULL nếu xe vãng lai
    vehicle_id      INT,
    card_id         INT,
    slot_id         INT,
    license_plate   NVARCHAR(20) NOT NULL,
    entry_time      DATETIME2    NOT NULL,
    exit_time       DATETIME2,
    duration_min    INT,                          -- Thời gian gửi (phút)
    amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method  NVARCHAR(30) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','card','qr_code','monthly_pass')),
    payment_status  NVARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','waived')),
    paid_at         DATETIME2,
    staff_id        INT,                          -- Nhân viên thu tiền
    notes           NVARCHAR(255),
    created_at      DATETIME2    NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (user_id)   REFERENCES users(user_id),
    FOREIGN KEY (vehicle_id)REFERENCES vehicles(vehicle_id),
    FOREIGN KEY (card_id)   REFERENCES cards(card_id),
    FOREIGN KEY (slot_id)   REFERENCES parking_slots(slot_id),
    FOREIGN KEY (staff_id)  REFERENCES users(user_id)
);
GO

-- ============================================================
-- 6. NHẬT KÝ HOẠT ĐỘNG STAFF (staff_activity_logs)
--    Mỗi dòng = 1 sự kiện qua cổng hoặc thao tác của staff (quét tự động,
--    xác nhận/từ chối, mở thủ công, RFID, đặt chỗ mới...). Khớp với màn
--    "Nhật ký hoạt động" phía Staff — lọc/thống kê theo ngày qua log_date.
-- ============================================================
CREATE TABLE staff_activity_logs (
    log_id          INT IDENTITY(1,1) PRIMARY KEY,
    gate_id         NVARCHAR(20)  NOT NULL,                 -- Cổng A, A1, A2...
    license_plate   NVARCHAR(20),                           -- biển số, RFID UID, hoặc NULL nếu chưa xác định
    vehicle_type    NVARCHAR(50)
                    CHECK (vehicle_type IN (
                        N'Xe máy / Xe máy điện',
                        N'Ô tô 4-7 chỗ (Xăng)',
                        N'Ô tô 4-7 chỗ (Điện / EV)'
                    )),
    action          NVARCHAR(255) NOT NULL,                 -- vd "Nhận diện tự động", "Đặt chỗ mới (RSV-1234) — xe chưa tới bãi"
    direction       NVARCHAR(10)  NOT NULL DEFAULT 'entry'
                    CHECK (direction IN ('entry','exit','awaiting')), -- VÀO / RA / CHƯA VÀO
    status          NVARCHAR(20)  NOT NULL
                    CHECK (status IN ('GRANTED','DENIED','OVERRIDE','PENDING')),
    recognition     NVARCHAR(20)  NOT NULL DEFAULT 'casual'
                    CHECK (recognition IN ('subscriber','casual','unknown')),
    fee             DECIMAL(10,2),
    slot_id         INT,                                    -- ô đỗ liên quan (nếu có)
    handled_by      INT,                                    -- staff xử lý; NULL = hệ thống tự ghi nhận
    occurred_at     DATETIME2     NOT NULL DEFAULT GETDATE(),  -- thời điểm sự kiện xảy ra
    log_date        AS CAST(occurred_at AS DATE) PERSISTED,    -- cột tính sẵn, dùng lọc/thống kê theo ngày
    created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (slot_id)    REFERENCES parking_slots(slot_id),
    FOREIGN KEY (handled_by) REFERENCES users(user_id)
);
GO

-- Lọc nhanh theo ngày (khớp bộ lọc ngày ở màn "Nhật ký hoạt động")
CREATE INDEX idx_staff_activity_logs_date ON staff_activity_logs(log_date);
GO

-- ============================================================
-- DỮ LIỆU MẪU
-- ============================================================

-- 1. USERS
INSERT INTO users (full_name, email, phone, password_hash, role) VALUES
  (N'Admin Hệ Thống',    'admin@parking.vn',    '0900000001', 'hash_admin',   'admin'),
  (N'Nguyễn Văn Quản',   'manager@parking.vn',  '0900000002', 'hash_manager', 'manager'),
  (N'Trần Thị Nhân Viên','staff@parking.vn',     '0900000003', 'hash_staff',   'staff'),
  (N'Lê Minh Tài',       'tai.le@gmail.com',     '0912345678', 'hash_user1',   'user'),
  (N'Phạm Thị Lan',      'lan.pham@gmail.com',   '0987654321', 'hash_user2',   'user'),
  (N'Trần Văn Hùng',     'hung.tran@gmail.com',  '0971111222', 'hash_user3',   'user'),
  (N'Nguyễn Thị Mai',    'mai.nguyen@gmail.com', '0962223333', 'hash_user4',   'user');
GO

-- 2. VEHICLES
INSERT INTO vehicles (user_id, vehicle_type, license_plate, brand, model, color) VALUES
  (4, N'Xe máy',  '59F1-12345', N'Honda',   N'Wave RSX',  N'Đen'),
  (4, N'Ô tô',    '51A-999.88', N'Toyota',  N'Vios',      N'Trắng'),
  (5, N'Xe máy',  '59P2-67890', N'Yamaha',  N'Exciter',   N'Đỏ'),
  (6, N'Ô tô',    '51B-123.45', N'Honda',   N'CR-V',      N'Đen'),
  (6, N'Xe máy',  '59G3-55566', N'Suzuki',  N'Raider',    N'Xanh'),
  (7, N'Xe đạp',  'XD-001',     N'Giant',   N'ATX 610',   N'Xám');
GO

-- 3. CARDS
INSERT INTO cards (card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status) VALUES
  ('CARD-M-0001', 'monthly', 4, 1, '2025-01-01', '2025-12-31', 'active'),
  ('CARD-M-0002', 'monthly', 5, 3, '2025-03-01', '2025-08-31', 'active'),
  ('CARD-D-0003', 'daily',   6, 4, '2025-05-01', NULL,         'active'),
  ('CARD-D-0004', 'daily',   7, 6, '2025-04-15', NULL,         'active'),
  ('CARD-S-0001', 'staff',   3, NULL,'2025-01-01',NULL,         'active'),
  ('CARD-M-0005', 'monthly', 6, 5, '2025-02-01', '2025-05-01', 'expired'),
  ('CARD-D-0007', 'daily',   NULL,NULL,'2025-05-20',NULL,        'lost');
GO

-- 4. PARKING SLOTS  (mã ô đỗ khớp với ParkingFloorMap frontend)
INSERT INTO parking_slots (slot_code, floor, zone, vehicle_type, status) VALUES
  ('F1-B01',  1, 'A', N'Xe máy / Xe máy điện',     'Occupied'),
  ('F1-B02',  1, 'A', N'Xe máy / Xe máy điện',     'Available'),
  ('F1-B03',  1, 'A', N'Xe máy / Xe máy điện',     'Available'),
  ('F1-B04',  1, 'A', N'Xe máy / Xe máy điện',     'Reserved'),
  ('F1-B05',  1, 'A', N'Xe máy / Xe máy điện',     'Maintenance'),
  ('F1-E01',  1, 'B', N'Xe máy / Xe máy điện',     'Occupied'),
  ('F1-E02',  1, 'B', N'Xe máy / Xe máy điện',     'Available'),
  ('F1-A01',  2, 'A', N'Ô tô 4-7 chỗ (Xăng)',      'Occupied'),
  ('F1-A02',  2, 'A', N'Ô tô 4-7 chỗ (Xăng)',      'Available'),
  ('F1-A03',  2, 'A', N'Ô tô 4-7 chỗ (Xăng)',      'Reserved'),
  ('F1-A04',  2, 'B', N'Ô tô 4-7 chỗ (Xăng)',      'Available'),
  ('F1-D01', -1, 'A', N'Ô tô 4-7 chỗ (Xăng)',      'Occupied'),
  ('F1-D02', -1, 'A', N'Ô tô 4-7 chỗ (Xăng)',      'Available'),
  ('F1-C01',  1, 'C', N'Ô tô 4-7 chỗ (Điện / EV)', 'Available'),
  ('F1-C02',  1, 'C', N'Ô tô 4-7 chỗ (Điện / EV)', 'Occupied');
GO

-- 5. PAYMENTS (lượt gửi xe + thanh toán)
INSERT INTO payments
  (user_id, vehicle_id, card_id, slot_id, license_plate,
   entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes)
VALUES
-- Đã thanh toán
(4, 1, 1, 1, '59F1-12345',
 '2025-05-21 08:30:00','2025-05-21 10:15:00', 105, 10000, 'monthly_pass','paid','2025-05-21 10:16:00', 3, N'Thẻ tháng'),

(5, 3, 2, 6, '59P2-67890',
 '2025-05-21 07:00:00','2025-05-21 17:30:00', 630, 50000, 'cash',        'paid','2025-05-21 17:31:00', 3, N'Áp trần phí ngày'),

(6, 4, 3, 8, '51B-123.45',
 '2025-05-20 09:00:00','2025-05-20 12:30:00', 210, 45000, 'qr_code',     'paid','2025-05-20 12:31:00', 3, NULL),

(7, 6, 4, 15,'XD-001',
 '2025-05-21 06:30:00','2025-05-21 08:00:00',  90,  3000, 'cash',        'paid','2025-05-21 08:01:00', 3, N'Xe đạp lượt vào'),

(6, 5, NULL,1, '59G3-55566',
 '2025-05-19 13:00:00','2025-05-19 15:00:00', 120, 10000, 'cash',        'paid','2025-05-19 15:02:00', 3, NULL),

-- Đang gửi (chưa ra)
(4, 2, NULL, 8,'51A-999.88',
 '2025-05-21 14:00:00', NULL, NULL, 0, 'cash', 'pending', NULL, NULL, N'Xe đang trong bãi'),

-- Xe vãng lai (không có tài khoản)
(NULL, NULL, NULL, 6, '60A-888.77',
 '2025-05-21 09:15:00','2025-05-21 11:00:00', 105, 10000, 'cash',        'paid','2025-05-21 11:01:00', 3, N'Xe vãng lai'),

-- Miễn phí (nhân viên)
(3, NULL, 5, 2, 'NV-STAFF',
 '2025-05-21 07:50:00','2025-05-21 17:00:00', 550,     0, 'monthly_pass','waived','2025-05-21 17:00:00',NULL, N'Nhân viên miễn phí');
GO

-- 6. STAFF ACTIVITY LOGS
INSERT INTO staff_activity_logs
  (gate_id, license_plate, vehicle_type, action, direction, status, recognition, fee, slot_id, handled_by, occurred_at)
VALUES
-- Xe tháng quét thẻ tự động vào bãi (hệ thống tự ghi nhận, không qua staff)
('A1', '59F1-12345', N'Xe máy / Xe máy điện',     N'Nhận diện tự động',        'entry',    'GRANTED', 'subscriber', 0,    1,    NULL, '2025-05-21 08:30:00'),
-- Staff xác nhận cho xe ra sau khi thu phí
('A2', '59P2-67890', N'Xe máy / Xe máy điện',     N'Nhân viên xác nhận',       'exit',     'GRANTED', 'casual',     5000, 6,    3,    '2025-05-21 17:30:00'),
-- Camera không đọc được biển số → nhân viên mở thủ công
('A1', '51B-123.45', N'Ô tô 4-7 chỗ (Xăng)',      N'Mở thủ công (Nhân Viên)',  'entry',    'OVERRIDE','casual',     0,    8,    3,    '2025-05-20 09:00:00'),
-- Lượt quét khả nghi bị nhân viên từ chối
('A1', NULL,         NULL,                        N'Nhân viên từ chối',        'entry',    'DENIED',  'unknown',    NULL, NULL, 3,    '2025-05-21 10:05:00'),
-- Đặt chỗ mới — xe chưa tới bãi, staff chưa check-in
('A',  '51A-999.88', N'Ô tô 4-7 chỗ (Xăng)',      N'Đặt chỗ mới (RSV-7781) — xe chưa tới bãi', 'awaiting', 'PENDING', 'casual', NULL, NULL, NULL, '2025-05-21 07:55:00');
GO

-- ============================================================
-- KIỂM TRA NHANH
-- ============================================================
SELECT N'=== USERS ===' AS info;
SELECT user_id, full_name, role, is_active FROM users;

SELECT N'=== VEHICLES ===' AS info;
SELECT v.vehicle_id, u.full_name, v.vehicle_type, v.license_plate, v.brand, v.model
FROM vehicles v JOIN users u ON v.user_id = u.user_id;

SELECT N'=== CARDS ===' AS info;
SELECT card_id, card_number, card_type, user_id, vehicle_id, expire_date, status FROM cards;

SELECT N'=== PARKING SLOTS ===' AS info;
SELECT slot_id, slot_code, floor, zone, vehicle_type, status FROM parking_slots;

SELECT N'=== PAYMENTS ===' AS info;
SELECT payment_id, license_plate, entry_time, exit_time,
       duration_min, amount, payment_method, payment_status
FROM payments;

SELECT N'=== STAFF ACTIVITY LOGS ===' AS info;
SELECT log_id, gate_id, license_plate, vehicle_type, action, direction, status, log_date, occurred_at
FROM staff_activity_logs
ORDER BY occurred_at DESC;
GO