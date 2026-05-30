package pe.controllers;

import pe.model.UserDao;
import pe.model.UserDto;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@WebServlet("/api/users/*")
public class UserController extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        UserDao dao = new UserDao();
        String pathInfo = request.getPathInfo();

        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                List<UserDto> users = dao.getAllUsers();
                out.print(usersToJson(users));
                response.setStatus(HttpServletResponse.SC_OK);
                return;
            }

            if (pathInfo.matches("^/\\d+$")) {
                int userId = Integer.parseInt(pathInfo.substring(1));
                UserDto user = dao.getUserById(userId);
                if (user != null) {
                    out.print(userToJson(user));
                    response.setStatus(HttpServletResponse.SC_OK);
                } else {
                    out.print("{\"error\":\"User not found\"}");
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                }
                return;
            }

            out.print("{\"error\":\"Invalid endpoint\"}");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        } catch (Exception e) {
            e.printStackTrace();
            out.print("{\"error\":\"Server error\"}");
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private String usersToJson(List<UserDto> users) {
        StringBuilder sb = new StringBuilder();
        sb.append('[');
        boolean first = true;
        for (UserDto user : users) {
            if (!first) sb.append(',');
            first = false;
            sb.append(userToJson(user));
        }
        sb.append(']');
        return sb.toString();
    }

    private String userToJson(UserDto user) {
        StringBuilder sb = new StringBuilder();
        sb.append('{');
        sb.append("\"user_id\":").append(user.getUserId());
        sb.append(",\"full_name\":\"").append(escape(user.getFullName())).append('"');
        sb.append(",\"email\":\"").append(escape(user.getEmail())).append('"');
        sb.append(",\"phone\":\"").append(escape(user.getPhone())).append('"');
        sb.append(",\"role\":\"").append(escape(user.getRole())).append('"');
        sb.append(",\"active\":").append(user.isActive());
        sb.append('}');
        return sb.toString();
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
