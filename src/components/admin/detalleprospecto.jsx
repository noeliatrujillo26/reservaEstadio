// ═══════════════════════════════════════════════════════════════════
// detalleprospecto.jsx — detalle de una tarjeta del Pipeline.
// espejo 1:1 de v1: #modal-prospecto-detalle, abrirProspecto(),
// guardarMovimientoProspecto(), renderHistorialPD() y _pdGenerarReserva()
// (js/modules/pipeline.js).
//
// Tres cosas en un sitio: los datos editables de la cotizacion, el HISTORIAL
// de pagos (consulta) y el boton que convierte la tarjeta en reserva.
//
// GENERAR RESERVA es el flujo obligatorio del negocio: una reserva nace aqui,
// no en la vista de Reservas. El boton exige respaldo —un abono registrado, o
// marcar "Pendiente" para apartar sin cobro— y se apaga si la tarjeta ya tiene
// su reserva: volver a pulsarlo creaba una segunda por descuido.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  abonado_etapa, pagos_de_tarjeta, pipeline_etapas, reservas_activas, suma_pagos_dinero,
} from '../../lib/pipeline'
import { msg_sin_pago, msg_ya_generada, puede_generar_reserva } from '../../lib/prospectos'
import { map_precio } from '../../lib/preciosadmin'
import { min_seccion, precio_seccion } from '../../lib/reservasadmin'
import { formato_fecha } from '../../lib/cobros'
import { es_cobro_credito } from '../../lib/dashboard'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// El padre monta este componente SOLO con una tarjeta, y con key={card.id}.
// Asi el estado inicial puede derivarse de `card` sin efectos ni guardas.
function detalle_prospecto({ card, puede, oncerrar, oneditar, ongenerar, guardando }) {
  const { juegos, areas, secciones, reservas, cobros, politica } = useadmindatos()

  const [editando, seteditando] = useState(false)
  const [pendiente, setpendiente] = useState(false)
  const [campos, setcampos] = useState([])
  // El formulario arranca DERIVADO de la tarjeta, no cargado por un efecto.
  // Con el efecto, el primer render devolvia null: la vista salia vacia un
  // instante, y el banco de pruebas —que no ejecuta efectos— renderizaba CERO
  // caracteres y lo daba por bueno. El padre monta este modal con key={id},
  // asi que cambiar de tarjeta lo reinicia sin necesidad de sincronizar nada.
  const [d, setd] = useState(() => ({
    nombre: card.nombre || '', email: card.email || '', tel: card.tel || '',
    juegoid: card.juego || '', zonaid: card.zonaid || '',
    consumomonto: card.consumomonto || 0, extramonto: card.extramonto || 0,
    adultos: card.adultos || 0, ninos: card.ninos || 0,
    adultoextraprecio: card.adultoextraprecio || 0,
    ninoextraprecio: card.ninoextraprecio || 0,
    descuento: card.descuento || 0, descripcion: card.descripcion || '',
    notas: card.notas || '', vendedora: card.vendedora || '',
    tipocomida: card.tipocomida || 'carne_asada',
  }))

  const catalogo = useMemo(() => (secciones || []).map(map_precio), [secciones])

  const pagos = useMemo(() => pagos_de_tarjeta(card, cobros || []), [card, cobros])
  const activas = useMemo(() => reservas_activas(card, reservas), [card, reservas])

  const juego = (juegos || []).find((j) => String(j.id) === String(d.juegoid)) || null
  const area = (areas || []).find((a) => a.id === d.zonaid) || null
  const areamonto = area ? precio_seccion(area, catalogo) || 0 : 0
  const incluidas = area ? min_seccion(area, catalogo, juego) : 0

  const etapa = pipeline_etapas.find((e) => e.id === card.etapa)
  const abonadoreal = suma_pagos_dinero(pagos)
  const abonadoetapa = abonado_etapa(card, cobros || [])
  const credito = abonadoetapa - abonadoreal
  const puedegenerar = puede_generar_reserva(card, { reservas, cobros, pendiente })

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))
  const err = (k) => (campos.includes(k) ? ' input-error' : '')

  async function guardar() {
    setcampos([])
    const r = await oneditar(card, { ...d, areamonto })
    if (r && r.ok) seteditando(false)
    else if (r && r.campos) setcampos(r.campos)
  }

  async function generar() {
    if (!puedegenerar) return
    await ongenerar(card, { juegoid: d.juegoid, zonaid: d.zonaid, areamonto })
  }

  const chip = (label, valor, color) => (
    <div className="info-chip">
      <div className="info-chip-label">{label}</div>
      <div className="info-chip-val" style={color ? { color } : undefined}>{valor}</div>
    </div>
  )

  const campo = (k, etiqueta, props) => (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{etiqueta}</label>
      <input
        className={'input' + err(k)} value={d[k]} disabled={!editando}
        onChange={(e) => set(k, e.target.value)} {...props}
      />
    </div>
  )

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{card.nombre}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
              {(card.folio || '—') + ' · ' + (etapa ? etapa.label : card.etapa)}
            </div>
          </div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {chip('Folio', card.folio || '—')}
            {chip('Monto total', money(card.monto), 'var(--naranja)')}
            {chip('Abonado', money(abonadoreal), abonadoreal > 0 ? 'var(--verde)' : undefined)}
          </div>
          {credito > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--naranja)', fontWeight: 700 }}>
              💳 A crédito (no cobrado): {money(credito)}
            </div>
          )}

          {/* ── Datos de la cotización ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
              Datos de la cotización
            </div>
            {puede && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => seteditando((x) => !x)}
                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 9px' }}
              >
                {editando ? 'Cancelar edición' : '✏️ Modificar'}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {campo('nombre', 'Nombre / Empresa *')}
            {campo('email', 'Email', { type: 'email' })}
            {campo('tel', 'Teléfono', { maxLength: 10, inputMode: 'numeric' })}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vendedora</label>
              <input className="input" value={d.vendedora} disabled={!editando}
                onChange={(e) => set('vendedora', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Juego</label>
              <select className="input select" value={d.juegoid} disabled={!editando}
                onChange={(e) => set('juegoid', e.target.value)}>
                <option value="">— Selecciona —</option>
                {(juegos || []).map((j) => (
                  <option key={j.id} value={j.id}>{j.fecha + ' · vs ' + j.rival}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zona</label>
              <select className="input select" value={d.zonaid} disabled={!editando}
                onChange={(e) => set('zonaid', e.target.value)}>
                <option value="">— Selecciona —</option>
                {(areas || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Monto Área: <strong>{money(areamonto)}</strong>
            {incluidas > 0 && ' · incluye ' + incluidas + ' personas'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {campo('consumomonto', 'Consumo ($)', { type: 'number', min: '0', step: '0.01' })}
            {campo('extramonto', 'Extra ($)', { type: 'number', min: '0', step: '0.01' })}
            {campo('adultos', 'Adultos extra', { type: 'number', min: '0', step: '1' })}
            {campo('ninos', 'Niños extra', { type: 'number', min: '0', step: '1' })}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Notas</label>
            <textarea
              className="input" rows={2} style={{ width: '100%', resize: 'vertical' }}
              value={d.notas} disabled={!editando}
              onChange={(e) => set('notas', e.target.value)}
            />
          </div>

          {editando && (
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}

          {/* ── Historial de pagos (consulta) ── */}
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            Historial de pagos
          </div>
          {pagos.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              Sin pagos registrados todavía.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Fecha</th>
                    <th>Concepto</th>
                    <th>Forma</th>
                    <th>Monto</th>
                    <th>Registró</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formato_fecha(p.fecha)}</td>
                      <td>
                        <span className="tag">{p.concepto}</span>
                        {es_cobro_credito(p) && (
                          <span className="badge badge-orange" style={{ fontSize: '10px', marginLeft: '4px' }}>
                            crédito
                          </span>
                        )}
                      </td>
                      <td>{p.formapago}</td>
                      <td style={{ fontWeight: 700 }}>{money(p.monto)}</td>
                      <td className="td-muted">{p.recibio || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Reservas vinculadas / generar ── */}
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            Reserva vinculada
          </div>
          {activas.length > 0 ? (
            <div style={{ fontSize: '12px' }}>
              {activas.map((r) => (
                <div key={r.id}>
                  <strong>{r.id}</strong> · {r.zona} · {money(r.montopagado)} de{' '}
                  {money(Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentomonto) || 0)))}
                </div>
              ))}
              <div style={{ color: 'var(--text-3)', marginTop: '4px' }}>{msg_ya_generada}</div>
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox" style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  checked={pendiente} onChange={(e) => setpendiente(e.target.checked)}
                  disabled={!puede}
                />
                Pendiente — apartar la zona sin cobro por ahora
              </label>
              {!puedegenerar && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{msg_sin_pago}</div>
              )}
              {puede && (
                <button
                  className="btn btn-primary" onClick={generar}
                  disabled={!puedegenerar || guardando || !d.juegoid || !d.zonaid}
                  title={puedegenerar ? '' : msg_sin_pago}
                >
                  {guardando ? 'Generando…' : '🏟 Generar Reserva'}
                </button>
              )}
              {(!d.juegoid || !d.zonaid) && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                  Elige juego y zona arriba para poder generar la reserva.
                </div>
              )}
            </>
          )}

          {politica && (
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Enganche mínimo vigente: {politica.enganche_minimo}% ·{' '}
              {money((Number(card.monto) || 0) * politica.enganche_minimo / 100)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const DetalleProspecto = detalle_prospecto
export default DetalleProspecto
