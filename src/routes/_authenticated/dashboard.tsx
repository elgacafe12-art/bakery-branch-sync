import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Package, TrendingUp, ClipboardList, Truck,
  Warehouse, Users as UsersIcon, Store, BarChart3, ShoppingBasket,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LOCATION_LABELS, ROLE_LABELS, STATUS_COLORS, STATUS_LABELS, type AppRole } from "@/lib/roles";
import { Link } from "@tanstack/react-router";
import { StorePortal } from "@/components/portals/StorePortal";
import { BakeryPortal } from "@/components/portals/BakeryPortal";
import { DeliveryPortal } from "@/components/portals/DeliveryPortal";
import { BranchPortal } from "@/components/portals/BranchPortal";
import { PortalHeader, QuickTile, StatTile } from "@/components/portals/shared";
import { DamageSummary } from "@/components/portals/DamageSummary";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — ELGA Café" }] }),
});

function Dashboard() {
  const { roles, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const primary = (roles[0] ?? "admin") as AppRole;

  if (roles.includes("admin")) return <AdminPortal />;
  if (primary === "central_store") return <StorePortal />;
  if (primary === "central_bakery") return <BakeryPortal />;
  if (primary === "delivery_man") return <DeliveryPortal />;
  if (primary === "branch_1") return <BranchPortal location="branch_1" label="Branch 1" />;
  if (primary === "branch_2") return <BranchPortal location="branch_2" label="Branch 2" />;
  return <AdminPortal />;
}

function AdminPortal() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [reqs, deliv, lowStock, movements] = await Promise.all([
        supabase.from("requests").select("id,status", { count: "exact" }),
        supabase.from("requests").select("id", { count: "exact", head: true }).in("status", ["assigned", "picked_up"]),
        supabase.from("inventory").select("*, ingredients!inner(name,min_stock,unit)").eq("item_type", "ingredient"),
        supabase.from("inventory_movements").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      const pending = (reqs.data ?? []).filter((r) => r.status === "pending").length;
      const low = (lowStock.data ?? []).filter((row: any) => row.ingredients && Number(row.quantity) < Number(row.ingredients.min_stock));
      return {
        pending, active: deliv.count ?? 0,
        movements24h: movements.count ?? 0, lowStock: low,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["admin-recent-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("requests")
        .select("id,request_number,status,from_location,to_location,created_at,item_type")
        .order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PortalHeader title={ROLE_LABELS.admin} subtitle="System-wide overview across all locations" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickTile to="/users" icon={UsersIcon} title="Users & roles" desc="Manage staff access" />
        <QuickTile to="/ingredients" icon={ShoppingBasket} title="Ingredients" desc="Edit catalogue" />
        <QuickTile to="/suppliers" icon={Store} title="Suppliers" desc="Manage suppliers" />
        <QuickTile to="/reports" icon={BarChart3} title="Reports" desc="All movements" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile title="Pending requests" value={stats?.pending ?? 0} icon={ClipboardList} tone="warning" />
        <StatTile title="Active deliveries" value={stats?.active ?? 0} icon={Truck} tone="primary" />
        <StatTile title="Movements (24h)" value={stats?.movements24h ?? 0} icon={TrendingUp} tone="accent" />
        <StatTile title="Low-stock items" value={stats?.lowStock?.length ?? 0} icon={AlertTriangle} tone="destructive" />
      </div>

      {stats?.lowStock && stats.lowStock.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="h-5 w-5" /> Low Stock Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.lowStock.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between text-sm border-b border-warning/20 pb-2 last:border-0">
                <div>
                  <span className="font-medium">{row.ingredients.name}</span>
                  <span className="text-muted-foreground"> at {LOCATION_LABELS[row.location as keyof typeof LOCATION_LABELS]}</span>
                </div>
                <div className="text-right">
                  <div className="text-warning-foreground font-semibold">{row.quantity} {row.ingredients.unit}</div>
                  <div className="text-xs text-muted-foreground">min {row.ingredients.min_stock} {row.ingredients.unit}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Recent Requests</CardTitle>
          <Link to="/requests" className="text-sm text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(recent ?? []).map((r) => (
            <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition border border-transparent hover:border-border">
              <div>
                <div className="font-medium text-sm">{r.request_number}</div>
                <div className="text-xs text-muted-foreground">
                  {LOCATION_LABELS[r.from_location]} → {LOCATION_LABELS[r.to_location]} · {r.item_type}
                </div>
              </div>
              <Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge>
            </Link>
          ))}
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No requests yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
