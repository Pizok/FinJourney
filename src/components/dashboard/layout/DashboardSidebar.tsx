'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase.client';
import { apiFetchClient } from '@/lib/apiClient.client';
import {
  LayoutDashboard,
  Landmark,
  Route,
  SlidersHorizontal,
  BarChart3,
  ShoppingBag,
  Settings,
  Lock,
  LogOut,
  Menu,
  X,
  Flame,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
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
  { label: 'Finance', href: '/finance', icon: Landmark },
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
  onClick,
}: {
  item: NavItem;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  if (item.locked) {
    return (
      <div
        className="flex items-center gap-4 px-6 py-3 opacity-40 cursor-not-allowed select-none min-w-max"
        aria-disabled="true"
        title={item.label}
      >
        <Icon
          size={24}
          strokeWidth={2}
          className="flex-shrink-0 text-muted-text group-hover/link:text-muted-emerald transition-colors"
        />
        <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex-1">
          <span className="font-sans text-sm text-muted-text font-medium group-hover/link:text-pearl-text transition-colors">
            {item.label}
          </span>
          <span className="ml-auto text-xs font-semibold text-muted-text bg-tactical-border/50 px-2 py-0.5 rounded flex items-center gap-1.5 whitespace-nowrap">
            <Lock size={10} strokeWidth={2.5} />
            {item.lockLabel || 'LOCKED'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
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
        size={24}
        strokeWidth={2}
        className={[
          'flex-shrink-0 transition-colors',
          isActive ? 'text-muted-emerald' : 'text-muted-text group-hover/link:text-pearl-text',
        ].join(' ')}
      />
      <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <span className="font-sans text-sm">{item.label}</span>
      </div>
    </Link>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { data } = useDashboardData();
  const setData = useDashboardStore(s => s.setData);
  const pathname = usePathname();
  const router = useRouter();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!data) {
      apiFetchClient('/me/bootstrap')
        .then((res: any) => {
          if (res) {
            setData(res);
          }
        })
        .catch((err: any) => console.error("Failed to fetch dashboard sidebar data:", err));
    }
  }, [data, setData]);

  if (!data) {
    return (
      <>
        <div className="w-20 flex-shrink-0 hidden md:block" aria-hidden="true" />
        <aside className="w-20 h-screen fixed top-0 left-0 z-50 bg-canvas-surface border-r border-tactical-border animate-pulse" />
      </>
    );
  }

  const { profile, player_state, feature_unlocks } = data;


  const avatarLetter = initial(profile.avatar_key ?? profile.username ?? 'U');
  const hpColor = hpBarColor(player_state?.hp ?? 100);

  // Build nav items with dynamic analytics lock state
  const navItems = NAV_ITEMS.map((item) => {
    if (item.href === '/analytics') {
      return { ...item, locked: !feature_unlocks.analytics };
    }
    return item;
  });

  async function handleLogout() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      router.push('/auth');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to logout');
    }
  }

  return (
    <>
      {/* Invisible placeholder to reserve width in the flex container on desktop */}
      <div className="w-20 flex-shrink-0 hidden md:block" aria-hidden="true" />

      {/* Mobile Floating Burger Button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className={[
          'md:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full shadow-lg',
          'bg-muted-emerald text-white hover:bg-muted-emerald/90 transition-transform active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pearl-text',
          isMobileOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        ].join(' ')}
        aria-label="Open navigation menu"
      >
        <Menu size={24} strokeWidth={2.5} />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-abyssal-slate/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The Sidebar */}
      <aside className={[
        'fixed top-0 left-0 h-screen z-50 bg-canvas-surface border-r border-tactical-border flex flex-col',
        'overflow-x-hidden overflow-y-auto transition-all duration-300 ease-out',
        // Desktop styling
        'md:w-20 md:hover:w-64 group',
        // Mobile styling
        'w-64',
        isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      ].join(' ')}>

        {/* Header */}
        <div className="h-[77px] flex items-center px-6 border-b border-tactical-border flex-shrink-0 justify-between">
          <div className="flex items-center gap-4 min-w-max">
            <Image src="/logo/logo.svg" alt="FinJourney Logo" width={28} height={28} className="flex-shrink-0" />
            <span className="font-display text-sm font-semibold text-pearl-text tracking-wide uppercase opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
              FinJourney
            </span>
          </div>
          <button 
            className="md:hidden text-muted-text hover:text-pearl-text p-1" 
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 py-4 space-y-1" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              onClick={() => setIsMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="py-4 border-t border-tactical-border space-y-1">
          <div className="flex items-center gap-4 px-6 py-3 mt-1 min-w-max" title="Standby tokens">
            <Lock size={20} strokeWidth={2} className="text-muted-text flex-shrink-0" />
            <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex-1">
              <span className="font-sans text-xs text-muted-text whitespace-nowrap">
                Standby tokens
              </span>
              <span className="ml-auto font-sans text-xs text-pearl-text font-medium pl-4">
                {player_state.standby_tokens}/7
              </span>
            </div>
          </div>

          {BOTTOM_ITEMS.map((item) => (
            <NavLink 
              key={item.href} 
              item={item} 
              isActive={pathname === item.href}
              onClick={() => setIsMobileOpen(false)} 
            />
          ))}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Log out"
            className={[
              'w-full flex items-center gap-4 px-6 py-3 min-w-max transition-colors duration-150',
              'text-muted-text hover:bg-abyssal-slate hover:text-red-400 group/btn',
            ].join(' ')}
          >
            <LogOut size={20} strokeWidth={2} className="flex-shrink-0 group-hover/btn:text-red-400" />
            <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
              <span className="font-sans text-sm">Log Out</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
