import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchMyProfile } from './api/profiles';
import { supabase } from './supabase';
import type { ProfileRow } from './types';

interface AuthState {
  session: Session | null;
  userId: string | null;
  profile: ProfileRow | null;
  initializing: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<unknown>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => mounted && setInitializing(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const userId = session?.user.id ?? null;
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    queryFn: () => fetchMyProfile(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId,
      profile: profileQuery.data ?? null,
      initializing,
      profileLoading: !!userId && profileQuery.isPending,
      refreshProfile: () => profileQuery.refetch(),
      signOut: async () => {
        await supabase.auth.signOut();
        qc.clear();
      },
    }),
    [session, userId, profileQuery, initializing, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** Narrowed accessor for screens that are only reachable when signed in. */
export function useMe(): { userId: string; profile: ProfileRow | null } {
  const { userId, profile } = useAuth();
  return { userId: userId ?? '', profile };
}
