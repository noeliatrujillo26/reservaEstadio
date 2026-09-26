// ═══════════════════════════════════════════════════════════════════
// cobrarreserva.jsx — pestaña "Cobrar a Reserva" de /reserva-express.
//
// Sin equivalente en la v1: pantalla nueva, pensada para un celular en plena
// llamada. A diferencia de nuevocobro.jsx (elige CLIENTE y luego, aparte, su
// reserva), aquí el buscador es de UN SOLO PASO — folio, cliente o
// teléfono → la reserva directa (buscar_reservas, lib/cobrarreserva.js) —
// porque el caso de uso típico es "tengo el folio o el teléfono en la mano,
// cóbrale".
//
// Reutiliza la MISMA cascada de siempre (usecobrosescritura().registrar):
// inserta el cobro, sincroniza el saldo de la reserva, reevalúa la etapa de
// su tarjeta en el Pipeline y recarga los datos de la sesión — así que en
// cuanto se guarda, el resto de esta MISMA sesión (si el Pipeline/Cobros/
// Dashboard están montados en la misma pestaña) ya lo refleja, sin F5.
// Entre pestañas o dispositivos distintos NO hay sincronización en vivo
// (no existe Realtime en este proyecto todavía) — igual que el resto del
// panel admin hoy.
//
// "Saldo a favor" como forma de pago es una REDENCIÓN (gasta el saldo ya
// acumulado del cliente para pagar ESTA reserva) — usecobrosescritura.js la
// implementa como caso nuevo, simétrico al abono a saldo a favor que ya
// existía, con la misma disciplina de "el dinero no se mueve si el cobro no
// quedó guardado".
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from 'react'
import { sb } from '../../supabaseclient'
import useadmin from '../../hooks/useadmin'
import useadmindatos from '../../hooks/useadmindatos'
import usecobrosescritura from '../../hooks/usecobrosescritura'
import { buscar_cliente, catalogo_clientes } from '../../lib/clientes'
import { buscar_reservas, resumen_reserva } from '../../lib/cobrarreserva'
import { folio_visible } from '../../lib/reservasadmin'
import { saldo_favor_de } from '../../lib/cascadas'
import { mxn2 } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// formas de pago fijas + el catálogo real de métodos activos (mismo criterio
// que nuevocobro.jsx), con "Saldo a favor" siempre al final: es una
// redención, no un método del catálogo de `metodos_pago`.
function formas_de_pago(metodos) {
  const activos = (metodos || [])
    .filter((m) => String(m.estado || 'Activo') !== 'Inactivo')
    .map((m) => m.nombre)
  const base = activos.length ? activos : ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']
  return base.concat(['SALDO A FAVOR'])
}

export default function cobrarreserva({ tab = 'cobrar', ontab } = {}) {
  const { usuario, cerrar_sesion } = useadmin()
  const { clientes, reservas, cobros, metodos, cargando } = useadmindatos()
  const { registrar, guardando } = usecobrosescritura()

  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [reserva, setreserva] = useState(null)
  const [monto, setmonto] = useState('')
  const [forma, setforma] = useState('')
  const [referencia, setreferencia] = useState('')
  const [saldofavor, setsaldofavor] = useState(null)
  const [errorcampo, seterrorcampo] = useState(null)
  const [exito, setexito] = useState(null)
  const refbusqueda = useRef(null)
  const refmonto = useRef(null)

  const catalogo = useMemo(() => catalogo_clientes({ clientes, reservas }), [clientes, reservas])
  const cliente = useMemo(() => {
    if (!reserva) return null
    const ficha = buscar_cliente(catalogo, { nombre: reserva.cliente, email: reserva.email, tel: reserva.tel })
    return ficha || { id: null, nombre: reserva.cliente || '', email: reserva.email || '', tel: reserva.tel || '' }
  }, [reserva, catalogo])

  const resultados = useMemo(() => buscar_reservas(reservas, busqueda), [reservas, busqueda])
  const resumen = useMemo(() => resumen_reserva(reserva, cobros), [reserva, cobros])
  const formas = useMemo(() => formas_de_pago(metodos), [metodos])

  const montonum = parseFloat(monto) || 0
  const esredencion = forma === 'SALDO A FAVOR'
  const saldoinsuficiente = esredencion && saldofavor != null && montonum > saldofavor + 0.009

  function elegir(r) {
    setreserva(r)
    setbusqueda('')
    setabrirdrop(false)
    setmonto('')
    setforma(formas[0] || '')
    setreferencia('')
    seterrorcampo(null)
    setsaldofavor(null)
    const ficha = buscar_cliente(catalogo, { nombre: r.cliente, email: r.email, tel: r.tel })
    if (ficha && ficha.id != null) {
      saldo_favor_de(sb, ficha.id).then(setsaldofavor)
    }
    setTimeout(() => { if (refmonto.current) refmonto.current.focus() }, 80)
  }

  function cambiar() {
    setreserva(null)
    setbusqueda('')
    setmonto('')
    setreferencia('')
    seterrorcampo(null)
    setsaldofavor(null)
    setTimeout(() => { if (refbusqueda.current) refbusqueda.current.focus() }, 80)
  }

  async function guardar() {
    seterrorcampo(null)
    const r = await registrar({
      cliente,
      reservaid: reserva ? reserva.id : '',
      concepto: 'ABONO',
      monto,
      forma,
      referencia,
      fecha: hoy_hermosillo(),
      requierefactura: false,
      archivo: null,
      // Ninguna forma de esta pestaña pide comprobante aparte: el pago se
      // capturó en vivo por teléfono/en sitio, y "Saldo a favor" ya se
      // respaldó cuando se abonó.
      comprobanteobligatorio: false,
    })
    if (r && r.ok) {
      setexito({
        folio: folio_visible(reserva), cliente: cliente.nombre, monto: montonum,
        forma, restante: Math.max(0, resumen.restante - montonum),
      })
    } else if (r && r.campo) {
      seterrorcampo(r.campo)
    }
  }

  function nuevocobro() {
    setexito(null)
    cambiar()
  }

  if (cargando) {
    return <div className="re-cargando">Cargando reservas…</div>
  }

  return (
    <>
      <div className="re-topbar">
        <a href="/" className="re-logo-link" aria-label="Ir a la página principal" title="Ir a la página principal">
          <img src={import.meta.env.BASE_URL + 'logo-naranjeros.png'} alt="Naranjeros" />
        </a>
        <div className="re-topbar-titulo">Reserva Express</div>
        <div className="re-topbar-usuario">
          {usuario ? usuario.nombre : '—'}
          <br />
          {usuario ? usuario.rol : ''}
        </div>
        <button className="re-salir" onClick={cerrar_sesion} title="Cerrar sesión" aria-label="Cerrar sesión">⏻</button>
      </div>

      {ontab && (
        <div className="re-tabs">
          <button
            type="button" className={'re-tab' + (tab === 'nueva' ? ' activo' : '')}
            onClick={() => ontab('nueva')}
          >
            Nueva Reserva
          </button>
          <button
            type="button" className={'re-tab' + (tab === 'cobrar' ? ' activo' : '')}
            onClick={() => ontab('cobrar')}
          >
            Cobrar a Reserva
          </button>
        </div>
      )}

      <div className="re-form">
        <div className="re-seccion">
          <div className="re-seccion-titulo">🔎 Buscar reserva</div>
          <div className="re-campo">
            <label>Folio, cliente o teléfono</label>
            {!reserva ? (
              <div style={{ position: 'relative' }}>
                <input
                  ref={refbusqueda}
                  className={'re-input' + (errorcampo === 'reserva' ? ' re-error' : '')}
                  placeholder="Ej. RES-042, Juan Pérez o 662…"
                  autoComplete="off" inputMode="search" type="search"
                  value={busqueda}
                  onChange={(e) => { setbusqueda(e.target.value); setabrirdrop(true) }}
                  onFocus={() => setabrirdrop(true)}
                  onBlur={() => setTimeout(() => setabrirdrop(false), 150)}
                />
                {abrirdrop && busqueda.trim() && (
                  <div className="re-dropdown">
                    {resultados.length ? (
                      resultados.map((r) => (
                        <div
                          key={r.id}
                          className="re-dropdown-item"
                          onMouseDown={() => elegir(r)}
                        >
                          <div className="re-dropdown-nombre">{folio_visible(r)} · {r.cliente || 'Sin nombre'}</div>
                          <div className="re-dropdown-sub">
                            {(r.zona || 'Sin zona') + (r.tel ? ' · ' + r.tel : '')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--texto-tenue)' }}>
                        Sin coincidencias
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="re-cliente-elegido">
                <div style={{ minWidth: 0 }}>
                  <div className="re-cliente-elegido-nombre">{folio_visible(reserva)} · {reserva.cliente || '—'}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--texto-tenue)', marginTop: '2px' }}>
                    {(reserva.zona || 'Sin zona') + (reserva.tel ? ' · ' + reserva.tel : '')}
                  </div>
                </div>
                <button type="button" className="re-cliente-elegido-cambiar" onClick={cambiar} aria-label="Cambiar reserva">
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {reserva && (
          <>
            <div className="re-seccion">
              <div className="re-seccion-titulo">💰 Resumen (doctrina bruto)</div>
              <div className="re-desglose">
                <div className="re-desglose-fila"><span>Monto Total Bruto</span><span>{money(resumen.totalbruto)}</span></div>
                {resumen.descuento > 0 && (
                  <div className="re-desglose-fila re-desglose-descuento"><span>Descuento</span><span>−{money(resumen.descuento)}</span></div>
                )}
                <div className="re-desglose-fila"><span>Abonado</span><span>{money(resumen.abonado)}</span></div>
                {resumen.credito > 0 && (
                  <div className="re-desglose-fila"><span>💳 A crédito</span><span>{money(resumen.credito)}</span></div>
                )}
                <div className="re-desglose-total">
                  <span>{resumen.liquidada ? '✅ Liquidada' : 'Restante por Liquidar'}</span>
                  <span>{money(resumen.restante)}</span>
                </div>
              </div>
              {saldofavor != null && saldofavor > 0 && (
                <div className="re-ayuda" style={{ marginTop: '8px' }}>
                  💰 Este cliente tiene {money(saldofavor)} de saldo a favor disponible.
                </div>
              )}
            </div>

            <div className="re-seccion">
              <div className="re-seccion-titulo">🧾 Registrar cobro</div>
              <div className="re-campo">
                <label>Monto a cobrar ($) *</label>
                <input
                  ref={refmonto}
                  className={'re-input' + (errorcampo === 'monto' ? ' re-error' : '')}
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                  value={monto} onChange={(e) => setmonto(e.target.value)}
                />
                {resumen.restante > 0 && (
                  <div className="re-ayuda">
                    Restante por liquidar: {money(resumen.restante)}.{' '}
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--naranja-dark)', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}
                      onClick={() => setmonto(String(resumen.restante))}
                    >
                      Usar este monto
                    </button>
                  </div>
                )}
              </div>

              <div className="re-campo">
                <label>Método de pago *</label>
                <select
                  className={'re-select' + (errorcampo === 'forma' ? ' re-error' : '')}
                  value={forma} onChange={(e) => setforma(e.target.value)}
                >
                  {formas.map((f) => (
                    <option key={f} value={f}>{f === 'SALDO A FAVOR' ? 'Saldo a favor (redención)' : f}</option>
                  ))}
                </select>
                {esredencion && saldoinsuficiente && (
                  <div className="re-ayuda" style={{ color: 'var(--rojo)' }}>
                    ⚠️ El saldo a favor disponible ({money(saldofavor)}) es menor al monto capturado.
                  </div>
                )}
                {esredencion && saldofavor == null && cliente && cliente.id == null && (
                  <div className="re-ayuda" style={{ color: 'var(--rojo)' }}>
                    ⚠️ Este cliente no tiene ficha en el catálogo: no se le puede aplicar saldo a favor.
                  </div>
                )}
              </div>

              <div className="re-campo">
                <label>Notas / Referencia (opcional)</label>
                <input
                  className="re-input" type="text" placeholder="Ej. voucher #1234, confirmó por WhatsApp…"
                  value={referencia} onChange={(e) => setreferencia(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {reserva && (
        <div className="re-cta-wrap">
          <button
            className="re-btn re-btn-primario" onClick={guardar}
            disabled={guardando || !(montonum > 0) || !forma}
          >
            {guardando ? 'Registrando…' : 'REGISTRAR COBRO'}
          </button>
        </div>
      )}

      {exito && (
        <div className="re-exito-overlay" role="dialog" aria-modal="true">
          <div className="re-exito-card">
            <div className="re-exito-icono">✓</div>
            <h2>¡Cobro registrado!</h2>
            <div className="re-exito-folio">{exito.folio}</div>
            <div className="re-exito-detalle">
              <div><strong>Cliente:</strong> {exito.cliente}</div>
              <div><strong>Monto:</strong> {money(exito.monto)}</div>
              <div><strong>Forma de pago:</strong> {exito.forma}</div>
              <div><strong>Restante:</strong> {exito.restante <= 0 ? '✅ Liquidada' : money(exito.restante)}</div>
            </div>
            <button className="re-btn re-btn-primario" onClick={nuevocobro}>
              ¡Listo!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
