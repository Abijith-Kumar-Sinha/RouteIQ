// Instrumented sorts for the Benchmark Lab. Each returns the number of
// key comparisons performed — the standard "basic operation" whose count is
// what Big-O analysis predicts. They sort a copy so the caller can reuse the
// same input array across algorithms for a fair comparison.

export function selectionSort(input: number[]): number {
  const a = input.slice()
  let ops = 0
  for (let i = 0; i < a.length - 1; i++) {
    let min = i
    for (let j = i + 1; j < a.length; j++) {
      ops++
      if (a[j] < a[min]) min = j
    }
    if (min !== i) {
      const t = a[i]
      a[i] = a[min]
      a[min] = t
    }
  }
  return ops
}

export function bubbleSort(input: number[]): number {
  const a = input.slice()
  let ops = 0
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      ops++
      if (a[j] > a[j + 1]) {
        const t = a[j]
        a[j] = a[j + 1]
        a[j + 1] = t
      }
    }
  }
  return ops
}

export function insertionSort(input: number[]): number {
  const a = input.slice()
  let ops = 0
  for (let i = 1; i < a.length; i++) {
    const key = a[i]
    let j = i - 1
    while (j >= 0) {
      ops++
      if (a[j] <= key) break
      a[j + 1] = a[j]
      j--
    }
    a[j + 1] = key
  }
  return ops
}

export function mergeSort(input: number[]): number {
  const a = input.slice()
  let ops = 0
  function ms(lo: number, hi: number) {
    if (hi - lo <= 1) return
    const mid = (lo + hi) >> 1
    ms(lo, mid)
    ms(mid, hi)
    const tmp: number[] = []
    let i = lo
    let j = mid
    while (i < mid && j < hi) {
      ops++
      if (a[i] <= a[j]) tmp.push(a[i++])
      else tmp.push(a[j++])
    }
    while (i < mid) tmp.push(a[i++])
    while (j < hi) tmp.push(a[j++])
    for (let k = 0; k < tmp.length; k++) a[lo + k] = tmp[k]
  }
  ms(0, a.length)
  return ops
}

export function quickSort(input: number[]): number {
  const a = input.slice()
  let ops = 0
  function qs(lo: number, hi: number) {
    if (lo >= hi) return
    const pivot = a[hi]
    let i = lo
    for (let j = lo; j < hi; j++) {
      ops++
      if (a[j] < pivot) {
        const t = a[i]
        a[i] = a[j]
        a[j] = t
        i++
      }
    }
    const t = a[i]
    a[i] = a[hi]
    a[hi] = t
    qs(lo, i - 1)
    qs(i + 1, hi)
  }
  qs(0, a.length - 1)
  return ops
}
