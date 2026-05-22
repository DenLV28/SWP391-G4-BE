package pe.model;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import pe.utils.DbUtils;

public class PaymentDao {

    // Lấy tất cả thanh toán
    public List<PaymentDto> getAllPayments() {
        List<PaymentDto> list = new ArrayList<>();
        String query = "SELECT payment_id, user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes, created_at FROM payments ORDER BY created_at DESC";
        
        try (Connection conn = DbUtils.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {
            
            while (rs.next()) {
                PaymentDto dto = new PaymentDto(
                    rs.getInt("payment_id"),
                    rs.getInt("user_id"),
                    rs.getInt("vehicle_id"),
                    rs.getInt("card_id"),
                    rs.getInt("slot_id"),
                    rs.getString("license_plate"),
                    rs.getString("entry_time"),
                    rs.getString("exit_time"),
                    rs.getInt("duration_min"),
                    rs.getDouble("amount"),
                    rs.getString("payment_method"),
                    rs.getString("payment_status"),
                    rs.getString("paid_at"),
                    rs.getInt("staff_id"),
                    rs.getString("notes"),
                    rs.getString("created_at")
                );
                list.add(dto);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy thanh toán theo ID
    public PaymentDto getPaymentById(int paymentId) {
        String query = "SELECT payment_id, user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes, created_at FROM payments WHERE payment_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, paymentId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new PaymentDto(
                        rs.getInt("payment_id"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getInt("card_id"),
                        rs.getInt("slot_id"),
                        rs.getString("license_plate"),
                        rs.getString("entry_time"),
                        rs.getString("exit_time"),
                        rs.getInt("duration_min"),
                        rs.getDouble("amount"),
                        rs.getString("payment_method"),
                        rs.getString("payment_status"),
                        rs.getString("paid_at"),
                        rs.getInt("staff_id"),
                        rs.getString("notes"),
                        rs.getString("created_at")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy thanh toán của một user
    public List<PaymentDto> getPaymentsByUserId(int userId) {
        List<PaymentDto> list = new ArrayList<>();
        String query = "SELECT payment_id, user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    PaymentDto dto = new PaymentDto(
                        rs.getInt("payment_id"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getInt("card_id"),
                        rs.getInt("slot_id"),
                        rs.getString("license_plate"),
                        rs.getString("entry_time"),
                        rs.getString("exit_time"),
                        rs.getInt("duration_min"),
                        rs.getDouble("amount"),
                        rs.getString("payment_method"),
                        rs.getString("payment_status"),
                        rs.getString("paid_at"),
                        rs.getInt("staff_id"),
                        rs.getString("notes"),
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

    // Lấy thanh toán theo biển số
    public List<PaymentDto> getPaymentsByLicensePlate(String licensePlate) {
        List<PaymentDto> list = new ArrayList<>();
        String query = "SELECT payment_id, user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes, created_at FROM payments WHERE license_plate = ? ORDER BY created_at DESC";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, licensePlate);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    PaymentDto dto = new PaymentDto(
                        rs.getInt("payment_id"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getInt("card_id"),
                        rs.getInt("slot_id"),
                        rs.getString("license_plate"),
                        rs.getString("entry_time"),
                        rs.getString("exit_time"),
                        rs.getInt("duration_min"),
                        rs.getDouble("amount"),
                        rs.getString("payment_method"),
                        rs.getString("payment_status"),
                        rs.getString("paid_at"),
                        rs.getInt("staff_id"),
                        rs.getString("notes"),
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

    // Lấy thanh toán theo trạng thái
    public List<PaymentDto> getPaymentsByStatus(String status) {
        List<PaymentDto> list = new ArrayList<>();
        String query = "SELECT payment_id, user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes, created_at FROM payments WHERE payment_status = ? ORDER BY created_at DESC";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, status);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    PaymentDto dto = new PaymentDto(
                        rs.getInt("payment_id"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getInt("card_id"),
                        rs.getInt("slot_id"),
                        rs.getString("license_plate"),
                        rs.getString("entry_time"),
                        rs.getString("exit_time"),
                        rs.getInt("duration_min"),
                        rs.getDouble("amount"),
                        rs.getString("payment_method"),
                        rs.getString("payment_status"),
                        rs.getString("paid_at"),
                        rs.getInt("staff_id"),
                        rs.getString("notes"),
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

    // Thêm thanh toán mới
    public boolean addPayment(PaymentDto payment) {
        String query = "INSERT INTO payments (user_id, vehicle_id, card_id, slot_id, license_plate, entry_time, exit_time, duration_min, amount, payment_method, payment_status, paid_at, staff_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, payment.getUserId());
            pstmt.setInt(2, payment.getVehicleId());
            pstmt.setInt(3, payment.getCardId());
            pstmt.setInt(4, payment.getSlotId());
            pstmt.setString(5, payment.getLicensePlate());
            pstmt.setString(6, payment.getEntryTime());
            pstmt.setString(7, payment.getExitTime());
            pstmt.setInt(8, payment.getDurationMin());
            pstmt.setDouble(9, payment.getAmount());
            pstmt.setString(10, payment.getPaymentMethod());
            pstmt.setString(11, payment.getPaymentStatus());
            pstmt.setString(12, payment.getPaidAt());
            pstmt.setInt(13, payment.getStaffId());
            pstmt.setString(14, payment.getNotes());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật thanh toán
    public boolean updatePayment(PaymentDto payment) {
        String query = "UPDATE payments SET user_id = ?, vehicle_id = ?, card_id = ?, slot_id = ?, license_plate = ?, entry_time = ?, exit_time = ?, duration_min = ?, amount = ?, payment_method = ?, payment_status = ?, paid_at = ?, staff_id = ?, notes = ? WHERE payment_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, payment.getUserId());
            pstmt.setInt(2, payment.getVehicleId());
            pstmt.setInt(3, payment.getCardId());
            pstmt.setInt(4, payment.getSlotId());
            pstmt.setString(5, payment.getLicensePlate());
            pstmt.setString(6, payment.getEntryTime());
            pstmt.setString(7, payment.getExitTime());
            pstmt.setInt(8, payment.getDurationMin());
            pstmt.setDouble(9, payment.getAmount());
            pstmt.setString(10, payment.getPaymentMethod());
            pstmt.setString(11, payment.getPaymentStatus());
            pstmt.setString(12, payment.getPaidAt());
            pstmt.setInt(13, payment.getStaffId());
            pstmt.setString(14, payment.getNotes());
            pstmt.setInt(15, payment.getPaymentId());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Xóa thanh toán
    public boolean deletePayment(int paymentId) {
        String query = "DELETE FROM payments WHERE payment_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, paymentId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật trạng thái thanh toán
    public boolean updatePaymentStatus(int paymentId, String status) {
        String query = "UPDATE payments SET payment_status = ? WHERE payment_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, status);
            pstmt.setInt(2, paymentId);
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }
}
