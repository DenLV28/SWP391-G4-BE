/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package pe.controllers;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import pe.model.UserDao;
import pe.model.UserDto;
import java.util.List;

/**
 *
 * @author Computing Fundamental - HCM Campus
 */
public class MainController extends HttpServlet {

    private static final String WELCOME = "register.jsp";

    /**
     * Processes requests for both HTTP <code>GET</code> and <code>POST</code>
     * methods.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    protected void processRequest(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {

    response.setContentType("text/html;charset=UTF-8");

    String url = WELCOME;

    try {

        String action = request.getParameter("action");

        UserDao dao = new UserDao();

        // =========================
        // REGISTER
        // =========================
        if ("Register".equals(action)) {

            String fullName = request.getParameter("fullName");
            String email = request.getParameter("email");
            String phone = request.getParameter("phone");
            String password = request.getParameter("password");

            // check email tồn tại
            if (dao.checkEmailExist(email)) {

                request.setAttribute("ERROR", "Email already exists!");

                url = "register.jsp";

            } else {

                UserDto user = new UserDto();

                user.setFullName(fullName);
                user.setEmail(email);
                user.setPhone(phone);
                user.setPasswordHash(password);

                user.setRole("user");

                user.setActive(true);

                boolean check = dao.register(user);

                if (check) {

                    request.setAttribute("MESSAGE", "Register Success!");

                    url = "login.jsp";

                } else {

                    request.setAttribute("ERROR", "Register Failed!");

                    url = "register.jsp";
                }
            }
        }

        // =========================
        // LOGIN
        // =========================
        else if ("Login".equals(action)) {

            String email = request.getParameter("email");
            String password = request.getParameter("password");

            UserDto user = dao.checkLogin(email, password);

            if (user != null) {

                request.getSession().setAttribute("LOGIN_USER", user);

                url = "home.jsp";

            } else {

                request.setAttribute("ERROR", "Invalid Email or Password!");

                url = "login.jsp";
            }
        }

    } catch (Exception e) {

        e.printStackTrace();

    } finally {

        request.getRequestDispatcher(url).forward(request, response);
    }
}

    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP <code>GET</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Handles the HTTP <code>POST</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Short description";
    }// </editor-fold>

}
