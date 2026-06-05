import { buildAdjacency, type Graph } from './types'

// A compact router for the large city graph (tens of thousands of nodes).
// Records the *order* nodes settle in (O(V) memory) so the animation can
// reveal "all nodes with order < step" without snapshotting per frame.
//
// Supports three search strategies on the same machinery:
//   dijkstra — priority = distance so far (g)               → shortest path
//   astar    — priority = g + straight-line estimate (h)    → guided, fewer nodes
//   bfs      — priority = hop count                          → fewest road segments

export type RouteAlgo = 'dijkstra' | 'astar' | 'bfs'

export interface MapRoute {
  order: Record<string, number>
  orderIds: string[]
  settledCount: number
  pathNodes: string[]
  pathEdges: string[]
  pathOrder: number
  totalCost: number // metres
  opsAt: number[]
  opsTotal: number
  reached: boolean
  complexity: string
}

class MinHeap {
  private a: { id: string; key: number }[] = []
  get size() {
    return this.a.length
  }
  push(id: string, key: number) {
    const a = this.a
    a.push({ id, key })
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].key <= a[i].key) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop(): { id: string; key: number } {
    const a = this.a
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      const n = a.length
      for (;;) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let s = i
        if (l < n && a[l].key < a[s].key) s = l
        if (r < n && a[r].key < a[s].key) s = r
        if (s === i) break
        ;[a[s], a[i]] = [a[i], a[s]]
        i = s
      }
    }
    return top
  }
}

const COMPLEXITY: Record<RouteAlgo, string> = {
  astar: 'A* · O((V+E) log V), far fewer nodes with the heuristic',
  dijkstra: 'Dijkstra · O((V+E) log V) with a binary heap',
  bfs: 'BFS · O(V+E), fewest road segments (ignores distance)',
}

export function mapRoute(
  graph: Graph,
  srcId: string,
  dstId: string,
  algo: RouteAlgo,
): MapRoute {
  const adj = buildAdjacency(graph)
  const pos = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const target = pos[dstId]
  const h =
    algo === 'astar' && target
      ? (id: string) => {
          const n = pos[id]
          return Math.hypot(n.x - target.x, n.y - target.y)
        }
      : () => 0

  const useHops = algo === 'bfs'
  const dist: Record<string, number> = {} // metres along the chosen path
  const hops: Record<string, number> = {} // edge count (BFS priority)
  const order: Record<string, number> = {}
  const orderIds: string[] = []
  const parent: Record<string, string> = {}
  const parentEdge: Record<string, string> = {}
  const settled = new Set<string>()
  for (const n of graph.nodes) {
    dist[n.id] = Infinity
    hops[n.id] = Infinity
  }
  dist[srcId] = 0
  hops[srcId] = 0

  const heap = new MinHeap()
  heap.push(srcId, useHops ? 0 : h(srcId))
  let ops = 0
  const opsAt: number[] = []
  let idx = 0
  let pathOrder = -1

  while (heap.size) {
    const { id: u } = heap.pop()
    if (settled.has(u)) continue
    settled.add(u)
    order[u] = idx
    orderIds.push(u)
    ops++
    opsAt.push(ops)
    idx++
    if (u === dstId) {
      pathOrder = order[u]
      break
    }
    for (const { to, weight, edgeId } of adj[u]) {
      ops++
      if (settled.has(to)) continue
      const candDist = dist[u] + weight
      const candHops = hops[u] + 1
      const improved = useHops ? candHops < hops[to] : candDist < dist[to]
      if (improved) {
        dist[to] = candDist
        hops[to] = candHops
        parent[to] = u
        parentEdge[to] = edgeId
        heap.push(to, useHops ? candHops : candDist + h(to))
      }
    }
  }

  const reached = settled.has(dstId)
  const pathNodes: string[] = []
  const pathEdges: string[] = []
  if (reached) {
    let at: string | undefined = dstId
    while (at) {
      pathNodes.unshift(at)
      if (parentEdge[at]) pathEdges.unshift(parentEdge[at])
      at = parent[at]
    }
  }

  return {
    order,
    orderIds,
    settledCount: idx,
    pathNodes,
    pathEdges,
    pathOrder: reached ? pathOrder : idx,
    totalCost: reached ? Math.round(dist[dstId]) : Infinity,
    opsAt,
    opsTotal: ops,
    reached,
    complexity: COMPLEXITY[algo],
  }
}
