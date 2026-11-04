'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONDITION_LABELS, LISTING_MODE_LABELS, PRICE_MODES, publicStorageUrl, timeAgo } from '@jefeli/shared';
import type { Json } from '@jefeli/shared';
import { env } from '@/lib/env';
import { xof } from '@/lib/format';
import {
  CONTENT_TYPES,
  MODERATION_ACTION_LABELS,
  MODERATION_STATE_LABELS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  TARGET_TABLES,
  TARGET_TYPE_LABELS,
  adminError,
  formatDateTime,
  publicPath,
} from '@/lib/admin-labels';
import { Avatar } from '@/components/ui';
import { IconClose, IconExternal, IconRefresh } from '@/components/icons';
import { useAdmin } from './AdminShell';
import { ConfirmDialog, Loading, Notice, PageHead, Segmented, StateChip, useLoader, type ConfirmRequest, type NoticeState } from './kit';

type ProfileLite = {
  id: string;
  handle: string;
  display_name: string;
  status: 'active' | 'suspended';
  verification_level: 'none' | 'merchant_verified';
  avatar_path: string | null;
  is_demo: boolean;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  target_owner_id: string | null;
  reason: string;
  details: string;
  evidence: Json;
  status: 'open' | 'in_review' | 'actioned' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  reporter: { handle: string; display_name: string } | null;
  owner: ProfileLite | null;
  resolver: { handle: string; display_name: string } | null;
};

type SameTargetRow = { id: string; target_type: string; target_id: string; status: string; reason: string; created_at: string };

type ActionLog = {
  id: string;
  action: string;
  reason: string;
  created_at: string;
  moderator: { handle: string; display_name: string } | null;
};

type QueueResult = {
  key: string;
  rows: ReportRow[];
  sameTarget: Map<string, SameTargetRow[]>;
  counts: { open: number; in_review: number };
  error: string | null;
};

type StatusFilter = 'todo' | 'open' | 'in_review' | 'actioned' | 'dismissed' | 'all';

const REPORT_SELECT = `id, reporter_id, target_type, target_id, target_owner_id, reason, details, evidence, status, created_at, resolved_at, resolution_note,
  reporter:profiles!reports_reporter_id_fkey(handle, display_name),
  owner:profiles!reports_target_owner_id_fkey(id, handle, display_name, status, verification_level, avatar_path, is_demo),
  resolver:profiles!reports_resolved_by_fkey(handle, display_name)`;

const key = (type: string, id: string) => `${type}:${id}`;
const EMPTY_MAP = new Map<string, SameTargetRow[]>();

function asRecord(value: Json): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json>) : {};
}

function str(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function snippet(r: ReportRow): string {
  const e = asRecord(r.evidence);
  const text = str(e.title) ?? str(e.body) ?? str(e.caption) ?? str(e.display_name) ?? str(e.bio) ?? '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t) return t.length > 110 ? `${t.slice(0, 109)}…` : t;
  return r.owner ? `Contenu de @${r.owner.handle}` : 'Aucun aperçu';
}

function statusTone(status: string): 'warn' | 'info' | 'ok' | 'neutral' {
  if (status === 'open') return 'warn';
  if (status === 'in_review') return 'info';
  if (status === 'actioned') return 'ok';
  return 'neutral';
}

export function ReportsQueue() {
  const { supabase } = useAdmin();
  const [status, setStatus] = useState<StatusFilter>('todo');
  const [type, setType] = useState<string>('all');
  const queryKey = `${status}|${type}`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const load = useCallback(async (): Promise<QueueResult> => {
    const loadKey = `${status}|${type}`;
    let q = supabase.from('reports').select(REPORT_SELECT);
    if (status === 'todo') q = q.in('status', ['open', 'in_review']);
    else if (status !== 'all') q = q.eq('status', status);
    if (type !== 'all') q = q.eq('target_type', type);
    const oldestFirst = status === 'todo' || status === 'open' || status === 'in_review';
    const { data, error: err } = await q
      .order('created_at', { ascending: oldestFirst })
      .limit(100)
      .overrideTypes<ReportRow[], { merge: false }>();
    const list = err ? [] : (data ?? []);
    const ids = [...new Set(list.map((r) => r.target_id))];
    const [same, openCount, reviewCount] = await Promise.all([
      ids.length
        ? supabase.from('reports').select('id, target_type, target_id, status, reason, created_at').in('target_id', ids).limit(1000)
        : Promise.resolve({ data: [] as SameTargetRow[], error: null }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
    ]);
    const map = new Map<string, SameTargetRow[]>();
    for (const r of (same.data ?? []) as SameTargetRow[]) {
      const k = key(r.target_type, r.target_id);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return {
      key: loadKey,
      rows: list,
      sameTarget: map,
      counts: { open: openCount.count ?? 0, in_review: reviewCount.count ?? 0 },
      error: err ? adminError(err) : null,
    };
  }, [supabase, status, type]);

  const { data: result, reload } = useLoader(load);
  const current = result?.key === queryKey ? result : null;
  const rows = current ? current.rows : null;
  const sameTarget = current?.sameTarget ?? EMPTY_MAP;
  const error = current?.error ?? null;
  const counts = result?.counts ?? null;

  const selected = useMemo(() => rows?.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const statusOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'todo', label: 'À traiter', count: counts ? counts.open + counts.in_review : undefined },
    { value: 'open', label: 'Nouveaux', count: counts?.open },
    { value: 'in_review', label: 'En cours', count: counts?.in_review },
    { value: 'actioned', label: 'Traités' },
    { value: 'dismissed', label: 'Classés' },
    { value: 'all', label: 'Tous' },
  ];

  return (
    <>
      <PageHead
        title="Signalements"
        intro="File d’attente des signalements des membres, du plus ancien au plus récent. Chaque décision est journalisée et peut être contestée."
      >
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
          <IconRefresh width={16} height={16} /> Actualiser
        </button>
      </PageHead>

      <div className="admin-filters">
        <Segmented label="Statut" value={status} options={statusOptions} onChange={setStatus} />
        <label className="select-field">
          <span className="sr-only">Type de contenu</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Tous les types</option>
            {Object.entries(TARGET_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {error ? <Notice notice={{ tone: 'error', text: error }} /> : null}

      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="admin-empty">
          <strong>Aucun signalement</strong>
          <span>{status === 'todo' ? 'Rien à traiter pour le moment.' : 'Aucun résultat pour ces filtres.'}</span>
        </div>
      ) : (
        <ul className="report-list" aria-label="Signalements">
          {rows.map((r) => {
            const same = sameTarget.get(key(r.target_type, r.target_id)) ?? [];
            const openSame = same.filter((s) => s.status === 'open' || s.status === 'in_review').length;
            return (
              <li key={r.id}>
                <button type="button" className="report-row" onClick={() => setSelectedId(r.id)} aria-haspopup="dialog">
                  <span className="report-row-main">
                    <span className="report-row-top">
                      <span className="report-reason">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>
                      <span className="report-type">{TARGET_TYPE_LABELS[r.target_type] ?? r.target_type}</span>
                      {openSame > 1 ? <span className="report-count">{openSame} signalements</span> : null}
                    </span>
                    <span className="report-snippet">{snippet(r)}</span>
                    <span className="report-sub">
                      {r.owner ? `@${r.owner.handle}` : 'Auteur inconnu'}
                      {r.owner?.status === 'suspended' ? ' · compte suspendu' : ''} · signalé {timeAgo(r.created_at)}
                    </span>
                  </span>
                  <StateChip tone={statusTone(r.status)}>{REPORT_STATUS_LABELS[r.status] ?? r.status}</StateChip>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <ReportDrawer
          key={selected.id}
          report={selected}
          sameTarget={sameTarget.get(key(selected.target_type, selected.target_id)) ?? []}
          onClose={() => setSelectedId(null)}
          onChanged={async (message) => {
            setNotice({ tone: 'success', text: message });
            await reload();
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

type EvidenceMedia = { label: string; kind: 'image' | 'video' | 'audio' | 'file'; bucket: 'public-media' | 'private-media'; path: string };

function kindFromPath(path: string, hint?: string | null): EvidenceMedia['kind'] {
  if (hint === 'image' || hint === 'video') return hint;
  if (/\.(jpe?g|png|webp|gif|heic)$/i.test(path)) return 'image';
  if (/\.(mp4|mov|webm|m4v)$/i.test(path)) return 'video';
  if (/\.(m4a|aac|mp3|ogg|oga|wav)$/i.test(path)) return 'audio';
  return hint === 'voice' ? 'audio' : 'file';
}

function evidenceMedia(type: string, evidence: Json): EvidenceMedia[] {
  const e = asRecord(evidence);
  const out: EvidenceMedia[] = [];
  if (type === 'product') {
    const img = str(e.image_path);
    const poster = str(e.poster_path);
    if (img) out.push({ label: 'Photo principale', kind: 'image', bucket: 'public-media', path: img });
    if (poster && poster !== img) out.push({ label: 'Aperçu', kind: 'image', bucket: 'public-media', path: poster });
  } else if (type === 'post' && Array.isArray(e.media)) {
    e.media.forEach((m, i) => {
      const r = asRecord(m);
      const path = str(r.path);
      if (!path) return;
      out.push({
        label: `Média ${i + 1}`,
        kind: kindFromPath(path, str(r.kind)),
        bucket: r.bucket === 'private-media' ? 'private-media' : 'public-media',
        path,
      });
    });
  } else if (type === 'story') {
    const path = str(e.path);
    if (path) out.push({ label: 'Statut', kind: kindFromPath(path, str(e.kind)), bucket: 'private-media', path });
  } else if (type === 'message') {
    const path = str(e.attachment_path);
    if (path) out.push({ label: 'Pièce jointe', kind: kindFromPath(path, str(e.kind)), bucket: 'private-media', path });
  }
  return out;
}

const EVIDENCE_LABELS: Record<string, string> = {
  title: 'Titre',
  price_xof: 'Prix',
  price_mode: 'Affichage du prix',
  condition: 'État',
  listing_mode: 'Mode',
  category_slug: 'Catégorie',
  city: 'Ville',
  description: 'Description',
  body: 'Texte',
  caption: 'Légende',
  handle: 'Nom d’utilisateur',
  display_name: 'Nom affiché',
  bio: 'Bio',
  visibility: 'Audience',
  rating: 'Note',
  status: 'Statut',
  kind: 'Type',
  sent_at: 'Envoyé le',
};

const KIND_LABELS: Record<string, string> = { image: 'Photo', video: 'Vidéo', text: 'Texte', voice: 'Message vocal', product: 'Fiche article', offer: 'Offre', system: 'Message système' };
const VISIBILITY_LABELS: Record<string, string> = { public: 'Tout le monde', followers: 'Abonnés', friends: 'Amis' };

const HIDDEN_EVIDENCE_KEYS = new Set(['media', 'image_path', 'poster_path', 'path', 'attachment_path', 'id', 'seller_id', 'conversation_id', 'post_id', 'live_session_id']);

function formatEvidenceValue(k: string, v: Json): string {
  if (v === null || v === undefined) return '—';
  if (k === 'price_xof' && typeof v === 'number') return xof(v);
  if (k === 'price_mode' && typeof v === 'string') return PRICE_MODES.find((m) => m.key === v)?.label ?? v;
  if (k === 'condition' && typeof v === 'string') return CONDITION_LABELS[v as keyof typeof CONDITION_LABELS] ?? v;
  if (k === 'listing_mode' && typeof v === 'string') return LISTING_MODE_LABELS[v as keyof typeof LISTING_MODE_LABELS] ?? v;
  if (k === 'sent_at' && typeof v === 'string') return formatDateTime(v);
  if (k === 'rating' && typeof v === 'number') return `${v}/5`;
  if (k === 'kind' && typeof v === 'string') return KIND_LABELS[v] ?? v;
  if (k === 'visibility' && typeof v === 'string') return VISIBILITY_LABELS[v] ?? v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function useResolvedMedia(supabase: SupabaseClient, items: EvidenceMedia[]) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const sig = items.map((i) => `${i.bucket}/${i.path}`).join('|');
  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string | null> = {};
      for (const m of items) {
        const k = `${m.bucket}/${m.path}`;
        if (m.bucket === 'public-media') {
          next[k] = publicStorageUrl(env.supabaseUrl, 'public-media', m.path);
        } else {
          // Staff may read private evidence referenced by a report (storage RLS); 5 min URL.
          const { data } = await supabase.storage.from('private-media').createSignedUrl(m.path, 300);
          next[k] = data?.signedUrl ?? null;
        }
      }
      if (alive) setUrls(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, sig]);
  return urls;
}

type ActionSpec = {
  action: string;
  label: string;
  tone: 'danger' | 'dark' | 'primary';
  targetType: string;
  targetId: string;
  description: string;
  adminOnly?: boolean;
};

function ReportDrawer({
  report,
  sameTarget,
  onClose,
  onChanged,
}: {
  report: ReportRow;
  sameTarget: SameTargetRow[];
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const { supabase, role } = useAdmin();
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const untyped = supabase as unknown as SupabaseClient;

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  const targetType = report.target_type;
  const targetId = report.target_id;

  const loadDetail = useCallback(async (): Promise<{ history: ActionLog[]; targetState: string | null }> => {
    const tbl = TARGET_TABLES[targetType];
    const [hist, state] = await Promise.all([
      supabase
        .from('moderation_actions')
        .select('id, action, reason, created_at, moderator:profiles!moderation_actions_moderator_id_fkey(handle, display_name)')
        .eq('target_id', targetId)
        .order('created_at', { ascending: false })
        .limit(50)
        .overrideTypes<ActionLog[], { merge: false }>(),
      tbl ? untyped.from(tbl.table).select(tbl.column).eq('id', targetId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const row = state.data as Record<string, string> | null;
    return { history: hist.data ?? [], targetState: tbl && row ? (row[tbl.column] ?? null) : null };
  }, [supabase, untyped, targetType, targetId]);

  const { data: detail, reload: reloadDetail } = useLoader(loadDetail);
  const history = detail?.history ?? null;
  const targetState: string | null | undefined = detail ? detail.targetState : undefined;

  const media = useMemo(() => evidenceMedia(report.target_type, report.evidence), [report]);
  const urls = useResolvedMedia(untyped, media);

  const r = report;
  const owner = r.owner;
  const evidence = asRecord(r.evidence);
  const isResolved = r.status === 'actioned' || r.status === 'dismissed';
  const link = publicPath(r.target_type, r.target_id, owner?.handle);
  const userTargetType = r.target_type === 'agreement' ? 'profile' : r.target_type;
  const userTargetId = r.target_type === 'agreement' ? (owner?.id ?? r.target_id) : r.target_id;

  const actions: ActionSpec[] = [];
  if (CONTENT_TYPES.has(r.target_type)) {
    if (r.target_type === 'message') {
      actions.push({
        action: 'remove_content',
        label: 'Supprimer le message',
        tone: 'danger',
        targetType: r.target_type,
        targetId: r.target_id,
        description: 'Le message est retiré de la conversation pour les deux membres.',
      });
    } else {
      if (targetState !== 'hidden')
        actions.push({
          action: 'hide_content',
          label: 'Masquer',
          tone: 'dark',
          targetType: r.target_type,
          targetId: r.target_id,
          description: 'Le contenu n’est plus visible par les autres membres (son auteur le voit encore). Réversible.',
        });
      if (targetState !== 'removed')
        actions.push({
          action: 'remove_content',
          label: 'Supprimer',
          tone: 'danger',
          targetType: r.target_type,
          targetId: r.target_id,
          description: 'Le contenu est retiré pour tout le monde. Réversible avec «\u00A0Rétablir\u00A0» ou après contestation.',
        });
      if (targetState === 'hidden' || targetState === 'removed')
        actions.push({
          action: 'restore_content',
          label: 'Rétablir',
          tone: 'primary',
          targetType: r.target_type,
          targetId: r.target_id,
          description: 'Le contenu redevient visible selon ses réglages d’audience.',
        });
    }
  }
  if (owner) {
    actions.push({
      action: 'warn_user',
      label: 'Avertir le membre',
      tone: 'dark',
      targetType: userTargetType,
      targetId: userTargetId,
      description: 'Le membre reçoit un avertissement avec votre motif. Aucun contenu n’est modifié.',
    });
    if (owner.status === 'active')
      actions.push({
        action: 'suspend_user',
        label: 'Suspendre le compte',
        tone: 'danger',
        targetType: userTargetType,
        targetId: userTargetId,
        description:
          'Le membre ne peut plus publier, écrire ni interagir, et son profil n’est plus visible publiquement. Il peut contester la décision.',
      });
    else
      actions.push({
        action: 'unsuspend_user',
        label: 'Réactiver le compte',
        tone: 'primary',
        targetType: userTargetType,
        targetId: userTargetId,
        description: 'Le compte redevient actif.',
      });
    if (owner.verification_level === 'merchant_verified')
      actions.push({
        action: 'revoke_verification',
        label: 'Retirer la vérification',
        tone: 'danger',
        targetType: 'profile',
        targetId: owner.id,
        description: 'Le badge «\u00A0Vendeur vérifié\u00A0» est retiré du profil.',
        adminOnly: true,
      });
  }
  if (!isResolved)
    actions.push({
      action: 'dismiss_report',
      label: 'Classer sans suite',
      tone: 'dark',
      targetType: r.target_type,
      targetId: r.target_id,
      description: 'Le signalement et les doublons ouverts sur ce contenu sont classés. Les signaleurs en sont informés.',
    });

  function ask(spec: ActionSpec) {
    setConfirm({
      title: spec.label,
      description: (
        <>
          <p>{spec.description}</p>
          {spec.action !== 'dismiss_report' ? (
            <p className="muted small" style={{ marginTop: 6 }}>
              Le membre concerné est notifié&nbsp;; le début du motif figure dans sa notification.
            </p>
          ) : null}
        </>
      ),
      confirmLabel: 'Confirmer',
      tone: spec.tone,
      reason: { label: 'Motif', required: true, placeholder: 'Règle enfreinte, éléments constatés…' },
      run: async (reason) => {
        const { error } = await supabase.rpc('moderate', {
          p_action: spec.action,
          p_target_type: spec.targetType,
          p_target_id: spec.targetId,
          p_report_id: r.id,
          p_reason: reason,
        });
        if (error) throw new Error(adminError(error));
        setNotice({ tone: 'success', text: `${MODERATION_ACTION_LABELS[spec.action] ?? spec.action}\u00A0: action enregistrée.` });
        await Promise.all([onChanged(`${MODERATION_ACTION_LABELS[spec.action] ?? spec.action}\u00A0: action enregistrée.`), reloadDetail()]);
      },
    });
  }

  async function setStatus(next: 'open' | 'in_review') {
    setNotice(null);
    const { error } = await supabase.rpc('set_report_status', { p_report_id: r.id, p_status: next });
    if (error) {
      setNotice({ tone: 'error', text: adminError(error) });
      return;
    }
    const msg = next === 'in_review' ? 'Signalement pris en charge.' : 'Signalement remis en attente.';
    setNotice({ tone: 'success', text: msg });
    await onChanged(msg);
  }

  const order = Object.keys(EVIDENCE_LABELS);
  const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k));
  const evidenceEntries = Object.entries(evidence)
    .filter(([k]) => !HIDDEN_EVIDENCE_KEYS.has(k))
    .sort(([a], [b]) => rank(a) - rank(b));

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="drawer-title" onClose={onClose}>
      <div className="drawer-inner">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">{TARGET_TYPE_LABELS[r.target_type] ?? r.target_type}</p>
            <h2 id="drawer-title">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer le détail">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body">
          <Notice notice={notice} onDismiss={() => setNotice(null)} />

          <div className="drawer-status">
            <StateChip tone={statusTone(r.status)}>{REPORT_STATUS_LABELS[r.status]}</StateChip>
            {targetState ? (
              <StateChip tone={targetState === 'active' ? 'ok' : 'danger'}>
                Contenu&nbsp;: {MODERATION_STATE_LABELS[targetState] ?? targetState}
              </StateChip>
            ) : null}
            {r.status === 'open' ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void setStatus('in_review')}>
                Prendre en charge
              </button>
            ) : null}
            {r.status === 'in_review' ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void setStatus('open')}>
                Remettre en attente
              </button>
            ) : null}
          </div>

          <section className="drawer-section">
            <h3>Signalement</h3>
            <dl className="kv">
              <div>
                <dt>Reçu</dt>
                <dd>{formatDateTime(r.created_at)}</dd>
              </div>
              <div>
                <dt>Par</dt>
                <dd>{r.reporter ? `${r.reporter.display_name} (@${r.reporter.handle})` : 'Membre supprimé'}</dd>
              </div>
              <div>
                <dt>Précisions</dt>
                <dd className="prewrap">{r.details.trim() || '—'}</dd>
              </div>
              <div>
                <dt>Pour ce contenu</dt>
                <dd>
                  {sameTarget.length} {sameTarget.length > 1 ? 'signalements' : 'signalement'}
                  {sameTarget.length > 1 ? (
                    <span className="muted">
                      {' '}
                      ({Object.entries(
                        sameTarget.reduce<Record<string, number>>((acc, s) => {
                          acc[s.reason] = (acc[s.reason] ?? 0) + 1;
                          return acc;
                        }, {}),
                      )
                        .map(([k, n]) => `${REPORT_REASON_LABELS[k] ?? k} × ${n}`)
                        .join(', ')}
                      )
                    </span>
                  ) : null}
                </dd>
              </div>
              {isResolved ? (
                <div>
                  <dt>Décision</dt>
                  <dd>
                    {formatDateTime(r.resolved_at)}
                    {r.resolver ? ` · @${r.resolver.handle}` : ''}
                    {r.resolution_note ? <span className="prewrap" style={{ display: 'block' }}>{r.resolution_note}</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Membre concerné</h3>
            {owner ? (
              <div className="owner-card">
                <Avatar src={publicStorageUrl(env.supabaseUrl, 'avatars', owner.avatar_path)} name={owner.display_name} size={40} />
                <div style={{ minWidth: 0 }}>
                  <strong>{owner.display_name}</strong>
                  <div className="muted small">
                    @{owner.handle}
                    {owner.verification_level === 'merchant_verified' ? ' · vendeur vérifié' : ''}
                    {owner.is_demo ? ' · DÉMO' : ''}
                  </div>
                </div>
                <StateChip tone={owner.status === 'active' ? 'ok' : 'danger'}>{owner.status === 'active' ? 'Actif' : 'Suspendu'}</StateChip>
              </div>
            ) : (
              <p className="muted small">Aucun propriétaire identifié pour ce contenu.</p>
            )}
            {link ? (
              <a className="drawer-link" href={link} target="_blank" rel="noopener noreferrer">
                Voir la page publique <IconExternal width={15} height={15} />
              </a>
            ) : null}
          </section>

          <section className="drawer-section">
            <h3>Preuve (copie au moment du signalement)</h3>
            {media.length > 0 ? (
              <div className="evidence-media">
                {media.map((m) => {
                  const url = urls[`${m.bucket}/${m.path}`];
                  return (
                    <figure key={`${m.bucket}/${m.path}`}>
                      {url === undefined ? (
                        <div className="evidence-missing">Chargement…</div>
                      ) : url === null ? (
                        <div className="evidence-missing">Média privé inaccessible ou supprimé</div>
                      ) : m.kind === 'image' ? (
                        <img src={url} alt={m.label} loading="lazy" />
                      ) : m.kind === 'video' ? (
                        <video src={url} controls preload="metadata" />
                      ) : m.kind === 'audio' ? (
                        <audio src={url} controls preload="none" />
                      ) : (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          Ouvrir le fichier
                        </a>
                      )}
                      <figcaption>
                        {m.label} · {m.bucket === 'private-media' ? 'privé (lien 5 min)' : 'public'}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : null}
            {evidenceEntries.length > 0 ? (
              <dl className="kv">
                {evidenceEntries.map(([k, v]) => (
                  <div key={k}>
                    <dt>{EVIDENCE_LABELS[k] ?? k}</dt>
                    <dd className="prewrap">{formatEvidenceValue(k, v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted small">Aucune donnée copiée.</p>
            )}
            <details className="raw-json">
              <summary>Données brutes</summary>
              <pre>{JSON.stringify(r.evidence, null, 2)}</pre>
            </details>
          </section>

          <section className="drawer-section">
            <h3>Décider</h3>
            <div className="action-grid">
              {actions.map((a) => {
                const locked = a.adminOnly && role !== 'admin';
                return (
                  <button
                    key={a.action}
                    type="button"
                    className={`btn btn-sm ${a.tone === 'danger' ? 'btn-outline action-danger' : a.tone === 'primary' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => ask(a)}
                    disabled={locked}
                    title={locked ? 'Réservé aux administrateurs' : undefined}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            {isResolved ? <p className="muted small" style={{ marginTop: 8 }}>Ce signalement est déjà traité&nbsp;; une nouvelle action sera ajoutée au journal.</p> : null}
          </section>

          <section className="drawer-section">
            <h3>Historique de modération du contenu</h3>
            {history === null ? (
              <Loading />
            ) : history.length === 0 ? (
              <p className="muted small">Aucune action précédente.</p>
            ) : (
              <ol className="timeline">
                {history.map((h) => (
                  <li key={h.id}>
                    <strong>{MODERATION_ACTION_LABELS[h.action] ?? h.action}</strong>
                    <span className="muted small">
                      {' '}
                      · {formatDateTime(h.created_at)}
                      {h.moderator ? ` · @${h.moderator.handle}` : ''}
                    </span>
                    {h.reason ? <p className="prewrap small">{h.reason}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </dialog>
  );
}
