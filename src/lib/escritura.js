// ═══════════════════════════════════════════════════════════════════
// escritura.js — infraestructura de ESCRITURA del panel (Fase 2).
// espejo de v1: _TABLA_MODULO_EDICION y _instalarGuardiaEscritura()
// (js/modules/utils.js), sbInsertCompat/sbUpdateCompat (js/00-conexion.js)
// y logMov() (js/22-usuarios-clientes.js).
//
// TRES CANDADOS, en este orden:
//   1. la bandera VITE_ESCRITURA_ADMIN — apaga toda escritura de un golpe
//   2. el permiso del rol sobre el modulo dueño de la tabla
//   3. las politicas RLS de la base, que son la AUTORIDAD FINAL: los dos
//      candados de arriba son de la interfaz y alguien podria saltarselos
//      manipulando el JS; la base no.
//
// Toda escritura se VERIFICA: se pide .select() de vuelta y se cuentan las
// filas. Cero filas sin error es el sintoma tipico de una politica RLS que
// bloqueo en silencio — la v1 lo documenta y aqui se trata como error, no
// como exito.
// ═══════════════════════════════════════════════════════════════════

import { puedo_acceder } from './permisos'

export const escritura_admin = import.meta.env.VITE_ESCRITURA_ADMIN === 'true'

// Que modulos pueden escribir en cada tabla. Basta nivel 'editar' en UNO:
// registrar un abono desde el Pipeline inserta en `cobros`, asi que una
// Vendedora con pipeline:'editar' escribe ahi aunque no tenga la seccion
// Cobros en su menu.
// Modulos cuyos flujos APARTAN O LIBERAN una seccion: generar la reserva desde
// una tarjeta, editarla o borrarla, vender un palco, o bloquear zonas desde el
// editor del mapa. Todos ellos tienen que poder escribir `zona_juego_estado`,
// porque crear la reserva y marcar su seccion son DOS MITADES DEL MISMO ACTO.
//
// `cobros` NO esta aqui a proposito, aunque si escribe en `reservas`: lo unico
// que toca desde ahi es el SALDO de una reserva que ya existe. Registrar o
// cancelar un cobro nunca aparta ni libera una seccion, asi que darle ese
// permiso seria abrir de mas.
const modulos_estado_seccion = ['seccionesreservadas', 'pipeline', 'palcos', 'crear']

export const tabla_modulo_edicion = {
  reservas: ['seccionesreservadas', 'pipeline', 'cobros', 'palcos'],
  clientes: ['clientes'],
  cobros: ['cobros', 'pipeline'],
  // 'cotizaciones' se agrega aqui ademas de 'pipeline': convertir una
  // cotizacion en prospecto (cotizacion_a_prospecto_payload, en
  // usecotizacionesescritura.js) inserta en esta misma tabla, y es una accion
  // del modulo Cotizaciones — misma logica que 'cobros' o 'palcos' aqui abajo
  // en `reservas`: una Vendedora con cotizaciones:editar pero sin ver Pipeline
  // en su menu debe poder enviar SU cotizacion al tablero de todos modos.
  pipeline_prospectos: ['pipeline', 'cotizaciones'],
  cotizaciones: ['cotizaciones'],
  descuentos_volumen: ['descuentos'],
  // AGREGADA AQUI, no la trae la v1. Su _TABLA_MODULO_EDICION no declara
  // `zona_juego_estado`, asi que la guardia por tabla la deja pasar sin mirar
  // el rol: bloquear una seccion —sacarla de venta— quedaba al alcance de
  // cualquier cuenta con sesion.
  //
  // CORREGIDA: la lista era ['seccionesreservadas','crear','palcos'] y dejaba
  // fuera 'pipeline'. Generar la reserva desde una tarjeta escribe en
  // `reservas` (permitido por pipeline) y despues en `zona_juego_estado`
  // (bloqueado), asi que un perfil con pipeline:editar y sin
  // seccionesreservadas:editar creaba la reserva y NO apartaba la seccion:
  // quedaba vendida y libre a la vez.
  zona_juego_estado: modulos_estado_seccion,
}

// motivo por el que una escritura no procede, o null si puede proceder.
export function motivo_bloqueo(usuario, tabla) {
  if (!escritura_admin) return 'apagada'
  const modulos = tabla_modulo_edicion[tabla]
  // una tabla sin dueño declarado no se escribe desde el panel.
  if (!modulos) return 'sin_permiso'
  return modulos.some((m) => puedo_acceder(usuario, m, 'editar')) ? null : 'sin_permiso'
}

export const mensajes_bloqueo = {
  apagada: '🔒 La escritura del panel está desactivada en esta versión.',
  sin_permiso: '⛔ No tienes permisos para realizar ediciones (modo solo lectura).',
}

// PGRST204 = columna inexistente. La base puede ir una migracion atras.
export function es_error_columna(error) {
  return !!error && (error.code === 'PGRST204' || /column|columna/i.test(error.message || ''))
}

export function subset_legacy(payload, claves) {
  if (Array.isArray(payload)) return payload.map((p) => subset_legacy(p, claves))
  const out = {}
  claves.forEach((k) => {
    if (k in payload) out[k] = payload[k]
  })
  return out
}

// ── escrituras verificadas ──────────────────────────────────────
// Devuelven { ok, filas, error, motivo }. Nunca lanzan: quien llama decide
// el mensaje.

// Interpreta la respuesta de supabase con el criterio de la v1: error
// explicito, o cero filas devueltas (que es RLS bloqueando en silencio).
function interpretar(res, operacion, tabla) {
  if (res.error) {
    console.error('escritura/' + operacion + ' en ' + tabla + ':', res.error)
    return { ok: false, error: res.error, motivo: 'error' }
  }
  const filas = (res.data || []).length
  if (!filas) {
    console.error(
      'escritura/' + operacion + ' en ' + tabla + ': 0 filas afectadas ' +
      '(¿política RLS, o id sin coincidencia?)'
    )
    return { ok: false, filas: 0, motivo: 'sin_filas' }
  }
  return { ok: true, filas, datos: res.data }
}

export async function actualizar_verificado(sb, usuario, tabla, payload, id, claveslegacy) {
  const bloqueo = motivo_bloqueo(usuario, tabla)
  if (bloqueo) return { ok: false, motivo: bloqueo }

  let res = await sb.from(tabla).update(payload).eq('id', id).select()
  // reintento con las columnas originales si la base va una migracion atras.
  if (es_error_columna(res.error) && claveslegacy && claveslegacy.length) {
    res = await sb.from(tabla).update(subset_legacy(payload, claveslegacy)).eq('id', id).select()
  }
  return interpretar(res, 'update', tabla)
}

export async function insertar_verificado(sb, usuario, tabla, payload, claveslegacy) {
  const bloqueo = motivo_bloqueo(usuario, tabla)
  if (bloqueo) return { ok: false, motivo: bloqueo }

  let res = await sb.from(tabla).insert(payload).select()
  if (es_error_columna(res.error) && claveslegacy && claveslegacy.length) {
    res = await sb.from(tabla).insert(subset_legacy(payload, claveslegacy)).select()
  }
  return interpretar(res, 'insert', tabla)
}

// El BORRADO real (no el suave). Se usa unicamente donde el negocio lo pide:
// una reservacion eliminada desaparece de la base. Todo lo demas —cobros,
// prospectos— se cancela con estado, para conservar la auditoria.
// Verificado igual que los otros: cero filas es fallo, no exito.
export async function borrar_verificado(sb, usuario, tabla, id) {
  const bloqueo = motivo_bloqueo(usuario, tabla)
  if (bloqueo) return { ok: false, motivo: bloqueo }
  const res = await sb.from(tabla).delete().eq('id', id).select()
  return interpretar(res, 'delete', tabla)
}

// ── bitacora ────────────────────────────────────────────────────
// espejo de logMov(): cada escritura deja rastro en `movimientos`. Va en
// segundo plano a proposito — que la bitacora falle no debe deshacer ni
// bloquear la accion que ya se guardo.
export function registrar_movimiento(sb, { tipo, desc, ref, monto, usuario }) {
  return sb
    .from('movimientos')
    .insert({
      tipo,
      descripcion: desc,
      ref: ref || '—',
      usuario: usuario || '—',
      monto: monto || null,
    })
    .then(({ error }) => {
      if (error) console.error('No se pudo registrar el movimiento:', error)
      return !error
    })
}
