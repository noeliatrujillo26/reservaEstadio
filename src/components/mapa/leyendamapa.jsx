// ═══════════════════════════════════════════════════════════════════
// leyendamapa.jsx — leyenda de colores del mapa.
// espejo 1:1 de v1: la leyenda estatica del html (lineas 694-701) y
// _renderLeyendaMapa() (linea 3040).
//
// se agrupa POR COLOR: cada tono presente en los pines genera su entrada,
// etiquetada con la categoria mas frecuente de las zonas de ese color. asi
// ningun color visible en el mapa queda sin representacion. sin secciones
// todavia se conserva la leyenda estatica del html, igual que la v1.
// ═══════════════════════════════════════════════════════════════════

import usemapa from '../../hooks/usemapa'
import { categoria_leyenda, orden_leyenda, color_seguro } from '../../lib/leyenda'

// leyenda estatica: primer pintado, antes de que llegue el mapa.
const estatica = [
  { color: '#1A1A1A', borde: '2px solid #555', label: 'Terraza Der.' },
  { color: '#1A6BB0', label: 'Terraza Izq.' },
  { color: '#E91E8C', label: 'Platea' },
  { color: '#fff', borde: '2px solid #999', label: 'Palco All-Inc.' },
  { color: '#E05C1A', label: 'Jardín' },
]

export default function leyendamapa() {
  const { zonas } = usemapa()

  // agrupar por color; etiqueta = categoria mas frecuente entre sus zonas.
  const por_color = {}
  Object.keys(zonas).forEach((id) => {
    const z = zonas[id]
    if (!z || !z._color) return
    const cat = categoria_leyenda(z.nombre)
    if (!cat) return
    const c = String(z._color).toLowerCase()
    if (!por_color[c]) por_color[c] = {}
    por_color[c][cat] = (por_color[c][cat] || 0) + 1
  })

  const entradas = Object.keys(por_color).map((color) => {
    const cats = por_color[color]
    const label = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0]
    return { color, label }
  })

  entradas.sort((a, b) => {
    const ia = orden_leyenda.indexOf(a.label)
    const ib = orden_leyenda.indexOf(b.label)
    return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.label.localeCompare(b.label, 'es')
  })

  // sin secciones con color: no pisar la estatica.
  const usar_estatica = entradas.length === 0

  return (
    <div className="leyenda" id="mapa-leyenda">
      {usar_estatica
        ? estatica.map((e) => (
            <div className="leyenda-item" key={e.label}>
              <span className="leyenda-dot" style={{ background: e.color, border: e.borde }} />{' '}
              {e.label}
            </div>
          ))
        : entradas.map((e) => (
            <div className="leyenda-item" key={e.color}>
              <span className="leyenda-dot" style={{ background: color_seguro(e.color) }} /> {e.label}
            </div>
          ))}
      {/* estado fijo al final: el MISMO gris que pintan las zonas
          bloqueadas/reservadas (#999999 con opacidad 0.55). */}
      <div className="leyenda-item">
        <span className="leyenda-dot" style={{ background: '#999999', opacity: 0.55 }} /> No
        disponible
      </div>
    </div>
  )
}
