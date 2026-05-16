"use client";

import { useEffect, useState } from "react";
import { UserAPI, WalletAPI, GameAPI, TournamentAPI, FriendAPI } from "@/lib/api";
import { 
  Trophy, 
  Brain, 
  Coins, 
  Gamepad2, 
  Percent, 
  FireExtinguisher,
  TrendingUp,
  Clock,
  ChevronRight,
  User as UserIcon
} from "lucide-react";
import { motion } from "framer-motion";

const StatTile = ({ icon: Icon, label, value, sub, color, trend }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 rounded-2xl relative overflow-hidden group hover:border-[var(--gold)]/20 transition-all duration-300"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-opacity-10 ${color}`}>
      <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
    <div className="font-space text-3xl font-black text-[var(--text-primary)] leading-none">{value}</div>
    <div className="text-[11px] text-[var(--text-muted)] mt-2">{sub}</div>
    {trend && (
      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
        <TrendingUp className="w-3 h-3" />
        LIVE
      </div>
    )}
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  </motion.div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [profile, stats, wallet, tournaments, history] = await Promise.all([
        UserAPI.getProfile(),
        UserAPI.getStats(),
        WalletAPI.getBalance(),
        TournamentAPI.getAll("paid", "live"),
        GameAPI.getHistory("all", "all", 1)
      ]);

      setData({
        user: profile.user,
        stats: stats.stats,
        wallet: wallet.wallet,
        tournaments: tournaments.tournaments,
        history: history.matches
      });
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { user, stats, wallet, tournaments, history } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-[var(--gold-dim)] to-transparent border border-[var(--gold)]/20 p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl border-2 border-[var(--gold)]/30 bg-[var(--bg-tertiary)] flex items-center justify-center text-3xl font-black text-[var(--gold)] shadow-2xl">
            {user?.profile_image ? <img src={user.profile_image} className="w-full h-full object-cover rounded-2xl" /> : user?.username?.[0].toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[3px] mb-1">Welcome back, Champion</div>
            <h2 className="font-space text-3xl font-black text-[var(--text-primary)]">{user?.full_name || user?.username}</h2>
            <div className="flex gap-3 mt-3">
              <span className="bg-[var(--gold)] text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{user?.rank}</span>
              <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-[10px] font-bold text-[var(--gold)] flex items-center gap-1.5">
                <Brain className="w-3 h-3" />
                IQ {user?.iq_level}
              </span>
            </div>
          </div>
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-5 pointer-events-none select-none">
          <Trophy size={180} className="text-[var(--gold)]" />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile 
          icon={Coins} 
          label="Wallet Balance" 
          value={wallet?.balance?.toLocaleString() || "0"} 
          sub="Available Coins"
          color="bg-[var(--gold)]"
          trend={true}
        />
        <StatTile 
          icon={Gamepad2} 
          label="Matches Played" 
          value={stats?.total_matches || "0"} 
          sub={`${stats?.wins || 0}W / ${stats?.losses || 0}L / ${stats?.draws || 0}D`}
          color="bg-emerald-500"
        />
        <StatTile 
          icon={Percent} 
          label="Win Rate" 
          value={`${stats?.win_rate || 0}%`} 
          sub="All-time performance"
          color="bg-blue-500"
        />
        <StatTile 
          icon={Clock} 
          label="Best Streak" 
          value={stats?.best_streak || "0"} 
          sub="Wins in a row"
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]" />
                Quick Actions
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/play" className="group bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-6 rounded-2xl hover:border-[var(--gold)]/30 transition-all">
                <Gamepad2 className="w-8 h-8 text-[var(--gold)] mb-4 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-[15px] text-[var(--text-primary)]">Play Chess</div>
                <div className="text-xs text-[var(--text-muted)]">Find a random opponent</div>
              </Link>
              <Link href="/tournaments/paid" className="group bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-6 rounded-2xl hover:border-[var(--accent)]/30 transition-all">
                <Trophy className="w-8 h-8 text-[var(--accent)] mb-4 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-[15px] text-[var(--text-primary)]">Paid TR</div>
                <div className="text-xs text-[var(--text-muted)]">Win real coins</div>
              </Link>
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]" />
                Recent Activity
              </h3>
              <Link href="/history" className="text-[11px] text-[var(--gold)] font-bold">View History →</Link>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
              {history?.length > 0 ? (
                history.slice(0, 5).map((match, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] last:border-0 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        match.winner_id === user.id ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          vs {match.player1_id === user.id ? match.player2_id?.username : match.player1_id?.username}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">{match.timer_type}m · {new Date(match.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "font-space font-black text-sm",
                      match.winner_id === user.id ? "text-emerald-500" : "text-red-500"
                    )}>
                      {match.winner_id === user.id ? "+" : "-"}{match.iq_change_p1 || 10} IQ
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)] text-sm italic">No matches played yet</div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Live Activity */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                Live Radar
              </h3>
            </div>
            <div className="space-y-3">
              <div className="bg-black/30 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Online Players</div>
                  <div className="font-space text-2xl font-black text-[var(--gold)]">1,248</div>
                </div>
                <Users className="w-8 h-8 text-[var(--gold)] opacity-20" />
              </div>
              <div className="bg-black/30 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Matches</div>
                  <div className="font-space text-2xl font-black text-orange-500">42</div>
                </div>
                <Gamepad2 className="w-8 h-8 text-orange-500 opacity-20" />
              </div>
            </div>
          </section>

          {/* Live Tournaments */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]" />
                Live Tournaments
              </h3>
            </div>
            <div className="space-y-3">
              {tournaments?.length > 0 ? (
                tournaments.slice(0, 3).map((t, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:border-[var(--gold)]/30 transition-colors">
                    <div className="text-sm font-bold text-[var(--text-primary)] mb-1">{t.name}</div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--gold)] font-bold">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {t.prize_pool?.toLocaleString()} Coins
                      </span>
                      <span>{t.current_players}/{t.max_players} Joined</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white/5 border border-white/5 p-6 rounded-xl text-center text-xs text-[var(--text-muted)] italic">
                  No live tournaments at the moment
                </div>
              )}
              <Link href="/tournaments/paid" className="block text-center p-3 text-[11px] font-bold text-[var(--gold)] hover:bg-[var(--gold)]/5 rounded-xl transition-colors">
                View All Tournaments
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
