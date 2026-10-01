// ═══════════════════════════════════════════════════════════════════
// biometria.js — candado de Face ID / Touch ID para /reserva-express
// (02 oct 2026), SOLO LOCAL AL DISPOSITIVO.
//
// MODELO DE SEGURIDAD — LEER ANTES DE TOCAR ESTE ARCHIVO:
// Esto NO es un segundo factor de autenticación verificado por servidor.
// Supabase sí trae un WebAuthn/passkey real (sb.auth.registerPasskey()/
// signInWithPasskey(), en @supabase/auth-js 2.112.4) que hace la ceremonia
// completa con el servidor de Supabase — PERO requiere activar "Passkeys"
// en el panel de Supabase (Authentication → Settings) de este proyecto, y
// a la fecha de este cambio esa bandera no está prendida. Se decidió a
// propósito NO usar ese camino todavía y construir en su lugar un candado
// puramente local:
//
//   · La sesión REAL sigue siendo la de Supabase (persistSession:true,
//     ver supabaseclient.js) — ese token es la única autoridad ante la
//     base de datos y las políticas RLS. Face ID/Touch ID NUNCA la crea
//     ni la reemplaza.
//   · navigator.credentials.create()/get() se usan SIN servidor detrás:
//     el challenge se genera en el navegador (no en un backend que lo
//     recuerde), así que la firma que regresa get() NO SE VERIFICA
//     criptográficamente contra nada. Lo que SÍ garantiza el navegador/SO
//     es que get() solo resuelve con éxito si el usuario pasó Face ID/
//     Touch ID/PIN del dispositivo para la credencial exacta que create()
//     generó en ESE dispositivo — eso basta para un candado de
//     conveniencia ("¿sigues siendo tú, en este teléfono?"), pero NO
//     equivale a una prueba criptográfica verificable por un tercero.
//   · Por eso vive TODO en localStorage, nunca en Supabase: no hay nada
//     que un servidor pudiera verificar aunque quisiera.
//
// Si algún día se activan los Passkeys de Supabase, este archivo se
// reemplaza por llamadas a sb.auth.registerPasskey()/signInWithPasskey() —
// no se extiende este candado local para que "parezca" más seguro de lo
// que es.
// ═══════════════════════════════════════════════════════════════════

const PREFIJO_CLAVE = 're_biometria_'

// Periodo de gracia (03 oct 2026, a pedido explícito): con uso diario, Face
// ID/Touch ID NO debe pedirse en cada apertura ni en cada recarga — solo
// cuando pasaron 7 días completos desde la última verificación exitosa (o
// nunca se verificó: alta recién habilitada cuenta como la primera). La
// marca (`ultimaVerificacionFaceid`, timestamp en ms) vive en el MISMO
// objeto local que la credencial — un solo lugar, y "deshabilitar" borra
// las dos cosas de un golpe.
export const GRACIA_MS = 7 * 24 * 60 * 60 * 1000

function clave(email) {
  return PREFIJO_CLAVE + String(email || '').trim().toLowerCase()
}

// Vacío (ambiente SSR, navegador viejo, o localStorage bloqueado) → se
// trata como "no disponible/no habilitada", nunca como error.
function leer_local(email) {
  try {
    const crudo = window.localStorage.getItem(clave(email))
    return crudo ? JSON.parse(crudo) : null
  } catch (e) {
    return null
  }
}
function escribir_local(email, datos) {
  try {
    window.localStorage.setItem(clave(email), JSON.stringify(datos))
    return true
  } catch (e) {
    return false
  }
}
function borrar_local(email) {
  try {
    window.localStorage.removeItem(clave(email))
  } catch (e) {}
}

// ¿Hay WebAuthn con autenticador de PLATAFORMA (Face ID/Touch ID/huella del
// propio teléfono, no una llave USB)? Sin esto, ni mostrar la opción.
export async function biometria_disponible() {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch (e) {
    return false
  }
}

// ¿Este dispositivo ya tiene Face ID/Touch ID habilitado para ESTE correo?
// Por correo, no global: dos cuentas distintas en el mismo teléfono no
// deben heredar la huella habilitada de la otra.
export function biometria_habilitada(email) {
  const d = leer_local(email)
  return !!(d && d.credencialId)
}

// ¿Sigue dentro del periodo de gracia de 7 días desde la última
// verificación exitosa? false también si nunca se habilitó o nunca se
// marcó ninguna verificación (sin fecha = sin gracia, se pide igual).
// `ultimaVerificacionFaceid: 0` (lo que deja expirar_verificacion_biometria()
// al cerrar sesión) cae aquí mismo: 0 es una fecha "del año 1970", así que
// Date.now() - 0 siempre es mayor a GRACIA_MS — nunca hace falta un caso
// especial para distinguir "0" de "nunca se verificó".
export function dentro_de_periodo_gracia(email) {
  const d = leer_local(email)
  if (!d || !d.credencialId || d.ultimaVerificacionFaceid == null) return false
  return Date.now() - d.ultimaVerificacionFaceid < GRACIA_MS
}

// Renueva la marca de tiempo por otros 7 días — se llama tras CUALQUIER
// verificación exitosa (habilitar por primera vez cuenta como la primera
// verificación, y cada desbloqueo la renueva). Si por lo que sea ya no
// hay credencial guardada (se deshabilitó entre medias), no hace nada.
function marcar_verificacion_exitosa(email) {
  const d = leer_local(email)
  if (!d || !d.credencialId) return
  escribir_local(email, { ...d, ultimaVerificacionFaceid: Date.now() })
}

function abuf_a_b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function b64_a_abuf(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Registra la credencial de plataforma y la guarda LOCAL. `usuario` =
// { id, email, nombre } (el perfil ya autenticado — admincontext.jsx).
// Nunca lanza: regresa { ok, motivo? }.
export async function habilitar_biometria(usuario) {
  if (!usuario || !usuario.email) return { ok: false, motivo: 'sin_usuario' }
  if (!(await biometria_disponible())) return { ok: false, motivo: 'no_soportado' }
  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32))
    const credencial = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Reserva Express', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(String(usuario.id || usuario.email)),
          name: usuario.email,
          displayName: usuario.nombre || usuario.email,
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none',
      },
    })
    if (!credencial) return { ok: false, motivo: 'cancelado' }
    // Alta = la primera verificación exitosa: arranca el reloj de 7 días
    // de una vez, para no pedir Face ID otra vez un minuto después de
    // activarlo.
    const guardado = escribir_local(usuario.email, {
      credencialId: abuf_a_b64(credencial.rawId), ultimaVerificacionFaceid: Date.now(),
    })
    if (!guardado) return { ok: false, motivo: 'sin_almacenamiento' }
    return { ok: true }
  } catch (e) {
    // NotAllowedError = el usuario canceló el diálogo del sistema (o lo
    // rechazó con Face ID) — no es un error técnico, es un "no, gracias".
    const motivo = e && e.name === 'NotAllowedError' ? 'cancelado' : 'error'
    if (motivo === 'error') console.error('habilitar_biometria:', e)
    return { ok: false, motivo, error: e }
  }
}

// Pide Face ID/Touch ID para la credencial YA registrada de este correo.
// Nunca lanza: regresa { ok, motivo? }. Ver la nota de seguridad arriba —
// esto es un candado local, no una verificación criptográfica de servidor.
export async function desbloquear_biometria(email) {
  const d = leer_local(email)
  if (!d || !d.credencialId) return { ok: false, motivo: 'no_habilitada' }
  if (!(await biometria_disponible())) return { ok: false, motivo: 'no_soportado' }
  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32))
    const credencial = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64_a_abuf(d.credencialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    if (!credencial) return { ok: false, motivo: 'cancelado' }
    marcar_verificacion_exitosa(email) // renueva los 7 días de gracia
    return { ok: true }
  } catch (e) {
    const motivo = e && e.name === 'NotAllowedError' ? 'cancelado' : 'error'
    if (motivo === 'error') console.error('desbloquear_biometria:', e)
    return { ok: false, motivo, error: e }
  }
}

// "Cerrar sesión" MANUAL (admincontext.jsx) llama esto — NO a
// deshabilitar_biometria() de abajo. Corrección del 03 oct 2026: antes el
// logout borraba la credencial COMPLETA, así que el siguiente ingreso
// volvía a ofrecer "Habilitar Face ID" como si fuera la primera vez, en
// vez de pedir el desbloqueo directo de una cuenta que ya lo tenía
// activado. Ahora solo se expira la marca de tiempo — `credencialId`
// (el WebAuthn ya registrado en este dispositivo) se CONSERVA — así que:
//   · biometria_habilitada() sigue viendo la credencial → el siguiente
//     ingreso muestra el candado de desbloqueo directo, nunca el banner
//     de "¿quieres activar Face ID?".
//   · dentro_de_periodo_gracia() da false de inmediato (timestamp 0) →
//     ese desbloqueo SÍ se exige una vez, no se regala un acceso directo
//     solo porque la credencial sigue ahí.
export function expirar_verificacion_biometria(email) {
  const d = leer_local(email)
  if (!d || !d.credencialId) return
  escribir_local(email, { ...d, ultimaVerificacionFaceid: 0 })
}

// Borra TODO (credencial + marca) — a diferencia de expirar_verificacion_
// biometria() de arriba, esto es un "apaga Face ID en este dispositivo"
// de verdad: sin esto, el siguiente ingreso vuelve a ofrecer el alta desde
// cero. Hoy no hay ningún botón en la UI que la dispare (ver
// bloqueobiometrico.jsx) — queda lista para ese control cuando se agregue,
// en vez de inventarse una desde cero.
export function deshabilitar_biometria(email) {
  borrar_local(email)
}
