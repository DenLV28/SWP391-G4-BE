# Luồng đặt chỗ: Driver → Staff

Khi **driver đặt xe** ở phần "Đặt chỗ", thông tin sẽ hiển thị ngay bên **Staff**
ở mục **"Yêu cầu Đặt chỗ trước"** (Dashboard của Staff Portal).

## Cách hoạt động

1. Driver tạo đặt chỗ → reservation mới có trạng thái **`Pending`** (chờ xác nhận).
2. Reservation được lưu vào `localStorage` (`src/services/reservationStore.ts`)
   nên **không mất khi reload**, và **đồng bộ giữa các tab** + giữa các lần đăng
   nhập (driver → đăng xuất → đăng nhập staff).
3. Bên Staff, mục "Yêu cầu Đặt chỗ trước" hiển thị biển số, giờ đến dự kiến,
   loại xe, trạng thái. Các yêu cầu `Pending` được đẩy lên đầu, kèm nút **XÁC NHẬN**.
4. Staff bấm **XÁC NHẬN** → reservation chuyển sang **`Confirmed`** → driver thấy
   trạng thái cập nhật và mới được phép check-in vào bãi.

## Thử nhanh

- Cách 1 (1 tab): đăng nhập `driver@parking.vn / driver123` → đặt chỗ → đăng xuất
  → đăng nhập `staff@parking.vn / staff123` → xem Dashboard.
- Cách 2 (2 tab, đồng bộ trực tiếp): mở 2 tab, 1 tab driver đặt chỗ, tab staff
  sẽ thấy yêu cầu hiện ra mà không cần F5.

## File liên quan

```
src/services/reservationStore.ts   # lưu + đồng bộ reservations (localStorage)
src/App.tsx                         # tạo booking = Pending; lưu/đồng bộ; xác nhận
src/pages/staff/StaffOverview.tsx   # hiển thị "Yêu cầu Đặt chỗ trước"
src/pages/staff/StaffDashboard.tsx  # nối nút Xác nhận → cập nhật trạng thái thật
```

> Đây là đồng bộ phía **frontend** (localStorage). Khi backend có bảng/endpoint
> reservation (hiện `backend/server.js` mới có users + auth), chỉ cần đổi
> `loadReservations/saveReservations` thành gọi API là dữ liệu dùng chung thật
> sự giữa nhiều máy.
