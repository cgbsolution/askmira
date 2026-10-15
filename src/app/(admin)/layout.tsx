"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { AccessDenied } from "@/components/common/AccessDenied";
import { AppHeader } from "@/components/layout/AppHeader";
import { OperatorBanner } from "@/components/operators/OperatorBanner";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SIDEBAR_COOKIE_NAME, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { decideAccess } from "@/lib/access";

/**
 * Whether the rail was left expanded last time. Only called once the session
 * has loaded, which never happens during server rendering.
 */
function sidebarWasOpen(): boolean {
  return !document.cookie.split("; ").includes(`${SIDEBAR_COOKIE_NAME}=false`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Client-side gate. The backend rejects an unauthenticated request anyway —
  // this exists so the user lands on sign-in rather than an empty shell, and
  // comes back to the page they were trying to open.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // A temporary password is replaced before anything else is opened; then,
  // where the workspace requires it, two-step sign-in is set up.
  const mustChangePassword = Boolean(user?.must_change_password);
  const mustSetUpTwoStep = !mustChangePassword && Boolean(user?.two_step_required);
  useEffect(() => {
    if (isLoading) return;
    if (mustChangePassword) router.replace("/change-password");
    else if (mustSetUpTwoStep) router.replace("/two-step-setup");
  }, [isLoading, mustChangePassword, mustSetUpTwoStep, router]);

  if (isLoading || !isAuthenticated || mustChangePassword || mustSetUpTwoStep) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Presentation only: the page is not rendered, so it makes no API calls the
  // person was never going to be allowed. The API refuses them regardless.
  const decision = decideAccess(pathname, user, tenant);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen={sidebarWasOpen()}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppHeader />
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) flex-1 p-4 md:p-6">
            <OperatorBanner />
            {decision === "allowed" ? children : <AccessDenied reason={decision} />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
