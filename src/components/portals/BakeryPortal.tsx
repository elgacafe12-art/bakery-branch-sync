import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, ChefHat, Truck, Warehouse, AlertTriangle, ClipboardList } from "lucide-react";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { PortalHeader, QuickTile, StatTile } from "./shared";
import { DamageSummary } from "./DamageSummary";

export function BakeryPortal() {
  const { data } = useQuery({
    queryKey: ["portal-bakery"],
    queryFn: async () => {
      const [mine, incoming, outgoing, low] = await Promise.all([
        supabase.from("requests").select("id,request_number,status,to_location,item_type,created_at")
          .eq("from_location", "central_bakery").order("created_at", { ascending: false }).limit(6),
        supabase.from("requests").select("id", { count: "exact", head: true })
          .eq("to_location", "central_bakery").in("status", ["approved", "assigned", "picked_up"]),
        supabase.from("requests").select("id", { count: "exact", head: true })
          .eq("from_location", "central_bakery").in("status", ["pending", "approved", "assigned"]),
        supabase.from("inventory").select("id,quantity,ingredients!inner(name,unit,min_stock)")
          .eq("location", "central_bakery").eq("item_type", "ingredient"),
      ]);
      const lowStock = (low.data ?? []).filter((r: any) => r.ingredients && Number(r.quantity) < Number(r.ingredients.min_stock));
      return { mine: mine.data ?? [], incoming: incoming.count ?? 0, outgoing: outgoing.count ?? 0, lowStock };
    },
  });

  return (
    <div className="space-y-6">
      <PortalHeader title="Central Bakery" subtitle="Request ingredients · Produce finished goods · Dispatch to branches" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickTile to="/requests/new" icon={Send} title="New request" desc="Order from Central Store" />
        <QuickTile to="/production" icon={ChefHat} title="Production" desc="Record finished products" />
        <QuickTile to="/deliveries" icon={Truck} title="Deliveries out" desc="Send to branches" />
        <QuickTile to="/inventory" icon={Warehouse} title="Bakery stock" desc="Current inventory" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile title="Incoming ingredients" value={data?.incoming ?? 0} icon={Truck} tone="primary" />
        <StatTile title="Outgoing to branches" value={data?.outgoing ?? 0} icon={Send} tone="accent" />
        <StatTile title="My open requests" value={data?.mine.length ?? 0} icon={ClipboardList} tone="warning" />
        <StatTile title="Low ingredients" value={data?.lowStock.length ?? 0} icon={AlertTriangle} tone="destructive" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> My recent requests</CardTitle>
          <Link to="/requests" className="text-sm text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.mine ?? []).map((r) => (
            <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="flex items-center justify-between p-3 rounded-md hover:bg-muted border border-transparent hover:border-border">
              <div>
                <div className="font-medium text-sm">{r.request_number}</div>
                <div className="text-xs text-muted-foreground">to {LOCATION_LABELS[r.to_location]} · {r.item_type}</div>
              </div>
              <Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge>
            </Link>
          ))}
          {(data?.mine ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No requests yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
