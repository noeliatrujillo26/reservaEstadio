// ═══════════════════════════════════════════════════════════════════
// palcos.jsx — ocupacion de los palcos compartidos.
// espejo 1:1 de v1: #page-palcos de index.html y renderPalcosBoard()
// (js/modules/palcos.js).
//
// No reutiliza el Pipeline Comercial a proposito: alli una tarjeta es un
// prospecto que aspira a una zona entera; aqui es una compra de N lugares
// dentro de un palco que otros comparten, y la pregunta que manda es cuanto
// queda por vender en cada palco.
//
// MODO CONSULTA: se omiten el reporte descargable y cualquier edicion.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { lugares_de_reserva, ocupacion_palco, palcos_del_mapa } from '../../lib/pipeline'
import { redondear_dinero, mxn2 } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function palcos() {
  const { areas, reservas, juegos, cargando } = useadmindatos()
  const [juegoid, setjuegoid] = useState('')

  // se preselecciona el proximo juego, como en el resto del panel.
  useEffect(() => {
    if (juegoid || !juegos.length) return
    const hoy = hoy_hermosillo()
    const prox = juegos.find((j) => (j.fecha || '') >= hoy) || juegos[0]
    if (prox) setjuegoid(String(prox.id))
  }, [juegos, juegoid])

  const juego = juegos.find((j) => String(j.id) === String(juegoid)) || null
  const palcos = useMemo(() => palcos_del_mapa(areas), [areas])

  const datos = useMemo(() => {
    if (!juego || !palcos.length) return null
    const cols = palcos.map((a) => ({ area: a, o: ocupacion_palco(a, juego.id, reservas) }))
    const resumen = cols.reduce(
      (r, { o }) => ({
        capacidad: r.capacidad + o.capacidad,
        ocupados: r.ocupados + o.ocupados,
        reservas: r.reservas + o.reservas.length,
        agotados: r.agotados + (o.agotado ? 1 : 0),
        importe:
          r.importe +
          o.reservas.reduce(
            (s, x) => s + Math.max(0, (Number(x.monto) || 0) - (Number(x.descuentomonto) || 0)),
            0
          ),
      }),
      { capacidad: 0, ocupados: 0, reservas: 0, agotados: 0, importe: 0 }
    )
    return { cols, resumen }
  }, [palcos, juego, reservas])

  const kpis = datos
    ? [
        { label: 'Lugares', valor: datos.resumen.capacidad, delta: 'capacidad total', color: 'var(--azul)' },
        { label: 'Vendidos', valor: datos.resumen.ocupados, delta: datos.resumen.reservas + ' reserva(s)', color: 'var(--naranja)' },
        { label: 'Disponibles', valor: Math.max(0, datos.resumen.capacidad - datos.resumen.ocupados), delta: datos.resumen.agotados + ' palco(s) agotado(s)', color: 'var(--verde)' },
        { label: 'Importe', valor: money(datos.resumen.importe), delta: 'neto de las reservas', color: 'var(--morado)' },
      ]
    : []

  return (
    <div className="page active" id="page-palcos">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2>Pipeline de Palcos</h2>
            <p>Venta por lugares en palcos compartidos</p>
          </div>
          <select
            id="palcos-filtro-juego" className="input select" style={{ width: '280px' }}
            value={juegoid} onChange={(e) => setjuegoid(e.target.value)}
          >
            <option value="">— Selecciona un juego —</option>
            {juegos.map((j) => (
              <option key={j.id} value={String(j.id)}>{j.fecha} · vs {j.rival}</option>
            ))}
          </select>
        </div>

        {kpis.length > 0 && (
          <div id="palcos-kpis" className="stats-grid" style={{ marginBottom: '18px' }}>
            {kpis.map((k) => (
              <div className="stat-card" key={k.label}>
                <div className="stat-card-label">{k.label}</div>
                <div className="stat-card-value" style={{ color: k.color }}>{k.valor}</div>
                <div className="stat-card-delta">{k.delta}</div>
              </div>
            ))}
          </div>
        )}

        {cargando && (
          <div style={{ padding: '40px', color: 'var(--text-3)', textAlign: 'center' }}>Cargando…</div>
        )}
        {!cargando && !palcos.length && (
          <div style={{ padding: '40px', color: 'var(--text-3)', textAlign: 'center' }}>
            No hay palcos compartidos configurados.
            <br />
            <span style={{ fontSize: '12px' }}>
              Se marcan con <b>es_compartida</b> en el editor del mapa.
            </span>
          </div>
        )}
        {!cargando && palcos.length > 0 && !juego && (
          <div style={{ padding: '40px', color: 'var(--text-3)', textAlign: 'center' }}>
            Elige un juego para ver la ocupación de sus palcos.
          </div>
        )}

        {datos && (
          <div id="palcos-board" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
            {datos.cols.map(({ area, o }) => {
              const color = o.agotado ? 'var(--rojo)' : o.pct >= 80 ? 'var(--naranja)' : 'var(--verde)'
              return (
                <div
                  key={area.id}
                  className="pipeline-col"
                  style={{ minWidth: '290px', maxWidth: '290px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{area.nombre}</div>
                      {o.agotado ? (
                        <span className="badge badge-red" style={{ fontSize: '10px', marginLeft: 'auto' }}>
                          AGOTADO
                        </span>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: '10px', marginLeft: 'auto' }}>
                          {o.libres} libres
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '5px' }}>
                      {o.ocupados} de {o.capacidad} lugares · {o.pct}%
                    </div>
                    <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: o.pct + '%', height: '100%', background: color, borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {o.reservas.map((r) => (
                      <div key={r.id} style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '9px 10px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{r.cliente}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                          {lugares_de_reserva(r)} lugar(es) ·{' '}
                          {money(Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentomonto) || 0)))}
                        </div>
                      </div>
                    ))}
                    {o.reservas.length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '14px 2px' }}>
                        Sin ventas en este palco todavía.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
