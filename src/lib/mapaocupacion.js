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
// `zona_juego_estado` lleva una fila por (juego, zona), y la fila puede no
// existir todavia: una seccion que nunca se toco no tiene registro, y su
// estado es 'libre' por omision.
//
// POR ESO NO SE USA UPSERT. Un upsert sin `onConflict` resuelve el conflicto
// contra la CLAVE PRIMARIA, asi que depende de que la tabla tenga la unica
// sobre (juego_id, zona_id) declarada exactamente asi. Si no la tiene —o si
// la primaria es un id propio— el upsert no encuentra contra que chocar:
// inserta una fila mas y la seccion acaba con dos estados a la vez, o falla
// con 23505. En ninguno de los dos casos queda lo que se pidio.
//
// Aqui se hace explicito: UPDATE primero y, solo si no toco ninguna fila,
// INSERT. Son dos viajes en vez de uno, y a cambio funciona con o sin clave
// unica, y se sabe siempre cual de las dos cosas ocurrio.
// ═══════════════════════════════════════════════════════════════════

import { actualizar_verificado, motivo_bloqueo, registrar_movimiento } from './escritura'

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

  // Se mandan los ids TAL CUAL llegan y ademas se dejan en el diagnostico: si
  // alguna vez no cuadran con lo que la tabla guarda (un juego_id numerico
  // contra uno de texto, por ejemplo), el mensaje lo enseña en vez de dejar
  // adivinando por que la seccion sigue libre.
  const fila = { juego_id: juegoid, zona_id: zonaid, estado }

  // 1. UPDATE. Si la fila existe, aqui termina.
  const upd = await sb
    .from('zona_juego_estado')
    .update({ estado })
    .eq('juego_id', juegoid)
    .eq('zona_id', zonaid)
    .select()
  if (upd.error) {
    console.error('escritura/update en zona_juego_estado:', upd.error, '· fila:', fila)
    return { ok: false, motivo: 'error', error: upd.error, fila }
  }
  if ((upd.data || []).length) {
    return { ok: true, filas: upd.data.length, estado, fila, via: 'update' }
  }

  // 2. No habia fila: se crea. Si dos cajas llegan a la vez, una de las dos
  //    choca con la unica (23505) — y eso significa que la otra ya la creo,
  //    asi que se reintenta el UPDATE en lugar de dar error.
  const ins = await sb.from('zona_juego_estado').insert(fila).select()
  if (!ins.error && (ins.data || []).length) {
    return { ok: true, filas: ins.data.length, estado, fila, via: 'insert' }
  }
  const duplicado = ins.error &&
    (ins.error.code === '23505' || /duplicate key/i.test(ins.error.message || ''))
  if (duplicado) {
    const reintento = await sb
      .from('zona_juego_estado')
      .update({ estado })
      .eq('juego_id', juegoid)
      .eq('zona_id', zonaid)
      .select()
    if (!reintento.error && (reintento.data || []).length) {
      return { ok: true, filas: reintento.data.length, estado, fila, via: 'update-tras-carrera' }
    }
  }

  if (ins.error) {
    console.error('escritura/insert en zona_juego_estado:', ins.error, '· fila:', fila)
    return { ok: false, motivo: 'error', error: ins.error, fila }
  }
  // Ni update ni insert devolvieron fila y ninguno dio error: es RLS callando.
  console.error(
    'escritura en zona_juego_estado: 0 filas en update y en insert ' +
    '(¿política RLS?) · fila:', fila
  )
  return { ok: false, motivo: 'sin_filas', fila }
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

// Aviso comun de un estado de seccion que no se pudo escribir. Nombra la causa
// probable, porque las tres se arreglan de forma distinta: sin permiso es un
// rol mal configurado, sin filas es RLS o la clave unica, y error es la base.
export function texto_fallo_estado(res, nombre) {
  if (!res || res.ok) return null
  const donde = nombre ? ' (' + nombre + ')' : ''
  if (res.motivo === 'sin_permiso') {
    return '⚠️ La sección' + donde + ' NO se marcó: tu perfil no tiene permiso para ' +
      'cambiar el estado de las secciones. Pídelo y márcala a mano mientras tanto.'
  }
  if (res.motivo === 'sin_filas') {
    return '⚠️ La sección' + donde + ' NO se marcó: la base no aceptó ni la actualización ' +
      'ni el alta (0 filas). Revisa las políticas RLS de `zona_juego_estado`.'
  }
  return '⚠️ La sección' + donde + ' NO se marcó como reservada' +
    (res.error && res.error.message ? ': ' + res.error.message : '.') +
    ' Márcala a mano desde el mapa.'
}

// ── LIBERAR LAS RESERVAS DE UNA TARJETA ─────────────────────────
// espejo 1:1 de v1: _liberarReservasDeProspecto() (js/modules/pipeline.js).
// Cancela cada reserva ACTIVA vinculada y libera su seccion, con DOS
// salvaguardas que no son opcionales:
//
//   1. La seccion solo se libera si NO queda otra reserva activa sobre la
//      misma (zona, juego). Liberarla sin mirar dejaba vendida una zona que
//      otro cliente seguia ocupando.
//   2. Solo se pisa el estado 'reservada'. Un 'bloqueada' es una decision
//      manual del admin —la zona esta fuera de venta a proposito— y cancelar
//      una reserva no puede deshacerla.
//
// Cancelar la reserva BORRA ademas su saldo de consumo: una reserva cancelada
// jamas debe seguir apareciendo en la vista de consumos ni en sus envios.
export async function liberar_reservas_de_prospecto(sb, usuario, card, ctx) {
  const ids = card.reservaids || []
  const liberadas = []
  const avisos = []

  for (const rid of ids) {
    const r = (ctx.reservas || []).find((x) => x.id === rid)
    if (!r || String(r.estado || '').toLowerCase() === 'cancelada') continue

    const res = await actualizar_verificado(
      sb, usuario, 'reservas', { estado: 'Cancelada', saldo_consumo: 0 }, rid, ['estado']
    )
    if (!res.ok) {
      console.error('No se pudo cancelar la reserva ' + rid + ':', res.error || res.motivo)
      avisos.push('⚠️ No se pudo liberar la reserva ' + rid + ' — revísala a mano.')
      continue
    }

    // La seccion se resuelve con la llave compuesta, en orden estricto:
    // zona_id primero y el nombre exacto como respaldo.
    const juegoid = r.juegoid || ''
    const area = (r.zonaid && (ctx.areas || []).find((a) => String(a.id) === String(r.zonaid))) ||
      (ctx.areas || []).find((a) => a.nombre === r.zona)
    if (!juegoid || !area) continue

    // Salvaguarda 1: ¿queda otra reserva activa en la misma zona y juego?
    const otraactiva = (ctx.reservas || []).find((x) => {
      if (x.id === rid || String(x.juegoid) !== String(juegoid)) return false
      if (String(x.estado || '').toLowerCase() === 'cancelada') return false
      return x.zonaid
        ? String(x.zonaid) === String(area.id)
        : String(x.zona || '').trim().toLowerCase() === String(area.nombre || '').trim().toLowerCase()
    })
    if (otraactiva) continue

    // Salvaguarda 2: solo se pisa 'reservada'.
    if (estado_vivo(ctx.areasestados, juegoid, area.id) !== 'reservada') continue

    const libre = await set_estado_zona(sb, usuario, juegoid, area.id, 'libre')
    if (!libre.ok) {
      avisos.push(texto_fallo_estado(libre, area.nombre))
      continue
    }
    liberadas.push({ rid, zona: area.nombre })
    registrar_movimiento(sb, {
      tipo: 'Reserva',
      desc: 'Sección liberada: ' + area.nombre + ' · reserva ' + rid +
        ' cancelada al eliminar del Pipeline',
      ref: card.nombre,
      usuario: usuario ? usuario.nombre : '—',
    })
  }

  return { liberadas, avisos }
}

// Los tres folios con los que puede estar etiquetado un cobro de esta tarjeta:
// el folio del prospecto, su alias ('PROS-002' ↔ '002') y el id de cada
// reserva vinculada. Se agrega tambien el id de la tarjeta, que la v1 usa
// como ultimo recurso.
export function folios_de_prospecto(card) {
  const folios = []
  ;(card.reservaids || []).forEach((rid) => folios.push(String(rid)))
  const f = String(card.folio || '').trim()
  if (f) {
    folios.push(f)
    folios.push(f.toUpperCase().startsWith('PROS-') ? f.slice(5) : 'PROS-' + f)
  }
  folios.push(String(card.id))
  return folios
}

// En "Boletos enviados" la eliminacion esta PROHIBIDA: los boletos ya salieron
// y liberar el espacio dejaria una doble venta.
export function puede_eliminarse(card) {
  return !!card && card.etapa !== 'boletos_entregados'
}

export const msg_no_eliminable =
  '⛔ Imposible eliminar: esta reserva ya cuenta con boletos enviados.'
