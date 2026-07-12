// SERVER-ONLY. Never import this from client code — the *.server.ts suffix
// blocks it from client bundles. Portal accounts are identified by email
// only; sign-in is performed via one-time-use magic link tokens minted by
// the Supabase Admin API, so no shared passwords live in this codebase.
import type { AppRole } from "./roles";

export interface PortalAccount {
  role: AppRole;
  email: string;
  label: string;
}

export const PORTAL_ACCOUNTS: Record<AppRole, PortalAccount> = {
  admin:          { role: "admin",          email: "admin@elga.local",    label: "Administrator" },
  central_store:  { role: "central_store",  email: "store@elga.local",    label: "Central Store" },
  central_bakery: { role: "central_bakery", email: "bakery@elga.local",   label: "Central Bakery" },
  delivery_man:   { role: "delivery_man",   email: "delivery@elga.local", label: "Delivery Man" },
  branch_1:       { role: "branch_1",       email: "branch1@elga.local",  label: "Branch 1" },
  branch_2:       { role: "branch_2",       email: "branch2@elga.local",  label: "Branch 2" },
};
