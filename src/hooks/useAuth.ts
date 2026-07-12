import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/roles";

export interface AuthState {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, roles: [], loading: true });

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string): Promise<AppRole[]> => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r) => r.role as AppRole);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ?? null;
      const roles = user ? await loadRoles(user.id) : [];
      if (mounted) setState({ user, roles, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      // defer to avoid deadlocks
      setTimeout(async () => {
        const roles = user ? await loadRoles(user.id) : [];
        if (mounted) setState({ user, roles, loading: false });
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function hasRole(roles: AppRole[], ...check: AppRole[]): boolean {
  return roles.some((r) => check.includes(r));
}
