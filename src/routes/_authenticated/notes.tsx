import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Pin, PinOff, Archive, ArchiveRestore, Check, Trash2, Plus, Search,
  Clock, AlertTriangle, StickyNote, BellOff,
} from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
  head: () => ({ meta: [{ title: "Notes & Reminders — ELGA Café" }] }),
});

const CATEGORIES = [
  "inventory","suppliers","finance","staff","maintenance",
  "branch_operations","central_store","central_bakery","general",
] as const;
type Category = typeof CATEGORIES[number];
type Priority = "low" | "medium" | "high";
type Status = "pending" | "completed";

interface Note {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  due_at: string | null;
  reminder_at: string | null;
  status: Status;
  pinned: boolean;
  archived: boolean;
  reminder_dismissed: boolean;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  inventory: "Inventory", suppliers: "Suppliers", finance: "Finance",
  staff: "Staff", maintenance: "Maintenance", branch_operations: "Branch Operations",
  central_store: "Central Store", central_bakery: "Central Bakery", general: "General",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/15 text-primary border-primary/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

function NotesPage() {
  const { user, roles, loading } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [dialog, setDialog] = useState<{ open: boolean; note?: Note | null }>({ open: false });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("admin-notes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notes", filter: `owner_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["admin-notes"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  const { data: notes = [] } = useQuery({
    queryKey: ["admin-notes"],
    enabled: !!user && roles.includes("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notes")
        .select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (tab === "active" ? n.archived : !n.archived) return false;
      if (category !== "all" && n.category !== category) return false;
      if (priority !== "all" && n.priority !== priority) return false;
      if (status !== "all" && n.status !== status) return false;
      if (s && !(`${n.title} ${n.description ?? ""}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [notes, tab, category, priority, status, search]);

  const upsert = useMutation({
    mutationFn: async (n: Partial<Note> & { id?: string }) => {
      if (!user) throw new Error("no user");
      const payload: any = { ...n, owner_id: user.id };
      if (n.id) {
        const { error } = await supabase.from("admin_notes").update(payload).eq("id", n.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_notes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-notes"] });
      setDialog({ open: false });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, ...changes }: Partial<Note> & { id: string }) => {
      const { error } = await supabase.from("admin_notes").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notes"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-notes"] }); },
  });

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!roles.includes("admin")) {
    return <div className="p-8 text-sm text-muted-foreground">This module is only available to administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <StickyNote className="h-6 w-6 text-primary" /> Notes & Reminders
          </h1>
          <p className="text-sm text-muted-foreground">Private admin workspace for notes, tasks, and reminders.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, note: null })}>
          <Plus className="h-4 w-4 mr-2" /> New note
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as any)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No notes.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((n) => (
                <NoteCard key={n.id} note={n}
                  onEdit={() => setDialog({ open: true, note: n })}
                  onTogglePin={() => patch.mutate({ id: n.id, pinned: !n.pinned })}
                  onToggleArchive={() => patch.mutate({ id: n.id, archived: !n.archived })}
                  onComplete={() => patch.mutate({ id: n.id, status: n.status === "pending" ? "completed" : "pending" })}
                  onDismissReminder={() => patch.mutate({ id: n.id, reminder_dismissed: true })}
                  onDelete={() => { if (confirm("Delete this note?")) del.mutate(n.id); }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NoteDialog
        open={dialog.open}
        note={dialog.note ?? null}
        onOpenChange={(o) => setDialog({ open: o })}
        onSubmit={(payload) => upsert.mutate({ ...(dialog.note ?? {}), ...payload, id: dialog.note?.id })}
        saving={upsert.isPending}
      />
    </div>
  );
}

function NoteCard({
  note, onEdit, onTogglePin, onToggleArchive, onComplete, onDismissReminder, onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onComplete: () => void;
  onDismissReminder: () => void;
  onDelete: () => void;
}) {
  const overdue = note.due_at && new Date(note.due_at) < new Date() && note.status === "pending";
  return (
    <Card className={note.pinned ? "border-primary/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <button className="text-left flex-1" onClick={onEdit}>
            <CardTitle className="text-base flex items-center gap-2">
              {note.status === "completed" && <Check className="h-4 w-4 text-success" />}
              <span className={note.status === "completed" ? "line-through text-muted-foreground" : ""}>{note.title}</span>
            </CardTitle>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePin} title={note.pinned ? "Unpin" : "Pin"}>
            {note.pinned ? <Pin className="h-4 w-4 text-primary" /> : <PinOff className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge variant="outline" className={PRIORITY_COLORS[note.priority]}>{note.priority}</Badge>
          <Badge variant="outline">{CATEGORY_LABELS[note.category]}</Badge>
          {overdue && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {note.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.description}</p>}
        {(note.due_at || note.reminder_at) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {note.due_at && <div><Clock className="inline h-3 w-3 mr-1" /> Due {new Date(note.due_at).toLocaleString()}</div>}
            {note.reminder_at && <div><Clock className="inline h-3 w-3 mr-1" /> Remind {new Date(note.reminder_at).toLocaleString()}{note.reminder_dismissed ? " (dismissed)" : ""}</div>}
          </div>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          <Button variant="outline" size="sm" onClick={onComplete}>
            <Check className="h-3.5 w-3.5 mr-1" /> {note.status === "pending" ? "Complete" : "Reopen"}
          </Button>
          {note.reminder_at && !note.reminder_dismissed && note.status === "pending" && (
            <Button variant="outline" size="sm" onClick={onDismissReminder}>
              <BellOff className="h-3.5 w-3.5 mr-1" /> Dismiss
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onToggleArchive}>
            {note.archived ? <><ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore</> : <><Archive className="h-3.5 w-3.5 mr-1" /> Archive</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

function NoteDialog({
  open, note, onOpenChange, onSubmit, saving,
}: {
  open: boolean;
  note: Note | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (n: Partial<Note>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setDescription(note?.description ?? "");
    setCategory(note?.category ?? "general");
    setPriority(note?.priority ?? "medium");
    setDueAt(toLocalInput(note?.due_at));
    setReminderAt(toLocalInput(note?.reminder_at));
  }, [open, note?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date & time</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <Label>Reminder date & time</Label>
              <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={saving || !title.trim()}
            onClick={() => onSubmit({
              title: title.trim(),
              description: description.trim() || null,
              category, priority,
              due_at: fromLocalInput(dueAt),
              reminder_at: fromLocalInput(reminderAt),
              reminder_dismissed: false,
            })}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
