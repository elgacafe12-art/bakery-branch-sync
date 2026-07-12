import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-24 w-64" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar roles={roles} />
      <SidebarInset>
        <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center gap-3 px-4">
          <SidebarTrigger />
          <div className="flex-1">
            <div className="text-sm font-medium truncate">{user?.email}</div>
            <div className="text-xs text-muted-foreground">
              {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(" · ") : "No role assigned yet"}
            </div>
          </div>
          <NotificationBell />
        </header>
        <main className="p-4 md:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
