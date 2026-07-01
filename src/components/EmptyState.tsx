import React from 'react';

export default function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
      <Icon className="mx-auto h-10 w-10 text-slate-300 mb-2" />
      <h4 className="text-xs font-bold text-slate-700">{title}</h4>
      <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">{description}</p>
    </div>
  );
}
