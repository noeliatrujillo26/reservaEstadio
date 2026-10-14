// ═══════════════════════════════════════════════════════════════════
// propina-express.run.mjs — Propina en Reserva Exprés (14 oct 2026).
//
// Cubre dos frentes:
//  1. insertar_verificado() (src/lib/escritura.js) ya reintenta de forma
//     QUIRÚRGICA: si la base rechaza el cobro porque la columna `propina`
//     aún no está migrada, se quita SOLO esa columna y el cobro conserva
//     email/zona_id/origen/creado_por_*/tipo_movimiento — antes, cualquier
//     columna ausente degradaba TODO el payload al subconjunto legacy.
//  2. Las vistas de Reserva Exprés capturan y envían la propina:
//     "Registrar Cobro" (cobrarreserva.jsx → usecobrosescritura.js, campo
//     cobros.propina del MISMO cobro) y "Nueva Reserva"
//     (formularioexpress.jsx → usereservaexpress.js, fila propia en cobros
//     con monto 0 y el folio de la reserva nueva). Comprobación a nivel de
//     fuente, mismo criterio que sinemojis.run.mjs.
//
// Se corre con:  node pruebas/propina-express.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/propina-express.js', '--outDir', 'pruebas/out-propina-express', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true, env: { ...process.env, VITE_ESCRITURA_ADMIN: 'true' } }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const { insertar_verificado, columna_faltante } = await import('./out-propina-express/propina-express.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

const ADMIN = { rol: 'Administrador', permisos: {} }
const CLAVES_LEGACY = [
  'fecha', 'mes', 'cliente', 'area', 'zona', 'concepto', 'monto', 'forma_pago',
  'fecha_reserva', 'recibio', 'factura', 'folio', 'notas', 'evidencia',
]
const PAYLOAD = {
  fecha: '2026-10-14', mes: 'Octubre', cliente: 'CLIENTE EXPRESS', email: 'x@x.com',
  area: 'ASADOR', zona: 'TERRAZA X', zona_id: 'z-1', concepto: 'ABONO',
  monto: 2000, propina: 150.5, forma_pago: 'EFECTIVO', fecha_reserva: '',
  recibio: 'Root', factura: '', folio: 'NRJ-ADM-X1', notas: 'n', evidencia: '',
  creado_por_id: 'u1', creado_por_email: 'root@x.com',
  origen: 'RESERVA_EXPRESS_MOBILE', tipo_movimiento: 'ABONO_DIRECTO',
}

function errorColumna(col) {
  return { code: 'PGRST204', message: "Could not find the '" + col + "' column of 'cobros' in the schema cache" }
}

// sb falso: rechaza mientras el payload traiga alguna de las columnas
// "sin migrar"; acepta en cuanto ya no viajen, devolviendo la fila.
function sbFalso(columnasQueFaltan) {
  const intentos = []
  return {
    intentos,
    from: () => ({
      insert: (payload) => ({
        select: async () => {
          intentos.push(Object.assign({}, payload))
          const faltante = columnasQueFaltan.find((c) => c in payload)
          if (faltante) return { data: null, error: errorColumna(faltante) }
          return { data: [payload], error: null }
        },
      }),
    }),
  }
}

console.log('─── columna_faltante(): lee el nombre exacto del error ───')
check("PGRST204 'propina' → 'propina'", columna_faltante(errorColumna('propina')) === 'propina')
check('mensaje sin nombre → null', columna_faltante({ code: 'PGRST204', message: 'columna desconocida' }) === null)

console.log('\n─── Solo falta `propina`: el cobro conserva TODOS sus metadatos ───')
{
  const sb = sbFalso(['propina'])
  const r = await insertar_verificado(sb, ADMIN, 'cobros', PAYLOAD, CLAVES_LEGACY)
  const final = sb.intentos[sb.intentos.length - 1]
  check('El insert termina OK', r.ok === true, r)
  check('Se quitó SOLO propina', !('propina' in final))
  check('email/zona_id/origen/creado_por_*/tipo_movimiento SIGUEN en el payload',
    final.email === 'x@x.com' && final.zona_id === 'z-1'
    && final.origen === 'RESERVA_EXPRESS_MOBILE'
    && final.creado_por_id === 'u1' && final.tipo_movimiento === 'ABONO_DIRECTO')
}

console.log('\n─── Faltan DOS columnas (propina y origen): el bucle quita una por una ───')
{
  const sb = sbFalso(['propina', 'origen'])
  const r = await insertar_verificado(sb, ADMIN, 'cobros', PAYLOAD, CLAVES_LEGACY)
  const final = sb.intentos[sb.intentos.length - 1]
  check('El insert termina OK', r.ok === true, r)
  check('Se quitaron propina y origen, nada más',
    !('propina' in final) && !('origen' in final) && final.email === 'x@x.com' && final.creado_por_id === 'u1')
}

console.log('\n─── Error SIN nombre de columna: cae al respaldo legacy de siempre ───')
{
  const sb = {
    intentos: [],
    from: () => ({
      insert: (payload) => ({
        select: async () => {
          sb.intentos.push(Object.assign({}, payload))
          // primer intento (payload completo) truena sin nombre; el subconjunto
          // legacy (sin email/propina) pasa.
          if ('email' in payload) return { data: null, error: { code: 'PGRST204', message: 'columna desconocida' } }
          return { data: [payload], error: null }
        },
      }),
    }),
  }
  const r = await insertar_verificado(sb, ADMIN, 'cobros', PAYLOAD, CLAVES_LEGACY)
  const final = sb.intentos[sb.intentos.length - 1]
  check('El insert termina OK con el subconjunto legacy', r.ok === true && !('email' in final) && !('propina' in final))
}

console.log('\n─── Las vistas de Reserva Exprés capturan y envían la propina ───')
{
  const cobrar = readFileSync(new URL('../src/components/reservaexpress/cobrarreserva.jsx', import.meta.url), 'utf8')
  check('"Registrar Cobro": input de Propina ($ MXN) presente',
    /Propina \(\$ MXN\)/.test(cobrar) && /setpropina/.test(cobrar))
  check('"Registrar Cobro": la propina viaja en registrar({...})',
    /registrar\(\{[\s\S]{0,200}propina,/.test(cobrar))
  check('"Registrar Cobro": se limpia al elegir reserva y al cambiar',
    (cobrar.match(/setpropina\(''\)/g) || []).length >= 2)

  const escritura = readFileSync(new URL('../src/hooks/usecobrosescritura.js', import.meta.url), 'utf8')
  check('usecobrosescritura: el payload del cobro lleva propina (independiente del monto)',
    /propina: redondear_dinero\(Math\.max\(0, parseFloat\(datos\.propina\) \|\| 0\)\)/.test(escritura))
  const legacyMatch = /claves_legacy_cobro = \[([^\]]*)\]/.exec(escritura)
  check('usecobrosescritura: propina FUERA de claves_legacy_cobro (compat con base sin migrar)',
    !!legacyMatch && !/propina/.test(legacyMatch[1]))

  const form = readFileSync(new URL('../src/components/reservaexpress/formularioexpress.jsx', import.meta.url), 'utf8')
  check('"Nueva Reserva": input de Propina ($ MXN) presente (estado d.propina)',
    /Propina \(\$ MXN\)/.test(form) && /d\.propina/.test(form) && /propina: ''/.test(form))

  const hook = readFileSync(new URL('../src/hooks/usereservaexpress.js', import.meta.url), 'utf8')
  check('"Nueva Reserva": al crear con propina > 0 inserta su fila en cobros (monto 0, folio de la reserva)',
    /insertar_directo\('cobros',[\s\S]{0,400}monto: 0, propina: propinacrear/.test(hook)
    && /folio: String\(nuevoid\)/.test(hook))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
