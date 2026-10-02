// ═══════════════════════════════════════════════════════════════════
// zona-dinamica-y-reenvio.run.mjs — corrección del 06 oct 2026:
//
//   1) El selector de "Zona / Asador" al EDITAR una reserva leía
//      `areasestados` de useadmindatos() — un mapa cacheado que se carga
//      UNA SOLA VEZ al abrir la sesión y solo se refresca con recargar().
//      Eso podía ofrecer una zona que alguien más ya había ocupado
//      mientras la sesión seguía abierta. Ahora consulta EN VIVO contra
//      Supabase con disponibilidad_zonas_en_vivo() — la MISMA función que
//      ya usa formularioexpress.jsx, y que ya tiene su propia cobertura en
//      disponibilidad-bidireccional.run.mjs (no se duplica aquí).
//   2) "Reenviar Comprobante por Email" ahora revisa que haya sesión antes
//      de llamar al endpoint — defensivo, no un candado nuevo: el endpoint
//      en sí (api/send-reservation-email.js) NO exige ningún rol ni
//      sesión de panel admin, confirmado por inspección directa.
//
// La interacción real (elegir una reserva, abrir "Editar", cambiar el
// juego y ver el <select> de zona reaccionar) no se puede ejercitar sin
// un DOM real: los useEffect de React no corren en un render de servidor
// (renderToString) y este proyecto no trae react-test-renderer ni mocks
// de hooks. Se verifica contra el CÓDIGO FUENTE, mismo criterio que
// autologin-y-edicion-express.run.mjs.
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

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
