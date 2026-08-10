# Individual defensive players (IDP)

Canonical positions (display order): **CB, S, DT, DE, LB** (plus team **DEF**).
Mapped from Sleeper NFL `position` (`NT→DT`, `OLB/ILB/MLB→LB`, `FS/SS→S`). When `position` is only **DL/DB**, refine from `depth_chart_position` (e.g. `RCB→CB`, `FS→S`, `LDE→DE`). Bare `DL`/`DB` depth labels stay unmapped.

## What shipped

- Position seed rows + Sleeper import for active rostered defenders
- Roster presets: **Standard offense**, **Offense + IDP** (standard offense + DEF + **2 CB, 2 S, 1 DT, 2 DE, 2 LB**), **Custom**
- Offense + IDP uses a starter summary (no editable positions table); Custom keeps the table
- Colors, rankings/draft filters, IDP stat columns (CB → S → DT → DE → LB)
- Position badge palette: QB rose, RB sky, WR emerald, TE violet, K amber, FLEX teal, DEF gray, IDP (CB/S/DT/DE/LB) pink
- Team Player Stats: Defensive Backs / Defensive Linemen / Linebackers tables; Team DEF only when rostered
- Points by position + Position Strength include individual IDP slots from roster settings
- Minimal default IDP scoring (solo/assist, sack, INT, FF, FR, safety, TD) scoped to IDP only
- Team DEF rules stay on `DEF` only; omitted from defaults when roster has no DEF
- Scoring rule “Apply to” toggles limited to positions on the league roster
- New leagues persist scoring rules filtered to roster positions at create
- Roster save prunes scoring rules that no longer match roster positions (incl. team-DEF defaults)
- Sleeper `idp_*` projection keys aliased onto shared keys via `normalizePlayerStats`
- nflverse official replace maps IDP box-score lines (`def_tackles_solo` / `def_tackle_assists` / `def_tackles_for_loss`, sacks, FF, FR, INT, safety, TD) onto the same keys
- Sleeper score fetch includes IDP NFL positions + `DL`/`DB` buckets
- Need-aware / mock draft: pad QB/RB/WR/TE/FLEX before IDP needs; K/DEF still last two picks
- Game Centre box score partitions IDP with defense
- Player Overview for IDP: season production tiles, scoring DNA, team tackle-share opportunity, solo% efficiency, position medians / startable cutoffs (not stubbed)

## Ops after deploy

```bash
pnpm db:seed:positions   # upsert CB/S/DT/DE/LB rows + sort_order
pnpm db:seed:players     # import defenders (re-run after mapper change)
pnpm db:seed:scores      # optional: backfill projections/stats with expanded positions
```

Default create-league format remains **offense-only (standard)**. Commissioners opt into IDP via Roster Requirements.

**Existing leagues:** stored scoring JSON is not auto-migrated when IDP slots are added later. Commissioner adds IDP-scoped rules (or re-applies a scoring preset) in Settings. No auto-merge planned.

## Remaining gaps

| Gap | Why it matters | Status / follow-up |
|---|---|---|
| **IDP FLEX** | Custom slots are exact-match only | Deferred — revisit with offense FLEX redesign |
| **Free-agent defenders without `team`** | Same gate as offense (`active` + team) — practice-squad / FA without team stay out | Revisit if waiver wire feels thin mid-season |
| **Player page stats per position** | Overview / game-log / column sets still need position-specific tweaks (CB vs S vs DT vs DE vs LB) | Revisit each IDP position’s stats surface against real usage |

Offense-only leagues are unaffected until a commissioner enables IDP slots.
