// ═══════════════════════════════════════════════════════════════════
// useprospectos.js — escritura del Pipeline Comercial.
// espejo 1:1 de v1: guardarNuevoProspecto(), _asegurarClientePipeline(),
// guardarMovimientoProspecto(), el handler de `drop` y _pdGenerarReserva()
// (js/modules/pipeline.js).
//
// CUATRO ACCIONES
//   crear          → alta de la tarjeta + ficha de cliente + cupon
//   editar         → reescribe la tarjeta y sincroniza su reserva vinculada
//   mover          → cambio de columna, con las cinco reglas de negocio
//   generar_reserva→ convierte la tarjeta en reserva REAL, heredando todo
//
// generar_reserva es la unica via por la que nace una reserva: el flujo
// obligatorio del negocio. Por eso arrastra tanto — cupon, economia, estado
// del mapa, cobros previos y etapa — y por eso cada pieza avisa por separado
// si falla, en vez de dejar una reserva a medio vincular.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, insertar_verificado, mensajes_bloqueo, motivo_bloqueo,
  registrar_movimiento,
} from '../lib/escritura'
import { set_estado_zona } from '../lib/mapaocupacion'
import { sincronizar_etapa } from '../lib/cascadas'
import { pipeline_etapas, reservas_activas } from '../lib/pipeline'
import {
  bruto_tarjeta, calc_total_prospecto, nuevo_folio_prospecto, validar_edicion_prospecto,
  validar_mover_etapa, validar_prospecto,
} from '../lib/prospectos'
import {
  economia_reserva, estado_pago_reserva, etiqueta_juego, generar_folio_reserva,
  min_seccion,
} from '../lib/reservasadmin'
import { map_precio } from '../lib/preciosadmin'
import { buscar_cliente, tel_norm } from '../lib/clientes'
import { cobro_cancelado } from '../lib/cobros'
import { es_cobro_credito } from '../lib/dashboard'
import { redondear_dinero } from '../lib/dinero'
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

export function useprospectos() {
  const { usuario } = useadmin()
  const {
    pipeline, reservas, cobros, clientes, juegos, areas, secciones,
    descuentosvolumen, politica, areasestados, recargar,
  } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [moviendo, setmoviendo] = useState(null)

  const puede = motivo_bloqueo(usuario, 'pipeline_prospectos') === null

  // ── FICHA DE CLIENTE ─────────────────────────────────────────
  // TODO prospecto queda tambien registrado como cliente. Si ya existe se
  // recupera su id; si no, se crea. NO es fatal: un fallo aqui deja el
  // prospecto sin vincular a su ficha, no sin guardar.
  //
  // Identidad = nombre + telefono. Un correo distinto al de la ficha ya NO
  // crea un cliente nuevo: es la misma persona con otro correo. Y los huecos
  // de la ficha se COMPLETAN con lo que trae el prospecto, sin pisar nunca un
  // dato ya capturado.
  const asegurar_cliente = useCallback(
    async (nombre, email, tel) => {
      try {
        if (!nombre || (!email && !tel)) return null
        // Sin telefono no hay con que identificar: se deja pasar al alta en
        // vez de bloquear por un dato que ya no es identificador.
        const existente = tel_norm(tel)
          ? buscar_cliente(clientes || [], { nombre, email, tel })
          : null

        if (existente && existente.id != null) {
          const faltantes = {}
          if (email && !String(existente.email || '').trim()) faltantes.email = email
          if (tel && !String(existente.tel || '').trim()) faltantes.tel = tel
          if (Object.keys(faltantes).length) {
            const r = await actualizar_verificado(
              sb, usuario, 'clientes', faltantes, existente.id, ['email', 'tel']
            )
            if (!r.ok) console.warn('No se pudieron completar los datos del cliente:', r.motivo)
          }
          return existente.id
        }

        const res = await insertar_verificado(sb, usuario, 'clientes', {
          nombre: String(nombre).toUpperCase(),
          email: email || '',
          tel: tel || '',
          empresa: '',
          fecha_alta: hoy_hermosillo(),
        }, ['nombre', 'email', 'tel', 'empresa', 'fecha_alta'])
        if (!res.ok) {
          console.error('No se pudo crear la ficha de cliente del prospecto (no-fatal):', res.error || res.motivo)
          return null
        }
        return res.datos && res.datos[0] && res.datos[0].id != null ? res.datos[0].id : null
      } catch (e) {
        console.error('Alta de cliente desde el pipeline falló (no-fatal):', e)
        return null
      }
    },
    [clientes, usuario]
  )

  // ── CREAR PROSPECTO ──────────────────────────────────────────
  const crear = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'pipeline_prospectos')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (guardando) return { ok: false }

      const errores = validar_prospecto(datos)
      if (errores.length) {
        mostrartoast(
          '⚠️ ' + errores[0].mensaje +
          (errores.length > 1 ? ' (+' + (errores.length - 1) + ' campo(s) más)' : '')
        )
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      setguardando(true)
      try {
        const calc = calc_total_prospecto(datos, { descuentosvolumen })
        const etapa = pipeline_etapas.find((e) => e.id === datos.etapaid) || pipeline_etapas[0]
        const folio = nuevo_folio_prospecto(pipeline)
        const clienteid = await asegurar_cliente(datos.nombre, datos.email, datos.tel)
        const id = 'pp' + Date.now()
        const cambiadaen = new Date().toISOString()

        const res = await insertar_verificado(sb, usuario, 'pipeline_prospectos', {
          id, folio, nombre: datos.nombre, email: datos.email,
          zona: datos.zona || '', serie: '', monto: calc.total, etapa: etapa.id,
          badge: 'Panel Admin', notas: datos.notas || '',
          vendedora: datos.vendedora || '', juego: datos.juegoid, tel: datos.tel,
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
              ? '⚠️ La base no aceptó el prospecto (0 filas). Revisa las políticas RLS de `pipeline_prospectos`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        // Los dos extras van en UPDATE aparte y NO dentro del insert: metidos
        // ahi, si la columna no existe todavia el compat reintentaria con el
        // subconjunto legacy de 11 claves y se perderian consumo_monto,
        // extra_monto, tipo_comida y cliente_id. Aqui un fallo no cuesta nada
        // — el prospecto ya quedo guardado.
        if (calc.descuentototal > 0) {
          const r = await actualizar_verificado(
            sb, usuario, 'pipeline_prospectos', { descuento_monto: calc.descuentototal }, id, null
          )
          if (!r.ok) console.warn('descuento_monto no se guardó:', r.motivo)
        }
        if (datos.codigodescuento) {
          const r = await actualizar_verificado(
            sb, usuario, 'pipeline_prospectos', { codigo_descuento: datos.codigodescuento }, id, null
          )
          if (!r.ok) console.warn('codigo_descuento no se guardó:', r.motivo)
        }

        mostrartoast('Prospecto "' + datos.nombre + '" agregado')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Prospecto creado · ' + datos.nombre,
          ref: folio,
          monto: calc.total || null,
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true, id, folio }
      } catch (err) {
        console.error('crear prospecto:', err)
        mostrartoast('⚠️ No se pudo crear el prospecto. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, pipeline, descuentosvolumen, asegurar_cliente, mostrartoast, recargar]
  )

  // ── EDITAR PROSPECTO ─────────────────────────────────────────
  // Al guardar se sincroniza la reserva vinculada: cliente, contacto, zona,
  // juego y personas. La ECONOMIA solo se re-deriva cuando la tarjeta modela
  // el descuento (manual o por volumen).
  const editar = useCallback(
    async (card, datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'pipeline_prospectos')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (guardando) return { ok: false }

      const errores = validar_edicion_prospecto(datos)
      if (errores.length) {
        mostrartoast(
          '⚠️ ' + errores[0].mensaje +
          (errores.length > 1 ? ' (+' + (errores.length - 1) + ' campo(s) más)' : '')
        )
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      setguardando(true)
      try {
        const zobj = (areas || []).find((a) => a.id === datos.zonaid) || null
        const calc = calc_total_prospecto({
          ...datos,
          areamonto: datos.areamonto,
          adultoextracant: datos.adultos,
          ninoextracant: datos.ninos,
          minpersonas: zobj ? min_seccion(zobj, (secciones || []).map(map_precio),
            (juegos || []).find((j) => String(j.id) === String(datos.juegoid))) : 0,
        }, { descuentosvolumen })

        const res = await actualizar_verificado(sb, usuario, 'pipeline_prospectos', {
          nombre: datos.nombre, email: datos.email,
          zona_id: datos.zonaid || '', zona: zobj ? zobj.nombre : '',
          consumo_monto: Number(datos.consumomonto) || 0,
          extra_monto: Number(datos.extramonto) || 0,
          descripcion: datos.descripcion || '', notas: datos.notas || '',
          juego: datos.juegoid, adultos: datos.adultos, ninos: datos.ninos,
          adulto_extra_precio: Number(datos.adultoextraprecio) || 0,
          nino_extra_precio: Number(datos.ninoextraprecio) || 0,
          monto: calc.total, vendedora: datos.vendedora || '', tel: datos.tel,
          tipo_comida: datos.tipocomida === 'discada' ? 'discada' : 'carne_asada',
        }, card.id, ['nombre', 'zona', 'monto', 'vendedora', 'tel', 'notas', 'juego', 'etapa'])
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `pipeline_prospectos`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }

        // Sincronizar las reservas vinculadas.
        const jobj = (juegos || []).find((j) => String(j.id) === String(datos.juegoid))
        for (const rid of card.reservaids || []) {
          const r = (reservas || []).find((x) => x.id === rid)
          if (!r) continue
          const basezona = zobj && jobj
            ? min_seccion(zobj, (secciones || []).map(map_precio), jobj) || 0
            : 0
          const fila = {
            cliente: datos.nombre, email: datos.email, tel: datos.tel,
            personas: basezona + (Number(datos.adultos) || 0) + (Number(datos.ninos) || 0),
            adultos: datos.adultos, ninos: datos.ninos,
            saldo_consumo: Number(datos.consumomonto) || 0,
          }
          if (zobj) fila.zona = zobj.nombre
          if (jobj) { fila.juego = etiqueta_juego(jobj); fila.juego_id = jobj.id }

          // Una reserva publica pagada con CUPON lleva su descuento en PESOS y
          // la tarjeta no tiene donde expresarlo: su "bruto" reconstruido es en
          // realidad el NETO, asi que re-derivar borraba el cupon y la reserva
          // liquidada volvia a deber el precio de lista. En ese caso el dinero
          // NO se toca; el resto de los datos si.
          const pctcard = calc.manualpct + calc.volumenpct
          const cuponajeno = pctcard <= 0 && (Number(r.descuentomonto) || 0) > 0
          if (!cuponajeno) {
            fila.monto = calc.subtotal
            fila.descuento_monto = Math.max(0, calc.subtotal - calc.total)
          }
          const rs = await actualizar_verificado(
            sb, usuario, 'reservas', fila, r.id,
            ['cliente', 'email', 'tel', 'zona', 'juego', 'juego_id', 'monto', 'personas']
          )
          if (!rs.ok) {
            mostrartoast(
              '⚠️ El prospecto se guardó, pero la reserva ' + r.id +
              ' no se pudo sincronizar. Revísala.', 9000
            )
          }
        }

        mostrartoast('✅ Prospecto actualizado')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Prospecto editado · ' + datos.nombre,
          ref: card.folio || card.id,
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true }
      } catch (err) {
        console.error('editar prospecto:', err)
        mostrartoast('⚠️ No se pudo guardar el prospecto. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, areas, secciones, juegos, reservas, descuentosvolumen, mostrartoast, recargar]
  )

  // ── MOVER DE COLUMNA ─────────────────────────────────────────
  const mover = useCallback(
    async (card, destinoid) => {
      const bloqueo = motivo_bloqueo(usuario, 'pipeline_prospectos')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      const veredicto = validar_mover_etapa(card, destinoid, {
        reservas, cobros, enganchemin: politica ? politica.enganche_minimo : 0,
      })
      if (veredicto) {
        // 'misma' no es un error: soltar la tarjeta donde ya estaba no cambia
        // nada y no debe reiniciar su contador de dias.
        if (veredicto.mensaje) mostrartoast('⚠️ ' + veredicto.mensaje, 8000)
        return { ok: false, motivo: veredicto.motivo }
      }

      const etapa = pipeline_etapas.find((e) => e.id === destinoid)
      setmoviendo(card.id)
      try {
        const cambiadaen = new Date().toISOString()
        const res = await actualizar_verificado(
          sb, usuario, 'pipeline_prospectos',
          { etapa: destinoid, etapa_cambiada_en: cambiadaen }, card.id, ['etapa']
        )
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio de etapa (0 filas).'
              : '⚠️ No se guardó el cambio de etapa en Supabase'
          )
          return { ok: false }
        }
        mostrartoast('Movido a ' + (etapa ? etapa.label : destinoid))
        registrar_movimiento(sb, {
          tipo: 'Pipeline',
          desc: 'Movida a mano · ' + card.nombre + ' → ' + (etapa ? etapa.label : destinoid),
          ref: card.folio || card.id,
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true }
      } finally {
        setmoviendo(null)
      }
    },
    [usuario, reservas, cobros, politica, mostrartoast, recargar]
  )

  // ── GENERAR LA RESERVA DESDE LA TARJETA ──────────────────────
  // El flujo obligatorio del negocio. Hereda, en este orden:
  //   1. la ECONOMIA de la tarjeta (bruto y descuento en pesos). Sin esto la
  //      reserva nacia con el precio de LISTA de la zona: el admin veia $233
  //      y el portal del cliente $9,750.
  //   2. el CUPON con el que se creo el prospecto (para reportes)
  //   3. el ESTADO DEL MAPA: la seccion queda 'reservada'
  //   4. los COBROS previos etiquetados con el folio del prospecto, que se
  //      re-etiquetan al folio real — el panel los veia, pero el portal no, y
  //      monto_pagado quedaba en 0
  //   5. la ETAPA, reevaluada con lo abonado
  const generar_reserva = useCallback(
    async (card, datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'reservas')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (guardando) return { ok: false }

      const j = (juegos || []).find((x) => String(x.id) === String(datos.juegoid))
      const a = (areas || []).find((x) => x.id === datos.zonaid)
      if (!j || !a) { mostrartoast('⚠️ Elige el juego y la sección de la reserva'); return { ok: false } }
      if (reservas_activas(card, reservas).length > 0) {
        mostrartoast('⚠️ Este prospecto ya tiene su reserva vinculada.', 8000)
        return { ok: false }
      }

      setguardando(true)
      try {
        // 1. ECONOMIA HEREDADA: bruto de la tarjeta y el descuento en pesos
        //    que la separa de su monto neto.
        const bruto = bruto_tarjeta(card, datos.areamonto)
        const descpesos = Math.max(0, bruto - (Number(card.monto) || 0))
        const eco = economia_reserva(bruto, bruto > 0 ? descpesos / bruto : 0)
        const catalogo = (secciones || []).map(map_precio)
        const incluidas = min_seccion(a, catalogo, j) || 0
        const personas = incluidas + (Number(card.adultos) || 0) + (Number(card.ninos) || 0)
        // Nace SIN pago: los abonos previos se reconcilian abajo.
        const estadopago = estado_pago_reserva(0, eco.neto)

        let nuevoid = generar_folio_reserva('admin', reservas)
        let res = null
        for (let intento = 0; intento < 5; intento++) {
          res = await insertar_verificado(sb, usuario, 'reservas', {
            id: nuevoid, cliente: card.nombre, email: card.email, tel: card.tel,
            zona: a.nombre, zona_id: a.id, juego: etiqueta_juego(j), juego_id: j.id,
            monto: eco.bruto, descuento_monto: eco.descuento, monto_pagado: 0,
            pago: 'Sin pago', metodo: 'Tarjeta', personas,
            estado: 'Confirmada', estado_pago: estadopago,
            adultos: Number(card.adultos) || 0, ninos: Number(card.ninos) || 0,
            saldo_consumo: Number(card.consumomonto) || 0,
            cotizacion_id: card.cotizid || null,
          }, claves_legacy_reserva)
          if (res.ok || !es_duplicado(res.error)) break
          nuevoid = generar_folio_reserva('admin', reservas)
        }
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la reserva (0 filas). Revisa las políticas RLS de `reservas`.'
              : '⚠️ No se pudo crear la reserva' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        // 2. CUPON heredado. No fatal: lo unico que se pierde es la
        //    trazabilidad del cupon en reportes.
        if (card.codigodescuento) {
          const r = await actualizar_verificado(
            sb, usuario, 'reservas', { codigo_descuento: card.codigodescuento }, nuevoid, null
          )
          if (!r.ok) console.warn('codigo_descuento no se guardó en la reserva:', r.motivo)
        }

        // 3. ESTADO DEL MAPA. Si falla, la reserva existe pero el mapa la
        //    muestra libre y alguien puede venderla otra vez.
        const ocupa = await set_estado_zona(sb, usuario, j.id, a.id, 'reservada')
        if (!ocupa.ok) {
          mostrartoast(
            '⚠️ La reserva se creó, pero la sección NO se marcó como reservada. ' +
            'Márcala a mano desde el mapa.', 9000
          )
        }

        // 4. VINCULO tarjeta ↔ reserva. Es la columna vertebral del historial
        //    de pagos: un fallo silencioso aqui deja los cobros huerfanos.
        const ids = (card.reservaids || []).concat([nuevoid])
        const vinc = await actualizar_verificado(
          sb, usuario, 'pipeline_prospectos', { reserva_ids: ids }, card.id, null
        )
        if (!vinc.ok) {
          mostrartoast(
            '⚠️ La reserva se creó, pero NO quedó vinculada al prospecto ' +
            (card.folio || '') + '. Vincúlala manualmente desde el detalle.', 8000
          )
        }

        // 5. COBROS PREVIOS: los abonos registrados ANTES de generar la
        //    reserva viven con el folio del PROSPECTO. Se re-etiquetan al
        //    folio real, y despues se fija el pagado con la suma de DINERO
        //    REAL — los creditos siguen en cobros para el avance de etapa,
        //    pero no entran a monto_pagado.
        const folio = String(card.folio || '')
        const previos = folio
          ? (cobros || []).filter((c) => String(c.folio) === folio && !cobro_cancelado(c))
          : []
        let pagado = 0
        for (const c of previos) {
          const r = await actualizar_verificado(
            sb, usuario, 'cobros', { folio: String(nuevoid) }, c.id, ['folio']
          )
          if (!r.ok) {
            console.error('Re-etiquetado del cobro ' + c.id + ' falló:', r.motivo)
            continue
          }
          if (!es_cobro_credito(c)) pagado += Number(c.monto) || 0
        }
        if (pagado > 0) {
          const liquidada = eco.neto > 0 && pagado >= eco.neto
          const r = await actualizar_verificado(sb, usuario, 'reservas', {
            monto_pagado: redondear_dinero(pagado),
            estado_pago: liquidada ? 'pagado' : 'parcial',
            pago: liquidada ? 'Completo' : 'Parcial',
          }, nuevoid, ['monto_pagado', 'estado_pago', 'pago'])
          if (!r.ok) {
            mostrartoast(
              '⚠️ La reserva se creó, pero su saldo inicial no se pudo fijar. Revísalo.', 9000
            )
          }
        }

        mostrartoast('✅ Reserva creada: ' + a.nombre + ' · ' + nuevoid)
        registrar_movimiento(sb, {
          tipo: 'Reserva',
          desc: 'Nueva reserva desde ' + (card.folio || card.id) + ': ' + a.nombre +
            ' · vs ' + j.rival,
          ref: card.nombre,
          monto: pagado || null,
          usuario: usuario ? usuario.nombre : '—',
        })

        // 6. ETAPA, con la reserva y sus cobros YA en su sitio.
        try {
          const cardactualizada = { ...card, reservaids: ids }
          const cobrosdespues = (cobros || []).map((c) =>
            previos.some((p) => p.id === c.id) ? { ...c, folio: String(nuevoid) } : c
          )
          const reservanueva = {
            id: nuevoid, estado: 'Confirmada', monto: eco.bruto,
            descuentomonto: eco.descuento, montopagado: redondear_dinero(pagado),
            estadopago: pagado > 0 ? 'parcial' : estadopago,
          }
          const r = await sincronizar_etapa(sb, usuario, cardactualizada, {
            reservas: (reservas || []).concat([reservanueva]),
            cobros: cobrosdespues,
            cotizaciones: [],
            enganchemin: politica ? politica.enganche_minimo : 0,
          })
          if (r) mostrartoast(r.texto)
        } catch (e) {
          console.error('Sincronización de etapa tras generar la reserva falló:', e)
        }

        recargar()
        return { ok: true, id: nuevoid }
      } catch (err) {
        console.error('generar reserva desde prospecto:', err)
        mostrartoast('⚠️ No se pudo generar la reserva. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [
      usuario, guardando, juegos, areas, secciones, reservas, cobros, politica,
      mostrartoast, recargar,
    ]
  )

  return {
    puede, crear, editar, mover, generar_reserva, guardando, moviendo,
    areasestados,
  }
}

export default useprospectos
