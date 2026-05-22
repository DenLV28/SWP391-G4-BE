package pe.model;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import pe.utils.DbUtils;

public class ParkingSlotDao {

    // Lấy tất cả chỗ đỗ
    public List<ParkingSlotDto> getAllSlots() {
        List<ParkingSlotDto> list = new ArrayList<>();
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots ORDER BY floor, zone, slot_code";
        
        try (Connection conn = DbUtils.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {
            
            while (rs.next()) {
                ParkingSlotDto dto = new ParkingSlotDto(
                    rs.getInt("slot_id"),
                    rs.getString("slot_code"),
                    rs.getInt("floor"),
                    rs.getString("zone"),
                    rs.getString("vehicle_type"),
                    rs.getString("status"),
                    rs.getString("notes")
                );
                list.add(dto);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy chỗ đỗ theo ID
    public ParkingSlotDto getSlotById(int slotId) {
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots WHERE slot_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, slotId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new ParkingSlotDto(
                        rs.getInt("slot_id"),
                        rs.getString("slot_code"),
                        rs.getInt("floor"),
                        rs.getString("zone"),
                        rs.getString("vehicle_type"),
                        rs.getString("status"),
                        rs.getString("notes")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy chỗ đỗ theo mã
    public ParkingSlotDto getSlotByCode(String slotCode) {
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots WHERE slot_code = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, slotCode);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new ParkingSlotDto(
                        rs.getInt("slot_id"),
                        rs.getString("slot_code"),
                        rs.getInt("floor"),
                        rs.getString("zone"),
                        rs.getString("vehicle_type"),
                        rs.getString("status"),
                        rs.getString("notes")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy chỗ đỗ theo tầng
    public List<ParkingSlotDto> getSlotsByFloor(int floor) {
        List<ParkingSlotDto> list = new ArrayList<>();
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots WHERE floor = ? ORDER BY zone, slot_code";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, floor);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    ParkingSlotDto dto = new ParkingSlotDto(
                        rs.getInt("slot_id"),
                        rs.getString("slot_code"),
                        rs.getInt("floor"),
                        rs.getString("zone"),
                        rs.getString("vehicle_type"),
                        rs.getString("status"),
                        rs.getString("notes")
                    );
                    list.add(dto);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy chỗ đỗ trống theo loại xe
    public List<ParkingSlotDto> getAvailableSlots(String vehicleType) {
        List<ParkingSlotDto> list = new ArrayList<>();
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots WHERE status = 'available' AND vehicle_type = ? ORDER BY floor, zone, slot_code";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, vehicleType);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    ParkingSlotDto dto = new ParkingSlotDto(
                        rs.getInt("slot_id"),
                        rs.getString("slot_code"),
                        rs.getInt("floor"),
                        rs.getString("zone"),
                        rs.getString("vehicle_type"),
                        rs.getString("status"),
                        rs.getString("notes")
                    );
                    list.add(dto);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy chỗ đỗ theo trạng thái
    public List<ParkingSlotDto> getSlotsByStatus(String status) {
        List<ParkingSlotDto> list = new ArrayList<>();
        String query = "SELECT slot_id, slot_code, floor, zone, vehicle_type, status, notes FROM parking_slots WHERE status = ? ORDER BY floor, zone";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, status);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    ParkingSlotDto dto = new ParkingSlotDto(
                        rs.getInt("slot_id"),
                        rs.getString("slot_code"),
                        rs.getInt("floor"),
                        rs.getString("zone"),
                        rs.getString("vehicle_type"),
                        rs.getString("status"),
                        rs.getString("notes")
                    );
                    list.add(dto);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Thêm chỗ đỗ mới
    public boolean addSlot(ParkingSlotDto slot) {
        String query = "INSERT INTO parking_slots (slot_code, floor, zone, vehicle_type, status, notes) VALUES (?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, slot.getSlotCode());
            pstmt.setInt(2, slot.getFloor());
            pstmt.setString(3, slot.getZone());
            pstmt.setString(4, slot.getVehicleType());
            pstmt.setString(5, slot.getStatus());
            pstmt.setString(6, slot.getNotes());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật chỗ đỗ
    public boolean updateSlot(ParkingSlotDto slot) {
        String query = "UPDATE parking_slots SET slot_code = ?, floor = ?, zone = ?, vehicle_type = ?, status = ?, notes = ? WHERE slot_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, slot.getSlotCode());
            pstmt.setInt(2, slot.getFloor());
            pstmt.setString(3, slot.getZone());
            pstmt.setString(4, slot.getVehicleType());
            pstmt.setString(5, slot.getStatus());
            pstmt.setString(6, slot.getNotes());
            pstmt.setInt(7, slot.getSlotId());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Xóa chỗ đỗ
    public boolean deleteSlot(int slotId) {
        String query = "DELETE FROM parking_slots WHERE slot_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, slotId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật trạng thái chỗ đỗ
    public boolean updateSlotStatus(int slotId, String status) {
        String query = "UPDATE parking_slots SET status = ? WHERE slot_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, status);
            pstmt.setInt(2, slotId);
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }
}
