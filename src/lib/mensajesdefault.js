// ═══════════════════════════════════════════════════════════════════
// mensajesdefault.js — plantillas de mensajes quemadas en el html de la v1
// (index.html, seccion #page-mensajes).
//
// La v1 las guarda en localStorage 'naranjeros-mensajes' con cargarMensajes()
// / guardarMensajes(): NO viven en la base, asi que solo las ve el navegador
// donde se editaron. Estas son las que se muestran cuando no hay nada
// guardado. Se conservan textual.
// ═══════════════════════════════════════════════════════════════════

export const mensajes_default = {
  "msg-wa-confirmacion": "¡Hola {nombre}! 🧡 Tu reserva en Naranjeros está confirmada.\n\n📍 Zona: {zona}\n⚾ Juego: {juego} — {fecha}\n💰 Monto pagado: {monto}\n🎫 Folio: {folio}\n\n¡Te esperamos en el estadio! Presentate 30 min antes.\n\n🏟️ *Recuerda:* a más tardar *72 horas antes del evento* recibirás tus boletos de entrada al estadio. Cualquier duda, comunícate al *(662) 662-9029*.\n\n🎉 Usa el siguiente código con tus amigos y obtengan 10% de descuento en tienda física o en línea: HMO-NARANJERO2026",
  "msg-wa-recordatorio": "¡Hola {nombre}! 🧡 Mañana es el juego. Tu zona: {zona}. ¡Vamos Naranjeros! 🔶🔷",
  "msg-wa-saldo": "Hola {nombre}, tienes un saldo pendiente de {monto} para tu reserva ({folio}). Liquida antes del juego para conservar tu lugar. ¡Gracias! 🧡",
  "msg-email-confirmacion": "Hola {nombre},\n\nTu reserva en Naranjeros de Hermosillo ha sido confirmada exitosamente.\n\n  Zona: {zona}\n  Juego: {juego} · {fecha}\n  Monto: {monto}\n  Folio: {folio}\n\nPreséntate 30 minutos antes del juego con este folio. Ante cualquier duda escríbenos al WhatsApp o a contacto@naranjeros.mx.\n\n¡Vamos Naranjeros! 🧡\nEquipo Naranjeros de Hermosillo",
  "msg-email-recordatorio": "Hola {nombre},\n\nMañana se juega {juego} y tu zona {zona} te espera. Llega 30 minutos antes para disfrutar al máximo.\n\n¡Vamos Naranjeros! 🧡",
  "msg-pip-prospecto": "Hola {nombre} 👋, soy del equipo de Naranjeros de Hermosillo 🧡. Me gustaría platicarte sobre nuestras zonas exclusivas para esta temporada. ¿Te interesa conocer opciones para {zona}?",
  "msg-pip-cotizado": "Hola {nombre}, te compartimos la propuesta para la zona {zona} por un monto de ${monto} 📋. ¿Tienes alguna pregunta? Recuerda que los lugares son limitados. ¡No te quedes sin el tuyo! 🧡",
  "msg-pip-reserva_momentanea": "Hola {nombre}, ¡apartamos momentáneamente la zona {zona} para ti! 🧡 Para confirmar tu reserva realiza tu enganche a la brevedad — el apartado es temporal y está sujeto a disponibilidad. ¿Te compartimos los datos de pago?",
  "msg-pip-reservado": "Hola {nombre} 🎉, tu zona {zona} está reservada para esta temporada. Monto: ${monto}. Si tienes saldo pendiente, recuerda liquidarlo antes del primer juego. ¡Nos vemos en el estadio! ⚾🧡\n\n🏟️ *Recuerda:* a más tardar *72 horas antes del evento* recibirás tus boletos de entrada al estadio. Cualquier duda, comunícate al *(662) 662-9029*.",
  "msg-pip-cerrado": "Hola {nombre} ✅, ¡todo listo! Tu zona {zona} está confirmada y el pago registrado. ¡Gracias por ser parte de Naranjeros! Nos vemos en el Estadio Fernando Valenzuela 🧡🔶\n\n🏟️ *Recuerda:* a más tardar *72 horas antes del evento* recibirás tus boletos de entrada al estadio. Cualquier duda, comunícate al *(662) 662-9029*.",
  "msg-pip-boletos_entregados": "Hola {nombre} 🎟️, ¡tus boletos para {juego} ya fueron enviados! Tu zona {zona} está lista. Preséntalos en el acceso el día del juego. ¡Nos vemos en el Estadio Fernando Valenzuela! ⚾🧡\n\nCualquier duda, comunícate al *(662) 662-9029*.",
  "msg-cotiza-wa": "",
  "msg-referidos-wa": "",
  "msg-email-asunto": "✅ Reserva confirmada · Naranjeros de Hermosillo — Folio {folio}",
  "msg-email-asunto-rec": "⚾ Mañana es el juego · {zona} te espera",
  "msg-ops-tel": "6621282950",
  "msg-admin-tel": ""
}

export default mensajes_default
