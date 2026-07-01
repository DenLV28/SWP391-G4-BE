import React from 'react';

export default function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Available: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Occupied: 'bg-rose-100 text-rose-800 border-rose-300',
    Reserved: 'bg-amber-100 text-amber-800 border-amber-300',
    Maintenance: 'bg-slate-100 text-slate-700 border-slate-300',
    Locked: 'bg-red-100 text-red-950 border-red-300',
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Inactive: 'bg-slate-50 text-slate-500 border-slate-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
    New: 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Unpaid: 'bg-rose-50 text-rose-700 border-rose-200',
    Failed: 'bg-rose-50 text-rose-800 border-rose-300',
    Low: 'bg-slate-50 text-slate-600 border-slate-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    High: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const labelMap: Record<string, string> = {
    Available: 'Trống',
    Occupied: 'Đã chiếm',
    Reserved: 'Đã giữ chỗ',
    Maintenance: 'Bảo trì',
    Locked: 'Đã khóa',
    Active: 'Hoạt động',
    Inactive: 'Không hoạt động',
    Pending: 'Đang chờ',
    Confirmed: 'Đã xác nhận',
    Completed: 'Hoàn tất',
    Cancelled: 'Đã hủy',
    New: 'Mới',
    'In Progress': 'Đang xử lý',
    Resolved: 'Đã xử lý',
    Paid: 'Đã thanh toán',
    Unpaid: 'Chưa thanh toán',
    Failed: 'Thất bại',
    Low: 'Thấp',
    Medium: 'Trung bình',
    High: 'Cao',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${colorMap[status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      {labelMap[status] || status}
    </span>
  );
}
