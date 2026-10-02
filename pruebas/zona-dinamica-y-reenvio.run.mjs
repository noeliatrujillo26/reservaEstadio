// ═══════════════════════════════════════════════════════════════════
// zona-dinamica-y-reenvio.run.mjs — correcciones del 06 oct 2026 en la
// pestaña "Reservas" de /reserva-express:
//
//   1) El selector de "Zona / Asador" al EDITAR una reserva leía
//      `areasestados` de useadmindatos() — un mapa cacheado que se carga
//      UNA SOLA VEZ al abrir la sesión y solo se refresca con recargar().
//      Ahora consulta EN VIVO contra Supabase con
//      disponibilidad_zonas_en_vivo() — la MISMA función que ya usa
//      formularioexpress.jsx, y que ya tiene su propia cobertura en
//      disponibilidad-bidireccional.run.mjs (no se duplica aquí).
//   2) "Reenviar Comprobante por Email": NO se encontró en ningún lugar
//      del código el mensaje "Sesión del panel requerida" ni un candado
//      es_admin para este botón (búsqueda exhaustiva en todo el repo,
//      sin coincidencias) — api/send-reservation-email.js nunca exigió
//      rol ni sesión de panel. Se agregó de todos modos una comprobación
//      defensiva de sesión, y — lo que SÍ era un bug real — ahora
//      consulta `reservas` directo en Supabase justo antes de reenviar,
//      para no depender de una copia local que recargar() (async) quizás
//      no haya terminado de refrescar.
//   3) El <Toast/> compartido no tenía NINGÚN CSS bajo .pagina-reserva-
//      express (solo bajo .pagina-admin) — cada aviso salía invisible.
//      Ahora tiene su propia regla base + variantes toast-exito/
//      toast-error.
//
// La interacción real (elegir una reserva, abrir "Editar", cambiar el
// juego y ver el <select> de zona reaccionar, o pulsar "Reenviar" y ver
// el toast) no se puede ejercitar sin un DOM real: los useEffect de React
// no corren en un render de servidor (renderToString) y este proyecto no
// trae react-test-renderer ni mocks de hooks. Se verifica contra el
// CÓDIGO FUENTE, mismo criterio que autologin-y-edicion-express.run.mjs.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

const src = readFileSync('src/components/reservaexpress/verreservas.jsx', 'utf8')

console.log('─── 1) Zona al editar: disponibilidad EN VIVO, no el mapa cacheado ───')
{
  check('Importa disponibilidad_zonas_en_vivo (lib/mapaocupacion.js)',
    src.includes("disponibilidad_zonas_en_vivo") && src.includes("from '../../lib/mapaocupacion'"))
  check('Ya NO llama a estado_vivo()', !src.includes('estado_vivo('))
  check('`areasestados` ya NO se destructura de useadmindatos() (solo queda mencionado en un comentario histórico)',
    !/const \{[^}]*areasestados[^}]*\} = useadmindatos\(\)/.test(src))
  check('Hay un estado de carga (cargandozonas) mientras llega la respuesta',
    src.includes('cargandozonas'))
  check('El <select> se deshabilita mientras carga o sin zonas disponibles',
    /disabled=\{!d\.juegoid \|\| cargandozonas \|\| sinzonasdisponibles\}/.test(src))
  check('Placeholder "— Sin zonas disponibles —" cuando el juego no tiene ninguna libre',
    src.includes('Sin zonas disponibles'))
  check('La zona ACTUAL de la reserva solo se cuela si el juego elegido es el MISMO que ya tenía',
    src.includes('String(reserva.juegoid) === String(d.juegoid)'))
}

console.log('\n─── 2) Reenviar comprobante: revisa sesión antes de llamar al endpoint ───')
{
  const inicio = src.indexOf('async function reenviaremail(')
  const fin = src.indexOf('function mensaje_whatsapp', inicio)
  const cuerpo = inicio >= 0 && fin > inicio ? src.slice(inicio, fin) : ''
  check('reenviaremail() existe', inicio >= 0)
  check('Revisa `usuario` (sesión de Reserva Express) antes de llamar a fetch()',
    /if \(!usuario\)/.test(cuerpo))
  check('El aviso es sobre la SESIÓN, no sobre un rol/candado de panel admin',
    cuerpo.includes('Tu sesión expiró'))
}

console.log('\n─── 3) El endpoint de reenvío NO exige rol ni sesión de panel admin ───')
{
  const srcApi = readFileSync('api/send-reservation-email.js', 'utf8')
  check('No hay ninguna verificación de "es_admin" ni similar', !/es_admin|esAdmin/.test(srcApi))
  check('No hay ninguna verificación de cookie/sesión de panel ("Sesión del panel")',
    !srcApi.includes('Sesión del panel'))
  check('La única validación de identidad es folio + email coincidentes (ya documentada)',
    srcApi.includes('El correo no coincide con la reserva'))
}

console.log('\n─── 4) Reenvío con datos FRESCOS (06 oct 2026): consulta directa antes de enviar ───')
{
  const inicio = src.indexOf('async function reenviaremail(')
  const fin = src.indexOf('function mensaje_whatsapp', inicio)
  const cuerpo = inicio >= 0 && fin > inicio ? src.slice(inicio, fin) : ''

  check('Antes de llamar al endpoint, consulta `reservas` directo en Supabase por id',
    /sb\s*\n?\s*\.from\('reservas'\)\.select\('id, email'\)\.eq\('id', reserva\.id\)\.maybeSingle\(\)/.test(cuerpo))
  check('Si la consulta falla o no encuentra la reserva, avisa y NO intenta enviar',
    cuerpo.includes('No se pudo confirmar la reserva antes de reenviar'))
  check('El folio y el email que se mandan al endpoint son los FRESCOS (fresca.id/emailfresco), no la copia local',
    cuerpo.includes('folio: fresca.id') && cuerpo.includes('email: emailfresco'))
  check('El toast de éxito dice exactamente "Comprobante actualizado reenviado con éxito a <email>"',
    cuerpo.includes("'✅ Comprobante actualizado reenviado con éxito a ' + emailfresco"))
}

console.log('\n─── 5) Toast visible y con color (antes invisible en /reserva-express) ───')
{
  const srcToast = readFileSync('src/components/ui/toast.jsx', 'utf8')
  check('toast.jsx agrega "toast-exito" cuando el mensaje empieza con ✅',
    srcToast.includes("toast-exito") && srcToast.includes("startsWith('✅')"))
  check('toast.jsx agrega "toast-error" para ⚠️/⛔/❌/🚫',
    srcToast.includes('toast-error'))

  const srcCss = readFileSync('src/styles/reserva-express.css', 'utf8')
  check('reserva-express.css YA tiene una regla base .toast (antes no tenía ninguna)',
    /\.pagina-reserva-express \.toast \{/.test(srcCss))
  check('…con variante verde para toast-exito', /\.toast\.toast-exito \{ border-left-color: var\(--verde\)/.test(srcCss))
  check('…y variante roja para toast-error', /\.toast\.toast-error \{ border-left-color: var\(--rojo\)/.test(srcCss))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
