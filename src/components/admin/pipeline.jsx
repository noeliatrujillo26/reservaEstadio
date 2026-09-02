// ═══════════════════════════════════════════════════════════════════
// pipeline.jsx — tablero comercial (kanban).
// espejo 1:1 de v1: #page-pipeline de index.html y renderPipelineBoard()
// (js/modules/pipeline.js).
//
// ESCRITURA (Fase 2): alta de prospectos, detalle con edicion e historial,
// generacion de la reserva y movimiento entre columnas.
//
// Las tarjetas se ARRASTRAN, igual que en la v1, y ademas se pueden mover con
// el teclado (← →) o desde el detalle: el arrastre solo funciona con raton, y
// dejar el tablero inoperable sin el no es aceptable. Las cinco reglas que
// deciden si una tarjeta puede cambiar de columna viven en lib/prospectos.js,
// probadas aparte.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useprospectos from '../../hooks/useprospectos'
import NuevoProspecto from './nuevoprospecto'
import DetalleProspecto from './detalleprospecto'
import { useconfirmarseguro } from './confirmarseguro'
import { puede_eliminarse } from '../../lib/mapaocupacion'
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
  const {
    puede, crear, editar, mover, generar_reserva, eliminar, registrar_pago,
    guardando, moviendo, borrando, pagando,
  } = useprospectos()
  const { confirmarseguro, dialogo } = useconfirmarseguro()
  const [abrirnuevo, setabrirnuevo] = useState(false)
  // se guarda el ID y no la tarjeta: tras cada escritura el panel relee de la
  // base, y con el objeto viejo el detalle seguiria mostrando lo anterior.
  const [detalleid, setdetalleid] = useState(null)
  const [arrastrando, setarrastrando] = useState(null)

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

  const detalle = useMemo(
    () => (detalleid == null ? null : cards.find((c) => c.id === detalleid) || null),
    [detalleid, cards]
  )

  // ELIMINAR. Con reserva vinculada la eliminacion LIBERA el espacio en el
  // mapa, asi que exige motivo y contraseña — es la misma puerta que borrar
  // una reserva desde su tabla. Un prospecto puro, sin reservas, solo pide
  // confirmar: no hay nada que liberar ni dinero que descuadrar.
  async function pedir_eliminar(card) {
    if (!puede_eliminarse(card)) return
    const tienereservas = (card.reservaids || []).length > 0
    const conf = await confirmarseguro({
      titulo: tienereservas ? '⚠️ Eliminar reserva del Pipeline' : '🗑 Eliminar prospecto',
      descripcion: tienereservas ? (
        <>
          ¿Eliminar esta oportunidad y sus reservas{' '}
          <strong>{(card.reservaids || []).map((x) => '#' + x).join(', ')}</strong>?
          <br />
          Al confirmar, el espacio se liberará en el mapa para que otros clientes
          puedan reservarlo, y sus cobros se cancelarán.
        </>
      ) : (
        <>¿Eliminar a <strong>{card.nombre}</strong> del Pipeline?</>
      ),
      etiquetamotivo: '¿Por qué se elimina? *',
      pedirmotivo: tienereservas,
      textoconfirmar: tienereservas ? 'Confirmar y Eliminar' : 'Sí, eliminar',
    })
    if (!conf) return
    // Sin reservas la v1 no pide motivo; se deja constancia igual para que la
    // bitacora nunca tenga una eliminacion sin explicacion.
    const r = await eliminar(card, { motivo: conf.motivo || 'sin reserva vinculada' })
    if (r && r.ok) setdetalleid(null)
  }

  // Mover con TECLADO: ← una columna atras, → una adelante. El arrastre solo
  // funciona con raton, y el tablero tiene que poder operarse sin el.
  function mover_relativo(card, paso) {
    const i = pipeline_etapas.findIndex((e) => e.id === card.etapa)
    const destino = pipeline_etapas[i + paso]
    if (destino) mover(card, destino.id)
  }

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
            {puede && (
              <button className="btn btn-primary btn-sm" onClick={() => setabrirnuevo(true)}>
                + Nuevo prospecto
              </button>
            )}
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
              onDragOver={(e) => { if (puede && arrastrando) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                if (puede && arrastrando) mover(arrastrando, etapa.id)
                setarrastrando(null)
              }}
              style={{
                background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px',
                border: '1px solid ' + (arrastrando && arrastrando.etapa !== etapa.id ? 'var(--naranja)' : 'var(--border)'),
                minHeight: '400px',
              }}
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
                      role="button"
                      tabIndex={0}
                      draggable={puede}
                      onDragStart={() => setarrastrando(c)}
                      onDragEnd={() => setarrastrando(null)}
                      onClick={() => setdetalleid(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setdetalleid(c.id) }
                        else if (puede && e.key === 'ArrowRight') { e.preventDefault(); mover_relativo(c, 1) }
                        else if (puede && e.key === 'ArrowLeft') { e.preventDefault(); mover_relativo(c, -1) }
                      }}
                      title={puede ? 'Clic para ver el detalle · ← → para cambiar de columna' : 'Clic para ver el detalle'}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '8px', padding: '11px 12px',
                        cursor: puede ? 'grab' : 'pointer',
                        opacity: moviendo === c.id ? 0.5 : 1,
                      }}
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

      <NuevoProspecto
        abierto={abrirnuevo}
        oncerrar={() => setabrirnuevo(false)}
        oncrear={crear}
        guardando={guardando}
      />
      {detalle && (
      <DetalleProspecto
        key={detalle.id}
        card={detalle}
        puede={puede}
        oncerrar={() => setdetalleid(null)}
        oneditar={editar}
        ongenerar={generar_reserva}
        oneliminar={pedir_eliminar}
        onpagar={registrar_pago}
        guardando={guardando}
        borrando={borrando}
        pagando={pagando}
      />
      )}
      {dialogo}
    </div>
  )
}
