import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

export const BrandLogo = ({ collapsed = false }: Props) => {
  return (
    <div className={cn("flex items-center gap-2.5 transition-all duration-200", collapsed ? "justify-center" : "")}>
      {/* Logo image / fallback icon */}
      <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 bg-blue-600 flex items-center justify-center">
        <img
          src="/logo-brand.png"
          alt="BuzyHub"
          className="h-full w-full object-contain"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = "none";
            // Show fallback letter
            (el.parentElement as HTMLElement).innerHTML =
              '<span style="color:white;font-weight:800;font-size:14px;letter-spacing:-0.03em">BH</span>';
          }}
        />
      </div>

      {!collapsed && (
        <div className="leading-tight min-w-0">
          <div className="font-bold text-[14px] tracking-tight text-gray-900 leading-none">
            BuzyHub
          </div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-none">
            CRM Workspace
          </div>
        </div>
      )}
    </div>
  );
};
