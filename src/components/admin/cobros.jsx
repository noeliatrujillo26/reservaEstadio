// ═══════════════════════════════════════════════════════════════════
// cobros.jsx — Registro de Cobros.
// espejo 1:1 de v1: #page-cobros de index.html (lineas 2460-2568) y
// js/modules/cobros.js (renderCobrosKPIs, filtrarCobros, getSortedCobros,
// renderCobrosTabla, renderResumen, renderVendedoras).
//
// SOLO LECTURA: se omiten "Nuevo cobro", el interruptor de "Requiere factura",
// cancelar cobros y el envio del reporte del dia — todos escriben o disparan
// efectos externos. Quedan la tabla, los filtros, el orden, los KPIs y las
// dos pestanas de resumen, que es donde vive la consulta.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import CobrosFiltros from './cobrosfiltros'
import {
  cobro_cancelado, estado_cobro, filtrar_cobros, kpis_cobros, meses_label,
  ordenar_cobros, requiere_factura, resumen_por_vendedora, resumen_por_zona,
  colores_vendedora, folio_reserva,
} from '../../lib/cobros'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// espejo de formatFecha() de la v1.
function formato_fecha(str) {
  if (!str || str.length < 8) return str || '—'
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: '2-digit',
    })
  } catch (e) {
    return str
  }
}

const filtros_vacios = {
  busqueda: '', mes: [], concepto: [], forma: [], recibio: [], factura: [],
  fecha: '', estado: '',
}

const columnas = [
  { id: 'fecha', texto: 'Fecha', nowrap: true },
  { id: 'cliente', texto: 'Cliente' },
  { id: 'zona', texto: 'Área/Zona' },
  { id: 'concepto', texto: 'Concepto' },
  { id: 'estado', texto: 'Estado', nowrap: true },
  { id: 'formapago', texto: 'Forma pago' },
  { id: 'monto', texto: 'Monto' },
  { id: 'recibio', texto: 'Recibió' },
  { id: 'folio', texto: 'N° Recibo' },
  { id: 'factura', texto: 'Requiere factura' },
]

export default function cobros() {
  const { cobros: todos, reservas, areas, cargando, errores } = useadmindatos()

  const [filtros, setfiltros] = useState(filtros_vacios)
  const [orden, setorden] = useState({ col: 'fecha', dir: 'desc' })
  const [pestana, setpestana] = useState('tabla')

  // opciones de cada desplegable: las fijas del sistema mas TODA forma y
  // vendedor que aparezca de verdad en los cobros.
  const opciones = useMemo(() => {
    const unicos = (f) => [...new Set(todos.map(f).filter(Boolean))].sort()
    return {
      mes: meses_label,
      concepto: ['ABONO', 'LIQUIDACION', 'SALDO A FAVOR', 'CRÉDITO', 'Boletos', 'Comida'],
      forma: [...new Set(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CRÉDITO'].concat(unicos((c) => c.formapago)))],
      recibio: unicos((c) => c.recibio),
    }
  }, [todos])

  const filtrados = useMemo(() => filtrar_cobros(todos, filtros), [todos, filtros])
  const visibles = useMemo(() => ordenar_cobros(filtrados, orden.col, orden.dir), [filtrados, orden])
  // los KPIs reflejan LO FILTRADO en vivo, igual que la v1.
  const kpis = useMemo(() => kpis_cobros(filtrados, reservas), [filtrados, reservas])
  const resumen = useMemo(() => resumen_por_zona(todos), [todos])
  const vendedoras = useMemo(() => resumen_por_vendedora(todos), [todos])

  function ordenar_por(col) {
    setorden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  }

  return (
    <div className="page active" id="page-cobros">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Registro de Cobros</h2>
            <p>Captura de anticipos, abonos, liquidaciones y consumos por juego · Reemplaza el control en Excel</p>
          </div>
        </div>

        {cargando && <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Cargando cobros…</p>}
        {!cargando && errores.includes('cobros') && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px' }}>
            ⚠ No se pudo leer la tabla de cobros.
          </div>
        )}

        {/* ── KPIs ── */}
        <div id="cobros-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(' + kpis.length + ',1fr)', gap: '12px', marginBottom: '20px' }}>
          {kpis.map((k) => (
            <div className="stat-card" style={{ padding: '14px 16px' }} key={k.label}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icono}</div>
              <div className="stat-card-label">{k.label}</div>
              <div className="stat-card-value" style={{ fontSize: '22px', color: k.color }}>
                {k.dinero ? money(k.valor) : k.valor}
              </div>
            </div>
          ))}
        </div>

        {/* ── pestañas ── */}
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={'tab-btn' + (pestana === 'tabla' ? ' active' : '')} onClick={() => setpestana('tabla')}>
            Todos los cobros
          </button>
          <button className={'tab-btn' + (pestana === 'resumen' ? ' active' : '')} onClick={() => setpestana('resumen')}>
            Resumen por zona
          </button>
          <button className={'tab-btn' + (pestana === 'vendedoras' ? ' active' : '')} onClick={() => setpestana('vendedoras')}>
            Por vendedora
          </button>
        </div>

        {pestana === 'tabla' && (
          <div className="card" style={{ borderRadius: '0 0 10px 10px', borderTop: 'none' }}>
            <CobrosFiltros
              filtros={filtros} setfiltros={setfiltros} opciones={opciones}
              mostrados={visibles.length} total={todos.length}
              onlimpiar={() => setfiltros(filtros_vacios)}
            />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {columnas.map((c) => (
                      <th
                        key={c.id} onClick={() => ordenar_por(c.id)}
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: c.nowrap ? 'nowrap' : undefined }}
                      >
                        {c.texto}{' '}
                        <span style={{ color: 'var(--naranja)' }}>
                          {orden.col === c.id ? (orden.dir === 'asc' ? '↑' : '↓') : ''}
                        </span>
                      </th>
                    ))}
                    <th style={{ whiteSpace: 'nowrap' }}>Folio Reserva</th>
                  </tr>
                </thead>
                <tbody id="cobros-tbody">
                  {visibles.map((c) => {
                    const cancelado = cobro_cancelado(c)
                    // los cancelados se conservan para auditoria, tachados.
                    const estilo = cancelado
                      ? { textDecoration: 'line-through', opacity: 0.6 }
                      : undefined
                    return (
                      <tr key={c.id} style={estilo}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formato_fecha(c.fecha)}</td>
                        <td>{c.cliente}</td>
                        <td>{c.zona}</td>
                        <td><span className="tag">{c.concepto}</span></td>
                        <td>
                          <span
                            className={'badge ' + (cancelado ? 'badge-red' : 'badge-green')}
                            style={{ fontSize: '10px', fontWeight: cancelado ? 800 : 700 }}
                            title={cancelado ? 'Cobro cancelado: se conserva para auditoría y no suma en totales ni saldos' : undefined}
                          >
                            {estado_cobro(c)}
                          </span>
                        </td>
                        <td>{c.formapago}</td>
                        <td style={{ fontWeight: 700 }}>{money(c.monto)}</td>
                        <td>{c.recibio || '—'}</td>
                        <td>{c.folio || '—'}</td>
                        <td>
                          {requiere_factura(c) ? (
                            <span className="badge badge-orange" style={{ fontSize: '10px' }}>Requerida</span>
                          ) : (
                            <span className="td-muted">—</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {folio_reserva(c, reservas, areas) || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!visibles.length && (
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <p>No hay cobros registrados</p>
              </div>
            )}
          </div>
        )}

        {pestana === 'resumen' && (
          <div className="card" style={{ borderRadius: '0 0 10px 10px', borderTop: 'none' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Zona</th>
                    <th style={{ width: '12%' }}>Cobros</th>
                    <th style={{ width: '16%' }}>Anticipos</th>
                    <th style={{ width: '16%' }}>Abonos</th>
                    <th style={{ width: '17%' }}>Liquidaciones</th>
                    <th style={{ width: '17%' }}>Total cobrado</th>
                  </tr>
                </thead>
                <tbody id="resumen-zona-tbody">
                  {resumen.map(([zona, v]) => (
                    <tr key={zona}>
                      <td><span className="tag" style={{ fontWeight: 700 }}>{zona}</span></td>
                      <td className="td-muted">{v.n}</td>
                      <td style={{ color: 'var(--azul)' }}>{money(v.anticipos)}</td>
                      <td style={{ color: 'var(--amarillo)' }}>{money(v.abonos)}</td>
                      <td style={{ color: 'var(--verde)' }}>{money(v.liq)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--naranja)' }}>{money(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resumen.length && (
              <div className="empty-state"><div className="empty-state-icon">🧾</div><p>Sin cobros para resumir</p></div>
            )}
          </div>
        )}

        {pestana === 'vendedoras' && (
          <div id="vendedoras-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '16px', marginTop: '1px' }}>
            {vendedoras.lista.map(([nombre, v]) => {
              const pct = vendedoras.total_general > 0
                ? Math.round((v.total / vendedoras.total_general) * 100) : 0
              const top_zona = Object.entries(v.zonas).sort((a, b) => b[1] - a[1])[0]
              const color = colores_vendedora[nombre] || '#666'
              return (
                <div className="card" key={nombre}>
                  <div style={{ padding: '18px 16px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {nombre[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>{nombre}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{v.n} cobros registrados</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color, marginBottom: '4px' }}>{money(v.total)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '10px' }}>{pct}% del total</div>
                    <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', marginBottom: '12px' }}>
                      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: '3px' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                      Top zona: <strong>{top_zona ? top_zona[0] : '—'}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
            {!vendedoras.lista.length && (
              <div className="empty-state"><div className="empty-state-icon">👤</div><p>Sin cobros por vendedora</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
