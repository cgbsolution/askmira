"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Backdrop } from "@/components/layout/Backdrop";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Client-side gate. The backend rejects an unauthenticated request anyway —
  // this exists so the user lands on sign-in rather than an empty shell.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin");
  }, [isLoading, isAuthenticated, router]);

  const contentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[260px]"
      : "lg:ml-[84px]";

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <Backdrop />
      <div className={`flex min-h-screen flex-col transition-[margin] duration-200 ease-out ${contentMargin}`}>
        <AppHeader />
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
