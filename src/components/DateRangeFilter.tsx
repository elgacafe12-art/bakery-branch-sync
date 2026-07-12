import { useState } from "react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, format,
} from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DatePreset =
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "this_year" | "all" | "custom";

export interface DateFilterValue {
  preset: DatePreset;
  from: Date | null;
  to: Date | null;
}

export function computePresetRange(preset: DatePreset, now = new Date()): { from: Date | null; to: Date | null } {
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "this_week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": { const w = subWeeks(now, 1); return { from: startOfWeek(w, { weekStartsOn: 1 }), to: endOfWeek(w, { weekStartsOn: 1 }) }; }
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": { const m = subMonths(now, 1); return { from: startOfMonth(m), to: endOfMonth(m) }; }
    case "this_year": return { from: startOfYear(now), to: endOfYear(now) };
    default: return { from: null, to: null };
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today", yesterday: "Yesterday",
  this_week: "This Week", last_week: "Last Week",
  this_month: "This Month", last_month: "Last Month",
  this_year: "This Year", all: "All Time", custom: "Custom Range",
};

interface Props {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
}

export function DateRangeFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    value.from ? { from: value.from, to: value.to ?? undefined } : undefined
  );

  const handlePreset = (p: DatePreset) => {
    if (p === "custom") { setOpen(true); return; }
    const r = computePresetRange(p);
    onChange({ preset: p, from: r.from, to: r.to });
  };

  const applyCustom = () => {
    if (range?.from) {
      onChange({ preset: "custom", from: startOfDay(range.from), to: endOfDay(range.to ?? range.from) });
      setOpen(false);
    }
  };

  const label = value.preset === "custom" && value.from
    ? `${format(value.from, "MMM d, yyyy")} – ${format(value.to ?? value.from, "MMM d, yyyy")}`
    : PRESET_LABELS[value.preset];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={value.preset} onValueChange={(v) => handlePreset(v as DatePreset)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
            <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start text-left font-normal min-w-[220px]", !value.from && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} />
          <div className="flex justify-end gap-2 p-3 border-t">
            <Button size="sm" variant="ghost" onClick={() => { setRange(undefined); onChange({ preset: "all", from: null, to: null }); setOpen(false); }}>Clear</Button>
            <Button size="sm" onClick={applyCustom} disabled={!range?.from}>Apply</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function classifyDate(d: Date, now = new Date()): string {
  const day = startOfDay(d).getTime();
  const today = startOfDay(now).getTime();
  const yesterday = startOfDay(subDays(now, 1)).getTime();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  if (day >= weekStart) return "This Week";
  if (day >= monthStart) return "This Month";
  if (day >= yearStart) return format(d, "MMMM yyyy");
  return format(d, "yyyy");
}
