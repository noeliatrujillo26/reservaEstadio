// ═══════════════════════════════════════════════════════════════════
// movimientos.jsx — registro de auditoria del sistema.
// espejo 1:1 de v1: #page-movimientos de index.html (lineas 2183-2216) y
// renderMovimientos() / cargarMovimientosPagina().
//
// Vista de auditoria: en la v1 tampoco se edita nada aqui, asi que es
// naturalmente de solo lectura.
// ═══════════════════════════════════════════════════════════════════

import usemovimientos from '../../hooks/usemovimientos'
import { mov_badge, mov_por_pagina, tipos_mov } from '../../lib/movimientos'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function movimientos() {
  const { filtros, cambiar_filtros, pagina, totalpaginas, total, filas, cargando, error, mover } =
    usemovimientos()

  const primero = total === 0 ? 0 : (pagina - 1) * mov_por_pagina + 1
  const ultimo = Math.min(pagina * mov_por_pagina, total)

  return (
    <div className="page active" id="page-movimientos">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2>Registro de Movimientos</h2>
            <p>Auditoría completa de acciones en el sistema</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div className="flex gap-2 flex-center" style={{ flexWrap: 'wrap' }}>
              <div className="search-wrap" style={{ flex: 1, minWidth: '200px' }}>
                <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="#9AA3B4" strokeWidth="1.4" />
                  <path d="M10 10l2.5 2.5" stroke="#9AA3B4" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  id="mov-buscar" className="input" placeholder="Buscar movimiento, usuario o zona..."
                  value={filtros.q} onChange={(e) => cambiar_filtros({ q: e.target.value })}
                />
              </div>
              <select
                id="mov-tipo" className="input select" style={{ width: '150px' }}
                value={filtros.tipo} onChange={(e) => cambiar_filtros({ tipo: e.target.value })}
              >
                <option value="">Todos los tipos</option>
                {tipos_mov.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="date" id="mov-fecha-desde" className="input" style={{ width: '150px' }} title="Desde"
                value={filtros.desde} onChange={(e) => cambiar_filtros({ desde: e.target.value })}
              />
              <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>a</span>
              <input
                type="date" id="mov-fecha-hasta" className="input" style={{ width: '150px' }} title="Hasta"
                value={filtros.hasta} onChange={(e) => cambiar_filtros({ hasta: e.target.value })}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => cambiar_filtros({ desde: '', hasta: '' })}
              >
                Limpiar fechas
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Zona / Referencia</th>
                  <th>Usuario</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody id="movimientos-tbody">
                {filas.map((m, i) => (
                  <tr key={m.id != null ? m.id : i}>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{m.ts}</td>
                    <td><span className={'badge ' + (mov_badge[m.tipo] || 'badge-gray')}>{m.tipo}</span></td>
                    <td>{m.desc}</td>
                    <td className="td-muted">{m.ref}</td>
                    <td className="td-muted">{m.usuario}</td>
                    {m.monto ? (
                      <td className="fw-700" style={{ color: 'var(--verde)' }}>+{money(m.monto)}</td>
                    ) : (
                      <td className="td-muted">—</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando movimientos…
            </div>
          )}
          {!cargando && error && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠</div>
              <p>{error}</p>
            </div>
          )}
          {!cargando && !error && filas.length === 0 && (
            <div id="movimientos-empty" className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>Sin movimientos registrados</p>
            </div>
          )}

          {total > 0 && (
            <div
              id="mov-paginacion"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', color: 'var(--text-2)', padding: '10px 20px', borderTop: '1px solid var(--border)' }}
            >
              <span id="mov-rango" style={{ whiteSpace: 'nowrap', marginRight: '4px' }}>
                {primero}–{ultimo} de {total}
              </span>
              <button
                className="btn btn-ghost btn-xs" title="Anterior" disabled={pagina <= 1}
                onClick={() => mover(-1)}
                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
              >‹</button>
              <button
                className="btn btn-ghost btn-xs" title="Siguiente" disabled={pagina >= totalpaginas}
                onClick={() => mover(1)}
                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
              >›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
