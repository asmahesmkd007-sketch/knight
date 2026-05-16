"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Gamepad2, 
  Users, 
  Trophy, 
  Sword, 
  BarChart3, 
  History, 
  User, 
  Wallet, 
  Settings, 
  Headset, 
  AlertTriangle, 
  Info, 
  BookOpen, 
  FileText, 
  RotateCcw,
  Power,
  Coins
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

const NavItem = ({ href, icon: Icon, children, active }) => (
  <Link 
    href={href} 
    className={cn(
      "flex items-center gap-3 px-4 py-2 mx-2 my-0.5 rounded-xl transition-all duration-200 text-[13px] font-medium",
      active 
        ? "bg-[var(--gold-dim)] text-[var(--gold)] border-l-2 border-[var(--gold)] rounded-l-none pl-5" 
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
    )}
  >
    <Icon className={cn("w-4 h-4", active ? "text-[var(--gold)]" : "text-[var(--text-muted)]")} />
    {children}
  </Link>
);

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 px-4 pt-4 pb-1 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[2.2px]">
    {children}
    <div className="flex-1 h-[1px] bg-gradient-to-r from-[var(--border-subtle)] to-transparent" />
  </div>
);

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[var(--sidebar-w)] bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] fixed inset-y-0 left-0 z-50 flex flex-col shadow-2xl">
      <div className="h-[var(--topbar-h)] px-4 flex items-center border-b border-[var(--border-subtle)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--gold)] rounded-lg flex items-center justify-center font-space font-black text-black text-lg">
            OX
          </div>
          <span className="font-space text-lg font-extrabold tracking-tighter text-[var(--text-primary)]">
            CHESS <span className="text-[var(--gold)]">OX</span>
          </span>
        </Link>
      </div>

      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-[var(--gold)]/30 bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--gold)] font-bold shadow-lg">
          P
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Loading...</div>
          <div className="text-[11px] font-bold text-[var(--gold)]">IQ: 100</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <div className="mx-2 mb-4 p-3 rounded-xl bg-gradient-to-br from-[var(--gold-dim)] to-transparent border border-[var(--gold)]/20 shadow-inner">
          <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">WALLET</div>
          <div className="flex items-center gap-2 text-2xl font-space font-black text-[var(--gold)] my-1">
            <Coins className="w-5 h-5 animate-bounce" />
            0
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">coins available</div>
        </div>

        <SectionTitle>Main</SectionTitle>
        <NavItem href="/dashboard" icon={Home} active={pathname === "/dashboard"}>Dashboard</NavItem>
        <NavItem href="/play" icon={Gamepad2} active={pathname === "/play"}>Play Chess</NavItem>
        <NavItem href="/clans" icon={Sword} active={pathname === "/clans"}>Clans</NavItem>
        <NavItem href="/friends" icon={Users} active={pathname === "/friends"}>Friends</NavItem>

        <SectionTitle>Tournaments</SectionTitle>
        <NavItem href="/tournaments/free" icon={Trophy} active={pathname === "/tournaments/free"}>Free Arena</NavItem>
        <NavItem href="/tournaments/paid" icon={Trophy} active={pathname === "/tournaments/paid"}>Paid TR</NavItem>

        <SectionTitle>Overview</SectionTitle>
        <NavItem href="/leaderboard" icon={BarChart3} active={pathname === "/leaderboard"}>Leaderboard</NavItem>
        <NavItem href="/history" icon={History} active={pathname === "/history"}>Match History</NavItem>

        <SectionTitle>Accounts</SectionTitle>
        <NavItem href="/account" icon={User} active={pathname === "/account"}>Account & KYC</NavItem>
        <NavItem href="/wallet" icon={Wallet} active={pathname === "/wallet"}>Wallet</NavItem>
        <NavItem href="/settings" icon={Settings} active={pathname === "/settings"}>Settings</NavItem>

        <SectionTitle>Communication</SectionTitle>
        <NavItem href="/support" icon={Headset} active={pathname === "/support"}>Support</NavItem>
        <NavItem href="/report" icon={AlertTriangle} active={pathname === "/report"}>Report</NavItem>

        <SectionTitle>Info</SectionTitle>
        <NavItem href="/about" icon={Info} active={pathname === "/about"}>About</NavItem>
        <NavItem href="/rules" icon={BookOpen} active={pathname === "/rules"}>Rules</NavItem>
        <NavItem href="/terms" icon={FileText} active={pathname === "/terms"}>Terms</NavItem>
        <NavItem href="/refund" icon={RotateCcw} active={pathname === "/refund"}>Refund</NavItem>

        <div className="mt-8 px-4">
          <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors text-[13px] font-medium">
            <Power className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>
    </aside>
  );
}
