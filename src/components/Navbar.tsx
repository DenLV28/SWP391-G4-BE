/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const location = useLocation();
  return (
    <header className="bg-white shadow-sm py-2 px-4 flex items-center justify-between fixed top-0 left-0 right-0 z-20">
      <div className="flex items-center gap-2">
        <span className="text-blue-600 font-bold text-lg">ParkFlow</span>
        <nav className="hidden md:flex gap-4 ml-6 text-sm">
          <Link to="/" className={location.pathname === "/" ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1" : "hover:text-blue-600"}>Trang chủ</Link>
          <Link to="/dat-cho" className={location.pathname === "/dat-cho" ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1" : "hover:text-blue-600"}>Đặt chỗ</Link>
          <Link to="/bang-gia" className={location.pathname === "/bang-gia" ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1" : "hover:text-blue-600"}>Bảng giá</Link>
          <Link to="/lien-he" className={location.pathname === "/lien-he" ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1" : "hover:text-blue-600"}>Liên hệ</Link>
          <Link to="/gioi-thieu" className={location.pathname === "/gioi-thieu" ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1" : "hover:text-blue-600"}>Giới thiệu</Link>
        </nav>
      </div>
      <div className="flex gap-2">
        <Link to="/dang-nhap" className="text-xs text-gray-500 hover:underline">Đăng nhập</Link>
        <Link to="/dang-ky" className="text-xs text-gray-500 hover:underline">Đăng ký</Link>
      </div>
    </header>
  );
};

export default Navbar;
