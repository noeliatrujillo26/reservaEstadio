// ═══════════════════════════════════════════════════════════════════
// ajustes.js — parámetros globales del sistema (tabla configuracion_panel).
//
// espejo PARCIAL de v1: configuracion_panel (clave → valor jsonb) es la
// MISMA tabla que agrego la v1 el 01 sep 2026 para 'mensajes',
// 'cotiz_plantilla' y 'desc_max_sin_autorizacion' — ver
// migracion-configuracion-panel.sql. Las llaves 'fiscal' y
// 'cuenta_bancaria_default_id' de aqui abajo son NUEVAS, sin equivalente en
// la v1 (sus datos fiscales viven hardcodeados en js/00-config.js — el
// app_config ESTATICO del cliente, ver lib/config.js, un archivo DISTINTO a
// este). 'cotiz_plantilla' SI reutiliza la llave de la v1, aunque v2 guarda
// su propia forma del bloque (nombre/color/logourl) en vez de la de la v1
// (logo/color/nombre/condiciones) — ver la migracion para el detalle.
//
// Este modulo reemplaza a la tabla app_config (fila unica, columnas fijas)
// que usaba la primera version de Ajustes en v2: sus datos ya se copiaron a
// configuracion_panel por la migracion; app_config sigue en la base sin
// usarse, como respaldo.
//
// ALCANCE: este modulo es para el PANEL ADMIN unicamente. El sitio publico
// (recibos/checkout) sigue leyendo su copia estatica de lib/config.js /
// api/_lib/config.js sin cambios — conectar esos flujos a esta tabla es
// trabajo aparte, deliberadamente fuera de este modulo para no arriesgar el
// checkout en produccion.
// ═══════════════════════════════════════════════════════════════════

// MAPEADOR: `filas` es el arreglo crudo de configuracion_panel (una fila por
// llave, puede faltar cualquiera de las tres si nunca se ha guardado).
export function map_config(filas) {
  const porclave = {}
  ;(filas || []).forEach((f) => { if (f && f.clave) porclave[f.clave] = f })

  const fiscalfila = porclave.fiscal
  const fiscal = (fiscalfila && fiscalfila.valor) || {}
  const plantillafila = porclave.cotiz_plantilla
  const plantilla = (plantillafila && plantillafila.valor) || {}
  const cuentafila = porclave.cuenta_bancaria_default_id

  // "ultima actualizacion" = la mas reciente de las tres llaves que este
  // modulo usa — cada una se guarda por separado, ya no hay una fila unica.
  const actualizadoen = [fiscalfila, plantillafila, cuentafila]
    .filter(Boolean)
    .map((f) => f.actualizado_en)
    .filter(Boolean)
    .sort()
    .pop() || null

  return {
    fiscal: {
      razonsocial: fiscal.razon_social || '',
      nombrecomercial: fiscal.nombre_comercial || '',
      rfc: fiscal.rfc || '',
      domicilio: fiscal.domicilio || '',
      telefonos: fiscal.telefonos || '',
    },
    cuentabancariadefaultid: cuentafila && cuentafila.valor != null
      ? String(cuentafila.valor)
      : '',
    plantillarecibos: {
      nombre: plantilla.nombre || '',
      color: plantilla.color || '',
      logourl: plantilla.logo_url || '',
    },
    actualizadoen,
  }
}

// ── VALIDACION ────────────────────────────────────────────────────
// Ningun campo es obligatorio: una organizacion puede guardar solo una
// parte (por ejemplo, primero la cuenta bancaria y despues lo fiscal). El
// unico candado real es el formato del RFC, y SOLO si viene capturado —
// vacio es valido.
const rfc_valido = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export function validar_config(d) {
  const errores = []
  const rfc = String((d.fiscal && d.fiscal.rfc) || '').trim().toUpperCase()
  if (rfc && !rfc_valido.test(rfc.replace(/\s+/g, ''))) {
    errores.push({ campo: 'rfc', mensaje: 'El RFC no tiene un formato válido.' })
  }
  return errores
}
