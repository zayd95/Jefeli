'use client';

import { useCallback, useState } from 'react';
import {
  APPEAL_STATUS_LABELS,
  MODERATION_ACTION_LABELS,
  TARGET_TYPE_LABELS,
  adminError,
  formatDateTime,
  publicPath,
} from '@/lib/admin-labels';
import { IconExternal, IconRefresh } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { ConfirmDialog, Loading, Notice, PageHead, Segmented, StateChip, type ConfirmRequest, type NoticeState, useLoader } from './kit';

type AppealRow = {
  id: string;
  body: string;
  status: 'open' | 'upheld' | 'reversed';
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  user: { id: string; handle: string; display_name: string; status: string } | null;
  resolver: { handle: string } | null;
  action: {
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    reason: string;
    created_at: string;
    moderator: { handle: string } | null;
  } | null;
};

const REVERSIBLE = new Set(['hide_content', 'remove_content', 'suspend_user', 'revoke_verification']);

export function Appeals() {
  const { supabase } = useAdmin();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async (): Promise<{ key: string; rows: AppealRow[]; error: string | null }> => {
    let q = supabase.from('appeals').select(
      `id, body, status, created_at, resolved_at, resolution_note,
       user:profiles!appeals_user_id_fkey(id, handle, display_name, status),
       resolver:profiles!appeals_resolved_by_fkey(handle),
       action:moderation_actions!appeals_moderation_action_id_fkey(id, action, target_type, target_id, reason, created_at,
         moderator:profiles!moderation_actions_moderator_id_fkey(handle))`,
    );
    q = tab === 'open' ? q.eq('status', 'open').order('created_at', { ascending: true }) : q.neq('status', 'open').order('resolved_at', { ascending: false });
    const { data, error: err } = await q.limit(100).overrideTypes<AppealRow[], { merge: false }>();
    return { key: tab, rows: data ?? [], error: err ? adminError(err) : null };
  }, [supabase, tab]);

  const { data: result, reload } = useLoader(load);
  const rows = result?.key === tab ? result.rows : null;
  const error = result?.key === tab ? result.error : null;

  function resolve(a: AppealRow, reverse: boolean) {
    const actionLabel = a.action ? (MODERATION_ACTION_LABELS[a.action.action] ?? a.action.action) : 'la décision';
    setConfirm({
      title: reverse ? 'Annuler la décision' : 'Maintenir la décision',
      description: reverse ? (
        <p>
          «&nbsp;{actionLabel} » sera annulée{a.action && REVERSIBLE.has(a.action.action) ? ' et ses effets levés (contenu rétabli, compte réactivé ou badge rendu)' : ''}.
          Le membre est notifié.
        </p>
      ) : (
        <p>La décision «&nbsp;{actionLabel} » reste en place. Le membre est notifié.</p>
      ),
      confirmLabel: reverse ? 'Annuler la décision' : 'Maintenir',
      tone: reverse ? 'primary' : 'dark',
      reason: { label: 'Réponse motivée', required: true, placeholder: 'Explication transmise au journal' },
      run: async (note) => {
        const { error: err } = await supabase.rpc('resolve_appeal', { p_appeal_id: a.id, p_reverse: reverse, p_note: note });
        if (err) throw new Error(adminError(err));
        setNotice({ tone: 'success', text: reverse ? 'Décision annulée.' : 'Décision maintenue.' });
        await reload();
      },
    });
  }

  return (
    <>
      <PageHead title="Contestations" intro="Les membres peuvent contester une décision de modération les concernant. Examinez chaque demande avec un regard neuf.">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
          <IconRefresh width={16} height={16} /> Actualiser
        </button>
      </PageHead>
      <div className="admin-filters">
        <Segmented
          label="Statut"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'À examiner' },
            { value: 'done', label: 'Traitées' },
          ]}
        />
      </div>
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {error ? <Notice notice={{ tone: 'error', text: error }} /> : null}

      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="admin-empty">
          <strong>{tab === 'open' ? 'Aucune contestation à examiner' : 'Aucune contestation traitée'}</strong>
        </div>
      ) : (
        <div className="admin-cards">
          {rows.map((a) => {
            const link = a.action ? publicPath(a.action.target_type, a.action.target_id, a.user?.handle) : null;
            return (
              <article className="card admin-card" key={a.id}>
                <div className="admin-card-head">
                  <div>
                    <strong>{a.user ? `${a.user.display_name} (@${a.user.handle})` : 'Membre supprimé'}</strong>
                    <div className="muted small">Contestation déposée le {formatDateTime(a.created_at)}</div>
                  </div>
                  <StateChip tone={a.status === 'open' ? 'warn' : a.status === 'reversed' ? 'ok' : 'neutral'}>{APPEAL_STATUS_LABELS[a.status]}</StateChip>
                </div>
                <blockquote className="appeal-body prewrap">{a.body}</blockquote>
                {a.action ? (
                  <dl className="kv">
                    <div>
                      <dt>Décision contestée</dt>
                      <dd>
                        <strong>{MODERATION_ACTION_LABELS[a.action.action] ?? a.action.action}</strong> ·{' '}
                        {TARGET_TYPE_LABELS[a.action.target_type] ?? a.action.target_type}
                        {link ? (
                          <>
                            {' · '}
                            <a className="drawer-link" href={link} target="_blank" rel="noopener noreferrer">
                              voir <IconExternal width={13} height={13} />
                            </a>
                          </>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Prise le</dt>
                      <dd>
                        {formatDateTime(a.action.created_at)}
                        {a.action.moderator ? ` · @${a.action.moderator.handle}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Motif initial</dt>
                      <dd className="prewrap">{a.action.reason || '—'}</dd>
                    </div>
                    {a.status !== 'open' ? (
                      <div>
                        <dt>Réponse</dt>
                        <dd className="prewrap">
                          {formatDateTime(a.resolved_at)}
                          {a.resolver ? ` · @${a.resolver.handle}` : ''}
                          {a.resolution_note ? `\n${a.resolution_note}` : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {a.status === 'open' ? (
                  <div className="admin-card-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => resolve(a, false)}>
                      Maintenir la décision
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => resolve(a, true)}>
                      Annuler la décision
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
