import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LOCATION_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests/")({
  component: RequestsList,
  head: () => ({ meta: [{ title: "Requests — ELGA Café" }] }),
});

function RequestsList() {
  const { roles } = useAuth();
  const canCreate = roles.some((r) => ["central_bakery", "branch_1", "branch_2"].includes(r));
  const { data } = useQuery({
    queryKey: ["requests-list"],
    queryFn: async () => (await supabase.from("requests").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Requests</h1><p className="text-sm text-muted-foreground">All ingredient and product requests.</p></div>
        {canCreate && <Button asChild><Link to="/requests/new"><Plus className="h-4 w-4 mr-2" />New Request</Link></Button>}
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Request #</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => window.location.assign(`/requests/${r.id}`)}>
                <TableCell className="font-mono text-sm">{r.request_number}</TableCell>
                <TableCell className="capitalize">{r.item_type}</TableCell>
                <TableCell>{LOCATION_LABELS[r.from_location]}</TableCell>
                <TableCell>{LOCATION_LABELS[r.to_location]}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy HH:mm")}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
