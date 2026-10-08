// ═══════════════════════════════════════════════════════════════════
// ticket-reserva-desglose.run.mjs — el ticket de Reserva Exprés que viaja
// por el enlace de WhatsApp (html_ticket_reserva, src/lib/recibo.js,
// publicado en Storage y servido por /api/recibo?f=...) estaba incompleto
// frente al correo de confirmación: solo mostraba el total final, sin el
// desglose Área/IVA/Subtotal/Descuento/Extra/Consumo (02 oct 2026).
//
// El cálculo se homologó con el mismo que usa el panel v1 para su correo/
// recibo (_desgloseAreaIvaReserva, api/_lib/reciboEmail.js): precios CON
// IVA incluido, así que "Área" (antes de IVA) sale de dividir entre 1.16.
//
// Mismo método que calc-total-prospecto.run.mjs: compila el puente con
// Vite (pruebas/cascadas.js, ya re-exporta html_ticket_reserva) y corre
// las comprobaciones contra el HTML real generado.
//
// Se corre con:  node pruebas/ticket-reserva-desglose.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/cascadas.js', '--outDir', 'pruebas/out-cascadas', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const { html_ticket_reserva } = await import('./out-cascadas/cascadas.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── Con desglose completo (areabase presente, el caso real de Reserva Exprés) ───')
{
  // Área $9,750 con IVA incluido −10% de descuento + Extra $230 + Consumo
  // $1,000 — mismo ejemplo de calc-total-prospecto.run.mjs. areabase =
  // $9,750 (antes del descuento, SIN consumo/extra, igual que calc.areabase).
  const html = html_ticket_reserva({
    folio: 'NRJ-ADM-00123', cliente: 'Juan Pérez', tel: '6621234567',
    zona: 'Jardín Derecho A', juego: 'vs Águilas · J5', fecha: '15 de octubre de 2026',
    personas: 18, vendedora: 'Meli', monto: 9005, estado: 'Reserva registrada · pendiente de enganche',
    areabase: 9750, descuentototal: 975, extramonto: 230, consumomonto: 1000,
  })

  check('Área = $8,405.17 (9,750 ÷ 1.16, antes de IVA)', html.includes('$8,405.17 MXN'), html)
  check('IVA (16%) = $1,344.83 (9,750 − 8,405.17)', html.includes('$1,344.83 MXN'), html)
  check('Subtotal = $9,750.00 (el areabase íntegro, CON IVA)', html.includes('Subtotal</span><span>$9,750.00 MXN'), html)
  check('Descuento (10%) = −$975.00', html.includes('Descuento (10%)') && html.includes('−$975.00 MXN'), html)
  check('Extra = $230.00', html.includes('Extra</span><span>$230.00 MXN'), html)
  check('Consumo = $1,000.00', html.includes('Consumo</span><span>$1,000.00 MXN'), html)
  check('Total de la reserva = $9,005.00 (el monto final que ya traía el ticket)',
    html.includes('Total de la reserva</span><span>$9,005.00 MXN'), html)
  check('Monto pagado = $0.00 (reserva momentánea, nada cobrado todavía)',
    html.includes('Monto pagado</span><span>$0.00 MXN'), html)
  check('Forma de pago = "Sin pago"', html.includes('Forma de pago</span><span>Sin pago'), html)
  check('Saldo restante = $9,005.00 (igual al total: nada abonado)',
    html.includes('Saldo restante</span><span>$9,005.00 MXN'), html)
  check('Estado de pago = "Por cobrar"', html.includes('Estado de pago</span><span>Por cobrar'), html)
  check('El renglón "Estado" (de la RESERVA, no del pago) se conserva tal cual venía',
    html.includes('Estado</span><span>Reserva registrada'));
  check('El orden es Área → IVA → Subtotal → Descuento → Extra → Consumo → Total',
    html.indexOf('>Área<') < html.indexOf('IVA (16%)')
    && html.indexOf('IVA (16%)') < html.indexOf('>Subtotal<')
    && html.indexOf('>Subtotal<') < html.indexOf('Descuento (10%)')
    && html.indexOf('Descuento (10%)') < html.indexOf('>Extra<')
    && html.indexOf('>Extra<') < html.indexOf('>Consumo<')
    && html.indexOf('>Consumo<') < html.indexOf('Total de la reserva'));
}

console.log('\n─── Sin descuento, sin extra, sin consumo: esas filas no aparecen (cero ruido) ───')
{
  const html = html_ticket_reserva({
    folio: 'NRJ-ADM-00124', cliente: 'Ana López', tel: '6629876543',
    zona: 'Terraza Derecha 2', juego: 'vs Sultanes · J8', fecha: '20 de noviembre de 2026',
    personas: 10, vendedora: 'Fer', monto: 5500, estado: 'Reserva registrada · pendiente de enganche',
    areabase: 5500, descuentototal: 0, extramonto: 0, consumomonto: 0,
  })
  check('Área/IVA/Subtotal SÍ aparecen (siempre que haya areabase)', html.includes('>Área<') && html.includes('IVA (16%)'));
  check('Descuento NO aparece (0)', !html.includes('Descuento ('));
  check('Extra NO aparece (0)', !html.includes('>Extra<'));
  check('Consumo NO aparece (0)', !html.includes('>Consumo<'));
}

console.log('\n─── Sin areabase (llamador viejo o dato incompleto): el bloque se omite, no se inventan ceros ───')
{
  const html = html_ticket_reserva({
    folio: 'NRJ-ADM-00125', cliente: 'Carlos Ruiz', tel: '6625551234',
    zona: 'Palco All-Inclusive Der', juego: 'vs Tomateros · J12', fecha: '05 de diciembre de 2026',
    personas: 20, vendedora: 'Meli', monto: 18000, estado: 'Reserva registrada · pendiente de enganche',
  })
  check('Sin areabase: no aparece "Área" ni "IVA (16%)" (nada inventado)',
    !html.includes('>Área<') && !html.includes('IVA (16%)'));
  check('El resto del ticket sigue intacto: Total/Monto pagado/Saldo/Estado de pago',
    html.includes('Total de la reserva</span><span>$18,000.00 MXN')
    && html.includes('Monto pagado</span><span>$0.00 MXN')
    && html.includes('Estado de pago</span><span>Por cobrar'));
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
