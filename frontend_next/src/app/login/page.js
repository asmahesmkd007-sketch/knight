"use client";

import { useState } from "react";
import { AuthAPI } from "@/lib/api";
import { 
  Mail, 
  Lock, 
  User, 
  AtSign, 
  Phone, 
  Eye, 
  EyeOff, 
  ChevronRight,
  Trophy,
  Brain,
  Coins,
  Gamepad2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

const Feature = ({ icon: Icon, children, delay }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-[var(--gold-dim)] hover:border-[var(--gold)]/20 transition-all group"
  >
    <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] flex items-center justify-center text-[var(--gold)] group-hover:scale-110 transition-transform">
      <Icon size={14} />
    </div>
    <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{children}</span>
  </motion.div>
);

export default function LoginPage() {
  const [tab, setTab] = useState("login");
  const [showPass, setShowPass] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    fullName: "",
    phone: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = tab === "login" 
        ? await AuthAPI.login({ email: formData.email, password: formData.password })
        : await AuthAPI.register({ 
            email: formData.email, 
            password: formData.password, 
            username: formData.username,
            fullName: formData.fullName,
            phone: formData.phone
          });

      if (res.success) {
        localStorage.setItem("px_token", res.token);
        localStorage.setItem("px_user", JSON.stringify(res.user));
        window.location.href = "/dashboard";
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--gold)]/10 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--accent)]/10 blur-[100px] rounded-full animate-pulse delay-700" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-2 bg-[var(--bg-secondary)] rounded-[32px] border border-[var(--border-subtle)] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative z-10"
      >
        {/* Left Panel: Branding */}
        <div className="hidden md:flex flex-col items-center justify-center p-12 relative bg-[#0a0a18]">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 to-transparent" />
          
          <div className="relative z-10 w-full flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-[var(--gold)] rounded-3xl flex items-center justify-center font-space font-black text-black text-4xl mb-6 shadow-[0_0_50px_rgba(212,168,67,0.3)]">
              OX
            </div>
            <h1 className="font-space text-4xl font-black tracking-tight text-[var(--text-primary)] mb-2">
              CHESS <span className="text-[var(--gold)]">OX</span>
            </h1>
            <p className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[4px] mb-12">The Ultimate Chess Arena</p>

            <div className="w-full max-w-[280px] space-y-3">
              <Feature icon={Gamepad2} delay={0.1}>Real-time multiplayer matches</Feature>
              <Feature icon={Trophy} delay={0.2}>Free & Paid Tournaments</Feature>
              <Feature icon={Coins} delay={0.3}>Earn real coin rewards</Feature>
              <Feature icon={Brain} delay={0.4}>IQ-based ranking system</Feature>
            </div>

            <div className="flex gap-8 mt-12 pt-12 border-t border-white/5 w-full justify-center">
              <div>
                <div className="font-space text-2xl font-black text-[var(--gold)]">10K+</div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Players</div>
              </div>
              <div className="w-[1px] bg-white/10" />
              <div>
                <div className="font-space text-2xl font-black text-[var(--gold)]">500+</div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Daily Games</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-[var(--bg-secondary)]">
          <div className="mb-8">
            <h2 className="font-space text-3xl font-black text-[var(--text-primary)] leading-tight">
              {tab === "login" ? <>Welcome <span className="text-[var(--gold)]">back</span></> : <>Join the <span className="text-[var(--gold)]">Arena</span></>}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mt-2">
              {tab === "login" ? "Sign in to continue your journey" : "Create your account and start playing"}
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-[var(--bg-tertiary)] p-1 rounded-2xl flex relative mb-8 border border-[var(--border-subtle)]">
            <motion.div 
              layoutId="tab"
              className="absolute inset-y-1 bg-[var(--gold)] rounded-xl shadow-[0_4px_12px_rgba(212,168,67,0.3)]"
              style={{ width: "calc(50% - 4px)", left: tab === "login" ? "4px" : "calc(50% + 0px)" }}
            />
            <button 
              onClick={() => setTab("login")}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold relative z-10 transition-colors", tab === "login" ? "text-black" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
              Sign In
            </button>
            <button 
              onClick={() => setTab("register")}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold relative z-10 transition-colors", tab === "register" ? "text-black" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {tab === "register" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Username</label>
                    <div className="relative">
                      <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input 
                        type="text" 
                        required
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10 transition-all"
                        placeholder="chess_king"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input 
                        type="text" 
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10 transition-all"
                  placeholder="player@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type={showPass ? "text" : "password"} 
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-11 pr-12 text-sm focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10 transition-all"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {tab === "register" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Phone (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10 transition-all"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-xs text-red-500 text-center font-bold"
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[var(--gold)] hover:bg-[var(--gold-light)] disabled:opacity-50 text-black py-3.5 rounded-xl font-bold shadow-[0_10px_25px_rgba(212,168,67,0.3)] hover:shadow-[0_15px_30px_rgba(212,168,67,0.4)] transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {tab === "login" ? "Sign In" : "Create Account"}
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-[var(--border-subtle)]">
            <button className="w-full bg-white/5 border border-white/10 py-3 rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-[var(--text-primary)] hover:bg-white/10 transition-all">
              <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="mt-8 text-center text-[10px] text-[var(--text-muted)] leading-relaxed">
            By continuing, you agree to our <Link href="/terms" className="text-[var(--gold)]">Terms & Conditions</Link> and <Link href="/privacy" className="text-[var(--gold)]">Privacy Policy</Link>.
            <div className="mt-2 opacity-50">© 2026 CHESS OX · The evolution of strategy.</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
