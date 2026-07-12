import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — ELGA Café" }] }),
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifs"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    toast.success("All marked read");
    qc.invalidateQueries();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">System alerts and updates.</p></div>
        <Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4 mr-2" /> Mark all read</Button>
      </div>
      <Card><CardContent className="p-0">
        {(data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground"><Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />No notifications</div>}
        {(data ?? []).map((n) => (
          <div key={n.id} onClick={() => markOne(n.id)} className={`p-4 border-b last:border-0 cursor-pointer hover:bg-muted/50 ${!n.read ? "bg-accent/5" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  {n.title}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{n.message}</div>
                {n.link && <Link to={n.link} className="text-xs text-primary hover:underline mt-1 inline-block">View →</Link>}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{format(new Date(n.created_at), "MMM d, HH:mm")}</div>
            </div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
