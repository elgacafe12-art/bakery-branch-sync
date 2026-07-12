import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOCATION_LABELS, roleToLocation, type LocationType, type ItemType } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests/new")({
  component: NewRequest,
  head: () => ({ meta: [{ title: "New Request — ELGA Café" }] }),
});

function NewRequest() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const myLoc = useMemo(() => roles.map(roleToLocation).find(Boolean) as LocationType | undefined, [roles]);
  const isBakery = myLoc === "central_bakery";
  const isBranch = myLoc === "branch_1" || myLoc === "branch_2";

  const [itemType, setItemType] = useState<ItemType>(isBakery ? "ingredient" : "product");
  const [fromLoc, setFromLoc] = useState<LocationType>(isBakery ? "central_store" : "central_bakery");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([{ item_id: "", quantity: 0 }]);
  const [saving, setSaving] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["req-items", itemType],
    queryFn: async () => {
      if (itemType === "ingredient") {
        return (await supabase.from("ingredients").select("id,name,unit").is("deleted_at", null).order("name")).data ?? [];
      }
      return (await supabase.from("products").select("id,name,unit").is("deleted_at", null).order("name")).data ?? [];
    },
  });

  const submit = async () => {
    if (!myLoc) return toast.error("You have no location role");
    const valid = lines.filter((l) => l.item_id && l.quantity > 0);
    if (!valid.length) return toast.error("Add items");
    setSaving(true);
    const { data: req, error } = await supabase.from("requests").insert({
      from_location: fromLoc, to_location: myLoc, item_type: itemType,
      requested_by: user!.id, notes, status: "pending",
    }).select().single();
    if (error || !req) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    await supabase.from("request_items").insert(valid.map((l) => ({ request_id: req.id, item_id: l.item_id, quantity: l.quantity })));
    await supabase.from("notifications").insert({
      target_role: fromLoc === "central_store" ? "central_store" : "central_bakery",
      title: "New request received", message: `Request ${req.request_number} from ${LOCATION_LABELS[myLoc]}`, link: `/requests/${req.id}`,
    });
    setSaving(false);
    toast.success("Request created");
    navigate({ to: "/requests/$id", params: { id: req.id } });
  };

  const availableFroms: LocationType[] = itemType === "ingredient" ? ["central_store"] : ["central_bakery"];

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold">New Request</h1><p className="text-sm text-muted-foreground">Order raw ingredients or finished products for {myLoc ? LOCATION_LABELS[myLoc] : "your location"}.</p></div>
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Item Type</Label>
              <Select value={itemType} onValueChange={(v) => { setItemType(v as ItemType); setFromLoc(v === "ingredient" ? "central_store" : "central_bakery"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isBakery || isBranch) && <SelectItem value="ingredient">Raw Ingredients (from Central Store)</SelectItem>}
                  {isBranch && <SelectItem value="product">Finished Products (from Central Bakery)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Select value={fromLoc} onValueChange={(v) => setFromLoc(v as LocationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableFroms.map((l) => <SelectItem key={l} value={l}>{LOCATION_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Items</Label><Button size="sm" variant="outline" onClick={() => setLines([...lines, { item_id: "", quantity: 0 }])}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.item_id} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, item_id: v } : x))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{(items ?? []).map((it) => <SelectItem key={it.id} value={it.id}>{it.name} ({it.unit})</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
