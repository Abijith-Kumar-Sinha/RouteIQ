# RouteIQ — Visual Logistics Engine

> An interactive logistics platform that turns classic algorithms into things
> you can **watch run** — across a real city, frame by frame, with operation
> counts ticking up in front of you. Built for a Design & Analysis of
> Algorithms course, engineered like a product.

![React](https://img.shields.io/badge/React-19-38bdf8) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Tailwind](https://img.shields.io/badge/TailwindCSS-4-0ea5e9) ![Leaflet](https://img.shields.io/badge/Leaflet-maps-199900)

RouteIQ models a delivery company's daily problem — *get goods from a depot to
customers, cheaply* — and solves each sub-problem with a different algorithm
from the DAA syllabus, then composes them into one product across five modes.

## The five modes

| Mode | What it does | Algorithms |
|------|--------------|------------|
| **Studio** | Hand-build a weighted graph and watch any algorithm execute step by step | Dijkstra, BFS, Greedy TSP, 0/1 Knapsack, Huffman |
| **City Map** | Route across **39k+ real Bangalore intersections** (OpenStreetMap), single or multi-stop | A\*, Dijkstra, BFS, Greedy TSP ordering |
| **Race Arena** | Three algorithms flood an editable grid/maze **simultaneously** — fewest cells explored wins | A\* vs Dijkstra vs BFS |
| **Simulation** | A fleet of trucks drives the optimised tour on real roads, with a savings dashboard | Greedy TSP + A\* + fleet assignment |
| **Benchmark Lab** | Measures real runtime as input grows and overlays it on the theoretical Big-O | Selection, Bubble, Insertion, Merge, Quick sort |

## Highlights

- **Real road data** — a baked OpenStreetMap graph of Bangalore (3 coverage
  levels: 12 km core, within-ORR, and city-wide arterials), fetched on demand.
- **Graph contraction** — degree-2 chains are collapsed to intersection-level
  edges (lossless for shortest paths) while edge *geometry* is preserved so the
  real road curves still render. Routing stays fast at city scale.
- **Heap-based router with O(V) animation memory** — records settle-order
  instead of snapshotting the visited set per frame, so 80k+ node searches
  animate smoothly.
- **Empirical complexity proof** — the Benchmark Lab plots measured operation
  counts against scaled theoretical curves; they overlap, and `ops / f(n)`
  stays constant. You don't claim the Big-O, you *measure* it.
- **Canvas overlays with viewport culling** and zoom-synced transforms keep the
  visualisations buttery even with tens of thousands of segments.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # preview the built bundle
```

Re-baking the map data (optional — already committed in `public/`):

```bash
node scripts/fetch-osm.mjs core   # 12 km, all streets (default)
node scripts/fetch-osm.mjs orr    # ~18 km, all streets
node scripts/fetch-osm.mjs bbmp   # ~28 km, arterials
```

## Architecture

```
src/
  algorithms/   pure, framework-free implementations + step traces
                dijkstra · bfs · astar · tsp · knapsack · huffman · mapRoute
  data/         OSM graph loader + contraction-aware city data
  race/         grid model, maze generation
  bench/        instrumented sorts (operation-counting)
  lib/          shared helpers (coverage mask, …)
  views/        Studio · CityMap · Race · Simulation · Benchmark · Landing
  components/   GraphCanvas, Knapsack/Huffman views
scripts/
  fetch-osm.mjs OpenStreetMap → contracted routing graph
```

Algorithms are deliberately decoupled from the UI: each returns a serialisable
result/step-trace, so the rendering layer never needs to know *how* a result
was produced — only how to draw a frame.

## Syllabus mapping (DAA)

- **Brute Force** — Selection/Bubble sort (Benchmark Lab)
- **Divide & Conquer** — Merge/Quick sort (Benchmark Lab)
- **Decrease & Conquer** — BFS
- **Greedy** — Dijkstra, A\*, Huffman, Greedy TSP, Fractional/0-1 Knapsack
- **Dynamic Programming** — 0/1 Knapsack
- **Backtracking / Branch & Bound** — TSP (approximated greedily on real roads)

---

Built by **Abijith** · RV College of Engineering.
