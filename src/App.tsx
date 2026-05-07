import { useState, useEffect, useMemo, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Users,
  CreditCard,
  FileText,
  Wrench,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  User as UserIcon,
  Settings,
  LayoutDashboard,
  LogIn,
  Mail,
  Lock,
  UserPlus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  TrendingUp,
  CheckCircle2,
  ScanLine,
} from "lucide-react";
import { BarcodeScanner } from "./components/BarcodeScanner";

// Local Component Imports
import TenantDashboard from "./components/TenantDashboard";
import LandlordDashboard from "./components/LandlordDashboard";
import AdminDashboard from "./components/AdminDashboard";
import Onboarding, { BDICheckStandalone } from "./components/Onboarding";
import ContractsManagement from "./components/ContractsManagement";
import { PaymentsManagement, PropertyCondition, ChatUI } from "./components/SharedViews";
import MaintenanceManagement from "./components/MaintenanceManagement";
import { TenantDashboardNavTarget } from "./lib/tenantDashboard";

// Utilities & Types
import { Role, User, Property } from "./types";
import { cn } from "./lib/utils";
import { useAppData } from "./lib/appData";
import { BRAND_LOCAL_EMAIL_DOMAIN, BRAND_NAME, BRAND_SLOGAN } from "./lib/brand";

// Assets
import welcomeImage from "./image/Gemini_Generated_Image_u8ml1gu8ml1gu8ml.png";
import hagaiLogo from "./image/HAGAI_LOGO.png";

// House Images
import house1 from "./image/houseimg/house_1.jpg";
import house2 from "./image/houseimg/house_2.jpg";
import house3 from "./image/houseimg/house_3.jpg";
import house4 from "./image/houseimg/house_4.jpg";
import house5 from "./image/houseimg/house_5.jpeg";
import house6 from "./image/houseimg/house_6.jpeg";

const propertyPlaceholder = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=2070";

type AppNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

/**
 * גרים פה Main Application
 */
export default function App() {
  const { db, currentUser: user, siteAccessSession, isReady, logout } = useAppData();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);
  const needsOnboarding = Boolean(user?.role === "tenant" && !user.onboardingComplete);

  useEffect(() => {
    if (needsOnboarding) {
      setShowOnboardingFlow(true);
    }
  }, [needsOnboarding]);

  const handleLogout = () => {
    logout();
    setShowOnboardingFlow(false);
    setIsMobileSidebarOpen(false);
    setActiveTab("dashboard");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const isSidebarExpanded = isSidebarOpen || isMobileSidebarOpen;
  const navItems = user ? getNavItemsForRole(user.role) : [];
  const activeNavLabel = navItems.find((item) => item.id === activeTab)?.label ?? "בית";
  const recentContacts = useMemo(() => {
    if (!user || user.role !== "landlord") return [];

    return [...db.messageTopics]
      .filter((topic) => topic.participantIds.includes(user.id))
      .sort((left, right) => Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt))
      .map((topic) => {
        const counterpartyId = topic.participantIds.find((participantId) => participantId !== user.id);
        return counterpartyId ? db.users.find((candidate) => candidate.id === counterpartyId) : null;
      })
      .filter((candidate): candidate is User => Boolean(candidate))
      .slice(0, 3);
  }, [db.messageTopics, db.users, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab, siteAccessSession, showOnboardingFlow, user?.id]);

  // A tenant invite QR is a public entry point. Do not reuse the last local session
  // from the same mobile browser, otherwise the QR opens the previous account.
  useEffect(() => {
    const propertyId = new URLSearchParams(window.location.search).get("propertyId");
    if (isReady && propertyId && user && !(user.role === "tenant" && needsOnboarding)) {
      logout();
      setShowOnboardingFlow(false);
    }
  }, [isReady, logout, needsOnboarding, user]);

  // 1. Initial Loading Screen
  if (!isReady) {
    return <LoadingScreen />;
  }

  const urlPropertyId = new URLSearchParams(window.location.search).get("propertyId") || undefined;

  // Public tenant invite: scanning a QR should not require the internal site-access gate.
  if (!siteAccessSession && !user && urlPropertyId) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 flex flex-col">
        <WelcomeScreen propertyId={urlPropertyId} />
      </div>
    );
  }

  // 2. Site Access Gate
  if (!siteAccessSession && user?.role !== "tenant") {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 flex flex-col">
        <SiteAccessScreen />
      </div>
    );
  }

  // 3. Login / Welcome Screen
  if (!user) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 flex flex-col">
        <WelcomeScreen propertyId={urlPropertyId} />
      </div>
    );
  }

  // 4. Tenant Onboarding Flow (if applicable)
  if (showOnboardingFlow && user.role === "tenant") {
    return (
        <Onboarding
          user={user}
          onComplete={() => {
            setShowOnboardingFlow(false);
          }}
          onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen min-w-0 flex-col bg-slate-100 font-sans text-right selection:bg-blue-100 selection:text-blue-900 md:h-screen md:flex-row" dir="rtl">
      {isMobileSidebarOpen && (
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-[2px] md:hidden"
          aria-label="סגור תפריט"
        />
      )}
      
      {/* 4. GLOBAL SIDEBAR NAVIGATION */}
      <aside className={cn(
        "bg-white rounded-[32px] border border-slate-200/40 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_20px_50px_rgba(0,0,0,0.05)] z-30 flex flex-col shrink-0",
        "fixed inset-y-4 right-4 left-4 md:static md:inset-auto md:h-[calc(100vh-2.5rem)] md:my-5 md:mx-5",
        isMobileSidebarOpen
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-[105%] opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto",
        isSidebarOpen ? "md:w-80" : "md:w-24"
      )}>
        {/* Toggle Button for Desktop - Repositioned to match image style */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 z-40 hidden md:flex"
        >
          {isSidebarOpen ? <ChevronRight size={10} className="text-slate-400" /> : <ChevronLeft size={10} className="text-slate-400" />}
        </button>

        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* Sidebar Logo Area */}
          <div className="flex items-center gap-4 p-8 pt-10 h-24 shrink-0 transition-all">
            <div className="h-16 shrink-0 cursor-pointer active:scale-95 md:h-[4.5rem]">
              <img src={hagaiLogo} alt="Logo" className="h-full w-auto object-contain" />
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="mr-auto h-10 w-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center md:hidden"
              aria-label="סגור תפריט"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Scroll Area */}
          <div className="flex-1 px-4 overflow-y-auto no-scrollbar space-y-6">
            <div className="space-y-1">
              <NavCategory label="ניווט" collapsed={!isSidebarExpanded} />
              {navItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={activeTab === item.id}
                  onClick={() => handleTabChange(item.id)}
                  collapsed={!isSidebarExpanded}
                />
              ))}
            </div>

            {user.role === "landlord" && (
              <div className="space-y-1 pt-2">
                <div className="flex items-center justify-between px-4 pb-2 group">
                  <NavCategory label="אנשי קשר אחרונים" collapsed={!isSidebarExpanded} />
                </div>
                
                {recentContacts.length > 0 ? (
                  recentContacts.map((contact) => (
                    <MessageUser
                      key={contact.id}
                      name={contact.name}
                      collapsed={!isSidebarExpanded}
                      online={contact.role === "tenant" && contact.onboardingComplete}
                      onClick={() => handleTabChange("messages")}
                    />
                  ))
                ) : (
                  !isSidebarExpanded ? null : (
                    <p className="px-4 py-3 text-[12px] font-bold text-slate-400">
                      אין עדיין שיחות פעילות.
                    </p>
                  )
                )}
              </div>
            )}
            
            <div className="space-y-1 pt-2">
              <NavCategory label="חשבון" collapsed={!isSidebarExpanded} />
              <SidebarItem
                icon={<LogOut size={18} />}
                label="התנתקות"
                active={false}
                onClick={handleLogout}
                collapsed={!isSidebarExpanded}
                tone="danger"
              />
            </div>
          </div>

          {/* User Profile Card Footer */}
          <div className="p-4 mt-auto border-t border-slate-50">
             <div className={cn(
               "flex items-center gap-3 p-3 rounded-2xl transition-all",
               isSidebarExpanded ? "bg-slate-50 border border-slate-100" : "justify-center px-0 bg-transparent"
             )}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white bg-slate-900 text-sm font-black text-white shadow-sm">
                   {user.name.charAt(0)}
                </div>
                {isSidebarExpanded && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900">{user.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 tracking-wider">
                       {user.role === "admin" ? "מנהל מערכת" : user.role === "landlord" ? "משכיר" : "שוכר"}
                    </p>
                  </div>
                )}
                {isSidebarExpanded && <ChevronRight size={14} className="text-slate-300 rotate-90" />}
             </div>
          </div>
        </div>
      </aside>

      {/* 5. MAIN CONTENT AREA */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-[#F9FBFB]">
        
        {/* Top Header Bar */}
        <header className="h-20 shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/40 flex items-center justify-between gap-3 px-4 md:h-24 md:px-12 z-20 sticky top-0">
          <div className="flex items-center gap-8 flex-1 min-w-0">
             <div className="relative group max-w-sm w-full hidden lg:block">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                <input 
                  type="text" 
                  placeholder="חיפוש מהיר בדף הנוכחי..." 
                  className="w-full bg-slate-100/50 border border-transparent rounded-2xl py-3 pl-6 pr-12 text-[13px] focus:outline-none focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-900/5 transition-all font-semibold placeholder:text-slate-400" 
                />
             </div>
             <div className="min-w-0 lg:hidden">
                <p className="truncate text-[15px] font-black leading-tight text-slate-900">{activeNavLabel}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {user.role === "admin" ? "מנהל מערכת" : user.role === "landlord" ? "משכיר" : "דייר"}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2 md:gap-8">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg md:hidden"
              aria-label="פתח תפריט"
            >
              <Menu size={20} />
            </button>
            <button className="relative h-11 w-11 md:h-12 md:w-12 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm">
              <Bell size={20} />
              <span className="absolute top-3 right-3 h-2.5 w-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 md:gap-5 shrink-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-[15px] font-bold text-slate-900 leading-none max-w-[220px] font-display tracking-tight break-words">{user.name}</p>
                <p className="mt-1.5 text-[10px] text-slate-400 font-bold tracking-wide">
                  {user.role === "admin" ? "מנהל מערכת" : user.role === "landlord" ? "משכיר" : "שוכר"}
                </p>
              </div>
              <button className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 overflow-hidden hover:border-slate-900 shadow-sm transition-all group md:h-14 md:w-14">
                 <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform md:h-10 md:w-10">
                    <UserIcon size={20} />
                 </div>
              </button>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8 lg:p-12 custom-scrollbar scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -5 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mx-auto w-full min-w-0 max-w-7xl"
            >
              {renderTabContent(
                activeTab,
                user,
                (target) => handleTabChange(target),
                (needsOnboarding || user.email === "noa@example.com") ? () => setShowOnboardingFlow(true) : undefined,
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component Rendering Logic
// -----------------------------------------------------------------------------

function renderTabContent(
  tab: string,
  user: User,
  onNavigate: (target: TenantDashboardNavTarget) => void,
  onResumeOnboarding?: () => void,
) {
  const role = user.role;
  switch (tab) {
    case "dashboard":
      if (role === "tenant") {
        return (
          <TenantDashboard
            user={user}
            onNavigate={onNavigate}
            onResumeOnboarding={onResumeOnboarding}
          />
        );
      }
      if (role === "landlord") return <LandlordDashboard user={user} />;
      if (role === "admin") return <AdminDashboard user={user} />;
      return null;
    case "contracts":
      return <ContractsManagement user={user} />;
    case "payments":
      return <PaymentsManagement user={user} />;
    case "maintenance":
      return <MaintenanceManagement user={user} />;
    case "condition":
      return <PropertyCondition user={user} />;
    case "messages":
      return <ChatUI user={user} />;
    default:
      return <div className="text-center py-20 text-slate-400">העמוד בבנייה...</div>;
  }
}

// -----------------------------------------------------------------------------
// UI Sub-Components
// -----------------------------------------------------------------------------

function SidebarItem({ icon, label, active, onClick, collapsed, children, hasSubItems, isExpanded, tone = "default" }: any) {
  return (
    <div className="w-full">
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-[20px] transition-all duration-300 group",
          active 
            ? "bg-slate-50 text-slate-900 shadow-sm" 
            : "text-slate-400 hover:text-slate-900 bg-transparent hover:bg-slate-50/50",
          tone === "danger" && !active && "text-rose-500 hover:text-rose-700 hover:bg-rose-50/80",
          collapsed && "justify-center px-0"
        )}
      >
        <span className={cn(
          "shrink-0 transition-transform duration-300", 
          active ? "scale-110" : "group-hover:scale-110"
        )}>
          {icon}
        </span>
        {!collapsed && (
          <span className="flex-1 min-w-0 text-right text-[13px] font-bold tracking-tight">
            {label}
          </span>
        )}
        {!collapsed && hasSubItems && (
          <ChevronRight size={14} className={cn("text-slate-300 transition-transform", isExpanded ? "rotate-90" : "")} />
        )}
      </button>
      {children}
    </div>
  );
}

function NavCategory({ label, collapsed }: { label: string, collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <p className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
      {label}
    </p>
  );
}

function SubItem({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className={cn(
      "w-full pr-10 pl-4 py-2 rounded-2xl text-right text-[12px] font-medium transition-all relative overflow-hidden",
      active ? "text-slate-900 bg-slate-50/80" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50/40"
    )}>
      {active && <div className="absolute top-1/2 right-4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-900" />}
      {label}
    </button>
  );
}

function getNavItemsForRole(role: Role): AppNavItem[] {
  if (role === "tenant") {
    return [
      { id: "dashboard", label: "בית הדייר", icon: <LayoutDashboard size={18} /> },
      { id: "payments", label: "תשלומים", icon: <CreditCard size={18} /> },
      { id: "contracts", label: "מסמכים וחוזה", icon: <FileText size={18} /> },
      { id: "maintenance", label: "תחזוקה", icon: <Wrench size={18} /> },
      { id: "messages", label: "הודעות", icon: <MessageSquare size={18} /> },
    ];
  }

  if (role === "landlord") {
    return [
      { id: "dashboard", label: "מרכז שליטה", icon: <LayoutDashboard size={18} /> },
      { id: "payments", label: "גבייה", icon: <CreditCard size={18} /> },
      { id: "contracts", label: "חוזים", icon: <FileText size={18} /> },
      { id: "maintenance", label: "תקלות וקריאות", icon: <Wrench size={18} /> },
      { id: "messages", label: "הודעות", icon: <MessageSquare size={18} /> },
    ];
  }

  return [
    { id: "dashboard", label: "סקירה מערכתית", icon: <LayoutDashboard size={18} /> },
    { id: "payments", label: "ניהול גבייה", icon: <CreditCard size={18} /> },
    { id: "contracts", label: "חוזים והסכמים", icon: <FileText size={18} /> },
  ];
}

function MessageUser({ name, collapsed, online, onClick }: { name: string, collapsed: boolean, online: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={online ? onClick : undefined}
      className={cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl hover:bg-slate-50 transition-all group",
      collapsed && "justify-center px-0"
    )}>
      <div className="relative shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-slate-100 text-xs font-black text-slate-700 transition-all group-hover:bg-slate-900 group-hover:text-white">
          {name.charAt(0)}
        </div>
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
          online ? "bg-emerald-500" : "bg-rose-500"
        )} />
      </div>
      {!collapsed && (
        <span className="flex-1 min-w-0 text-right text-[13px] font-bold text-slate-500 group-hover:text-slate-900">
          {name}
        </span>
      )}
    </button>
  );
}

export function WelcomeScreen({ propertyId }: { propertyId?: string }) {
  const { db, login, register, clearSiteAccess } = useAppData();
  const [isRegister, setIsRegister] = useState(Boolean(propertyId));
  const [activePropertyId, setActivePropertyId] = useState<string | undefined>(propertyId);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showPropertyBoard, setShowPropertyBoard] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    setActivePropertyId(propertyId);
    setIsRegister(Boolean(propertyId));
  }, [propertyId]);

  const handleQrScan = (value: string) => {
    setShowQrScanner(false);
    try {
      const url = new URL(value);
      const scannedPropertyId = url.searchParams.get("propertyId");
      if (scannedPropertyId) {
        const propertyExists = db.properties.some((property) => property.id === scannedPropertyId);
        if (!propertyExists) {
          setError("קוד ה-QR תקין, אבל הנכס לא נמצא במערכת המקומית.");
          return;
        }
        setActivePropertyId(scannedPropertyId);
        setIsRegister(true);
        setError(null);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}?propertyId=${encodeURIComponent(scannedPropertyId)}`,
        );
        return;
      }
    } catch {}
    // If not a URL with propertyId, just show the value as an error hint
    setError("קוד ה-QR שנסרק אינו מכיל מזהה נכס תקין. נסה שוב.");
  };

  // When coming from a QR invite (propertyId present), skip role selection — always register as tenant
  if (showRoleSelection && pendingDraft) {
    return (
      <RoleSelection
        onSelect={async (role) => {
          setError(null);
          setIsLoading(true);
          try {
            await register({
              name: pendingDraft.name,
              email: pendingDraft.email,
              password: pendingDraft.password,
              role,
              propertyId: role === "tenant" ? activePropertyId : undefined,
            });
            if (activePropertyId) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (err: any) {
            console.error(err);
            setError(err?.message || "אירעה שגיאה לא צפויה");
          } finally {
            setIsLoading(false);
          }
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error("נא להזין שם מלא");
        if (!email.trim()) throw new Error("נא להזין כתובת דוא\"ל");
        if (!password.trim()) throw new Error("נא להזין סיסמה");

        if (activePropertyId) {
          // QR invite flow — register directly as tenant, no role selection
          await register({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: "tenant",
            propertyId: activePropertyId,
          });
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // Normal flow — show role selection
          setPendingDraft({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          });
          setShowRoleSelection(true);
        }
      } else {
        await login(email, password, activePropertyId);
        if (activePropertyId) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "אירעה שגיאה לא צפויה");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setIsRegister(false);
    setEmail(demoEmail);
    setPassword("123123");
    
    // Map email to a readable username for demo purposes
    const usernameMap: Record<string, string> = {
      "admin@admin.com": "מנהל מערכת",
      "landlord@landlord.com": "משכיר הדגמה",
      "tenant@tenant.com": "דייר הדגמה",
      "noa@example.com": "מועמדת הדגמה"
    };
    
    setName(usernameMap[demoEmail] || demoEmail.split('@')[0]);
    setError(null);
    try {
      await login(demoEmail, "123123", activePropertyId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "אירעה שגיאה לא צפויה");
    }
  };

  const handleGoogleStyleLogin = () => {
    const timestamp = Date.now().toString().slice(-6);
    setPendingDraft({
      name: `משתמש חדש ${timestamp}`,
      email: `google-${timestamp}@${BRAND_LOCAL_EMAIL_DOMAIN}`,
      password: "123123",
    });
    setShowRoleSelection(true);
  };

  const publicProperties = db.properties
    .filter((property) => !property.isArchived && property.catalogStatus !== "archived")
    .sort((left, right) => {
      if (left.status === right.status) return 0;
      if (left.status === "vacant") return -1;
      if (right.status === "vacant") return 1;
      return 0;
    })
    .slice(0, 6)
    .map((p, idx) => {
       const houseImages = [house1, house2, house3, house4, house5, house6];
       return {
          ...p,
          imageUrl: houseImages[idx % houseImages.length]
       };
    });
  const managedPropertiesCount = "34,987";
  const successRate = "99.5%";

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-start overflow-x-hidden bg-slate-100 p-3 font-sans selection:bg-slate-900 selection:text-white sm:p-4 md:p-6 lg:p-8" dir="rtl">
      
      {/* 1. Full-Page Background Image */}
      <img 
        src={welcomeImage} 
        className="absolute inset-0 h-full w-full object-cover z-0" 
        alt="Modern Architecture" 
      />

      {activePropertyId ? (
        /* Focused Join Property UI */
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-0 py-6 sm:px-4 sm:py-10 md:py-14">
          <div className="w-full animate-in zoom-in-95 fade-in rounded-[28px] border border-white/40 bg-white/95 p-5 shadow-[0_50px_100px_rgba(0,0,0,0.4)] backdrop-blur-3xl duration-700 sm:rounded-[36px] sm:p-8 md:rounded-[40px] md:p-16">
             
             <div className="mb-8 flex flex-col items-center gap-6 md:mb-12 md:flex-row md:gap-10">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border-4 border-white bg-slate-900 shadow-2xl sm:h-32 sm:w-32 sm:rounded-[36px] md:h-40 md:w-40 md:rounded-[40px]">
                   <img src={hagaiLogo} alt="Logo" className="h-16 w-auto scale-110 object-contain sm:h-20 md:h-24" />
                </div>
                <div className="text-center md:text-right">
                   <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-600 rounded-full mb-4">
                      <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      <span className="text-[11px] font-black uppercase tracking-widest">הזמנה להצטרפות לנכס</span>
                   </div>
                   <h1 className="mb-4 text-3xl font-black leading-[1.12] text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl italic font-display">
                      הצטרפות לדירה ב-{db.properties.find(p => p.id === activePropertyId)?.address || "נכס חדש במערכת"}
                   </h1>
                   <p className="text-sm font-bold leading-7 text-slate-500 sm:text-base md:text-lg md:leading-relaxed">
                      הוזמנת על ידי המשכיר להתחיל את תהליך השכירות הדיגיטלי ב-{BRAND_NAME}. <br className="hidden md:block" />
                      וודאות מוחלטת, ביטחון מלא, וללא צ'קים פיזיים.
                   </p>
                </div>
             </div>

             <div className="mb-8 h-px w-full bg-slate-100 md:mb-12" />

             <div className="grid items-start gap-8 md:grid-cols-[1fr_0.8fr] md:gap-12">
                {/* Form Side */}
                <div className="space-y-8">
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setIsRegister(true)}
                        className={cn(
                          "flex-1 py-4 rounded-2xl font-black text-sm transition-all",
                          isRegister ? "bg-slate-950 text-white shadow-xl" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                         יצירת חשבון דייר
                      </button>
                      <button 
                        onClick={() => setIsRegister(false)}
                        className={cn(
                          "flex-1 py-4 rounded-2xl font-black text-sm transition-all",
                          !isRegister ? "bg-slate-950 text-white shadow-xl" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                         כניסת משתמש קיים
                      </button>
                   </div>

                   <form onSubmit={handleSubmit} className="space-y-4">
                      {isRegister && (
                        <AuthInput
                          label="שם מלא"
                          icon={<UserIcon size={18} />}
                          value={name}
                          onChange={setName}
                          placeholder="ישראל ישראלי"
                          name="name"
                        />
                      )}
                      <AuthInput
                        label='דוא"ל'
                        icon={<Mail size={18} />}
                        value={email}
                        onChange={setEmail}
                        placeholder="your@email.com"
                        type="email"
                        name="email"
                      />
                      <AuthInput
                        label="סיסמה"
                        icon={<Lock size={18} />}
                        value={password}
                        onChange={setPassword}
                        placeholder="••••••••"
                        type="password"
                        name="password"
                      />

                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-6 bg-blue-600 text-white rounded-[24px] font-black text-lg shadow-2xl hover:bg-blue-700 transition-all active:scale-[0.98] disabled:bg-slate-300 mt-4"
                      >
                         {isLoading ? "מעבד..." : isRegister ? "הרשמה והמשך לאונבורדינג" : "כניסה והמשך לאונבורדינג"}
                      </button>
                   </form>

                   {error && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-3">
                         <AlertCircle size={18} />
                         {error}
                      </div>
                   )}
                </div>

                {/* Info Side */}
                <div className="space-y-6">
                   <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">מה קורה אחרי ההרשמה?</h3>
                      <ul className="space-y-4">
                         {[
                           { icon: <ShieldCheck size={18} />, text: "אימות זהות (KYC) בטוח ומאובטח" },
                           { icon: <TrendingUp size={18} />, text: "בדיקת זכאות ודירוג אשראי (BDI)" },
                           { icon: <FileText size={18} />, text: "חתימה דיגיטלית על חוזה השכירות" },
                           { icon: <CreditCard size={18} />, text: "הקמת הוראת קבע לחיובים חודשיים" }
                         ].map((item, i) => (
                           <li key={i} className="flex items-center gap-3 text-[13px] font-bold text-slate-600">
                              <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                 {item.icon}
                              </div>
                              {item.text}
                           </li>
                         ))}
                      </ul>
                   </div>
                   
                   <div className="p-6 rounded-[32px] bg-blue-600 text-white shadow-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">תמיכה ושאלות</p>
                      <p className="text-sm font-bold leading-relaxed">זקוק לעזרה בתהליך ההצטרפות? המוקד שלנו זמין עבורך לכל שאלה.</p>
                      <button className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-[11px] font-black transition-all">
                         פתיחת צ׳אט תמיכה
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        /* Default Hero Experience */
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-2 py-10 sm:px-4 md:py-14 lg:py-16">
           <div className="animate-in fade-in slide-in-from-bottom-10 flex w-full max-w-4xl flex-col items-center duration-1000">
              
              {/* Centered Logo & Brand */}
              <div className="mb-8 flex flex-col items-center gap-4">
                 <div className="h-20 w-20 md:h-24 md:w-24 bg-white/20 backdrop-blur-md rounded-[28px] flex items-center justify-center border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.3)] animate-bounce-slow">
                    <img src={hagaiLogo} alt="Logo" className="h-14 md:h-16 w-auto object-contain scale-[1.2]" />
                 </div>
                 <h1 className="text-4xl font-black text-white italic font-display drop-shadow-[0_8px_16px_rgba(15,23,42,0.35)] sm:text-5xl">
                    {BRAND_NAME}
                 </h1>
              </div>

              <h2 className="max-w-3xl text-center text-4xl font-black leading-tight text-white drop-shadow-[0_10px_18px_rgba(15,23,42,0.35)] sm:text-5xl md:text-6xl italic font-display">
                 מערכת תשלומי<br />שכר דירה חכמה.
              </h2>
              
              <div className="mt-6 flex justify-center w-full px-4 max-w-2xl">
                 <span className="px-6 py-3 bg-black/30 backdrop-blur-xl border border-white/10 rounded-[24px] text-white font-bold text-sm md:text-base leading-relaxed text-center shadow-2xl">
                    מחליפים את הצ'קים הפיזיים בביטחון דיגיטלי מלא - וודאות מוחלטת למשכיר, נוחות מקסימלית לשוכר
                 </span>
              </div>

              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center gap-3">
                 <button
                    onClick={() => setShowPropertyBoard(true)}
                    className="flex w-full max-w-[280px] items-center justify-center gap-3 rounded-[24px] bg-white px-8 py-5 text-lg font-black text-slate-900 shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all hover:bg-blue-600 hover:text-white active:scale-95 sm:w-auto sm:max-w-none sm:px-12 sm:text-xl sm:hover:scale-105"
                 >
                    <span>שוק דירות</span>
                    <Home size={24} />
                 </button>
                 <button
                    onClick={() => setShowQrScanner(true)}
                    className="flex w-full max-w-[280px] items-center justify-center gap-3 rounded-[24px] bg-white/20 backdrop-blur-md px-8 py-5 text-base font-black text-white border border-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all hover:bg-white/30 active:scale-95 sm:w-auto sm:max-w-none sm:px-10"
                 >
                    <ScanLine size={22} />
                    <span>סרוק QR להצטרפות</span>
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQrScanner && (
        <BarcodeScanner
          title="סריקת קוד הזמנה"
          description="סרוק את קוד ה-QR שהמשכיר שלח לך"
          onScan={handleQrScan}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      {/* 5. Combined Login & Stats Command Bar (Only shown if NOT in focused join flow) */}
      {!activePropertyId && (
        <div className="relative z-30 flex w-full max-w-7xl flex-col items-center gap-3 px-2 pb-6 sm:px-4 sm:pb-8 md:gap-5">

         {/* Unified "Command Bar" for Login + Stats (Darkened Glass) */}
         <div className="flex w-full flex-col gap-4 rounded-[28px] border border-white/40 bg-white/85 p-4 shadow-[0_40px_100px_rgba(0,0,0,0.38)] backdrop-blur-3xl sm:gap-5 sm:p-6 md:gap-8 md:rounded-[36px] md:p-8 lg:p-10">

            {/* Stats Group - compact on mobile */}
            <div className="flex items-center justify-center gap-6 sm:gap-10 md:gap-24">
               <div className="text-center">
                  <p className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">דירות מנוהלות</p>
                  <p className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-900 tabular-nums italic font-display leading-none">{managedPropertiesCount}</p>
               </div>
               <div className="h-10 w-px bg-slate-200" />
               <div className="text-center">
                  <p className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">שיעור הצלחה</p>
                  <p className="text-3xl sm:text-4xl md:text-6xl font-black text-blue-600 tabular-nums italic font-display leading-none">{successRate}</p>
               </div>
            </div>

            <div className="h-px w-full bg-slate-100" />

            {/* Compact Login Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:gap-4">
               <div className="w-full flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <AuthInputCompact
                     icon={<UserIcon size={16} />}
                     value={name}
                     onChange={setName}
                     placeholder="שם מלא"
                     name="name"
                  />
                  <AuthInputCompact
                     icon={<Lock size={16} />}
                     value={password}
                     onChange={setPassword}
                     placeholder="סיסמה"
                     type="password"
                     name="password"
                  />
                  <AuthInputCompact
                     icon={<Mail size={16} />}
                     value={email}
                     onChange={setEmail}
                     placeholder="דוא״ל"
                     type="email"
                     name="email"
                  />
               </div>
               <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-auto h-12 sm:h-14 md:h-16 px-6 sm:px-8 md:px-12 bg-slate-950 text-white rounded-[18px] md:rounded-[24px] font-black text-sm md:text-base tracking-widest hover:bg-blue-600 transition-all active:scale-[0.95] disabled:bg-slate-400 shrink-0 shadow-2xl"
               >
                  {isLoading ? "מעבד..." : "כניסה למערכת"}
               </button>
            </form>

            {error && (
               <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center">
                  {error}
               </div>
            )}
         </div>

         {/* Quick Demo Access - scrollable row */}
         <div className="flex w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-[24px] border border-white/50 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-2xl md:w-auto md:rounded-full md:px-5 md:scale-90 md:hover:scale-100 md:transition-transform">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 shrink-0">דמו:</p>
            <QuickAccessBtn icon={<ShieldCheck size={14} />} label="אדמין" onClick={() => handleDemoLogin("admin@admin.com")} />
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <QuickAccessBtn icon={<Home size={14} />} label="משכיר" onClick={() => handleDemoLogin("landlord@landlord.com")} />
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <QuickAccessBtn icon={<UserIcon size={14} />} label="דייר" onClick={() => handleDemoLogin("tenant@tenant.com")} />
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <QuickAccessBtn icon={<UserPlus size={14} />} label="מועמד" onClick={() => handleDemoLogin("noa@example.com")} />
         </div>
        </div>
      )}

      {/* Property Board Modal */}
      {showPropertyBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 md:p-8 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-6xl bg-white rounded-[40px] md:rounded-[48px] shadow-2xl overflow-hidden border border-white/20 flex flex-col h-full max-h-[90vh]">
             <div className="flex items-center justify-between p-6 md:px-12 border-b border-slate-100 shrink-0">
                <div className="text-right">
                   <h2 className="text-2xl md:text-4xl font-black text-slate-900 italic font-display tracking-tight">לוח הדירות של <span className="text-blue-600">{BRAND_NAME}</span></h2>
                   <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Discover your next luxury residence</p>
                </div>
                <button onClick={() => setShowPropertyBoard(false)} className="h-12 w-12 md:h-14 md:w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                   <X size={24} />
                </button>
             </div>
             
             <div className="p-6 md:p-12 overflow-y-auto no-scrollbar">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                   {publicProperties.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => setSelectedProperty(p)}
                        className="group relative bg-white rounded-[32px] border border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col h-full"
                      >
                         {/* Property Image Container */}
                         <div className="relative h-48 overflow-hidden">
                            <img 
                              src={p.imageUrl || propertyPlaceholder} 
                              alt={p.address} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-4 right-4">
                               <span className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black rounded-full shadow-lg">פנוי</span>
                            </div>
                         </div>

                         <div className="p-6 flex flex-col flex-1">
                            <div className="flex justify-between items-center mb-3">
                               <h3 className="text-lg font-black text-slate-900 truncate pl-2">{p.address}</h3>
                               <span className="text-xl font-black text-blue-600 tabular-nums italic font-display shrink-0">₪{p.rent.toLocaleString()}</span>
                            </div>
                            
                            <div className="flex items-center gap-4 mb-4">
                               <div className="flex items-center gap-1.5 text-slate-400">
                                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                                  <span className="text-[10px] font-bold">{p.rooms || 3} חדרים</span>
                               </div>
                               <div className="flex items-center gap-1.5 text-slate-400">
                                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                                  <span className="text-[10px] font-bold">{p.sizeSqm || 85} מ״ר</span>
                               </div>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-6 line-clamp-2 leading-relaxed">{p.description || "דירה משופצת במיקום מעולה, מוארת ומרווחת..."}</p>
                            
                            <div className="mt-auto">
                               <button className="w-full py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all uppercase tracking-widest shadow-sm">
                                  צפה בפרטים מלאים
                               </button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Pinterest Style Property Details Popup */}
      <AnimatePresence>
         {selectedProperty && (
            <PropertyDetailsPopup 
               property={selectedProperty} 
               onClose={() => setSelectedProperty(null)} 
            />
         )}
      </AnimatePresence>
    </div>
  );
}

function SiteAccessScreen() {
  const { requestSiteAccess } = useAppData();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      requestSiteAccess(username, password);
    } catch (err: any) {
      setError(err?.message || "הגישה נדחתה");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-start overflow-x-hidden bg-slate-900 p-4 py-6 font-sans selection:bg-slate-900 selection:text-white md:justify-center md:p-8" dir="rtl">
      
      {/* 1. Full-Page Background Image */}
      <img 
        src={welcomeImage} 
        className="absolute inset-0 h-full w-full object-cover z-0" 
        alt="Early Access Background" 
      />
      <div className="absolute inset-0 bg-slate-900/40 z-0" />
      
      {/* 2. Top-Left Branding Layer */}
        <div className="relative z-10 mb-5 flex w-full max-w-5xl flex-col gap-5 px-2 sm:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 justify-center md:justify-start">
          <img src={hagaiLogo} alt={BRAND_NAME} className="h-14 md:h-18 w-auto object-contain" />
          <div className="text-right">
            <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter font-display italic">
              {BRAND_NAME}
            </span>
            <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">{BRAND_SLOGAN}</p>
          </div>
        </div>
        </div>

          {/* 3. Immersive Centered Access Card */}
      <div className="relative z-10 w-full max-w-xl px-0 sm:px-4 animate-in zoom-in-95 fade-in duration-1000">
         <div className="rounded-[28px] border border-white/40 bg-white/85 p-6 text-center shadow-[0_40px_100px_rgba(0,0,0,0.3)] backdrop-blur-3xl sm:p-8 md:rounded-[32px] md:p-12 lg:p-16">
            
            <div className="flex justify-center mb-6 md:mb-8">
               <div className="h-16 w-16 md:h-20 md:w-20 bg-slate-950 text-white rounded-2xl flex items-center justify-center shadow-2xl">
                  <ShieldCheck size={34} className="md:hidden" />
                  <ShieldCheck size={40} className="hidden md:block" />
               </div>
            </div>

            <div className="mb-8 md:mb-10">
               <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight italic font-display">כניסה מוקדמת</h2>
               <p className="text-slate-400 font-bold text-sm mt-3 px-2 md:px-8">אנא הזן את פרטי הגישה לשכבת האבטחה של המערכת</p>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-black animate-in shake-in">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
               <AuthInput
                 label="שם משתמש"
                 icon={<UserIcon size={18} />}
                 value={username}
                 onChange={setUsername}
                 placeholder="admin / metering01"
                 name="username"
                 autoComplete="username"
               />
               <AuthInput
                 label="סיסמה"
                 icon={<Lock size={18} />}
                 value={password}
                 onChange={setPassword}
                 placeholder="••••••••"
                 type="password"
                 name="password"
                 autoComplete="current-password"
               />

               <button
                 type="submit"
                 disabled={isLoading}
                 className="w-full h-14 md:h-16 bg-[#020617] text-white rounded-[16px] font-black text-base md:text-lg shadow-2xl hover:bg-black transition-all active:scale-[0.98] disabled:bg-slate-400 flex items-center justify-center gap-3"
               >
                 {isLoading ? (
                   <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <>
                     <LogIn size={20} />
                     <span>אישור גישה</span>
                   </>
                 )}
               </button>
            </form>
            <div className="mt-8 md:mt-10 p-5 md:p-6 bg-slate-50/50 rounded-[24px] border border-slate-200 text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">מידע למורשים</p>
               <div className="space-y-2 text-[11px] font-bold text-slate-500 leading-relaxed">
                  <p>• הגישה מותרת למשתמשים מורשים בלבד.</p>
                  <p>• קוד הגישה הזמני תקף ל-24 שעות מרגע הכניסה.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function QuickAccessBtn({ icon, label, onClick }: { icon: ReactNode, label: string, onClick: () => void }) {
   return (
      <button 
         onClick={onClick}
         className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 group md:justify-start md:gap-2 md:px-4"
      >
         <span className="text-slate-400 group-hover:text-blue-600 transition-colors">{icon}</span>
         <span className="text-[11px] font-bold md:text-xs">{label}</span>
      </button>
   );
}

function DemoBtn({ label, onClick, color }: any) {
   return (
      <button 
         onClick={onClick}
         className={cn("py-3 px-3 text-white text-[10px] font-black rounded-xl hover:scale-105 transition-all shadow-lg active:scale-95 italic font-display tracking-widest", color)}
      >
         {label}
      </button>
   );
}

function AuthInputCompact({ icon, value, onChange, placeholder, type = "text", name }: any) {
   return (
      <div className="relative group">
         <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
            {icon}
         </div>
         <input 
            type={type} 
            required
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder} 
            className="w-full h-14 bg-slate-50/50 border border-slate-100 rounded-[20px] pr-12 pl-4 text-xs font-bold focus:ring-4 focus:ring-slate-900/5 focus:border-slate-300 transition-all outline-none placeholder:text-slate-400"
         />
      </div>
   );
}

function AuthInput({ label, icon, value, onChange, placeholder, type = "text", name, autoComplete }: any) {
   return (
      <div className="space-y-3">
         {label && <label className="text-[10px] font-black text-slate-400 tracking-[0.12em] mr-1 uppercase tracking-widest">{label}</label>}
         <div className="relative group">
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
               {icon}
            </div>
            <input 
               type={type} 
               required
               name={name}
               autoComplete={autoComplete}
               value={value}
               onChange={(e) => onChange(e.target.value)}
               placeholder={placeholder} 
               className="w-full h-16 bg-white border border-slate-200 rounded-[24px] pr-14 pl-6 text-[15px] font-bold focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none shadow-sm placeholder:text-slate-300"
            />
         </div>
      </div>
   );
}

function PropertyDetailsPopup({ property: p, onClose }: { property: Property, onClose: () => void }) {
   const [activeImageIndex, setActiveImageIndex] = useState(0);
   
   // Map the images from the houseimg directory
   const houseImages = [house1, house2, house3, house4, house5, house6];
   
   const images = [
      p.imageUrl || propertyPlaceholder,
      ...houseImages.filter(img => img !== p.imageUrl).slice(0, 3)
   ];

   const nextImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveImageIndex((prev) => (prev + 1) % images.length);
   };

   const prevImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
   };

   return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 md:p-8">
         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl"
         />
         <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 60 }}
            className="relative flex max-h-[95dvh] w-full max-w-7xl flex-col overflow-hidden rounded-t-[32px] bg-white shadow-[0_50px_100px_rgba(0,0,0,0.5)] sm:max-h-[90vh] sm:rounded-[40px] lg:max-h-[850px] lg:flex-row lg:rounded-[44px]"
            dir="rtl"
         >
            {/* Pinterest Style Layout: Left Side (Interactive Gallery) */}
            <div className="group relative h-[34vh] min-h-[230px] w-full select-none overflow-hidden bg-slate-100 sm:h-[42vh] lg:h-auto lg:min-h-0 lg:w-3/5">
               <AnimatePresence mode="wait">
                  <motion.img 
                     key={activeImageIndex}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     transition={{ duration: 0.4, ease: "easeOut" }}
                     src={images[activeImageIndex]} 
                     alt={p.address} 
                     className="w-full h-full object-cover shadow-inner"
                  />
               </AnimatePresence>
               
               {/* Gallery Controls */}
               <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-2 sm:bottom-10 sm:gap-3">
                  {images.map((_, idx) => (
                     <button 
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                        className={cn(
                           "h-1.5 transition-all duration-500 rounded-full",
                           idx === activeImageIndex ? "w-10 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                        )}
                     />
                  ))}
               </div>

               <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 opacity-100 transition-opacity sm:px-6 lg:opacity-0 lg:group-hover:opacity-100">
                  <button 
                     onClick={prevImage}
                     className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-2xl backdrop-blur-xl transition-all hover:bg-white hover:text-slate-900 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
                  >
                     <ChevronRight size={24} className="sm:hidden" />
                     <ChevronRight size={32} className="hidden sm:block" />
                  </button>
                  <button 
                     onClick={nextImage}
                     className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-2xl backdrop-blur-xl transition-all hover:bg-white hover:text-slate-900 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
                  >
                     <ChevronLeft size={24} className="sm:hidden" />
                     <ChevronLeft size={32} className="hidden sm:block" />
                  </button>
               </div>

               <button 
                  onClick={onClose}
                  className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white hover:text-slate-900 sm:right-8 sm:top-8 sm:h-12 sm:w-12 lg:hidden"
               >
                  <X size={24} />
               </button>
            </div>

            {/* Right Side (Detailed Content) */}
            <div className="flex w-full flex-col overflow-y-auto border-r border-slate-50 bg-white p-5 sm:p-8 md:p-10 lg:w-2/5 lg:p-14 no-scrollbar">
               <div className="mb-6 flex shrink-0 items-center justify-between sm:mb-10">
                  <button onClick={onClose} className="h-14 w-14 bg-slate-50 rounded-2xl hidden lg:flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-100">
                     <X size={24} />
                  </button>
                  <div className="flex gap-3">
                     <div className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-600/20 uppercase tracking-widest">למכירה</div>
                     <div className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-emerald-500/20 uppercase tracking-widest">פנוי</div>
                  </div>
               </div>

               <div className="mb-8 sm:mb-10">
                  <h1 className="mb-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl font-display italic italic-black">{p.address}</h1>
                  <div className="flex items-center gap-2">
                     <div className="h-5 w-5 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <MapPin size={12} />
                     </div>
                     <p className="text-sm font-black text-slate-400 uppercase tracking-wider">{p.city || "לב יבנה, יבנה"} • נכס עם ממ״ד</p>
                  </div>
               </div>

               <div className="mb-8 grid grid-cols-3 gap-3 sm:mb-12 sm:gap-5">
                  <PropertyMetric label="חדרים" value={p.rooms || 3} />
                  <PropertyMetric label="קומה" value={p.floor || "2/3"} />
                  <PropertyMetric label="מ״ר" value={p.sizeSqm || 87} />
               </div>

               <div className="mb-8 sm:mb-12">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="h-1 w-10 bg-blue-600 rounded-full" />
                     <h4 className="text-base font-black text-slate-900 uppercase tracking-widest">תיאור הנכס</h4>
                  </div>
                  <p className="text-base text-slate-500 leading-relaxed font-medium">
                     {p.description || `למכירה דירת ${p.rooms || 3} חדרים בשכונת לב יבנה. דירה משופצת, כ-80 מ"ר. מטבח גדול ומשודרג, מקלחת גדולה ומשופצת, ריצוף ואינסטלציה חדשה. חדר כביסה גדול. מרפסת 7 מ"ר יוצאת מיחידת הורים. מקום ייעודי לפינת אוכל. בניין בוטיק, 3 קומות- רק 9 דיירים בכל הבניין. ממ"ד, מעלית וחניה בטאבו. רשתות, מיזוג בכל הבית, דירה מוארת!! סביבת מגורים שהיא איכות חיים! סמוך לפארקים, תחבורה ציבורית ומוסדות חינוך. שווה להתרשם!!`}
                  </p>
               </div>

               <div className="mb-8 space-y-5 sm:mb-12">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="h-1 w-10 bg-slate-200 rounded-full" />
                     <h4 className="text-base font-black text-slate-900 uppercase tracking-widest">מפרט טכני</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
                     <DetailRow label="סוג העסקה" value="מכירה" />
                     <DetailRow label="מצב הנכס" value={p.condition === "renovated" ? "משופץ" : "חדש"} />
                     <DetailRow label="מ״ר בנוי" value={`${p.builtSqm || 87} מ״ר`} />
                     <DetailRow label="קומות בבניין" value={(p.floorsInBuilding || 3).toString()} />
                     <DetailRow label="חניות" value={(p.parkingCount || 1).toString()} />
                     <DetailRow label="מחיר למ״ר" value={`₪${(p.pricePerSqm || 22873).toLocaleString()}`} />
                     <DetailRow label="תאריך כניסה" value={p.entryDate || "כניסה גמישה"} />
                  </div>
               </div>

               <div className="mt-auto flex shrink-0 flex-col gap-6 border-t border-slate-100 pt-7 sm:gap-8 sm:pt-10">
                  <div className="flex justify-between items-center">
                     <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">מחיר סופי מבוקש</p>
                        <p className="break-words text-3xl font-black leading-none text-slate-900 sm:text-4xl md:text-5xl italic font-display">₪{(p.rent * 300 || 1990000).toLocaleString()}</p>
                     </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                     <button className="w-full py-5 bg-slate-950 text-white rounded-3xl font-black text-sm tracking-[0.2em] hover:bg-black transition-all shadow-2xl shadow-slate-950/20 active:scale-[0.98] uppercase">הצגת מספר טלפון</button>
                     <div className="grid grid-cols-2 gap-4">
                        <button className="py-5 bg-emerald-500 text-white rounded-3xl font-black text-[11px] tracking-[0.1em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] uppercase">WhatsApp</button>
                        <button className="py-5 bg-white border-2 border-slate-100 text-slate-900 rounded-3xl font-black text-[11px] tracking-[0.1em] hover:bg-slate-50 transition-all active:scale-[0.98] uppercase">השאר פרטים</button>
                     </div>
                  </div>
               </div>
            </div>
         </motion.div>
      </div>
   );
}

function PropertyMetric({ label, value }: { label: string, value: string | number }) {
   return (
      <div className="rounded-[22px] border border-slate-100/50 bg-slate-50 p-3 text-center transition-all duration-500 group hover:bg-white hover:shadow-xl sm:rounded-[32px] sm:p-6">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-500 transition-colors">{label}</p>
         <p className="text-xl font-black text-slate-900 sm:text-2xl font-display italic">{value}</p>
      </div>
   );
}

function DetailRow({ label, value }: { label: string, value: string }) {
   return (
      <div className="flex justify-between items-center py-1 border-b border-slate-50">
         <span className="text-xs font-bold text-slate-400">{label}</span>
         <span className="text-xs font-black text-slate-700">{value}</span>
      </div>
   );
}

function RoleSelection({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-slate-50 p-4 text-right font-sans selection:bg-slate-900 selection:text-white md:p-8" dir="rtl">
      <div className="w-full max-w-6xl space-y-12 md:space-y-20 animate-in zoom-in-95 duration-500 py-8 md:py-12">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-black leading-tight text-slate-900 sm:text-5xl md:text-7xl lg:text-8xl italic font-display">
            הבית שלך ב-<span className="text-blue-600">שליטה מלאה</span>
          </h1>
          <p className="text-lg md:text-2xl text-slate-400 font-bold max-w-3xl mx-auto leading-relaxed italic">
            ברוכים הבאים ל-{BRAND_NAME}. {BRAND_SLOGAN} לכל הצדדים, בלי ניירת ובלי אי ודאות.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 lg:gap-10">
          <RoleCard 
            title="שוכר" 
            desc="תשלום שכירות פשוט, דיווח על תקלות וניהול החיים בדירה בשלושה קליקים" 
            onSelect={() => onSelect("tenant")} 
            color="bg-blue-600" 
            icon={<Home size={40} />} 
          />
          <RoleCard 
            title="משכיר" 
            desc="גבייה אוטומטית, סינון שוכרים מבוסס AI וניהול תחזוקה שוטף בשלט רחוק" 
            onSelect={() => onSelect("landlord")} 
            color="bg-indigo-600" 
            icon={<Users size={40} />} 
          />
          <RoleCard 
            title="מנהל מערכת" 
            desc="פיקוח מערכתי מלא, אישור KYC וניטור עסקאות בזמן אמת ללא פשרות" 
            onSelect={() => onSelect("admin")} 
            color="bg-slate-950" 
            icon={<ShieldCheck size={40} />} 
          />
        </div>

        <div className="flex flex-col items-center gap-6">
           <div className="h-px w-24 bg-slate-200"></div>
           <p className="text-[11px] font-black text-slate-300 tracking-[0.24em] animate-pulse italic">
              {BRAND_SLOGAN} • v1.0.4
           </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ title, desc, onSelect, color, icon }: any) {
  return (
    <button 
      onClick={onSelect}
      className="group relative flex min-h-[300px] flex-col items-start justify-between overflow-hidden rounded-[32px] border border-slate-100 bg-white p-6 text-right shadow-2xl transition-all hover:-translate-y-1 hover:scale-[1.01] md:h-[420px] md:rounded-[40px] md:p-10 lg:p-12"
    >
      <div className={cn("absolute top-0 right-0 h-3 w-full", color)}></div>
      <div className={cn("h-20 w-20 rounded-[28px] flex items-center justify-center text-white shadow-2xl shadow-current/20 transition-all group-hover:scale-110 group-hover:rotate-6 bg-slate-900", color)}>
        {icon}
      </div>
      <div className="space-y-6 relative z-10 w-full">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter font-display italic leading-none">{title}</h2>
        <p className="text-lg text-slate-400 font-bold leading-relaxed italic">{desc}</p>
        <div className="pt-6 flex items-center gap-3 text-slate-900 font-black text-[13px] group-hover:gap-6 transition-all tracking-[0.14em] font-display italic">
          <span>היכנס למערכת</span>
          <ChevronLeft size={24} />
        </div>
      </div>
      <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-slate-50/50 group-hover:bg-slate-100 transition-all duration-700 z-0 scale-75 group-hover:scale-125"></div>
    </button>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden px-4" dir="rtl">
       {/* Background Elements */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] bg-blue-600/10 blur-[180px] rounded-full animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-[40%] -translate-y-[40%] h-[400px] w-[400px] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse delay-700"></div>
       </div>

      <div className="relative group">
        <div className="flex items-center justify-center relative z-10 animate-bounce">
           <img src={hagaiLogo} alt="Logo" className="h-28 w-auto object-contain rounded-2xl bg-white p-4 shadow-2xl" />
        </div>
        <div className="absolute -inset-4 rounded-[40px] border border-white/5 animate-[ping_3s_infinite] opacity-20"></div>
        <div className="absolute -inset-8 rounded-[48px] border border-white/5 animate-[ping_4s_infinite] opacity-10"></div>
      </div>

      <div className="mt-20 space-y-8 text-center relative z-10 w-full max-w-xs">
        <div className="space-y-3">
           <h2 className="text-3xl font-black tracking-tight font-display italic">{BRAND_NAME}</h2>
           <p className="text-[11px] text-slate-500 font-black tracking-[0.24em] animate-pulse italic">מאמת כניסה...</p>
        </div>
        
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
          />
        </div>
        <p className="text-[9px] text-slate-700 font-black tracking-[0.18em] font-display">יוצר חיבור מאובטח למסד הנתונים</p>
      </div>
    </div>
  );
}
