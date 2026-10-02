// ═══════════════════════════════════════════════════════════════════
// remitente-correo.run.mjs — cambio de remitente "Zonas Naranjeros" →
// "Áreas Sociales Naranjeros" (06 oct 2026).
//
// api/_lib/reciboEmail.js y cotizacionEmail.js son CommonJS puro (sin
// import.meta.env) — se cargan con require() directo, sin compilar nada
// con Vite (a diferencia de los componentes React de /reserva-express).
//
// Se corre con:  node pruebas/remitente-correo.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── Remitente SMTP (api/_lib/reciboEmail.js · _remitenteSMTP) ───')
{
  const { _remitenteSMTP } = require('../api/_lib/reciboEmail.js')

  const antes = process.env.EMAIL_FROM
  delete process.env.EMAIL_FROM
  const sinOverride = _remitenteSMTP()
  check('Sin EMAIL_FROM configurado: el nombre por default es "Áreas Sociales Naranjeros"',
    sinOverride.name === 'Áreas Sociales Naranjeros', sinOverride)
  check('Ya NO es "Zonas Naranjeros"', sinOverride.name !== 'Zonas Naranjeros')

  // Un EMAIL_FROM explícito en el entorno SIGUE ganando — el cambio es solo
  // al DEFAULT de código, no se forzó el nombre nuevo por encima de una
  // configuración real en Vercel.
  process.env.EMAIL_FROM = '"Otro Remitente" <otro@reservaestadio.com>'
  const conOverride = _remitenteSMTP()
  check('Con EMAIL_FROM explícito: ese nombre sigue ganando (no se pisa)',
    conOverride.name === 'Otro Remitente', conOverride)

  if (antes === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = antes
}

console.log('\n─── Plantilla de cotización (api/_lib/cotizacionEmail.js) ───')
{
  const { buildCotizEmailHtml } = require('../api/_lib/cotizacionEmail.js')
  const html = buildCotizEmailHtml(
    { id: 'COT-0001', cliente: 'Juan Pérez', juegos: 'vs Águilas', zona: 'Terraza Derecha', total: 9750 },
    null
  )
  check('El encabezado dice "Áreas Sociales Naranjeros"', html.includes('Áreas Sociales Naranjeros'))
  check('Ya no queda "Zonas Naranjeros" en el cuerpo del correo', !html.includes('Zonas Naranjeros'))
}

// El asunto del correo de cotización (enviarCotizacionPorCorreo) es una
// variable local, no se expone por separado — se verifica contra el
// CÓDIGO FUENTE, mismo criterio ya usado en otras pruebas de este repo
// para lo que no se puede leer de vuelta vía una función exportada.
console.log('\n─── Asunto del correo de cotización (código fuente) ───')
{
  const src = readFileSync('api/_lib/cotizacionEmail.js', 'utf8')
  check('El asunto dice "Áreas Sociales Naranjeros de Hermosillo"',
    src.includes("Áreas Sociales Naranjeros de Hermosillo"))
  check('Ya no queda "Zonas Naranjeros" en ningún lado del archivo', !src.includes('Zonas Naranjeros'))
}

console.log('\n─── Sin rastros de "Zonas Naranjeros" en los helpers de correo ───')
{
  const srcRecibo = readFileSync('api/_lib/reciboEmail.js', 'utf8')
  check('reciboEmail.js ya no menciona "Zonas Naranjeros" (ni en comentarios)', !srcRecibo.includes('Zonas Naranjeros'))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
