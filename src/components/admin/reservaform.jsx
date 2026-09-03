// ═══════════════════════════════════════════════════════════════════
// reservaform.jsx — panel lateral "Nueva reserva" / "Editar reserva".
// espejo 1:1 de v1: #res-drawer (index.html 3100-3210), abrirReservaManual(),
// editarReservaRes() y _resSumarPersonas() (js/20-editor-mapa.js).
//
// EL FORMULARIO ES CORTO A PROPOSITO, y no por recortar la migracion: el
// negocio ya lo recorto en la v1. Sus campos de personas, precio y forma de
// pago viven en el DOM dentro de un `display:none` con esta nota literal:
//
//   "Para modificar las personas extra o los precios, hazlo desde
//    Detalles de la cotización en el prospecto."
//
// Es decir: una reserva suelta se captura como APARTADO —seccion, cliente y
// nada mas—, nace con pago "Sin pago" al precio de lista de la seccion, y todo
// lo demas se gobierna desde la cotizacion del prospecto. Reponer aqui esos
// campos seria devolver una capacidad que se retiro a proposito.
//
// Al EDITAR se hereda la economia de la reserva (bruto + descuento) en vez de
// recalcularla: pisarla con el precio de lista dejaba el descuento viejo sobre
// un bruto nuevo, y una reserva de $23,300 con $23,067 de descuento acababa
// con neto $0, marcada como liquidada sin haber cobrado.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { catalogo_clientes, cliente_coincide } from '../../lib/clientes'
import { map_precio } from '../../lib/preciosadmin'
import { estado_vivo } from '../../lib/mapaocupacion'
import { min_seccion, precio_seccion } from '../../lib/reservasadmin'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

function reserva_form({ abierto, editando, juegoinicial, zonainicial, oncerrar, onguardar, guardando }) {
  const { juegos, areas, secciones, clientes, reservas, areasestados, politica } = useadmindatos()

  const [juegoid, setjuegoid] = useState('')
  const [zonaid, setzonaid] = useState('')
  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [cliente, setcliente] = useState(null)   // { nombre, email, tel }
  const [manual, setmanual] = useState(false)    // alta de cliente nuevo
  const [errorcampo, seterrorcampo] = useState(null)

  const catalogo = useMemo(() => (secciones || []).map(map_precio), [secciones])

  useEffect(() => {
    if (!abierto) return
    seterrorcampo(null)
    setabrirdrop(false)
    setbusqueda('')
    if (editando) {
      setjuegoid(String(editando.juegoid || ''))
      setzonaid(String(editando.zonaid || ''))
      setcliente({
        nombre: editando.cliente || '',
        email: editando.email || '',
        tel: editando.tel || '',
      })
      setmanual(false)
    } else {
      setjuegoid(String(juegoinicial || ''))
      setzonaid(String(zonainicial || ''))
      setcliente(null)
      setmanual(false)
    }
  }, [abierto, editando, juegoinicial, zonainicial])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    if (abierto) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [abierto, oncerrar])

  const juego = useMemo(
    () => (juegos || []).find((x) => String(x.id) === String(juegoid)) || null,
    [juegos, juegoid]
  )
  const area = useMemo(
    () => (areas || []).find((x) => String(x.id) === String(zonaid)) || null,
    [areas, zonaid]
  )

  // Solo secciones LIBRES para el juego elegido — mas la propia cuando se
  // edita, que obviamente esta reservada por esta misma reserva.
  const zonas = useMemo(() => {
    if (!juegoid) return []
    return (areas || []).filter((a) => {
      if (editando && String(a.id) === String(editando.zonaid)) return true
      return estado_vivo(areasestados, juegoid, a.id) === 'libre'
    })
  }, [areas, areasestados, juegoid, editando])

  const catalogoclientes = useMemo(
    () => catalogo_clientes({ clientes, reservas }),
    [clientes, reservas]
  )
  const coincidencias = useMemo(
    () => catalogoclientes.filter((c) => cliente_coincide(c, busqueda)),
    [catalogoclientes, busqueda]
  )

  // Personas: incluidas de la seccion + extras. En una reserva suelta no hay
  // extras (vienen de la cotizacion), asi que el total ES lo incluido.
  const incluidas = area ? min_seccion(area, catalogo, juego) : 0
  const adultosextra = editando ? Number(editando.adultos) || 0 : 0
  const ninos = editando ? Number(editando.ninos) || 0 : 0
  const personas = incluidas + adultosextra + ninos

  // Economia: al editar se HEREDA la de la reserva; al crear, precio de lista.
  const bruto = editando
    ? Number(editando.monto) || 0
    : (area ? precio_seccion(area, catalogo) || 0 : 0)
  const descuentopct = editando && Number(editando.monto) > 0
    ? Math.min(Number(editando.descuentomonto) || 0, Number(editando.monto)) / Number(editando.monto)
    : 0
  const descuento = Math.min(bruto * descuentopct, bruto)
  const neto = Math.max(0, bruto - descuento)

  if (!abierto) return null

  async function guardar() {
    seterrorcampo(null)
    const r = await onguardar({
      juegoid,
      zonaid,
      nombre: cliente ? cliente.nombre : '',
      email: cliente ? cliente.email : '',
      tel: cliente ? cliente.tel : '',
      // Una reserva suelta nace SIN pago: el badge queda "Incompleto" y el
      // cobro real se registra despues, con su comprobante.
      pago: editando ? editando.pago || 'Sin pago' : 'Sin pago',
      metodo: editando ? editando.metodo || 'Tarjeta' : 'Tarjeta',
      adultos: adultosextra,
      ninos,
      personas,
      bruto,
      descuentopct,
      engancheminpct: politica ? politica.enganche_minimo : 0,
      saldoconsumo: editando ? editando.saldoconsumo || 0 : 0,
      cotizacionid: editando ? editando.cotizacionid || '' : '',
      editando,
    })
    if (r && r.ok) oncerrar()
    else if (r && r.campo) seterrorcampo(r.campo)
  }

  function elegir(c) {
    setcliente({
      nombre: c.nombre || '',
      email: c.email === '—' ? '' : c.email || '',
      tel: c.tel === '—' ? '' : c.tel || '',
    })
    setabrirdrop(false)
    setmanual(false)
  }

  const campo_cliente = (k, valor, props) => (
    <input
      className={'input' + (errorcampo === k ? ' input-error' : '')}
      value={valor}
      onChange={(e) => setcliente((c) => ({ ...(c || { nombre: '', email: '', tel: '' }), [k]: e.target.value }))}
      {...props}
    />
  )

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title">{editando ? 'Editar reserva' : 'Nueva reserva'}</div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Juego *</label>
            <select
              className={'input select' + (errorcampo === 'juego' ? ' input-error' : '')}
              value={juegoid}
              onChange={(e) => { setjuegoid(e.target.value); setzonaid('') }}
            >
              <option value="">— Selecciona un juego —</option>
              {(juegos || []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.fecha + ' · vs ' + j.rival + ' · Juego ' + j.num}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sección *</label>
            <select
              className={'input select' + (errorcampo === 'zona' ? ' input-error' : '')}
              value={zonaid} disabled={!juegoid}
              onChange={(e) => setzonaid(e.target.value)}
            >
              <option value="">— Selecciona sección —</option>
              {zonas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
              Solo secciones libres para el juego seleccionado.
            </p>
          </div>

          {/* Resumen de SOLO LECTURA, igual que la v1. */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total de Adultos
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{incluidas + adultosextra}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total de Niños
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{ninos}</div>
            </div>
            <div style={{ gridColumn: '1/-1', fontSize: '12px', color: 'var(--text-3)' }}>
              Total de personas:{' '}
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {personas + (incluidas ? ' (' + incluidas + ' incl. + ' + (adultosextra + ninos) + ' extra)' : '')}
              </span>
            </div>
            <div style={{ gridColumn: '1/-1', fontSize: '11px', color: 'var(--text-3)' }}>
              ✎ Para modificar las personas extra o los precios, hazlo desde{' '}
              <strong>Detalles de la cotización</strong> en el prospecto.
            </div>
          </div>

          {/* Economia derivada: se muestra para que quede claro que se guarda. */}
          {area && (
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              Total {money(bruto)}
              {descuento > 0 && ' · Descuento ' + money(descuento) + ' · Neto ' + money(neto)}
              {!editando && ' · Nace sin pago registrado'}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Cliente *</label>
            {!cliente && !manual && (
              <div style={{ position: 'relative' }}>
                <input
                  className={'input' + (errorcampo === 'nombre' ? ' input-error' : '')}
                  placeholder="Buscar cliente por nombre, correo o teléfono…"
                  autoComplete="off" value={busqueda}
                  onChange={(e) => { setbusqueda(e.target.value); setabrirdrop(true) }}
                  onFocus={() => setabrirdrop(true)}
                />
                {abrirdrop && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', zIndex: 500,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  }}>
                    {coincidencias.slice(0, 60).map((c, i) => (
                      <div
                        key={(c.id != null ? c.id : 'r') + '-' + i}
                        onMouseDown={() => elegir(c)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '13px' }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {(c.email || 'sin correo') + (c.tel ? ' · ' + c.tel : '')}
                        </div>
                      </div>
                    ))}
                    <div
                      onMouseDown={() => { setmanual(true); setcliente({ nombre: '', email: '', tel: '' }); setabrirdrop(false) }}
                      style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--naranja)', fontWeight: 700 }}
                    >
                      + Capturar cliente nuevo
                    </div>
                  </div>
                )}
              </div>
            )}

            {cliente && (
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--verde)',
                borderRadius: '8px', padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {manual ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {campo_cliente('nombre', cliente.nombre, { placeholder: 'Nombre completo *' })}
                        {campo_cliente('email', cliente.email, { type: 'email', placeholder: 'Email *' })}
                        {campo_cliente('tel', cliente.tel, {
                          placeholder: 'Teléfono * (10 dígitos)', maxLength: 10, inputMode: 'numeric',
                        })}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{cliente.nombre}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {(cliente.email || 'sin correo') + (cliente.tel ? ' · ' + cliente.tel : '')}
                        </div>
                        {/* El telefono es obligatorio y muchas fichas no lo
                            traen: se pide aqui mismo en vez de mandar al
                            usuario a otra pantalla. */}
                        {!cliente.tel && (
                          <div style={{ marginTop: '6px' }}>
                            {campo_cliente('tel', cliente.tel, {
                              placeholder: 'Teléfono * (10 dígitos)', maxLength: 10,
                              inputMode: 'numeric', style: { fontSize: '12px', height: '32px' },
                            })}
                          </div>
                        )}
                        {!cliente.email && (
                          <div style={{ marginTop: '6px' }}>
                            {campo_cliente('email', cliente.email, {
                              type: 'email', placeholder: 'Email *',
                              style: { fontSize: '12px', height: '32px' },
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setcliente(null); setmanual(false); setbusqueda('') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                      fontSize: '18px', lineHeight: 1, padding: '0 4px', flexShrink: 0,
                    }}
                    aria-label="Quitar cliente"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cancelar</button>
          <button
            className="btn btn-primary" onClick={guardar} disabled={guardando}
            style={guardando ? { opacity: 0.6 } : undefined}
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ReservaForm = reserva_form
export default ReservaForm
