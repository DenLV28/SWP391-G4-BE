import React from 'react';

export default function StatCard({ title, value, helper, icon: Icon, accentClass, bgIconClass }: {
  title: string;
  value: string | number;
  helper?: string;
  icon: any;
  accentClass: string;
  bgIconClass: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</p>
          <p className="mt-2 text-xl font-extrabold text-slate-900 tracking-tight">{value}</p>
          {helper && <p className="mt-1 text-[10px] font-semibold text-slate-400 leading-tight">{helper}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${bgIconClass} ${accentClass} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
