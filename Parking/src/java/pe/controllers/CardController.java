package pe.controllers;

import pe.model.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet("/api/cards/*")
public class CardController extends HttpServlet {
    private CardDao cardDao = new CardDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        String pathInfo = request.getPathInfo();
        
        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                List<CardDto> cards = cardDao.getAllCards();
                JSONArray jsonArray = new JSONArray();
                for (CardDto c : cards) {
                    jsonArray.put(cardToJson(c));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.matches("^/\\d+$")) {
                int cardId = Integer.parseInt(pathInfo.substring(1));
                CardDto card = cardDao.getCardById(cardId);
                if (card != null) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print(cardToJson(card).toString());
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    out.print("{\"error\":\"Card not found\"}");
                }
            } else if (pathInfo.startsWith("/byUser/")) {
                int userId = Integer.parseInt(pathInfo.substring(8));
                List<CardDto> cards = cardDao.getCardsByUserId(userId);
                JSONArray jsonArray = new JSONArray();
                for (CardDto c : cards) {
                    jsonArray.put(cardToJson(c));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                out.print("{\"error\":\"Invalid request\"}");
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        
        try {
            String json = request.getReader().lines()
                    .reduce("", (acc, actual) -> acc + actual);
            JSONObject jsonObject = new JSONObject(json);
            
            CardDto card = new CardDto();
            card.setCardNumber(jsonObject.getString("card_number"));
            card.setCardType(jsonObject.getString("card_type"));
            card.setUserId(jsonObject.optInt("user_id"));
            card.setVehicleId(jsonObject.optInt("vehicle_id"));
            card.setIssuedDate(jsonObject.getString("issued_date"));
            card.setExpireDate(jsonObject.optString("expire_date"));
            card.setStatus(jsonObject.optString("status", "active"));
            
            if (cardDao.addCard(card)) {
                response.setStatus(HttpServletResponse.SC_CREATED);
                out.print("{\"success\":true,\"message\":\"Card added successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to add card\"}");
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        
        try {
            String json = request.getReader().lines()
                    .reduce("", (acc, actual) -> acc + actual);
            JSONObject jsonObject = new JSONObject(json);
            
            CardDto card = new CardDto();
            card.setCardId(jsonObject.getInt("card_id"));
            card.setCardNumber(jsonObject.getString("card_number"));
            card.setCardType(jsonObject.getString("card_type"));
            card.setUserId(jsonObject.optInt("user_id"));
            card.setVehicleId(jsonObject.optInt("vehicle_id"));
            card.setIssuedDate(jsonObject.getString("issued_date"));
            card.setExpireDate(jsonObject.optString("expire_date"));
            card.setStatus(jsonObject.optString("status", "active"));
            
            if (cardDao.updateCard(card)) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"success\":true,\"message\":\"Card updated successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to update card\"}");
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        String pathInfo = request.getPathInfo();
        
        try {
            if (pathInfo.matches("^/\\d+$")) {
                int cardId = Integer.parseInt(pathInfo.substring(1));
                if (cardDao.deleteCard(cardId)) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print("{\"success\":true,\"message\":\"Card deleted successfully\"}");
                } else {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    out.print("{\"success\":false,\"message\":\"Failed to delete card\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    private JSONObject cardToJson(CardDto c) {
        JSONObject json = new JSONObject();
        json.put("card_id", c.getCardId());
        json.put("card_number", c.getCardNumber());
        json.put("card_type", c.getCardType());
        json.put("user_id", c.getUserId());
        json.put("vehicle_id", c.getVehicleId());
        json.put("issued_date", c.getIssuedDate());
        json.put("expire_date", c.getExpireDate());
        json.put("status", c.getStatus());
        json.put("created_at", c.getCreatedAt());
        return json;
    }
}
