import React from 'react';

export default function Footer({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const nav = (view: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate?.(view);
  };

  return (
    <footer className="public-footer border-t py-8">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4 px-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[18px] font-bold tracking-tight text-[#1f67db]">ParkFlow</span>
        </div>

        <p className="text-center text-[14px] lg:text-left">© 2026 ParkFlow Management System. All rights reserved.</p>

        <div className="flex items-center justify-center gap-8 text-[14px] lg:justify-end">
          <a href="#" onClick={nav('terms')} className="transition hover:text-[#1f67db]">
            Điều khoản
          </a>
          <a href="#" onClick={nav('privacy')} className="transition hover:text-[#1f67db]">
            Bảo mật
          </a>
          <a href="#" className="transition hover:text-[#1f67db]">
            Trợ giúp
          </a>
        </div>
      </div>
    </footer>
  );
}
