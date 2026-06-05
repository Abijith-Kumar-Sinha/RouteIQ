import { useEffect, useMemo, useRef, useState } from 'react'
import { dijkstra } from '../algorithms/dijkstra'
import { bfs } from '../algorithms/bfs'
import { astar } from '../algorithms/astar'
import type { AlgoResult, AlgoStep } from '../algorithms/types'
import {
  makeGrid,
  gridToGraph,
  randomWalls,
  mazeWalls,
  cellId,
  parseCell,
  type Grid,
} from '../race/grid'

type Racer = { id: 'astar' | 'dijkstra' | 'bfs'; name: string; tag: string }
const RACERS: Racer[] = [
  { id: 'astar', name: 'A*', tag: 'Greedy + heuristic' },
  { id: 'dijkstra', name: 'Dijkstra', tag: 'Uniform-cost' },
  { id: 'bfs', name: 'BFS', tag: 'Breadth-first' },
]

type EditMode = 'wall' | 'erase' | 'start' | 'end'

export default function RaceView() {
  const [grid, setGrid] = useState<Grid>(() => makeGrid())
  const [mode, setMode] = useState<EditMode>('wall')
  const [results, setResults] = useState<Record<string, AlgoResult> | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)

  const graph = useMemo(() => gridToGraph(grid), [grid])

  const maxLen = results
    ? Math.max(...Object.values(results).map((r) => r.steps.length))
    : 0
  const atEnd = results ? step >= maxLen - 1 : false

  useEffect(() => {
    if (!playing || !results) return
    if (step >= maxLen - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStep((s) => Math.min(maxLen - 1, s + speed)), 40)
    return () => clearTimeout(t)
  }, [playing, step, results, speed, maxLen])

  function resetRun() {
    setResults(null)
    setStep(0)
    setPlaying(false)
  }

  function run() {
    const r: Record<string, AlgoResult> = {
      astar: astar(graph, grid.start, grid.end, { heuristicScale: 1 }),
      dijkstra: dijkstra(graph, grid.start, grid.end),
      bfs: bfs(graph, grid.start, grid.end),
    }
    setResults(r)
    setStep(0)
    setPlaying(true)
  }

  function paint(r: number, c: number) {
    const id = cellId(r, c)
    setGrid((g) => {
      if (mode === 'start') {
        if (g.walls.has(id) || id === g.end) return g
        return { ...g, start: id }
      }
      if (mode === 'end') {
        if (g.walls.has(id) || id === g.start) return g
        return { ...g, end: id }
      }
      if (id === g.start || id === g.end) return g
      const walls = new Set(g.walls)
      if (mode === 'wall') walls.add(id)
      else walls.delete(id)
      return { ...g, walls }
    })
    resetRun()
  }

  function setWalls(walls: Set<string>) {
    setGrid((g) => ({ ...g, walls }))
    resetRun()
  }

  // Winner = reached the goal exploring the fewest cells.
  const winner = useMemo(() => {
    if (!results || !atEnd) return null
    let best: string | null = null
    let bestExplored = Infinity
    for (const racer of RACERS) {
      const res = results[racer.id]
      if (res.failure) continue
      const explored = res.steps[res.steps.length - 1].visited.length
      if (explored < bestExplored) {
        bestExplored = explored
        best = racer.id
      }
    }
    return best
  }, [results, atEnd])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2440] bg-panel px-5 py-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              ['wall', 'Wall'],
              ['erase', 'Erase'],
              ['start', 'Start'],
              ['end', 'End'],
            ] as [EditMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                mode === m
                  ? 'border-[var(--color-accent-2)] bg-[#1e2547] text-ink'
                  : 'border-[#2b3756] text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-[#2b3756]" />
          <button
            onClick={() => setWalls(mazeWalls(grid))}
            className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            Maze
          </button>
          <button
            onClick={() => setWalls(randomWalls(grid))}
            className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            Random
          </button>
          <button
            onClick={() => setWalls(new Set())}
            className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            Clear
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            Speed
            <input
              type="range"
              min={1}
              max={12}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-28 accent-[var(--color-accent)]"
            />
          </label>
          <button
            onClick={() => (results && !atEnd ? setPlaying((p) => !p) : run())}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-1.5 text-sm font-semibold text-bg transition hover:brightness-110"
          >
            {playing ? '⏸ Pause' : atEnd || !results ? '🏁 Race' : '▶ Resume'}
          </button>
          <button
            onClick={resetRun}
            className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Arena */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-4 lg:grid-cols-3">
        {RACERS.map((racer) => {
          const res = results?.[racer.id] ?? null
          const frame = res ? res.steps[Math.min(step, res.steps.length - 1)] : null
          const done = res ? step >= res.steps.length - 1 : false
          return (
            <RacePanel
              key={racer.id}
              racer={racer}
              grid={grid}
              frame={frame}
              result={res}
              done={done}
              isWinner={winner === racer.id}
              onPaint={paint}
            />
          )
        })}
      </div>

      <p className="border-t border-[#1a2440] bg-panel px-5 py-2 text-center text-xs text-muted">
        Draw walls, drop a maze, then race. All three find an equally short path
        on a uniform grid — the contest is <b className="text-ink">how many
        cells each explores to get there</b>. Watch A* barely break a sweat.
      </p>
    </div>
  )
}

function RacePanel({
  racer,
  grid,
  frame,
  result,
  done,
  isWinner,
  onPaint,
}: {
  racer: Racer
  grid: Grid
  frame: AlgoStep | null
  result: AlgoResult | null
  done: boolean
  isWinner: boolean
  onPaint: (r: number, c: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const painting = useRef(false)

  const explored = frame ? frame.visited.length : 0
  const pathLen = result && done && !result.failure ? result.finalPathNodes.length - 1 : null

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const cell = Math.min(rect.width / grid.cols, rect.height / grid.rows)
    const w = cell * grid.cols
    const h = cell * grid.rows
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const fill = (id: string, color: string, inset = 0) => {
      const { r, c } = parseCell(id)
      ctx.fillStyle = color
      ctx.fillRect(c * cell + inset, r * cell + inset, cell - inset * 2, cell - inset * 2)
    }

    // Grid background.
    ctx.fillStyle = '#0c1424'
    ctx.fillRect(0, 0, w, h)

    if (frame) {
      ctx.fillStyle = 'rgba(245,158,11,0.45)'
      for (const id of frame.visited) {
        const { r, c } = parseCell(id)
        ctx.fillRect(c * cell, r * cell, cell, cell)
      }
      ctx.fillStyle = 'rgba(167,139,250,0.8)'
      for (const id of frame.frontier) {
        const { r, c } = parseCell(id)
        ctx.fillRect(c * cell, r * cell, cell, cell)
      }
      // Best path so far / final.
      for (const id of frame.pathNodes) fill(id, '#22d3ee', cell * 0.18)
    }

    // Walls.
    ctx.fillStyle = '#243049'
    for (const id of grid.walls) {
      const { r, c } = parseCell(id)
      ctx.fillRect(c * cell, r * cell, cell, cell)
    }

    // Grid lines (subtle).
    ctx.strokeStyle = '#121a2e'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let c = 0; c <= grid.cols; c++) {
      ctx.moveTo(c * cell, 0)
      ctx.lineTo(c * cell, h)
    }
    for (let r = 0; r <= grid.rows; r++) {
      ctx.moveTo(0, r * cell)
      ctx.lineTo(w, r * cell)
    }
    ctx.stroke()

    fill(grid.start, '#34d399')
    fill(grid.end, '#f87171')

    if (frame?.current) {
      const { r, c } = parseCell(frame.current)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.strokeRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2)
    }

    // Editing.
    function cellAt(ev: PointerEvent) {
      const b = canvas.getBoundingClientRect()
      const c = Math.floor((ev.clientX - b.left) / cell)
      const r = Math.floor((ev.clientY - b.top) / cell)
      if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) return null
      return { r, c }
    }
    const down = (ev: PointerEvent) => {
      painting.current = true
      const p = cellAt(ev)
      if (p) onPaint(p.r, p.c)
    }
    const move = (ev: PointerEvent) => {
      if (!painting.current) return
      const p = cellAt(ev)
      if (p) onPaint(p.r, p.c)
    }
    const up = () => {
      painting.current = false
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [grid, frame, onPaint])

  return (
    <div
      className={`flex min-h-0 flex-col rounded-2xl border bg-panel p-3 transition ${
        isWinner ? 'border-[var(--color-success)]' : 'border-[#1e293f]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-ink">{racer.name}</span>
          <span className="ml-2 text-xs text-muted">{racer.tag}</span>
        </div>
        {isWinner && (
          <span className="rounded-full bg-[#0c2a20] px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
            🏆 fewest explored
          </span>
        )}
      </div>
      <div className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg bg-[#0c1424]">
        <canvas ref={ref} className="h-full w-full touch-none" />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs">
        <span className="text-[var(--color-visited)]">
          explored {explored.toLocaleString()}
        </span>
        <span className="text-accent">
          {result?.failure
            ? 'no path'
            : pathLen !== null
              ? `path ${pathLen}`
              : '—'}
        </span>
      </div>
    </div>
  )
}
