// ═══════════════════════════════════════════════════════════════════
// biometria.run.mjs — sesión fija + candado de Face ID/Touch ID
// (02 oct 2026, /reserva-express). Ver el modelo de seguridad completo
// en la cabecera de src/lib/biometria.js: candado LOCAL sobre la sesión
// de Supabase ya persistida, no un segundo factor verificado por servidor
// (esa es la razón de que todo aquí se pruebe contra localStorage y
// WebAuthn simulados, nunca contra una base real).
//
// Shims de navegador ANTES de importar nada — mismo criterio que
// vistas-admin.run.mjs (global.window/localStorage) — extendido con
// navigator.credentials (WebAuthn) y window.PublicKeyCredential.
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'

function fabricar_localstorage() {
  const datos = {}
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    removeItem: (k) => { delete datos[k] },
    _volcado: () => ({ ...datos }),
  }
}

// `comportamiento` es MUTABLE a propósito: cada bloque de prueba cambia
// cómo responde el autenticador simulado (éxito, cancelado, no soportado)
// sin tener que reconstruir todo el shim de ventana.
const comportamiento = { soportado: true, crear: 'exito', obtener: 'exito' }

function credencial_falsa(tamano) {
  return { rawId: new Uint8Array(tamano || 16).fill(7) }
}

global.window = {
  localStorage: fabricar_localstorage(),
  crypto: globalThis.crypto,
  location: { hostname: 'reservaestadio.com' },
  PublicKeyCredential: {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => comportamiento.soportado,
  },
}
// Node 21+ ya define `navigator` como getter global de solo lectura
// (navigator.userAgent) — hay que forzar la propiedad en vez de asignarla.
Object.defineProperty(global, 'navigator', {
  configurable: true,
  writable: true,
  value: {
    credentials: {
      create: async () => {
        if (comportamiento.crear === 'cancelado') { const e = new Error('cancelado'); e.name = 'NotAllowedError'; throw e }
        if (comportamiento.crear === 'error') throw new Error('fallo técnico')
        return credencial_falsa()
      },
      get: async () => {
        if (comportamiento.obtener === 'cancelado') { const e = new Error('cancelado'); e.name = 'NotAllowedError'; throw e }
        if (comportamiento.obtener === 'error') throw new Error('fallo técnico')
        return credencial_falsa()
      },
    },
  },
})

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/biometria-puente.js', '--outDir', 'pruebas/out-biometria', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true }
)
if (build.status !== 0) {
  console.log('FALLA la compilación del puente de pruebas')
  process.exit(1)
}
const {
  sb, biometria_disponible, biometria_habilitada, habilitar_biometria,
  desbloquear_biometria, deshabilitar_biometria,
} = await import('./out-biometria/biometria-puente.js')

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── 1) Sesión fija: persistSession/autoRefreshToken explícitos ───')
{
  check('persistSession: true', sb.auth.persistSession === true)
  check('autoRefreshToken: true', sb.auth.autoRefreshToken === true)
  check('storage resuelto (no se cae por `window.localStorage` a secas bajo SSR)', !!sb.auth.storage)
}

const USUARIO = { id: 7, email: 'fer@naranjeros.mx', nombre: 'Fer Vendedora' }

console.log('\n─── 2) Habilitar Face ID/Touch ID (registro) ───')
{
  comportamiento.crear = 'exito'
  check('Antes de habilitar: no está habilitada para esta cuenta', !biometria_habilitada(USUARIO.email))
  const r = await habilitar_biometria(USUARIO)
  check('habilitar_biometria() regresa ok:true', r.ok === true, r)
  check('Después de habilitar: biometria_habilitada() ya la ve', biometria_habilitada(USUARIO.email))
  check('Queda SOLO en localStorage (no se tocó Supabase)', typeof window.localStorage.getItem('re_biometria_' + USUARIO.email) === 'string')

  const otracuenta = { id: 9, email: 'otra@naranjeros.mx', nombre: 'Otra' }
  check('Una cuenta DISTINTA en el mismo dispositivo no hereda la credencial', !biometria_habilitada(otracuenta.email))
}

console.log('\n─── 3) Desbloquear (ciclo de vida normal) ───')
{
  comportamiento.obtener = 'exito'
  const r = await desbloquear_biometria(USUARIO.email)
  check('desbloquear_biometria() con la credencial correcta regresa ok:true', r.ok === true, r)
}

console.log('\n─── 4) Fallback de autenticación: cancelado / sin soporte / sin habilitar ───')
{
  comportamiento.obtener = 'cancelado'
  const rCancel = await desbloquear_biometria(USUARIO.email)
  check('Cancelar el diálogo del sistema → ok:false, motivo "cancelado" (no "error")',
    rCancel.ok === false && rCancel.motivo === 'cancelado', rCancel)

  comportamiento.obtener = 'exito'
  comportamiento.soportado = false
  const rSinSoporte = await desbloquear_biometria(USUARIO.email)
  check('Sin soporte de plataforma → ok:false, motivo "no_soportado"',
    rSinSoporte.ok === false && rSinSoporte.motivo === 'no_soportado', rSinSoporte)
  comportamiento.soportado = true

  const rSinHabilitar = await desbloquear_biometria('nadie@naranjeros.mx')
  check('Cuenta sin credencial registrada → ok:false, motivo "no_habilitada"',
    rSinHabilitar.ok === false && rSinHabilitar.motivo === 'no_habilitada', rSinHabilitar)
}

console.log('\n─── 5) Cancelar el REGISTRO (habilitar) también es un "no, gracias", no un error ───')
{
  comportamiento.crear = 'cancelado'
  const r = await habilitar_biometria({ id: 11, email: 'nueva@naranjeros.mx', nombre: 'Nueva' })
  check('habilitar_biometria() cancelado → ok:false, motivo "cancelado"', r.ok === false && r.motivo === 'cancelado', r)
  check('No quedó credencial a medias guardada', !biometria_habilitada('nueva@naranjeros.mx'))
  comportamiento.crear = 'exito'
}

console.log('\n─── 6) "Cerrar sesión" manual apaga el candado — deshabilitar_biometria() ───')
{
  check('Sigue habilitada antes de cerrar sesión', biometria_habilitada(USUARIO.email))
  deshabilitar_biometria(USUARIO.email)
  check('Tras deshabilitar_biometria(): ya no está habilitada', !biometria_habilitada(USUARIO.email))
  const r = await desbloquear_biometria(USUARIO.email)
  check('Reabrir sin credencial exige autenticación normal (motivo "no_habilitada", no un desbloqueo fantasma)',
    r.ok === false && r.motivo === 'no_habilitada', r)
}

console.log('\n─── 7) Disponibilidad reportada fielmente ───')
{
  comportamiento.soportado = true
  check('biometria_disponible() === true cuando el autenticador de plataforma existe', await biometria_disponible())
  comportamiento.soportado = false
  check('biometria_disponible() === false cuando no existe', !(await biometria_disponible()))
  comportamiento.soportado = true
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
