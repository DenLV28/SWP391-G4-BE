# Parking Management Backend - Project Structure

## Cấu trúc thư mục

```
Parking/src/java/pe/
├── controllers/
│   ├── VehicleController.java       # API endpoints cho quản lý phương tiện
│   ├── CardController.java          # API endpoints cho quản lý thẻ
│   ├── ParkingSlotController.java   # API endpoints cho quản lý chỗ đỗ
│   ├── PaymentController.java       # API endpoints cho quản lý thanh toán
│   └── MainController.java          # Main servlet (đã có)
├── model/
│   ├── UserDto.java                 # Model cho user (đã có)
│   ├── UserDao.java                 # DAO cho user (đã có)
│   ├── VehicleDto.java              # Model cho phương tiện
│   ├── VehicleDao.java              # DAO cho phương tiện
│   ├── CardDto.java                 # Model cho thẻ
│   ├── CardDao.java                 # DAO cho thẻ
│   ├── ParkingSlotDto.java          # Model cho chỗ đỗ
│   ├── ParkingSlotDao.java          # DAO cho chỗ đỗ
│   ├── PaymentDto.java              # Model cho thanh toán
│   └── PaymentDao.java              # DAO cho thanh toán
└── utils/
    ├── DbUtils.java                 # Utility cho database connection (đã có)
    └── ... (các utility khác)
```

## Công nghệ sử dụng
- **Java** (Servlet API)
- **SQL Server** (SQL Server 2019 trở lên)
- **JSON** (org.json library)
- **JDBC** (Database connectivity)

## Cách thực hiện CRUD Operations

### 1. Database Layer (DAO - Data Access Object)
Mỗi entity (Vehicle, Card, ParkingSlot, Payment) có một DAO class:
- `getAll()` - Lấy tất cả bản ghi
- `getById(id)` - Lấy bản ghi theo ID
- `getBy[Property]([value])` - Lấy bản ghi theo thuộc tính
- `add(dto)` - Thêm bản ghi mới
- `update(dto)` - Cập nhật bản ghi
- `delete(id)` - Xóa bản ghi

**Ví dụ:**
```java
VehicleDao vehicleDao = new VehicleDao();
List<VehicleDto> vehicles = vehicleDao.getAllVehicles();
VehicleDto vehicle = vehicleDao.getVehicleById(1);
vehicleDao.addVehicle(vehicle);
vehicleDao.updateVehicle(vehicle);
vehicleDao.deleteVehicle(1);
```

### 2. Model Layer (DTO - Data Transfer Object)
Mỗi entity có một DTO class chứa:
- Private fields (thuộc tính)
- Getters & Setters
- Constructors

**Ví dụ:**
```java
VehicleDto vehicle = new VehicleDto();
vehicle.setVehicleId(1);
vehicle.setUserId(4);
vehicle.setVehicleType("Xe máy");
vehicle.setLicensePlate("59F1-12345");
```

### 3. Controller Layer (Servlet)
Mỗi resource có một Controller servlet xử lý HTTP requests:
- `@WebServlet("/api/[resource]/*")` - URL mapping
- `doGet()` - Xử lý GET requests
- `doPost()` - Xử lý POST requests (CREATE)
- `doPut()` - Xử lý PUT requests (UPDATE)
- `doDelete()` - Xử lý DELETE requests

**Ví dụ endpoint:**
```
GET    /api/vehicles                  - Lấy tất cả
GET    /api/vehicles/1                - Lấy theo ID
POST   /api/vehicles                  - Tạo mới
PUT    /api/vehicles                  - Cập nhật
DELETE /api/vehicles/1                - Xóa
```

## Dependency: org.json

File `web.xml` cần cấu hình thư viện JSON:
```xml
<!-- Thêm vào WEB-INF/lib/ -->
- json-20231013.jar (hoặc version mới hơn)
```

## Response Format

Tất cả responses là JSON:

**Success Response (200/201):**
```json
{
  "success": true,
  "message": "Operation successful"
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message here"
}
```

**Data Response (200):**
```json
[
  {
    "id": 1,
    "name": "value",
    "...": "..."
  }
]
```

## Connection String

Database connection thông qua `DbUtils.getConnection()`:
```properties
Server: localhost
Database: parking_management
Port: 1433 (SQL Server default)
```

## Main Endpoints Summary

| Resource | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| Vehicles | GET | /api/vehicles | Lấy tất cả phương tiện |
| Vehicles | GET | /api/vehicles/{id} | Lấy phương tiện theo ID |
| Vehicles | POST | /api/vehicles | Thêm phương tiện mới |
| Vehicles | PUT | /api/vehicles | Cập nhật phương tiện |
| Vehicles | DELETE | /api/vehicles/{id} | Xóa phương tiện |
| Cards | GET | /api/cards | Lấy tất cả thẻ |
| Cards | POST | /api/cards | Thêm thẻ mới |
| Slots | GET | /api/parking-slots | Lấy tất cả chỗ đỗ |
| Slots | GET | /api/parking-slots/available/{type} | Lấy chỗ trống |
| Payments | GET | /api/payments | Lấy tất cả thanh toán |
| Payments | POST | /api/payments | Ghi nhận thanh toán |

## Hướng phát triển tiếp theo

1. **Authentication & Authorization**
   - Thêm JWT token validation
   - Role-based access control

2. **Services Layer**
   - Thêm business logic layer
   - Xử lý các use case phức tạp

3. **Error Handling**
   - Custom exception classes
   - Centralized error handler

4. **Validation**
   - Input validation
   - Business rule validation

5. **Testing**
   - Unit tests cho DAO/Service
   - Integration tests
   - API tests

6. **Documentation**
   - Swagger/OpenAPI integration
   - API documentation page

## Build & Deploy

1. **Build project:**
   ```bash
   ant build
   ```

2. **Deploy:**
   - Copy WAR file tới Tomcat webapps/
   - Hoặc sử dụng IDE deploy feature

3. **Test API:**
   ```bash
   curl -X GET http://localhost:8080/Parking/api/vehicles
   ```

---

**Branch:** `feature/api-backend`  
**Created:** 2025-05-22  
**Status:** Initial API structure created with full CRUD operations
