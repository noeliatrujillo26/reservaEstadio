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
//   3. Ademas de crear la tarjeta, este flujo GENERA LA RESERVA FORMAL de
//      inmediato (folio NRJ-ADM-XXXXX, fila real en `reservas`, zona
//      'reservada') — el mismo resultado que "🏟 Generar Reserva" en el
//      detalle de un prospecto (generar_reserva, useprospectos.js), pero
//      disparado EN EL MISMO CLIC en vez de como un paso posterior. Sigue
//      siendo una desviacion deliberada del resto del panel (alli una
//      reserva nace despues, cuando ya hay abono o se marca "Pendiente"):
//      aqui el proposito es cerrar la venta YA, en plena llamada, sin
//      esperar un segundo clic desde el Pipeline.
//
// Por lo demas reutiliza las MISMAS piezas probadas que useprospectos.js:
// nuevo_folio_prospecto/generar_folio_reserva (folios aleatorios
// verificados), calc_total_prospecto (EL MISMO motor de precios que "Nuevo
// prospecto" — area/zona, consumo, extra, adultos/niños extra, descuento
// manual y por volumen, y ahora tambien un cupon de codigo resuelto por
// validar_codigo_descuento), es_error_columna/subset_legacy/
// registrar_movimiento (de escritura.js) y buscar_cliente (identidad
// nombre+telefono) para no duplicar una ficha ya existente.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import { buscar_cliente, tel_norm } from '../lib/clientes'
import { mxn2 } from '../lib/dinero'
import { es_error_columna, registrar_movimiento, subset_legacy } from '../lib/escritura'
import { leer_mensajes } from '../lib/mensajes'
import { disponibilidad_zonas_en_vivo, estados_zona, texto_fallo_estado } from '../lib/mapaocupacion'
import { calc_total_prospecto, nuevo_folio_prospecto } from '../lib/prospectos'
import { html_ticket_reserva, nombre_archivo_ticket } from '../lib/recibo'
import { email_valido, etiqueta_juego, generar_folio_reserva } from '../lib/reservasadmin'
import { subir_comprobante } from '../lib/storage'
import { hoy_hermosillo } from '../lib/fechas'

const claves_legacy_prospecto = [
  'id', 'nombre', 'zona', 'serie', 'monto', 'etapa', 'badge', 'notas', 'vendedora', 'juego', 'tel',
]

const claves_legacy_reserva = [
  'id', 'cliente', 'email', 'tel', 'zona', 'juego', 'juego_id', 'monto',
  'descuento_monto', 'monto_pagado', 'pago', 'metodo', 'personas', 'estado', 'estado_pago',
]

function es_duplicado(error) {
  return !!error && (error.code === '23505' || /duplicate key/i.test(error.message || ''))
}

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// Sustituye {nombre}/{zona}/{juego}/{fecha}/{monto}/{folio} en una plantilla
// de Ajustes → Mensajes (lib/mensajesdefault.js) — las MISMAS variables que
// documenta esa pantalla. Un token sin valor se deja tal cual en vez de
// desaparecer, para que un hueco se note en vez de dejar una frase coja.
function rellenar_plantilla(txt, vars) {
  return String(txt || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m))
}

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
  const { pipeline, clientes, areas, juegos, reservas, descuentosvolumen, recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [compartiendo, setcompartiendo] = useState(false)

  // toda la autorizacion que pide este modulo: que haya sesion de
  // administrador activa (ReservaExpress.jsx ya la exige antes de montar
  // el formulario, asi que en la practica esto siempre es true aqui).
  const puede = !!usuario

  // datos = { nombre, tel, email, juegoid, zonaid, zona, tipocomida,
  //           areamonto, minpersonas, consumomonto, extramonto,
  //           adultoextraprecio, adultoextracant, ninoextraprecio,
  //           ninoextracant, descuento, cupon: {codigo,tipo,valor}|null,
  //           vendedora, notas }
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
        // 1. VALIDACION PREVENTIVA: re-verificar la zona EN VIVO contra
        // Supabase, no contra el catálogo que trae el formulario — el
        // formulario pudo llevar minutos abierto mientras se habla por
        // teléfono, y alguien más pudo ocuparla (o casi llenar el palco)
        // mientras tanto. Misma funcion que arma la lista del <select> en
        // formularioexpress.jsx (disponibilidad_zonas_en_vivo: zona_juego_
        // estado + reservas activas + prospectos con zona asignada para
        // zonas exclusivas; suma de adultos contra capacidad_maxima para
        // palcos compartidos), para que el guardado nunca acepte algo que el
        // propio selector ya habria mostrado como "(Ocupada)" o rechazado
        // por falta de cupo.
        try {
          const disponibilidad = await disponibilidad_zonas_en_vivo(sb, datos.juegoid, areas)
          const info = disponibilidad[String(datos.zonaid)]
          if (info) {
            if (info.escompartida) {
              if (info.libres != null && calc.totaladultos > info.libres) {
                mostrartoast(
                  '⛔ Ese palco ya no tiene lugares suficientes para ' + calc.totaladultos +
                  ' adulto(s) — quedan ' + info.libres + ' disponible(s). Ajusta la cantidad o elige otra zona.',
                  8000
                )
                return { ok: false, campos: ['zona'] }
              }
            } else if (info.ocupada) {
              mostrartoast('⛔ Esa zona ya fue ocupada por otra persona. Elige otra.', 8000)
              return { ok: false, campos: ['zona'] }
            }
          }
        } catch (edisp) {
          console.error('Verificación de disponibilidad en vivo falló (Reserva Exprés):', edisp)
        }

        // 2. FICHA DE CLIENTE — mejor esfuerzo, no fatal: un fallo aqui deja
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

        // 3. LA TARJETA, directo en "Reserva Momentánea".
        const notas = datos.notas || ''

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

        // 4. GENERAR LA RESERVA FORMAL — el mismo resultado que "🏟 Generar
        // Reserva" en el detalle del prospecto (generar_reserva,
        // useprospectos.js), replicado sin el candado de motivo_bloqueo por
        // la misma razon de la cabecera de este archivo. Nace SIN pago
        // ('Sin pago'/monto_pagado 0): eso es correcto — no se cobro nada
        // todavia — y por lo mismo la tarjeta del pipeline se queda en
        // 'reserva_momentanea' (regla de la casa: sin abono, ahi se queda;
        // ver etapa_por_abono en lib/pipeline.js), sin necesidad de tocar su
        // etapa aqui. No-fatal: si falla, la tarjeta y el bloqueo de zona de
        // abajo siguen adelante — se avisa para generarla a mano.
        let reservaid = null
        let avisoreserva = null
        try {
          const j = (juegos || []).find((x) => String(x.id) === String(datos.juegoid))
          const a = (areas || []).find((x) => x.id === datos.zonaid)
          if (!j || !a) throw new Error('juego o zona no encontrados en el catálogo')

          let nuevoid = generar_folio_reserva('admin', reservas)
          let res = null
          for (let intento = 0; intento < 5; intento++) {
            res = await insertar_directo('reservas', {
              id: nuevoid, cliente: datos.nombre, email: datos.email || '', tel,
              zona: a.nombre, zona_id: a.id, juego: etiqueta_juego(j), juego_id: j.id,
              // regla de la casa: monto = BRUTO (calc.subtotal), descuento
              // aparte — igual que generar_reserva/bruto_tarjeta.
              monto: calc.subtotal, descuento_monto: calc.descuentototal, monto_pagado: 0,
              pago: 'Sin pago', metodo: 'Tarjeta', personas: calc.personas,
              estado: 'Confirmada', estado_pago: 'pendiente',
              adultos: calc.adultocant, ninos: calc.ninocant,
              saldo_consumo: Number(datos.consumomonto) || 0,
              cotizacion_id: null,
            }, claves_legacy_reserva)
            if (res.ok || !es_duplicado(res.error)) break
            nuevoid = generar_folio_reserva('admin', reservas)
          }

          if (res.ok) {
            reservaid = nuevoid
            if (datos.cupon && datos.cupon.codigo) {
              const rc = await actualizar_directo('reservas', { codigo_descuento: datos.cupon.codigo }, nuevoid, null)
              if (!rc.ok) console.warn('codigo_descuento no se guardó en la reserva:', rc.motivo)
            }
            const vinc = await actualizar_directo('pipeline_prospectos', { reserva_ids: [nuevoid] }, id, null)
            if (!vinc.ok) console.warn('reserva_ids no se pudo vincular a la tarjeta:', vinc.motivo)
          } else {
            avisoreserva = '⚠️ La zona quedó apartada, pero la reserva formal (folio NRJ) NO se pudo generar' +
              (res.motivo === 'sin_filas' ? ' (0 filas — revisa las políticas RLS de `reservas`).' : '.') +
              ' Genérala a mano desde el Pipeline.'
          }
        } catch (egen) {
          console.error('Generar reserva formal falló (Reserva Exprés):', egen)
          avisoreserva = '⚠️ La zona quedó apartada, pero la reserva formal (folio NRJ) NO se pudo generar. ' +
            'Genérala a mano desde el Pipeline.'
        }

        // 5. BLOQUEAR LA ZONA en vivo. No-fatal para la tarjeta (ya se
        // guardó); si falla, se avisa para marcarla a mano.
        const bloq = await bloquear_zona_directo(datos.juegoid, datos.zonaid, 'reservada')
        const avisobloqueo = !bloq.ok ? texto_fallo_estado(bloq, datos.zona) : null

        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Reserva Exprés · Reserva Momentánea creada · ' + datos.nombre +
            (reservaid ? ' · reserva ' + reservaid : ' · ⚠️ sin reserva formal') +
            (avisobloqueo ? ' · ⚠️ zona NO bloqueada' : ' · zona bloqueada'),
          ref: folio,
          monto: calc.total || null,
          usuario: usuario ? usuario.nombre : '—',
        })

        await recargar()
        // el toast tiene UNA sola ranura: si hay dos avisos, el segundo
        // pisaria al primero antes de que se alcance a leer — se juntan en
        // uno, mismo criterio que generar_reserva() en useprospectos.js.
        const avisos = [avisoreserva, avisobloqueo].filter(Boolean)
        if (avisos.length) mostrartoast(avisos.join(' · '), 9000)
        return {
          ok: true, folio, reservaid, avisobloqueo, avisoreserva,
          monto: calc.total, personas: calc.personas,
        }
      } catch (err) {
        console.error('crear reserva exprés:', err)
        mostrartoast('⚠️ No se pudo crear la reserva. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, pipeline, clientes, juegos, reservas, areas, descuentosvolumen, mostrartoast, recargar]
  )

  // ── COMPARTIR EL TICKET POR WHATSAPP ─────────────────────────────
  // `exito` es el resumen que arma formularioexpress.jsx tras crear_express:
  // { folio, reservaid, nombre, tel, zona, juego, monto, personas, vendedora }.
  //
  // El "PDF" del resto de la app es en realidad un documento HTML imprimible
  // (window.print → "Guardar como PDF"), publicado en Storage y servido por
  // /api/recibo?f=... con el Content-Type correcto — mismo patron que el
  // recibo automatico de un pago (reciboauto.js + useprospectos.js
  // registrar_pago), aqui aplicado a una reserva SIN pago porque express no
  // cobra nada. El mensaje reutiliza la plantilla configurable de "Reserva
  // momentánea" (Ajustes → Mensajes, msg-pip-reserva_momentanea): es la
  // etapa en la que la tarjeta se queda, y su texto ya dice lo correcto —
  // apartado sin cobro, falta el enganche — a diferencia de la plantilla de
  // "confirmación" que habla de un monto YA pagado.
  //
  // SIN window.open('', '_blank'): ese truco (pestaña en blanco que se
  // navega despues, para esquivar el bloqueo de pop-ups) deja en iOS/Safari
  // una pestaña "about:blank" huerfana de fondo — el deep link salta a la
  // app de WhatsApp, pero Safari nunca la cierra, porque el handoff a la app
  // no cuenta como "usar" la pestaña. Aqui se navega el DOCUMENTO ACTUAL con
  // window.location.href: no abre nada nuevo, asi que no hay nada que
  // esquivar ni nada que quede huerfano.
  const compartir_whatsapp = useCallback(
    async (exito) => {
      if (!exito) return { ok: false }
      setcompartiendo(true)
      try {
        const juegolabel = exito.juego
          ? etiqueta_juego(exito.juego) + ' · vs ' + exito.juego.rival
          : ''
        const fechalabel = exito.juego
          ? new Date(exito.juego.fecha + 'T12:00').toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
          : ''
        const folio = exito.reservaid || exito.folio

        const html = html_ticket_reserva({
          folio, cliente: exito.nombre, tel: exito.tel, zona: exito.zona,
          juego: juegolabel, fecha: fechalabel, personas: exito.personas,
          vendedora: exito.vendedora, monto: exito.monto,
          estado: 'Reserva registrada · pendiente de enganche',
        })
        const archivo = new File([html], nombre_archivo_ticket(folio), { type: 'text/html' })
        const subida = await subir_comprobante(sb, archivo, 'recibos')
        const link = subida.ruta && !subida.error
          ? window.location.origin + '/api/recibo?f=' + encodeURIComponent(subida.ruta)
          : ''
        if (!link) console.warn('Ticket de Reserva Exprés no se pudo subir a Storage:', subida.error)

        const plantillas = leer_mensajes()
        const cuerpo = rellenar_plantilla(plantillas['msg-pip-reserva_momentanea'], {
          nombre: exito.nombre, zona: exito.zona, juego: juegolabel, fecha: fechalabel,
          monto: money(exito.monto), folio,
        })
        const mensaje = cuerpo +
          '\n\n🎫 Folio: ' + folio +
          (link ? '\n📄 Tu ticket: ' + link : '')

        const telcliente = tel_norm(exito.tel)
        const numerowa = telcliente.length === 10 ? '52' + telcliente : ''
        const url = 'https://wa.me/' + numerowa + '?text=' + encodeURIComponent(mensaje)

        window.location.href = url
        return { ok: true, link }
      } catch (e) {
        console.error('compartir_whatsapp (Reserva Exprés):', e)
        mostrartoast('⚠️ No se pudo preparar el ticket para WhatsApp.')
        return { ok: false }
      } finally {
        setcompartiendo(false)
      }
    },
    [mostrartoast]
  )

  return { puede, crear_express, guardando, compartir_whatsapp, compartiendo }
}

export default usereservaexpress
