// ═══════════════════════════════════════════════════════════════════
// checkoutcontext.jsx — estado del checkout de 4 pasos.
// espejo de v1: el objeto global _co, iniciarReserva(), coMostrarPaso(),
// coIrPaso2/3(), coSeleccionarPct(), aplicarPromo(), cerrarCheckout() y toda
// la cuenta regresiva del apartado (_holdIniciar y companeros).
//
// QUE APARTA Y QUE NO — importa no mentirle al cliente. La fila 'Pendiente'
// que bloquea la zona contra el doble cobro la crea el SERVIDOR al generar la
// sesion de Stripe (api/checkout.js), NO este contador. Por eso el mensaje
// dice "tiempo restante para completar tu reserva" y no "tu zona esta
// apartada". Este reloj solo evita que el flujo quede abierto para siempre
// con precios y disponibilidad ya viejos.
//
// LA FECHA LIMITE VIVE EN sessionStorage, no en una variable: un contador que
// se reinicia con F5 no es un limite, es un adorno. Se guarda por juego+zona,
// asi que cambiar de zona empieza un plazo nuevo — es otra reserva.
//
// SOLO LECTURA: los pasos 1 a 3 no escriben NADA en la base. La unica
// escritura de todo el flujo es el POST a /api/checkout, y hoy esta cerrado
// tras la bandera VITE_PAGOS_HABILITADOS (ver pagar()).
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import usereserva from '../hooks/usereserva'
import usemapa from '../hooks/usemapa'
import uselandingconfig from '../hooks/uselandingconfig'
import { usetoast } from './toastcontext'
import { con_extras, desglose_total_zona } from '../lib/precios'
import { co_total } from '../lib/checkout'
import { fecha_con_dia } from '../lib/fechas'
import { mxn2 } from '../lib/dinero'
import app_config from '../lib/config'

export const checkoutcontext = createContext(null)

export const hold_minutos = 10
export const hold_aviso_seg = 120 // ultimos 2 minutos: alerta en rojo

// interruptor de la pasarela. mientras sea false el flujo llega hasta el paso
// 3 y NO envia el POST que crea la reserva: nada se escribe en produccion.
export const pagos_habilitados = import.meta.env.VITE_PAGOS_HABILITADOS === 'true'

const fmt = (n) => Number(n).toLocaleString('es-MX', mxn2)

function hold_clave_de(co) {
  return 'nrj_hold_' + String((co && co.juegoid) || '') + '_' + String((co && co.zonaid) || '')
}

export function checkoutprovider({ children }) {
  const { zonas, zonaactiva, personas, ninos } = usemapa()
  const { juegoactivofecha, juegoactivoid, juegosporfecha, dv_mejor_regla } = usereserva()
  const { politica, txtliquidar } = uselandingconfig()
  const { mostrartoast } = usetoast()

  const [abierto, setabierto] = useState(false)
  const [paso, setpaso] = useState(1)
  const [co, setco] = useState(null)
  const [expirado, setexpirado] = useState(false)
  const [restante, setrestante] = useState(hold_minutos * 60)
  // datos definitivos del recibo, ya confirmados por stripe (paso 4).
  const [recibo, setrecibo] = useState(null)

  const limite = useRef(0)
  const clave = useRef('')
  const temporizador = useRef(null)

  // ── cuenta regresiva ────────────────────────────────────────────
  const detener_hold = useCallback(() => {
    if (temporizador.current) {
      clearInterval(temporizador.current)
      temporizador.current = null
    }
  }, [])

  const iniciar_hold = useCallback((nuevo_co) => {
    detener_hold()
    if (!nuevo_co) return
    clave.current = hold_clave_de(nuevo_co)

    // un plazo ya empezado para esta misma zona se retoma donde iba:
    // recargar la pagina no regala tiempo nuevo.
    let guardado = 0
    try {
      guardado = Number(sessionStorage.getItem(clave.current) || 0) || 0
    } catch (e) {}
    const ahora = Date.now()
    limite.current = guardado > ahora ? guardado : ahora + hold_minutos * 60 * 1000
    try {
      sessionStorage.setItem(clave.current, String(limite.current))
    } catch (e) {}

    setrestante(Math.max(0, Math.ceil((limite.current - Date.now()) / 1000)))
    temporizador.current = setInterval(() => {
      const seg = Math.max(0, Math.ceil((limite.current - Date.now()) / 1000))
      setrestante(seg)
      if (seg <= 0) {
        detener_hold()
        try {
          if (clave.current) sessionStorage.removeItem(clave.current)
        } catch (e) {}
        setabierto(false)
        setexpirado(true)
      }
    }, 1000)
  }, [detener_hold])

  useEffect(() => detener_hold, [detener_hold])

  // se llama al confirmarse el pago: el plazo ya no aplica y no debe revivir
  // si el cliente vuelve a abrir la misma zona en esta sesion.
  const liberar_hold = useCallback(() => {
    detener_hold()
    try {
      if (clave.current) sessionStorage.removeItem(clave.current)
    } catch (e) {}
    clave.current = ''
  }, [detener_hold])

  // ── abrir el checkout ───────────────────────────────────────────
  // espejo de iniciarReserva(). el desglose es el MISMO de la tarjeta de
  // detalle: lo mostrado = lo cobrado.
  const iniciar_reserva = useCallback(() => {
    if (!zonaactiva) return
    const base = zonas[zonaactiva]
    if (!base || !base.disponible) return
    const z = con_extras(base)

    const d = desglose_total_zona(z, juegoactivofecha, personas, ninos)
    // carga segura: nunca abrir el checkout con un total en $0 por datos que
    // aun no llegan de supabase.
    if (!(d.total > 0)) {
      mostrartoast('⏳ Los precios aún están cargando. Intenta en unos segundos.')
      return
    }

    const j = juegoactivofecha ? juegosporfecha[juegoactivofecha] : null
    const etiqueta_juego = j
      ? 'Naranjeros vs ' + j.rival + ' · ' + fecha_con_dia(j.fecha)
      : ''

    const nuevo = {
      // zonaid/juegoid son los MISMOS que viajan al servidor al crear la
      // sesion de pago. Sin ellos, una regla de grupo acotada a ciertas zonas
      // o juegos nunca se veia en el navegador pero SI la aplicaba el
      // servidor: el cliente leia un total y stripe cobraba otro.
      zonaid: zonaactiva,
      juegoid: juegoactivoid,
      zona: z.nombre,
      cap: z.cap,
      juego: etiqueta_juego,
      personas,
      ninos,
      precioPP: d.pp,
      precioExtra: d.extra,
      precioNino: d.nino,
      preciostr: fmt(d.total),
      precionum: d.total,
      pct: politica.enganche_minimo,
      promo: null,
      nombre: '',
      email: '',
      tel: '',
      acepto: false,
    }

    setco(nuevo)
    setpaso(1)
    setexpirado(false)
    setabierto(true)
    iniciar_hold(nuevo)
  }, [
    zonaactiva, zonas, juegoactivofecha, juegoactivoid, juegosporfecha,
    personas, ninos, politica.enganche_minimo, mostrartoast, iniciar_hold,
  ])

  // solo se detiene el intervalo: la fecha limite sigue viva en
  // sessionStorage — cerrar y reabrir no debe regalar diez minutos nuevos.
  const cerrar = useCallback(() => {
    setabierto(false)
    detener_hold()
  }, [detener_hold])

  const actualizar = useCallback((parche) => {
    setco((prev) => (prev ? { ...prev, ...parche } : prev))
  }, [])

  const totales = co ? co_total(co, dv_mejor_regla) : null

  // ── cupon promocional ───────────────────────────────────────────
  // validacion real contra la api (tabla `descuentos`): vigencia, usos
  // disponibles y juegos aplicables se verifican del lado del servidor.
  // es un GET de SOLO LECTURA — no consume ni reserva el cupon.
  const aplicar_promo = useCallback(
    async (codigo_crudo) => {
      const codigo = String(codigo_crudo || '').trim().toUpperCase()
      if (!codigo) return null
      try {
        const qs = new URLSearchParams({ codigo, juegoId: juegoactivoid })
        const resp = await fetch('/api/checkout?action=validar-cupon&' + qs.toString())
        const data = await resp.json()
        if (data.valido) {
          const promo = { codigo: data.codigo, tipo: data.tipo, valor: data.valor }
          actualizar({ promo })
          return { ok: true, promo }
        }
        actualizar({ promo: null })
        return { ok: false, mensaje: data.mensaje || 'Código no válido o ya expirado' }
      } catch (err) {
        actualizar({ promo: null })
        return { ok: false, mensaje: 'No se pudo validar el código. Intenta de nuevo.' }
      }
    },
    [juegoactivoid, actualizar]
  )

  // ── pago ────────────────────────────────────────────────────────
  // ESTA es la unica escritura de todo el flujo: el POST crea la reserva
  // 'Pendiente' y la sesion de Stripe. Mientras VITE_PAGOS_HABILITADOS no sea
  // 'true' no se envia nada y produccion queda intacta.
  const pagar = useCallback(
    async (turnstiletoken) => {
      if (!pagos_habilitados) {
        mostrartoast('🔒 La pasarela de pagos aún no está habilitada en esta versión.')
        return { ok: false, bloqueado: true }
      }
      try {
        const resp = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zona: co.zona, zonaId: co.zonaid,
            juego: co.juego, juegoId: co.juegoid,
            personas: co.personas, ninos: co.ninos,
            precioNum: co.precionum, pct: co.pct,
            promoCodigo: co.promo ? co.promo.codigo : null,
            nombre: co.nombre, email: co.email, tel: co.tel,
            turnstileToken: turnstiletoken || null,
          }),
        })
        const data = await resp.json()
        if (!resp.ok || !data.url) {
          // 409 = otra persona gano la zona mientras el cliente llenaba el
          // formulario. 403 = turnstile rechazo el token.
          throw Object.assign(new Error(data.error || 'No se pudo iniciar el pago'), {
            status: resp.status,
          })
        }
        window.location.href = data.url // Stripe Checkout hospedado
        return { ok: true }
      } catch (err) {
        mostrartoast('⚠ ' + (err.message || 'No se pudo iniciar el pago. Intenta de nuevo.'))
        return { ok: false, status: err.status }
      }
    },
    [co, mostrartoast]
  )

  // ── confirmacion al volver de stripe ────────────────────────────
  // espejo de mostrarConfirmacionStripe(). Es un GET de SOLO LECTURA: la
  // fuente de verdad de estado_pago/monto_pagado es el webhook, aqui solo se
  // lee lo que ya haya en supabase.
  const confirmar_sesion = useCallback(
    async (sessionid) => {
      // el pago ya entro: la cuenta regresiva se retira por completo. Dejarla
      // correr sobre la pantalla de exito diria que aun falta algo por hacer.
      liberar_hold()
      setabierto(true)
      setpaso(4)
      setrecibo(null)
      try {
        const resp = await fetch(
          '/api/checkout?action=confirmar-sesion&session_id=' + encodeURIComponent(sessionid)
        )
        const data = await resp.json()
        if (!resp.ok || !data.reserva) throw new Error(data.error || 'No encontramos tu reserva')
        const r = data.reserva

        // mismo recalculo que la v1 sobre lo guardado en supabase.
        const base = Math.round((Number(r.monto) * Number(r.porcentaje_pagado)) / 100)
        const desc = Number(r.descuento_monto) || 0
        const bd = base - desc
        // comision = 7% real sobre el subtotal CON descuento, siempre positiva
        // y sumada. derivarla restando (monto_pagado - subtotal) la volvia
        // negativa cuando el webhook aun no habia escrito monto_pagado.
        const com = Math.round(bd * app_config.COMISION_PCT)
        // total realmente cobrado: lo que reporto el webhook; si aun no
        // aterriza (0/null), se reconstruye como subtotal + comision.
        const monto = Number(r.monto_pagado) > 0 ? Number(r.monto_pagado) : bd + com

        setrecibo({
          folio: r.id, zona: r.zona, juego: r.juego,
          nombre: r.cliente, email: r.email, tel: r.tel, rfc: r.rfc || '',
          precionum: Number(r.monto), pct: r.porcentaje_pagado,
          base, desc, com, monto,
          promocodigo: r.descuento_codigo || null,
          cardlast4: r.card_last4 || null,
          fecha: r.actualizado_en || new Date().toISOString(),
          liga: data.ligaRecibo || null,
        })
      } catch (err) {
        mostrartoast('⚠ ' + (err.message || 'No pudimos confirmar tu pago.'))
      }
    },
    [liberar_hold, mostrartoast]
  )

  // al volver de stripe la url trae ?session_id=. se limpia del historial para
  // que un refresh no vuelva a disparar la confirmacion.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session_id')
    if (!sid) return
    confirmar_sesion(sid)
    try {
      window.history.replaceState({}, '', window.location.pathname)
    } catch (e) {}
  }, [confirmar_sesion])

  const valor = {
    abierto, paso, setpaso, co, actualizar, totales, expirado, setexpirado,
    restante, txtliquidar, politica,
    iniciar_reserva, cerrar, aplicar_promo, pagar, liberar_hold,
    recibo, confirmar_sesion,
    pagos_habilitados,
  }

  return <checkoutcontext.Provider value={valor}>{children}</checkoutcontext.Provider>
}

export default checkoutprovider
