// ═══════════════════════════════════════════════════════════════════
// reservas.jsx — vista "Reservas" (secciones reservadas por juego).
// espejo 1:1 de v1: #page-seccionesreservadas de index.html (lineas
// 2805-2867) y renderSeccionesResTabla()/renderSeccionesResKPIs() de
// js/20-editor-mapa.js.
//
// SOLO LECTURA: se omite la columna de Acciones (ver detalle, WhatsApp,
// compartir codigo, eliminar reserva y bloquear/desbloquear seccion) y los
// botones de reporte — todos escriben o disparan efectos externos.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  badge_categoria, badge_estado, es_palco_compartido, filas_reservas,
  folio_visible, label_estado, total_personas_seccion,
} from '../../lib/reservasadmin'
import { hoy_hermosillo } from '../../lib/fechas'

export default function reservas() {
  const { reservas: todas, cobros, juegos, areas, areasestados, cargando } = useadmindatos()

  const [juegoid, setjuegoid] = useState('')
  const [soloocupadas, setsoloocupadas] = useState(false)
  const [tipozona, settipozona] = useState('')

  // al llegar los juegos se preselecciona el proximo, igual que hace
  // seleccionarProximoJuegoRes() en la v1.
  useEffect(() => {
    if (juegoid || !juegos.length) return
    const hoy = hoy_hermosillo()
    const prox = juegos.find((j) => (j.fecha || '') >= hoy) || juegos[0]
    if (prox) setjuegoid(String(prox.id))
  }, [juegos, juegoid])

  // String() en ambos lados: el value del select es texto y el id del juego
  // puede ser numerico — la comparacion estricta dejaba la tabla vacia.
  const juego = juegos.find((x) => String(x.id) === String(juegoid)) || null

  const datos = useMemo(
    () => filas_reservas({ areas, reservas: todas, cobros, areasestados, juego, soloocupadas, tipozona }),
    [areas, todas, cobros, areasestados, juego, soloocupadas, tipozona]
  )

  const subtitulo = juego
    ? new Date(juego.fecha + 'T12:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      }) + ' · vs ' + juego.rival + ' · Juego ' + juego.num + ' · ' + juego.hora + ' h'
    : 'Disponibilidad por sección y juego'

  const conteo = !datos
    ? '0 filas'
    : soloocupadas || tipozona
      ? datos.filas.length + ' de ' + datos.total + ' secciones'
      : datos.total + ' secciones'

  return (
    <div className="page active" id="page-seccionesreservadas">
      <div className="page-inner" style={{ padding: '28px' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Reservas</h2>
            <p>Secciones con estado de reserva por juego de la temporada</p>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div id="sr-kpis" className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-label">Secciones</div>
            <div className="stat-card-value">{datos ? datos.total : 0}</div>
            <div className="stat-card-delta">en el juego</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Libres</div>
            <div className="stat-card-value" style={{ color: 'var(--verde)' }}>{datos ? datos.libres : 0}</div>
            <div className="stat-card-delta delta-up">
              {datos && datos.total > 0 ? Math.round((datos.libres / datos.total) * 100) : 0}% disponible
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Reservadas</div>
            <div className="stat-card-value" style={{ color: 'var(--azul)' }}>{datos ? datos.reservadas : 0}</div>
            <div className="stat-card-delta">{datos ? datos.pctocup : 0}% ocupación</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Bloqueadas</div>
            <div className="stat-card-value" style={{ color: 'var(--rojo)' }}>{datos ? datos.bloqueadas : 0}</div>
            <div className="stat-card-delta">fuera de venta</div>
          </div>
        </div>

        {/* ── controles ── */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            id="sr-filtro-juego" className="input select" style={{ width: '280px' }}
            value={juegoid} onChange={(e) => setjuegoid(e.target.value)}
          >
            <option value="">— Selecciona un juego —</option>
            {juegos.map((j) => (
              <option value={String(j.id)} key={j.id}>
                {j.fecha} · vs {j.rival}
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', marginLeft: '8px' }}>
            <div
              id="sr-toggle-wrap" onClick={() => setsoloocupadas((v) => !v)}
              style={{ width: '40px', height: '22px', borderRadius: '11px', background: soloocupadas ? 'var(--naranja)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div
                id="sr-toggle-knob"
                style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: soloocupadas ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
            </div>
            <span title="Muestra las secciones reservadas Y bloqueadas (todo lo que no está libre)">
              Solo ocupadas
            </span>
          </label>

          <select
            id="sr-filtro-tipo" className="input select" style={{ width: '190px' }}
            title="Zonas exclusivas se venden completas; los palcos compartidos se venden por lugares"
            value={tipozona} onChange={(e) => settipozona(e.target.value)}
          >
            <option value="">Todas las zonas</option>
            <option value="exclusiva">Zonas exclusivas</option>
            <option value="compartida">Palcos compartidos</option>
          </select>

          <span id="sr-count" className="badge badge-gray" style={{ marginLeft: 'auto' }}>{conteo}</span>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" id="sr-sub">{subtitulo}</div>
          </div>
          <div className="table-wrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>Nº</th>
                  <th style={{ width: '11%' }}>Folio</th>
                  <th style={{ width: '22%' }}>Sección</th>
                  <th style={{ width: '12%' }}>Categoría</th>
                  <th style={{ width: '14%' }}>Personas incluidas</th>
                  <th style={{ width: '12%' }}>Estado</th>
                  <th style={{ width: '16%' }}>Cliente</th>
                  <th style={{ width: '12%' }}>Pago</th>
                </tr>
              </thead>
              <tbody id="sr-tbody">
                {!juego && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                      {cargando ? 'Cargando datos…' : 'Selecciona un juego para ver la disponibilidad'}
                    </td>
                  </tr>
                )}

                {juego && datos && datos.filas.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                      {tipozona === 'compartida' ? (
                        <>
                          No hay palcos compartidos configurados.
                          <br />
                          <span style={{ fontSize: '12px' }}>
                            Se marcan con <b>es_compartida</b> en el editor del mapa.
                          </span>
                        </>
                      ) : soloocupadas && datos.total > 0 ? (
                        <>
                          Este juego aún no tiene secciones reservadas ni bloqueadas.
                          <br />
                          <span style={{ fontSize: '12px' }}>
                            Desactiva <b>"Solo ocupadas"</b> para ver las {datos.total} secciones del juego.
                          </span>
                        </>
                      ) : (
                        'No hay secciones configuradas para este juego'
                      )}
                    </td>
                  </tr>
                )}

                {juego && datos && datos.filas.map((f, idx) => {
                  const folio = folio_visible(f.reserva)
                  const cliente = f.reserva ? f.reserva.cliente : '—'
                  return (
                    <tr key={f.a.id}>
                      <td className="td-muted" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-3)' }}>
                        {idx + 1}
                      </td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={folio}>
                        {folio}
                      </td>
                      <td className="td-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.a.nombre}>
                        {f.a.nombre}
                        {es_palco_compartido(f.a) && (
                          <span className="badge badge-purple" style={{ fontSize: '9px', marginLeft: '6px' }}>
                            Compartido
                          </span>
                        )}
                      </td>
                      <td><span className={'badge ' + (badge_categoria[f.cat] || 'badge-gray')}>{f.cat}</span></td>
                      <td className="td-muted" style={{ textAlign: 'center' }}>
                        {total_personas_seccion(f.a, f.reserva)}
                      </td>
                      <td>
                        <span className={'badge ' + badge_estado[f.est]}>
                          <span className="bdot" />
                          {label_estado[f.est]}
                        </span>
                      </td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cliente}>
                        {cliente}
                      </td>
                      <td>
                        {f.pago ? (
                          <span
                            className={'badge ' + f.pago.badge}
                            title="Los pagos se registran desde el detalle de la reserva (Historial de Pagos)"
                          >
                            {f.pago.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
