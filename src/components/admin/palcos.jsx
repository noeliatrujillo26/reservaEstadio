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
// ESCRITURA (Fase 2): clic en una tarjeta abre la MISMA edicion de reserva que
// usa la vista de Reservas (usereservasescritura + reservaform.jsx) — la v1
// tampoco tiene un formulario propio aqui, _palcoAbrirReserva reutiliza
// abrirReservaManual(). No hay boton de eliminar en la tarjeta: en la v1 el
// borrado vive solo en la tabla de Reservas.
//
// EL CONTROL DE LUGARES DISPONIBLES NO ES UNA TABLA QUE SINCRONIZAR: no se
// guarda en ningun lado, se CALCULA sumando las reservas activas del palco
// (ocupacion_palco, en lib/pipeline.js) cada vez que se pinta. Guardar una
// reserva dispara recargar(), que relee la base; la ocupacion se recalcula
// sola con los datos frescos — no hay nada que "sincronizar" aparte.
// Sigue sin migrar el reporte descargable: dispara un archivo, no escribe.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import usereservasescritura from '../../hooks/usereservasescritura'
import ReservaForm from './reservaform'
import { estado_pago_palco, lugares_de_reserva, ocupacion_palco, palcos_del_mapa } from '../../lib/pipeline'
import { redondear_dinero, mxn2 } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

export default function palcos() {
  const { areas, reservas, juegos, cargando } = useadmindatos()
  const { puede, guardar, guardando } = usereservasescritura()
  const [form, setform] = useState(null) // { editando } | null

  // El proximo juego se PRESELECCIONA, igual que en Reservas. Va DERIVADO y no
  // en un useEffect: con el efecto el primer render se pintaba vacio —y el
  // banco de pruebas, que no ejecuta efectos, nunca llegaba a probar el
  // tablero ni sus KPIs, solo el mensaje "elige un juego".
  const [juegoelegido, setjuegoelegido] = useState('')
  const juegoauto = useMemo(() => {
    if (!juegos.length) return ''
    const hoy = hoy_hermosillo()
    const prox = juegos.find((j) => (j.fecha || '') >= hoy) || juegos[0]
    return prox ? String(prox.id) : ''
  }, [juegos])
  const juegoid = juegoelegido || juegoauto

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
            value={juegoid} onChange={(e) => setjuegoelegido(e.target.value)}
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
                  style={{
                    minWidth: '290px', maxWidth: '290px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px', overflow: 'hidden',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {area.nombre}
                      </div>
                      {o.agotado ? (
                        <span className="badge badge-red" style={{ fontSize: '10px', marginLeft: 'auto', flexShrink: 0 }}>
                          AGOTADO
                        </span>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: '10px', marginLeft: 'auto', flexShrink: 0 }}>
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
                    {o.reservas.map((r) => {
                      const lugares = lugares_de_reserva(r)
                      const { neto, saldo, liquidada, pendiente } = estado_pago_palco(r)
                      const raya = liquidada ? 'var(--verde)' : pendiente ? 'var(--naranja)' : 'var(--azul, #2563eb)'
                      return (
                        <div
                          key={r.id}
                          role={puede ? 'button' : undefined}
                          tabIndex={puede ? 0 : undefined}
                          onClick={() => puede && setform({ editando: r })}
                          onKeyDown={(e) => {
                            if (puede && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setform({ editando: r }) }
                          }}
                          title={puede ? 'Clic para editar la reserva' : undefined}
                          style={{
                            background: 'var(--surface-2)', borderRadius: '8px', padding: '9px 10px',
                            borderLeft: '3px solid ' + raya, cursor: puede ? 'pointer' : 'default', overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                            {/* minWidth:0 es lo que de verdad hace efecto el ellipsis: un hijo
                                flex mide su min-width por su contenido (auto), no por el ancho
                                disponible, y sin esto un nombre largo empujaba la tarjeta mas
                                alla de los 290px de la columna y se encimaba con la de al lado. */}
                            <span style={{ fontSize: '13px', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.cliente || '—'}
                              {/* Afordancia explicita de que la tarjeta es clicable — el cursor
                                  solo no bastaba para que se notara que abre la edicion. */}
                              {puede && (
                                <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: '5px' }} title="Clic para editar la reserva">
                                  ✎
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--naranja)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {lugares} lugar{lugares === 1 ? '' : 'es'}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{r.id}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '6px' }}>
                            <span style={{ color: 'var(--text-3)' }}>{money(neto)}</span>
                            {liquidada ? (
                              <span style={{ color: 'var(--verde)', fontWeight: 700 }}>Liquidada</span>
                            ) : (
                              <span style={{ color: 'var(--rojo)', fontWeight: 700 }}>Resta {money(saldo)}</span>
                            )}
                          </div>
                          {pendiente && (
                            <div style={{ fontSize: '10px', color: 'var(--naranja)', fontWeight: 700, marginTop: '4px' }}>
                              ⏳ Apartado sin pago confirmado
                            </div>
                          )}
                        </div>
                      )
                    })}
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

      <ReservaForm
        abierto={!!form}
        editando={form ? form.editando : null}
        juegoinicial={juegoid}
        zonainicial=""
        oncerrar={() => setform(null)}
        onguardar={guardar}
        guardando={guardando}
      />
    </div>
  )
}
