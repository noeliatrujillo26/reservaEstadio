// ═══════════════════════════════════════════════════════════════════
// cotizform.jsx — modal "Nueva cotización" / "Editar cotización".
// espejo 1:1 de v1: #modal-nueva-cotiz + guardarCotiz()/editarCotiz(),
// calcCotiz() y _validaCotizFecha() (js/modules/cotizaciones.js).
//
// El desglose se recalcula EN VIVO con la misma funcion que se guarda
// (calcular_cotizacion), no con una copia paralela — lo que el usuario ve en
// pantalla es exactamente lo que se persiste. Ver la cabecera de
// lib/cotizaciones.js para las tres deviaciones deliberadas frente a la v1
// (tope de 100% reutilizando calc_total_prospecto, "Monto Área" siempre
// editable en vez del escape "Otro (especificar)", y sin envio por
// WhatsApp/correo/PDF/clave de gerente en este formulario).
//
// "Monto Área" se autollena SOLO en el instante en que se ELIGE una zona
// (dentro del propio onChange, no en un efecto reactivo): asi, si despues se
// corrige a mano, nada lo vuelve a pisar por detras. Y si se limpia la zona
// (cotizacion sin seccion especifica, el equivalente a "Otro" de la v1 sin
// necesitar una opcion aparte) el monto tecleado se conserva tal cual.
//
// La ZONA solo ofrece secciones LIBRES para el juego elegido (mas la propia
// cuando se edita) — mismo criterio que reservaform.jsx: la disponibilidad se
// resuelve en el propio <select>, no con una opcion deshabilitada aparte.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { catalogo_clientes, cliente_coincide } from '../../lib/clientes'
import { calcular_cotizacion } from '../../lib/cotizaciones'
import { estado_vivo } from '../../lib/mapaocupacion'
import { map_precio } from '../../lib/preciosadmin'
import { min_seccion, precio_seccion } from '../../lib/reservasadmin'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

const vacio = {
  cliente: '', email: '', tel: '', empresa: '', descripcion: '',
  juegoid: '', zonaid: '', zona: '', tipocomida: 'carne_asada',
  areamonto: '', personasincluidas: '', consumodesc: '', consumomonto: '',
  extramonto: '', adultoextraprecio: '', adultoextracant: '',
  ninoextraprecio: '', ninoextracant: '', descuento: '', diasvalida: '15',
  vendedora: '', notas: '',
}

function cotiz_form({ abierto, editando, oncerrar, onguardar, guardando }) {
  const { juegos, areas, secciones, clientes, reservas, areasestados, descuentosvolumen, usuarios } = useadmindatos()

  const [d, setd] = useState(vacio)
  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [elegido, setelegido] = useState(false)
  const [campos, setcampos] = useState([])

  useEffect(() => {
    if (!abierto) return
    setcampos([])
    setabrirdrop(false)
    if (editando) {
      setd({
        cliente: editando.cliente || '', email: editando.email || '', tel: editando.tel || '',
        empresa: editando.empresa || '', descripcion: editando.descripcion || '',
        juegoid: editando.juegoid || '', zonaid: editando.zonaid || '', zona: editando.zona || '',
        tipocomida: editando.tipocomida === 'discada' ? 'discada' : 'carne_asada',
        areamonto: editando.areamonto || '', personasincluidas: editando.personasincluidas || '',
        consumodesc: editando.consumodesc || '', consumomonto: editando.consumomonto || '',
        extramonto: editando.extramonto || '',
        adultoextraprecio: editando.adultoextraprecio || '', adultoextracant: editando.adultoextracant || '',
        ninoextraprecio: editando.ninoextraprecio || '', ninoextracant: editando.ninoextracant || '',
        descuento: editando.descuento || '', diasvalida: '15',
        vendedora: editando.vendedora || '', notas: editando.notas || '',
      })
      setelegido(!!(editando.cliente))
      setbusqueda('')
    } else {
      setd(vacio)
      setelegido(false)
      setbusqueda('')
    }
  }, [abierto, editando])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    if (abierto) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [abierto, oncerrar])

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))

  const catalogo = useMemo(() => (secciones || []).map(map_precio), [secciones])
  const juego = useMemo(
    () => (juegos || []).find((j) => String(j.id) === String(d.juegoid)) || null,
    [juegos, d.juegoid]
  )
  // Solo secciones LIBRES para el juego elegido — mas la propia cuando se
  // edita, que obviamente esta reservada por esta misma cotizacion si ya
  // se convirtio en reserva.
  const zonas = useMemo(() => {
    if (!d.juegoid) return []
    return (areas || []).filter((a) => {
      if (editando && String(a.id) === String(editando.zonaid)) return true
      return estado_vivo(areasestados, d.juegoid, a.id) === 'libre'
    })
  }, [areas, areasestados, d.juegoid, editando])
  const area = useMemo(
    () => (areas || []).find((a) => a.id === d.zonaid) || null,
    [areas, d.zonaid]
  )

  const areacatalogo = area ? precio_seccion(area, catalogo) || 0 : 0
  const minpersonas = area ? min_seccion(area, catalogo, juego) : 0

  const calc = useMemo(
    () => calcular_cotizacion(
      { ...d, personasincluidas: d.personasincluidas || minpersonas },
      { descuentosvolumen }
    ),
    [d, minpersonas, descuentosvolumen]
  )

  const catalogoclientes = useMemo(
    () => catalogo_clientes({ clientes, reservas }),
    [clientes, reservas]
  )
  const coincidencias = useMemo(
    () => catalogoclientes.filter((c) => cliente_coincide(c, busqueda)),
    [catalogoclientes, busqueda]
  )
  const vendedoras = useMemo(
    () => [...new Set((usuarios || []).map((u) => u.nombre).filter(Boolean))].sort(),
    [usuarios]
  )

  if (!abierto) return null

  async function guardar() {
    setcampos([])
    const r = await onguardar({
      ...d,
      zona: area ? area.nombre : '',
      editando,
    })
    if (r && r.ok) oncerrar()
    else if (r && r.campos) setcampos(r.campos)
  }

  const err = (k) => (campos.includes(k) ? ' input-error' : '')

  const num = (k, etiqueta, props) => (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{etiqueta}</label>
      <input
        className={'input' + err(k)} type="number" min="0" step="0.01"
        value={d[k]} onChange={(e) => set(k, e.target.value)} {...props}
      />
    </div>
  )

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '600px' }}>
        <div className="modal-header">
          <div className="modal-title">{editando ? 'Editar cotización · ' + editando.id : 'Nueva cotización'}</div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ── Cliente ── */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Cliente *</label>
            {!elegido ? (
              <div style={{ position: 'relative' }}>
                <input
                  className={'input' + err('cliente')}
                  placeholder="Buscar cliente por nombre, correo o teléfono…"
                  autoComplete="off" value={busqueda}
                  onChange={(e) => {
                    setbusqueda(e.target.value)
                    set('cliente', e.target.value.trim())
                    setabrirdrop(true)
                  }}
                  onFocus={() => setabrirdrop(true)}
                />
                {abrirdrop && coincidencias.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', zIndex: 500,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  }}>
                    {coincidencias.slice(0, 60).map((c, i) => (
                      <div
                        key={(c.id != null ? c.id : 'r') + '-' + i}
                        onMouseDown={() => {
                          setd((x) => ({
                            ...x,
                            cliente: c.nombre || '',
                            email: c.email === '—' ? '' : c.email || '',
                            tel: c.tel === '—' ? '' : c.tel || '',
                            empresa: x.empresa || c.empresa || '',
                          }))
                          setelegido(true)
                          setabrirdrop(false)
                        }}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '13px' }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {(c.email || 'sin correo') + (c.tel ? ' · ' + c.tel : '')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--verde)',
                borderRadius: '8px', padding: '8px 12px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.cliente}</div>
                <button
                  type="button"
                  onClick={() => { setelegido(false); setbusqueda(''); set('cliente', '') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '18px', lineHeight: 1 }}
                  aria-label="Cambiar cliente"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email</label>
              <input
                className={'input' + err('email')} type="email"
                value={d.email} onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Teléfono (10 dígitos)</label>
              <input
                className={'input' + err('tel')} maxLength={10} inputMode="numeric"
                value={d.tel} onChange={(e) => set('tel', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Empresa</label>
            <input className="input" value={d.empresa} onChange={(e) => set('empresa', e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Descripción</label>
            <textarea
              className="input" rows={2} style={{ width: '100%', resize: 'vertical' }}
              value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Juego</label>
              <select
                className="input select" value={d.juegoid}
                onChange={(e) => { set('juegoid', e.target.value); set('zonaid', '') }}
              >
                <option value="">— Selecciona —</option>
                {(juegos || []).map((j) => (
                  <option key={j.id} value={j.id}>{j.fecha + ' · vs ' + j.rival}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zona</label>
              <select
                className="input select" value={d.zonaid} disabled={!d.juegoid}
                onChange={(e) => {
                  const zid = e.target.value
                  const elegida = (areas || []).find((a) => a.id === zid) || null
                  setd((x) => ({
                    ...x,
                    zonaid: zid,
                    areamonto: elegida ? (precio_seccion(elegida, catalogo) || 0) : x.areamonto,
                    personasincluidas: elegida ? min_seccion(elegida, catalogo, juego) : x.personasincluidas,
                  }))
                }}
              >
                <option value="">{d.juegoid ? '— Selecciona —' : 'Elige primero un juego'}</option>
                {zonas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tipo de comida</label>
              <select className="input select" value={d.tipocomida} onChange={(e) => set('tipocomida', e.target.value)}>
                <option value="carne_asada">Carne asada</option>
                <option value="discada">Discada</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vendedor(a)</label>
              <select className="input select" value={d.vendedora} onChange={(e) => set('vendedora', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            Cotización
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Monto Área ($)</label>
              <input
                className="input" type="number" min="0" step="0.01" value={d.areamonto}
                onChange={(e) => set('areamonto', e.target.value)}
              />
              {area && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                  Catálogo: {money(areacatalogo)}{minpersonas > 0 && ' · incluye ' + minpersonas + ' personas'}
                </div>
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Consumo — descripción</label>
              <input className="input" value={d.consumodesc} onChange={(e) => set('consumodesc', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {num('consumomonto', 'Consumo ($)')}
            {num('extramonto', 'Extra ($)')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {num('adultoextraprecio', 'Precio adulto extra ($)')}
            {num('adultoextracant', 'Adultos extra', { step: '1' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {num('ninoextraprecio', 'Precio niño extra ($)')}
            {num('ninoextracant', 'Niños extra', { step: '1' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {num('descuento', 'Descuento manual (%)', { max: '100' })}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Válida por</label>
              <select className="input select" value={d.diasvalida} onChange={(e) => set('diasvalida', e.target.value)}>
                <option value="15">15 días</option>
                <option value="30">30 días</option>
              </select>
            </div>
          </div>

          {/* Resumen: EXACTAMENTE lo que se va a guardar. */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '10px 12px', fontSize: '12px',
          }}>
            <div>Subtotal (IVA incluido): <strong>{money(calc.subtotal)}</strong></div>
            {calc.volumenpct > 0 && (
              <div style={{ color: 'var(--verde)' }}>
                Descuento por grupo: {calc.volumenpct}%{calc.volumennombre ? ' · ' + calc.volumennombre : ''} (automático, {calc.personas} personas)
              </div>
            )}
            {calc.descuentototal > 0 && <div>Descuento total: −{money(calc.descuentototal)}</div>}
            <div>Subtotal (sin IVA): {money(calc.base)}</div>
            <div>IVA (16%, incluido): {money(calc.iva)}</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--naranja)', marginTop: '4px' }}>
              Total: {money(calc.total)}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Notas</label>
            <textarea
              className="input" rows={2} style={{ width: '100%', resize: 'vertical' }}
              value={d.notas} onChange={(e) => set('notas', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cancelar</button>
          <button
            className="btn btn-primary" onClick={guardar} disabled={guardando}
            style={guardando ? { opacity: 0.6 } : undefined}
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CotizForm = cotiz_form
export default CotizForm
