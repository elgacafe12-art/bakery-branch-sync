import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LOCATION_LABELS, roleToLocation } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/damage")({
  component: DamagePage,
  head: () => ({ meta: [{ title: "Damage Log — ELGA Café" }] }),
});

function DamagePage() {
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const myLoc = roles.map(roleToLocation).find(Boolean) ?? null;

  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState<string>(myLoc ?? "central_store");
  const [itemType, setItemType] = useState<"ingredient" | "product">("ingredient");
  const [itemId, setItemId] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");

  const { data: items } = useQuery({
    queryKey: ["damage-items", itemType],
    queryFn: async () => {
      const table = itemType === "ingredient" ? "ingredients" : "products";
      const { data } = await supabase.from(table).select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["damage-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("damage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!reason.trim()) throw new Error("Reason is required");
      const { error } = await supabase.from("damage_logs").insert({
        reporter_id: user.id,
        location: location as any,
        item_type: itemId ? (itemType as any) : null,
        item_id: itemId || null,
        quantity: quantity ? Number(quantity) : null,
        reason: reason.trim(),
        photo_url: photoUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Damage report submitted");
      setReason(""); setQuantity(""); setItemId(""); setPhotoUrl("");
      qc.invalidateQueries({ queryKey: ["damage-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolve = async (id: string, resolved: boolean) => {
    const { error } = await supabase.from("damage_logs").update({ resolved }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["damage-logs"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-warning-foreground" /> Damage & Issues</h1>
        <p className="text-sm text-muted-foreground">Report damaged, missing, or spoiled items.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Report</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LOCATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select value={itemType} onValueChange={(v) => { setItemType(v as any); setItemId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ingredient">Ingredient</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item (optional)</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Select item…" /></SelectTrigger>
              <SelectContent>
                {(items ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity (optional)</Label>
            <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 3" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Reason / description</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened? Broken during delivery, spoiled, missing…" rows={3} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Photo URL (optional)</Label>
            <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Submit report</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Reports</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Location</TableHead><TableHead>Reason</TableHead>
              <TableHead>Qty</TableHead><TableHead>Status</TableHead>{isAdmin && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(logs ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell>{LOCATION_LABELS[l.location as keyof typeof LOCATION_LABELS]}</TableCell>
                  <TableCell className="max-w-md truncate">{l.reason}</TableCell>
                  <TableCell>{l.quantity ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={l.resolved ? "bg-success/20 text-success-foreground" : "bg-warning/20"}>
                      {l.resolved ? "Resolved" : "Open"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => resolve(l.id, !l.resolved)}>
                        {l.resolved ? "Reopen" : "Resolve"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(logs ?? []).length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">No damage reports</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
