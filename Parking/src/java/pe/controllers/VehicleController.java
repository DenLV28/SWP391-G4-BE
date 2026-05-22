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

@WebServlet("/api/vehicles/*")
public class VehicleController extends HttpServlet {
    private VehicleDao vehicleDao = new VehicleDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        String pathInfo = request.getPathInfo();
        
        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                // Lấy tất cả phương tiện
                List<VehicleDto> vehicles = vehicleDao.getAllVehicles();
                JSONArray jsonArray = new JSONArray();
                for (VehicleDto v : vehicles) {
                    jsonArray.put(vehicleToJson(v));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.matches("^/\\d+$")) {
                // Lấy phương tiện theo ID
                int vehicleId = Integer.parseInt(pathInfo.substring(1));
                VehicleDto vehicle = vehicleDao.getVehicleById(vehicleId);
                if (vehicle != null) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print(vehicleToJson(vehicle).toString());
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    out.print("{\"error\":\"Vehicle not found\"}");
                }
            } else if (pathInfo.startsWith("/byUser/")) {
                // Lấy phương tiện theo user ID
                int userId = Integer.parseInt(pathInfo.substring(8));
                List<VehicleDto> vehicles = vehicleDao.getVehiclesByUserId(userId);
                JSONArray jsonArray = new JSONArray();
                for (VehicleDto v : vehicles) {
                    jsonArray.put(vehicleToJson(v));
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
            // Đọc JSON từ request
            String json = request.getReader().lines()
                    .reduce("", (acc, actual) -> acc + actual);
            JSONObject jsonObject = new JSONObject(json);
            
            VehicleDto vehicle = new VehicleDto();
            vehicle.setUserId(jsonObject.getInt("user_id"));
            vehicle.setVehicleType(jsonObject.getString("vehicle_type"));
            vehicle.setLicensePlate(jsonObject.getString("license_plate"));
            vehicle.setBrand(jsonObject.optString("brand"));
            vehicle.setModel(jsonObject.optString("model"));
            vehicle.setColor(jsonObject.optString("color"));
            
            if (vehicleDao.addVehicle(vehicle)) {
                response.setStatus(HttpServletResponse.SC_CREATED);
                out.print("{\"success\":true,\"message\":\"Vehicle added successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to add vehicle\"}");
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
            
            VehicleDto vehicle = new VehicleDto();
            vehicle.setVehicleId(jsonObject.getInt("vehicle_id"));
            vehicle.setUserId(jsonObject.getInt("user_id"));
            vehicle.setVehicleType(jsonObject.getString("vehicle_type"));
            vehicle.setLicensePlate(jsonObject.getString("license_plate"));
            vehicle.setBrand(jsonObject.optString("brand"));
            vehicle.setModel(jsonObject.optString("model"));
            vehicle.setColor(jsonObject.optString("color"));
            
            if (vehicleDao.updateVehicle(vehicle)) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"success\":true,\"message\":\"Vehicle updated successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to update vehicle\"}");
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
                int vehicleId = Integer.parseInt(pathInfo.substring(1));
                if (vehicleDao.deleteVehicle(vehicleId)) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print("{\"success\":true,\"message\":\"Vehicle deleted successfully\"}");
                } else {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    out.print("{\"success\":false,\"message\":\"Failed to delete vehicle\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    private JSONObject vehicleToJson(VehicleDto v) {
        JSONObject json = new JSONObject();
        json.put("vehicle_id", v.getVehicleId());
        json.put("user_id", v.getUserId());
        json.put("vehicle_type", v.getVehicleType());
        json.put("license_plate", v.getLicensePlate());
        json.put("brand", v.getBrand());
        json.put("model", v.getModel());
        json.put("color", v.getColor());
        json.put("created_at", v.getCreatedAt());
        return json;
    }
}
