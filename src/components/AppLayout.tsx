import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

export const AppLayout = () => {
  return (
    <SidebarProvider>
      {/* Outer: light gray page background like Crisp */}
      <div className="min-h-screen flex w-full" style={{ background: "hsl(210 20% 96%)" }}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          {/* Inner: scrollable content area — slightly inset */}
          <main className="flex-1 overflow-auto p-4 md:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
