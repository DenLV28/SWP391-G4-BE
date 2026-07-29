# ParkFlow — Tài liệu Nghiệp vụ, Luồng Demo & Cơ sở dữ liệu

> Tài liệu này được viết bằng cách đọc trực tiếp mã nguồn hiện tại của dự án
> (không dựa vào các file `docs/*.md`, `README_DOCUMENTATION.md`,
> `IMPLEMENTATION_CHECKLIST.md`... trong repo — những file đó là tài liệu cũ,
> lỗi thời hoặc thuộc một đồ án khác, không còn khớp với code thực tế).

---

## 1. ParkFlow là gì?

ParkFlow là hệ thống quản lý bãi giữ xe thông minh, gồm 3 bãi cố định:
**ParkFlow Long Phước**, **ParkFlow Thủ Đức**, **ParkFlow Quận 9**
(nguồn danh sách bãi duy nhất: [src/utils/parkingLots.ts](src/utils/parkingLots.ts)).

Hệ thống phục vụ 4 vai trò (role), mỗi vai trò có một "cổng" (portal) riêng:

| Vai trò (code) | Vai trò (hiển thị) | Trang chủ mặc định |
|---|---|---|
| `user` | Parking User / Driver | Lượt gửi hiện tại (`myparking`) |
| `staff` | Parking Staff | Bảng điều khiển (`staffdashboard`) |
| `manager` | Parking Manager | Tổng quan (`managerdashboard`) |
| `admin` | System Administrator | Admin Dashboard (`admindashboard`) |

Phân quyền route được định nghĩa tập trung tại
[src/services/authService.ts](src/services/authService.ts) (`ROLE_POLICY`), và
được backend enforce lại ở một số thao tác nhạy cảm (vd. staff chỉ được
xác nhận/hủy đặt chỗ đúng bãi mình phụ trách — xem `PUT /api/reservations/:id`
trong `backend/server.js`).

### Kiến trúc

```
Frontend (React 19 + Vite + TypeScript)  ──┐
  src/App.tsx: điều phối toàn app,          │  fetch qua Vite proxy /api → :4000
  giữ state toàn cục, đồng bộ real-time     │
  qua SSE + polling 30s                     ▼
                                    Backend (Express + mssql)
                                    backend/server.js — SQL Server
                                    "parking_management"
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
            PaddleOCR service        VNPay Sandbox            ESP32 Gate
            (ocr-service/, :8868)   (thanh toán online)   (rào chắn + RFID thật)
            đọc biển số từ ảnh                              poll lệnh mở/đóng
```

- Không có JWT/session token thật — đăng nhập xong, object `User` được lưu vào
  `localStorage` (`parkflow_current_user`) và tin tưởng ở phía client.
- Đồng bộ dữ liệu real-time giữa Driver/Staff/Manager dùng **Server-Sent Events**
  (`/api/reservations/events`, `/api/slots/events`, `/api/issues/events`,
  `/api/payments/events`, `/api/notifications/events`,
  `/api/staff-manager-messages/events`, `/api/iot/rfid-events`), cộng thêm
  **polling dự phòng mỗi 30 giây** trong `App.tsx` để chống rớt SSE/ngrok.

---

## 2. Luồng nghiệp vụ theo vai trò (kèm code)

### 2.1. Driver (Parking User) — Đặt chỗ & gửi xe

**Đặt chỗ** — [src/pages/public/AvailableSlots.tsx](src/pages/public/AvailableSlots.tsx)

Ba gói dịch vụ:
| Gói | `reservationType` | Cách tính giá |
|---|---|---|
| Gửi theo lượt | `Fixed-time` | 1 mức giá cố định (`firstHourPrice`), không tính theo giờ |
| Qua đêm | `Fixed-time` | giá qua đêm (`overnightPrice`) + phụ thu mỗi đêm thêm |
| Theo tháng | `Flexible` | giá tháng (`monthlyPrice`), **bắt buộc thanh toán VNPay trước khi tạo đặt chỗ** |

Luồng: chọn bãi → chọn ô đỗ trên sơ đồ (hoặc để hệ thống tự gán) → điền biển
số/loại xe → xác nhận → tạo `Reservation` trạng thái **`Pending`**
(`onAddReservation` trong `App.tsx`, POST `/api/reservations`).

> Bãi đang **Bảo trì/Đóng cửa** (`dbo.parking_lots.status`) sẽ bị chặn đặt chỗ
> ngay ở bước này (`isLotUnavailable`, xem mục 2.4).

**Vòng đời đặt chỗ**: `Pending` → (Staff xác nhận) `Confirmed` → (xe vào, quét
RFID/nhập tay ở cổng) `Checked-in` → (xe ra, thanh toán) `Completed`, hoặc bị
hủy ở bất kỳ bước nào → `Cancelled`.

**Lượt gửi hiện tại** — [src/pages/driver/CurrentSession.tsx](src/pages/driver/CurrentSession.tsx):
theo dõi phiên gửi xe (`ParkingSession`) đang `Active`, tính phí tạm tính theo
thời gian thực (`realtimeParkingFee` trong
[src/utils/reservationPricing.ts](src/utils/reservationPricing.ts)), thanh
toán qua VNPay/Cash/QR Banking rồi mở barie (`onCheckOutSession`).

### 2.2. Staff — Vận hành cổng

**Điều khiển cổng** — [src/pages/staff/GateControl.tsx](src/pages/staff/GateControl.tsx),
là màn hình phức tạp nhất hệ thống, mô phỏng luồng IoT thật:

```
[1] Xe quẹt thẻ RFID tại cổng
      └─ POST /api/rfid-scans            (tạo bản ghi status='Scanned')
[2] Camera tự động chụp ảnh biển số       (captureAndOCR() trong GateControl.tsx)
[3] POST http://localhost:8868/ocr/plate  (PaddleOCR đọc biển số; nếu service
                                            không chạy, fallback sang Gemini API)
[4] PATCH /api/rfid-scans/:id             (lưu ảnh + biển số + hash,
                                            đối chiếu dbo.vehicles.rfid_uid
                                            → status 'Captured'/'Linked')
[5] Staff xem hàng đợi, bấm XÁC NHẬN (GRANTED/OVERRIDE) hoặc TỪ CHỐI (Rejected)
      └─ handleConfirmScan / handleDenyScan trong StaffDashboard.tsx
      └─ Xác nhận → sendCommand(gateId,'open') → ESP32 poll thấy lệnh → mở rào
```

Ngoài quét thẻ, Staff còn xử lý: xác nhận/hủy đặt chỗ, nhập biển số thủ công
(khách vãng lai không có thẻ), quét QR vé tháng, theo dõi bãi xe
(`parkingmonitor`), báo cáo/xem "Sự cố Ô đỗ" (`emergency` — thực ra là trang
quản lý sự cố ô đỗ, không phải khẩn cấp cháy nổ).

**Ràng buộc theo bãi**: mỗi Staff chỉ gán được **1 bãi** (`users.assigned_parking_lot`),
chỉ thấy/thao tác dữ liệu của đúng bãi đó
([src/pages/staff/StaffDashboard.tsx](src/pages/staff/StaffDashboard.tsx),
biến `staffLotKey`). Nếu bãi đang **Bảo trì**, toàn bộ thao tác vận hành
(quét thẻ, mở cổng, xác nhận/hủy đặt chỗ, đổi trạng thái ô đỗ, trả xe) bị khóa
ở một điểm duy nhất: hàm `guardMaintenance()`.

### 2.3. Manager — Vận hành & cấu hình

- **Tổng quan** ([ManagerDashboard.tsx](src/pages/manager/ManagerDashboard.tsx)):
  doanh thu, phiên hoạt động, sơ đồ bãi đỗ — gộp dữ liệu cả 3 bãi.
- **Quản lý Bãi xe** ([ManagerParkingLots.tsx](src/pages/manager/ManagerParkingLots.tsx)):
  đổi trạng thái Hoạt động/Bảo trì từng bãi, gán nhân viên phụ trách (1
  bãi ↔ 1 nhân viên — gán người mới tự động gỡ người cũ khỏi bãi đó).
- **Bảng giá & Loại xe** ([ManagerPricingVehicles.tsx](src/pages/manager/ManagerPricingVehicles.tsx)):
  chỉnh giá theo lượt/qua đêm/tháng + phụ phí cho từng loại xe
  (`dbo.pricing_rules` — nguồn giá dùng chung cho User đặt chỗ và Staff thu phí).
- **Xử lý Ngoại lệ**: duyệt/từ chối `SlotIssue` do Staff báo cáo (ô đỗ hỏng,
  cần bảo trì) — Duyệt → ô chuyển `Maintenance`; Từ chối → ô trở lại bình thường.
- **Báo cáo, Xe Thẻ tháng, Phản hồi Người dùng**: xem thống kê, danh sách vé
  tháng đang hiệu lực, phản hồi/khiếu nại từ Driver.

### 2.4. Tính năng "Bảo trì bãi đỗ" (xuyên suốt 3 vai trò)

Trạng thái bãi (`Hoạt động` / `Bảo trì` / `Đóng cửa`) lưu ở `dbo.parking_lots`,
là nguồn chân lý duy nhất, poll mỗi 30s vào state toàn cục `lotStatuses` trong
`App.tsx`:
- **Manager** đổi trạng thái → lưu qua `PUT /api/parking-lots/:name`.
- **Driver**: bãi Bảo trì bị disable trong dropdown chọn bãi khi đặt chỗ, chặn
  hẳn việc tạo đặt chỗ mới.
- **Staff**: hiện banner "Bãi đang tạm ngưng để bảo trì", khóa toàn bộ thao
  tác vận hành, chỉ được xem.

### 2.5. Admin

Quản lý người dùng toàn hệ thống (tạo/sửa/khóa tài khoản, đổi vai trò), quản
lý mô tả/quyền hạn của 4 vai trò (`dbo.role_definitions`), cấu hình hệ thống.

---

## 3. Luồng chạy Demo

### 3.1. Khởi động

```powershell
# 1) Backend — cần SQL Server chạy sẵn (server: localhost, user: sa / 12345)
cd backend
node server.js
# → "Server running on http://0.0.0.0:4000"
# Lần đầu chạy: tự tạo database "parking_management" + toàn bộ bảng + seed dữ liệu mẫu.

# 2) Frontend
npm run dev
# → http://localhost:5173  (Vite proxy /api → http://127.0.0.1:4000)

# 3) (Tùy chọn) OCR service — đọc biển số cho Gate Control
cd ocr-service
powershell -File start.ps1
# → http://localhost:8868  (không chạy thì FE tự fallback sang Gemini API)
```

### 3.2. Tài khoản demo

> ⚠️ **Phát hiện khi kiểm tra**: `src/services/authService.ts` (`DEMO_ACCOUNTS`)
> ghi mật khẩu là `driver123`/`manager123`/`admin123`/`staff123`, nhưng backend
> thực tế seed các tài khoản này với mật khẩu **`123456`**
> (`ensureDemoAccounts()` trong `backend/server.js`) — đã xác minh trực tiếp
> qua `POST /api/auth/login`. Mật khẩu **đúng để demo là `123456`**, danh sách
> trong `authService.ts` bị sai/lỗi thời và nên sửa lại.

| Email | Mật khẩu (thật) | Vai trò |
|---|---|---|
| admin@parking.vn | 123456 | System Administrator |
| manager@parking.vn | 123456 | Parking Manager |
| staff@parking.vn | 123456 | Parking Staff (mặc định chưa gán bãi — Manager cần gán trước khi demo) |
| driver@parking.vn | 123456 | Parking User / Driver |

### 3.3. Kịch bản demo đề xuất (đủ vòng đời một lượt gửi xe)

1. **Manager** đăng nhập → *Quản lý Bãi xe* → gán `staff@parking.vn` phụ
   trách 1 bãi (vd. ParkFlow Long Phước) → đảm bảo bãi đó **Hoạt động**.
2. **Driver** đăng nhập → *Đặt chỗ* → chọn đúng bãi vừa gán → chọn ô đỗ, loại
   xe, gói "Gửi theo lượt" → xác nhận → đơn ở trạng thái **Pending**.
3. **Staff** đăng nhập → *Bảng điều khiển* → mục "Yêu cầu Đặt chỗ trước" →
   bấm **XÁC NHẬN** → đơn chuyển **Confirmed**.
4. Vẫn ở Staff → *Điều khiển cổng* → nhập biển số thủ công (hoặc quẹt RFID
   nếu xe đã có thẻ liên kết) → xe được ghi nhận vào bãi, sinh
   `ParkingSession` mới, đơn chuyển **Checked-in**, ô đỗ chuyển `Occupied`.
5. **Driver** vào *Lượt gửi hiện tại* → thấy phí tạm tính tăng theo thời gian
   thực → bấm thanh toán (Cash/QR/VNPay) → mở barie → phiên **Completed**.
6. Quay lại **Manager** → *Báo cáo*/*Tổng quan* → thấy doanh thu, số phiên đã
   cập nhật ngay (SSE, không cần F5).

### 3.4. Kịch bản phụ (đáng demo thêm)

- **Bảo trì bãi**: Manager chuyển 1 bãi sang Bảo trì → mở tab Driver đang ở
  màn đặt chỗ → thấy banner chặn ngay không cần F5 (đồng bộ 30s hoặc do vừa
  vào lại trang) → mở tab Staff của bãi đó → thấy banner khóa thao tác.
- **Sự cố ô đỗ**: Staff báo cáo ô hỏng (*Sự cố Ô đỗ*) → Manager duyệt (*Xử lý
  Ngoại lệ*) → ô chuyển `Maintenance`, biến mất khỏi danh sách ô trống khi
  Driver đặt chỗ.
- **Vé tháng**: Driver đặt gói "Theo tháng" → bắt buộc thanh toán VNPay ngay →
  Manager xem trong *Xe Thẻ tháng*.

---

## 4. Cơ sở dữ liệu (SQL Server — `parking_management`)

> **Lưu ý quan trọng**: toàn bộ schema được tạo bằng code
> (`createTables()` trong `backend/server.js`), **không dùng ràng buộc
> `FOREIGN KEY` thật ở tầng SQL** cho bất kỳ bảng nào. Mọi quan hệ giữa các
> bảng là **khóa phụ logic** (id/code được lưu dưới dạng chuỗi/số nhưng không
> có constraint DB enforce) — ứng dụng tự đảm bảo tính toàn vẹn ở tầng code.
> Cột user_id trong hầu hết các bảng là `NVARCHAR` (không phải `INT`) để vừa
> nhận id thật từ DB vừa nhận id giả từ dữ liệu mock cũ.

### 4.1. Danh sách bảng

| # | Bảng | Khóa chính (PK) | Khóa duy nhất (UNIQUE) | Khóa phụ logic (tham chiếu tới) |
|---|---|---|---|---|
| 1 | `dbo.users` | `user_id` (INT, IDENTITY) | `email`, `phone` | — |
| 2 | `dbo.vehicles` | `vehicle_id` (INT, IDENTITY) | `rfid_uid` (lọc `NOT NULL`) | `user_id` → `users.user_id` |
| 3 | `dbo.reservations` | `reservation_id` (INT, IDENTITY) | `reservation_code` | `user_id` → `users.user_id`; `slot_code` → `parking_slots.slot_code`; `parking_lot` → `parking_lots.name` |
| 4 | `dbo.parking_sessions` | `session_id` (INT, IDENTITY) | `ticket_code` | `user_id` → `users.user_id`; `slot_code` → `parking_slots.slot_code` |
| 5 | `dbo.payments` | `payment_id` (INT, IDENTITY) | `payment_code` | `user_id` → `users.user_id`; `ticket_code` → `parking_sessions.ticket_code`; `reservation_code` → `reservations.reservation_code` |
| 6 | `dbo.parking_slots` | `slot_id` (INT, IDENTITY) | `slot_code` | `parking_lot` → `parking_lots.name` |
| 7 | `dbo.slot_issues` | `issue_id` (INT, IDENTITY) | — | `slot_code` → `parking_slots.slot_code` |
| 8 | `dbo.force_clear_logs` | `log_id` (INT, IDENTITY) | — | `slot_code` → `parking_slots.slot_code`; `session_id` → `parking_sessions.session_id`; `performed_by_id` → `users.user_id` |
| 9 | `dbo.rfid_scans` | `scan_id` (INT, IDENTITY) | — | `rfid_uid`/`vehicle_id` → `vehicles.rfid_uid`/`vehicle_id`; `scanned_by_id` → `users.user_id` |
| 10 | `dbo.pricing_rules` | `rule_id` (INT, IDENTITY) | `vehicle_type` | — |
| 11 | `dbo.parking_lots` | `lot_id` (INT, IDENTITY) | `name` | — |
| 12 | `dbo.feedbacks` | `feedback_id` (INT, IDENTITY) | `feedback_code` | `user_id` → `users.user_id`; `ticket_code` → `parking_sessions.ticket_code` |
| 13 | `dbo.staff_manager_messages` | `message_id` (INT, IDENTITY) | — | `sender_id` → `users.user_id` |
| 14 | `dbo.notifications` | `notification_id` (INT, IDENTITY) | — | `user_id` → `users.user_id` |
| 15 | `dbo.role_definitions` | `role_key` (NVARCHAR, không tự tăng) | — | — (chỉ có đúng 4 giá trị cố định: `user`/`staff`/`manager`/`admin`) |

### 4.2. Chi tiết từng bảng

#### `dbo.users` — Tài khoản
```
user_id (PK, IDENTITY)   full_name          email (UNIQUE)     phone (UNIQUE)
password_hash (bcrypt)   role               status             is_active
assigned_parking_lot     created_at         password_updated_at
```
`role` là chuỗi tự do (`user`/`staff`/`manager`/`admin`), không FK tới
`role_definitions.role_key` nhưng phải khớp giá trị để phân quyền hoạt động.

#### `dbo.vehicles` — Xe đã đăng ký
```
vehicle_id (PK)   user_id      license_plate   vehicle_type
brand             model        is_default      rfid_uid (UNIQUE, nullable)
created_at
```
`rfid_uid` là mã thẻ RFID được **liên kết** (khác với việc *quét* thẻ, lưu ở
`rfid_scans`) — 1 xe có thể chưa gắn thẻ nào (`NULL`).

#### `dbo.reservations` — Đặt chỗ
```
reservation_id (PK)   reservation_code (UNIQUE)   user_id
reservation_type ('Flexible'|'Fixed-time')        slot_assignment_mode
vehicle_type          license_plate    date    start_time    end_time
floor    area    slot_code    status ('Pending'/'Confirmed'/'Checked-in'/
                                       'Completed'/'Cancelled')
note    estimated_cost    parking_lot
created_at / db_created_at / confirmed_at / checked_in_at / completed_at /
cancelled_at   (mốc thời gian THẬT của từng lần đổi trạng thái)
overstay_notified
```

#### `dbo.parking_sessions` — Phiên gửi xe thực tế (sau khi xe đã vào bãi)
```
session_id (PK)   user_id   ticket_code (UNIQUE)   license_plate   vehicle_type
check_in_time     check_out_time     expected_end_time     entry_gate
floor / area / slot_code     estimated_fee
payment_status ('Unpaid'/'Paid'/'Failed')     payment_method
session_status ('Active'/'Completed'/'Cancelled')     barrier_status ('Closed'/'Opened')
db_created_at
```

#### `dbo.payments` — Giao dịch thanh toán
```
payment_id (PK)   payment_code (UNIQUE)   user_id   ticket_code   reservation_code
parking_fee   extra_service_fee   lost_ticket_fee   overtime_fee   discount
total_amount   method   status ('Unpaid'/'Paid'/'Failed')
created_at / paid_at / db_created_at
```
(cột `overtime_fee` vẫn còn trong DB nhưng không còn app nào tính/ghi giá trị
khác 0 — tính năng phí quá giờ đã bị gỡ khỏi frontend, xem mục 5.)

#### `dbo.parking_slots` — Kho ô đỗ (3 bãi dùng chung 1 bảng, phân biệt qua `parking_lot`)
```
slot_id (PK)   slot_code (UNIQUE, vd. "LP-F1-A01")   floor   zone
vehicle_type (nhãn tiếng Việt, vd. "Xe máy / Xe máy điện")
status ('Available'/'Occupied'/'Reserved'/'Maintenance'/...)
notes   parking_lot (tên bãi, khớp `parking_lots.name`)
```

#### `dbo.slot_issues` — Sự cố ô đỗ (Staff báo cáo → Manager duyệt)
```
issue_id (PK)   slot_code   issue_type   description   image_url
reported_by     reported_at
status ('Pending'/'Approved'/'Rejected'/'Resolved')  -- có CHECK constraint
```

#### `dbo.force_clear_logs` — Nhật ký "buộc giải phóng ô đỗ"
```
log_id (PK)   slot_code   session_id (nullable)   ticket_code   license_plate
performed_by_id / performed_by_name / performed_by_role   reason   created_at
```

#### `dbo.rfid_scans` — Nhật ký từng lần quẹt thẻ tại cổng (độc lập với việc thẻ đã *liên kết* xe hay chưa)
```
scan_id (PK)   rfid_uid   gate_id   direction ('entry'/'exit')
status ('Scanned'/'Captured'/'Linked'/'Rejected')
image_data   license_plate   license_plate_hash   vehicle_id (nullable)
scanned_by_id / scanned_by_name   created_at / updated_at
```

#### `dbo.pricing_rules` — Bảng giá theo loại xe (Manager chỉnh, User/Staff cùng đọc)
```
rule_id (PK)   vehicle_type (UNIQUE)   vehicle_key   icon   description
hourly_price ("giá theo lượt")   overnight_price   monthly_price
status ('active'/'inactive')   updated_at
-- cột lịch sử còn giữ trong DB nhưng không còn dùng: next_hour_price, overtime_rate_30min
lost_ticket_fee   extra_service_fee   note
```

#### `dbo.parking_lots` — Trạng thái vận hành của 3 bãi
```
lot_id (PK)   name (UNIQUE)   status ('Hoạt động'/'Bảo trì'/'Đóng cửa')
updated_at
```

#### `dbo.feedbacks` — Phản hồi/khiếu nại của Driver
```
feedback_id (PK)   feedback_code (UNIQUE)   user_id   type   ticket_code
description   priority ('Low'/...)   status ('New'/...)   attachment_url
staff_response   staff_responded_at   created_at / db_created_at
```

#### `dbo.staff_manager_messages` — Kênh chat chung Staff ↔ Manager
```
message_id (PK)   sender_id   sender_name   sender_role   message
created_at / db_created_at
```

#### `dbo.notifications` — Chuông thông báo theo user
```
notification_id (PK)   user_id   type   title   body   target_view
is_read   created_at / db_created_at
```

#### `dbo.role_definitions` — Mô tả & quyền hạn hiển thị cho 4 vai trò (Admin chỉnh)
```
role_key (PK, NVARCHAR — 'user'/'staff'/'manager'/'admin')
description   permissions (JSON string dạng mảng)   updated_at   updated_by
```

---

## 5. Ghi chú kỹ thuật đáng lưu ý

- **Không có FK constraint thật**: toàn bộ liên kết giữa bảng là quy ước ở
  code, không được SQL Server enforce. Xóa một `user` không tự động dọn
  `vehicles`/`reservations` liên quan — cần cẩn thận khi thao tác dữ liệu thủ công.
- **Mật khẩu demo trong `authService.ts` sai** so với backend thực tế (xem
  mục 3.2) — nên đồng bộ lại một trong hai phía.
- **`next_hour_price`, `overtime_rate_30min` (bảng `pricing_rules`)** và
  **`overtime_fee` (bảng `payments`)**: cột vẫn còn trong DB (không xóa để
  tránh rủi ro migration) nhưng không còn tính năng frontend nào đọc/ghi giá
  trị khác 0 — hệ thống hiện tính giá **cố định theo lượt**, không còn tính
  theo giờ tiếp theo hay phụ phí quá giờ.
- **`role` (bảng `users`) và `role_key` (bảng `role_definitions`)** không có
  FK nhưng phải khớp nhau theo quy ước cố định trong code
  (`normalizeRoleForStorage` ở `backend/server.js`).
