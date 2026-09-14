// ═══════════════════════════════════════════════════════════════════
// calc-total-prospecto.run.mjs — calc_total_prospecto() DEBE aplicar el
// descuento (manual, cupón o por volumen/grupo) únicamente sobre el costo
// de ocupar la zona (área + personas extra); Consumo y Extra jamás se
// descuentan.
//
// BUG REAL (14 sep 2026): el `subtotal` que alimentaba los cálculos de
// descuento ya venía empacado con Consumo y Extra —el mismo bug de "regla
// global" ya corregido del lado de v1 (js/modules/pipeline.js, 11 sep
// 2026)—, así que un Consumo grande diluía el % efectivo del descuento en
// vez de mantenerse íntegro.
//
// Mismo método que cascadas.run.mjs: compila el puente con Vite (resuelve
// los imports extensionless de src/lib/*, que Node por sí solo no entiende)
// y corre las cuentas contra el bundle real.
//
// Se corre con:  node pruebas/calc-total-prospecto.run.mjs
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
const { calc_total_prospecto } = await import('./out-cascadas/cascadas.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── Caso 1: solo área, sin descuento ───')
{
  const c = calc_total_prospecto(
    { areamonto: 9750, consumomonto: 0, extramonto: 0, descuento: 0, minpersonas: 15 },
    { areas: [], descuentosvolumen: [] }
  )
  check('subtotal = total = $9,750, sin descuento', c.subtotal === 9750 && c.total === 9750 && c.descuentototal === 0, c)
}

console.log('\n─── Caso 2: área + descuento manual 10%, SIN consumo/extra ───')
{
  const c = calc_total_prospecto(
    { areamonto: 9750, consumomonto: 0, extramonto: 0, descuento: 10, minpersonas: 15 },
    { areas: [], descuentosvolumen: [] }
  )
  check('Descuento −$975.00 (10% exacto del área) · total $8,775.00', c.descuentototal === 975 && c.total === 8775, c)
}

console.log('\n─── Caso 3 (el ejemplo del reporte): área $9,750 −10% + Consumo $10,000 + Extra $230 ───')
{
  const c = calc_total_prospecto(
    { areamonto: 9750, consumomonto: 10000, extramonto: 230, descuento: 10, minpersonas: 15 },
    { areas: [], descuentosvolumen: [] }
  )
  check('areabase (base descontable) = $9,750, SIN inflar por Consumo/Extra', c.areabase === 9750, c)
  check('Descuento −$975.00 (10% SOLO del área, no de los $19,980 con consumo/extra)', c.descuentototal === 975, c)
  check('subtotal (bruto empacado) = $19,980.00 (9,750+10,000+230)', c.subtotal === 19980, c)
  check('Total EXACTO $19,005.00 = (9,750−975) + 10,000 + 230', c.total === 19005, c)
}

console.log('\n─── Caso 4: descuento por VOLUMEN (grupo), zona normal, con Consumo — el grupo tampoco toca Consumo ───')
{
  const c = calc_total_prospecto(
    { areamonto: 8200, consumomonto: 1000, extramonto: 0, descuento: 0, minpersonas: 15, zonaid: 'z1' },
    { areas: [{ id: 'z1', escompartida: false }],
      descuentosvolumen: [{ activo: true, minpersonas: 15, porcentaje: 10, juegos: [], zonas: [] }] }
  )
  check('Regla de grupo detectada (10%)', c.volumenpct === 10, c)
  check('Descuento −$820.00 (10% de $8,200, nunca del consumo)', c.descuentototal === 820, c)
  check('Total $8,380.00 (8,200−820+1,000) — mismo resultado ya validado en v1', c.total === 8380, c)
}

console.log('\n─── Caso 5: PALCO — regresión (el grupo excluye niños de su base; sigue igual que antes) ───')
{
  const c = calc_total_prospecto(
    {
      areamonto: 5000, consumomonto: 0, extramonto: 0, descuento: 0, minpersonas: 4,
      adultoextraprecio: 1000, adultoextracant: 2, ninoextraprecio: 500, ninoextracant: 3,
      zonaid: 'palco1',
    },
    { areas: [{ id: 'palco1', escompartida: true }],
      descuentosvolumen: [{ activo: true, minpersonas: 6, porcentaje: 20, juegos: [], zonas: [] }] }
  )
  check('Es palco y el umbral de grupo cuenta SOLO adultos (totaladultos=6)', c.espalco === true && c.totaladultos === 6, c)
  check('areabase incluye TODO (área + adultos + niños) = $8,500', c.areabase === 8500, c)
  check('Descuento de grupo −$1,400.00 (20% de área+adultos=$7,000, niños EXCLUIDOS)', c.descuentototal === 1400, c)
  check('Total $7,100.00 (8,500−1,400)', c.total === 7100, c)
}

console.log('\n─── Caso 6: cupón de MONTO FIJO mayor al área — se topa en areabase, nunca "gasta" contra el Consumo ───')
{
  const c = calc_total_prospecto(
    { areamonto: 1000, consumomonto: 5000, extramonto: 0, minpersonas: 0, cupon: { tipo: 'fijo', valor: 5000 } },
    { areas: [], descuentosvolumen: [] }
  )
  check('El cupón de $5,000 se topa en el área ($1,000), no en el subtotal con consumo ($6,000)',
    c.descuentototal === 1000, c)
  check('Total $5,000.00 (6,000−1,000) — el Consumo queda íntegro', c.total === 5000, c)
}

console.log('\n─── Caso 7: manual + grupo combinados (no palco) — ambos sobre areabase, nunca sobre Consumo ───')
{
  const c = calc_total_prospecto(
    { areamonto: 10000, consumomonto: 2000, extramonto: 0, descuento: 10, minpersonas: 15, zonaid: 'z2' },
    { areas: [{ id: 'z2', escompartida: false }],
      descuentosvolumen: [{ activo: true, minpersonas: 15, porcentaje: 5, juegos: [], zonas: [] }] }
  )
  // manual: 10% de 10,000 = 1,000 · grupo: 5% de 10,000 = 500 → 1,500 en pesos
  check('Descuento combinado −$1,500.00 (10% + 5% del área, nunca del consumo)', c.descuentototal === 1500, c)
  check('Total $10,500.00 = (10,000−1,500) + 2,000', c.total === 10500, c)
}

console.log('\n─── Caso 8: manual > 100% (capturado a mano) — el piso de $0 es SOLO del área, jamás "pide prestado" al Consumo ───')
{
  // Encontrado por el banco diferencial (pruebas/cascadas.run.mjs) contra la
  // v1 real: un descuento manual de 112% sobre área $15,154.77 + consumo
  // $5,102.12 + extra $3,914.37 daba total v1 $9,016.49 pero v2 $5,647.64 —
  // el exceso del 12% por encima del área se estaba comiendo parte del
  // consumo/extra en vez de quedarse solo en $0 de área.
  const c = calc_total_prospecto(
    { areamonto: 15154.77, consumomonto: 5102.12, extramonto: 3914.37, descuento: 112, minpersonas: 28 },
    { areas: [], descuentosvolumen: [] }
  )
  check('El área se queda en $0 (nunca negativa) y Consumo+Extra quedan ÍNTEGROS: total $9,016.49',
    c.total === 9016.49, c)
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
