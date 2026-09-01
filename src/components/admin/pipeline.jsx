// ═══════════════════════════════════════════════════════════════════
// pipeline.jsx — tablero comercial (kanban).
// espejo 1:1 de v1: #page-pipeline de index.html y renderPipelineBoard()
// (js/modules/pipeline.js).
//
// MODO CONSULTA: el tablero de la v1 se opera arrastrando tarjetas entre
// columnas, y ese movimiento ESCRIBE la etapa en la base. Aqui las tarjetas no
// se arrastran ni se editan: se ven, se filtran y se consultan. Los totales
// por columna, el reloj de dias en etapa y el abonado acumulado si estan.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  columna_lleva_abonado, dias_en_etapa, filtrar_tarjetas, pagos_de_tarjeta,
  pipeline_etapas, series_de, suma_pagos_dinero,
} from '../../lib/pipeline'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// el badge de dias sube de tono con el tiempo, igual que la v1: lo que
// preocupa es que un apartado lleve dias sin que entre el enganche.
function tono_dias(d) {
  if (d == null) return null
  if (d >= 14) return 'badge-red'
  if (d >= 7) return 'badge-orange'
  if (d >= 3) return 'badge-yellow'
  return 'badge-gray'
}

export default function pipeline() {
  const { pipeline: cards, juegos, cobros, usuarios, cargando, errores } = useadmindatos()

  const [vendedora, setvendedora] = useState('')
  const [serie, setserie] = useState('')
  const [juego, setjuego] = useState('')
  const [texto, settexto] = useState('')

  const series = useMemo(() => series_de(juegos), [juegos])
  // el selector de juego se acota a la serie elegida, como en la v1.
  const juegos_filtro = useMemo(
    () => (serie ? juegos.filter((j) => j.serie === serie) : juegos),
    [juegos, serie]
  )
  const serie_ids = serie ? juegos_filtro.map((j) => j.id) : null

  // solo vendedoras ACTIVAS, igual que el select de la v1.
  const vendedoras = useMemo(
    () => usuarios.filter((u) => u.rol === 'Vendedora' && u.estado === 'Activo').map((u) => u.nombre),
    [usuarios]
  )

  const columnas = useMemo(
    () =>
      pipeline_etapas.map((etapa) => {
        const propias = filtrar_tarjetas(cards, etapa.id, {
          vendedora, juego, seriejuegoids: serie_ids, texto,
        })
        const total = propias.reduce((s, c) => s + (c.monto || 0), 0)
        // el abonado usa el MISMO criterio que la tarjeta: cobros activos,
        // dejando fuera el credito, que es cuenta por cobrar.
        const abonado = columna_lleva_abonado(etapa.id)
          ? propias.reduce((s, c) => s + suma_pagos_dinero(pagos_de_tarjeta(c, cobros)), 0)
          : null
        return { etapa, cards: propias, total, abonado }
      }),
    [cards, vendedora, juego, serie_ids, texto, cobros]
  )

  const est_select = { fontSize: '13px', width: '180px' }

  return (
    <div className="page active" id="page-pipeline">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2>Pipeline Comercial</h2>
            <p>Seguimiento de prospectos y reservas en proceso</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="pipeline-buscar" className="input btn-sm" type="search"
              placeholder="Buscar cliente, correo o tel…" style={{ width: '210px' }}
              title="Filtra las tarjetas de TODAS las columnas por nombre, correo, teléfono o folio"
              value={texto} onChange={(e) => settexto(e.target.value)}
            />
            <select
              className="input select btn-sm" style={est_select}
              value={vendedora} onChange={(e) => setvendedora(e.target.value)}
            >
              <option value="">Todas</option>
              {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              className="input select btn-sm" style={est_select}
              value={serie}
              onChange={(e) => { setserie(e.target.value); setjuego('') }}
            >
              <option value="">Todas las series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.desde} – {s.hasta} · vs {s.rival}
                </option>
              ))}
            </select>
            <select
              className="input select btn-sm" style={est_select}
              value={juego} onChange={(e) => setjuego(e.target.value)}
            >
              <option value="">Todos los juegos</option>
              {juegos_filtro.map((j) => (
                <option key={j.id} value={String(j.id)}>{j.fecha} · vs {j.rival}</option>
              ))}
            </select>
          </div>
        </div>

        {!cargando && errores.includes('pipeline_prospectos') && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px' }}>
            ⚠ No se pudo leer la tabla del pipeline.
          </div>
        )}

        <div
          id="pipeline-board"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(' + pipeline_etapas.length + ',minmax(240px,1fr))', gap: '14px', overflowX: 'auto', alignItems: 'start' }}
        >
          {columnas.map(({ etapa, cards: propias, total, abonado }) => (
            <div
              key={etapa.id}
              className="pipeline-col"
              style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px', border: '1px solid var(--border)', minHeight: '400px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: etapa.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{etapa.label}</span>
                <span className="badge badge-gray" style={{ fontSize: '10px', marginLeft: 'auto' }}>
                  {propias.length}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '10px' }}>
                {money(total)}
                {abonado != null && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--verde)' }}>abonado {money(abonado)}</span>
                  </>
                )}
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {propias.map((c) => {
                  const d = dias_en_etapa(c)
                  const tono = tono_dias(d)
                  const abonadocard = suma_pagos_dinero(pagos_de_tarjeta(c, cobros))
                  return (
                    <div
                      key={c.id}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '11px 12px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>{c.nombre}</div>
                        {d != null && (
                          <span className={'badge ' + tono} style={{ fontSize: '9px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            ⏱️ {d}d
                          </span>
                        )}
                      </div>
                      {c.folio && (
                        <div style={{ fontSize: '10.5px', color: 'var(--naranja)', fontWeight: 700, marginTop: '2px' }}>
                          {c.folio}
                        </div>
                      )}
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '3px' }}>
                        {[c.zona, c.vendedora].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{money(c.monto)}</span>
                        {abonadocard > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--verde)' }}>
                            abonado {money(abonadocard)}
                          </span>
                        )}
                      </div>
                      {(c.adultos > 0 || c.ninos > 0) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                          {c.adultos} adulto{c.adultos === 1 ? '' : 's'}
                          {c.ninos ? ' · ' + c.ninos + ' niño' + (c.ninos === 1 ? '' : 's') : ''}
                        </div>
                      )}
                      {c.tipocomida === 'discada' && (
                        <span className="badge badge-gray" style={{ fontSize: '9px', marginTop: '5px', display: 'inline-block' }}>
                          🌮 Discada
                        </span>
                      )}
                    </div>
                  )
                })}

                {propias.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '14px 2px', textAlign: 'center' }}>
                    {cargando ? 'Cargando…' : 'Sin tarjetas'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
