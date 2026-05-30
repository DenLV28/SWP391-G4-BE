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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@WebServlet("/api/auth/login")
public class AuthController extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        String body = readRequestBody(request);
        String email = parseJsonField(body, "email");
        String password = parseJsonField(body, "password");

        if ((email == null || email.isEmpty()) && (password == null || password.isEmpty())) {
            email = request.getParameter("email");
            password = request.getParameter("password");
        }

        if (email == null || password == null || email.isEmpty() || password.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            out.print("{\"error\":\"Email và password là bắt buộc\"}");
            return;
        }

        UserDao dao = new UserDao();
        UserDto user = dao.checkLogin(email, password);

        if (user == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.print("{\"error\":\"Email hoặc mật khẩu không đúng\"}");
            return;
        }

        response.setStatus(HttpServletResponse.SC_OK);
        out.print(userToJson(user));
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        String email = request.getParameter("email");
        String password = request.getParameter("password");

        if (email == null || password == null || email.isEmpty() || password.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
            out.print("{\"error\":\"Please call POST /api/auth/login with JSON {\\\"email\\\":..., \\\"password\\\":...}\"}");
            return;
        }

        UserDao dao = new UserDao();
        UserDto user = dao.checkLogin(email, password);

        if (user == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.print("{\"error\":\"Email hoặc mật khẩu không đúng\"}");
            return;
        }

        response.setStatus(HttpServletResponse.SC_OK);
        out.print(userToJson(user));
    }

    private String readRequestBody(HttpServletRequest request) throws IOException {
        StringBuilder body = new StringBuilder();
        String line;
        while ((line = request.getReader().readLine()) != null) {
            body.append(line);
        }
        return body.toString();
    }

    private String parseJsonField(String json, String field) {
        if (json == null) {
            return null;
        }
        Pattern pattern = Pattern.compile("\\\"" + field + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
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
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
