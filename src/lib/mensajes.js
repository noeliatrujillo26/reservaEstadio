// ═══════════════════════════════════════════════════════════════════
// mensajes.js — plantillas de mensajes automaticos.
// espejo 1:1 de v1: cargarMensajes() (js/21-mensajes.js).
//
// OJO: la v1 guarda estas plantillas en localStorage 'naranjeros-mensajes',
// NO en la base. Solo las ve el navegador donde se editaron; en otro equipo se
// muestran las quemadas en el html. Es una limitacion de la v1 que se
// conserva. Las dos excepciones (cotiza y referidos) SI viven en
// configuracion_landing y por eso llegan de la base.
// ═══════════════════════════════════════════════════════════════════

import mensajes_default from './mensajesdefault'

export const clave_mensajes = 'naranjeros-mensajes'

// mapa llave-de-localStorage -> id del campo en el html.
const por_clave = {
  waConfirmacion: 'msg-wa-confirmacion',
  waRecordatorio: 'msg-wa-recordatorio',
  waSaldo: 'msg-wa-saldo',
  emailAsunto: 'msg-email-asunto',
  emailConfirmacion: 'msg-email-confirmacion',
  emailAsuntoRec: 'msg-email-asunto-rec',
  emailRecordatorio: 'msg-email-recordatorio',
  pipProspecto: 'msg-pip-prospecto',
  pipReserva_momentanea: 'msg-pip-reserva_momentanea',
  pipCotizado: 'msg-pip-cotizado',
  pipReservado: 'msg-pip-reservado',
  pipCerrado: 'msg-pip-cerrado',
  pipBoletos_entregados: 'msg-pip-boletos_entregados',
  opsTel: 'msg-ops-tel',
  adminTel: 'msg-admin-tel',
}

// espejo de cargarMensajes(): lo guardado gana sobre lo quemado, y un valor
// vacio NO pisa el default (la v1 hace `if (el && val)`).
export function leer_mensajes() {
  const out = { ...mensajes_default }
  try {
    const raw = localStorage.getItem(clave_mensajes)
    if (!raw) return out
    const d = JSON.parse(raw)
    Object.keys(por_clave).forEach((k) => {
      if (d[k]) out[por_clave[k]] = d[k]
    })
  } catch (e) {}
  return out
}

// los bloques tal como los agrupa la pantalla de la v1.
export const grupos_mensajes = [
  { label: 'WhatsApp',
    sub: 'Mensajes enviados vía WhatsApp Business API. Usa {nombre}, {zona}, {juego}, {fecha}, {monto}, {folio} como variables.',
    campos: [
      { id: 'msg-wa-confirmacion', label: 'Confirmación de reserva' },
      { id: 'msg-wa-recordatorio', label: 'Recordatorio de juego' },
      { id: 'msg-wa-saldo', label: 'Aviso de saldo pendiente' },
    ] },
  { label: 'Correo electrónico', sub: 'Plantillas de los correos automáticos.',
    campos: [
      { id: 'msg-email-asunto', label: 'Asunto · confirmación', corto: true },
      { id: 'msg-email-confirmacion', label: 'Cuerpo · confirmación' },
      { id: 'msg-email-asunto-rec', label: 'Asunto · recordatorio', corto: true },
      { id: 'msg-email-recordatorio', label: 'Cuerpo · recordatorio' },
    ] },
  { label: 'Pipeline comercial', sub: 'Un mensaje por etapa del embudo.',
    campos: [
      { id: 'msg-pip-prospecto', label: 'Prospecto' },
      { id: 'msg-pip-reserva_momentanea', label: 'Reserva momentánea' },
      { id: 'msg-pip-cotizado', label: 'Cotizado' },
      { id: 'msg-pip-reservado', label: 'Reservado' },
      { id: 'msg-pip-cerrado', label: 'Cerrado' },
      { id: 'msg-pip-boletos_entregados', label: 'Boletos entregados' },
    ] },
  { label: 'Teléfonos', sub: 'Números que reciben avisos internos.',
    campos: [
      { id: 'msg-ops-tel', label: 'Operaciones', corto: true },
      { id: 'msg-admin-tel', label: 'Administración', corto: true },
    ] },
]
