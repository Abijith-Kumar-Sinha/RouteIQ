// Huffman coding — build an optimal prefix-free code by greedily merging
// the two least-frequent symbols until one tree remains. Used here to
// "compress" the route manifest before transmission. Syllabus: Unit IV
// (Greedy Technique — Huffman Trees and codes).

export interface HuffNode {
  id: number
  char?: string
  freq: number
  left?: HuffNode
  right?: HuffNode
}

export interface HuffmanResult {
  tree: HuffNode | null
  codes: Record<string, string>
  freq: Record<string, number>
  encoded: string
  originalBits: number
  encodedBits: number
  ratio: number
  complexity: string
  opsTotal: number
}

export function huffman(text: string): HuffmanResult {
  const freq: Record<string, number> = {}
  for (const ch of text) freq[ch] = (freq[ch] ?? 0) + 1

  let ops = 0
  let counter = 0

  // Min-priority queue, kept sorted by frequency (small inputs → fine).
  let heap: HuffNode[] = Object.entries(freq).map(([char, f]) => ({
    id: counter++,
    char,
    freq: f,
  }))
  heap.sort((a, b) => a.freq - b.freq)

  if (heap.length === 0) {
    return {
      tree: null,
      codes: {},
      freq,
      encoded: '',
      originalBits: 0,
      encodedBits: 0,
      ratio: 0,
      complexity: 'O(n log n)',
      opsTotal: 0,
    }
  }

  // Edge case: a single distinct symbol still needs one bit.
  if (heap.length === 1) {
    const only = heap[0]
    const codes = { [only.char as string]: '0' }
    const encoded = '0'.repeat(only.freq)
    const originalBits = text.length * 8
    return {
      tree: only,
      codes,
      freq,
      encoded,
      originalBits,
      encodedBits: encoded.length,
      ratio: originalBits ? 1 - encoded.length / originalBits : 0,
      complexity: 'O(n log n)',
      opsTotal: heap.length,
    }
  }

  while (heap.length > 1) {
    ops++
    const left = heap.shift() as HuffNode
    const right = heap.shift() as HuffNode
    const merged: HuffNode = {
      id: counter++,
      freq: left.freq + right.freq,
      left,
      right,
    }
    // Insert the merged node back in sorted position.
    let i = 0
    while (i < heap.length && heap[i].freq <= merged.freq) i++
    heap.splice(i, 0, merged)
  }

  const tree = heap[0]
  const codes: Record<string, string> = {}
  assignCodes(tree, '', codes)

  const encoded = [...text].map((ch) => codes[ch]).join('')
  const originalBits = text.length * 8 // assume 8-bit ASCII baseline
  const encodedBits = encoded.length

  return {
    tree,
    codes,
    freq,
    encoded,
    originalBits,
    encodedBits,
    ratio: originalBits ? 1 - encodedBits / originalBits : 0,
    complexity: 'O(n log n) — n distinct symbols',
    opsTotal: ops,
  }
}

function assignCodes(
  node: HuffNode,
  prefix: string,
  out: Record<string, string>,
): void {
  if (node.char !== undefined) {
    out[node.char] = prefix || '0'
    return
  }
  if (node.left) assignCodes(node.left, prefix + '0', out)
  if (node.right) assignCodes(node.right, prefix + '1', out)
}
