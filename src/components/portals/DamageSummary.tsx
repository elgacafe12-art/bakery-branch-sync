import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { LOCATION_LABELS, type LocationType } from "@/lib/roles";

type Row = { location: string; item_type: string | null; quantity: number | null; created_at: string };

function startOf(period: "day" | "week" | "month") {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - day);
  } else if (period === "month") {
    d.setDate(1);
  }
  return d;
}

export function DamageSummary({
  location,
  title = "Damage Summary",
  showBreakdown = true,
  showValue = false,
  locations,
}: {
  location?: LocationType;
  title?: string;
  showBreakdown?: boolean;
  showValue?: boolean;
  locations?: LocationType[]; // admin: show all + breakdown by location
}) {
  const monthStart = startOf("month").toISOString();

  const { data } = useQuery({
    queryKey: ["damage-summary", location ?? "all", locations?.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("damage_logs")
        .select("location,item_type,quantity,created_at")
        .gte("created_at", monthStart);
      if (location) q = q.eq("location", location);
      const { data } = await q;
      return (data ?? []) as Row[];
    },
  });

  const rows = data ?? [];
  const dayStart = startOf("day").getTime();
  const weekStart = startOf("week").getTime();

  const sum = (filter: (r: Row) => boolean) =>
    rows.filter(filter).reduce((n, r) => n + Number(r.quantity ?? 0), 0);

  const today = sum((r) => new Date(r.created_at).getTime() >= dayStart);
  const week = sum((r) => new Date(r.created_at).getTime() >= weekStart);
  const month = sum(() => true);
  const rawMaterial = sum((r) => r.item_type === "ingredient");
  const finished = sum((r) => r.item_type === "product");
  const totalItems = rows.filter((r) => Number(r.quantity ?? 0) > 0).length;

  const byLocation = locations
    ? locations.map((loc) => ({
        loc,
        qty: rows.filter((r) => r.location === loc).reduce((n, r) => n + Number(r.quantity ?? 0), 0),
      }))
    : [];

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Today" value={today} />
          <Stat label="This Week" value={week} />
          <Stat label="This Month" value={month} />
        </div>
        {showBreakdown && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <Stat label="Raw Material" value={rawMaterial} tone="muted" />
            <Stat label="Finished Product" value={finished} tone="muted" />
          </div>
        )}
        {showValue && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <Stat label="Total Damaged Items" value={totalItems} tone="muted" />
            <Stat label="Damage Value" value="—" tone="muted" />
          </div>
        )}
        {locations && byLocation.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            <div className="text-xs font-medium text-muted-foreground mb-2">Breakdown by location (this month)</div>
            {byLocation.map((b) => (
              <div key={b.loc} className="flex items-center justify-between text-sm">
                <span>{LOCATION_LABELS[b.loc]}</span>
                <span className="font-semibold">{b.qty}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "muted" }) {
  return (
    <div>
      <div className={`text-xl font-bold ${tone === "muted" ? "text-foreground" : "text-destructive"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
