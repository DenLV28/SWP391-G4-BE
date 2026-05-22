package pe.model;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import pe.utils.DbUtils;

public class VehicleDao {

    // Lấy tất cả phương tiện
    public List<VehicleDto> getAllVehicles() {
        List<VehicleDto> list = new ArrayList<>();
        String query = "SELECT vehicle_id, user_id, vehicle_type, license_plate, brand, model, color, created_at FROM vehicles";
        
        try (Connection conn = DbUtils.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {
            
            while (rs.next()) {
                VehicleDto dto = new VehicleDto(
                    rs.getInt("vehicle_id"),
                    rs.getInt("user_id"),
                    rs.getString("vehicle_type"),
                    rs.getString("license_plate"),
                    rs.getString("brand"),
                    rs.getString("model"),
                    rs.getString("color"),
                    rs.getString("created_at")
                );
                list.add(dto);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy phương tiện theo ID
    public VehicleDto getVehicleById(int vehicleId) {
        String query = "SELECT vehicle_id, user_id, vehicle_type, license_plate, brand, model, color, created_at FROM vehicles WHERE vehicle_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, vehicleId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new VehicleDto(
                        rs.getInt("vehicle_id"),
                        rs.getInt("user_id"),
                        rs.getString("vehicle_type"),
                        rs.getString("license_plate"),
                        rs.getString("brand"),
                        rs.getString("model"),
                        rs.getString("color"),
                        rs.getString("created_at")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy phương tiện theo biển số
    public VehicleDto getVehicleByLicensePlate(String licensePlate) {
        String query = "SELECT vehicle_id, user_id, vehicle_type, license_plate, brand, model, color, created_at FROM vehicles WHERE license_plate = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, licensePlate);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new VehicleDto(
                        rs.getInt("vehicle_id"),
                        rs.getInt("user_id"),
                        rs.getString("vehicle_type"),
                        rs.getString("license_plate"),
                        rs.getString("brand"),
                        rs.getString("model"),
                        rs.getString("color"),
                        rs.getString("created_at")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy tất cả phương tiện của một user
    public List<VehicleDto> getVehiclesByUserId(int userId) {
        List<VehicleDto> list = new ArrayList<>();
        String query = "SELECT vehicle_id, user_id, vehicle_type, license_plate, brand, model, color, created_at FROM vehicles WHERE user_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    VehicleDto dto = new VehicleDto(
                        rs.getInt("vehicle_id"),
                        rs.getInt("user_id"),
                        rs.getString("vehicle_type"),
                        rs.getString("license_plate"),
                        rs.getString("brand"),
                        rs.getString("model"),
                        rs.getString("color"),
                        rs.getString("created_at")
                    );
                    list.add(dto);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Thêm phương tiện mới
    public boolean addVehicle(VehicleDto vehicle) {
        String query = "INSERT INTO vehicles (user_id, vehicle_type, license_plate, brand, model, color) VALUES (?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, vehicle.getUserId());
            pstmt.setString(2, vehicle.getVehicleType());
            pstmt.setString(3, vehicle.getLicensePlate());
            pstmt.setString(4, vehicle.getBrand());
            pstmt.setString(5, vehicle.getModel());
            pstmt.setString(6, vehicle.getColor());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật phương tiện
    public boolean updateVehicle(VehicleDto vehicle) {
        String query = "UPDATE vehicles SET user_id = ?, vehicle_type = ?, license_plate = ?, brand = ?, model = ?, color = ? WHERE vehicle_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, vehicle.getUserId());
            pstmt.setString(2, vehicle.getVehicleType());
            pstmt.setString(3, vehicle.getLicensePlate());
            pstmt.setString(4, vehicle.getBrand());
            pstmt.setString(5, vehicle.getModel());
            pstmt.setString(6, vehicle.getColor());
            pstmt.setInt(7, vehicle.getVehicleId());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Xóa phương tiện
    public boolean deleteVehicle(int vehicleId) {
        String query = "DELETE FROM vehicles WHERE vehicle_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, vehicleId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }
}
