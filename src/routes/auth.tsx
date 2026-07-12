import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Coffee, Delete } from "lucide-react";
import { signInWithPin } from "@/lib/pin-auth.functions";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Enter PIN — ELGA Café" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const signIn = useServerFn(signInWithPin);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (value: string) => {
    if (!/^\d{4}$/.test(value)) {
      toast.error("Invalid PIN");
      setPin("");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn({ data: { pin: value } });
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) throw error;
      toast.success(`Welcome — ${result.label}`);
      await supabase.auth.getUser();
      await navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Sign-in failed");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const press = (d: string) => {
    if (loading) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Coffee className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">ELGA Café</h1>
            <p className="text-sm text-muted-foreground">Inventory Management</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>Enter Portal PIN</CardTitle>
            <CardDescription>Each portal has its own 4-digit code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-4 w-4 rounded-full border-2 border-primary transition-colors"
                  style={{ backgroundColor: pin.length > i ? "hsl(var(--primary))" : "transparent" }}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Button key={d} variant="outline" size="lg" className="h-16 text-2xl font-semibold" onClick={() => press(d)} disabled={loading}>
                  {d}
                </Button>
              ))}
              <div />
              <Button variant="outline" size="lg" className="h-16 text-2xl font-semibold" onClick={() => press("0")} disabled={loading}>
                0
              </Button>
              <Button variant="ghost" size="lg" className="h-16" onClick={back} disabled={loading || pin.length === 0}>
                <Delete className="h-6 w-6" />
              </Button>
            </div>

            {loading && <p className="text-center text-sm text-muted-foreground">Signing in…</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
