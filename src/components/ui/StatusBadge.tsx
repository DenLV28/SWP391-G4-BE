/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface StatusBadgeProps {
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-green-100 text-green-700',
  Occupied: 'bg-red-100 text-red-700',
  Reserved: 'bg-amber-100 text-amber-700',
  Maintenance: 'bg-slate-200 text-slate-700',
  Paid: 'bg-green-100 text-green-700',
  Unpaid: 'bg-red-100 text-red-700',
  Active: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-slate-200 text-slate-700',
  Pending: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-green-100 text-green-700',
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-violet-100 text-violet-700',
  Resolved: 'bg-green-100 text-green-700',
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  Available: 'Trống',
  Occupied: 'Đã chiếm',
  Reserved: 'Đã giữ chỗ',
  Maintenance: 'Bảo trì',
  Paid: 'Đã thanh toán',
  Unpaid: 'Chưa thanh toán',
  Active: 'Hoạt động',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy',
  Pending: 'Đang chờ',
  Confirmed: 'Đã xác nhận',
  New: 'Mới',
  'In Progress': 'Đang xử lý',
  Resolved: 'Đã xử lý',
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
