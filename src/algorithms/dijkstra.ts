import {
  buildAdjacency,
  type AlgoResult,
  type AlgoStep,
  type Graph,
} from './types'

// Dijkstra's algorithm — single-source shortest path on a non-negative
// weighted graph. Syllabus: Unit IV (Greedy Technique).
//
// We use a "settled set + distance table" formulation and pick the
// minimum-distance unsettled node each round. Every meaningful action
// pushes a frame onto `steps` so the UI can animate the search.

export function dijkstra(
  graph: Graph,
  startId: string,
  targetId: string,
): AlgoResult {
  const adj = buildAdjacency(graph)
  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const prevEdge: Record<string, string | null> = {}
  const settled = new Set<string>()
  const steps: AlgoStep[] = []
  let ops = 0

  for (const n of graph.nodes) {
    dist[n.id] = Infinity
    prev[n.id] = null
    prevEdge[n.id] = null
  }
  dist[startId] = 0

  const labelSnapshot = () => {
    const out: Record<string, number> = {}
    for (const k in dist) if (dist[k] < Infinity) out[k] = dist[k]
    return out
  }

  steps.push({
    visited: [],
    frontier: [startId],
    current: null,
    pathNodes: [],
    pathEdges: [],
    labels: labelSnapshot(),
    note: `Initialise: distance to ${label(graph, startId)} = 0, all others = ∞.`,
    ops,
  })

  while (settled.size < graph.nodes.length) {
    // Greedily pick the unsettled node with the smallest tentative distance.
    let u: string | null = null
    let best = Infinity
    for (const n of graph.nodes) {
      ops++
      if (!settled.has(n.id) && dist[n.id] < best) {
        best = dist[n.id]
        u = n.id
      }
    }
    if (u === null || best === Infinity) break // remaining nodes unreachable
    settled.add(u)

    steps.push({
      visited: [...settled],
      frontier: frontierOf(dist, settled),
      current: u,
      pathNodes: tracePath(prev, u),
      pathEdges: traceEdges(prevEdge, prev, u),
      labels: labelSnapshot(),
      note: `Settle ${label(graph, u)} (smallest tentative distance = ${dist[u]}).`,
      ops,
    })

    if (u === targetId) break // early exit once the target is settled

    // Relax every outgoing edge.
    for (const { to, weight, edgeId } of adj[u]) {
      ops++
      if (settled.has(to)) continue
      const cand = dist[u] + weight
      if (cand < dist[to]) {
        dist[to] = cand
        prev[to] = u
        prevEdge[to] = edgeId
        steps.push({
          visited: [...settled],
          frontier: frontierOf(dist, settled),
          current: u,
          pathNodes: tracePath(prev, to),
          pathEdges: traceEdges(prevEdge, prev, to),
          labels: labelSnapshot(),
          note: `Relax ${label(graph, u)}→${label(graph, to)}: improved distance to ${cand}.`,
          ops,
        })
      }
    }
  }

  const reached = dist[targetId] < Infinity
  const finalPathNodes = reached ? tracePath(prev, targetId) : []
  const finalPathEdges = reached ? traceEdges(prevEdge, prev, targetId) : []

  steps.push({
    visited: [...settled],
    frontier: [],
    current: null,
    pathNodes: finalPathNodes,
    pathEdges: finalPathEdges,
    labels: labelSnapshot(),
    note: reached
      ? `Done. Shortest path to ${label(graph, targetId)} costs ${dist[targetId]}.`
      : `${label(graph, targetId)} is unreachable from ${label(graph, startId)}.`,
    ops,
  })

  return {
    steps,
    finalPathNodes,
    finalPathEdges,
    totalCost: reached ? dist[targetId] : Infinity,
    complexity: 'O(V²) — array-select; O((V+E)·log V) with a heap',
    opsTotal: ops,
    failure: reached ? undefined : 'Target unreachable',
  }
}

function frontierOf(
  dist: Record<string, number>,
  settled: Set<string>,
): string[] {
  return Object.keys(dist).filter(
    (k) => !settled.has(k) && dist[k] < Infinity,
  )
}

function tracePath(prev: Record<string, string | null>, end: string): string[] {
  const path: string[] = []
  let at: string | null = end
  while (at) {
    path.unshift(at)
    at = prev[at]
  }
  return path
}

function traceEdges(
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
