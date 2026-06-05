import type { Map as LeafletMap } from 'leaflet'

export type Bounds = [[number, number], [number, number]] // [[s,w],[n,e]]

/** Is a lat/lon inside the coverage box? */
export function inBounds(b: Bounds, lat: number, lon: number): boolean {
  return lat >= b[0][0] && lat <= b[1][0] && lon >= b[0][1] && lon <= b[1][1]
}

/**
 * Dim everything outside the coverage box (Yulu-style service-area mask) and
 * outline the routable region with a dashed boundary. Call right after
 * clearing the canvas so roads/pins draw on top of the clear interior.
 */
export function drawCoverageMask(
  ctx: CanvasRenderingContext2D,
  map: LeafletMap,
  b: Bounds,
) {
  const size = map.getSize()
  const p1 = map.latLngToContainerPoint([b[1][0], b[0][1]]) // NW
  const p2 = map.latLngToContainerPoint([b[0][0], b[1][1]]) // SE
  const x1 = Math.min(p1.x, p2.x)
  const x2 = Math.max(p1.x, p2.x)
  const y1 = Math.min(p1.y, p2.y)
  const y2 = Math.max(p1.y, p2.y)

  // Translucent fill over the outside (even-odd punches a hole for the inside).
  ctx.save()
  ctx.fillStyle = 'rgba(6,9,16,0.6)'
  ctx.beginPath()
  ctx.rect(0, 0, size.x, size.y)
  ctx.rect(x1, y1, x2 - x1, y2 - y1)
  ctx.fill('evenodd')
  ctx.restore()

  ctx.strokeStyle = 'rgba(56,189,248,0.55)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  ctx.setLineDash([])
}
