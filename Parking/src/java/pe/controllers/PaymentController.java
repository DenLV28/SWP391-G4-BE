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

@WebServlet("/api/payments/*")
public class PaymentController extends HttpServlet {
    private PaymentDao paymentDao = new PaymentDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        String pathInfo = request.getPathInfo();
        
        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                List<PaymentDto> payments = paymentDao.getAllPayments();
                JSONArray jsonArray = new JSONArray();
                for (PaymentDto p : payments) {
                    jsonArray.put(paymentToJson(p));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.matches("^/\\d+$")) {
                int paymentId = Integer.parseInt(pathInfo.substring(1));
                PaymentDto payment = paymentDao.getPaymentById(paymentId);
                if (payment != null) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print(paymentToJson(payment).toString());
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    out.print("{\"error\":\"Payment not found\"}");
                }
            } else if (pathInfo.startsWith("/byUser/")) {
                int userId = Integer.parseInt(pathInfo.substring(8));
                List<PaymentDto> payments = paymentDao.getPaymentsByUserId(userId);
                JSONArray jsonArray = new JSONArray();
                for (PaymentDto p : payments) {
                    jsonArray.put(paymentToJson(p));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.startsWith("/byLicensePlate/")) {
                String licensePlate = pathInfo.substring(16);
                List<PaymentDto> payments = paymentDao.getPaymentsByLicensePlate(licensePlate);
                JSONArray jsonArray = new JSONArray();
                for (PaymentDto p : payments) {
                    jsonArray.put(paymentToJson(p));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.startsWith("/byStatus/")) {
                String status = pathInfo.substring(10);
                List<PaymentDto> payments = paymentDao.getPaymentsByStatus(status);
                JSONArray jsonArray = new JSONArray();
                for (PaymentDto p : payments) {
                    jsonArray.put(paymentToJson(p));
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
            
            PaymentDto payment = new PaymentDto();
            payment.setUserId(jsonObject.optInt("user_id"));
            payment.setVehicleId(jsonObject.optInt("vehicle_id"));
            payment.setCardId(jsonObject.optInt("card_id"));
            payment.setSlotId(jsonObject.optInt("slot_id"));
            payment.setLicensePlate(jsonObject.getString("license_plate"));
            payment.setEntryTime(jsonObject.getString("entry_time"));
            payment.setExitTime(jsonObject.optString("exit_time"));
            payment.setDurationMin(jsonObject.optInt("duration_min"));
            payment.setAmount(jsonObject.optDouble("amount", 0));
            payment.setPaymentMethod(jsonObject.optString("payment_method", "cash"));
            payment.setPaymentStatus(jsonObject.optString("payment_status", "pending"));
            payment.setPaidAt(jsonObject.optString("paid_at"));
            payment.setStaffId(jsonObject.optInt("staff_id"));
            payment.setNotes(jsonObject.optString("notes"));
            
            if (paymentDao.addPayment(payment)) {
                response.setStatus(HttpServletResponse.SC_CREATED);
                out.print("{\"success\":true,\"message\":\"Payment added successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to add payment\"}");
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
            
            PaymentDto payment = new PaymentDto();
            payment.setPaymentId(jsonObject.getInt("payment_id"));
            payment.setUserId(jsonObject.optInt("user_id"));
            payment.setVehicleId(jsonObject.optInt("vehicle_id"));
            payment.setCardId(jsonObject.optInt("card_id"));
            payment.setSlotId(jsonObject.optInt("slot_id"));
            payment.setLicensePlate(jsonObject.getString("license_plate"));
            payment.setEntryTime(jsonObject.getString("entry_time"));
            payment.setExitTime(jsonObject.optString("exit_time"));
            payment.setDurationMin(jsonObject.optInt("duration_min"));
            payment.setAmount(jsonObject.optDouble("amount", 0));
            payment.setPaymentMethod(jsonObject.optString("payment_method", "cash"));
            payment.setPaymentStatus(jsonObject.optString("payment_status", "pending"));
            payment.setPaidAt(jsonObject.optString("paid_at"));
            payment.setStaffId(jsonObject.optInt("staff_id"));
            payment.setNotes(jsonObject.optString("notes"));
            
            if (paymentDao.updatePayment(payment)) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"success\":true,\"message\":\"Payment updated successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to update payment\"}");
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
                int paymentId = Integer.parseInt(pathInfo.substring(1));
                if (paymentDao.deletePayment(paymentId)) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print("{\"success\":true,\"message\":\"Payment deleted successfully\"}");
                } else {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    out.print("{\"success\":false,\"message\":\"Failed to delete payment\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    private JSONObject paymentToJson(PaymentDto p) {
        JSONObject json = new JSONObject();
        json.put("payment_id", p.getPaymentId());
        json.put("user_id", p.getUserId());
        json.put("vehicle_id", p.getVehicleId());
        json.put("card_id", p.getCardId());
        json.put("slot_id", p.getSlotId());
        json.put("license_plate", p.getLicensePlate());
        json.put("entry_time", p.getEntryTime());
        json.put("exit_time", p.getExitTime());
        json.put("duration_min", p.getDurationMin());
        json.put("amount", p.getAmount());
        json.put("payment_method", p.getPaymentMethod());
        json.put("payment_status", p.getPaymentStatus());
        json.put("paid_at", p.getPaidAt());
        json.put("staff_id", p.getStaffId());
        json.put("notes", p.getNotes());
        json.put("created_at", p.getCreatedAt());
        return json;
    }
}
