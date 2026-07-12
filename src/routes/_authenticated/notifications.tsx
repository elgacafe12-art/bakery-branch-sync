import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, CheckCheck, Trash2, Search, Volume2, VolumeX, BellRing, BellOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNotificationsCtx } from "@/hooks/useNotifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — ELGA Café" }] }),
});

const TYPE_LABELS: Record<string, string> = {
  supplier_delivery: "Supplier delivery",
  stock_received: "Stock received",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
  adjustment: "Adjustment",
  damage: "Damage",
  damage_reported: "Damage reported",
  production: "Production",
  request_new: "New request",
  request_approved: "Request approved",
  request_rejected: "Request rejected",
  delivery_assigned: "Delivery assigned",
  delivery_completed: "Delivery completed",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  reminder_pending: "Pending reminder",
  reminder_delayed: "Delayed delivery",
  reminder_low_stock: "Low stock reminder",
  info: "Info",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  normal: "bg-primary/10 text-primary border-primary/30",
  reminder: "bg-warning/15 text-warning-foreground border-warning/30",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [search, setSearch] = useState("");
  const notifCtx = useNotificationsCtx();

  const { data } = useQuery({
    queryKey: ["notifs-all"],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((n) => {
      if (filterRead === "unread" && n.read) return false;
      if (filterRead === "read" && !n.read) return false;
      if (filterType !== "all" && n.type !== filterType) return false;
      if (filterDate && !n.created_at.startsWith(filterDate)) return false;
      if (q && !(`${n.title} ${n.message}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, filterRead, filterType, filterDate, search]);

  const types = useMemo(() => Array.from(new Set((data ?? []).map((n) => n.type))).sort(), [data]);

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    toast.success("All marked read");
    qc.invalidateQueries();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries();
  };

  const deleteOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries();
  };

  const clearRead = async () => {
    await supabase.from("notifications").delete().eq("read", true);
    toast.success("Cleared read notifications");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Real-time alerts across all locations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
          </Button>
          <Button variant="outline" onClick={clearRead}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear read
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            {notifCtx.settings.sound_enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <Label className="flex-1">Sound</Label>
            <Switch
              checked={notifCtx.settings.sound_enabled}
              onCheckedChange={(v) => notifCtx.setSettings({ sound_enabled: v })}
            />
          </div>
          <div className="flex items-center gap-2">
            {notifCtx.permission === "granted" ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <Label className="flex-1">Browser alerts</Label>
            <Button
              size="sm"
              variant={notifCtx.permission === "granted" ? "outline" : "default"}
              onClick={notifCtx.requestPermission}
              disabled={notifCtx.permission === "granted"}
            >
              {notifCtx.permission === "granted" ? "Enabled" : notifCtx.permission === "denied" ? "Blocked" : "Enable"}
            </Button>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Bell className="h-4 w-4" />
            <Label className="flex-1">
              Push notifications {!notifCtx.pushSupported && <span className="text-xs text-muted-foreground">(unsupported)</span>}
            </Label>
            {notifCtx.pushSubscribed ? (
              <Button size="sm" variant="outline" onClick={notifCtx.disablePush}>Disable</Button>
            ) : (
              <Button size="sm" onClick={notifCtx.enablePush} disabled={!notifCtx.pushSupported}>Enable</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterRead} onValueChange={(v) => setFilterRead(v as "all" | "unread" | "read")}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="w-[170px]" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No notifications
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 border-b last:border-0 hover:bg-muted/50 ${!n.read ? "bg-accent/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 cursor-pointer" onClick={() => markOne(n.id)}>
                  <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <span>{n.title}</span>
                    <Badge variant="outline" className={PRIORITY_COLORS[n.priority] ?? ""}>
                      {n.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                    {n.location && <Badge variant="outline" className="text-xs">{n.location}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{n.message}</div>
                  {n.link && (
                    <Link to={n.link} className="text-xs text-primary hover:underline mt-1 inline-block">
                      Open →
                    </Link>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), "MMM d, HH:mm")}</div>
                  <Button size="icon" variant="ghost" onClick={() => deleteOne(n.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
