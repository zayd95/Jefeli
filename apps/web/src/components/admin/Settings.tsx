'use client';

import { useCallback, useState } from 'react';
import { adminError, formatDateTime } from '@/lib/admin-labels';
import { IconInfo } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { ConfirmDialog, Loading, Notice, PageHead, useLoader, type ConfirmRequest, type NoticeState } from './kit';

type Flag = {
  key: string;
  enabled: boolean;
  description: string;
  updated_at: string;
  updated_by: string | null;
};

export function Settings() {
  const { supabase, role } = useAdmin();
  const isAdmin = role === 'admin';
  const [notice, setNotice] = useState<NoticeState>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async (): Promise<{ flags: Flag[]; error: string | null }> => {
    const { data, error: err } = await supabase.from('feature_flags').select('key, enabled, description, updated_at, updated_by').order('key');
    return { flags: data ?? [], error: err ? adminError(err) : null };
  }, [supabase]);

  const { data: result, reload } = useLoader(load);
  const flags = result?.flags ?? null;
  const error = result?.error ?? null;

  function toggle(f: Flag) {
    const next = !f.enabled;
    setConfirm({
      title: `${next ? 'Activer' : 'Désactiver'} «\u00A0${f.key}\u00A0»`,
      description: (
        <>
          <p>{f.description}</p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Le changement s’applique à tous les membres dès le prochain chargement de l’application et est inscrit au
            journal d’audit.
          </p>
        </>
      ),
      confirmLabel: next ? 'Activer' : 'Désactiver',
      tone: next ? 'primary' : 'danger',
      run: async () => {
        const { error: err } = await supabase.rpc('admin_set_feature_flag', { p_key: f.key, p_enabled: next });
        if (err) throw new Error(adminError(err));
        setNotice({ tone: 'success', text: `«\u00A0${f.key}\u00A0» ${next ? 'activé' : 'désactivé'}.` });
        await reload();
      },
    });
  }

  return (
    <>
      <PageHead title="Réglages" intro="Fonctionnalités activables à distance. Certaines exigent un fournisseur externe configuré : lisez la description avant d’activer." />
      {!isAdmin ? (
        <div className="explain">
          <IconInfo />
          <div>Réservé aux administrateurs&nbsp;: vous pouvez consulter l’état des fonctionnalités sans le modifier.</div>
        </div>
      ) : null}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {error ? <Notice notice={{ tone: 'error', text: error }} /> : null}
      {flags === null ? (
        <Loading />
      ) : (
        <ul className="flag-list">
          {flags.map((f) => (
            <li key={f.key} className="card flag">
              <div style={{ minWidth: 0 }}>
                <p className="mono flag-key">{f.key}</p>
                <p className="flag-desc">{f.description}</p>
                <p className="muted small">Modifié le {formatDateTime(f.updated_at)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.enabled}
                aria-label={`${f.key}\u00A0: ${f.enabled ? 'activé' : 'désactivé'}`}
                className="switch"
                disabled={!isAdmin}
                onClick={() => toggle(f)}
              >
                <span className="switch-track">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">{f.enabled ? 'Activé' : 'Désactivé'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
