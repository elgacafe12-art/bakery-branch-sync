import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import type { ComponentType } from "react";

export function PortalHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/15 via-secondary to-background border p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title} Portal</div>
      <h1 className="text-2xl font-bold tracking-tight mt-1">Welcome back</h1>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );
}

export function QuickTile({
  to, params, icon: Icon, title, desc,
}: {
  to: string;
  params?: Record<string, string>;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to as any} params={params as any} className="group">
      <Card className="hover:border-primary/60 hover:shadow-md transition h-full">
        <CardContent className="p-4 space-y-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StatTile({
  title, value, icon: Icon, tone,
}: {
  title: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tone: "warning" | "primary" | "accent" | "destructive" | "success";
}) {
  const toneClass: Record<string, string> = {
    warning: "text-warning-foreground bg-warning/15",
    primary: "text-primary bg-primary/10",
    accent: "text-accent-foreground bg-accent/20",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success-foreground bg-success/20",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${toneClass[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}
