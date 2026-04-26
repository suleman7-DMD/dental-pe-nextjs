"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  MapPin,
  Target,
  Briefcase,
  Search,
  Brain,
  Crosshair,
  Rocket,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  BarChart3,
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

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Launchpad", href: "/launchpad", icon: Rocket },
      { label: "Warroom", href: "/warroom", icon: Crosshair },
    ],
  },
  {
    title: "MARKETS",
    items: [
      { label: "Job Market", href: "/job-market", icon: Briefcase },
      { label: "Market Intel", href: "/market-intel", icon: MapPin },
      { label: "Buyability", href: "/buyability", icon: Target },
    ],
  },
  {
    title: "ANALYSIS",
    items: [
      { label: "Deal Flow", href: "/deal-flow", icon: TrendingUp },
      { label: "Research", href: "/research", icon: Search },
      { label: "Intelligence", href: "/intelligence", icon: Brain },
      { label: "Data Breakdown", href: "/data-breakdown", icon: BarChart3 },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { label: "System", href: "/system", icon: Settings },
    ],
  },
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
      prefetch={false}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-md text-[13px] font-medium transition-all duration-150",
        "py-[10px] px-4",
        isActive
          ? "text-[#F5F5F0] bg-[rgba(184,134,11,0.1)]"
          : "text-[#F5F5F0]/60 hover:text-[#F5F5F0]/80 hover:bg-[#363636]",
        collapsed && "justify-center px-0"
      )}
    >
      {/* Active indicator — left border */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#B8860B]" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
          isActive ? "text-[#F5F5F0]" : "text-[#F5F5F0]/60 group-hover:text-[#F5F5F0]/80"
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
    <div className="flex h-full flex-col bg-[#2C2C2C]">
      {/* Logo area */}
      <div
        className={cn(
          "flex items-center px-4 pt-5 pb-4",
          collapsed ? "justify-center px-2" : "gap-0"
        )}
      >
        {collapsed ? (
          /* Collapsed: DP monogram */
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B8860B]/15 border border-[#B8860B]/20">
            <span className="text-[13px] font-bold text-[#B8860B]">DP</span>
          </div>
        ) : (
          /* Expanded: Dental PE / INTELLIGENCE */
          <div className="flex flex-col">
            <span className="text-[18px] font-bold leading-tight text-[#F5F5F0]" style={{ fontFamily: 'var(--font-sans), Inter, sans-serif' }}>
              Dental PE
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#B8860B]">
              Intelligence
            </span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-[2px] px-2 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.title} className={cn(sectionIdx > 0 && "mt-3")}>
            {/* Section label */}
            {!collapsed && (
              <div className="px-4 pb-1 pt-1">
                <span className="text-[10px] font-medium uppercase tracking-widest text-[#F5F5F0]/40">
                  {section.title}
                </span>
              </div>
            )}
            {collapsed && sectionIdx > 0 && (
              <div className="mx-3 mb-1 h-px bg-white/[0.06]" />
            )}
            {section.items.map((item) => {
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
          </div>
        ))}
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
            <span className="text-[11px] font-medium text-[#F5F5F0]/60">
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
              "bg-[#2C2C2C] border-t border-white/[0.06]",
              "text-[#F5F5F0]/60 hover:text-[#F5F5F0]",
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
                className="fixed left-3 top-3 z-50 bg-[#2C2C2C] border border-white/[0.08] text-[#F5F5F0]/60 hover:text-[#F5F5F0] hover:bg-[#363636]"
              />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[220px] p-0 bg-[#2C2C2C] border-white/[0.06]"
            showCloseButton={false}
          >
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
