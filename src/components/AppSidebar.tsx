import {
  LayoutDashboard, Users, UserCog, Target, FileText, Wallet,
  CalendarDays, Settings, Handshake, BarChart3, Zap, Briefcase,
  Banknote, Bell, MapPin, Megaphone, ShieldCheck, Clock, List,
  ClipboardList, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/components/ui/sidebar";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { title: "Dashboard",        url: "/",              icon: LayoutDashboard },
  { title: "Analytics",        url: "/analytics",     icon: BarChart3 },
  { title: "Clients",          url: "/clients",       icon: Users },
  { title: "Employees",        url: "/employees",     icon: UserCog },
  { title: "Live Tracking",    url: "/live-tracking", icon: MapPin },
  { title: "Verification",     url: "/verification",  icon: ShieldCheck },
  { title: "Shifts",           url: "/shifts",        icon: Clock },
  { title: "Assignments",      url: "/assignments",   icon: List },
  { title: "Field Reports",    url: "/field-reports", icon: ClipboardList },
  { title: "Leads",            url: "/leads",         icon: Target },
  { title: "Projects",         url: "/projects",      icon: Briefcase },
  { title: "Quotations & Bills", url: "/quotations",  icon: FileText },
  { title: "Financials",       url: "/financials",    icon: Banknote },
  { title: "Recovery",         url: "/recovery",      icon: Wallet },
  { title: "Calendar",         url: "/calendar",      icon: CalendarDays },
  { title: "Notifications",    url: "/notifications", icon: Bell },
  { title: "Partners",         url: "/partners",      icon: Handshake },
  { title: "Smart Lead Hub",   url: "/smart-leads",   icon: Zap },
  { title: "Broadcast",        url: "/broadcast",     icon: Megaphone },
  { title: "Cash Custody",     url: "/cash-custody",  icon: Wallet },
];

const ADMIN_ONLY = [
  "/analytics", "/quotations", "/recovery", "/settings",
  "/partners", "/financials", "/live-tracking", "/cash-custody",
];

export function AppSidebar() {
  const { user } = useAuth();
  const { setOpenMobile, openMobile, isMobile } = useSidebar();
  const [collapsed, setCollapsed] = useState(false);

  const visible = NAV_ITEMS.filter((item) => {
    if (user?.role === "Employee" && ADMIN_ONLY.includes(item.url)) return false;
    return true;
  });

  const close = () => { if (isMobile) setOpenMobile(false); };

  return (
    <TooltipProvider delayDuration={200}>
      <>
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-200 shrink-0"
          style={{ width: collapsed ? 56 : 220 }}
        >
          {/* ── Logo header ── */}
          <div
            className="flex items-center h-14 border-b border-gray-200 shrink-0 overflow-hidden"
            style={{ paddingLeft: collapsed ? 10 : 14, paddingRight: collapsed ? 6 : 10 }}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <BrandLogo collapsed={collapsed} />
            </div>
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto h-6 w-6 rounded-md flex items-center justify-center
                text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" />
                : <ChevronLeft  className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* ── Nav items ── */}
          <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
            {visible.map((item) => (
              <Tooltip key={item.title}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    onClick={close}
                    className={`
                      flex items-center gap-2.5 rounded-lg px-2 h-9 w-full
                      text-[13px] font-medium text-gray-500
                      hover:bg-gray-100 hover:text-gray-900
                      transition-colors duration-150 relative group overflow-hidden
                      ${collapsed ? "justify-center" : ""}
                    `}
                    activeClassName="!bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white shadow-sm"
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && (
                      <span className="truncate leading-none">{item.title}</span>
                    )}
                  </NavLink>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="text-xs font-medium">
                    {item.title}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>

          {/* ── Settings at bottom ── */}
          <div className="shrink-0 border-t border-gray-200 px-2 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/settings"
                  onClick={close}
                  className={`
                    flex items-center gap-2.5 rounded-lg px-2 h-9 w-full
                    text-[13px] font-medium text-gray-500
                    hover:bg-gray-100 hover:text-gray-900
                    transition-colors duration-150
                    ${collapsed ? "justify-center" : ""}
                  `}
                  activeClassName="!bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white"
                >
                  <Settings className="h-[17px] w-[17px] shrink-0" />
                  {!collapsed && <span className="truncate leading-none">Settings</span>}
                </NavLink>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs font-medium">
                  Settings
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>

        {/* Mobile Sidebar Sheet */}
        {isMobile && (
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetContent side="left" className="p-0 w-64 bg-white border-r border-gray-200 [&>button]:hidden">
              <div className="flex flex-col h-full bg-white">
                {/* Logo header */}
                <div className="flex items-center h-14 border-b border-gray-200 px-4 shrink-0 justify-between">
                  <BrandLogo collapsed={false} />
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                  {visible.map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      end={item.url === "/"}
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-lg px-2 h-9 w-full text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 relative group overflow-hidden"
                      activeClassName="!bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white shadow-sm"
                    >
                      <item.icon className="h-[17px] w-[17px] shrink-0" />
                      <span className="truncate leading-none">{item.title}</span>
                    </NavLink>
                  ))}
                </nav>

                {/* Settings at bottom */}
                <div className="shrink-0 border-t border-gray-200 px-2 py-2">
                  <NavLink
                    to="/settings"
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg px-2 h-9 w-full text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
                    activeClassName="!bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white"
                  >
                    <Settings className="h-[17px] w-[17px] shrink-0" />
                    <span className="truncate leading-none">Settings</span>
                  </NavLink>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </>
    </TooltipProvider>
  );
}
