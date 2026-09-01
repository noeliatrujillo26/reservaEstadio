// ═══════════════════════════════════════════════════════════════════
// reportes.jsx — analisis de ventas, cobros y ocupacion.
// espejo 1:1 de v1: #page-reportes de index.html (lineas 2382-2458) y
// renderReportes() / _repDatos() / _repRango() (js/modules/cobros.js).
//
// SOLO LECTURA: se omiten los exports a PDF y Excel.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { barras, datos_reporte, mas_frecuente, mes_label, rango_reporte } from '../../lib/reportes'
import { redondear_dinero, mxn2 } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// grafica de barras horizontales, igual que la de la v1.
function grafica({ datos, etiquetar }) {
  if (!datos.length) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
        Sin cobros registrados aún.
      </p>
    )
  }
  return datos.map((b) => (
    <div style={{ marginBottom: '10px' }} key={b.clave}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
        <span style={{ color: 'var(--text-2)' }}>{etiquetar ? etiquetar(b.clave) : b.clave}</span>
        <span style={{ fontWeight: 700 }}>{money(b.valor)}</span>
      </div>
      <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: b.pct + '%', background: 'var(--naranja)', borderRadius: '4px' }} />
      </div>
    </div>
  ))
}

const Grafica = grafica

export default function reportes() {
  const { cobros, reservas, juegos, areas, cargando } = useadmindatos()

  // temporadas ofrecidas: la actual y la anterior, como el select de la v1.
  const anio = parseInt(hoy_hermosillo().slice(0, 4), 10)
  const temporadas = ['Temporada ' + anio + '-' + (anio + 1), 'Temporada ' + (anio - 1) + '-' + anio]

  const [temporada, settemporada] = useState(temporadas[0])
  const [periodo, setperiodo] = useState('toda')
  const [ini, setini] = useState('')
  const [fin, setfin] = useState('')

  const rango = useMemo(
    () => rango_reporte(temporada, periodo, ini, fin),
    [temporada, periodo, ini, fin]
  )
  const d = useMemo(
    () => datos_reporte({ cobros, reservas, juegos, areas, rango }),
    [cobros, reservas, juegos, areas, rango]
  )

  const vendedoras = Object.entries(d.porvend).sort((a, b) => b[1].total - a[1].total)
  const top = Object.entries(d.porcliente).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
  const facturado = Object.values(d.porcliente).reduce((s, c) => s + c.facturado, 0)

  const tarjetas = [
    { label: 'Ingresos totales', valor: money(d.total), color: 'var(--naranja)',
      delta: (d.cs.length ? d.cs.length + ' cobro(s) · ' + rango.etiqueta : 'Sin cobros registrados') +
        (d.credito_por_cobrar > 0 ? ' · 💳 ' + money(d.credito_por_cobrar) + ' a crédito por cobrar' : '') },
    { label: 'Zonas vendidas', valor: d.reservas_t.length, color: 'var(--verde)',
      delta: 'de ' + d.disponibles + ' disponibles (' + areas.length + ' zonas × ' + (d.juegos_t.length || 1) + ' juego(s))' },
    { label: 'Ocupación promedio', valor: d.ocupacion + '%', color: 'var(--azul)',
      delta: d.reservas_t.length ? d.reservas_t.length + ' sección(es) con reserva activa' : 'Todas las secciones libres' },
    { label: 'Ticket promedio', valor: money(d.ticket), color: 'var(--amarillo)', delta: 'por zona vendida' },
    { label: 'Facturado', valor: money(facturado), color: 'var(--morado)', delta: 'cobros marcados como requiere factura' },
  ]

  return (
    <div className="page active" id="page-reportes">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div>
            <h2>Reportes</h2>
            <p>Análisis de ventas, cobros y ocupación por temporada</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="input select btn-sm" id="reporte-temporada" style={{ fontSize: '13px' }}
              value={temporada} onChange={(e) => settemporada(e.target.value)}
            >
              {temporadas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="input select btn-sm" id="reporte-periodo" style={{ fontSize: '13px' }}
              value={periodo} onChange={(e) => setperiodo(e.target.value)}
            >
              <option value="toda">Toda la temporada</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="7dias">Últimos 7 días</option>
              <option value="mes">Este mes</option>
              <option value="personalizado">Rango personalizado</option>
            </select>
            {periodo === 'personalizado' && (
              <>
                <input type="date" className="input btn-sm" style={{ fontSize: '13px' }} title="Fecha inicio"
                  value={ini} onChange={(e) => setini(e.target.value)} />
                <input type="date" className="input btn-sm" style={{ fontSize: '13px' }} title="Fecha fin"
                  value={fin} onChange={(e) => setfin(e.target.value)} />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px', marginBottom: '24px' }}>
          {tarjetas.map((k) => (
            <div className="stat-card" style={{ borderLeft: '3px solid ' + k.color }} key={k.label}>
              <div className="stat-card-label">{k.label}</div>
              <div className="stat-card-value">{k.valor}</div>
              <div className="stat-card-delta">{k.delta}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{d.pordia ? 'Ingresos por día' : 'Ingresos por mes'}</div>
                <div className="card-sub">
                  {rango.periodo === 'toda'
                    ? 'Cobros registrados en la temporada'
                    : 'Cobros del periodo: ' + rango.etiquetaperiodo}
                </div>
              </div>
            </div>
            <div className="card-body">
              <Grafica datos={barras(d.pormes, true)} etiquetar={mes_label} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Ingresos por sección</div></div>
            <div className="card-body"><Grafica datos={barras(d.porzona)} /></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Rendimiento por vendedora</div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Vendedora</th><th>Cobros</th><th>Total</th><th>% del total</th></tr></thead>
                <tbody>
                  {vendedoras.length === 0 ? (
                    <tr><td colSpan={4} className="td-muted" style={{ textAlign: 'center', padding: '16px' }}>
                      Sin cobros registrados aún.
                    </td></tr>
                  ) : (
                    vendedoras.map(([nombre, v]) => (
                      <tr key={nombre}>
                        <td className="td-name">{nombre}</td>
                        <td>{v.n}</td>
                        <td style={{ color: 'var(--naranja)', fontWeight: 700 }}>{money(v.total)}</td>
                        <td>{d.total ? Math.round((v.total / d.total) * 100) : 0}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Por forma de pago</div>
                <div className="card-sub">Todas las formas registradas en cobros</div>
              </div>
            </div>
            <div className="card-body"><Grafica datos={barras(d.porforma)} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Top 10 clientes por facturación</div></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Zona</th><th>Concepto</th><th>Total pagado</th><th>Facturado</th></tr>
              </thead>
              <tbody>
                {top.length === 0 ? (
                  <tr><td colSpan={6} className="td-muted" style={{ textAlign: 'center', padding: '16px' }}>
                    Sin cobros registrados aún.
                  </td></tr>
                ) : (
                  top.map(([nombre, c], i) => (
                    <tr key={nombre}>
                      <td className="td-muted">{i + 1}</td>
                      <td className="td-name">{nombre}</td>
                      <td style={{ fontSize: '12px' }}>{mas_frecuente(c.zonas)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{mas_frecuente(c.conceptos)}</td>
                      <td style={{ color: 'var(--naranja)', fontWeight: 700 }}>{money(c.total)}</td>
                      <td>{c.facturado ? money(c.facturado) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {cargando && (
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '14px' }}>Cargando datos…</p>
        )}
      </div>
    </div>
  )
}
