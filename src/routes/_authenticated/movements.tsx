import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATION_LABELS, type LocationType } from "@/lib/roles";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { DateRangeFilter, classifyDate, type DateFilterValue } from "@/components/DateRangeFilter";
import { exportToCsv, exportToExcel, exportToPdf, printTable } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/movements")({
  component: MovementsPage,
  head: () => ({ meta: [{ title: "Inventory Movements — ELGA Café" }] }),
});

const MOVEMENT_LABEL: Record<string, string> = {
  supplier_in: "Supplier IN",
  delivery_out: "Delivery OUT",
  delivery_in: "Delivery IN",
  production_in: "Production IN",
  production_out: "Production OUT",
  damage: "Damage",
  adjustment: "Adjustment",
  usage: "Usage",
};

const MOVEMENT_TONE: Record<string, string> = {
  supplier_in: "bg-success/15 text-success-foreground border-success/40",
  delivery_in: "bg-primary/15 text-primary border-primary/30",
  delivery_out: "bg-warning/20 text-warning-foreground border-warning/40",
  production_in: "bg-success/15 text-success-foreground border-success/40",
  production_out: "bg-warning/20 text-warning-foreground border-warning/40",
  damage: "bg-destructive/15 text-destructive border-destructive/30",
  adjustment: "bg-muted text-muted-foreground border-border",
  usage: "bg-warning/15 text-warning-foreground border-warning/40",
};

function MovementsPage() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: "this_month", from: null, to: null });
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["movements", dateFilter.from?.toISOString(), dateFilter.to?.toISOString(), locationFilter, typeFilter],
    queryFn: async () => {
      let q = supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(2000);
      if (dateFilter.from) q = q.gte("created_at", dateFilter.from.toISOString());
      if (dateFilter.to) q = q.lte("created_at", dateFilter.to.toISOString());
      if (locationFilter !== "all") q = q.eq("location", locationFilter as LocationType);
      if (typeFilter !== "all") q = q.eq("movement", typeFilter as any);
      const { data: movs } = await q;

      const ingIds = new Set<string>(), prodIds = new Set<string>(), userIds = new Set<string>();
      (movs ?? []).forEach((m) => {
        (m.item_type === "ingredient" ? ingIds : prodIds).add(m.item_id);
        if (m.performed_by) userIds.add(m.performed_by);
      });
      const [ings, prods, profs] = await Promise.all([
        ingIds.size ? supabase.from("ingredients").select("id,name,unit").in("id", Array.from(ingIds)) : Promise.resolve({ data: [] as any[] }),
        prodIds.size ? supabase.from("products").select("id,name,unit").in("id", Array.from(prodIds)) : Promise.resolve({ data: [] as any[] }),
        userIds.size ? supabase.from("profiles").select("id,full_name").in("id", Array.from(userIds)) : Promise.resolve({ data: [] as any[] }),
      ]);
      const im = new Map((ings.data ?? []).map((i) => [i.id, i]));
      const pm = new Map((prods.data ?? []).map((p) => [p.id, p]));
      const um = new Map((profs.data ?? []).map((p) => [p.id, p]));
      return (movs ?? []).map((m) => ({
        ...m,
        item: m.item_type === "ingredient" ? im.get(m.item_id) : pm.get(m.item_id),
        user: um.get(m.performed_by ?? ""),
      }));
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((m: any) =>
      (m.item?.name ?? "").toLowerCase().includes(s) ||
      (m.user?.full_name ?? "").toLowerCase().includes(s) ||
      (m.notes ?? "").toLowerCase().includes(s) ||
      MOVEMENT_LABEL[m.movement]?.toLowerCase().includes(s) ||
      LOCATION_LABELS[m.location as LocationType]?.toLowerCase().includes(s)
    );
  }, [data, search]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; date: Date; items: any[] }>();
    filtered.forEach((m: any) => {
      const d = new Date(m.created_at);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { label: classifyDate(d), date: d, items: [] });
      map.get(key)!.items.push(m);
    });
    // group by classification bucket
    const byBucket = new Map<string, { key: string; date: Date; items: any[] }[]>();
    Array.from(map.entries()).forEach(([key, v]) => {
      if (!byBucket.has(v.label)) byBucket.set(v.label, []);
      byBucket.get(v.label)!.push({ key, date: v.date, items: v.items });
    });
    return Array.from(byBucket.entries());
  }, [filtered]);

  const exportRows = useMemo(() => filtered.map((m: any) => [
    format(new Date(m.created_at), "yyyy-MM-dd"),
    format(new Date(m.created_at), "HH:mm"),
    MOVEMENT_LABEL[m.movement] ?? m.movement,
    LOCATION_LABELS[m.location as LocationType] ?? "",
    m.item?.name ?? "",
    Number(m.quantity).toFixed(2),
    m.item?.unit ?? "",
    m.user?.full_name ?? "",
    m.reference_type ?? "",
    m.notes ?? "",
  ]), [filtered]);

  const headers = ["Date", "Time", "Type", "Location", "Item", "Quantity", "Unit", "User", "Reference", "Notes"];
  const fname = `inventory-movements-${format(new Date(), "yyyy-MM-dd")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory Movements</h1>
          <p className="text-sm text-muted-foreground">Timeline of every stock change, grouped by day.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => exportToCsv(fname, headers, exportRows)}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(fname, "Movements", headers, exportRows)}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPdf(fname, "Inventory Movements", headers, exportRows)}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
          <Button size="sm" variant="outline" onClick={() => printTable("Inventory Movements", headers, exportRows)}><Printer className="h-4 w-4 mr-1.5" />Print</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {Object.entries(LOCATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(MOVEMENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, user, notes…" className="pl-9" />
          </div>
          <div className="text-sm text-muted-foreground ml-auto">{filtered.length} record{filtered.length === 1 ? "" : "s"}</div>
        </CardContent>
      </Card>

      {groups.length === 0 && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No movements in the selected range.</CardContent></Card>
      )}

      <div className="space-y-4">
        {groups.map(([bucket, days]) => (
          <BucketBlock key={bucket} bucket={bucket} days={days} />
        ))}
      </div>
    </div>
  );
}

function BucketBlock({ bucket, days }: { bucket: string; days: { key: string; date: Date; items: any[] }[] }) {
  const total = days.reduce((s, d) => s + d.items.length, 0);
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
          <h2 className="font-semibold">{bucket}</h2>
          <span className="text-xs text-muted-foreground">{total} movement{total === 1 ? "" : "s"} · {days.length} day{days.length === 1 ? "" : "s"}</span>
        </div>
        <div className="divide-y">
          {days.map((d) => <DayGroup key={d.key} date={d.date} items={d.items} defaultOpen={bucket === "Today" || bucket === "Yesterday"} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function DayGroup({ date, items, defaultOpen }: { date: Date; items: any[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{format(date, "EEEE, MMMM d, yyyy")}</span>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} movement{items.length === 1 ? "" : "s"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs font-mono">{format(new Date(m.created_at), "HH:mm")}</TableCell>
                <TableCell><Badge variant="outline" className={MOVEMENT_TONE[m.movement] ?? ""}>{MOVEMENT_LABEL[m.movement]}</Badge></TableCell>
                <TableCell className="text-sm">{LOCATION_LABELS[m.location as LocationType]}</TableCell>
                <TableCell className="font-medium text-sm">{m.item?.name ?? "—"}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${Number(m.quantity) < 0 ? "text-destructive" : "text-success-foreground"}`}>
                  {Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity).toFixed(2)} {m.item?.unit ?? ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.user?.full_name ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.reference_type ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{m.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
