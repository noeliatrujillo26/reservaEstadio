// ═══════════════════════════════════════════════════════════════════
// completados.jsx — archivo del Pipeline.
// espejo 1:1 de v1: #page-completados de index.html (lineas 2034-2065) y
// renderCompletados() (js/modules/pipeline.js).
//
// Son las tarjetas en etapa 'completado': procesos finalizados con exito,
// con sus boletos ya enviados y archivados fuera del tablero.
//
// SOLO LECTURA: se omiten "Detalle" y "Restaurar" — restaurar devuelve la
// tarjeta a Boletos enviados, o sea escribe su etapa en la base.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { filtrar_completados, folios_completado, series_de } from '../../lib/pipeline'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function completados() {
  const { pipeline: cards, juegos, cargando, errores } = useadmindatos()

  const [busqueda, setbusqueda] = useState('')
  const [serie, setserie] = useState('')
  const [juego, setjuego] = useState('')

  const series = useMemo(() => series_de(juegos), [juegos])
  const juegos_filtro = useMemo(
    () => (serie ? juegos.filter((j) => j.serie === serie) : juegos),
    [juegos, serie]
  )
  const serie_ids = serie ? juegos_filtro.map((j) => String(j.id)) : null

  const filas = useMemo(
    () => filtrar_completados(cards, { busqueda, juego, seriejuegoids: serie_ids }),
    [cards, busqueda, juego, serie_ids]
  )

  // etiqueta del juego, como _compJuegoLabel().
  function etiqueta_juego(id) {
    const j = juegos.find((x) => String(x.id) === String(id))
    if (!j) return '—'
    const f = new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    return f + ' · vs ' + j.rival
  }

  return (
    <div className="page active" id="page-completados">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2>Completados</h2>
            <p>Historial de procesos finalizados con éxito · boletos enviados y archivados</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input btn-sm" id="comp-buscar" placeholder="Buscar folio o cliente…"
              style={{ width: '200px' }}
              value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
            />
            <select
              className="input select btn-sm" id="comp-filtro-serie" style={{ width: '170px' }}
              value={serie}
              onChange={(e) => { setserie(e.target.value); setjuego('') }}
            >
              <option value="">Todas las series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.desde} · vs {s.rival}</option>
              ))}
            </select>
            <select
              className="input select btn-sm" id="comp-filtro-juego" style={{ width: '165px' }}
              value={juego} onChange={(e) => setjuego(e.target.value)}
            >
              <option value="">Todos los juegos</option>
              {juegos_filtro.map((j) => (
                <option key={j.id} value={String(j.id)}>{etiqueta_juego(j.id)}</option>
              ))}
            </select>
            <span id="completados-count" style={{ fontSize: '12px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
              {filas.length} completado{filas.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Folio</th>
                <th>Cliente</th>
                <th>Zona</th>
                <th>Juego</th>
                <th style={{ whiteSpace: 'nowrap' }}>Monto</th>
                <th>Vendedora</th>
              </tr>
            </thead>
            <tbody id="completados-tbody">
              {filas.map((c) => (
                <tr key={c.id} style={{ verticalAlign: 'middle' }}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 700, color: 'var(--naranja)' }}>
                    {folios_completado(c) || '—'}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '13px' }}>{c.nombre || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{c.zona || '—'}</td>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{etiqueta_juego(c.juego)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--naranja)', whiteSpace: 'nowrap' }}>
                    {money(c.monto)}
                  </td>
                  <td style={{ fontSize: '12px' }}>{c.vendedora || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div id="completados-empty" className="empty-state">
              <div className="empty-state-icon">✅</div>
              <p>
                {errores.includes('pipeline_prospectos')
                  ? 'No se pudo leer la tabla del pipeline'
                  : 'Aún no hay procesos completados'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
