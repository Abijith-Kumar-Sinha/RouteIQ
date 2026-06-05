// 0/1 Knapsack via dynamic programming — decide which parcels to load
// into a truck of fixed capacity to maximise delivered value, taking each
// parcel whole or not at all. Syllabus: Unit IV (Dynamic Programming).

export interface Parcel {
  id: string
  name: string
  weight: number
  value: number
}

export interface KnapsackResult {
  /** dp[i][w] = best value using first i parcels within capacity w. */
  table: number[][]
  capacity: number
  parcels: Parcel[]
  chosen: string[]
  bestValue: number
  usedWeight: number
  complexity: string
  opsTotal: number
}

export function knapsack(parcels: Parcel[], capacity: number): KnapsackResult {
  const n = parcels.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0),
  )
  let ops = 0

  for (let i = 1; i <= n; i++) {
    const { weight, value } = parcels[i - 1]
    for (let w = 0; w <= capacity; w++) {
      ops++
      if (weight <= w) {
        // Best of: skip this parcel, or take it plus best of the rest.
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value)
      } else {
        dp[i][w] = dp[i - 1][w]
      }
    }
  }

  // Backtrack through the table to recover which parcels were chosen.
  const chosen: string[] = []
  let w = capacity
  let usedWeight = 0
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const p = parcels[i - 1]
      chosen.push(p.id)
      usedWeight += p.weight
      w -= p.weight
    }
  }
  chosen.reverse()

  return {
    table: dp,
    capacity,
    parcels,
    chosen,
    bestValue: dp[n][capacity],
    usedWeight,
    complexity: 'O(n · W) — n parcels, capacity W',
    opsTotal: ops,
  }
}
