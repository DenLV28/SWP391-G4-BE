/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface InfoItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export default function InfoItem({ label, value, icon }: InfoItemProps) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
