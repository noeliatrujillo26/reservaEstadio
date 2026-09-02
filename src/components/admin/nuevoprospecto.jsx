// ═══════════════════════════════════════════════════════════════════
// nuevoprospecto.jsx — modal "Nuevo prospecto".
// espejo 1:1 de v1: #modal-pipeline + buildPipelineModal(), calcPipTotal() y
// guardarNuevoProspecto() (js/modules/pipeline.js).
//
// El total se recalcula EN VIVO con la misma funcion que se guarda
// (calc_total_prospecto), no con una copia paralela: lo que el usuario ve en
// pantalla es exactamente lo que se persiste. El descuento por grupo es
// automatico y aditivo al manual, y el combinado se acota al 100%.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { catalogo_clientes, cliente_coincide } from '../../lib/clientes'
import { calc_total_prospecto } from '../../lib/prospectos'
import { pipeline_etapas } from '../../lib/pipeline'
import { map_precio } from '../../lib/preciosadmin'
import { min_seccion, precio_seccion } from '../../lib/reservasadmin'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

const vacio = {
  nombre: '', email: '', tel: '', juegoid: '', zonaid: '', etapaid: 'prospecto',
  vendedora: '', notas: '', descuento: '', consumomonto: '', extramonto: '',
  adultoextraprecio: '', adultoextracant: '', ninoextraprecio: '', ninoextracant: '',
  tipocomida: 'carne_asada',
}

function nuevo_prospecto({ abierto, oncerrar, oncrear, guardando }) {
  const { juegos, areas, secciones, clientes, reservas, descuentosvolumen, usuarios } = useadmindatos()

  const [d, setd] = useState(vacio)
  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [elegido, setelegido] = useState(false) // cliente tomado del catalogo
  const [campos, setcampos] = useState([])

  useEffect(() => {
    if (!abierto) return
    setd(vacio)
    setbusqueda('')
    setabrirdrop(false)
    setelegido(false)
    setcampos([])
  }, [abierto])

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))

  const catalogo = useMemo(() => (secciones || []).map(map_precio), [secciones])
  const juego = useMemo(
    () => (juegos || []).find((j) => String(j.id) === String(d.juegoid)) || null,
    [juegos, d.juegoid]
  )
  const area = useMemo(
    () => (areas || []).find((a) => a.id === d.zonaid) || null,
    [areas, d.zonaid]
  )

  // El "Monto Área" y las personas incluidas salen del catalogo de Precios en
  // cuanto hay seccion y juego: nadie los teclea a mano.
  const areamonto = area ? precio_seccion(area, catalogo) || 0 : 0
  const minpersonas = area ? min_seccion(area, catalogo, juego) : 0

  const calc = useMemo(
    () => calc_total_prospecto(
      { ...d, areamonto, minpersonas, juegoid: d.juegoid, zonaid: d.zonaid },
      { descuentosvolumen }
    ),
    [d, areamonto, minpersonas, descuentosvolumen]
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
    const r = await oncrear({
      ...d,
      zona: area ? area.nombre : '',
      areamonto,
      minpersonas,
      codigodescuento: '',
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
          <div className="modal-title">Nuevo prospecto</div>
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
                  className={'input' + err('nombre')}
                  placeholder="Buscar cliente por nombre, correo o teléfono…"
                  autoComplete="off" value={busqueda}
                  onChange={(e) => {
                    setbusqueda(e.target.value)
                    set('nombre', e.target.value.trim())
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
                            nombre: c.nombre || '',
                            email: c.email === '—' ? '' : c.email || '',
                            tel: c.tel === '—' ? '' : c.tel || '',
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
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.nombre}</div>
                <button
                  type="button"
                  onClick={() => { setelegido(false); setbusqueda(''); setd((x) => ({ ...x, nombre: '', email: '', tel: '' })) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '18px', lineHeight: 1 }}
                  aria-label="Cambiar cliente"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Correo y telefono son OBLIGATORIOS: sin ellos el prospecto nace
              incontactable y arrastra el problema a la reserva. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email *</label>
              <input
                className={'input' + err('email')} type="email"
                value={d.email} onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Teléfono * (10 dígitos)</label>
              <input
                className={'input' + err('tel')} maxLength={10} inputMode="numeric"
                value={d.tel} onChange={(e) => set('tel', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Juego de interés *</label>
              <select
                className={'input select' + err('juego')}
                value={d.juegoid} onChange={(e) => set('juegoid', e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {(juegos || []).map((j) => (
                  <option key={j.id} value={j.id}>{j.fecha + ' · vs ' + j.rival}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zona</label>
              <select className="input select" value={d.zonaid} onChange={(e) => set('zonaid', e.target.value)}>
                <option value="">— Selecciona —</option>
                {(areas || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Etapa inicial</label>
              <select className="input select" value={d.etapaid} onChange={(e) => set('etapaid', e.target.value)}>
                {pipeline_etapas.slice(0, 2).map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vendedora</label>
              <select className="input select" value={d.vendedora} onChange={(e) => set('vendedora', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

          {/* ── Cotización ── */}
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            Cotización
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Monto Área: <strong>{money(areamonto)}</strong>
            {minpersonas > 0 && ' · incluye ' + minpersonas + ' personas'}
            {!area && ' · elige una zona para tomar la tarifa del catálogo'}
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
              <label className="form-label">Tipo de comida</label>
              <select className="input select" value={d.tipocomida} onChange={(e) => set('tipocomida', e.target.value)}>
                <option value="carne_asada">Carne asada</option>
                <option value="discada">Discada</option>
              </select>
            </div>
          </div>

          {/* Resumen: EXACTAMENTE lo que se va a guardar. */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '10px 12px', fontSize: '12px',
          }}>
            <div>Subtotal: <strong>{money(calc.subtotal)}</strong></div>
            {calc.volumenpct > 0 && (
              <div style={{ color: 'var(--verde)' }}>
                Descuento por grupo: {calc.volumenpct}% (automático, {calc.personas} personas)
              </div>
            )}
            {calc.descuentototal > 0 && <div>Descuento total: −{money(calc.descuentototal)}</div>}
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--naranja)', marginTop: '4px' }}>
              Total: {money(calc.total)}
            </div>
            <div style={{ color: 'var(--text-3)', marginTop: '2px' }}>
              {calc.totaladultos} adulto(s) · {calc.ninocant} niño(s) · {calc.personas} personas
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
            {guardando ? 'Guardando…' : 'Crear prospecto'}
          </button>
        </div>
      </div>
    </div>
  )
}

const NuevoProspecto = nuevo_prospecto
export default NuevoProspecto
