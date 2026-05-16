
# Chess Ultimate Encyclopedia — Build Plan

A single, very long content page modeled on the uploaded brief (1,766 lines, 27 sections) and inspired by chess.com/terms/chess. Goal: rank on Google + get cited by AI tools.

## Scope

One main route (`/`) replacing the placeholder. All 27 sections live on this page. Separate routes are not needed — the brief is explicit that this is one comprehensive page (TOC anchors to sections within it).

## Design System

Update `src/styles.css` with the brief's exact tokens (oklch equivalents of):
- bg `#0f0f1a`, card `#1a1a2e`, deep card `#12122a`
- gold `#d4a843`, gold-light `#f0c866`, teal `#3dd6ac`
- text `#f4f4f6`, muted `#9ca3b0`, gold border `rgba(212,168,67,0.12)`
- semantic: win-green, draw-blue, error-red

Typography (load via Google Fonts in `__root.tsx` head):
- Playfair Display (display/headings)
- Inter (body, line-height 1.8)
- JetBrains Mono (notation)

Aesthetic: dark luxury editorial — generous padding, gold hairline dividers, pull-quotes, drop caps on opening paragraphs.

## Page Structure

```
src/routes/index.tsx                  # composes all sections
src/components/chess/
  TopMetaBar.tsx
  Hero.tsx                            # animated CSS chessboard bg, stat pills
  TableOfContents.tsx                 # sticky sidebar + reading-progress bar + scroll-spy
  ReadingProgress.tsx
  Section.tsx                         # shared section wrapper (anchor id, h2)
  PullQuote.tsx
  PieceAccordion.tsx                  # 6 piece sections
  InteractiveBoard.tsx                # SVG 8x8 with hover coordinate tooltip
  PieceValueBar.tsx
  StepGuide.tsx                       # numbered setup steps
  MoveDiagram.tsx                     # mini SVG board to show piece movements
  ChampionsTimeline.tsx               # all world champions 1886–today
  HistoryTimeline.tsx
  BenefitGrid.tsx
  OpeningsGrid.tsx
  TacticsGrid.tsx
  RatingLadder.tsx
  TitlesTable.tsx
  GlossaryList.tsx                    # alphabetized
  FAQ.tsx                             # accordion + JSON-LD FAQPage
  Footer.tsx
src/data/
  champions.ts                        # name, years, country, bio, legacy
  openings.ts
  glossary.ts
  faq.ts
  history.ts
```

Sections in order (matching brief): Hero → TOC → What Is Chess → Why It Matters → Board → Pieces → Setup → Movement → Check/Checkmate → Special Rules → Game End → Time Controls → Notation → Openings → Middlegame → Endgame → Tactics → Ratings/Elo → FIDE Titles → Federations → Competitions → History → World Champions → Famous Games → Variants → Chess & AI → How to Start → Glossary → FAQ.

## SEO / AEO

In `__root.tsx` head (or per-route override):
- Title: "Chess: The Complete Encyclopedia — Rules, History, Champions & Strategy"
- Meta description (<160 chars)
- Single H1, semantic `<section>` + `<h2>` per chapter
- Canonical link, og:title/description/image, twitter card
- JSON-LD: `Article` for the page + `FAQPage` for the FAQ section
- Alt text on all visuals; descriptive anchor IDs (`#what-is-chess`, etc.)

## Interactive Behaviors

- Sticky left TOC on desktop, floating collapsible panel on mobile
- Reading-progress bar (scroll %)
- Scroll-spy: active TOC link highlighted in gold via IntersectionObserver
- Hero: subtle CSS chessboard pattern with hover scale on squares
- InteractiveBoard: hover any square → tooltip shows coordinate (e.g. "e4")
- PieceAccordion: open by default on desktop, collapsible on mobile
- FAQ accordion using existing shadcn `Accordion`
- Smooth-scroll anchor navigation

## Technical Notes

- TanStack Start route file `src/routes/index.tsx` only (delete placeholder)
- All styling via Tailwind utilities + tokens in `src/styles.css`
- Reuse shadcn `Accordion`, `Card`, `Badge`, `Button`, `Separator`
- Unicode pieces (♔♕♖♗♘♙) for inline display; SVG for board diagrams
- No backend, no auth, no DB — pure static content page
- Lazy-load below-the-fold sections is unnecessary at this content size; rely on SSR

## Out of Scope

- Actually playing chess (the "Play Chess Now" CTA links to chess.com)
- User accounts, saved progress
- Live game data / API integrations

## Deliverable

A single richly-designed page with all 27 sections fully written from the brief's copy, sticky TOC, scroll-spy, interactive board, accordions for pieces and FAQ, complete world-champions list, and full SEO/JSON-LD wiring.
