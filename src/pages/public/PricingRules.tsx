import React from 'react';
import { ArrowRight, Bike, Building2, Car, ShieldCheck, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import pricingHeroImage from '../../assets/images/xe.jpg';

type PricingPlan = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  featured?: boolean;
  prices: {
    label: string;
    value: string;
  }[];
  actionLabel: string;
};

const pricingPlans: PricingPlan[] = [
  {
    title: 'Xe máy',
    subtitle: 'Phù hợp cho xe hai bánh cá nhân',
    icon: Bike,
    prices: [
      { label: 'Theo giờ', value: '10.000đ' },
      { label: 'Qua đêm', value: '15.000đ' },
      { label: 'Theo tháng', value: '150.000đ' },
    ],
    actionLabel: 'Chọn gói này',
  },
  {
    title: 'Ô tô 4 - 7 chỗ',
    subtitle: 'Gói phổ biến cho gia đình và doanh nghiệp',
    icon: Car,
    featured: true,
    prices: [
      { label: 'Theo giờ', value: '25.000đ' },
      { label: 'Qua đêm', value: '80.000đ' },
      { label: 'Theo tháng', value: '1.200.000đ' },
    ],
    actionLabel: 'Đặt chỗ ngay',
  },
  {
    title: 'Xe tải và xe khách',
    subtitle: 'Dành cho xe tải nhẹ và xe dịch vụ',
    icon: Truck,
    prices: [
      { label: 'Theo giờ', value: '40.000đ' },
      { label: 'Qua đêm', value: '120.000đ' },
      { label: 'Theo tháng', value: '2.500.000đ' },
    ],
    actionLabel: 'Chọn gói này',
  },
];

export default function PricingRules({ setView }: { setView: (view: string) => void }) {
  return (
    <div className="public-page text-slate-900">
      <section className="public-hero-section">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <p className="public-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
              Bảng giá ParkFlow
            </p>
            <h1 className="public-heading mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Bảng giá dịch vụ gửi xe thông minh
            </h1>
            <p className="public-copy mt-6 text-[15px] leading-7">
              ParkFlow cung cấp hệ thống bãi đỗ hiện đại, giám sát AI 24/7, quy trình ra vào rõ ràng
              và chính sách giá minh bạch cho từng loại phương tiện.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { icon: ShieldCheck, label: 'An ninh AI 24/7' },
                { icon: Building2, label: '7 tầng hiện đại' },
                { icon: ShieldCheck, label: 'PCCC tiêu chuẩn' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="public-surface flex min-w-[126px] items-center gap-2 rounded-2xl border px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm"
                  >
                    <span className="public-soft-accent flex h-7 w-7 items-center justify-center rounded-full text-blue-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-tight">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:justify-self-end">
            <div className="public-surface overflow-hidden rounded-[28px] border shadow-[0_18px_60px_rgba(15,23,42,0.15)]">
              <img src={pricingHeroImage} alt="Bãi đỗ xe ParkFlow" className="aspect-[4/3] w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pb-12">
          <div className="text-center">
            <h2 className="public-heading text-[28px] font-bold tracking-tight sm:text-[30px]">
              Lựa chọn gói dịch vụ phù hợp
            </h2>
            <p className="public-copy mt-3 text-[14px]">
              Giải pháp đỗ xe an toàn và tiết kiệm cho mọi loại phương tiện
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:items-stretch">
            {pricingPlans.map((plan) => {
              const Icon = plan.icon;

              return (
                <article
                  key={plan.title}
                  className={[
                    'relative rounded-2xl border p-6 shadow-sm transition-transform duration-200',
                    plan.featured
                      ? 'border-[#0f63d8] bg-[#0f63d8] text-white shadow-[0_14px_34px_rgba(15,99,216,0.28)] lg:-translate-y-2'
                      : 'public-surface text-slate-700',
                  ].join(' ')}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f63d8] shadow-md">
                      Phổ biến nhất
                    </div>
                  )}

                  <div
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-full',
                      plan.featured ? 'bg-white/15 text-white' : 'public-soft-accent text-blue-600',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-6 text-[20px] font-semibold tracking-tight">{plan.title}</h3>
                  <p className={`mt-3 text-[13px] ${plan.featured ? 'text-blue-50/90' : 'public-copy'}`}>
                    {plan.subtitle}
                  </p>

                  <div className="mt-8 space-y-6">
                    {plan.prices.map((price, index) => (
                      <div
                        key={price.label}
                        className={[
                          'flex items-center justify-between border-b pb-4 text-[14px]',
                          plan.featured ? 'border-white/20' : 'border-slate-200',
                          index === plan.prices.length - 1 ? 'border-b-0 pb-0' : '',
                        ].join(' ')}
                      >
                        <span className={plan.featured ? 'text-blue-100/90' : 'text-slate-500'}>{price.label}</span>
                        <span className="font-bold">{price.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 space-y-3">
                    <button
                      onClick={() => setView('slots')}
                      className={[
                        'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition',
                        plan.featured
                          ? 'bg-white text-[#0f63d8] shadow-md hover:bg-slate-100'
                          : 'public-button-secondary border hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {plan.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        // Navigate to pricing detail page
                        window.location.hash = '#/pricing-detail';
                      }}
                      className={[
                        'w-full rounded-xl px-4 py-2.5 text-[13px] font-semibold transition border',
                        plan.featured
                          ? 'border-white/30 text-white hover:bg-white/10'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      Xem chi tiết bảng giá
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="public-section-alt">
        <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="rounded-[24px] bg-[#0f63d8] px-6 py-14 text-center text-white shadow-[0_18px_50px_rgba(15,99,216,0.25)] sm:px-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
              Bạn đã sẵn sàng đỗ xe thông minh?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-blue-50/95">
              Tham gia cùng hàng nghìn khách hàng đang tin tưởng ParkFlow. Đặt chỗ ngay hôm nay để nhận
              ưu đãi cho tháng đầu tiên.
            </p>
            <button
              onClick={() => setView('slots')}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-10 py-3 text-[13px] font-semibold text-blue-700 shadow-[0_10px_24px_rgba(15,23,42,0.2)] transition hover:bg-slate-50"
            >
              Đặt chỗ ngay
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
