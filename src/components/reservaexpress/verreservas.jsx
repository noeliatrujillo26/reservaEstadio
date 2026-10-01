// ═══════════════════════════════════════════════════════════════════
// verreservas.jsx — pestaña "Reservas" de /reserva-express.
//
// Sin equivalente en la v1: pantalla nueva. Busca reservas existentes (folio,
// cliente, teléfono o email — buscar_reservas()/reserva_coincide(), lib/
// cobrarreserva.js, el MISMO buscador de un solo paso que ya usa "Registrar
// Cobro", ampliado el 01 oct 2026 para matchear también por email), muestra
// una tarjeta resumen por coincidencia y permite:
//
//   · Editar Reserva — contacto del cliente, Juego y Zona/Asador. Mismo
//     alcance y el MISMO hook de guardado (usereservasescritura().guardar())
//     que usa el panel de escritorio (reservaform.jsx): la escritura pasa por
//     actualizar_verificado() + el candado de rol de siempre (motivo_bloqueo
//     sobre 'reservas'), así que el Panel Admin ve el cambio de inmediato
//     (recargar() es parte del propio hook) y NO se reabre aquí la puerta que
//     reservaform.jsx cerró a propósito para precio/personas/tipo de comida
//     (esos viven en la cotización del prospecto, no en la reserva — ver la
//     cabecera de ese archivo). Decisión explícita, no un olvido.
//   · Reenviar Comprobante — por Email vía /api/send-reservation-email con
//     `reenvio:true` (el mismo endpoint que ya manda el correo de
//     confirmación al crear la reserva, aquí en modo reenvío manual: se
//     salta el candado de un-solo-envío y adjunta el historial de abonos), y
//     por WhatsApp con un mensaje de texto — mismo criterio que
//     cobrarreserva.jsx (enviar_whatsapp()): un resumen con los datos
//     vigentes de la reserva y el enlace al portal de autoservicio, NO el
//     ticket-imagen que arma compartir_whatsapp() al crear una reserva nueva
//     (eso es para el instante del alta; aquí la reserva ya existe y puede
//     haberse editado, así que el texto se arma con los datos frescos en
//     vez de reabrir esa generación de imagen).
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmin from '../../hooks/useadmin'
import useadmindatos from '../../hooks/useadmindatos'
import usereservasescritura from '../../hooks/usereservasescritura'
import { usetoast } from '../../context/toastcontext'
import { buscar_reservas, resumen_reserva } from '../../lib/cobrarreserva'
import { tel_norm } from '../../lib/clientes'
import { estado_vivo } from '../../lib/mapaocupacion'
import { folio_visible } from '../../lib/reservasadmin'
import { mxn2 } from '../../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// Iconos de la tarjeta de reserva — trazo delgado (stroke), mismo estilo que
// los demás SVG inline del formulario (viewBox 16/18, strokeWidth ~1.6).
// 'currentColor' hereda el color de texto del contenedor (.re-reserva-fila
// svg, .re-accion-btn), así que cada badge/botón los pinta a su manera sin
// duplicar el SVG por color.
function IconJuego() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 1.5v3M11 1.5v3M2 6.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconZona() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 14.5s5-4.2 5-8.3A5 5 0 003 6.2c0 4.1 5 8.3 5 8.3z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <circle cx="8" cy="6.2" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function IconEstado() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 8.3l1.8 1.8 3.2-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEditar() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11.4 2.6a1.6 1.6 0 012.3 0l1.7 1.7a1.6 1.6 0 010 2.3L6.6 15.4l-4 .9.9-4 7.9-7.9z"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}
function IconEmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 5l5.6 4.3a1.5 1.5 0 001.8 0L15.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconWhatsapp() {
  // Insignia circular verde con el glifo blanco, en vez de un emoji 📲 —
  // mismo verde de marca (#25D366) que ya usaba .re-btn-whatsapp.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#25D366" />
      <path
        d="M13.85 11.35c-.22-.11-1.3-.64-1.5-.71-.2-.08-.35-.11-.5.11-.14.22-.56.71-.69.85-.13.15-.26.16-.48.06-1.29-.64-2.13-1.15-2.98-2.6-.22-.39.22-.36.64-1.2.07-.15.04-.27-.03-.38s-.5-1.19-.68-1.63c-.18-.42-.37-.37-.5-.38h-.42c-.15 0-.39.06-.59.28-.2.22-.77.75-.77 1.83 0 1.08.79 2.12.9 2.27.11.15 1.52 2.32 3.68 3.15 2.16.84 2.16.56 2.56.52.41-.04 1.3-.53 1.49-1.05.18-.52.18-.96.13-1.05-.06-.09-.2-.15-.42-.26z"
        fill="#fff"
      />
    </svg>
  )
}

// Tarjeta de UNA reserva — exportada aparte (no solo por prolijidad): es lo
// que pruebas/tarjetareserva.run.mjs renderiza directo con datos fijos para
// comprobar la estructura visual (encabezado/cuerpo/resumen/acciones en una
// sola caja, con flujo continuo hasta el último botón) sin depender del
// buscador ni de una sesión real.
export function TarjetaReserva({
  reserva, resumen, enviandoemail, errorcampo, oncerrar, oneditar, onemail, onwhatsapp,
}) {
  return (
    <div className="re-reserva-card">
      <div className="re-reserva-header">
        <div style={{ minWidth: 0 }}>
          <div className="re-reserva-folio">{folio_visible(reserva)}</div>
          <div className="re-reserva-cliente-nombre">{reserva.cliente || '—'}</div>
          <div className="re-reserva-cliente-contacto">
            {(reserva.email || 'sin correo') + (reserva.tel ? ' · ' + reserva.tel : '')}
          </div>
        </div>
        <button type="button" className="re-reserva-cerrar" onClick={oncerrar} aria-label="Cerrar">×</button>
      </div>

      <div className="re-reserva-divisor" />

      <div className="re-reserva-cuerpo">
        <div className="re-reserva-fila">
          <IconJuego />
          <span className="re-reserva-etiqueta">Juego</span>
          <span className="re-reserva-valor">{reserva.juego || '—'}</span>
        </div>
        <div className="re-reserva-fila">
          <IconZona />
          <span className="re-reserva-etiqueta">Zona / Asador</span>
          <span className="re-reserva-valor">{reserva.zona || '—'}</span>
        </div>
        <div className="re-reserva-fila">
          <IconEstado />
          <span className="re-reserva-etiqueta">Estado</span>
          <span className="re-reserva-valor">{reserva.estado || '—'}</span>
        </div>
      </div>

      <div className="re-reserva-divisor" />

      <div className="re-resumen-grid" style={{ marginBottom: 0 }}>
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

      <div className="re-reserva-divisor" />

      {/* Botones de acción AL FINAL de la misma tarjeta — flujo continuo
          desde los datos del cliente hasta la última acción, sin que se
          sientan como una barra flotante aparte. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="re-accion-btn re-accion-editar" onClick={oneditar}>
          <IconEditar />
          Editar Reserva
        </button>
        <button
          className="re-accion-btn re-accion-email" onClick={onemail}
          disabled={enviandoemail || !reserva.email}
        >
          <IconEmail />
          {enviandoemail ? 'Enviando…' : 'Reenviar Comprobante por Email'}
        </button>
        <button className="re-accion-btn re-accion-whatsapp" onClick={onwhatsapp}>
          <IconWhatsapp />
          Enviar comprobante
        </button>
        {errorcampo === 'whatsapp' && (
          <div className="re-ayuda" style={{ color: 'var(--rojo)' }}>
            ⚠️ Esta reserva no tiene un teléfono a 10 dígitos registrado.
          </div>
        )}
        {!reserva.email && (
          <div className="re-ayuda" style={{ color: 'var(--rojo)' }}>
            ⚠️ Esta reserva no tiene correo registrado — no se puede reenviar por email.
          </div>
        )}
      </div>
    </div>
  )
}

export default function verreservas({ tab = 'reservas', ontab } = {}) {
  const { usuario, cerrar_sesion } = useadmin()
  const { juegos, areas, areasestados, reservas, cobros, pipeline, cargando } = useadmindatos()
  const { guardar, guardando } = usereservasescritura()
  const { mostrartoast } = usetoast()

  const [busqueda, setbusqueda] = useState('')
  const [reservaid, setreservaid] = useState(null)
  const [editando, seteditando] = useState(false)
  const [d, setd] = useState({ juegoid: '', zonaid: '', nombre: '', email: '', tel: '' })
  const [errorcampo, seterrorcampo] = useState(null)
  const [enviandoemail, setenviandoemail] = useState(false)

  const resultados = useMemo(() => buscar_reservas(reservas, busqueda), [reservas, busqueda])
  // Siempre se relee del arreglo vivo de useadmindatos(): tras guardar(), ese
  // arreglo ya trae los datos frescos (recargar() corre dentro del hook) —
  // así la tarjeta de detalle se actualiza sola, sin guardar una copia propia
  // que quedaría vieja en cuanto se edita.
  const reserva = useMemo(
    () => (reservas || []).find((r) => String(r.id) === String(reservaid)) || null,
    [reservas, reservaid]
  )
  const resumen = useMemo(() => resumen_reserva(reserva, cobros, pipeline), [reserva, cobros, pipeline])

  // Zonas ofrecidas al editar: libres para el juego elegido + la propia de la
  // reserva (si no, desaparecería de su propio selector) — mismo criterio
  // que reservaform.jsx.
  const zonasposibles = useMemo(() => {
    if (!d.juegoid) return []
    return (areas || []).filter((a) => {
      if (reserva && String(a.id) === String(reserva.zonaid)) return true
      return estado_vivo(areasestados, d.juegoid, a.id) === 'libre'
    })
  }, [areas, areasestados, d.juegoid, reserva])

  function elegir(r) {
    setreservaid(r.id)
    setbusqueda('')
    seteditando(false)
    seterrorcampo(null)
  }

  function cambiar() {
    setreservaid(null)
    seteditando(false)
    seterrorcampo(null)
  }

  function abrireditar() {
    if (!reserva) return
    setd({
      juegoid: String(reserva.juegoid || ''),
      zonaid: String(reserva.zonaid || ''),
      nombre: reserva.cliente || '',
      email: reserva.email || '',
      tel: reserva.tel || '',
    })
    seterrorcampo(null)
    seteditando(true)
  }

  async function guardarcambios() {
    if (!reserva) return
    seterrorcampo(null)
    const descuentopct = Number(reserva.monto) > 0
      ? Math.min(Number(reserva.descuentomonto) || 0, Number(reserva.monto)) / Number(reserva.monto)
      : 0
    const r = await guardar({
      juegoid: d.juegoid,
      zonaid: d.zonaid,
      nombre: d.nombre,
      email: d.email,
      tel: d.tel,
      pago: reserva.pago,
      metodo: reserva.metodo || 'Tarjeta',
      adultos: reserva.adultos || 0,
      ninos: reserva.ninos || 0,
      personas: reserva.personas,
      bruto: reserva.monto,
      descuentopct,
      saldoconsumo: reserva.saldoconsumo || 0,
      cotizacionid: reserva.cotizacionid || '',
      editando: reserva,
    })
    if (r && r.ok) seteditando(false)
    else if (r && r.campo) seterrorcampo(r.campo)
  }

  async function reenviaremail() {
    if (!reserva || !reserva.email) return
    setenviandoemail(true)
    try {
      const resp = await fetch('/api/send-reservation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio: reserva.id, email: reserva.email, reenvio: true }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok && data.enviado) {
        mostrartoast('✅ Comprobante reenviado a ' + reserva.email)
      } else {
        mostrartoast('⚠️ No se pudo reenviar el comprobante' + (data.error ? ': ' + data.error : '.'))
      }
    } catch (e) {
      console.error('Reenvío de comprobante por email falló:', e)
      mostrartoast('⚠️ No se pudo reenviar el comprobante. Intenta de nuevo.')
    } finally {
      setenviandoemail(false)
    }
  }

  // Mismo criterio de mensaje que cobrarreserva.jsx (mensaje_whatsapp): un
  // resumen con los datos VIGENTES de la reserva (ya reflejan cualquier
  // edición recién guardada) y el enlace al portal de autoservicio.
  function mensaje_whatsapp() {
    const urlreserva = window.location.origin + '/mis-reservas'
    return '¡Hola *' + (reserva.cliente || '') + '*! 👋\n' +
      'Aquí está el comprobante actualizado de tu reserva:\n\n' +
      '📌 *Folio:* ' + folio_visible(reserva) + '\n' +
      (reserva.juego ? '🏟️ *Juego:* ' + reserva.juego + '\n' : '') +
      (reserva.zona ? '📍 *Zona:* ' + reserva.zona + '\n' : '') +
      '📊 *Total Reserva:* ' + money(resumen.total) + '\n' +
      '✅ *Total Pagado:* ' + money(resumen.abonado) + '\n' +
      '🔴 *Restante por Liquidar:* ' + (resumen.liquidada ? '✅ Liquidada' : money(resumen.restante)) + '\n\n' +
      'Ver el detalle completo aquí: ' + urlreserva
  }

  function reenviarwhatsapp() {
    if (!reserva) return
    const numerowa = tel_norm(reserva.tel)
    const numero = numerowa.length === 10 ? '52' + numerowa : ''
    if (!numero) { seterrorcampo('whatsapp'); return }
    const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje_whatsapp())
    window.open(url, '_blank')
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
          <button type="button" className={'re-tab' + (tab === 'nueva' ? ' activo' : '')} onClick={() => ontab('nueva')}>
            Nueva Reserva
          </button>
          <button type="button" className={'re-tab' + (tab === 'cobrar' ? ' activo' : '')} onClick={() => ontab('cobrar')}>
            Registrar Cobro
          </button>
          <button type="button" className={'re-tab' + (tab === 'reservas' ? ' activo' : '')} onClick={() => ontab('reservas')}>
            Reservas
          </button>
        </div>
      )}

      {/* .re-form reserva 100px de margen inferior para la barra fija
          .re-cta-wrap de las otras pestañas — aquí esa barra solo existe en
          modo edición. Sin este ajuste, ver una reserva (sin editar) dejaba
          un hueco vacío enorme al pie: justo el "espacio vacío innecesario"
          que pedía corregir el rediseño. */}
      <div className="re-form" style={editando ? undefined : { paddingBottom: '28px' }}>
        <div className="re-seccion">
          <div className="re-seccion-titulo">🔎 Buscar reserva</div>
          <div className="re-campo">
            <label>Folio, cliente, teléfono o email</label>
            <input
              className="re-input"
              placeholder="Ej. RES-042, Juan Pérez, 662… o correo@ejemplo.com"
              autoComplete="off" inputMode="search" type="search"
              value={busqueda}
              onChange={(e) => { setbusqueda(e.target.value); setreservaid(null); seteditando(false) }}
            />
          </div>

          {!reserva && busqueda.trim() && (
            resultados.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {resultados.map((r) => {
                  const res = resumen_reserva(r, cobros, pipeline)
                  return (
                    <div
                      key={r.id}
                      onClick={() => elegir(r)}
                      style={{
                        border: '1px solid var(--borde)', borderRadius: '10px', padding: '10px 12px',
                        cursor: 'pointer', background: 'var(--superficie, #fff)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{r.cliente || 'Sin nombre'}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--naranja-dark)' }}>
                          {folio_visible(r)}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '2px' }}>
                        {(r.juego || 'Sin juego') + ' · ' + (r.zona || 'Sin zona')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px' }}>
                        <span>{r.estado || '—'}</span>
                        <span style={{ fontWeight: 700 }}>{money(res.total)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="re-ayuda" style={{ marginTop: '8px' }}>Sin coincidencias.</div>
            )
          )}
        </div>

        {reserva && !editando && (
          <TarjetaReserva
            reserva={reserva} resumen={resumen} enviandoemail={enviandoemail} errorcampo={errorcampo}
            oncerrar={cambiar} oneditar={abrireditar} onemail={reenviaremail} onwhatsapp={reenviarwhatsapp}
          />
        )}

        {reserva && editando && (
          <div className="re-seccion">
            <div className="re-seccion-titulo">✏️ Editar reserva</div>

            <div className="re-campo">
              <label>Juego *</label>
              <select
                className={'re-select' + (errorcampo === 'juego' ? ' re-error' : '')}
                value={d.juegoid}
                onChange={(e) => setd((x) => ({ ...x, juegoid: e.target.value, zonaid: '' }))}
              >
                <option value="">— Selecciona el juego —</option>
                {(juegos || []).map((j) => (
                  <option key={j.id} value={j.id}>{j.fecha} · vs {j.rival}</option>
                ))}
              </select>
            </div>

            <div className="re-campo">
              <label>Zona / Asador *</label>
              <select
                className={'re-select' + (errorcampo === 'zona' ? ' re-error' : '')}
                value={d.zonaid} disabled={!d.juegoid}
                onChange={(e) => setd((x) => ({ ...x, zonaid: e.target.value }))}
              >
                <option value="">{d.juegoid ? '— Selecciona una zona —' : '— Elige primero el juego —'}</option>
                {zonasposibles.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
              <div className="re-ayuda">Solo zonas libres para el juego elegido (más la actual de esta reserva).</div>
            </div>

            <div className="re-campo">
              <label>Nombre del cliente *</label>
              <input
                className={'re-input' + (errorcampo === 'nombre' ? ' re-error' : '')}
                value={d.nombre} onChange={(e) => setd((x) => ({ ...x, nombre: e.target.value }))}
              />
            </div>
            <div className="re-campo">
              <label>Email *</label>
              <input
                className={'re-input' + (errorcampo === 'email' ? ' re-error' : '')}
                type="email" value={d.email} onChange={(e) => setd((x) => ({ ...x, email: e.target.value }))}
              />
            </div>
            <div className="re-campo">
              <label>Teléfono * (10 dígitos)</label>
              <input
                className={'re-input' + (errorcampo === 'tel' ? ' re-error' : '')}
                maxLength={10} inputMode="numeric" value={d.tel}
                onChange={(e) => setd((x) => ({ ...x, tel: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Las 3 acciones de "ver" viven DENTRO de TarjetaReserva (flujo
          continuo hasta el final de la tarjeta); esta barra fija solo
          aplica a "Guardar/Cancelar" cuando el formulario de edición está
          abierto. */}
      {reserva && editando && (
        <div className="re-cta-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="re-btn re-btn-primario" onClick={guardarcambios} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button className="re-btn re-btn-secundario" onClick={() => seteditando(false)} disabled={guardando}>
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}
