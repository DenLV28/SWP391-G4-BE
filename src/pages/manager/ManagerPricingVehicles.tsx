import { useEffect, useState } from 'react';
import {
  Edit2, Trash2, Plus, X, Car,
  TrendingUp, Clock, Filter, Download, MoreVertical,
} from 'lucide-react';
import { buildApiUrl } from '../../services/apiConfig';

interface VehiclePrice {
  id: string;
  name: string;
  vehicleKey: string;
  icon: string;
  description: string;
  prices: { hourly: number; overnight: number; monthly: number };
  status: 'active' | 'inactive';
}

function dtoToVehiclePrice(dto: Record<string, any>): VehiclePrice {
  return {
    id: String(dto.id),
    name: dto.vehicleType ?? '',
    vehicleKey: dto.vehicleKey ?? '',
    icon: dto.icon ?? '🚗',
    description: dto.description ?? '',
    prices: {
      hourly: dto.hourlyPrice ?? 0,
      overnight: dto.overnightPrice ?? 0,
      monthly: dto.monthlyPrice ?? 0,
    },
    status: dto.status ?? 'active',
  };
}

function vehiclePriceToBody(v: VehiclePrice) {
  return {
    vehicle_type: v.name,
    vehicle_key: v.vehicleKey,
    icon: v.icon,
    description: v.description,
    hourly_price: v.prices.hourly,
    overnight_price: v.prices.overnight,
    monthly_price: v.prices.monthly,
    status: v.status,
  };
}

function fmtVND(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

const PAGE_SIZE = 4;

export default function ManagerPricingVehicles({ setView: _setView }: { setView: (view: string) => void }) {
  const [vehicles, setVehicles] = useState<VehiclePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<VehiclePrice | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(vehicles.length / PAGE_SIZE);
  const paged = vehicles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    fetch(buildApiUrl('/api/pricing-rules'), {
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
      .then((r) => r.json())
      .then((data: any[]) => setVehicles(data.map(dtoToVehiclePrice)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (v: VehiclePrice) => { setFormData({ ...v }); setShowModal(true); };
  const openAdd = () => {
    setFormData({ id: '', name: '', vehicleKey: '', icon: '🚗', description: '', prices: { hourly: 0, overnight: 0, monthly: 0 }, status: 'active' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(buildApiUrl(`/api/pricing-rules/${id}`), {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      setVehicles((vs) => vs.filter((v) => v.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    const newStatus = v.status === 'active' ? 'inactive' : 'active';
    try {
      await fetch(buildApiUrl(`/api/pricing-rules/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ ...vehiclePriceToBody(v), status: newStatus }),
      });
      setVehicles((vs) => vs.map((x) => x.id === id ? { ...x, status: newStatus } : x));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!formData?.name) return;
    const isEdit = vehicles.some((v) => v.id === formData.id);
    try {
      if (isEdit) {
        const res = await fetch(buildApiUrl(`/api/pricing-rules/${formData.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify(vehiclePriceToBody(formData)),
        });
        const data = await res.json();
        const updated = dtoToVehiclePrice(data.rule);
        setVehicles((vs) => vs.map((v) => v.id === updated.id ? updated : v));
      } else {
        const res = await fetch(buildApiUrl('/api/pricing-rules'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify(vehiclePriceToBody(formData)),
        });
        const data = await res.json();
        setVehicles((vs) => [...vs, dtoToVehiclePrice(data.rule)]);
      }
    } catch (err) {
      console.error(err);
    }
    setShowModal(false);
    setFormData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Bảng giá &amp; Loại xe</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Thêm loại xe mới
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Car className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Tổng số loại xe</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {String(vehicles.length).padStart(2, '0')} Nhóm
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Cập nhật lần cuối</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">14:20, Hôm nay</p>
          </div>
        </div>

        <div className="rounded-2xl bg-blue-600 p-5 shadow-lg flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-blue-100">Doanh thu dự kiến (Tháng)</p>
            <p className="text-2xl font-bold text-white mt-0.5">1.250.000.000đ</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Danh sách loại xe &amp; Đơn giá</h3>
          <div className="flex items-center gap-1">
            <button className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition">
              <Filter className="h-4 w-4" />
            </button>
            <button className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Đang tải dữ liệu...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">Loại xe</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-600">Bảng giá theo lượt</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-600">Bảng giá qua đêm</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-600">Bảng giá tháng</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-lg shrink-0">
                          {v.icon}
                        </div>
                        <span className="font-medium text-slate-800">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{fmtVND(v.prices.hourly)}</td>
                    <td className="px-6 py-4 text-slate-700">{fmtVND(v.prices.overnight)}</td>
                    <td className="px-6 py-4 text-slate-700">{fmtVND(v.prices.monthly)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(v.id)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          v.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {v.status === 'active' ? 'Đang áp dụng' : 'Tạm dừng'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Hiển thị {(page - 1) * PAGE_SIZE + 1} -{' '}
              {Math.min(page * PAGE_SIZE, vehicles.length)} trong {vehicles.length} loại xe
            </p>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Tiếp
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI promo card */}
        <div className="lg:col-span-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-7 relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-lg font-bold text-blue-700 mb-2">
              Tự động điều chỉnh giá theo giờ cao điểm?
            </h4>
            <p className="text-sm text-slate-600 max-w-lg mb-5">
              Hệ thống ParkFlow AI có thể hỗ trợ bạn tự động tăng/giảm giá vé lượt dựa trên mật độ
              xe thực tế trong bãi để tối ưu hóa doanh thu.
            </p>
            <button className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
              Tìm hiểu thêm
            </button>
          </div>
          <TrendingUp className="absolute -right-8 -bottom-8 h-44 w-44 text-blue-200 opacity-30 pointer-events-none" />
        </div>

        {/* Tip card */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-900 p-7 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">
              Mẹo quản lý
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Đảm bảo bạn đã in bảng giá mới và niêm yết tại cổng ra vào sau khi thay đổi trên hệ
              thống.
            </p>
          </div>
          <button className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition">
            <Download className="h-4 w-4" />
            Tải file niêm yết mẫu (PDF)
          </button>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && formData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                {vehicles.find((v) => v.id === formData.id) ? 'Chỉnh sửa loại xe' : 'Thêm loại xe mới'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setFormData(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {(
                [
                  { label: 'Tên loại xe',             key: 'name',        placeholder: 'VD: Xe máy / Xe máy điện' },
                  { label: 'Khóa loại xe (vehicle_key)', key: 'vehicleKey', placeholder: 'VD: motorbike' },
                  { label: 'Icon (emoji)',              key: 'icon',        placeholder: 'VD: 🏍️' },
                  { label: 'Mô tả',                    key: 'description', placeholder: 'VD: Xe máy 50-200cc' },
                ] as const
              ).map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={(formData as Record<string, any>)[f.key]}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              ))}

              {(
                [
                  { label: 'Giá theo lượt (VNĐ)', key: 'hourly' },
                  { label: 'Giá qua đêm (VNĐ)',   key: 'overnight' },
                  { label: 'Giá theo tháng (VNĐ)', key: 'monthly' },
                ] as const
              ).map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input
                    type="number"
                    value={(formData.prices as Record<string, number>)[f.key]}
                    onChange={(e) =>
                      setFormData({ ...formData, prices: { ...formData.prices, [f.key]: Number(e.target.value) } })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Tạm dừng</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setFormData(null); }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
