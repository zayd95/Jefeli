/**
 * Desktop web shell (W1.4): a persistent Atlantic-night sidebar around the same screens the
 * phone uses. Only mounted when useLayout().desktop (web ≥ 768 px); phones keep the dock.
 * « Créer » opens the same smart creation menu as the dock (Statut · Publication · Article).
 */
import { useQuery } from '@tanstack/react-query';
import { Link, router, usePathname } from 'expo-router';
import { Bell, Bookmark, Compass, House, MessageCircle, Plus, Search, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CreateMenu } from '@/components/CreateMenu';
import { Avatar, BrandLogo, BrandMark, colors, dark, DemoBadge, spacing, Text } from '@/design';
import { fetchUnreadCount } from '@/lib/api/messages';
import { fetchUnreadNotificationCount } from '@/lib/api/notifications';
import { useAuth } from '@/lib/auth';
import { SIDEBAR_COMPACT, SIDEBAR_WIDE, useLayout } from '@/lib/layout';

/**
 * Screens with their own desktop layout (feed + rail, grids, two columns, workspace, editor + preview,
 * phone-proportion stages). Every other screen — forms, settings, lists, details — reads in a
 * centred 720 px column instead of stretching across the window.
 */
const OWN_LAYOUT = ['/explore', '/p/', '/u/', '/profile', '/messages', '/chat', '/publish/post', '/statut', '/highlight'];
/** Dark screens read in the column on the night background rather than in a light frame. */
const DARK_FRAME = ['/publish/status', '/post/'];
function ownLayout(pathname: string): boolean {
  return pathname === '/' || OWN_LAYOUT.some((p) => pathname.startsWith(p));
}

type Item = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean; badge?: number };

export function DesktopShell({ children }: { children: ReactNode }) {
  const { wide } = useLayout();
  const pathname = usePathname();
  const { userId, profile } = useAuth();
  const [creating, setCreating] = useState(false);
  const unreadMessages = useQuery({ queryKey: ['unread-messages'], queryFn: fetchUnreadCount, enabled: !!userId, refetchInterval: 60_000 });
  const unreadNotifs = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => fetchUnreadNotificationCount(userId as string),
    enabled: !!userId,
    refetchInterval: 90_000,
  });
  // Messages is a three-pane workspace: it keeps the icon rail even on wide screens.
  const darkFrame = DARK_FRAME.some((p) => pathname.startsWith(p));
  const compact = !wide || pathname.startsWith('/messages') || pathname.startsWith('/chat');

  const items: Item[] = [
    { href: '/', label: 'Accueil', icon: House, match: (p) => p === '/' },
    { href: '/explore', label: 'Explorer', icon: Compass, match: (p) => p.startsWith('/explore') || p.startsWith('/p/') },
    { href: '/search', label: 'Rechercher', icon: Search, match: (p) => p.startsWith('/search') },
    { href: '/messages', label: 'Messages', icon: MessageCircle, match: (p) => p.startsWith('/messages') || p.startsWith('/chat'), badge: unreadMessages.data ?? 0 },
    { href: '/notifications', label: 'Notifications', icon: Bell, match: (p) => p.startsWith('/notifications'), badge: unreadNotifs.data ?? 0 },
    { href: '/saved', label: 'Enregistrés', icon: Bookmark, match: (p) => p.startsWith('/saved') },
    { href: '/profile', label: 'Mon profil', icon: UserRound, match: (p) => p.startsWith('/profile') || (!!profile?.handle && p === `/u/${profile.handle}`) },
    { href: '/settings', label: 'Réglages', icon: SlidersHorizontal, match: (p) => p.startsWith('/settings') },
  ];

  return (
    <View style={styles.row}>
      <View style={[styles.sidebar, { width: compact ? SIDEBAR_COMPACT : SIDEBAR_WIDE }, compact && styles.sidebarCompact]} accessibilityRole="navigation" aria-label="Navigation principale">
        <Pressable onPress={() => router.push('/')} accessibilityRole="link" accessibilityLabel="Jëfëli, accueil" style={[styles.brand, compact && { paddingHorizontal: 0 }]}>
          {compact ? <BrandMark height={32} /> : <BrandLogo height={30} />}
        </Pressable>
        <View style={{ gap: 2 }}>
          {items.map((item) => (
            <NavItem key={item.href} item={item} on={item.match(pathname)} compact={compact} />
          ))}
        </View>
        <Pressable
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          accessibilityLabel="Créer"
          accessibilityHint="Ouvre le menu : statut, publication ou article"
          style={({ pressed }) => [styles.create, compact && styles.createCompact, pressed && { opacity: 0.85 }]}
        >
          <Plus size={20} color={colors.night} strokeWidth={2.6} />
          {!compact ? (
            <Text weight="800" color={colors.night} style={{ fontSize: 16 }}>
              Créer
            </Text>
          ) : null}
        </Pressable>
        {profile ? (
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="link"
            accessibilityLabel={`Mon profil : ${profile.display_name}`}
            style={[styles.me, compact && styles.meCompact]}
          >
            <Avatar path={profile.avatar_path} name={profile.display_name} size={38} />
            {!compact ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text weight="700" color={dark.text} numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
                    {profile.display_name}
                  </Text>
                  {profile.is_demo ? <DemoBadge tone="dark" /> : null}
                </View>
                <Text variant="caption" color={dark.textSecondary} numberOfLines={1}>
                  @{profile.handle}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.content, darkFrame && { backgroundColor: colors.night }]}>
        {ownLayout(pathname) ? children : <View style={[styles.column, darkFrame && { borderColor: dark.border }]}>{children}</View>}
      </View>
      <CreateMenu visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

/** A real <a href> (Enter follows it; the browser can open it in a new tab), styled like the dock items. */
function NavItem({ item, on, compact }: { item: Item; on: boolean; compact: boolean }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  const label = item.badge ? `${item.label}, ${item.badge} non lus` : item.label;
  return (
    <Link href={item.href as never} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        aria-current={on ? 'page' : undefined}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={StyleSheet.flatten([styles.item, compact && styles.itemCompact, on ? styles.itemOn : hovered && styles.itemHover])}
      >
        <View>
          <Icon size={22} color={on ? dark.mint : dark.textStrong} strokeWidth={on ? 2.2 : 1.9} />
          {item.badge && compact ? <View style={styles.dot} /> : null}
        </View>
        {!compact ? (
          <Text weight={on ? '800' : '600'} color={on ? dark.mint : dark.textStrong} style={{ fontSize: 16, flex: 1 }}>
            {item.label}
          </Text>
        ) : null}
        {!compact && item.badge ? (
          <View style={styles.badge}>
            <Text variant="micro" weight="800" color={colors.white} style={{ fontSize: 11, lineHeight: 13 }}>
              {item.badge > 99 ? '99+' : item.badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: colors.night },
  sidebar: { backgroundColor: colors.night, borderRightWidth: 1, borderRightColor: dark.border, paddingTop: 24, paddingBottom: 18, paddingHorizontal: 14, gap: 18 },
  sidebarCompact: { paddingHorizontal: 10, alignItems: 'center' },
  brand: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 46, paddingHorizontal: 12, borderRadius: 12 },
  itemCompact: { width: 50, justifyContent: 'center', paddingHorizontal: 0 },
  itemOn: { backgroundColor: dark.mintSelected },
  itemHover: { backgroundColor: dark.subtle },
  badge: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.live },
  create: { height: 50, borderRadius: 999, backgroundColor: colors.mint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  createCompact: { width: 50 },
  me: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: dark.subtle },
  meCompact: { padding: 4, backgroundColor: 'transparent' },
  content: { flex: 1, minWidth: 0, backgroundColor: colors.background },
  column: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
});
