// ═══════════════════════════════════════════════════════════════════
// clientedetalle.jsx — expediente completo de un cliente.
// espejo 1:1 de v1: _renderDetalleCliente() (js/22-usuarios-clientes.js
// 1635-1722), salvo la seccion de facturas (ver nota abajo).
//
// HISTORIAL UNIFICADO: reservas, PAGOS realizados (cliente_id / folio de sus
// reservas o de las tarjetas del Pipeline ligadas / identidad telefono+
// nombre — NUNCA el correo) y consumo incluido. Es la MISMA cuenta que arma
// "Total pagado" arriba: si un pago aparece en la tabla, ya esta contado.
//
// El padre (clientes.jsx) monta este componente SOLO con un cliente y sus
// tres listas ya calculadas — igual que detalleprospecto.jsx, para que el
// banco de pruebas pueda montarlo con props propias sin depender de un clic.
//
// FUERA DE ALCANCE: la seccion "Facturas" de la v1 lee `facturasData`, que
// sale de #page-facturas — una pagina sin entrada en el menu lateral,
// inalcanzable en la v1 (ver commit de Cobros). No se migra por la misma
// razon: no hay forma de generar ese dato todavia.
// ═══════════════════════════════════════════════════════════════════

import { es_cobro_credito } from '../../lib/dashboard'
import { formato_fecha } from '../../lib/cobros'
import { pipeline_etapas } from '../../lib/pipeline'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

function cliente_detalle({ cliente, pagos, consumos, tarjetas, oncerrar }) {
  return (
    <div
      className="modal-overlay open" id="modal-cliente-detalle"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ width: '640px', margin: 'auto' }}>
        <div className="card-header" style={{ padding: '18px 22px' }}>
          <div>
            <div className="card-title" id="cl-modal-nombre">{cliente.nombre}</div>
            <div className="card-sub">
              {cliente.email} · {cliente.tel}
            </div>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={oncerrar}>✕</button>
        </div>

        <div style={{ padding: '18px 22px', maxHeight: '72vh', overflowY: 'auto' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '18px' }}>
            <div className="stat-card" style={{ padding: '12px 14px' }}>
              <div className="stat-card-label">Reservas</div>
              <div className="stat-card-value" style={{ fontSize: '20px' }}>{cliente.reservas.length}</div>
            </div>
            <div className="stat-card" style={{ padding: '12px 14px' }}>
              <div className="stat-card-label">Total pagado</div>
              <div className="stat-card-value" style={{ fontSize: '20px', color: 'var(--verde)' }}>
                {money(cliente.totalpagado)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '12px 14px' }}>
              <div className="stat-card-label">Saldo</div>
              <div className="stat-card-value" style={{ fontSize: '20px', color: 'var(--rojo)' }}>
                {money(cliente.saldototal)}
              </div>
            </div>
          </div>

          {(cliente.saldofavor > 0 || cliente.creditototal > 0 || cliente.creditoautorizado) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {cliente.saldofavor > 0 && (
                <span className="badge badge-blue">Saldo a favor: {money(cliente.saldofavor)}</span>
              )}
              {cliente.creditototal > 0 && (
                <span className="badge badge-orange">A crédito: {money(cliente.creditototal)}</span>
              )}
              {cliente.creditoautorizado && <span className="badge badge-gray">Crédito autorizado</span>}
            </div>
          )}

          <div className="card-title" style={{ fontSize: '13px', marginBottom: '8px' }}>
            Historial de reservas
          </div>
          {cliente.reservas.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-3)', padding: '12px 0' }}>
              Este cliente aún no tiene reservas activas.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Zona</th>
                    <th>Juego</th>
                    <th>Pagado</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {cliente.reservas.map((r) => (
                    <tr key={r.folio}>
                      <td className="td-muted" style={{ fontWeight: 600 }}>{r.folio}</td>
                      <td>{r.zona}</td>
                      <td className="td-muted">{r.juego}</td>
                      <td style={{ color: 'var(--verde)' }}>{money(r.montopagado)}</td>
                      <td>
                        {r.cortesia ? (
                          <span className="badge badge-purple">Cortesía</span>
                        ) : r.saldo > 0 ? (
                          <span style={{ color: 'var(--rojo)' }}>{money(r.saldo)}</span>
                        ) : (
                          <span className="badge badge-green">Pagado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagos realizados — historial UNIFICADO: cliente_id, folio (de
              sus reservas o de las tarjetas del Pipeline ligadas) o
              identidad telefono+nombre. Es la MISMA cuenta que arma el
              total de arriba — si aqui aparece un pago, ya esta contado en
              "Total pagado". */}
          <div className="card-title" style={{ fontSize: '13px', margin: '20px 0 8px' }}>
            Pagos realizados ({pagos.length})
          </div>
          {pagos.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-3)', padding: '4px 0 12px' }}>
              Sin pagos registrados.
            </p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th>Forma</th>
                    <th>Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td className="td-muted" style={{ fontSize: '12px' }}>{formato_fecha(p.fecha)}</td>
                      <td style={{ fontSize: '12px' }}>
                        {p.concepto || '—'}
                        {es_cobro_credito(p) && (
                          <span
                            className="badge badge-orange" style={{ fontSize: '10px', marginLeft: '4px' }}
                            title="Compromiso de pago a crédito: NO es dinero cobrado"
                          >
                            Crédito
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--naranja)', fontWeight: 600 }}>{money(p.monto)}</td>
                      <td className="td-muted" style={{ fontSize: '12px' }}>{p.formapago || '—'}</td>
                      <td className="td-muted" style={{ fontSize: '11px' }}>{p.folio || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Consumo incluido — cruza por folio propio o, a falta de el,
              por identidad telefono+nombre: la MISMA regla que la vista
              Saldo de Consumo. */}
          {consumos.length > 0 && (
            <>
              <div className="card-title" style={{ fontSize: '13px', margin: '20px 0 8px' }}>
                Consumo incluido ({consumos.length})
              </div>
              <div className="table-wrap" style={{ marginBottom: '12px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Zona</th>
                      <th>Juego</th>
                      <th>Consumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumos.map((r) => (
                      <tr key={r.id}>
                        <td className="td-muted" style={{ fontSize: '12px' }}>{r.id}</td>
                        <td style={{ fontSize: '12px' }}>{r.zona || '—'}</td>
                        <td className="td-muted" style={{ fontSize: '12px' }}>{r.juego || '—'}</td>
                        <td style={{ color: 'var(--naranja)', fontWeight: 600 }}>{money(r.saldoconsumo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Tarjetas del Pipeline vinculadas — conecta el expediente con
              la oportunidad comercial que lo origino. La v1 no tiene esta
              seccion; se agrega porque la vinculacion ya existe en los
              datos (cliente_id / reserva_ids) y viene a la vista a
              proposito de este modulo. */}
          {tarjetas.length > 0 && (
            <>
              <div className="card-title" style={{ fontSize: '13px', margin: '20px 0 8px' }}>
                En el Pipeline ({tarjetas.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
                {tarjetas.map((p) => {
                  const etapa = pipeline_etapas.find((e) => e.id === p.etapa)
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px',
                        background: 'var(--surface-2)', borderRadius: '8px', padding: '8px 10px',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--naranja)' }}>{p.folio || p.id}</span>
                      <span
                        style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: etapa ? etapa.color : 'var(--text-3)', flexShrink: 0,
                        }}
                      />
                      <span>{etapa ? etapa.label : p.etapa}</span>
                      {p.vendedora && <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{p.vendedora}</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const ClienteDetalle = cliente_detalle
export default ClienteDetalle
