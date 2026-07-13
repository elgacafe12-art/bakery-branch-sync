import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Coffee, LayoutDashboard, Users, Truck, Package, ShoppingBasket, Store,
  ClipboardList, Send, ChefHat, Bell, BarChart3, LogOut, Warehouse, PackageCheck,
  AlertTriangle,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[] | "all";
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: "all" },
      { title: "Notifications", url: "/notifications", icon: Bell, roles: "all" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Requests", url: "/requests", icon: ClipboardList, roles: ["admin", "central_store", "central_bakery", "branch_1", "branch_2"] },
      { title: "New Request", url: "/requests/new", icon: Send, roles: ["central_bakery", "branch_1", "branch_2"] },
      { title: "Deliveries", url: "/deliveries", icon: Truck, roles: ["admin", "central_store", "central_bakery", "delivery_man"] },
      { title: "Receive from Supplier", url: "/receive", icon: PackageCheck, roles: ["admin", "central_store"] },
      { title: "Production", url: "/production", icon: ChefHat, roles: ["admin", "central_bakery"] },
      { title: "Raw Material Usage", url: "/usage", icon: ChefHat, roles: ["admin", "branch_1", "branch_2"] },
      { title: "Damage / Issues", url: "/damage", icon: AlertTriangle, roles: "all" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock Levels", url: "/inventory", icon: Warehouse, roles: ["admin", "central_store", "central_bakery", "branch_1", "branch_2"] },
      { title: "Movements", url: "/movements", icon: BarChart3, roles: ["admin", "central_store", "central_bakery"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", url: "/users", icon: Users, roles: ["admin"] },
      { title: "Suppliers", url: "/suppliers", icon: Store, roles: ["admin", "central_store"] },
      { title: "Ingredients", url: "/ingredients", icon: ShoppingBasket, roles: ["admin"] },
      { title: "Products", url: "/products", icon: Package, roles: ["admin"] },
      { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin"] },
    ],
  },
];

export function AppSidebar({ roles }: { roles: AppRole[] }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const canSee = (item: NavItem) =>
    item.roles === "all" || roles.some((r) => (item.roles as AppRole[]).includes(r)) || roles.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Coffee className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sidebar-foreground truncate">ELGA Café</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">Inventory System</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter(canSee);
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={path === item.url}>
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
