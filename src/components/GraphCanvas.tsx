import { useEffect, useRef, useState } from 'react'
import type { AlgoStep, Graph } from '../algorithms/types'

export type EditorMode =
  | 'move'
  | 'addCity'
  | 'addRoad'
  | 'setStart'
  | 'setTarget'
  | 'toggleStop'
  | 'delete'

interface Props {
  graph: Graph
  frame: AlgoStep | null
  startId: string | null
  targetId: string | null
  stops: string[]
  mode: EditorMode
  onAddCity: (x: number, y: number) => void
  onMoveCity: (id: string, x: number, y: number) => void
  onAddRoad: (a: string, b: string) => void
  onDeleteCity: (id: string) => void
  onDeleteRoad: (edgeId: string) => void
  onSetStart: (id: string) => void
  onSetTarget: (id: string) => void
  onToggleStop: (id: string) => void
}

const VIEW_W = 1000
const VIEW_H = 620
const K_MIN = 0.4
const K_MAX = 4
// How far the grid extends past the visible area so pan/zoom never runs off it.
const GRID_MARGIN = 4000

interface View {
  k: number
  x: number
  y: number
}

export default function GraphCanvas({
  graph,
  frame,
  startId,
  targetId,
  stops,
  mode,
  onAddCity,
  onMoveCity,
  onAddRoad,
  onDeleteCity,
  onDeleteRoad,
  onSetStart,
  onSetTarget,
  onToggleStop,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [roadFrom, setRoadFrom] = useState<string | null>(null)
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)

  // The working area expands to fill whatever space the panel gives us, so
  // the grid + placeable region cover the entire stage (not a fixed box).
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: VIEW_W, h: VIEW_H })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setSize({ w: Math.max(320, cr.width), h: Math.max(320, cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = size.w
  const H = size.h

  // Pan/zoom: content is drawn inside a <g> transformed by translate+scale.
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const panRef = useRef<{
    startVX: number
    startVY: number
    startX: number
    startY: number
    cx: number
    cy: number
    moved: boolean
  } | null>(null)

  const visited = new Set(frame?.visited ?? [])
  const frontier = new Set(frame?.frontier ?? [])
  const pathNodes = new Set(frame?.pathNodes ?? [])
  const pathEdges = new Set(frame?.pathEdges ?? [])
  const current = frame?.current ?? null
  const labels = frame?.labels ?? {}

  // Screen pixel → viewBox coordinate (ignores pan/zoom).
  function toViewBox(e: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      vx: ((e.clientX - rect.left) / rect.width) * W,
      vy: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  // Screen pixel → content coordinate (inverts the current pan/zoom).
  function toContent(e: { clientX: number; clientY: number }) {
    const { vx, vy } = toViewBox(e)
    return { x: (vx - view.x) / view.k, y: (vy - view.y) / view.k }
  }

  // Zoom toward a viewBox anchor point so it stays under the cursor.
  function zoomAt(vx: number, vy: number, factor: number) {
    setView((v) => {
      const k = clamp(v.k * factor, K_MIN, K_MAX)
      const ratio = k / v.k
      return { k, x: vx - (vx - v.x) * ratio, y: vy - (vy - v.y) * ratio }
    })
  }

  function handleWheel(e: React.WheelEvent) {
    const { vx, vy } = toViewBox(e)
    zoomAt(vx, vy, e.deltaY < 0 ? 1.15 : 1 / 1.15)
  }

  // Pointer down on empty canvas → start a pan (and remember the spot in
  // case it turns out to be a click, e.g. to add a city).
  function handleSvgPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return
    const { vx, vy } = toViewBox(e)
    const { x, y } = toContent(e)
    panRef.current = {
      startVX: vx,
      startVY: vy,
      startX: view.x,
      startY: view.y,
      cx: x,
      cy: y,
      moved: false,
    }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function handleSvgPointerMove(e: React.PointerEvent) {
    if (dragId) {
      const { x, y } = toContent(e)
      onMoveCity(dragId, clamp(x, 20, W - 20), clamp(y, 20, H - 20))
      return
    }
    const pan = panRef.current
    if (pan) {
      const { vx, vy } = toViewBox(e)
      const dx = vx - pan.startVX
      const dy = vy - pan.startVY
      if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true
      setView((v) => ({ ...v, x: pan.startX + dx, y: pan.startY + dy }))
    }
  }

  function handleSvgPointerUp() {
    const pan = panRef.current
    if (pan && !pan.moved) {
      // It was a click, not a drag → run the background action.
      if (mode === 'addCity') onAddCity(pan.cx, pan.cy)
      setRoadFrom(null)
    }
    panRef.current = null
    setDragId(null)
  }

  function handleNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    if (mode === 'move') {
      setDragId(id)
      svgRef.current?.setPointerCapture(e.pointerId)
    }
  }

  function handleNodeClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    switch (mode) {
      case 'setStart':
        onSetStart(id)
        break
      case 'setTarget':
        onSetTarget(id)
        break
      case 'toggleStop':
        onToggleStop(id)
        break
      case 'delete':
        onDeleteCity(id)
        break
      case 'addRoad':
        if (roadFrom === null) {
          setRoadFrom(id)
        } else if (roadFrom !== id) {
          onAddRoad(roadFrom, id)
          setRoadFrom(null)
        }
        break
    }
  }

  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))

  const isPanning = panRef.current?.moved ?? false

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full"
      style={{
        background:
          'radial-gradient(900px 620px at 50% 42%, rgba(56,189,248,0.07), transparent), radial-gradient(760px 520px at 68% 70%, rgba(129,140,248,0.06), transparent), #0a0e1a',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full touch-none select-none"
        style={{ cursor: isPanning ? 'grabbing' : mode === 'move' ? 'grab' : 'default' }}
        onWheel={handleWheel}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="#121a2e"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Effectively infinite grid. The ambient glow lives on the wrapper
              (CSS) so the texture stays uniform everywhere, at any pan/zoom. */}
          <rect
            x={-GRID_MARGIN}
            y={-GRID_MARGIN}
            width={W + GRID_MARGIN * 2}
            height={H + GRID_MARGIN * 2}
            fill="url(#grid)"
            style={{ pointerEvents: 'none' }}
          />

      {/* Edges */}
      {graph.edges.map((e) => {
        const a = nodeById[e.source]
        const b = nodeById[e.target]
        if (!a || !b) return null
        const onPath = pathEdges.has(e.id)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const deletable = mode === 'delete'
        const aboutToDelete = deletable && hoverEdge === e.id
        const lineColor = aboutToDelete
          ? 'var(--color-danger)'
          : onPath
            ? 'var(--color-path)'
            : '#2b3756'
        return (
          <g
            key={e.id}
            style={{ cursor: deletable ? 'pointer' : 'default' }}
            onMouseEnter={() => deletable && setHoverEdge(e.id)}
            onMouseLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
            onClick={(ev) => {
              if (deletable) {
                ev.stopPropagation()
                onDeleteRoad(e.id)
              }
            }}
          >
            {/* Wide, invisible hit-area so thin roads are easy to click. */}
            {deletable && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={20}
              />
            )}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lineColor}
              strokeWidth={onPath || aboutToDelete ? 6 : 2.5}
              strokeLinecap="round"
              className={onPath ? 'animate-flow' : ''}
              filter={onPath || aboutToDelete ? 'url(#soft)' : undefined}
            />
            <g transform={`translate(${mx} ${my})`}>
              <circle
                r={12}
                fill="#0d1426"
                stroke={aboutToDelete ? 'var(--color-danger)' : '#2b3756'}
                strokeWidth={1}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fill={
                  aboutToDelete
                    ? 'var(--color-danger)'
                    : onPath
                      ? 'var(--color-path)'
                      : '#7c89a8'
                }
                fontFamily="var(--font-mono)"
              >
                {aboutToDelete ? '✕' : e.weight}
              </text>
            </g>
          </g>
        )
      })}

      {/* Pending road preview */}
      {roadFrom && nodeById[roadFrom] && (
        <circle
          cx={nodeById[roadFrom].x}
          cy={nodeById[roadFrom].y}
          r={26}
          fill="none"
          stroke="var(--color-accent-2)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}

      {/* Nodes */}
      {graph.nodes.map((n) => {
        const isStart = n.id === startId
        const isTarget = n.id === targetId
        const isStop = stops.includes(n.id)
        const isCurrent = n.id === current
        const onPath = pathNodes.has(n.id)
        const isVisited = visited.has(n.id)
        const isFrontier = frontier.has(n.id)

        let fill = '#1c2740'
        let stroke = '#3a496e'
        if (isVisited) {
          fill = '#3a2c10'
          stroke = 'var(--color-visited)'
        }
        if (isFrontier) {
          fill = '#2a2150'
          stroke = 'var(--color-frontier)'
        }
        if (onPath) {
          fill = '#0b3a44'
          stroke = 'var(--color-path)'
        }
        if (isStart) {
          fill = '#0c3a28'
          stroke = 'var(--color-success)'
        }
        if (isTarget) {
          fill = '#0b2f44'
          stroke = 'var(--color-accent)'
        }

        const dist = labels[n.id]

        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            style={{ cursor: mode === 'move' ? 'grab' : 'pointer' }}
            onPointerDown={(e) => handleNodePointerDown(e, n.id)}
            onClick={(e) => handleNodeClick(e, n.id)}
          >
            {isCurrent && (
              <circle r={30} fill="none" stroke="#fff" strokeWidth={2}>
                <animate
                  attributeName="r"
                  values="22;34;22"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0.1;0.9"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {isStop && (
              <circle
                r={28}
                fill="none"
                stroke="var(--color-frontier)"
                strokeWidth={2.5}
                strokeDasharray="3 4"
              />
            )}
            <circle
              r={20}
              fill={fill}
              stroke={stroke}
              strokeWidth={3}
              filter={onPath || isCurrent ? 'url(#soft)' : undefined}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={15}
              fontWeight={700}
              fill="#e5e9f0"
            >
              {n.id}
            </text>
            <text
              y={37}
              textAnchor="middle"
              fontSize={13}
              fill="#9fb0d0"
              fontWeight={500}
            >
              {n.label}
            </text>
            {dist !== undefined && (
              <g transform="translate(22 -20)">
                <rect
                  x={-4}
                  y={-11}
                  width={String(dist).length * 9 + 8}
                  height={20}
                  rx={5}
                  fill="#0a0e1a"
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <text
                  x={String(dist).length * 4.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontFamily="var(--font-mono)"
                  fill={stroke}
                >
                  {dist}
                </text>
              </g>
            )}
          </g>
        )
      })}
        </g>
      </svg>

      <ZoomControls
        zoom={view.k}
        onZoomIn={() => zoomAt(W / 2, H / 2, 1.25)}
        onZoomOut={() => zoomAt(W / 2, H / 2, 1 / 1.25)}
        onReset={() => setView({ k: 1, x: 0, y: 0 })}
      />
    </div>
  )
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  const btn =
    'grid h-9 w-9 place-items-center rounded-lg border border-[#2b3756] bg-[#0d1426]/90 text-lg text-ink backdrop-blur transition hover:border-[var(--color-accent)] hover:text-accent'
  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
      <div className="rounded-md bg-[#0d1426]/90 px-2 py-1 font-mono text-xs text-muted backdrop-blur">
        {Math.round(zoom * 100)}%
      </div>
      <button className={btn} onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
        +
      </button>
      <button className={btn} onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
        −
      </button>
      <button
        className={btn + ' text-xs'}
        onClick={onReset}
        title="Reset view"
        aria-label="Reset view"
      >
        ⟲
      </button>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
