-- ============================================================
--  MIGRATION: Cập nhật parking_slots
--  Chạy file này trong SQL Server Management Studio
--  trên database parking_management
-- ============================================================
USE parking_management;
GO

-- ── Bước 1: Xóa CHECK constraints cũ trên parking_slots ──────────────────────
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE parking_slots DROP CONSTRAINT ' + cc.name + N'; '
FROM sys.check_constraints cc
JOIN sys.columns c
  ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t
  ON cc.parent_object_id = t.object_id
WHERE t.name = 'parking_slots'
  AND c.name IN ('vehicle_type', 'status');
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
GO

-- ── Bước 2: Xóa DEFAULT constraint cũ trên cột status ────────────────────────
DECLARE @df NVARCHAR(200) = N'';
SELECT @df = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
  ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
JOIN sys.tables t
  ON dc.parent_object_id = t.object_id
WHERE t.name = 'parking_slots' AND c.name = 'status';
IF LEN(@df) > 0 EXEC (N'ALTER TABLE parking_slots DROP CONSTRAINT ' + @df);
GO

-- ── Bước 3: Đổi mã ô đỗ từ T1-A-01 → F1-A01 ────────────────────────────────
-- (khớp với ParkingFloorMap của frontend)
UPDATE parking_slots SET slot_code = 'F1-B01' WHERE slot_code = 'T1-A-01';
UPDATE parking_slots SET slot_code = 'F1-B02' WHERE slot_code = 'T1-A-02';
UPDATE parking_slots SET slot_code = 'F1-B03' WHERE slot_code = 'T1-A-03';
UPDATE parking_slots SET slot_code = 'F1-B04' WHERE slot_code = 'T1-A-04';
UPDATE parking_slots SET slot_code = 'F1-B05' WHERE slot_code = 'T1-A-05';
UPDATE parking_slots SET slot_code = 'F1-E01' WHERE slot_code = 'T1-B-01';
UPDATE parking_slots SET slot_code = 'F1-E02' WHERE slot_code = 'T1-B-02';
UPDATE parking_slots SET slot_code = 'F1-A01' WHERE slot_code = 'T2-A-01';
UPDATE parking_slots SET slot_code = 'F1-A02' WHERE slot_code = 'T2-A-02';
UPDATE parking_slots SET slot_code = 'F1-A03' WHERE slot_code = 'T2-A-03';
UPDATE parking_slots SET slot_code = 'F1-A04' WHERE slot_code = 'T2-B-01';
UPDATE parking_slots SET slot_code = 'F1-D01' WHERE slot_code = 'B1-A-01';
UPDATE parking_slots SET slot_code = 'F1-D02' WHERE slot_code = 'B1-A-02';
UPDATE parking_slots SET slot_code = 'F1-C01' WHERE slot_code = 'T1-C-01';
UPDATE parking_slots SET slot_code = 'F1-C02' WHERE slot_code = 'T1-C-02';
GO

-- ── Bước 4: Cập nhật loại xe sang giá trị mới ───────────────────────────────
UPDATE parking_slots SET vehicle_type = N'Xe máy / Xe máy điện'     WHERE vehicle_type IN (N'Xe máy', N'motorbike');
UPDATE parking_slots SET vehicle_type = N'Ô tô 4-7 chỗ (Xăng)'     WHERE vehicle_type IN (N'Ô tô',   N'car');
UPDATE parking_slots SET vehicle_type = N'Ô tô 4-7 chỗ (Điện / EV)' WHERE vehicle_type IN (N'Xe đạp', N'electric vehicle', N'bicycle');
GO

-- ── Bước 5: Viết hoa chữ cái đầu của status ─────────────────────────────────
UPDATE parking_slots SET status = 'Available'   WHERE status = 'available';
UPDATE parking_slots SET status = 'Occupied'    WHERE status = 'occupied';
UPDATE parking_slots SET status = 'Reserved'    WHERE status = 'reserved';
UPDATE parking_slots SET status = 'Maintenance' WHERE status = 'maintenance';
GO

-- ── Bước 6: Thêm DEFAULT và CHECK constraints mới ───────────────────────────
ALTER TABLE parking_slots
    ADD CONSTRAINT DF_slots_status DEFAULT 'Available' FOR status;

ALTER TABLE parking_slots
    ADD CONSTRAINT CK_slots_vehicle_type
    CHECK (vehicle_type IN (
        N'Xe máy / Xe máy điện',
        N'Ô tô 4-7 chỗ (Xăng)',
        N'Ô tô 4-7 chỗ (Điện / EV)'
    ));

ALTER TABLE parking_slots
    ADD CONSTRAINT CK_slots_status
    CHECK (status IN ('Available', 'Occupied', 'Reserved', 'Pending', 'Maintenance', 'Locked'));
GO

-- ── Kiểm tra kết quả ─────────────────────────────────────────────────────────
SELECT slot_id, slot_code, floor, zone, vehicle_type, status
FROM parking_slots
ORDER BY slot_code;
GO
