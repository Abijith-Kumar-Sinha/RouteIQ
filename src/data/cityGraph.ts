import type { Graph } from '../algorithms/types'

// The road graph now lives in public/cityRoads.json and is fetched on demand
// (it's several MB). Edges carry `geom`: a flat [lat,lon,lat,lon,…] polyline
// so the original road curves still draw even though routing only happens
// between intersections (degree-2 chains were contracted away at bake time).

interface RawCity {
  city: string
  center: { lat: number; lon: number }
  bbox: { south: number; west: number; north: number; east: number }
  nodes: { id: string; lat: number; lon: number }[]
  edges: { id: string; source: string; target: string; weight: number; geom: number[] }[]
}

export interface CityData {
  graph: Graph
  latlon: Record<string, [number, number]>
  geom: Record<string, number[]>
  center: [number, number]
  bounds: [[number, number], [number, number]]
  nearestNode: (lat: number, lon: number) => string
  nodeCount: number
  edgeCount: number
}

const DEG = Math.PI / 180

export interface Coverage {
  id: string
  label: string
  file: string
  note: string
}

// Default is the lean 12 km core. The bigger ones are opt-in for power users
// (they download more data). Files live in public/ and are baked by the
// fetch-osm script.
export const COVERAGES: Coverage[] = [
  { id: 'core', label: 'Core', file: '/cityRoads.json', note: '12 km · ~40k nodes' },
  { id: 'orr', label: 'Within ORR', file: '/cityRoads-orr.json', note: '18 km · heavier' },
  { id: 'bbmp', label: 'Greater', file: '/cityRoads-bbmp.json', note: 'city-wide arterials' },
]

const cache: Record<string, Promise<CityData>> = {}

export function loadCity(file = '/cityRoads.json'): Promise<CityData> {
  if (!cache[file]) {
    cache[file] = fetch(file)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${file}`)
        return r.json()
      })
      .then(build)
  }
  return cache[file]
}

function build(city: RawCity): CityData {
  const mPerLat = 111320
  const mPerLon = 111320 * Math.cos(city.center.lat * DEG)

  const graph: Graph = {
    nodes: city.nodes.map((n) => ({
      id: n.id,
      label: n.id,
      x: (n.lon - city.center.lon) * mPerLon,
      y: -(n.lat - city.center.lat) * mPerLat,
    })),
    edges: city.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      weight: e.weight,
    })),
  }

  const latlon: Record<string, [number, number]> = {}
  for (const n of city.nodes) latlon[n.id] = [n.lat, n.lon]

  const geom: Record<string, number[]> = {}
  for (const e of city.edges) geom[e.id] = e.geom

  // Nearest intersection to a click — linear scan is fine at this scale.
  const nodes = city.nodes
  function nearestNode(lat: number, lon: number): string {
    let best = nodes[0].id
    let bd = Infinity
    for (const n of nodes) {
      const d = (n.lat - lat) ** 2 + (n.lon - lon) ** 2
      if (d < bd) {
        bd = d
        best = n.id
      }
    }
    return best
  }

  const b = city.bbox
  return {
    graph,
    latlon,
    geom,
    center: [city.center.lat, city.center.lon],
    bounds: [
      [b.south, b.west],
      [b.north, b.east],
    ],
    nearestNode,
    nodeCount: city.nodes.length,
    edgeCount: city.edges.length,
  }
}
