// ═══════════════════════════════════════════════════════════════════
// fechas.js — helpers de fecha del sitio publico.
// espejo 1:1 de v1: _MESES_CAL, _fechaConDia(), _diaSemanaCorto() y _esJueSab()
// de panel-inicio.html.
// ═══════════════════════════════════════════════════════════════════

export const meses_cal = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// fecha de "hoy" en la zona horaria del estadio, no la del navegador.
// misma llamada que usan cargarJuegos() y renderCal() en la v1.
export function hoy_hermosillo() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' })
}

// "Jueves 15 de Octubre" (largo) o "Jue, 15 de Oct" (corto).
export function fecha_con_dia(fecha_iso, corto) {
  if (!fecha_iso) return ''
  const dia = new Date(fecha_iso + 'T12:00')
    .toLocaleDateString('es-MX', { weekday: corto ? 'short' : 'long' })
    .replace('.', '')
  const dia_cap = dia.charAt(0).toUpperCase() + dia.slice(1)
  const [, mm, dd] = fecha_iso.split('-')
  const mes = meses_cal[parseInt(mm, 10) - 1] || ''
  return corto
    ? dia_cap + ', ' + parseInt(dd, 10) + ' de ' + mes.slice(0, 3)
    : dia_cap + ' ' + parseInt(dd, 10) + ' de ' + mes
}

// solo la abreviatura del dia ("Jue") para las tarjetas compactas.
export function dia_semana_corto(fecha_iso) {
  if (!fecha_iso) return ''
  const dia = new Date(fecha_iso + 'T12:00')
    .toLocaleDateString('es-MX', { weekday: 'short' })
    .replace('.', '')
  return dia.charAt(0).toUpperCase() + dia.slice(1)
}

// domingo-miercoles vs jueves-sabado: precio2 aplica jue/vie/sab (dia 4,5,6).
export function es_jue_sab(fecha) {
  if (!fecha) return false
  return new Date(fecha + 'T12:00:00').getDay() >= 4
}

// "19:30" -> "7:30 PM". misma conversion que cargarJuegos() y selDia().
export function hora12(hora) {
  const h = parseInt(hora)
  const min = String(hora).split(':')[1]
  return (h > 12 ? h - 12 : h) + ':' + min + (h >= 12 ? ' PM' : ' AM')
}
