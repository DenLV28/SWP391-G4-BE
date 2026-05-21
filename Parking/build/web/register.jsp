<%@page contentType="text/html" pageEncoding="UTF-8"%>

<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Register Page</title>

        <style>

            body{
                font-family: Arial, sans-serif;
                background-color: #f2f2f2;
            }

            .container{
                width: 450px;
                margin: 50px auto;
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0px 0px 10px gray;
            }

            h2{
                text-align: center;
                color: #333;
            }

            input[type=text],
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
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            }

            input[type=submit]:hover{
                background-color: #218838;
            }

            .error{
                color: red;
                text-align: center;
            }

            .message{
                color: green;
                text-align: center;
            }

            .login-link{
                text-align: center;
                margin-top: 15px;
            }

            .login-link a{
                text-decoration: none;
                color: #007bff;
            }

        </style>

    </head>

    <body>

        <div class="container">

            <h2>Create New Account</h2>

            <form action="MainController" method="POST">

                Full Name:
                <input type="text" name="fullName" required>

                Email:
                <input type="email" name="email" required>

                Phone:
                <input type="text" name="phone" required>

                Password:
                <input type="password" name="password" required>

                <input type="submit" name="action" value="Register">

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

            <div class="login-link">

                Already have an account?
                <a href="login.jsp">Login Here</a>

            </div>

        </div>

    </body>
</html>