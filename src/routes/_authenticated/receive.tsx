import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/receive")({
  component: ReceivePage,
  head: () => ({ meta: [{ title: "Receive from Supplier — ELGA Café" }] }),
});

interface Line { ingredient_id: string; quantity: number; unit_price: number; expiry_date: string; notes: string }
const EMPTY_LINE: Line = { ingredient_id: "", quantity: 0, unit_price: 0, expiry_date: "", notes: "" };

function ReceivePage() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  const { data: suppliers } = useQuery({ queryKey: ["sup"], queryFn: async () => (await supabase.from("suppliers").select("id,name").is("deleted_at", null).order("name")).data ?? [] });
  const { data: ingredients } = useQuery({ queryKey: ["ing"], queryFn: async () => (await supabase.from("ingredients").select("id,name,unit").is("deleted_at", null).order("name")).data ?? [] });
  const { data: recent } = useQuery({
    queryKey: ["recent-sd"],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_deliveries").select("*, suppliers(name), supplier_delivery_items(quantity, ingredients(name,unit))").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const total = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);

  const submit = async () => {
    if (!supplierId) return toast.error("Select supplier");
    const valid = lines.filter((l) => l.ingredient_id && l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one ingredient");
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { data: del, error } = await supabase.from("supplier_deliveries").insert({
      supplier_id: supplierId, invoice_number: invoice || null, delivery_date: date, notes, total_amount: total, received_by: user?.id,
    }).select().single();
    if (error || !del) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const items = valid.map((l) => ({ delivery_id: del.id, ingredient_id: l.ingredient_id, quantity: l.quantity, unit_price: l.unit_price, expiry_date: l.expiry_date || null, notes: l.notes || null }));
    await supabase.from("supplier_delivery_items").insert(items);

    // Movements → central_store IN
    const movements = valid.map((l) => ({
      location: "central_store" as const, item_type: "ingredient" as const, item_id: l.ingredient_id,
      quantity: l.quantity, movement: "supplier_in" as const, reference_type: "supplier_delivery", reference_id: del.id,
      notes: `Invoice ${invoice}`, performed_by: user?.id,
    }));
    await supabase.from("inventory_movements").insert(movements);

    await supabase.from("notifications").insert({
      target_role: "admin", title: "New supplier delivery", message: `${valid.length} item(s) received from supplier.`, link: "/movements",
    });

    setSaving(false);
    toast.success("Received and inventory updated");
    setLines([{ ...EMPTY_LINE }]); setInvoice(""); setNotes(""); setSupplierId("");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Receive from Supplier</h1><p className="text-sm text-muted-foreground">Record raw ingredient deliveries into the central store.</p></div>
      <Card>
        <CardHeader><CardTitle>New Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                <SelectContent>{(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Invoice #</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
            <div><Label>Delivery date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Items</Label><Button size="sm" variant="outline" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}><Plus className="h-4 w-4 mr-1" />Add line</Button></div>
            <div className="border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Expiry</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={l.ingredient_id} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, ingredient_id: v } : x))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{(ingredients ?? []).map((ing) => <SelectItem key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell><Input type="date" value={l.expiry_date} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, expiry_date: e.target.value } : x))} /></TableCell>
                      <TableCell className="font-mono">{(l.quantity * l.unit_price).toFixed(2)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Total: {total.toFixed(2)}</div>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Receive Delivery"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Deliveries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Invoice</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.delivery_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.suppliers?.name}</TableCell>
                  <TableCell>{r.invoice_number ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.supplier_delivery_items?.map((i: any) => `${i.ingredients?.name} (${i.quantity})`).join(", ")}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.total_amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
