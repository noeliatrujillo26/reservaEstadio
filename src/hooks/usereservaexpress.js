// ═══════════════════════════════════════════════════════════════════
// usereservaexpress.js — alta ULTRA RAPIDA de una "Reserva Momentánea"
// desde /reserva-express (pensada para un celular, en plena llamada).
//
// AUTORIZACION: CUALQUIER SESION ACTIVA DE SUPABASE BASTA.
// A diferencia del resto del panel (escritura.js: motivo_bloqueo/
// insertar_verificado/set_estado_zona), este modulo NO exige ademas la
// bandera VITE_ESCRITURA_ADMIN ni que el rol tenga 'editar' en
// pipeline/cotizaciones — ReservaExpress.jsx ya exige una sesion de
// administrador verificada (correo+contraseña contra Supabase Auth + perfil
// activo en `usuarios`) antes de montar este formulario, y esa sesion activa
// es TODA la autorizacion que este modulo pide. Por eso los inserts de aqui
// abajo NO llaman a insertar_verificado/set_estado_zona (que primero
// preguntan motivo_bloqueo): son un espejo local de esas mismas funciones,
// MENOS ese candado — se duplican en vez de tocar escritura.js/
// mapaocupacion.js, para no aflojar el candado en el resto del panel, que
// sigue detras de la bandera y los permisos de rol.
//
// La autoridad REAL sigue siendo RLS, exactamente como en el resto del
// panel: cada escritura se VERIFICA pidiendo .select() de vuelta y contando
// filas — 0 filas sin error es RLS bloqueando en silencio, y aqui se trata
// igual que ahi, como fallo y no como exito.
//
// POR QUE NO REUTILIZA useprospectos().crear()
//   1. crear() valida con validar_prospecto(), que EXIGE correo — aqui el
//      correo es opcional a propósito (spec: "Cliente: Nombre completo o
//      Empresa *, Teléfono *, Email" — sin asterisco). Cambiar
//      validar_prospecto() afectaria tambien al modal "Nuevo prospecto",
//      donde el correo SI es obligatorio y asi debe seguir.
//   2. crear() no acepta un cupon de codigo ya resuelto (`d.cupon`) via sus
//      parametros publicos — aqui SI se valida un codigo contra el catalogo
//      YA CARGADO (ver validar_codigo_descuento en lib/catalogos.js) y se le
//      pasa a calc_total_prospecto() tal como espera.
//   3. Ademas de crear la tarjeta, este flujo BLOQUEA la zona en
//      zona_juego_estado de inmediato — un paso que en el resto del panel
//      solo ocurre al GENERAR LA RESERVA real (generar_reserva, mas
//      adelante en el embudo). Es una desviacion deliberada: el proposito
//      de esta pantalla es apartar el lugar YA, mientras se sigue
//      platicando con el cliente.
//
// Por lo demas reutiliza las MISMAS piezas probadas que useprospectos.js:
// nuevo_folio_prospecto (folio aleatorio verificado), calc_total_prospecto
// (EL MISMO motor de precios que "Nuevo prospecto" — area/zona, consumo,
// extra, adultos/niños extra, descuento manual y por volumen, y ahora
// tambien un cupon de codigo resuelto por validar_codigo_descuento), es_
// error_columna/subset_legacy/registrar_movimiento (de escritura.js) y
// buscar_cliente (identidad nombre+telefono) para no duplicar una ficha ya
// existente.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import { buscar_cliente, tel_norm } from '../lib/clientes'
import { es_error_columna, registrar_movimiento, subset_legacy } from '../lib/escritura'
import { estados_zona, texto_fallo_estado } from '../lib/mapaocupacion'
import { calc_total_prospecto, nuevo_folio_prospecto } from '../lib/prospectos'
import { email_valido } from '../lib/reservasadmin'
import { redondear_dinero, mxn2 } from '../lib/dinero'
import { hoy_hermosillo } from '../lib/fechas'

const claves_legacy_prospecto = [
  'id', 'nombre', 'zona', 'serie', 'monto', 'etapa', 'badge', 'notas', 'vendedora', 'juego', 'tel',
]

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// ── escritura verificada SIN el candado de permisos por rol/bandera ──
// Mismo criterio de interpretacion que interpretar() en escritura.js: error
// explicito, o cero filas devueltas (RLS bloqueando en silencio).
function interpretar(res, operacion, tabla) {
  if (res.error) {
    console.error('reserva-express/' + operacion + ' en ' + tabla + ':', res.error)
    return { ok: false, error: res.error, motivo: 'error' }
  }
  const filas = (res.data || []).length
  if (!filas) {
    console.error(
      'reserva-express/' + operacion + ' en ' + tabla + ': 0 filas afectadas ' +
      '(¿política RLS, o id sin coincidencia?)'
    )
    return { ok: false, filas: 0, motivo: 'sin_filas' }
  }
  return { ok: true, filas, datos: res.data }
}

async function insertar_directo(tabla, payload, claveslegacy) {
  let res = await sb.from(tabla).insert(payload).select()
  if (es_error_columna(res.error) && claveslegacy && claveslegacy.length) {
    res = await sb.from(tabla).insert(subset_legacy(payload, claveslegacy)).select()
  }
  return interpretar(res, 'insert', tabla)
}

async function actualizar_directo(tabla, payload, id, claveslegacy) {
  let res = await sb.from(tabla).update(payload).eq('id', id).select()
  if (es_error_columna(res.error) && claveslegacy && claveslegacy.length) {
    res = await sb.from(tabla).update(subset_legacy(payload, claveslegacy)).eq('id', id).select()
  }
  return interpretar(res, 'update', tabla)
}

// espejo de set_estado_zona() (lib/mapaocupacion.js) sin el motivo_bloqueo
// inicial — UPDATE primero y, solo si no toco fila, INSERT (con reintento
// si dos altas chocan a la vez).
async function bloquear_zona_directo(juegoid, zonaid, estado) {
  if (estados_zona.indexOf(estado) < 0) return { ok: false, motivo: 'estado-invalido' }
  const fila = { juego_id: juegoid, zona_id: zonaid, estado }

  const upd = await sb.from('zona_juego_estado').update({ estado })
    .eq('juego_id', juegoid).eq('zona_id', zonaid).select()
  if (upd.error) {
    console.error('reserva-express/update en zona_juego_estado:', upd.error, '· fila:', fila)
    return { ok: false, motivo: 'error', error: upd.error, fila }
  }
  if ((upd.data || []).length) return { ok: true, filas: upd.data.length, estado, fila, via: 'update' }

  const ins = await sb.from('zona_juego_estado').insert(fila).select()
  if (!ins.error && (ins.data || []).length) return { ok: true, filas: ins.data.length, estado, fila, via: 'insert' }

  const duplicado = ins.error &&
    (ins.error.code === '23505' || /duplicate key/i.test(ins.error.message || ''))
  if (duplicado) {
    const reintento = await sb.from('zona_juego_estado').update({ estado })
      .eq('juego_id', juegoid).eq('zona_id', zonaid).select()
    if (!reintento.error && (reintento.data || []).length) {
      return { ok: true, filas: reintento.data.length, estado, fila, via: 'update-tras-carrera' }
    }
  }
  if (ins.error) {
    console.error('reserva-express/insert en zona_juego_estado:', ins.error, '· fila:', fila)
    return { ok: false, motivo: 'error', error: ins.error, fila }
  }
  console.error('reserva-express: 0 filas en update y en insert de zona_juego_estado (¿política RLS?) · fila:', fila)
  return { ok: false, motivo: 'sin_filas', fila }
}

export function usereservaexpress() {
  const { usuario } = useadmin()
  const { pipeline, clientes, areas, descuentosvolumen, recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)

  // toda la autorizacion que pide este modulo: que haya sesion de
  // administrador activa (ReservaExpress.jsx ya la exige antes de montar
  // el formulario, asi que en la practica esto siempre es true aqui).
  const puede = !!usuario

  // datos = { nombre, tel, email, juegoid, zonaid, zona, tipocomida,
  //           areamonto, minpersonas, consumomonto, extramonto,
  //           adultoextraprecio, adultoextracant, ninoextraprecio,
  //           ninoextracant, descuento, cupon: {codigo,tipo,valor}|null,
  //           vendedora, notas, abonoinicial }
  // El monto NO se pasa: se calcula aqui con calc_total_prospecto(), el
  // MISMO motor que usa "Nuevo prospecto" — lo que ve el formulario en su
  // tarjeta de desglose es EXACTAMENTE lo que se guarda.
  const crear_express = useCallback(
    async (datos) => {
      if (!usuario) {
        mostrartoast('⚠️ Tu sesión expiró. Vuelve a iniciar sesión.')
        return { ok: false }
      }
      if (guardando) return { ok: false }

      const faltan = []
      if (!String(datos.nombre || '').trim()) faltan.push('nombre')
      const tel = String(datos.tel || '').trim()
      if (!tel) faltan.push('tel')
      else if (tel.replace(/\D/g, '').length !== 10) faltan.push('tel')
      if (String(datos.email || '').trim() && !email_valido(datos.email)) faltan.push('email')
      if (!datos.juegoid) faltan.push('juego')
      if (!datos.zonaid) faltan.push('zona')

      const calc = calc_total_prospecto(datos, { areas, descuentosvolumen })
      if (!(calc.total > 0)) faltan.push('monto')

      if (faltan.length) {
        mostrartoast('⚠️ Revisa los campos marcados')
        return { ok: false, campos: faltan }
      }

      setguardando(true)
      try {
        // 1. FICHA DE CLIENTE — mejor esfuerzo, no fatal: un fallo aqui deja
        // la tarjeta sin vincular a su ficha, no sin guardar. Identidad
        // nombre+telefono, igual que en todo el panel.
        let clienteid = null
        try {
          const existente = tel_norm(tel)
            ? buscar_cliente(clientes || [], { nombre: datos.nombre, email: datos.email, tel })
            : null
          if (existente && existente.id != null) {
            clienteid = existente.id
          } else {
            const rcli = await insertar_directo('clientes', {
              nombre: String(datos.nombre).toUpperCase(), email: datos.email || '', tel,
              empresa: '', fecha_alta: hoy_hermosillo(),
            }, ['nombre', 'email', 'tel', 'empresa', 'fecha_alta'])
            if (rcli.ok && rcli.datos && rcli.datos[0]) clienteid = rcli.datos[0].id
          }
        } catch (e) {
          console.error('Alta de cliente desde Reserva Exprés falló (no-fatal):', e)
        }

        // 2. LA TARJETA, directo en "Reserva Momentánea". El abono inicial
        // NO se registra como cobro aqui (eso exige forma de pago y, casi
        // siempre, comprobante — dos cosas que no caben en una llamada):
        // queda anotado en notas para que quien la atienda lo cobre desde
        // "+ Registrar pago" en el detalle de la tarjeta.
        const abono = Number(datos.abonoinicial) || 0
        const notas = [
          datos.notas || '',
          abono > 0 ? 'Abono inicial acordado por teléfono: ' + money(abono) + ' — pendiente de registrar el cobro.' : '',
        ].filter(Boolean).join('\n')

        const folio = nuevo_folio_prospecto(pipeline)
        const id = 'pp' + Date.now()
        const cambiadaen = new Date().toISOString()

        const res = await insertar_directo('pipeline_prospectos', {
          id, folio, nombre: datos.nombre, email: datos.email || '',
          zona: datos.zona || '', zona_id: datos.zonaid, serie: '',
          monto: calc.total, etapa: 'reserva_momentanea',
          badge: 'Reserva Exprés', notas,
          vendedora: datos.vendedora || '', juego: datos.juegoid, tel,
          adultos: calc.adultocant, ninos: calc.ninocant,
          descuento: Number(datos.descuento) || 0,
          consumo_monto: Number(datos.consumomonto) || 0,
          extra_monto: Number(datos.extramonto) || 0,
          adulto_extra_precio: Number(datos.adultoextraprecio) || 0,
          nino_extra_precio: Number(datos.ninoextraprecio) || 0,
          cliente_id: clienteid,
          tipo_comida: datos.tipocomida === 'discada' ? 'discada' : 'carne_asada',
          etapa_cambiada_en: cambiadaen,
        }, claves_legacy_prospecto)

        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la reserva (0 filas). Revisa las políticas RLS de `pipeline_prospectos`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        // Los dos extras van en UPDATE aparte, igual que en useprospectos.js
        // crear(): un fallo aqui no cuesta nada, la tarjeta ya quedo guardada.
        if (calc.descuentototal > 0) {
          const r = await actualizar_directo('pipeline_prospectos', { descuento_monto: calc.descuentototal }, id, null)
          if (!r.ok) console.warn('descuento_monto no se guardó:', r.motivo)
        }
        if (datos.cupon && datos.cupon.codigo) {
          const r = await actualizar_directo('pipeline_prospectos', { codigo_descuento: datos.cupon.codigo }, id, null)
          if (!r.ok) console.warn('codigo_descuento no se guardó:', r.motivo)
        }

        // 3. BLOQUEAR LA ZONA en vivo — el paso que distingue a esta
        // pantalla del alta normal de un prospecto. No-fatal para la
        // tarjeta (ya se guardó); si falla, se avisa para marcarla a mano.
        const bloq = await bloquear_zona_directo(datos.juegoid, datos.zonaid, 'reservada')
        const avisobloqueo = !bloq.ok ? texto_fallo_estado(bloq, datos.zona) : null

        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Reserva Exprés · Reserva Momentánea creada · ' + datos.nombre +
            (avisobloqueo ? ' · ⚠️ zona NO bloqueada' : ' · zona bloqueada'),
          ref: folio,
          monto: calc.total || null,
          usuario: usuario ? usuario.nombre : '—',
        })

        await recargar()
        if (avisobloqueo) mostrartoast(avisobloqueo, 9000)
        return { ok: true, folio, avisobloqueo, monto: calc.total }
      } catch (err) {
        console.error('crear reserva exprés:', err)
        mostrartoast('⚠️ No se pudo crear la reserva. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, pipeline, clientes, areas, descuentosvolumen, mostrartoast, recargar]
  )

  return { puede, crear_express, guardando }
}

export default usereservaexpress
