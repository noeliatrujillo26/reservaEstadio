// ═══════════════════════════════════════════════════════════════════
// cotizaciones.js — propuestas comerciales.
// espejo 1:1 de v1: el map de cargarCotizacionesDesdeSupabase()
// (js/30-init.js), renderCotizKPIs(), renderCotizLista(), cotizMatchesTab(),
// COTIZ_ESTADOS y COTIZ_BADGE (js/modules/cotizaciones.js).
//
// ESCRITURA (Fase 2): guardarCotiz()/editarCotiz(), calcCotiz()/
// getCotizFromForm(), _validaCotizFecha() y confirmarMoverCotizPipeline()
// (js/modules/cotizaciones.js). Tres deviaciones deliberadas, documentadas:
//
//   1. DESGLOSE DE PRECIO: calcCotiz() de la v1 combina el descuento manual y
//      el de grupo POR SEPARADO (subtotal*pctManual/100 + subtotal*pctGrupo/100)
//      sin topar la suma en 100% — un manual de 80% mas un grupo de 30% da un
//      TOTAL NEGATIVO. Ese mismo bug ya se encontro y se corrigio del lado del
//      Pipeline (ver el comentario de calc_total_prospecto en prospectos.js).
//      Aqui se reutiliza esa MISMA funcion, ya corregida y probada, en vez de
//      repetir el calculo viejo: es el mismo modelo de negocio (manual + grupo,
//      aditivo, acotado a 100%) y una cotizacion con descuentos grandes ya no
//      puede quedar con un total negativo.
//   2. "OTRO (ESPECIFICAR)": la v1 permite un juego/zona de texto libre para
//      paquetes multi-juego o personalizados, con el Monto Área bloqueado o
//      liberado segun el caso. Se omite — igual que ya omite nuevoprospecto.jsx
//      del Pipeline, que tiene el mismo problema y resuelve igual — y el Monto
//      Área queda SIEMPRE editable (se autollena al elegir zona+juego, pero se
//      puede corregir a mano), lo que cubre el caso de catalogo Y el caso de un
//      paquete a medida sin necesitar una opcion "otro" aparte.
//   3. Se omiten el envio por WhatsApp/correo, el PDF, la eliminacion y el
//      candado de "clave de gerente" para descuentos grandes (pedirClaveGerente
//      de la v1 compara contra una contraseña compartida fija en el bundle del
//      cliente — un candado debil que ningun otro modulo de este panel replica;
//      las acciones sensibles aqui usan re-autenticacion real, como el resto
//      del panel). El tope de 100% de calc_total_prospecto ya evita el total
//      negativo; una autorizacion de gerente en forma es una funcionalidad
//      aparte, no pedida en este alcance.
// ═══════════════════════════════════════════════════════════════════

import { calc_total_prospecto, descuento_volumen_aplicable, nuevo_folio_prospecto } from './prospectos'
import { email_valido, tel_valido } from './reservasadmin'
import { redondear_dinero } from './dinero'

// MAPEADOR COMPLETO: la fila de `cotizaciones` trae 30+ columnas en
// snake_case. Se migran todas, no solo las que pinta la tabla — el resumen
// financiero del detalle las necesita.
export function map_cotizacion(c) {
  return {
    id: c.id,
    fecha: c.fecha,
    cliente: c.cliente,
    tel: c.tel,
    email: c.email,
    empresa: c.empresa || '',
    descripcion: c.descripcion,
    volumenpct: Number(c.descuento_volumen_pct) || 0,
    volumennombre: c.descuento_volumen_nombre || '',
    juegoid: c.juego_id != null && c.juego_id !== '' ? String(c.juego_id) : '',
    juegos: c.juegos,
    zonaid: c.zona_id || '',
    zona: c.zona || '',
    personasincluidas: c.personas_incluidas || '',
    consumodesc: c.consumo_desc,
    areamonto: c.area_monto,
    consumomonto: c.consumo_monto,
    extramonto: c.extra_monto || 0,
    adultoextraprecio: c.adulto_extra_precio || 0,
    adultoextracant: c.adulto_extra_cant || 0,
    adultosextramonto: c.adultos_extra_monto || 0,
    ninoextraprecio: c.nino_extra_precio || 0,
    ninoextracant: c.nino_extra_cant || 0,
    ninosextramonto: c.ninos_extra_monto || 0,
    descuento: c.descuento,
    subtotal: c.subtotal,
    iva: c.iva,
    total: c.total,
    metodospago: c.metodos_pago || [],
    notas: c.notas,
    // solo 'discada' es alterna; cualquier otro valor es carne asada.
    tipocomida: c.tipo_comida === 'discada' ? 'discada' : 'carne_asada',
    valida: c.valida,
    vendedora: c.vendedora,
    estado: c.estado,
    enpipeline: c.en_pipeline,
  }
}

export const cotiz_estados = ['Activa', 'Aprobada', 'Concretada', 'Rechazada', 'Vencida']

export const cotiz_badge = {
  Activa: 'badge-blue',
  Aprobada: 'badge-teal',
  Concretada: 'badge-green',
  Rechazada: 'badge-red',
  Vencida: 'badge-orange',
}

export const cotiz_tabs = [
  { id: 'activas', label: 'Activas', icono: '📝' },
  { id: 'aprobadas', label: 'Aprobadas', icono: '👍' },
  { id: 'concretadas', label: 'Concretadas', icono: '✅' },
  { id: 'rechazadas', label: 'Rechazadas', icono: '❌' },
  { id: 'vencidas', label: 'Vencidas', icono: '⏳' },
]

// la pestaña por omision ('activas') recoge TODO lo que sea Activa.
export function coincide_tab(c, tab) {
  if (tab === 'aprobadas') return c.estado === 'Aprobada'
  if (tab === 'concretadas') return c.estado === 'Concretada'
  if (tab === 'rechazadas') return c.estado === 'Rechazada'
  if (tab === 'vencidas') return c.estado === 'Vencida'
  return c.estado === 'Activa'
}

export function filtrar_cotizaciones(lista, busqueda, tab) {
  const q = String(busqueda || '').toLowerCase()
  return lista.filter(
    (c) =>
      (!q ||
        String(c.cliente || '').toLowerCase().includes(q) ||
        String(c.descripcion || '').toLowerCase().includes(q)) &&
      coincide_tab(c, tab)
  )
}

// espejo del sort de renderCotizLista(): texto en minusculas, resto tal cual.
export function ordenar_cotizaciones(lista, col, dir) {
  if (!col) return lista
  const d = dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    let av = a[col] || ''
    let bv = b[col] || ''
    if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase() }
    return av < bv ? -d : av > bv ? d : 0
  })
}

// los 5 KPIs se calculan sobre TODAS las cotizaciones, no sobre la pestaña
// activa — igual que renderCotizKPIs().
export function kpis_cotizaciones(lista) {
  return {
    total: lista.reduce((s, c) => s + (c.total || 0), 0),
    activas: lista.filter((c) => c.estado === 'Activa').length,
    aprobadas: lista.filter((c) => c.estado === 'Aprobada').length,
    concretadas: lista.filter((c) => c.estado === 'Concretada').length,
    rechazadas: lista.filter((c) => c.estado === 'Rechazada').length,
  }
}

// ── FOLIO ────────────────────────────────────────────────────────
// COT-001, COT-002… mismo criterio que nuevo_folio_prospecto: el siguiente
// sale del maximo YA usado en lo cargado, no de un contador de modulo — dos
// pestañas abiertas no se pisan.
export function folio_cotizacion(cotizaciones) {
  const max = (cotizaciones || []).reduce((m, c) => {
    const n = parseInt(String(c.id || '').replace(/^COT-0*/, ''), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return 'COT-' + String(max + 1).padStart(3, '0')
}

// ── VALIDACION DEL ALTA/EDICION ──────────────────────────────────
// Mismos tres campos que guardarCotiz(): el cliente es obligatorio, telefono y
// correo se validan SOLO si vienen — una cotizacion inicial puede no tener
// todavia un dato de contacto completo.
export function validar_cotizacion(d) {
  const errores = []
  if (!String(d.cliente || '').trim()) {
    errores.push({ campo: 'cliente', mensaje: 'Falta el nombre del cliente' })
  }
  const tel = String(d.tel || '').trim()
  if (tel && !tel_valido(tel)) {
    errores.push({ campo: 'tel', mensaje: 'El teléfono debe tener 10 dígitos' })
  }
  const email = String(d.email || '').trim()
  if (email && !email_valido(email)) {
    errores.push({ campo: 'email', mensaje: 'El email no es válido' })
  }
  return errores
}

// ── VIGENCIA ─────────────────────────────────────────────────────
// espejo de _validaCotizFecha(): fecha base + N dias (15 o 30), en formato
// ISO local — NUNCA toISOString(), que es UTC y corre el dia.
export function fecha_validez_cotizacion(fechabase, dias) {
  const d = new Date(fechabase + 'T12:00')
  d.setDate(d.getDate() + (parseInt(dias, 10) || 15))
  return d.toLocaleDateString('en-CA')
}

// ── DESGLOSE DE PRECIO ────────────────────────────────────────────
// espejo de calcCotiz()/getCotizFromForm() reutilizando calc_total_prospecto
// (ver la nota de deviacion #1 en la cabecera del archivo) y agregandole el
// desglose de IVA incluido que la v1 muestra en el cotizador: el "Subtotal"
// que se enseña es la base gravable REAL (total/1.16), y el IVA es la
// diferencia exacta — base + IVA suman el Total al centavo.
// La regla de volumen GANADORA se vuelve a buscar aqui, ademas de adentro de
// calc_total_prospecto: esta necesita el NOMBRE de la regla para guardarlo
// junto al porcentaje (descuento_volumen_nombre, columna de `cotizaciones`),
// y calc_total_prospecto solo devuelve el %. Mismos argumentos, misma
// funcion pura — no hay forma de que diverjan.
export function calcular_cotizacion(d, ctx) {
  const calc = calc_total_prospecto({ ...d, minpersonas: d.personasincluidas }, ctx)
  const base = redondear_dinero(calc.total / 1.16)
  const iva = redondear_dinero(calc.total - base)
  const regla = descuento_volumen_aplicable(
    (ctx && ctx.descuentosvolumen) || [], calc.personas, d.juegoid, d.zonaid
  )
  return { ...calc, base, iva, volumennombre: regla ? regla.nombre : '' }
}

// ── ESTADO ───────────────────────────────────────────────────────
// espejo de _cotizConcretaSoloViaPipeline(): desde Activa/Aprobada, el estado
// "Concretada" no se puede poner a mano — esa transicion es exclusiva del
// Pipeline Comercial, que ademas crea el prospecto.
export function cotiz_transicion_bloqueada(estadoactual, nuevo) {
  return (estadoactual === 'Activa' || estadoactual === 'Aprobada') && nuevo === 'Concretada'
}

// ¿La cotizacion sigue REALMENTE viva en el Pipeline? espejo de
// _cotizSigueEnPipeline(), la mitad de LECTURA: la bandera `enpipeline` no
// basta sola porque nunca se apagaba sin esto — pero apagarla es un efecto
// (escribe en la base) y vive en el hook, no aqui.
export function cotizacion_activa_en_pipeline(c, pipeline) {
  if (!c || !c.enpipeline) return false
  return (pipeline || []).some((p) => p && p.cotizid === c.id && p.etapa !== 'descartado')
}

// ── CONVERTIR EN PROSPECTO DEL PIPELINE ──────────────────────────
// espejo de confirmarMoverCotizPipeline(): arma la fila nueva de
// `pipeline_prospectos`. El folio y el id nacen aqui, no en la escritura, para
// poder probarse sin tocar la base.
//
// `c.total` es el NETO de la cotizacion (subtotal menos descuentos). Si
// llegara en 0 (fila vieja o guardada a medias) se recompone sumando sus
// partidas en vez de dejar el prospecto con un monto de 0.
export function cotizacion_a_prospecto_payload(c, ctx) {
  const area = (ctx.areas || []).find((a) => String(a.id) === String(c.zonaid))
  const monto = Number(c.total) > 0
    ? Number(c.total)
    : redondear_dinero(
        (Number(c.areamonto) || 0) + (Number(c.consumomonto) || 0) + (Number(c.extramonto) || 0) +
        (Number(c.adultosextramonto) || 0) + (Number(c.ninosextramonto) || 0)
      )
  return {
    id: 'p-' + c.id,
    folio: nuevo_folio_prospecto(ctx.pipeline),
    nombre: c.cliente,
    email: c.email || '',
    tel: c.tel || '',
    zona_id: c.zonaid || '',
    zona: area ? area.nombre : (c.zona || c.consumodesc || '—'),
    serie: '',
    juego: c.juegoid || '',
    descripcion: c.descripcion || '',
    monto,
    descuento: Number(c.descuento) || 0,
    adultos: c.adultoextracant || 0,
    ninos: c.ninoextracant || 0,
    consumo_monto: c.consumomonto || 0,
    extra_monto: c.extramonto || 0,
    adulto_extra_precio: c.adultoextraprecio || 0,
    nino_extra_precio: c.ninoextraprecio || 0,
    etapa: 'cotizado',
    badge: 'Panel Admin',
    notas: c.notas || '',
    vendedora: c.vendedora || '',
    cotiz_id: c.id,
    tipo_comida: c.tipocomida === 'discada' ? 'discada' : 'carne_asada',
    etapa_cambiada_en: new Date().toISOString(),
  }
}
