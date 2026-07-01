import React from 'react';

export default function FormInput({ label, error, type = 'text', ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:ring-1 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600'}`}
        {...props}
      />
      {error && <span className="block text-[10px] font-semibold text-rose-500">{error}</span>}
    </div>
  );
}
