// ═══════════════════════════════════════════════════════════════════
// metodos.jsx — metodos de pago del sistema.
// espejo 1:1 de v1: #page-metodos de index.html y renderMetodos()
// (js/01-nucleo.js).
//
// SOLO LECTURA: se omiten crear, editar, activar/desactivar y eliminar.
// ═══════════════════════════════════════════════════════════════════

import useadmindatos from '../../hooks/useadmindatos'
import { metodo_icon } from '../../lib/catalogos'

export default function metodos() {
  const { metodos: lista, cargando, errores } = useadmindatos()

  const activos = lista.filter((m) => m.activo).length

  return (
    <div className="page active" id="page-metodos">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Métodos de Pago</h2>
            <p>Cuentas y formas de cobro disponibles para registrar cobros</p>
          </div>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxWidth: '520px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-label">Métodos</div>
            <div className="stat-card-value">{lista.length}</div>
            <div className="stat-card-delta">configurados</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Activos</div>
            <div className="stat-card-value" style={{ color: 'var(--verde)' }}>{activos}</div>
            <div className="stat-card-delta">disponibles para cobrar</div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Método</th>
                  <th style={{ width: '50%' }}>Detalle</th>
                  <th style={{ width: '20%' }}>Estado</th>
                </tr>
              </thead>
              <tbody id="metodos-tbody">
                {lista.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{metodo_icon[m.tipo] || '💠'}</span>
                        <div>
                          <div className="td-name">{m.nombre}</div>
                          <div className="td-muted">{m.tipo}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {m.detalle || <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td>
                      <span className={'badge ' + (m.activo ? 'badge-green' : 'badge-gray')}>
                        {m.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando métodos…
            </div>
          )}
          {!cargando && lista.length === 0 && (
            <div id="metodos-empty" className="empty-state">
              <div className="empty-state-icon">💳</div>
              <p>
                {errores.includes('metodos_pago')
                  ? 'No se pudo leer la tabla de métodos de pago'
                  : 'Sin métodos de pago configurados'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
