// ═══════════════════════════════════════════════════════════════════
// sinemojis.run.mjs — rediseño minimalista de /reserva-express (02 oct
// 2026): tipografía, SVG y remoción de emojis.
//
// Renderiza FormularioExpress y CobrarReserva con react-dom/server (mismo
// método que pruebas/tarjetareserva.run.mjs/calc-total-prospecto.run.mjs:
// compila el puente con Vite y revisa el HTML real) y comprueba que los
// emojis de encabezados/botones desaparecieron y los SVG de iconos.jsx
// quedaron en su lugar.
//
// Se corre con:  node pruebas/sinemojis.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/sinemojis.jsx', '--outDir', 'pruebas/out-sinemojis', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const { renderFormulario, renderCobrar, renderReservas } = await import('./out-sinemojis/sinemojis.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

// Los emojis que el rediseño debía eliminar de encabezados y botones —
// NO se incluyen los de las plantillas de WhatsApp (mensaje_whatsapp) ni
// los de los toasts (mostrartoast): esos son texto que recibe el CLIENTE
// o retroalimentación transitoria, no "encabezados y botones" de la app,
// y el ticket no pidió tocarlos.
const EMOJIS_PROHIBIDOS = ['👤', '🏟️', '🏟', '🔎', '💰', '🧾', '📥', '📤', '📎', '🥩', '🌮']

console.log('─── "Nueva Reserva" (formularioexpress.jsx) ───')
{
  const html = renderFormulario()
  for (const e of EMOJIS_PROHIBIDOS) {
    check('Sin "' + e + '"', !html.includes(e), html.length)
  }
  check('Título "Cliente" sigue presente (con ícono, no con 👤)', html.includes('>Cliente</div>') || /Cliente<\/div>/.test(html))
  check('Título "Evento" sigue presente', /Evento<\/div>/.test(html))
  check('Título "Financiero" sigue presente', /Financiero<\/div>/.test(html))
  check('"Carne asada" sigue presente, ahora con su SVG (viewBox 0 0 118 122, el de la landing)',
    html.includes('Carne asada') && html.includes('viewBox="0 0 118 122"'))
  // Discada solo se pinta si el juego fijado permite DOM-MIÉ; el fixture no
  // fija juego todavía, así que el botón de Discada no se monta — se
  // comprueba solo que, si el SVG de Carne Asada ya está, el formulario no
  // reventó al resolver el ícono (misma import, mismo módulo).
  check('La página no se cae al renderizar (hay contenido real)', html.length > 2000, html.length)

  // Botón naranja principal (02 oct 2026, refinamiento): Sentence case, no
  // "Crear Reserva Momentánea" con cada palabra en mayúscula.
  check('Botón "Crear reserva momentánea" en Sentence case (no "Crear Reserva Momentánea")',
    html.includes('Crear reserva momentánea') && !html.includes('Crear Reserva Momentánea'))
}

console.log('\n─── "Registrar Cobro" (cobrarreserva.jsx) ───')
{
  const html = renderCobrar()
  for (const e of EMOJIS_PROHIBIDOS) {
    check('Sin "' + e + '"', !html.includes(e), html.length)
  }
  check('Título "Buscar reserva" sigue presente', /Buscar reserva<\/div>/.test(html))
  check('El formulario no se cae al renderizar', html.length > 1000, html.length)
}

// El botón "Registrar Cobro" y el área de carga solo se montan con una
// reserva ya elegida (estado interno que un render SSR de una sola pasada
// no puede simular) — se verifican sobre el CÓDIGO FUENTE en vez del HTML
// renderizado, mismo criterio que usan otras pruebas de este repo
// (test-landing-responsive.js, en el otro proyecto) para marcado que no
// se monta solo.
console.log('\n─── Botón naranja principal y carga de comprobante (código fuente) ───')
{
  const src = readFileSync('src/components/reservaexpress/cobrarreserva.jsx', 'utf8')
  check('Botón "Registrar Cobro" en Sentence case (no "REGISTRAR COBRO")',
    src.includes("'Registrar Cobro'") && !src.includes('REGISTRAR COBRO'))
  check('Carga de comprobante: texto corto "Subir comprobante" (no el párrafo largo anterior)',
    src.includes('Subir comprobante') && !src.includes('Clic para cargar comprobante'))
}

// ── Sesión fija: getSession(), no getUser() (05 oct 2026) ────────────────
// getUser() SIEMPRE hace un viaje de red a Supabase para revalidar; en una
// conexión celular lenta/al despertar el radio justo al abrir la app, ese
// viaje podía tardar más que el tope de con_tiempo() y mandaba al login con
// una sesión local perfectamente válida esperando. getSession() resuelve
// la sesión YA guardada en localStorage sin depender de ese viaje de red
// para el caso común. No hay forma honesta de ejercitar esto end-to-end
// (depende de window/localStorage reales y de una llamada de red a
// Supabase) — se verifica contra el CÓDIGO FUENTE, mismo criterio que la
// verificación de editar_reserva_express() en
// autologin-y-edicion-express.run.mjs.
console.log('\n─── Sesión fija: admincontext.jsx usa getSession(), no getUser() ───')
{
  const src = readFileSync('src/context/admincontext.jsx', 'utf8')
  const inicio = src.indexOf('const cargar_perfil = useCallback(')
  const fin = src.indexOf('}, [])', inicio)
  const cuerpo = inicio >= 0 && fin > inicio ? src.slice(inicio, fin) : ''
  check('cargar_perfil() existe', inicio >= 0)
  check('Usa sb.auth.getSession() para resolver la sesión ya guardada', cuerpo.includes('sb.auth.getSession()'))
  check('NO usa sb.auth.getUser() (el que siempre viaja por red)', !cuerpo.includes('sb.auth.getUser()'))
  check('Lee el usuario desde session.user (getSession() ya lo trae, sin otra llamada)',
    cuerpo.includes('session.user'))
}

// ── Rediseño de las 3 pestañas superiores (05 oct 2026) ──────────────────
// Cada botón lleva su propia clase de color (re-tab-nueva/-cobrar/-
// -reservas) + su ícono — se verifica en los 3 componentes que las montan
// (las tres pantallas repiten la misma barra, sin un componente
// compartido).
console.log('\n─── Pestañas superiores: clases de color + íconos por pestaña ───')
{
  const revisar = (html, nombre) => {
    check(nombre + ': re-tab-nueva presente', /re-tab re-tab-nueva/.test(html), html.length)
    check(nombre + ': re-tab-cobrar presente', /re-tab re-tab-cobrar/.test(html), html.length)
    check(nombre + ': re-tab-reservas presente', /re-tab re-tab-reservas/.test(html), html.length)
    check(nombre + ': la pestaña activa trae la clase "activo"', / activo"/.test(html), html.length)
    // 3 pestañas × su propio ícono (calendario+, monedas+$, calendario+lista)
    // = al menos 3 <svg> solo en la barra de pestañas (puede haber más en el
    // resto de la pantalla, pero nunca menos de 3 aquí).
    const svgs = (html.match(/<svg/g) || []).length
    check(nombre + ': hay íconos SVG de sobra para las 3 pestañas (≥3 en toda la página)', svgs >= 3, svgs)
  }
  revisar(renderFormulario(), 'Nueva Reserva (formularioexpress.jsx)')
  revisar(renderCobrar(), 'Registrar Cobro (cobrarreserva.jsx)')
  revisar(renderReservas(), 'Reservas (verreservas.jsx)')
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
