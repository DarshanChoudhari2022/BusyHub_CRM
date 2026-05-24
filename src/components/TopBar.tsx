import { useState } from "react";
import {
  Bell, Search, LogOut, MessageCircle, Phone,
  Plus, Check, Eye, EyeOff, Lock, ChevronDown,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDateDDMMYYYY, waLink, formatINR } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate, Link } from "react-router-dom";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const TopBar = () => {
  const { user, logout } = useAuth();
  const { isShielded, requestUnlock, lock, isDialogOpen, setDialogOpen, tryUnlock } = usePrivacyShield();
  const { notifications, refresh, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const today = formatDateDDMMYYYY();
  const unread = notifications.filter((n) => n.urgent).length;
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tryUnlock(password)) {
      setPassword(""); setPasswordError("");
      toast.success("Data unlocked");
    } else {
      setPasswordError("Incorrect password");
      setPassword("");
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  if (!user) return null;

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {/* ── Top bar — white, 1px bottom border ── */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 sticky top-0 z-30 shrink-0">

        {/* Sidebar toggle (mobile) */}
        <SidebarTrigger className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md h-8 w-8 flex items-center justify-center transition-colors md:hidden" />

        {/* Search bar */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="h-[14px] w-[14px] absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search clients, leads, invoices…"
              className="pl-8 h-8 text-[13px] bg-gray-50 border-gray-200 rounded-lg
                focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500
                placeholder:text-gray-400 text-gray-900 transition-all"
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1">

          {/* Date */}
          <span className="hidden sm:inline text-[12px] text-gray-400 font-medium mr-2">{today}</span>

          {/* Privacy shield */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg transition-colors ${
              isShielded
                ? "text-blue-500 hover:bg-blue-50"
                : "text-green-500 hover:bg-green-50"
            }`}
            onClick={() => isShielded ? requestUnlock() : lock()}
            title={isShielded ? "Data hidden — click to unlock" : "Data visible — click to lock"}
          >
            {isShielded ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
            {isShielded && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
            )}
          </Button>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg relative hover:bg-gray-100">
                <Bell className="h-[15px] w-[15px] text-gray-500" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-blue-600 ring-2 ring-white" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 rounded-xl shadow-lg border-gray-200">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-900">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    onClick={async () => {
                      const t = toast.loading("Resolving all…");
                      try {
                        const followIds  = notifications.filter(n => n.id.startsWith("follow-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                        const taskIds    = notifications.filter(n => n.id.startsWith("task-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                        const payIds     = notifications.filter(n => n.id.startsWith("pay-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                        const smartIds   = notifications.filter(n => n.id.startsWith("smart-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                        const otherIds   = notifications.filter(n => n.id.startsWith("stale-") || n.id.startsWith("qfollow-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                        const promises = [];
                        if (followIds.length)  promises.push(supabase.from("leads").update({ next_call_date: null, last_interaction_date: new Date().toISOString().slice(0,10) }).in("id", followIds));
                        if (taskIds.length)    promises.push(supabase.from("lead_tasks").update({ status: "Completed" }).in("id", taskIds));
                        if (payIds.length)     promises.push(supabase.from("quotations").update({ status: "Paid" }).in("id", payIds));
                        if (smartIds.length)   promises.push(supabase.from("smart_leads").update({ status: "Archived" }).in("id", smartIds));
                        if (otherIds.length)   promises.push(supabase.from("leads").update({ last_interaction_date: new Date().toISOString().slice(0,10) }).in("id", otherIds));
                        promises.push(markAllAsRead());
                        await Promise.all(promises);
                        toast.dismiss(t); toast.success("All resolved");
                      } catch { toast.dismiss(t); toast.error("Failed"); }
                    }}
                  >
                    Mark all done
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-auto divide-y divide-gray-50">
                {notifications.length > 0 ? notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <Link to={n.link || "#"} className="flex items-start gap-2.5 mb-2">
                      {n.urgent && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-gray-900 leading-snug">{n.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{n.time}</div>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {n.type === "payment" ? (
                          <button
                            className="text-[11px] font-semibold text-green-600 hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
                            onClick={() => {
                              const msg = (n.meta.amount > 10000 ? WHATSAPP_TEMPLATES.RECOVERY_FIRM : WHATSAPP_TEMPLATES.RECOVERY_SOFT)(n.meta.name, formatINR(n.meta.amount), n.meta.invoice);
                              window.open(waLink(n.meta.phone, msg), "_blank");
                            }}
                          >
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                          </button>
                        ) : n.type === "smart-lead" || n.type === "lead_assigned" ? (
                          <button
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                            onClick={() => navigate(n.link || "/smart-leads")}
                          >
                            <Plus className="h-3 w-3" /> Assign
                          </button>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <button
                              className="h-6 w-6 rounded-md text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors"
                              onClick={() => window.open(waLink(n.meta?.phone, ""), "_blank")}
                              title="WhatsApp"
                            ><MessageCircle className="h-3 w-3" /></button>
                            <button
                              className="h-6 w-6 rounded-md text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-colors"
                              onClick={() => window.open(`tel:${n.meta?.phone}`, "_self")}
                              title="Call"
                            ><Phone className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                      <button
                        className="text-[11px] font-semibold text-gray-400 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation();
                          if (n.id.startsWith("db-")) { await markAsRead(n.id); toast.success("Dismissed"); return; }
                          const idx = n.id.indexOf("-");
                          const type = n.id.substring(0, idx);
                          const id   = n.id.substring(idx + 1);
                          try {
                            if (type === "follow")       await supabase.from("leads").update({ next_call_date: null, last_interaction_date: new Date().toISOString().slice(0,10) }).eq("id", id);
                            else if (type === "task")    await supabase.from("lead_tasks").update({ status: "Done" }).eq("id", id);
                            else if (type === "pay")     await supabase.from("quotations").update({ status: "Paid" }).eq("id", id);
                            else if (type === "smart")   await supabase.from("smart_leads").update({ status: "Contacted" }).eq("id", id);
                            else if (type === "stale" || type === "qfollow") await supabase.from("leads").update({ last_interaction_date: new Date().toISOString().slice(0,10) }).eq("id", id);
                            refresh(); toast.success("Done");
                          } catch { toast.error("Failed"); }
                        }}
                      >
                        <Check className="h-3 w-3" /> Done
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-10 text-center text-[13px] text-gray-400">
                    No new notifications
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* User avatar + menu */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-blue-600 text-white text-[11px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-[13px] font-semibold text-gray-900 leading-none">{user.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{user.role}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1.5 rounded-xl shadow-lg border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700
                  hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4 text-gray-500" />
                Sign Out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Privacy Shield Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) { setPassword(""); setPasswordError(""); } }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Lock className="h-4 w-4 text-blue-600" />
              Unlock Confidential Data
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="shield-password" className="text-[13px] font-medium text-gray-700">
                Enter Password
              </Label>
              <Input
                id="shield-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                autoFocus
                className={`h-10 text-[13px] rounded-lg bg-gray-50 border-gray-200
                  focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500
                  ${passwordError ? "border-red-300 focus-visible:ring-red-500/30 focus-visible:border-red-400" : ""}`}
              />
              {passwordError && (
                <p className="text-[12px] text-red-500 font-medium">{passwordError}</p>
              )}
            </div>
            <p className="text-[12px] text-gray-400">
              Financial data and client names are hidden. Enter the password to reveal all.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 text-[13px] rounded-lg"
                onClick={() => { setDialogOpen(false); setPassword(""); setPasswordError(""); }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 text-[13px] rounded-lg bg-blue-600 hover:bg-blue-700 gap-1.5"
              >
                <Eye className="h-4 w-4" /> Unlock
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
