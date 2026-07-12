// SERVER-ONLY. Never import this from client code — the *.server.ts suffix
// blocks it from client bundles. Contains the fixed portal account
// credentials keyed by ROLE. The PIN → role mapping now lives in the DB
// (public.portal_pins) so admins can change PINs at runtime.
import type { AppRole } from "./roles";

export interface PortalCredential {
  role: AppRole;
  email: string;
  password: string;
  label: string;
}

// Passwords are ONLY known to server code and MUST match auth.users.
export const PORTAL_ACCOUNTS: Record<AppRole, PortalCredential> = {
  admin:          { role: "admin",          email: "admin@elga.local",    password: "elga-srv-adm-K7pQx9nR2mW8vLtY", label: "Administrator" },
  central_store:  { role: "central_store",  email: "store@elga.local",    password: "elga-srv-str-J3fH8kD2nB5cM9zP", label: "Central Store" },
  central_bakery: { role: "central_bakery", email: "bakery@elga.local",   password: "elga-srv-bak-T6yN2gF4wQ8sX1jL", label: "Central Bakery" },
  delivery_man:   { role: "delivery_man",   email: "delivery@elga.local", password: "elga-srv-del-V9mP3xC7bH5rD2kQ", label: "Delivery Man" },
  branch_1:       { role: "branch_1",       email: "branch1@elga.local",  password: "elga-srv-b1-N8jK4wY6tR3fM9pQ",  label: "Branch 1" },
  branch_2:       { role: "branch_2",       email: "branch2@elga.local",  password: "elga-srv-b2-L2xB7hV5nD8cF4mR",  label: "Branch 2" },
};

export const DEFAULT_PORTAL_PINS: Record<string, AppRole> = {
  "3234": "admin",
  "4444": "central_store",
  "5555": "central_bakery",
  "1234": "delivery_man",
  "4321": "branch_1",
  "3333": "branch_2",
};
