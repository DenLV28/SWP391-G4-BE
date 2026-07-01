/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export default function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-blue-300"
    >
      <div className="rounded-xl bg-blue-50 p-2 text-blue-700">{icon}</div>
      {label}
    </button>
  );
}
