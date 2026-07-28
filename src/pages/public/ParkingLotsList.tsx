import React, { useEffect, useRef, useState } from 'react';
import {
  Search, MapPin, Camera, Shield, Zap, Home, ChevronDown, ChevronUp,
  Map, Phone, Car, ArrowRight,
} from 'lucide-react';
import parkflowBg from '../../assets/images/parkflow_bg_1779336618673.png';
import type { PricingRule, VehicleKey } from '../../data/mockData';
// Real photos of the three lots (see "Bãi xe nổi bật")
import baiXeQuan9Img from '../../assets/images/bai-xe-quan-9.jpg';
import baiXeThuDucImg from '../../assets/images/bai-xe-thu-duc.jpg';
import baiXeLongPhuocImg from '../../assets/images/bai-xe-long-phuoc.jpg';

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
  floor: { name: string; items: string[] };
}

const lots: Lot[] = [
  {
    id: '1',
    name: 'Bãi đỗ xe ParkFlow Quận 9',
    address: '5A Đường Lò Lu, KP. Phước Hiệp, P, Long Phước, Hồ Chí Minh 700000, Việt Nam',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('5A Đường Lò Lu, KP. Phước Hiệp, P, Long Phước, Hồ Chí Minh 700000, Việt Nam'),
    image: baiXeQuan9Img,
    badge: 'Còn chỗ',
    badgeColor: 'bg-blue-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Tòa nhà' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '700.000đ',
    floor: { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Staff Booth'] },
  },
  {
    id: '2',
    name: 'Bãi đỗ xe ParkFlow Thủ Đức',
    address: '86/33 Đ. Số 5, khu phố 3, Linh Xuân, Hồ Chí Minh, Việt Nam',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('86/33 Đ. Số 5, khu phố 3, Linh Xuân, Hồ Chí Minh, Việt Nam'),
    image: baiXeThuDucImg,
    badge: 'Phổ biến',
    badgeColor: 'bg-emerald-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Mái che tôn' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '850.000đ',
    floor: { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Staff Booth'] },
  },
  {
    id: '3',
    name: 'Bãi đỗ xe ParkFlow Long Phước',
    address: 'Tp, 15/3 Đ. Số 3, Thủ Đức, Hồ Chí Minh 720300, Việt Nam',
    // The query includes the Google Maps place name ("Bãi Giữ xe ô tô Thủ Đức")
    // so Maps snaps to the exact business pin instead of a street-level guess.
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Bãi Giữ xe ô tô Thủ Đức, 15/3 Đ. Số 3, Thủ Đức, Hồ Chí Minh 720300, Việt Nam'),
    image: baiXeLongPhuocImg,
    badge: 'Còn chỗ',
    badgeColor: 'bg-blue-600 text-white',
    features: [
      { icon: <Home className="h-4 w-4 text-blue-600" />, label: 'Mái che tôn' },
      { icon: <Camera className="h-4 w-4 text-blue-600" />, label: 'Camera 24/7' },
      { icon: <Shield className="h-4 w-4 text-blue-600" />, label: 'Bảo vệ' },
      { icon: <Zap className="h-4 w-4 text-blue-600" />, label: 'Trạm sạc điện' },
    ],
    priceFrom: '1.100.000đ',
    floor: { name: 'Tầng 1', items: ['Ô tô 4-7 chỗ (Xăng)', 'Ô tô 4-7 chỗ (Điện/EV)', 'Trạm sạc EV', 'Staff Booth'] },
  },
];

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

// Metadata cố định (icon, nhãn, mô tả) — số tiền lấy trực tiếp từ pricingRules
// (bảng giá thật do Manager chỉnh) để không bao giờ lệch với giá đang tính phí.
const pricingRowsMeta: {
  vehicleKey: VehicleKey;
  icon: React.ReactNode;
  label: string;
  sub: string;
  popular?: boolean;
  perVisitLabel: string;
}[] = [
  {
    vehicleKey: 'motorbike',
    icon: <Car className="h-5 w-5 text-blue-600" />,
    label: 'Xe máy / Xe máy điện',
    sub: 'Mô tô, tay ga, xe điện 2 bánh',
    perVisitLabel: 'Theo lượt',
  },
  {
    vehicleKey: 'car',
    icon: <Car className="h-5 w-5 text-blue-600" />,
    label: 'Ô tô 4-7 chỗ (Xăng)',
    sub: 'Sedan, SUV, Hatchback',
    popular: true,
    perVisitLabel: 'Theo giờ',
  },
  {
    vehicleKey: 'electric vehicle',
    icon: <Zap className="h-5 w-5 text-blue-600" />,
    label: 'Ô tô 4-7 chỗ (Điện / EV)',
    sub: 'Có trạm sạc EV kèm theo',
    perVisitLabel: 'Theo giờ',
  },
];

function buildPricingRows(pricingRules: PricingRule[]) {
  return pricingRowsMeta.map((meta) => {
    const rule = pricingRules.find((r) => r.vehicleType === meta.vehicleKey);
    return {
      icon: meta.icon,
      label: meta.label,
      sub: meta.sub,
      popular: meta.popular,
      prices: [
        { type: meta.perVisitLabel, price: formatVnd(rule?.firstHourPrice ?? 0) },
        { type: 'Qua đêm', price: formatVnd(rule?.overnightPrice ?? 0) },
        { type: 'Theo tháng', price: formatVnd(rule?.monthlyPrice ?? 0) },
      ],
    };
  });
}

import ParkingFloorMap from '../../components/ParkingFloorMap';

function LotCard({ lot, onBook }: { lot: Lot; onBook: (lotId: string) => void }) {
  const [expanded, setExpanded] = useState(false);

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
              {/* Floor plan — same schematic map as the booking page (view-only) */}
              <div className="relative bg-slate-50 p-2">
                <ParkingFloorMap level={1} interactive={false} />
                <div className="absolute top-4 left-4 bg-blue-700/90 text-white text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/40">
                  {lot.floor.name}
                </div>
              </div>

              {/* Floor info pills */}
              <div className="px-4 py-3 flex flex-wrap gap-1.5 bg-slate-50 border-t border-slate-100">
                {lot.floor.items.map((item, j) => (
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

export default function ParkingLotsList({
  setView,
  pricingRules = [],
}: {
  setView: (v: string) => void;
  pricingRules?: PricingRule[];
}) {
  const [search, setSearch] = useState('');
  const featuredRef = useRef<HTMLElement>(null);
  const pricingRows = buildPricingRows(pricingRules);

  // "Xem bản đồ" on the homepage hero lands here — jump straight to "Bãi xe nổi bật".
  useEffect(() => {
    try {
      if (sessionStorage.getItem('parkflow.scrollToFeaturedLots') === '1') {
        sessionStorage.removeItem('parkflow.scrollToFeaturedLots');
        requestAnimationFrame(() => {
          featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch {}
  }, []);

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
      <section ref={featuredRef} id="bai-xe-noi-bat" className="py-12 scroll-mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Bãi xe nổi bật</h2>

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
