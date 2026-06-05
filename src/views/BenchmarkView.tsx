import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  selectionSort,
  bubbleSort,
  insertionSort,
  mergeSort,
  quickSort,
} from '../bench/sorts'

interface BenchAlgo {
  id: string
  name: string
  bigO: string
  color: string
  quad: boolean
  f: (n: number) => number
  run: (a: number[]) => number
}

const ALGOS: BenchAlgo[] = [
  { id: 'selection', name: 'Selection Sort', bigO: 'O(n²)', color: '#f87171', quad: true, f: (n) => n * n, run: selectionSort },
  { id: 'bubble', name: 'Bubble Sort', bigO: 'O(n²)', color: '#fb923c', quad: true, f: (n) => n * n, run: bubbleSort },
  { id: 'insertion', name: 'Insertion Sort', bigO: 'O(n²)', color: '#fbbf24', quad: true, f: (n) => n * n, run: insertionSort },
  { id: 'merge', name: 'Merge Sort', bigO: 'O(n log n)', color: '#34d399', quad: false, f: (n) => n * Math.log2(Math.max(2, n)), run: mergeSort },
  { id: 'quick', name: 'Quick Sort', bigO: 'O(n log n)', color: '#38bdf8', quad: false, f: (n) => n * Math.log2(Math.max(2, n)), run: quickSort },
]

type Row = { n: number; [k: string]: number }

function fmt(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return String(Math.round(v))
}

export default function BenchmarkView() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(['selection', 'merge']),
  )
  const [metric, setMetric] = useState<'ops' | 'time'>('ops')
  const [rows, setRows] = useState<Row[]>([])
  const [fits, setFits] = useState<Record<string, number>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  const selectedList = useMemo(
    () => ALGOS.filter((a) => selected.has(a.id)),
    [selected],
  )

  async function run() {
    if (selectedList.length === 0) return
    setRunning(true)
    setRows([])
    setFits({})
    setProgress(0)

    const quad = selectedList.some((a) => a.quad)
    const maxN = quad ? 2400 : 16000
    const steps = 12
    const sizes = Array.from({ length: steps }, (_, i) =>
      Math.round((maxN * (i + 1)) / steps),
    )

    const collected: Row[] = []
    for (let s = 0; s < sizes.length; s++) {
      await new Promise((r) => setTimeout(r, 0))
      const N = sizes[s]
      const arr = Array.from({ length: N }, () => Math.random())
      const row: Row = { n: N }
      for (const a of selectedList) {
        const t0 = performance.now()
        const ops = a.run(arr)
        const t1 = performance.now()
        row[a.id] = ops
        row[a.id + '_ms'] = Number((t1 - t0).toFixed(3))
      }
      collected.push(row)
      setRows([...collected])
      setProgress((s + 1) / sizes.length)
    }

    const last = collected[collected.length - 1]
    const f: Record<string, number> = {}
    for (const a of selectedList) f[a.id] = last[a.id] / a.f(last.n)
    setFits(f)
    setRunning(false)
  }

  const chartData = useMemo(() => {
    return rows.map((r) => {
      const o: Record<string, number> = { n: r.n }
      for (const a of selectedList) {
        o[a.id] = metric === 'ops' ? r[a.id] : r[a.id + '_ms']
        if (metric === 'ops' && fits[a.id] !== undefined)
          o[a.id + '_t'] = fits[a.id] * a.f(r.n)
      }
      return o
    })
  }, [rows, fits, metric, selectedList])

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setRows([])
    setFits({})
  }

  const last = rows[rows.length - 1]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2440] bg-panel px-5 py-3">
        {ALGOS.map((a) => (
          <button
            key={a.id}
            onClick={() => toggle(a.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
              selected.has(a.id)
                ? 'border-[#34507e] bg-panel-2 text-ink'
                : 'border-[#22304f] text-muted hover:text-ink'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: selected.has(a.id) ? a.color : '#2b3756',
              }}
            />
            {a.name}
            <span className="font-mono text-[10px] text-muted">{a.bigO}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-[#2b3756] p-0.5 text-xs">
            {(['ops', 'time'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-2.5 py-1 transition ${
                  metric === m ? 'bg-[#0c2236] text-accent' : 'text-muted'
                }`}
              >
                {m === 'ops' ? 'Operations' : 'Time (ms)'}
              </button>
            ))}
          </div>
          <button
            disabled={running || selected.size === 0}
            onClick={run}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-1.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-40"
          >
            {running ? `Running ${Math.round(progress * 100)}%` : '▶ Run benchmark'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="min-h-0 flex-1 p-4">
        {rows.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted">
            <div>
              <div className="mb-2 text-2xl">📊</div>
              Pick algorithms and hit <b className="text-ink">Run benchmark</b>.
              <br />
              Each is timed on random inputs of growing size — the{' '}
              <span className="text-ink">measured</span> curve (solid) is plotted
              against the <span className="text-ink">theoretical</span> Big-O
              (dashed).
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
              <XAxis
                dataKey="n"
                stroke="#8b95a8"
                tick={{ fontSize: 12, fill: '#8b95a8' }}
                label={{ value: 'input size (n)', position: 'insideBottom', offset: -10, fill: '#8b95a8', fontSize: 12 }}
              />
              <YAxis
                stroke="#8b95a8"
                tick={{ fontSize: 12, fill: '#8b95a8' }}
                tickFormatter={fmt}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #22304f',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e5e9f0' }}
                formatter={(v) => fmt(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedList.map((a) => (
                <Line
                  key={a.id}
                  type="monotone"
                  dataKey={a.id}
                  name={`${a.name} (measured)`}
                  stroke={a.color}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {metric === 'ops' &&
                selectedList.map((a) => (
                  <Line
                    key={a.id + '_t'}
                    type="monotone"
                    dataKey={a.id + '_t'}
                    name={`${a.name} (theory)`}
                    stroke={a.color}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Result table */}
      {last && (
        <div className="border-t border-[#1a2440] bg-panel px-5 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Algorithm</th>
                <th className="py-1 font-medium">Big-O</th>
                <th className="py-1 font-medium">Ops @ n={last.n}</th>
                <th className="py-1 font-medium">Time @ n={last.n}</th>
                <th className="py-1 font-medium">Empirical c = ops / f(n)</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {selectedList.map((a) => (
                <tr key={a.id} className="border-t border-[#1a2440]">
                  <td className="py-1.5" style={{ color: a.color }}>
                    {a.name}
                  </td>
                  <td className="py-1.5 text-muted">{a.bigO}</td>
                  <td className="py-1.5 text-ink">{fmt(last[a.id])}</td>
                  <td className="py-1.5 text-ink">{last[a.id + '_ms']} ms</td>
                  <td className="py-1.5 text-accent">
                    {(last[a.id] / a.f(last.n)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
