import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { roleToLocation, LOCATION_LABELS, type LocationType } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/usage")({
  component: UsagePage,
  head: () => ({ meta: [{ title: "Raw Material Usage — ELGA Café" }] }),
});

function UsagePage() {
  const qc = useQueryClient();
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const branchLoc: LocationType | null = useMemo(() => {
    if (roles.includes("branch_1")) return "branch_1";
    if (roles.includes("branch_2")) return "branch_2";
    return null;
  }, [roles]);

  const [location, setLocation] = useState<LocationType>(branchLoc ?? "branch_1");
  const [itemId, setItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [usedAt, setUsedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>("");

  const effectiveLocation: LocationType = branchLoc ?? location;

  const { data: stock } = useQuery({
    queryKey: ["usage-stock", effectiveLocation],
    enabled: !!effectiveLocation,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory")
        .select("item_id, quantity, ingredients(id,name,unit,min_stock)")
        .eq("location", effectiveLocation)
        .eq("item_type", "ingredient");
      return (data ?? []).filter((r: any) => r.ingredients);
    },
  });

  const { data: history } = useQuery({
    queryKey: ["usage-history", effectiveLocation],
    enabled: !!effectiveLocation,
    queryFn: async () => {
      const { data: movs } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("location", effectiveLocation)
        .eq("movement", "usage" as any)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = Array.from(new Set((movs ?? []).map((m) => m.item_id)));
      const users = Array.from(new Set((movs ?? []).map((m) => m.performed_by).filter(Boolean))) as string[];
      const [ings, profs] = await Promise.all([
        ids.length ? supabase.from("ingredients").select("id,name,unit").in("id", ids) : Promise.resolve({ data: [] as any[] }),
        users.length ? supabase.from("profiles").select("id,full_name").in("id", users) : Promise.resolve({ data: [] as any[] }),
      ]);
      const im = new Map((ings.data ?? []).map((i: any) => [i.id, i]));
      const um = new Map((profs.data ?? []).map((p: any) => [p.id, p]));
      return (movs ?? []).map((m: any) => ({ ...m, item: im.get(m.item_id), user: um.get(m.performed_by ?? "") }));
    },
  });

  const selected = (stock ?? []).find((r: any) => r.item_id === itemId) as any | undefined;
  const available = selected ? Number(selected.quantity) : 0;
  const requested = Number(quantity) || 0;
  const insufficient = !!selected && requested > 0 && requested > available;

  const record = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!itemId) throw new Error("Select a raw material");
      if (!(requested > 0)) throw new Error("Enter a valid quantity");
      if (insufficient) throw new Error(`Insufficient stock: available ${available}`);
      const notesCombined = [
        `Used on ${usedAt}`,
        note.trim() ? note.trim() : null,
      ].filter(Boolean).join(" — ");
      const { error } = await supabase.from("inventory_movements").insert({
        location: effectiveLocation,
        item_type: "ingredient" as any,
        item_id: itemId,
        quantity: -Math.abs(requested),
        movement: "usage" as any,
        reference_type: "branch_usage",
        notes: notesCombined,
        performed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usage recorded and stock updated");
      setItemId(""); setQuantity(""); setNote("");
      qc.invalidateQueries();
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.toLowerCase().includes("insufficient")) {
        toast.error("Insufficient Stock — cannot record usage");
      } else {
        toast.error(msg || "Failed to record usage");
      }
    },
  });

  if (loading) return null;
  if (!branchLoc && !isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" /> Raw Material Usage
        </h1>
        <p className="text-sm text-muted-foreground">
          Record raw materials used to prepare menu items. Stock is deducted automatically.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Record Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {isAdmin && !branchLoc && (
            <div className="space-y-2 md:col-span-2">
              <Label>Branch</Label>
              <Select value={location} onValueChange={(v) => { setLocation(v as LocationType); setItemId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch_1">{LOCATION_LABELS.branch_1}</SelectItem>
                  <SelectItem value="branch_2">{LOCATION_LABELS.branch_2}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>Raw Material</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Select raw material…" /></SelectTrigger>
              <SelectContent>
                {(stock ?? []).map((r: any) => (
                  <SelectItem key={r.item_id} value={r.item_id}>
                    {r.ingredients.name} — {Number(r.quantity).toFixed(2)} {r.ingredients.unit} in stock
                  </SelectItem>
                ))}
                {(stock ?? []).length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No raw materials in stock</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity Used {selected ? `(${selected.ingredients.unit})` : ""}</Label>
            <Input
              type="number" inputMode="decimal" min="0" step="0.01"
              value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
            />
            {selected && (
              <p className="text-xs text-muted-foreground">
                Available: {available.toFixed(2)} {selected.ingredients.unit}
              </p>
            )}
            {insufficient && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Insufficient Stock
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={usedAt} onChange={(e) => setUsedAt(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Note / Reason (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Used for pizza, burgers, coffee…" />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => record.mutate()} disabled={record.isPending || insufficient || !itemId || !(requested > 0)}>
              {record.isPending ? "Recording…" : "Record Usage"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Usage</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Raw Material</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{format(new Date(m.created_at), "PP p")}</TableCell>
                  <TableCell className="font-medium">{m.item?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/40">
                      {Number(m.quantity).toFixed(2)} {m.item?.unit ?? ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.user?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.notes ?? ""}</TableCell>
                </TableRow>
              ))}
              {(history ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No usage recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
