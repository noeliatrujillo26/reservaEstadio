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
  actualizar_verificado, borrar_verificado, insertar_verificado, mensajes_bloqueo,
  motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'
import {
  folios_de_prospecto, liberar_reservas_de_prospecto, msg_no_eliminable,
  puede_eliminarse, set_estado_zona, texto_fallo_estado,
} from '../lib/mapaocupacion'
import {
  cancelar_cobros_de_folios, cliente_id_de_cobro, mover_saldo_favor, saldo_favor_de,
  sincronizar_etapa, sincronizar_pago_reserva,
} from '../lib/cascadas'
import { subir_comprobante } from '../lib/storage'
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
import { area_por_nombre_zona, cobro_cancelado, es_pago_desde_saldo_favor } from '../lib/cobros'
import { es_cobro_credito, es_pago_credito } from '../lib/dashboard'
import { mxn2, redondear_dinero } from '../lib/dinero'
import { hoy_hermosillo } from '../lib/fechas'

const claves_legacy_prospecto = [
  'id', 'nombre', 'zona', 'serie', 'monto', 'etapa', 'badge', 'notas', 'vendedora', 'juego', 'tel',
]
const claves_legacy_reserva = [
  'id', 'cliente', 'email', 'tel', 'zona', 'juego', 'juego_id', 'monto',
  'descuento_monto', 'monto_pagado', 'pago', 'metodo', 'personas', 'estado', 'estado_pago',
]

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// claves originales de `cobros`, iguales que en Registro de Cobros.
const claves_legacy_cobro = [
  'fecha', 'mes', 'cliente', 'area', 'zona', 'concepto', 'monto', 'forma_pago',
  'fecha_reserva', 'recibio', 'factura', 'folio', 'notas', 'evidencia',
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
  const [borrando, setborrando] = useState(null)
  const [pagando, setpagando] = useState(false)

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
      // Los avisos NO se enseñan segun van saliendo: el toast tiene UNA sola
      // ranura, asi que el "✅ Reserva creada" del final borraba la
      // advertencia de la seccion sin apartar y el usuario nunca se enteraba.
      // Se juntan y se enseñan AL FINAL, despues del exito, para que lo ultimo
      // en pantalla sea lo que hay que atender.
      const avisos = []
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
        if (!ocupa.ok) avisos.push(texto_fallo_estado(ocupa, a.nombre))

        // 4. VINCULO tarjeta ↔ reserva. Es la columna vertebral del historial
        //    de pagos: un fallo silencioso aqui deja los cobros huerfanos.
        const ids = (card.reservaids || []).concat([nuevoid])
        const vinc = await actualizar_verificado(
          sb, usuario, 'pipeline_prospectos', { reserva_ids: ids }, card.id, null
        )
        if (!vinc.ok) {
          avisos.push(
            '⚠️ La reserva se creó, pero NO quedó vinculada al prospecto ' +
            (card.folio || '') + '. Vincúlala manualmente desde el detalle.'
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
            avisos.push('⚠️ La reserva se creó, pero su saldo inicial no se pudo fijar. Revísalo.')
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

        // El mapa se repinta con lo que la base tiene AHORA, y se ESPERA: sin
        // el await la vista podia quedarse un instante con la seccion todavia
        // libre justo despues de apartarla.
        await recargar()

        // Los avisos van al final, ya sin nada que los pise. Duran 9 s: no son
        // confirmaciones, son cosas que alguien tiene que ir a arreglar.
        if (avisos.length) mostrartoast(avisos.join(' · '), 9000)
        return { ok: true, id: nuevoid, avisos }
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


  // ── ELIMINAR PROSPECTO ───────────────────────────────────────
  // espejo de eliminarProspecto(). `confirmacion` = { motivo } cuando la
  // tarjeta tiene reservas (el llamador ya pidio contraseña); sin reservas
  // basta un si/no.
  //
  // LA TARJETA CON RESERVA NO SE BORRA: se archiva con etapa 'descartado'. Esa
  // fila-lapida conserva el vinculo reserva_ids, y sin ella la sincronizacion
  // automatica —que crea tarjetas para reservas sin vincular— la resucitaba en
  // cada recarga. Borrar la fila era justo lo que hacia reaparecer tarjetas
  // "de la nada". Un prospecto puro, sin reservas, si se borra de verdad:
  // nada lo recrea.
  const eliminar = useCallback(
    async (card, confirmacion) => {
      const bloqueo = motivo_bloqueo(usuario, 'pipeline_prospectos')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (!puede_eliminarse(card)) {
        mostrartoast(msg_no_eliminable, 8000)
        return { ok: false, motivo: 'boletos' }
      }
      const tienereservas = (card.reservaids || []).length > 0
      if (tienereservas && (!confirmacion || !confirmacion.motivo)) return { ok: false }

      setborrando(card.id)
      const avisos = []
      try {
        // 1. Los CREDITOS de la tarjeta dejan de ser cobrables. El dinero REAL
        //    no se toca aqui: ese cobro existio y su registro debe sobrevivir
        //    a la eliminacion. Los cobros reales se cancelan mas abajo, ya con
        //    la tarjeta fuera.
        const folios = folios_de_prospecto(card)

        // 2. Reservas y secciones, con sus dos salvaguardas.
        if (tienereservas) {
          const lib = await liberar_reservas_de_prospecto(sb, usuario, card, {
            reservas, areas, areasestados,
          })
          lib.avisos.forEach((a) => avisos.push(a))
          if (lib.liberadas.length) {
            mostrartoast('🟢 ' + lib.liberadas.length + ' sección(es) liberada(s) en el mapa')
          }
          registrar_movimiento(sb, {
            tipo: 'ELIMINACIÓN_RESERVA',
            desc: 'Reservas ' + (card.reservaids || []).map((x) => '#' + x).join(', ') +
              ' canceladas al eliminar el prospecto · ' + card.nombre +
              ' · Motivo: ' + confirmacion.motivo,
            ref: card.folio || card.id,
            usuario: usuario ? usuario.nombre : '—',
          })
        }

        // 3. La tarjeta: lapida si tenia reservas, borrado real si no.
        const res = tienereservas
          ? await actualizar_verificado(
            sb, usuario, 'pipeline_prospectos',
            { etapa: 'descartado', badge: 'Descartado' }, card.id, ['etapa']
          )
          : await borrar_verificado(sb, usuario, 'pipeline_prospectos', card.id)
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la eliminación (0 filas). Revisa las políticas RLS de `pipeline_prospectos`.'
              : '⚠️ No se pudo eliminar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }

        // 4. CASCADA DE COBROS: sin la tarjeta, sus pagos quedan sin dueño y
        //    seguirian inflando el Registro de Cobros y los Ingresos de
        //    Reportes. Se cancelan por las tres formas de folio.
        try {
          const r = await cancelar_cobros_de_folios(
            sb, usuario, folios, 'se eliminó el prospecto ' + (card.folio || card.id),
            { cobros, clientes, reservas }
          )
          r.avisos.forEach((a) => avisos.push(a))
          if (r.cancelados > 0) {
            mostrartoast('🧾 ' + r.cancelados + ' cobro(s) vinculado(s) cancelado(s)')
          }
        } catch (e) {
          console.error('Cascada de cobros al eliminar el prospecto falló:', e)
        }

        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Prospecto eliminado · ' + card.nombre +
            (confirmacion && confirmacion.motivo ? ' · Motivo: ' + confirmacion.motivo : ''),
          ref: card.folio || 'Pipeline Comercial',
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        mostrartoast('🗑 Prospecto eliminado · ' + card.nombre)
        if (avisos.length) mostrartoast(avisos.join(' · '), 9000)
        return { ok: true, avisos }
      } finally {
        setborrando(null)
      }
    },
    [
      usuario, reservas, areas, areasestados, cobros, clientes,
      mostrartoast, recargar,
    ]
  )

  // ── REGISTRAR UN PAGO DESDE LA TARJETA ───────────────────────
  // espejo de agregarPagoPD(). El cobro se inserta con el folio de la RESERVA
  // vinculada cuando existe —asi el portal Mis Reservas lo suma a su
  // historial— y con el del prospecto cuando todavia no hay reserva.
  //
  // datos = { concepto, forma, monto, requierefactura, archivo, pendiente }
  const registrar_pago = useCallback(
    async (card, datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'cobros')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (pagando) return { ok: false } // doble clic → un solo pago

      const monto = parseFloat(datos.monto) || 0
      if (!(monto > 0)) {
        mostrartoast('⚠️ Ingresa un monto válido')
        return { ok: false, campo: 'monto' }
      }
      const espendiente = !!datos.pendiente
      const concepto = String(datos.concepto || 'ABONO')
      const forma = espendiente ? 'PENDIENTE' : String(datos.forma || '')
      const escredito = !espendiente && es_pago_credito(concepto, forma)
      const essaldofavor = !espendiente && es_pago_desde_saldo_favor('', forma)

      // COMPROBANTE obligatorio, con cuatro excepciones y cada una por su
      // motivo: CREDITO no tiene archivo al momento; PENDIENTE todavia no es
      // un pago; EFECTIVO se recibe en mano sin documento externo; y el SALDO
      // A FAVOR ya entro antes con su propio comprobante.
      const esefectivo = !espendiente && forma === 'EFECTIVO'
      if (!escredito && !espendiente && !esefectivo && !essaldofavor && !datos.archivo) {
        mostrartoast(
          '⚠️ Por favor adjunta el comprobante de pago (imagen o PDF) para poder registrar el abono.',
          8000
        )
        return { ok: false, campo: 'comprobante' }
      }

      // PAGO DESDE SALDO A FAVOR: se valida contra la BASE, no contra lo que
      // muestra la pantalla. Entre abrir el detalle y pulsar Registrar, otra
      // caja pudo gastar ese saldo, y aplicar de mas dejaria al cliente con
      // saldo negativo: dinero que nunca entrego.
      let clienteid = null
      if (essaldofavor) {
        clienteid = card.clienteid != null
          ? card.clienteid
          : cliente_id_de_cobro(
            { cliente: card.nombre, email: card.email, tel: card.tel },
            { clientes, reservas }
          )
        if (clienteid == null) {
          mostrartoast(
            '⚠️ Este prospecto no está ligado a una ficha de cliente: no se puede aplicar saldo a favor.',
            8000
          )
          return { ok: false }
        }
        const saldoahora = await saldo_favor_de(sb, clienteid)
        if (saldoahora == null) {
          mostrartoast('⚠️ No se pudo consultar el saldo a favor. Intenta de nuevo.', 7000)
          return { ok: false }
        }
        if (saldoahora <= 0) {
          mostrartoast('⚠️ Este cliente no tiene saldo a favor disponible.', 7000)
          return { ok: false }
        }
        if (monto > saldoahora + 0.009) {
          mostrartoast(
            '⚠️ El monto (' + money(monto) + ') supera el saldo a favor disponible (' +
            money(saldoahora) + ').', 9000
          )
          return { ok: false }
        }
      }

      setpagando(true)
      const avisos = []
      try {
        // El comprobante SI frena aqui, al reves que en Registro de Cobros:
        // alli el dinero ya se recibio y perder el registro seria peor; aqui
        // el pago aun no existe y registrarlo sin su respaldo, habiendolo
        // exigido, seria contradecirse.
        let evidencia = ''
        if (datos.archivo) {
          const subida = await subir_comprobante(sb, datos.archivo, 'pipeline')
          if (!subida.url) {
            mostrartoast(
              '⚠️ No se pudo subir el comprobante' +
              (subida.error && subida.error.message ? ': ' + subida.error.message : '.') +
              ' Intenta de nuevo.', 8000
            )
            return { ok: false }
          }
          evidencia = subida.url
        }

        const reservavinc = (card.reservaids || [])
          .map((rid) => (reservas || []).find((r) => r.id === rid))
          .find((r) => r && String(r.estado || '').toLowerCase() !== 'cancelada') || null
        const zonanombre = reservavinc ? reservavinc.zona : card.zona || ''
        const areamatch = area_por_nombre_zona(zonanombre, areas)
        const fecha = hoy_hermosillo()
        const messtr = new Date().toLocaleDateString('es-MX', {
          month: 'long', timeZone: 'America/Hermosillo',
        })

        const res = await insertar_verificado(sb, usuario, 'cobros', {
          fecha,
          mes: messtr.charAt(0).toUpperCase() + messtr.slice(1),
          cliente: String(reservavinc ? reservavinc.cliente : card.nombre).toUpperCase(),
          email: (reservavinc ? reservavinc.email : card.email) || '',
          area: 'ASADOR',
          zona: zonanombre,
          zona_id: areamatch ? areamatch.id : '',
          concepto: concepto.toUpperCase(),
          monto: redondear_dinero(monto),
          forma_pago: forma,
          fecha_reserva: '',
          recibio: usuario ? usuario.nombre : '',
          factura: datos.requierefactura ? 'REQUERIDA' : '',
          folio: reservavinc ? String(reservavinc.id) : card.folio || '',
          notas: (essaldofavor ? 'Pago aplicado desde Saldo a Favor · ' : '') +
            'Pipeline Comercial · ' + card.nombre +
            (card.folio ? ' · Folio pipeline ' + card.folio : ''),
          evidencia,
        }, claves_legacy_cobro)
        if (!res.ok) {
          console.error('Error exacto de Supabase al guardar el pago:', res.error)
          mostrartoast(
            res.error && res.error.code === '42501'
              ? '⚠️ Tu rol no tiene permisos para registrar pagos.'
              : res.motivo === 'sin_filas'
                ? '⚠️ La base no aceptó el pago (0 filas). Revisa las políticas RLS de `cobros`.'
                : '⚠️ No se pudo guardar el pago: ' +
                  ((res.error && res.error.message) || 'error desconocido'),
            8000
          )
          return { ok: false }
        }
        const guardado = (res.datos && res.datos[0]) || null

        // Descontar del saldo a favor. DESPUES del insert: si el cobro no se
        // guardo, el saldo no se toca.
        let saldorestante = null
        if (essaldofavor) {
          const mov = await mover_saldo_favor(sb, usuario, clienteid, -redondear_dinero(monto))
          if (mov.ok) saldorestante = mov.saldo
          else {
            avisos.push(
              '⚠️ El pago quedó registrado, pero el saldo a favor del cliente NO se descontó' +
              (mov.motivo === 'insuficiente' ? ' (saldo insuficiente).' : '.') +
              ' Revísalo en su ficha.'
            )
          }
        }

        // Saldo de la reserva vinculada. Sin esto el abono quedaba solo en
        // cobros y el portal del cliente seguia mostrando el saldo viejo.
        let sync = null
        if (reservavinc) {
          try {
            sync = await sincronizar_pago_reserva(
              sb, usuario, reservavinc.id, redondear_dinero(monto), escredito
            )
            if (!sync.ok && sync.motivo !== 'reserva-no-encontrada') {
              avisos.push(
                '⚠️ El pago quedó registrado, pero el saldo de la reserva ' + reservavinc.id +
                ' no se actualizó. Revísalo.'
              )
            }
          } catch (e) {
            console.error('Sincronización de saldo falló (el abono sí quedó registrado):', e)
          }
        }

        mostrartoast(
          '✅ ¡Pago registrado! · ' + money(redondear_dinero(monto)) +
          (essaldofavor && saldorestante != null
            ? ' · Aplicado desde Saldo a Favor · Restante: ' + money(saldorestante) : '') +
          (sync && sync.liquidada ? ' · 💚 Reserva ' + reservavinc.id + ' LIQUIDADA' : '')
        )
        registrar_movimiento(sb, {
          tipo: 'Pago',
          desc: 'Pago registrado · ' + card.nombre + ' (' + concepto + ')' +
            (essaldofavor
              ? ' · Aplicado desde Saldo a Favor. Saldo restante: ' +
                (saldorestante != null ? money(saldorestante) : 'sin confirmar')
              : ''),
          ref: card.folio || '—',
          monto: redondear_dinero(monto),
          usuario: usuario ? usuario.nombre : '—',
        })

        // LA ETAPA SE REEVALUA SIEMPRE, no solo al liquidar. Antes esto colgaba
        // de "la reserva quedo liquidada", asi que un abono parcial —justo el
        // que cubre el enganche— no movia nada y la tarjeta se quedaba en su
        // columna hasta que alguien la arrastrara.
        try {
          const nuevo = guardado
            ? {
              id: guardado.id, folio: guardado.folio || '',
              monto: Number(guardado.monto) || 0, concepto: guardado.concepto || '',
              formapago: guardado.forma_pago || '', estado: guardado.estado || '',
            }
            : null
          const reservasdespues = (reservavinc && sync && sync.ok && !sync.credito)
            ? (reservas || []).map((r) => (r.id === reservavinc.id
              ? { ...r, montopagado: sync.pagado, estadopago: sync.estadopago, pago: sync.pagolabel }
              : r))
            : reservas
          const r = await sincronizar_etapa(sb, usuario, card, {
            reservas: reservasdespues,
            cobros: nuevo ? (cobros || []).concat([nuevo]) : cobros || [],
            cotizaciones: [],
            enganchemin: politica ? politica.enganche_minimo : 0,
          })
          if (r) mostrartoast(r.texto)
        } catch (e) {
          console.error('Sincronización de etapa tras el pago falló:', e)
        }

        await recargar()
        if (avisos.length) mostrartoast(avisos.join(' · '), 9000)
        return { ok: true, avisos }
      } catch (err) {
        console.error('registrar pago desde el prospecto:', err)
        mostrartoast('⚠️ No se pudo registrar el pago. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setpagando(false)
      }
    },
    [
      usuario, pagando, reservas, cobros, clientes, areas, politica,
      mostrartoast, recargar,
    ]
  )

  return {
    puede, crear, editar, mover, generar_reserva, eliminar, registrar_pago,
    guardando, moviendo, borrando, pagando, areasestados,
  }
}

export default useprospectos
