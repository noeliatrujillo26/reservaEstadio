// ═══════════════════════════════════════════════════════════════════
// cobrarreserva.jsx — pestaña "Registrar Cobro" de /reserva-express.
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
import { buscar_cliente, catalogo_clientes, tel_norm } from '../../lib/clientes'
import { buscar_reservas, resumen_reserva } from '../../lib/cobrarreserva'
import { folio_visible } from '../../lib/reservasadmin'
import { saldo_favor_de, toca_saldo_favor } from '../../lib/cascadas'
import { mxn2, redondear_dinero } from '../../lib/dinero'
import { hoy_hermosillo } from '../../lib/fechas'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// Catálogo FIJO homologado con el del Pipeline (25 sep 2026, a pedido
// explícito) — a propósito ya NO sale del catálogo real de `metodos_pago`:
// estas cuatro, en este orden, siempre.
const FORMAS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'SALDO A FAVOR']

export default function cobrarreserva({ tab = 'cobrar', ontab } = {}) {
  const { usuario, cerrar_sesion } = useadmin()
  const { clientes, reservas, cobros, pipeline, cargando } = useadmindatos()
  const { registrar, guardando } = usecobrosescritura()

  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [reserva, setreserva] = useState(null)
  const [monto, setmonto] = useState('')
  const [forma, setforma] = useState('')
  const [referencia, setreferencia] = useState('')
  const [requierefactura, setrequierefactura] = useState(false)
  const [archivo, setarchivo] = useState(null)
  const [saldofavor, setsaldofavor] = useState(null)
  const [errorcampo, seterrorcampo] = useState(null)
  const [exito, setexito] = useState(null)
  const refbusqueda = useRef(null)
  const refmonto = useRef(null)
  const refarchivo = useRef(null)

  const catalogo = useMemo(() => catalogo_clientes({ clientes, reservas }), [clientes, reservas])
  const cliente = useMemo(() => {
    if (!reserva) return null
    const ficha = buscar_cliente(catalogo, { nombre: reserva.cliente, email: reserva.email, tel: reserva.tel })
    return ficha || { id: null, nombre: reserva.cliente || '', email: reserva.email || '', tel: reserva.tel || '' }
  }, [reserva, catalogo])

  const resultados = useMemo(() => buscar_reservas(reservas, busqueda), [reservas, busqueda])
  const resumen = useMemo(() => resumen_reserva(reserva, cobros, pipeline), [reserva, cobros, pipeline])

  const montonum = parseFloat(monto) || 0
  const esredencion = forma === 'SALDO A FAVOR'
  const saldoinsuficiente = esredencion && saldofavor != null && montonum > saldofavor + 0.009
  // Comprobante obligatorio salvo Saldo a favor — mismo criterio que
  // nuevocobro.jsx (toca_saldo_favor): ese dinero ya se respaldó al abonarlo.
  const comprobanteobligatorio = !toca_saldo_favor('ABONO', forma)

  function elegir(r) {
    setreserva(r)
    setbusqueda('')
    setabrirdrop(false)
    setmonto('')
    setforma(FORMAS_PAGO[0])
    setreferencia('')
    setrequierefactura(false)
    setarchivo(null)
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
    setrequierefactura(false)
    setarchivo(null)
    seterrorcampo(null)
    setsaldofavor(null)
    setTimeout(() => { if (refbusqueda.current) refbusqueda.current.focus() }, 80)
  }

  async function guardar() {
    seterrorcampo(null)
    const concepto = 'ABONO'
    const r = await registrar({
      cliente,
      reservaid: reserva ? reserva.id : '',
      concepto,
      monto,
      forma,
      referencia,
      fecha: hoy_hermosillo(),
      requierefactura,
      archivo,
      comprobanteobligatorio,
      // Auditoría (25 sep 2026): esta pestaña vive en el celular, fuera del
      // panel de escritorio — usecobrosescritura.js lo guarda en cobros.origen.
      origen: 'RESERVA_EXPRESS_MOBILE',
    })
    if (r && r.ok) {
      // El resumen de ANTES del cobro (`resumen`) sigue siendo el correcto
      // punto de partida: React todavía no re-renderizó con los datos que
      // recargar() (dentro de registrar()) acaba de traer, así que sumar el
      // monto recién pagado a mano da la cifra "hasta la fecha" exacta sin
      // esperar un segundo render.
      const totalpagado = redondear_dinero(resumen.abonado + montonum)
      const restante = Math.max(0, redondear_dinero(resumen.restante - montonum))
      setexito({
        folio: folio_visible(reserva),
        cliente: cliente.nombre,
        tel: reserva.tel || cliente.tel || '',
        zona: reserva.zona || '',
        juego: reserva.juego || '',
        concepto,
        monto: montonum,
        forma,
        fechahora: new Date().toLocaleString('es-MX', {
          timeZone: 'America/Hermosillo', dateStyle: 'long', timeStyle: 'short',
        }),
        totalreserva: resumen.total,
        totalpagado,
        restante,
        // r.cobro es la fila REAL insertada (usecobrosescritura.js la
        // devuelve desde el 25 sep 2026) — su `evidencia` es el enlace ya
        // subido al storage, no el nombre del archivo local.
        evidencia: (r.cobro && r.cobro.evidencia) || '',
      })
    } else if (r && r.campo) {
      seterrorcampo(r.campo)
    }
  }

  // Plantilla EXACTA de confirmación de pago (25 sep 2026) — igual en
  // contenido y estructura a la del Pipeline, para que el cliente reciba el
  // mismo mensaje sin importar desde qué pantalla se registró su pago.
  // [URL_Reserva]: el portal público de autoservicio (mismo criterio que
  // api/recordatorios.js en asadores-panel-master: SITE_URL + '/mis-reservas'
  // a secas — el cliente entra con SU folio y correo, no un enlace mágico).
  function mensaje_whatsapp(e) {
    const urlreserva = window.location.origin + '/mis-reservas'
    return '¡Hola *' + e.cliente + '*! 👋\n' +
      'Confirmamos la recepción de tu pago. Aquí está el detalle de tu comprobante:\n\n' +
      '📌 *Folio:* ' + e.folio + '\n' +
      '💵 *Monto Abonado:* ' + money(e.monto) + '\n' +
      '💳 *Método de Pago:* ' + e.forma + '\n' +
      '📊 *Total Reserva:* ' + money(e.totalreserva) + '\n' +
      '✅ *Total Pagado:* ' + money(e.totalpagado) + '\n' +
      '🔴 *Restante por Liquidar:* ' + money(e.restante) + '\n\n' +
      'Gracias por tu pago. Ver detalle de tu reserva aquí: ' + urlreserva
  }

  function enviar_whatsapp() {
    if (!exito) return
    const numerowa = tel_norm(exito.tel)
    const numero = numerowa.length === 10 ? '52' + numerowa : ''
    if (!numero) { seterrorcampo('whatsapp'); return }
    const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje_whatsapp(exito))
    window.open(url, '_blank')
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
            Registrar Cobro
          </button>
          <button
            type="button" className={'re-tab' + (tab === 'reservas' ? ' activo' : '')}
            onClick={() => ontab('reservas')}
          >
            Reservas
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
                          <div className="re-dropdown-nombre">{r.cliente || 'Sin nombre'}</div>
                          <div className="re-dropdown-sub">
                            {folio_visible(r) + ' · ' + (r.zona || 'Sin zona') + (r.tel ? ' · ' + r.tel : '')}
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
                  <div className="re-cliente-elegido-nombre">{reserva.cliente || '—'}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--texto-tenue)', marginTop: '2px' }}>
                    {folio_visible(reserva) + ' · ' + (reserva.zona || 'Sin zona') + (reserva.tel ? ' · ' + reserva.tel : '')}
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
              <div className="re-seccion-titulo">💰 Resumen</div>
              <div className="re-resumen-grid">
                <div className="re-resumen-caja">
                  <div className="re-resumen-caja-label">Total reserva</div>
                  <div className="re-resumen-caja-valor">{money(resumen.total)}</div>
                </div>
                <div className="re-resumen-caja">
                  <div className="re-resumen-caja-label">Pagado</div>
                  <div className="re-resumen-caja-valor verde">{money(resumen.abonado)}</div>
                </div>
                <div className="re-resumen-caja">
                  <div className="re-resumen-caja-label">Restante</div>
                  <div className="re-resumen-caja-valor rojo">
                    {resumen.liquidada ? '✅' : money(resumen.restante)}
                  </div>
                </div>
              </div>
              {resumen.credito > 0 && (
                <div className="re-ayuda" style={{ marginTop: '6px' }}>
                  💳 {money(resumen.credito)} a crédito (compromiso de pago, no dinero cobrado).
                </div>
              )}
              {saldofavor != null && saldofavor > 0 && (
                <div className="re-ayuda" style={{ marginTop: '4px' }}>
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
                  {FORMAS_PAGO.map((f) => (
                    <option key={f} value={f}>{f}</option>
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

              {/* Comprobante — mismo criterio que nuevocobro.jsx (Pipeline):
                  obligatorio salvo pago con Saldo a favor, que ya se respaldó
                  al abonarlo. Se sube al mismo storage ('cobros') y el enlace
                  viaja en `cobros.evidencia`, igual que en el Pipeline. */}
              <div className="re-campo">
                <label>
                  {'Comprobante' + (comprobanteobligatorio ? ' *' : ' (opcional)')}
                </label>
                <label
                  htmlFor="re-cobrar-archivo"
                  className={'re-upload' + (errorcampo === 'comprobante' && !archivo ? ' re-error' : '')}
                >
                  {archivo ? '📎 ' + archivo.name : '📤 Clic para cargar comprobante (imagen o PDF)'}
                </label>
                <input
                  ref={refarchivo}
                  id="re-cobrar-archivo"
                  type="file" accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setarchivo(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <div className="re-ayuda">
                  {comprobanteobligatorio
                    ? 'Obligatorio: adjunta el respaldo del pago (transferencia, voucher, ficha o foto del recibo).'
                    : 'Opcional con Saldo a favor: el dinero ya se respaldó al abonarlo.'}
                </div>
              </div>

              <label className="re-checkbox">
                <input
                  type="checkbox"
                  checked={requierefactura} onChange={(e) => setrequierefactura(e.target.checked)}
                />
                Requiere factura
              </label>
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
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--naranja-dark)' }}>
              NARANJEROS DE HERMOSILLO{exito.juego ? ' · ' + exito.juego : ''}
            </div>
            <div className="re-exito-folio">{exito.folio}</div>
            <div className="re-exito-detalle">
              <div><strong>Cliente:</strong> {exito.cliente}</div>
              {exito.tel && <div><strong>Teléfono:</strong> {exito.tel}</div>}
              {exito.zona && <div><strong>Zona:</strong> {exito.zona}</div>}
              <div style={{ borderTop: '1px dashed var(--borde)', margin: '8px 0', paddingTop: '8px' }}>
                <strong>Pago registrado</strong>
              </div>
              <div><strong>Concepto:</strong> {exito.concepto}</div>
              <div><strong>Monto cobrado:</strong> {money(exito.monto)}</div>
              <div><strong>Forma de pago:</strong> {exito.forma}</div>
              <div><strong>Fecha y hora:</strong> {exito.fechahora}</div>
              {exito.evidencia && (
                <div>
                  <strong>Comprobante:</strong>{' '}
                  <a href={exito.evidencia} target="_blank" rel="noreferrer" style={{ color: 'var(--naranja-dark)', fontWeight: 700 }}>
                    Ver adjunto
                  </a>
                </div>
              )}
              <div style={{ borderTop: '1px dashed var(--borde)', margin: '8px 0', paddingTop: '8px' }}>
                <strong>Resumen financiero</strong>
              </div>
              <div><strong>Total reserva:</strong> {money(exito.totalreserva)}</div>
              <div><strong>Total pagado:</strong> {money(exito.totalpagado)}</div>
              <div><strong>Restante:</strong> {exito.restante <= 0 ? '✅ Liquidada' : money(exito.restante)}</div>
            </div>
            <button className="re-btn re-btn-whatsapp" onClick={enviar_whatsapp}>
              📲 Enviar Comprobante por WhatsApp
            </button>
            {errorcampo === 'whatsapp' && (
              <div className="re-ayuda" style={{ color: 'var(--rojo)', marginBottom: '10px' }}>
                ⚠️ Este cliente no tiene un teléfono a 10 dígitos registrado.
              </div>
            )}
            <button className="re-btn re-btn-secundario" onClick={nuevocobro}>
              Registrar Nuevo Cobro
            </button>
          </div>
        </div>
      )}
    </>
  )
}
