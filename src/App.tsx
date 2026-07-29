import React, { useState, useEffect, useRef } from "react";
import { UserCircle2 } from "lucide-react";
// Common UI components
import Topbar from "./components/Topbar";
import { AdminSidebar, DriverSidebar } from "./components/Sidebar";
import PublicNavbar from "./components/PublicNavbar";
import Footer from "./components/Footer";

// Public pages
import Homepage from "./pages/public/Homepage";
import ContactPage from "./components/ContactPage";
import ParkingInformation from "./pages/public/ParkingInformation";
import AvailableSlotsPage from "./pages/public/AvailableSlots";
import PricingRulesPage from "./pages/public/PricingRules";
import PricingDetail from "./pages/public/PricingDetail";
import TermsPage from "./pages/public/Terms";
import PrivacyPage from "./pages/public/Privacy";
import HelpPage from "./pages/public/Help";
import LoginPage from "./pages/public/Login";
import RegisterPage from "./pages/public/Register";
import ParkingLotsList from "./pages/public/ParkingLotsList";

// Driver pages
import MyParking from "./pages/driver/MyParking";
import MyReservations from "./pages/driver/MyReservations";
import PaymentsPage from "./pages/driver/Payments";
import VNPayReturn from "./pages/driver/VNPayReturn";
import FeedbackPage from "./pages/driver/Feedback";
import ProfilePage from "./pages/driver/Profile";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import RoleManagement from "./pages/admin/RoleManagement";
import SystemConfiguration from "./pages/admin/SystemConfiguration";

// Manager pages
import ManagerDashboard from "./pages/manager/ManagerDashboard";

// Staff pages
import StaffDashboard from "./pages/staff/StaffDashboard";
import type { EmergencyLog } from "./types/staff";
import { initialEmergencyLogs } from "./types/staff";

// Auth & role business rules
import { getHomeRoute, canAccessRoute, PUBLIC_ROUTES } from "./services/authService";
// Reservation persistence (driver → staff handshake, cross-tab + reload safe)
import {
  loadReservations,
  saveReservations,
  subscribeReservations,
} from "./services/reservationStore";
import {
  loadFeedbacks,
  saveFeedbacks,
  subscribeFeedbacks,
} from "./services/feedbackStore";
import {
  loadVehicles,
  saveVehicles,
  subscribeVehicles,
} from "./services/vehicleStore";
import {
  fetchVehiclesByUser,
  createVehicle,
  updateVehicle as apiUpdateVehicle,
  setDefaultVehicle as apiSetDefaultVehicle,
} from "./services/vehicleService";
import {
  fetchReservationsByUser,
  fetchAllReservations,
  createReservation as apiCreateReservation,
  updateReservation as apiUpdateReservation,
  deleteReservation as apiDeleteReservation,
  subscribeToReservationEvents,
} from "./services/reservationService";
import {
  fetchPaymentsByUser,
  fetchAllPayments,
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  deletePayment as apiDeletePayment,
  subscribeToPaymentEvents,
} from "./services/paymentService";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationEvents,
  type AppNotification,
} from "./services/notificationService";
import {
  fetchActiveSession,
  fetchActiveSessionsByUser,
  createSession as apiCreateSession,
  updateSession as apiUpdateSession,
} from "./services/sessionService";
import {
  fetchFeedbacksByUser,
  fetchAllFeedbacks,
  createFeedback as apiCreateFeedback,
  updateFeedback as apiUpdateFeedback,
} from "./services/feedbackService";
import {
  loadPayments,
  savePayments,
  subscribePayments,
} from "./services/paymentStore";
import {
  loadSessions,
  saveSessions,
  subscribeSessions,
} from "./services/sessionStore";
import userService, { UserRecord } from "./services/userService";
import { fixMojibake, nowLocalStr, localDateISO } from "./utils/helpers";
import { minutesSinceCreated, SELF_CANCEL_WINDOW_MINUTES, perVisitOverstay, buildCheckedInVehicles, isPaymentVoided, addOneMonth, findActiveMonthlyReservation } from "./utils/reservationPricing";
import { fetchSlotStatuses, updateSlotStatus, subscribeToSlotEvents, forceClearSlot } from "./services/slotService";
import { fetchPricingRules } from "./services/pricingService";
import { fetchParkingLotStatuses, updateParkingLotStatus, type ParkingLotStatus } from "./services/parkingLotService";
import { fetchIssues, apiCreateIssue, apiUpdateIssue, subscribeToIssueEvents } from "./services/issueService";
import NetworkSettings from "./components/NetworkSettings";
import { loadSlots, saveSlots, subscribeSlots } from "./services/slotStore";

// Mock data & Types & Helpers
import {
  User,
  Slot,
  Floor,
  Area,
  Reservation,
  Payment,
  Feedback,
  SavedVehicle,
  VehicleKey,
  SystemConfig,
  AdminActivity,
  ParkingSession,
  Role,
  SlotIssue,
  initialUsers,
  initialSlots,
  mockFloors,
  mockAreas,
  initialPayments,
  initialFeedbacks,
  initialSavedVehicles,
  initialSystemConfig,
  initialAdminActivities,
  initialParkingSession,
  rolesList,
  mockPricingRules,
  PricingRule,
} from "./data/mockData";
import {
  LayoutDashboard,
  ParkingCircle,
  DollarSign,
  BarChart3,
  AlertCircle,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";

const SESSION_KEY = "parkflow_current_user";

const STATUS_VI_LABEL: Record<Slot["status"], string> = {
  Available: "Trống",
  Occupied: "Đang đỗ",
  Reserved: "Đã đặt",
  Pending: "Chờ duyệt",
  Maintenance: "Bảo trì",
  Locked: "Đã khóa",
};

const normalizeRole = (role: string): Role => {
  switch (role) {
    case "System Administrator":
    case "admin":
      return "System Administrator";
    case "Parking Manager":
    case "manager":
      return "Parking Manager";
    case "Parking Staff":
    case "staff":
      return "Parking Staff";
    case "Parking User / Driver":
    case "user":
      return "Parking User / Driver";
    default:
      return "Parking User / Driver";
  }
};

const toAppUser = (record: UserRecord): User => ({
  id: String(record.id),
  fullName: fixMojibake(record.fullName),
  email: record.email,
  phone: record.phone,
  role: normalizeRole(record.role),
  status:
    record.status === "Active" ||
    record.status === "Inactive" ||
    record.status === "Locked"
      ? record.status
      : record.isActive
        ? "Active"
        : "Locked",
  assignedParkingLot: record.assignedParkingLot || '',
  createdAt: record.createdAt ? String(record.createdAt) : localDateISO(),
  passwordUpdatedAt: record.passwordUpdatedAt ?? null,
});

export default function App() {
  // Toast notifications states
  const [toasts, setToasts] = useState<
    { id: number; message: string; type: "success" | "info" | "error" }[]
  >([]);

  const addToast = (
    message: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Override window.alert
  useEffect(() => {
    window.alert = (message: string) => {
      const lowercaseMsg = message.toLowerCase();
      let type: "success" | "info" | "error" = "success";
      if (
        lowercaseMsg.includes("error") ||
        lowercaseMsg.includes("fail") ||
        lowercaseMsg.includes("not permit") ||
        lowercaseMsg.includes("cannot") ||
        lowercaseMsg.includes("incorrect") ||
        lowercaseMsg.includes("required") ||
        lowercaseMsg.includes("invalid") ||
        lowercaseMsg.includes("choose") ||
        lowercaseMsg.includes("select") ||
        lowercaseMsg.includes("first to reserve") ||
        lowercaseMsg.includes("không thể") ||
        lowercaseMsg.includes("không được") ||
        lowercaseMsg.includes("chỉ có thể") ||
        lowercaseMsg.includes("không hợp lệ") ||
        lowercaseMsg.includes("thất bại") ||
        lowercaseMsg.includes("lỗi") ||
        lowercaseMsg.includes("quá sớm") ||
        lowercaseMsg.includes("quá thời gian") ||
        lowercaseMsg.includes("không tồn tại") ||
        lowercaseMsg.includes("không hoạt động")
      ) {
        type = "error";
      } else if (
        lowercaseMsg.includes("info") ||
        lowercaseMsg.includes("notice") ||
        lowercaseMsg.includes("cancelled") ||
        lowercaseMsg.includes("đã hủy")
      ) {
        type = "info";
      }
      addToast(message, type);
    };
  }, []);

  // Navigation & User Portal States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as User;
      return parsed && parsed.email && parsed.role ? parsed : null;
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });
  const [currentView, setCurrentView] = useState<string>("home");
  const [interfaceMode, setInterfaceMode] = useState<"light" | "dark">(
    initialSystemConfig.interfaceMode ?? "light",
  );

  const setView = (view: string) => {
    window.location.hash = `#/${view}`;
  };

  // Sync view state with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\//, "");
      const validViews = [
        "home", "baixe", "info", "slots", "pricing", "pricing-detail", "contact", "login", "register",
        "terms", "privacy", "help",
        "myparking", "reservations", "payments", "feedback", "profile", "vnpay-return",
        "admindashboard", "usermanagement", "rolemanagement", "systemconfig",
        "managerdashboard", "parkinglots", "parkinglotdetail", "pricing-vehicles", "reports", "monthlycards", "exceptions",
        "staffdashboard", "gatecontrol", "parkingmonitor", "activitylog", "emergency",
      ];

      const targetView = (hash || "home").split("?")[0];

      if (!validViews.includes(targetView)) {
        setCurrentView("home");
        window.location.hash = "#/home";
        return;
      }

      if (!currentUser) {
        const isProtectedRoute = [
          "myparking", "reservations", "payments", "feedback", "profile",
          "admindashboard", "usermanagement", "rolemanagement", "systemconfig",
          "managerdashboard", "parkinglots", "parkinglotdetail", "pricing-vehicles", "reports", "monthlycards", "exceptions",
          "staffdashboard", "gatecontrol", "parkingmonitor", "activitylog", "emergency",
        ].includes(targetView);

        if (isProtectedRoute) {
          setCurrentView("login");
          window.location.hash = "#/login";
        } else {
          setCurrentView(targetView);
        }
        return;
      }

      // User is logged in — enforce per-role business rules via authService
      const isPublicRoute = PUBLIC_ROUTES.includes(targetView);

      if (isPublicRoute) {
        setCurrentView(targetView);
      } else if (canAccessRoute(currentUser.role, targetView)) {
        setCurrentView(targetView);
      } else {
        const home = getHomeRoute(currentUser.role);
        setCurrentView(home);
        window.location.hash = `#/${home}`;
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [currentUser]);

  // Application Mock Database States
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [slots, setSlots] = useState<Slot[]>(() => loadSlots() ?? initialSlots);
  const skipNextSlotSave = useRef(false);

  // Persist slots to localStorage on every change so other tabs pick it up instantly.
  // Guard against writing an empty array (which would poison future loads).
  useEffect(() => {
    if (skipNextSlotSave.current) { skipNextSlotSave.current = false; return; }
    if (slots.length > 0) saveSlots(slots);
  }, [slots]);

  // Pick up slot changes made in other tabs (cross-role sync via localStorage).
  useEffect(() => {
    const unsubscribe = subscribeSlots((next) => {
      skipNextSlotSave.current = true;
      setSlots(next);
    });
    return unsubscribe;
  }, []);

  // SSE: receive instant slot-status pushes from the backend whenever any client
  // updates a slot on any machine. This is the primary cross-machine sync mechanism.
  useEffect(() => {
    const cleanup = subscribeToSlotEvents((slotCode, status) => {
      setSlots((prev) =>
        prev.map((s) => (s.slotCode === slotCode ? { ...s, status } : s)),
      );
    });
    return cleanup;
  }, []);

  // SSE: push a payment the instant it's created or its status changes (e.g. a
  // user finishes VNPay checkout) so Staff/Manager see it immediately instead
  // of waiting on the 10s poll — and so the paying user's own other tabs/devices
  // pick it up right away too.
  useEffect(() => {
    const cleanup = subscribeToPaymentEvents((payment) => {
      setPayments((prev) => {
        const idx = prev.findIndex((p) => p.id === payment.id);
        if (idx === -1) return [payment, ...prev];
        const next = [...prev];
        next[idx] = payment;
        return next;
      });
    });
    return cleanup;
  }, []);

  // Poll DB every 30 s as a reliable fallback (covers SSE failures, ngrok drops, reconnects).
  useEffect(() => {
    const sync = async () => {
      const dbSlots = await fetchSlotStatuses();
      if (!dbSlots.length) return;
      // DB là nguồn chân lý cho kho ô đỗ: cập nhật status + parkingLot cho ô đã
      // có, BỔ SUNG ô chỉ tồn tại trong DB (TD-*/LP-* của Thủ Đức & Long Phước)
      // và LOẠI ô đã bị xóa khỏi DB (mỗi bãi sức chứa khác nhau, localStorage
      // cũ có thể còn ô ma) — nhờ vậy sơ đồ 3 bãi đồng bộ cho User/Staff/Manager.
      setSlots((prev) => {
        const known = new Set(prev.map((s) => s.slotCode));
        const dbCodes = new Set(dbSlots.map((d) => d.slotCode));
        const merged = prev
          .filter((s) => dbCodes.has(s.slotCode))
          .map((s) => {
            const db = dbSlots.find((d) => d.slotCode === s.slotCode);
            if (!db) return s;
            const statusChanged = db.status !== s.status;
            const lotChanged = !!db.parkingLot && db.parkingLot !== s.parkingLot;
            if (!statusChanged && !lotChanged) return s;
            return { ...s, status: db.status, parkingLot: db.parkingLot ?? s.parkingLot };
          });
        const additions = dbSlots.filter((d) => !known.has(d.slotCode));
        return additions.length ? [...merged, ...additions] : merged;
      });
    };
    // Pricing rides the same interval — Manager's edits show up for Staff/User
    // without a full reload, no need for a separate timer.
    const syncPricing = async () => {
      const dbRules = await fetchPricingRules();
      if (dbRules.length) setPricingRules(dbRules);
    };
    // Same for lot status (Hoạt động/Bảo trì) — Manager flips a lot to
    // maintenance, User/Staff see it within 30s without reloading.
    const syncLotStatuses = async () => {
      const dbLots = await fetchParkingLotStatuses();
      if (dbLots.length) setLotStatuses(dbLots);
    };
    sync();
    syncPricing();
    syncLotStatuses();
    const id = setInterval(() => { sync(); syncPricing(); syncLotStatuses(); }, 30000);
    return () => clearInterval(id);
  }, []);

  // Issues state — loaded from DB on mount, kept in sync via SSE
  const [issues, setIssues] = useState<SlotIssue[]>([]);

  useEffect(() => {
    fetchIssues().then((data) => { if (data.length) setIssues(data); });
  }, []);

  useEffect(() => {
    const cleanup = subscribeToIssueEvents((partial) => {
      setIssues((prev) => {
        const idx = prev.findIndex((i) => i.id === partial.id);
        if (idx === -1) return [partial as SlotIssue, ...prev];
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...partial };
        return updated;
      });
    });
    return cleanup;
  }, []);

  const handleCreateIssue = async (issue: Omit<SlotIssue, 'id' | 'reportedAt' | 'status'>) => {
    const created = await apiCreateIssue(issue);
    if (!created) throw new Error('Không kết nối được tới máy chủ. Vui lòng kiểm tra backend.');
    setIssues((prev) => [created, ...prev]);
  };

  const applyIssueStatus = (id: string, status: SlotIssue['status']) => {
    const previous = issues.find((i) => i.id === id)?.status;
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    apiUpdateIssue(id, { status }).then((ok) => {
      if (!ok && previous) {
        setIssues((prev) => prev.map((i) => i.id === id ? { ...i, status: previous } : i));
        addToast('Không thể cập nhật sự cố. Vui lòng thử lại.', 'error');
      }
    });
  };

  const handleApproveIssue = (id: string) => {
    applyIssueStatus(id, 'Approved');
    const issue = issues.find((i) => i.id === id);
    if (issue?.slotCode) {
      setSlots((prev) => prev.map((s) => s.slotCode === issue.slotCode ? { ...s, status: 'Maintenance' } : s));
      updateSlotStatus(issue.slotCode, 'Maintenance').catch(() => {});
    }
  };

  const handleRejectIssue = (id: string) => {
    applyIssueStatus(id, 'Rejected');
    const issue = issues.find((i) => i.id === id);
    if (issue?.slotCode) {
      setSlots((prev) => prev.map((s) => s.slotCode === issue.slotCode ? { ...s, status: 'Available' } : s));
      updateSlotStatus(issue.slotCode, 'Available').catch(() => {});
    }
  };

  const handleRestoreIssue = (id: string) => {
    const issue = issues.find((i) => i.id === id);
    if (issue?.slotCode) {
      setSlots((prev) => prev.map((s) => s.slotCode === issue.slotCode ? { ...s, status: 'Available' } : s));
      updateSlotStatus(issue.slotCode, 'Available').catch(() => {});
    }
    applyIssueStatus(id, 'Resolved');
  };

  // Staff/Manager-only: force an Occupied slot back to Available (backend also
  // enforces the role check and closes any linked active session). Returns
  // whether it succeeded so the calling panel can keep its dialog open on failure.
  const handleForceClearSlot = async (slotCode: string, reason: string): Promise<boolean> => {
    if (!currentUser) return false;
    const result = await forceClearSlot(slotCode, currentUser.id, reason);
    if (result.ok === true) {
      setSlots((prev) => prev.map((s) => (s.slotCode === slotCode ? { ...s, status: 'Available' } : s)));
      addToast(
        result.sessionClosed
          ? `Đã buộc dọn ô ${slotCode} và đóng phiên gửi xe${result.licensePlate ? ` (${result.licensePlate})` : ''}.`
          : `Đã buộc dọn ô ${slotCode}.`,
        'success',
      );
      return true;
    }
    addToast(result.ok === false ? result.error : 'Không thể buộc dọn ô đỗ.', 'error');
    return false;
  };

  // Manual override from the live floor map (Quản lý Sự cố) — sets a slot to
  // any status directly, unlike Force Clear which only does Occupied→Available.
  const handleSetSlotStatus = async (slotCode: string, status: Slot['status']): Promise<boolean> => {
    try {
      await updateSlotStatus(slotCode, status);
      setSlots((prev) => prev.map((s) => (s.slotCode === slotCode ? { ...s, status } : s)));
      addToast(`Đã đổi trạng thái ô ${slotCode} sang "${STATUS_VI_LABEL[status]}".`, 'success');
      return true;
    } catch {
      addToast(`Không thể đổi trạng thái ô ${slotCode}.`, 'error');
      return false;
    }
  };

  // Polling fallback: re-fetch issues every 30 s to catch any SSE misses.
  useEffect(() => {
    const sync = async () => {
      const data = await fetchIssues();
      if (!data.length) return;
      setIssues((prev) => {
        const byId = new Map(prev.map((i) => [i.id, i]));
        let changed = false;
        data.forEach((d) => {
          const existing = byId.get(d.id);
          if (!existing || existing.status !== d.status) { byId.set(d.id, d); changed = true; }
        });
        return changed ? [...byId.values()].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)) : prev;
      });
    };
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, []);

  const [emergencyLogs, setEmergencyLogs] = useState<EmergencyLog[]>(initialEmergencyLogs);
  const [floors, setFloors] = useState<Floor[]>(mockFloors);
  const [areas, setAreas] = useState<Area[]>(mockAreas);
  const [reservations, setReservations] =
    useState<Reservation[]>(() => loadReservations() ?? []);
  // When a change arrives from another tab we apply it without re-persisting,
  // so two tabs don't ping-pong saves back and forth.
  const skipNextReservationSave = useRef(false);

  // In-flight "create" POSTs, keyed by local reservation id. A discard fired
  // right after booking (Hủy đặt chỗ / X on the success modal) must wait for
  // its matching create to land before deleting — otherwise the DELETE can
  // reach the server before the POST commits, becomes a no-op, and the
  // reservation survives as an orphaned Pending row that staff still sees.
  const pendingReservationCreates = useRef<Map<string, Promise<void>>>(new Map());

  // IDs of reservations the user explicitly cleared — persisted in localStorage so
  // polling cannot bring them back, even if the DB update is delayed or fails.
  const hiddenResIds = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('pf_hidden_res') || '[]') as string[])
  );
  const addHiddenResIds = (ids: string[]) => {
    ids.forEach((id) => hiddenResIds.current.add(id));
    localStorage.setItem('pf_hidden_res', JSON.stringify([...hiddenResIds.current]));
  };

  // IDs of payments a driver cleared from their own "Thanh toán" history —
  // hides them from that driver's view only. Deliberately NOT deleted from
  // dbo.payments: the row is shared revenue data Staff/Manager still need for
  // the wallet/accounting totals, so a personal declutter action must not
  // destroy it for everyone else.
  const hiddenPaymentIds = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('pf_hidden_payments') || '[]') as string[])
  );
  const addHiddenPaymentIds = (ids: string[]) => {
    ids.forEach((id) => hiddenPaymentIds.current.add(id));
    localStorage.setItem('pf_hidden_payments', JSON.stringify([...hiddenPaymentIds.current]));
  };

  const [feedbacks, setFeedbacks] = useState<Feedback[]>(
    () => loadFeedbacks() ?? initialFeedbacks,
  );
  const skipNextFeedbackSave = useRef(false);
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>(
    () => loadVehicles() ?? initialSavedVehicles,
  );
  const skipNextVehicleSave = useRef(false);
  const [payments, setPayments] = useState<Payment[]>(
    () => loadPayments() ?? initialPayments,
  );
  const skipNextPaymentSave = useRef(false);
  // Live pricing from dbo.pricing_rules — Manager edits it, Staff/User both read
  // it. Starts from the mock table so the UI has numbers before the fetch
  // resolves, then gets replaced with the real DB values.
  const [pricingRules, setPricingRules] = useState<PricingRule[]>(mockPricingRules);
  // Trạng thái vận hành (Hoạt động/Bảo trì/Đóng cửa) của 3 bãi — nguồn chân lý
  // duy nhất cho việc chặn đặt chỗ (user) và khóa thao tác (staff) khi bãi
  // đang bảo trì. Trước đây chỉ là state cục bộ trong ManagerParkingLots.tsx.
  const [lotStatuses, setLotStatuses] = useState<ParkingLotStatus[]>([]);
  const [systemConfig, setSystemConfig] =
    useState<SystemConfig>(initialSystemConfig);
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>(
    initialAdminActivities,
  );
  const [currentSession, setCurrentSession] = useState<ParkingSession>(() => {
    const sessions = loadSessions();
    return sessions?.[0] ?? initialParkingSession;
  });
  // currentSession chỉ theo dõi MỘT vé (thiết kế ban đầu: mỗi tài khoản một
  // xe) — một tài khoản có thể có nhiều xe cùng đỗ (vd. xe đăng ký hộ người
  // khác), nên "Xe đang đỗ tại bãi" của driver cần TOÀN BỘ danh sách này,
  // không chỉ currentSession.
  const [driverActiveSessions, setDriverActiveSessions] = useState<ParkingSession[]>([]);
  const skipNextSessionSave = useRef(false);

  useEffect(() => {
    setInterfaceMode(systemConfig.interfaceMode ?? "light");
  }, [systemConfig.interfaceMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", interfaceMode);
  }, [interfaceMode]);

  // Persist reservations on every change so a driver's booking survives reload
  // and is visible to staff (even in another tab / after re-login).
  useEffect(() => {
    if (skipNextReservationSave.current) {
      skipNextReservationSave.current = false;
      return;
    }
    saveReservations(reservations);
  }, [reservations]);

  // Pick up reservation changes made in other tabs without re-persisting them.
  useEffect(() => {
    const unsubscribe = subscribeReservations((next) => {
      skipNextReservationSave.current = true;
      setReservations(next);
    });
    return unsubscribe;
  }, []);

  // Đồng bộ thời gian thực giữa driver ↔ staff/manager qua server push (SSE):
  // user đặt chỗ → staff thấy yêu cầu ngay; staff xác nhận/hủy → driver thấy
  // ngay — không phải chờ chu kỳ poll 10 giây. Poll vẫn giữ nguyên làm lưới an
  // toàn khi mất kết nối SSE tạm thời.
  useEffect(() => {
    const unsubscribe = subscribeToReservationEvents((e) => {
      skipNextReservationSave.current = true;
      if (e.type === 'deleted') {
        setReservations((prev) => prev.filter((r) => r.id !== e.id));
      } else {
        setReservations((prev) => {
          const idx = prev.findIndex((r) => r.id === e.reservation.id);
          if (idx === -1) return [e.reservation, ...prev];
          const next = [...prev];
          next[idx] = e.reservation;
          return next;
        });
      }
    });
    return unsubscribe;
  }, []);

  // Persist feedbacks so driver→staff handshake works across tabs and re-logins.
  useEffect(() => {
    if (skipNextFeedbackSave.current) {
      skipNextFeedbackSave.current = false;
      return;
    }
    saveFeedbacks(feedbacks);
  }, [feedbacks]);

  // Pick up feedback changes made in other tabs without re-persisting them.
  useEffect(() => {
    const unsubscribe = subscribeFeedbacks((next) => {
      skipNextFeedbackSave.current = true;
      setFeedbacks(next);
    });
    return unsubscribe;
  }, []);

  // Persist savedVehicles across reloads and tabs.
  useEffect(() => {
    if (skipNextVehicleSave.current) { skipNextVehicleSave.current = false; return; }
    saveVehicles(savedVehicles);
  }, [savedVehicles]);

  useEffect(() => {
    const unsubscribe = subscribeVehicles((next) => {
      skipNextVehicleSave.current = true;
      setSavedVehicles(next);
    });
    return unsubscribe;
  }, []);

  // Sync vehicle list from backend whenever the logged-in user changes.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Parking User / Driver') return;
    fetchVehiclesByUser(currentUser.id)
      .then((apiVehicles) => {
        if (apiVehicles.length === 0) return;
        setSavedVehicles((prev) => {
          const otherUsers = prev.filter((v) => v.userId !== currentUser.id);
          return [...otherUsers, ...apiVehicles];
        });
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // Sync ALL data from DB on login — ensures cross-device consistency.
  useEffect(() => {
    if (!currentUser) return;
    const isDriver = currentUser.role === 'Parking User / Driver';
    const isStaffOrManager =
      currentUser.role === 'Parking Staff' || currentUser.role === 'Parking Manager';

    if (isDriver) {
      const uid = currentUser.id;

      fetchReservationsByUser(uid)
        .then((apiRes) => {
          if (apiRes.length === 0) return;
          const visible = apiRes.filter((r) => !hiddenResIds.current.has(r.id));
          setReservations((prev) => {
            const others = prev.filter((r) => r.userId !== uid);
            return [...visible, ...others];
          });
        })
        .catch(() => {});

      fetchPaymentsByUser(uid)
        .then((apiPay) => {
          if (apiPay.length === 0) return;
          setPayments((prev) => {
            const others = prev.filter((p) => p.userId !== uid);
            return [...apiPay, ...others];
          });
        })
        .catch(() => {});

      fetchActiveSession(uid)
        .then((apiSession) => {
          if (!apiSession) {
            // No Active session in DB for this user. This effect only runs once
            // per login/page-load, so a "Hoàn tất" confirmation shown right after
            // an in-app checkout has already had its moment on screen — a fresh
            // load (reload, re-login) should reflect DB truth and not keep
            // resurrecting a Completed session from localStorage indefinitely.
            setCurrentSession((prev) => ({
              ...prev,
              userId: uid,
              ticketCode: '',
              sessionStatus: 'Cancelled',
              paymentStatus: 'Unpaid',
              barrierStatus: 'Closed',
            }));
            return;
          }
          setCurrentSession((prev) => {
            // Guard against a race with the VNPay-return flow: that flow marks
            // the session Paid locally and fires its own apiUpdateSession, but
            // doesn't wait for it — if this GET (kicked off on the same mount,
            // e.g. right after returning from VNPay) resolves first, it would
            // read the not-yet-committed "Unpaid" row and revert the just-paid
            // session, leaving "Mở barie" stuck locked despite a real payment.
            if (
              prev.ticketCode === (apiSession as any).ticketCode &&
              prev.paymentStatus === 'Paid' &&
              (apiSession as any).paymentStatus !== 'Paid'
            ) {
              return prev;
            }
            return apiSession as any;
          });
        })
        .catch(() => {});

      fetchActiveSessionsByUser(uid)
        .then((apiSessions) => setDriverActiveSessions(apiSessions as any))
        .catch(() => {});

      fetchFeedbacksByUser(uid)
        .then((apiFb) => {
          if (apiFb.length === 0) return;
          setFeedbacks((prev) => {
            const others = prev.filter((f) => f.userId !== uid);
            return [...apiFb, ...others];
          });
        })
        .catch(() => {});
    }

    if (isStaffOrManager) {
      fetchAllReservations()
        .then((apiRes) => {
          if (apiRes.length === 0) return;
          setReservations(apiRes);
        })
        .catch(() => {});

      fetchAllFeedbacks()
        .then((apiFb) => {
          if (apiFb.length === 0) return;
          setFeedbacks(apiFb);
        })
        .catch(() => {});

      fetchAllPayments()
        .then((apiPay) => {
          if (apiPay.length === 0) return;
          setPayments(apiPay);
        })
        .catch(() => {});
    }
  }, [currentUser?.id]);

  // Poll backend every 10 s to pick up data created on other devices/browsers.
  // localStorage events only fire within the same browser, so without this
  // a staff member on Machine A never sees reservations/feedbacks submitted
  // from a user on Machine B.
  useEffect(() => {
    if (!currentUser) return;
    const isDriver = currentUser.role === 'Parking User / Driver';
    const isStaffOrManager =
      currentUser.role === 'Parking Staff' || currentUser.role === 'Parking Manager';
    if (!isDriver && !isStaffOrManager) return;

    const poll = async () => {
      try {
        if (isDriver) {
          const uid = currentUser.id;
          const [apiRes, apiFb] = await Promise.all([
            fetchReservationsByUser(uid),
            fetchFeedbacksByUser(uid),
          ]);
          if (apiRes.length > 0) {
            const visible = apiRes.filter((r) => !hiddenResIds.current.has(r.id));
            setReservations((prev) => {
              const others = prev.filter((r) => r.userId !== uid);
              return [...visible, ...others];
            });
          }
          if (apiFb.length > 0) {
            setFeedbacks((prev) => {
              const others = prev.filter((f) => f.userId !== uid);
              return [...apiFb, ...others];
            });
          }
          // Heal a stale local session: the DB may hold an Active session this
          // tab isn't tracking (e.g. it was restored/created elsewhere after this
          // page load nulled currentSession). Only adopt when we're not already
          // tracking a live session ourselves — never stomp same-ticket local
          // state, where an in-flight checkout PUT could get resurrected.
          const apiSession = await fetchActiveSession(uid);
          if (apiSession) {
            setCurrentSession((prev) => {
              if (prev.ticketCode === (apiSession as any).ticketCode) return prev;
              if (prev.ticketCode && prev.sessionStatus === 'Active') return prev;
              return apiSession as any;
            });
          }
          fetchActiveSessionsByUser(uid)
            .then((apiSessions) => setDriverActiveSessions(apiSessions as any))
            .catch(() => {});
        }
        if (isStaffOrManager) {
          const [apiRes, apiFb, apiPay] = await Promise.all([
            fetchAllReservations(),
            fetchAllFeedbacks(),
            fetchAllPayments(),
          ]);
          if (apiRes.length > 0) setReservations(apiRes);
          if (apiFb.length > 0) setFeedbacks(apiFb);
          if (apiPay.length > 0) setPayments(apiPay);
        }
      } catch {
        // API không khả dụng — tiếp tục chạy với dữ liệu đã cache
      }
    };

    const intervalId = window.setInterval(poll, 10_000);
    return () => window.clearInterval(intervalId);
  }, [currentUser?.id, currentUser?.role]);

  // Persist payments across reloads and tabs.
  useEffect(() => {
    if (skipNextPaymentSave.current) { skipNextPaymentSave.current = false; return; }
    savePayments(payments);
  }, [payments]);

  useEffect(() => {
    const unsubscribe = subscribePayments((next) => {
      skipNextPaymentSave.current = true;
      setPayments(next);
    });
    return unsubscribe;
  }, []);

  // Persist parking session across reloads and tabs.
  useEffect(() => {
    if (skipNextSessionSave.current) { skipNextSessionSave.current = false; return; }
    saveSessions([currentSession]);
  }, [currentSession]);

  useEffect(() => {
    const unsubscribe = subscribeSessions((next) => {
      if (next[0]) {
        skipNextSessionSave.current = true;
        setCurrentSession(next[0]);
      }
    });
    return unsubscribe;
  }, []);

  // Auto-detect pre-paid sessions: if an active session's licence plate matches a reservation
  // (Checked-in OR Confirmed) that already has a Paid payment, mark the session as Paid automatically.
  // We also accept 'Confirmed' because pre-payment happens before check-in, and DB polling may
  // temporarily revert the reservation back to 'Confirmed' before the auto-detect fires.
  useEffect(() => {
    if (currentSession.sessionStatus !== 'Active' || currentSession.paymentStatus === 'Paid') return;
    const matchedReservation = reservations.find(
      (r) =>
        r.licensePlate.trim().toLowerCase() === currentSession.licensePlate.trim().toLowerCase() &&
        (r.status === 'Checked-in' || r.status === 'Confirmed'),
    );
    if (!matchedReservation) return;
    const prePaidPayment = payments.find(
      (p) =>
        p.status === 'Paid' &&
        (p.reservationCode === matchedReservation.reservationCode || p.ticketCode === matchedReservation.reservationCode),
    );
    if (prePaidPayment) {
      setCurrentSession((prev) => ({ ...prev, paymentStatus: 'Paid' }));
      // Address the session by ticketCode, not currentSession.id: sessions created
      // in this tab still carry the local "SES-..." id (the DB row got a numeric
      // one), and a PUT against that unknown id 404s silently — leaving the DB
      // Unpaid so the paid state resurrects as unpaid on the next reload.
      apiUpdateSession(currentSession.ticketCode, {
        paymentStatus: 'Paid',
        paymentMethod: (prePaidPayment.method as any) || 'VNPay',
      }).catch(() => {});
    }
  }, [currentSession.sessionStatus, currentSession.paymentStatus, currentSession.licensePlate, payments, reservations]);

  useEffect(() => {
    const syncUsers = async () => {
      try {
        const remoteUsers = await userService.fetchUsers();
        const mappedUsers = remoteUsers.map(toAppUser);

        // Merge API users into local users — preserve local IDs so every
        // userId-based filter (vehicles, reservations, payments) keeps working.
        setUsers((prev) => {
          const merged = [...prev];
          mappedUsers.forEach((apiUser) => {
            const idx = merged.findIndex(
              (u) => u.email.toLowerCase() === apiUser.email.toLowerCase(),
            );
            if (idx >= 0) {
              // Refresh live fields but keep the local ID.
              merged[idx] = {
                ...merged[idx],
                fullName: apiUser.fullName,
                phone: apiUser.phone,
                role: apiUser.role,
                status: apiUser.status,
                assignedParkingLot: apiUser.assignedParkingLot,
              };
            } else {
              merged.push(apiUser);
            }
          });
          return merged;
        });

        if (currentUser) {
          const latestUser = mappedUsers.find(
            (user) =>
              user.id === currentUser.id ||
              user.email.toLowerCase() === currentUser.email.toLowerCase(),
          );

          // User not found in API → locally-created account; keep the session.
          if (!latestUser) return;

          // Only force-logout when the API explicitly marks the account inactive.
          if (latestUser.status !== "Active") {
            setCurrentUser(null);
            window.localStorage.removeItem(SESSION_KEY);
            return;
          }

          // Refresh display fields while preserving the local ID.
          // assignedParkingLot: staff đang đăng nhập nhận phân công bãi mới của
          // manager trong vòng 5s, không cần đăng nhập lại.
          if (
            latestUser.fullName !== currentUser.fullName ||
            latestUser.role !== currentUser.role ||
            latestUser.phone !== currentUser.phone ||
            latestUser.status !== currentUser.status ||
            (latestUser.assignedParkingLot || '') !== (currentUser.assignedParkingLot || '')
          ) {
            const refreshedUser: User = {
              ...currentUser,
              fullName: latestUser.fullName,
              phone: latestUser.phone,
              role: latestUser.role,
              status: latestUser.status,
              assignedParkingLot: latestUser.assignedParkingLot,
            };
            setCurrentUser(refreshedUser);
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(refreshedUser));
          }
        }
      } catch {
        // API unreachable — keep running on local data, no logout.
      }
    };

    syncUsers();
    const intervalId = window.setInterval(syncUsers, 5000);
    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  // Authentication operations
  const handleLogin = (user: User) => {
    // Find matching local user by email to merge supplemental fields (password cache, etc.)
    // but always use the API user's id so vehicle/reservation fetches hit the correct DB row.
    const localUser = users.find(
      (u) => u.email.toLowerCase() === user.email.toLowerCase(),
    );
    const merged: User = localUser
      ? { ...localUser, ...user }
      : user;
    setCurrentUser(merged);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    // Clear stale session that belongs to a different user
    setCurrentSession((prev) => {
      if (prev.userId !== merged.id) {
        return { ...prev, userId: merged.id, ticketCode: '', sessionStatus: 'Cancelled', paymentStatus: 'Unpaid', barrierStatus: 'Closed' };
      }
      return prev;
    });
    setView(getHomeRoute(merged.role));
  };

  const handleRegister = (newUser: User, plateNumber?: string, vehicleType?: string, brand?: string, model?: string) => {
    setUsers((prev) => [newUser, ...prev]);
    if (plateNumber && vehicleType) {
      const newVehicle = {
        id: `SV-${Date.now()}`,
        userId: newUser.id,
        licensePlate: plateNumber,
        vehicleType: vehicleType as any,
        brand: brand ?? '',
        model: model ?? '',
        isDefault: true,
      };
      setSavedVehicles((prev) => [...prev, newVehicle]);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    window.localStorage.removeItem(SESSION_KEY);
    setView("home");
  };

  // Driver actions
  // slotsOverride: dùng khi caller vừa fetch riêng một bản ô đỗ MỚI NHẤT từ
  // backend (vd. handleMonthlyBookingPaid, chạy sau khi quay lại từ VNPay —
  // tại thời điểm đó `slots` trong closure có thể vẫn là bản cache cũ từ
  // localStorage vì App vừa mount lại, effect fetch tươi chưa kịp chạy xong).
  // Không có override thì dùng state hiện tại như trước giờ.
  const handleAddReservation = (newRes: any, slotsOverride?: Slot[]): Reservation | null => {
    const slotPool = slotsOverride ?? slots;
    // A physical vehicle can't be booked/parked in two places at once — block a
    // second reservation for the same plate while one is still pending or the
    // car is already checked in, otherwise check-in later produces two live
    // sessions for the same plate (looks like a "phantom" duplicate vehicle).
    const normalizedPlate = String(newRes.licensePlate || '').trim().toUpperCase().replace(/\s+/g, '');
    const conflicting = normalizedPlate
      ? reservations.find(
          (r) =>
            String(r.licensePlate || '').trim().toUpperCase().replace(/\s+/g, '') === normalizedPlate &&
            (r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Checked-in'),
        )
      : undefined;
    if (conflicting) {
      alert(
        conflicting.status === 'Checked-in'
          ? `Xe ${newRes.licensePlate} hiện đang đỗ trong bãi (vé ${conflicting.reservationCode}). Vui lòng cho xe ra trước khi đặt chỗ mới.`
          : `Xe ${newRes.licensePlate} đã có một đặt chỗ khác đang chờ (${conflicting.reservationCode}). Vui lòng hủy đặt chỗ cũ trước khi đặt chỗ mới.`,
      );
      return null;
    }
    // Xe vào bãi không qua đặt chỗ (khách vãng lai) chỉ có bản ghi trong
    // parking_sessions, không nằm trong reservations — vẫn phải chặn đặt chỗ
    // mới cho những xe này, nếu không "conflicting" ở trên bỏ sót và xe đang
    // thực sự nằm trong bãi vẫn đặt tiếp được như trong ảnh chụp báo lỗi.
    const conflictingSession = normalizedPlate
      ? driverActiveSessions.find(
          (s) =>
            s.sessionStatus === 'Active' &&
            String(s.licensePlate || '').trim().toUpperCase().replace(/\s+/g, '') === normalizedPlate,
        )
      : undefined;
    if (conflictingSession) {
      alert(`Xe ${newRes.licensePlate} hiện đang đỗ trong bãi (vé ${conflictingSession.ticketCode}). Vui lòng cho xe ra trước khi đặt chỗ mới.`);
      return null;
    }
    // Thẻ tháng: mỗi xe chỉ 1 thẻ còn hiệu lực tại một thời điểm. Không dựa
    // vào check "Pending/Confirmed/Checked-in" ở trên vì thẻ tháng dao động
    // qua lại Checked-in/Completed mỗi lần xe ra/vào trong tháng — "Completed"
    // không có nghĩa thẻ đã hết hạn, nên cần check riêng theo ngày hết hạn.
    if (newRes.note === 'Theo tháng') {
      const existingMonthly = findActiveMonthlyReservation(newRes.licensePlate, reservations);
      if (existingMonthly) {
        alert(
          `Xe ${newRes.licensePlate} đang có một thẻ tháng còn hiệu lực (${existingMonthly.reservationCode}, hết hạn ${addOneMonth(existingMonthly.date.split('T')[0])}). Vui lòng đợi thẻ hết hạn rồi mới đặt lại.`,
        );
        return null;
      }
    }

    const code = `RSV-${Math.floor(1000 + Math.random() * 9000)}`;
    let assignedSlotCode = newRes.slotCode;

    if (!assignedSlotCode && newRes.slotAssignmentMode === "Auto") {
      const availableSlot = slotPool.find(
        (s) =>
          s.floorName === newRes.floor &&
          s.areaName === newRes.area &&
          s.vehicleType === newRes.vehicleType &&
          s.status === "Available",
      );
      if (availableSlot) {
        assignedSlotCode = availableSlot.slotCode;
      } else {
        // Không khớp đúng khu/tầng đã chọn lúc đặt (vd. dữ liệu ô đỗ đổi khác
        // trong lúc khách thao tác trên VNPay) — vẫn cố xếp một ô Trống bất kỳ
        // cùng loại xe, còn hơn để đặt chỗ không có ô nào (bãi không cập nhật).
        const fallbackSlot = slotPool.find(
          (s) => s.vehicleType === newRes.vehicleType && s.status === "Available",
        );
        if (fallbackSlot) assignedSlotCode = fallbackSlot.slotCode;
      }
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const r: Reservation = {
      id: `RSV-${Date.now()}`,
      userId: currentUser?.id || "GUEST",
      reservationCode: code,
      // New bookings arrive as a request; staff confirms them from the Staff portal.
      status: "Pending",
      ...newRes,
      slotCode: assignedSlotCode,
      createdAt,
    };

    setReservations((prev) => [r, ...prev]);

    // Persist to DB (local state is already updated). The promise is tracked
    // so a discard fired right after this (see handleDiscardReservation) can
    // wait for it instead of racing it.
    const createPromise = apiCreateReservation(r).then(
      () => {},
      () => {},
    );
    pendingReservationCreates.current.set(r.id, createPromise);
    createPromise.finally(() => {
      if (pendingReservationCreates.current.get(r.id) === createPromise) {
        pendingReservationCreates.current.delete(r.id);
      }
    });

    // Update areas slots stats
    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === newRes.area) {
          return {
            ...a,
            availableSlots: Math.max(0, a.availableSlots - 1),
            reservedSlots: a.reservedSlots + 1,
          };
        }
        return a;
      }),
    );

    // Update floors slots stats
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === newRes.floor) {
          return {
            ...f,
            availableSlots: Math.max(0, f.availableSlots - 1),
            reservedSlots: f.reservedSlots + 1,
          };
        }
        return f;
      }),
    );

    // Thẻ tháng đã thanh toán xong (không phải "chờ duyệt" như đặt chỗ
    // thường) → đánh dấu ô đỗ "Locked" (sơ đồ hiển thị "Xe tháng", xem legend
    // ParkingFloorMap) để giữ riêng cho khách suốt tháng, không lẫn với ô
    // đang thật sự chờ staff duyệt. Ô chỉ về lại "Available" khi thẻ bị hủy
    // hoặc hết hạn — xe ra/vào trong tháng không được trả ô về trống.
    const slotStatusForNewRes = newRes.note === 'Theo tháng' ? 'Locked' : 'Pending';
    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotCode === assignedSlotCode) {
          return { ...s, status: slotStatusForNewRes };
        }
        return s;
      }),
    );
    if (assignedSlotCode) updateSlotStatus(assignedSlotCode, slotStatusForNewRes).catch(() => {});

    return r;
  };

  // Gói tháng: VNPay báo thanh toán thành công cho một đặt chỗ tháng CHƯA
  // từng tồn tại (AvailableSlots chỉ lưu tạm thông tin, không gọi
  // handleAddReservation trước khi thanh toán) — tạo đặt chỗ thật ngay bây
  // giờ rồi mới đánh dấu hóa đơn (đã tạo Unpaid từ trước) là Paid. Nhờ vậy,
  // nếu khách không thanh toán/hủy giữa chừng thì không có đặt chỗ nào được
  // tạo — đúng yêu cầu "bắt buộc thanh toán trước mới được đặt".
  const handleMonthlyBookingPaid = async (
    paymentId: string,
    booking: import('./pages/driver/VNPayReturn').PendingMonthlyBooking,
  ) => {
    // Trang này vừa mount lại sau khi quay về từ VNPay (điều hướng ra ngoài
    // domain rồi quay lại) — `slots` trong state lúc này có thể vẫn là bản
    // cache cũ từ localStorage, effect fetch tươi của App chưa chắc đã chạy
    // xong. Tự fetch một bản MỚI NHẤT ở đây để việc xếp ô cho đặt chỗ tháng
    // luôn dựa trên tình trạng bãi thật, không bị "bỏ trống ô" do dữ liệu cũ.
    let freshSlots: Slot[] | undefined;
    try {
      freshSlots = await fetchSlotStatuses();
      setSlots(freshSlots);
    } catch { /* fetch lỗi — vẫn thử tạo đặt chỗ với slots hiện có trong state */ }

    const created = handleAddReservation(booking, freshSlots);
    if (!created) {
      alert(
        'Thanh toán đã thành công nhưng không thể tạo đặt chỗ tháng (biển số này đang có một đặt chỗ khác chưa hoàn tất). Vui lòng liên hệ quản lý bãi để được hỗ trợ hoàn tiền.',
      );
      return;
    }
    handleConfirmPayment(paymentId, 'VNPay', null);
  };

  // Hủy NGAY sau khi vừa đặt (nút Hủy / dấu X trên modal thành công): đặt chỗ
  // chưa được xác nhận/thanh toán → XÓA HẲN khỏi DB và danh sách, không để lại
  // bản ghi Cancelled (tránh poll 10s kéo trạng thái Pending từ DB sống lại).
  const handleDiscardReservation = (id: string) => {
    const targetRes = reservations.find((r) => r.id === id);
    if (!targetRes) return;
    setReservations((prev) => prev.filter((r) => r.id !== id));
    // Xóa theo reservationCode: id cục bộ (RSV-<timestamp>) khác reservation_id
    // trong DB ngay sau khi đặt — code là khóa ổn định ở cả hai phía.
    // Chờ POST tạo đơn (nếu còn đang chạy) hoàn tất trước khi gọi DELETE —
    // nếu không, DELETE có thể tới server trước khi POST commit, coi như xóa
    // hụt (no-op), và đơn Pending vẫn sống sót trong DB rồi bị đẩy tới staff
    // qua SSE dù phía user đã "hủy".
    const pendingCreate = pendingReservationCreates.current.get(id) ?? Promise.resolve();
    pendingReservationCreates.current.delete(id);
    pendingCreate.finally(() => {
      apiDeleteReservation(targetRes.reservationCode).catch(() => {});
    });
    // Trả ô đỗ về Trống như luồng hủy thường
    if (targetRes.slotCode) {
      setSlots((prev) => prev.map((s) => (s.slotCode === targetRes.slotCode ? { ...s, status: 'Available' } : s)));
      updateSlotStatus(targetRes.slotCode, 'Available').catch(() => {});
    }
    // Nếu đã lỡ tạo hóa đơn Unpaid (vd bấm "Thanh toán VNPay" rồi lỗi giữa
    // chừng) trước khi hủy ngay đơn này — dọn luôn, không để sót trên trang
    // Thanh toán (mirror handleCancelReservation).
    const staleUnpaid = payments.filter(
      (p) => p.status !== 'Paid' && (p.reservationCode === targetRes.reservationCode || p.ticketCode === targetRes.reservationCode),
    );
    if (staleUnpaid.length > 0) {
      const staleIds = new Set(staleUnpaid.map((p) => p.id));
      setPayments((prev) => prev.filter((p) => !staleIds.has(p.id)));
      staleUnpaid.forEach((p) => apiDeletePayment(p.id).catch(() => {}));
    }
    // Hoàn thống kê areas/floors đã trừ lúc tạo (mirror handleCancelReservation)
    // — nếu không, dashboard sẽ bị lệch reservedSlots/availableSlots vĩnh viễn
    // mỗi lần user hủy ngay một đơn vừa đặt.
    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === targetRes.area) {
          return {
            ...a,
            availableSlots: a.availableSlots + 1,
            reservedSlots: Math.max(0, a.reservedSlots - 1),
          };
        }
        return a;
      }),
    );
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === targetRes.floor) {
          return {
            ...f,
            availableSlots: f.availableSlots + 1,
            reservedSlots: Math.max(0, f.reservedSlots - 1),
          };
        }
        return f;
      }),
    );
    addToast(`Đã hủy đặt chỗ ${targetRes.reservationCode}.`, 'info');
  };

  const handleCancelReservation = (id: string) => {
    const targetRes = reservations.find((r) => r.id === id);
    if (!targetRes) return;

    // Free-cancel window: user can self-cancel only within 5 minutes of
    // creating the reservation (Pending or Confirmed) — past that, the
    // booking is left to staff to manage.
    if (minutesSinceCreated(targetRes) > SELF_CANCEL_WINDOW_MINUTES) {
      alert(`Không thể hủy đặt chỗ. Chỉ được tự hủy trong vòng ${SELF_CANCEL_WINDOW_MINUTES} phút sau khi đặt chỗ. Vui lòng liên hệ nhân viên bãi đỗ để được hỗ trợ hủy.`);
      return;
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Cancelled" } : r)),
    );
    apiUpdateReservation(id, { status: 'Cancelled', cancelledBy: 'user' }).catch(() => {});

    // Đặt chỗ hủy rồi thì hóa đơn Unpaid gắn với nó (nếu có, vd bấm "Thanh
    // toán VNPay" nhưng chưa hoàn tất) không còn ý nghĩa gì nữa — chưa hề có
    // tiền thật nào chuyển, để lại chỉ khiến trang Thanh toán hiện một chiếc
    // xe đã hủy như đang nợ tiền. Payment Đã thanh toán thì giữ nguyên (là
    // lịch sử giao dịch thật, không được xóa).
    const staleUnpaid = payments.filter(
      (p) => p.status !== 'Paid' && (p.reservationCode === targetRes.reservationCode || p.ticketCode === targetRes.reservationCode),
    );
    if (staleUnpaid.length > 0) {
      const staleIds = new Set(staleUnpaid.map((p) => p.id));
      setPayments((prev) => prev.filter((p) => !staleIds.has(p.id)));
      staleUnpaid.forEach((p) => apiDeletePayment(p.id).catch(() => {}));
    }

    // Revert areas slots stats
    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === targetRes.area) {
          return {
            ...a,
            availableSlots: a.availableSlots + 1,
            reservedSlots: Math.max(0, a.reservedSlots - 1),
          };
        }
        return a;
      }),
    );

    // Revert floors slots stats
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === targetRes.floor) {
          return {
            ...f,
            availableSlots: f.availableSlots + 1,
            reservedSlots: Math.max(0, f.reservedSlots - 1),
          };
        }
        return f;
      }),
    );

    // Revert slot status back to Available (handles both Pending and Reserved)
    setSlots((prev) => prev.map((s) => {
      if (targetRes.slotCode && s.slotCode === targetRes.slotCode) {
        if (targetRes.slotCode) updateSlotStatus(targetRes.slotCode, 'Available').catch(() => {});
        return { ...s, status: "Available" };
      }
      return s;
    }));

    // Direct addToast (not alert) so the type is explicit: red toast, not the
    // keyword-guessed dark "info" one.
    addToast("Bạn đã hủy đặt chỗ thành công", "error");
  };

  const handleExpireReservation = (id: string) => {
    const targetRes = reservations.find((r) => r.id === id);
    if (!targetRes) return;
    if (targetRes.status !== "Confirmed" && targetRes.status !== "Pending")
      return;

    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Expired" } : r)),
    );
    apiUpdateReservation(id, { status: 'Expired' }).catch(() => {});

    // Revert areas slots stats
    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === targetRes.area) {
          return {
            ...a,
            availableSlots: a.availableSlots + 1,
            reservedSlots: Math.max(0, a.reservedSlots - 1),
          };
        }
        return a;
      }),
    );

    // Revert floors slots stats
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === targetRes.floor) {
          return {
            ...f,
            availableSlots: f.availableSlots + 1,
            reservedSlots: Math.max(0, f.reservedSlots - 1),
          };
        }
        return f;
      }),
    );

    // Revert slot status back to Available (handles both Pending and Reserved)
    setSlots((prev) => prev.map((s) => {
      if (targetRes.slotCode && s.slotCode === targetRes.slotCode) {
        if (targetRes.slotCode) updateSlotStatus(targetRes.slotCode, 'Available').catch(() => {});
        return { ...s, status: "Available" };
      }
      return s;
    }));

    alert("Đặt chỗ đã hết hạn. Chỗ đỗ đã được giải phóng.");
  };

  // Auto-expire reservations background job
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const toExpire = reservations.filter((res) => {
        if (res.status !== "Confirmed" && res.status !== "Pending")
          return false;
        const base = res.createdAt ?? `${res.date} ${res.startTime}`;
        const [datePart, timePart] = base.split(" ");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, min] = (timePart ?? "00:00").split(":").map(Number);
        const expirationTime = new Date(year, month - 1, day, hour + 24, min);
        return now > expirationTime;
      });

      // Avoid alert spam on auto-expire
      const originalAlert = window.alert;
      window.alert = () => {};
      toExpire.forEach((res) => {
        handleExpireReservation(res.id);
        if (currentUser && res.userId === currentUser.id) {
          addToast(
            `Reservation ${res.reservationCode} has expired due to late arrival.`,
            "info",
          );
        }
      });
      window.alert = originalAlert;
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [reservations, currentUser]);

  // Checkout for a car shown via a *virtual* session (ticket "TMP-<resCode>"):
  // CurrentSession fabricates these when the selected checked-in reservation
  // isn't the session this tab tracks, so the normal path's ticket match fails.
  // Resolve everything through the reservation instead: free its slot, complete
  // it, settle its linked payment, and close the real DB session row (whose
  // ticket code is recoverable from that payment).
  const handleVirtualCheckOut = (
    resCode: string,
    paymentMethod: "Cash" | "Card" | "E-Wallet" | "QR Banking" | "Crypto" | "VNPay",
    finalAmount: number,
    showAlert: boolean,
  ): boolean => {
    const res = reservations.find((r) => r.reservationCode === resCode);
    if (!res) return false;

    if (res.slotCode) {
      setSlots((prev) =>
        prev.map((s) => (s.slotCode === res.slotCode ? { ...s, status: "Available" } : s)),
      );
      updateSlotStatus(res.slotCode, 'Available').catch(() => {});
      setAreas((prev) =>
        prev.map((a) =>
          a.areaName === res.area
            ? { ...a, occupiedSlots: Math.max(0, a.occupiedSlots - 1), availableSlots: a.availableSlots + 1 }
            : a,
        ),
      );
      setFloors((prev) =>
        prev.map((f) =>
          f.floorName === res.floor
            ? { ...f, occupiedSlots: Math.max(0, f.occupiedSlots - 1), availableSlots: f.availableSlots + 1 }
            : f,
        ),
      );
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, status: "Completed" } : r)),
    );
    apiUpdateReservation(res.id, { status: "Completed" }).catch(() => {});

    const paidAt = nowLocalStr();
    const payRecord = payments.find(
      (p) => p.reservationCode === resCode || p.ticketCode === resCode,
    );
    const wasPrePaid = payRecord?.status === 'Paid';
    if (payRecord && !wasPrePaid) {
      setPayments((prev) =>
        prev.map((p) =>
          p.id === payRecord.id
            ? { ...p, status: "Paid", method: paymentMethod, totalAmount: finalAmount, paidAt, licensePlate: res.licensePlate }
            : p,
        ),
      );
      apiUpdatePayment(payRecord.id, {
        status: 'Paid', method: paymentMethod, paidAt, totalAmount: finalAmount, parkingFee: finalAmount,
      }).catch(() => {});
    }

    // The payment row remembers the real session ticket even though this tab
    // never loaded that session — use it to close the DB row too.
    const realTicket = payRecord?.ticketCode && !payRecord.ticketCode.startsWith('TMP-') && payRecord.ticketCode !== resCode
      ? payRecord.ticketCode
      : null;
    if (realTicket) {
      apiUpdateSession(realTicket, {
        sessionStatus: 'Completed',
        paymentStatus: 'Paid',
        paymentMethod,
        checkOutTime: paidAt,
        barrierStatus: 'Opened',
      }).catch(() => {});
      if (currentSession.ticketCode === realTicket) {
        setCurrentSession((prev) => ({
          ...prev, sessionStatus: "Completed", paymentStatus: "Paid", barrierStatus: "Opened", checkOutTime: paidAt,
        }));
      }
    }

    if (showAlert) {
      alert(wasPrePaid
        ? "Xe ra cổng thành công. Barrier đã mở."
        : "Thanh toán thành công. Barrier đã mở. Check-out hoàn tất."
      );
    }
    return true;
  };

  const handleCheckOutSession = (
    ticketCode: string,
    paymentMethod: "Cash" | "Card" | "E-Wallet" | "QR Banking" | "Crypto" | "VNPay",
    finalAmount: number,
    showAlert: boolean = true,
  ): boolean => {
    if (currentUser?.status !== "Active") return false;
    if (ticketCode.startsWith('TMP-')) {
      return handleVirtualCheckOut(ticketCode.slice(4), paymentMethod, finalAmount, showAlert);
    }
    if (currentSession.ticketCode !== ticketCode) return false;
    if (currentSession.sessionStatus !== "Active") return false;

    const targetSlot = slots.find(
      (s) =>
        s.slotCode === currentSession.slotCode &&
        s.floorName === currentSession.floor &&
        s.areaName === currentSession.area,
    );

    if (targetSlot) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === targetSlot.id ? { ...s, status: "Available" } : s,
        ),
      );
      updateSlotStatus(targetSlot.slotCode, 'Available').catch(() => {});
    }

    const checkOutTime = nowLocalStr();
    setCurrentSession((prev) => ({
      ...prev,
      sessionStatus: "Completed",
      paymentStatus: "Paid",
      estimatedFee: finalAmount,
      barrierStatus: "Opened",
      checkOutTime,
    }));
    // ticketCode, not currentSession.id — the local "SES-..." id doesn't exist in
    // the DB (rows get numeric ids), so a PUT by that id 404s silently and the DB
    // session stays Active/Unpaid, resurrecting the car as unpaid after reload.
    apiUpdateSession(ticketCode, {
      sessionStatus: 'Completed',
      paymentStatus: 'Paid',
      paymentMethod,
      checkOutTime,
      estimatedFee: finalAmount,
      barrierStatus: 'Opened',
    }).catch(() => {});

    const paidAt = nowLocalStr();
    const payRecord = payments.find((p) => p.ticketCode === ticketCode);
    // Chỉ cập nhật payment nếu chưa Paid (tránh ghi đè xe đã thanh toán trước)
    if (payRecord && payRecord.status !== 'Paid') {
      setPayments((prev) =>
        prev.map((p) =>
          p.ticketCode === ticketCode
            ? { ...p, status: "Paid", method: paymentMethod, totalAmount: finalAmount, paidAt, licensePlate: currentSession.licensePlate }
            : p,
        ),
      );
      apiUpdatePayment(payRecord.id, {
        status: 'Paid',
        method: paymentMethod,
        paidAt,
        totalAmount: finalAmount,
        parkingFee: finalAmount,
      }).catch(() => {});
    }

    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === currentSession.area) {
          return {
            ...a,
            occupiedSlots: Math.max(0, a.occupiedSlots - 1),
            availableSlots: a.availableSlots + 1,
          };
        }
        return a;
      }),
    );

    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === currentSession.floor) {
          return {
            ...f,
            occupiedSlots: Math.max(0, f.occupiedSlots - 1),
            availableSlots: f.availableSlots + 1,
          };
        }
        return f;
      }),
    );

    // Find reservations to complete BEFORE updating state (need their ids for DB sync)
    const completingRes = reservations.filter(
      (r) =>
        r.licensePlate.trim().toLowerCase() === currentSession.licensePlate.trim().toLowerCase() &&
        r.status === "Checked-in",
    );

    setReservations((prev) =>
      prev.map((r) => {
        if (
          r.licensePlate.trim().toLowerCase() ===
            currentSession.licensePlate.trim().toLowerCase() &&
          r.status === "Checked-in"
        ) {
          return { ...r, status: "Completed" };
        }
        return r;
      }),
    );

    // Persist reservation status to DB so polling doesn't revert it back to Checked-in
    completingRes.forEach((r) =>
      apiUpdateReservation(r.id, { status: "Completed" }).catch(() => {}),
    );

    const wasPrePaid = currentSession.paymentStatus === 'Paid';
    if (showAlert) {
      alert(wasPrePaid
        ? "Xe ra cổng thành công. Barrier đã mở."
        : "Thanh toán thành công. Barrier đã mở. Check-out hoàn tất."
      );
    }
    return true;
  };

  const handleConfirmPayment = (
    id: string,
    method: "Cash" | "Card" | "E-Wallet" | "QR Banking" | "Crypto" | "VNPay",
    vnpayCtx?: import('./pages/driver/VNPayReturn').VNPayCheckoutContext | null,
  ) => {
    const now = nowLocalStr(true);
    const payment = payments.find((p) => p.id === id);
    const finalAmount = payment?.totalAmount ?? vnpayCtx?.amount ?? 0;

    // Mark payment as Paid in local state + DB
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "Paid", method, paidAt: now } : p,
      ),
    );
    apiUpdatePayment(id, { status: 'Paid', method, paidAt: now, totalAmount: finalAmount }).catch(() => {});

    // If VNPay returned with checkout context (the "pay at exit" flow from
    // CurrentSession's modal): paying does NOT put the car through the gate.
    // Only mark the session Paid and keep it Active — the car stays visible in
    // "Lượt gửi hiện tại" as paid, and the driver then presses "Mở barie"
    // (the prepaid checkout path), which is what actually completes the
    // session and releases the slot. VNPayReturn already shows the success
    // confirmation, so no alert here.
    if (vnpayCtx && vnpayCtx.sessionId) {
      // Resolve the real session ticket. A virtual-session payment carries a
      // fabricated "TMP-<resCode>" ticket; the real ticket is recoverable from
      // the check-in invoice linked to the same reservation.
      let sessionTicket = vnpayCtx.ticketCode || '';
      if (sessionTicket.startsWith('TMP-')) {
        const resCode = sessionTicket.slice(4);
        const linked = payments.find(
          (p) =>
            p.reservationCode === resCode &&
            p.ticketCode &&
            !p.ticketCode.startsWith('TMP-') &&
            p.ticketCode !== resCode,
        );
        sessionTicket = linked?.ticketCode ?? '';
      }
      if (sessionTicket) {
        setCurrentSession((prev) =>
          prev.ticketCode === sessionTicket ? { ...prev, paymentStatus: "Paid" } : prev,
        );
        // ticketCode, not sessionId: the ctx carries the local "SES-..." id which
        // doesn't exist in the DB — a PUT by it 404s silently (see handleCheckOutSession).
        apiUpdateSession(sessionTicket, { paymentStatus: 'Paid', paymentMethod: method }).catch(() => {});
      }
      return;
    }

    // Paying from the Payments page (no checkout ctx): the car is still physically
    // in the lot, so only flip the session to Paid — do NOT check it out. The
    // session stays Active/visible in "Lượt gửi hiện tại" until the driver actually
    // exits through the gate flow (CurrentSession's checkout), which is the only
    // path that should complete the session and release the slot.
    if (payment && payment.ticketCode === currentSession.ticketCode && currentSession.sessionStatus === 'Active') {
      setCurrentSession((prev) => ({ ...prev, paymentStatus: 'Paid' }));
      apiUpdateSession(payment.ticketCode, { paymentStatus: 'Paid', paymentMethod: method }).catch(() => {});
      alert('Thanh toán thành công qua ' + method + '. Vui lòng quét QR tại cổng để cho xe ra.');
    } else {
      alert('Thanh toán thành công qua ' + method + '.');
    }
  };

  const handleAddVehicle = (newVeh: any): boolean => {
    const userVehicles = savedVehicles.filter((v) => v.userId === (currentUser?.id || ""));
    const localVehicle: SavedVehicle = {
      id: `SV-${Date.now()}`,
      userId: currentUser?.id || "",
      isDefault: userVehicles.length === 0,
      ...newVeh,
    };
    // Optimistic update — show immediately.
    setSavedVehicles((prev) => [...prev, localVehicle]);
    // Persist to backend; if success, replace the local entry with the DB record.
    if (currentUser?.id) {
      createVehicle({
        userId: currentUser.id,
        licensePlate: newVeh.licensePlate,
        vehicleType: newVeh.vehicleType,
        brand: newVeh.brand ?? '',
        model: newVeh.model ?? '',
        isDefault: userVehicles.length === 0,
      })
        .then((saved) => {
          setSavedVehicles((prev) =>
            prev.map((v) => (v.id === localVehicle.id ? saved : v)),
          );
        })
        .catch(() => {
          // API unavailable — localStorage copy remains.
        });
    }
    return true;
  };

  const handleUpdateVehicle = async (
    vehicleId: string,
    updates: { licensePlate: string; vehicleType: VehicleKey; brand: string; model: string },
  ): Promise<{ ok: boolean; error?: string }> => {
    // Optimistic update — reflect the edit immediately.
    setSavedVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, ...updates } : v)),
    );
    try {
      const saved = await apiUpdateVehicle(vehicleId, updates);
      setSavedVehicles((prev) => prev.map((v) => (v.id === vehicleId ? saved : v)));
      return { ok: true };
    } catch (err) {
      // API unavailable — keep the optimistic local update instead of reverting,
      // matching handleAddVehicle's offline-friendly behavior.
      return { ok: true };
    }
  };

  const handleSetDefaultVehicle = (vehicleId: string) => {
    setSavedVehicles((prev) =>
      prev.map((v) =>
        v.userId === currentUser?.id
          ? { ...v, isDefault: v.id === vehicleId }
          : v,
      ),
    );
    apiSetDefaultVehicle(vehicleId).catch(() => {
      // API unavailable — local state is already updated.
    });
  };

  const handleUpdateLotStatus = async (name: string, status: ParkingLotStatus['status']): Promise<boolean> => {
    const previous = lotStatuses;
    setLotStatuses((prev) => {
      const idx = prev.findIndex((l) => l.name === name);
      if (idx === -1) return [...prev, { name, status, updatedAt: '' }];
      const next = [...prev];
      next[idx] = { ...next[idx], status };
      return next;
    });
    const saved = await updateParkingLotStatus(name, status);
    if (!saved) { setLotStatuses(previous); return false; }
    setLotStatuses((prev) => prev.map((l) => (l.name === name ? saved : l)));
    return true;
  };

  const handleSubmitFeedback = (newFb: any) => {
    const ts = Date.now();
    const fbCode = `FB-${ts.toString().slice(-6)}`;
    const f: Feedback = {
      id: `FB-${ts}`,
      userId: currentUser?.id || "GUEST",
      feedbackCode: fbCode,
      status: "New",
      createdAt: nowLocalStr(),
      ...newFb,
    };
    setFeedbacks((prev) => [f, ...prev]);
    apiCreateFeedback(f).catch(() => {});
  };

  const handleRespondFeedback = (id: string, response: string, newStatus?: Feedback['status']) => {
    const respondedAt = nowLocalStr();
    const resolvedStatus = newStatus ?? 'In Progress';
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              staffResponse: response,
              staffRespondedAt: respondedAt,
              status: resolvedStatus,
            }
          : f,
      ),
    );
    apiUpdateFeedback(id, { status: resolvedStatus, staffResponse: response, staffRespondedAt: respondedAt }).catch(() => {});
  };

  const handleUpdateProfile = async (up: Partial<User>): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: 'Chưa đăng nhập.' };

    // fullName/phone/email are real DB columns and must round-trip through the
    // backend (which also enforces the email/phone-uniqueness check) — anything
    // else (e.g. passwordUpdatedAt bookkeeping, local-only address) is applied
    // to local state directly since there's no matching column to persist it to.
    const touchesCoreInfo = up.fullName !== undefined || up.phone !== undefined || up.email !== undefined;
    if (touchesCoreInfo) {
      try {
        const updated = await userService.updateUser(currentUser.id, {
          fullName: up.fullName ?? currentUser.fullName,
          email: up.email ?? currentUser.email,
          phone: up.phone ?? currentUser.phone,
          actorId: currentUser.id,
        });
        const nextUser: User = {
          ...currentUser,
          ...up,
          fullName: updated.fullName,
          email: updated.email,
          phone: updated.phone,
        };
        setCurrentUser(nextUser);
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
        setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, ...nextUser } : u)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Không thể cập nhật thông tin.' };
      }
    }

    const nextUser = { ...currentUser, ...up };
    setCurrentUser(nextUser);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...up } : u)),
    );
    return { ok: true };
  };

  // Admin actions
  const handleCreateUser = async (u: any): Promise<boolean> => {
    try {
      const created = await userService.createUser({
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        password: u.password,
        assignedParkingLot: u.assignedParkingLot || '',
        actorId: currentUser?.id,
      });
      setUsers((prev) => [toAppUser(created), ...prev]);

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Create User Profile",
        actor: currentUser?.fullName || "System Admin",
        target: `${u.fullName} (${u.email})`,
        createdAt: nowLocalStr(),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("Tạo tài khoản mới thành công.");
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể tạo tài khoản.");
      return false;
    }
  };

  // Seeded/demo users keep a local id (e.g. 'DEMO-ADM') after merging with the
  // API by email — see the syncUsers effect above — so other mock-data filters
  // (vehicles/reservations/payments keyed by that local id) keep matching. But
  // PUT/DELETE /api/users/:id need the real numeric DB id, or they 404. Resolve
  // it by email right before any mutating call; fall back to the given id if
  // the backend is unreachable or no match is found (updateUser/deleteUser
  // will then report their own error).
  const resolveApiUserId = async (userId: string): Promise<string> => {
    const target = users.find((u) => u.id === userId);
    if (!target) return userId;
    try {
      const remote = await userService.fetchUsers();
      const match = remote.find((r) => r.email.toLowerCase() === target.email.toLowerCase());
      return match ? String(match.id) : userId;
    } catch {
      return userId;
    }
  };

  const handleEditUser = async (id: string, u: any): Promise<boolean> => {
    try {
      const apiId = await resolveApiUserId(id);
      const updated = await userService.updateUser(apiId, {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        assignedParkingLot: u.assignedParkingLot || '',
        actorId: currentUser?.id,
      });
      // Giữ id local để các filter theo userId (đặt chỗ, xe...) không gãy
      setUsers((prev) =>
        prev.map((usr) => (usr.id === id ? { ...toAppUser(updated), id: usr.id } : usr)),
      );

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Update User Profile",
        actor: currentUser?.fullName || "System Admin",
        target: `${u.fullName} (${u.email})`,
        createdAt: nowLocalStr(),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("Cập nhật thông tin tài khoản thành công.");
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật tài khoản.");
      return false;
    }
  };

  const handleAssignStaffToLot = async (userId: string, lotName: string): Promise<boolean> => {
    try {
      const apiId = await resolveApiUserId(userId);
      const updated = await userService.updateUser(apiId, { assignedParkingLot: lotName, actorId: currentUser?.id });
      // Giữ id local để các filter theo userId (đặt chỗ, xe...) không gãy
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...toAppUser(updated), id: u.id } : u)));
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể phân công nhân viên.");
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    try {
      const apiId = await resolveApiUserId(id);
      await userService.deleteUser(apiId, currentUser?.id);
      setUsers((prev) => prev.filter((usr) => usr.id !== id));

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Delete User Account",
        actor: currentUser?.fullName || "System Admin",
        target: `${targetUser.fullName} (${targetUser.email})`,
        createdAt: nowLocalStr(),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("Đã xóa tài khoản người dùng.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể xóa tài khoản.");
    }
  };

  const handleToggleLockUser = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    const nextStatus = targetUser.status === "Locked" ? "Active" : "Locked";

    try {
      const apiId = await resolveApiUserId(id);
      const updated = await userService.updateUser(apiId, { status: nextStatus, actorId: currentUser?.id });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === id ? { ...toAppUser(updated), id: usr.id } : usr)),
      );

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action:
          nextStatus === "Locked" ? "Lock User Account" : "Unlock User Account",
        actor: currentUser?.fullName || "System Admin",
        target: `${targetUser.fullName} (${targetUser.email})`,
        createdAt: nowLocalStr(),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert(nextStatus === "Locked" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật trạng thái tài khoản.");
    }
  };

  const handleAssignRole = async (userId: string, newRole: Role): Promise<boolean> => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return false;

    try {
      const apiId = await resolveApiUserId(userId);
      const updated = await userService.updateUser(apiId, { role: newRole, actorId: currentUser?.id });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === userId ? { ...toAppUser(updated), id: usr.id } : usr)),
      );

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Assign Role Credentials",
        actor: currentUser?.fullName || "System Admin",
        target: `${targetUser.fullName} assigned to ${newRole}`,
        createdAt: nowLocalStr(),
      };
      setAdminActivities((prev) => [log, ...prev]);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật vai trò.");
      return false;
    }
  };

  const handleSaveConfig = (updated: Partial<SystemConfig>) => {
    setSystemConfig((prev) => ({ ...prev, ...updated }));

    const log: AdminActivity = {
      id: `ACT-${Date.now()}`,
      action: "Configure system settings",
      actor: currentUser?.fullName || "System Admin",
      target: "Stored global configurations",
      createdAt: nowLocalStr(),
    };
    setAdminActivities((prev) => [log, ...prev]);
  };

  // Stats calculation
  const publicStats = {
    total: slots.length,
    available: slots.filter((s) => s.status === "Available").length,
    occupied: slots.filter((s) => s.status === "Occupied").length,
    reserved: slots.filter((s) => s.status === "Reserved").length,
  };

  // "sessionAmount" bên dưới ước tính theo Date.now() ngay lúc tính — nhưng
  // useMemo chỉ chạy lại khi dependency đổi, nên số này sẽ đứng yên nếu không
  // có gì khác kích hoạt render. Tick nhẹ mỗi 30s (không cần từng giây — đây
  // chỉ là số tổng trên thẻ thống kê, không phải đồng hồ đang chạy) để "Số dư
  // chưa thanh toán" của xe đang đỗ tự lớn dần đúng với phí quá giờ thực tế.
  const [unpaidTick, setUnpaidTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setUnpaidTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Calculate unpaid total — includes:
  // 1. Unpaid payments with known amount ("otherAmount": old/unrelated unpaid items)
  // 2. Every currently-parked vehicle's fee ("sessionAmount") — summed with the exact
  //    same formula/list (buildCheckedInVehicles + perVisitOverstay) MyParking uses for
  //    each vehicle's own "Phí tạm tính" card, so the total always matches what's shown
  //    per vehicle (incl. walk-ins with no reservation, and accounts with >1 car parked).
  // 3. Confirmed/Pending reservations that paid "Thanh toán sau" (no paid payment record) ("reservationAmount")
  // Broken out by category (not just summed) so the UI can show what the total is made of,
  // instead of one lump number that looks inconsistent with the per-vehicle "Phí tạm tính".
  const { unpaidTotal, unpaidIsEstimate, unpaidSessionAmount, unpaidReservationAmount, unpaidOtherAmount } = React.useMemo(() => {
    let sessionAmount = 0;
    let reservationAmount = 0;
    let otherAmount = 0;
    let hasEstimate = false;

    // Part 1: Unpaid payment records with a known amount (old/unrelated unpaid items)
    // — bỏ qua hóa đơn đã "hủy thanh toán" (đặt chỗ gắn với nó đã bị hủy/xóa),
    // không thì Số dư chưa thanh toán vẫn cộng tiền cho xe đã hủy từ lâu.
    for (const p of payments) {
      if (p.status !== 'Unpaid' || p.userId !== currentUser?.id) continue;
      if (isPaymentVoided(p, reservations)) continue;
      if (p.totalAmount > 0) otherAmount += p.totalAmount;
    }

    // Part 2: Every vehicle currently parked under this account
    if (currentUser) {
      const myReservations = reservations.filter((r) => r.userId === currentUser.id);
      const checkedIn = buildCheckedInVehicles(myReservations, driverActiveSessions);
      for (const res of checkedIn) {
        sessionAmount += perVisitOverstay(res, pricingRules, Date.now()).total;
        hasEstimate = true;
      }
    }

    // Part 3: Confirmed/Pending reservations with "Thanh toán sau" (no paid payment linked)
    if (currentUser) {
      for (const r of reservations) {
        if (r.userId !== currentUser.id) continue;
        if (r.status !== 'Confirmed' && r.status !== 'Pending') continue;
        if (!r.estimatedCost || r.estimatedCost <= 0) continue;
        // Skip if there's already a paid or unpaid payment for this reservation
        const linked = payments.find((p) => p.ticketCode === r.reservationCode);
        if (linked) continue;
        reservationAmount += r.estimatedCost;
        hasEstimate = true;
      }
    }

    return {
      unpaidTotal: sessionAmount + reservationAmount + otherAmount,
      unpaidIsEstimate: hasEstimate,
      unpaidSessionAmount: sessionAmount,
      unpaidReservationAmount: reservationAmount,
      unpaidOtherAmount: otherAmount,
    };
  }, [payments, currentUser, reservations, driverActiveSessions, pricingRules, unpaidTick]);
  const upcomingRes = reservations.find(
    (r) => r.status === "Confirmed" || r.status === "Pending",
  );

  // Bell notification: track reservation status changes (Cancelled/Expired —
  // the ones staff/system trigger on the user's behalf) and feedback replies
  // that the user hasn't seen yet. Keyed by `${id}:${status}` for reservations
  // so a later status change on the same booking still surfaces as a fresh,
  // unseen notification. "Confirmed" is handled separately below via the
  // backend-persisted notifications table (see notificationService), since
  // staff confirming a booking must push a real "Đã đặt xe thành công" record.
  const [seenFeedbackIds, setSeenFeedbackIds] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const f of feedbacks) {
      if (f.staffResponse) initial.add(f.id);
    }
    return initial;
  });

  // Backend-persisted notifications (e.g. "Đã đặt xe thành công" on staff confirm)
  const [userNotifications, setUserNotifications] = React.useState<AppNotification[]>([]);
  const currentUserRef = React.useRef(currentUser);
  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  React.useEffect(() => {
    if (!currentUser || currentUser.role !== "Parking User / Driver") {
      setUserNotifications([]);
      return;
    }
    fetchNotifications(currentUser.id)
      .then(({ notifications }) => setUserNotifications(notifications))
      .catch(() => {});
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    const cleanup = subscribeToNotificationEvents((n) => {
      if (currentUserRef.current?.id !== n.userId) return;
      setUserNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
    });
    return cleanup;
  }, []);

  // The bell only carries staff/server-originated events: feedback replies and
  // backend notifications (booking confirmed by staff, server auto-expiry).
  // Locally-derived reservation events were deliberately dropped — they also
  // fired when the driver cancelled their own booking, showing a phantom badge
  // for something the user did themselves.
  const userBellNotifications = React.useMemo(() => {
    if (!currentUser || currentUser.role !== "Parking User / Driver") return [];
    const items: { id: string; type: "reservation" | "feedback"; title: string; body: string; targetView: string }[] = [];

    feedbacks
      .filter((f) => f.userId === currentUser.id && f.staffResponse && !seenFeedbackIds.has(f.id))
      .forEach((f) =>
        items.push({
          id: f.id,
          type: "feedback",
          title: "Nhân viên đã phản hồi yêu cầu",
          body: `${f.type} · "${(f.staffResponse ?? "").slice(0, 50)}${(f.staffResponse ?? "").length > 50 ? "..." : ""}"`,
          targetView: "feedback",
        }),
      );

    userNotifications
      .filter((n) => !n.isRead)
      .forEach((n) =>
        items.push({
          id: `notif-${n.id}`,
          type: "reservation",
          title: n.title,
          body: n.body,
          targetView: n.targetView || "reservations",
        }),
      );

    return items;
  }, [currentUser, feedbacks, seenFeedbackIds, userNotifications]);

  // The badge count always matches the dropdown list — no separate tally to drift out of sync.
  const notificationCount = userBellNotifications.length;

  // Clicking one bell item marks just that item as read, then routes by type:
  // 'Parking Reservation' → Lịch sử đặt chỗ, 'User Feedback' → Phản hồi / Hỗ trợ.
  const handleNotificationClick = (n: { id: string; type: "reservation" | "feedback"; targetView: string }) => {
    if (n.type === "feedback") {
      setSeenFeedbackIds((prev) => new Set(prev).add(n.id));
      setView(n.targetView || "feedback");
      return;
    }
    if (n.id.startsWith("notif-")) {
      const realId = n.id.slice("notif-".length);
      setUserNotifications((prev) => prev.map((x) => (x.id === realId ? { ...x, isRead: true } : x)));
      markNotificationRead(realId).catch(() => {});
    }
    setView(n.targetView || "reservations");
  };

  const handleClearNotifications = () => {
    setSeenFeedbackIds((prev) => {
      const next = new Set(prev);
      for (const f of feedbacks) {
        if (f.staffResponse) next.add(f.id);
      }
      return next;
    });
    if (currentUser && userNotifications.some((n) => !n.isRead)) {
      setUserNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      markAllNotificationsRead(currentUser.id).catch(() => {});
    }
  };

  // Staff/Manager views show who filed each feedback. DB rows carry userName
  // from the server-side join; mock/localStorage rows only have userId, so
  // resolve those against the users list here.
  const feedbacksWithNames = React.useMemo(
    () =>
      feedbacks.map((f) =>
        f.userName ? f : { ...f, userName: users.find((u) => u.id === f.userId)?.fullName ?? '' },
      ),
    [feedbacks, users],
  );

  const getDriverPortalTitle = (view: string) => {
    switch (view) {
      case "myparking":
        return "Trang của tôi";
      case "reservations":
        return "Lịch sử đặt chỗ";
      case "payments":
        return "Thanh toán";
      case "feedback":
        return "Phản hồi / Hỗ trợ";
      case "profile":
        return "Hồ sơ";
      default:
        return "Trang của tôi";
    }
  };

  // Page layout renderer wrapper
  const renderPortalLayout = () => {
    const themeShellClass = interfaceMode === "dark" ? "theme-dark" : "";

    if (currentUser === null) {
      // Guest public navigation bar flow
      return (
        <div
          className={`min-h-screen bg-slate-50/50 flex flex-col justify-between ${themeShellClass}`}
        >
          <div>
            <PublicNavbar
              currentView={currentView}
              setView={setView}
              user={null}
              onLogout={handleLogout}
              notificationCount={0}
            />
            <main
              className={
                ["home", "info", "pricing", "contact", "terms", "privacy", "help"].includes(currentView)
                  ? ""
                  : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
              }
            >
              {currentView === "home" && (
                <Homepage setView={setView} stats={publicStats} pricingRules={pricingRules} />
              )}
              {currentView === "baixe" && (
                <ParkingLotsList setView={setView} pricingRules={pricingRules} />
              )}
              {currentView === "info" && (
                <ParkingInformation setView={setView} />
              )}
              {currentView === "slots" && (
                <AvailableSlotsPage
                  setView={setView}
                  slots={slots}
                  isLoggedIn={false}
                  currentUser={currentUser}
                  savedVehicles={savedVehicles}
                  onAddReservation={handleAddReservation}
                  onCancelReservation={handleCancelReservation}
                  onDiscardReservation={handleDiscardReservation}
                  reservations={reservations}
                  pricingRules={pricingRules}
                  lotStatuses={lotStatuses}
                />
              )}
              {currentView === "pricing" && (
                <PricingRulesPage setView={setView} pricingRules={pricingRules} />
              )}
              {currentView === "pricing-detail" && (
                <PricingDetail setView={setView} />
              )}
              {currentView === "contact" && (
                <ContactPage currentUser={currentUser} onSubmitFeedback={handleSubmitFeedback} />
              )}
              {currentView === "terms" && <TermsPage setView={setView} />}
              {currentView === "privacy" && <PrivacyPage setView={setView} />}
              {currentView === "help" && <HelpPage setView={setView} />}
              {/* VNPay redirect về đây kể cả khi chưa đăng nhập */}
              {currentView === "vnpay-return" && (
                <VNPayReturn
                  onPaymentSuccess={(id, ctx) => handleConfirmPayment(id, "VNPay", ctx)}
                  onMonthlyBookingPaid={handleMonthlyBookingPaid}
                  setView={setView}
                />
              )}
              {currentView === "login" && (
                <LoginPage
                  onLogin={handleLogin}
                  setView={setView}
                  users={users}
                />
              )}
              {currentView === "register" && (
                <RegisterPage
                  onRegister={handleRegister}
                  setView={setView}
                  users={users}
                />
              )}
            </main>
          </div>
          <Footer onNavigate={setView} />
        </div>
      );
    }

    if (currentUser.role === "System Administrator") {
      // Administrative dashboard flow
      return (
        <div
          className={`min-h-screen bg-slate-50/50 pl-64 flex flex-col justify-between ${themeShellClass}`}
        >
          <AdminSidebar
            currentView={currentView}
            setView={setView}
            onLogout={handleLogout}
            user={currentUser}
          />
          <div>
            <Topbar user={currentUser} title="Bảng điều hành Quản trị" onLogout={handleLogout} />
            <main className="p-6">
              {currentView === "admindashboard" && (
                <AdminDashboard
                  systemConfig={systemConfig}
                  adminActivities={adminActivities}
                  users={users}
                  roles={rolesList}
                  slots={slots}
                  reservations={reservations}
                  payments={payments}
                  onSaveConfig={handleSaveConfig}
                />
              )}
              {currentView === "usermanagement" && (
                <UserManagement
                  users={users}
                  onCreateUser={handleCreateUser}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                  onToggleLockUser={handleToggleLockUser}
                  activeAdminEmail={currentUser.email}
                  viewerRole={currentUser.role}
                />
              )}
              {currentView === "rolemanagement" && (
                <RoleManagement
                  users={users}
                  onAssignRole={handleAssignRole}
                  activeAdminEmail={currentUser.email}
                  viewerRole={currentUser.role}
                  viewerId={currentUser.id}
                />
              )}
              {currentView === "systemconfig" && (
                <SystemConfiguration
                  systemConfig={systemConfig}
                  onSaveConfig={handleSaveConfig}
                  onPreviewThemeChange={(mode) => {
                    setInterfaceMode(mode);
                    document.documentElement.setAttribute("data-theme", mode);
                  }}
                />
              )}
            </main>
          </div>
          <footer className="border-t border-slate-100/60 bg-white py-4 text-center text-[10px] text-slate-400">
            Bảng điều khiển Hệ thống • © 2026
          </footer>
        </div>
      );
    }

    if (currentUser.role === "Parking Manager") {
      // Manager dashboard flow - all manager pages handled by ManagerDashboard component
      return (
        <div className={themeShellClass}>
          <ManagerDashboard
            slots={slots}
            payments={payments}
            reservations={reservations}
            users={users}
            pricingRules={pricingRules}
            feedbacks={feedbacksWithNames}
            setView={setView}
            currentView={currentView}
            floors={floors}
            areas={areas}
            currentUser={currentUser}
            onLogout={handleLogout}
            emergencyLogs={emergencyLogs}
            issues={issues}
            onApproveIssue={handleApproveIssue}
            onRejectIssue={handleRejectIssue}
            onRestoreIssue={handleRestoreIssue}
            onForceClearSlot={handleForceClearSlot}
            onRespondFeedback={handleRespondFeedback}
            addToast={addToast}
            onUpdateUser={handleUpdateProfile}
            onAssignStaff={handleAssignStaffToLot}
            lotStatuses={lotStatuses}
            onUpdateLotStatus={handleUpdateLotStatus}
          />
        </div>
      );
    }

    if (currentUser.role === "Parking Staff") {
      // Staff portal flow - gate control, IoT scan handling, activity & emergency
      return (
        <div className={themeShellClass}>
          <StaffDashboard
            currentUser={currentUser}
            setView={setView}
            currentView={currentView}
            slots={slots}
            reservations={reservations}
            payments={payments}
            pricingRules={pricingRules}
            users={users}
            onUpdateUser={handleUpdateProfile}
            onCheckOutSession={handleCheckOutSession}
            onForceClearSlot={handleForceClearSlot}
            onSetSlotStatus={handleSetSlotStatus}
            lotStatuses={lotStatuses}
            onConfirmReservation={(id) => {
              const res = reservations.find((r) => r.id === id);
              setReservations((prev) =>
                prev.map((r) =>
                  r.id === id ? { ...r, status: "Confirmed" } : r,
                ),
              );
              // staffId để backend TỰ kiểm tra staff có đúng bãi của đặt chỗ
              // không (không chỉ tin bộ lọc UI) — server chặn (403) nếu lệch bãi.
              apiUpdateReservation(id, { status: 'Confirmed', staffId: currentUser?.id })
                .catch(() => {
                  // Bị chặn hoặc lỗi mạng → hoàn tác trạng thái lạc quan đã set ở trên.
                  setReservations((prev) =>
                    prev.map((r) => (r.id === id && res ? { ...r, status: res.status } : r)),
                  );
                  addToast('Không thể xác nhận đặt chỗ — bãi đỗ không thuộc phân công của bạn.', 'error');
                });
              // Slot becomes Reserved (yellow) once staff confirms the booking
              if (res?.slotCode) {
                setSlots((prev) =>
                  prev.map((s) =>
                    s.slotCode === res.slotCode ? { ...s, status: "Reserved" } : s,
                  ),
                );
                updateSlotStatus(res.slotCode, 'Reserved').catch(() => {});
              }
            }}
            onCancelReservation={(id) => {
              const res = reservations.find((r) => r.id === id);
              if (!res) return;
              setReservations((prev) =>
                prev.map((r) => (r.id === id ? { ...r, status: "Cancelled" } : r)),
              );
              // staffId để backend TỰ kiểm tra staff có đúng bãi của đặt chỗ
              // không (không chỉ tin bộ lọc UI) — server chặn (403) nếu lệch bãi.
              apiUpdateReservation(id, { status: 'Cancelled', cancelledBy: 'staff', staffId: currentUser?.id })
                .catch(() => {
                  // Bị chặn hoặc lỗi mạng → hoàn tác trạng thái lạc quan đã set ở trên.
                  setReservations((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, status: res.status } : r)),
                  );
                  addToast('Không thể hủy đặt chỗ — bãi đỗ không thuộc phân công của bạn.', 'error');
                });
              // Slot + area/floor stats freed back up once staff cancels the booking
              if (res.slotCode) {
                setSlots((prev) =>
                  prev.map((s) =>
                    s.slotCode === res.slotCode ? { ...s, status: "Available" } : s,
                  ),
                );
                updateSlotStatus(res.slotCode, 'Available').catch(() => {});
              }
              setAreas((prev) =>
                prev.map((a) =>
                  a.areaName === res.area
                    ? { ...a, availableSlots: a.availableSlots + 1, reservedSlots: Math.max(0, a.reservedSlots - 1) }
                    : a,
                ),
              );
              setFloors((prev) =>
                prev.map((f) =>
                  f.floorName === res.floor
                    ? { ...f, availableSlots: f.availableSlots + 1, reservedSlots: Math.max(0, f.reservedSlots - 1) }
                    : f,
                ),
              );
            }}
            onLogout={handleLogout}
            addToast={addToast}
            onAddEmergency={(log) => setEmergencyLogs((prev) => [log, ...prev])}
            onCreateIssue={handleCreateIssue}
          />
        </div>
      );
    }

    // Any other logged-in user (default: Parking User / Driver) gets the driver portal.
    // This guarantees every registered account can sign in instead of being blocked
    // by the "permission not assigned" screen.
    if (currentUser) {
      // Driver member portal flow - integrated directly into public site style
      return (
        <div
          className={`min-h-screen bg-slate-50/50 flex flex-col justify-between ${themeShellClass}`}
        >
          <div>
            <PublicNavbar
              currentView={currentView}
              setView={setView}
              user={currentUser}
              onLogout={handleLogout}
              notificationCount={notificationCount}
              onClearNotifications={handleClearNotifications}
              bellNotifications={userBellNotifications}
              onNotificationClick={handleNotificationClick}
            />
            <main
              className={
                ["home", "info", "pricing", "contact", "terms", "privacy", "help"].includes(currentView)
                  ? ""
                  : "mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"
              }
            >
              {/* Public Pages */}
              {currentView === "home" && (
                <Homepage setView={setView} stats={publicStats} pricingRules={pricingRules} />
              )}
              {currentView === "baixe" && (
                <ParkingLotsList setView={setView} pricingRules={pricingRules} />
              )}
              {currentView === "info" && (
                <ParkingInformation setView={setView} />
              )}
              {currentView === "slots" && (
                <AvailableSlotsPage
                  setView={setView}
                  slots={slots}
                  isLoggedIn={true}
                  currentUser={currentUser}
                  savedVehicles={savedVehicles}
                  onAddReservation={handleAddReservation}
                  onCancelReservation={handleCancelReservation}
                  onDiscardReservation={handleDiscardReservation}
                  reservations={reservations}
                  pricingRules={pricingRules}
                  lotStatuses={lotStatuses}
                />
              )}
              {currentView === "pricing" && (
                <PricingRulesPage setView={setView} pricingRules={pricingRules} />
              )}
              {currentView === "pricing-detail" && (
                <PricingDetail setView={setView} />
              )}
              {currentView === "contact" && (
                <ContactPage currentUser={currentUser} onSubmitFeedback={handleSubmitFeedback} />
              )}
              {currentView === "terms" && <TermsPage setView={setView} />}
              {currentView === "privacy" && <PrivacyPage setView={setView} />}
              {currentView === "help" && <HelpPage setView={setView} />}

              {/* VNPay Return — không cần đăng nhập, VNPay redirect thẳng về đây */}
              {currentView === "vnpay-return" && (
                <VNPayReturn
                  onPaymentSuccess={(id, ctx) => handleConfirmPayment(id, "VNPay", ctx)}
                  onMonthlyBookingPaid={handleMonthlyBookingPaid}
                  setView={setView}
                />
              )}

              {/* Driver-Specific Pages with a standard profile layout */}
              {[
                "myparking",
                "reservations",
                "payments",
                "feedback",
                "profile",
              ].includes(currentView) && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
                  {/* Driver Portal Navigation Menu Card */}
                  <div className="xl:min-w-0">
                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                      <div className="mb-5 flex items-center gap-3 border-b border-slate-50 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">
                          {currentUser.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">
                            {currentUser.fullName}
                          </h4>
                          <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                            Cổng người dùng
                          </span>
                        </div>
                      </div>
                      <nav className="space-y-1">
                        {[
                          { key: "myparking", label: "Trang của tôi" },
                          { key: "reservations", label: "Lịch sử đặt chỗ" },
                          { key: "payments", label: "Thanh toán" },
                          { key: "feedback", label: "Phản hồi / Hỗ trợ" },
                          { key: "profile", label: "Hồ sơ" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setView(item.key)}
                            className={`flex w-full items-center rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                              currentView === item.key
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-100"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-850"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center rounded-xl px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                        >
                          Đăng xuất
                        </button>
                      </nav>
                    </div>

                    {/* Quick links — separate card below the nav */}
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Lối tắt nhanh</p>
                      <div className="space-y-1">
                        {[
                          { key: "slots",   label: "Đặt chỗ gửi xe" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setView(item.key)}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                          >
                            <span>{item.label}</span>
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 18 6-6-6-6" /></svg>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Personal info — only on the "Lịch sử đặt chỗ" page */}
                    {currentView === "reservations" && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f67db]/10 text-[#1f67db]">
                            <UserCircle2 className="h-4 w-4" />
                          </div>
                          <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Thông tin cá nhân</h2>
                        </div>

                        <div className="mt-3 rounded-[14px] border border-slate-200 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1f67db] text-[16px] font-black">
                              {currentUser.fullName ? currentUser.fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : <UserCircle2 className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-500">Họ và tên</p>
                              <p className="mt-0.5 text-[16px] font-black tracking-tight text-slate-950 leading-tight truncate">
                                {currentUser.fullName || 'Chưa cập nhật'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid min-w-0 gap-2">
                          <div className="min-w-0 rounded-[14px] border border-slate-200 bg-white px-3 py-3">
                            <p className="text-[11px] text-slate-500">Email</p>
                            <p className="mt-0.5 truncate text-[14px] font-bold text-slate-900" title={currentUser.email || undefined}>{currentUser.email || 'Chưa cập nhật'}</p>
                          </div>
                          <div className="min-w-0 rounded-[14px] border border-slate-200 bg-white px-3 py-3">
                            <p className="text-[11px] text-slate-500">Số điện thoại</p>
                            <p className="mt-0.5 truncate text-[14px] font-bold text-slate-900" title={currentUser.phone || undefined}>{currentUser.phone || 'Chưa cập nhật'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side Content Panel */}
                  <div className="min-w-0">
                    {currentView === "myparking" && (
                      <MyParking
                        user={currentUser}
                        setView={setView}
                        currentSession={currentSession}
                        activeSessions={driverActiveSessions}
                        reservations={reservations.filter((r) => r.userId === currentUser.id)}
                        unpaidTotal={unpaidTotal}
                        unpaidIsEstimate={unpaidIsEstimate}
                        unpaidSessionAmount={unpaidSessionAmount}
                        unpaidReservationAmount={unpaidReservationAmount}
                        unpaidOtherAmount={unpaidOtherAmount}
                        feedbacks={feedbacks.filter((f) => f.userId === currentUser?.id)}
                        savedVehicles={savedVehicles}
                        pricingRules={pricingRules}
                        slots={slots}
                        onClearCheckedIn={(ids) => {
                          addHiddenResIds(ids);
                          setReservations((prev) => prev.filter((r) => !ids.includes(r.id)));
                          ids.forEach((id) => apiUpdateReservation(id, { status: 'Completed' }).catch(() => {}));
                        }}
                      />
                    )}
                    {currentView === "reservations" && (
                      <MyReservations
                        reservations={reservations.filter((r) => r.userId === currentUser.id)}
                        activeSessions={driverActiveSessions}
                        payments={payments}
                        onAddReservation={handleAddReservation}
                        onCancelReservation={handleCancelReservation}
                        floors={floors}
                        areas={areas}
                        slots={slots}
                        driverStatus={currentUser.status}
                        savedVehicles={savedVehicles}
                        systemConfig={systemConfig}
                        onExpireReservation={handleExpireReservation}
                        onClearHistory={(ids) => {
                          addHiddenResIds(ids);
                          setReservations((prev) => prev.filter((r) => !ids.includes(r.id)));
                          ids.forEach((id) => apiUpdateReservation(id, { status: 'Completed' }).catch(() => {}));
                        }}
                        setView={setView}
                        currentUser={currentUser}
                        currentSession={currentSession}
                        pricingRules={pricingRules}
                      />
                    )}
                    {currentView === "payments" && (
                      <PaymentsPage
                        payments={payments
                          .filter((p) => p.userId === currentUser.id && !hiddenPaymentIds.current.has(p.id))
                          .map((p) => {
                            if (p.licensePlate) return p;
                            // Enrich from current session
                            if (p.ticketCode === currentSession.ticketCode)
                              return { ...p, licensePlate: currentSession.licensePlate };
                            // Enrich from reservation (pre-paid: ticketCode === reservationCode)
                            const matchRes = reservations.find((r) => r.reservationCode === p.ticketCode);
                            if (matchRes) return { ...p, licensePlate: matchRes.licensePlate };
                            return p;
                          })}
                        reservations={reservations}
                        onClearPaid={() => {
                          // Hide-only: these rows stay in dbo.payments (and in this app's
                          // shared `payments` state) since Staff/Manager's revenue wallet
                          // depends on them — only this driver's own view forgets them.
                          const toHide = payments.filter((p) => p.userId === currentUser.id && p.status === "Paid");
                          addHiddenPaymentIds(toHide.map((p) => p.id));
                        }}
                      />
                    )}
                    {currentView === "feedback" && (
                      <FeedbackPage
                        feedbacks={feedbacks.filter((f) => f.userId === currentUser?.id)}
                        onSubmitFeedback={handleSubmitFeedback}
                      />
                    )}
                    {currentView === "profile" && (
                      <ProfilePage
                        user={currentUser}
                        savedVehicles={savedVehicles}
                        onUpdateUser={handleUpdateProfile}
                        onAddVehicle={handleAddVehicle}
                        onUpdateVehicle={handleUpdateVehicle}
                        onSetDefaultVehicle={handleSetDefaultVehicle}
                      />
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
          <Footer onNavigate={setView} />
        </div>
      );
    }

    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-center text-xs">
        <div className="bg-white p-6 rounded-2xl shadow border max-w-sm">
          <h4 className="font-bold text-slate-800">Phân quyền không hợp lệ</h4>
          <p className="text-slate-400 mt-1">
            Tài khoản này chưa được cấp đúng quyền để đăng nhập.
          </p>
          <button
            onClick={handleLogout}
            className="mt-4 rounded-xl bg-slate-900 text-white px-4 py-2 font-bold hover:bg-slate-850"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-slate-800 antialiased font-sans">
      {renderPortalLayout()}

      {/* Floating custom toast popup notifications */}
      <div className="fixed top-20 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl p-4 shadow-xl border text-xs font-bold text-white transition-all duration-300 transform translate-y-0 animate-slide-in-right ${
              toast.type === "success"
                ? "bg-emerald-600 border-emerald-500"
                : toast.type === "error"
                  ? "bg-rose-600 border-rose-500"
                  : "bg-slate-800 border-slate-700"
            }`}
          >
            {toast.type === "success" && (
              <svg
                className="h-5 w-5 shrink-0 text-emerald-100 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {toast.type === "error" && (
              <svg
                className="h-5 w-5 shrink-0 text-rose-100 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {toast.type === "info" && (
              <svg
                className="h-5 w-5 shrink-0 text-slate-100 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}

            <div className="flex-1 leading-snug whitespace-pre-line">
              {toast.message}
            </div>

            <button
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="ml-1 hover:opacity-80 focus:outline-none cursor-pointer shrink-0"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
