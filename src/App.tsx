import { lazy, Suspense, useState } from 'react'
import Landing from './views/Landing'

const StudioView = lazy(() => import('./views/StudioView'))
const MapView = lazy(() => import('./views/MapView'))
const RaceView = lazy(() => import('./views/RaceView'))
const SimulationView = lazy(() => import('./views/SimulationView'))
const BenchmarkView = lazy(() => import('./views/BenchmarkView'))

export type View = 'home' | 'studio' | 'map' | 'race' | 'sim' | 'benchmark'

const NAV: { id: View; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'map', label: 'City Map' },
  { id: 'race', label: 'Race Arena' },
  { id: 'sim', label: 'Simulation' },
  { id: 'benchmark', label: 'Benchmark' },
]

export default function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav view={view} setView={setView} />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<Loading />}>
          {view === 'home' && <Landing onLaunch={setView} />}
          {view === 'studio' && <StudioView />}
          {view === 'map' && <MapView />}
          {view === 'race' && <RaceView />}
          {view === 'sim' && <SimulationView />}
          {view === 'benchmark' && <BenchmarkView />}
        </Suspense>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex items-center gap-3 text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2b3756] border-t-[var(--color-accent)]" />
        Loading…
      </div>
    </div>
  )
}

function TopNav({
  view,
  setView,
}: {
  view: View
  setView: (v: View) => void
}) {
  return (
    <header className="flex items-center justify-between border-b border-[#1a2440] bg-panel px-5 py-2.5">
      <button
        onClick={() => setView('home')}
        className="flex items-center gap-3"
        title="Home"
      >
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] font-bold text-bg">
          R
        </div>
        <div className="text-left">
          <div className="text-lg font-bold leading-none text-ink">
            Route<span className="text-accent">IQ</span>
          </div>
          <div className="text-[11px] text-muted">Visual logistics engine</div>
        </div>
      </button>

      <nav className="flex items-center gap-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === n.id
                ? 'bg-[#0c2236] font-semibold text-accent'
                : 'text-muted hover:bg-panel-2 hover:text-ink'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
