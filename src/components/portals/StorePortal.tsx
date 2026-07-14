import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, ClipboardList, Truck, Warehouse, AlertTriangle } from "lucide-react";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { PortalHeader, QuickTile, StatTile } from "./shared";
import { DamageSummary } from "./DamageSummary";

export function StorePortal() {
  const { data } = useQuery({
    queryKey: ["portal-store"],
    queryFn: async () => {
      const [pending, active, inv, lowRows] = await Promise.all([
        supabase.from("requests").select("id,request_number,status,from_location,to_location,item_type,created_at")
          .eq("to_location", "central_store").eq("status", "pending").order("created_at", { ascending: false }).limit(6),
        supabase.from("requests").select("id", { count: "exact", head: true })
          .in("status", ["approved", "assigned", "picked_up"]).eq("from_location", "central_store"),
        supabase.from("inventory").select("id,quantity,ingredients!inner(name,unit,min_stock)")
          .eq("location", "central_store").eq("item_type", "ingredient"),
        supabase.from("inventory").select("id,quantity,ingredients!inner(name,unit,min_stock)")
          .eq("location", "central_store").eq("item_type", "ingredient"),
      ]);
      const low = (lowRows.data ?? []).filter((r: any) => r.ingredients && Number(r.quantity) < Number(r.ingredients.min_stock));
      return { pending: pending.data ?? [], active: active.count ?? 0, invCount: (inv.data ?? []).length, low };
    },
  });

  return (
    <div className="space-y-6">
      <PortalHeader title="Central Store" subtitle="Receive from suppliers · Fulfil bakery & branch requests · Dispatch deliveries" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickTile to="/receive" icon={PackageCheck} title="Receive from Supplier" desc="Log incoming stock" />
        <QuickTile to="/requests" icon={ClipboardList} title="Requests to fulfil" desc="Bakery & branch orders" />
        <QuickTile to="/deliveries" icon={Truck} title="Deliveries" desc="Assign delivery man" />
        <QuickTile to="/inventory" icon={Warehouse} title="Stock levels" desc="Central store inventory" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile title="Pending requests" value={data?.pending.length ?? 0} icon={ClipboardList} tone="warning" />
        <StatTile title="In dispatch" value={data?.active ?? 0} icon={Truck} tone="primary" />
        <StatTile title="Ingredients tracked" value={data?.invCount ?? 0} icon={Warehouse} tone="accent" />
        <StatTile title="Low stock" value={data?.low.length ?? 0} icon={AlertTriangle} tone="destructive" />
      </div>

      <DamageSummary location="central_store" title="Central Store — Damage Summary" showBreakdown={false} showValue />



      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Incoming requests</CardTitle>
          <Link to="/requests" className="text-sm text-primary hover:underline">Open queue →</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.pending ?? []).map((r) => (
            <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="flex items-center justify-between p-3 rounded-md hover:bg-muted border border-transparent hover:border-border">
              <div>
                <div className="font-medium text-sm">{r.request_number}</div>
                <div className="text-xs text-muted-foreground">
                  from {LOCATION_LABELS[r.from_location]} · {r.item_type}
                </div>
              </div>
              <Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge>
            </Link>
          ))}
          {(data?.pending ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending requests.</p>}
        </CardContent>
      </Card>

      {data?.low && data.low.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="h-5 w-5" /> Low stock at Central Store
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.low.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between text-sm border-b border-warning/20 pb-2 last:border-0">
                <span className="font-medium">{row.ingredients.name}</span>
                <span className="text-warning-foreground font-semibold">{row.quantity} / min {row.ingredients.min_stock} {row.ingredients.unit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
