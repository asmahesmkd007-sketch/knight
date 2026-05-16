import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  champions,
  openings,
  tactics,
  ratingTiers,
  variants,
  benefits,
  glossary,
  faq,
} from "@/data/chess";

export const Route = createFileRoute("/")({
  component: ChessEncyclopedia,
  head: () => ({
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Chess: The Complete Encyclopedia",
          description:
            "The most comprehensive guide to chess on the internet. Rules, history, World Champions, openings, strategy and more.",
          author: { "@type": "Organization", name: "Chess Encyclopedia" },
          datePublished: "2025-01-01",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

const TOC = [
  ["what-is-chess", "What Is Chess?"],
  ["why-matters", "Why Chess Matters"],
  ["board", "The Chessboard"],
  ["pieces", "Chess Pieces"],
  ["setup", "How to Set Up the Board"],
  ["movement", "How Pieces Move"],
  ["check-mate", "Check & Checkmate"],
  ["special", "Special Rules"],
  ["game-end", "How a Game Ends"],
  ["time", "Time Controls"],
  ["notation", "Chess Notation"],
  ["openings", "Chess Openings"],
  ["strategy", "Strategy & Tactics"],
  ["ratings", "Ratings & Elo"],
  ["titles", "FIDE Titles"],
  ["competitions", "Competitions"],
  ["history", "History of Chess"],
  ["champions", "World Champions"],
  ["variants", "Chess Variants"],
  ["ai", "Chess & AI"],
  ["start", "How to Start Playing"],
  ["quiz", "Test Your Knowledge"],
  ["glossary", "Glossary"],
  ["faq", "FAQ"],
] as const;

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return p;
}

function useActiveSection() {
  const [active, setActive] = useState<string>(TOC[0][0]);
  useEffect(() => {
    const els = TOC.map(([id]) => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el
    );
    // Use scroll position fallback for short sections that don't trigger IntersectionObserver
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: [0, 0.1, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return active;
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-[color:var(--gold)]/10 py-16 last:border-b-0 md:py-24">
      <div className="mb-10">
        {eyebrow && (
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-[color:var(--gold)]">
            § {eyebrow}
          </div>
        )}
        <h2 className="font-display text-3xl font-bold leading-tight text-foreground md:text-5xl">
          {title}
        </h2>
        <div className="gold-divider mt-6 max-w-md" />
      </div>
      <div className="space-y-6 text-[17px] leading-[1.85] text-foreground/85 [&_.dropcap::first-letter]:font-display [&_.dropcap::first-letter]:text-[4.5rem] [&_.dropcap::first-letter]:leading-[0.9] [&_.dropcap::first-letter]:float-left [&_.dropcap::first-letter]:pr-3 [&_.dropcap::first-letter]:pt-1.5 [&_.dropcap::first-letter]:text-[color:var(--gold)] [&_.dropcap::first-letter]:font-bold">
        {children}
      </div>
    </section>
  );
}

function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote
      role="note"
      className="my-10 border-l-2 border-[color:var(--gold)] bg-[color:var(--card-deep)] p-6 font-display text-xl italic leading-snug text-[color:var(--gold-light)] md:p-8 md:text-2xl lg:text-3xl"
    >
      {children}
    </blockquote>
  );
}

function StatPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--card)]/60 px-4 py-2 font-mono text-xs tracking-wider text-[color:var(--gold-light)] backdrop-blur">
      {label}
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-6 transition-all hover:border-[color:var(--gold)]/40 hover:shadow-[0_0_40px_-12px_rgba(212,168,67,0.3)] ${className}`}
    >
      {children}
    </div>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-[color:var(--gold)]/15">
      <div className="chess-hero-bg absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color:var(--background)]/60 to-[color:var(--background)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 md:py-28 lg:py-36">
        <Badge className="mb-6 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--card-deep)] px-4 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold-light)] hover:bg-[color:var(--card-deep)]">
          Free Complete Guide — No Sign Up Needed
        </Badge>
        <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-7xl lg:text-8xl">
          Chess: The
          <br />
          <span className="bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--gold-light)] bg-clip-text text-transparent">
            Complete Encyclopedia
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-foreground/75 sm:mt-8 md:text-xl">
          Chess is a two-player strategy board game played on a 64-square board, where each player commands 16 pieces with the goal of trapping the opponent's king. It is one of the oldest, most studied, and most popular games in human history — with over 800 million active players worldwide. Whether you are a total beginner or an experienced player, this guide covers everything you need to know about chess.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <StatPill label="800M+ Players" />
          <StatPill label="1,500+ Years of History" />
          <StatPill label="10¹²⁰ Possible Games" />
          <StatPill label="195 Countries Play" />
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-[color:var(--gold)] px-8 text-[color:var(--background)] hover:bg-[color:var(--gold-light)]"
          >
            <a href="#what-is-chess">📖 Start Reading ↓</a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-[color:var(--gold)]/40 bg-transparent px-8 text-foreground hover:bg-[color:var(--card)] hover:text-foreground"
          >
            <a href="https://www.chess.com/play" target="_blank" rel="noopener noreferrer">
              ▶ Play Chess Now
            </a>
          </Button>
        </div>
        <div className="gold-pulse mt-16 select-none text-center text-5xl tracking-[0.4em] text-[color:var(--gold)] md:text-6xl">
          ♔ ♕ ♖ ♗ ♘ ♙
        </div>
      </div>
    </header>
  );
}

function TopMetaBar() {
  return (
    <div className="border-t-[3px] border-[color:var(--gold)] border-b border-[color:var(--gold)]/15 bg-[color:var(--card-deep)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 text-xs">
        <span className="font-display text-sm tracking-wide text-[color:var(--gold-light)]">
          ♟ The Complete Chess Encyclopedia
        </span>
        <span className="hidden items-center gap-4 font-mono text-[color:var(--muted-foreground)] md:flex">
          <span>~25 min read</span>
          <span className="text-[color:var(--gold)]/40">•</span>
          <span>Last updated 2025</span>
        </span>
      </div>
    </div>
  );
}

function ProgressBar() {
  const p = useScrollProgress();
  return (
    <div
      aria-hidden="true"
      className="progress-bar-track fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--gold-light)] transition-transform duration-100 ease-linear"
      style={{ transform: `scaleX(${p / 100})` }}
    />
  );
}

function TableOfContents() {
  const active = useActiveSection();
  return (
    <nav aria-label="Table of contents" className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-4">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">
          On This Page
        </div>
        <ul className="space-y-1 border-l border-[color:var(--gold)]/15">
          {TOC.map(([id, label], i) => {
            const isActive = active === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`block border-l-2 py-1.5 pl-4 text-sm transition-all ${
                    isActive
                      ? "-ml-px border-[color:var(--gold)] font-medium text-[color:var(--gold-light)]"
                      : "-ml-px border-transparent text-[color:var(--muted-foreground)] hover:text-foreground"
                  }`}
                >
                  <span className="mr-2 font-mono text-[10px] opacity-60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function MobileTOC() {
  const [open, setOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open table of contents"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[color:var(--gold)] px-5 py-3 font-mono text-xs font-semibold text-[color:var(--background)] shadow-2xl shadow-[color:var(--gold)]/40 transition-transform hover:scale-105 active:scale-95"
      >
        📋 Contents
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="mobile-toc-sheet absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-[color:var(--gold)]/30 bg-[color:var(--card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-xl text-[color:var(--gold-light)]">
                On This Page
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close table of contents"
                className="flex h-8 w-8 items-center justify-center rounded-full text-2xl text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--card-deep)] hover:text-foreground"
              >
                ×
              </button>
            </div>
            <ul className="space-y-1">
              {TOC.map(([id, label], i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={() => setOpen(false)}
                    className="toc-link block border-b border-[color:var(--gold)]/10 py-3 text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    <span className="mr-3 font-mono text-[10px] text-[color:var(--gold)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Chessboard() {
  const [hover, setHover] = useState<string | null>(null);
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return (
    <div className="my-10">
      <div className="mx-auto max-w-md">
        <div className="chess-grid grid grid-cols-8 overflow-hidden rounded-md border border-[color:var(--gold)]/30 shadow-2xl">
          {Array.from({ length: 8 }).map((_, r) =>
            Array.from({ length: 8 }).map((_, c) => {
              const light = (r + c) % 2 === 0;
              const sq = `${files[c]}${8 - r}`;
              const isHovered = hover === sq;
              return (
                <div
                  key={sq}
                  role="gridcell"
                  aria-label={sq}
                  onMouseEnter={() => setHover(sq)}
                  onMouseLeave={() => setHover(null)}
                  onTouchStart={(e) => { e.preventDefault(); setHover(sq); }}
                  onTouchEnd={() => setTimeout(() => setHover(null), 800)}
                  className={`relative aspect-square flex items-center justify-center text-[10px] font-mono cursor-crosshair select-none transition-colors ${
                    light ? "bg-[#e8d4a0]" : "bg-[#7a4a2c]"
                  } ${isHovered ? "outline outline-2 outline-[color:var(--teal)]" : ""}`}
                >
                  {isHovered && (
                    <span className={`font-bold ${light ? "text-[#7a4a2c]" : "text-[#e8d4a0]"}`}>
                      {sq}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 grid grid-cols-8 gap-0 px-0 text-center font-mono text-xs text-[color:var(--gold)]">
          {files.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <p className="mt-2 text-center font-mono text-xs text-[color:var(--muted-foreground)]">
          {hover ? `Square: ${hover}` : "Hover any square to see its coordinate"}
        </p>
      </div>
    </div>
  );
}

const pieceData = [
  {
    glyph: "♙",
    name: "The Pawn",
    badge: "Most Numerous Piece • Value: 1 Point",
    paras: [
      "The pawn is the most common piece on the board, with each player starting with eight of them arranged on the second rank. Though individually the least powerful piece, pawns form the foundation of every chess position. The arrangement of pawns — called the pawn structure — determines the fundamental character of the position and influences every strategic decision.",
      "Pawns move forward only — they can never move backward. On its first move, a pawn may advance either one or two squares forward. On all subsequent moves, it can only move one square forward. Unlike every other piece in chess, the pawn does not capture in the same direction it moves: it captures diagonally, one square forward to either side.",
      "When a pawn reaches the opposite end of the board, it must immediately be promoted to any other piece except a king. Almost universally, players promote to a queen — the most powerful piece — though sometimes promoting to a knight or rook is strategically better (called underpromotion).",
      "The famous Tarrasch proverb states: 'Pawns are the soul of chess.' Their structure creates long-term advantages and weaknesses. Doubled pawns, isolated pawns, and passed pawns are key concepts every chess player must understand.",
    ],
  },
  {
    glyph: "♘",
    name: "The Knight",
    badge: "The Jumping Piece • Value: 3 Points",
    paras: [
      "The knight is the most unusual piece in chess and often the most confusing for beginners. Each player starts with two knights. In a standard chess set, the knight is represented as a horse, reflecting its medieval origins where mounted cavalry could leap over infantry lines.",
      "The knight moves in an 'L' shape: two squares in one direction (horizontally or vertically) and then one square perpendicular to that. From the center of the board, a knight reaches up to 8 squares. The knight is the ONLY chess piece that can jump over other pieces — friendly or enemy — making it especially dangerous in closed positions.",
      "Knights are worth approximately 3 pawns and are considered 'minor pieces' alongside bishops. Knights are generally stronger in closed positions with locked pawn structures, while bishops are typically stronger in open positions with long diagonals.",
      "'Knights on the rim are dim' — one of the most well-known principles in chess. A knight on the edge of the board has far fewer squares it can reach. Always try to keep knights active near the center.",
    ],
  },
  {
    glyph: "♗",
    name: "The Bishop",
    badge: "The Diagonal Mover • Value: 3 Points",
    paras: [
      "The bishop moves diagonally any number of squares, as long as no piece blocks its path. Because of this movement, a bishop that starts on a light square will always remain on light squares — and one starting on a dark square will always stay on dark squares. This is why each player has two bishops: one for each color complex.",
      "Bishops are worth 3 points, the same as knights, but most modern chess theory considers bishops to be very slightly more valuable — often called the 'bishop pair advantage.' When one player has both bishops and the other has a bishop and knight, the two-bishop player holds a long-term strategic edge.",
      "The strength of a bishop depends enormously on the pawn structure. A bishop blocked by its own pawns is called a 'bad bishop' — it has little mobility and influence. Recognizing good and bad bishops is one of the most important intermediate concepts.",
    ],
  },
  {
    glyph: "♖",
    name: "The Rook",
    badge: "The Tower of Power • Value: 5 Points",
    paras: [
      "The rook moves horizontally or vertically any number of squares, as long as its path is not blocked. It is one of the two major pieces in chess (along with the queen) and is worth 5 pawns. Rooks work best on open files where they can exert maximum pressure along the entire length of the board.",
      "The rook is the only piece (besides the king) involved in the special castling move. Castling allows the king to move to safety while simultaneously activating the rook — one reason it is important to develop rooks early.",
      "In the endgame, rooks become extremely powerful because the board opens up. The famous principle 'Rooks belong behind passed pawns' is one of the most important endgame concepts. Two rooks working together can execute devastating attacks called 'rook batteries.'",
    ],
  },
  {
    glyph: "♕",
    name: "The Queen",
    badge: "The Most Powerful Piece • Value: 9 Points",
    paras: [
      "The queen is by far the most powerful piece in chess. It can move any number of squares in ANY direction — horizontally, vertically, or diagonally. The queen combines the movement of a rook and a bishop, making it worth approximately 9 pawns — three times a minor piece and nearly twice a rook.",
      "The queen was not always this powerful. In the original Indian chaturanga and Persian shatranj, the equivalent piece (the 'vizier' or 'firz') could only move one square diagonally. The dramatic transformation to the modern queen happened in 15th-century Europe, likely in Spain or Portugal — one of the most significant rule changes in chess history.",
      "Because the queen is so valuable, players must use it carefully. Bringing the queen out too early exposes it to attacks by less valuable enemy pieces. A common beginner mistake is 'queen hunting' — moving the queen all over the board only to have it chased away. Masters use the queen to coordinate with other pieces and deliver the decisive blow.",
    ],
  },
  {
    glyph: "♔",
    name: "The King",
    badge: "The Most Important Piece • Value: Infinite",
    paras: [
      "The king is the most important piece in chess — not because it is powerful, but because it is the target. The entire game revolves around protecting your king while threatening the opponent's. The king moves one square in any direction. While this makes it seem weak, the king cannot be captured or traded.",
      "In the opening and middlegame, the king is highly vulnerable. Players castle their king to safety behind a wall of pawns, usually on the kingside. Leaving the king in the center is one of the most common causes of defeat for beginners.",
      "In the endgame, the character of the king transforms completely. With fewer pieces on the board, the king becomes an active fighting piece that must march toward the center to support its pawns. The 'king march' from one end of the board to the other is one of the most beautiful concepts in chess endgames.",
    ],
  },
];

function PieceValueBar() {
  const items = [
    { p: "♙", n: "Pawn", v: 1 },
    { p: "♘", n: "Knight", v: 3 },
    { p: "♗", n: "Bishop", v: 3 },
    { p: "♖", n: "Rook", v: 5 },
    { p: "♕", n: "Queen", v: 9 },
    { p: "♔", n: "King", v: "∞" },
  ];
  return (
    <div className="my-8 grid grid-cols-3 gap-3 md:grid-cols-6">
      {items.map((it) => (
        <div
          key={it.n}
          className="rounded-lg border border-[color:var(--gold)]/15 bg-[color:var(--card-deep)] p-4 text-center"
        >
          <div className="text-3xl text-[color:var(--gold)]">{it.p}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted-foreground)]">
            {it.n}
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-[color:var(--gold-light)]">
            {it.v}
          </div>
        </div>
      ))}
    </div>
  );
}

const setupSteps = [
  { t: "Orient the board", d: "Place the board so each player has a LIGHT square in the bottom-right corner. Easy to remember: 'Light on right.'" },
  { t: "Place the rooks", d: "White rooks on a1 and h1; Black rooks on a8 and h8. The rooks go in the four corners." },
  { t: "Place the knights", d: "White knights on b1 and g1; Black knights on b8 and g8. Each knight goes immediately next to a rook." },
  { t: "Place the bishops", d: "White bishops on c1 and f1; Black bishops on c8 and f8. The bishops go next to each knight." },
  { t: "Place the queens", d: "Queen on her own color. White queen on d1 (light square); Black queen on d8 (dark square). The most common beginner mistake." },
  { t: "Place the kings", d: "King on the remaining center square — White king on e1, Black king on e8. The kings face each other directly." },
  { t: "Place the pawns", d: "White's eight pawns fill the second rank (a2–h2). Black's eight pawns fill the seventh rank (a7–h7)." },
];

function StepGuide() {
  return (
    <ol className="my-8 space-y-4">
      {setupSteps.map((s, i) => (
        <li
          key={i}
          className="flex gap-5 rounded-lg border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--card-deep)] font-display text-xl font-bold text-[color:var(--gold)]">
            {i + 1}
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-foreground">{s.t}</div>
            <p className="mt-1 text-foreground/75">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const notationRows: [string, string][] = [
  ["K", "King"],
  ["Q", "Queen"],
  ["R", "Rook"],
  ["B", "Bishop"],
  ["N", "Knight"],
  ["x", "Capture"],
  ["+", "Check"],
  ["#", "Checkmate"],
  ["O-O", "Castle Kingside"],
  ["O-O-O", "Castle Queenside"],
  ["=", "Promotion (e.g., e8=Q)"],
  ["!", "Good move"],
  ["!!", "Brilliant move"],
  ["?", "Mistake"],
  ["??", "Blunder"],
  ["!?", "Interesting / risky"],
  ["?!", "Dubious"],
];

const quizData = [
  { q: "How many squares are on a chessboard?", opts: ["32", "48", "64", "81"], a: 2, ex: "8 rows × 8 columns = 64 squares, alternating light and dark." },
  { q: "Which piece can jump over other pieces?", opts: ["Bishop", "Rook", "Queen", "Knight"], a: 3, ex: "The knight is the only piece that can jump over pieces in its path." },
  { q: "What does 'checkmate' mean?", opts: ["The king is in check with no escape", "The king moves two squares", "Both queens are captured", "Time runs out"], a: 0, ex: "Checkmate = king is in check and cannot escape. The game ends immediately." },
  { q: "How does the queen move?", opts: ["Only diagonally", "Only straight", "In an L-shape", "Any direction, any distance"], a: 3, ex: "The queen combines rook + bishop movement." },
  { q: "What is stalemate?", opts: ["A draw when the player to move has no legal moves and is not in check", "When both kings meet", "When all pawns are gone", "A type of checkmate"], a: 0, ex: "Stalemate is always a draw, regardless of material." },
  { q: "What is the maximum number of squares a queen can reach from the center?", opts: ["14", "20", "27", "35"], a: 2, ex: "From a central square, the queen reaches up to 27 squares — more than any other piece." },
  { q: "Which country produced the first World Chess Champion?", opts: ["Russia", "Germany", "Austria (Steinitz)", "France"], a: 2, ex: "Wilhelm Steinitz, born in Prague (then Austrian Empire), became the first official champion in 1886." },
  { q: "Who is the current World Chess Champion (2024–25)?", opts: ["Magnus Carlsen", "Ding Liren", "Gukesh Dommaraju", "Viswanathan Anand"], a: 2, ex: "Gukesh defeated Ding Liren in December 2024 to become the youngest undisputed champion." },
  { q: "What is 'en passant'?", opts: ["A type of checkmate", "Castling with the queen's rook", "A special pawn capture", "Moving a knight backwards"], a: 2, ex: "En passant is a unique pawn capture against a pawn that just moved two squares." },
  { q: "What is the highest official title in chess?", opts: ["International Master", "FIDE Master", "Grandmaster", "National Master"], a: 2, ex: "Grandmaster (GM) is the highest regular FIDE title." },
];

function Quiz() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const handleReset = () => {
    setI(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  const handleNext = () => {
    if (i === quizData.length - 1) {
      setDone(true);
    } else {
      setI((prev) => prev + 1);
      setPicked(null);
    }
  };

  if (done) {
    const msg =
      score >= 9 ? "Outstanding — you're ready for tournament play! 🏆"
      : score >= 7 ? "Strong work — you understand chess well. ⭐"
      : score >= 5 ? "Solid effort — review the sections above and try again. 📚"
      : "A great start — chess takes time. Review the guide and try again! 🌱";
    return (
      <Card className="text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-[color:var(--gold)]">
          Quiz Complete
        </div>
        <div className="my-4 font-display text-6xl font-bold text-[color:var(--gold-light)]">
          {score}/10
        </div>
        <p className="text-foreground/80">{msg}</p>
        <Button
          onClick={handleReset}
          className="mt-6 rounded-full bg-[color:var(--gold)] text-[color:var(--background)] hover:bg-[color:var(--gold-light)]"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  const cur = quizData[i];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-[color:var(--gold)]">
          Question {i + 1} / {quizData.length}
        </span>
        <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
          Score: {score}
        </span>
      </div>
      <h3 className="mb-6 font-display text-xl font-semibold text-foreground md:text-2xl">
        {cur.q}
      </h3>
      <div className="space-y-2">
        {cur.opts.map((o, idx) => {
          const isCorrect = idx === cur.a;
          const isPicked = picked === idx;
          const reveal = picked !== null;
          return (
            <button
              key={idx}
              disabled={reveal}
              onClick={() => {
                if (picked !== null) return;
                setPicked(idx);
                if (idx === cur.a) setScore((s) => s + 1);
              }}
              className={`quiz-option w-full rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                reveal && isCorrect
                  ? "border-[color:var(--win)] bg-[color:var(--win)]/15 text-[color:var(--win)]"
                  : reveal && isPicked
                    ? "border-[color:var(--destructive)] bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]"
                    : "border-[color:var(--gold)]/15 bg-[color:var(--card-deep)] text-foreground/80 hover:border-[color:var(--gold)]/40 disabled:cursor-not-allowed"
              }`}
            >
              <span className="mr-3 font-mono text-xs opacity-60">
                {String.fromCharCode(65 + idx)}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-5 rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--card-deep)] p-4 text-sm text-foreground/80">
          <span className="font-semibold text-[color:var(--gold-light)]">Explanation:</span>{" "}
          {cur.ex}
          <Button
            onClick={handleNext}
            className="mt-4 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--background)] hover:bg-[color:var(--gold-light)]"
          >
            {i === quizData.length - 1 ? "See Results" : "Next Question →"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Glossary() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = useMemo(
    () => ["All", ...Array.from(new Set(glossary.map((g) => g.cat))).sort()],
    []
  );
  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return glossary.filter(
      (g) =>
        (cat === "All" || g.cat === cat) &&
        (ql === "" ||
          g.term.toLowerCase().includes(ql) ||
          g.def.toLowerCase().includes(ql))
    );
  }, [q, cat]);
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chess terms..."
          className="rounded-full border-[color:var(--gold)]/30 bg-[color:var(--card-deep)] px-5"
        />
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                cat === c
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-[color:var(--background)]"
                  : "border-[color:var(--gold)]/20 bg-transparent text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((g) => (
          <div
            key={g.term}
            className="rounded-lg border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="font-display text-lg font-semibold text-[color:var(--gold-light)]">
                {g.term}
              </h4>
              <span className="rounded-full border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[color:var(--teal)]">
                {g.cat}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/75">{g.def}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-[color:var(--muted-foreground)]">
            No terms found matching "{q}"
          </p>
        )}
      </div>
    </div>
  );
}

function ChessEncyclopedia() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProgressBar />
      <TopMetaBar />
      <Hero />
      <MobileTOC />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
          <TableOfContents />
          <main className="min-w-0">
            {/* 1. WHAT IS CHESS */}
            <Section id="what-is-chess" eyebrow="01" title="What Is Chess?">
              <p className="dropcap">
                Chess is a two-player, turn-based strategy board game played on a square board divided into 64 squares arranged in an 8×8 grid. Each player begins with 16 pieces: one king, one queen, two rooks, two bishops, two knights, and eight pawns. The objective of chess is to place the opponent's king in checkmate — a position where the king is under attack and has no legal move to escape. Chess contains no element of luck or hidden information; the outcome depends entirely on the decisions of both players.
              </p>
              <p>
                Chess is one of the most played games in human history. According to FIDE — the International Chess Federation — over 800 million people play chess worldwide. It is recognized as a sport in more than 100 countries and is practiced competitively at all levels, from school clubs to the Olympic Chess Olympiad. Online platforms have brought the game to hundreds of millions of digital players, making it one of the fastest-growing online sports of the 21st century.
              </p>
              <p>
                What makes chess special among all board games is the sheer depth of its strategy. The number of possible chess games is estimated at 10 to the power of 120 — a number larger than the atoms in the observable universe. This means no two chess games need ever be exactly alike. Masters spend decades studying the game and still encounter entirely new positions. Chess combines logic, pattern recognition, memory, creativity, and psychological pressure.
              </p>
              <p>
                Research has consistently shown that learning chess improves concentration, problem-solving ability, and mathematical thinking in children. Many countries have introduced chess as part of their school curriculum. Beyond education, chess creates a universal language — a game that needs no translation, played across cultures and connecting people of all ages on the same 64-square playing field.
              </p>
              <PullQuote>
                ♟ The number of possible chess games is greater than the number of atoms in the observable universe.
              </PullQuote>
            </Section>

            {/* 2. WHY CHESS MATTERS */}
            <Section id="why-matters" eyebrow="02" title="Why Chess Matters — Benefits and Importance">
              <p>
                Chess is far more than entertainment. It is a tool for cognitive development, a competitive sport, a form of art, and a historical artifact. Here are the most important reasons chess matters to millions of people around the world.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {benefits.map((b) => (
                  <Card key={b.title}>
                    <div className="text-3xl">{b.icon}</div>
                    <h3 className="mt-3 font-display text-lg font-semibold text-[color:var(--gold-light)]">
                      {b.title}
                    </h3>
                    <p className="mt-2 text-sm text-foreground/75">{b.desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 3. BOARD */}
            <Section id="board" eyebrow="03" title="The Chessboard — Understanding the Playing Field">
              <p>
                The chessboard is an 8×8 grid containing exactly 64 squares, alternating between light and dark colors. The columns on the board are called <em>files</em> and are labeled with letters from 'a' to 'h' from left to right (from White's perspective). The rows are called <em>ranks</em> and are numbered 1 through 8, with rank 1 nearest to White and rank 8 nearest to Black. Every square has a unique coordinate — for example, 'e4' refers to the square on the e-file and the 4th rank.
              </p>
              <p>
                The board must always be placed so that each player has a light square in the bottom-right corner. A common beginner mistake is to set the board rotated 90 degrees — that is always wrong. The center four squares — d4, d5, e4, and e5 — are the most strategically important area. Controlling these squares in the opening is a fundamental principle of chess strategy.
              </p>
              <p>
                The board is also divided conceptually into two sides: the <em>kingside</em> (files e through h) and the <em>queenside</em> (files a through d). Players often describe their plans in terms of which side of the board they are attacking or defending. Understanding the geography of the chessboard is the first essential step to understanding everything that happens on it.
              </p>
              <Chessboard />
            </Section>

            {/* 4. PIECES */}
            <Section id="pieces" eyebrow="04" title="Chess Pieces — All 6 Types Explained">
              <p>
                Each player begins with exactly 16 chess pieces: one king, one queen, two rooks, two bishops, two knights, and eight pawns. Each type of piece moves in a completely different way, has a different value, and plays a different strategic role throughout the game.
              </p>
              <PieceValueBar />
              <Accordion type="multiple" defaultValue={["p-0"]} className="space-y-3">
                {pieceData.map((p, i) => (
                  <AccordionItem
                    key={p.name}
                    value={`p-${i}`}
                    className="rounded-xl border border-[color:var(--gold)]/15 bg-[color:var(--card)] px-6 [&[data-state=open]]:border-[color:var(--gold)]/40"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 text-left">
                        <span className="text-4xl text-[color:var(--gold)]">{p.glyph}</span>
                        <div>
                          <div className="font-display text-xl font-semibold text-foreground">
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted-foreground)]">
                            {p.badge}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-6 text-foreground/80">
                      {p.paras.map((t, idx) => (
                        <p key={idx}>{t}</p>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>

            {/* 5. SETUP */}
            <Section id="setup" eyebrow="05" title="How to Set Up a Chess Board — Step by Step">
              <p>
                Setting up a chess board correctly is the very first skill every beginner must learn. Follow these steps exactly.
              </p>
              <StepGuide />
              <div className="rounded-lg border-l-2 border-[color:var(--gold)] bg-[color:var(--card-deep)] p-5 text-sm">
                <span className="font-semibold text-[color:var(--gold-light)]">💡 Memory trick:</span>{" "}
                From left to right on White's first rank: Rook · Knight · Bishop · Queen · King · Bishop · Knight · Rook.
              </div>
            </Section>

            {/* 6. MOVEMENT */}
            <Section id="movement" eyebrow="06" title="How Chess Pieces Move">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Pawn", "Forward 1 square always. Forward 2 squares on first move only. Captures diagonally forward 1 square. Cannot move backward. Special: en passant capture."],
                  ["Knight", "Moves in an 'L': 2 squares in one direction + 1 square perpendicular. From the center, reaches up to 8 squares. The ONLY piece that jumps over others."],
                  ["Bishop", "Moves diagonally any number of squares. Always stays on the same color square it started on. From the center, reaches up to 13 squares."],
                  ["Rook", "Moves horizontally or vertically any number of squares. From any square it always reaches exactly 14 squares. Participates in castling."],
                  ["Queen", "Combines rook + bishop. Moves in any of 8 directions any number of squares. From the center, can reach up to 27 squares — more than any other piece."],
                  ["King", "Moves exactly 1 square in any direction. Can never move into check. Participates in castling. Cannot be captured — the game ends if it is checkmated."],
                ].map(([name, desc]) => (
                  <Card key={name}>
                    <div className="font-display text-lg font-semibold text-[color:var(--gold-light)]">
                      {name}
                    </div>
                    <p className="mt-2 text-sm text-foreground/75">{desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 7. CHECK & CHECKMATE */}
            <Section id="check-mate" eyebrow="07" title="Check, Checkmate, and Stalemate">
              <h3 className="font-display text-2xl font-semibold text-[color:var(--gold-light)]">Check</h3>
              <p>
                Check is the condition where a player's king is under direct attack by one or more enemy pieces. When your king is in check, you must immediately resolve the situation. There are exactly three ways to get out of check: move the king to a safe square, block the attack with one of your own pieces, or capture the attacking piece. If none of these is possible, it is checkmate.
              </p>
              <p>
                It is illegal to make a move that leaves your own king in check. A player can also be in check from two pieces simultaneously — a 'double check' — where the only legal response is to move the king.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Checkmate</h3>
              <p>
                Checkmate — often shortened to 'mate' — is the ultimate goal of chess. It occurs when a player's king is in check AND there is no legal move to escape. The word comes from the Persian phrase 'shah mat,' meaning 'the king is helpless.' When checkmate occurs, the game ends immediately.
              </p>
              <p>
                Famous checkmate patterns include Scholar's Mate (mate on move 4 targeting f7), Fool's Mate (the fastest possible mate in 2 moves), Smothered Mate (knight delivers mate while the king is surrounded by its own pieces), and the Arabian Mate (rook and knight in the corner).
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Stalemate</h3>
              <p>
                Stalemate occurs when the player whose turn it is has NO legal move AND their king is NOT in check. The result is always a draw — even if one player has an enormous material advantage. Stalemate has saved countless players who were losing badly. For the stronger side, avoiding stalemate is an important technical skill.
              </p>
            </Section>

            {/* 8. SPECIAL */}
            <Section id="special" eyebrow="08" title="The Three Special Rules in Chess">
              <p>
                Chess has three special rules that apply only in specific situations: castling, en passant, and pawn promotion. All three confuse beginners — but with the explanations below they make complete sense.
              </p>
              <h3 className="font-display text-2xl font-semibold text-[color:var(--gold-light)]">Castling</h3>
              <p>
                Castling is a special move involving the king and one rook — the only time in chess where two pieces move in the same turn. The king moves two squares toward a rook, and the rook then jumps over the king to the square on the other side. Castling kingside is called 'castling short'; castling queenside is 'castling long.'
              </p>
              <p>
                Castling is legal only when ALL of the following are true: (1) neither the king nor the rook involved has previously moved; (2) there are no pieces between them; (3) the king is not currently in check; (4) the king does not pass through or land on an attacked square. The rook is allowed to be under attack or pass through an attacked square — only the king's path matters.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">En Passant</h3>
              <p>
                En passant is French for 'in passing.' When a pawn moves two squares from its starting position and lands beside an enemy pawn, the enemy pawn may capture it as if it had only moved one square. The capturing pawn moves diagonally to the square the moving pawn skipped. This is only legal on the VERY NEXT MOVE — miss it, and the right is permanently lost. It is the only chess move where the captured piece does not occupy the destination square.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Pawn Promotion</h3>
              <p>
                When a pawn reaches the opposite end of the board — rank 8 for White, rank 1 for Black — it MUST immediately be replaced by another piece (king excluded). Almost universally, players promote to a queen ('queening'). Occasionally, underpromoting to a knight is correct — typically when queening would cause stalemate or when a knight delivers immediate checkmate.
              </p>
            </Section>

            {/* 9. GAME END */}
            <Section id="game-end" eyebrow="09" title="How Does a Chess Game End?">
              <p>A chess game can end in three ways: a win for White, a win for Black, or a draw.</p>
              <h3 className="font-display text-xl font-semibold text-[color:var(--win)]">Wins</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Checkmate", "The opponent's king is in check with no legal escape. The game ends immediately."],
                  ["Resignation", "A player gives up when the position is hopeless. Most professional games end in resignation."],
                  ["Time Forfeit", "In timed games, if your clock runs out you lose — unless the opponent lacks the material to mate, in which case it is a draw."],
                ].map(([t, d]) => (
                  <Card key={t}>
                    <div className="font-display text-lg font-semibold text-[color:var(--gold-light)]">{t}</div>
                    <p className="mt-2 text-sm text-foreground/75">{d}</p>
                  </Card>
                ))}
              </div>
              <h3 className="mt-8 font-display text-xl font-semibold text-[color:var(--draw)]">Draws</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Stalemate", "The player to move has no legal moves and is not in check. Immediate draw."],
                  ["Mutual Agreement", "Both players agree to a draw at any point — common in equal positions."],
                  ["Threefold Repetition", "If the same position occurs three times, either player may claim a draw."],
                  ["Fifty-Move Rule", "If 50 consecutive moves pass with no pawn move or capture, either player may claim a draw."],
                  ["Insufficient Material", "If neither player has enough pieces to deliver mate (e.g. K vs K), the game is drawn immediately."],
                ].map(([t, d]) => (
                  <Card key={t}>
                    <div className="font-display text-lg font-semibold text-[color:var(--gold-light)]">{t}</div>
                    <p className="mt-2 text-sm text-foreground/75">{d}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 10. TIME */}
            <Section id="time" eyebrow="10" title="Chess Time Controls — Bullet, Blitz, Rapid, Classical">
              <p>
                In competitive chess, every player has a limited amount of time to make all their moves. Different time limits create entirely different styles of chess — from calm, deep classical games lasting hours to frantic bullet games decided in under two minutes.
              </p>
              <div className="my-8 overflow-hidden rounded-xl border border-[color:var(--gold)]/15">
                <div className="h-2 bg-gradient-to-r from-[color:var(--draw)] via-[color:var(--gold)] to-[color:var(--destructive)]" />
                <div className="grid divide-y divide-[color:var(--gold)]/10 md:grid-cols-3 md:divide-x md:divide-y-0">
                  {[
                    ["Correspondence", "Days per move", "Online/postal play. Deep calculation."],
                    ["Classical", "60–120+ min each", "Used in World Championships."],
                    ["Rapid", "10–60 min each", "Most common tournament format."],
                    ["Blitz", "3–10 min each", "Most popular online format."],
                    ["Bullet", "1–2 min each", "Ultra-fast, reflex-based."],
                    ["Hyperbullet", "Under 60 seconds", "Chaos chess."],
                  ].map(([n, t, d]) => (
                    <div key={n} className="bg-[color:var(--card)] p-5">
                      <div className="font-display text-lg font-semibold text-[color:var(--gold-light)]">{n}</div>
                      <div className="font-mono text-xs text-[color:var(--gold)]">{t}</div>
                      <p className="mt-2 text-sm text-foreground/70">{d}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p>
                Most modern time controls include an <em>increment</em> — extra seconds added to your clock after every move. For example, '5+3' means each player starts with 5 minutes and gains 3 seconds per move. Increments prevent games from ending purely on time when both players are still making good moves.
              </p>
            </Section>

            {/* 11. NOTATION */}
            <Section id="notation" eyebrow="11" title="Chess Notation — How Moves Are Recorded">
              <p>
                Chess notation is the system used to record chess moves, allowing games to be written down, shared, studied, and replayed. The standard system used worldwide today is <em>algebraic notation</em>, adopted officially by FIDE in 1976.
              </p>
              <p>
                Each piece is represented by a capital letter: K = King, Q = Queen, R = Rook, B = Bishop, N = Knight (K is taken, so Knights use N). Pawns have no letter — a pawn move is simply the destination square (e.g. 'e4'). Captures use 'x' (e.g. 'Nxe5'). Check is '+' and checkmate is '#'.
              </p>
              <p className="font-mono text-sm">
                Example (Ruy Lopez opening):{" "}
                <span className="text-[color:var(--gold-light)]">
                  1.e4 e5 2.Nf3 Nc6 3.Bb5 a6
                </span>
              </p>
              <div className="overflow-hidden rounded-xl border border-[color:var(--gold)]/15">
                <table className="w-full font-mono text-sm">
                  <thead className="bg-[color:var(--card-deep)] text-[color:var(--gold)]">
                    <tr>
                      <th className="px-5 py-3 text-left">Symbol</th>
                      <th className="px-5 py-3 text-left">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--gold)]/10">
                    {notationRows.map(([s, m]) => (
                      <tr key={s} className="bg-[color:var(--card)]">
                        <td className="px-5 py-2.5 text-[color:var(--gold-light)]">{s}</td>
                        <td className="px-5 py-2.5 text-foreground/80">{m}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 12. OPENINGS */}
            <Section id="openings" eyebrow="12" title="Chess Openings — The First Moves of a Game">
              <p>
                The opening is the first phase of a chess game, typically lasting the first 10–20 moves. Despite the complexity of opening theory, all good openings follow the same basic principles.
              </p>
              <h3 className="font-display text-2xl font-semibold text-[color:var(--gold-light)]">Three Core Opening Principles</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Control the Center", "Pawns and pieces in or near the central squares (d4, d5, e4, e5) control more of the board."],
                  ["Develop Your Pieces", "Get your knights and bishops off their starting squares quickly. Undeveloped pieces are sleeping."],
                  ["Castle Your King", "After developing, castle to safety. A king stuck in the center is a constant target."],
                ].map(([t, d], i) => (
                  <Card key={t}>
                    <div className="font-mono text-xs text-[color:var(--gold)]">PRINCIPLE 0{i + 1}</div>
                    <h4 className="mt-2 font-display text-lg font-semibold text-foreground">{t}</h4>
                    <p className="mt-2 text-sm text-foreground/75">{d}</p>
                  </Card>
                ))}
              </div>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Most Popular Openings</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {openings.map((o) => (
                  <Card key={o.name}>
                    <h4 className="font-display text-lg font-semibold text-foreground">{o.name}</h4>
                    <div className="mt-1 font-mono text-xs text-[color:var(--gold)]">{o.moves}</div>
                    <p className="mt-3 text-sm text-foreground/75">{o.desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 13. STRATEGY */}
            <Section id="strategy" eyebrow="13" title="Chess Strategy — How Masters Think">
              <p>
                After the opening, chess enters the middlegame — the most complex and creative phase, where plans are formed and most decisive combinations occur.
              </p>
              <h3 className="font-display text-2xl font-semibold text-[color:var(--gold-light)]">Middlegame Strategy</h3>
              <p>
                The pawn structure determines what plans are available. Locked structures favor knights and slow positional maneuvering; open structures favor bishops and rooks. Identifying the correct plan from the structure is the master skill of middlegame chess.
              </p>
              <p>
                Piece activity and outposts are the building blocks of strong positions. An outpost is a square in enemy territory where your piece cannot be attacked by an enemy pawn — knights placed on outposts are devastating because they cannot be dislodged. Trading off the opponent's defenders of these squares is a common positional plan.
              </p>
              <p>
                King safety governs the middlegame. Once both kings have castled, attacks are organized around opening lines (files and diagonals) toward the enemy king. Pawn storms, piece sacrifices to open the king's position, and infiltrating squares near the king are the most common attacking themes.
              </p>
              <p>
                Material is not everything. The 'exchange sacrifice' — giving up a rook for a minor piece — is a classic positional sacrifice that wins long-term compensation in the form of pawn structure, square control, or attacking chances. Knowing when material matters and when it does not is one of the deepest skills in chess.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Endgame Principles</h3>
              <p>
                The endgame begins when most pieces have been exchanged and direct mating threats are reduced. The king transforms from hunted target to active fighting piece — getting the king into the center is often the single most important endgame move.
              </p>
              <p>
                Pawn endgames are governed by precise concepts: the opposition (kings facing each other with one square between them — the player NOT to move has the advantage), key squares (squares whose occupation guarantees promotion), and the 'rule of the square' (a quick way to check whether a king can catch a passed pawn).
              </p>
              <p>
                Rook endgames — the most common type at master level — center on two iconic positions: the Lucena (a winning technique for the side with the extra pawn, also called 'building a bridge') and the Philidor (the standard drawing technique for the defender). Mastering these two positions is essential for any serious chess player.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Tactics</h3>
              <p>
                Tactics are short sequences of moves that win material or deliver checkmate. Even the best strategic plans are meaningless if a player overlooks a one-move tactic.
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {tactics.map((t) => (
                  <Card key={t.name}>
                    <div className="text-3xl">{t.icon}</div>
                    <h4 className="mt-2 font-display text-lg font-semibold text-[color:var(--gold-light)]">
                      {t.name}
                    </h4>
                    <p className="mt-2 text-sm text-foreground/75">{t.desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 14. RATINGS */}
            <Section id="ratings" eyebrow="14" title="Chess Ratings — How Player Strength Is Measured">
              <p>
                Chess ratings are numerical representations of a player's relative skill. The higher the rating, the stronger the player. When two players compete, the outcome affects both ratings: the winner gains points and the loser loses points. The number of points exchanged depends on the difference in ratings.
              </p>
              <p>
                The most widely used system is the <em>Elo</em> rating, developed by Hungarian-American physicist Arpad Elo in the 1960s and adopted by FIDE in 1970. A player rated 200 points above their opponent is expected to win roughly 76% of games. Online platforms like Chess.com and Lichess use modified systems (Glicko-2) that account for rating reliability.
              </p>
              <div className="my-6 space-y-2">
                {ratingTiers.map((r) => (
                  <div
                    key={r.tier}
                    className="flex items-center gap-4 rounded-lg border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-4"
                  >
                    <div className="text-2xl">{r.icon}</div>
                    <div className="flex-1">
                      <div className="font-display text-base font-semibold text-foreground">{r.tier}</div>
                      <div className="text-sm text-foreground/65">{r.note}</div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-[color:var(--gold-light)]">
                      {r.range}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 15. TITLES */}
            <Section id="titles" eyebrow="15" title="FIDE Titles — From Candidate Master to Grandmaster">
              <p>
                FIDE awards official chess titles to players who achieve specific performance thresholds in international tournaments. These titles are permanent — once earned, a chess title is never taken away.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-[color:var(--gold)]/15">
                  <div className="bg-[color:var(--card-deep)] px-5 py-3 font-display font-semibold text-[color:var(--gold-light)]">
                    Open Titles
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-[color:var(--card-deep)]/60 font-mono text-xs uppercase text-[color:var(--gold)]">
                      <tr>
                        <th className="px-4 py-2 text-left">Title</th>
                        <th className="px-4 py-2 text-left">Abbr</th>
                        <th className="px-4 py-2 text-left">Min Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--gold)]/10 bg-[color:var(--card)]">
                      {[
                        ["Candidate Master", "CM", "2200"],
                        ["FIDE Master", "FM", "2300"],
                        ["International Master", "IM", "2400"],
                        ["Grandmaster", "GM", "2500"],
                      ].map((row) => (
                        <tr key={row[0]}>
                          {row.map((c, i) => (
                            <td key={i} className="px-4 py-2.5 text-foreground/80">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-hidden rounded-xl border border-[color:var(--gold)]/15">
                  <div className="bg-[color:var(--card-deep)] px-5 py-3 font-display font-semibold text-[color:var(--gold-light)]">
                    Women's Titles
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-[color:var(--card-deep)]/60 font-mono text-xs uppercase text-[color:var(--gold)]">
                      <tr>
                        <th className="px-4 py-2 text-left">Title</th>
                        <th className="px-4 py-2 text-left">Abbr</th>
                        <th className="px-4 py-2 text-left">Min Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--gold)]/10 bg-[color:var(--card)]">
                      {[
                        ["Woman Candidate Master", "WCM", "2000"],
                        ["Woman FIDE Master", "WFM", "2100"],
                        ["Woman International Master", "WIM", "2200"],
                        ["Woman Grandmaster", "WGM", "2300"],
                      ].map((row) => (
                        <tr key={row[0]}>
                          {row.map((c, i) => (
                            <td key={i} className="px-4 py-2.5 text-foreground/80">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p>
                The Grandmaster title is the highest awarded by FIDE. To earn it, a player must achieve a rating of at least 2500 AND score three 'GM norms' — performances at a specific level against other titled players. As of 2025, fewer than 2,000 Grandmasters exist worldwide out of hundreds of millions of chess players.
              </p>
            </Section>

            {/* 16. COMPETITIONS */}
            <Section id="competitions" eyebrow="16" title="Chess Competitions — How Tournaments Work">
              <p>
                Chess competitions range from local club tournaments to the World Chess Championship — the most prestigious event in chess, held every two years between the reigning champion and a challenger. The most prestigious team competition is the Chess Olympiad, held every two years, which regularly features teams from over 180 nations.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Round Robin", "Every player plays every other player. The most accurate format for determining the strongest player."],
                  ["Swiss System", "Players with similar scores are paired each round. Allows large tournaments (100+) to finish in few rounds."],
                  ["Knockout / Match", "Players compete head-to-head; loser is eliminated. Used in World Championship cycles."],
                  ["Arena", "Players can start new games immediately after finishing. Popular online."],
                ].map(([t, d]) => (
                  <Card key={t}>
                    <h4 className="font-display text-lg font-semibold text-[color:var(--gold-light)]">{t}</h4>
                    <p className="mt-2 text-sm text-foreground/75">{d}</p>
                  </Card>
                ))}
              </div>
              <ul className="ml-5 list-disc text-foreground/80 marker:text-[color:var(--gold)]">
                <li>World Chess Championship (classical, every 2 years)</li>
                <li>Candidates Tournament (selects the World Championship challenger)</li>
                <li>Chess Olympiad (team event, every 2 years)</li>
                <li>Grand Chess Tour (elite round-robin circuit)</li>
                <li>World Rapid and Blitz Championship</li>
                <li>National Championships (every country holds its own)</li>
              </ul>
            </Section>

            {/* 17. HISTORY */}
            <Section id="history" eyebrow="17" title="The Complete History of Chess — From Ancient India to Today">
              <h3 className="font-display text-2xl font-semibold text-[color:var(--gold-light)]">Origins: Chaturanga in Ancient India</h3>
              <p>
                The origins of chess can be traced back to ancient India, where a game called <em>chaturanga</em> was played during the Gupta Empire, roughly between the 4th and 6th centuries AD. The word 'chaturanga' is Sanskrit for 'four divisions of the military' — infantry, cavalry, elephants, and chariots — corresponding to the four piece types. Chaturanga was already remarkably similar to modern chess: different pieces had different powers, and the fate of the king determined the outcome.
              </p>
              <p>
                Chaturanga was played on an 8×8 grid called an <em>ashtāpada</em>. The pieces included a raja (king), mantri (counselor — ancestor of the queen, but far weaker), ratha (chariot — ancestor of the rook), gaja (elephant — bishop), ashva (horse — knight), and padāti (foot soldier — pawn). Chaturanga was considered a simulation of warfare, a training tool for commanders, and carried deep philosophical and religious symbolism.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Persian Evolution: Shatranj</h3>
              <p>
                Chaturanga spread westward to Persia around the 6th century AD and evolved into <em>shatranj</em>. The raja became the 'shah' (king — the source of the word 'chess'), and the mantri became the 'firz' (vizier). The phrase 'shah mat' — 'the king is helpless' — became the word 'checkmate.' Shatranj became enormously popular in the Islamic Golden Age, with masters like al-Suli and al-Lajlaj writing the first opening theory.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Chess Arrives in Europe</h3>
              <p>
                Chess entered Europe via the Moorish conquest of Spain, through Sicily and Italy, and possibly through Byzantine routes. By the 10th and 11th centuries it was widespread throughout medieval Europe. The pieces were reinterpreted to reflect feudal society: the vizier became a queen, the elephant a bishop, and the chariot a castle (rook). Chess was considered one of the seven skills required of a knight.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Revolutionary 15th-Century Rule Changes</h3>
              <p>
                The most dramatic transformation in chess history occurred around 1475 in Spain or Portugal. The queen — formerly the weakest piece — gained the ability to move any number of squares in any direction, instantly becoming the most powerful piece. Bishops gained their long-range diagonal movement, and pawns gained the two-square first move. The new game was sometimes called 'Mad Queen Chess' — and within decades it had replaced the old shatranj throughout Europe.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Romantic Era: 1600s–1800s</h3>
              <p>
                For two centuries chess was dominated by 'Romantic chess' — brilliant sacrifices and aggressive attacks pursued regardless of material cost. The most celebrated figure was Paul Morphy (1837–1884), an American prodigy from New Orleans often considered the greatest natural talent in chess history. Adolf Anderssen's 'Immortal Game' (1851) and 'Evergreen Game' (1852) — both featuring spectacular queen sacrifices — remain among the most famous games ever played.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Classical Era: Steinitz and Scientific Chess</h3>
              <p>
                Wilhelm Steinitz (1836–1900) revolutionized chess by replacing the Romantic attacking style with scientific positional principles. He argued that chess was about accumulating small advantages and only attacking when justified. Steinitz became the first official World Chess Champion in 1886 by defeating Johannes Zukertort in a match played across New York, St. Louis, and New Orleans.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Soviet Chess Empire (1948–1991)</h3>
              <p>
                After WWII, chess became a matter of national prestige for the Soviet Union. From 1948 to 1972, every World Chess Champion was a Soviet citizen. The dominant figure was Mikhail Botvinnik, whose students included future champions Anatoly Karpov and Garry Kasparov. Other Soviet champions included the wizard Mikhail Tal, the prophylactic genius Tigran Petrosian, and the universal Boris Spassky.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Bobby Fischer and the Match of the Century</h3>
              <p>
                The 1972 World Championship between American Bobby Fischer and Soviet champion Boris Spassky in Reykjavik, Iceland, was one of the most dramatic events in sports history. Played at the height of the Cold War, Fischer won 12.5–8.5, breaking the Soviet monopoly on the world title for the first time in 24 years. Fischer then refused to defend his title in 1975, forfeiting to Anatoly Karpov.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Karpov, Kasparov, and Deep Blue</h3>
              <p>
                Karpov dominated chess from 1975 to 1985 with quiet positional precision. In 1985, the young Garry Kasparov won the title at age 22 and held it for 15 years — one of the longest reigns ever. In 1997, IBM's Deep Blue defeated Kasparov 3.5–2.5 — the first computer to beat a reigning World Champion in a classical match, a landmark moment for AI.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">The Modern Era: Kramnik, Anand, Carlsen</h3>
              <p>
                Vladimir Kramnik ended Kasparov's reign in 2000 using the famous Berlin Defense. Viswanathan Anand of India became champion in 2007, inspiring an entire generation of Indian players. Magnus Carlsen of Norway held the title from 2013 to 2023 with the highest peak rating ever recorded (2882) before voluntarily declining to defend.
              </p>
              <h3 className="mt-8 font-display text-2xl font-semibold text-[color:var(--gold-light)]">Gukesh — The Youngest World Champion</h3>
              <p>
                In December 2024, 18-year-old Gukesh Dommaraju of India became the youngest undisputed World Chess Champion in history, defeating Ding Liren of China in Singapore. Gukesh grew up in Chennai, inspired by Anand. His victory represents the rise of a new generation of digital-native chess prodigies and the growing dominance of Asian — especially Indian — chess.
              </p>
            </Section>

            {/* 18. CHAMPIONS */}
            <Section id="champions" eyebrow="18" title="All World Chess Champions (1886–Present)">
              <p>
                The World Chess Championship has been contested since 1886. Here is every undisputed World Chess Champion in history, with country, years of reign, and a brief story of their style and significance.
              </p>
              <div className="space-y-3">
                {champions.map((c) => (
                  <div
                    key={c.n}
                    className="grid gap-4 rounded-xl border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-5 transition-all hover:border-[color:var(--gold)]/40 md:grid-cols-[80px_1fr]"
                  >
                    <div className="border-b border-[color:var(--gold)]/10 pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-4 md:text-center">
                      <div className="font-mono text-xs text-[color:var(--gold)]">CHAMPION</div>
                      <div className="font-display text-4xl font-bold text-[color:var(--gold-light)]">
                        #{c.n}
                      </div>
                      <div className="mt-1 text-2xl">{c.flag}</div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-xl font-semibold text-foreground">
                          {c.name}
                        </h3>
                        <span className="font-mono text-xs text-[color:var(--gold)]">
                          {c.years} · {c.reign}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/75">{c.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 19. VARIANTS */}
            <Section id="variants" eyebrow="19" title="Chess Variants — Other Ways to Play">
              <p>
                While standard chess is the most widely played form, many fascinating variants exist that use different rules, boards, or pieces. These variants offer fresh challenges even to experienced players.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {variants.map((v) => (
                  <Card key={v.name}>
                    <h3 className="font-display text-lg font-semibold text-[color:var(--gold-light)]">
                      {v.name}
                    </h3>
                    <p className="mt-2 text-sm text-foreground/75">{v.desc}</p>
                  </Card>
                ))}
              </div>
            </Section>

            {/* 20. AI */}
            <Section id="ai" eyebrow="20" title="Chess and Artificial Intelligence — A 70-Year Relationship">
              <p>
                Chess has been central to the history of AI since the very beginning of the field. In 1950, mathematician Alan Turing wrote the first chess-playing algorithm — not on a computer, but on paper. That same year, Claude Shannon published a landmark paper on how computers could be programmed to play chess.
              </p>
              <p>
                The progression from Turing's paper chess to modern engines spans 70 years. By the 1990s, Deep Blue's specialized hardware could evaluate hundreds of millions of positions per second, and in 1997 it defeated Kasparov. Today, programs like Stockfish play above 3500 Elo — far beyond any human.
              </p>
              <p>
                In 2017, DeepMind's AlphaZero taught itself chess from scratch using only the rules and neural networks trained by self-play. AlphaZero defeated Stockfish and played a dynamic, sacrificial style remarkably unlike any previous engine — leading many observers to say AlphaZero played chess the way humans dream of playing it.
              </p>
              <p>
                Today, chess engines are not enemies of the sport but essential training tools. Every professional player uses engines to analyze games, prepare opening novelties, and study endgames. The relationship between human and computer chess is now symbiotic.
              </p>
            </Section>

            {/* 21. START */}
            <Section id="start" eyebrow="21" title="How to Start Playing Chess — Your First Steps">
              <ol className="space-y-4">
                {[
                  ["Learn the basic rules", "You now know them from this guide! Each piece moves differently, you win by checkmate, and you must always get your king to safety. The rules will feel natural after a few games."],
                  ["Play your first games online for free", "Chess.com and Lichess.org are the two biggest platforms — both completely free. Create an account and play against the computer at the beginner level before challenging real players."],
                  ["Learn the three opening principles", "Before studying specific openings: control the center, develop your pieces, castle your king. These three principles give you a solid start in every game."],
                  ["Solve puzzles every day", "Chess puzzles are short exercises where you find the best move. Solving 5–10 puzzles a day is one of the fastest ways to improve."],
                  ["Review your games", "After every game, spend 5 minutes reviewing your moves. Identify the moment you started to lose — usually a single blunder. Learning to spot your blunders is the fastest path to improvement."],
                  ["Join a club or community", "Chess is more fun with other people. Find a local club, join an online community, or watch chess content on YouTube and Twitch. Learning from stronger players accelerates improvement dramatically."],
                ].map(([t, d], i) => (
                  <li
                    key={i}
                    className="flex gap-5 rounded-lg border border-[color:var(--gold)]/15 bg-[color:var(--card)] p-5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--card-deep)] font-display text-xl font-bold text-[color:var(--gold)]">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-display text-lg font-semibold text-foreground">{t}</div>
                      <p className="mt-1 text-foreground/75">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            {/* 22. QUIZ */}
            <Section id="quiz" eyebrow="22" title="Test Your Chess Knowledge">
              <Quiz />
            </Section>

            {/* 23. GLOSSARY */}
            <Section id="glossary" eyebrow="23" title="Chess Glossary — 55 Terms Defined">
              <Glossary />
            </Section>

            {/* 24. FAQ */}
            <Section id="faq" eyebrow="24" title="Frequently Asked Questions About Chess">
              <Accordion type="single" collapsible className="space-y-3">
                {faq.map((f, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-xl border border-[color:var(--gold)]/15 bg-[color:var(--card)] px-6"
                  >
                    <AccordionTrigger className="text-left font-display text-base font-semibold text-foreground hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 leading-relaxed text-foreground/80">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>
          </main>
        </div>
      </div>

      {/* FOOTER CTA */}
      <footer className="mt-20 border-t border-[color:var(--gold)]/15 bg-[color:var(--card-deep)]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl">
            Ready to Play Your First Game?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-foreground/75">
            You now know everything you need to start playing chess. The best way to improve is simply to play — every game teaches you something new.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[color:var(--gold)] px-8 text-[color:var(--background)] hover:bg-[color:var(--gold-light)]"
            >
              <a href="https://www.chess.com/play/online" target="_blank" rel="noopener noreferrer">
                ▶ Play vs Human
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-[color:var(--gold)]/40 bg-transparent px-8 text-foreground hover:bg-[color:var(--card)] hover:text-foreground"
            >
              <a href="https://www.chess.com/play/computer" target="_blank" rel="noopener noreferrer">
                🤖 Play vs Computer
              </a>
            </Button>
          </div>
          <div className="mt-12 select-none text-3xl tracking-[0.4em] text-[color:var(--gold)]/70">
            ♔ ♕ ♖ ♗ ♘ ♙
          </div>
          <div className="mt-12 text-xs font-mono uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            The Complete Chess Encyclopedia · 2025
          </div>
        </div>
      </footer>
    </div>
  );
}
