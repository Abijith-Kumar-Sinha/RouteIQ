import type { Graph } from '../algorithms/types'
import type { Parcel } from '../algorithms/knapsack'

// A default road network to land on. Coordinates live in an 1000×620
// virtual canvas; the SVG scales to fit. Weights are notional "km / cost".

export const defaultGraph: Graph = {
  nodes: [
    { id: 'A', label: 'Depot', x: 130, y: 120 },
    { id: 'B', label: 'Hub North', x: 360, y: 70 },
    { id: 'C', label: 'Westend', x: 120, y: 360 },
    { id: 'D', label: 'Central', x: 410, y: 300 },
    { id: 'E', label: 'Eastgate', x: 690, y: 150 },
    { id: 'F', label: 'Riverside', x: 380, y: 520 },
    { id: 'G', label: 'Old Town', x: 660, y: 400 },
    { id: 'H', label: 'Market', x: 870, y: 300 },
    { id: 'I', label: 'Harbour', x: 700, y: 560 },
    { id: 'J', label: 'Uptown', x: 880, y: 520 },
  ],
  edges: [
    { id: 'e1', source: 'A', target: 'B', weight: 7 },
    { id: 'e2', source: 'A', target: 'C', weight: 9 },
    { id: 'e3', source: 'A', target: 'D', weight: 14 },
    { id: 'e4', source: 'B', target: 'D', weight: 9 },
    { id: 'e5', source: 'B', target: 'E', weight: 11 },
    { id: 'e6', source: 'C', target: 'D', weight: 8 },
    { id: 'e7', source: 'C', target: 'F', weight: 12 },
    { id: 'e8', source: 'D', target: 'E', weight: 10 },
    { id: 'e9', source: 'D', target: 'F', weight: 7 },
    { id: 'e10', source: 'D', target: 'G', weight: 13 },
    { id: 'e11', source: 'E', target: 'G', weight: 6 },
    { id: 'e12', source: 'E', target: 'H', weight: 9 },
    { id: 'e13', source: 'F', target: 'I', weight: 10 },
    { id: 'e14', source: 'G', target: 'H', weight: 8 },
    { id: 'e15', source: 'G', target: 'I', weight: 7 },
    { id: 'e16', source: 'H', target: 'J', weight: 6 },
    { id: 'e17', source: 'I', target: 'J', weight: 9 },
  ],
}

export const defaultParcels: Parcel[] = [
  { id: 'p1', name: 'Electronics', weight: 6, value: 30 },
  { id: 'p2', name: 'Medicine', weight: 3, value: 14 },
  { id: 'p3', name: 'Books', weight: 4, value: 16 },
  { id: 'p4', name: 'Furniture', weight: 10, value: 40 },
  { id: 'p5', name: 'Groceries', weight: 5, value: 18 },
  { id: 'p6', name: 'Apparel', weight: 2, value: 9 },
]

export const defaultCapacity = 15
