import { useState } from 'react'
import { knapsack, type Parcel } from '../algorithms/knapsack'

interface Props {
  parcels: Parcel[]
  capacity: number
}

export default function KnapsackView({ parcels, capacity }: Props) {
  const [cap, setCap] = useState(capacity)
  const [hover, setHover] = useState<{ i: number; w: number } | null>(null)
  const result = knapsack(parcels, cap)
  const chosen = new Set(result.chosen)

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted">
            Truck capacity
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className="w-48 accent-[var(--color-accent)]"
            />
            <span className="font-mono text-lg text-accent">{cap}</span>
          </div>
        </div>
        <Stat label="Best value" value={`₹${result.bestValue}`} accent="success" />
        <Stat label="Weight used" value={`${result.usedWeight} / ${cap}`} />
        <Stat label="DP operations" value={String(result.opsTotal)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {parcels.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              chosen.has(p.id)
                ? 'border-[var(--color-success)] bg-[#0c2a20] text-[var(--color-success)]'
                : 'border-[#2b3756] bg-panel-2 text-muted'
            }`}
          >
            <div className="font-semibold">{p.name}</div>
            <div className="font-mono text-xs">
              w {p.weight} · ₹{p.value}
              {chosen.has(p.id) && ' · LOADED'}
            </div>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#1e293f]">
        <table className="border-collapse font-mono text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-10 bg-panel px-2 py-1 text-muted">
                item ＼ w
              </th>
              {range(cap + 1).map((w) => (
                <th key={w} className="bg-panel px-2 py-1 text-center text-muted">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.table.map((row, i) => (
              <tr key={i}>
                <th className="sticky left-0 z-10 whitespace-nowrap bg-panel px-2 py-1 text-left text-muted">
                  {i === 0 ? '∅' : parcels[i - 1].name}
                </th>
                {row.map((v, w) => {
                  const isHover = hover && hover.i === i && hover.w === w
                  return (
                    <td
                      key={w}
                      onMouseEnter={() => setHover({ i, w })}
                      onMouseLeave={() => setHover(null)}
                      className={`px-2 py-1 text-center transition-colors ${
                        isHover
                          ? 'bg-[var(--color-accent)] text-bg'
                          : v > 0
                            ? 'text-ink'
                            : 'text-[#3c4a6b]'
                      }`}
                      style={{
                        background:
                          !isHover && v > 0
                            ? `rgba(56,189,248,${Math.min(0.28, v / (result.bestValue || 1) * 0.28)})`
                            : undefined,
                      }}
                    >
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Each cell <span className="font-mono">dp[i][w]</span> = best value using
        the first <span className="font-mono">i</span> parcels within weight{' '}
        <span className="font-mono">w</span>. The bottom-right cell is the optimal
        load; we backtrack up the table to recover which parcels to take.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'success'
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`font-mono text-lg ${
          accent === 'success' ? 'text-[var(--color-success)]' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}
