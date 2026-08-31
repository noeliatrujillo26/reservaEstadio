// ═══════════════════════════════════════════════════════════════════
// dinero.js — redondeo y formato de importes.
// espejo 1:1 de v1: redondearDinero(), fmtDinero() y _MXN2 de panel-inicio.html.
// el redondeo AL CENTAVO tiene que dar exactamente lo mismo que
// api/_lib/dinero.js del servidor, o el checkout se rechaza con 400.
// ═══════════════════════════════════════════════════════════════════

export const mxn2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

export function redondear_dinero(n) {
  const v = Number(n)
  if (!isFinite(v)) return 0
  const r = Math.round(Math.abs(v) * 100 + 1e-9) / 100
  return v < 0 ? -r : r
}

// dos decimales siempre, tambien en importes cerrados ($9,750.00).
export function fmt_dinero(n) {
  return redondear_dinero(n).toLocaleString('es-MX', mxn2)
}
