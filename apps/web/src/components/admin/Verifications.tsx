'use client';

import { useCallback, useState } from 'react';
import { publicStorageUrl, timeAgo } from '@jefeli/shared';
import { env } from '@/lib/env';
import { BUSINESS_TYPE_LABELS, VERIFICATION_STATUS_LABELS, adminError, formatDateTime } from '@/lib/admin-labels';
import { Avatar } from '@/components/ui';
import { IconExternal, IconInfo, IconRefresh } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { ConfirmDialog, Loading, Notice, PageHead, Segmented, StateChip, type ConfirmRequest, type NoticeState, useLoader } from './kit';

type Applicant = {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  city: string | null;
  status: 'active' | 'suspended';
  verification_level: 'none' | 'merchant_verified';
  products_count: number;
  followers_count: number;
  rating_sum: number;
  rating_count: number;
  is_demo: boolean;
  created_at: string;
};

type RequestRow = {
  id: string;
  business_name: string;
  business_type: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  user: Applicant | null;
  reviewer: { handle: string } | null;
};

const APPLICANT = 'id, handle, display_name, avatar_path, city, status, verification_level, products_count, followers_count, rating_sum, rating_count, is_demo, created_at';

export function Verifications() {
  const { supabase, role } = useAdmin();
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState<'pending' | 'done' | 'verified'>('pending');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async (): Promise<{ key: string; rows: RequestRow[]; verified: Applicant[]; error: string | null }> => {
    if (tab === 'verified') {
      const { data, error: err } = await supabase
        .from('profiles')
        .select(APPLICANT)
        .eq('verification_level', 'merchant_verified')
        .order('display_name')
        .limit(200)
        .overrideTypes<Applicant[], { merge: false }>();
      return { key: tab, rows: [], verified: data ?? [], error: err ? adminError(err) : null };
    }
    let q = supabase
      .from('verification_requests')
      .select(
        `id, business_name, business_type, details, status, created_at, reviewed_at, review_note,
         user:profiles!verification_requests_user_id_fkey(${APPLICANT}),
         reviewer:profiles!verification_requests_reviewed_by_fkey(handle)`,
      );
    q = tab === 'pending' ? q.eq('status', 'pending').order('created_at', { ascending: true }) : q.neq('status', 'pending').order('reviewed_at', { ascending: false });
    const { data, error: err } = await q.limit(100).overrideTypes<RequestRow[], { merge: false }>();
    return { key: tab, rows: data ?? [], verified: [], error: err ? adminError(err) : null };
  }, [supabase, tab]);

  const { data: result, reload } = useLoader(load);
  const current = result?.key === tab ? result : null;
  const rows = current ? current.rows : null;
  const verified = current ? current.verified : null;
  const error = current?.error ?? null;

  function review(r: RequestRow, approve: boolean) {
    setConfirm({
      title: approve ? `Accorder le badge à ${r.business_name}` : `Refuser la demande de ${r.business_name}`,
      description: approve ? (
        <p>
          Le profil @{r.user?.handle} affichera «&nbsp;Vendeur vérifié&nbsp;». Confirmez que les informations fournies ont été
          examinées.
        </p>
      ) : (
        <p>Le membre est informé du refus. Il pourra déposer une nouvelle demande.</p>
      ),
      confirmLabel: approve ? 'Accorder' : 'Refuser',
      tone: approve ? 'primary' : 'danger',
      reason: {
        label: 'Note d’examen',
        required: !approve,
        placeholder: approve ? 'Éléments vérifiés (ex.\u00A0: boutique visitée, registre de commerce consulté)' : 'Motif du refus',
      },
      run: async (note) => {
        const { error: err } = await supabase.rpc('review_verification_request', {
          p_request_id: r.id,
          p_approve: approve,
          p_note: note,
        });
        if (err) throw new Error(adminError(err));
        setNotice({ tone: 'success', text: approve ? 'Badge accordé.' : 'Demande refusée.' });
        await reload();
      },
    });
  }

  function revoke(p: Applicant) {
    setConfirm({
      title: `Retirer la vérification de ${p.display_name}`,
      description: <p>Le badge «&nbsp;Vendeur vérifié&nbsp;» disparaît du profil. Le membre est notifié et peut contester.</p>,
      confirmLabel: 'Retirer',
      tone: 'danger',
      reason: { label: 'Motif', required: true },
      run: async (reason) => {
        const { error: err } = await supabase.rpc('moderate', {
          p_action: 'revoke_verification',
          p_target_type: 'profile',
          p_target_id: p.id,
          p_reason: reason,
        });
        if (err) throw new Error(adminError(err));
        setNotice({ tone: 'success', text: 'Vérification retirée.' });
        await reload();
      },
    });
  }

  return (
    <>
      <PageHead title="Vérifications vendeurs" intro="Demandes de badge « Vendeur vérifié » déposées depuis l’application.">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
          <IconRefresh width={16} height={16} /> Actualiser
        </button>
      </PageHead>

      <div className="explain">
        <IconInfo />
        <div>
          <strong>Ce que signifie le badge.</strong> Il indique que l’équipe Jëfëli a examiné les informations fournies
          par le vendeur (nom commercial, activité, éléments transmis). Il ne garantit ni les produits, ni les
          paiements, ni la livraison, et peut être retiré à tout moment. Seul un administrateur peut l’accorder ou le
          retirer.
          {!isAdmin ? <span className="explain-warn"> Vous êtes modérateur&nbsp;: consultation seule.</span> : null}
        </div>
      </div>

      <div className="admin-filters">
        <Segmented
          label="Vue"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'En attente' },
            { value: 'done', label: 'Traitées' },
            { value: 'verified', label: 'Vendeurs vérifiés' },
          ]}
        />
      </div>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {error ? <Notice notice={{ tone: 'error', text: error }} /> : null}

      {tab === 'verified' ? (
        verified === null ? (
          <Loading />
        ) : verified.length === 0 ? (
          <div className="admin-empty">
            <strong>Aucun vendeur vérifié</strong>
          </div>
        ) : (
          <div className="admin-cards">
            {verified.map((p) => (
              <article className="card admin-card" key={p.id}>
                <ApplicantHeader p={p} />
                <div className="admin-card-actions">
                  <button type="button" className="btn btn-outline btn-sm action-danger" disabled={!isAdmin} onClick={() => revoke(p)}>
                    Retirer la vérification
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="admin-empty">
          <strong>{tab === 'pending' ? 'Aucune demande en attente' : 'Aucune demande traitée'}</strong>
        </div>
      ) : (
        <div className="admin-cards">
          {rows.map((r) => (
            <article className="card admin-card" key={r.id}>
              {r.user ? <ApplicantHeader p={r.user} /> : <p className="muted">Membre introuvable</p>}
              <dl className="kv">
                <div>
                  <dt>Nom commercial</dt>
                  <dd>
                    <strong>{r.business_name}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Activité</dt>
                  <dd>{BUSINESS_TYPE_LABELS[r.business_type] ?? r.business_type}</dd>
                </div>
                <div>
                  <dt>Détails fournis</dt>
                  <dd className="prewrap">{r.details.trim() || '—'}</dd>
                </div>
                <div>
                  <dt>Déposée</dt>
                  <dd>{formatDateTime(r.created_at)}</dd>
                </div>
                {r.status !== 'pending' ? (
                  <div>
                    <dt>Décision</dt>
                    <dd>
                      <StateChip tone={r.status === 'approved' ? 'ok' : 'danger'}>{VERIFICATION_STATUS_LABELS[r.status]}</StateChip>{' '}
                      {formatDateTime(r.reviewed_at)}
                      {r.reviewer ? ` · @${r.reviewer.handle}` : ''}
                      {r.review_note ? <span className="prewrap" style={{ display: 'block', marginTop: 4 }}>{r.review_note}</span> : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {r.status === 'pending' ? (
                <div className="admin-card-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={!isAdmin} onClick={() => review(r, true)}>
                    Accorder le badge
                  </button>
                  <button type="button" className="btn btn-outline btn-sm action-danger" disabled={!isAdmin} onClick={() => review(r, false)}>
                    Refuser
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function ApplicantHeader({ p }: { p: Applicant }) {
  const avg = p.rating_count ? (p.rating_sum / p.rating_count).toFixed(1).replace('.', ',') : null;
  return (
    <div className="owner-card">
      <Avatar src={publicStorageUrl(env.supabaseUrl, 'avatars', p.avatar_path)} name={p.display_name} size={44} />
      <div style={{ minWidth: 0 }}>
        <strong>
          {p.display_name}
          {p.is_demo ? <span className="chip chip-demo" style={{ marginLeft: 6 }}>DÉMO</span> : null}
        </strong>
        <div className="muted small">
          @{p.handle}
          {p.city ? ` · ${p.city}` : ''} · membre {timeAgo(p.created_at)}
        </div>
        <div className="muted small">
          {p.products_count} article(s) en ligne · {p.followers_count} abonné(s)
          {avg ? ` · ${avg}/5 (${p.rating_count} avis)` : ' · aucun avis'}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        {p.status === 'suspended' ? <StateChip tone="danger">Suspendu</StateChip> : null}
        {p.verification_level === 'merchant_verified' ? <StateChip tone="ok">Vérifié</StateChip> : null}
        <a className="drawer-link" href={`/${p.handle}`} target="_blank" rel="noopener noreferrer">
          Profil <IconExternal width={14} height={14} />
        </a>
      </div>
    </div>
  );
}
