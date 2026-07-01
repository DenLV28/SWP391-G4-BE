import React from 'react';
import { ArrowRight, CheckCircle2, Clock, DollarSign, Globe, MapPin, Play } from 'lucide-react';
import anNinhImage from '../../assets/images/an-ninh.jpg';
import xeTrongImage from '../../assets/images/xe-trong.jpg';
import ParkingJourney from './ParkingJourney';

export default function ParkingInformation({ setView }: { setView: (view: string) => void }) {
  return (
    <div className="public-page">
      <section className="public-hero-section relative overflow-hidden pb-28 pt-20">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #1a56db 0px, #1a56db 1px, transparent 1px, transparent 60px), repeating-linear-gradient(0deg, #1a56db 0px, #1a56db 1px, transparent 1px, transparent 60px)',
            }}
          />
          <div className="absolute right-[15%] top-16 h-72 w-72 rounded-full bg-[#1a56db] opacity-[0.04] blur-3xl" />
          <div className="absolute bottom-0 left-[10%] h-96 w-96 rounded-full bg-[#1a56db] opacity-[0.03] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-[900px] px-4 text-center sm:px-6 lg:px-8">
          <h1 className="public-heading mb-6 text-[38px] font-extrabold leading-[1.1] tracking-tight lg:text-[52px]">
            ParkFlow - Tìm và thuê chỗ đỗ xe an toàn, tiện lợi
          </h1>
          <p className="public-copy mx-auto mb-8 max-w-2xl text-[15px] leading-relaxed">
            Chúng tôi cung cấp nền tảng hiện đại giúp bạn dễ dàng tìm kiếm và thuê vị trí đỗ xe an toàn
            chỉ trong vài phút, mang lại trải nghiệm gửi xe rõ ràng và ít ma sát hơn.
          </p>
          <button
            onClick={() => setView('slots')}
            className="inline-flex items-center gap-2.5 rounded-full bg-[#1a56db] px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-300/70 active:translate-y-0"
          >
            Khám phá giải pháp
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <ParkingJourney setView={setView} />

      <section className="public-section py-20">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-12 lg:flex-row">
            <div className="lg:w-1/2 space-y-6">
              <h2 className="public-heading text-[28px] font-bold leading-tight lg:text-[32px]">Sứ mệnh của chúng tôi</h2>
              <p className="public-copy text-[14px] leading-relaxed">
                ParkFlow giúp người vận hành tăng hiệu suất khai thác bãi đỗ trong đô thị lớn, giảm áp lực tìm
                chỗ đỗ và mang lại trải nghiệm thuê chỗ minh bạch hơn cho người dùng cuối.
              </p>

              <div className="max-w-sm rounded-2xl bg-[#1a56db] p-6 text-white shadow-lg">
                <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  Tầm nhìn 2030
                </h3>
                <p className="text-[13px] leading-relaxed text-blue-100">
                  ParkFlow hướng tới trở thành nền tảng đặt chỗ đỗ xe thông minh phổ biến trong khu vực,
                  giúp mọi hành trình đô thị diễn ra nhanh hơn và ít áp lực hơn.
                </p>
              </div>
            </div>

            <div className="relative lg:w-1/2">
              <div className="grid grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-2xl shadow-lg">
                  <img src={anNinhImage} alt="Hệ thống giám sát an ninh" className="h-52 w-full object-cover" />
                </div>
                <div className="overflow-hidden rounded-2xl shadow-lg">
                  <img src={xeTrongImage} alt="Vị trí đỗ xe còn trống" className="h-52 w-full object-cover" />
                </div>
              </div>

              <div className="public-surface absolute -bottom-5 right-6 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-xl">
                <div className="public-soft-accent flex h-10 w-10 items-center justify-center rounded-full">
                  <Clock className="h-5 w-5 text-[#1a56db]" />
                </div>
                <div>
                  <p className="public-heading text-[18px] font-bold">05 phút</p>
                  <p className="text-[11px] text-slate-400">Thời gian tìm vị trí trung bình</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section-alt border-t py-20">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="public-heading mb-3 text-[28px] font-bold lg:text-[34px]">Tại sao chọn ParkFlow?</h2>
            <p className="public-copy mx-auto max-w-xl text-[15px] leading-relaxed">
              Chúng tôi tập trung vào những giá trị cốt lõi để mang đến trải nghiệm tốt hơn cho người gửi xe.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FeatureCard
              title="An ninh tuyệt đối 24/7"
              icon={<Play className="h-5 w-5" />}
              iconWrap="bg-red-50 text-red-500"
              image={anNinhImage}
              description="Hệ thống camera AI giám sát liên tục 24/7 cùng đội ngũ bảo vệ chuyên nghiệp. Xe của bạn được bảo vệ xuyên suốt thời gian gửi."
            />

            <div className="rounded-2xl bg-[#1a56db] p-8 text-white shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="space-y-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[20px] font-bold">Đặt chỗ dễ dàng</h3>
                <p className="text-[13px] leading-relaxed text-blue-100">
                  Chỉ với vài thao tác trên ứng dụng, vị trí đỗ xe sẽ được sẵn sàng trước khi bạn đến bãi.
                </p>
              </div>
            </div>

            <FeatureTextCard
              title="Giá cả minh bạch"
              icon={<DollarSign className="h-5 w-5" />}
              iconWrap="bg-amber-50 text-amber-500"
              description="Mọi chi phí luôn được công khai trước khi xác nhận. Không phí ẩn, không phụ phí bất ngờ."
            />

            <FeatureCard
              title="Mạng lưới phủ khắp"
              icon={<Globe className="h-5 w-5" />}
              iconWrap="bg-blue-50 text-[#1a56db]"
              image={xeTrongImage}
              description="Với nhiều điểm đỗ tại Hà Nội và TP.HCM, ParkFlow giúp bạn dễ dàng tìm được bãi gần nhất cho mọi hành trình."
            />
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto max-w-[1000px] px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101b3b] to-[#1a2d5c] p-12 text-center text-white shadow-xl md:p-16">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white opacity-5 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#1a56db] opacity-20 blur-3xl" />

            <div className="relative z-10">
              <h2 className="mb-4 text-[26px] font-bold leading-tight md:text-[34px]">Sẵn sàng để đặt chỗ ngay?</h2>
              <p className="mx-auto mb-8 max-w-xl text-[14px] leading-relaxed text-slate-300">
                Tham gia cùng hàng nghìn người đang tận hưởng sự tiện lợi và an tâm mỗi ngày cùng ParkFlow.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setView('slots')}
                  className="rounded-full bg-[#1a56db] px-7 py-3 text-[14px] font-bold text-white shadow-lg transition hover:bg-blue-600"
                >
                  Đặt chỗ ngay
                </button>
                <button
                  onClick={() => setView('contact')}
                  className="rounded-full border border-white/20 bg-white/10 px-7 py-3 text-[14px] font-bold text-white transition backdrop-blur-sm hover:bg-white/20"
                >
                  Liên hệ tư vấn
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  icon,
  iconWrap,
  description,
  image,
}: {
  title: string;
  icon: React.ReactNode;
  iconWrap: string;
  description: string;
  image: string;
}) {
  return (
    <div className="public-surface rounded-2xl border p-8 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconWrap}`}>{icon}</div>
          <h3 className="public-heading text-[20px] font-bold">{title}</h3>
          <p className="public-copy text-[13px] leading-relaxed">{description}</p>
        </div>
        <div className="h-32 w-full flex-shrink-0 overflow-hidden rounded-xl md:w-44 md:h-auto">
          <img src={image} alt={title} className="h-full w-full rounded-xl object-cover" />
        </div>
      </div>
    </div>
  );
}

function FeatureTextCard({
  title,
  icon,
  iconWrap,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  iconWrap: string;
  description: string;
}) {
  return (
    <div className="public-surface rounded-2xl border p-8 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="space-y-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconWrap}`}>{icon}</div>
        <h3 className="public-heading text-[20px] font-bold">{title}</h3>
        <p className="public-copy text-[13px] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
