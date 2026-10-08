// ═══════════════════════════════════════════════════════════════════
// sin-columnas-faltantes.run.mjs — insertar_directo()/actualizar_directo()
// (src/hooks/usereservaexpress.js) NO deben perder metadatos cuando
// Supabase rechaza el escritura por una columna ausente en ESE entorno
// (migración pendiente, PGRST204: "Could not find the 'X' column…").
//
// BUG REAL (02 oct 2026): el único respaldo era reintentar con un
// subconjunto fijo de "claves legacy" — chico y desactualizado: le
// faltaban zona_id/adultos/ninos/consumo_monto/extra_monto/cliente_id/
// tipo_comida (prospecto) y zona_id/adultos/ninos/saldo_consumo/
// cotizacion_id (reserva). Cualquier columna ausente tiraba TODOS esos
// campos de un tirón, no solo la que de verdad faltaba — un prospecto de
// Reserva Exprés nacía sin vendedora/adultos/niños/cliente_id aunque esos
// campos SÍ existieran en la base; simplemente nunca viajaban en el
// reintento.
//
// Arreglo: _columna_faltante() lee el nombre EXACTO de la columna del
// mensaje de error y el reintento solo quita ESA — todo lo demás se
// conserva siempre, sin mantener una lista a mano.
//
// Supabase real simulado con un `sb.from` falso que rechaza el PRIMER
// intento con el error real de Postgrest y acepta el segundo — mismo
// patrón de prueba que cascadas.run.mjs (vm/ssr, sin tocar la base).
//
// Se corre con:  node pruebas/sin-columnas-faltantes.run.mjs
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
const { sb, insertar_directo, actualizar_directo, _columna_faltante } = await import('./out-cascadas/cascadas.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

// Error REAL de Postgrest (PGRST204) para una columna ausente.
function errorColumnaAusente(col) {
  return { code: 'PGRST204', message: "Could not find the '" + col + "' column of 'pipeline_prospectos' in the schema cache" }
}

// Simula `sb.from(tabla)`: el PRIMER insert/update con el payload COMPLETO
// falla con la columna indicada; cualquier intento SIN esa columna ya
// presente succeeds y se captura para inspección.
function sbFalso(colQueFalta) {
  const capturados = []
  return {
    from: (tabla) => ({
      insert: (payload) => ({
        select: async () => {
          if (colQueFalta in payload) return { data: null, error: errorColumnaAusente(colQueFalta) }
          capturados.push({ tabla, payload })
          return { data: [payload], error: null }
        },
      }),
      update: (payload) => ({
        eq: () => ({
          select: async () => {
            if (colQueFalta in payload) return { data: null, error: errorColumnaAusente(colQueFalta) }
            capturados.push({ tabla, payload })
            return { data: [payload], error: null }
          },
        }),
      }),
    }),
    capturados,
  }
}

console.log('─── _columna_faltante(): lee el nombre real del mensaje de Postgrest ───')
{
  check('"Could not find the \'X\' column…" (PGRST204, el mensaje real)',
    _columna_faltante(errorColumnaAusente('tipo_comida')) === 'tipo_comida')
  check('Variante "column \\"X\\" does not exist"', _columna_faltante({ message: 'column "cliente_id" does not exist' }) === 'cliente_id')
  check('Sin error → null', _columna_faltante(null) === null)
  check('Error de otro tipo (sin nombre de columna) → null', _columna_faltante({ message: 'permission denied' }) === null)
}

console.log('\n─── insertar_directo(): un prospecto SIN columna "tipo_comida" en el entorno ───')
{
  const falso = sbFalso('tipo_comida')
  const sbOrig = sb.from
  sb.from = falso.from

  const payloadCompleto = {
    id: 'pp-test-1', folio: 'PROS-TEST', nombre: 'CLIENTE PRUEBA', email: 'x@x.com',
    zona: 'Terraza Izquierda 3', zona_id: 'ti-3', serie: '', monto: 9500, etapa: 'reserva_momentanea',
    badge: 'Reserva Exprés', notas: '', vendedora: 'MELI', juego: 'J-TEST', tel: '6621234567',
    adultos: 20, ninos: 5, descuento: 0, consumo_monto: 500, extra_monto: 200,
    adulto_extra_precio: 150, nino_extra_precio: 80, cliente_id: 42,
    tipo_comida: 'discada', etapa_cambiada_en: '2026-10-02T12:00:00.000Z',
  }
  const claveslegacy = ['id', 'nombre', 'zona', 'serie', 'monto', 'etapa', 'badge', 'notas', 'vendedora', 'juego', 'tel']
  const res = await insertar_directo('pipeline_prospectos', payloadCompleto, claveslegacy)
  const guardado = falso.capturados[0] && falso.capturados[0].payload

  check('El insert terminó OK (tras el reintento automático)', res.ok === true, res)
  check('SOLO se quitó "tipo_comida" — el resto de los metadatos SIGUEN en el payload guardado',
    guardado && !('tipo_comida' in guardado)
    && guardado.vendedora === 'MELI' && guardado.adultos === 20 && guardado.ninos === 5
    && guardado.cliente_id === 42 && guardado.consumo_monto === 500 && guardado.extra_monto === 200
    && guardado.zona_id === 'ti-3' && guardado.email === 'x@x.com',
    guardado)

  sb.from = sbOrig
}

console.log('\n─── insertar_directo(): una reserva SIN columna "cotizacion_id" en el entorno ───')
{
  const falso = sbFalso('cotizacion_id')
  const sbOrig = sb.from
  sb.from = falso.from

  const payloadReserva = {
    id: 'NRJ-ADM-00999', cliente: 'CLIENTE PRUEBA', email: 'x@x.com', tel: '6621234567',
    zona: 'Terraza Izquierda 3', zona_id: 'ti-3', juego: 'vs Prueba', juego_id: 'J-TEST',
    monto: 9500, descuento_monto: 0, monto_pagado: 0, pago: 'Sin pago', metodo: 'Tarjeta',
    personas: 25, estado: 'Confirmada', estado_pago: 'pendiente',
    adultos: 20, ninos: 5, saldo_consumo: 500, cotizacion_id: null,
  }
  const claveslegacyReserva = ['id', 'cliente', 'email', 'tel', 'zona', 'juego', 'juego_id', 'monto',
    'descuento_monto', 'monto_pagado', 'pago', 'metodo', 'personas', 'estado', 'estado_pago']
  const res = await insertar_directo('reservas', payloadReserva, claveslegacyReserva)
  const guardado = falso.capturados[0] && falso.capturados[0].payload

  check('El insert de la reserva terminó OK', res.ok === true, res)
  check('SOLO se quitó "cotizacion_id" — adultos/ninos/saldo_consumo/zona_id SIGUEN en el payload',
    guardado && !('cotizacion_id' in guardado)
    && guardado.adultos === 20 && guardado.ninos === 5
    && guardado.saldo_consumo === 500 && guardado.zona_id === 'ti-3',
    guardado)

  sb.from = sbOrig
}

console.log('\n─── actualizar_directo(): el mismo criterio al EDITAR (no solo al crear) ───')
{
  const falso = sbFalso('adulto_extra_precio')
  const sbOrig = sb.from
  sb.from = falso.from

  const cambios = { nombre: 'CLIENTE EDITADO', vendedora: 'FER', adultos: 18, ninos: 3, adulto_extra_precio: 200 }
  const res = await actualizar_directo('pipeline_prospectos', cambios, 'pp-existente', ['nombre', 'vendedora'])
  const guardado = falso.capturados[0] && falso.capturados[0].payload

  check('El update terminó OK', res.ok === true, res)
  check('SOLO se quitó "adulto_extra_precio" — vendedora/adultos/ninos SIGUEN en el payload de la edición',
    guardado && !('adulto_extra_precio' in guardado)
    && guardado.vendedora === 'FER' && guardado.adultos === 18 && guardado.ninos === 3,
    guardado)

  sb.from = sbOrig
}

console.log('\n─── Si el mensaje no trae el nombre de columna, cae al respaldo de "claves legacy" ───')
{
  const falso = {
    from: (tabla) => ({
      insert: (payload) => ({
        select: async () => {
          // Error de columna SIN nombre identificable en el mensaje.
          if (Object.keys(payload).length > 3) return { data: null, error: { code: 'PGRST204', message: 'column mismatch' } }
          falso.capturados = [{ tabla, payload }]
          return { data: [payload], error: null }
        },
      }),
    }),
    capturados: [],
  }
  const sbOrig = sb.from
  sb.from = falso.from
  const res = await insertar_directo('pipeline_prospectos', { id: 'pp-x', nombre: 'X', vendedora: 'Y', extra: 'Z' }, ['id', 'nombre'])
  check('Con el respaldo de claves legacy, el insert igual termina OK', res.ok === true, res)
  check('…y guarda SOLO ese subconjunto (comportamiento de siempre, intacto)',
    JSON.stringify(falso.capturados[0].payload) === JSON.stringify({ id: 'pp-x', nombre: 'X' }))
  sb.from = sbOrig
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
