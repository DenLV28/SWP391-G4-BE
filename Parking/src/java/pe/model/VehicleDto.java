package pe.model;

public class VehicleDto {
    private int vehicleId;
    private int userId;
    private String vehicleType;
    private String licensePlate;
    private String brand;
    private String model;
    private String color;
    private String createdAt;

    // Constructors
    public VehicleDto() {
    }

    public VehicleDto(int vehicleId, int userId, String vehicleType, String licensePlate, 
                      String brand, String model, String color, String createdAt) {
        this.vehicleId = vehicleId;
        this.userId = userId;
        this.vehicleType = vehicleType;
        this.licensePlate = licensePlate;
        this.brand = brand;
        this.model = model;
        this.color = color;
        this.createdAt = createdAt;
    }

    // Getters & Setters
    public int getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(int vehicleId) {
        this.vehicleId = vehicleId;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getVehicleType() {
        return vehicleType;
    }

    public void setVehicleType(String vehicleType) {
        this.vehicleType = vehicleType;
    }

    public String getLicensePlate() {
        return licensePlate;
    }

    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
