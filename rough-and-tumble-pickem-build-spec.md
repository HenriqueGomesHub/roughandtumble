# Rough & Tumble — Pick'em App · Build Specification

> Seattle's Pub for Women's Sports. A QR-driven, in-venue pick'em game where patrons predict winners of live women's sports games for points and season prizes, while a big-screen "Live" view on the pub monitor shows the game, the running community vote split, and the voting countdown.

**Status:** Build-ready spec. Hand to Claude Code and execute the phases in §15.
**Stack:** Vite + React + TypeScript + Tailwind v4 · Supabase (Postgres / Auth / Realtime / Edge Functions) · Vercel · ESPN (unofficial) data feed, isolated for later swap.
**Design language:** Rough & Tumble system — cream paper surfaces, stadium navy, single persimmon accent, square corners, slab-caps headlines. See §10.

---

## 1. Product summary

A patron walks into the pub on game night, scans a QR sticker on the table, and lands in the app. The pub's big screen shows the live game. When the admin opens a voting window, the patron enters the on-screen game code (proving they're present), picks who wins, and earns points if they're right. Streaks and showing up regularly earn bonus points. A season-long leaderboard decides who takes the prizes; a weekly window and a watch-party attendance track add more reasons to come back.

### The core loop
1. **Scan** the table QR → app opens.
2. **Log in** with phone number (first time: add a name; OTP verifies the number once).
3. If a voting window is **open**, the voting modal appears first.
4. **Enter the game code** shown on the big screen → pick a team → submit (changeable until the timer ends).
5. **Watch** the game on the big screen; see the live community split and countdown.
6. Game ends → picks **settle** → points awarded → leaderboard updates live.
7. Come back next game night. Climb the board. Win prizes.

### Three surfaces, one codebase
- **Phone app** (most users) — responsive PWA, tab navigation: Bracket · Leaderboard · Prizes · Live.
- **Big screen / TV** (`/tv`) — read-only, glanceable display on the pub monitor.
- **Admin** (`/admin`, PC) — runs voting sessions, manages games/brackets/seasons/prizes, moderates users.

---

## 2. Users & roles

| Role | Device | How they get in | What they can do |
|---|---|---|---|
| **Patron** | Phone | Phone number + one-time OTP (first login only) | Vote, view all four pages, see their rank, track attendance |
| **Admin** | PC | Phone login → admin password gate | Everything below in §12 |
| **Display** | Big screen | No auth — read-only public route | Nothing; it only renders live state |

Admin is a flag on the user record (`profiles.is_admin`). When a recognized-admin phone logs in, a password gate appears (a shared admin password, server-verified). No 2FA in v1.

---

## 3. Glossary

- **Voting session** — an admin-opened window tied to one game, with a join **code** and a fixed **duration**. One open session at a time in v1.
- **Game code** — a short code (e.g. 6 chars) shown on the big screen. Entering it is the **presence gate**: you can only earn points if you're physically there to read it.
- **Pick** — a patron's single prediction in a session (one per phone per session; changeable until close).
- **Settlement** — after the game finishes, picks are scored and points awarded.
- **Streak** — consecutive correct picks for a user. Resets to 0 on a wrong pick; a night with no pick is neutral (does not reset).
- **Participation day / watch party** — a distinct calendar day (pub timezone) on which a user made ≥1 pick. Drives the +1/day point, the attendance bar, and the season drawing — one unified signal.
- **Season** — a league's run (regular season → playoffs → champion). Leaderboard persists after the final game until the admin resets, so prizes can be handed out.
- **Week** — a rolling 7-day window for the weekly leaderboard / Top Weekly Picker.

---

## 4. Scoring engine (authoritative)

All scoring happens at **settlement**, server-side, and is **idempotent** (re-running settlement for a session must not double-count). Every award is written to a `point_events` ledger so the leaderboard is auditable and recomputable.

### Rules
- **Correct pick:** `+10` base points.
- **Streak bonus:** on a correct pick, `+N` where `N` is the streak length **reached by this pick** (the resulting streak). First correct = +1, second consecutive = +2, … fifth = +5.
- **Wrong pick:** `0` base, `0` streak bonus, streak resets to `0`.
- **No pick on a day:** neutral — streak is not reset.
- **Participation:** `+1` once per **distinct calendar day** (pub timezone, `America/Los_Angeles`) on which the user made ≥1 pick — awarded regardless of whether picks were right or wrong.

### Worked example
A user with these consecutive correct picks (no misses) earns, per pick: `10+1, 10+2, 10+3, 10+4, 10+5` = `11, 12, 13, 14, 15`. If pick #6 is wrong: `0`, streak → 0. Pick #7 correct again: `10+1`. Each distinct day they played also adds `+1` once.

### Ranking
- **Leaderboard ranks by total points.** Wins (count of correct picks) and current streak are shown as secondary stats.
- **Season leaderboard:** all `point_events` in the active season.
- **Weekly leaderboard:** `point_events` within the rolling 7-day window.
- **Ties:** rank by points desc, then total wins desc, then earliest-to-reach (first `point_events.created_at` that put them at their final total). Prize ties at a tier are resolved by the admin (documented, not automated).

### Attendance / watch parties
- `parties_attended` = `COUNT(DISTINCT participation_day)` for the user in the active season.
- Season goal is configurable on the season (`watch_party_goal`, default 8). Hitting the goal enters the user into the season drawing.

---

## 5. Pages & screens

Layouts come from the phone wireframes; **visual styling comes from §10** (cream/navy/persimmon, square corners). The wireframes' dark palette and pill buttons are **not** the look.

### 5.1 Onboarding (login modal)
- Triggered by **Login** (persimmon pill, top-right) or automatically when a voting session is open and the user is anonymous.
- **Welcome Back** state: phone number field → **LET'S GO**. Unknown number → reveal **name** field (sign-up) → register.
- First login sends an **OTP** (Supabase phone auth); returning users skip it. Numbers normalized to **E.164**.
- Copy and CTAs in R&T voice ("LET'S GO", "New here? Sign up").

### 5.2 Voting modal (the moment of the app)
- Appears **first** when a session is open and the user opens the app.
- **Game code** input (required) → on valid code, reveals the two teams (logos, colors, names) → tap a team to pick → **submit**.
- Pick is **changeable** until `closes_at`. One pick per phone per session.
- **Dismissable** — user can exit to browse teams/bracket/live to inform their guess. While a session is open and the user hasn't locked in (or wants to change), a **floating bottom-right button** shows the live "⏱ M:SS left to vote" and reopens the modal.
- Countdown is **server-authoritative** (`closes_at`); identical on phone and big screen.

### 5.3 Bracket
- **View-only**, pan/zoom canvas (React Flow or equivalent). Only shown when the active season has a bracket (playoffs).
- Rounds as columns (e.g. Quarterfinals → Semifinals → Final), match nodes show two teams or **TBD**, connector lines in persimmon, the live/next matchup highlighted.
- Top of page: persistent **LIVE NOW** banner (current game + score) and a strip of **next-up game chips** (team marks + date).
- Auto-seeded from standings; advanced from playoff results; admin can override (see §12).

### 5.4 Leaderboard
- Heading "LEADERBOARD" (slab caps, persimmon underline), Login pill.
- Toggle: **Season** / **This Week**.
- Ranked rows: rank badge (gold/silver/bronze trophy-medal-ribbon for 1–3, then numerals) → initials avatar → name + ⭐ (active-streak marker) → "`{wins}` wins · 🔥`{streak}`" → big persimmon points number + "points".
- **Pinned "You" row** (persimmon border) always visible, even at rank 10+.

### 5.5 Prizes & Rewards
Three blocks (all built in v1):
1. **Season Prizes** — tiered cards 1st/2nd/3rd (gold/silver/bronze gradients), each with a value + label (e.g. "$250 Food & Drink Credit"). Content is admin-editable.
2. **Watch Party Rewards** — attendance card with a personal progress bar ("5 / 8 parties", "3 more parties to qualify!") feeding a season drawing for merch/VIP.
3. **Weekly Prizes** — "Top Weekly Picker" → highest weekly points wins a bar tab.
- All prize copy/values are admin-editable records, not hardcoded.

### 5.6 Live
- **Live scoreboard:** team logos + team colors + score + LIVE dot + game clock/status.
- **Pick'em Predictions:** community split bar (e.g. 38% / 62%), persimmon vs cream, "Based on `{n}` participants". Updates live as votes come in.
- **Match stats:** sport-specific comparative rows (WNBA: points/rebounds/assists/FG% etc.; NWSL later: shots/possession/corners). Pulled from ESPN `summary`.
- **Winner animation** on final.

### 5.7 Big screen / TV (`/tv`)
From the vibe mockup, made richer. Cream page, navy bands top (logo) and bottom.
- **Left:** large live scoreboard (logos, colors, big scores, LIVE dot, persimmon divider, clock).
- **Beneath scoreboard:** two panels — (a) live **vote split** with animated persimmon/cream bars + the **countdown ring** when a session is open; (b) **match stats**.
- **Right:** ranked leaderboard (top ~7), #1 row highlighted persimmon.
- **Winner animation** when the game goes final; voting state changes (open → counting down → closed → settled) are visible at a glance.
- No auth; subscribes to Realtime; auto-recovers on reconnect.

---

## 6. Key flows

### 6.1 Onboarding
`Scan QR → app → Login → phone (E.164) → [first time: OTP + name] → authenticated → (if session open) voting modal`

### 6.2 Voting
`Open session detected → voting modal → enter game code → code valid & now < closes_at → reveal teams → pick → submit (upsert) → [optional: change pick until close] → close → settle`

Server-side `submit_pick(code, team_id)` RPC validates: code matches an **open** session, `now < closes_at`, one row per (session, user) (upsert). Rejects otherwise. This is the presence + integrity gate.

### 6.3 Admin session lifecycle
`Admin picks the live game → set duration → OPEN session (generates code, sets closes_at) → countdown shown on TV + phones → [admin may close early / cancel] → timer ends → session CLOSED → game finishes (ESPN state=post, winner known) → SETTLE (auto; manual winner override available) → points awarded → leaderboards update live`

### 6.4 Settlement
Triggered when the session's game reaches `state = 'post'` with a known winner (or admin confirms/overrides). For each pick in the session, in chronological order: mark correct/incorrect, update the user's streak, compute base + streak bonus, ensure that day's +1 participation exists, write `point_events`, update denormalized `profiles` stats. Idempotent per session.

---

## 7. Data model (Postgres / Supabase)

Use `uuid` PKs (`gen_random_uuid()`), `timestamptz`, and Row-Level Security on every table. Denormalize leaderboard-critical stats onto `profiles` for fast reads; keep `point_events` as the source of truth.

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| phone | text unique | E.164 |
| display_name | text | editable by owner & admin |
| is_admin | boolean | default false; set only server-side |
| total_points | int | denormalized, season-scoped (see note) |
| current_streak | int | |
| best_streak | int | |
| total_wins | int | |
| created_at | timestamptz | |

> Denormalized stats reflect the **active season**. On season reset, archive then zero them. The authoritative numbers always remain derivable from `point_events`.

### seasons
`id, league (text), name, watch_party_goal (int default 8), starts_at, ends_at, is_active (bool), created_at`

### games
`id, espn_event_id (text unique), season_id (fk), league (text), is_playoff (bool), state ('pre'|'in'|'post'), status_detail (text), period (int), clock (text), start_time (timestamptz), home_team_id/away_team_id (text), home/away _name/_abbr/_logo/_color (text), home_score/away_score (int), winner_team_id (text null), stats (jsonb), updated_at`

### voting_sessions
`id, game_id (fk), code (text), duration_seconds (int), opens_at, closes_at (timestamptz), status ('open'|'closed'|'settled'|'cancelled'), home_votes (int), away_votes (int), total_votes (int), created_by (fk profiles), settled_at, created_at`

> `home_votes/away_votes/total_votes` are maintained by a trigger on `picks` so the live split is one subscribable row (no exposing raw picks). `closes_at` is the single source of truth for the countdown.

### picks
`id, session_id (fk), user_id (fk), game_id (fk), picked_team_id (text), is_correct (bool null), points_awarded (int null), created_at, updated_at`
**Unique(session_id, user_id).** Changing a pick is an upsert (allowed only while `now < closes_at`).

### point_events (ledger)
`id, user_id (fk), session_id (fk null), season_id (fk), type ('win'|'streak_bonus'|'participation'), points (int), created_at`

### bracket_matchups
`id, season_id (fk), round (int), round_label (text), position (int), team_a_id (text null), team_b_id (text null), team_a_name/logo, team_b_name/logo, winner_team_id (text null), next_matchup_id (fk self null), espn_event_id (text null), updated_at`

### prizes
`id, season_id (fk), category ('season'|'watch_party'|'weekly'), rank (int null), title (text), value_label (text), description (text), sort_order (int)`

### Views (computed)
- `season_leaderboard` — sum `point_events.points` per user for the active season, + wins + current_streak, ordered by points desc, wins desc.
- `weekly_leaderboard` — same, filtered to `created_at >= now() - interval '7 days'`.
- `attendance` — `COUNT(DISTINCT date(picks.created_at AT TIME ZONE 'America/Los_Angeles'))` per user per season.

### RLS sketch
- **profiles:** authenticated can `SELECT` all (names/initials for the board); owner can `UPDATE display_name`; admins can `UPDATE` any (rename); `is_admin` never client-settable.
- **picks:** owner can `INSERT/UPDATE/SELECT` own only, and only via the `submit_pick` RPC for writes; no public read of raw picks.
- **voting_sessions / games / bracket_matchups / prizes:** public `SELECT`; writes admin-only via RPC / service role.
- **point_events:** public `SELECT` aggregates via views only; no direct raw read needed by clients.

---

## 8. Architecture

```
                         ┌─────────────────────────────┐
   Pub big screen  ◄──── │      Supabase Realtime       │ ◄──── Phones (PWA)
                         │  (games, voting_sessions)    │ ◄──── Admin (PC)
                         └──────────────┬──────────────┘
                                        │ Postgres changes
                         ┌──────────────┴──────────────┐
                         │     Supabase Postgres        │
                         │  + Auth (phone OTP) + RLS    │
                         └──────────────┬──────────────┘
                                        │ upsert scores / settle
                         ┌──────────────┴──────────────┐
                         │  Supabase Edge Function      │
                         │  cron poller (~15–20s)       │
                         │  └─ lib/espn (ISOLATED)      │ ──► ESPN unofficial API
                         └─────────────────────────────┘

   Frontend: Vite + React + TS + Tailwind v4, deployed on Vercel.
   Routes:  /  (phone app, tabbed)   ·   /tv  (display)   ·   /admin  (gated)
```

### Why this shape
- **ESPN must be fetched server-side** (CORS blocks the browser; only JSON, not images). The Edge Function is that server.
- **One poller, fanned out.** The Edge Function is the only thing that touches ESPN. It writes to Postgres; **all** clients subscribe to Supabase Realtime. Live scores, vote split, and countdown all push from one place, perfectly synced across phones and the TV.
- **Logos/headshots load client-side** directly from `a.espncdn.com` (not CORS-gated), with `onError` fallbacks.
- **Data layer isolated** in `lib/espn` so swapping ESPN → a licensed feed (SportsDataIO / Sportradar / ASA) is a one-file change.

### Frontend structure (suggested)
```
src/
  lib/supabase.ts          // client + typed helpers
  lib/time.ts              // server-time offset, countdown math
  hooks/useSession.ts      // active voting session + countdown
  hooks/useLiveGame.ts     // current game realtime
  hooks/useLeaderboard.ts  // season / weekly
  features/onboarding/     // login + OTP modal
  features/voting/         // code entry, pick, change, floating timer
  features/bracket/        // pan/zoom canvas
  features/leaderboard/
  features/prizes/
  features/live/
  routes/tv/               // big-screen display
  routes/admin/            // gated admin
  ui/                      // tokens, primitives (Button, Card, ScorePill…)
supabase/
  functions/poll-espn/     // cron Edge Function
    lib/espn.ts            // ISOLATED data module (swap point)
  functions/settle-session/
  migrations/              // schema + RLS + triggers + views
```

---

## 9. ESPN integration

Wrap all of this in `supabase/functions/poll-espn/lib/espn.ts`. Re-verify field paths if parsing breaks — the API is unofficial.

### Endpoints (no key; all GET)
Base `https://site.api.espn.com/apis`, league slug `basketball/wnba` (NWSL later: `soccer/usa.1`).

| Need | Endpoint | Poll/cache |
|---|---|---|
| Live/recent scores | `/site/v2/sports/basketball/wnba/scoreboard` | 15–20s |
| Teams (logos/colors) | `/site/v2/sports/basketball/wnba/teams` | ~5 min |
| Standings (seeding) | `/v2/sports/basketball/wnba/standings` | ~5 min (note: `/apis/v2`, not `/site/v2`) |
| Roster/photos | `/site/v2/sports/basketball/wnba/teams/{id}/roster` | ~1 h |
| Play-by-play / box | `/site/v2/sports/basketball/wnba/summary?event={id}` | 15s while live |

### Field paths (verified)
- Game: `events[].id`, `competitions[0].status.type.state` (`pre`/`in`/`post`), `.status.type.shortDetail` (clock/"Final").
- Competitor: `competitions[0].competitors[]` → `.homeAway`, `.score`, `.winner`, `.records[]` (type `total` → `.summary`), `.team.{id,displayName,shortDisplayName,abbreviation,logo,color}`.
- Leaders: competitor `.leaders[]` → find `name==="points"` → `.leaders[0].displayValue`, `.athlete.shortName`, `.athlete.headshot`.
- Teams: `sports[0].leagues[0].teams[].team.{id,displayName,abbreviation,location,color,alternateColor,logos[]}` — pick logo by `rel` (`default` light, `dark` dark UI).

### Required defensive handling (the traps)
- **`team.color` has no `#`** — prefix it.
- **Standings JSON shape is unstable** — walk the tree (recurse collecting `entries[]`), de-dupe by team id, sort by `winPercent`. Do not index a fixed path.
- **Missing images are normal** — always `onError` → colored circle + abbreviation.
- **Caches/proxies serve stale data and drop query params** — verify freshness against `events[].date`; don't trust that `?dates=` survived.
- **No public CORS proxies** — only our own server fetch.
- **Direct image URLs** (fallback when no API object): `https://a.espncdn.com/i/teamlogos/wnba/500/{abbr}.png` (abbr lowercase); `https://a.espncdn.com/i/headshots/wnba/players/full/{id}.png`.

### Brackets (no endpoint — we build it)
- **Seed** from standings (top N by win pct). Standard 8-team pairing: 1v8 & 4v5 (top half), 2v7 & 3v6 (bottom half).
- **Advance** from `scoreboard` results filtered to playoff games → set `winner_team_id`, propagate to `next_matchup_id`.
- **Manual override** so it works before/independent of live playoff data (admin clicks a team to advance).

### Multi-sport
Data layer keys off a `LEAGUE` constant. **WNBA ships first.** NWSL is the documented duplicate (`soccer/usa.1`): no quarters/clock, adjust round labels and the `stats` jsonb shape (shots/possession/corners vs points/rebounds/assists). The Live "Match Stats" block renders from `games.stats` jsonb, branched by `league`.

### Licensing (informed call)
ESPN is unofficial and not licensed for commercial redistribution. For an internal pub engagement tool you're not reselling data, risk is low — but keep the data layer isolated and be ready to swap to a licensed feed (SportsDataIO / Sportradar / ASA, with image rights) if it ever becomes a commercial concern.

---

## 10. Design system (Rough & Tumble, applied)

**North star:** two dominant surfaces — cream paper and stadium navy — anchored by *one* loud persimmon accent. Roughly **60% cream / 30% navy / 10% persimmon**. Persimmon is a signal (buttons, headlines, links, the live dot, the #1 highlight, vote bar, divider), never a large wash.

### Tokens
```css
:root{
  /* color */
  --navy:#232F49; --navy-deep:#1A2336;
  --paper:#EEE5DC; --paper-deep:#E4D9CA;
  --persimmon:#E96630; --persimmon-deep:#D2531D;
  --white:#FFFFFF;
  --muted-navy:rgba(35,47,73,.62);   /* fine print on cream */
  --muted-cream:rgba(238,229,220,.60);/* fine print on navy */

  /* type */
  --display:"Zilla Slab","Sentinel",Rockwell,serif; /* UPPERCASE headings */
  --body:"Hanken Grotesk",system-ui,sans-serif;     /* sentence case */
  --script:"Kaushan Script",cursive;                /* logotype fallback only */

  /* spacing (8-pt): 4 8 12 16 24 32 48 64 96 128 */
  --maxw:1180px;
  --radius:0px;                 /* everything is square */
  --shadow:0 18px 40px -18px rgba(26,35,54,.45);
}
```

### Hard rules
- **`border-radius: 0` everywhere** — buttons, inputs, cards, images, avatars. (The wireframes' pill buttons are wrong; square them.)
- **Headings & button labels:** Zilla Slab 700, **UPPERCASE**, tight line-height, positive tracking. **Body:** Hanken Grotesk, sentence case, lh 1.6, ~60ch measure.
- **Borders:** `2px navy` for frames/ghost buttons; `1–2px persimmon` for hairlines and nav underlines.
- **Buttons:** primary = persimmon bg / white label, hover `--persimmon-deep` + `translateY(-2px)`; ghost = transparent, `2px solid navy`, hover navy fill / cream label.
- **Logotype:** use the **provided logo asset** (script wordmark + pennant + tagline). Kaushan Script only as a stand-in if the asset is unavailable.
- **Imagery:** team logos full-color on their team color; winner/celebration moments full-color; archival = navy duotone.

### Per-surface direction
- **Phone:** cream page, navy cards, persimmon accents. Reskin every wireframe into this — same layout, R&T paint. Bottom tab bar on navy with persimmon active state.
- **TV:** cream page; navy header band (logo) + footer band; navy scoreboard card (big white scores, persimmon LIVE dot + divider); navy leaderboard panel with cream rows, #1 persimmon; animated persimmon/cream vote bars; a prominent **persimmon countdown ring**; winner animation on final. Designed to read from across the room — oversized type, high contrast.
- **Voice:** punchy, second-person, exclamatory — "LET'S GO", "Sign Me Up!", "LFG!".

---

## 11. Realtime & sync

- **Channels:** clients subscribe to the active `voting_sessions` row (status, `home/away/total_votes`, `closes_at`) and the live `games` row (state, scores, clock, stats).
- **Vote split:** trigger on `picks` keeps the vote counts on the session row → one subscribable source, raw picks never exposed.
- **Countdown:** server-authoritative `closes_at`. Clients compute `remaining = closes_at − serverNow`, using a one-time **server-time offset** (`lib/time.ts`) so phones and TV agree to the second.
- **Reconnect:** all views re-fetch current state on reconnect/visibility-change; the TV must self-heal without a manual refresh.

---

## 12. Admin (PC)

- **Auth:** phone login; if `is_admin`, show a password gate → `verify_admin_password` RPC (shared secret in server config, not in client). Unlock is session-scoped. No 2FA in v1.
- **Live control panel:**
  - Pick the **current game** from today's synced games.
  - **Open voting session** → choose duration → generates code, sets `closes_at`. Code + countdown go live on the TV.
  - **Close early** / **cancel** the session.
  - View live tallies + countdown.
  - **Settle:** automatic on game final; **manual winner override** available.
- **Brackets:** seed from standings, advance from results, manual override (click a team to advance).
- **Users:** view every player (name + phone), **rename** inappropriate names, see their stats.
- **Seasons:** create / activate / **reset** (archives the board so prizes can still be handed out, then starts fresh).
- **Prizes:** edit all prize records (season tiers, watch-party, weekly), set `watch_party_goal`.

---

## 13. Security & anti-cheat

- **Presence gate:** points require entering the session **code** shown only on the in-venue screen, enforced in `submit_pick`. This is the core anti-farming mechanism.
- **One pick per phone per session:** DB unique constraint + RPC upsert.
- **Pick window:** writes rejected unless `now < closes_at` (server-checked, not client-trusted).
- **Phone verified once** via OTP; numbers normalized to E.164 so one human = one record.
- **RLS everywhere**; admin writes via RPC/service role only; `is_admin` not client-settable.
- **Settlement is server-side and idempotent**; points are never computed or written by the client.
- **Vote split** exposed only as aggregates; raw picks are private.

---

## 14. Non-functional

- **Responsive** for phone (primary), PC (admin), and large TV (display) — three distinct layouts, one codebase.
- **PWA:** installable (Add to Home Screen), like Axis. Offline shell tolerable; live data obviously needs connection.
- **Performance:** leaderboard reads from denormalized stats / views; one shared poller; image fallbacks; lazy-load the bracket canvas.
- **Resilience:** TV auto-recovers; ESPN parsing defensive; missing data degrades gracefully.
- **Timezone:** all day-boundary logic in `America/Los_Angeles`.

---

## 15. Build phases (for Claude Code)

Execute in order; each phase should be runnable/verifiable before moving on.

1. **Scaffold** — Vite + React + TS + Tailwind v4, R&T tokens in `ui/`, square-corner primitives (Button, Card, Input, Avatar, ScorePill), fonts, routing (`/`, `/tv`, `/admin`), Supabase client.
2. **Schema & RLS** — all tables (§7), triggers (vote counts), views (leaderboards, attendance), RLS policies, RPCs (`submit_pick`, `verify_admin_password`), seed a dev season.
3. **Auth** — phone OTP onboarding modal (welcome-back / sign-up), E.164 normalization, profile creation, admin gate.
4. **ESPN data layer** — `lib/espn.ts` (isolated), `poll-espn` Edge Function cron, upsert `games`, defensive parsing + image fallbacks, standings tree-walk.
5. **Live (phone) + Realtime** — live scoreboard, community split, match stats, `useLiveGame`/`useSession` hooks, server-time offset + countdown.
6. **Voting** — voting modal (code → teams → pick → change), `submit_pick`, dismiss-to-browse + floating timer button.
7. **Settlement** — `settle-session` Edge Function, scoring engine (§4), `point_events`, denormalized stat updates, idempotency.
8. **Leaderboard** — season/weekly toggle, ranked rows, pinned "You" row.
9. **Prizes** — three blocks, admin-editable records, attendance progress bar.
10. **Bracket** — pan/zoom canvas, seed/advance/override, LIVE banner + next-up chips.
11. **TV display** — `/tv` rich layout from the vibe screen, animated bars, countdown ring, winner animation, self-healing.
12. **Admin** — full control panel (§12).
13. **Polish** — winner animations, empty/loading/error states, PWA manifest, responsive passes for phone/PC/TV, accessibility.

---

## 16. Claude Code kickoff prompt (paste-ready)

> Build **Rough & Tumble Pick'em**, an in-venue women's-sports pick'em web app, per the attached build spec (`rough-and-tumble-pickem-build-spec.md`). Stack: Vite + React + TypeScript + Tailwind v4 frontend on Vercel; Supabase for Postgres, phone-OTP auth, Realtime, and Edge Functions; ESPN unofficial API as the data feed, fully isolated in `supabase/functions/poll-espn/lib/espn.ts` for later swap.
>
> Work in the phases defined in §15, one at a time, and pause for review after each. Start with Phase 1 (scaffold) and Phase 2 (schema, RLS, triggers, views, RPCs). Strictly follow the Rough & Tumble design system in §10 — cream paper surfaces, stadium navy, single persimmon accent, **`border-radius: 0` everywhere**, Zilla Slab uppercase headings, Hanken Grotesk body, use the provided logo asset for the wordmark. The phone wireframes define layout only, not styling.
>
> Honor the scoring engine in §4 exactly (10 base, +resulting-streak bonus, +1 per participation-day, wrong pick resets streak, missed day neutral), the presence-gate via game code in §13, and server-authoritative countdown sync in §11. All scoring is server-side and idempotent via the `point_events` ledger. Build WNBA first with the data layer ready for the NWSL league swap. Ask me before introducing any dependency not implied by the spec.

---

## 17. Out of scope (v1) / future

- Favorite-team following and team-specific bracket highlighting.
- Multiple concurrent voting sessions; multiple pubs/venues (data model already allows growth).
- In-game prop bets (next quarter, etc.) — v1 is pre-game winner only.
- Licensed data feed migration (SportsDataIO / Sportradar / ASA) — swap `lib/espn.ts` only.
- 2FA for admin.
- Push notifications.

---

*This spec reflects decisions confirmed during planning. ESPN endpoint shapes are unofficial and may change — re-verify field paths in `lib/espn.ts` if parsing breaks.*
