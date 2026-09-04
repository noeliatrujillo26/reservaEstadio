// ═══════════════════════════════════════════════════════════════════
// ajustes.js — parámetros globales del sistema (tabla app_config).
//
// SIN EQUIVALENTE 1:1 EN LA V1: sus "ajustes" viven repartidos en tres
// sitios distintos, ninguno editable desde el panel — datos fiscales y de
// contacto hardcodeados en js/00-config.js (el app_config ESTATICO del
// cliente, ver lib/config.js — un archivo DISTINTO a este, no confundir: ese
// es la configuracion del SITIO, este es la tabla NUEVA del panel), la
// plantilla de recibos/cotizaciones en el localStorage de CADA navegador
// (nrj_cotiz_plantilla, no se comparte entre sesiones), y no existe pagina
// de Ajustes en absoluto. Ver migracion-app-config.sql para la tabla nueva y
// sus politicas RLS.
//
// ALCANCE: este modulo es para el PANEL ADMIN unicamente. El sitio publico
// (recibos/checkout) sigue leyendo su copia estatica de lib/config.js /
// api/_lib/config.js sin cambios — conectar esos flujos a esta tabla es
// trabajo aparte, deliberadamente fuera de este modulo para no arriesgar el
// checkout en produccion.
// ═══════════════════════════════════════════════════════════════════

// MAPEADOR: la fila de `app_config` es una sola (id=1, ver la migracion),
// con dos bloques JSONB. Ambos llegan con default '{}' de la base, nunca
// null, pero se defiende de todos modos.
export function map_config(c) {
  const fiscal = (c && c.fiscal) || {}
  const plantilla = (c && c.plantilla_recibos) || {}
  return {
    fiscal: {
      razonsocial: fiscal.razon_social || '',
      nombrecomercial: fiscal.nombre_comercial || '',
      rfc: fiscal.rfc || '',
      domicilio: fiscal.domicilio || '',
      telefonos: fiscal.telefonos || '',
    },
    cuentabancariadefaultid: c && c.cuenta_bancaria_default_id != null
      ? String(c.cuenta_bancaria_default_id)
      : '',
    plantillarecibos: {
      nombre: plantilla.nombre || '',
      color: plantilla.color || '',
      logourl: plantilla.logo_url || '',
    },
    actualizadoen: (c && c.actualizado_en) || null,
    actualizadopor: (c && c.actualizado_por) || '',
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
