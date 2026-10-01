// ═══════════════════════════════════════════════════════════════════
// disponibilidad-bidireccional.run.mjs — selección bidireccional
// zona↔juego en /reserva-express (01 oct 2026).
//
// disponibilidad_juegos_para_zona() (src/lib/mapaocupacion.js) es la
// contraparte INVERSA de disponibilidad_zonas_en_vivo(): dado una zona, dice
// en cuáles juegos sigue libre — usada por formularioexpress.jsx cuando el
// usuario elige la zona ANTES que el juego (#selectZona ya no nace
// deshabilitado). Las tres fuentes y el criterio de "ocupada" deben ser
// EXACTAMENTE los mismos que la función original, solo invertidos: un
// bloqueo manual en zona_juego_estado, una reserva activa, o un prospecto
// con esa zona ya asignada (salvo 'descartado') — y para un palco compartido,
// la capacidad, nunca la etiqueta.
//
// Mismo método que calc-total-prospecto.run.mjs: compila el puente con Vite
// (resuelve los imports extensionless de src/lib/*) y corre las cuentas
// contra el bundle real.
//
// Se corre con:  node pruebas/disponibilidad-bidireccional.run.mjs
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
const { disponibilidad_juegos_para_zona, disponibilidad_zonas_en_vivo } = await import('./out-cascadas/cascadas.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

// Cliente de Supabase FALSO, de solo lectura: cada tabla es un arreglo fijo,
// .eq() filtra en memoria. Ninguna prueba toca la base real.
function sb_lectura_falsa(tablas) {
  return {
    from(tabla) {
      const filtros = {}
      const q = {
        select() { return q },
        eq(col, val) { filtros[col] = val; return q },
        then(res, rej) {
          const filas = (tablas[tabla] || []).filter((f) =>
            Object.entries(filtros).every(([k, v]) => String(f[k]) === String(v))
          )
          return Promise.resolve({ data: filas, error: null }).then(res, rej)
        },
      }
      return q
    },
  }
}

console.log('─── Zona exclusiva: las tres fuentes de ocupación, invertidas por juego ───')
{
  const sb = sb_lectura_falsa({
    zona_juego_estado: [{ zona_id: 'z1', juego_id: 'j2', estado: 'bloqueada' }],
    reservas: [{ zona_id: 'z1', juego_id: 'j3', estado: 'activa', personas: 4, adultos: 4, ninos: 0 }],
    pipeline_prospectos: [{ zona_id: 'z1', juego: 'j1', etapa: 'cotizado' }],
  })
  const area = { id: 'z1', escompartida: false }
  const juegos = [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }, { id: 'j4' }]
  const r = await disponibilidad_juegos_para_zona(sb, 'z1', area, juegos)

  check('j1 ocupada por un prospecto con esta zona ya asignada', r.j1.ocupada === true, r.j1)
  check('j2 ocupada por bloqueo MANUAL en zona_juego_estado', r.j2.ocupada === true, r.j2)
  check('j3 ocupada por una reserva ACTIVA', r.j3.ocupada === true, r.j3)
  check('j4 LIBRE: ninguna de las tres fuentes la menciona', r.j4.ocupada === false, r.j4)
  check('Zona exclusiva: ocupados/capacidad/libres no aplican (null)',
    r.j4.escompartida === false && r.j4.ocupados === null && r.j4.capacidad === null && r.j4.libres === null, r.j4)
}

console.log('\n─── Un prospecto "descartado" NO cuenta como ocupación ───')
{
  const sb = sb_lectura_falsa({
    zona_juego_estado: [], reservas: [],
    pipeline_prospectos: [{ zona_id: 'z1', juego: 'j1', etapa: 'descartado' }],
  })
  const r = await disponibilidad_juegos_para_zona(sb, 'z1', { id: 'z1', escompartida: false }, [{ id: 'j1' }])
  check('j1 sigue libre: el prospecto se descartó', r.j1.ocupada === false, r.j1)
}

console.log('\n─── Una reserva CANCELADA tampoco cuenta ───')
{
  const sb = sb_lectura_falsa({
    zona_juego_estado: [],
    reservas: [{ zona_id: 'z1', juego_id: 'j1', estado: 'Cancelada', personas: 4, adultos: 4, ninos: 0 }],
    pipeline_prospectos: [],
  })
  const r = await disponibilidad_juegos_para_zona(sb, 'z1', { id: 'z1', escompartida: false }, [{ id: 'j1' }])
  check('j1 sigue libre: la reserva está cancelada', r.j1.ocupada === false, r.j1)
}

console.log('\n─── Palco compartido: decide la CAPACIDAD, nunca la etiqueta guardada ───')
{
  const area = { id: 'pz', escompartida: true, capacidadmaxima: 10 }
  const sb = sb_lectura_falsa({
    zona_juego_estado: [],
    reservas: [
      // j1: 6 adultos de 10 — queda cupo.
      { zona_id: 'pz', juego_id: 'j1', estado: 'activa', personas: 6, adultos: 6, ninos: 0 },
      // j2: 10 de 10 — agotado por capacidad, SIN ninguna fila en zona_juego_estado.
      { zona_id: 'pz', juego_id: 'j2', estado: 'activa', personas: 10, adultos: 10, ninos: 0 },
    ],
    pipeline_prospectos: [],
  })
  const r = await disponibilidad_juegos_para_zona(sb, 'pz', area, [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }])

  check('j1: con cupo — NO ocupada, y trae el desglose de lugares (4 libres de 10)',
    r.j1.ocupada === false && r.j1.escompartida === true && r.j1.capacidad === 10 &&
    r.j1.ocupados === 6 && r.j1.libres === 4, r.j1)
  check('j2: agotado por CAPACIDAD (10/10), aunque nadie lo bloqueó a mano', r.j2.ocupada === true, r.j2)
  check('j3: sin reservas — libre, capacidad completa disponible',
    r.j3.ocupada === false && r.j3.libres === 10, r.j3)
}

console.log('\n─── Un bloqueo MANUAL manda sobre un palco con cupo libre ───')
{
  const area = { id: 'pz', escompartida: true, capacidadmaxima: 10 }
  const sb = sb_lectura_falsa({
    zona_juego_estado: [{ zona_id: 'pz', juego_id: 'j1', estado: 'bloqueada' }],
    reservas: [{ zona_id: 'pz', juego_id: 'j1', estado: 'activa', personas: 2, adultos: 2, ninos: 0 }],
    pipeline_prospectos: [],
  })
  const r = await disponibilidad_juegos_para_zona(sb, 'pz', area, [{ id: 'j1' }])
  check('j1 ocupada por el bloqueo MANUAL, aunque le quede cupo real', r.j1.ocupada === true, r.j1)
}

console.log('\n─── Simetría con disponibilidad_zonas_en_vivo(): mismo dato, sentido opuesto ───')
{
  // La MISMA situación (zona z1, juego j1, bloqueada) debe leerse igual
  // consultada "por juego" (función original) que "por zona" (la nueva) —
  // son las dos caras de la misma tabla.
  const filas = {
    zona_juego_estado: [{ zona_id: 'z1', juego_id: 'j1', estado: 'bloqueada' }],
    reservas: [], pipeline_prospectos: [],
  }
  const sb = sb_lectura_falsa(filas)
  const porJuego = await disponibilidad_zonas_en_vivo(sb, 'j1', [{ id: 'z1', escompartida: false }])
  const porZona = await disponibilidad_juegos_para_zona(sb, 'z1', { id: 'z1', escompartida: false }, [{ id: 'j1' }])
  check('disponibilidad_zonas_en_vivo(j1) ve z1 ocupada', porJuego.z1.ocupada === true, porJuego)
  check('disponibilidad_juegos_para_zona(z1) ve j1 ocupada — mismo resultado, invertido',
    porZona.j1.ocupada === true, porZona)
}

console.log('\n─── Zona o área ausentes: no truena, regresa vacío ───')
{
  const sb = sb_lectura_falsa({})
  const r1 = await disponibilidad_juegos_para_zona(sb, '', { id: 'z1' }, [{ id: 'j1' }])
  const r2 = await disponibilidad_juegos_para_zona(sb, 'z1', null, [{ id: 'j1' }])
  check('Sin zonaid: {} (fail-open, igual que disponibilidad_zonas_en_vivo sin juegoid)',
    Object.keys(r1).length === 0, r1)
  check('Sin area: {} ', Object.keys(r2).length === 0, r2)
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
