import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, AlertTriangle, PackageCheck, Bell } from "lucide-react";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { PortalHeader, QuickTile, StatTile } from "./shared";

export function DeliveryPortal() {
  const { data } = useQuery({
    queryKey: ["portal-delivery"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      const [mine, done] = await Promise.all([
        supabase.from("requests").select("id,request_number,status,from_location,to_location,item_type,created_at")
          .eq("delivery_man_id", uid ?? "").in("status", ["assigned", "picked_up"])
          .order("created_at", { ascending: false }),
        supabase.from("requests").select("id", { count: "exact", head: true })
          .eq("delivery_man_id", uid ?? "").in("status", ["delivered", "completed"]),
      ]);
      return { mine: mine.data ?? [], done: done.count ?? 0 };
    },
  });

  const toPickup = (data?.mine ?? []).filter((r) => r.status === "assigned").length;
  const inTransit = (data?.mine ?? []).filter((r) => r.status === "picked_up").length;

  return (
    <div className="space-y-6">
      <PortalHeader title="Delivery Man" subtitle="Pick up · Deliver · Confirm receipts · Report any damage" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickTile to="/deliveries" icon={Truck} title="My deliveries" desc="Pickup & drop-off" />
        <QuickTile to="/damage" icon={AlertTriangle} title="Report damage" desc="Log damaged items" />
        <QuickTile to="/notifications" icon={Bell} title="Notifications" desc="New assignments" />
        <QuickTile to="/requests" icon={PackageCheck} title="Request history" desc="All routes" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile title="To pick up" value={toPickup} icon={PackageCheck} tone="warning" />
        <StatTile title="In transit" value={inTransit} icon={Truck} tone="primary" />
        <StatTile title="Completed" value={data?.done ?? 0} icon={PackageCheck} tone="success" />
        <StatTile title="Assigned to me" value={data?.mine.length ?? 0} icon={Bell} tone="accent" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> My active runs</CardTitle>
          <Link to="/deliveries" className="text-sm text-primary hover:underline">Open deliveries →</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.mine ?? []).map((r) => (
            <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="flex items-center justify-between p-3 rounded-md hover:bg-muted border border-transparent hover:border-border">
              <div>
                <div className="font-medium text-sm">{r.request_number}</div>
                <div className="text-xs text-muted-foreground">
                  {LOCATION_LABELS[r.from_location]} → {LOCATION_LABELS[r.to_location]} · {r.item_type}
                </div>
              </div>
              <Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge>
            </Link>
          ))}
          {(data?.mine ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No active deliveries.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
