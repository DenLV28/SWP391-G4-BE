package pe.model;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import pe.utils.DbUtils;

public class CardDao {

    // Lấy tất cả thẻ
    public List<CardDto> getAllCards() {
        List<CardDto> list = new ArrayList<>();
        String query = "SELECT card_id, card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status, created_at FROM cards";
        
        try (Connection conn = DbUtils.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {
            
            while (rs.next()) {
                CardDto dto = new CardDto(
                    rs.getInt("card_id"),
                    rs.getString("card_number"),
                    rs.getString("card_type"),
                    rs.getInt("user_id"),
                    rs.getInt("vehicle_id"),
                    rs.getString("issued_date"),
                    rs.getString("expire_date"),
                    rs.getString("status"),
                    rs.getString("created_at")
                );
                list.add(dto);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Lấy thẻ theo ID
    public CardDto getCardById(int cardId) {
        String query = "SELECT card_id, card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status, created_at FROM cards WHERE card_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, cardId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new CardDto(
                        rs.getInt("card_id"),
                        rs.getString("card_number"),
                        rs.getString("card_type"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getString("issued_date"),
                        rs.getString("expire_date"),
                        rs.getString("status"),
                        rs.getString("created_at")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy thẻ theo số thẻ
    public CardDto getCardByNumber(String cardNumber) {
        String query = "SELECT card_id, card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status, created_at FROM cards WHERE card_number = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, cardNumber);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new CardDto(
                        rs.getInt("card_id"),
                        rs.getString("card_number"),
                        rs.getString("card_type"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getString("issued_date"),
                        rs.getString("expire_date"),
                        rs.getString("status"),
                        rs.getString("created_at")
                    );
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    // Lấy tất cả thẻ của một user
    public List<CardDto> getCardsByUserId(int userId) {
        List<CardDto> list = new ArrayList<>();
        String query = "SELECT card_id, card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status, created_at FROM cards WHERE user_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    CardDto dto = new CardDto(
                        rs.getInt("card_id"),
                        rs.getString("card_number"),
                        rs.getString("card_type"),
                        rs.getInt("user_id"),
                        rs.getInt("vehicle_id"),
                        rs.getString("issued_date"),
                        rs.getString("expire_date"),
                        rs.getString("status"),
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

    // Thêm thẻ mới
    public boolean addCard(CardDto card) {
        String query = "INSERT INTO cards (card_number, card_type, user_id, vehicle_id, issued_date, expire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, card.getCardNumber());
            pstmt.setString(2, card.getCardType());
            pstmt.setInt(3, card.getUserId());
            pstmt.setInt(4, card.getVehicleId());
            pstmt.setString(5, card.getIssuedDate());
            pstmt.setString(6, card.getExpireDate());
            pstmt.setString(7, card.getStatus());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật thẻ
    public boolean updateCard(CardDto card) {
        String query = "UPDATE cards SET card_number = ?, card_type = ?, user_id = ?, vehicle_id = ?, issued_date = ?, expire_date = ?, status = ? WHERE card_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, card.getCardNumber());
            pstmt.setString(2, card.getCardType());
            pstmt.setInt(3, card.getUserId());
            pstmt.setInt(4, card.getVehicleId());
            pstmt.setString(5, card.getIssuedDate());
            pstmt.setString(6, card.getExpireDate());
            pstmt.setString(7, card.getStatus());
            pstmt.setInt(8, card.getCardId());
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Xóa thẻ
    public boolean deleteCard(int cardId) {
        String query = "DELETE FROM cards WHERE card_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setInt(1, cardId);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // Cập nhật trạng thái thẻ
    public boolean updateCardStatus(int cardId, String status) {
        String query = "UPDATE cards SET status = ? WHERE card_id = ?";
        
        try (Connection conn = DbUtils.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(query)) {
            
            pstmt.setString(1, status);
            pstmt.setInt(2, cardId);
            
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }
}
