import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, KeyRound, Save } from "lucide-react";
import { setPortalPin } from "@/lib/pin-auth.functions";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users & PINs — ELGA Café" }] }),
});

const ROLES: AppRole[] = ["admin", "central_store", "central_bakery", "delivery_man", "branch_1", "branch_2"];

function UsersPage() {
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const assignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role assigned");
    qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success("Role removed");
    qc.invalidateQueries({ queryKey: ["user-list"] });
    qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users, Roles & PINs</h1>
        <p className="text-sm text-muted-foreground">Assign roles to users and change the PIN for each portal.</p>
      </div>

      <PinManagerCard />

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Assign Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {ROLE_LABELS[r]}
                          <button onClick={() => removeRole(u.id, r)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select onValueChange={(v) => assignRole(u.id, v as AppRole)}>
                      <SelectTrigger className="w-56"><SelectValue placeholder="Assign role..." /></SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {(users ?? []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No users yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PinManagerCard() {
  const qc = useQueryClient();
  const savePin = useServerFn(setPortalPin);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: pins } = useQuery({
    queryKey: ["portal-pins"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("portal_pins").select("role,pin,updated_at").order("role");
      if (error) throw error;
      return (data ?? []) as { role: AppRole; pin: string; updated_at: string }[];
    },
  });

  const submit = async (role: AppRole) => {
    const pin = (drafts[role] ?? "").trim();
    if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be exactly 4 digits");
    setSaving(role);
    try {
      await savePin({ data: { role, pin } });
      toast.success(`PIN updated for ${ROLE_LABELS[role]}`);
      setDrafts((d) => ({ ...d, [role]: "" }));
      qc.invalidateQueries({ queryKey: ["portal-pins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update PIN");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Portal PINs</CardTitle>
        <CardDescription>Each portal has its own 4-digit login PIN. Only admins can change these.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Portal</TableHead>
              <TableHead>Current PIN</TableHead>
              <TableHead>New PIN</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((role) => {
              const row = (pins ?? []).find((p) => p.role === role);
              return (
                <TableRow key={role}>
                  <TableCell className="font-medium">{ROLE_LABELS[role]}</TableCell>
                  <TableCell><span className="font-mono text-lg tracking-widest">{row?.pin ?? "—"}</span></TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4-digit PIN"
                      className="w-32 font-mono tracking-widest"
                      value={drafts[role] ?? ""}
                      onChange={(e) => setDrafts({ ...drafts, [role]: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      disabled={saving === role || !/^\d{4}$/.test(drafts[role] ?? "")}
                      onClick={() => submit(role)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saving === role ? "Saving…" : "Save"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
