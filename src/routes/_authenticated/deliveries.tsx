import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/deliveries")({
  component: DeliveriesPage,
  head: () => ({ meta: [{ title: "Deliveries — ELGA Café" }] }),
});

function DeliveriesPage() {
  const { user, roles } = useAuth();
  const isDM = roles.includes("delivery_man");

  const { data } = useQuery({
    queryKey: ["deliveries", user?.id, isDM],
    queryFn: async () => {
      let q = supabase.from("requests").select("*").in("status", ["approved", "assigned", "picked_up", "delivered"]).order("created_at", { ascending: false });
      if (isDM && user) q = q.eq("delivery_man_id", user.id);
      return (await q).data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Deliveries</h1><p className="text-sm text-muted-foreground">{isDM ? "Your assigned deliveries." : "All active deliveries."}</p></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Request #</TableHead><TableHead>Route</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link to="/requests/$id" params={{ id: r.id }} className="font-mono text-sm text-primary hover:underline">{r.request_number}</Link></TableCell>
                <TableCell>{LOCATION_LABELS[r.from_location]} → {LOCATION_LABELS[r.to_location]}</TableCell>
                <TableCell className="capitalize">{r.item_type}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.picked_up_at ? format(new Date(r.picked_up_at), "MMM d, HH:mm") : "—"}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No active deliveries</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
