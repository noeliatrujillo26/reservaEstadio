// ═══════════════════════════════════════════════════════════════════
// consumos.jsx — Saldo de Consumo.
// espejo 1:1 de v1: #page-consumos de index.html (lineas 2658-2700) y
// renderConsumoPorReserva() / _poblarFiltrosConsumo() (js/01-nucleo.js).
//
// ESCRITURA (Fase 2): eliminar el registro de consumo (deja saldo_consumo en
// $0; la reserva NO se borra). Sigue sin migrar exportar CSV y el envio por
// WhatsApp (individual y masivo): son efectos externos, no escrituras.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useconsumoescritura from '../../hooks/useconsumoescritura'
import { useconfirmar } from './confirmar'
import { filtrar_consumos, juegos_con_consumo, total_consumo } from '../../lib/consumos'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function consumos() {
  const { reservas, juegos, cargando, errores } = useadmindatos()
  const { puede, eliminar, borrando } = useconsumoescritura()
  const { confirmar, dialogo } = useconfirmar()

  const [busqueda, setbusqueda] = useState('')
  const [juegoid, setjuegoid] = useState('')

  async function pedir_eliminar(r) {
    const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)
    const ok = await confirmar(
      <>
        ¿Estás seguro de que deseas eliminar este registro de consumo? Esto
        afectará a la reserva asociada.
        <br />
        <strong>{r.cliente}</strong> · {r.zona} · {money(r.saldoconsumo)}
        <br />
        El consumo incluido de la reserva #{r.id} quedará en $0 (la reserva NO
        se elimina).
      </>,
      'Sí, eliminar'
    )
    if (ok) eliminar(r)
  }

  const filas = useMemo(
    () => filtrar_consumos(reservas, { busqueda, juegoid }),
    [reservas, busqueda, juegoid]
  )
  // el selector solo lista juegos que de verdad tienen consumo registrado.
  const opciones = useMemo(() => juegos_con_consumo(reservas, juegos), [reservas, juegos])
  const total = useMemo(() => total_consumo(filas), [filas])

  return (
    <div className="page active" id="page-consumos">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Saldo de Consumo</h2>
            <p>Consumo incluido por reserva generada</p>
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: '20px', gridTemplateColumns: 'repeat(2,1fr)', maxWidth: '520px' }}>
          <div className="stat-card">
            <div className="stat-card-label">Reservas con consumo</div>
            <div className="stat-card-value">{filas.length}</div>
            <div className="stat-card-delta">activas, sin canceladas</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Consumo incluido</div>
            <div className="stat-card-value" style={{ color: 'var(--naranja)' }}>{money(total)}</div>
            <div className="stat-card-delta">total mostrado</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="search-wrap" style={{ width: '220px' }}>
              <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="#9AA3B4" strokeWidth="1.4" />
                <path d="M10 10l2.5 2.5" stroke="#9AA3B4" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                className="input" id="consumos-cliente-search" placeholder="Buscar cliente o zona..."
                style={{ paddingLeft: '32px' }}
                value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
              />
            </div>
            <select
              className="input select" style={{ width: '220px' }} id="filtro-consumo-juego"
              value={juegoid} onChange={(e) => setjuegoid(e.target.value)}
            >
              <option value="">Todos los juegos</option>
              {opciones.map((j) => (
                <option key={j.id} value={String(j.id)}>
                  {j.fecha} · vs {j.rival}
                </option>
              ))}
            </select>
            <span
              id="consumos-cliente-count"
              style={{ fontSize: '12px', color: 'var(--text-3)', whiteSpace: 'nowrap', marginLeft: 'auto' }}
            >
              {filas.length} reserva(s)
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Zona</th>
                  <th>Juego</th>
                  <th style={{ textAlign: 'right' }}>Consumo incluido (paquete default)</th>
                  {puede && <th style={{ width: '60px' }} />}
                </tr>
              </thead>
              <tbody id="consumos-cliente-tbody">
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td className="td-name">{r.cliente}</td>
                    <td className="td-muted" style={{ fontSize: '12px' }}>{r.zona}</td>
                    <td className="td-muted" style={{ fontSize: '12px' }}>{r.juego || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--naranja)' }}>
                      {money(r.saldoconsumo)}
                    </td>
                    {puede && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-outline btn-xs"
                          style={{ color: 'var(--rojo)', borderColor: 'var(--rojo-bg)' }}
                          title="Eliminar registro de consumo"
                          disabled={borrando === r.id}
                          onClick={() => pedir_eliminar(r)}
                        >
                          {borrando === r.id ? '…' : '🗑'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando consumos…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div id="consumos-cliente-empty" className="empty-state">
              <div className="empty-state-icon">👤</div>
              <p>
                {errores.includes('reservas')
                  ? 'No se pudo leer la tabla de reservas'
                  : 'No hay reservas con consumo incluido'}
              </p>
            </div>
          )}
        </div>
      </div>
      {dialogo}
    </div>
  )
}
