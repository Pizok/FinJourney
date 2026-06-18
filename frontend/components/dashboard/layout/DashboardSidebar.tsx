'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Route,
  SlidersHorizontal,
  BarChart3,
  ShoppingBag,
  Settings,
  Lock,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { initial, hpBarColor } from '../utils/dashboard.helpers';

// ─── Nav Item Types ─────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  locked?: boolean;
  lockLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, locked: false, lockLabel: 'Level 3' },
  { label: 'Journey', href: '/journey', icon: Route },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive = false,
}: {
  item: NavItem;
  isActive?: boolean;
}) {
  const Icon = item.icon;

  if (item.locked) {
    return (
      <div
        className="flex items-center gap-4 px-6 py-3 opacity-40 cursor-not-allowed select-none min-w-max"
        aria-disabled="true"
        title={item.label}
      >
        <Icon size={20} strokeWidth={2} className="text-muted-text flex-shrink-0" />
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="font-sans text-sm text-muted-text flex-1">
            {item.label}
          </span>
          {item.lockLabel && (
            <span className="font-sans text-[10px] uppercase tracking-widest text-muted-text border border-tactical-border rounded px-1.5 py-0.5">
              {item.lockLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-4 px-6 py-3 transition-all duration-150 min-w-max relative',
        isActive
          ? 'bg-abyssal-slate/50 text-pearl-text'
          : 'text-muted-text hover:text-pearl-text hover:bg-abyssal-slate/50',
      ].join(' ')}
      title={item.label}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted-emerald rounded-r-full" />
      )}
      
      <Icon
        size={20}
        strokeWidth={2}
        className={[
          'flex-shrink-0 transition-colors',
          isActive
            ? 'text-muted-emerald'
            : 'text-muted-text group-hover:text-pearl-text',
        ].join(' ')}
      />
      <span className="font-sans text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {item.label}
      </span>
    </Link>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const { data } = useDashboardData();
  const { profile, player_state, feature_unlocks } = data;
  const pathname = usePathname();

  const avatarLetter = initial(profile.avatar_class);
  const hpColor = hpBarColor(player_state.hp);

  // Build nav items with dynamic analytics lock state
  const navItems = NAV_ITEMS.map((item) => {
    if (item.href === '/analytics') {
      return { ...item, locked: !feature_unlocks.analytics };
    }
    return item;
  });

  return (
    <>
      {/* Invisible placeholder to reserve width in the flex container */}
      <div className="w-20 flex-shrink-0 hidden md:block" aria-hidden="true" />

      {/* The actual absolute sidebar that expands on hover */}
      <aside className="group w-20 hover:w-64 transition-all duration-300 ease-out h-screen fixed top-0 left-0 z-50 bg-canvas-surface border-r border-tactical-border flex flex-col overflow-x-hidden overflow-y-auto">

        {/* Header */}
        <div className="h-[77px] flex items-center px-6 border-b border-tactical-border flex-shrink-0">
          <div className="flex items-center gap-4 min-w-max">
            <Image src="/logo/logo.svg" alt="FinJourney Logo" width={28} height={28} className="flex-shrink-0" />
            <span className="font-display text-sm font-semibold text-pearl-text tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              FinJourney
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 py-4 space-y-1" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="py-4 border-t border-tactical-border space-y-1">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {/* Standby Tokens */}
          <div className="flex items-center gap-4 px-6 py-3 mt-1 min-w-max" title="Standby tokens">
            <Lock size={20} strokeWidth={2} className="text-muted-text flex-shrink-0" />
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-1">
              <span className="font-sans text-xs text-muted-text whitespace-nowrap">
                Standby tokens
              </span>
              <span className="ml-auto font-sans text-xs text-pearl-text font-medium pl-4">
                {player_state.standby_tokens}/7
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
