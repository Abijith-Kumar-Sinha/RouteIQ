import type { Graph } from '../algorithms/types'

// A simple 4-connected grid the Race Arena animates on. Each open cell is a
// node; neighbours are joined by unit-weight edges. Walls are blocked cells.
// Uniform weights make the point land hard: BFS and Dijkstra explore in big
// rings, while A* drives a tight beam at the goal.

export interface Grid {
  cols: number
  rows: number
  walls: Set<string> // "r,c"
  start: string // "r,c"
  end: string
}

export const cellId = (r: number, c: number) => `${r},${c}`
export const parseCell = (id: string) => {
  const [r, c] = id.split(',').map(Number)
  return { r, c }
}

export function makeGrid(cols = 33, rows = 22): Grid {
  return {
    cols,
    rows,
    walls: new Set(),
    start: cellId(Math.floor(rows / 2), 3),
    end: cellId(Math.floor(rows / 2), cols - 4),
  }
}

/** Build the routing Graph from the grid (skips walls). */
export function gridToGraph(g: Grid): Graph {
  const isWall = (r: number, c: number) => g.walls.has(cellId(r, c))
  const inBounds = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < g.rows && c < g.cols

  const nodes: Graph['nodes'] = []
  const edges: Graph['edges'] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (isWall(r, c)) continue
      nodes.push({ id: cellId(r, c), label: '', x: c, y: r })
      // Only add right/down neighbours to avoid duplicate undirected edges.
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        const nr = r + dr
        const nc = c + dc
        if (inBounds(nr, nc) && !isWall(nr, nc)) {
          edges.push({
            id: `${r},${c}-${nr},${nc}`,
            source: cellId(r, c),
            target: cellId(nr, nc),
            weight: 1,
          })
        }
      }
    }
  }
  return { nodes, edges }
}

/** Scatter random obstacles (keeping start/end clear). */
export function randomWalls(g: Grid, density = 0.28): Set<string> {
  const walls = new Set<string>()
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const id = cellId(r, c)
      if (id === g.start || id === g.end) continue
      if (Math.random() < density) walls.add(id)
    }
  }
  return walls
}

/** Recursive-division maze — carves rooms with a single gap in each wall. */
export function mazeWalls(g: Grid): Set<string> {
  const walls = new Set<string>()
  const add = (r: number, c: number) => {
    const id = cellId(r, c)
    if (id !== g.start && id !== g.end) walls.add(id)
  }
  // Border.
  for (let c = 0; c < g.cols; c++) {
    add(0, c)
    add(g.rows - 1, c)
  }
  for (let r = 0; r < g.rows; r++) {
    add(r, 0)
    add(r, g.cols - 1)
  }

  const rand = (lo: number, hi: number) =>
    lo + Math.floor(Math.random() * (hi - lo + 1))

  function divide(
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    horizontal: boolean,
  ) {
    if (r2 - r1 < 2 || c2 - c1 < 2) return
    if (horizontal) {
      // pick an even row to wall, odd column for the gap
      const wr = rand(r1 + 1, r2 - 1)
      const gap = rand(c1, c2)
      for (let c = c1; c <= c2; c++) if (c !== gap) add(wr, c)
      divide(r1, c1, wr - 1, c2, !horizontal)
      divide(wr + 1, c1, r2, c2, !horizontal)
    } else {
      const wc = rand(c1 + 1, c2 - 1)
      const gap = rand(r1, r2)
      for (let r = r1; r <= r2; r++) if (r !== gap) add(r, wc)
      divide(r1, c1, r2, wc - 1, !horizontal)
      divide(r1, wc + 1, r2, c2, !horizontal)
    }
  }
  divide(1, 1, g.rows - 2, g.cols - 2, g.cols > g.rows)
  return walls
}
