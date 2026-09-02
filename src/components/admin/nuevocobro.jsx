// ═══════════════════════════════════════════════════════════════════
// nuevocobro.jsx — modal "Registrar cobro manual".
// espejo 1:1 de v1: #modal-nuevo-cobro (index.html 3352-3436) y su logica
// (abrirNuevoCobro, _ncCliSearch, _ncCliSeleccionar, _ncCargarSaldoFavor,
// _ncPoblarReservas, _ncActualizarSaldo, _ncComprobanteObligatorio,
// _ncActualizarComprobanteUI — js/modules/cobros.js 1551-1797).
//
// Los avisos en vivo NO son adorno: son los que evitan el sobrecobro por
// descuido y los que explican por que un credito no baja el saldo. Se migran
// con el mismo texto y las mismas condiciones.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { sb } from '../../supabaseclient'
import useadmindatos from '../../hooks/useadmindatos'
import { catalogo_clientes, cliente_coincide, reservas_del_cliente } from '../../lib/clientes'
import { saldo_favor_de, toca_saldo_favor } from '../../lib/cascadas'
import { es_pago_credito } from '../../lib/dashboard'
import { mxn2 } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// mismas opciones y mismo orden que el <select> de la v1.
const conceptos = [
  { v: 'ABONO', t: 'Abono' },
  { v: 'ANTICIPO', t: 'Anticipo / Enganche' },
  { v: 'LIQUIDACION', t: 'Liquidación (pago total)' },
  { v: 'CONSUMO', t: 'Consumo' },
  { v: 'CRÉDITO', t: 'Crédito (por cobrar)' },
  { v: 'SALDO A FAVOR', t: 'Abono a Saldo a Favor' },
]

function nuevo_cobro({ abierto, oncerrar, onregistrar, guardando }) {
  const { clientes, reservas, metodos } = useadmindatos()

  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [cliente, setcliente] = useState(null)
  const [saldofavor, setsaldofavor] = useState(null)
  const [reservaid, setreservaid] = useState('')
  const [concepto, setconcepto] = useState('ABONO')
  const [monto, setmonto] = useState('')
  const [forma, setforma] = useState('')
  // La fecha por defecto es HOY EN HERMOSILLO, no la del navegador: con el
  // ancla en UTC el dia se corria hacia atras por la noche.
  const [fecha, setfecha] = useState(hoy_hermosillo())
  const [requierefactura, setrequierefactura] = useState(false)
  const [archivo, setarchivo] = useState(null)
  const [errorcampo, seterrorcampo] = useState(null)
  const refbusqueda = useRef(null)
  const refarchivo = useRef(null)

  // Formas de pago del catalogo REAL (tabla metodos_pago), no una lista fija.
  const formas = useMemo(() => {
    const activos = (metodos || [])
      .filter((m) => String(m.estado || 'Activo') !== 'Inactivo')
      .map((m) => m.nombre)
    return activos.length ? activos : ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']
  }, [metodos])

  // Al abrir se limpia todo, igual que abrirNuevoCobro().
  useEffect(() => {
    if (!abierto) return
    setbusqueda('')
    setabrirdrop(false)
    setcliente(null)
    setsaldofavor(null)
    setreservaid('')
    setconcepto('ABONO')
    setmonto('')
    setfecha(hoy_hermosillo())
    setrequierefactura(false)
    setarchivo(null)
    seterrorcampo(null)
    const t = setTimeout(() => {
      if (refbusqueda.current) refbusqueda.current.focus()
    }, 120)
    return () => clearTimeout(t)
  }, [abierto])

  useEffect(() => {
    if (abierto) setforma(formas[0] || '')
  }, [abierto, formas])

  // Saldo a favor del cliente elegido: se lee de la BASE, no del espejo local,
  // porque otra caja pudo haberlo movido hace un minuto y aplicar de mas seria
  // dinero mal contado.
  useEffect(() => {
    let vivo = true
    setsaldofavor(null)
    if (!cliente || cliente.id == null) return undefined
    saldo_favor_de(sb, cliente.id).then((s) => {
      if (vivo) setsaldofavor(s)
    })
    return () => {
      vivo = false
    }
  }, [cliente])

  const catalogo = useMemo(() => catalogo_clientes({ clientes, reservas }), [clientes, reservas])
  const coincidencias = useMemo(
    () => catalogo.filter((c) => cliente_coincide(c, busqueda)),
    [catalogo, busqueda]
  )
  const susreservas = useMemo(
    () => reservas_del_cliente(cliente, reservas),
    [cliente, reservas]
  )
  const reserva = useMemo(
    () => (reservaid ? susreservas.find((r) => String(r.id) === String(reservaid)) || null : null),
    [reservaid, susreservas]
  )

  // ¿HACE FALTA COMPROBANTE? Por defecto SI: un cobro capturado a mano
  // necesita respaldo de que el dinero entro. La excepcion son las DOS caras
  // del saldo a favor: aplicarlo no mueve dinero por fuera (el comprobante se
  // pidio al abonar), y al abonarlo se admite que el respaldo llegue despues
  // sin frenar la captura del anticipo.
  const comprobanteobligatorio = !toca_saldo_favor(concepto, forma)

  const montonum = parseFloat(monto) || 0
  const escredito = es_pago_credito(concepto, '')

  // ── aviso en vivo del saldo ──────────────────────────────────
  const info = !reserva
    ? cliente
      ? susreservas.length
        ? 'Sin asociar: el cobro queda a nombre del cliente, sin descontar de ninguna reserva.'
        : 'Este cliente no tiene reservas activas.'
      : 'Elige primero un cliente.'
    : (() => {
        const neto = Math.max(0, (Number(reserva.monto) || 0) - (Number(reserva.descuentomonto) || 0))
        const pagado = Number(reserva.montopagado) || 0
        return (
          'Total ' + money(neto) + ' · Pagado ' + money(pagado) +
          ' · Saldo ' + money(Math.max(0, neto - pagado))
        )
      })()

  const aviso = (() => {
    if (escredito && montonum > 0) {
      return {
        texto: '💳 Crédito: queda como cuenta por cobrar. No suma al dinero recibido ni baja el saldo de la reserva.',
        verde: false,
      }
    }
    if (reserva && montonum > 0) {
      const neto = Math.max(0, (Number(reserva.monto) || 0) - (Number(reserva.descuentomonto) || 0))
      const saldo = Math.max(0, neto - (Number(reserva.montopagado) || 0))
      if (montonum > saldo + 0.009) {
        return {
          texto:
            '⚠️ El monto supera el saldo pendiente (' + money(saldo) +
            '). Se registrará igual, pero la reserva quedará sobrepagada.',
          verde: false,
        }
      }
      if (saldo > 0 && Math.abs(montonum - saldo) < 0.01) {
        return { texto: '✅ Con este cobro la reserva queda LIQUIDADA.', verde: true }
      }
    }
    return null
  })()

  if (!abierto) return null

  async function guardar() {
    seterrorcampo(null)
    const r = await onregistrar({
      cliente, reservaid, concepto, monto, forma, fecha, requierefactura, archivo,
      comprobanteobligatorio,
    })
    if (r && r.ok) oncerrar()
    else if (r && r.campo) {
      seterrorcampo(r.campo)
      if (r.campo === 'comprobante' && refarchivo.current) refarchivo.current.focus()
    }
  }

  function elegir(c) {
    setcliente({
      // el id hace falta para mover su saldo a favor.
      id: c.id != null ? c.id : null,
      nombre: c.nombre || '',
      email: c.email === '—' ? '' : c.email || '',
      tel: c.tel === '—' ? '' : c.tel || '',
    })
    setabrirdrop(false)
    setreservaid('')
  }

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) oncerrar()
      }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title">Registrar cobro manual</div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* ── Cliente ── */}
          <div className="form-group">
            <label className="form-label">Cliente *</label>
            {!cliente ? (
              <div style={{ position: 'relative' }}>
                <input
                  ref={refbusqueda}
                  className={'input' + (errorcampo === 'cliente' ? ' input-error' : '')}
                  placeholder="Buscar por nombre, correo o teléfono…"
                  autoComplete="off"
                  value={busqueda}
                  onChange={(e) => { setbusqueda(e.target.value); setabrirdrop(true) }}
                  onFocus={() => setabrirdrop(true)}
                />
                {abrirdrop && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.13)',
                    maxHeight: '230px', overflowY: 'auto', marginTop: '3px',
                  }}>
                    {coincidencias.length ? (
                      // el tope de 60 es el de la v1: la lista es para elegir,
                      // no para recorrerla entera.
                      coincidencias.slice(0, 60).map((c, i) => (
                        <div
                          key={(c.id != null ? c.id : 'r') + '-' + i}
                          onMouseDown={() => elegir(c)}
                          style={{
                            padding: '9px 12px', cursor: 'pointer',
                            borderBottom: '1px solid var(--border)', fontSize: '13px',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                            {(c.email && c.email !== '—' ? c.email : 'sin correo') +
                              (c.tel && c.tel !== '—' ? ' · ' + c.tel : '')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-3)' }}>
                        Sin coincidencias
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '9px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{cliente.nombre}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {(cliente.email || 'sin correo') + (cliente.tel ? ' · ' + cliente.tel : '')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setcliente(null); setreservaid(''); setbusqueda(''); setabrirdrop(false) }}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '11px', padding: '3px 9px',
                      color: 'var(--text-2)', whiteSpace: 'nowrap',
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saldo a favor del cliente elegido. Solo aparece si tiene. */}
          {saldofavor != null && saldofavor > 0 && (
            <div style={{
              background: 'var(--verde-bg)', border: '1px solid var(--verde)', color: 'var(--verde)',
              borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700,
              marginBottom: '12px',
            }}>
              💰 Saldo a favor disponible: {money(saldofavor)}
            </div>
          )}

          {/* ── Reserva ── */}
          <div className="form-group">
            <label className="form-label">Reserva / Folio asociado</label>
            <select
              className="input select"
              value={reservaid}
              disabled={!cliente}
              onChange={(e) => setreservaid(e.target.value)}
            >
              <option value="">— Sin reserva asociada —</option>
              {susreservas.map((r) => {
                const neto = Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentomonto) || 0))
                return (
                  <option key={r.id} value={r.id}>
                    {r.id + ' · ' + (r.zona || '—') + ' · ' + money(neto)}
                  </option>
                )
              })}
            </select>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{info}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Concepto *</label>
              <select className="input select" value={concepto} onChange={(e) => setconcepto(e.target.value)}>
                {conceptos.map((c) => (
                  <option key={c.v} value={c.v}>{c.t}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Monto *</label>
              <input
                className={'input' + (errorcampo === 'monto' ? ' input-error' : '')}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={monto} onChange={(e) => setmonto(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Forma de pago *</label>
              <select className="input select" value={forma} onChange={(e) => setforma(e.target.value)}>
                {formas.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fecha del cobro</label>
              <input className="input" type="date" value={fecha} onChange={(e) => setfecha(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">
              {'Comprobante (imagen o PDF)' + (comprobanteobligatorio ? ' *' : ' (Opcional)')}
            </label>
            <input
              ref={refarchivo}
              className={'input' + (errorcampo === 'comprobante' && !archivo ? ' input-error' : '')}
              type="file" accept="image/*,application/pdf"
              style={{ fontSize: '12px', padding: '6px' }}
              onChange={(e) => setarchivo(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
              {comprobanteobligatorio
                ? 'Obligatorio: adjunta el respaldo del pago (transferencia, voucher, ficha o foto del recibo).'
                : 'Opcional en movimientos de saldo a favor: el dinero ya se respaldó al abonarlo.'}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '10px' }}>
            <input
              type="checkbox" style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              checked={requierefactura} onChange={(e) => setrequierefactura(e.target.checked)}
            />
            Requiere factura
          </label>

          {aviso && (
            <div style={{
              borderRadius: '8px', padding: '9px 12px', fontSize: '12px', marginTop: '12px',
              background: aviso.verde ? 'var(--verde-bg)' : 'var(--amarillo-bg)',
              border: '1px solid ' + (aviso.verde ? 'var(--verde)' : 'var(--amarillo)'),
              color: aviso.verde ? 'var(--verde)' : 'var(--amarillo)',
            }}>
              {aviso.texto}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
            style={guardando ? { opacity: 0.6 } : undefined}
          >
            {guardando ? 'Registrando…' : 'Registrar cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

const NuevoCobro = nuevo_cobro
export default NuevoCobro
