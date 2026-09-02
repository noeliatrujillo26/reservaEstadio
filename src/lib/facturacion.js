// ═══════════════════════════════════════════════════════════════════
// facturacion.js — datos fiscales del titular de un cobro (CFDI).
// espejo 1:1 de v1: _buscarFacturacionCliente() y _REGIMEN_FISCAL_LABEL
// (js/modules/cobros.js 633-680).
// ═══════════════════════════════════════════════════════════════════

import { nombre_norm, tel_norm } from './clientes'

export const regimen_fiscal_label = {
  601: 'General de Ley Personas Morales',
  603: 'Personas Morales con Fines no Lucrativos',
  605: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  606: 'Arrendamiento',
  607: 'Enajenación o Adquisición de Bienes',
  608: 'Demás ingresos',
  610: 'Residentes en el Extranjero sin Establecimiento Permanente',
  611: 'Ingresos por Dividendos',
  612: 'Personas Físicas con Actividades Empresariales y Profesionales',
  614: 'Ingresos por intereses',
  615: 'Ingresos por obtención de premios',
  616: 'Sin obligaciones fiscales',
  620: 'Sociedades Cooperativas de Producción',
  621: 'Incorporación Fiscal',
  622: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  623: 'Opcional para Grupos de Sociedades',
  624: 'Coordinados',
  625: 'Actividades Empresariales con Plataformas Tecnológicas',
  626: 'Régimen Simplificado de Confianza (RESICO)',
}

// Datos fiscales del titular de un cobro. Salen del CATALOGO de clientes, que
// viene de Supabase (columna jsonb `facturacion`).
//
// La identidad se resuelve como en todo el panel: TELEFONO + nombre primero, y
// el correo solo como ultimo recurso — varios titulares comparten el
// corporativo, y emitir una factura con el RFC de otro seria grave.
//
// NOTA DE MIGRACION: la v1 consulta ademas un espejo en localStorage
// (_loadClientesExtra) como respaldo. Aqui no se migra: ese espejo es
// justamente lo que causaba que en otro equipo o tras limpiar la cache el
// detalle saliera sin datos fiscales. La base es la unica fuente.
export function buscar_facturacion_cliente(email, nombre, tel, clientes) {
  const norm = (s) => String(s || '').toLowerCase().trim()
  const lista = clientes || []
  const telbuscado = tel_norm(tel)
  const nombuscado = nombre_norm(nombre)

  let c = null
  if (telbuscado) {
    c = lista.find((x) => {
      const t = tel_norm(x.tel)
      if (!t || t !== telbuscado) return false
      const n = nombre_norm(x.nombre)
      // sin nombre en alguno de los dos manda el telefono: es el mismo titular.
      return !n || !nombuscado || n === nombuscado
    })
  }
  if (!c && nombuscado) c = lista.find((x) => nombre_norm(x.nombre) === nombuscado)
  if (!c && email) c = lista.find((x) => norm(x.email) === norm(email))
  return (c && c.facturacion) || null
}

// Etiqueta legible de un regimen: "626 · Régimen Simplificado de Confianza".
export function regimen_legible(regimen) {
  if (!regimen) return '—'
  return regimen + ' · ' + (regimen_fiscal_label[regimen] || '')
}
