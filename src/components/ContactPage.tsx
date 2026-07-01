import React from 'react';
import { ChevronDown, Clock3, Mail, MapPin, Phone, PhoneCall, Send } from 'lucide-react';
import officeHeroImage from '../assets/images/parkflow_bg_1779336618673.png';

const faqItems = [
  {
    question: 'Làm thế nào để đặt chỗ trước?',
    answer:
      'Chọn mục Đặt chỗ trên thanh điều hướng, điền thông tin xe, thời gian gửi xe và xác nhận để giữ chỗ ngay lập tức.',
  },
  {
    question: 'Dịch vụ đỗ xe có an toàn không?',
    answer:
      'Có. Bãi xe được giám sát 24/7, kết hợp kiểm soát ra vào và camera an ninh tại các khu vực trọng điểm.',
  },
  {
    question: 'Các phương thức thanh toán được chấp nhận?',
    answer:
      'Bạn có thể thanh toán bằng thẻ ngân hàng, chuyển khoản hoặc các ví điện tử được hỗ trợ trong hệ thống.',
  },
  {
    question: 'Tôi có thể hủy đặt chỗ đã thanh toán không?',
    answer:
      'Có thể, tùy theo chính sách hủy của từng loại chỗ. Khi hủy hợp lệ, hệ thống sẽ thông báo mức hoàn tiền tương ứng.',
  },
];

function ContactDetail({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-[14px] text-slate-700">
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-[#1a56db]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="leading-6">{children}</div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="public-page text-slate-900">
      <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="max-w-2xl">
          <h1 className="public-heading font-display text-[38px] font-extrabold tracking-tight sm:text-[48px]">
            Liên hệ với chúng tôi
          </h1>
          <p className="public-copy mt-4 max-w-2xl text-[16px] leading-7 sm:text-[17px]">
            Đội ngũ ParkFlow luôn sẵn sàng hỗ trợ bạn 24/7. Hãy cho chúng tôi biết bạn cần gì,
            chúng tôi sẽ phản hồi sớm nhất có thể.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="public-surface rounded-[18px] border p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-8">
            <h2 className="public-heading text-[20px] font-semibold">Gửi tin nhắn cho ParkFlow</h2>

            <form className="mt-7 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-medium text-slate-700">Họ và tên</span>
                  <input
                    type="text"
                    defaultValue="Nguyễn Văn A"
                    className="public-input h-12 w-full rounded-lg border px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#1a56db]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    defaultValue="email@vi-du.com"
                    className="public-input h-12 w-full rounded-lg border px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#1a56db]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-slate-700">Số điện thoại</span>
                <input
                  type="tel"
                  defaultValue="090 123 4567"
                  className="public-input h-12 w-full rounded-lg border px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#1a56db]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-slate-700">Lời nhắn</span>
                <textarea
                  rows={5}
                  defaultValue="Chúng tôi có thể giúp gì cho bạn?"
                  className="public-input min-h-[140px] w-full rounded-lg border px-4 py-3 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#1a56db]"
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0f63d8] px-8 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(15,99,216,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0c57c2] active:translate-y-0"
              >
                Gửi yêu cầu
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <article className="public-surface overflow-hidden rounded-[18px] border shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="relative h-[194px] overflow-hidden">
                <img src={officeHeroImage} alt="Bãi đỗ xe ParkFlow" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 pt-10 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2.5 py-1 text-[13px] font-medium backdrop-blur-sm">
                    <MapPin className="h-4 w-4" />
                    <span>Tân Sơn Nhất, TP.HCM</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h2 className="public-heading text-[20px] font-semibold">Địa chỉ văn phòng</h2>
                <p className="public-copy mt-3 text-[15px] leading-7">
                  Nhà để xe ga Quốc nội, cổng Hàng không Quốc tế Tân Sơn Nhất, Phường Tân Sơn Hòa,
                  TP.HCM
                </p>

                <div className="my-5 border-t border-slate-200" />

                <div className="space-y-3">
                  <ContactDetail icon={Phone}>
                    <a href="tel:+842812345678" className="transition hover:text-[#1a56db]">
                      +84 28 1234 5678
                    </a>
                  </ContactDetail>
                  <ContactDetail icon={Mail}>
                    <a href="mailto:support@parkflow.vn" className="transition hover:text-[#1a56db]">
                      support@parkflow.vn
                    </a>
                  </ContactDetail>
                  <ContactDetail icon={Clock3}>Mở cửa 24/7 (bao gồm lễ tết)</ContactDetail>
                </div>
              </div>
            </article>

            <article className="rounded-[18px] bg-[#1f6fe5] p-6 text-white shadow-[0_16px_34px_rgba(31,111,229,0.28)]">
              <h3 className="text-[22px] font-semibold">Hỗ trợ khẩn cấp?</h3>
              <p className="mt-3 max-w-[28ch] text-[15px] leading-7 text-white/90">
                Liên hệ trực tiếp qua hotline nếu bạn gặp vấn đề tại bãi đỗ xe.
              </p>

              <a
                href="tel:19001234"
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-semibold text-[#1a56db] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                <PhoneCall className="h-4 w-4" />
                <span>1900 1234</span>
              </a>
            </article>
          </div>
        </div>

        <section className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="public-heading font-display text-[34px] font-extrabold tracking-tight sm:text-[40px]">
              Câu hỏi thường gặp
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-[700px] space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="public-surface group rounded-xl border shadow-[0_10px_24px_rgba(15,23,42,0.03)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 text-left text-[15px] font-medium text-slate-900 marker:hidden">
                  <span>{item.question}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#1a56db] transition duration-200 group-open:rotate-180" />
                </summary>
                <div className="public-copy px-5 pb-5 pt-0 text-[14px] leading-7">{item.answer}</div>
              </details>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
