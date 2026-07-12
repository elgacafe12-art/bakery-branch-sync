import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type LocationType = Database["public"]["Enums"]["location_type"];
export type ItemType = Database["public"]["Enums"]["item_type"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  central_store: "Central Store",
  central_bakery: "Central Bakery",
  delivery_man: "Delivery Man",
  branch_1: "Branch 1",
  branch_2: "Branch 2",
};

export const LOCATION_LABELS: Record<LocationType, string> = {
  central_store: "Central Store",
  central_bakery: "Central Bakery",
  branch_1: "Branch 1",
  branch_2: "Branch 2",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  assigned: "Assigned",
  picked_up: "Picked Up",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: "bg-warning/20 text-warning-foreground border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  assigned: "bg-accent/20 text-accent-foreground border-accent/40",
  picked_up: "bg-chart-2/20 text-foreground border-chart-2/40",
  delivered: "bg-success/20 text-success-foreground border-success/40",
  completed: "bg-success/30 text-success-foreground border-success/50",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function roleToLocation(role: AppRole): LocationType | null {
  if (role === "central_store") return "central_store";
  if (role === "central_bakery") return "central_bakery";
  if (role === "branch_1") return "branch_1";
  if (role === "branch_2") return "branch_2";
  return null;
}
