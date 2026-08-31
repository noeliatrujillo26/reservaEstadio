// ═══════════════════════════════════════════════════════════════════
// temporadas.jsx — rol de juegos de la temporada.
// espejo 1:1 de v1: #page-temporadas de index.html y renderTempTabla() /
// renderTempStats() / showTempMes() / showTempAnio() (js/modules/areas-juegos.js).
//
// SOLO LECTURA: se omiten "Agregar juego", editar, eliminar y exportar.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  anios_de, estado_badge_juego, etiqueta_dia, filtrar_juegos, meses_label,
  meses_orden, stats_temporada,
} from '../../lib/catalogos'

export default function temporadas() {
  const { juegos, cargando, errores } = useadmindatos()

  const anios = useMemo(() => anios_de(juegos), [juegos])
  const [anio, setanio] = useState('')
  const [mes, setmes] = useState('todos')

  // el año arranca en el primero disponible; la v1 fija 2026 a mano.
  const anioactivo = anio || anios[0] || ''
  const filas = useMemo(() => filtrar_juegos(juegos, mes, anioactivo), [juegos, mes, anioactivo])
  // las 4 cifras salen del calendario COMPLETO, no del filtrado (igual que la v1).
  const stats = useMemo(() => stats_temporada(juegos), [juegos])

  const tarjetas = [
    { label: 'Juegos en casa', valor: stats.total, color: 'var(--naranja)', icono: '⚾' },
    { label: 'Confirmados', valor: stats.confirmados, color: 'var(--verde)', icono: '✅' },
    { label: 'Series', valor: stats.series, color: 'var(--azul)', icono: '📅' },
    { label: 'Rivales', valor: stats.rivales, color: 'var(--morado)', icono: '🏟️' },
  ]

  return (
    <div className="page active" id="page-temporadas">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Temporadas</h2>
            <p>Rol de juegos oficial · Edita fechas y horas si hay correcciones al calendario</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {anios.map((a) => (
              <button
                key={a}
                className={'btn btn-sm ' + (a === anioactivo ? 'btn-primary' : 'btn-outline')}
                onClick={() => setanio(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '24px' }} id="temp-stats">
          {tarjetas.map((k) => (
            <div className="stat-card" style={{ padding: '14px 16px' }} key={k.label}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icono}</div>
              <div className="stat-card-label">{k.label}</div>
              <div className="stat-card-value" style={{ fontSize: '22px', color: k.color }}>{k.valor}</div>
            </div>
          ))}
        </div>

        <div className="tab-bar" style={{ marginBottom: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
          <button className={'tab-btn' + (mes === 'todos' ? ' active' : '')} onClick={() => setmes('todos')}>
            Todos
          </button>
          {meses_orden.map((m) => (
            <button key={m} className={'tab-btn' + (mes === m ? ' active' : '')} onClick={() => setmes(m)}>
              {meses_label[m]}
            </button>
          ))}
        </div>

        <div className="card" style={{ borderRadius: '0 0 10px 10px', borderTop: 'none' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Juego #</th><th>Fecha</th><th>Hora</th><th>Rival</th>
                  <th>Tipo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody id="temp-tbody">
                {filas.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>Juego {j.num}</div>
                      <div className="td-muted">{j.serie}</div>
                    </td>
                    <td><div style={{ fontWeight: 600 }}>{etiqueta_dia(j.fecha)}</div></td>
                    <td><div style={{ fontWeight: 600 }}>{j.hora}</div></td>
                    <td>
                      Naranjeros <span style={{ color: 'var(--text-3)' }}>vs</span> <strong>{j.rival}</strong>
                    </td>
                    <td><span className="tag">Casa</span></td>
                    <td>
                      <span className={'badge ' + (estado_badge_juego[j.estado] || 'badge-gray')}>
                        {j.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando calendario…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">⚾</div>
              <p>
                {errores.includes('juegos')
                  ? 'No se pudo leer la tabla de juegos'
                  : 'Sin juegos para ese filtro'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
