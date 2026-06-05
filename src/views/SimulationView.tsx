import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapRoute } from '../algorithms/mapRoute'
import { loadCity, type CityData } from '../data/cityGraph'
import { cityName } from '../data/cityMeta'
import { drawCoverageMask, inBounds } from '../lib/coverage'

const TRUCK_COLORS = ['#38bdf8', '#f59e0b', '#a78bfa']

interface Truck {
  color: string
  pts: number[] // flat [lat,lon,…] drive polyline
  cum: number[] // cumulative metres per vertex
  total: number
  legCost: number // summed shortest-path leg costs (metres)
  marks: { id: string; dist: number; isStop: boolean }[]
  stopCount: number
}

export default function SimulationView() {
  const [data, setData] = useState<CityData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    loadCity()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  if (error)
    return (
      <div className="grid h-full place-items-center text-muted">
        Couldn’t load the city road graph.
      </div>
    )
  if (!data)
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#2b3756] border-t-[var(--color-accent)]" />
          <div className="text-sm text-muted">Loading {cityName}…</div>
        </div>
      </div>
    )
  return <SimInner data={data} />
}

function SimInner({ data }: { data: CityData }) {
  const [depot, setDepot] = useState<string | null>(null)
  const [stops, setStops] = useState<string[]>([])
  const [fleet, setFleet] = useState(1)
  const [trucks, setTrucks] = useState<Truck[] | null>(null)
  const [stats, setStats] = useState<{ naive: number; greedy: number } | null>(
    null,
  )
  const [traveled, setTraveled] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [map, setMap] = useState<LeafletMap | null>(null)

  const pos = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {}
    for (const n of data.graph.nodes) m[n.id] = { x: n.x, y: n.y }
    return m
  }, [data])

  const maxTotal = trucks ? Math.max(...trucks.map((t) => t.total), 1) : 1
  const done = trucks ? traveled >= maxTotal : false

  useEffect(() => {
    if (!playing || !trucks) return
    if (traveled >= maxTotal) {
      setPlaying(false)
      return
    }
    const t = setTimeout(
      () => setTraveled((d) => Math.min(maxTotal, d + speed * 55)),
      40,
    )
    return () => clearTimeout(t)
  }, [playing, traveled, trucks, speed, maxTotal])

  function resetRun() {
    setTrucks(null)
    setStats(null)
    setTraveled(0)
    setPlaying(false)
  }

  // Nearest-neighbour order through a truck's stops, returning to depot.
  function tourFor(depotId: string, group: string[]): string[] {
    const order = [depotId]
    const remaining = new Set(group)
    let cur = depotId
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
    order.push(depotId)
    return order
  }

  function buildTruck(color: string, tour: string[]): Truck {
    const pts: number[] = []
    const cum: number[] = []
    let total = 0
    const marks: Truck['marks'] = []
    const push = (lat: number, lon: number) => {
      if (pts.length === 0) {
        pts.push(lat, lon)
        cum.push(0)
        return
      }
      const n = pts.length
      if (Math.abs(pts[n - 2] - lat) < 1e-7 && Math.abs(pts[n - 1] - lon) < 1e-7)
        return
      total += haversine(pts[n - 2], pts[n - 1], lat, lon)
      pts.push(lat, lon)
      cum.push(total)
    }
    let legCost = 0
    const d0 = data.latlon[tour[0]]
    push(d0[0], d0[1])
    for (let i = 0; i + 1 < tour.length; i++) {
      const leg = mapRoute(data.graph, tour[i], tour[i + 1], 'astar')
      if (leg.reached) {
        legCost += leg.totalCost
        for (let j = 0; j < leg.pathEdges.length; j++) {
          const u = leg.pathNodes[j]
          const g = data.geom[leg.pathEdges[j]]
          const lu = data.latlon[u]
          const forward =
            Math.abs(g[0] - lu[0]) < 1e-6 && Math.abs(g[1] - lu[1]) < 1e-6
          if (forward) for (let k = 0; k < g.length; k += 2) push(g[k], g[k + 1])
          else for (let k = g.length - 2; k >= 0; k -= 2) push(g[k], g[k + 1])
        }
      }
      const isStop = i + 1 < tour.length - 1 // last node is the depot return
      marks.push({ id: tour[i + 1], dist: total, isStop })
    }
    return { color, pts, cum, total, legCost, marks, stopCount: group_count(tour) }
  }

  // Total routed distance for a given visit order (used for the naive baseline).
  function tourCost(tour: string[]): number {
    let total = 0
    for (let i = 0; i + 1 < tour.length; i++) {
      const leg = mapRoute(data.graph, tour[i], tour[i + 1], 'astar')
      if (leg.reached) total += leg.totalCost
    }
    return total
  }

  function dispatch() {
    if (!depot || stops.length === 0) return
    const groups = partition(depot, stops, fleet, pos).filter((g) => g.length)
    const built: Truck[] = []
    let greedy = 0
    let naive = 0
    groups.forEach((g, i) => {
      const truck = buildTruck(
        TRUCK_COLORS[i % TRUCK_COLORS.length],
        tourFor(depot, g),
      )
      built.push(truck)
      greedy += truck.legCost
      // Naive baseline: same trucks/stops, visited in the order placed.
      const placed = [...g].sort((a, b) => stops.indexOf(a) - stops.indexOf(b))
      naive += tourCost([depot, ...placed, depot])
    })
    setTrucks(built)
    setStats({ naive, greedy })
    setTraveled(0)
    setPlaying(true)
  }

  function addPoint(lat: number, lon: number) {
    if (!inBounds(data.bounds, lat, lon)) return
    const id = data.nearestNode(lat, lon)
    resetRun()
    if (!depot) setDepot(id)
    else setStops((s) => (s.includes(id) || id === depot ? s : [...s, id]))
  }

  function removePoint(lat: number, lon: number) {
    resetRun()
    // Remove nearest stop; if click is closest to depot, clear depot.
    let target: 'depot' | number = -1
    let bd = Infinity
    if (depot) {
      const ll = data.latlon[depot]
      bd = (ll[0] - lat) ** 2 + (ll[1] - lon) ** 2
      target = 'depot'
    }
    stops.forEach((id, i) => {
      const ll = data.latlon[id]
      const d = (ll[0] - lat) ** 2 + (ll[1] - lon) ** 2
      if (d < bd) {
        bd = d
        target = i
      }
    })
    if (target === 'depot') setDepot(null)
    else if (typeof target === 'number' && target >= 0)
      setStops((s) => s.filter((_, i) => i !== target))
  }

  function clearAll() {
    setDepot(null)
    setStops([])
    resetRun()
  }

  // Live delivery metrics.
  let delivered = 0
  let totalStops = 0
  let covered = 0
  let planned = 0
  if (trucks) {
    for (const t of trucks) {
      const tv = Math.min(traveled, t.total)
      covered += tv
      planned += t.total
      for (const m of t.marks) {
        if (m.isStop) {
          totalStops++
          if (m.dist <= tv) delivered++
        }
      }
    }
  } else {
    totalStops = stops.length
  }

  const saved = stats ? stats.naive - stats.greedy : 0
  const savedPct = stats && stats.naive > 0 ? (saved / stats.naive) * 100 : 0
  const savedText =
    saved >= 0
      ? `${(saved / 1000).toFixed(2)} km · ${savedPct.toFixed(0)}% shorter`
      : `${(-saved / 1000).toFixed(2)} km longer`

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
        <SimCanvas
          map={map}
          data={data}
          trucks={trucks}
          traveled={traveled}
          depot={depot}
          stops={stops}
        />
      )}

      <div className="absolute left-4 top-4 z-[600] w-[320px] rounded-2xl border border-[#1e293f] bg-panel/95 p-4 backdrop-blur">
        <div className="mb-1 text-sm font-bold text-ink">Delivery Simulation</div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          <b className="text-ink">Left-click</b> the map: first point is the{' '}
          <span className="text-[var(--color-success)]">depot</span>, the rest
          are <span className="text-accent">deliveries</span>.{' '}
          <b className="text-ink">Right-click</b> removes one.
        </p>

        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            Fleet size
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setFleet(n)
                  resetRun()
                }}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  fleet === n
                    ? 'border-[var(--color-accent)] bg-[#0c2236] text-ink'
                    : 'border-[#2b3756] text-muted hover:text-ink'
                }`}
              >
                {n} 🚚
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            disabled={!depot || stops.length === 0}
            onClick={() => (trucks && !done ? setPlaying((p) => !p) : dispatch())}
            className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? '⏸ Pause' : done || !trucks ? '🚚 Dispatch' : '▶ Resume'}
          </button>
          <button
            onClick={clearAll}
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
            max={15}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent)]"
          />
          <span className="font-mono">{speed}×</span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="Delivered"
            value={`${delivered} / ${totalStops}`}
            accent
          />
          <Metric
            label="Distance"
            value={`${(covered / 1000).toFixed(1)} / ${(planned / 1000).toFixed(1)} km`}
          />
          <Metric label="Fleet" value={`${trucks ? trucks.length : fleet} 🚚`} />
          <Metric
            label="Progress"
            value={trucks ? `${Math.round((traveled / maxTotal) * 100)}%` : '—'}
          />
        </div>

        {stats && (
          <div className="mt-3 rounded-lg border border-[#22304f] bg-panel-2 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
              Route optimization · greedy TSP
            </div>
            <Row
              label="Naive (as placed)"
              value={`${(stats.naive / 1000).toFixed(2)} km`}
            />
            <Row
              label="Greedy-optimized"
              value={`${(stats.greedy / 1000).toFixed(2)} km`}
              accent
            />
            <div className="my-1.5 h-px bg-[#22304f]" />
            <Row label="Saved" value={savedText} success />
          </div>
        )}

        {done && trucks && (
          <div className="mt-3 rounded-lg border border-[var(--color-success)] bg-[#0c2a20] p-2 text-center text-xs font-semibold text-[var(--color-success)]">
            ✓ All deliveries complete · {(planned / 1000).toFixed(1)} km driven
          </div>
        )}
      </div>
    </div>
  )
}

function group_count(tour: string[]) {
  return Math.max(0, tour.length - 2) // exclude depot at both ends
}

// Split stops among trucks by angle around the depot (clean, non-crossing).
function partition(
  depot: string,
  stops: string[],
  fleet: number,
  pos: Record<string, { x: number; y: number }>,
): string[][] {
  if (fleet <= 1) return [stops]
  const d = pos[depot]
  const sorted = [...stops].sort(
    (a, b) =>
      Math.atan2(pos[a].y - d.y, pos[a].x - d.x) -
      Math.atan2(pos[b].y - d.y, pos[b].x - d.x),
  )
  const groups: string[][] = Array.from({ length: fleet }, () => [])
  sorted.forEach((s, i) => groups[i % fleet].push(s))
  return groups
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

function SimCanvas({
  map,
  data,
  trucks,
  traveled,
  depot,
  stops,
}: {
  map: LeafletMap
  data: CityData
  trucks: Truck[] | null
  traveled: number
  depot: string | null
  stops: string[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const st = useRef({ trucks, traveled, depot, stops })
  st.current = { trucks, traveled, depot, stops }
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const cp = (lat: number, lon: number) => map.latLngToContainerPoint([lat, lon])

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
      const { trucks, traveled, depot, stops } = st.current

      if (trucks) {
        for (const t of trucks) {
          // Planned route (faint) then driven portion (bright).
          ctx.lineWidth = 2
          ctx.strokeStyle = t.color + '40'
          ctx.beginPath()
          for (let i = 0; i < t.pts.length; i += 2) {
            const p = cp(t.pts[i], t.pts[i + 1])
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()

          const tv = Math.min(traveled, t.total)
          ctx.lineWidth = 3.5
          ctx.strokeStyle = t.color
          ctx.beginPath()
          let started = false
          for (let i = 0; i < t.pts.length; i += 2) {
            if (t.cum[i / 2] > tv) break
            const p = cp(t.pts[i], t.pts[i + 1])
            started ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), (started = true))
          }
          ctx.stroke()
        }
      }

      // Stops + depot pins.
      const drawPin = (id: string, color: string, label: string, delivered = false) => {
        const ll = data.latlon[id]
        const p = cp(ll[0], ll[1])
        ctx.fillStyle = delivered ? '#16361f' : color
        ctx.strokeStyle = delivered ? '#34d399' : '#0a0e1a'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = delivered ? '#34d399' : '#06121f'
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(delivered ? '✓' : label, p.x, p.y + 0.5)
      }

      // Which stops are delivered?
      const deliveredSet = new Set<string>()
      if (trucks) {
        for (const t of trucks) {
          const tv = Math.min(traveled, t.total)
          for (const m of t.marks)
            if (m.isStop && m.dist <= tv) deliveredSet.add(m.id)
        }
      }
      stops.forEach((id, i) =>
        drawPin(id, '#38bdf8', String(i + 1), deliveredSet.has(id)),
      )
      if (depot) drawPin(depot, '#34d399', 'H')

      // Trucks.
      if (trucks) {
        for (const t of trucks) {
          const p = posAt(t.pts, t.cum, Math.min(traveled, t.total))
          const cpt = cp(p.lat, p.lon)
          ctx.font = '20px system-ui'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🚚', cpt.x, cpt.y)
        }
      }
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
  }, [map, data])

  useEffect(() => {
    const c = ref.current as unknown as { _schedule?: () => void } | null
    c?._schedule?.()
  }, [trucks, traveled, depot, stops])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-[500]" />
}

function posAt(pts: number[], cum: number[], traveled: number) {
  if (traveled <= 0) return { lat: pts[0], lon: pts[1] }
  const tot = cum[cum.length - 1]
  if (traveled >= tot)
    return { lat: pts[pts.length - 2], lon: pts[pts.length - 1] }
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < traveled) lo = mid + 1
    else hi = mid
  }
  const i = Math.max(1, lo)
  const t = (traveled - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1])
  const la0 = pts[(i - 1) * 2]
  const lo0 = pts[(i - 1) * 2 + 1]
  const la1 = pts[i * 2]
  const lo1 = pts[i * 2 + 1]
  return { lat: la0 + (la1 - la0) * t, lon: lo0 + (lo1 - lo0) * t }
}

function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(la2 - la1)
  const dLon = toRad(lo2 - lo1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function Row({
  label,
  value,
  accent,
  success,
}: {
  label: string
  value: string
  accent?: boolean
  success?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted">{label}</span>
      <span
        className={`font-mono ${
          success
            ? 'font-semibold text-[var(--color-success)]'
            : accent
              ? 'text-accent'
              : 'text-ink'
        }`}
      >
        {value}
      </span>
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
