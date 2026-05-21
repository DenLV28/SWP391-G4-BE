<%@page contentType="text/html" pageEncoding="UTF-8"%>

<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Login Page</title>

        <style>

            body{
                font-family: Arial, sans-serif;
                background-color: #f2f2f2;
            }

            .container{
                width: 400px;
                margin: 100px auto;
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0px 0px 10px gray;
            }

            h2{
                text-align: center;
                color: #333;
            }

            input[type=email],
            input[type=password]{

                width: 100%;
                padding: 10px;
                margin-top: 5px;
                margin-bottom: 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }

            input[type=submit]{

                width: 100%;
                padding: 10px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            }

            input[type=submit]:hover{
                background-color: #0056b3;
            }

            .error{
                color: red;
                text-align: center;
            }

            .message{
                color: green;
                text-align: center;
            }

            .register-link{
                text-align: center;
                margin-top: 15px;
            }

            .register-link a{
                text-decoration: none;
                color: #007bff;
            }

        </style>

    </head>

    <body>

        <div class="container">

            <h2>Parking Management Login</h2>

            <form action="MainController" method="POST">

                Email:
                <input type="email" name="email" required>

                Password:
                <input type="password" name="password" required>

                <input type="submit" name="action" value="Login">

            </form>

            <%
                String error = (String) request.getAttribute("ERROR");

                if(error != null){
            %>

            <p class="error"><%= error %></p>

            <%
                }
            %>

            <%
                String message = (String) request.getAttribute("MESSAGE");

                if(message != null){
            %>

            <p class="message"><%= message %></p>

            <%
                }
            %>

            <div class="register-link">

                Don't have an account?
                <a href="register.jsp">Register Here</a>

            </div>

        </div>

    </body>
</html>