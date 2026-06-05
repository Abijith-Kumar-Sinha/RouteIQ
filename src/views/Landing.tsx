import type { View } from '../App'
import { cityName, cityNodeCount, cityEdgeCount } from '../data/cityMeta'

const FEATURES: {
  to: View
  tag: string
  title: string
  body: string
  accent: string
}[] = [
  {
    to: 'map',
    tag: 'Real data',
    title: 'Route real city streets',
    body: `Dijkstra and A* crawling across ${cityNodeCount.toLocaleString()} real intersections of ${cityName}, straight from OpenStreetMap.`,
    accent: 'var(--color-accent)',
  },
  {
    to: 'race',
    tag: 'Head to head',
    title: 'Algorithm Race Arena',
    body: 'Dijkstra vs A* vs BFS running at the same time. Watch them flood the map and see who explores fewer nodes.',
    accent: 'var(--color-frontier)',
  },
  {
    to: 'sim',
    tag: 'Live',
    title: 'Delivery simulation',
    body: 'Trucks drive the optimised tour in real time while a dashboard tallies distance, cost and parcels delivered.',
    accent: 'var(--color-success)',
  },
  {
    to: 'benchmark',
    tag: 'Proof',
    title: 'Benchmark Lab',
    body: 'Measure real runtime as inputs grow and watch the empirical curve trace the theoretical Big-O.',
    accent: 'var(--color-visited)',
  },
]

const ALGORITHMS = [
  'Dijkstra',
  'A*',
  'BFS',
  'Greedy TSP',
  '0/1 Knapsack',
  'Huffman',
]

export default function Landing({ onLaunch }: { onLaunch: (v: View) => void }) {
  return (
    <div className="h-full overflow-auto">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(700px 360px at 30% 10%, rgba(56,189,248,0.18), transparent), radial-gradient(600px 320px at 80% 30%, rgba(129,140,248,0.16), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#22304f] bg-panel px-4 py-1.5 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-success)]" />
            6 algorithms · real map data · fully interactive
          </div>
          <h1 className="bg-gradient-to-br from-white via-[#cfe6ff] to-[var(--color-accent)] bg-clip-text text-6xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-7xl">
            Watch algorithms
            <br />
            think.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            RouteIQ is a logistics engine that turns six classic algorithms into
            something you can watch run — across a real city, frame by frame,
            with the operation count ticking up in front of you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onLaunch('map')}
              className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-bg transition hover:brightness-110"
            >
              Explore the city map →
            </button>
            <button
              onClick={() => onLaunch('studio')}
              className="rounded-xl border border-[#2b3756] px-6 py-3 font-semibold text-ink transition hover:border-[var(--color-accent)]"
            >
              Open the Studio
            </button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {ALGORITHMS.map((a) => (
              <span
                key={a}
                className="rounded-full border border-[#22304f] bg-panel px-3 py-1 font-mono text-xs text-muted"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <button
              key={f.to}
              onClick={() => onLaunch(f.to)}
              className="group rounded-2xl border border-[#1e293f] bg-panel p-6 text-left transition hover:-translate-y-0.5 hover:border-[#34507e]"
            >
              <div
                className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: f.accent, background: `${f.accent}1a` }}
              >
                {f.tag}
              </div>
              <h3 className="text-xl font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              <div
                className="mt-4 text-sm font-semibold opacity-0 transition group-hover:opacity-100"
                style={{ color: f.accent }}
              >
                Open →
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          <Stat value="6" label="Algorithms" />
          <Stat value={cityNodeCount.toLocaleString()} label="Real intersections" />
          <Stat value={cityEdgeCount.toLocaleString()} label="Road segments" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a2440] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['React', 'TypeScript', 'Vite', 'Tailwind', 'Leaflet', 'Recharts'].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#22304f] px-3 py-1 text-xs text-muted"
                >
                  {t}
                </span>
              ),
            )}
          </div>
          <p className="text-sm text-muted">
            Built by <span className="font-semibold text-ink">Abijith</span> · RV
            College of Engineering — a Design &amp; Analysis of Algorithms project.
          </p>
        </div>
      </footer>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#1e293f] bg-panel py-6">
      <div className="font-mono text-3xl font-bold text-accent">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  )
}
