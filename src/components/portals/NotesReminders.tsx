import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StickyNote, Plus, Check, Clock, AlertTriangle, Flame } from "lucide-react";
import { toast } from "sonner";

interface DashNote {
  id: string; title: string; priority: "low"|"medium"|"high";
  status: "pending"|"completed"; due_at: string|null; reminder_at: string|null;
  pinned: boolean; archived: boolean;
}

export function NotesReminders() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    const ch = supabase.channel("admin-notes-widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notes", filter: `owner_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["admin-notes-widget"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, roles, qc]);

  const { data: notes = [] } = useQuery({
    queryKey: ["admin-notes-widget"],
    enabled: !!user && roles.includes("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notes")
        .select("id,title,priority,status,due_at,reminder_at,pinned,archived")
        .eq("archived", false).eq("status", "pending")
        .order("pinned", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DashNote[];
    },
  });

  const add = useMutation({
    mutationFn: async (t: string) => {
      if (!user) return;
      const { error } = await supabase.from("admin_notes").insert({ owner_id: user.id, title: t });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added"); setTitle(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-notes-widget"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notes").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notes-widget"] }),
  });

  if (!roles.includes("admin")) return null;

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  const todaysReminders = notes.filter((n) => n.reminder_at && new Date(n.reminder_at) >= startOfDay && new Date(n.reminder_at) <= endOfDay);
  const overdue = notes.filter((n) => n.due_at && new Date(n.due_at) < now);
  const upcoming = notes.filter((n) => n.due_at && new Date(n.due_at) >= now).slice(0, 5);
  const highPriority = notes.filter((n) => n.priority === "high");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-5 w-5 text-primary" /> Notes & Reminders
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Quick add
          </Button>
          <Link to="/notes" className="text-sm text-primary hover:underline self-center">Open →</Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Today's reminders" value={todaysReminders.length} icon={Clock} tone="primary" />
          <Stat label="Upcoming tasks" value={upcoming.length} icon={Clock} tone="accent" />
          <Stat label="Overdue" value={overdue.length} icon={AlertTriangle} tone="destructive" />
          <Stat label="High priority" value={highPriority.length} icon={Flame} tone="warning" />
        </div>

        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No active notes. Add one to get started.</p>
        ) : (
          <div className="space-y-1.5">
            {[...overdue.slice(0, 3), ...upcoming.filter(u => !overdue.find(o => o.id === u.id)).slice(0, 5 - Math.min(3, overdue.length))]
              .slice(0, 5).map((n) => {
              const isOverdue = n.due_at && new Date(n.due_at) < now;
              return (
                <div key={n.id} className="flex items-center justify-between gap-2 p-2 rounded border text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 items-center">
                      {n.due_at && <span>{new Date(n.due_at).toLocaleString()}</span>}
                      {isOverdue && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 h-4 px-1">Overdue</Badge>}
                      {n.priority === "high" && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 h-4 px-1">High</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => complete.mutate(n.id)} title="Mark complete">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Quick add note</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Title…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add.mutate(title.trim()); }} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || add.isPending} onClick={() => add.mutate(title.trim())}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const cls: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  };
  return (
    <div className="rounded-md border p-2.5 flex items-center gap-2">
      <div className={`h-8 w-8 rounded flex items-center justify-center ${cls[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      </div>
    </div>
  );
}
