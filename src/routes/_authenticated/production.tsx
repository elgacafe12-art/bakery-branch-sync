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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionPage,
  head: () => ({ meta: [{ title: "Production — ELGA Café" }] }),
});

function ProductionPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");
  const [used, setUsed] = useState<{ ingredient_id: string; quantity_used: number }[]>([{ ingredient_id: "", quantity_used: 0 }]);

  const { data: products } = useQuery({ queryKey: ["p"], queryFn: async () => (await supabase.from("products").select("id,name,unit").is("deleted_at", null).order("name")).data ?? [] });
  const { data: ingredients } = useQuery({ queryKey: ["i"], queryFn: async () => (await supabase.from("ingredients").select("id,name,unit").is("deleted_at", null).order("name")).data ?? [] });
  const { data: history } = useQuery({
    queryKey: ["prod-hist"],
    queryFn: async () => (await supabase.from("productions").select("*, products(name,unit), production_ingredients(quantity_used, ingredients(name,unit))").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const save = async () => {
    if (!productId || quantity <= 0) return toast.error("Product and quantity required");
    const validUsed = used.filter((u) => u.ingredient_id && u.quantity_used > 0);
    const { data: prod, error } = await supabase.from("productions").insert({ product_id: productId, quantity_produced: quantity, notes, produced_by: user?.id }).select().single();
    if (error || !prod) return toast.error(error?.message ?? "Failed");

    if (validUsed.length) {
      await supabase.from("production_ingredients").insert(validUsed.map((u) => ({ production_id: prod.id, ingredient_id: u.ingredient_id, quantity_used: u.quantity_used })));
      // Deduct ingredients from bakery
      await supabase.from("inventory_movements").insert(validUsed.map((u) => ({
        location: "central_bakery" as const, item_type: "ingredient" as const, item_id: u.ingredient_id,
        quantity: -u.quantity_used, movement: "production_out" as const, reference_type: "production", reference_id: prod.id, performed_by: user?.id,
      })));
    }
    // Add produced product to bakery
    await supabase.from("inventory_movements").insert({
      location: "central_bakery", item_type: "product", item_id: productId,
      quantity, movement: "production_in", reference_type: "production", reference_id: prod.id, performed_by: user?.id,
    });

    toast.success("Production recorded");
    setProductId(""); setQuantity(0); setNotes(""); setUsed([{ ingredient_id: "", quantity_used: 0 }]);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Bakery Production</h1><p className="text-sm text-muted-foreground">Record finished products and consume ingredients.</p></div>

      <Card>
        <CardHeader><CardTitle>Record Production</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity Produced</Label><Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Ingredients Used</Label><Button size="sm" variant="outline" onClick={() => setUsed([...used, { ingredient_id: "", quantity_used: 0 }])}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Quantity Used</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {used.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={u.ingredient_id} onValueChange={(v) => setUsed(used.map((x, j) => j === i ? { ...x, ingredient_id: v } : x))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{(ingredients ?? []).map((ing) => <SelectItem key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" step="0.01" value={u.quantity_used} onChange={(e) => setUsed(used.map((x, j) => j === i ? { ...x, quantity_used: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setUsed(used.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end"><Button onClick={save}>Record Production</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Production History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Ingredients Used</TableHead></TableRow></TableHeader>
            <TableBody>
              {(history ?? []).map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">{format(new Date(h.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="font-medium">{h.products?.name}</TableCell>
                  <TableCell>{h.quantity_produced} {h.products?.unit}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.production_ingredients?.map((pi: any) => `${pi.ingredients?.name} (${pi.quantity_used})`).join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
