import { useState, useEffect, ReactNode } from "react";
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
  ChevronRight
} from "lucide-react";

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
import { Role, User } from "./types";
import { cn } from "./lib/utils";
import { useAppData } from "./lib/appData";

// Assets
import welcomeImage from "./image/Gemini_Generated_Image_u8ml1gu8ml1gu8ml.png";

type AppNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

/**
 * RentFlow Main Application
 */
export default function App() {
  const { currentUser: user, isReady, logout } = useAppData();
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

  // 1. Initial Loading Screen
  if (!isReady) {
    return <LoadingScreen />;
  }

  // 2. Login / Welcome Screen
  if (!user) {
    return (
      <div className="h-screen w-full overflow-hidden bg-slate-50 flex flex-col">
        <WelcomeScreen />
      </div>
    );
  }

  // 4. Tenant Onboarding Flow (if applicable)
  if (showOnboardingFlow && needsOnboarding && user.role === "tenant") {
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
    <div className="relative flex h-screen bg-slate-100 font-sans text-right selection:bg-blue-100 selection:text-blue-900" dir="rtl">
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

        <div className="flex h-full flex-col overflow-hidden">
          {/* Sidebar Logo Area */}
          <div className="flex items-center gap-4 p-8 pt-10 h-24 shrink-0 transition-all">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-slate-900/10 cursor-pointer active:scale-95">
              <div className="h-4 w-4 border-2 border-white rounded-[2px]" />
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
                
                <MessageUser name="אסתר הופמן" avatar="https://i.pravatar.cc/150?u=esther" collapsed={!isSidebarExpanded} online onClick={() => handleTabChange("messages")} />
                <MessageUser name="יעקב יונתן" avatar="https://i.pravatar.cc/150?u=jacob" collapsed={!isSidebarExpanded} online={false} onClick={() => handleTabChange("messages")} />
                <MessageUser name="קובי לוי" avatar="https://i.pravatar.cc/150?u=cody" collapsed={!isSidebarExpanded} online onClick={() => handleTabChange("messages")} />
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
                <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-white shadow-sm">
                   <img src="https://i.pravatar.cc/150?u=john" className="h-full w-full object-cover" alt="User" />
                </div>
                {isSidebarExpanded && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 truncate tracking-wider">
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative bg-[#F9FBFB]">
        
        {/* Top Header Bar */}
        <header className="h-24 shrink-0 bg-white/70 backdrop-blur-xl border-b border-slate-200/40 flex items-center justify-between px-4 md:px-12 z-20 sticky top-0">
          <div className="flex items-center gap-8 flex-1 min-w-0">
             <div className="relative group max-w-sm w-full hidden lg:block">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                <input 
                  type="text" 
                  placeholder="חיפוש מהיר בדף הנוכחי..." 
                  className="w-full bg-slate-100/50 border border-transparent rounded-2xl py-3 pl-6 pr-12 text-[13px] focus:outline-none focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-900/5 transition-all font-semibold placeholder:text-slate-400" 
                />
             </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg md:hidden"
              aria-label="פתח תפריט"
            >
              <Menu size={20} />
            </button>
            <button className="relative h-12 w-12 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm">
              <Bell size={20} />
              <span className="absolute top-3 right-3 h-2.5 w-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-[15px] font-bold text-slate-900 leading-none truncate max-w-[150px] font-display tracking-tight">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5 tracking-wide truncate">
                  {user.role === "admin" ? "מנהל מערכת" : user.role === "landlord" ? "משכיר" : "שוכר מאומת"}
                </p>
              </div>
              <button className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 overflow-hidden hover:border-slate-900 shadow-sm transition-all group">
                 <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <UserIcon size={20} />
                 </div>
              </button>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-16 custom-scrollbar scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -5 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="max-w-7xl mx-auto"
            >
              {renderTabContent(
                activeTab,
                user,
                (target) => handleTabChange(target),
                needsOnboarding ? () => setShowOnboardingFlow(true) : undefined,
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
          <span className="flex-1 min-w-0 truncate text-right text-[13px] font-bold tracking-tight">
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

function MessageUser({ name, avatar, collapsed, online, onClick }: { name: string, avatar: string, collapsed: boolean, online: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl hover:bg-slate-50 transition-all group",
      collapsed && "justify-center px-0"
    )}>
      <div className="relative shrink-0">
        <img src={avatar} className="h-8 w-8 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-100" alt={name} />
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
          online ? "bg-emerald-500" : "bg-rose-500"
        )} />
      </div>
      {!collapsed && (
        <span className="flex-1 min-w-0 text-right text-[13px] font-bold text-slate-500 group-hover:text-slate-900 truncate">
          {name}
        </span>
      )}
    </button>
  );
}

export function WelcomeScreen() {
  const { login, register } = useAppData();
  const [isRegister, setIsRegister] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
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

  if (showRoleSelection && pendingDraft) {
     return (
       <RoleSelection
         onSelect={(role) => {
           register({
             name: pendingDraft.name,
             email: pendingDraft.email,
             password: pendingDraft.password,
             role,
           });
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
        setPendingDraft({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        setShowRoleSelection(true);
      } else {
        login(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "אירעה שגיאה לא צפויה");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    setIsRegister(false);
    setEmail(demoEmail);
    setPassword("123123");
    setError(null);
  };

  const handleGoogleStyleLogin = () => {
    const timestamp = Date.now().toString().slice(-6);
    setPendingDraft({
      name: `משתמש חדש ${timestamp}`,
      email: `google-${timestamp}@rentflow.local`,
      password: "123123",
    });
    setShowRoleSelection(true);
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans selection:bg-slate-900 selection:text-white overflow-hidden p-6" dir="rtl">
      
      {/* Left Side: Image & Branding (50%) */}
      <div className="hidden lg:flex w-1/2 relative rounded-[40px] overflow-hidden group shadow-2xl">
        <img 
          src={welcomeImage} 
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[2s] group-hover:scale-105" 
          alt="Modern Apartment" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent"></div>
        
        <div className="absolute inset-0 flex flex-col justify-end p-20 space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-950 text-3xl font-black italic shadow-2xl rotate-2">R</div>
          
          <div className="space-y-4">
            <h2 className="text-6xl font-black text-white leading-tight tracking-tighter">
              הדרך הנכונה <br/>
              <span className="text-blue-400">לנהל נכס.</span>
            </h2>
            <p className="text-xl text-slate-200 font-bold leading-relaxed max-w-lg">
              RentFlow מעניקה לך ניהול חכם של הנכסים שלך, גבייה אוטומטית, ותקשורת שקופה מול השוכרים. הכל במקום אחד.
            </p>
          </div>
          
          <div className="flex items-center gap-12 pt-8 border-t border-white/20">
             <div>
                <p className="text-sm font-black text-white/40 uppercase tracking-widest">דירות מנוהלות</p>
                <p className="text-3xl font-black text-white mt-1 italic tracking-tighter tabular-nums">12,450+</p>
             </div>
             <div>
                <p className="text-sm font-black text-white/40 uppercase tracking-widest">שביעות רצון</p>
                <p className="text-3xl font-black text-white mt-1 italic tracking-tighter tabular-nums">98.4%</p>
             </div>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form (50%) */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-md space-y-10">
          
          <div className="space-y-2">
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
              {isRegister ? "נעים להכיר!" : "ברוכים השבים!"}
            </h3>
            <p className="text-slate-400 font-bold text-base">
              {isRegister ? "הצטרפו למהפכה בניהול השכירות בישראל." : "היכנסו עם הפרטים שלכם כדי להמשיך."}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-black animate-in shake-in">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegister && (
              <AuthInput label="שם מלא" icon={<UserIcon size={18} />} value={name} onChange={setName} placeholder="ישראל ישראלי" />
            )}
            <AuthInput label="אימייל" icon={<Mail size={18} />} value={email} onChange={setEmail} placeholder="name@company.com" type="email" />
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-slate-900 mr-1">סיסמה</label>
                  {!isRegister && <button type="button" className="text-xs font-black text-blue-600 hover:underline">שכחת סיסמה?</button>}
               </div>
               <AuthInput icon={<Lock size={18} />} value={password} onChange={setPassword} placeholder="••••••••" type="password" />
            </div>

            <div className="flex items-center gap-2 mr-1">
               <input type="checkbox" id="remember" className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
               <label htmlFor="remember" className="text-xs font-bold text-slate-500 cursor-pointer">זכור אותי במחשב זה</label>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-slate-950 text-white rounded-2xl font-black text-base shadow-xl hover:bg-black transition-all active:scale-[0.98] disabled:bg-slate-400 flex items-center justify-center gap-3 italic"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isRegister ? "הרשמה למערכת" : "התחברות"}
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-xs font-black bg-white px-4 text-slate-400 uppercase tracking-widest">או באמצעות</div>
          </div>

          <div className="space-y-4">
            <button 
              type="button"
              onClick={handleGoogleStyleLogin}
              className="w-full h-14 bg-white border border-slate-200 flex items-center justify-center gap-4 rounded-2xl font-bold text-slate-900 hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm italic"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>התחברות עם Google</span>
            </button>

             <div className="grid grid-cols-2 gap-2 mt-4">
                <DemoBtn label="מנהל" onClick={() => handleDemoLogin("admin@admin.com")} color="bg-slate-100/80 text-slate-900 border border-slate-200" />
                <DemoBtn label="משכיר" onClick={() => handleDemoLogin("landlord@landlord.com")} color="bg-slate-100/80 text-slate-900 border border-slate-200" />
                <DemoBtn label="דייר מאושר" onClick={() => handleDemoLogin("tenant@tenant.com")} color="bg-blue-50 text-blue-700 border border-blue-100" />
                <DemoBtn label="תהליך הרשמת דייר" onClick={() => handleDemoLogin("noa@example.com")} color="bg-indigo-50 text-indigo-700 border border-indigo-100" />
             </div>
          </div>

          <div className="text-center pt-4">
             <p className="text-sm font-bold text-slate-500">
               {isRegister ? "כבר רשום?" : "עוד לא רשום?"}{" "}
               <button 
                 onClick={() => { setIsRegister(!isRegister); setError(null); }}
                 className="text-slate-950 font-black border-b border-slate-950 hover:pb-0.5 transition-all ml-1 italic"
               >
                 {isRegister ? "כניסה למערכת" : "צור חשבון חדש"}
               </button>
             </p>
          </div>
        </div>
      </div>
    </div>
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

function AuthInput({ label, icon, value, onChange, placeholder, type = "text" }: any) {
   return (
      <div className="space-y-3">
         {label && <label className="text-[10px] font-black text-slate-400 tracking-[0.12em] mr-1">{label}</label>}
         <div className="relative group">
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
               {icon}
            </div>
            <input 
               type={type} 
               required
               value={value}
               onChange={(e) => onChange(e.target.value)}
               placeholder={placeholder} 
               className="w-full h-16 bg-white border border-slate-200 rounded-[24px] pr-14 pl-6 text-[15px] font-bold focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none shadow-sm placeholder:text-slate-300"
            />
         </div>
      </div>
   );
}

function RoleSelection({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-right font-sans selection:bg-slate-900 selection:text-white" dir="rtl">
      <div className="w-full max-w-6xl space-y-20 animate-in zoom-in-95 duration-500 py-12">
        <div className="text-center space-y-6">
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-tight italic font-display">
            הבית שלך ב-<span className="text-blue-600">שליטה מלאה</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 font-bold max-w-3xl mx-auto leading-relaxed italic">
            ברוכים הבאים ל-RentFlow. ניהול שכירות מתקדם, שקוף ומאובטח לכל הצדדים מעולם לא היה פשוט כל כך.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
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
              מערכת ניהול השכירות החכמה בישראל • v1.0.4
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
      className="group relative h-[450px] overflow-hidden rounded-[40px] bg-white p-12 text-right shadow-2xl transition-all hover:scale-[1.02] hover:-translate-y-3 border border-slate-100 flex flex-col justify-between items-start"
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
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden" dir="rtl">
       {/* Background Elements */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] bg-blue-600/10 blur-[180px] rounded-full animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-[40%] -translate-y-[40%] h-[400px] w-[400px] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse delay-700"></div>
       </div>

      <div className="relative group">
        <div className="h-28 w-28 rounded-3xl bg-white shadow-[0_0_80px_rgba(255,255,255,0.1)] flex items-center justify-center text-slate-950 text-5xl font-black italic relative z-10 animate-bounce font-display shadow-2xl">
          R
        </div>
        <div className="absolute -inset-4 rounded-[40px] border border-white/5 animate-[ping_3s_infinite] opacity-20"></div>
        <div className="absolute -inset-8 rounded-[48px] border border-white/5 animate-[ping_4s_infinite] opacity-10"></div>
      </div>

      <div className="mt-20 space-y-8 text-center relative z-10 w-full max-w-xs">
        <div className="space-y-3">
           <h2 className="text-3xl font-black tracking-tight font-display italic">Rent<span className="text-blue-500">Flow</span></h2>
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
