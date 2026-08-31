import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Radar, TrendingUp, Star, Users, ShoppingBag, Coins, Video,
  Check, Activity, Bell, ArrowRight, Gauge, Sparkles, Lock,
  ShieldCheck, Zap, Clock, Music2, Hash, Layers, Palette, MessageSquare,
  Mail, LogOut, User as UserIcon,
  Sun, Moon, RefreshCw,
} from "lucide-react";

/* =========================================================
   SUPABASE (auth + trial)
   ========================================================= */
const SUPABASE_URL = "https://kxxedfhxmcakfxmtneeq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PPIszEpxdZDsv2nqLQgL1Q_V5FOX-Qp";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TRIAL_DAYS = 3;

/* =========================================================
   MOCK SIGNAL ENGINE (fallback preview data before live data loads)
   ========================================================= */
const PERSONAS = [
  { id: "creator", label: "Creator", icon: Video, tag: "TikTok / Shorts / Reels" },
  { id: "store", label: "E-commerce", icon: ShoppingBag, tag: "Product sourcing" },
  { id: "marketer", label: "Marketer", icon: Users, tag: "Campaign timing" },
  { id: "investor", label: "Investor", icon: Coins, tag: "Meme-coin narratives" },
];

const CATEGORY_BY_PERSONA = {
  creator: ["Sound", "Hashtag", "Format"],
  store: ["Product", "Aesthetic", "Hashtag"],
  marketer: ["Hashtag", "Format", "Aesthetic"],
  investor: ["Coin", "Narrative"],
};

const NAME_POOL = {
  Sound: ["\"Corridor\" slowed remix", "8-bit villain riff", "rainy lo-fi loop v2", "static-hum transition cue", "brainrot sound mashup #7"],
  Hashtag: ["#quietluxury2", "#deskbombing", "#feralgirlsummer3", "#cozycore.exe", "#glitchcore.tools", "#italianbrainrot"],
  Format: ["POV: silent vlog", "3-second hook stitch", "\"rate my setup\" duet", "split-screen reaction", "AI-narrated brainrot skit"],
  Product: ["mini heatless curler v2", "glass-skin serum stick", "LED desk fog lamp", "wearable neck-fan clip"],
  Aesthetic: ["mob wife 2.0", "dopamine minimalism", "goblincore office", "liminal beige"],
  Coin: ["$FROGWIF", "$STATIC", "$NANOCAT", "$GHOSTPEPE", "$BRAINROT"],
  Narrative: ["AI-agent memes", "retro-internet nostalgia", "sleep-deprived dev humor", "anti-hustle culture", "Italian brainrot animal lore", "surreal AI-generated meme creatures"],
};
const PLATFORMS = ["TikTok", "Instagram Reels", "X", "YouTube Shorts", "Telegram"];

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function generateTrends() {
  const rand = seedRandom(42);
  const out = [];
  let id = 0;
  Object.entries(NAME_POOL).forEach(([category, names]) => {
    names.forEach((name) => {
      id += 1;
      const velocity = Math.round(20 + rand() * 780);
      const spark = Array.from({ length: 12 }, (_, i) => {
        const base = 10 + i * (velocity / 120);
        return Math.max(2, Math.round(base + rand() * 15));
      });
      out.push({
        id, name, category,
        platform: PLATFORMS[Math.floor(rand() * PLATFORMS.length)],
        velocity, spark,
        firstSeen: Math.round(1 + rand() * 60),
        score: Math.min(99, Math.round(velocity / 9 + rand() * 15)),
        description: "A live signal detected by Trend Radar.",
        emoji: "📡",
      });
    });
  });
  return out.sort((a, b) => b.score - a.score);
}
const ALL_TRENDS = generateTrends();

const API_BASE = "https://trend-radar-backend-production.up.railway.app";

function normalizeTrend(t) {
  const hoursAgo = t.first_seen_at
    ? Math.max(1, Math.round((Date.now() - new Date(t.first_seen_at).getTime()) / 3600000))
    : t.firstSeen ?? 24;
  const spark = Array.isArray(t.spark_data)
    ? t.spark_data
    : Array.isArray(t.spark)
    ? t.spark
    : [10, 12, 14, 13, 16, 18, 17, 20, 22, 21, 24, 26];
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    platform: t.platform,
    velocity: Number(t.velocity_pct ?? t.velocity ?? 30),
    score: Number(t.score ?? 50),
    description: t.description || TREND_COPY[t.category] || "A live signal detected by Trend Radar.",
    emoji: CATEGORY_EMOJI[t.category] || "📡",
      sourceUrl: /^https?:\/\//i.test(String(t.source_url || "")) ? t.source_url : null,
      mediaUrl: /^https?:\/\//i.test(String(t.media_url || "")) ? t.media_url : null,
    mediaType: t.media_type === "video" ? "video" : "image",
    spark,
    firstSeen: hoursAgo,
  };
}

/* =========================================================
   VISUAL PRIMITIVES
   ========================================================= */
function Sparkline({ data, color = "#7c5cff" }) {
  const safeData = Array.isArray(data) && data.length > 0 ? data : [1, 1];
  const max = Math.max(...safeData) || 1;
  const points = safeData
    .map((v, i) => `${(i / (safeData.length - 1 || 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  const areaPoints = `0,30 ${points} 100,30`;
  return (
    <svg viewBox="0 0 100 30" className="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- 3D Radar Core (signature hero element) ---------- */
function RadarCore() {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = now - last; last = now;
      setAngle((a) => (a + dt * 0.02) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleMove = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -14, y: px * 18 });
  };
  const handleLeave = () => setTilt({ x: 0, y: 0 });

  const blips = useMemo(
    () => ALL_TRENDS.slice(0, 9).map((t, i) => ({
      id: t.id,
      r: 34 + ((i * 19) % 58),
      theta: (i * 71) % 360,
      z: (i % 3) * 22 - 22,
      size: 3.5 + (t.score % 4),
      label: t.name,
      velocity: t.velocity,
    })),
    []
  );

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="relative w-full aspect-square max-w-md mx-auto select-none"
        style={{ perspective: "1100px" }}
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, #7c5cff 0%, transparent 70%)" }}
        />
        <div
          className="relative w-full h-full transition-transform duration-200 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${58 + tilt.x}deg) rotateZ(${tilt.y}deg)`,
          }}
        >
          {[0, 1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute rounded-full border"
              style={{
                inset: `${ring * 12}%`,
                borderColor: ring === 0 ? "rgba(124,92,255,0.55)" : "rgba(124,92,255,0.18)",
                borderWidth: ring === 0 ? 1.5 : 1,
                transform: `translateZ(${ring * 6}px)`,
                boxShadow: ring === 0 ? "0 0 40px rgba(124,92,255,0.25) inset" : "none",
              }}
            />
          ))}
          <div
            className="absolute rounded-full"
            style={{
              inset: "48%",
              background: "radial-gradient(circle, #e6dcff 0%, #7c5cff 60%, transparent 100%)",
              boxShadow: "0 0 30px 6px rgba(124,92,255,0.7)",
              transform: "translateZ(30px)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{ transform: `translateZ(2px) rotate(${angle}deg)`, transformOrigin: "50% 50%" }}
          >
            <div
              className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
              style={{
                background: "conic-gradient(from 0deg, rgba(124,92,255,0.5), transparent 55%)",
              }}
            />
          </div>
          {blips.map((b) => {
            const rad = (b.theta * Math.PI) / 180;
            const x = 50 + (b.r / 2) * Math.cos(rad);
            const y = 50 + (b.r / 2) * Math.sin(rad);
            const lit = ((angle - b.theta + 360) % 360) < 50;
            return (
              <div
                key={b.id}
                className="absolute group"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%,-50%) translateZ(${b.z + 14}px)`,
                }}
              >
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: b.size * 2,
                    height: b.size * 2,
                    background: lit ? "#f0e9ff" : "#7c5cff",
                    boxShadow: lit ? "0 0 14px 4px rgba(124,92,255,0.9)" : "0 0 6px rgba(124,92,255,0.5)",
                    opacity: lit ? 1 : 0.65,
                  }}
                />
                <div
                  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity mono text-[9px] px-1.5 py-0.5 rounded bg-[#0f0d1f] border border-[#241c40] text-[#c9bfff]"
                  style={{ transform: "translateZ(60px) translateX(-50%)" }}
                >
                  {b.label} · +{b.velocity}%
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-2xl"
          style={{ background: "rgba(124,92,255,0.35)" }}
        />
      </div>

      <div className="hidden md:block absolute -left-6 top-6 w-40 glass rounded-xl p-3 shadow-2xl rotate-[-8deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5b83d]" />
          <p className="mono text-[8px] text-[#a99fd4] uppercase tracking-wide">Breaking now</p>
        </div>
        <p className="display text-[11px] font-semibold leading-snug mb-1.5">#glitchcore.tools</p>
        <div className="flex items-center gap-1 text-[#a98bff] mono text-[10px] font-medium">
          <TrendingUp className="w-3 h-3" /> +340%
        </div>
      </div>
      <div className="hidden md:block absolute -right-4 bottom-10 w-36 glass rounded-xl p-3 shadow-2xl rotate-[7deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7c5cff] animate-pulse" />
          <p className="mono text-[8px] text-[#a99fd4] uppercase tracking-wide">Live scan</p>
        </div>
        <p className="display text-[11px] font-semibold leading-snug mb-1.5">$NANOCAT</p>
        <div className="flex items-center gap-1 text-[#f5b83d] mono text-[10px] font-medium">
          <TrendingUp className="w-3 h-3" /> +812%
        </div>
      </div>
    </div>
  );
}

function SignalTicker() {
  const items = useMemo(() => ALL_TRENDS.slice(0, 14), []);
  const line = items.map((t) => `${t.name} +${t.velocity}%`).join("   //   ");
  return (
    <div className="theme-ticker border-y border-[#1c1633] bg-[#0b0918]/80 overflow-hidden py-2.5">
      <div className="whitespace-nowrap mono text-[11px] tracking-wide text-[#8a7fc0] animate-[ticker_40s_linear_infinite]">
        {line} // {line}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

function GrainOverlay() {
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none z-[1] opacity-[0.05] mix-blend-overlay">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

const CATEGORY_VISUALS = [
  { key: "Sound", icon: Music2, color: "#7c5cff", desc: "Audio & remix trends before they're everywhere" },
  { key: "Hashtag", icon: Hash, color: "#f5b83d", desc: "Tags accelerating across every platform" },
  { key: "Format", icon: Layers, color: "#4fd1c5", desc: "Video formats creators are about to copy" },
  { key: "Product", icon: ShoppingBag, color: "#ff6b9d", desc: "Physical products about to spike in demand" },
  { key: "Aesthetic", icon: Palette, color: "#8b6bff", desc: "Visual styles taking over feeds" },
  { key: "Coin", icon: Coins, color: "#ffd166", desc: "On-chain narratives gaining early velocity" },
  { key: "Narrative", icon: MessageSquare, color: "#7cc8ff", desc: "Cultural moments forming in real time" },
];

const TREND_COPY = {
  Sound: "Audio gaining momentum across short-form video. Use it early before saturation.",
  Hashtag: "Conversation accelerating across social platforms with growing audience intent.",
  Format: "A repeatable video format that creators are beginning to copy at scale.",
  Product: "Early demand signal before competition and ad costs rise.",
  Aesthetic: "A visual direction spreading through feeds and creator content.",
  Coin: "An emerging on-chain narrative showing unusual momentum and attention.",
  Narrative: "A cultural conversation building across communities and media channels.",
};
const CATEGORY_EMOJI = { Sound: "🎵", Hashtag: "#️⃣", Format: "🎬", Product: "🛍️", Aesthetic: "✨", Coin: "🪙", Narrative: "💬" };
const TREND_ACTION = { Sound: "Use this audio in your next 1–2 posts.", Hashtag: "Add it only where it fits your content angle.", Format: "Adapt this format before it becomes saturated.", Product: "Validate demand before competitors catch up.", Aesthetic: "Build your next creative around this visual direction.", Coin: "Watch momentum and risk before taking action.", Narrative: "Create content around the conversation while it is early." };
const TREND_MEDIA = { Sound: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=80", Hashtag: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1000&q=80", Format: "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1000&q=80", Product: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80", Aesthetic: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80", Coin: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1000&q=80", Narrative: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1000&q=80" };

const PREVIEW_SIGNALS = [
  { category: "TikTok Sound", name: "Trending audio signal", score: 92, velocity: "+743%", color: "#35d07f" },
  { category: "Product", name: "Early demand spike", score: 78, velocity: "+518%", color: "#35d07f" },
  { category: "Narrative", name: "Cooling conversation", score: 24, velocity: "-18%", color: "#ff6b6b" },
];

function CategoryOrb({ icon: Icon, color, label, desc }) {
  return (
    <div className="glass rounded-2xl p-5 flex flex-col items-start gap-3 hover:-translate-y-1 hover:border-[#7c5cff]/40 transition-all duration-300 group">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center relative"
        style={{ background: `linear-gradient(135deg, ${color}33, ${color}0d)`, border: `1px solid ${color}55` }}
      >
        <div className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity" style={{ background: color }} />
        <Icon className="w-5 h-5 relative" style={{ color }} />
      </div>
      <div>
        <p className="display font-semibold text-sm mb-1">{label}</p>
        <p className="body-f text-xs text-[#a99fd4] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ---------- Auth: sign-in modal ---------- */
function SignInModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? "error" : "sent");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#060512]/80 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-7 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b6bff]/20 to-[#6941e8]/20 border border-[#7c5cff]/30 flex items-center justify-center mb-4">
          <Mail className="w-4.5 h-4.5 text-[#a98bff]" />
        </div>
        <p className="display font-bold text-lg mb-1.5">Sign in to Trend Radar</p>
        <p className="body-f text-sm text-[#a99fd4] mb-5">
          Get a 3-day free trial with full access. No password needed — we'll email you a magic link.
        </p>
        {status === "sent" ? (
          <div className="rounded-xl border border-[#7c5cff]/30 bg-[#160f2e] p-4">
            <p className="body-f text-sm text-[#c9bfff]">
              Check <span className="font-semibold">{email}</span> for your sign-in link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#0f0d1f] border border-[#241c40] rounded-xl px-4 py-3 text-sm body-f text-[#f2eefa] placeholder:text-[#4a4270] outline-none focus:border-[#7c5cff] transition"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white py-3 rounded-xl text-sm font-semibold hover:shadow-[0_0_25px_rgba(124,92,255,0.4)] transition disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="mono text-xs text-[#ff8a8a]">Something went wrong — please try again.</p>
            )}
          </form>
        )}
        <button onClick={onClose} className="mt-4 w-full text-center mono text-xs text-[#655a92] hover:text-[#a99fd4] transition">
          Close
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function TrendRadar() {
  const [persona, setPersona] = useState("creator");
  const [watchlist, setWatchlist] = useState(new Set());
  const [liveTrends, setLiveTrends] = useState(null);
  const [checkingLive, setCheckingLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("trend-theme") === "light");
  const [expandedColumns, setExpandedColumns] = useState({});
  const [selectedTrend, setSelectedTrend] = useState(null);

  // Auth + trial state
  const [session, setSession] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [trialStartedAt, setTrialStartedAt] = useState(null);
  const [hasActiveSub, setHasActiveSub] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfileLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data: userRow } = await supabase
        .from("users")
        .select("trial_started_at, selected_plan")
        .eq("id", session.user.id)
        .maybeSingle();
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (cancelled) return;
      setTrialStartedAt(userRow?.trial_started_at ?? session.user.created_at);
      setSelectedPlan(userRow?.selected_plan ?? null);
      setHasActiveSub(!!subRow);
      setProfileLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/trends?persona=${persona}&tier=pro`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.trends?.length > 0) setLiveTrends(data.trends.map(normalizeTrend));
        else setLiveTrends(null);
      })
      .catch(() => { if (!cancelled) setLiveTrends(null); })
      .finally(() => { if (!cancelled) setCheckingLive(false); });
    return () => { cancelled = true; };
  }, [persona]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch (e) { /* nothing saved yet */ }
  }, []);

  const toggleWatch = (id) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("watchlist", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const categories = CATEGORY_BY_PERSONA[persona];
  const visibleTrends = liveTrends ?? ALL_TRENDS.filter((t) => categories.includes(t.category));
  const activePersona = PERSONAS.find((p) => p.id === persona);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/trends/refresh`, { method: "POST" });
      const r = await fetch(`${API_BASE}/api/trends?persona=${persona}&tier=pro`);
      const data = await r.json();
      if (data?.trends?.length > 0) setLiveTrends(data.trends.map(normalizeTrend));
    } catch (e) { /* backend unreachable */ }
    finally { setRefreshing(false); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const toggleTheme = () => setLightMode((value) => { const next = !value; localStorage.setItem("trend-theme", next ? "light" : "dark"); return next; });

  const daysUsed = trialStartedAt
    ? Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86400000)
    : 0;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  const trialActive = trialDaysLeft > 0;
  const isLoggedIn = !!session?.user;
  const choosePlan = async (planId) => {
    if (!session?.user) { setShowSignIn(true); return; }
    const { error } = await supabase.from("users").update({ selected_plan: planId }).eq("id", session.user.id);
    if (!error) setSelectedPlan(planId);
    else alert("Could not save your plan selection. Please try again.");
  };
  const hasFullAccess = isLoggedIn && (trialActive || hasActiveSub);
  const trialExpiredNoSub = isLoggedIn && profileLoaded && !trialActive && !hasActiveSub;

  // Anonymous / not-yet-trialed visitors see a capped preview; expired trial sees nothing.
  const freeLimit = trialExpiredNoSub ? 0 : hasFullAccess ? Infinity : 3;

  const startCheckout = async (planId) => {
    const email = session?.user?.email || window.prompt("Enter your email to continue to checkout:");
    if (!email) return;
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session?.user?.id || email, email, tier: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Checkout failed to start. Please try again.");
    } catch (err) {
      alert("Could not reach checkout. Please try again.");
    }
  };

  return (
    <div className={`min-h-screen ${lightMode ? "theme-light" : "theme-dark"} relative`}>
      <GrainOverlay />
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      {selectedTrend && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060512]/75 backdrop-blur-md px-4" onClick={() => setSelectedTrend(null)}><div className="glass rounded-3xl w-full max-w-lg p-7 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b6bff]/30 to-[#4b8cff]/20 border border-[#8b6bff]/40 flex items-center justify-center text-3xl">{selectedTrend.emoji || CATEGORY_EMOJI[selectedTrend.category] || "📡"}</div><div><p className="mono text-[10px] uppercase tracking-widest text-[#a98bff]">{selectedTrend.category} · {selectedTrend.platform}</p><h3 className="display text-xl font-extrabold mt-1">{selectedTrend.name}</h3></div></div><button onClick={() => setSelectedTrend(null)} className="text-[#a99fd4] text-xl">×</button></div><div className="relative mt-6 h-52 rounded-2xl overflow-hidden border border-[#7c5cff]/25"><img src={TREND_MEDIA[selectedTrend.category] || TREND_MEDIA.Narrative} alt={`Example visual for ${selectedTrend.name}`} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#060512]/80 via-transparent to-transparent" /><div className="absolute bottom-4 left-4 flex items-center gap-2"><span className="w-9 h-9 rounded-full bg-white text-[#4b35b8] flex items-center justify-center text-sm">▶</span><span className="mono text-[10px] text-white uppercase tracking-widest">Example preview · {selectedTrend.platform}</span></div></div><div className="mt-5 rounded-2xl bg-[#130f26]/70 border border-[#7c5cff]/20 p-4"><Sparkline data={selectedTrend.spark} color={selectedTrend.score >= 60 ? "#35d07f" : selectedTrend.score >= 30 ? "#f5b83d" : "#ff6b6b"} /><div className="grid grid-cols-2 gap-3 mt-4"><div><p className="mono text-[10px] text-[#7c729f]">TREND SCORE</p><p className={`display text-2xl font-extrabold ${selectedTrend.score >= 60 ? "text-[#35d07f]" : selectedTrend.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{selectedTrend.score}</p></div><div><p className="mono text-[10px] text-[#7c729f]">VELOCITY</p><p className="display text-2xl font-extrabold text-[#a98bff]">+{selectedTrend.velocity}%</p></div></div></div><p className="body-f text-sm leading-relaxed text-[#b3a9d9] mt-5">{selectedTrend.description || TREND_COPY[selectedTrend.category] || "A live signal detected by Trend Radar."}</p><p className="body-f text-xs leading-relaxed text-[#a98bff] mt-2">{TREND_ACTION[selectedTrend.category] || "Move early while the signal is gaining momentum."}</p><p className="mono text-[10px] text-[#7c729f] mt-4">First detected {selectedTrend.firstSeen ?? "recently"} hours ago · Updated hourly</p></div></div>}
      {!isLoggedIn && <a href="#pricing" className="md:hidden fixed bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b6bff] to-[#6941e8] py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(70,45,180,.45)]">Start 3-day free trial <ArrowRight className="w-4 h-4" /></a>}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .display { font-family: 'Manrope', sans-serif; letter-spacing: -0.035em; }
        .body-f { font-family: 'DM Sans', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        * { scrollbar-color: #2a2150 #060512; }
        .glass {
          background: linear-gradient(180deg, rgba(23,18,45,0.7), rgba(15,12,31,0.7));
          backdrop-filter: blur(14px);
          border: 1px solid rgba(124,92,255,0.14);
        }
        .theme-dark { background: radial-gradient(circle at 72% 12%, #101b4a 0%, #080b24 34%, #060512 78%); color: #f2f5ff; }
        .theme-light { background: #dff3ff; color: #10213f; }
        .theme-light .glass { background: rgba(239,250,255,.92); border-color: #b7dff2; box-shadow: 0 14px 36px rgba(42,104,160,.10); }
        .theme-light .body-f, .theme-light .mono { color: #405875; }
        .theme-light header { background: #c9eaff; border-color: #a9d5ed; }
        .theme-light .theme-muted { color: #716b86 !important; }
        .theme-light input { background: #fff; color: #171329; border-color: #d9d3ec; }
        .theme-light [class*="bg-[#130f26"] { background-color: #f1eff8; }
        .theme-light [class*="border-[#231b45"] { border-color: #ddd7ed; }
        .theme-light [class*="text-[#a99fd4"] { color: #625a7c; }
        .theme-light h1, .theme-light h2, .theme-light p.display { color: #10213f; }
        .theme-light .text-white { color: #fff !important; }
        .theme-light [class*="bg-[#060512"] { background-color: #dff3ff; }
        .theme-light [class*="bg-[#160f2e"] { background-color: #e5f3ff; }
        .theme-light [class*="bg-[#0f0d1f"] { background-color: #f7fcff; }
        .theme-light [class*="text-[#7c729f"] { color: #647c96; }
        .theme-light [class*="text-[#f2eefa"] { color: #10213f; }
        .theme-light [class*="text-[#c9bfff"] { color: #315fc0; }
        .theme-light [class*="text-[#b3a9d9"] { color: #405875; }
        .theme-light [class*="text-[#655a92"] { color: #607894; }
        .theme-light [class*="text-[#4a4270"] { color: #71879e; }
        .theme-light [class*="border-[#1c1633"] { border-color: #cfe2f5; }
        .theme-light [class*="border-[#2a2150"] { border-color: #bed8ee; }
        .theme-light [class*="bg-[#130f26"] { background-color: #eaf5fc; }
        .theme-light [class*="bg-[#0f2a1c"] { background-color: #e6f8ee; }
        .theme-light [class*="bg-[#2a2010"] { background-color: #fff5d9; }
        .theme-light [class*="bg-[#060512]/92"] { background-color: rgba(255,255,255,.94); }
        .theme-light .theme-ticker { background: #d9efff; border-color: #bcdcf2; }
        .theme-light .theme-ticker > div { color: #28577f !important; font-weight: 600; }
        .theme-light .theme-stats { background: #c5e9fc; border-color: #a9d8ef; }
        .theme-light h1 span { color: #5570d8; background: none; -webkit-text-fill-color: #5570d8; }
        .theme-light p, .theme-light span, .theme-light a, .theme-light button { font-weight: 500; }
        .theme-light p.display, .theme-light h1, .theme-light h2, .theme-light h3 { font-weight: 800; }
        .nav-link { display: inline-flex; align-items: center; padding: 8px 10px; border-radius: 9px; transition: color .2s ease, background .2s ease, transform .2s ease; }
        .nav-link:hover, .nav-link:focus-visible { color: #79a8ff !important; background: rgba(76,126,255,.14); transform: translateY(-1px); outline: none; }
        .theme-light .nav-link:hover, .theme-light .nav-link:focus-visible { color: #4b64d8 !important; background: #e9edff; }
      `}</style>

      {/* NAV */}
      <header className="border-b border-[#1c1633] sticky top-0 bg-[#060512]/85 backdrop-blur-md z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#4a2fb8]">
              <Radar className="w-4 h-4 text-white" />
            </div>
            <span className="display font-bold tracking-tight text-[15px]">TREND/RADAR</span>
          </div>
          <nav className="hidden md:flex items-center gap-9 body-f text-[13px] font-semibold tracking-[0.08em] text-[#b9afd9]">
            <a href="#categories" className="nav-link">CATEGORIES</a>
            <a href="#feed" className="nav-link">LIVE FEED</a>
            <a href="#how" className="nav-link">HOW IT WORKS</a>
            <a href="#pricing" className="nav-link">PRICING</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="w-9 h-9 rounded-full border border-[#2a2150] flex items-center justify-center hover:border-[#7c5cff] transition">
              {lightMode ? <Moon className="w-4 h-4 text-[#6044d8]" /> : <Sun className="w-4 h-4 text-[#f5b83d]" />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 mono text-xs font-bold text-white bg-gradient-to-r from-[#9b78ff] via-[#7c5cff] to-[#5c3ee8] shadow-[0_0_25px_rgba(124,92,255,.45)] hover:shadow-[0_0_38px_rgba(124,92,255,.7)] hover:-translate-y-0.5 px-5 py-3 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scanning..." : "Refresh"}
            </button>
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                {hasActiveSub ? (
                  <span className="hidden sm:flex mono text-[10px] text-[#7cffb0] bg-[#0f2a1c] border border-[#2a5540] rounded-full px-2.5 py-1">PRO</span>
                ) : trialActive ? (
                  <span className="hidden sm:flex mono text-[10px] text-[#c9bfff] bg-[#160f2e] border border-[#7c5cff]/40 rounded-full px-2.5 py-1">
                    {trialDaysLeft}d trial left
                  </span>
                ) : (
                  <span className="hidden sm:flex mono text-[10px] text-[#f5b83d] bg-[#2a2010] border border-[#5a4a20] rounded-full px-2.5 py-1">Trial ended</span>
                )}
                <button onClick={handleSignOut} className="w-8 h-8 rounded-full bg-[#130f26] border border-[#231b45] flex items-center justify-center hover:border-[#7c5cff] transition">
                  <LogOut className="w-3.5 h-3.5 text-[#a99fd4]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSignIn(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-4 py-1.5 rounded-full text-[11px] mono font-medium hover:shadow-[0_0_20px_rgba(124,92,255,0.35)] transition"
              >
                <UserIcon className="w-3.5 h-3.5" /> Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 md:pt-20 pb-20 grid md:grid-cols-2 gap-14 items-center overflow-hidden">
        <div>
          <div className="inline-flex items-center gap-1.5 mono text-[10px] tracking-widest text-[#c9bfff] bg-[#160f2e] border border-[#2a2150] rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c5cff] animate-pulse" />
            LIVE GOOGLE SEARCH SIGNAL ENGINE
          </div>
          <h1 className="display text-[2.6rem] leading-[1.06] md:text-6xl font-bold mb-6 tracking-tight">
            See the trend<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#e6dcff] via-[#b9a3ff] to-[#7c5cff]">
              before it's a trend.
            </span>
          </h1>
          <p className="body-f text-[#b3a9d9] text-[15px] leading-relaxed mb-8 max-w-md">
            Our engine scans live signals across TikTok, Reels, product marketplaces and on-chain
            narratives every hour — surfacing what's about to break out, hours before it's obvious.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const active = persona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm body-f font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white font-medium shadow-[0_0_20px_rgba(124,92,255,0.35)]"
                      : "bg-[#130f26] text-[#a99fd4] hover:bg-[#1c1633] border border-[#231b45]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {p.label}
                </button>
              );
            })}
          </div>
          <p className="mono text-[11px] text-[#655a92] mb-8">{activePersona.tag}</p>
          {!isLoggedIn ? (
            <button
              onClick={() => setShowSignIn(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:shadow-[0_0_30px_rgba(124,92,255,0.45)] transition shadow-lg"
            >
              Start 3-day free trial <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:shadow-[0_0_30px_rgba(124,92,255,0.45)] transition shadow-lg"
            >
              {hasActiveSub ? "Manage plan" : "View plans"} <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
        <RadarCore />
      </section>

      {/* TRUST BAR */}
      <section className="theme-stats border-y border-[#1c1633] bg-[#0a0817]/60">
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Activity, value: "Hourly", label: "Signal refresh cycle" },
            { icon: ShieldCheck, value: "Encrypted", label: "Data in transit & at rest" },
            { icon: Zap, value: "Google Search", label: "Live-grounded AI signals" },
            { icon: Clock, value: "< 60s", label: "Manual scan turnaround" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#160f2e] border border-[#2a2150] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#a98bff]" />
                </div>
                <div>
                  <p className="display text-sm font-semibold leading-tight">{s.value}</p>
                  <p className="mono text-[10px] text-[#7c729f] leading-tight mt-0.5">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SignalTicker />

      {/* CATEGORIES */}
      <section id="categories" className="max-w-6xl mx-auto px-6 py-20">
        <p className="mono text-[11px] tracking-widest text-[#7c5cff] mb-3">COVERAGE</p>
        <h2 className="display text-2xl md:text-3xl font-bold mb-10">Seven signal types, scanned continuously.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_VISUALS.map((c) => (
            <CategoryOrb key={c.key} icon={c.icon} color={c.color} label={c.key} desc={c.desc} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20">
        <p className="mono text-[11px] tracking-widest text-[#7c5cff] mb-3">THE PIPELINE</p>
        <h2 className="display text-2xl md:text-3xl font-bold mb-10">Three stages, one hour, zero noise.</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: "01", icon: Gauge, title: "Velocity scan", body: "Every hour, our engine sweeps live search signals to measure how fast a sound, tag, product or coin is accelerating — not how big it already is." },
            { n: "02", icon: Sparkles, title: "Noise filter", body: "One-off spikes get discarded automatically. Only sustained, compounding growth gets promoted into a tracked signal." },
            { n: "03", icon: Bell, title: "Instant surfacing", body: "The moment something crosses your persona's threshold, it lands at the top of your live feed — ranked and ready to act on." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-2xl p-6 hover:border-[#7c5cff]/40 transition">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b6bff]/20 to-[#6941e8]/20 border border-[#7c5cff]/30 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-[#a98bff]" />
                  </div>
                  <span className="mono text-xs text-[#4a4270]">{f.n}</span>
                </div>
                <p className="display font-semibold mb-2 text-[15px]">{f.title}</p>
                <p className="body-f text-sm text-[#a99fd4] leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEED */}
      <section id="feed" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="display text-2xl md:text-3xl font-extrabold tracking-tight">Live feed <span className="text-[#8b6bff]">—</span> {activePersona.label}</h2>
            {!checkingLive && (
              liveTrends ? (
                <span className="flex items-center gap-1.5 mono text-[10px] text-[#c9bfff] bg-[#160f2e] border border-[#7c5cff]/40 rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7c5cff] animate-pulse" /> LIVE
                </span>
              ) : (
                <span className="mono text-[10px] text-[#655a92] bg-[#0f0d1f] border border-[#1c1633] rounded-full px-2.5 py-1">
                  SAMPLE PREVIEW
                </span>
              )
            )}
          </div>
          <span className="mono text-xs text-[#655a92]">sorted by trend score</span>
        </div>

        {!isLoggedIn ? (
          <div className="glass rounded-2xl p-10 text-center">
            <Lock className="w-5 h-5 text-[#a98bff] mx-auto mb-3" />
            <p className="display font-semibold mb-2">Sign in to see live trends</p>
            <p className="body-f text-sm text-[#a99fd4] mb-6">See exactly what is accelerating before everyone else.</p>
            <div className="grid md:grid-cols-3 gap-3 text-left mb-6">
              {PREVIEW_SIGNALS.map((signal) => <div key={signal.name} className="relative overflow-hidden rounded-xl border border-[#7c5cff]/20 bg-[#100c20] p-4">
                <div className="blur-[5px] select-none opacity-70"><p className="mono text-[9px] text-[#a99fd4] uppercase">{signal.category}</p><p className="display text-xs font-bold mt-2">{signal.name}</p><p className="mono text-lg font-bold mt-4" style={{color:signal.color}}>{signal.velocity}</p></div>
                <div className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-[#1b1435]/90 px-3 py-1.5 mono text-[9px] text-[#c9bfff]">LIVE SIGNAL LOCKED</span></div>
              </div>)}
            </div>
            <button onClick={() => setShowSignIn(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-5 py-2.5 rounded-xl text-sm font-semibold">Sign in</button>
            <p className="mono text-[10px] text-[#655a92] mt-3">3-day free trial · cancel anytime</p>
          </div>
        ) : !profileLoaded ? (
          <div className="glass rounded-2xl p-10 text-center animate-pulse"><p className="body-f text-sm text-[#a99fd4]">Loading your access…</p></div>
        ) : !selectedPlan ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="display font-semibold mb-2">Choose your plan to continue</p>
            <p className="body-f text-sm text-[#a99fd4] mb-5">Start your 3-day free trial. You can cancel anytime.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => choosePlan("pro")} className="bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-5 py-2.5 rounded-xl text-sm font-semibold">Start Pro trial</button>
              <button onClick={() => choosePlan("investor")} className="border border-[#7c5cff]/50 text-[#c9bfff] px-5 py-2.5 rounded-xl text-sm font-semibold">Start Signal+ trial</button>
            </div>
          </div>
        ) : trialExpiredNoSub ? (
          <div className="glass rounded-2xl p-10 text-center">
            <Lock className="w-5 h-5 text-[#a98bff] mx-auto mb-3" />
            <p className="display font-semibold mb-2">Your 3-day trial has ended</p>
            <p className="body-f text-sm text-[#a99fd4] mb-5 max-w-sm mx-auto">
              Pick a plan below to keep tracking live signals — cancel anytime.
            </p>
            <a href="#pricing" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-[0_0_25px_rgba(124,92,255,0.4)] transition">
              View plans <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : checkingLive ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-5 h-[156px] animate-pulse">
                <div className="h-2.5 w-20 bg-[#1c1633] rounded mb-3" />
                <div className="h-3.5 w-32 bg-[#1c1633] rounded mb-6" />
                <div className="h-9 w-full bg-[#130f26] rounded mb-3" />
                <div className="h-2.5 w-24 bg-[#1c1633] rounded" />
              </div>
            ))}
          </div>
        ) : visibleTrends.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="body-f text-sm text-[#a99fd4]">No signals for this persona yet — try Refresh, or check back soon.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {categories.map((category) => {
              const categoryInfo = CATEGORY_VISUALS.find((item) => item.key === category);
              const CategoryIcon = categoryInfo?.icon ?? Layers;
              const categoryTrends = visibleTrends.filter((t) => t.category === category);
              const isExpanded = expandedColumns[category];
              const shownTrends = isExpanded ? categoryTrends : categoryTrends.slice(0, 4);
              return <div key={category} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${categoryInfo?.color}22`}}><CategoryIcon className="w-4 h-4" style={{color:categoryInfo?.color}} /></div><div><p className="display text-xs font-bold">{category === "Sound" ? "TikTok Sounds" : category + "s"}</p><p className="mono text-[9px] theme-muted">{categoryTrends.length} signals</p></div></div>
                  <span className="mono text-[9px] text-[#7c5cff]">TOP VIRAL</span>
                </div>
                <div className="space-y-2">
                {shownTrends.map((t, idx) => {
              const locked = idx >= freeLimit;
              const watched = watchlist.has(t.id);
              return (
                <div key={t.id} onClick={() => setSelectedTrend(t)} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedTrend(t)} className="relative rounded-2xl border border-[#7c5cff]/15 bg-[#130f26]/60 p-4 overflow-hidden cursor-pointer hover:border-[#7c5cff]/60 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(66,45,150,.22)] transition-all duration-200">
                  <div className="h-16 -mx-4 -mt-4 mb-3 flex items-end justify-between px-4 pb-3 relative overflow-hidden" style={{background:`linear-gradient(120deg, ${categoryInfo?.color}35, transparent 68%)`}}><div className="absolute -right-3 -top-8 text-[86px] opacity-20 rotate-12">{t.emoji || CATEGORY_EMOJI[t.category] || "📡"}</div><span className={`relative z-10 mono text-[9px] font-bold tracking-widest ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{t.score >= 60 ? "● BREAKING" : t.score >= 30 ? "↗ RISING" : "○ COOLING"}</span><span className="relative z-10 mono text-[9px] text-[#a99fd4]">OPEN SIGNAL →</span></div>
                  {locked && (
                    <div className="absolute inset-0 bg-[#060512]/92 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-3 text-center">
                      <Lock className="w-4 h-4 text-[#a98bff]" />
                      <span className="mono text-xs text-[#a99fd4]">
                        {isLoggedIn ? "Upgrade to unlock" : "Sign in for free trial"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="flex items-center gap-2"><span className="text-lg">{t.emoji || CATEGORY_EMOJI[t.category] || "📡"}</span><p className="mono text-[10px] text-[#7c729f] uppercase tracking-wide">{t.category} · {t.platform}</p></div>
                      <p className="display font-semibold text-[13px] mt-1 leading-snug">{t.name}</p>
                    </div>
                    <button onClick={(event) => { event.stopPropagation(); toggleWatch(t.id); }} className="shrink-0">
                      <Star className={`w-4 h-4 ${watched ? "fill-[#f5b83d] text-[#f5b83d]" : "text-[#4a4270]"}`} />
                    </button>
                  </div>
                  <Sparkline data={t.spark} />
                  <p className="body-f text-[10px] leading-relaxed text-[#7c729f] mt-1.5"><span className="font-semibold text-[#a99fd4]">Why it matters: </span>{t.description || TREND_COPY[t.category] || "A live signal detected by Trend Radar."}</p>
                  <p className="body-f text-[10px] leading-relaxed text-[#a98bff] mt-1"><span className="font-semibold">Do this: </span>{TREND_ACTION[t.category] || "Move early while the signal is gaining momentum."}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`flex items-center gap-1 mono text-[10px] font-bold ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>
                      <TrendingUp className="w-3 h-3" /> +{t.velocity}%
                    </span>
                    <span className={`mono text-[9px] font-bold ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{t.score >= 60 ? "HOT" : t.score >= 30 ? "WARMING" : "COOLING"} · {t.score}</span>
                  </div>
                  <p className="mono text-[9px] text-[#4a4270] mt-1">first seen {t.firstSeen ?? "recently"}h ago</p>
                </div>
              );
                })}
                </div>
                {categoryTrends.length > 4 && <button onClick={() => setExpandedColumns((prev) => ({...prev, [category]: !isExpanded}))} className="w-full mt-3 py-2 rounded-lg border border-[#7c5cff]/25 text-[#a98bff] mono text-[10px] font-bold hover:bg-[#7c5cff]/10 transition">{isExpanded ? "Show less" : `See more (${categoryTrends.length - 4})`}</button>}
              </div>;
            })}
          </div>
        )}
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24">
        <p className="mono text-[11px] tracking-widest text-[#7c5cff] mb-3">PLANS</p>
        <h2 className="display text-2xl md:text-3xl font-bold mb-2">Unlock every signal.</h2>
        <p className="body-f text-[#a99fd4] mb-10 text-sm">
          Every plan starts with a 3-day free trial — cancel anytime, no charge if you cancel before it ends.
        </p>
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
          {[
            { id: "pro", name: "Pro", price: "$29", period: "/mo", features: ["All trends, live", "Push alerts on new signals", "Watchlist & history", "Every category unlocked"], highlight: true },
            { id: "investor", name: "Signal+", price: "$99", period: "/mo", features: ["Everything in Pro", "On-chain meme-coin scanner", "API access", "Priority on new signal types"] },
          ].map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-7 relative ${
                plan.highlight
                  ? "border border-[#7c5cff] bg-gradient-to-b from-[#1c1440] to-[#130f26] shadow-[0_0_40px_rgba(124,92,255,0.15)]"
                  : "glass"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-7 bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white text-[10px] font-bold px-2.5 py-1 rounded-full mono tracking-wide">
                  MOST POPULAR
                </span>
              )}
              <p className="display font-bold text-lg">{plan.name}</p>
              <p className="mono text-[2rem] font-bold text-[#c9bfff] my-3">
                {plan.price}<span className="text-sm text-[#7c729f]">{plan.period}</span>
              </p>
              <ul className="space-y-2 mt-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm body-f text-[#b3a9d9]">
                    <Check className="w-3.5 h-3.5 text-[#7c5cff] mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (!isLoggedIn) { setShowSignIn(true); return; }
                  startCheckout(plan.id);
                }}
                className="mt-6 w-full py-3 rounded-xl text-sm font-semibold transition bg-gradient-to-r from-[#8b6bff] to-[#6941e8] text-white shadow-lg hover:shadow-[0_0_25px_rgba(124,92,255,0.4)]"
              >
                {isLoggedIn ? "Choose plan" : "Start free trial"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#1c1633] py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Radar className="w-4 h-4 text-[#7c5cff]" />
          <span className="display font-bold text-sm tracking-tight">TREND/RADAR</span>
        </div>
        <div className="flex items-center justify-center gap-4 mono text-[11px] text-[#7c729f]">
          <a href="/privacy.html" className="hover:text-[#c9bfff] transition">Privacy Policy</a>
          <span className="text-[#2a2150]">·</span>
          <a href="/terms.html" className="hover:text-[#c9bfff] transition">Terms of Service</a>
        </div>
        <p className="mono text-[10px] text-[#4a4270] mt-4">© {new Date().getFullYear()} Trend Radar. All rights reserved.</p>
      </footer>
    </div>
  );
}
