import React, { useState, useEffect, useMemo } from "react";
import { fetchLiveTrends, fetchStoredTrends } from "./lib/trends.js";
import { supabase } from "./lib/supabase.js";
import {
  Radar, TrendingUp, Star, Zap, Users, ShoppingBag, Coins, Video,
  Check, Activity, Bell, ArrowRight, Gauge, Sparkles, Lock,
} from "lucide-react";

/* =========================================================
   PERSONAS AND CATEGORIES
   ========================================================= */
const PERSONAS = [
  { id: "creator", label: "Creator", icon: Video, tag: "TikTok / Shorts / Reels" },
  { id: "store", label: "E-commerce", icon: ShoppingBag, tag: "Product sourcing" },
  { id: "marketer", label: "Marketer", icon: Users, tag: "Campaign timing" },
  { id: "investor", label: "Investor", icon: Coins, tag: "Meme-coin narratives" },
];

const CATEGORY_BY_PERSONA = {
  creator: ["Sound", "Hashtag", "Format", "Topic", "News"],
  store: ["Product", "Aesthetic", "Hashtag", "Topic", "News"],
  marketer: ["Hashtag", "Format", "Aesthetic", "Topic", "News"],
  investor: ["Coin", "Narrative", "Topic", "News"],
};

/* =========================================================
   VISUAL PRIMITIVES
   ========================================================= */
function Sparkline({ data, color = "#39ff8f" }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="h-8 flex items-center mono text-[10px] text-[#3d6b52]">History is building...</div>;
  const max = Math.max(...data);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="w-full h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RadarSweep({ trends }) {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = now - last; last = now;
      setAngle((a) => (a + dt * 0.045) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const blips = useMemo(
    () => trends.slice(0, 11).map((t, i) => ({
      id: t.id, r: 16 + ((i * 34) % 80), theta: (i * 53) % 360, size: 3 + (t.score % 5),
    })),
    [trends]
  );

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d2b1f" />
            <stop offset="100%" stopColor="#04140d" />
          </radialGradient>
          <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#39ff8f" stopOpacity="0" />
            <stop offset="100%" stopColor="#39ff8f" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#radarBg)" stroke="#1c4b34" strokeWidth="1" />
        {[80, 60, 40, 20].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#1c4b34" strokeWidth="0.6" />
        ))}
        <line x1="2" y1="100" x2="198" y2="100" stroke="#1c4b34" strokeWidth="0.5" />
        <line x1="100" y1="2" x2="100" y2="198" stroke="#1c4b34" strokeWidth="0.5" />
        <g style={{ transformOrigin: "100px 100px", transform: `rotate(${angle}deg)` }}>
          <path d="M100,100 L100,2 A98,98 0 0,1 149,15 Z" fill="url(#sweepGrad)" />
        </g>
        {blips.map((b) => {
          const rad = (b.theta * Math.PI) / 180;
          const x = 100 + b.r * Math.cos(rad);
          const y = 100 + b.r * Math.sin(rad);
          const lit = ((angle - b.theta + 360) % 360) < 40;
          return <circle key={b.id} cx={x} cy={y} r={b.size / 2} fill={lit ? "#a8ffcf" : "#39ff8f"} opacity={lit ? 1 : 0.55} />;
        })}
        <circle cx="100" cy="100" r="2" fill="#39ff8f" />
      </svg>
    </div>
  );
}

function SignalTicker({ trends }) {
  const items = useMemo(() => trends.slice(0, 14), [trends]);
  const line = items.map((t) => `${t.name} +${t.velocity}%`).join("   ///   ");
  return (
    <div className="border-y border-[#123423] bg-[#081b12] overflow-hidden py-2.5">
      <div className="whitespace-nowrap mono text-xs text-[#5fae82] animate-[ticker_38s_linear_infinite]">
        {line} /// {line}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function TrendRadar() {
  const [persona, setPersona] = useState("creator");
  const [watchlist, setWatchlist] = useState(new Set());
  const [tier, setTier] = useState("free");
  const [trends, setTrends] = useState([]);
  const [sourceStatus, setSourceStatus] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch (e) { /* nothing saved yet */ }
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from("watchlist").select("trend_id").eq("user_id", user.id).then(({ data }) => {
      if (data) setWatchlist(new Set(data.map((row) => row.trend_id)));
    });
  }, [user]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthMessage("");
    if (!supabase) return setAuthMessage("Supabase is not configured.");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return setAuthMessage(result.error.message);
    setAuthMessage(authMode === "signup" ? "Check your email to confirm your account." : "Signed in.");
    if (authMode === "signin") setAuthMode(null);
  };

  useEffect(() => {
    let active = true;
    fetchStoredTrends().then((stored) => stored || fetch("/api/trends").then((response) => {
      if (!response.ok) throw new Error("API HTTP " + response.status);
      return response.json();
    })).then((result) => {
      if (!active) return;
      setTrends(result.trends);
      setSourceStatus(result.sourceStatus);
      setUpdatedAt(result.updatedAt);
    }).catch(() => fetchLiveTrends().then((result) => {
      if (!active) return;
      setTrends(result.trends);
      setSourceStatus(result.sourceStatus);
      setUpdatedAt(result.updatedAt);
    })).catch(() => { if (active) setSourceStatus({ google: "error", gdelt: "error" }); });
    return () => { active = false; };
  }, []);

  const toggleWatch = (id) => {
    if (!user) { setAuthMode("signin"); setAuthMessage("Sign in to save your watchlist."); return; }
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("watchlist", JSON.stringify(Array.from(next)));
      supabase.from("watchlist").upsert({ user_id: user.id, trend_id: id }, { onConflict: "user_id,trend_id" })
        .then(() => { if (!next.has(id)) return supabase.from("watchlist").delete().eq("user_id", user.id).eq("trend_id", id); });
      return next;
    });
  };

  const choosePlan = async (planId) => {
    if (planId === "free") return setTier("free");
    if (!user) { setAuthMode("signin"); setAuthMessage("Sign in before choosing a paid plan."); return; }
    setAuthMessage("");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/billing/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, email: user.email, tier: planId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Checkout is not configured yet.");
      window.location.href = result.url;
    } catch (error) { setAuthMode("signin"); setAuthMessage(error.message); }
  };

  const createAlert = async (trend) => {
    if (!user) { setAuthMode("signin"); setAuthMessage("Sign in to create alerts."); return; }
    const { error } = await supabase.from("alerts").insert({ user_id: user.id, trend_id: trend.id, channel: "email", threshold_score: Math.min(99, Number(trend.score) + 5) });
    setAlertMessage(error ? "Could not create alert." : `Alert set for ${trend.name}.`);
  };

  const categories = CATEGORY_BY_PERSONA[persona];
  const visibleTrends = trends.filter((t) => categories.includes(t.category));
  const freeLimit = 3;
  const activePersona = PERSONAS.find((p) => p.id === persona);

  return (
    <div className="min-h-screen bg-[#04120c] text-[#d8f5e4]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        .display { font-family: 'Space Grotesk', sans-serif; }
        .body-f { font-family: 'Inter', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        * { scrollbar-color: #1c4b34 #04120c; }
      `}</style>

      {/* NAV */}
      <header className="border-b border-[#123423] sticky top-0 bg-[#04120c]/90 backdrop-blur z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-[#39ff8f]" />
            <span className="display font-bold tracking-tight text-lg">TREND / RADAR</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 mono text-xs text-[#9fc9b2]">
            <a href="#feed" className="hover:text-[#39ff8f] transition">Live Feed</a>
            <a href="#how" className="hover:text-[#39ff8f] transition">How it works</a>
            <a href="#pricing" className="hover:text-[#39ff8f] transition">Pricing</a>
          </nav>
          <div className="mono text-[11px] text-[#5fae82] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            {trends.length} SIGNALS LIVE
          </div>
          <div className="flex items-center gap-2 ml-4">
            {user ? <button onClick={() => supabase.auth.signOut()} className="mono text-[10px] text-[#9fc9b2]">Sign out</button> : <button onClick={() => setAuthMode("signin")} className="mono text-[10px] text-[#39ff8f]">Sign in</button>}
          </div>
        </div>
      </header>

      {authMode && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
        <form onSubmit={submitAuth} className="w-full max-w-sm rounded-xl border border-[#1c4b34] bg-[#081b12] p-6">
          <div className="flex justify-between items-center mb-5"><h2 className="display font-bold">{authMode === "signup" ? "Create account" : "Sign in"}</h2><button type="button" onClick={() => setAuthMode(null)} className="text-[#9fc9b2]">×</button></div>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full mb-3 rounded-lg bg-[#04120c] border border-[#123423] p-3 text-sm" />
          <input required minLength="6" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" className="w-full mb-4 rounded-lg bg-[#04120c] border border-[#123423] p-3 text-sm" />
          {authMessage && <p className="text-xs text-[#ffcf70] mb-3">{authMessage}</p>}
          <button className="w-full rounded-lg bg-[#39ff8f] text-[#04120c] py-2.5 font-semibold">{authMode === "signup" ? "Create account" : "Sign in"}</button>
          <button type="button" onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthMessage(""); }} className="w-full mt-3 text-xs text-[#9fc9b2]">{authMode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}</button>
        </form>
      </div>}

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-14 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="mono text-xs text-[#39ff8f] tracking-widest mb-4">EARLY-SIGNAL DETECTION</p>
          <h1 className="display text-4xl md:text-5xl font-bold leading-[1.05] mb-5">
            See the trend<br />before it's a trend.
          </h1>
          <p className="body-f text-[#9fc9b2] text-base leading-relaxed mb-8 max-w-md">
            We track sounds, hashtags, products and meme coins the moment their growth curve starts
            bending upward — hours or days before they hit the mainstream feed.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const active = persona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm mono transition ${
                    active ? "bg-[#39ff8f] text-[#04120c] font-medium" : "bg-[#0c2318] text-[#9fc9b2] hover:bg-[#123423]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {p.label}
                </button>
              );
            })}
          </div>
          <p className="mono text-[11px] text-[#3d6b52] mb-8">{activePersona.tag}</p>
          <a href="#feed" className="inline-flex items-center gap-2 bg-[#39ff8f] text-[#04120c] px-5 py-3 rounded-lg font-semibold text-sm hover:bg-[#a8ffcf] transition">
            Start free <ArrowRight className="w-4 h-4" />
          </a>
          <a href="#how" className="inline-flex items-center gap-2 ml-3 border border-[#1c4b34] px-5 py-3 rounded-lg font-semibold text-sm text-[#9fc9b2] hover:border-[#39ff8f] transition">See how it works</a>
        </div>
            <RadarSweep trends={visibleTrends} />
      </section>

      <SignalTicker trends={visibleTrends} />

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="display text-2xl font-bold mb-8">How the radar works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Gauge, title: "Velocity scan", body: "We measure how fast a sound, tag or coin is accelerating right now — not how big it already is." },
            { icon: Sparkles, title: "Noise filter", body: "One-off spikes get discarded. Only sustained, compounding growth gets promoted to a signal." },
            { icon: Bell, title: "Instant alert", body: "The moment something crosses your threshold, it lands in your feed and inbox — first." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border border-[#123423] bg-[#081b12] p-5">
                <Icon className="w-5 h-5 text-[#39ff8f] mb-3" />
                <p className="display font-semibold mb-1.5">{f.title}</p>
                <p className="body-f text-sm text-[#9fc9b2] leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEED */}
      <section id="feed" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="display text-xl font-bold">Live feed — {activePersona.label}</h2>
          <span className="mono text-xs text-[#5fae82]">sorted by trend score</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleTrends.map((t, idx) => {
            const locked = tier === "free" && idx >= freeLimit;
            const watched = watchlist.has(t.id);
            return (
              <div key={t.id} className="relative rounded-xl border border-[#123423] bg-[#081b12] p-4 overflow-hidden">
                {locked && (
                  <div className="absolute inset-0 bg-[#04120c]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
                    <Lock className="w-4 h-4 text-[#39ff8f]" />
                    <span className="mono text-xs text-[#9fc9b2]">Pro signal</span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="mono text-[10px] text-[#5fae82] uppercase tracking-wide">{t.category} · {t.platform}</p>
                    <p className="display font-semibold text-sm mt-1">{t.name}</p>
                  </div>
                  <button onClick={() => toggleWatch(t.id)} className="shrink-0">
                    <Star className={`w-4 h-4 ${watched ? "fill-[#39ff8f] text-[#39ff8f]" : "text-[#3d6b52]"}`} />
                  </button>
                </div>
                <Sparkline data={t.spark} />
                <button onClick={() => createAlert(t)} className="mt-3 text-[10px] mono text-[#9fc9b2] hover:text-[#39ff8f]">Set score alert +5</button>
                <div className="flex items-center justify-between mt-2">
                  <span className="flex items-center gap-1 text-[#39ff8f] mono text-xs">
                    <TrendingUp className="w-3.5 h-3.5" /> +{t.velocity}% / 48h
                  </span>
                  <span className="mono text-[10px] text-[#5fae82]">score {t.score}</span>
                </div>
                <p className="mono text-[10px] text-[#3d6b52] mt-1">source {t.platform} · updated {updatedAt ? new Date(updatedAt).toLocaleTimeString("en-US") : "..."}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#123423] bg-[#081b12] p-6">
          <p className="mono text-xs text-[#39ff8f] mb-3">WHY TRUST THE RADAR</p>
          <p className="display font-semibold text-lg mb-2">Find movement before it becomes crowded.</p>
          <p className="body-f text-sm text-[#9fc9b2] leading-relaxed">Trend Radar combines Google Trends and news coverage signals. It measures attention and momentum; it does not promise guaranteed results.</p>
        </div>
        <div className="rounded-xl border border-[#123423] bg-[#081b12] p-6">
          <p className="mono text-xs text-[#39ff8f] mb-3">BUILT FOR ACTION</p>
          <p className="body-f text-sm text-[#9fc9b2] leading-relaxed">Creators find topics, stores spot demand, marketers time campaigns, and investors monitor narratives before they become obvious.</p>
        </div>
      </section>

      {alertMessage && <div className="fixed bottom-5 right-5 z-40 rounded-lg border border-[#39ff8f] bg-[#0c2318] px-4 py-3 text-xs text-[#d8f5e4]">{alertMessage}</div>}

      {user && <section id="watchlist" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-xl border border-[#123423] bg-[#081b12] p-6">
          <div className="flex items-baseline justify-between mb-3"><h2 className="display text-xl font-bold">My Watchlist</h2><span className="mono text-xs text-[#5fae82]">{watchlist.size} saved</span></div>
          <div className="flex flex-wrap gap-2">
            {trends.filter((trend) => watchlist.has(trend.id)).map((trend) => <button key={trend.id} onClick={() => toggleWatch(trend.id)} className="rounded-full border border-[#1c4b34] px-3 py-1.5 text-xs text-[#9fc9b2] hover:border-[#39ff8f]">{trend.name} ×</button>)}
            {!watchlist.size && <p className="text-sm text-[#5fae82]">Save a trend with the star to see it here.</p>}
          </div>
        </div>
      </section>}

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="display text-2xl font-bold mb-2">Plans</h2>
        <p className="body-f text-[#9fc9b2] mb-8 text-sm">Unlock every signal and get alerted the moment it moves.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { id: "free", name: "Free", price: "$0", period: "", features: ["3 trends per persona", "24h delayed data", "No alerts"] },
            { id: "pro", name: "Pro", price: "$29", period: "/mo", features: ["All trends, live", "Push alerts on new signals", "Watchlist & history", "Every category unlocked"], highlight: true },
            { id: "investor", name: "Signal+", price: "$99", period: "/mo", features: ["Everything in Pro", "On-chain meme-coin scanner", "API access", "Priority on new signal types"] },
          ].map((plan) => (
            <div
              key={plan.id}
              onClick={() => choosePlan(plan.id)}
              className={`cursor-pointer rounded-xl border p-6 transition relative ${
                tier === plan.id ? "border-[#39ff8f] bg-[#0c2318]" : "border-[#123423] bg-[#081b12] hover:border-[#1c4b34]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-6 bg-[#39ff8f] text-[#04120c] text-[10px] font-bold px-2 py-0.5 rounded-full mono">MOST POPULAR</span>
              )}
              <p className="display font-bold text-lg">{plan.name}</p>
              <p className="mono text-2xl font-bold text-[#39ff8f] my-2">{plan.price}<span className="text-sm text-[#5fae82]">{plan.period}</span></p>
              <ul className="space-y-1.5 mt-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm body-f text-[#9fc9b2]">
                    <Check className="w-3.5 h-3.5 text-[#39ff8f] mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className={`mt-5 w-full py-2.5 rounded-lg text-sm font-semibold transition ${
                tier === plan.id ? "bg-[#39ff8f] text-[#04120c]" : "bg-[#123423] text-[#d8f5e4] hover:bg-[#1c4b34]"
              }`}>
                {tier === plan.id && plan.id === "free" ? "Selected" : plan.id === "free" ? "Choose free" : "Subscribe"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#123423] py-8 text-center">
        <p className="mono text-[10px] text-[#3d6b52]">LIVE SOURCES · {sourceStatus ? (sourceStatus.google ? "Google " + sourceStatus.google + " · GDELT " + sourceStatus.gdelt : "Database " + sourceStatus.database) : "loading"}</p>
      </footer>
    </div>
  );
}
