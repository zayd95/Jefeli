import { toFrenchError } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ban, BellOff, Flag, Pencil, Pin, PinOff, Share2, Trash2, Clock3 } from 'lucide-react-native';
import { Alert, Platform } from 'react-native';

import { Sheet, SheetAction, useToast } from '@/design';
import { block, mute } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';
import type { ReportTarget } from '@/lib/api/safety';

export function confirmAsync(title: string, message: string, confirmLabel: string, destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm ? globalThis.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Contextual actions on someone's content: share, report, mute, block — or edit/delete for
 * the owner. Every report/block goes to the real backend.
 */
export function ContentMenu({
  visible,
  onClose,
  ownerId,
  ownerName,
  target,
  onShare,
  onEdit,
  onDelete,
  deleteLabel = 'Supprimer',
  pin,
  onShareToStatus,
}: {
  visible: boolean;
  onClose: () => void;
  ownerId: string;
  ownerName: string;
  target: { type: ReportTarget; id: string };
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  /** Owner-only: pin to / unpin from the profile (max 3 per kind, enforced by the database). */
  pin?: { pinned: boolean; onToggle: () => void };
  /** Owner-only (W1.2): a 24-hour status pointing to this publication or article. */
  onShareToStatus?: () => void;
}) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const isOwner = userId === ownerId;

  const run = (fn: () => void | Promise<void>) => async () => {
    onClose();
    try {
      await fn();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} tone="dark">
      {onShare ? <SheetAction icon={Share2} label="Partager" onPress={run(onShare)} /> : null}
      {isOwner && pin ? (
        <SheetAction icon={pin.pinned ? PinOff : Pin} label={pin.pinned ? 'Retirer de mon profil' : 'Épingler sur mon profil'} onPress={run(pin.onToggle)} />
      ) : null}
      {isOwner && onShareToStatus ? <SheetAction icon={Clock3} label="Partager en statut" description="24 heures, sans renvoyer les fichiers." onPress={run(onShareToStatus)} /> : null}
      {isOwner && onEdit ? <SheetAction icon={Pencil} label="Modifier" onPress={run(onEdit)} /> : null}
      {isOwner && onDelete ? (
        <SheetAction
          icon={Trash2}
          label={deleteLabel}
          destructive
          onPress={run(async () => {
            if (await confirmAsync(`${deleteLabel} ?`, 'Cette action est définitive.', deleteLabel)) {
              await onDelete();
              toast('Supprimé', 'success');
            }
          })}
        />
      ) : null}
      {!isOwner ? (
        <>
          <SheetAction
            icon={Flag}
            label="Signaler"
            description="Arnaque, article interdit, harcèlement…"
            onPress={run(() => router.push({ pathname: '/report', params: { type: target.type, id: target.id } }))}
          />
          <SheetAction
            icon={BellOff}
            label={`Masquer ${ownerName}`}
            description="Ses publications n’apparaîtront plus dans votre fil."
            onPress={run(async () => {
              await mute(userId ?? '', ownerId);
              qc.invalidateQueries({ queryKey: ['feed'] });
              toast(`${ownerName} est masqué(e)`, 'success');
            })}
          />
          <SheetAction
            icon={Ban}
            label={`Bloquer ${ownerName}`}
            destructive
            description="Vous ne pourrez plus vous voir ni vous écrire."
            onPress={run(async () => {
              if (await confirmAsync(`Bloquer ${ownerName} ?`, 'Vos abonnements mutuels et vos liens d’amitié seront supprimés.', 'Bloquer')) {
                await block(userId ?? '', ownerId);
                qc.invalidateQueries();
                toast(`${ownerName} est bloqué(e)`, 'success');
              }
            })}
          />
        </>
      ) : null}
    </Sheet>
  );
}
