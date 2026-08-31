// ═══════════════════════════════════════════════════════════════════
// dashboard.jsx — vista principal del panel.
// espejo 1:1 de v1: #page-dashboard de index.html (lineas 1886-1975) y
// loadDashboardStats() de js/modules/dashboard.js.
//
// las 8 piezas de la v1, en el mismo orden: 4 tarjetas de KPI, ingresos por
// juego, ocupacion por seccion, actividad reciente y proximas series.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { calcular_dashboard, colores_categoria } from '../../lib/dashboard'
import { redondear_dinero, mxn2 } from '../../lib/dinero'
import app_config from '../../lib/config'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)
const fmt_k = (v) => (v >= 1000 ? '$' + Math.round(v / 100) / 10 + 'k' : money(v))
const fmt_fecha = (f) =>
  new Date(f + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

const iconos_mov = {
  Pago: ['💵', '#DCFCE7'],
  Enganche: ['⏳', '#FEF9C3'],
  Reserva: ['📋', '#DBEAFE'],
  Admin: ['⚙️', '#F1F3F7'],
}

const vacio = { fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }

export default function dashboard() {
  const { cobros, reservas, juegos, areas, areasestados, movimientos, cargando, errores } =
    useadmindatos()

  const d = useMemo(
    () => calcular_dashboard({ cobros, reservas, juegos, areas, areasestados, movimientos }),
    [cobros, reservas, juegos, areas, areasestados, movimientos]
  )

  return (
    <div className="page active" id="page-dashboard">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Dashboard</h2>
            <p>{app_config.temporadalabel} · Estadio Fernando Valenzuela</p>
          </div>
        </div>

        {cargando && (
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '12px' }}>
            Cargando datos…
          </p>
        )}
        {!cargando && errores.length > 0 && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--text-2)' }}>
            ⚠ No se pudieron leer: <b>{errores.join(', ')}</b>. Las demás cifras sí están
            actualizadas.
          </div>
        )}

        {/* ── 4 tarjetas de KPI ── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: '#FFF0E8' }}>💰</div>
            <div className="stat-card-label">Ingresos del mes</div>
            <div className="stat-card-value" id="dash-ingresos">{money(d.ingresos)}</div>
            <div className="stat-card-delta" id="dash-ingresos-delta">
              {d.ingresos_delta ? (
                <>
                  <span className={d.ingresos_delta.pct >= 0 ? 'delta-up' : 'delta-down'}>
                    {(d.ingresos_delta.pct >= 0 ? '↑ ' : '↓ ') + Math.abs(d.ingresos_delta.pct) + '%'}
                  </span>{' '}
                  vs mes anterior
                </>
              ) : (
                d.ingresos_texto
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: '#DCFCE7' }}>📋</div>
            <div className="stat-card-label">Reservas activas</div>
            <div className="stat-card-value" id="dash-reservas">{d.reservas_activas}</div>
            <div className="stat-card-delta" id="dash-reservas-delta">{d.reservas_texto}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: '#DBEAFE' }}>🏟️</div>
            <div className="stat-card-label">Ocupación promedio</div>
            <div className="stat-card-value" id="dash-ocupacion">{d.ocupacion}%</div>
            <div className="stat-card-delta" id="dash-ocupacion-delta">{d.ocupacion_texto}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: '#EDE9FE' }}>⏳</div>
            <div className="stat-card-label">Enganches pendientes</div>
            <div className="stat-card-value" id="dash-enganches">{money(d.enganches)}</div>
            <div className="stat-card-delta" id="dash-enganches-delta">{d.enganches_texto}</div>
          </div>
        </div>

        {/* ── Ingresos por juego · Ocupación por sección ── */}
        <div className="grid-2" style={{ marginBottom: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Ingresos por juego</div>
                <div className="card-sub" id="dash-ingresos-juego-sub">
                  {d.con_ingreso.length
                    ? d.con_ingreso.length + ' juego(s) con ingresos registrados'
                    : 'Sin datos aún'}
                </div>
              </div>
            </div>
            <div className="card-body" id="dash-ingresos-juego">
              {d.con_ingreso.length ? (
                <div className="bar-chart">
                  {d.con_ingreso.map((j) => {
                    const v = d.por_juego[j.id]
                    return (
                      <div className="bar-wrap" key={j.id} title={'vs ' + j.rival + ' · ' + money(v)}>
                        <div className="bar-val">{fmt_k(v)}</div>
                        <div className="bar" style={{ height: Math.max(6, Math.round((v / d.max_ingreso) * 100)) + '%' }} />
                        <div className="bar-label">{fmt_fecha(j.fecha)}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={vacio}>
                  Aquí se mostrarán los ingresos conforme se registren pagos de reservas.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Ocupación por sección</div>
                <div className="card-sub" id="dash-ocupacion-sub">
                  {d.proximo && d.grupos
                    ? 'Próximo juego · ' + fmt_fecha(d.proximo.fecha) + ' vs ' + d.proximo.rival
                    : 'Sin datos'}
                </div>
              </div>
            </div>
            <div className="card-body" id="dash-ocupacion-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {d.grupos ? (
                Object.entries(d.grupos).map(([cat, g]) => {
                  const pct = g.total ? Math.round((g.res / g.total) * 100) : 0
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>{cat} ({g.res}/{g.total})</span>
                        <span className="fw-700">{pct}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#F1F3F7', borderRadius: '3px' }}>
                        <div style={{ width: pct + '%', height: '100%', background: colores_categoria[cat] || 'var(--naranja)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p style={vacio}>Sin juegos próximos o secciones configuradas.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Actividad reciente · Próximas series ── */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">Actividad reciente</div></div>
            <div className="card-body" id="dash-actividad" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
              {d.actividad.length ? (
                <div className="timeline">
                  {d.actividad.map((m, i) => {
                    const [ic, bg] = iconos_mov[m.tipo] || ['•', '#F1F3F7']
                    return (
                      <div className="tl-item" key={i}>
                        <div className="tl-dot" style={{ background: bg, fontSize: '14px' }}>{ic}</div>
                        <div className="tl-content">
                          <div className="tl-title">{m.desc}</div>
                          <div className="tl-meta">
                            {[m.usuario, m.ts].filter(Boolean).join(' · ')}
                            {m.monto ? ' · ' + money(m.monto) : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={vacio}>Sin movimientos registrados todavía.</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Próximas series en casa</div></div>
            <div className="card-body" id="dash-series" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
              {d.series.length ? (
                d.series.map((s, i) => {
                  const ini = fmt_fecha(s.juegos[0].fecha)
                  const fin = fmt_fecha(s.juegos[s.juegos.length - 1].fecha)
                  const rango = ini === fin ? ini : ini + ' – ' + fin
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>vs {s.rival}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{rango}</div>
                      </div>
                      <span className="badge badge-orange">
                        {s.juegos.length} juego{s.juegos.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })
              ) : (
                <p style={vacio}>No hay juegos próximos en el calendario.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
