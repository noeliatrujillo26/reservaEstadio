// ═══════════════════════════════════════════════════════════════════
// usecotizacionesescritura.js — CREAR, EDITAR, cambiar ESTADO y CONVERTIR una
// cotización en prospecto del Pipeline.
// espejo 1:1 de v1: guardarCotiz(), cambiarEstadoCotiz() y
// confirmarMoverCotizPipeline() (js/modules/cotizaciones.js).
//
// LO QUE ARRASTRA CADA UNA
//   guardar               → inserta o reescribe la fila de `cotizaciones`.
//                            fecha y vigencia se RECALCULAN desde hoy en cada
//                            guardado —tambien al editar—, igual que
//                            guardarCotiz(): editar una cotizacion la
//                            re-cotiza, no conserva la fecha original.
//   cambiar_estado         → cambia el estado, con el candado de "Concretada"
//                            solo-vía-Pipeline (cotiz_transicion_bloqueada).
//   convertir_a_prospecto  → re-verifica disponibilidad EN VIVO contra
//                            Supabase, inserta la fila nueva en
//                            `pipeline_prospectos` y marca la cotizacion
//                            en_pipeline=true / estado='Concretada'. Si la
//                            bandera en_pipeline quedo colgada —el prospecto
//                            que apuntaba se elimino del tablero— se
//                            autorepara antes de bloquear el reenvio, igual
//                            que _cotizSigueEnPipeline()/_liberarCotizDePipeline
//                            de la v1: solo cuando el Pipeline YA cargo
//                            (`cargando` en false), nunca contra un tablero
//                            todavia vacio por no haber terminado de leerse.
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
import {
  calcular_cotizacion, cotiz_transicion_bloqueada, cotizacion_a_prospecto_payload,
  cotizacion_activa_en_pipeline, fecha_validez_cotizacion, folio_cotizacion, validar_cotizacion,
} from '../lib/cotizaciones'
import { hoy_hermosillo } from '../lib/fechas'

const claves_legacy_cotiz = [
  'fecha', 'cliente', 'tel', 'email', 'descripcion', 'juegos', 'consumo_desc',
  'area_monto', 'consumo_monto', 'descuento', 'subtotal', 'iva', 'total', 'notas',
  'valida', 'vendedora', 'estado', 'en_pipeline',
]
const claves_legacy_prospecto = [
  'id', 'nombre', 'zona', 'serie', 'monto', 'etapa', 'badge', 'notas', 'vendedora', 'juego', 'tel',
]

function es_duplicado(error) {
  return !!error && (error.code === '23505' || /duplicate key/i.test(error.message || ''))
}

export function usecotizacionesescritura() {
  const { usuario } = useadmin()
  const { cotizaciones, descuentosvolumen, areas, pipeline, cargando, recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [moviendo, setmoviendo] = useState(null)

  const puede = motivo_bloqueo(usuario, 'cotizaciones') === null

  // ── CREAR / EDITAR ───────────────────────────────────────────
  // datos = { editando, cliente, tel, email, empresa, descripcion, juegoid,
  //           zonaid, zona, personasincluidas, consumodesc, areamonto,
  //           consumomonto, extramonto, adultoextraprecio, adultoextracant,
  //           ninoextraprecio, ninoextracant, descuento, diasvalida, notas,
  //           tipocomida, vendedora }
  const guardar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'cotizaciones')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (guardando) return { ok: false }

      const errores = validar_cotizacion(datos)
      if (errores.length) {
        mostrartoast(
          '⚠️ ' + errores[0].mensaje +
          (errores.length > 1 ? ' (+' + (errores.length - 1) + ' campo(s) más)' : '')
        )
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      setguardando(true)
      try {
        const calc = calcular_cotizacion(datos, { descuentosvolumen })
        const editando = datos.editando || null
        const hoy = hoy_hermosillo()
        const valida = fecha_validez_cotizacion(hoy, datos.diasvalida)

        const payload = {
          fecha: hoy,
          cliente: String(datos.cliente).trim().toUpperCase(),
          tel: datos.tel || '',
          email: datos.email || '',
          empresa: datos.empresa || '',
          descripcion: datos.descripcion || '',
          juego_id: datos.juegoid || '',
          juegos: '',
          zona_id: datos.zonaid || '',
          zona: datos.zona || '',
          personas_incluidas: datos.personasincluidas || '',
          consumo_desc: datos.consumodesc || '',
          area_monto: Number(datos.areamonto) || 0,
          consumo_monto: Number(datos.consumomonto) || 0,
          extra_monto: Number(datos.extramonto) || 0,
          adulto_extra_precio: Number(datos.adultoextraprecio) || 0,
          adulto_extra_cant: calc.adultocant,
          adultos_extra_monto: (Number(datos.adultoextraprecio) || 0) * calc.adultocant,
          nino_extra_precio: Number(datos.ninoextraprecio) || 0,
          nino_extra_cant: calc.ninocant,
          ninos_extra_monto: (Number(datos.ninoextraprecio) || 0) * calc.ninocant,
          descuento: calc.manualpct,
          subtotal: calc.subtotal,
          iva: calc.iva,
          total: calc.total,
          descuento_volumen_pct: calc.volumenpct || null,
          descuento_volumen_nombre: calc.volumenpct ? calc.volumennombre : null,
          notas: datos.notas || '',
          tipo_comida: datos.tipocomida === 'discada' ? 'discada' : 'carne_asada',
          valida,
          vendedora: datos.vendedora || '',
          estado: editando ? editando.estado : 'Activa',
          en_pipeline: editando ? !!editando.enpipeline : false,
        }

        let res = null
        let nuevoid = null
        if (editando) {
          res = await actualizar_verificado(sb, usuario, 'cotizaciones', payload, editando.id, claves_legacy_cotiz)
        } else {
          // Folio secuencial COT-001, COT-002… — igual que el de prospectos,
          // con el mismo riesgo (dos pestañas creando a la vez), asi que se
          // reintenta con el siguiente numero si choca. 5 intentos: mas que
          // eso ya no es una coincidencia, es un fallo real.
          nuevoid = folio_cotizacion(cotizaciones)
          for (let intento = 0; intento < 5; intento++) {
            res = await insertar_verificado(
              sb, usuario, 'cotizaciones', { id: nuevoid, ...payload }, ['id', ...claves_legacy_cotiz]
            )
            if (res.ok || !es_duplicado(res.error)) break
            const n = parseInt(nuevoid.replace(/^COT-0*/, ''), 10) || 0
            nuevoid = 'COT-' + String(n + 1).padStart(3, '0')
          }
        }
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la cotización (0 filas). Revisa las políticas RLS de `cotizaciones`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        const id = editando ? editando.id : nuevoid
        mostrartoast('✅ Cotización ' + (id || '') + ' guardada')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: (editando ? 'Cotización editada · ' : 'Cotización creada · ') + (id || ''),
          ref: payload.cliente,
          monto: calc.total || null,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true, id }
      } catch (err) {
        console.error('guardar cotización:', err)
        mostrartoast('⚠️ No se pudo guardar la cotización. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, cotizaciones, descuentosvolumen, mostrartoast, recargar]
  )

  // ── CAMBIAR ESTADO ────────────────────────────────────────────
  const cambiar_estado = useCallback(
    async (cotizacion, nuevo) => {
      const bloqueo = motivo_bloqueo(usuario, 'cotizaciones')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }

      if (cotiz_transicion_bloqueada(cotizacion.estado, nuevo)) {
        mostrartoast('⚠️ Para concretar una cotización activa, debes procesarla a través del Pipeline.')
        return { ok: false }
      }

      const res = await actualizar_verificado(
        sb, usuario, 'cotizaciones', { estado: nuevo }, cotizacion.id, ['estado']
      )
      if (!res.ok) {
        mostrartoast(
          res.motivo === 'sin_filas'
            ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `cotizaciones`.'
            : '⚠️ No se pudo actualizar en Supabase' +
              ((res.error && res.error.message) ? ': ' + res.error.message : '.')
        )
        return { ok: false }
      }
      mostrartoast('Estado de ' + cotizacion.id + ' → ' + nuevo)
      registrar_movimiento(sb, {
        tipo: 'Admin',
        desc: 'Estado de cotización cambiado · ' + cotizacion.id + ' → ' + nuevo,
        ref: cotizacion.cliente,
        usuario: usuario ? usuario.nombre : '—',
      })
      await recargar()
      return { ok: true }
    },
    [usuario, mostrartoast, recargar]
  )

  // ── CONVERTIR EN PROSPECTO DEL PIPELINE ──────────────────────
  const convertir_a_prospecto = useCallback(
    async (cotizacion) => {
      const bloqueo = motivo_bloqueo(usuario, 'pipeline_prospectos')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (moviendo) return { ok: false }

      // Autorreparacion de la bandera colgada: solo con el Pipeline YA
      // cargado (nunca contra un tablero vacio por no haber terminado de
      // leerse — se respeta el valor guardado en ese caso, igual que la v1).
      if (cotizacion.enpipeline && !cargando && !cotizacion_activa_en_pipeline(cotizacion, pipeline)) {
        await actualizar_verificado(
          sb, usuario, 'cotizaciones', { en_pipeline: false, estado: 'Activa' }, cotizacion.id, ['en_pipeline', 'estado']
        )
        cotizacion = { ...cotizacion, enpipeline: false, estado: 'Activa' }
      }
      if (cotizacion_activa_en_pipeline(cotizacion, pipeline)) {
        mostrartoast('Ya está en el Pipeline')
        return { ok: false }
      }

      setmoviendo(cotizacion.id)
      try {
        // Re-verificacion de disponibilidad EN TIEMPO REAL contra Supabase, no
        // el cache local: si otra persona tomo la seccion despues de crearse
        // la cotizacion, la conversion se bloquea aqui.
        if (cotizacion.juegoid && cotizacion.zonaid) {
          try {
            let ocupado = false
            const rz = await sb.from('zona_juego_estado').select('estado')
              .eq('juego_id', cotizacion.juegoid).eq('zona_id', cotizacion.zonaid).maybeSingle()
            if (!rz.error && rz.data && rz.data.estado && rz.data.estado !== 'libre') ocupado = true
            if (!ocupado) {
              const rr = await sb.from('reservas').select('id, estado')
                .eq('zona_id', cotizacion.zonaid).eq('juego_id', cotizacion.juegoid)
              if (!rr.error && (rr.data || []).some((r) => !/cancelad/i.test(r.estado || ''))) ocupado = true
            }
            if (ocupado) {
              mostrartoast('⛔ No se puede confirmar: la sección ya fue ocupada por otro cliente.')
              return { ok: false }
            }
          } catch (edisp) {
            console.error('Verificación de disponibilidad en vivo falló:', edisp)
          }
        }

        const payload = cotizacion_a_prospecto_payload(cotizacion, { areas, pipeline })
        let res = await insertar_verificado(sb, usuario, 'pipeline_prospectos', payload, claves_legacy_prospecto)

        // LLAVE DUPLICADA: el prospecto 'p-COT-XXX' ya existe (se envio antes
        // y se archivo como 'descartado', o un envio previo no alcanzo a
        // marcar la cotizacion). Se REVIVE la fila existente en vez de fallar
        // — mismo criterio que la v1.
        if (!res.ok && es_duplicado(res.error)) {
          const sinid = { ...payload }
          delete sinid.id
          res = await actualizar_verificado(sb, usuario, 'pipeline_prospectos', sinid, payload.id, null)
        }
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

        const rescot = await actualizar_verificado(
          sb, usuario, 'cotizaciones', { en_pipeline: true, estado: 'Concretada' }, cotizacion.id,
          ['en_pipeline', 'estado']
        )
        if (!rescot.ok) console.warn('No se pudo marcar en_pipeline:', rescot.motivo)

        mostrartoast('✅ ' + cotizacion.cliente + ' enviado al Pipeline Comercial · Cotizado')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Cotización movida al Pipeline · ' + cotizacion.id,
          ref: cotizacion.cliente,
          monto: cotizacion.total || null,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } catch (err) {
        console.error('convertir cotización en prospecto:', err)
        mostrartoast('⚠️ No se pudo enviar al Pipeline: ' + (err.message || err))
        return { ok: false }
      } finally {
        setmoviendo(null)
      }
    },
    [usuario, moviendo, areas, pipeline, cargando, mostrartoast, recargar]
  )

  return { puede, guardar, guardando, cambiar_estado, convertir_a_prospecto, moviendo }
}

export default usecotizacionesescritura
