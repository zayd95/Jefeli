'use client';

import { useCallback, useState } from 'react';
import { MODERATION_ACTION_LABELS, TARGET_TYPE_LABELS, adminError, formatDateTime } from '@/lib/admin-labels';
import { IconRefresh } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { Loading, Notice, PageHead, Segmented, useLoader } from './kit';

type ActionRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  report_id: string | null;
  moderator: { handle: string } | null;
  owner: { handle: string } | null;
};

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export function Journal() {
  const { supabase } = useAdmin();
  const [tab, setTab] = useState<'actions' | 'audit'>('actions');

  const load = useCallback(async (): Promise<{
    key: string;
    actions: ActionRow[];
    audit: AuditRow[];
    actors: Record<string, string>;
    error: string | null;
  }> => {
    if (tab === 'actions') {
      const { data, error: err } = await supabase
        .from('moderation_actions')
        .select(
          `id, action, target_type, target_id, reason, created_at, report_id,
           moderator:profiles!moderation_actions_moderator_id_fkey(handle),
           owner:profiles!moderation_actions_target_owner_id_fkey(handle)`,
        )
        .order('created_at', { ascending: false })
        .limit(150)
        .overrideTypes<ActionRow[], { merge: false }>();
      return { key: tab, actions: data ?? [], audit: [], actors: {}, error: err ? adminError(err) : null };
    } else {
      const { data, error: err } = await supabase.rpc('admin_audit_log', { p_limit: 150 });
      const list = err ? [] : ((data ?? []) as unknown as AuditRow[]);
      const ids = [...new Set(list.map((a) => a.actor_id).filter((x): x is string => !!x))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, handle').in('id', ids);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.handle]));
      }
      return { key: tab, actions: [], audit: list, actors: names, error: err ? adminError(err) : null };
    }
  }, [supabase, tab]);

  const { data: result, reload } = useLoader(load);
  const current = result?.key === tab ? result : null;
  const actions = current ? current.actions : null;
  const audit = current ? current.audit : null;
  const actors = current?.actors ?? {};
  const error = current?.error ?? null;

  return (
    <>
      <PageHead title="Journal" intro="Historique immuable des décisions de modération et des opérations sensibles. Rien ne peut y être modifié ni effacé.">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
          <IconRefresh width={16} height={16} /> Actualiser
        </button>
      </PageHead>
      <div className="admin-filters">
        <Segmented
          label="Journal"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'actions', label: 'Décisions de modération' },
            { value: 'audit', label: 'Journal d’audit' },
          ]}
        />
      </div>
      {error ? <Notice notice={{ tone: 'error', text: error }} /> : null}

      {tab === 'actions' ? (
        actions === null ? (
          <Loading />
        ) : actions.length === 0 ? (
          <div className="admin-empty">
            <strong>Aucune décision enregistrée</strong>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Décision</th>
                  <th scope="col">Cible</th>
                  <th scope="col">Membre</th>
                  <th scope="col">Par</th>
                  <th scope="col">Motif</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{formatDateTime(a.created_at)}</td>
                    <td>
                      <strong>{MODERATION_ACTION_LABELS[a.action] ?? a.action}</strong>
                      {a.report_id ? <span className="muted small"> · signalement</span> : null}
                    </td>
                    <td>
                      {TARGET_TYPE_LABELS[a.target_type] ?? a.target_type}
                      <span className="mono muted"> {a.target_id.slice(0, 8)}</span>
                    </td>
                    <td>{a.owner ? `@${a.owner.handle}` : '—'}</td>
                    <td>{a.moderator ? `@${a.moderator.handle}` : '—'}</td>
                    <td className="reason-cell">{a.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : audit === null ? (
        <Loading />
      ) : audit.length === 0 ? (
        <div className="admin-empty">
          <strong>Journal d’audit vide</strong>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Date</th>
                <th scope="col">Opération</th>
                <th scope="col">Entité</th>
                <th scope="col">Auteur</th>
                <th scope="col">Données</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="mono muted">{a.id}</td>
                  <td className="nowrap">{formatDateTime(a.created_at)}</td>
                  <td className="mono">{a.action}</td>
                  <td>
                    {a.entity_type ?? '—'}
                    {a.entity_id ? <span className="mono muted"> {a.entity_id.slice(0, 18)}</span> : null}
                  </td>
                  <td>{a.actor_id ? (actors[a.actor_id] ? `@${actors[a.actor_id]}` : a.actor_id.slice(0, 8)) : 'système'}</td>
                  <td className="mono small reason-cell">{Object.keys(a.data ?? {}).length ? JSON.stringify(a.data) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
