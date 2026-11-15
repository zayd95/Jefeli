'use client';

import { useCallback, useState } from 'react';
import { adminError, formatDateTime } from '@/lib/admin-labels';
import { IconRefresh } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { Loading, Notice, PageHead, Segmented, StateChip, useLoader, type NoticeState } from './kit';

type Status = 'new' | 'seen' | 'done';
type FeedbackRow = {
  id: string;
  kind: string;
  message: string;
  platform: string;
  status: Status;
  created_at: string;
  author: { handle: string } | null;
};

const KIND_LABELS: Record<string, string> = { problem: 'Problème', idea: 'Idée', unclear: 'Pas clair', other: 'Autre' };
const STATUS_LABELS: Record<Status, string> = { new: 'Nouveau', seen: 'Lu', done: 'Traité' };

/** Feedback members sent from Réglages › Donner mon avis (web beta). Staff only (RLS). */
export function Feedback() {
  const { supabase } = useAdmin();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from('feedback')
      .select('id, kind, message, platform, status, created_at, author:profiles!feedback_user_id_fkey(handle)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter === 'open') q = q.neq('status', 'done');
    const { data, error } = await q.overrideTypes<FeedbackRow[], { merge: false }>();
    return { key: filter, rows: data ?? [], error: error ? adminError(error) : null };
  }, [supabase, filter]);

  const { data: result, reload } = useLoader(load);
  const current = result?.key === filter ? result : null;

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    setNotice(error ? { tone: 'error', text: adminError(error) } : null);
    await reload();
  }

  return (
    <>
      <PageHead title="Avis" intro="Messages envoyés par les membres depuis Réglages › Donner mon avis. Visibles par l’équipe uniquement.">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
          <IconRefresh width={16} height={16} /> Actualiser
        </button>
      </PageHead>
      <div className="admin-filters">
        <Segmented
          label="Avis"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'À traiter' },
            { value: 'all', label: 'Tous' },
          ]}
        />
      </div>
      {current?.error ? <Notice notice={{ tone: 'error', text: current.error }} /> : null}
      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
      {current === null ? (
        <Loading />
      ) : current.rows.length === 0 ? (
        <div className="admin-empty">
          <strong>Aucun avis {filter === 'open' ? 'à traiter' : 'pour le moment'}</strong>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Message</th>
                <th scope="col">Membre</th>
                <th scope="col">État</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {current.rows.map((f) => (
                <tr key={f.id}>
                  <td className="nowrap">
                    {formatDateTime(f.created_at)}
                    <span className="muted small"> · {f.platform}</span>
                  </td>
                  <td>{KIND_LABELS[f.kind] ?? f.kind}</td>
                  <td className="reason-cell">{f.message}</td>
                  <td>{f.author ? `@${f.author.handle}` : '—'}</td>
                  <td>
                    <StateChip tone={f.status === 'new' ? 'warn' : f.status === 'done' ? 'ok' : 'neutral'}>{STATUS_LABELS[f.status]}</StateChip>
                  </td>
                  <td className="nowrap">
                    {f.status === 'new' ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setStatus(f.id, 'seen')}>
                        Marquer lu
                      </button>
                    ) : null}
                    {f.status !== 'done' ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void setStatus(f.id, 'done')}>
                        Traité
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
