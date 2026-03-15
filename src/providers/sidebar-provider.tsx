"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useSidebar } from "@/lib/hooks/use-sidebar";

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  mounted: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  expand: () => {},
  collapse: () => {},
  mounted: false,
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebar = useSidebar();

  return (
    <SidebarContext.Provider value={sidebar}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  return useContext(SidebarContext);
}
