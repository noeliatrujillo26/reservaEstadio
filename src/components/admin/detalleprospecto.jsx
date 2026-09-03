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

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  abonado_etapa, pagos_de_tarjeta, pipeline_etapas, reservas_activas, suma_pagos_dinero,
} from '../../lib/pipeline'
import { msg_sin_pago, msg_ya_generada, puede_generar_reserva } from '../../lib/prospectos'
import { msg_no_eliminable, puede_eliminarse } from '../../lib/mapaocupacion'
import { es_pago_desde_saldo_favor } from '../../lib/cobros'
import { es_forma_efectivo, es_pago_credito, nombres_formas_pago } from '../../lib/dashboard'
import { map_precio } from '../../lib/preciosadmin'
import { min_seccion, precio_seccion } from '../../lib/reservasadmin'
import { formato_fecha } from '../../lib/cobros'
import { es_cobro_credito } from '../../lib/dashboard'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// El padre monta este componente SOLO con una tarjeta, y con key={card.id}.
// Asi el estado inicial puede derivarse de `card` sin efectos ni guardas.
function detalle_prospecto({
  card, puede, oncerrar, oneditar, ongenerar, oneliminar, onpagar,
  guardando, borrando, pagando,
}) {
  const { juegos, areas, secciones, reservas, cobros, politica, metodos } = useadmindatos()

  const [editando, seteditando] = useState(false)
  const [pendiente, setpendiente] = useState(false)
  const [campos, setcampos] = useState([])
  // formulario de pago de la tarjeta (agregarPagoPD).
  const [pago, setpago] = useState({
    concepto: 'ABONO', forma: '', monto: '', requierefactura: false,
    archivo: null, pendiente: false,
  })
  const [errorpago, seterrorpago] = useState(null)
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

  // El padre solo monta este modal mientras esta abierto (ver comentario de
  // arriba), asi que el listener vive mientras el componente vive: no hace
  // falta una guarda de "abierto".
  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [oncerrar])

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

  // Formas de pago del catalogo REAL (metodos_pago) + SALDO A FAVOR, que no es
  // un metodo del catalogo sino la aplicacion de dinero que ya entro.
  // 'Caja taquilla estadio' se garantiza SIEMPRE presente (ver
  // nombres_formas_pago): es la via mas comun para cerrar un abono en
  // persona, y su ausencia bloquearia ese flujo.
  const formaspago = nombres_formas_pago(metodos).concat(['CRÉDITO', 'SALDO A FAVOR'])

  const setp = (k, v) => setpago((x) => ({ ...x, [k]: v }))
  const formaefectiva = pago.pendiente ? 'PENDIENTE' : pago.forma
  const pagoescredito = !pago.pendiente && es_pago_credito(pago.concepto, formaefectiva)
  const pagoessaldo = !pago.pendiente && es_pago_desde_saldo_favor('', formaefectiva)
  // El comprobante es obligatorio salvo en cuatro casos, cada uno por su
  // motivo: credito (no hay archivo aun), pendiente (no hay pago), EFECTIVO
  // en cualquiera de sus formas del catalogo — incluida 'Caja taquilla
  // estadio' — (se recibe en mano) y saldo a favor (ese dinero ya entro con
  // el suyo).
  const comprobanteobligatorio = !pagoescredito && !pago.pendiente &&
    !es_forma_efectivo(formaefectiva, metodos) && !pagoessaldo

  async function pagar() {
    seterrorpago(null)
    const r = await onpagar(card, { ...pago, forma: formaefectiva })
    if (r && r.ok) {
      setpago({ concepto: 'ABONO', forma: '', monto: '', requierefactura: false, archivo: null, pendiente: false })
    } else if (r && r.campo) seterrorpago(r.campo)
  }

  async function eliminar() {
    await oneliminar(card)
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

          {/* ── Registrar un pago ── */}
          {puede && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
                Registrar pago
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Concepto</label>
                  <select className="input select" value={pago.concepto}
                    onChange={(e) => setp('concepto', e.target.value)}>
                    {['ABONO', 'ANTICIPO', 'LIQUIDACION', 'CONSUMO', 'CRÉDITO'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Monto *</label>
                  <input
                    className={'input' + (errorpago === 'monto' ? ' input-error' : '')}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={pago.monto} onChange={(e) => setp('monto', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Forma de pago</label>
                <select
                  className="input select" value={pago.forma} disabled={pago.pendiente}
                  onChange={(e) => setp('forma', e.target.value)}
                >
                  <option value="">— Selecciona —</option>
                  {formaspago.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* "Pendiente" es el apartado SIN cobro: no hay dinero todavia,
                  asi que no hay forma de pago ni comprobante que pedir. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox" style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  checked={pago.pendiente}
                  onChange={(e) => setpago((x) => ({ ...x, pendiente: e.target.checked, forma: '' }))}
                />
                Pendiente — apartar la zona sin cobro por ahora
              </label>

              {!pago.pendiente && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    {'Comprobante' + (comprobanteobligatorio ? ' *' : ' (Opcional)')}
                  </label>
                  <input
                    className={'input' + (errorpago === 'comprobante' && !pago.archivo ? ' input-error' : '')}
                    type="file" accept="image/*,application/pdf"
                    style={{ fontSize: '12px', padding: '6px' }}
                    onChange={(e) => setp('archivo', e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                    {comprobanteobligatorio
                      ? 'Obligatorio: adjunta el respaldo del pago.'
                      : pagoescredito
                        ? 'El crédito no lleva comprobante: todavía no hay dinero recibido.'
                        : pagoessaldo
                          ? 'El saldo a favor ya entró antes con su propio comprobante.'
                          : 'En efectivo el dinero se recibe en mano, sin documento externo.'}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox" style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  checked={pago.requierefactura}
                  onChange={(e) => setp('requierefactura', e.target.checked)}
                />
                Requiere factura
              </label>

              <button
                className="btn btn-primary btn-sm" onClick={pagar}
                disabled={pagando || !(parseFloat(pago.monto) > 0) || (!pago.forma && !pago.pendiente)}
              >
                {pagando ? 'Registrando…' : '+ Registrar pago'}
              </button>
            </>
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

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {puede ? (
            <button
              className="btn btn-danger btn-sm"
              onClick={eliminar}
              disabled={borrando === card.id || !puede_eliminarse(card)}
              title={puede_eliminarse(card) ? 'Eliminar prospecto' : msg_no_eliminable}
            >
              {borrando === card.id ? '…' : '🗑 Eliminar prospecto'}
            </button>
          ) : <span />}
          <button className="btn btn-ghost" onClick={oncerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const DetalleProspecto = detalle_prospecto
export default DetalleProspecto
