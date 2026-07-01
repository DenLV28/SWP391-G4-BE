import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  MessageSquareWarning,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import {
  initialFeedbacks,
  initialParkingSession,
  initialPayments,
  initialReservations,
  mockPricingRules,
} from '../../data/mockData';

type JourneyAction = {
  label: string;
  view?: string;
  variant?: 'primary' | 'ghost';
};

type JourneyCard = {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badge: string;
  stats: { label: string; value: string }[];
  actions: JourneyAction[];
};

const carPricing = mockPricingRules.find((rule) => rule.vehicleType === 'car') ?? mockPricingRules[0];

const journeyCards: JourneyCard[] = [
  {
    step: '01',
    title: 'Gửi xe theo lượt',
    description:
      'Xe vào bãi, hệ thống phát thẻ xe hoặc mã gửi xe. Khách chỉ thanh toán khi ra cổng, phù hợp cho lượt gửi ngắn hạn hoặc phát sinh.',
    icon: Ticket,
    accent: 'from-blue-500 to-indigo-600',
    badge: 'Luồng vào bãi',
    stats: [
      { label: 'Mã gửi xe', value: initialParkingSession.ticketCode },
      { label: 'Cổng vào', value: initialParkingSession.entryGate },
      { label: 'Phí tạm tính', value: `${initialParkingSession.estimatedFee.toLocaleString('vi-VN')}đ` },
    ],
    actions: [
      { label: 'Xem bãi trống', view: 'slots', variant: 'primary' },
      { label: 'Xem bảng giá', view: 'pricing', variant: 'ghost' },
    ],
  },
  {
    step: '02',
    title: 'Đặt chỗ trước',
    description:
      'Đặt trước theo loại phương tiện, thời gian gửi và khu vực còn trống nếu bãi hỗ trợ. Luồng này phù hợp khi cần chắc chắn có chỗ.',
    icon: CalendarDays,
    accent: 'from-emerald-500 to-teal-600',
    badge: 'Luồng đặt chỗ',
    stats: [
      { label: 'Mã đặt chỗ', value: initialReservations[0].reservationCode },
      { label: 'Thời gian', value: `${initialReservations[0].startTime} - ${initialReservations[0].endTime}` },
      { label: 'Khu vực', value: `${initialReservations[0].floor} / ${initialReservations[0].area}` },
    ],
    actions: [
      { label: 'Đặt chỗ ngay', view: 'slots', variant: 'primary' },
      { label: 'Đăng nhập', view: 'login', variant: 'ghost' },
    ],
  },
  {
    step: '03',
    title: 'Theo dõi lượt gửi xe',
    description:
      'Xem lượt gửi hiện tại với giờ vào, loại xe, khu vực gửi và phí tạm tính. Đây là màn hình để người dùng biết xe đang ở đâu.',
    icon: Clock3,
    accent: 'from-amber-500 to-orange-600',
    badge: 'Luồng theo dõi',
    stats: [
      { label: 'Giờ vào', value: initialParkingSession.checkInTime },
      { label: 'Loại xe', value: 'Ô tô' },
      { label: 'Ô đang giữ', value: initialParkingSession.slotCode },
      { label: 'Trạng thái', value: 'Đang hoạt động' },
    ],
    actions: [
      { label: 'Xem lượt gửi', view: 'login', variant: 'primary' },
      { label: 'Tìm hiểu quy trình', view: 'info', variant: 'ghost' },
    ],
  },
  {
    step: '04',
    title: 'Thanh toán phí gửi xe',
    description:
      'Tổng hợp phí gửi xe, phí dịch vụ bổ sung, phí mất thẻ hoặc phí quá giờ nếu có. Giao diện hiển thị rõ từng dòng để dễ kiểm tra.',
    icon: CreditCard,
    accent: 'from-violet-500 to-fuchsia-600',
    badge: 'Luồng thanh toán',
    stats: [
      { label: 'Phí gửi xe', value: `${initialPayments[0].parkingFee.toLocaleString('vi-VN')}đ` },
      { label: 'Phí dịch vụ', value: `${initialPayments[0].extraServiceFee.toLocaleString('vi-VN')}đ` },
      { label: 'Giảm giá', value: `${initialPayments[0].discount.toLocaleString('vi-VN')}đ` },
      { label: 'Tổng thanh toán', value: `${initialPayments[0].totalAmount.toLocaleString('vi-VN')}đ` },
    ],
    actions: [
      { label: 'Thanh toán ngay', view: 'login', variant: 'primary' },
      { label: 'Xem quy định phí', view: 'pricing', variant: 'ghost' },
    ],
  },
  {
    step: '05',
    title: 'Gửi phản hồi và hỗ trợ',
    description:
      'Dùng khi mất thẻ xe, sai phí, khó tìm xe, slot bị chiếm hoặc phát sinh sự cố trong bãi. Đây là kênh hỗ trợ nên có trong luồng chuẩn.',
    icon: MessageSquareWarning,
    accent: 'from-rose-500 to-red-600',
    badge: 'Luồng hỗ trợ',
    stats: [
      { label: 'Mã phản hồi', value: initialFeedbacks[0].feedbackCode },
      { label: 'Loại phản hồi', value: initialFeedbacks[0].type },
      { label: 'Ưu tiên', value: initialFeedbacks[0].priority },
      { label: 'Trạng thái', value: initialFeedbacks[0].status },
    ],
    actions: [
      { label: 'Liên hệ hỗ trợ', view: 'contact', variant: 'primary' },
      { label: 'Xem FAQ', view: 'info', variant: 'ghost' },
    ],
  },
];

function JourneyButton({
  label,
  view,
  variant,
  setView,
}: JourneyAction & { setView: (view: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (view) setView(view);
      }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
        variant === 'primary'
          ? 'bg-slate-950 text-white hover:bg-slate-800'
          : 'public-button-secondary border hover:bg-slate-50'
      }`}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

export default function ParkingJourney({ setView }: { setView: (view: string) => void }) {
  const feePreview = `${(carPricing.firstHourPrice + carPricing.extraServiceFee).toLocaleString('vi-VN')}đ`;

  return (
    <section className="public-section-alt border-y py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="public-pill inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
              Dữ liệu mẫu, chưa có backend
            </span>
            <h2 className="public-heading mt-4 text-[28px] font-bold tracking-tight sm:text-[34px]">
              Luồng nghiệp vụ chuẩn cho người gửi xe
            </h2>
            <p className="public-copy mt-3 text-[15px] leading-7">
              Bố cục này gom đúng 5 nhu cầu chính của hệ thống: gửi xe theo lượt, đặt chỗ trước, theo dõi
              lượt gửi hiện tại, thanh toán phí và gửi phản hồi khi có sự cố.
            </p>
          </div>

          <div className="public-surface rounded-2xl border px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Chỉ là bản xem trước bằng dữ liệu mẫu
            </div>
            <div className="mt-2 text-[14px] font-semibold text-slate-900">Có thể thay bằng API thật sau này</div>
            <div className="mt-1 text-[13px] text-slate-500">Phí ô tô tham chiếu: {feePreview}</div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {journeyCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.step}
                className="public-surface rounded-[24px] border p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bước {card.step}</div>
                      <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-950">{card.title}</h3>
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {card.badge}
                  </span>
                </div>

                <p className="public-copy mt-4 text-[14px] leading-7">{card.description}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {card.stats.map((item) => (
                    <div key={item.label} className="public-card-muted rounded-2xl border px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {card.actions.map((action) => (
                    <JourneyButton key={action.label} {...action} setView={setView} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="public-surface rounded-[24px] border p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tổng hợp dữ liệu mẫu</div>
                <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-950">Tóm tắt dữ liệu mẫu đang hiển thị</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Sẵn sàng nối BE sau
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <SummaryCard title="Thông tin lượt gửi hiện tại" icon={MapPin}>
                <SummaryRow label="Giờ vào" value={initialParkingSession.checkInTime} />
                <SummaryRow label="Khu vực" value={initialParkingSession.area} />
                <SummaryRow label="Ô đỗ" value={initialParkingSession.slotCode} />
              </SummaryCard>

              <SummaryCard title="Vé xe / mã gửi xe" icon={Ticket}>
                <div className="public-surface mt-3 rounded-2xl border p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                    {initialParkingSession.ticketCode}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-slate-900">
                    {initialParkingSession.licensePlate} • {initialParkingSession.vehicleType}
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-500">
                    Hệ thống phát mã khi xe vào bãi và dùng mã này để đối soát khi thanh toán.
                  </div>
                </div>
              </SummaryCard>

              <SummaryCard title="Bản nháp thanh toán" icon={CreditCard}>
                <SummaryRow label="Phí bãi" value={`${initialPayments[0].parkingFee.toLocaleString('vi-VN')}đ`} />
                <SummaryRow label="Phí dịch vụ" value={`${initialPayments[0].extraServiceFee.toLocaleString('vi-VN')}đ`} />
                <SummaryRow label="Tổng cộng" value={`${initialPayments[0].totalAmount.toLocaleString('vi-VN')}đ`} accent />
              </SummaryCard>

              <SummaryCard title="Các loại phản hồi thường gặp" icon={MessageSquareWarning}>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Mất thẻ xe', 'Sai phí', 'Khó tìm xe', 'Slot bị chiếm', 'Lỗi trong bãi'].map((tag) => (
                    <span key={tag} className="public-surface rounded-full border px-3 py-1 text-[12px] font-medium text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
                  Ví dụ ticket: <strong>{initialFeedbacks[0].feedbackCode}</strong> • trạng thái <strong>{initialFeedbacks[0].status}</strong>
                </div>
              </SummaryCard>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[#0f172a] p-6 text-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Luồng khuyến nghị</div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight">Phân biệt luồng khách chưa đăng nhập và đã đăng nhập</h3>
            <div className="mt-5 space-y-4 text-[14px] leading-7 text-slate-300">
              <DarkNote title="Khách chưa đăng nhập">
                Chỉ xem thông tin bãi, bảng giá và luồng tham khảo. Khi muốn đặt chỗ, thanh toán hoặc gửi phản hồi chi tiết thì chuyển sang màn đăng nhập.
              </DarkNote>
              <DarkNote title="Khách đã đăng nhập">
                Có thể đặt chỗ trước, theo dõi lượt gửi, kiểm tra hóa đơn và tạo phản hồi từ cổng cá nhân.
              </DarkNote>
              <DarkNote title="Mục tiêu UI hiện tại">
                Chưa có backend nên chỉ cần mock data đủ sát thực tế để demo logic, chưa cần xử lý API hay lưu trạng thái thật.
              </DarkNote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="public-card-muted rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <div className="mt-3 space-y-2 text-[14px] text-slate-700">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <strong className={accent ? 'text-emerald-600' : ''}>{value}</strong>
    </div>
  );
}

function DarkNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="font-semibold text-white">{title}</div>
      <p className="mt-1">{children}</p>
    </div>
  );
}
