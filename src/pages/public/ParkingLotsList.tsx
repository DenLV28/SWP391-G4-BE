import React, { useState } from 'react';
import {
  Search, MapPin, Camera, Shield, Zap, Home, ChevronDown, ChevronUp,
  Map, Phone, Filter, LayoutGrid, Car, ArrowRight,
} from 'lucide-react';
import anNinhImg from '../../assets/images/an-ninh.jpg';
import xeTrongImg from '../../assets/images/xe-trong.jpg';
import xeImg from '../../assets/images/xe.jpg';
import parkflowBg from '../../assets/images/parkflow_bg_1779336618673.png';

interface Lot {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
  image: string;
  badge: string;
  badgeColor: string;
  features: { icon: React.ReactNode; label: string }[];
  priceFrom: string;
  floors: { name: string; items: string[] }[];
}

const lots: Lot[] = [
  {
    id: '1',
    name: 'Bãi đỗ xe ParkFlow Quận 9',
    address: '8 Lò Lu, KP. Phước Hiệp, P. Trường Thạnh, Thủ Đức',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=8+L%C3%B2+Lu+Ph%C6%B0%E1%BB%9Bc+Hi%E1%BB%87p+Tr%C6%B0%E1%BB%9Dng+Th%E1%BA%A1nh+Th%E1%BB%A7+%C4%90%E1%BB%A9c+Ho+Chi+Minh',
    image: xeTrongImg,
    badge: 'Còn chỗ',
    badgeColor: 'bg-blue-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Tòa nhà' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '700.000đ',
    floors: [
      { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Staff Booth', 'Ramp lên'] },
      { name: 'Tầng 2', items: ['Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Ramp xuống'] },
    ],
  },
  {
    id: '2',
    name: 'Bãi đỗ xe ParkFlow Thủ Đức',
    address: 'Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Linh+Trung+Thu+Duc+Ho+Chi+Minh',
    image: anNinhImg,
    badge: 'Phổ biến',
    badgeColor: 'bg-emerald-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Mái che tôn' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '850.000đ',
    floors: [
      { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Staff Booth', 'Ramp lên'] },
      { name: 'Tầng 2', items: ['Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Ramp xuống'] },
    ],
  },
  {
    id: '3',
    name: 'Bãi đỗ xe ParkFlow Long Phước',
    address: '8 đường Lò Lu, KP5, P. Long Phước, TP HCM',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Long+Phuoc+Ho+Chi+Minh',
    image: xeImg,
    badge: 'Còn chỗ',
    badgeColor: 'bg-blue-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Mái che tôn' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '1.100.000đ',
    floors: [
      { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Staff Booth', 'Ramp lên'] },
      { name: 'Tầng 2', items: ['Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Ramp xuống'] },
    ],
  },
];

const pricingRows = [
  {
    icon: <Car className="h-5 w-5 text-blue-600" />,
    label: 'Xe máy / Xe máy điện',
    sub: 'Mô tô, tay ga, xe điện 2 bánh',
    prices: [
      { type: 'Theo lượt', price: '10.000đ' },
      { type: 'Qua đêm', price: '30.000đ' },
      { type: 'Theo tháng', price: '200.000đ' },
    ],
  },
  {
    icon: <Car className="h-5 w-5 text-blue-600" />,
    label: 'Ô tô 4-7 chỗ (Xăng)',
    sub: 'Sedan, SUV, Hatchback',
    popular: true,
    prices: [
      { type: 'Theo giờ', price: '25.000đ' },
      { type: 'Qua đêm', price: '80.000đ' },
      { type: 'Theo tháng', price: '700.000đ' },
    ],
  },
  {
    icon: <Zap className="h-5 w-5 text-blue-600" />,
    label: 'Ô tô 4-7 chỗ (Điện / EV)',
    sub: 'Có trạm sạc EV kèm theo',
    prices: [
      { type: 'Theo giờ', price: '30.000đ' },
      { type: 'Qua đêm', price: '100.000đ' },
      { type: 'Theo tháng', price: '1.200.000đ' },
    ],
  },
];

import blueprintImg from '../../assets/images/xe-trong.jpg';

// Each floor tab maps to a vertical slice of the blueprint image
const FLOOR_IMG_POSITION = ['0% 5%', '0% 52%', '0% 97%'];

function LotCard({ lot, onBook }: { lot: Lot; onBook: (lotId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeFloor, setActiveFloor] = useState(0);

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row w-full">
      {/* Thumbnail image */}
      <div className="relative h-56 md:h-auto md:w-2/5 overflow-hidden flex-shrink-0">
        <img
          src={lot.image}
          alt={lot.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className={`absolute top-4 left-4 ${lot.badgeColor} px-3 py-1 rounded-full text-xs font-bold shadow`}>
          {lot.badge}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-slate-800 mb-1">{lot.name}</h3>
        <div className="flex items-start gap-1.5 mb-4 text-slate-500 text-sm">
          <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <span>{lot.address}</span>
        </div>

        {/* Feature chips */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {lot.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg text-xs font-medium text-slate-700">
              {f.icon}
              {f.label}
            </div>
          ))}
        </div>

        {/* Collapsible 3D floor map */}
        <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Map className="h-4 w-4 text-blue-600" />
              Xem sơ đồ bãi đỗ
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {expanded && (
            <div className="bg-white">
              {/* Floor tabs */}
              <div className="flex border-b border-slate-100">
                {lot.floors.map((floor, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveFloor(i)}
                    className={`flex-1 py-2 text-[12px] font-semibold transition ${
                      activeFloor === i
                        ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/60'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>

              {/* Blueprint floor plan image */}
              <div className="relative overflow-hidden bg-[#0a1628]" style={{ height: 220 }}>
                <img
                  src={blueprintImg}
                  alt={`Sơ đồ ${lot.floors[activeFloor]?.name}`}
                  className="w-full transition-all duration-500"
                  style={{
                    height: `${lot.floors.length * 100}%`,
                    objectFit: 'cover',
                    objectPosition: FLOOR_IMG_POSITION[activeFloor] ?? 'top left',
                    marginTop: `-${activeFloor * 100}%`,
                  }}
                />
                <div className="absolute top-3 left-3 bg-blue-700/90 text-white text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/40">
                  {lot.floors[activeFloor]?.name}
                </div>
              </div>

              {/* Floor info pills */}
              <div className="px-4 py-3 flex flex-wrap gap-1.5 bg-slate-50 border-t border-slate-100">
                {lot.floors[activeFloor]?.items.map((item, j) => (
                  <span key={j} className="bg-blue-50 text-blue-700 text-[11px] font-medium px-2.5 py-1 rounded-full border border-blue-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price + actions */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Giá từ</p>
            <p className="text-xl font-bold text-blue-600">{lot.priceFrom}<span className="text-sm font-normal text-slate-500">/tháng</span></p>
          </div>
          <div className="flex gap-2">
            <a
              href={lot.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-50 transition"
            >
              <Map className="h-4 w-4" />
              Xem bản đồ
            </a>
            <button
              onClick={() => onBook(lot.id)}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm"
            >
              Thuê ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ParkingLotsList({ setView }: { setView: (v: string) => void }) {
  const [search, setSearch] = useState('');

  const filtered = lots.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.address.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative py-16 md:py-20 overflow-hidden bg-gradient-to-b from-blue-50 to-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Danh sách Bãi đỗ xe ParkFlow
          </h1>
          <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            Khám phá hệ thống bãi giữ xe an toàn, hiện đại với đầy đủ tiện nghi camera giám sát và mái che. Giải pháp thuê chỗ đỗ xe tháng linh hoạt cho mọi loại phương tiện.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-xl mx-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm shadow-sm"
                placeholder="Tìm kiếm khu vực (Quận 9, Thủ Đức…)"
              />
            </div>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow hover:bg-blue-700 transition">
              Tìm kiếm ngay
            </button>
          </div>
        </div>
      </section>

      {/* Pricing table */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Bảng giá dịch vụ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricingRows.map((row, i) => (
              <div key={i} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {row.popular && (
                  <span className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    Phổ biến
                  </span>
                )}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    {row.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.sub}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {row.prices.map((p, j) => (
                    <div key={j} className="flex justify-between items-center text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500">{p.type}</span>
                      <span className="font-bold text-blue-600">{p.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lot listing */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Bãi xe nổi bật</h2>
            <div className="flex gap-2">
              <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition">
                <Filter className="h-4 w-4 text-slate-500" />
              </button>
              <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition">
                <LayoutGrid className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Không tìm thấy bãi xe phù hợp.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {filtered.map((lot) => (
                <LotCard key={lot.id} lot={lot} onBook={() => setView('slots')} />
              ))}
            </div>
          )}

        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div
            className="bg-blue-600 rounded-3xl p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
            style={{ backgroundImage: `url(${parkflowBg})`, backgroundSize: 'cover', backgroundBlendMode: 'multiply' }}
          >
            <div className="absolute inset-0 bg-blue-600/85 rounded-3xl" />
            <div className="relative z-10 max-w-xl text-center md:text-left">
              <h2 className="text-2xl font-bold text-white mb-3">Bạn đang tìm chỗ đỗ xe dài hạn?</h2>
              <p className="text-blue-100 text-sm leading-relaxed">
                Liên hệ ngay với đội ngũ hỗ trợ của chúng tôi để được tư vấn vị trí phù hợp nhất với nhu cầu và loại xe của bạn.
              </p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row gap-3">
              <a
                href="tel:0933733838"
                className="flex items-center justify-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-xl text-sm font-bold shadow hover:scale-105 transition"
              >
                <Phone className="h-4 w-4" />
                0933 733 838
              </a>
              <button
                onClick={() => setView('contact')}
                className="flex items-center justify-center gap-2 border border-white/40 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-white/10 transition"
              >
                Yêu cầu tư vấn
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
