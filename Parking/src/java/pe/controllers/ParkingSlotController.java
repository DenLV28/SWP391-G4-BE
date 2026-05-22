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

@WebServlet("/api/parking-slots/*")
public class ParkingSlotController extends HttpServlet {
    private ParkingSlotDao parkingSlotDao = new ParkingSlotDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        String pathInfo = request.getPathInfo();
        String queryString = request.getQueryString();
        
        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                List<ParkingSlotDto> slots = parkingSlotDao.getAllSlots();
                JSONArray jsonArray = new JSONArray();
                for (ParkingSlotDto s : slots) {
                    jsonArray.put(slotToJson(s));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.matches("^/\\d+$")) {
                int slotId = Integer.parseInt(pathInfo.substring(1));
                ParkingSlotDto slot = parkingSlotDao.getSlotById(slotId);
                if (slot != null) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print(slotToJson(slot).toString());
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    out.print("{\"error\":\"Parking slot not found\"}");
                }
            } else if (pathInfo.startsWith("/available/")) {
                String vehicleType = pathInfo.substring(11);
                List<ParkingSlotDto> slots = parkingSlotDao.getAvailableSlots(vehicleType);
                JSONArray jsonArray = new JSONArray();
                for (ParkingSlotDto s : slots) {
                    jsonArray.put(slotToJson(s));
                }
                response.setStatus(HttpServletResponse.SC_OK);
                out.print(jsonArray.toString());
            } else if (pathInfo.startsWith("/byFloor/")) {
                int floor = Integer.parseInt(pathInfo.substring(9));
                List<ParkingSlotDto> slots = parkingSlotDao.getSlotsByFloor(floor);
                JSONArray jsonArray = new JSONArray();
                for (ParkingSlotDto s : slots) {
                    jsonArray.put(slotToJson(s));
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
            
            ParkingSlotDto slot = new ParkingSlotDto();
            slot.setSlotCode(jsonObject.getString("slot_code"));
            slot.setFloor(jsonObject.getInt("floor"));
            slot.setZone(jsonObject.getString("zone"));
            slot.setVehicleType(jsonObject.optString("vehicle_type"));
            slot.setStatus(jsonObject.optString("status", "available"));
            slot.setNotes(jsonObject.optString("notes"));
            
            if (parkingSlotDao.addSlot(slot)) {
                response.setStatus(HttpServletResponse.SC_CREATED);
                out.print("{\"success\":true,\"message\":\"Parking slot added successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to add parking slot\"}");
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
            
            ParkingSlotDto slot = new ParkingSlotDto();
            slot.setSlotId(jsonObject.getInt("slot_id"));
            slot.setSlotCode(jsonObject.getString("slot_code"));
            slot.setFloor(jsonObject.getInt("floor"));
            slot.setZone(jsonObject.getString("zone"));
            slot.setVehicleType(jsonObject.optString("vehicle_type"));
            slot.setStatus(jsonObject.optString("status", "available"));
            slot.setNotes(jsonObject.optString("notes"));
            
            if (parkingSlotDao.updateSlot(slot)) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"success\":true,\"message\":\"Parking slot updated successfully\"}");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                out.print("{\"success\":false,\"message\":\"Failed to update parking slot\"}");
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
                int slotId = Integer.parseInt(pathInfo.substring(1));
                if (parkingSlotDao.deleteSlot(slotId)) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    out.print("{\"success\":true,\"message\":\"Parking slot deleted successfully\"}");
                } else {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    out.print("{\"success\":false,\"message\":\"Failed to delete parking slot\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    private JSONObject slotToJson(ParkingSlotDto s) {
        JSONObject json = new JSONObject();
        json.put("slot_id", s.getSlotId());
        json.put("slot_code", s.getSlotCode());
        json.put("floor", s.getFloor());
        json.put("zone", s.getZone());
        json.put("vehicle_type", s.getVehicleType());
        json.put("status", s.getStatus());
        json.put("notes", s.getNotes());
        return json;
    }
}
