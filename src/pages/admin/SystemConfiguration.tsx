import React, { useEffect, useState } from 'react';
import { BellRing, ChevronRight, Globe, Lock, Palette, Pencil, Shield, SlidersHorizontal } from 'lucide-react';
import { SystemConfig, validateRequired } from '../../data/mockData';

type InterfaceMode = 'light' | 'dark';

export default function SystemConfiguration({
  systemConfig,
  onSaveConfig,
  onPreviewThemeChange,
}: {
  systemConfig: SystemConfig;
  onSaveConfig: (updated: Partial<SystemConfig>) => void;
  onPreviewThemeChange?: (mode: InterfaceMode) => void;
}) {
  const savedMode = systemConfig.interfaceMode ?? 'light';
  const [isEditing, setIsEditing] = useState(false);
  const [systemName, setSystemName] = useState(systemConfig.systemName);
  const [defaultCurrency, setDefaultCurrency] = useState(systemConfig.defaultCurrency);
  const [reservationEnabled, setReservationEnabled] = useState(systemConfig.reservationEnabled);
  const [maxReservationDuration, setMaxReservationDuration] = useState(systemConfig.maxReservationDuration);
  const [parkingSessionTimeout, setParkingSessionTimeout] = useState(systemConfig.parkingSessionTimeout);
  const [notificationEnabled, setNotificationEnabled] = useState(systemConfig.notificationEnabled);
  const [maintenanceMode, setMaintenanceMode] = useState(systemConfig.maintenanceMode);
  const [supportHotline, setSupportHotline] = useState(systemConfig.supportHotline);
  const [lostTicketFee, setLostTicketFee] = useState(systemConfig.lostTicketFee);
  const [defaultLanguage, setDefaultLanguage] = useState(systemConfig.defaultLanguage);
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>(savedMode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setInterfaceMode(savedMode);
  }, [savedMode]);

  const handleThemeSelect = (mode: InterfaceMode) => {
    if (!isEditing) return;
    setInterfaceMode(mode);
    onPreviewThemeChange?.(mode);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (validateRequired(systemName, 'Tên hệ thống')) tempErrors.systemName = 'Tên hệ thống là bắt buộc.';
    if (validateRequired(defaultCurrency, 'Đơn vị tiền tệ')) tempErrors.defaultCurrency = 'Đơn vị tiền tệ là bắt buộc.';
    if (validateRequired(supportHotline, 'Đường dây hỗ trợ')) tempErrors.supportHotline = 'Đường dây hỗ trợ là bắt buộc.';
    if (maxReservationDuration <= 0) tempErrors.maxReservationDuration = 'Thời lượng đặt chỗ phải lớn hơn 0.';
    if (parkingSessionTimeout <= 0) tempErrors.parkingSessionTimeout = 'Thời gian chờ phiên phải lớn hơn 0.';
    if (lostTicketFee < 0) tempErrors.lostTicketFee = 'Phí mất thẻ không được âm.';

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setErrors({});
    onSaveConfig({
      systemName,
      defaultCurrency,
      reservationEnabled,
      maxReservationDuration: Number(maxReservationDuration),
      parkingSessionTimeout: Number(parkingSessionTimeout),
      notificationEnabled,
      maintenanceMode,
      supportHotline,
      lostTicketFee: Number(lostTicketFee),
      defaultLanguage,
      interfaceMode,
    });
    setIsEditing(false);
    alert('Đã lưu cấu hình hệ thống.');
  };

  const handleReset = () => {
    setSystemName(systemConfig.systemName);
    setDefaultCurrency(systemConfig.defaultCurrency);
    setReservationEnabled(systemConfig.reservationEnabled);
    setMaxReservationDuration(systemConfig.maxReservationDuration);
    setParkingSessionTimeout(systemConfig.parkingSessionTimeout);
    setNotificationEnabled(systemConfig.notificationEnabled);
    setMaintenanceMode(systemConfig.maintenanceMode);
    setSupportHotline(systemConfig.supportHotline);
    setLostTicketFee(systemConfig.lostTicketFee);
    setDefaultLanguage(systemConfig.defaultLanguage);
    setInterfaceMode(savedMode);
    onPreviewThemeChange?.(savedMode);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 md:text-[32px]">Cài đặt hệ thống</h1>
          <p className="max-w-4xl text-[15px] leading-7 text-slate-600">
            Quản lý thông báo, chế độ vận hành, ngôn ngữ và các tham số cốt lõi của nền tảng ParkFlow.
          </p>
        </div>

        {!isEditing ? (
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Chế độ xem
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#d9e7ff] bg-[#eef5ff] px-5 py-2.5 text-[14px] font-semibold text-[#0b63d1] transition hover:bg-[#e3efff]"
            >
              <Pencil className="h-4 w-4" />
              Chỉnh sửa
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsCard icon={<BellRing className="h-5 w-5" />} title="Thông báo" titleClassName="text-[#0b63d1]">
          <div className="space-y-6">
            <ToggleRow title="Email Notifications" description="Nhận cập nhật hệ thống, giao dịch và cảnh báo vận hành qua email." checked={notificationEnabled} onChange={setNotificationEnabled} disabled={!isEditing} />
            <ToggleRow title="Pre-booking Access" description="Cho phép người dùng tạo đặt chỗ trước trên toàn hệ thống." checked={reservationEnabled} onChange={setReservationEnabled} disabled={!isEditing} />
          </div>
        </SettingsCard>

        <SettingsCard icon={<Palette className="h-5 w-5" />} title="Chế độ giao diện" titleClassName="text-[#0b63d1]">
          <div className="grid gap-4 md:grid-cols-2">
            <ModeCard label="Sáng" active={interfaceMode === 'light'} onClick={() => handleThemeSelect('light')} tone="light" disabled={!isEditing} />
            <ModeCard label="Tối" active={interfaceMode === 'dark'} onClick={() => handleThemeSelect('dark')} tone="dark" disabled={!isEditing} />
          </div>
          <p className="mt-4 text-[13px] leading-6 text-slate-500">
            Khi đang chỉnh sửa, chọn một chế độ sẽ xem trước ngay trên toàn giao diện. Bấm lưu để áp dụng lâu dài.
          </p>
        </SettingsCard>

        <SettingsCard icon={<Globe className="h-5 w-5" />} title="Ngôn ngữ" titleClassName="text-[#0b63d1]">
          <div className="space-y-4">
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              disabled={!isEditing}
              className={`w-full rounded-2xl border px-4 py-3 text-[14px] outline-none transition ${
                isEditing ? 'border-slate-200 bg-white text-slate-800 focus:border-blue-500' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <option value="Vietnamese">Tiếng Việt (Việt Nam)</option>
              <option value="English">English (United States)</option>
            </select>
            <p className="max-w-xl text-[13px] leading-6 text-slate-500">
              Cài đặt này ảnh hưởng đến giao diện ứng dụng, thông báo và nội dung email hỗ trợ.
            </p>
          </div>
        </SettingsCard>

        <SettingsCard icon={<Shield className="h-5 w-5" />} title="Quyền riêng tư" titleClassName="text-[#0b63d1]">
          <div className="space-y-2">
            <ActionRow title="Tên hệ thống" value={systemName} error={errors.systemName} isEditing={isEditing} input={<input type="text" value={systemName} onChange={(e) => setSystemName(e.target.value)} disabled={!isEditing} className={inputClass(isEditing)} />} />
            <ActionRow title="Dữ liệu tiền tệ" value={defaultCurrency} error={errors.defaultCurrency} isEditing={isEditing} input={<input type="text" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} disabled={!isEditing} className={inputClass(isEditing)} />} />
          </div>
        </SettingsCard>
      </div>

      <SettingsCard icon={<SlidersHorizontal className="h-5 w-5" />} title="Tham số vận hành" titleClassName="text-slate-950">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Hotline hỗ trợ" error={errors.supportHotline}>
            <input type="text" value={supportHotline} onChange={(e) => setSupportHotline(e.target.value)} disabled={!isEditing} className={baseFieldClass(isEditing)} />
          </Field>
          <Field label="Phí mất thẻ" error={errors.lostTicketFee}>
            <input type="number" value={lostTicketFee} onChange={(e) => setLostTicketFee(Number(e.target.value))} disabled={!isEditing} className={baseFieldClass(isEditing)} />
          </Field>
          <Field label="Đặt chỗ tối đa (giờ)" error={errors.maxReservationDuration}>
            <input type="number" value={maxReservationDuration} onChange={(e) => setMaxReservationDuration(Number(e.target.value))} disabled={!isEditing} className={baseFieldClass(isEditing)} />
          </Field>
          <Field label="Timeout phiên (phút)" error={errors.parkingSessionTimeout}>
            <input type="number" value={parkingSessionTimeout} onChange={(e) => setParkingSessionTimeout(Number(e.target.value))} disabled={!isEditing} className={baseFieldClass(isEditing)} />
          </Field>
        </div>
      </SettingsCard>

      <section className="flex flex-col gap-5 rounded-[24px] border border-[#d8e6ff] bg-[#edf4ff] px-8 py-8 shadow-[0_10px_24px_rgba(15,42,81,0.04)] md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-[20px] font-bold tracking-tight text-[#0c55b3]">Bảo mật hệ thống</h2>
          <p className="mt-2 text-[14px] leading-7 text-slate-700">
            Kích hoạt chế độ bảo trì và chuẩn hóa tham số timeout để giảm rủi ro trong các giao dịch ra vào và thanh toán tại bãi.
          </p>
        </div>

        <button
          type="button"
          disabled={!isEditing}
          onClick={() => setMaintenanceMode((prev) => !prev)}
          className={`inline-flex min-w-[170px] items-center justify-center rounded-[14px] px-7 py-4 text-[14px] font-semibold transition ${
            isEditing ? 'bg-[#0b63d1] text-white shadow-[0_14px_24px_rgba(11,99,209,0.24)] hover:bg-[#0859bc]' : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
          }`}
        >
          {maintenanceMode ? 'Tắt bảo trì' : 'Bật bảo trì'}
        </button>
      </section>

      {isEditing ? (
        <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
          <button type="button" onClick={handleReset} className="rounded-[12px] px-4 py-2.5 text-[14px] font-medium text-slate-700 transition hover:bg-slate-100">
            Hủy bỏ
          </button>
          <button type="submit" className="rounded-[14px] bg-[#0b63d1] px-7 py-3 text-[14px] font-semibold text-white shadow-[0_12px_22px_rgba(11,99,209,0.22)] transition hover:bg-[#0859bc]">
            Lưu thay đổi
          </button>
        </div>
      ) : null}
    </form>
  );
}

function inputClass(isEditing: boolean) {
  return `mt-3 w-full rounded-2xl border px-4 py-3 text-[14px] outline-none transition ${
    isEditing ? 'border-slate-200 bg-white focus:border-blue-500' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
  }`;
}

function baseFieldClass(isEditing: boolean) {
  return `w-full rounded-2xl border px-4 py-3 text-[14px] outline-none transition ${
    isEditing ? 'border-slate-200 bg-white focus:border-blue-500' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
  }`;
}

function SettingsCard({
  icon,
  title,
  titleClassName,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white px-6 py-7 shadow-[0_10px_24px_rgba(15,42,81,0.05)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="text-[#0b63d1]">{icon}</div>
        <h2 className={`text-[20px] font-bold tracking-tight ${titleClassName ?? 'text-slate-900'}`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="max-w-[420px]">
        <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-[13px] leading-6 text-slate-600">{description}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${checked ? 'bg-[#0b63d1]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

function ModeCard({
  label,
  active,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: 'light' | 'dark';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[16px] border-2 p-4 text-center transition ${active ? 'border-[#0b63d1] bg-[#eef5ff]' : 'border-transparent bg-[#eef4ff]'} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className={`flex h-[92px] items-center justify-center rounded-[12px] border ${tone === 'light' ? 'border-slate-300 bg-white text-[#0b63d1]' : 'border-slate-700 bg-[#12243b] text-white'}`}>
        <div className="text-[28px]">{tone === 'light' ? '☼' : '☾'}</div>
      </div>
      <div className={`mt-3 text-[14px] font-semibold ${active ? 'text-[#0b63d1]' : 'text-slate-800'}`}>{label}</div>
    </button>
  );
}

function ActionRow({
  title,
  value,
  input,
  error,
  isEditing,
}: {
  title: string;
  value: string;
  input: React.ReactNode;
  error?: string;
  isEditing?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-slate-100 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-[13px] text-slate-500">{value}</div>
        </div>
        <ChevronRight className={`h-4.5 w-4.5 ${isEditing ? 'text-slate-300' : 'text-slate-200'}`} />
      </div>
      {input}
      {error ? <div className="mt-2 text-[12px] font-medium text-rose-500">{error}</div> : null}
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-[12px] font-medium text-rose-500">{error}</span> : null}
    </label>
  );
}
