// ═══════════════════════════════════════════════════════════════════
// checkout.js — logica pura del checkout: totales, correo y typos.
// espejo 1:1 de v1: _coTotal(), _CO_EMAIL_RX, _coEmailValido(),
// _TYPO_DOMINIOS y _coTypoSugerido() de panel-inicio.html.
//
// la formula de _coTotal tiene que dar EXACTAMENTE lo mismo que
// calcularTotales() de api/_lib/descuentos.js: si difieren, el cliente lee un
// total y stripe cobra otro.
// ═══════════════════════════════════════════════════════════════════

import { redondear_dinero } from './dinero'
import app_config from './config'

// ── deteccion de typos en el dominio del correo ("¿quisiste decir…?") ──
export const typo_dominios = {
  'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmil.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmail.om': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'icloud.co': 'icloud.com', 'icloid.com': 'icloud.com', 'live.co': 'live.com',
}

// devuelve la correccion sugerida para un correo con typo de dominio, o null.
export function typo_sugerido(email) {
  const e = String(email || '').trim().toLowerCase()
  const arroba = e.lastIndexOf('@')
  if (arroba < 1) return null
  const correccion = typo_dominios[e.slice(arroba + 1)]
  return correccion ? e.slice(0, arroba + 1) + correccion : null
}

// validacion ESTRICTA del correo del paso 1: formato completo con @ y dominio
// con punto. el boton "Continuar" queda inhabilitado hasta que sea valido.
const co_email_rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function email_valido(v) {
  return co_email_rx.test(String(v || '').trim())
}

// telefonos: solo digitos y maximo 10 (misma regla que el panel admin).
export function solo_digitos_tel(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 10)
}

// la mejor regla de grupo para las personas del checkout.
export function co_volumen(co, dv_mejor_regla) {
  const personas = (Number(co.personas) || 0) + (Number(co.ninos) || 0)
  if (!personas) return null
  return dv_mejor_regla(personas, co.zonaid, co.juegoid)
}

// Totales del checkout. Redondeo al CENTAVO en cada paso, identico a
// calcularTotales() del servidor: un enganche del 30% sobre $9,750.50 son
// $2,925.15, no $2,925.
export function co_total(co, dv_mejor_regla) {
  const base = redondear_dinero((co.precionum * co.pct) / 100)

  let desc = 0
  if (co.promo) {
    desc =
      co.promo.tipo === 'fijo'
        ? Math.min(redondear_dinero(co.promo.valor), base)
        : redondear_dinero((base * co.promo.valor) / 100)
  }

  // MISMA formula que calcularTotales en el servidor: el descuento por
  // volumen se resta de la base antes de la comision, y el descuento
  // COMBINADO se acota a la base (cupon 100% + volumen daba totales
  // NEGATIVOS) — mantener identico a api/_lib/descuentos.js.
  const vol = co_volumen(co, dv_mejor_regla)
  const volpct = vol ? Number(vol.porcentaje) || 0 : 0
  const voldesc = Math.min(
    redondear_dinero((base * volpct) / 100),
    Math.max(0, redondear_dinero(base - desc))
  )
  const bd = Math.max(0, redondear_dinero(base - desc - voldesc))
  const com = redondear_dinero(bd * app_config.COMISION_PCT)

  return { base, desc, vol, volpct, voldesc, bd, com, total: redondear_dinero(bd + com) }
}
