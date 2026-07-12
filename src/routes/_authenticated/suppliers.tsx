import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Wheat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Suppliers — ELGA Café" }] }),
});

type FormState = {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  supplies_raw_ingredients: boolean;
};

const EMPTY: FormState = {
  name: "",
  contact_person: "",
  phone: "",
  address: "",
  supplies_raw_ingredients: true,
};

function SuppliersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawOnly, setRawOnly] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data } = useQuery({
    queryKey: ["suppliers", rawOnly],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").is("deleted_at", null).order("name");
      if (rawOnly) q = q.eq("supplies_raw_ingredients" as any, true);
      const { data } = await q;
      return data ?? [];
    },
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const payload: any = {
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      address: form.address || null,
      supplies_raw_ingredients: form.supplies_raw_ingredients,
    };
    const { error } = await supabase.from("suppliers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Supplier added");
    setOpen(false);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    const { error } = await supabase.from("suppliers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const toggleRaw = async (id: string, value: boolean) => {
    const { error } = await supabase.from("suppliers").update({ supplies_raw_ingredients: value } as any).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers and tag who delivers raw ingredients.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="raw-only" checked={rawOnly} onCheckedChange={setRawOnly} />
            <Label htmlFor="raw-only" className="text-sm">Raw ingredients only</Label>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact person</Label>
                  <Input id="contact_person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="raw" className="font-medium">Supplies raw ingredients</Label>
                    <p className="text-xs text-muted-foreground">Show this supplier when receiving raw stock.</p>
                  </div>
                  <Switch id="raw" checked={form.supplies_raw_ingredients} onCheckedChange={(v) => setForm({ ...form, supplies_raw_ingredients: v })} />
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>All Suppliers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Raw ingredients</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_person || "—"}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!s.supplies_raw_ingredients} onCheckedChange={(v) => toggleRaw(s.id, v)} />
                      {s.supplies_raw_ingredients && (
                        <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
                          <Wheat className="h-3 w-3" /> Raw
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No suppliers yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
