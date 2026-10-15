"use client"

import ChatProvider from "@/components/chat/ChatProvider";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { Toaster } from "sonner";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[250px]"
      : "lg:ml-[50px]";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader />
        <div className="p-2 lg:p-1 mx-auto max-w-(--breakpoint-2xl)">
          {children}
          
          <ChatProvider />
          <Toaster richColors position="top-right" />
        </div>
      </div>
    </div>
  );
}
