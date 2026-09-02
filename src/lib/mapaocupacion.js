// ═══════════════════════════════════════════════════════════════════
// mapaocupacion.js — el estado de cada seccion en cada juego.
// espejo 1:1 de v1: setEstadoZona() (js/modules/areas-juegos.js 249-261) y la
// validacion dura de toggleBloqueoSecRes() (js/20-editor-mapa.js).
//
// LA OCUPACION NO SE GUARDA, SE CALCULA. Un contador habria que decrementarlo
// al cancelar, al eliminar, al editar los lugares y al vencer un apartado;
// olvidar uno deja lugares fantasma. Sumando las reservas activas no hay nada
// que recordar: borrar una libera sus lugares sola. Por eso este archivo NO
// escribe ocupacion en ningun sitio — solo el estado libre/reservada/bloqueada
// de la seccion, que si es una decision y no una consecuencia.
//
// `zona_juego_estado` lleva una fila por (juego, zona). Se escribe con UPSERT
// porque la fila puede no existir todavia: una seccion que nunca se toco no
// tiene registro, y su estado es 'libre' por omision.
// ═══════════════════════════════════════════════════════════════════

import { motivo_bloqueo, registrar_movimiento } from './escritura'

export const estados_zona = ['libre', 'reservada', 'bloqueada']

// Estado VIVO de una seccion. Sin fila en zona_juego_estado el estado es
// 'libre': asi nace toda seccion que nadie ha tocado.
export function estado_vivo(areasestados, juegoid, zonaid) {
  const deljuego = (areasestados || {})[String(juegoid)] || {}
  return deljuego[String(zonaid)] || 'libre'
}

// ¿Se puede bloquear? NUNCA una seccion reservada: dejaria al cliente con una
// reserva sobre algo fuera de venta. La v1 lo valida contra el estado vivo y
// no contra el del render, que puede estar viejo — y aqui igual.
export function puede_bloquearse(areasestados, juegoid, zonaid) {
  return estado_vivo(areasestados, juegoid, zonaid) !== 'reservada'
}

// El upsert devuelve { ok, motivo, error }. NUNCA lanza.
//
// Esto se VERIFICA con .select() como todo lo demas. En la v1 era
// fire-and-forget: si el upsert no llegaba —red, RLS, conflicto— el error
// moria en la consola, el admin veia "reserva eliminada" y la zona se quedaba
// ocupada para siempre sin nadie a quien pertenecer. Asi nacian las zonas
// huerfanas (ver limpiar-zonas-huerfanas.sql en la v1).
export async function set_estado_zona(sb, usuario, juegoid, zonaid, estado) {
  const bloqueo = motivo_bloqueo(usuario, 'zona_juego_estado')
  if (bloqueo) return { ok: false, motivo: bloqueo }
  if (estados_zona.indexOf(estado) < 0) return { ok: false, motivo: 'estado-invalido' }

  const res = await sb
    .from('zona_juego_estado')
    .upsert({ juego_id: juegoid, zona_id: zonaid, estado })
    .select()
  if (res.error) {
    console.error('escritura/upsert en zona_juego_estado:', res.error)
    return { ok: false, motivo: 'error', error: res.error }
  }
  if (!(res.data || []).length) {
    console.error(
      'escritura/upsert en zona_juego_estado: 0 filas afectadas ' +
      '(¿política RLS, o falta la clave única (juego_id, zona_id)?)'
    )
    return { ok: false, motivo: 'sin_filas' }
  }
  return { ok: true, filas: res.data.length, estado }
}

// Bloquear o liberar, con su rastro. El movimiento se registra TAMBIEN cuando
// se rechaza: un intento de bloquear una seccion reservada es justo lo que hay
// que poder revisar despues, y la v1 lo deja anotado igual.
export async function alternar_bloqueo(sb, usuario, { juegoid, zonaid, nombre, areasestados }) {
  const vivo = estado_vivo(areasestados, juegoid, zonaid)
  if (vivo === 'reservada') {
    registrar_movimiento(sb, {
      tipo: 'Bloqueo',
      desc: 'Intento de bloqueo RECHAZADO (sección reservada) · ' + (nombre || zonaid),
      ref: zonaid,
      usuario: usuario ? usuario.nombre : '—',
    })
    return { ok: false, motivo: 'reservada' }
  }

  const siguiente = vivo === 'bloqueada' ? 'libre' : 'bloqueada'
  const res = await set_estado_zona(sb, usuario, juegoid, zonaid, siguiente)
  if (!res.ok) return res

  const etiqueta = (siguiente === 'bloqueada' ? 'Bloquear ' : 'Desbloquear ') + (nombre || zonaid)
  registrar_movimiento(sb, {
    tipo: siguiente === 'bloqueada' ? 'Bloqueo' : 'Liberar',
    desc: etiqueta,
    ref: nombre || zonaid,
    usuario: usuario ? usuario.nombre : '—',
  })
  return { ok: true, estado: siguiente, etiqueta }
}
