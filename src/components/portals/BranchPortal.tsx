import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Truck, Warehouse, AlertTriangle, PackageCheck } from "lucide-react";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS, type LocationType } from "@/lib/roles";
import { PortalHeader, QuickTile, StatTile } from "./shared";
import { DamageSummary } from "./DamageSummary";

export function BranchPortal({ location, label }: { location: LocationType; label: string }) {
  const { data } = useQuery({
    queryKey: ["portal-branch", location],
    queryFn: async () => {
      const [mine, incoming, invRows] = await Promise.all([
        supabase.from("requests").select("id,request_number,status,to_location,item_type,created_at")
          .eq("from_location", location).order("created_at", { ascending: false }).limit(6),
        supabase.from("requests").select("id,request_number,status,from_location,item_type,created_at")
          .eq("to_location", location).in("status", ["assigned", "picked_up"]).order("created_at", { ascending: false }).limit(6),
        supabase.from("inventory").select("id,quantity,item_type,ingredients(name,unit,min_stock),products(name,unit)")
          .eq("location", location),
      ]);
      return { mine: mine.data ?? [], incoming: incoming.data ?? [], inventory: invRows.data ?? [] };
    },
  });

  return (
    <div className="space-y-6">
      <PortalHeader title={label} subtitle="Request stock · Confirm deliveries · Report issues" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickTile to="/requests/new" icon={Send} title="New request" desc="Order from Bakery / Store" />
        <QuickTile to="/deliveries" icon={Truck} title="Incoming deliveries" desc="Confirm receipts" />
        <QuickTile to="/inventory" icon={Warehouse} title="Branch stock" desc="Current inventory" />
        <QuickTile to="/damage" icon={AlertTriangle} title="Report issue" desc="Missing / damaged" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile title="My open requests" value={data?.mine.length ?? 0} icon={Send} tone="warning" />
        <StatTile title="Incoming shipments" value={data?.incoming.length ?? 0} icon={Truck} tone="primary" />
        <StatTile title="Items tracked" value={data?.inventory.length ?? 0} icon={Warehouse} tone="accent" />
        <StatTile title="Confirmed deliveries" value={(data?.incoming ?? []).filter((r) => r.status === "picked_up").length} icon={PackageCheck} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> My requests</CardTitle>
            <Link to="/requests" className="text-sm text-primary hover:underline">All →</Link>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Incoming</CardTitle>
            <Link to="/deliveries" className="text-sm text-primary hover:underline">All →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.incoming ?? []).map((r) => (
              <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="flex items-center justify-between p-3 rounded-md hover:bg-muted border border-transparent hover:border-border">
                <div>
                  <div className="font-medium text-sm">{r.request_number}</div>
                  <div className="text-xs text-muted-foreground">from {LOCATION_LABELS[r.from_location]} · {r.item_type}</div>
                </div>
                <Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge>
              </Link>
            ))}
            {(data?.incoming ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nothing on the way.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
