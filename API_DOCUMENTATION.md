# Parking Management System - API Documentation

## Base URL
```
http://localhost:8080/Parking/api
```

---

## 1. Vehicles API

### Get All Vehicles
- **Endpoint:** `GET /api/vehicles`
- **Description:** Lấy danh sách tất cả phương tiện
- **Response:** 
```json
[
  {
    "vehicle_id": 1,
    "user_id": 4,
    "vehicle_type": "Xe máy",
    "license_plate": "59F1-12345",
    "brand": "Honda",
    "model": "Wave RSX",
    "color": "Đen",
    "created_at": "2025-05-21 08:30:00"
  }
]
```

### Get Vehicle by ID
- **Endpoint:** `GET /api/vehicles/{vehicle_id}`
- **Description:** Lấy thông tin phương tiện theo ID
- **Example:** `GET /api/vehicles/1`

### Get Vehicles by User
- **Endpoint:** `GET /api/vehicles/byUser/{user_id}`
- **Description:** Lấy tất cả phương tiện của một user
- **Example:** `GET /api/vehicles/byUser/4`

### Add New Vehicle
- **Endpoint:** `POST /api/vehicles`
- **Method:** POST
- **Description:** Thêm phương tiện mới
- **Request Body:**
```json
{
  "user_id": 4,
  "vehicle_type": "Xe máy",
  "license_plate": "59F1-12345",
  "brand": "Honda",
  "model": "Wave RSX",
  "color": "Đen"
}
```

### Update Vehicle
- **Endpoint:** `PUT /api/vehicles`
- **Method:** PUT
- **Description:** Cập nhật thông tin phương tiện
- **Request Body:**
```json
{
  "vehicle_id": 1,
  "user_id": 4,
  "vehicle_type": "Xe máy",
  "license_plate": "59F1-12345",
  "brand": "Honda",
  "model": "Wave RSX",
  "color": "Đen"
}
```

### Delete Vehicle
- **Endpoint:** `DELETE /api/vehicles/{vehicle_id}`
- **Method:** DELETE
- **Description:** Xóa phương tiện
- **Example:** `DELETE /api/vehicles/1`

---

## 2. Cards API

### Get All Cards
- **Endpoint:** `GET /api/cards`
- **Description:** Lấy danh sách tất cả thẻ

### Get Card by ID
- **Endpoint:** `GET /api/cards/{card_id}`
- **Description:** Lấy thông tin thẻ theo ID

### Get Cards by User
- **Endpoint:** `GET /api/cards/byUser/{user_id}`
- **Description:** Lấy tất cả thẻ của một user

### Add New Card
- **Endpoint:** `POST /api/cards`
- **Method:** POST
- **Description:** Thêm thẻ mới
- **Request Body:**
```json
{
  "card_number": "CARD-M-0001",
  "card_type": "monthly",
  "user_id": 4,
  "vehicle_id": 1,
  "issued_date": "2025-01-01",
  "expire_date": "2025-12-31",
  "status": "active"
}
```

### Update Card
- **Endpoint:** `PUT /api/cards`
- **Method:** PUT
- **Description:** Cập nhật thông tin thẻ

### Delete Card
- **Endpoint:** `DELETE /api/cards/{card_id}`
- **Method:** DELETE
- **Description:** Xóa thẻ

---

## 3. Parking Slots API

### Get All Slots
- **Endpoint:** `GET /api/parking-slots`
- **Description:** Lấy danh sách tất cả chỗ đỗ xe

### Get Slot by ID
- **Endpoint:** `GET /api/parking-slots/{slot_id}`
- **Description:** Lấy thông tin chỗ đỗ theo ID

### Get Available Slots
- **Endpoint:** `GET /api/parking-slots/available/{vehicle_type}`
- **Description:** Lấy danh sách chỗ đỗ trống theo loại xe
- **Example:** `GET /api/parking-slots/available/Xe máy`

### Get Slots by Floor
- **Endpoint:** `GET /api/parking-slots/byFloor/{floor}`
- **Description:** Lấy chỗ đỗ theo tầng
- **Example:** `GET /api/parking-slots/byFloor/1`

### Add New Slot
- **Endpoint:** `POST /api/parking-slots`
- **Method:** POST
- **Description:** Thêm chỗ đỗ mới
- **Request Body:**
```json
{
  "slot_code": "T1-A-01",
  "floor": 1,
  "zone": "A",
  "vehicle_type": "Xe máy",
  "status": "available",
  "notes": "Chỗ đỗ A1"
}
```

### Update Slot
- **Endpoint:** `PUT /api/parking-slots`
- **Method:** PUT
- **Description:** Cập nhật thông tin chỗ đỗ

### Delete Slot
- **Endpoint:** `DELETE /api/parking-slots/{slot_id}`
- **Method:** DELETE
- **Description:** Xóa chỗ đỗ

---

## 4. Payments API

### Get All Payments
- **Endpoint:** `GET /api/payments`
- **Description:** Lấy danh sách tất cả thanh toán

### Get Payment by ID
- **Endpoint:** `GET /api/payments/{payment_id}`
- **Description:** Lấy thông tin thanh toán theo ID

### Get Payments by User
- **Endpoint:** `GET /api/payments/byUser/{user_id}`
- **Description:** Lấy tất cả thanh toán của một user

### Get Payments by License Plate
- **Endpoint:** `GET /api/payments/byLicensePlate/{license_plate}`
- **Description:** Lấy thanh toán theo biển số xe

### Get Payments by Status
- **Endpoint:** `GET /api/payments/byStatus/{status}`
- **Description:** Lấy thanh toán theo trạng thái
- **Status values:** `pending`, `paid`, `waived`

### Add New Payment
- **Endpoint:** `POST /api/payments`
- **Method:** POST
- **Description:** Thêm bản ghi thanh toán mới
- **Request Body:**
```json
{
  "user_id": 4,
  "vehicle_id": 1,
  "card_id": 1,
  "slot_id": 1,
  "license_plate": "59F1-12345",
  "entry_time": "2025-05-21 08:30:00",
  "exit_time": "2025-05-21 10:15:00",
  "duration_min": 105,
  "amount": 10000,
  "payment_method": "cash",
  "payment_status": "pending",
  "paid_at": null,
  "staff_id": 3,
  "notes": "Ghi chú"
}
```

### Update Payment
- **Endpoint:** `PUT /api/payments`
- **Method:** PUT
- **Description:** Cập nhật thông tin thanh toán

### Delete Payment
- **Endpoint:** `DELETE /api/payments/{payment_id}`
- **Method:** DELETE
- **Description:** Xóa bản ghi thanh toán

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Yêu cầu thành công |
| 201 | Created - Tạo mới thành công |
| 400 | Bad Request - Yêu cầu không hợp lệ |
| 404 | Not Found - Không tìm thấy |
| 500 | Internal Server Error - Lỗi server |

---

## Vehicle Types
- `Xe máy` (Motorcycle)
- `Ô tô` (Car)
- `Xe đạp` (Bicycle)
- `Xe tải nhỏ` (Small truck)

## Card Types
- `monthly` (Thẻ tháng)
- `daily` (Thẻ ngày)
- `staff` (Thẻ nhân viên)

## Card Status
- `active` (Hoạt động)
- `inactive` (Không hoạt động)
- `lost` (Mất)
- `expired` (Hết hạn)

## Slot Status
- `available` (Trống)
- `occupied` (Đã chiếm)
- `reserved` (Đã đặt)
- `maintenance` (Bảo trì)

## Payment Methods
- `cash` (Tiền mặt)
- `card` (Thẻ)
- `qr_code` (Mã QR)
- `monthly_pass` (Thẻ tháng)

## Payment Status
- `pending` (Chờ thanh toán)
- `paid` (Đã thanh toán)
- `waived` (Miễn phí)

---

## Example Requests

### cURL Examples

#### Get all vehicles
```bash
curl -X GET http://localhost:8080/Parking/api/vehicles
```

#### Add new vehicle
```bash
curl -X POST http://localhost:8080/Parking/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 4,
    "vehicle_type": "Xe máy",
    "license_plate": "59F1-12345",
    "brand": "Honda",
    "model": "Wave RSX",
    "color": "Đen"
  }'
```

#### Get available slots for motorcycles
```bash
curl -X GET http://localhost:8080/Parking/api/parking-slots/available/Xe%20máy
```

#### Add payment
```bash
curl -X POST http://localhost:8080/Parking/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 4,
    "vehicle_id": 1,
    "license_plate": "59F1-12345",
    "entry_time": "2025-05-21 08:30:00",
    "amount": 10000,
    "payment_method": "cash",
    "payment_status": "pending"
  }'
```

---

## Notes
- Tất cả requests và responses sử dụng JSON format
- Charset: UTF-8
- Timestamp format: `YYYY-MM-DD HH:mm:ss`
- Các field optional được đánh dấu trong request body
