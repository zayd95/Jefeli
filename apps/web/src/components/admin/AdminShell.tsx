'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@jefeli/shared';
import { toFrenchError } from '@jefeli/shared';
import { browserClient } from '@/lib/supabase/browser';
import { ROLE_LABELS, type StaffRole } from '@/lib/admin-labels';
import { Wordmark } from '@/components/ui';
import { IconLock, IconLogout } from '@/components/icons';

type AdminContextValue = {
  supabase: SupabaseClient<Database>;
  role: StaffRole;
  userId: string;
  email: string | null;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin hors de AdminShell');
  return ctx;
}

type GateState =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'error'; message: string }
  | { kind: 'not_staff'; email: string | null }
  | { kind: 'staff'; session: Session; role: StaffRole };

const NAV = [
  { href: '/admin/signalements', label: 'Signalements' },
  { href: '/admin/verifications', label: 'Vérifications' },
  { href: '/admin/contestations', label: 'Contestations' },
  { href: '/admin/avis', label: 'Avis' },
  { href: '/admin/journal', label: 'Journal' },
  { href: '/admin/reglages', label: 'Réglages' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = browserClient();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const pathname = usePathname();

  const resolve = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setState({ kind: 'signed_out' });
        return;
      }
      // The role is only a UI gate: every staff RPC re-checks it in the database.
      const { data, error } = await supabase.rpc('my_staff_role');
      if (error) {
        setState({ kind: 'error', message: toFrenchError(error) });
        return;
      }
      const role = data as string | null;
      if (role === 'admin' || role === 'moderator') setState({ kind: 'staff', session, role });
      else setState({ kind: 'not_staff', email: session.user.email ?? null });
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) void resolve(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, resolve]);

  async function signOut() {
    await supabase.auth.signOut();
    setState({ kind: 'signed_out' });
  }

  if (state.kind === 'loading') {
    return (
      <div className="admin-center">
        <p className="muted" role="status">
          Chargement…
        </p>
      </div>
    );
  }

  if (state.kind === 'signed_out') return <LoginForm supabase={supabase} />;

  if (state.kind === 'error' || state.kind === 'not_staff') {
    return (
      <div className="admin-center">
        <div className="card admin-gate">
          <Wordmark size={28} />
          <span className="admin-gate-icon">
            <IconLock />
          </span>
          <h1>Accès réservé à l’équipe de modération</h1>
          <p className="muted">
            {state.kind === 'error'
              ? state.message
              : `Le compte ${state.email ?? ''} n’a pas de rôle de modération. Si vous pensez que c’est une erreur, contactez un administrateur.`}
          </p>
          <button type="button" className="btn btn-dark btn-block" onClick={signOut}>
            <IconLogout width={18} height={18} /> Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const ctx: AdminContextValue = {
    supabase,
    role: state.role,
    userId: state.session.user.id,
    email: state.session.user.email ?? null,
  };

  return (
    <AdminContext.Provider value={ctx}>
      <div className="admin-app">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-inner">
          <div className="admin-brand">
            <Link href="/admin/signalements" aria-label="Console de modération">
              <Wordmark size={24} />
            </Link>
            <span className="admin-brand-label">Modération</span>
          </div>
          <nav className="admin-nav" aria-label="Sections de la console">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="admin-user">
            <div className="admin-user-id">
              <div className="admin-user-email" title={ctx.email ?? ''}>
                {ctx.email}
              </div>
              <div className="admin-user-role">{ROLE_LABELS[ctx.role]}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOut} aria-label="Se déconnecter">
              <IconLogout width={18} height={18} />
              <span className="admin-hide-sm">Déconnexion</span>
            </button>
          </div>
          </div>
        </aside>
        <main className="admin-main" id="contenu">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}

function LoginForm({ supabase }: { supabase: SupabaseClient<Database> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(toFrenchError(err));
  }

  return (
    <div className="admin-center">
      <form className="card admin-gate" onSubmit={submit} noValidate>
        <Wordmark size={30} />
        <h1>Console de modération</h1>
        <p className="muted">Accès réservé à l’équipe Jëfëli. Connectez-vous avec votre compte membre de l’équipe.</p>
        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
          />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-dark btn-block" disabled={busy || !email || !password}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
