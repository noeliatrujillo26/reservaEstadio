// ═══════════════════════════════════════════════════════════════════
// comprobante-efectivo.run.mjs — Comprobante OPCIONAL en EFECTIVO
// (15 oct 2026), en las TRES pantallas de captura de pago de este repo:
//   · "Registrar Cobro" de Reserva Exprés (cobrarreserva.jsx)
//   · "Nuevo cobro" del panel admin (nuevocobro.jsx)
//   · el modal de pagos del Pipeline (detalleprospecto.jsx) — YA lo hacía
//     bien antes de este ticket; se deja como ancla de que no se rompió.
// Transferencia/Tarjeta/pagos digitales SIGUEN exigiéndolo. Mismo criterio
// que ya tiene el panel v1 (js/modules/pipeline.js, js/modules/cobros.js).
//
// Verificación a nivel de FUENTE (mismo patrón que sinemojis.run.mjs): no
// hace falta montar React para confirmar que la condición booleana
// correcta está conectada al campo.
//
// Se corre con:  node pruebas/comprobante-efectivo.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/cascadas.js', '--outDir', 'pruebas/out-cascadas', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const { es_forma_efectivo } = await import('./out-cascadas/cascadas.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── es_forma_efectivo(): la función que decide ───')
check('"EFECTIVO" → true (garantizada, sin catálogo)', es_forma_efectivo('EFECTIVO') === true)
check('"Caja taquilla estadio" → true (garantizada)', es_forma_efectivo('Caja taquilla estadio') === true)
check('"TRANSFERENCIA" → false', es_forma_efectivo('TRANSFERENCIA') === false)
check('"TARJETA" → false', es_forma_efectivo('TARJETA') === false)
check('vacío/undefined → false (nunca truena)', es_forma_efectivo('') === false && es_forma_efectivo(undefined) === false)
check('Catálogo real: un método tipo "efectivo" (ej. "Caja chica") → true',
  es_forma_efectivo('Caja chica', [{ nombre: 'Caja chica', tipo: 'efectivo' }]) === true)
check('Catálogo real: un método tipo "transferencia" → false',
  es_forma_efectivo('Cuenta BBVA', [{ nombre: 'Cuenta BBVA', tipo: 'transferencia' }]) === false)

console.log('\n─── "Registrar Cobro" de Reserva Exprés (cobrarreserva.jsx) ───')
{
  const src = readFileSync(new URL('../src/components/reservaexpress/cobrarreserva.jsx', import.meta.url), 'utf8')
  check('Importa es_forma_efectivo', /import \{ es_forma_efectivo \} from '\.\.\/\.\.\/lib\/dashboard'/.test(src))
  check('comprobanteobligatorio excluye EFECTIVO (y sigue excluyendo Saldo a favor)',
    /const comprobanteobligatorio = !toca_saldo_favor\('ABONO', forma\) && !es_forma_efectivo\(forma\)/.test(src))
}

console.log('\n─── "Nuevo cobro" del panel admin (nuevocobro.jsx) ───')
{
  const src = readFileSync(new URL('../src/components/admin/nuevocobro.jsx', import.meta.url), 'utf8')
  check('Importa es_forma_efectivo', /import \{ es_forma_efectivo, es_pago_credito \} from '\.\.\/\.\.\/lib\/dashboard'/.test(src))
  check('comprobanteobligatorio excluye EFECTIVO (contra el catálogo real de metodos)',
    /const comprobanteobligatorio = !toca_saldo_favor\(concepto, forma\) && !es_forma_efectivo\(forma, metodos\)/.test(src))
}

console.log('\n─── Modal de pagos del Pipeline (detalleprospecto.jsx) — ancla, ya estaba bien ───')
{
  const src = readFileSync(new URL('../src/components/admin/detalleprospecto.jsx', import.meta.url), 'utf8')
  check('Ya excluía EFECTIVO antes de este ticket (es_forma_efectivo en la condición)',
    /!es_forma_efectivo\(formaefectiva, metodos\)/.test(src))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
