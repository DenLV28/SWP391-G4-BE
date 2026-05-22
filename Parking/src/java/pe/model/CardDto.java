package pe.model;

public class CardDto {
    private int cardId;
    private String cardNumber;
    private String cardType; // monthly, daily, staff
    private int userId;
    private int vehicleId;
    private String issuedDate;
    private String expireDate;
    private String status; // active, inactive, lost, expired
    private String createdAt;

    // Constructors
    public CardDto() {
    }

    public CardDto(int cardId, String cardNumber, String cardType, int userId, int vehicleId,
                   String issuedDate, String expireDate, String status, String createdAt) {
        this.cardId = cardId;
        this.cardNumber = cardNumber;
        this.cardType = cardType;
        this.userId = userId;
        this.vehicleId = vehicleId;
        this.issuedDate = issuedDate;
        this.expireDate = expireDate;
        this.status = status;
        this.createdAt = createdAt;
    }

    // Getters & Setters
    public int getCardId() {
        return cardId;
    }

    public void setCardId(int cardId) {
        this.cardId = cardId;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public void setCardNumber(String cardNumber) {
        this.cardNumber = cardNumber;
    }

    public String getCardType() {
        return cardType;
    }

    public void setCardType(String cardType) {
        this.cardType = cardType;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public int getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(int vehicleId) {
        this.vehicleId = vehicleId;
    }

    public String getIssuedDate() {
        return issuedDate;
    }

    public void setIssuedDate(String issuedDate) {
        this.issuedDate = issuedDate;
    }

    public String getExpireDate() {
        return expireDate;
    }

    public void setExpireDate(String expireDate) {
        this.expireDate = expireDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
