import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Analytics } from "@vercel/analytics/react";
import {
  Radar, TrendingUp, Star, Users, ShoppingBag, Coins, Video,
  Check, Activity, Bell, ArrowRight, Gauge, Sparkles, Lock,
  ShieldCheck, Zap, Clock, Music2, Hash, Layers, Palette, MessageSquare,
  Mail, LogOut, User as UserIcon,
  Sun, Moon, RefreshCw, Search, SlidersHorizontal,
} from "lucide-react";

/* =========================================================
   SUPABASE (auth + trial)
   ========================================================= */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TRIAL_DAYS = 3;
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";
const DATA_REGION = import.meta.env.VITE_TREND_REGION || "Global web signals";
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const trackEvent = (name, params = {}) => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, params);
};
const normalizeTier = (value) => String(value || "").trim().toLowerCase().replace(/[+\s]/g, "");

/* =========================================================
   MOCK SIGNAL ENGINE (fallback preview data before live data loads)
   ========================================================= */
const PERSONAS = [
  { id: "creator", label: "Creator", icon: Video, tag: "TikTok / Shorts / Reels" },
  { id: "store", label: "E-commerce", icon: ShoppingBag, tag: "Product sourcing" },
  { id: "marketer", label: "Marketer", icon: Users, tag: "Campaign timing" },
  { id: "investor", label: "Investor", icon: Coins, tag: "Meme-coin narratives" },
  { id: "coins", label: "Coins", icon: Coins, tag: "Market-moving crypto assets" },
  { id: "memecoins", label: "Meme Coins", icon: Coins, tag: "Meme-coin momentum" },
  { id: "crypto-makers", label: "Crypto Makers", icon: Users, tag: "Builders, creators and protocols" },
];

const CATEGORY_BY_PERSONA = {
  creator: ["Sound", "Hashtag", "Format"],
  store: ["Product", "Aesthetic", "Hashtag"],
  marketer: ["Hashtag", "Format", "Aesthetic"],
  investor: ["Coin", "Narrative"],
  coins: ["CryptoCoin"],
  memecoins: ["MemeCoin"],
  "crypto-makers": ["CryptoMaker"],
};

const NAME_POOL = {
  Sound: ["\"Corridor\" slowed remix", "8-bit villain riff", "rainy lo-fi loop v2", "static-hum transition cue", "brainrot sound mashup #7"],
  Hashtag: ["#quietluxury2", "#deskbombing", "#feralgirlsummer3", "#cozycore.exe", "#glitchcore.tools", "#italianbrainrot"],
  Format: ["POV: silent vlog", "3-second hook stitch", "\"rate my setup\" duet", "split-screen reaction", "AI-narrated brainrot skit"],
  Product: ["mini heatless curler v2", "glass-skin serum stick", "LED desk fog lamp", "wearable neck-fan clip"],
  Aesthetic: ["mob wife 2.0", "dopamine minimalism", "goblincore office", "liminal beige"],
  Coin: ["$FROGWIF", "$STATIC", "$NANOCAT", "$GHOSTPEPE", "$BRAINROT"],
  Narrative: ["AI-agent memes", "retro-internet nostalgia", "sleep-deprived dev humor", "anti-hustle culture", "Italian brainrot animal lore", "surreal AI-generated meme creatures"],
  CryptoCoin: ["Bitcoin ETF flows", "Solana DeFi rotation", "Ethereum restaking", "Base ecosystem growth", "Chainlink oracle demand"],
  MemeCoin: ["PEPE community revival", "BONK trading velocity", "FLOKI gaming narrative", "BRETT Base momentum", "WIF social dominance"],
  CryptoMaker: ["Farcaster mini-app builders", "Zora creator launches", "Base protocol teams", "Solana creator tools", "On-chain game studios"],
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
        sourceUrl: trendFallbackUrl({ name, platform: PLATFORMS[Math.floor(rand() * PLATFORMS.length)], category }),
      });
    });
  });
  return out.sort((a, b) => b.score - a.score);
}
const ALL_TRENDS = generateTrends();

const API_BASE = (import.meta.env.VITE_API_URL || "https://trend-radar-backend-production.up.railway.app").replace(/\/$/, "");

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
    sourceUrl: /^https?:\/\//i.test(String(t.source_url || "")) ? t.source_url : trendFallbackUrl(t),
    mediaUrl: /^https?:\/\//i.test(String(t.media_url || "")) ? t.media_url : null,
    mediaType: t.media_type === "video" ? "video" : "image",
    spark,
    firstSeen: hoursAgo,
  };
}
function trendFallbackUrl(trend) {
  const query = encodeURIComponent(`${trend.name || "trend"} ${trend.platform || ""}`.trim());
  if (trend.category === "Product") return `https://www.amazon.com/s?k=${query}`;
  if (trend.category === "Coin" || trend.category === "MemeCoin") return `https://dexscreener.com/search?q=${query}`;
  if (trend.category === "CryptoCoin") return `https://www.coingecko.com/en/search?query=${query}`;
  if (trend.category === "CryptoMaker") return `https://www.google.com/search?q=${query}`;
  if (trend.category === "Sound" || /tiktok/i.test(trend.platform || "")) return `https://www.tiktok.com/search?q=${query}`;
  if (/instagram/i.test(trend.platform || "")) return `https://www.instagram.com/explore/search/keyword/?q=${query}`;
  if (/youtube/i.test(trend.platform || "")) return `https://www.youtube.com/results?search_query=${query}`;
  return `https://www.google.com/search?q=${query}`;
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
function RadarCore({ trends }) {
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

  const sourceTrends = Array.isArray(trends) && trends.length ? trends : ALL_TRENDS;
  const blips = useMemo(
    () => sourceTrends.slice(0, 9).map((t, i) => ({
      id: t.id,
      r: 34 + ((i * 19) % 58),
      theta: (i * 71) % 360,
      z: (i % 3) * 22 - 22,
      size: 3.5 + (t.score % 4),
      label: t.name,
      velocity: t.velocity,
    })),
    [sourceTrends]
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

function SignalTicker({ trends }) {
  const sourceTrends = Array.isArray(trends) && trends.length ? trends : ALL_TRENDS;
  const items = useMemo(() => sourceTrends.slice(0, 14), [sourceTrends]);
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

const CATEGORY_VISUALS = [
  { key: "Sound", icon: Music2, color: "#7c5cff", desc: "Audio & remix trends before they're everywhere" },
  { key: "Hashtag", icon: Hash, color: "#f5b83d", desc: "Tags accelerating across every platform" },
  { key: "Format", icon: Layers, color: "#4fd1c5", desc: "Video formats creators are about to copy" },
  { key: "Product", icon: ShoppingBag, color: "#ff6b9d", desc: "Physical products about to spike in demand" },
  { key: "Aesthetic", icon: Palette, color: "#8b6bff", desc: "Visual styles taking over feeds" },
  { key: "Coin", icon: Coins, color: "#ffd166", desc: "On-chain narratives gaining early velocity" },
  { key: "Narrative", icon: MessageSquare, color: "#7cc8ff", desc: "Cultural moments forming in real time" },
];
const SIGNAL_LOCKED_FOLDERS = [
  { key: "Meme Coins", category: "MemeCoin", icon: Coins, color: "#ff8b6a", desc: "Early meme-coin momentum and attention shifts" },
  { key: "Crypto Makers", category: "CryptoMaker", icon: Users, color: "#79e0c2", desc: "Builders, creators and protocols attracting fresh attention" },
  { key: "Crypto Markets", category: "CryptoCoin", icon: TrendingUp, color: "#58b8ff", desc: "Crypto narratives, sectors and market signals" },
  { key: "Narratives", category: "Narrative", icon: MessageSquare, color: "#c084fc", desc: "Long-horizon stories shaping the next cycle" },
  { key: "Global Markets", category: "News", icon: Gauge, color: "#35d07f", desc: "Macro themes and cross-market opportunities" },
];
const FREE_TRIAL_FOLDERS = new Set(["Sound", "Hashtag", "Format"]);

const TREND_COPY = {
  Sound: "Audio gaining momentum across short-form video. Use it early before saturation.",
  Hashtag: "Conversation accelerating across social platforms with growing audience intent.",
  Format: "A repeatable video format that creators are beginning to copy at scale.",
  Product: "Early demand signal before competition and ad costs rise.",
  Aesthetic: "A visual direction spreading through feeds and creator content.",
  Coin: "An emerging on-chain narrative showing unusual momentum and attention.",
  Narrative: "A cultural conversation building across communities and media channels.",
  CryptoCoin: "Large-cap crypto assets showing fresh attention and momentum.",
  MemeCoin: "Meme-coin communities and tokens showing unusual early attention.",
  CryptoMaker: "Crypto builders, creators and protocols attracting fresh ecosystem attention.",
};
const CATEGORY_EMOJI = { Sound: "🎵", Hashtag: "#️⃣", Format: "🎬", Product: "🛍️", Aesthetic: "✨", Coin: "🪙", Narrative: "💬", CryptoCoin: "₿", MemeCoin: "🐸", CryptoMaker: "🛠️" };
const TREND_ACTION = { Sound: "Use this audio in your next 1–2 posts.", Hashtag: "Add it only where it fits your content angle.", Format: "Adapt this format before it becomes saturated.", Product: "Validate demand before competitors catch up.", Aesthetic: "Build your next creative around this visual direction.", Coin: "Watch momentum and risk before taking action.", Narrative: "Create content around the conversation while it is early.", CryptoCoin: "Review liquidity and risk before taking action.", MemeCoin: "Check liquidity, holders and risk before taking action.", CryptoMaker: "Research the team and product before making a decision." };
const TREND_MEDIA = { Sound: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=80", Hashtag: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1000&q=80", Format: "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1000&q=80", Product: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80", Aesthetic: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80", Coin: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1000&q=80", Narrative: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1000&q=80", CryptoCoin: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1000&q=80", MemeCoin: "https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1000&q=80", CryptoMaker: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=80" };
const TREND_MEDIA_POOL = {
  Sound: [TREND_MEDIA.Sound, "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1000&q=80"],
  Hashtag: [TREND_MEDIA.Hashtag, "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1000&q=80"],
  Format: [TREND_MEDIA.Format, "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=80"],
  Product: [TREND_MEDIA.Product, "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1000&q=80"],
  Aesthetic: [TREND_MEDIA.Aesthetic, "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1000&q=80"],
  Coin: [TREND_MEDIA.Coin, "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=1000&q=80"],
  Narrative: [TREND_MEDIA.Narrative, "https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=1000&q=80"],
};
function fallbackMediaForTrend(trend) {
  const name = String(trend.name || "").toLowerCase();
  if (trend.category === "Coin" && /bitcoin|btc/.test(name)) return "https://assets.coincap.io/assets/icons/btc@2x.png";
  const emoji = CATEGORY_EMOJI[trend.category] || "📡";
  const label = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#142650"/><stop offset="1" stop-color="#24145a"/></linearGradient></defs><rect width="900" height="420" fill="url(#g)"/><circle cx="450" cy="190" r="115" fill="#58b8ff" opacity=".12"/><text x="450" y="225" text-anchor="middle" font-size="120">${emoji}</text><text x="450" y="350" text-anchor="middle" fill="#d5e4ff" font-family="Arial" font-size="26">${trend.category} signal</text></svg>`);
  return `data:image/svg+xml,${label}`;
}
function trendVerdict(score) {
  if (score >= 60) return { label: "Act now", text: "Strong early signal — test it while momentum is high." };
  if (score >= 30) return { label: "Watch closely", text: "Momentum is building — validate it before committing." };
  return { label: "Wait", text: "Momentum is weak or cooling — avoid spending money yet." };
}
function platformMark(platform) {
  if (/tiktok/i.test(platform || "")) return "♪";
  if (/instagram/i.test(platform || "")) return "◎";
  if (/youtube/i.test(platform || "")) return "▶";
  if (/telegram/i.test(platform || "")) return "✈";
  if (/x/i.test(platform || "")) return "𝕏";
  return "✦";
}
const SEARCH_SUGGESTIONS = [
  "TikTok sounds", "TikTok hashtags", "TikTok formats", "Instagram Reels", "YouTube Shorts",
  "football trends", "football match signals", "sports audience", "football creator ideas",
  "crypto narratives", "meme coins", "DeFi", "Bitcoin", "Solana", "AI products",
  "viral products", "e-commerce ideas", "beauty trends", "fashion aesthetics", "marketing hooks",
];
const SEARCH_ALIASES = {
  tiktok: ["tiktok", "sound", "hashtag", "format"],
  crypto: ["coin", "narrative", "crypto", "bitcoin", "solana", "defi"],
  "meme coin": ["coin", "narrative"],
  products: ["product", "aesthetic"],
  product: ["product", "aesthetic"],
  fashion: ["aesthetic"],
  marketing: ["hashtag", "format", "aesthetic"],
};
function matchesTrendSearch(trend, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [trend.name, trend.category, trend.platform, trend.description].map((value) => String(value || "").toLowerCase());
  if (fields.some((field) => field.includes(q))) return true;
  const aliases = Object.entries(SEARCH_ALIASES).find(([key]) => q.includes(key) || key.includes(q));
  return !!aliases && aliases[1].some((term) => fields.some((field) => field.includes(term)));
}

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
              {status === "sending" ? "Sending..." : "Request beta access"}
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
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [liveTrends, setLiveTrends] = useState(null);
  const [sourceStatus, setSourceStatus] = useState({ google: "unknown", gdelt: "unknown" });
  const [checkingLive, setCheckingLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("trend-theme") === "light");
  const [expandedColumns, setExpandedColumns] = useState({});
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [trendSort, setTrendSort] = useState("signal");
  const [trendWindow, setTrendWindow] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [footballMatches, setFootballMatches] = useState([]);
  const [footballOpen, setFootballOpen] = useState(false);
  const [signalNotice, setSignalNotice] = useState(false);
  const [footballQuery, setFootballQuery] = useState("");
  const [footballLoading, setFootballLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [savedMatches, setSavedMatches] = useState(() => new Set(JSON.parse(localStorage.getItem("saved-matches") || "[]")));
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem("trend-profile-avatar") || "");
  const [profileSettings, setProfileSettings] = useState(() => {
    try { return { showExplanations: true, showSourceLinks: true, showMetrics: true, compactCards: false, ...JSON.parse(localStorage.getItem("trend-profile-settings") || "{}") }; }
    catch (_) { return { showExplanations: true, showSourceLinks: true, showMetrics: true, compactCards: false }; }
  });

  // Auth + trial state
  const [session, setSession] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [trialStartedAt, setTrialStartedAt] = useState(null);
  const [hasActiveSub, setHasActiveSub] = useState(false);
  const [activeTier, setActiveTier] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const isLoggedIn = !!session?.user;
  const hasSignalAccess = isLoggedIn && hasActiveSub && ["investor", "signal", "signalplus"].includes(normalizeTier(activeTier));

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
      const { data: activeSubscriptions } = await supabase
        .from("subscriptions")
        .select("status, tier")
        .eq("user_id", session.user.id)
        .eq("status", "active");
      const subRow = (activeSubscriptions ?? []).find((row) => ["investor", "signal", "signalplus"].includes(normalizeTier(row.tier)))
        ?? activeSubscriptions?.[0]
        ?? null;
      if (cancelled) return;
      setTrialStartedAt(userRow?.trial_started_at ?? session.user.created_at);
      setSelectedPlan(userRow?.selected_plan ?? null);
      setHasActiveSub(!!subRow);
      setActiveTier(normalizeTier(subRow?.tier ?? null) || null);
      setProfileLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    const tierQuery = activeTier ? `&tier=${encodeURIComponent(activeTier)}` : "";
    fetch(`${API_BASE}/api/trends?persona=${persona}${tierQuery}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSourceStatus(data?.sourceStatus || { google: "unknown", gdelt: "unknown" });
        if (data?.trends?.length > 0) setLiveTrends(data.trends.map(normalizeTrend));
        else setLiveTrends(null);
      })
      .catch(() => { if (!cancelled) setLiveTrends(null); })
      .finally(() => { if (!cancelled) setCheckingLive(false); });
    return () => { cancelled = true; };
  }, [persona, session?.access_token, activeTier]);

  useEffect(() => {
    if (!hasSignalAccess || !session?.access_token) { setFootballMatches([]); setFootballLoading(false); return; }
    let cancelled = false;
    setFootballLoading(true);
    fetch(`${API_BASE}/api/sports/matches`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) setFootballMatches(Array.isArray(data?.matches) ? data.matches.slice(0, 12) : []); })
      .catch(() => { if (!cancelled) setFootballMatches([]); })
      .finally(() => { if (!cancelled) setFootballLoading(false); });
    return () => { cancelled = true; };
  }, [hasSignalAccess, session?.access_token]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch (e) { /* nothing saved yet */ }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    supabase.from("watchlist").select("trend_id").then(({ data }) => {
      if (!cancelled && Array.isArray(data)) setWatchlist(new Set(data.map((row) => row.trend_id)));
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session?.user) { setAlerts([]); return; }
    let cancelled = false;
    supabase.from("alerts").select("id, trend_id, threshold_score, threshold_velocity, sent_at").order("id", { ascending: false }).then(({ data }) => {
      if (!cancelled) setAlerts(Array.isArray(data) ? data : []);
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!selectedTrend?.id) return;
    let cancelled = false;
    if (!session?.access_token) return;
    fetch(`${API_BASE}/api/trends/${selectedTrend.id}/history`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const history = Array.isArray(data?.history) ? data.history : [];
        if (cancelled || history.length < 2) return;
        const spark = history.map((point) => Number(point.score)).filter(Number.isFinite);
        if (spark.length < 2) return;
        setSelectedTrend((current) => current ? { ...current, spark } : current);
        setLiveTrends((current) => current ? current.map((trend) => String(trend.id) === String(selectedTrend.id) ? { ...trend, spark } : trend) : current);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedTrend?.id]);

  useEffect(() => { localStorage.setItem("trend-profile-settings", JSON.stringify(profileSettings)); }, [profileSettings]);

  const updateProfileSetting = (key) => setProfileSettings((previous) => ({ ...previous, [key]: !previous[key] }));
  const handleProfileAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { window.alert("Please choose an image smaller than 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result || ""); setProfileAvatar(value); localStorage.setItem("trend-profile-avatar", value); };
    reader.readAsDataURL(file);
  };

  const toggleWatch = async (id) => {
    if (session?.user) {
      const exists = watchlist.has(id);
      const result = exists
        ? await supabase.from("watchlist").delete().eq("user_id", session.user.id).eq("trend_id", id)
        : await supabase.from("watchlist").insert({ user_id: session.user.id, trend_id: id });
      if (result.error) { window.alert("Could not update your watchlist. Please try again."); return; }
    }
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("watchlist", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const createTrendAlert = async (trend) => {
    if (!session?.user) { setShowSignIn(true); return; }
    const threshold = window.prompt("Alert me when this trend reaches score:", String(Math.max(1, Number(trend.score || 0))));
    if (threshold === null) return;
    const thresholdScore = Number(threshold);
    if (!Number.isFinite(thresholdScore) || thresholdScore < 0 || thresholdScore > 99) {
      window.alert("Please enter a score from 0 to 99.");
      return;
    }
    if (alerts.some((item) => String(item.trend_id) === String(trend.id) && Number(item.threshold_score) === Math.round(thresholdScore) && !item.sent_at)) {
      window.alert("You already have this alert.");
      return;
    }
    const { error } = await supabase.from("alerts").insert({ user_id: session.user.id, trend_id: trend.id, threshold_score: Math.round(thresholdScore) });
    if (error) { window.alert("Could not create the alert. Please try again."); return; }
    setAlerts((previous) => [{ id: `local-${Date.now()}`, trend_id: trend.id, threshold_score: Math.round(thresholdScore), sent_at: null }, ...previous]);
    window.alert("Alert created. We will email you when the score reaches your threshold.");
  };

  const deleteAlert = async (alertId) => {
    if (String(alertId).startsWith("local-")) { setAlerts((previous) => previous.filter((item) => item.id !== alertId)); return; }
    const { error } = await supabase.from("alerts").delete().eq("id", alertId);
    if (error) { window.alert("Could not delete the alert. Please try again."); return; }
    setAlerts((previous) => previous.filter((item) => item.id !== alertId));
  };

  const categories = hasSignalAccess
    ? CATEGORY_VISUALS.map((item) => item.key)
    : CATEGORY_BY_PERSONA[persona];
  const allVisibleTrends = liveTrends ?? ALL_TRENDS.filter((t) => categories.includes(t.category));
  const visibleTrends = allVisibleTrends.filter((t) => {
    if (showWatchlistOnly && !watchlist.has(t.id)) return false;
    const query = searchQuery.trim().toLowerCase();
    const hours = Number(t.firstSeen);
    const inWindow = trendWindow === "all" || (Number.isFinite(hours) && hours <= Number(trendWindow));
    if (!inWindow) return false;
    if (!query) return true;
    return matchesTrendSearch(t, query);
  }).sort((a, b) => {
    if (trendSort === "newest") return Number(a.firstSeen ?? 99999) - Number(b.firstSeen ?? 99999);
    if (trendSort === "oldest") return Number(b.firstSeen ?? -1) - Number(a.firstSeen ?? -1);
    if (trendSort === "score") return Number(b.score ?? 0) - Number(a.score ?? 0);
    if (trendSort === "velocity") return Number(b.velocity ?? 0) - Number(a.velocity ?? 0);
    return (Number(b.score ?? 0) * 2 + Number(b.velocity ?? 0)) - (Number(a.score ?? 0) * 2 + Number(a.velocity ?? 0));
  });
  const activePersona = PERSONAS.find((p) => p.id === persona);
  const categoriesToRender = selectedCategory ? [selectedCategory] : [];
  const filteredFootballMatches = footballMatches.filter((match) => { const q = footballQuery.trim().toLowerCase(); if (!q) return true; return [match.teams?.home?.name, match.teams?.away?.name, match.league?.name, match.league?.country].some((value) => String(value || "").toLowerCase().includes(q)); });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const tierQuery = activeTier ? `&tier=${encodeURIComponent(activeTier)}` : "";
      const r = await fetch(`${API_BASE}/api/trends?persona=${persona}${tierQuery}`, { headers });
      const data = await r.json();
      if (data?.trends?.length > 0) setLiveTrends(data.trends.map(normalizeTrend));
    } catch (e) { /* backend unreachable */ }
    finally { setRefreshing(false); }
  };
  const openMatch = async (match) => {
    if (!hasSignalAccess || !session?.access_token) return;
    setSelectedMatch(match); setMatchDetails(null); setMatchLoading(true);
    try { const response = await fetch(`${API_BASE}/api/sports/matches/${match.fixture?.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); const data = await response.json(); setMatchDetails(data); } catch (_) { setMatchDetails({ error: true }); } finally { setMatchLoading(false); }
  };
  const searchFootball = async () => {
    const query = footballQuery.trim();
    if (!query) return;
    setFootballLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/sports/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json();
      setFootballMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (_) { setFootballMatches([]); }
    finally { setFootballLoading(false); }
  };
  const toggleMatchSaved = (id) => setSavedMatches((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); localStorage.setItem("saved-matches", JSON.stringify([...next])); return next; });

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const toggleTheme = () => setLightMode((value) => { const next = !value; localStorage.setItem("trend-theme", next ? "light" : "dark"); return next; });

  const daysUsed = trialStartedAt
    ? Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86400000)
    : 0;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  const trialActive = trialDaysLeft > 0;
  const choosePlan = async (planId) => {
    if (!session?.user) { setShowSignIn(true); return; }
    const { error } = await supabase.from("users").update({ selected_plan: planId }).eq("id", session.user.id);
    if (!error) setSelectedPlan(planId);
    else alert("Could not save your plan selection. Please try again.");
  };
  const hasFullAccess = isLoggedIn && (trialActive || hasActiveSub);
  const paidTier = normalizeTier(activeTier || selectedPlan);
  const hasProAccess = isLoggedIn && hasFullAccess && (paidTier === "pro" || hasSignalAccess);
  const trialExpiredNoSub = isLoggedIn && profileLoaded && !trialActive && !hasActiveSub;

  // Anonymous / not-yet-trialed visitors see a capped preview; expired trial sees nothing.
  const freeLimit = trialExpiredNoSub ? 0 : hasFullAccess ? Infinity : 3;

  const startCheckout = async (planId) => {
    if (!BILLING_ENABLED) { trackEvent("beta_access_requested", { plan: planId }); setShowSignIn(true); return; }
    const email = session?.user?.email;
    if (!session?.access_token || !email) { setShowSignIn(true); return; }
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, tier: planId }),
      });
      const data = await res.json();
      if (data.url) { trackEvent("checkout_started", { plan: planId }); window.location.href = data.url; }
      else alert("Checkout failed to start. Please try again.");
    } catch (err) {
      alert("Could not reach checkout. Please try again.");
    }
  };

function MatchAnalytics({ match, loading, details, saved, close, toggleSaved }) {
  const stat = (i, type) => details?.statistics?.[i]?.statistics?.find((x) => x.type === type)?.value ?? "—";
  const prediction = details?.predictions?.predictions || {};
  const percent = prediction.percent || {};
  const bookmaker = details?.odds?.[0]?.bookmakers?.[0];
  const odds = bookmaker?.bets?.flatMap((bet) => (bet.values || []).slice(0, 3).map((v) => ({ market: bet.name, label: v.value, odd: v.odd }))) || [];
  const stats = [["Shots on target","Shots on Goal"],["Total shots","Total Shots"],["Possession","Ball Possession"],["Corners","Corner Kicks"],["Fouls","Fouls"],["Yellow cards","Yellow cards"],["Offsides","Offsides"]];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060512]/85 backdrop-blur-md px-4 py-6 overflow-y-auto" onClick={close}><div className="glass w-full max-w-3xl rounded-3xl p-5 md:p-7 my-auto" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-widest text-[#8ea7ff]">AI match intelligence</p><h3 className="display text-2xl font-extrabold mt-1">{match.teams?.home?.name} vs {match.teams?.away?.name}</h3><p className="body-f text-xs theme-muted mt-1">{match.league?.name || "Football"} · Live data analysis</p></div><button onClick={close} className="text-xl theme-muted">×</button></div>{loading ? <p className="body-f text-sm theme-muted py-10 text-center">Analysing live match data…</p> : details?.error ? <p className="body-f text-sm text-[#ff8b8b] py-10 text-center">No live details were returned for this fixture.</p> : <div className="mt-6 space-y-4"><div className="rounded-2xl bg-[#142650]/75 border border-[#6f8dff]/30 p-4"><div className="flex justify-between"><p className="mono text-[10px] uppercase tracking-widest text-[#b9d5ff]">AI prediction report</p><span className="mono text-[9px] text-[#8ea7ff]">probabilities, not guarantees</span></div><div className="grid grid-cols-3 gap-2 mt-4 text-center">{[["HOME",percent.home,"text-[#35d07f]"],["DRAW",percent.draw,"text-[#f5b83d]"],["AWAY",percent.away,"text-[#58b8ff]"]].map(([label,value,color]) => <div key={label}><p className="mono text-[9px] text-[#9eb9e8]">{label}</p><p className={`display text-xl font-extrabold ${color}`}>{value || "Not available"}</p></div>)}</div><div className="mt-4 grid md:grid-cols-3 gap-3 text-sm body-f"><span>Predicted score: <b>{prediction.goals?.home ?? "—"} - {prediction.goals?.away ?? "—"}</b></span><span>AI advice: <b>{prediction.advice || "Awaiting data"}</b></span><span>Best side: <b>{prediction.winner?.name || "Not determined"}</b></span></div></div><div className="rounded-2xl border border-[#6f8dff]/25 p-4"><div className="flex justify-between mb-3"><p className="mono text-[10px] uppercase tracking-widest text-[#a98bff]">Match statistics</p><span className="mono text-[9px] theme-muted">HOME · AWAY</span></div><div className="grid grid-cols-[1fr_64px_64px] gap-y-2 text-xs body-f"><span className="theme-muted">Goals</span><b className="text-center">{match.goals?.home ?? "—"}</b><b className="text-center">{match.goals?.away ?? "—"}</b>{stats.map(([label,type]) => <React.Fragment key={type}><span className="theme-muted">{label}</span><b className="text-center">{stat(0,type)}</b><b className="text-center">{stat(1,type)}</b></React.Fragment>)}</div></div><div className="rounded-2xl border border-[#6f8dff]/25 p-4"><div className="flex justify-between mb-3"><p className="mono text-[10px] uppercase tracking-widest text-[#a98bff]">Bookmaker market snapshot</p><span className="mono text-[9px] theme-muted">{bookmaker?.name || "No bookmaker data"}</span></div>{odds.length ? <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">{odds.map((o,i) => <div key={i} className="rounded-xl bg-[#101a38]/70 px-3 py-2"><p className="mono text-[9px] theme-muted">{o.market}</p><div className="flex justify-between text-xs mt-1"><span>{o.label}</span><b className="text-[#35d07f]">{o.odd}</b></div></div>)}</div> : <p className="body-f text-xs theme-muted">No bookmaker odds were returned for this fixture.</p>}</div><p className="body-f text-xs theme-muted">Live provider data is informational only; no result is guaranteed.</p></div>}<button onClick={() => toggle(match.fixture?.id)} className="mt-5 w-full rounded-xl border border-[#6f8dff]/40 py-3 text-sm font-semibold text-[#b9d5ff]">{saved ? "★ Saved to favourites" : "☆ Save match to favourites"}</button></div></div>;
}

  const matchOverlay = selectedMatch && <MatchAnalytics match={selectedMatch} loading={matchLoading} details={matchDetails} saved={savedMatches.has(selectedMatch.fixture?.id)} close={() => setSelectedMatch(null)} toggle={toggleMatchSaved} />;
  return (
    <div className={`min-h-screen ${lightMode ? "theme-light" : "theme-dark"} relative`}>
      {matchOverlay}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      {selectedTrend && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060512]/75 backdrop-blur-md px-4" onClick={() => setSelectedTrend(null)}><div className="glass rounded-3xl w-full max-w-lg p-7 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b6bff]/30 to-[#4b8cff]/20 border border-[#8b6bff]/40 flex items-center justify-center text-3xl">{selectedTrend.emoji || CATEGORY_EMOJI[selectedTrend.category] || "📡"}</div><div><p className="mono text-[10px] uppercase tracking-widest text-[#a98bff]">{selectedTrend.category} · {selectedTrend.platform}</p><h3 className="display text-xl font-extrabold mt-1">{selectedTrend.name}</h3></div></div><button onClick={() => setSelectedTrend(null)} className="text-[#a99fd4] text-xl">×</button></div><div className="relative mt-6 h-52 rounded-2xl overflow-hidden border border-[#7c5cff]/25">{selectedTrend.mediaUrl ? (selectedTrend.mediaType === "video" ? <video src={selectedTrend.mediaUrl} controls playsInline className="w-full h-full object-cover" /> : <img src={selectedTrend.mediaUrl} alt={`Preview for ${selectedTrend.name}`} className="w-full h-full object-cover" />) : <img src={fallbackMediaForTrend(selectedTrend)} alt={`Example visual for ${selectedTrend.name}`} className="w-full h-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-[#060512]/80 via-transparent to-transparent" /><div className="absolute bottom-4 left-4 flex items-center gap-2"><span className="w-9 h-9 rounded-full bg-white text-[#4b35b8] flex items-center justify-center text-sm">▶</span><span className="mono text-[10px] text-white uppercase tracking-widest">Example preview · {selectedTrend.platform}</span></div></div><div className="mt-5 rounded-2xl bg-[#130f26]/70 border border-[#7c5cff]/20 p-4"><Sparkline data={selectedTrend.spark} color={selectedTrend.score >= 60 ? "#35d07f" : selectedTrend.score >= 30 ? "#f5b83d" : "#ff6b6b"} /><div className="grid grid-cols-2 gap-3 mt-4"><div><p className="mono text-[10px] text-[#7c729f]">TREND SCORE</p><p className={`display text-2xl font-extrabold ${selectedTrend.score >= 60 ? "text-[#35d07f]" : selectedTrend.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{selectedTrend.score}</p></div><div><p className="mono text-[10px] text-[#7c729f]">VELOCITY</p><p className="display text-2xl font-extrabold text-[#a98bff]">+{selectedTrend.velocity}%</p></div></div></div><p className="body-f text-sm leading-relaxed text-[#b3a9d9] mt-5">{selectedTrend.description || TREND_COPY[selectedTrend.category] || "A live signal detected by Trend Radar."}</p><p className="body-f text-xs leading-relaxed text-[#a98bff] mt-2">{TREND_ACTION[selectedTrend.category] || "Move early while the signal is gaining momentum."}</p><p className="mono text-[10px] text-[#7c729f] mt-4">First detected {selectedTrend.firstSeen ?? "recently"} hours ago · Updated hourly</p>{profileSettings.showSourceLinks && selectedTrend.sourceUrl && <a href={selectedTrend.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#35d07f] bg-gradient-to-r from-[#159957] to-[#35d07f] px-4 py-3 text-sm font-extrabold text-white shadow-[0_0_22px_rgba(53,208,127,.3)] transition hover:scale-[1.02]">🔗 Open original source <span className="text-lg">↗</span></a>}</div></div>}
      {!isLoggedIn && <a href="#pricing" className="md:hidden fixed bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b6bff] to-[#6941e8] py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(70,45,180,.45)]">Start 3-day free trial <ArrowRight className="w-4 h-4" /></a>}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .display { font-family: 'Manrope', sans-serif; letter-spacing: -0.035em; }
        .body-f { font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif; }
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
        .profile-compact .glass.rounded-2xl.p-4 { padding: .65rem; }
        .profile-compact .glass.rounded-2xl.p-4 .body-f { font-size: .64rem; }
        .command-input::placeholder { color: #8194bd; opacity: 1; }
        .command-input { font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.01em; }
        .profile-panel { box-shadow: 0 24px 80px rgba(2, 5, 20, .55), 0 0 0 1px rgba(124,92,255,.08); }
        .profile-panel button { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {/* NAV */}
      <header className="relative border-b border-[#1c1633] sticky top-0 bg-[#060512]/85 backdrop-blur-md z-30">
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
                  <span className="hidden sm:flex mono text-[10px] text-[#7cffb0] bg-[#0f2a1c] border border-[#2a5540] rounded-full px-2.5 py-1">{hasSignalAccess ? "SIGNAL+" : "PRO"}</span>
                ) : trialActive ? (
                  <span className="hidden sm:flex mono text-[10px] text-[#c9bfff] bg-[#160f2e] border border-[#7c5cff]/40 rounded-full px-2.5 py-1">
                    {trialDaysLeft}d trial left
                  </span>
                ) : (
                  <span className="hidden sm:flex mono text-[10px] text-[#f5b83d] bg-[#2a2010] border border-[#5a4a20] rounded-full px-2.5 py-1">Trial ended</span>
                )}
                <button onClick={() => setShowProfilePanel((value) => !value)} aria-label="Open profile and settings" className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[#7c5cff]/60 bg-gradient-to-br from-[#8b6bff] to-[#284b91] text-white shadow-[0_0_18px_rgba(124,92,255,.3)] transition hover:scale-105 hover:border-[#58b8ff]">
                  {profileAvatar ? <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" /> : <UserIcon className="mx-auto h-4 w-4" />}
                </button>
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
        {isLoggedIn && showProfilePanel && <div className="profile-panel absolute right-6 top-full z-50 mt-3 w-[min(92vw,380px)] rounded-3xl border border-[#6f8dff]/45 bg-[#0d1631]/98 p-6 text-left backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-[#6f8dff]/20 pb-4"><div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#58b8ff]/70 bg-gradient-to-br from-[#8b6bff] to-[#284b91] flex items-center justify-center text-white">{profileAvatar ? <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" /> : <UserIcon className="h-5 w-5" />}</div><div className="min-w-0"><p className="display text-sm font-bold text-white">Your Trend Radar profile</p><p className="body-f truncate text-xs text-[#9eb9e8]">{session?.user?.email || "Signed-in account"}</p></div><button onClick={() => setShowProfilePanel(false)} className="ml-auto text-lg text-[#9eb9e8]">×</button></div>
          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#58b8ff]/45 bg-[#142650]/70 px-3 py-3 text-xs font-semibold text-[#b9d5ff] transition hover:border-[#35d07f] hover:text-[#8ff0b7]"><span>📷 {profileAvatar ? "Change profile photo" : "Add profile photo"}</span><input type="file" accept="image/*" onChange={handleProfileAvatar} className="hidden" /></label>
          <div className="mt-4"><p className="mono text-[10px] uppercase tracking-widest text-[#8ea7ff]">Dashboard preferences</p>{[["showExplanations","Show trend explanations"],["showSourceLinks","Show original source links"],["showMetrics","Show score and velocity"],["compactCards","Use compact trend cards"]].map(([key,label]) => <button key={key} onClick={() => updateProfileSetting(key)} className="mt-2 flex w-full items-center justify-between rounded-xl border border-[#6f8dff]/20 bg-[#15234a]/60 px-3 py-2.5 text-left text-xs text-[#d5e4ff]"><span>{label}</span><span className={`h-5 w-9 rounded-full p-0.5 transition ${profileSettings[key] ? "bg-[#35d07f]" : "bg-[#38476d]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${profileSettings[key] ? "translate-x-4" : ""}`} /></span></button>)}</div>
          <div className="mt-5 border-t border-[#6f8dff]/20 pt-4">
            <div className="flex items-center justify-between"><p className="mono text-[10px] uppercase tracking-widest text-[#8ea7ff]">My Alerts</p><span className="mono text-[9px] text-[#a99fd4]">{alerts.length}</span></div>
            {alerts.length === 0 ? <p className="body-f mt-2 text-[10px] text-[#9eb9e8]">No alerts yet. Use the Alert button on a trend.</p> : <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">{alerts.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#6f8dff]/20 bg-[#15234a]/60 px-2.5 py-2"><div><p className="mono text-[9px] text-[#d5e4ff]">Score ≥ {item.threshold_score ?? "—"}</p><p className="mono text-[8px] text-[#8ea7ff]">{item.sent_at ? "Sent" : "Waiting"}</p></div><button onClick={() => deleteAlert(item.id)} className="text-[10px] text-[#ff9b9b] hover:text-white" aria-label="Delete alert">Delete</button></div>)}</div>}
          </div>
          <p className="body-f mt-4 text-[10px] leading-relaxed text-[#8ea7ff]">Settings are saved automatically on this device.</p>
        </div>}
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
            TrendRadar turns live web and search signals into clear opportunities for creators and marketers.
            See the source, momentum and context before you decide what to make next.
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
              Request beta access <ArrowRight className="w-4 h-4" />
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
        <RadarCore trends={liveTrends} />
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

      <SignalTicker trends={liveTrends} />

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

      <section className={`max-w-6xl mx-auto px-6 pb-6 ${hasSignalAccess ? "" : "hidden"}`}>
        <button onClick={() => setFootballOpen((value) => !value)} className="flex w-full items-center gap-4 rounded-3xl border border-[#58b8ff]/40 bg-gradient-to-r from-[#142650] to-[#101a38] p-5 text-left hover:border-[#35d07f] transition">
          <span className="text-4xl">⚽</span><span><span className="display block text-lg font-extrabold">Football & Betting</span><span className="body-f text-xs text-[#9eb9e8]">Live matches, odds and AI statistics · {footballOpen ? "folder open" : "click to open"}</span></span><span className="ml-auto text-2xl text-[#58b8ff]">{footballOpen ? "⌃" : "⌄"}</span>
        </button>
      </section>
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="mb-4"><p className="mono text-[10px] uppercase tracking-[.22em] text-[#8ea7ff]">Explore the radar</p><h2 className="display text-2xl md:text-3xl font-extrabold mt-1">Signal folders</h2><p className="body-f text-sm theme-muted mt-2">Choose a folder to explore what is moving right now.</p></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {CATEGORY_VISUALS.map((item) => { const Icon = item.icon; const isFree = FREE_TRIAL_FOLDERS.has(item.key) || hasSignalAccess; return <button key={item.key} onClick={() => { if (!isFree) { setSignalNotice(true); window.setTimeout(() => setSignalNotice(false), 4200); return; } setSelectedCategory(item.key); document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); }} className={`relative glass rounded-2xl border p-4 text-left hover:-translate-y-1 transition ${isFree ? "border-[#6f8dff]/25 hover:border-[#58b8ff]" : "border-[#c084fc]/25 hover:border-[#c084fc]"}`}>
            {!isFree && <span className="absolute right-3 top-3 rounded-full bg-[#0b1028]/80 p-1.5 text-[#c084fc]"><Lock className="h-3.5 w-3.5" /></span>}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: `${item.color}25` }}><Icon className="h-5 w-5" style={{ color: item.color }} /></div><p className="display text-xs font-bold">{item.key === "Sound" ? "TikTok Sounds" : `${item.key}s`}</p><p className="body-f text-[10px] text-[#9eb9e8] mt-1">{isFree ? "Open folder →" : "Signal plan · locked"}</p>
          </button>; })}
          <button onClick={() => { if (!hasSignalAccess) { setSignalNotice(true); window.setTimeout(() => setSignalNotice(false), 4200); return; } setFootballOpen(true); document.getElementById("football-signals")?.scrollIntoView({ behavior: "smooth" }); }} className={`glass rounded-2xl border p-4 text-left hover:-translate-y-1 transition ${hasSignalAccess ? "border-[#35d07f]/35 hover:border-[#35d07f]" : "border-[#c084fc]/25 hover:border-[#c084fc]"}`}><div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3 text-xl" style={{ background: hasSignalAccess ? "#35d07f25" : "#c084fc25" }}>⚽</div><p className="display text-xs font-bold">Football & Betting</p><p className="body-f text-[10px] text-[#9eb9e8] mt-1">{hasSignalAccess ? "Open folder →" : "Signal+ only · locked"}</p>{!hasSignalAccess && <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-[#c084fc]" />}</button>
          {!hasSignalAccess && SIGNAL_LOCKED_FOLDERS.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => { setSignalNotice(true); window.setTimeout(() => setSignalNotice(false), 4200); }} className="group relative glass rounded-2xl border border-[#c084fc]/25 p-4 text-left hover:-translate-y-1 hover:border-[#c084fc] transition"><div className="absolute right-3 top-3 rounded-full bg-[#0b1028]/80 p-1.5 text-[#c084fc]"><Lock className="h-3.5 w-3.5" /></div><div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: `${item.color}25` }}><Icon className="h-5 w-5" style={{ color: item.color }} /></div><p className="display text-xs font-bold">{item.key}</p><p className="body-f text-[10px] text-[#9eb9e8] mt-1">Signal plan · locked</p></button>; })}
          {hasSignalAccess && SIGNAL_LOCKED_FOLDERS.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => { setSelectedCategory(item.category); document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); }} className="group relative glass rounded-2xl border border-[#35d07f]/25 p-4 text-left hover:-translate-y-1 hover:border-[#35d07f] transition"><div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: `${item.color}25` }}><Icon className="h-5 w-5" style={{ color: item.color }} /></div><p className="display text-xs font-bold">{item.key}</p><p className="body-f text-[10px] text-[#9eb9e8] mt-1">Open folder →</p></button>; })}
        </div>
      </section>
      {/* FOOTBALL SIGNALS */}
      <section id="football-signals" className={`max-w-6xl mx-auto px-6 pb-16 ${footballOpen && hasSignalAccess ? "" : "hidden"}`}>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div><p className="mono text-[10px] uppercase tracking-[.22em] text-[#8ea7ff]">Signal+ intelligence</p><h2 className="display text-2xl md:text-3xl font-extrabold mt-1">Football Signals <span className="text-[#35d07f]">· live</span></h2><p className="body-f text-sm theme-muted mt-2">Real fixtures first. AI analysis comes after the numbers. Informational only — not betting advice.</p></div>
          <span className="mono text-[10px] text-[#35d07f] border border-[#35d07f]/30 rounded-full px-3 py-1">LIVE DATA</span>
        </div>
        <div className="relative mb-5 max-w-3xl mx-auto"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#58b8ff]" /><input value={footballQuery} onChange={(e) => setFootballQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchFootball(); }} placeholder="Search any team or competition worldwide…" className="w-full rounded-2xl border-2 border-[#58b8ff]/50 bg-[#142650]/90 py-4 pl-12 pr-4 text-sm body-f text-white outline-none focus:border-[#35d07f] shadow-[0_0_30px_rgba(50,130,255,.16)]" /></div>{footballLoading ? <div className="glass rounded-2xl p-8 text-center body-f theme-muted">Loading today’s fixtures…</div> : filteredFootballMatches.length === 0 ? <div className="glass rounded-2xl p-8 text-center body-f theme-muted">No fixtures available right now.</div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredFootballMatches.map((match) => { const home = match.teams?.home; const away = match.teams?.away; const date = match.fixture?.date ? new Date(match.fixture.date).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "Upcoming"; return <div key={match.fixture?.id} className="glass rounded-2xl p-4 hover:border-[#58b8ff]/60 transition cursor-pointer" onClick={() => openMatch(match)}><div className="flex items-center justify-between mb-4"><span className="mono text-[9px] uppercase tracking-widest text-[#8ea7ff]">{match.league?.name || "Football"}</span><span className="mono text-[9px] text-[#35d07f]">{date}</span></div><div className="flex items-center justify-between gap-3"><div className="flex-1 text-center"><img src={home?.logo} alt="" className="w-10 h-10 object-contain mx-auto mb-2" /><p className="display text-xs font-bold leading-tight">{home?.name || "Home"}</p></div><div className="mono text-xs text-[#a99fd4]">VS</div><div className="flex-1 text-center"><img src={away?.logo} alt="" className="w-10 h-10 object-contain mx-auto mb-2" /><p className="display text-xs font-bold leading-tight">{away?.name || "Away"}</p></div></div><div className="mt-4 rounded-xl bg-[#142650]/60 border border-[#6f8dff]/20 px-3 py-2 text-center"><span className="mono text-[9px] text-[#b9d5ff]">OPEN FULL AI MATCH ANALYSIS →</span></div></div>; })}</div>}
      </section>

      {/* FEED */}
      <section id="feed" className={`screener-feed max-w-6xl mx-auto px-6 pb-20 ${profileSettings.compactCards ? "profile-compact" : ""}`}>
        <div className="flex flex-col items-center mb-7 gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="display text-2xl md:text-3xl font-extrabold tracking-tight">Live feed <span className="text-[#8b6bff]">—</span> {activePersona.label}</h2>
            {!checkingLive && (
              liveTrends ? (
                <span className="flex items-center gap-1.5 mono text-[10px] text-[#c9bfff] bg-[#160f2e] border border-[#7c5cff]/40 rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7c5cff] animate-pulse" /> LIVE · {DATA_REGION} · Google {sourceStatus.google} · GDELT {sourceStatus.gdelt}
                </span>
              ) : (
                <span className="mono text-[10px] text-[#655a92] bg-[#0f0d1f] border border-[#1c1633] rounded-full px-2.5 py-1">
                  LIVE PREVIEW
                </span>
              )
            )}
          </div>
          <div className="flex items-center justify-center gap-3 w-full">
            <div className="relative flex-1 md:w-[420px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8ea7ff]" />
              <input list="trend-search-suggestions" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search signals, topics or platforms…" aria-label="Search signals, topics or platforms" className="command-input w-full rounded-2xl border border-[#6f8dff]/45 bg-[#101a38]/95 py-4 pl-12 pr-16 text-sm text-white shadow-[0_14px_40px_rgba(4,10,35,.22)] outline-none transition focus:border-[#58b8ff] focus:bg-[#142650] focus:shadow-[0_0_32px_rgba(75,180,255,.25)]" />
              <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-[#6f8dff]/30 bg-[#0b1028] px-2 py-1 font-mono text-[10px] text-[#9eb9e8] sm:block">/</kbd>
              <datalist id="trend-search-suggestions">{SEARCH_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
              {searchQuery && <div className="absolute z-30 left-0 right-0 top-full mt-2 rounded-xl border border-[#6f8dff]/40 bg-[#101a38] p-2 shadow-2xl">{SEARCH_SUGGESTIONS.filter((suggestion) => suggestion.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6).map((suggestion) => <button key={suggestion} onClick={() => setSearchQuery(suggestion)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[#d5e4ff] hover:bg-[#284b91]">{suggestion}</button>)}</div>}
            </div>
            <div className="relative shrink-0">
              <button onClick={() => setShowFilters((value) => !value)} aria-label="Open trend filters" className={`inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-4 text-sm font-bold transition ${showFilters ? "border-[#35d07f] bg-[#123c32] text-[#8ff0b7]" : "border-[#6f8dff]/55 bg-[#15234a]/90 text-[#d5e4ff] hover:border-[#35d07f]"}`}><SlidersHorizontal className="h-5 w-5" /> <span className="hidden sm:inline">Filters</span></button>
              {showFilters && <div className="absolute right-0 top-full z-40 mt-3 w-[min(92vw,330px)] rounded-2xl border border-[#35d07f]/45 bg-[#101a38]/98 p-4 text-left shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between"><p className="display text-sm font-bold text-white">Trend controls</p><span className="mono text-[9px] text-[#35d07f]">SMART SORT</span></div>
                <label className="mono text-[10px] uppercase tracking-widest text-[#9eb9e8]">Sort by<select value={trendSort} onChange={(event) => setTrendSort(event.target.value)} className="mt-1 w-full rounded-xl border border-[#6f8dff]/35 bg-[#15234a] px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none"><option value="signal">Top signal strength</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="score">Highest score</option><option value="velocity">Fastest rising</option></select></label>
                <label className="mono mt-3 block text-[10px] uppercase tracking-widest text-[#9eb9e8]">Time window<select value={trendWindow} onChange={(event) => setTrendWindow(event.target.value)} className="mt-1 w-full rounded-xl border border-[#6f8dff]/35 bg-[#15234a] px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none"><option value="all">All available signals</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option></select></label>
                <p className="body-f mt-3 text-[10px] leading-relaxed text-[#8ea7ff]">Find the strongest opportunities faster: freshness, momentum and signal score are recalculated instantly.</p>
              </div>}
            </div>
            <button onClick={() => setShowWatchlistOnly((value) => !value)} className={`inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-4 text-sm font-bold transition ${showWatchlistOnly ? "border-[#f5b83d] bg-[#3b2a12] text-[#ffd77b]" : "border-[#6f8dff]/55 bg-[#15234a]/90 text-[#d5e4ff] hover:border-[#f5b83d]"}`} aria-pressed={showWatchlistOnly}>
              <Star className="h-5 w-5" /> <span className="hidden sm:inline">My Watchlist</span>
            </button>
          </div>
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
        ) : !selectedPlan && !trialActive && !hasActiveSub ? (
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
          <>
          {selectedCategory && <div className="mb-7 flex justify-center"><button onClick={() => { setSelectedCategory(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl border border-[#6f8dff]/40 px-4 py-3 text-xs font-semibold text-[#b9d5ff] hover:bg-[#1b3770]">← Back to signal folders</button></div>}
          {!selectedCategory ? <div className="rounded-3xl border border-[#6f8dff]/25 bg-gradient-to-br from-[#122452] to-[#101a38] p-10 text-center"><p className="mono text-[10px] uppercase tracking-[.2em] text-[#8ea7ff]">Choose your radar folder</p><h3 className="display mt-2 text-2xl font-extrabold">Pick a signal category to explore</h3><p className="body-f mt-2 text-sm text-[#b9ccef]">Open one folder to see the trends, examples and AI action plan inside.</p></div> : <div className="grid grid-cols-1 gap-4 items-start w-full">
            {categoriesToRender.map((category) => {
              const categoryInfo = CATEGORY_VISUALS.find((item) => item.key === category) || SIGNAL_LOCKED_FOLDERS.find((item) => item.category === category);
              const CategoryIcon = categoryInfo?.icon ?? Layers;
              const categoryTrends = visibleTrends.filter((t) => t.category === category);
              const isExpanded = expandedColumns[category];
              const shownTrends = isExpanded ? categoryTrends : categoryTrends.slice(0, 4);
              return <div key={category} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${categoryInfo?.color}22`}}><CategoryIcon className="w-4 h-4" style={{color:categoryInfo?.color}} /></div><div><p className="display text-xs font-bold">{category === "Sound" ? "TikTok Sounds" : category + "s"}</p><p className="mono text-[9px] theme-muted">{categoryTrends.length} signals</p></div></div>
                  <span className="mono text-[9px] text-[#7c5cff]">TOP VIRAL</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                      <div className="flex items-center gap-2"><span className="text-lg">{t.emoji || CATEGORY_EMOJI[t.category] || "📡"}</span><p className="mono text-[10px] text-[#7c729f] uppercase tracking-wide">{t.category}</p><span className="inline-flex items-center gap-1 rounded-full border border-[#7c5cff]/25 bg-[#7c5cff]/10 px-2 py-0.5 mono text-[9px] text-[#bcaeff]"><span className="text-sm leading-none">{platformMark(t.platform)}</span>{t.platform}</span></div>
                      <p className="display font-semibold text-[13px] mt-1 leading-snug">{t.name}</p>
                    </div>
                    <button onClick={(event) => { event.stopPropagation(); toggleWatch(t.id); }} className="shrink-0" aria-label={watched ? `Remove ${t.name} from watchlist` : `Add ${t.name} to watchlist`} aria-pressed={watched}>
                      <Star className={`w-4 h-4 ${watched ? "fill-[#f5b83d] text-[#f5b83d]" : "text-[#4a4270]"}`} />
                    </button>
                  </div>
                  {profileSettings.showMetrics && <Sparkline data={t.spark} />}
                  {profileSettings.showExplanations && <>
                    <p className="body-f text-[10px] leading-relaxed text-[#7c729f] mt-1.5"><span className="font-semibold text-[#a99fd4]">Why it matters: </span>{t.description || TREND_COPY[t.category] || "A live signal detected by Trend Radar."}</p>
                    <p className="body-f text-[10px] leading-relaxed text-[#a98bff] mt-1"><span className="font-semibold">Do this: </span>{TREND_ACTION[t.category] || "Move early while the signal is gaining momentum."}</p>
                  </>}
                  <div className="mt-3 rounded-xl border border-[#7c5cff]/15 bg-[#0f0b20]/55 px-3 py-2"><div className="flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-widest text-[#8ea7ff]">Decision</span><span className={`mono text-[9px] font-bold ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{trendVerdict(t.score).label}</span></div><p className="body-f text-[10px] leading-relaxed text-[#b3a9d9] mt-1">{trendVerdict(t.score).text}</p></div>
                  {profileSettings.showMetrics && <div className="flex items-center justify-between mt-1">
                    <span className={`flex items-center gap-1 mono text-[10px] font-bold ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>
                      <TrendingUp className="w-3 h-3" /> +{t.velocity}%
                    </span>
                    <span className={`mono text-[9px] font-bold ${t.score >= 60 ? "text-[#35d07f]" : t.score >= 30 ? "text-[#f5b83d]" : "text-[#ff6b6b]"}`}>{t.score >= 60 ? "HOT" : t.score >= 30 ? "WARMING" : "COOLING"} · {t.score}</span>
                  </div>}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {profileSettings.showMetrics && <p className="mono text-[9px] text-[#4a4270]">first seen {t.firstSeen ?? "recently"}h ago</p>}
                    <button onClick={(event) => { event.stopPropagation(); createTrendAlert(t); }} className="inline-flex items-center gap-1 rounded-lg border border-[#8b6bff]/35 px-2 py-1.5 mono text-[9px] font-bold text-[#c9bfff] hover:border-[#8b6bff] hover:bg-[#8b6bff]/10" aria-label={`Create alert for ${t.name}`}>
                      <Bell className="h-3 w-3" /> Alert
                    </button>
                  </div>
                </div>
              );
                })}
                </div>
                {categoryTrends.length > 4 && <button onClick={() => setExpandedColumns((prev) => ({...prev, [category]: !isExpanded}))} className="w-full mt-3 py-2 rounded-lg border border-[#7c5cff]/25 text-[#a98bff] mono text-[10px] font-bold hover:bg-[#7c5cff]/10 transition">{isExpanded ? "Show less" : `See more (${categoryTrends.length - 4})`}</button>}
              </div>;
            })}
          </div>}
          </>
        )}
      </section>

      {signalNotice && <div className="fixed bottom-6 left-1/2 z-[80] w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-[#c084fc]/50 bg-[#11142f]/95 p-4 shadow-[0_0_35px_rgba(192,132,252,.25)] backdrop-blur-xl animate-[shake_.45s_ease-in-out]"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#c084fc]/15 p-2 text-[#c084fc]"><Lock className="h-5 w-5" /></div><div><p className="display text-sm font-bold">Signal folder locked</p><p className="body-f text-xs text-[#b9ccef] mt-1">Unlock the Signal+ plan to access Meme Coins, Crypto Makers, Crypto Markets, Narratives and Global Markets. Football requires Pro or Signal+.</p><button onClick={() => { setSignalNotice(false); document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-3 rounded-lg bg-gradient-to-r from-[#8b6bff] to-[#6941e8] px-3 py-2 text-[11px] font-bold text-white">View Signal plan →</button></div><button onClick={() => setSignalNotice(false)} className="ml-auto text-[#9eb9e8]">×</button></div></div>}

      {profileSettings.showSourceLinks && selectedTrend?.sourceUrl && <a href={selectedTrend.sourceUrl} target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-3 rounded-2xl border-2 border-[#35d07f] bg-gradient-to-r from-[#159957] to-[#35d07f] px-6 py-4 text-sm font-extrabold text-white shadow-[0_0_30px_rgba(53,208,127,.55)] animate-[sourcePulse_1.8s_ease-in-out_infinite] hover:scale-105 hover:from-[#35d07f] hover:to-[#159957] transition">🔗 Open original source <span className="text-lg">↗</span></a>}

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24">
        <p className="mono text-[11px] tracking-widest text-[#7c5cff] mb-3">PLANS</p>
        <h2 className="display text-2xl md:text-3xl font-bold mb-2">Unlock every signal.</h2>
        <p className="body-f text-[#a99fd4] mb-10 text-sm">
          Beta access is currently invitation-only. Billing will open after the public launch.
        </p>
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
          {[
            { id: "pro", name: "Pro", price: "$29", period: "/mo", features: ["All trends, live", "Push alerts on new signals", "Watchlist & history", "Every category unlocked"], highlight: true },
            { id: "investor", name: "Signal+", price: "$99", period: "/mo", features: ["Everything in Pro", "Football & Betting intelligence", "On-chain meme-coin scanner", "Priority on new signal types"] },
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
                {BILLING_ENABLED ? (isLoggedIn ? "Choose plan" : "Start 3-day trial") : "Join the beta"}
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
          <a href="/methodology.html" className="hover:text-[#c9bfff] transition">Methodology</a>
          <a href="/contact.html" className="hover:text-[#c9bfff] transition">Contact</a>
        </div>
        <p className="mono text-[10px] text-[#4a4270] mt-4">© {new Date().getFullYear()} Trend Radar. All rights reserved.</p>
        <Analytics />
        {GA_MEASUREMENT_ID && <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} onLoad={() => { window.dataLayer = window.dataLayer || []; window.gtag = (...args) => window.dataLayer.push(args); window.gtag("js", new Date()); window.gtag("config", GA_MEASUREMENT_ID); }} />}
      </footer>
    </div>
  );
}
