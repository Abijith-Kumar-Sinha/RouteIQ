import { useEffect, useMemo, useRef, useState } from 'react'
import GraphCanvas, { type EditorMode } from '../components/GraphCanvas'
import KnapsackView from '../components/KnapsackView'
import HuffmanView from '../components/HuffmanView'
import { dijkstra } from '../algorithms/dijkstra'
import { bfs } from '../algorithms/bfs'
import { greedyTSP } from '../algorithms/tsp'
import type { AlgoResult, AlgoStep, Graph } from '../algorithms/types'
import { defaultCapacity, defaultGraph, defaultParcels } from '../data/cities'

type Algo = 'dijkstra' | 'bfs' | 'tsp' | 'knapsack' | 'huffman'

const ALGOS: { id: Algo; name: string; blurb: string }[] = [
  { id: 'dijkstra', name: 'Dijkstra', blurb: 'Shortest weighted path' },
  { id: 'bfs', name: 'BFS', blurb: 'Fewest-hops path' },
  { id: 'tsp', name: 'Greedy TSP', blurb: 'Multi-stop delivery tour' },
  { id: 'knapsack', name: '0/1 Knapsack', blurb: 'Load the truck' },
  { id: 'huffman', name: 'Huffman', blurb: 'Compress the manifest' },
]

const GRAPH_ALGOS: Algo[] = ['dijkstra', 'bfs', 'tsp']

export default function StudioView() {
  const [graph, setGraph] = useState<Graph>(() => ({
    ...defaultGraph,
    edges: recalcEdges(defaultGraph.nodes, defaultGraph.edges),
  }))
  const [algo, setAlgo] = useState<Algo>('dijkstra')
  const [mode, setMode] = useState<EditorMode>('move')
  const [startId, setStartId] = useState<string | null>('A')
  const [targetId, setTargetId] = useState<string | null>('J')
  const [stops, setStops] = useState<string[]>(['C', 'E', 'H'])

  const [result, setResult] = useState<AlgoResult | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const idRef = useRef(0)

  const isGraphAlgo = GRAPH_ALGOS.includes(algo)
  const frame: AlgoStep | null = result ? result.steps[stepIndex] ?? null : null

  // Manifest text the Huffman tab compresses — built from the city labels.
  const manifest = useMemo(
    () =>
      'ROUTEIQ MANIFEST ' +
      graph.nodes.map((n) => n.label.toUpperCase()).join(' '),
    [graph.nodes],
  )

  // ── Animation loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || !result) return
    if (stepIndex >= result.steps.length - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 650 / speed)
    return () => clearTimeout(t)
  }, [playing, stepIndex, result, speed])

  function run() {
    let r: AlgoResult
    if (algo === 'dijkstra') r = dijkstra(graph, startId!, targetId!)
    else if (algo === 'bfs') r = bfs(graph, startId!, targetId!)
    else r = greedyTSP(graph, startId!, stops)
    setResult(r)
    setStepIndex(0)
    setPlaying(true)
  }

  function reset() {
    setResult(null)
    setStepIndex(0)
    setPlaying(false)
  }

  // Clear any stale animation when switching algorithm or editing the graph.
  useEffect(() => {
    reset()
  }, [algo, graph])

  // ── Graph editing handlers ────────────────────────────────────────
  function addCity(x: number, y: number) {
    const id = nextId(graph)
    setGraph((g) => ({
      ...g,
      nodes: [...g.nodes, { id, label: `City ${id}`, x, y }],
    }))
  }
  function moveCity(id: string, x: number, y: number) {
    setGraph((g) => {
      const nodes = g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n))
      // Recompute weights of every road so they track the new distance.
      return { ...g, nodes, edges: recalcEdges(nodes, g.edges) }
    })
  }
  function addRoad(a: string, b: string) {
    if (
      graph.edges.some(
        (e) =>
          (e.source === a && e.target === b) ||
          (e.source === b && e.target === a),
      )
    )
      return
    const na = graph.nodes.find((n) => n.id === a)!
    const nb = graph.nodes.find((n) => n.id === b)!
    const w = roadWeight(na.x, na.y, nb.x, nb.y)
    setGraph((g) => ({
      ...g,
      edges: [
        ...g.edges,
        { id: `e${idRef.current++}_${a}${b}`, source: a, target: b, weight: w },
      ],
    }))
  }
  function deleteCity(id: string) {
    setGraph((g) => ({
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.source !== id && e.target !== id),
    }))
    if (startId === id) setStartId(null)
    if (targetId === id) setTargetId(null)
    setStops((s) => s.filter((x) => x !== id))
  }
  function deleteRoad(edgeId: string) {
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edgeId) }))
  }
  function toggleStop(id: string) {
    setStops((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const canRun =
    isGraphAlgo &&
    startId !== null &&
    (algo === 'tsp' ? stops.length > 0 : targetId !== null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-auto border-r border-[#1a2440] bg-panel p-4">
          <div className="grid grid-cols-1 gap-2">
            {ALGOS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAlgo(a.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  algo === a.id
                    ? 'border-[var(--color-accent)] bg-[#0c2236]'
                    : 'border-[#22304f] bg-panel-2 hover:border-[#34507e]'
                }`}
              >
                <div className="font-semibold text-ink">{a.name}</div>
                <div className="text-xs text-muted">{a.blurb}</div>
              </button>
            ))}
          </div>

          {isGraphAlgo ? (
            <GraphControls
              algo={algo}
              mode={mode}
              setMode={setMode}
              startId={startId}
              targetId={targetId}
              stops={stops}
              canRun={canRun}
              playing={playing}
              speed={speed}
              setSpeed={setSpeed}
              onReset={reset}
              onTogglePlay={() => {
                if (!result) run()
                else setPlaying((p) => !p)
              }}
              onStep={(d) =>
                result &&
                setStepIndex((i) =>
                  Math.max(0, Math.min(result.steps.length - 1, i + d)),
                )
              }
              hasResult={!!result}
              stepIndex={stepIndex}
              totalSteps={result?.steps.length ?? 0}
            />
          ) : (
            <div className="rounded-xl border border-[#22304f] bg-panel-2 p-4 text-sm text-muted">
              {algo === 'knapsack'
                ? 'Drag the capacity slider on the right. The DP table fills live and the chosen parcels light up.'
                : 'The manifest is compressed with an optimal Huffman code. Edit cities to change the symbol frequencies.'}
            </div>
          )}

          <Legend />
        </aside>

        {/* Main stage */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {isGraphAlgo && (
              <GraphCanvas
                graph={graph}
                frame={frame}
                startId={startId}
                targetId={algo === 'tsp' ? null : targetId}
                stops={algo === 'tsp' ? stops : []}
                mode={mode}
                onAddCity={addCity}
                onMoveCity={moveCity}
                onAddRoad={addRoad}
                onDeleteCity={deleteCity}
                onDeleteRoad={deleteRoad}
                onSetStart={setStartId}
                onSetTarget={setTargetId}
                onToggleStop={toggleStop}
              />
            )}
            {algo === 'knapsack' && (
              <KnapsackView parcels={defaultParcels} capacity={defaultCapacity} />
            )}
            {algo === 'huffman' && <HuffmanView text={manifest} />}
          </div>

          {isGraphAlgo && (
            <StepInspector result={result} frame={frame} stepIndex={stepIndex} />
          )}
        </main>
      </div>
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────
// ── Sidebar graph controls ───────────────────────────────────────────
function GraphControls(props: {
  algo: Algo
  mode: EditorMode
  setMode: (m: EditorMode) => void
  startId: string | null
  targetId: string | null
  stops: string[]
  canRun: boolean
  playing: boolean
  speed: number
  setSpeed: (n: number) => void
  onReset: () => void
  onTogglePlay: () => void
  onStep: (d: number) => void
  hasResult: boolean
  stepIndex: number
  totalSteps: number
}) {
  const {
    algo,
    mode,
    setMode,
    startId,
    targetId,
    stops,
    canRun,
    playing,
    speed,
    setSpeed,
    onReset,
    onTogglePlay,
    onStep,
    hasResult,
    stepIndex,
    totalSteps,
  } = props

  const modes: { id: EditorMode; label: string }[] = [
    { id: 'move', label: 'Move' },
    { id: 'addCity', label: '+ City' },
    { id: 'addRoad', label: '+ Road' },
    { id: 'setStart', label: 'Set Depot' },
    ...(algo === 'tsp'
      ? [{ id: 'toggleStop' as EditorMode, label: 'Toggle Stop' }]
      : [{ id: 'setTarget' as EditorMode, label: 'Set Target' }]),
    { id: 'delete', label: 'Delete' },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#22304f] bg-panel-2 p-4">
      <div className="text-xs uppercase tracking-wider text-muted">Edit map</div>
      <div className="grid grid-cols-3 gap-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-lg border px-2 py-1.5 text-xs transition ${
              mode === m.id
                ? 'border-[var(--color-accent-2)] bg-[#1e2547] text-ink'
                : 'border-[#2b3756] text-muted hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Depot:{' '}
          <span className="font-mono text-[var(--color-success)]">
            {startId ?? '—'}
          </span>
        </span>
        {algo === 'tsp' ? (
          <span>
            Stops:{' '}
            <span className="font-mono text-[var(--color-frontier)]">
              {stops.join(',') || '—'}
            </span>
          </span>
        ) : (
          <span>
            Target:{' '}
            <span className="font-mono text-accent">{targetId ?? '—'}</span>
          </span>
        )}
      </div>

      <div className="h-px bg-[#22304f]" />

      <div className="flex items-center gap-2">
        <button
          disabled={!canRun}
          onClick={onTogglePlay}
          className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? '⏸ Pause' : hasResult ? '▶ Play' : '▶ Run'}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-[#2b3756] px-3 py-2 text-sm text-muted hover:text-ink"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onStep(-1)}
          disabled={!hasResult}
          className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-30"
        >
          ◀ Step
        </button>
        <button
          onClick={() => onStep(1)}
          disabled={!hasResult}
          className="rounded-lg border border-[#2b3756] px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-30"
        >
          Step ▶
        </button>
        <span className="ml-auto font-mono text-xs text-muted">
          {hasResult ? `${stepIndex + 1}/${totalSteps}` : '—'}
        </span>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        Speed
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="font-mono">{speed}×</span>
      </label>
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────────────
function Legend() {
  const items: [string, string][] = [
    ['var(--color-success)', 'Depot / Start'],
    ['var(--color-accent)', 'Target'],
    ['var(--color-frontier)', 'Frontier / Stop'],
    ['var(--color-visited)', 'Visited'],
    ['var(--color-path)', 'Path'],
  ]
  return (
    <div className="mt-auto flex flex-col gap-2 rounded-xl border border-[#22304f] bg-panel-2 p-4">
      <div className="text-xs uppercase tracking-wider text-muted">Legend</div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
        {items.map(([c, l]) => (
          <div key={l} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border-2"
              style={{ borderColor: c }}
            />
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step inspector (bottom strip) ────────────────────────────────────
function StepInspector({
  result,
  frame,
  stepIndex,
}: {
  result: AlgoResult | null
  frame: AlgoStep | null
  stepIndex: number
}) {
  return (
    <div className="flex items-center gap-6 border-t border-[#1a2440] bg-panel px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-muted">
          Step {result ? stepIndex + 1 : 0}
        </div>
        <div className="truncate text-sm text-ink">
          {frame?.note ?? 'Press Run to watch the algorithm execute step by step.'}
        </div>
      </div>
      <Metric label="Operations" value={frame ? String(frame.ops) : '0'} />
      <Metric label="Complexity" value={result?.complexity ?? '—'} mono />
      <Metric
        label="Result cost"
        value={
          result
            ? result.totalCost === Infinity
              ? '∞'
              : String(result.totalCost)
            : '—'
        }
        accent
      />
    </div>
  )
}

function Metric({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div className="shrink-0">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`text-sm ${mono ? 'font-mono' : 'font-semibold'} ${
          accent ? 'text-accent' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────

// Road weight = scaled straight-line distance between its two cities.
// One source of truth, so the number always matches what you see.
const DISTANCE_SCALE = 28

function roadWeight(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(1, Math.round(Math.hypot(ax - bx, ay - by) / DISTANCE_SCALE))
}

/** Recompute every edge's weight from current node positions. */
function recalcEdges(
  nodes: Graph['nodes'],
  edges: Graph['edges'],
): Graph['edges'] {
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]))
  return edges.map((e) => {
    const a = pos[e.source]
    const b = pos[e.target]
    if (!a || !b) return e
    return { ...e, weight: roadWeight(a.x, a.y, b.x, b.y) }
  })
}

function nextId(graph: Graph): string {
  const used = new Set(graph.nodes.map((n) => n.id))
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i)
    if (!used.has(c)) return c
  }
  let k = 1
  while (used.has(`N${k}`)) k++
  return `N${k}`
}
