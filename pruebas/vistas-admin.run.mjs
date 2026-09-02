// ═══════════════════════════════════════════════════════════════════
// vistas-admin.run.mjs — corre el banco de pruebas de render.
//
// LO HACE DOS VECES, y esa es la parte importante.
//
// VITE_ESCRITURA_ADMIN es una constante de COMPILACION: con la bandera
// apagada el bundler elimina el codigo de escritura, asi que los botones
// nuevos, la columna de acciones y el modal NO EXISTEN en ese bundle y el
// banco no los renderiza nunca. Probar solo ese lado deja sin cubrir
// justamente el codigo que se ejecutara en produccion cuando se encienda la
// bandera — el mismo punto ciego que dejo pasar "Miniatura is not defined".
//
// Asi que se compila y se monta cada vista en los DOS modos:
//   · lectura   (VITE_ESCRITURA_ADMIN=false) — lo que hay hoy en produccion
//   · escritura (VITE_ESCRITURA_ADMIN=true)  — lo que habra al encenderla
// ═══════════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process'

global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
global.window = { localStorage: global.localStorage, addEventListener() {}, removeEventListener() {} }

const modos = [
  { nombre: 'lectura', flag: 'false', dir: 'pruebas/out-lectura' },
  { nombre: 'escritura', flag: 'true', dir: 'pruebas/out-escritura' },
]

let fallos = 0
let probadas = 0

for (const modo of modos) {
  console.log('\n── modo ' + modo.nombre.toUpperCase() + ' (VITE_ESCRITURA_ADMIN=' + modo.flag + ') ──')

  // Las variables ya presentes en el entorno GANAN sobre las de .env, que es
  // justo lo que hace falta para forzar cada modo sin tocar el archivo.
  const build = spawnSync(
    'npx',
    ['vite', 'build', '--ssr', 'pruebas/vistas-admin.jsx', '--outDir', modo.dir, '--logLevel', 'error'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, VITE_ESCRITURA_ADMIN: modo.flag },
    }
  )
  if (build.status !== 0) {
    console.log(' FALLA la compilacion en modo ' + modo.nombre)
    fallos++
    continue
  }

  const { vistas, render, escritura_activa } = await import('../' + modo.dir + '/vistas-admin.js')

  // Comprobacion de la propia prueba: si la bandera no llego al bundle, el
  // modo escritura estaria repitiendo el de lectura sin avisar.
  if (escritura_activa !== (modo.flag === 'true')) {
    console.log(
      ' FALLA la bandera no llego al bundle: se esperaba ' + modo.flag +
      ' y el bundle dice ' + escritura_activa
    )
    fallos++
    continue
  }

  for (const [nombre, Comp] of Object.entries(vistas)) {
    probadas++
    try {
      const h = render(Comp)
      console.log('  ok   ' + nombre.padEnd(20) + ' (' + h.length + ' chars)')
    } catch (e) {
      fallos++
      console.log(' FALLA ' + nombre.padEnd(20) + ' -> ' + e.message)
    }
  }
}

console.log('\nrenders probados: ' + probadas + ' | fallos: ' + fallos)
console.log(fallos === 0 ? 'TODAS RENDERIZAN EN LOS DOS MODOS' : 'HAY VISTAS ROTAS')
process.exit(fallos === 0 ? 0 : 1)
