// ═══════════════════════════════════════════════════════════════════
// tarjetareserva.run.mjs — rediseño UI/UX de la tarjeta de reserva y sus
// botones de acción (02 oct 2026), pestaña "Reservas" de /reserva-express.
//
// Verifica la ESTRUCTURA real del HTML renderizado (no solo que "algo"
// salga, como vistas-admin.run.mjs): una sola tarjeta contenedora con
// encabezado (folio en badge + cliente), cuerpo (Juego/Zona/Estado con
// icono), resumen financiero y los 3 botones de acción DENTRO de esa misma
// tarjeta — el pedido explícito era que el flujo visual fuera continuo
// hasta el último botón, no una barra flotante aparte.
//
// Mismo método que calc-total-prospecto.run.mjs: compila el puente con Vite
// (JSX + los imports extensionless de src/lib/*) y revisa el HTML real.
//
// Se corre con:  node pruebas/tarjetareserva.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/tarjetareserva.jsx', '--outDir', 'pruebas/out-tarjetareserva', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const { render } = await import('./out-tarjetareserva/tarjetareserva.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

const reserva = {
  id: '042', cliente: 'Juan Pérez', email: 'juan@correo.com', tel: '6621234567',
  juego: 'Naranjeros vs Águilas', zona: 'Terraza Derecha 1', estado: 'Confirmada',
}
const resumen = { total: 9750, abonado: 5000, restante: 4750, liquidada: false }

console.log('─── Una sola tarjeta: encabezado + cuerpo + resumen + acciones ───')
{
  const html = render({ reserva, resumen, enviandoemail: false, errorcampo: null, oncerrar: () => {}, oneditar: () => {}, onemail: () => {}, onwhatsapp: () => {} })

  check('Hay exactamente UNA tarjeta contenedora (re-reserva-card)', (html.match(/re-reserva-card/g) || []).length === 1, html.length)
  check('El folio se pinta como badge (re-reserva-folio) con "RES-042"', /re-reserva-folio[^>]*>RES-042</.test(html), html)
  check('Nombre del cliente resaltado', /re-reserva-cliente-nombre[^>]*>Juan Pérez</.test(html))
  check('Contacto (email · tel) visible', html.includes('juan@correo.com') && html.includes('6621234567'))

  check('Fila de Juego con su valor', /re-reserva-fila[\s\S]{0,400}?Juego<\/span>[\s\S]{0,80}?Naranjeros vs Águilas/.test(html))
  check('Fila de Zona / Asador con su valor', /Zona \/ Asador<\/span>[\s\S]{0,80}?Terraza Derecha 1/.test(html))
  check('Fila de Estado con su valor', /Estado<\/span>[\s\S]{0,80}?Confirmada/.test(html))
  // 3 filas del cuerpo + 1 icono whatsapp con fill propio = al menos 4 <svg>.
  check('Cada fila del cuerpo trae su propio ícono (svg)', (html.match(/<svg/g) || []).length >= 6, html)

  check('Resumen financiero: Total/Pagado/Restante en el grid de siempre',
    html.includes('re-resumen-grid') && html.includes('$9,750.00') && html.includes('$5,000.00') && html.includes('$4,750.00'))

  // Las 3 acciones DEBEN estar dentro de la tarjeta: aparecen DESPUÉS de
  // abrir re-reserva-card y antes de su cierre (buscamos que todo el bloque
  // de acciones esté contenido en el único match de la tarjeta completa).
  const cardAbreIdx = html.indexOf('re-reserva-card')
  const editarIdx = html.indexOf('Editar Reserva')
  const emailIdx = html.indexOf('Reenviar Comprobante por Email')
  const waIdx = html.indexOf('Enviar comprobante')
  check('Los 3 botones de acción están DESPUÉS del encabezado (dentro de la tarjeta, no en una barra aparte)',
    cardAbreIdx >= 0 && editarIdx > cardAbreIdx && emailIdx > editarIdx && waIdx > emailIdx,
    { cardAbreIdx, editarIdx, emailIdx, waIdx })

  check('Botón "Editar Reserva" con su clase de acción (borde propio)', /re-accion-btn re-accion-editar[^>]*>[\s\S]{0,400}?Editar Reserva/.test(html))
  check('Botón de email con su clase de acción', /re-accion-btn re-accion-email[^>]*>[\s\S]{0,400}?Reenviar Comprobante por Email/.test(html))
  check('Botón de WhatsApp con el texto pedido "Enviar comprobante" (ya no "Reenviar... por WhatsApp")',
    /re-accion-btn re-accion-whatsapp[^>]*>[\s\S]{0,600}?Enviar comprobante/.test(html) && !html.includes('Reenviar Comprobante por WhatsApp'))
  check('El ícono de WhatsApp es verde de marca (#25D366), no el emoji 📲', html.includes('#25D366') && !html.includes('📲'))
}

console.log('\n─── Estados deshabilitados / avisos ───')
{
  const sinEmail = { ...reserva, email: '' }
  const html = render({ reserva: sinEmail, resumen, enviandoemail: false, errorcampo: null, oncerrar: () => {}, oneditar: () => {}, onemail: () => {}, onwhatsapp: () => {} })
  check('Sin correo: el botón de email queda disabled', /re-accion-email[^>]*disabled/.test(html), html)
  check('Sin correo: aviso explícito visible', html.includes('no tiene correo registrado'))
}
{
  const html = render({ reserva, resumen, enviandoemail: true, errorcampo: 'whatsapp', oncerrar: () => {}, oneditar: () => {}, onemail: () => {}, onwhatsapp: () => {} })
  check('Enviando email: el botón cambia su texto a "Enviando…" y se deshabilita',
    html.includes('Enviando…') && /re-accion-email[^>]*disabled/.test(html))
  check('errorcampo "whatsapp": aviso de teléfono inválido visible', html.includes('no tiene un teléfono a 10 dígitos'))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
