// ── Core graph model ────────────────────────────────────────────────
// A city is a node; a road is a weighted, undirected edge.

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Animation trace ─────────────────────────────────────────────────
// Every algorithm emits an ordered list of AlgoStep frames. The player
// renders one frame at a time, so the viewer literally watches the
// algorithm think.

export interface AlgoStep {
  /** Nodes fully processed/settled so far. */
  visited: string[]
  /** Nodes discovered but not yet settled (the queue / priority frontier). */
  frontier: string[]
  /** The node being processed this frame. */
  current: string | null
  /** Best-known path so far, as node ids. */
  pathNodes: string[]
  /** Best-known path so far, as edge ids (for glowing roads). */
  pathEdges: string[]
  /** Per-node distance/cost labels to overlay. */
  labels: Record<string, number>
  /** Plain-English description of what just happened. */
  note: string
  /** Cumulative primitive operations performed up to this frame. */
  ops: number
}

export interface AlgoResult {
  steps: AlgoStep[]
  finalPathNodes: string[]
  finalPathEdges: string[]
  totalCost: number
  /** Big-O label shown in the complexity panel. */
  complexity: string
  /** Total primitive operations the algorithm performed. */
  opsTotal: number
  /** Set when no valid result exists (e.g. unreachable target). */
  failure?: string
}

// ── Adjacency helpers ───────────────────────────────────────────────

export interface Adj {
  [nodeId: string]: { to: string; weight: number; edgeId: string }[]
}

/** Build an undirected adjacency list from the graph. */
export function buildAdjacency(graph: Graph): Adj {
  const adj: Adj = {}
  for (const n of graph.nodes) adj[n.id] = []
  for (const e of graph.edges) {
    adj[e.source]?.push({ to: e.target, weight: e.weight, edgeId: e.id })
    adj[e.target]?.push({ to: e.source, weight: e.weight, edgeId: e.id })
  }
  return adj
}

/** Find the edge id joining two nodes, if any. */
export function edgeBetween(graph: Graph, a: string, b: string): string | null {
  const e = graph.edges.find(
    (e) =>
      (e.source === a && e.target === b) || (e.source === b && e.target === a),
  )
  return e ? e.id : null
}
