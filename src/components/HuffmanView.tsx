import { useMemo } from 'react'
import { huffman, type HuffNode } from '../algorithms/huffman'

interface Props {
  text: string
}

interface Positioned {
  node: HuffNode
  x: number
  y: number
}

export default function HuffmanView({ text }: Props) {
  const result = useMemo(() => huffman(text), [text])

  // Lay the tree out: assign x by in-order index, y by depth.
  const { positioned, edges, width, height } = useMemo(() => {
    const positioned: Positioned[] = []
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
    let leafX = 0
    const X_GAP = 64
    const Y_GAP = 86

    function place(node: HuffNode, depth: number): Positioned {
      let x: number
      if (!node.left && !node.right) {
        x = leafX * X_GAP + 40
        leafX++
      } else {
        const l = node.left ? place(node.left, depth + 1) : null
        const r = node.right ? place(node.right, depth + 1) : null
        const xs = [l?.x, r?.x].filter((v): v is number => v !== undefined)
        x = xs.reduce((a, b) => a + b, 0) / xs.length
        if (l) edges.push({ x1: x, y1: depth * Y_GAP + 40, x2: l.x, y2: (depth + 1) * Y_GAP + 40 })
        if (r) edges.push({ x1: x, y1: depth * Y_GAP + 40, x2: r.x, y2: (depth + 1) * Y_GAP + 40 })
      }
      const p = { node, x, y: depth * Y_GAP + 40 }
      positioned.push(p)
      return p
    }

    if (result.tree) place(result.tree, 0)
    const maxX = Math.max(80, ...positioned.map((p) => p.x)) + 60
    const maxY = Math.max(80, ...positioned.map((p) => p.y)) + 60
    return { positioned, edges, width: maxX, height: maxY }
  }, [result.tree])

  const sortedCodes = Object.entries(result.codes).sort(
    (a, b) => a[1].length - b[1].length,
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end gap-6">
        <Stat label="Original" value={`${result.originalBits} bits`} />
        <Stat label="Encoded" value={`${result.encodedBits} bits`} accent />
        <Stat
          label="Saved"
          value={`${(result.ratio * 100).toFixed(1)}%`}
          accent="success"
        />
        <Stat label="Symbols" value={String(Object.keys(result.freq).length)} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-4">
        <div className="min-h-0 overflow-auto rounded-xl border border-[#1e293f] bg-[#0b1120]">
          <svg width={width} height={height} className="min-h-full min-w-full">
            {edges.map((e, i) => {
              const midX = (e.x1 + e.x2) / 2
              const midY = (e.y1 + e.y2) / 2
              const bit = e.x2 < e.x1 ? '0' : '1'
              return (
                <g key={i}>
                  <line
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke="#33415f"
                    strokeWidth={2}
                  />
                  <text
                    x={midX}
                    y={midY}
                    fontSize={12}
                    fontFamily="var(--font-mono)"
                    fill={bit === '0' ? 'var(--color-accent)' : 'var(--color-frontier)'}
                    textAnchor="middle"
                  >
                    {bit}
                  </text>
                </g>
              )
            })}
            {positioned.map((p) => {
              const isLeaf = p.node.char !== undefined
              return (
                <g key={p.node.id} transform={`translate(${p.x} ${p.y})`}>
                  <circle
                    r={isLeaf ? 20 : 15}
                    fill={isLeaf ? '#0b2f44' : '#1c2740'}
                    stroke={isLeaf ? 'var(--color-accent)' : '#3a496e'}
                    strokeWidth={2.5}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isLeaf ? 13 : 11}
                    fontFamily="var(--font-mono)"
                    fontWeight={700}
                    fill="#e5e9f0"
                  >
                    {isLeaf ? showChar(p.node.char!) : p.node.freq}
                  </text>
                  {isLeaf && (
                    <text
                      y={33}
                      textAnchor="middle"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      fill="#7c89a8"
                    >
                      {p.node.freq}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto rounded-xl border border-[#1e293f] bg-panel p-4">
          <div className="text-xs uppercase tracking-wider text-muted">
            Code table
          </div>
          <table className="font-mono text-sm">
            <tbody>
              {sortedCodes.map(([ch, code]) => (
                <tr key={ch}>
                  <td className="py-1 pr-3 text-ink">{showChar(ch)}</td>
                  <td className="py-1 pr-3 text-muted">{result.freq[ch]}×</td>
                  <td className="py-1 text-accent">{code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e293f] bg-panel p-3">
        <div className="mb-1 text-xs uppercase tracking-wider text-muted">
          Encoded bitstream
        </div>
        <div className="max-h-20 overflow-auto break-all font-mono text-xs text-[var(--color-frontier)]">
          {result.encoded || '—'}
        </div>
      </div>
    </div>
  )
}

function showChar(ch: string) {
  if (ch === ' ') return '␣'
  if (ch === '\n') return '⏎'
  return ch
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean | 'success'
}) {
  const color =
    accent === 'success'
      ? 'text-[var(--color-success)]'
      : accent
        ? 'text-accent'
        : 'text-ink'
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-mono text-lg ${color}`}>{value}</div>
    </div>
  )
}
