import { useEffect, useState } from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import { buildApiUrl } from '../../services/apiConfig';

interface VehiclePrice {
  id: string;
  name: string;
  vehicleKey: string;
  icon: string;
  description: string;
  prices: { hourly: number; overnight: number; monthly: number };
  lostTicketFee: number;
  extraServiceFee: number;
  note: string;
  status: 'active' | 'inactive';
}

/** Giá tối thiểu cho mọi mức giá/phụ phí — chặn nhập nhầm 0 hay vài trăm đồng. */
const MIN_PRICE = 1000;

// Backend returns the nested { prices: {...} } shape (see toPricingRuleDto in
// server.js) — this used to be misread as flat dto.hourlyPrice, which was always
// undefined and silently fell back to 0 for every row.
function dtoToVehiclePrice(dto: Record<string, any>): VehiclePrice {
  return {
    id: String(dto.id),
    name: dto.vehicleType ?? '',
    vehicleKey: dto.vehicleKey ?? '',
    icon: dto.icon ?? '🚗',
    description: dto.description ?? '',
    prices: {
      hourly: dto.prices?.hourly ?? 0,
      overnight: dto.prices?.overnight ?? 0,
      monthly: dto.prices?.monthly ?? 0,
    },
    lostTicketFee: dto.lostTicketFee ?? 0,
    extraServiceFee: dto.extraServiceFee ?? 0,
    note: dto.note ?? '',
    status: dto.status ?? 'active',
  };
}

// Sent as the request body directly (server.js reads req.body.prices.hourly etc,
// camelCase) — no snake_case conversion needed here.
function vehiclePriceToBody(v: VehiclePrice) {
  return {
    vehicleType: v.name,
    vehicleKey: v.vehicleKey,
    icon: v.icon,
    description: v.description,
    prices: {
      hourly: v.prices.hourly,
      overnight: v.prices.overnight,
      monthly: v.prices.monthly,
    },
    lostTicketFee: v.lostTicketFee,
    extraServiceFee: v.extraServiceFee,
    note: v.note,
    status: v.status,
  };
}

function fmtVND(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

const PAGE_SIZE = 4;

export default function ManagerPricingVehicles({
  setView: _setView,
}: {
  setView: (view: string) => void;
}) {
  const [vehicles, setVehicles] = useState<VehiclePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<VehiclePrice | null>(null);
  const [formError, setFormError] = useState('');
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

  const openEdit = (v: VehiclePrice) => { setFormData({ ...v }); setFormError(''); setShowModal(true); };

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
    const priceValues = [
      formData.prices.hourly,
      formData.prices.overnight,
      formData.prices.monthly,
      formData.lostTicketFee,
      formData.extraServiceFee,
    ];
    if (priceValues.some((v) => v <= MIN_PRICE)) {
      setFormError(`Mọi mức giá/phụ phí phải lớn hơn ${MIN_PRICE.toLocaleString('vi-VN')}đ.`);
      return;
    }
    setFormError('');
    try {
      const res = await fetch(buildApiUrl(`/api/pricing-rules/${formData.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify(vehiclePriceToBody(formData)),
      });
      const data = await res.json();
      const updated = dtoToVehiclePrice(data);
      setVehicles((vs) => vs.map((v) => v.id === updated.id ? updated : v));
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
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Danh sách loại xe &amp; Đơn giá</h3>
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

      {/* Add / Edit Modal */}
      {showModal && formData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Chỉnh sửa loại xe</h2>
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

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Bảng giá</p>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { label: 'Giá theo lượt (VNĐ)',      key: 'hourly' },
                      { label: 'Giá qua đêm (VNĐ)',        key: 'overnight' },
                      { label: 'Giá theo tháng (VNĐ)',      key: 'monthly' },
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
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Phụ phí</p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { label: 'Phí mất thẻ (VNĐ)', key: 'lostTicketFee' },
                      { label: 'Phí dịch vụ (VNĐ)', key: 'extraServiceFee' },
                    ] as const
                  ).map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                      <input
                        type="number"
                        value={formData[f.key]}
                        onChange={(e) => setFormData({ ...formData, [f.key]: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="VD: Giới hạn tối đa 180.000đ/ngày."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

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

            {formError && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                {formError}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setFormData(null); setFormError(''); }}
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
