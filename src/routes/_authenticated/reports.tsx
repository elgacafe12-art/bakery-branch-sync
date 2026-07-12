import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { LOCATION_LABELS, type LocationType } from "@/lib/roles";
import { DateRangeFilter, type DateFilterValue } from "@/components/DateRangeFilter";
import { exportToCsv, exportToExcel, exportToPdf, printTable } from "@/lib/export-utils";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — ELGA Café" }] }),
});

type Bucket = "day" | "week" | "month" | "year";

function bucketKey(d: Date, b: Bucket): string {
  switch (b) {
    case "day": return format(startOfDay(d), "yyyy-MM-dd");
    case "week": return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II");
    case "month": return format(startOfMonth(d), "MMM yyyy");
    case "year": return format(startOfYear(d), "yyyy");
  }
}

function ReportsPage() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: "this_month", from: null, to: null });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"inventory" | "movements" | "production">("inventory");
  const [bucket, setBucket] = useState<Bucket>("day");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: inv } = useQuery({
    queryKey: ["report-inv"],
    queryFn: async () => {
      const [ings, prods] = await Promise.all([
        supabase.from("inventory").select("location,quantity, ingredients(name,unit,min_stock)").eq("item_type", "ingredient"),
        supabase.from("inventory").select("location,quantity, products(name,unit,min_stock)").eq("item_type", "product"),
      ]);
      return { ings: ings.data ?? [], prods: prods.data ?? [] };
    },
  });

  const { data: movs } = useQuery({
    queryKey: ["report-movs", dateFilter.from?.toISOString(), dateFilter.to?.toISOString()],
    queryFn: async () => {
      let q = supabase.from("inventory_movements").select("*").limit(5000);
      if (dateFilter.from) q = q.gte("created_at", dateFilter.from.toISOString());
      if (dateFilter.to) q = q.lte("created_at", dateFilter.to.toISOString());
      const { data } = await q;
      const ingIds = new Set<string>(), prodIds = new Set<string>();
      (data ?? []).forEach((m) => (m.item_type === "ingredient" ? ingIds : prodIds).add(m.item_id));
      const [ings, prods] = await Promise.all([
        ingIds.size ? supabase.from("ingredients").select("id,name,unit").in("id", Array.from(ingIds)) : Promise.resolve({ data: [] as any[] }),
        prodIds.size ? supabase.from("products").select("id,name,unit").in("id", Array.from(prodIds)) : Promise.resolve({ data: [] as any[] }),
      ]);
      const im = new Map((ings.data ?? []).map((i) => [i.id, i]));
      const pm = new Map((prods.data ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((m) => ({ ...m, item: m.item_type === "ingredient" ? im.get(m.item_id) : pm.get(m.item_id) }));
    },
  });

  const { data: prodStats } = useQuery({
    queryKey: ["report-prod", dateFilter.from?.toISOString(), dateFilter.to?.toISOString()],
    queryFn: async () => {
      let q = supabase.from("productions").select("quantity_produced, created_at, products(name,unit)");
      if (dateFilter.from) q = q.gte("created_at", dateFilter.from.toISOString());
      if (dateFilter.to) q = q.lte("created_at", dateFilter.to.toISOString());
      const { data } = await q;
      return data ?? [];
    },
  });

  // Inventory snapshot rows
  const invRows = useMemo(() => {
    const rows: { location: string; item: string; type: string; qty: number; unit: string; min: number }[] = [];
    (inv?.ings ?? []).forEach((r: any) => r.ingredients && rows.push({
      location: LOCATION_LABELS[r.location as LocationType], item: r.ingredients.name, type: "Ingredient",
      qty: Number(r.quantity), unit: r.ingredients.unit, min: Number(r.ingredients.min_stock),
    }));
    (inv?.prods ?? []).forEach((r: any) => r.products && rows.push({
      location: LOCATION_LABELS[r.location as LocationType], item: r.products.name, type: "Product",
      qty: Number(r.quantity), unit: r.products.unit, min: Number(r.products.min_stock),
    }));
    const s = search.trim().toLowerCase();
    return s ? rows.filter((r) => r.item.toLowerCase().includes(s) || r.location.toLowerCase().includes(s)) : rows;
  }, [inv, search]);

  // Movement aggregation by bucket
  const movAgg = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = (movs ?? []).filter((m: any) => !s || (m.item?.name ?? "").toLowerCase().includes(s));
    const map = new Map<string, { period: string; count: number; inQty: number; outQty: number }>();
    filtered.forEach((m: any) => {
      const key = bucketKey(new Date(m.created_at), bucket);
      const cur = map.get(key) ?? { period: key, count: 0, inQty: 0, outQty: 0 };
      cur.count += 1;
      const q = Number(m.quantity);
      if (q >= 0) cur.inQty += q; else cur.outQty += Math.abs(q);
      map.set(key, cur);
    });
    const arr = Array.from(map.values());
    arr.sort((a, b) => sortAsc ? a.period.localeCompare(b.period) : b.period.localeCompare(a.period));
    return arr;
  }, [movs, bucket, sortAsc, search]);

  const prodAgg = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = (prodStats ?? []).filter((p: any) => !s || (p.products?.name ?? "").toLowerCase().includes(s));
    const map = new Map<string, number>();
    filtered.forEach((p: any) => {
      const key = `${bucketKey(new Date(p.created_at), bucket)} · ${p.products?.name ?? "—"}`;
      map.set(key, (map.get(key) ?? 0) + Number(p.quantity_produced));
    });
    const arr = Array.from(map.entries()).map(([k, v]) => ({ label: k, qty: v }));
    arr.sort((a, b) => sortAsc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label));
    return arr;
  }, [prodStats, bucket, sortAsc, search]);

  const { headers, rows, title } = useMemo(() => {
    if (tab === "inventory") return {
      headers: ["Location", "Item", "Type", "Quantity", "Unit", "Min Stock"],
      rows: invRows.map((r) => [r.location, r.item, r.type, r.qty.toFixed(2), r.unit, r.min]),
      title: "Inventory Snapshot",
    };
    if (tab === "movements") return {
      headers: ["Period", "Movements", "Qty In", "Qty Out", "Net"],
      rows: movAgg.map((r) => [r.period, r.count, r.inQty.toFixed(2), r.outQty.toFixed(2), (r.inQty - r.outQty).toFixed(2)]),
      title: "Movements Report",
    };
    return {
      headers: ["Period · Product", "Total Produced"],
      rows: prodAgg.map((r) => [r.label, r.qty.toFixed(2)]),
      title: "Production Report",
    };
  }, [tab, invRows, movAgg, prodAgg]);

  const fname = `${tab}-report-${format(new Date(), "yyyy-MM-dd")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Historical operational data with calendar filtering.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => exportToCsv(fname, headers, rows)}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(fname, title, headers, rows)}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPdf(fname, title, headers, rows)}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
          <Button size="sm" variant="outline" onClick={() => printTable(title, headers, rows)}><Printer className="h-4 w-4 mr-1.5" />Print</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
          {tab !== "inventory" && (
            <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
              <TabsList>
                <TabsTrigger value="day">Daily</TabsTrigger>
                <TabsTrigger value="week">Weekly</TabsTrigger>
                <TabsTrigger value="month">Monthly</TabsTrigger>
                <TabsTrigger value="year">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSortAsc((v) => !v)}>Sort: {sortAsc ? "Oldest first" : "Newest first"}</Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="inventory">Inventory Snapshot</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card><CardHeader><CardTitle>Current Inventory</CardTitle></CardHeader><CardContent className="p-0">
            <ReportTable headers={headers} rows={rows} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card><CardHeader><CardTitle>Movements — {bucketLabel(bucket)}</CardTitle></CardHeader><CardContent className="p-0">
            <ReportTable headers={headers} rows={rows} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="production">
          <Card><CardHeader><CardTitle>Production — {bucketLabel(bucket)}</CardTitle></CardHeader><CardContent className="p-0">
            <ReportTable headers={headers} rows={rows} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function bucketLabel(b: Bucket) {
  return b === "day" ? "Daily" : b === "week" ? "Weekly" : b === "month" ? "Monthly" : "Yearly";
}

const PAGE = 25;

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const paged = rows.slice((page - 1) * PAGE, page * PAGE);
  return (
    <>
      <Table>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {paged.map((r, i) => (
            <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 0 ? "font-medium" : ""}>{String(c)}</TableCell>)}</TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>}
        </TableBody>
      </Table>
      {rows.length > PAGE && (
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <div className="text-sm px-2 py-1">Page {page} / {totalPages}</div>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
