import {
  buildAdjacency,
  type AlgoResult,
  type AlgoStep,
  type Graph,
} from './types'

// A* search — Dijkstra guided by a heuristic that estimates remaining
// distance to the goal, so it explores far fewer nodes. Not in the core
// syllabus, but it's the natural "smarter Dijkstra" and makes the Race
// Arena dramatic. f(n) = g(n) + h(n).
//
// `heuristicScale` converts coordinate distance into the same units as the
// edge weights (1 for the geographic graph where both are metres; 1/scale
// for the studio graph where weight = pixels / scale). Keeping h admissible
// (never an overestimate) guarantees the shortest path.

export function astar(
  graph: Graph,
  startId: string,
  targetId: string,
  opts: { heuristicScale?: number } = {},
): AlgoResult {
  const scale = opts.heuristicScale ?? 1
  const adj = buildAdjacency(graph)
  const pos = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const target = pos[targetId]

  const h = (id: string) => {
    const n = pos[id]
    if (!n || !target) return 0
    return Math.hypot(n.x - target.x, n.y - target.y) * scale
  }

  const g: Record<string, number> = {}
  const f: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const prevEdge: Record<string, string | null> = {}
  const closed = new Set<string>()
  const open = new Set<string>([startId])
  const steps: AlgoStep[] = []
  let ops = 0

  for (const n of graph.nodes) {
    g[n.id] = Infinity
    f[n.id] = Infinity
    prev[n.id] = null
    prevEdge[n.id] = null
  }
  g[startId] = 0
  f[startId] = h(startId)

  const labelSnapshot = () => {
    const out: Record<string, number> = {}
    for (const k in g) if (g[k] < Infinity) out[k] = Math.round(g[k])
    return out
  }

  steps.push({
    visited: [],
    frontier: [startId],
    current: null,
    pathNodes: [],
    pathEdges: [],
    labels: labelSnapshot(),
    note: `Initialise: g(${label(graph, startId)})=0, f=g+h estimates total cost via the heuristic.`,
    ops,
  })

  while (open.size > 0) {
    // Pick the open node with the lowest f = g + h.
    let u: string | null = null
    let best = Infinity
    for (const id of open) {
      ops++
      if (f[id] < best) {
        best = f[id]
        u = id
      }
    }
    if (u === null) break
    open.delete(u)
    closed.add(u)

    steps.push({
      visited: [...closed],
      frontier: [...open],
      current: u,
      pathNodes: tracePath(prev, u),
      pathEdges: traceEdges(prevEdge, prev, u),
      labels: labelSnapshot(),
      note: `Expand ${label(graph, u)} (lowest f=${Math.round(f[u])}). Guided toward the goal.`,
      ops,
    })

    if (u === targetId) break

    for (const { to, weight, edgeId } of adj[u]) {
      ops++
      if (closed.has(to)) continue
      const tentative = g[u] + weight
      if (tentative < g[to]) {
        prev[to] = u
        prevEdge[to] = edgeId
        g[to] = tentative
        f[to] = tentative + h(to)
        open.add(to)
        steps.push({
          visited: [...closed],
          frontier: [...open],
          current: u,
          pathNodes: tracePath(prev, to),
          pathEdges: traceEdges(prevEdge, prev, to),
          labels: labelSnapshot(),
          note: `Relax ${label(graph, u)}→${label(graph, to)}: g=${Math.round(tentative)}, f=${Math.round(f[to])}.`,
          ops,
        })
      }
    }
  }

  const reached = g[targetId] < Infinity
  const finalPathNodes = reached ? tracePath(prev, targetId) : []
  const finalPathEdges = reached ? traceEdges(prevEdge, prev, targetId) : []

  steps.push({
    visited: [...closed],
    frontier: [],
    current: null,
    pathNodes: finalPathNodes,
    pathEdges: finalPathEdges,
    labels: labelSnapshot(),
    note: reached
      ? `Done. A* reached ${label(graph, targetId)} with cost ${Math.round(g[targetId])}, exploring ${closed.size} nodes.`
      : `${label(graph, targetId)} is unreachable.`,
    ops,
  })

  return {
    steps,
    finalPathNodes,
    finalPathEdges,
    totalCost: reached ? Math.round(g[targetId]) : Infinity,
    complexity: 'O(E) with a good heuristic; O((V+E)·log V) worst case',
    opsTotal: ops,
    failure: reached ? undefined : 'Target unreachable',
  }
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
