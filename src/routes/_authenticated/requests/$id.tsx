import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LOCATION_LABELS, ROLE_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/requests/$id")({
  component: RequestDetail,
  head: () => ({ meta: [{ title: "Request — ELGA Café" }] }),
});

function RequestDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const [rejectReason, setRejectReason] = useState("");
  const [deliveryManId, setDeliveryManId] = useState("");
  const [notesEdit, setNotesEdit] = useState<Record<string, { damaged: number; missing: number }>>({});

  const { data: req } = useQuery({
    queryKey: ["req", id],
    queryFn: async () => (await supabase.from("requests").select("*, request_items(*)").eq("id", id).single()).data,
  });

  const { data: itemNames } = useQuery({
    queryKey: ["req-item-names", id, req?.item_type],
    enabled: !!req,
    queryFn: async () => {
      const ids = (req!.request_items ?? []).map((i: any) => i.item_id);
      if (!ids.length) return new Map();
      const table = req!.item_type === "ingredient" ? "ingredients" : "products";
      const { data } = await supabase.from(table).select("id,name,unit").in("id", ids);
      return new Map((data ?? []).map((d: any) => [d.id, d]));
    },
  });

  const { data: deliveryMen } = useQuery({
    queryKey: ["dm-list"],
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "delivery_man");
      const ids = (r ?? []).map((x) => x.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      return data ?? [];
    },
  });

  if (!req) return <div className="text-muted-foreground">Loading...</div>;

  const isFromMe = (req.from_location === "central_store" && roles.includes("central_store")) || (req.from_location === "central_bakery" && roles.includes("central_bakery")) || roles.includes("admin");
  const isReceiver = ["branch_1", "branch_2", "central_bakery"].some((r) => roles.includes(r as any)) && req.to_location === roles.find((r) => ["branch_1", "branch_2", "central_bakery"].includes(r));
  const isDM = req.delivery_man_id === user?.id;

  const update = async (patch: any, extra?: () => Promise<void>) => {
    const { error } = await supabase.from("requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (extra) await extra();
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["req", id] });
  };

  const approve = () =>
    update({ status: "approved", approved_by: user!.id, approved_at: new Date().toISOString() }, async () => {
      await supabase.from("notifications").insert({ user_id: req.requested_by, title: "Request approved", message: `Request ${req.request_number} was approved.`, link: `/requests/${id}` });
    });

  const reject = () => {
    if (!rejectReason) return toast.error("Reason required");
    update({ status: "rejected", rejection_reason: rejectReason }, async () => {
      await supabase.from("notifications").insert({ user_id: req.requested_by, title: "Request rejected", message: rejectReason, link: `/requests/${id}` });
    });
  };

  const assign = () => {
    if (!deliveryManId) return toast.error("Select delivery man");
    update({ status: "assigned", delivery_man_id: deliveryManId }, async () => {
      await supabase.from("notifications").insert({ user_id: deliveryManId, title: "New delivery assigned", message: `Request ${req.request_number}`, link: `/deliveries` });
    });
  };

  const pickup = async () => {
    // Deduct from source inventory. Guard against re-running by checking existing delivery_out.
    const items = req.request_items ?? [];
    const { data: existing } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("reference_type", "request")
      .eq("reference_id", req.id)
      .eq("movement", "delivery_out");
    if (!existing || existing.length === 0) {
      const movements = items.map((it: any) => ({
        location: req.from_location, item_type: req.item_type, item_id: it.item_id,
        quantity: -Number(it.quantity), movement: "delivery_out" as const,
        reference_type: "request", reference_id: req.id, performed_by: user?.id,
      }));
      const { error: mErr } = await supabase.from("inventory_movements").insert(movements);
      if (mErr) return toast.error(`Pickup failed: ${mErr.message}`);
    }
    update({ status: "picked_up", picked_up_at: new Date().toISOString() });
  };

  const deliver = async () => {
    const items = req.request_items ?? [];
    // Safety net: if pickup was never recorded (legacy/silent-fail), record delivery_out now too.
    const { data: outExisting } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("reference_type", "request")
      .eq("reference_id", req.id)
      .eq("movement", "delivery_out");
    if (!outExisting || outExisting.length === 0) {
      const outMovements = items.map((it: any) => ({
        location: req.from_location, item_type: req.item_type, item_id: it.item_id,
        quantity: -Number(it.quantity), movement: "delivery_out" as const,
        reference_type: "request", reference_id: req.id, performed_by: user?.id,
      }));
      const { error: outErr } = await supabase.from("inventory_movements").insert(outMovements);
      if (outErr) return toast.error(`Source deduction failed: ${outErr.message}`);
    }

    // Guard against re-running deliver
    const { data: inExisting } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("reference_type", "request")
      .eq("reference_id", req.id)
      .eq("movement", "delivery_in");
    const alreadyIn = (inExisting ?? []).length > 0;

    for (const it of items) {
      const edits = notesEdit[it.id] ?? { damaged: it.damaged_quantity ?? 0, missing: it.missing_quantity ?? 0 };
      const delivered = Number(it.quantity) - edits.damaged - edits.missing;
      await supabase.from("request_items").update({
        delivered_quantity: delivered, damaged_quantity: edits.damaged, missing_quantity: edits.missing,
      }).eq("id", it.id);
      if (delivered > 0 && !alreadyIn) {
        const { error: inErr } = await supabase.from("inventory_movements").insert({
          location: req.to_location, item_type: req.item_type, item_id: it.item_id,
          quantity: delivered, movement: "delivery_in" as const, reference_type: "request", reference_id: req.id, performed_by: user?.id,
        });
        if (inErr) return toast.error(`Delivery-in failed: ${inErr.message}`);
      }
    }
    update({ status: "delivered", delivered_at: new Date().toISOString() }, async () => {
      await supabase.from("notifications").insert({ user_id: req.requested_by, title: "Delivery arrived", message: `${req.request_number} was delivered.`, link: `/requests/${id}` });
    });
  };

  const complete = () => update({ status: "completed", completed_at: new Date().toISOString() });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-mono">{req.request_number}</div>
          <h1 className="text-2xl font-bold">{LOCATION_LABELS[req.from_location]} → {LOCATION_LABELS[req.to_location]}</h1>
          <div className="text-sm text-muted-foreground">Created {format(new Date(req.created_at), "PPP p")} · {req.item_type}</div>
        </div>
        <Badge className={STATUS_COLORS[req.status]} variant="outline">{STATUS_LABELS[req.status]}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Requested</TableHead><TableHead>Delivered</TableHead><TableHead>Damaged</TableHead><TableHead>Missing</TableHead></TableRow></TableHeader>
            <TableBody>
              {(req.request_items ?? []).map((it: any) => {
                const info = itemNames?.get(it.item_id);
                const canEdit = isDM && req.status === "picked_up";
                const cur = notesEdit[it.id] ?? { damaged: it.damaged_quantity ?? 0, missing: it.missing_quantity ?? 0 };
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{info?.name ?? it.item_id}</TableCell>
                    <TableCell>{it.quantity} {info?.unit}</TableCell>
                    <TableCell>{it.delivered_quantity ?? "—"}</TableCell>
                    <TableCell>{canEdit
                      ? <Input type="number" step="0.01" className="w-24" value={cur.damaged} onChange={(e) => setNotesEdit({ ...notesEdit, [it.id]: { ...cur, damaged: Number(e.target.value) } })} />
                      : (it.damaged_quantity ?? 0)}</TableCell>
                    <TableCell>{canEdit
                      ? <Input type="number" step="0.01" className="w-24" value={cur.missing} onChange={(e) => setNotesEdit({ ...notesEdit, [it.id]: { ...cur, missing: Number(e.target.value) } })} />
                      : (it.missing_quantity ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {req.notes && <Card><CardContent className="pt-6"><div className="text-sm"><span className="font-medium">Notes:</span> {req.notes}</div></CardContent></Card>}
      {req.rejection_reason && <Card className="border-destructive/40"><CardContent className="pt-6 text-sm"><span className="font-medium text-destructive">Rejected:</span> {req.rejection_reason}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {req.status === "pending" && isFromMe && (
            <div className="flex flex-wrap gap-2 items-end">
              <Button onClick={approve}>Approve</Button>
              <div className="flex-1 min-w-64">
                <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              <Button variant="destructive" onClick={reject}>Reject</Button>
            </div>
          )}

          {req.status === "approved" && isFromMe && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium">Assign delivery man</label>
                <Select value={deliveryManId} onValueChange={setDeliveryManId}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{(deliveryMen ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={assign}>Assign</Button>
            </div>
          )}

          {req.status === "assigned" && isDM && <Button onClick={pickup}>Confirm Pickup</Button>}
          {req.status === "picked_up" && isDM && <Button onClick={deliver}>Confirm Delivery</Button>}
          {req.status === "delivered" && (isReceiver || roles.includes("admin")) && <Button onClick={complete}>Confirm Received & Complete</Button>}

          {(req.status === "rejected" || req.status === "completed" || req.status === "cancelled") && (
            <p className="text-sm text-muted-foreground">This request is closed.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
