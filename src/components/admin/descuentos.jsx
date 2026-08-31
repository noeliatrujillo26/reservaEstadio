// ═══════════════════════════════════════════════════════════════════
// descuentos.jsx — codigos de descuento y reglas por volumen.
// espejo 1:1 de v1: #page-descuentos de index.html, renderDescuentos(),
// renderDescKPIs() y renderDescVolumen() (js/modules/cotizaciones.js).
//
// SOLO LECTURA: se omiten crear, editar, activar/desactivar y eliminar.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  estado_descuento, filtrar_descuentos, fmt_desc_valor, kpis_descuentos,
  usos_label, vence_label,
} from '../../lib/catalogos'

export default function descuentos() {
  const { descuentos: todos, descuentosvolumen, cargando, errores } = useadmindatos()

  const [busqueda, setbusqueda] = useState('')
  const filas = useMemo(() => filtrar_descuentos(todos, busqueda), [todos, busqueda])
  const kpis = useMemo(() => kpis_descuentos(todos), [todos])

  const tarjetas = [
    { label: 'Códigos totales', valor: kpis.total, color: 'var(--azul)', icono: '🏷️' },
    { label: 'Activos', valor: kpis.activos, color: 'var(--verde)', icono: '✅' },
    { label: 'Usos acumulados', valor: kpis.usos, color: 'var(--naranja)', icono: '📈' },
    { label: 'Vencidos', valor: kpis.vencidos, color: 'var(--rojo)', icono: '⏰' },
  ]

  return (
    <div className="page active" id="page-descuentos">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Descuentos</h2>
            <p>Códigos promocionales y reglas de descuento por grupo</p>
          </div>
        </div>

        <div className="stats-grid" id="desc-kpis" style={{ marginBottom: '20px' }}>
          {tarjetas.map((k) => (
            <div className="stat-card" key={k.label}>
              <div className="stat-card-icon" style={{ background: k.color + '1a' }}>{k.icono}</div>
              <div className="stat-card-label">{k.label}</div>
              <div className="stat-card-value" style={{ color: k.color }}>{k.valor}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="card-title">Códigos promocionales</div>
            <input
              className="input" id="desc-search" placeholder="Buscar código o descripción…"
              style={{ width: '240px', fontSize: '13px', marginLeft: 'auto' }}
              value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Valor</th><th>Descripción</th><th>Juegos</th>
                  <th>Usos</th><th>Vence</th><th>Estado</th>
                </tr>
              </thead>
              <tbody id="descuentos-tbody">
                {filas.map((d) => {
                  const est = estado_descuento(d)
                  const juegos = d.juegosaplicables
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="tag" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>{d.codigo}</span>
                      </td>
                      <td className="td-name" style={{ color: 'var(--naranja)' }}>{fmt_desc_valor(d)}</td>
                      <td className="td-muted">{d.descripcion || '—'}</td>
                      <td>
                        {!juegos || juegos.length === 0 ? (
                          <span className="badge badge-gray">Todos</span>
                        ) : (
                          <span className="badge badge-blue">
                            {juegos.length} juego{juegos.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="td-muted">{usos_label(d)}</td>
                      <td className="td-muted">{vence_label(d)}</td>
                      <td><span className={'badge ' + est.badge}>{est.texto}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando descuentos…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🏷️</div>
              <p>
                {errores.includes('descuentos')
                  ? 'No se pudo leer la tabla de descuentos'
                  : 'Sin códigos de descuento'}
              </p>
            </div>
          )}
        </div>

        {/* ── reglas por volumen ── */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Descuento por grupo</div>
              <div className="card-sub">
                Se aplica solo con reglas activas; el servidor las vuelve a evaluar al cobrar
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Regla</th><th>Desde</th><th>Descuento</th>
                  <th>Juegos</th><th>Zonas</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {descuentosvolumen.map((r) => (
                  <tr key={r.id}>
                    <td className="td-name">{r.nombre || '—'}</td>
                    <td className="td-muted">{r.minpersonas} personas</td>
                    <td style={{ fontWeight: 700, color: 'var(--naranja)' }}>{r.porcentaje}%</td>
                    <td>
                      {r.juegos && r.juegos.length ? (
                        <span className="badge badge-blue">{r.juegos.length}</span>
                      ) : (
                        <span className="badge badge-gray">Todos</span>
                      )}
                    </td>
                    <td>
                      {r.zonas && r.zonas.length ? (
                        <span className="badge badge-blue">{r.zonas.length}</span>
                      ) : (
                        <span className="badge badge-gray">Todas</span>
                      )}
                    </td>
                    <td>
                      <span className={'badge ' + (r.activo ? 'badge-green' : 'badge-gray')}>
                        {r.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!cargando && descuentosvolumen.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <p>Sin reglas de descuento por grupo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
