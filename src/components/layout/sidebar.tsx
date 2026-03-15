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
  { label: "Deal Flow", href: "/deals", icon: BarChart3 },
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
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        "hover:bg-[var(--bg-card-hover)]",
        isActive
          ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-l-2 border-[var(--accent-blue)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-l-2 border-transparent",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
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

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)] border-r border-[var(--border)]">
      {/* Header */}
      <div
        className={cn(
          "flex items-center border-b border-[var(--border)] px-4 py-4",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)] text-white font-bold text-sm">
          D
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Dental PE
            </span>
            <span className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">
              Intelligence
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
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
            />
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-[var(--border)] px-4 py-3",
          collapsed && "px-2"
        )}
      >
        {/* System status indicator */}
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center"
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--accent-green)]" />
          {!collapsed && (
            <span className="text-xs text-[var(--text-muted)]">
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
          "hidden md:flex flex-col relative transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent collapsed={mounted ? collapsed : false} />

        {/* Collapse toggle button */}
        <button
          onClick={toggle}
          className={cn(
            "absolute -right-3 top-20 z-10",
            "flex h-6 w-6 items-center justify-center rounded-full",
            "bg-[var(--bg-card)] border border-[var(--border)]",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            "hover:border-[var(--border-hover)] transition-colors"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>

      {/* Mobile sidebar (sheet overlay) */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="fixed left-3 top-3 z-50 bg-[var(--bg-card)] border border-[var(--border)]"
              />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-60 p-0 bg-[var(--bg-surface)] border-[var(--border)]"
          >
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
