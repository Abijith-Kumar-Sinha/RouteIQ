import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapRoute, type MapRoute, type RouteAlgo } from '../algorithms/mapRoute'
import {
  loadCity,
  COVERAGES,
  type CityData,
  type Coverage,
} from '../data/cityGraph'
import { cityName } from '../data/cityMeta'
import { drawCoverageMask, inBounds } from '../lib/coverage'

interface Plan {
  legs: MapRoute[]
  order: string[]
  totalCost: number
  reached: boolean
}

export default function MapView() {
  const [coverage, setCoverage] = useState<Coverage>(COVERAGES[0])
  const [data, setData] = useState<CityData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(false)
    loadCity(coverage.file)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [coverage])

  return (
    <div className="relative h-full w-full">
      <CoverageSelector coverage={coverage} onChange={setCoverage} />
      {error ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
          Couldn’t load the “{coverage.label}” map — that dataset may not be
          baked yet. Pick another coverage.
        </div>
      ) : !data ? (
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#2b3756] border-t-[var(--color-accent)]" />
            <div className="text-sm text-muted">
              Loading {cityName} · {coverage.label}…
            </div>
            <div className="mt-1 text-xs text-muted/70">{coverage.note}</div>
          </div>
        </div>
      ) : (
        <MapInner key={coverage.id} data={data} />
      )}
    </div>
  )
}

function CoverageSelector({
  coverage,
  onChange,
}: {
  coverage: Coverage
  onChange: (c: Coverage) => void
}) {
  return (
    <div className="absolute right-4 top-4 z-[700] flex items-center gap-1 rounded-2xl border border-[#1e293f] bg-panel/95 p-1.5 backdrop-blur">
      <span className="px-2 text-[10px] uppercase tracking-wider text-muted">
        Coverage
      </span>
      {COVERAGES.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c)}
          title={c.note}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            coverage.id === c.id
              ? 'bg-[#0c2236] font-semibold text-accent'
              : 'text-muted hover:text-ink'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

function MapInner({ data }: { data: CityData }) {
  const [algo, setAlgo] = useState<RouteAlgo>('astar')
  const [optimize, setOptimize] = useState(false)
  const [points, setPoints] = useState<string[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [legIndex, setLegIndex] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(6)
  const [map, setMap] = useState<LeafletMap | null>(null)

  const pos = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {}
    for (const n of data.graph.nodes) m[n.id] = { x: n.x, y: n.y }
    return m
  }, [data])

  const atEnd = plan ? legIndex >= plan.legs.length : false

  // Sequential leg-by-leg animation: each leg floods, then the next starts.
  useEffect(() => {
    if (!playing || !plan) return
    if (legIndex >= plan.legs.length) {
      setPlaying(false)
      return
    }
    const leg = plan.legs[legIndex]
    const inc = Math.max(1, Math.round((leg.settledCount / 180) * speed))
    const t = setTimeout(() => {
      if (step + inc >= leg.settledCount) {
        if (legIndex + 1 >= plan.legs.length) {
          setStep(leg.settledCount)
          setPlaying(false)
        } else {
          setLegIndex(legIndex + 1)
          setStep(0)
        }
      } else {
        setStep(step + inc)
      }
    }, 45)
    return () => clearTimeout(t)
  }, [playing, step, legIndex, plan, speed])

  function resetRun() {
    setPlan(null)
    setLegIndex(0)
    setStep(0)
    setPlaying(false)
  }

  function greedyOrder(pts: string[]): string[] {
    if (pts.length <= 3) return pts
    const start = pts[0]
    const dest = pts[pts.length - 1]
    const remaining = new Set(pts.slice(1, -1))
    const order = [start]
    let cur = start
    while (remaining.size) {
      let best: string | null = null
      let bd = Infinity
      const c = pos[cur]
      for (const s of remaining) {
        const p = pos[s]
        const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2
        if (d < bd) {
          bd = d
          best = s
        }
      }
      order.push(best!)
      remaining.delete(best!)
      cur = best!
    }
    order.push(dest)
    return order
  }

  function run() {
    if (points.length < 2) return
    const order = optimize ? greedyOrder(points) : points
    const legs: MapRoute[] = []
    let reached = true
    let total = 0
    for (let i = 0; i + 1 < order.length; i++) {
      const r = mapRoute(data.graph, order[i], order[i + 1], algo)
      legs.push(r)
      if (!r.reached) reached = false
      else total += r.totalCost
    }
    setPlan({ legs, order, totalCost: total, reached })
    setLegIndex(0)
    setStep(0)
    setPlaying(true)
  }

  function addPoint(lat: number, lon: number) {
    if (!inBounds(data.bounds, lat, lon)) return
    const id = data.nearestNode(lat, lon)
    resetRun()
    setPoints((p) => (p[p.length - 1] === id ? p : [...p, id]))
  }

  function removePoint(lat: number, lon: number) {
    setPoints((p) => {
      if (!p.length) return p
      let bi = -1
      let bd = Infinity
      p.forEach((id, i) => {
        const ll = data.latlon[id]
        const d = (ll[0] - lat) ** 2 + (ll[1] - lon) ** 2
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      return bi >= 0 ? p.filter((_, i) => i !== bi) : p
    })
    resetRun()
  }

  function clearAll() {
    setPoints([])
    resetRun()
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={data.bounds}
        boundsOptions={{ padding: [24, 24] }}
        minZoom={10}
        maxZoom={18}
        preferCanvas
        zoomControl={false}
        className="h-full w-full"
        style={{ background: '#0a0e1a' }}
        ref={setMap as never}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />
        <ClickHandler onAdd={addPoint} onRemove={removePoint} />
      </MapContainer>

      {map && (
        <AnimationCanvas
          map={map}
          data={data}
          plan={plan}
          legIndex={legIndex}
          step={step}
          points={points}
        />
      )}

      <ControlPanel
        algo={algo}
        setAlgo={(a) => {
          setAlgo(a)
          resetRun()
        }}
        optimize={optimize}
        setOptimize={(v) => {
          setOptimize(v)
          resetRun()
        }}
        points={points}
        canRun={points.length >= 2}
        playing={playing}
        atEnd={atEnd}
        onRun={() => (plan && !atEnd ? setPlaying((p) => !p) : run())}
        onClear={clearAll}
        speed={speed}
        setSpeed={setSpeed}
        plan={plan}
        legIndex={legIndex}
        step={step}
        nodeCount={data.nodeCount}
      />
    </div>
  )
}

function ClickHandler({
  onAdd,
  onRemove,
}: {
  onAdd: (lat: number, lon: number) => void
  onRemove: (lat: number, lon: number) => void
}) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng)
    },
    contextmenu(e) {
      e.originalEvent.preventDefault()
      onRemove(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// ── Canvas overlay ────────────────────────────────────────────────────────
interface EdgeMeta {
  id: string
  source: string
  target: string
  g: number[]
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

function AnimationCanvas({
  map,
  data,
  plan,
  legIndex,
  step,
  points,
}: {
  map: LeafletMap
  data: CityData
  plan: Plan | null
  legIndex: number
  step: number
  points: string[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const st = useRef({ plan, legIndex, step, points })
  st.current = { plan, legIndex, step, points }
  const rafRef = useRef(0)

  const edges: EdgeMeta[] = useMemo(() => {
    return data.graph.edges.map((e) => {
      const g = data.geom[e.id]
      let minLat = Infinity
      let minLon = Infinity
      let maxLat = -Infinity
      let maxLon = -Infinity
      for (let i = 0; i < g.length; i += 2) {
        const la = g[i]
        const lo = g[i + 1]
        if (la < minLat) minLat = la
        if (la > maxLat) maxLat = la
        if (lo < minLon) minLon = lo
        if (lo > maxLon) maxLon = lo
      }
      return { id: e.id, source: e.source, target: e.target, g, minLat, minLon, maxLat, maxLon }
    })
  }, [data])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!

    const poly = (g: number[]) => {
      const p0 = map.latLngToContainerPoint([g[0], g[1]])
      ctx.moveTo(p0.x, p0.y)
      for (let i = 2; i < g.length; i += 2) {
        const p = map.latLngToContainerPoint([g[i], g[i + 1]])
        ctx.lineTo(p.x, p.y)
      }
    }
    const drawPathEdges = (ids: string[]) => {
      ctx.beginPath()
      for (const id of ids) {
        const g = data.geom[id]
        if (g) poly(g)
      }
      ctx.stroke()
    }

    function draw() {
      const size = map.getSize()
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
        canvas.width = size.x * dpr
        canvas.height = size.y * dpr
        canvas.style.width = size.x + 'px'
        canvas.style.height = size.y + 'px'
      }
      canvas.style.transform = ''
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.x, size.y)
      drawCoverageMask(ctx, map, data.bounds)

      const bb = map.getBounds().pad(0.2)
      const s = bb.getSouth()
      const n = bb.getNorth()
      const w = bb.getWest()
      const e = bb.getEast()
      const visible = (m: EdgeMeta) =>
        !(m.maxLat < s || m.minLat > n || m.maxLon < w || m.minLon > e)

      const { plan, legIndex, step, points } = st.current

      // Base roads on screen.
      ctx.lineWidth = 1
      ctx.strokeStyle = '#1b2942'
      ctx.beginPath()
      for (const m of edges) if (visible(m)) poly(m.g)
      ctx.stroke()

      if (plan) {
        const legs = plan.legs

        // Current leg's exploration flood.
        if (legIndex < legs.length) {
          const order = legs[legIndex].order
          const rev = (id: string) => {
            const o = order[id]
            return o !== undefined && o < step
          }
          ctx.lineWidth = 1.6
          ctx.strokeStyle = 'rgba(245,158,11,0.5)'
          ctx.beginPath()
          for (const m of edges)
            if (visible(m) && rev(m.source) && rev(m.target)) poly(m.g)
          ctx.stroke()
        }

        // Finished + currently-reached leg paths (cyan trail).
        ctx.lineWidth = 4
        ctx.strokeStyle = '#22d3ee'
        ctx.shadowColor = '#22d3ee'
        ctx.shadowBlur = 12
        for (let i = 0; i < legs.length; i++) {
          const done = i < legIndex
          const reachedNow = i === legIndex && step > legs[i].pathOrder
          if (done || reachedNow) drawPathEdges(legs[i].pathEdges)
        }
        ctx.shadowBlur = 0

        // Current node marker.
        if (legIndex < legs.length) {
          const cur = legs[legIndex].orderIds[step - 1]
          if (cur) {
            const p = map.latLngToContainerPoint(data.latlon[cur])
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      }

      // Waypoint pins: start, numbered stops, destination.
      points.forEach((id, i) => {
        const isStart = i === 0
        const isDest = i === points.length - 1 && points.length > 1
        const color = isStart ? '#34d399' : isDest ? '#38bdf8' : '#a78bfa'
        const labelTxt = isStart
          ? 'S'
          : isDest
            ? 'D'
            : String(i)
        const p = map.latLngToContainerPoint(data.latlon[id])
        ctx.fillStyle = color
        ctx.strokeStyle = '#0a0e1a'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#06121f'
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelTxt, p.x, p.y + 0.5)
      })
    }

    function schedule() {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    function animateZoom(ev: L.ZoomAnimEvent) {
      const scale = map.getZoomScale(ev.zoom)
      const newOrigin = (
        map as unknown as {
          _getNewPixelOrigin: (c: L.LatLng, z: number) => L.Point
        }
      )._getNewPixelOrigin(ev.center, ev.zoom)
      const offset = map.getPixelOrigin().multiplyBy(scale).subtract(newOrigin)
      L.DomUtil.setTransform(canvas, offset, scale)
    }

    ;(canvas as unknown as { _schedule: () => void })._schedule = schedule
    schedule()
    map.on('move moveend zoomend resize viewreset', schedule)
    map.on('zoomanim', animateZoom)
    return () => {
      map.off('move moveend zoomend resize viewreset', schedule)
      map.off('zoomanim', animateZoom)
      cancelAnimationFrame(rafRef.current)
    }
  }, [map, edges, data])

  useEffect(() => {
    const c = ref.current as unknown as { _schedule?: () => void } | null
    c?._schedule?.()
  }, [plan, legIndex, step, points])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-[500]" />
}

// ── Control panel ────────────────────────────────────────────────────────
const ALGO_LABEL: Record<RouteAlgo, string> = {
  astar: 'A*',
  dijkstra: 'Dijkstra',
  bfs: 'BFS',
}

function ControlPanel(props: {
  algo: RouteAlgo
  setAlgo: (a: RouteAlgo) => void
  optimize: boolean
  setOptimize: (v: boolean) => void
  points: string[]
  canRun: boolean
  playing: boolean
  atEnd: boolean
  onRun: () => void
  onClear: () => void
  speed: number
  setSpeed: (n: number) => void
  plan: Plan | null
  legIndex: number
  step: number
  nodeCount: number
}) {
  const {
    algo,
    setAlgo,
    optimize,
    setOptimize,
    points,
    canRun,
    playing,
    atEnd,
    onRun,
    onClear,
    speed,
    setSpeed,
    plan,
    legIndex,
    step,
    nodeCount,
  } = props

  const stops = Math.max(0, points.length - 2)

  // Aggregate metrics across legs.
  let explored = 0
  let ops = 0
  if (plan) {
    for (let i = 0; i < Math.min(legIndex, plan.legs.length); i++) {
      explored += plan.legs[i].settledCount
      ops += plan.legs[i].opsTotal
    }
    if (legIndex < plan.legs.length) {
      const leg = plan.legs[legIndex]
      const e = Math.min(step, leg.settledCount)
      explored += e
      ops += e > 0 ? leg.opsAt[e - 1] : 0
    }
  }
  const lengthKm =
    plan && atEnd && plan.reached ? (plan.totalCost / 1000).toFixed(2) : null

  return (
    <div className="absolute left-4 top-4 z-[600] w-[330px] rounded-2xl border border-[#1e293f] bg-panel/95 p-4 backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-ink">{cityName}</span>
        <span className="font-mono text-[11px] text-muted">
          {nodeCount.toLocaleString()} nodes
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        <b className="text-ink">Left-click</b> to add stops (start → … →
        destination). <b className="text-ink">Right-click</b> removes the
        nearest one.
      </p>

      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {(['astar', 'dijkstra', 'bfs'] as RouteAlgo[]).map((a) => (
          <button
            key={a}
            onClick={() => setAlgo(a)}
            className={`rounded-lg border px-2 py-2 text-sm transition ${
              algo === a
                ? 'border-[var(--color-accent)] bg-[#0c2236] text-ink'
                : 'border-[#2b3756] text-muted hover:text-ink'
            }`}
          >
            {ALGO_LABEL[a]}
          </button>
        ))}
      </div>

      <button
        onClick={() => setOptimize(!optimize)}
        disabled={stops < 2}
        className={`mb-3 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition disabled:opacity-40 ${
          optimize
            ? 'border-[var(--color-frontier)] bg-[#1e2547] text-ink'
            : 'border-[#2b3756] text-muted hover:text-ink'
        }`}
        title="Reorder the stops for the shortest tour (greedy nearest-neighbour TSP)"
      >
        <span>Optimize stop order (greedy TSP)</span>
        <span className="font-mono">{optimize ? 'ON' : 'OFF'}</span>
      </button>

      <div className="mb-3 flex items-center gap-2">
        <button
          disabled={!canRun}
          onClick={onRun}
          className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? '⏸ Pause' : atEnd || !plan ? '▶ Run' : '▶ Resume'}
        </button>
        <button
          onClick={onClear}
          className="rounded-lg border border-[#2b3756] px-3 py-2 text-sm text-muted hover:text-ink"
        >
          Clear
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 text-xs text-muted">
        Speed
        <input
          type="range"
          min={1}
          max={20}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="flex-1 accent-[var(--color-accent)]"
        />
        <span className="font-mono">{speed}×</span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Stops" value={`${stops}`} />
        <Metric label="Nodes explored" value={explored.toLocaleString()} />
        <Metric label="Operations" value={ops.toLocaleString()} />
        <Metric
          label="Route length"
          value={
            lengthKm
              ? `${lengthKm} km`
              : plan && atEnd && !plan.reached
                ? 'unreachable'
                : '—'
          }
          accent
        />
      </div>

      {plan && (
        <div className="mt-3 rounded-lg border border-[#22304f] bg-panel-2 p-2 text-[11px] leading-relaxed text-muted">
          {plan.legs[Math.min(legIndex, plan.legs.length - 1)]?.complexity}
          {plan.legs.length > 1 && (
            <span>
              {' '}· leg {Math.min(legIndex + 1, plan.legs.length)}/
              {plan.legs.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-[#22304f] bg-panel-2 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`font-mono text-sm ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}
