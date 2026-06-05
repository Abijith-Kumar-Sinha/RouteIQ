import {
  buildAdjacency,
  type AlgoResult,
  type AlgoStep,
  type Graph,
} from './types'

// Greedy nearest-neighbour TSP — plan a delivery tour that starts at the
// depot, visits every selected stop once, and returns home. At each step
// it greedily hops to the nearest unvisited stop. Syllabus: Greedy
// Technique (Unit IV) as an approximation to TSP (Unit V, Branch & Bound).
//
// "Distance" between two stops is their true shortest path through the
// road network, so we run a small Dijkstra between each pair first. The
// animated tour then glows along real roads, not straight lines.

interface PairPath {
  dist: number
  nodes: string[]
  edges: string[]
}

export function greedyTSP(
  graph: Graph,
  depotId: string,
  stopIds: string[],
): AlgoResult {
  const adj = buildAdjacency(graph)
  const steps: AlgoStep[] = []
  let ops = 0

  const points = [depotId, ...stopIds.filter((s) => s !== depotId)]

  // Precompute shortest paths between every ordered pair of points.
  const pair: Record<string, Record<string, PairPath>> = {}
  for (const a of points) {
    pair[a] = {}
    const { dist, prev, prevEdge } = shortestFrom(graph, adj, a)
    for (const b of points) {
      if (a === b) continue
      ops += 1
      pair[a][b] = {
        dist: dist[b] ?? Infinity,
        nodes: rebuild(prev, b),
        edges: rebuildEdges(prevEdge, prev, b),
      }
    }
  }

  const visited = new Set<string>([depotId])
  const tour = [depotId]
  let current = depotId
  let totalCost = 0
  const tourEdges: string[] = []

  steps.push({
    visited: [depotId],
    frontier: stopIds,
    current: depotId,
    pathNodes: [depotId],
    pathEdges: [],
    labels: {},
    note: `Start tour at depot ${label(graph, depotId)}. Stops to visit: ${stopIds
      .map((s) => label(graph, s))
      .join(', ')}.`,
    ops,
  })

  while (visited.size < points.length) {
    // Greedily choose the nearest unvisited stop.
    let nearest: string | null = null
    let best = Infinity
    for (const p of points) {
      ops++
      if (visited.has(p)) continue
      const d = pair[current][p]?.dist ?? Infinity
      if (d < best) {
        best = d
        nearest = p
      }
    }
    if (nearest === null || best === Infinity) {
      steps.push({
        visited: [...visited],
        frontier: points.filter((p) => !visited.has(p)),
        current,
        pathNodes: tour,
        pathEdges: [...tourEdges],
        labels: {},
        note: `Remaining stops are unreachable — tour cannot be completed.`,
        ops,
      })
      return {
        steps,
        finalPathNodes: tour,
        finalPathEdges: tourEdges,
        totalCost: Infinity,
        complexity: 'O(n²·(V+E)) — n stops, Dijkstra per pair',
        opsTotal: ops,
        failure: 'Some stops unreachable',
      }
    }

    const leg = pair[current][nearest]
    visited.add(nearest)
    tour.push(nearest)
    tourEdges.push(...leg.edges)
    totalCost += leg.dist
    current = nearest

    steps.push({
      visited: [...visited],
      frontier: points.filter((p) => !visited.has(p)),
      current: nearest,
      pathNodes: [...tour],
      pathEdges: [...tourEdges],
      labels: {},
      note: `Nearest unvisited stop is ${label(graph, nearest)} (cost ${leg.dist}). Travel there. Tour cost so far: ${totalCost}.`,
      ops,
    })
  }

  // Return to the depot to close the loop.
  const back = pair[current][depotId]
  if (back && back.dist < Infinity) {
    tour.push(depotId)
    tourEdges.push(...back.edges)
    totalCost += back.dist
  }

  steps.push({
    visited: [...visited],
    frontier: [],
    current: depotId,
    pathNodes: [...tour],
    pathEdges: [...tourEdges],
    labels: {},
    note: `Return to depot. Complete tour cost: ${totalCost}.`,
    ops,
  })

  return {
    steps,
    finalPathNodes: tour,
    finalPathEdges: tourEdges,
    totalCost,
    complexity: 'O(n²·(V+E)) — n stops, Dijkstra per pair',
    opsTotal: ops,
  }
}

// Plain Dijkstra used internally for pairwise distances (no trace).
function shortestFrom(
  graph: Graph,
  adj: ReturnType<typeof buildAdjacency>,
  src: string,
) {
  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const prevEdge: Record<string, string | null> = {}
  const settled = new Set<string>()
  for (const n of graph.nodes) {
    dist[n.id] = Infinity
    prev[n.id] = null
    prevEdge[n.id] = null
  }
  dist[src] = 0
  while (settled.size < graph.nodes.length) {
    let u: string | null = null
    let best = Infinity
    for (const n of graph.nodes) {
      if (!settled.has(n.id) && dist[n.id] < best) {
        best = dist[n.id]
        u = n.id
      }
    }
    if (u === null || best === Infinity) break
    settled.add(u)
    for (const { to, weight, edgeId } of adj[u]) {
      if (settled.has(to)) continue
      const cand = dist[u] + weight
      if (cand < dist[to]) {
        dist[to] = cand
        prev[to] = u
        prevEdge[to] = edgeId
      }
    }
  }
  return { dist, prev, prevEdge }
}

function rebuild(prev: Record<string, string | null>, end: string): string[] {
  const path: string[] = []
  let at: string | null = end
  while (at) {
    path.unshift(at)
    at = prev[at]
  }
  return path
}

function rebuildEdges(
  prevEdge: Record<string, string | null>,
  prev: Record<string, string | null>,
  end: string,
): string[] {
  const edges: string[] = []
  let at: string | null = end
  while (at && prevEdge[at]) {
    edges.unshift(prevEdge[at] as string)
    at = prev[at]
  }
  return edges
}

function label(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.label ?? id
}
