package pe.model;

public class ParkingSlotDto {
    private int slotId;
    private String slotCode;
    private int floor;
    private String zone;
    private String vehicleType;
    private String status; // available, occupied, reserved, maintenance
    private String notes;

    // Constructors
    public ParkingSlotDto() {
    }

    public ParkingSlotDto(int slotId, String slotCode, int floor, String zone, 
                         String vehicleType, String status, String notes) {
        this.slotId = slotId;
        this.slotCode = slotCode;
        this.floor = floor;
        this.zone = zone;
        this.vehicleType = vehicleType;
        this.status = status;
        this.notes = notes;
    }

    // Getters & Setters
    public int getSlotId() {
        return slotId;
    }

    public void setSlotId(int slotId) {
        this.slotId = slotId;
    }

    public String getSlotCode() {
        return slotCode;
    }

    public void setSlotCode(String slotCode) {
        this.slotCode = slotCode;
    }

    public int getFloor() {
        return floor;
    }

    public void setFloor(int floor) {
        this.floor = floor;
    }

    public String getZone() {
        return zone;
    }

    public void setZone(String zone) {
        this.zone = zone;
    }

    public String getVehicleType() {
        return vehicleType;
    }

    public void setVehicleType(String vehicleType) {
        this.vehicleType = vehicleType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
