import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

// Trang "Sự cố Ô đỗ" độc lập đã được gộp vào "Xử lý Ngoại lệ" (ManagerExceptions
// — xem modal Chi tiết ở đó cho luồng duyệt/từ chối/khôi phục). 2 bảng nhãn
// dưới đây vẫn được giữ lại và export vì ManagerExceptions dùng chung, tránh
// lặp lại 2 bảng nhãn tiếng Việt ở 2 nơi.
export const ISSUE_TYPE_LABELS: Record<string, string> = {
  'Charging Station Failure':   'Lỗi trạm sạc',
  'Parking Sensor Failure':     'Lỗi cảm biến ô đỗ',
  'Parking Slot Damaged':       'Ô đỗ bị hỏng',
  'Vehicle Parked Incorrectly': 'Xe đỗ sai vị trí',
  'Other':                      'Khác',
  // backward compat
  'Charging Failure': 'Lỗi sạc',
  'Sensor Failure':   'Lỗi cảm biến',
  'Occupied Error':   'Lỗi trạng thái ô',
};

export const STATUS_CONFIG = {
  Pending:  { label: 'Chờ duyệt',     bg: 'bg-amber-50',   text: 'text-amber-700',   icon: Clock },
  Approved: { label: 'Đang bảo trì',  bg: 'bg-red-50',     text: 'text-red-700',     icon: AlertTriangle },
  Rejected: { label: 'Đã từ chối',    bg: 'bg-slate-100',  text: 'text-slate-500',   icon: XCircle },
  Resolved: { label: 'Đã hoàn thành', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle },
};
