package pe.model;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import pe.utils.DbUtils;

public class UserDao {

    // =========================
    // LOGIN
    // =========================
    public UserDto checkLogin(String email, String password) {

        UserDto user = null;

        try {

            Connection conn = DbUtils.getConnection();

            String sql = "SELECT * FROM users "
                    + "WHERE email = ? "
                    + "AND password_hash = ? "
                    + "AND is_active = 1";

            PreparedStatement ps = conn.prepareStatement(sql);

            ps.setString(1, email);
            ps.setString(2, password);

            ResultSet rs = ps.executeQuery();

            if (rs.next()) {

                user = new UserDto();

                user.setUserId(rs.getInt("user_id"));
                user.setFullName(rs.getString("full_name"));
                user.setEmail(rs.getString("email"));
                user.setPhone(rs.getString("phone"));
                user.setPasswordHash(rs.getString("password_hash"));
                user.setRole(rs.getString("role"));
                user.setActive(rs.getBoolean("is_active"));
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return user;
    }

    // =========================
    // CHECK EMAIL EXIST
    // =========================
    public boolean checkEmailExist(String email) {

        boolean check = false;

        try {

            Connection conn = DbUtils.getConnection();

            String sql = "SELECT email FROM users WHERE email = ?";

            PreparedStatement ps = conn.prepareStatement(sql);

            ps.setString(1, email);

            ResultSet rs = ps.executeQuery();

            if (rs.next()) {
                check = true;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return check;
    }

    // =========================
    // REGISTER
    // =========================
    public boolean register(UserDto user) {

        boolean check = false;

        try {

            Connection conn = DbUtils.getConnection();

            String sql = "INSERT INTO users "
                    + "(full_name, email, phone, password_hash, role, is_active) "
                    + "VALUES (?, ?, ?, ?, ?, ?)";

            PreparedStatement ps = conn.prepareStatement(sql);

            ps.setString(1, user.getFullName());
            ps.setString(2, user.getEmail());
            ps.setString(3, user.getPhone());
            ps.setString(4, user.getPasswordHash());
            ps.setString(5, user.getRole());
            ps.setBoolean(6, user.isActive());

            int result = ps.executeUpdate();

            if (result > 0) {
                check = true;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return check;
    }
}