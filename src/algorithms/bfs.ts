import {
  buildAdjacency,
  type AlgoResult,
  type AlgoStep,
  type Graph,
} from './types'

// Breadth-First Search — explores the graph in waves, so it finds the
// path with the FEWEST edges (ignoring weight). Syllabus: Unit II
// (Decrease and Conquer). Great contrast against Dijkstra: BFS counts
// hops, Dijkstra counts distance.

export function bfs(
  graph: Graph,
  startId: string,
  targetId: string,
): AlgoResult {
  const adj = buildAdjacency(graph)
  const visited = new Set<string>([startId])
  const prev: Record<string, string | null> = { [startId]: null }
  const prevEdge: Record<string, string | null> = {}
  const depth: Record<string, number> = { [startId]: 0 }
  const queue: string[] = [startId]
  const steps: AlgoStep[] = []
  let ops = 0

  steps.push({
    visited: [],
    frontier: [startId],
    current: null,
    pathNodes: [],
    pathEdges: [],
    labels: { [startId]: 0 },
    note: `Enqueue start ${label(graph, startId)} at depth 0.`,
    ops,
  })

  while (queue.length > 0) {
    const u = queue.shift() as string
    ops++

    steps.push({
      visited: [...visited],
      frontier: [...queue],
      current: u,
      pathNodes: tracePath(prev, u),
      pathEdges: traceEdges(prevEdge, prev, u),
      labels: { ...depth },
      note: `Dequeue ${label(graph, u)} (depth ${depth[u]}). Visit its neighbours.`,
      ops,
    })

    if (u === targetId) break

    for (const { to, edgeId } of adj[u]) {
      ops++
      if (visited.has(to)) continue
      visited.add(to)
      prev[to] = u
      prevEdge[to] = edgeId
      depth[to] = depth[u] + 1
      queue.push(to)
      steps.push({
        visited: [...visited],
        frontier: [...queue],
        current: u,
        pathNodes: tracePath(prev, to),
        pathEdges: traceEdges(prevEdge, prev, to),
        labels: { ...depth },
        note: `Discover ${label(graph, to)} at depth ${depth[to]}; enqueue it.`,
        ops,
      })
    }
  }

  const reached = visited.has(targetId) && targetId in prev
  const finalPathNodes = reached ? tracePath(prev, targetId) : []
  const finalPathEdges = reached ? traceEdges(prevEdge, prev, targetId) : []

  steps.push({
    visited: [...visited],
    frontier: [],
    current: null,
    pathNodes: finalPathNodes,
    pathEdges: finalPathEdges,
    labels: { ...depth },
    note: reached
      ? `Done. Fewest-hops path to ${label(graph, targetId)} uses ${finalPathNodes.length - 1} edge(s).`
      : `${label(graph, targetId)} is unreachable from ${label(graph, startId)}.`,
    ops,
  })

  return {
    steps,
    finalPathNodes,
    finalPathEdges,
    totalCost: reached ? finalPathNodes.length - 1 : Infinity,
    complexity: 'O(V + E)',
    opsTotal: ops,
    failure: reached ? undefined : 'Target unreachable',
  }
}

function tracePath(prev: Record<string, string | null>, end: string): string[] {
  const path: string[] = []
  let at: string | null = end
  while (at !== undefined && at !== null) {
    path.unshift(at)
    at = prev[at] ?? null
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
    at = prev[at] ?? null
  }
  return edges
}

function label(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.label ?? id
}
