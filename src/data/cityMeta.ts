// Lightweight city metadata — safe to import anywhere (e.g. the landing
// page) without pulling in the multi-megabyte road graph.
import meta from './cityMeta.json'

export const cityName: string = meta.city
export const cityCenter: [number, number] = [meta.center.lat, meta.center.lon]
export const cityNodeCount: number = meta.nodeCount
export const cityEdgeCount: number = meta.edgeCount
export const cityBBox = meta.bbox
