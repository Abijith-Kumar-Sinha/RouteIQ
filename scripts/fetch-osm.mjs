// Bakes a real OpenStreetMap road network into a routing graph.
//   node  -> { id, lat, lon }
//   edge  -> { source, target, weight(metres) }  (undirected)
// Run: node scripts/fetch-osm.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

// Presets — run `node scripts/fetch-osm.mjs <core|orr|bbmp>`.
// Larger boxes use a leaner road filter to keep them downloadable.
const FULL =
  'primary|secondary|tertiary|residential|trunk|unclassified|living_street|primary_link|secondary_link|tertiary_link'
const MAJOR = 'motorway|trunk|primary|secondary|tertiary|primary_link|secondary_link|tertiary_link|trunk_link|motorway_link'

const PRESETS = {
  // ~12 km, all streets — the default lean dataset.
  core: {
    city: 'Bengaluru',
    bbox: { south: 12.918, west: 77.54, north: 13.026, east: 77.648 },
    highways: FULL,
    out: 'public/cityRoads.json',
    meta: 'src/data/cityMeta.json',
  },
  // ~18 km (roughly within the Outer Ring Road), all streets.
  orr: {
    city: 'Bengaluru · Within ORR',
    bbox: { south: 12.891, west: 77.513, north: 13.053, east: 77.675 },
    highways: FULL,
    out: 'public/cityRoads-orr.json',
    meta: null,
  },
  // ~28 km city-wide, arterials only (keeps the size sane).
  bbmp: {
    city: 'Bengaluru · Greater',
    bbox: { south: 12.846, west: 77.468, north: 13.098, east: 77.72 },
    highways: MAJOR,
    out: 'public/cityRoads-bbmp.json',
    meta: null,
  },
}

const presetName = process.argv[2] || 'core'
const preset = PRESETS[presetName]
if (!preset) {
  console.error(`Unknown preset "${presetName}". Use: core | orr | bbmp`)
  process.exit(1)
}
const BBOX = preset.bbox
const CITY = preset.city
const HIGHWAYS = preset.highways
console.log(`Preset: ${presetName} (${CITY})`)

const query = `[out:json][timeout:90];
(way["highway"~"^(${HIGHWAYS})$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}););
(._;>;);
out body;`

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function haversine(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function fetchOverpass() {
  const body = 'data=' + encodeURIComponent(query)
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'RouteIQ/1.0 (DAA educational project; contact: student@example.com)',
    Accept: 'application/json',
  }
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Querying ${url} (attempt ${attempt}) ...`)
        const res = await fetch(url, { method: 'POST', body, headers })
        if (res.status === 429 || res.status === 504) {
          console.warn('  busy (HTTP ' + res.status + '), backing off...')
          await sleep(4000 * attempt)
          continue
        }
        if (!res.ok) {
          console.warn('  HTTP', res.status)
          break
        }
        return await res.json()
      } catch (e) {
        console.warn('  failed:', e.message)
        await sleep(1500)
      }
    }
  }
  throw new Error('All Overpass endpoints failed')
}

const data = await fetchOverpass()

const rawNodes = new Map()
for (const el of data.elements) {
  if (el.type === 'node') rawNodes.set(el.id, { lat: el.lat, lon: el.lon })
}

// Build undirected adjacency from way segments, dedup edges.
const adj = new Map()
const addEdge = (a, b, w) => {
  if (!adj.has(a)) adj.set(a, new Map())
  if (!adj.has(b)) adj.set(b, new Map())
  adj.get(a).set(b, w)
  adj.get(b).set(a, w)
}
for (const el of data.elements) {
  if (el.type !== 'way' || !el.nodes) continue
  for (let i = 0; i + 1 < el.nodes.length; i++) {
    const a = el.nodes[i]
    const b = el.nodes[i + 1]
    const na = rawNodes.get(a)
    const nb = rawNodes.get(b)
    if (!na || !nb) continue
    addEdge(a, b, Math.max(1, Math.round(haversine(na, nb))))
  }
}

console.log(`Raw graph: ${rawNodes.size} nodes before contraction`)

// ── Degree-2 contraction ────────────────────────────────────────────
// Intersections (degree ≠ 2) and dead-ends are "real" routing nodes. We
// collapse the chains of degree-2 shape-points between them into a single
// edge whose weight is the summed road distance and whose `geom` keeps every
// point so the curve still draws correctly. Lossless for shortest paths.
const degree = (id) => adj.get(id).size
const isReal = (id) => degree(id) !== 2
const segKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a)
const usedSeg = new Set()

const cNodes = new Set()
const cEdges = []

function walkFrom(start) {
  for (const [first] of adj.get(start)) {
    if (usedSeg.has(segKey(start, first))) continue
    let prev = start
    let cur = first
    usedSeg.add(segKey(prev, cur))
    let weight = adj.get(start).get(first)
    const chain = [start, first]
    let guard = 0
    while (!isReal(cur) && cur !== start && guard++ < 1_000_000) {
      let nxt = null
      for (const [n] of adj.get(cur)) {
        if (n !== prev) {
          nxt = n
          break
        }
      }
      if (nxt === null || usedSeg.has(segKey(cur, nxt))) break
      usedSeg.add(segKey(cur, nxt))
      weight += adj.get(cur).get(nxt)
      chain.push(nxt)
      prev = cur
      cur = nxt
    }
    cNodes.add(start)
    cNodes.add(cur)
    cEdges.push({ a: start, b: cur, weight: Math.max(1, Math.round(weight)), chain })
  }
}

for (const id of adj.keys()) if (isReal(id)) walkFrom(id)
// Mop up pure degree-2 loops (roundabouts with no real node).
for (const id of adj.keys()) {
  for (const [n] of adj.get(id)) {
    if (!usedSeg.has(segKey(id, n))) {
      walkFrom(id)
      break
    }
  }
}

// Largest connected component on the contracted graph.
const cAdj = new Map()
for (const id of cNodes) cAdj.set(id, [])
cEdges.forEach((e, i) => {
  cAdj.get(e.a).push([e.b, i])
  cAdj.get(e.b).push([e.a, i])
})
const seen = new Set()
let best = []
for (const start of cNodes) {
  if (seen.has(start)) continue
  const comp = []
  const stack = [start]
  seen.add(start)
  while (stack.length) {
    const u = stack.pop()
    comp.push(u)
    for (const [v] of cAdj.get(u))
      if (!seen.has(v)) {
        seen.add(v)
        stack.push(v)
      }
  }
  if (comp.length > best.length) best = comp
}
const keep = new Set(best)

const idMap = new Map()
const nodes = []
for (const id of keep) {
  const n = rawNodes.get(id)
  const short = 'n' + idMap.size
  idMap.set(id, short)
  nodes.push({ id: short, lat: round5(n.lat), lon: round5(n.lon) })
}

const edges = []
for (const e of cEdges) {
  if (!keep.has(e.a) || !keep.has(e.b)) continue
  // Flatten geometry to a rounded lat,lon,... array to shrink the JSON.
  const geom = []
  for (const id of e.chain) {
    const n = rawNodes.get(id)
    geom.push(round5(n.lat), round5(n.lon))
  }
  edges.push({
    id: 'e' + edges.length,
    source: idMap.get(e.a),
    target: idMap.get(e.b),
    weight: e.weight,
    geom,
  })
}

function round5(v) {
  return Math.round(v * 1e5) / 1e5
}

const out = {
  city: CITY,
  bbox: BBOX,
  center: {
    lat: (BBOX.south + BBOX.north) / 2,
    lon: (BBOX.west + BBOX.east) / 2,
  },
  nodes,
  edges,
}

// Heavy graph → public/ so it's fetched on demand (not bundled into JS).
// Tiny meta (core only) → src/data so the landing page can import counts.
mkdirSync('public', { recursive: true })
mkdirSync('src/data', { recursive: true })
writeFileSync(preset.out, JSON.stringify(out))
if (preset.meta) {
  writeFileSync(
    preset.meta,
    JSON.stringify({
      city: out.city,
      center: out.center,
      bbox: out.bbox,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    }),
  )
}
console.log(
  `Baked ${nodes.length} intersections, ${edges.length} edges → ${preset.out}`,
)
