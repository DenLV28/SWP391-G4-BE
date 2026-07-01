/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, LayoutDashboard, Car, LogOut, Clock, Layers, Users, Search, Plus, AlertCircle, ArrowRightCircle
} from 'lucide-react';
import { fetchParkingUsers, ParkingUser } from '../services/userService';

interface DashboardViewProps {
  userSession: {
    name: string;
    email: string;
    role?: string;
  };
  onLogOut: () => void;
}

interface ParkingLog {
  id: string;
  plate: string;
  type: 'xe-o-to' | 'xe-may' | 'xe-ban-tai' | 'xe-dien';
  action: 'check-in' | 'check-out';
  time: string;
  status: 'Thành công' | 'Bình thường';
}

export default function DashboardView({ userSession, onLogOut }: DashboardViewProps) {
  const [totalSpots, setTotalSpots] = useState(150);
  const [occupiedSpots, setOccupiedSpots] = useState(87);
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<ParkingLog[]>([]);
  const [users, setUsers] = useState<ParkingUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  const [inputPlate, setInputPlate] = useState('');
  const [inputVehicle, setInputVehicle] = useState<'xe-o-to' | 'xe-may' | 'xe-ban-tai' | 'xe-dien'>('xe-o-to');

  // Fetch stats and logs from node.js backend server
  const fetchParkingData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/parking/stats'),
        fetch('/api/parking/logs')
      ]);

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTotalSpots(stats.totalSpots);
        setOccupiedSpots(stats.occupiedSpots);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Error fetching parking data from Express:', error);
    }
  };

  const fetchUserList = async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const data = await fetchParkingUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching parking user list:', error);
      setUsersError(error instanceof Error ? error.message : 'Lỗi khi tải danh sách người dùng');
    } finally {
      setUsersLoading(false);
    }
  };

  // Run on mount and establish a 4-second sync timer (polling)
  useEffect(() => {
    fetchParkingData();
    fetchUserList();
    const interval = setInterval(() => {
      fetchParkingData();
      fetchUserList();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSimulateCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPlate.trim()) return;

    try {
      const response = await fetch('/api/parking/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate: inputPlate.trim().toUpperCase(),
          type: inputVehicle,
          action: 'check-in'
        })
      });

      if (response.ok) {
        setInputPlate('');
        // Instantly refresh
        fetchParkingData();
      }
    } catch (error) {
      console.error('Failed to dispatch simulate action:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/parking/clear', {
        method: 'POST'
      });
      if (response.ok) {
        fetchParkingData();
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const filteredLogs = logs.filter(
    log => log.plate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableSpots = totalSpots - occupiedSpots;
  const fillPercentage = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;

  const getVehicleName = (type: string) => {
    switch (type) {
      case 'xe-may': return '🏍️ Xe máy';
      case 'xe-o-to': return '🚗 Ô tô 4-7 chỗ';
      case 'xe-ban-tai': return '🚙 Bán tải';
      case 'xe-dien': return '⚡ Xe điện (EV)';
      default: return '🚗 Xe hơi';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6"
    >
      {/* Upper header action bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-park-blue-50 text-park-blue-600 flex items-center justify-center font-bold text-lg border border-park-blue-100">
            📊
          </div>
          <div>
            <h2 className="text-xl font-display font-extrabold text-park-blue-900">Bảng Quản Lý Bãi Đỗ ParkFlow</h2>
            <p className="text-sm text-gray-500">
              Chào mừng, <span className="font-semibold text-gray-800">{userSession.name}</span> ({userSession.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Hệ thống trực tuyến
          </span>
          <button
            onClick={onLogOut}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-rose-300 text-gray-600 hover:text-rose-600 font-semibold text-sm rounded-xl hover:bg-rose-50 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Grid statistics metrics overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 block uppercase tracking-wider">Tổng chỗ đỗ</span>
            <span className="text-3xl font-display font-black text-gray-900">{totalSpots}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center font-bold text-lg border border-gray-100">
            🏢
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 block uppercase tracking-wider">Số chỗ đã đỗ</span>
            <span className="text-3xl font-display font-black text-park-blue-600">{occupiedSpots}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-park-blue-50 text-park-blue-600 flex items-center justify-center font-bold text-lg border border-park-blue-100">
            🚗
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-600 block uppercase tracking-wider">Chỗ trống còn lại</span>
            <span className="text-3xl font-display font-black text-emerald-600">{availableSpots}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100">
            🟢
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tỷ lệ lấp đầy</span>
            <span className="text-sm font-bold text-park-blue-900">{fillPercentage}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                fillPercentage > 90 ? 'bg-rose-500' : fillPercentage > 70 ? 'bg-amber-500' : 'bg-park-blue-500'
              }`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Simulation Car Form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs h-fit space-y-5">
          <div>
            <h3 className="font-display font-extrabold text-gray-900 text-lg">Giả Lập Check-In Xe</h3>
            <p className="text-xs text-gray-500 mt-0.5">Mô phỏng quét camera bãi giữ xe thông minh của ParkFlow</p>
          </div>

          <form onSubmit={handleSimulateCheckIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block text-left">Nhập biển số xe giả lập</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Vd: 30F-999.99"
                  value={inputPlate}
                  onChange={(e) => setInputPlate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100/60 focus:bg-white text-gray-900 font-mono text-sm rounded-xl border border-gray-200 outline-hidden focus:ring-4 focus:ring-park-blue-100 focus:border-park-blue-500 transition-all uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block text-left">Chọn loại xe giả lập</label>
              <div className="grid grid-cols-2 gap-2">
                {(['xe-o-to', 'xe-may', 'xe-ban-tai', 'xe-dien'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInputVehicle(type)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-left flex items-center gap-2 ${
                      inputVehicle === type 
                        ? 'border-park-blue-600 bg-park-blue-50/50 text-park-blue-900' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    } transition-colors cursor-pointer`}
                  >
                    <span>{type === 'xe-o-to' ? '🚗' : type === 'xe-may' ? '🏍️' : type === 'xe-ban-tai' ? '🚙' : '⚡'}</span>
                    <span>{type === 'xe-o-to' ? 'Ô tô' : type === 'xe-may' ? 'Xe máy' : type === 'xe-ban-tai' ? 'Bán tải' : 'Xe điện'}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-park-blue-600 hover:bg-park-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Simulate Check-In
            </button>
          </form>

          <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 text-xs text-park-blue-900 leading-relaxed flex gap-3">
            <AlertCircle className="w-5 h-5 text-park-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Nhận diện bằng AI camera</p>
              <p className="text-gray-600 mt-1">Hệ thống ParkFlow tự động nhận diện biển số (ANPR/LPR) đạt độ chính xác 99.8% trong thời gian dưới 50ms.</p>
            </div>
          </div>
        </div>

        {/* Live Logs events feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold text-gray-900 text-lg">Hoạt động thời gian thực</h3>
                <p className="text-xs text-gray-500">Lịch sử xe ra vào cổng bãi đậu kiểm soát được cập nhật liên tục</p>
              </div>

              {/* Search bar inside logs */}
              <div className="relative w-full sm:w-56">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm biển số xe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 text-gray-800 text-xs rounded-lg border border-gray-200 outline-hidden focus:ring-2 focus:ring-park-blue-100 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* List entries */}
            <div className="divide-y divide-gray-100 overflow-y-auto max-h-96 pr-1">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  Không tìm thấy lịch sử xe phù hợp
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                        log.action === 'check-in' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-rose-50 text-rose-600'
                      }`}>
                        {log.action === 'check-in' ? '📥' : '📤'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 text-sm">{log.plate}</span>
                          <span className="text-[10px] text-gray-400">({getVehicleName(log.type)})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Hành động: {log.action === 'check-in' ? 'Check-in (vào bãi)' : 'Check-out (ra bãi)'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-500 font-mono block">{log.time}</span>
                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 mt-0.5 rounded bg-emerald-50 text-emerald-700">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between items-center mt-4">
            <span>Dữ liệu lưu trữ điện toán đám mây</span>
            <button 
              onClick={handleClearCache}
              className="text-park-blue-600 hover:underline hover:text-park-blue-700 font-semibold cursor-pointer"
            >
              Làm trống bộ nhớ đệm
            </button>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h3 className="font-display font-extrabold text-gray-900 text-lg">Danh sách người dùng</h3>
            <p className="text-xs text-gray-500">Kết nối với API người dùng từ backend và hiển thị danh sách</p>
          </div>
          <button
            onClick={fetchUserList}
            className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
          >
            Tải lại
          </button>
        </div>

        {usersLoading ? (
          <div className="text-sm text-gray-500">Đang tải danh sách người dùng...</div>
        ) : usersError ? (
          <div className="text-sm text-rose-600">Lỗi: {usersError}</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-gray-500">Chưa có dữ liệu người dùng.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Điện thoại</th>
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="bg-slate-50 odd:bg-white rounded-xl border border-gray-100">
                    <td className="px-3 py-2 text-xs text-gray-600 font-mono">{user.user_id}</td>
                    <td className="px-3 py-2 text-sm text-gray-800 font-semibold">{user.full_name}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{user.email}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{user.phone}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 capitalize">{user.role}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {user.active ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
