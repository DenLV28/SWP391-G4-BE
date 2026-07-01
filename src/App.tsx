import React, { useState, useEffect, useRef } from "react";
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
import LoginPage from "./pages/public/Login";
import RegisterPage from "./pages/public/Register";
import ParkingLotsList from "./pages/public/ParkingLotsList";

// Driver pages
import MyParking from "./pages/driver/MyParking";
import CurrentSessionPage from "./pages/driver/CurrentSession";
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
  setDefaultVehicle as apiSetDefaultVehicle,
} from "./services/vehicleService";
import {
  fetchReservationsByUser,
  fetchAllReservations,
  createReservation as apiCreateReservation,
  updateReservation as apiUpdateReservation,
} from "./services/reservationService";
import {
  fetchPaymentsByUser,
  fetchAllPayments,
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
} from "./services/paymentService";
import {
  fetchActiveSession,
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
import { fixMojibake } from "./utils/helpers";
import { fetchSlotStatuses, updateSlotStatus, subscribeToSlotEvents } from "./services/slotService";
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
  createdAt: record.createdAt ? String(record.createdAt) : new Date().toISOString().split("T")[0],
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
        "myparking", "session", "reservations", "payments", "feedback", "profile", "vnpay-return",
        "admindashboard", "usermanagement", "rolemanagement", "systemconfig",
        "managerdashboard", "parkinglots", "parkinglotdetail", "pricing-vehicles", "reports", "exceptions", "issues",
        "staffdashboard", "gatecontrol", "activitylog", "shiftlogs", "emergency",
      ];

      const targetView = (hash || "home").split("?")[0];

      if (!validViews.includes(targetView)) {
        setCurrentView("home");
        window.location.hash = "#/home";
        return;
      }

      if (!currentUser) {
        const isProtectedRoute = [
          "myparking", "session", "reservations", "payments", "feedback", "profile",
          "admindashboard", "usermanagement", "rolemanagement", "systemconfig",
          "managerdashboard", "parkinglots", "parkinglotdetail", "pricing-vehicles", "reports", "exceptions", "issues",
          "staffdashboard", "gatecontrol", "activitylog", "shiftlogs", "emergency",
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
  useEffect(() => {
    if (skipNextSlotSave.current) { skipNextSlotSave.current = false; return; }
    saveSlots(slots);
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

  // Poll DB every 30 s as a reliable fallback (covers SSE failures, ngrok drops, reconnects).
  useEffect(() => {
    const sync = async () => {
      const dbSlots = await fetchSlotStatuses();
      if (!dbSlots.length) return;
      setSlots((prev) =>
        prev.map((s) => {
          const db = dbSlots.find((d) => d.slotCode === s.slotCode);
          return db && db.status !== s.status ? { ...s, status: db.status } : s;
        }),
      );
    };
    sync();
    const id = setInterval(sync, 30000);
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

  const handleApproveIssue = (id: string) => {
    apiUpdateIssue(id, { status: 'Approved' }).catch(() => {});
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, status: 'Approved' } : i));
    const issue = issues.find((i) => i.id === id);
    if (issue?.slotCode) {
      setSlots((prev) => prev.map((s) => s.slotCode === issue.slotCode ? { ...s, status: 'Maintenance' } : s));
      updateSlotStatus(issue.slotCode, 'Maintenance').catch(() => {});
    }
  };

  const handleRejectIssue = (id: string) => {
    apiUpdateIssue(id, { status: 'Rejected' }).catch(() => {});
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, status: 'Rejected' } : i));
    const issue = issues.find((i) => i.id === id);
    if (issue?.slotCode) {
      setSlots((prev) => prev.map((s) => s.slotCode === issue.slotCode ? { ...s, status: 'Available' } : s));
      updateSlotStatus(issue.slotCode, 'Available').catch(() => {});
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

  // IDs of reservations the user explicitly cleared — persisted in localStorage so
  // polling cannot bring them back, even if the DB update is delayed or fails.
  const hiddenResIds = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('pf_hidden_res') || '[]') as string[])
  );
  const addHiddenResIds = (ids: string[]) => {
    ids.forEach((id) => hiddenResIds.current.add(id));
    localStorage.setItem('pf_hidden_res', JSON.stringify([...hiddenResIds.current]));
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
  const [systemConfig, setSystemConfig] =
    useState<SystemConfig>(initialSystemConfig);
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>(
    initialAdminActivities,
  );
  const [currentSession, setCurrentSession] = useState<ParkingSession>(() => {
    const sessions = loadSessions();
    return sessions?.[0] ?? initialParkingSession;
  });
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
            // No active session in DB for this user — clear any stale local session
            setCurrentSession((prev) => {
              if (prev.userId !== uid) {
                return { ...prev, userId: uid, ticketCode: '', sessionStatus: 'Cancelled', paymentStatus: 'Unpaid', barrierStatus: 'Closed' };
              }
              return prev;
            });
            return;
          }
          setCurrentSession(apiSession as any);
        })
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
        }
        if (isStaffOrManager) {
          const [apiRes, apiFb] = await Promise.all([
            fetchAllReservations(),
            fetchAllFeedbacks(),
          ]);
          if (apiRes.length > 0) setReservations(apiRes);
          if (apiFb.length > 0) setFeedbacks(apiFb);
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
      (p) => p.ticketCode === matchedReservation.reservationCode && p.status === 'Paid',
    );
    if (prePaidPayment) {
      setCurrentSession((prev) => ({ ...prev, paymentStatus: 'Paid' }));
      apiUpdateSession(currentSession.id, {
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
          if (
            latestUser.fullName !== currentUser.fullName ||
            latestUser.role !== currentUser.role ||
            latestUser.phone !== currentUser.phone ||
            latestUser.status !== currentUser.status
          ) {
            const refreshedUser: User = {
              ...currentUser,
              fullName: latestUser.fullName,
              phone: latestUser.phone,
              role: latestUser.role,
              status: latestUser.status,
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
    // Find matching local user by email to merge mock data (address, password, etc.)
    // and preserve local ID so savedVehicles/reservations/payments filters still work
    const localUser = users.find(
      (u) => u.email.toLowerCase() === user.email.toLowerCase(),
    );
    const merged: User = localUser
      ? { ...localUser, ...user, id: localUser.id }
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
  const handleAddReservation = (newRes: any): Reservation | null => {
    const code = `RSV-${Math.floor(1000 + Math.random() * 9000)}`;
    let assignedSlotCode = newRes.slotCode;

    if (!assignedSlotCode && newRes.slotAssignmentMode === "Auto") {
      const availableSlot = slots.find(
        (s) =>
          s.floorName === newRes.floor &&
          s.areaName === newRes.area &&
          s.vehicleType === newRes.vehicleType &&
          s.status === "Available",
      );
      if (availableSlot) {
        assignedSlotCode = availableSlot.slotCode;
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

    // Persist to DB (fire-and-forget; local state is already updated).
    apiCreateReservation(r).catch(() => {});

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

    // Slot becomes Pending until staff confirms
    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotCode === assignedSlotCode) {
          return { ...s, status: "Pending" };
        }
        return s;
      }),
    );
    if (assignedSlotCode) updateSlotStatus(assignedSlotCode, 'Pending').catch(() => {});

    return r;
  };

  const handleCancelReservation = (id: string) => {
    const targetRes = reservations.find((r) => r.id === id);
    if (!targetRes) return;

    // Check cancellation lead time: only block if start time is in the future but < 15 min away
    const dateOnly = targetRes.date.split('T')[0];
    const timeOnly = targetRes.startTime.slice(0, 5);
    const startDateTime = new Date(`${dateOnly}T${timeOnly}:00`);
    const diffMs = startDateTime.getTime() - Date.now();
    const diffMins = diffMs / (1000 * 60);

    if (diffMins > 0 && diffMins < 15) {
      alert('Không thể hủy đặt chỗ. Chỉ được hủy trước ít nhất 15 phút so với giờ bắt đầu.');
      return;
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Cancelled" } : r)),
    );
    apiUpdateReservation(id, { status: 'Cancelled' }).catch(() => {});

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

    alert(
      "Reservation cancelled successfully. The reserved slot has been released.",
    );
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

    alert("Reservation expired. The reserved slot has been released.");
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

  const handleCheckInReservation = (
    reservationId: string,
  ): {
    success: boolean;
    ticketCode?: string;
    slotCode?: string;
    error?: string;
  } => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return { success: false, error: "Reservation does not exist." };
    if (res.status !== "Confirmed")
      return {
        success: false,
        error: `Reservation status is ${res.status}, not Confirmed.`,
      };
    if (currentUser?.status !== "Active")
      return { success: false, error: "Account is not active." };

    // Find the specific reserved slot by slotCode, then fallback to area search
    let targetSlot = res.slotCode ? slots.find((s) => s.slotCode === res.slotCode) : undefined;
    if (!targetSlot) {
      targetSlot = slots.find(
        (s) =>
          s.floorName === res.floor &&
          s.areaName === res.area &&
          s.vehicleType === res.vehicleType &&
          (s.status === "Reserved" || s.status === "Available"),
      );
    }

    if (!targetSlot) {
      return {
        success: false,
        error: "No vacant slot available in the selected zone.",
      };
    }

    const ticketCode = `TCK-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Update reservation status to Checked-in
    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId ? { ...r, status: "Checked-in" } : r,
      ),
    );
    apiUpdateReservation(reservationId, { status: 'Checked-in' }).catch(() => {});

    // Update slot status to Occupied
    setSlots((prev) =>
      prev.map((s) =>
        s.id === targetSlot.id ? { ...s, status: "Occupied" } : s,
      ),
    );
    updateSlotStatus(targetSlot.slotCode, 'Occupied').catch(() => {});

    // Create a new current session
    const newSession: ParkingSession = {
      id: `SES-${Date.now()}`,
      userId: currentUser.id,
      ticketCode: ticketCode,
      licensePlate: res.licensePlate,
      vehicleType: res.vehicleType,
      checkInTime: new Date().toISOString().replace("T", " ").slice(0, 16),
      expectedEndTime: `${res.date} ${res.endTime}`,
      entryGate: "Gate A - Entrance Kiosk",
      floor: res.floor,
      area: res.area,
      slotCode: targetSlot.slotCode,
      estimatedFee: 0,
      paymentStatus: "Unpaid",
      sessionStatus: "Active",
      barrierStatus: "Closed",
    };

    // Update floor/area stats: decrement reserved, increment occupied
    setAreas((prev) =>
      prev.map((a) => {
        if (a.areaName === res.area) {
          return {
            ...a,
            reservedSlots: Math.max(0, a.reservedSlots - 1),
            occupiedSlots: a.occupiedSlots + 1,
          };
        }
        return a;
      }),
    );

    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorName === res.floor) {
          return {
            ...f,
            reservedSlots: Math.max(0, f.reservedSlots - 1),
            occupiedSlots: f.occupiedSlots + 1,
          };
        }
        return f;
      }),
    );

    // Auto create a matching unpaid invoice
    const newInvoice: Payment = {
      id: `PAY-${Date.now()}`,
      userId: currentUser.id,
      ticketCode: ticketCode,
      licensePlate: res.licensePlate,
      parkingFee: 0,
      extraServiceFee: 0,
      lostTicketFee: 0,
      discount: 0,
      totalAmount: 0,
      method: "",
      status: "Unpaid",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    setPayments((prev) => [newInvoice, ...prev]);
    apiCreatePayment(newInvoice).catch(() => {});

    setCurrentSession(newSession);
    apiCreateSession(newSession as any).catch(() => {});

    return { success: true, ticketCode, slotCode: targetSlot.slotCode };
  };

  const handleCheckOutSession = (
    ticketCode: string,
    paymentMethod: "Cash" | "Card" | "E-Wallet" | "QR Banking" | "Crypto",
    finalAmount: number,
  ): boolean => {
    if (currentSession.ticketCode !== ticketCode) return false;
    if (currentSession.sessionStatus !== "Active") return false;
    if (currentUser?.status !== "Active") return false;

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

    const checkOutTime = new Date().toISOString().replace("T", " ").slice(0, 16);
    setCurrentSession((prev) => ({
      ...prev,
      sessionStatus: "Completed",
      paymentStatus: "Paid",
      estimatedFee: finalAmount,
      barrierStatus: "Opened",
      checkOutTime,
    }));
    apiUpdateSession(currentSession.id, {
      sessionStatus: 'Completed',
      paymentStatus: 'Paid',
      paymentMethod,
      checkOutTime,
      estimatedFee: finalAmount,
      barrierStatus: 'Opened',
    }).catch(() => {});

    const paidAt = new Date().toISOString().replace("T", " ").slice(0, 16);
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
    alert(wasPrePaid
      ? "Xe ra cổng thành công. Barrier đã mở."
      : "Thanh toán thành công. Barrier đã mở. Check-out hoàn tất."
    );
    return true;
  };

  const handleConfirmPayment = (
    id: string,
    method: "Cash" | "Card" | "E-Wallet" | "QR Banking" | "Crypto" | "VNPay",
    vnpayCtx?: import('./pages/driver/VNPayReturn').VNPayCheckoutContext | null,
  ) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const payment = payments.find((p) => p.id === id);
    const finalAmount = payment?.totalAmount ?? vnpayCtx?.amount ?? 0;

    // Mark payment as Paid in local state + DB
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "Paid", method, paidAt: now } : p,
      ),
    );
    apiUpdatePayment(id, { status: 'Paid', method, paidAt: now, totalAmount: finalAmount }).catch(() => {});

    // If VNPay returned with checkout context, use it directly — payments may not be loaded yet
    if (vnpayCtx && vnpayCtx.sessionId) {
      setCurrentSession((prev) => ({ ...prev, paymentStatus: "Paid" }));
      apiUpdateSession(vnpayCtx.sessionId, { paymentStatus: 'Paid', paymentMethod: method }).catch(() => {});
      alert('Thanh toán VNPay thành công. Quay lại trang Lượt gửi và bấm "Mở barie" để xe ra cổng.');
      return;
    }

    // Fallback: look up payment in local state (for non-VNPay or same-session payments)
    if (payment && payment.ticketCode === currentSession.ticketCode && currentSession.sessionStatus === 'Active') {
      setCurrentSession((prev) => ({ ...prev, paymentStatus: "Paid" }));
      apiUpdateSession(currentSession.id, { paymentStatus: 'Paid', paymentMethod: method }).catch(() => {});
      alert('Thanh toán thành công qua ' + method + '. Bấm "Mở barie" trong trang Lượt gửi hiện tại để xe ra cổng.');
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

  const handleSubmitFeedback = (newFb: any) => {
    const ts = Date.now();
    const fbCode = `FB-${ts.toString().slice(-6)}`;
    const f: Feedback = {
      id: `FB-${ts}`,
      userId: currentUser?.id || "",
      feedbackCode: fbCode,
      status: "New",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      ...newFb,
    };
    setFeedbacks((prev) => [f, ...prev]);
    apiCreateFeedback(f).catch(() => {});
  };

  const handleRespondFeedback = (id: string, response: string, newStatus?: Feedback['status']) => {
    const respondedAt = new Date().toISOString().replace("T", " ").slice(0, 16);
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

  const handleUpdateProfile = (up: Partial<User>) => {
    if (!currentUser) return;
    const nextUser = { ...currentUser, ...up };
    setCurrentUser(nextUser);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...up } : u)),
    );
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
      });
      setUsers((prev) => [toAppUser(created), ...prev]);

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Create User Profile",
        actor: currentUser?.fullName || "System Admin",
        target: `${u.fullName} (${u.email})`,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("New account created successfully.");
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể tạo tài khoản.");
      return false;
    }
  };

  const handleEditUser = async (id: string, u: any): Promise<boolean> => {
    try {
      const updated = await userService.updateUser(id, {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        assignedParkingLot: u.assignedParkingLot || '',
      });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === id ? toAppUser(updated) : usr)),
      );

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Update User Profile",
        actor: currentUser?.fullName || "System Admin",
        target: `${u.fullName} (${u.email})`,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("User account details stored successfully.");
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật tài khoản.");
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    try {
      await userService.deleteUser(id);
      setUsers((prev) => prev.filter((usr) => usr.id !== id));

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action: "Delete User Account",
        actor: currentUser?.fullName || "System Admin",
        target: `${targetUser.fullName} (${targetUser.email})`,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert("User account deleted.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể xóa tài khoản.");
    }
  };

  const handleToggleLockUser = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    const nextStatus = targetUser.status === "Locked" ? "Active" : "Locked";

    try {
      const updated = await userService.updateUser(id, { status: nextStatus });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === id ? toAppUser(updated) : usr)),
      );

      const log: AdminActivity = {
        id: `ACT-${Date.now()}`,
        action:
          nextStatus === "Locked" ? "Lock User Account" : "Unlock User Account",
        actor: currentUser?.fullName || "System Admin",
        target: `${targetUser.fullName} (${targetUser.email})`,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      };
      setAdminActivities((prev) => [log, ...prev]);
      alert(`Account access status updated to: ${nextStatus}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể cập nhật trạng thái tài khoản.");
    }
  };

  const handleAssignRole = (userId: string, newRole: Role) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) =>
      prev.map((usr) => (usr.id === userId ? { ...usr, role: newRole } : usr)),
    );

    const log: AdminActivity = {
      id: `ACT-${Date.now()}`,
      action: "Assign Role Credentials",
      actor: currentUser?.fullName || "System Admin",
      target: `${targetUser.fullName} assigned to ${newRole}`,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    setAdminActivities((prev) => [log, ...prev]);
  };

  const handleSaveConfig = (updated: Partial<SystemConfig>) => {
    setSystemConfig((prev) => ({ ...prev, ...updated }));

    const log: AdminActivity = {
      id: `ACT-${Date.now()}`,
      action: "Configure system settings",
      actor: currentUser?.fullName || "System Admin",
      target: "Stored global configurations",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
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

  // Calculate unpaid total — includes:
  // 1. Unpaid payments with known amount
  // 2. Active session fee estimated by current time (payment totalAmount=0)
  // 3. Confirmed/Pending reservations that paid "Thanh toán sau" (no paid payment record)
  const { unpaidTotal, unpaidIsEstimate } = React.useMemo(() => {
    let total = 0;
    let hasEstimate = false;

    // Part 1 & 2: Unpaid payment records
    for (const p of payments) {
      if (p.status !== 'Unpaid' || p.userId !== currentUser?.id) continue;
      if (p.totalAmount > 0) {
        total += p.totalAmount;
        continue;
      }
      // Payment is 0 — estimate from active session duration
      if (
        currentSession.sessionStatus === 'Active' &&
        currentSession.paymentStatus !== 'Paid' &&
        p.ticketCode === currentSession.ticketCode
      ) {
        const rule = mockPricingRules.find((r) => r.vehicleType === currentSession.vehicleType) ?? mockPricingRules[0];
        const start = new Date(currentSession.checkInTime.replace(' ', 'T'));
        const totalMins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
        const extraHours = totalMins > 60 ? Math.ceil((totalMins - 60) / 60) : 0;
        const estimated = rule.firstHourPrice + extraHours * rule.nextHourPrice + rule.extraServiceFee;
        total += estimated;
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
        total += r.estimatedCost;
        hasEstimate = true;
      }
    }

    return { unpaidTotal: total, unpaidIsEstimate: hasEstimate };
  }, [payments, currentUser, currentSession, reservations]);
  const upcomingRes = reservations.find(
    (r) => r.status === "Confirmed" || r.status === "Pending",
  );

  // Bell notification: track reservations that became Confirmed after the user last cleared
  const [seenConfirmedIds, setSeenConfirmedIds] = React.useState<Set<string>>(() => {
    // Pre-seed with all currently confirmed reservations so we only notify about NEW ones
    const initial = new Set<string>();
    for (const r of reservations) {
      if (r.status === "Confirmed") initial.add(r.id);
    }
    return initial;
  });

  const notificationCount = React.useMemo(() => {
    if (!currentUser || currentUser.role !== "Parking User / Driver") return 0;
    return reservations.filter(
      (r) => r.userId === currentUser.id && r.status === "Confirmed" && !seenConfirmedIds.has(r.id),
    ).length;
  }, [reservations, currentUser, seenConfirmedIds]);

  const userBellNotifications = React.useMemo(() => {
    if (!currentUser || currentUser.role !== "Parking User / Driver") return [];
    const items: { id: string; type: "reservation" | "feedback"; title: string; body: string; targetView: string }[] = [];

    reservations
      .filter((r) => r.userId === currentUser.id && r.status === "Confirmed" && !seenConfirmedIds.has(r.id))
      .forEach((r) =>
        items.push({
          id: r.id,
          type: "reservation",
          title: "Đặt chỗ đã được xác nhận",
          body: `${r.reservationCode} · ${r.date} ${r.startTime}`,
          targetView: "reservations",
        }),
      );

    feedbacks
      .filter((f) => f.userId === currentUser.id && f.staffResponse)
      .forEach((f) =>
        items.push({
          id: f.id,
          type: "feedback",
          title: "Nhân viên đã phản hồi yêu cầu",
          body: `${f.type} · "${(f.staffResponse ?? "").slice(0, 50)}${(f.staffResponse ?? "").length > 50 ? "..." : ""}"`,
          targetView: "feedback",
        }),
      );

    return items;
  }, [currentUser, reservations, feedbacks, seenConfirmedIds]);

  const handleClearNotifications = () => {
    setSeenConfirmedIds((prev) => {
      const next = new Set(prev);
      for (const r of reservations) {
        if (r.status === "Confirmed") next.add(r.id);
      }
      return next;
    });
  };

  const getDriverPortalTitle = (view: string) => {
    switch (view) {
      case "myparking":
        return "Trang của tôi";
      case "session":
        return "Lượt gửi hiện tại";
      case "reservations":
        return "Đặt chỗ của tôi";
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
                ["home", "info", "pricing", "contact", "terms", "privacy"].includes(currentView)
                  ? ""
                  : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
              }
            >
              {currentView === "home" && (
                <Homepage setView={setView} stats={publicStats} />
              )}
              {currentView === "baixe" && (
                <ParkingLotsList setView={setView} />
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
                  reservations={reservations}
                />
              )}
              {currentView === "pricing" && (
                <PricingRulesPage setView={setView} />
              )}
              {currentView === "pricing-detail" && (
                <PricingDetail setView={setView} />
              )}
              {currentView === "contact" && <ContactPage />}
              {currentView === "terms" && <TermsPage setView={setView} />}
              {currentView === "privacy" && <PrivacyPage setView={setView} />}
              {/* VNPay redirect về đây kể cả khi chưa đăng nhập */}
              {currentView === "vnpay-return" && (
                <VNPayReturn
                  onPaymentSuccess={(id, ctx) => handleConfirmPayment(id, "VNPay", ctx)}
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
                />
              )}
              {currentView === "rolemanagement" && (
                <RoleManagement
                  users={users}
                  onAssignRole={handleAssignRole}
                  activeAdminEmail={currentUser.email}
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
            feedbacks={feedbacks}
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
            pricingRules={mockPricingRules}
            feedbacks={feedbacks}
            onConfirmReservation={(id) => {
              const res = reservations.find((r) => r.id === id);
              setReservations((prev) =>
                prev.map((r) =>
                  r.id === id ? { ...r, status: "Confirmed" } : r,
                ),
              );
              apiUpdateReservation(id, { status: 'Confirmed' }).catch(() => {});
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
            onRespondFeedback={handleRespondFeedback}
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
            />
            <main
              className={
                ["home", "info", "pricing", "contact", "terms", "privacy"].includes(currentView)
                  ? ""
                  : "mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"
              }
            >
              {/* Public Pages */}
              {currentView === "home" && (
                <Homepage setView={setView} stats={publicStats} />
              )}
              {currentView === "baixe" && (
                <ParkingLotsList setView={setView} />
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
                  reservations={reservations}
                />
              )}
              {currentView === "pricing" && (
                <PricingRulesPage setView={setView} />
              )}
              {currentView === "pricing-detail" && (
                <PricingDetail setView={setView} />
              )}
              {currentView === "contact" && <ContactPage />}
              {currentView === "terms" && <TermsPage setView={setView} />}
              {currentView === "privacy" && <PrivacyPage setView={setView} />}

              {/* VNPay Return — không cần đăng nhập, VNPay redirect thẳng về đây */}
              {currentView === "vnpay-return" && (
                <VNPayReturn
                  onPaymentSuccess={(id, ctx) => handleConfirmPayment(id, "VNPay", ctx)}
                  setView={setView}
                />
              )}

              {/* Driver-Specific Pages with a standard profile layout */}
              {[
                "myparking",
                "session",
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
                          { key: "session", label: "Lượt gửi hiện tại" },
                          { key: "reservations", label: "Đặt chỗ của tôi" },
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
                          { key: "session", label: "Lượt gửi hiện tại" },
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
                  </div>

                  {/* Right Side Content Panel */}
                  <div className="min-w-0">
                    {currentView === "myparking" && (
                      <MyParking
                        user={currentUser}
                        setView={setView}
                        currentSession={currentSession}
                        reservations={reservations.filter((r) => r.userId === currentUser.id)}
                        unpaidTotal={unpaidTotal}
                        unpaidIsEstimate={unpaidIsEstimate}
                        feedbacks={feedbacks.filter((f) => f.userId === currentUser?.id)}
                        savedVehicles={savedVehicles}
                        onClearCheckedIn={(ids) => {
                          addHiddenResIds(ids);
                          setReservations((prev) => prev.filter((r) => !ids.includes(r.id)));
                          ids.forEach((id) => apiUpdateReservation(id, { status: 'Completed' }).catch(() => {}));
                        }}
                      />
                    )}
                    {currentView === "session" && (
                      <CurrentSessionPage
                        currentSession={currentSession}
                        setView={setView}
                        onCheckOutSession={handleCheckOutSession}
                        pricingRules={mockPricingRules}
                        currentUser={currentUser}
                        slots={slots}
                        payments={payments}
                        reservations={reservations.filter((r) => r.userId === currentUser.id)}
                        savedVehicles={savedVehicles}
                      />
                    )}
                    {currentView === "reservations" && (
                      <MyReservations
                        reservations={reservations.filter((r) => r.userId === currentUser.id)}
                        onAddReservation={handleAddReservation}
                        onCancelReservation={handleCancelReservation}
                        floors={floors}
                        areas={areas}
                        slots={slots}
                        driverStatus={currentUser.status}
                        savedVehicles={savedVehicles}
                        systemConfig={systemConfig}
                        onCheckInReservation={handleCheckInReservation}
                        onExpireReservation={handleExpireReservation}
                        onClearHistory={(ids) => {
                          addHiddenResIds(ids);
                          setReservations((prev) => prev.filter((r) => !ids.includes(r.id)));
                          ids.forEach((id) => apiUpdateReservation(id, { status: 'Completed' }).catch(() => {}));
                        }}
                        setView={setView}
                        currentUser={currentUser}
                        currentSession={currentSession}
                        pricingRules={mockPricingRules}
                      />
                    )}
                    {currentView === "payments" && (
                      <PaymentsPage
                        payments={payments
                          .filter((p) => p.userId === currentUser.id)
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
                        onConfirmPayment={handleConfirmPayment}
                        onClearPaid={() =>
                          setPayments((prev) =>
                            prev.filter((p) => !(p.userId === currentUser.id && p.status === "Paid"))
                          )
                        }
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
