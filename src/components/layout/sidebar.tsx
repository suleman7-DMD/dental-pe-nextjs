"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Map,
  Target,
  Briefcase,
  Microscope,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "@/providers/sidebar-provider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Deal Flow", href: "/deal-flow", icon: BarChart3 },
  { label: "Market Intel", href: "/market-intel", icon: Map },
  { label: "Buyability", href: "/buyability", icon: Target },
  { label: "Job Market", href: "/job-market", icon: Briefcase },
  { label: "Research", href: "/research", icon: Microscope },
  { label: "System", href: "/system", icon: Settings },
];

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-md text-[13px] font-medium transition-all duration-150",
        "py-[10px] px-4",
        isActive
          ? "text-[#F8FAFC] bg-[rgba(59,130,246,0.1)]"
          : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[rgba(255,255,255,0.03)]",
        collapsed && "justify-center px-0"
      )}
    >
      {/* Active indicator — left border */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-[#3B82F6]" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
          isActive ? "text-[#F8FAFC]" : "text-[#94A3B8] group-hover:text-[#F8FAFC]"
        )}
      />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger delay={0} render={link} />
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#060B18]">
      {/* Logo area */}
      <div
        className={cn(
          "flex items-center px-4 pt-5 pb-4",
          collapsed ? "justify-center px-2" : "gap-0"
        )}
      >
        {collapsed ? (
          /* Collapsed: DP monogram */
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/20">
            <span className="text-[13px] font-bold text-[#3B82F6]">DP</span>
          </div>
        ) : (
          /* Expanded: Dental PE / INTELLIGENCE */
          <div className="flex flex-col">
            <span className="text-[18px] font-bold leading-tight text-[#F8FAFC]" style={{ fontFamily: 'var(--font-sans), Inter, sans-serif' }}>
              Dental PE
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#3B82F6]">
              Intelligence
            </span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-[2px] px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              item={item}
              isActive={isActive}
              collapsed={collapsed}
              onClick={onNavClick}
            />
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        {/* Separator */}
        <div className="mx-3 h-px bg-white/[0.06]" />

        {/* System status */}
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3",
            collapsed && "justify-center px-2"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
          </span>
          {!collapsed && (
            <span className="text-[11px] font-medium text-[#94A3B8]">
              System Online
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { collapsed, toggle, mounted } = useSidebarContext();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col relative transition-[width] duration-200 ease-in-out shrink-0",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <div className="flex h-full flex-col">
          <SidebarContent collapsed={mounted ? collapsed : false} />

          {/* Collapse toggle — pinned to bottom of sidebar */}
          <button
            onClick={toggle}
            className={cn(
              "flex items-center justify-center",
              "h-9 w-full",
              "bg-[#060B18] border-t border-white/[0.06]",
              "text-[#94A3B8] hover:text-[#F8FAFC]",
              "transition-colors duration-150"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar (sheet overlay) */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="fixed left-3 top-3 z-50 bg-[#060B18] border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#060B18]/90"
              />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[220px] p-0 bg-[#060B18] border-white/[0.06]"
            showCloseButton={false}
          >
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
