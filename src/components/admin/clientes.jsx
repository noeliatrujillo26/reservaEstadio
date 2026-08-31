// ═══════════════════════════════════════════════════════════════════
// clientes.jsx — expediente de clientes.
// espejo 1:1 de v1: #page-clientes de index.html (lineas 2870-2915),
// initClientesPage(), renderClientesTabla(), sortClientes(),
// onBuscarClientes() y paginaClientes().
//
// SOLO LECTURA: se omiten "Nuevo cliente", importar/exportar CSV y el menu de
// acciones por fila. Quedan la tabla, el buscador, el orden, la paginacion y
// el detalle con el historial de reservas del titular.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  armar_clientes, filtrar_clientes, ordenar_clientes, por_pagina,
} from '../../lib/clientes'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function clientes() {
  const { clientes: tabla, reservas, cobros, cargando, errores } = useadmindatos()

  const [busqueda, setbusqueda] = useState('')
  const [orden, setorden] = useState({ col: 'nombre', dir: 'asc' })
  const [pagina, setpagina] = useState(0)
  const [detalle, setdetalle] = useState(null)

  const todos = useMemo(
    () => armar_clientes({ clientes: tabla, reservas, cobros }),
    [tabla, reservas, cobros]
  )

  const filtrados = useMemo(() => filtrar_clientes(todos, busqueda), [todos, busqueda])
  const ordenados = useMemo(
    () => ordenar_clientes(filtrados, orden.col, orden.dir),
    [filtrados, orden]
  )

  const paginas = Math.max(1, Math.ceil(ordenados.length / por_pagina))
  const pag = Math.min(pagina, paginas - 1)
  const visibles = ordenados.slice(pag * por_pagina, pag * por_pagina + por_pagina)

  function ordenar_por(col) {
    setorden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
    setpagina(0)
  }

  const flecha = (col) => (orden.col === col ? (orden.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕')

  // metricas de consumo del conjunto filtrado.
  const metricas = useMemo(() => {
    const pagado = filtrados.reduce((s, c) => s + c.totalpagado, 0)
    const saldo = filtrados.reduce((s, c) => s + c.saldototal, 0)
    const credito = filtrados.reduce((s, c) => s + c.creditototal, 0)
    const conreserva = filtrados.filter((c) => c.reservas.length > 0).length
    return { pagado, saldo, credito, conreserva }
  }, [filtrados])

  return (
    <div className="page active" id="page-clientes">
      <div className="page-inner" style={{ padding: '28px' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2>Clientes</h2>
            <p>Registrados vía plataforma web y manual</p>
          </div>
        </div>

        {/* metricas de consumo del conjunto mostrado */}
        <div className="stats-grid" style={{ marginTop: '20px', marginBottom: '4px' }}>
          <div className="stat-card">
            <div className="stat-card-label">Clientes</div>
            <div className="stat-card-value">{filtrados.length}</div>
            <div className="stat-card-delta">{metricas.conreserva} con reservas</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total pagado</div>
            <div className="stat-card-value" style={{ color: 'var(--verde)' }}>{money(metricas.pagado)}</div>
            <div className="stat-card-delta">dinero recibido</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Saldo pendiente</div>
            <div className="stat-card-value" style={{ color: 'var(--rojo)' }}>{money(metricas.saldo)}</div>
            <div className="stat-card-delta">por cobrar</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">A crédito</div>
            <div className="stat-card-value" style={{ color: 'var(--naranja)' }}>{money(metricas.credito)}</div>
            <div className="stat-card-delta">compromiso, sin cobrar</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <input
              id="cl-buscar" className="input" placeholder="Buscar por nombre, correo o tel…"
              style={{ width: '240px', fontSize: '13px' }}
              value={busqueda}
              onChange={(e) => { setbusqueda(e.target.value); setpagina(0) }}
            />
            {ordenados.length > 0 && (
              <div id="cl-paginacion" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-2)' }}>
                <span id="cl-rango" style={{ whiteSpace: 'nowrap', marginRight: '4px' }}>
                  {pag * por_pagina + 1}–{Math.min((pag + 1) * por_pagina, ordenados.length)} de {ordenados.length}
                </span>
                <button
                  className="btn btn-ghost btn-xs" title="Anterior" disabled={pag === 0}
                  onClick={() => setpagina((p) => Math.max(0, p - 1))}
                  style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
                >‹</button>
                <button
                  className="btn btn-ghost btn-xs" title="Siguiente" disabled={pag >= paginas - 1}
                  onClick={() => setpagina((p) => Math.min(paginas - 1, p + 1))}
                  style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
                >›</button>
              </div>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('nombre')}>
                    Cliente<span className="sort-arrow">{flecha('nombre')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('email')}>
                    Email<span className="sort-arrow">{flecha('email')}</span>
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>Tel</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('reservas')}>
                    Reservas<span className="sort-arrow">{flecha('reservas')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('totalpagado')}>
                    Pagado<span className="sort-arrow">{flecha('totalpagado')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('saldototal')}>
                    Saldo<span className="sort-arrow">{flecha('saldototal')}</span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="cl-tbody">
                {visibles.map((c, i) => (
                  <tr key={(c.id != null ? 'id' + c.id : 'n' + i) + c.email}>
                    <td className="td-name">
                      {c.nombre}
                      {c.empresa && (
                        <span className="badge badge-gray" style={{ fontSize: '9px', marginLeft: '6px' }}>{c.empresa}</span>
                      )}
                    </td>
                    <td className="td-muted">{c.email}</td>
                    <td className="td-muted">{c.tel}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.reservas.length}</td>
                    <td style={{ color: 'var(--verde)', fontWeight: 600 }}>{money(c.totalpagado)}</td>
                    <td style={{ color: c.saldototal > 0 ? 'var(--rojo)' : 'var(--text-3)' }}>{money(c.saldototal)}</td>
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(c)} title="Ver expediente">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!cargando && ordenados.length === 0 && (
            <div id="cl-empty" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
              <div style={{ fontSize: '14px' }}>
                {errores.includes('clientes')
                  ? 'No se pudo leer la tabla de clientes'
                  : busqueda
                    ? 'Sin resultados para esa búsqueda'
                    : 'Sin compras registradas en la plataforma'}
              </div>
            </div>
          )}
          {cargando && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando clientes…
            </div>
          )}
        </div>
      </div>

      {/* ── expediente del cliente ── */}
      {detalle && (
        <div
          className="modal-overlay open" id="modal-cliente-detalle"
          style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setdetalle(null) }}
        >
          <div className="modal" style={{ width: '580px', margin: 'auto' }}>
            <div className="card-header" style={{ padding: '18px 22px' }}>
              <div>
                <div className="card-title" id="cl-modal-nombre">{detalle.nombre}</div>
                <div className="card-sub">
                  {detalle.email} · {detalle.tel}
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(null)}>✕</button>
            </div>

            <div style={{ padding: '18px 22px' }}>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '18px' }}>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label">Reservas</div>
                  <div className="stat-card-value" style={{ fontSize: '20px' }}>{detalle.reservas.length}</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label">Total pagado</div>
                  <div className="stat-card-value" style={{ fontSize: '20px', color: 'var(--verde)' }}>
                    {money(detalle.totalpagado)}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label">Saldo</div>
                  <div className="stat-card-value" style={{ fontSize: '20px', color: 'var(--rojo)' }}>
                    {money(detalle.saldototal)}
                  </div>
                </div>
              </div>

              {(detalle.saldofavor > 0 || detalle.creditototal > 0 || detalle.creditoautorizado) && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {detalle.saldofavor > 0 && (
                    <span className="badge badge-blue">Saldo a favor: {money(detalle.saldofavor)}</span>
                  )}
                  {detalle.creditototal > 0 && (
                    <span className="badge badge-orange">A crédito: {money(detalle.creditototal)}</span>
                  )}
                  {detalle.creditoautorizado && <span className="badge badge-gray">Crédito autorizado</span>}
                </div>
              )}

              <div className="card-title" style={{ fontSize: '13px', marginBottom: '8px' }}>
                Historial de reservas
              </div>
              {detalle.reservas.length === 0 ? (
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
                      {detalle.reservas.map((r) => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
