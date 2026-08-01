import baiXeQuan9Img from '../assets/images/bai-xe-quan-9.jpg';
import baiXeThuDucImg from '../assets/images/bai-xe-thu-duc.jpg';
import baiXeLongPhuocImg from '../assets/images/bai-xe-long-phuoc.jpg';
// Nhà Văn Hóa chưa có ảnh chụp thật — dùng ảnh chi nhánh ParkFlow chung làm placeholder.
import baiXeNhaVanHoaImg from '../assets/images/xe-trong.jpg';

/**
 * 4 bãi gốc có ảnh chụp thật đóng gói sẵn trong bundle; DB chỉ lưu `imageKey`
 * trỏ tới đây thay vì nhồi vài trăm KB base64 vào cột image_data. Bãi Admin tạo
 * mới thì ngược lại — ảnh upload nằm ở `imageData`.
 */
const BUNDLED_LOT_IMAGES: Record<string, string> = {
  quan9:     baiXeQuan9Img,
  thuduc:    baiXeThuDucImg,
  longphuoc: baiXeLongPhuocImg,
  nhavanhoa: baiXeNhaVanHoaImg,
};

/** Ảnh hiển thị của một bãi; '' nếu bãi chưa có ảnh nào. */
export function lotImageOf(lot?: { imageData?: string; imageKey?: string } | null): string {
  if (!lot) return '';
  if (lot.imageData) return lot.imageData;
  return BUNDLED_LOT_IMAGES[lot.imageKey ?? ''] ?? '';
}
