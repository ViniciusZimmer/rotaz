# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Warning: Non-standard Next.js

This project uses **Next.js 16.2.6** with React 19 — a pre-release/bleeding-edge version with breaking changes from what you may know. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code that touches Next.js internals. Heed deprecation notices.

## Commands

```bash
npm run dev      # Start dev server (uses --webpack flag)
npm run build    # Production build
npm run lint     # ESLint
```

No test suite exists.

## Architecture

Single-page Next.js App Router application. One client page, three API routes, and a set of pure library modules.

### Data flow

1. User uploads Excel → `app/page.tsx` parses it (two formats: `parsePadrao` / `parseModeloIA`)
2. User clicks "Calcular" → POST `/api/calcular` with `LinhaFrete[]`
3. `route.ts` processes routes **sequentially** (1s delay between each) to avoid HTTP 429 from Rotas Brasil
4. Each route: 1 API call to Rotas Brasil (eixo=6 as reference) → computes 28 ANTT variations mathematically
5. Results rendered in expandable table; exported via POST `/api/exportar`

### Key design constraints

- **1 API call per route only**: Rotas Brasil charges credits per call. The eixo=6 call gives km + pedagio reference; all 28 variations (7 eixos × 2 composição × 2 alto desempenho) are computed from `calcularANTT` locally.
- **Pedágio is not per-eixo**: Because we only call the API once (eixo=6), pedágio shown in the expandable grid and Excel is labelled "ref. 6 eixos" and excluded from per-eixo comparisons.
- **Route cache** (`.route-cache.json`): 30-day TTL, keyed by `"origem|destino|eixos"` (normalized). Entries with `pedagio === 0` are ignored on read and forced to retry.

### Library modules (`lib/`)

| File | Purpose |
|------|---------|
| `antt.ts` | ANTT formula (`km × CCD + CC`) + 4 full tables (T_SIMPLES, T_COMPOSICAO, T_SIMPLES_ALTO, T_COMPOSICAO_ALTO) for 7 eixos × 7 tipos de carga. Source: ANTT Resolução nº 5.867/2020, updated PORT.SUROC Nº 04/2026. |
| `rotas-brasil.ts` | Rotas Brasil API wrapper. Token from `ROTAS_BRASIL_TOKEN` env var. Retries up to 5× with progressive backoff on non-200. Falls back to `google-maps.ts` KM + `pedagio: 0`. |
| `route-cache.ts` | Hybrid in-memory Map + JSON file cache. Populated from disk on first call, persisted on every write. |
| `google-maps.ts` | KM fallback: Google Maps Distance Matrix API if `GOOGLE_MAPS_API_KEY` set, otherwise Haversine × 1.35 from a hardcoded `COORDS` table of Brazilian cities. |
| `excel.ts` | XLSX generation. `gerarExcel` (standard) and `gerarExcelModeloIA` both use `buildGrade` to produce a grid layout: merged route header row + 5 columns (Eixos | Simples | Simples+AD | Composição | Comp.+AD). |

### Types (`types/frete.ts`)

`LinhaFrete` is the central type — input row and output result share the same shape. `variacaoCompleta: LinhaVariacao[]` holds the 28 computed combinations added after calculation.

### Environment variables

| Variable | Used by |
|----------|---------|
| `ROTAS_BRASIL_TOKEN` | `lib/rotas-brasil.ts` — required for real km/pedágio data |
| `GOOGLE_MAPS_API_KEY` | `lib/google-maps.ts` — optional KM fallback (Haversine used if absent) |
