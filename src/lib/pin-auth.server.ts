// SERVER-ONLY. Never import this from client code — the *.server.ts suffix
// blocks it from client bundles. Contains the portal account credentials
// keyed by ROLE. Passwords are loaded from server-side secrets at runtime
// and are NEVER committed to source.
import type { AppRole } from "./roles";

export interface PortalCredential {
  role: AppRole;
  email: string;
  password: string;
  label: string;
}

function requirePw(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing portal password secret: ${name}`);
  return v;
}

// Passwords come from Lovable Cloud secrets (PORTAL_PW_*). Rotate them by
// updating the secret and the corresponding auth.users password together.
export const PORTAL_ACCOUNTS: Record<AppRole, PortalCredential> = {
  admin:          { role: "admin",          email: "admin@elga.local",    get password() { return requirePw("PORTAL_PW_ADMIN"); },    label: "Administrator" } as PortalCredential,
  central_store:  { role: "central_store",  email: "store@elga.local",    get password() { return requirePw("PORTAL_PW_STORE"); },    label: "Central Store" } as PortalCredential,
  central_bakery: { role: "central_bakery", email: "bakery@elga.local",   get password() { return requirePw("PORTAL_PW_BAKERY"); },   label: "Central Bakery" } as PortalCredential,
  delivery_man:   { role: "delivery_man",   email: "delivery@elga.local", get password() { return requirePw("PORTAL_PW_DELIVERY"); }, label: "Delivery Man" } as PortalCredential,
  branch_1:       { role: "branch_1",       email: "branch1@elga.local",  get password() { return requirePw("PORTAL_PW_BRANCH1"); },  label: "Branch 1" } as PortalCredential,
  branch_2:       { role: "branch_2",       email: "branch2@elga.local",  get password() { return requirePw("PORTAL_PW_BRANCH2"); },  label: "Branch 2" } as PortalCredential,
};

export const DEFAULT_PORTAL_PINS: Record<string, AppRole> = {
  "3234": "admin",
  "4444": "central_store",
  "5555": "central_bakery",
  "1234": "delivery_man",
  "4321": "branch_1",
  "3333": "branch_2",
};
