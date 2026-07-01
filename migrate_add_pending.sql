-- ============================================================
--  PATCH: Thêm trạng thái 'Pending' vào CHECK constraint của parking_slots
--  Chạy trong SSMS trên database parking_management
-- ============================================================
USE parking_management;
GO

-- Xóa CHECK constraint cũ trên cột status
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE parking_slots DROP CONSTRAINT ' + cc.name + N'; '
FROM sys.check_constraints cc
JOIN sys.columns c
  ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t
  ON cc.parent_object_id = t.object_id
WHERE t.name = 'parking_slots' AND c.name = 'status';
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
GO

-- Thêm CHECK constraint mới bao gồm 'Pending'
ALTER TABLE parking_slots
    ADD CONSTRAINT CK_slots_status
    CHECK (status IN ('Available', 'Occupied', 'Reserved', 'Pending', 'Maintenance', 'Locked'));
GO

-- Kiểm tra kết quả
SELECT OBJECT_NAME(parent_object_id) AS table_name, name AS constraint_name, definition
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.parking_slots');
GO
