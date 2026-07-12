import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ingredients")({
  component: IngredientsPage,
  head: () => ({ meta: [{ title: "Ingredients — ELGA Café" }] }),
});

type Form = { id?: string; name: string; unit: string; category: string; min_stock: number; can_go_to_branch: boolean };
const EMPTY: Form = { name: "", unit: "kg", category: "", min_stock: 0, can_go_to_branch: false };

function IngredientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data } = await supabase.from("ingredients").select("*").is("deleted_at", null).order("name");
      return data ?? [];
    },
  });

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const payload = { name: form.name, unit: form.unit, category: form.category || null, min_stock: form.min_stock, can_go_to_branch: form.can_go_to_branch };
    const { error } = form.id
      ? await supabase.from("ingredients").update(payload).eq("id", form.id)
      : await supabase.from("ingredients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const edit = (i: any) => { setForm({ ...i }); setOpen(true); };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("ingredients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingredients</h1>
          <p className="text-sm text-muted-foreground">Raw materials tracked in the system.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Ingredient</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Ingredient</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              </div>
              <div><Label>Minimum Stock Level</Label><Input type="number" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2">
                <Checkbox id="cgb" checked={form.can_go_to_branch} onCheckedChange={(v) => setForm({ ...form, can_go_to_branch: !!v })} />
                <Label htmlFor="cgb" className="cursor-pointer">Can be delivered directly to branches (no bakery production needed)</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead>Category</TableHead><TableHead>Min Stock</TableHead><TableHead>Direct to Branch</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{i.unit}</TableCell>
                  <TableCell>{i.category ?? "—"}</TableCell>
                  <TableCell>{i.min_stock}</TableCell>
                  <TableCell>{i.can_go_to_branch ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => edit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
