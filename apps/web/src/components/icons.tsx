import type { SVGProps } from 'react';

/** Minimal stroke icon set (24px grid, 1.75 stroke). Decorative by default. */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconVerified = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden focusable="false" {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
);

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const IconHand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 11.5V6.8a1.4 1.4 0 012.8 0V11M9.8 10.5V5.4a1.4 1.4 0 012.8 0v5.1M12.6 10.6V6.3a1.4 1.4 0 012.8 0v5.4M15.4 9.3a1.4 1.4 0 012.8 0v4.9a6.3 6.3 0 01-6.3 6.3h-.6a6 6 0 01-4.7-2.3l-2.7-3.5a1.5 1.5 0 012.3-1.9L7 14" />
  </Icon>
);

export const IconTruck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icon>
);

export const IconBox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Icon>
);

export const IconHeart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0112 7.4a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" />
  </Icon>
);

export const IconUpvote = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l7 8h-4v8H9v-8H5z" />
  </Icon>
);

export const IconComment = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 11.5a8 8 0 01-11.7 7.1L4 20l1.4-4.4A8 8 0 1120.5 11.5z" />
  </Icon>
);

export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4.5 4.5 0 006.4.4l2.6-2.6a4.5 4.5 0 00-6.4-6.4l-1.3 1.3" />
    <path d="M14 10a4.5 4.5 0 00-6.4-.4L5 12.2a4.5 4.5 0 006.4 6.4l1.3-1.3" />
  </Icon>
);

export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11M7.5 8L12 3.5 16.5 8" />
    <path d="M5 12.5v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
  </Icon>
);

export const IconMessage = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5h16v10.5H9l-5 4z" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5l-4.5-4.5-8 8.5" />
  </Icon>
);

export const IconPlay = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden focusable="false" {...p}>
    <path fill="currentColor" d="M8 5.5v13l10.5-6.5z" />
  </svg>
);

export const IconStar = ({ filled = true, ...p }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden focusable="false" {...p}>
    <path
      d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </svg>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.1" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l9 16H3z" />
    <path d="M12 10v4.5M12 17.2v.1" />
  </Icon>
);

export const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0z" />
    <circle cx="8" cy="8" r="1.4" />
  </Icon>
);

export const IconSwap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Icon>
);

export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5h4a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-4M10 16.5L5.5 12 10 7.5M5.5 12H15" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 01-13.1 5M4.5 12a7.5 7.5 0 0113.1-5" />
    <path d="M18 3.5V7.3h-3.8M6 20.5v-3.8h3.8" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const IconExternal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 014 18.5v-10A1.5 1.5 0 015.5 7H10" />
  </Icon>
);

/** Push pin — « Épinglé » (pinned to the top of a profile). Distinct from IconPin (location). */
export const IconPushpin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3.5h6M10 3.5l-.6 5.8L6.5 12.5v1.5h11v-1.5l-2.9-3.2L14 3.5M12 14v6.5" />
  </Icon>
);
