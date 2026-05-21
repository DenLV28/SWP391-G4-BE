<%@page import="pe.model.UserDto"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>

<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Home Page</title>

        <style>

            body{
                font-family: Arial, sans-serif;
                background-color: #f2f2f2;
            }

            .container{
                width: 700px;
                margin: 50px auto;
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0px 0px 10px gray;
            }

            h1{
                color: #333;
            }

            .info{
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
            }

            .menu{
                margin-top: 30px;
            }

            .menu a{

                display: inline-block;
                padding: 10px 20px;
                margin-right: 10px;

                background-color: #007bff;
                color: white;

                text-decoration: none;
                border-radius: 5px;
            }

            .menu a:hover{
                background-color: #0056b3;
            }

            .logout{
                background-color: #dc3545 !important;
            }

            .logout:hover{
                background-color: #b02a37 !important;
            }

        </style>

    </head>

    <body>

        <%
            UserDto user = (UserDto) session.getAttribute("LOGIN_USER");

            if(user == null){
                response.sendRedirect("login.jsp");
                return;
            }
        %>

        <div class="container">

            <h1>Welcome to Parking Management System</h1>

            <div class="info">

                <h3>User Information</h3>

                <p>
                    <strong>Full Name:</strong>
                    <%= user.getFullName() %>
                </p>

                <p>
                    <strong>Email:</strong>
                    <%= user.getEmail() %>
                </p>

                <p>
                    <strong>Phone:</strong>
                    <%= user.getPhone() %>
                </p>

                <p>
                    <strong>Role:</strong>
                    <%= user.getRole() %>
                </p>

            </div>

            <div class="menu">

                <a href="#">Manage Vehicles</a>

                <a href="#">Parking Slots</a>

                <a href="#">Payments</a>

                <a href="login.jsp" class="logout">
                    Logout
                </a>

            </div>

        </div>

    </body>
</html>