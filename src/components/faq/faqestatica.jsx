// ═══════════════════════════════════════════════════════════════════
// faqestatica.jsx — las 8 preguntas quemadas en el html de la v1
// (panel-inicio.html lineas 825-880).
//
// son el respaldo: si el admin edito la FAQ (columna `faq` de
// configuracion_landing) esas ganan, y si la consulta falla o viene vacia se
// muestran estas — la seccion nunca queda vacia por un error tecnico.
//
// las respuestas van como jsx porque algunas llevan <br> y <strong>, que en
// la version dinamica se pierden: ahi el texto se escapa y solo los saltos de
// linea se vuelven <br>, tal cual hace _cargarFaq().
// ═══════════════════════════════════════════════════════════════════

export const faq_estatica = [
  {
    pregunta: '¿Qué incluye la zona de asadores?',
    respuesta:
      'Tu reservación incluye el acceso al estadio, una zona de asador exclusiva y reservada para tu grupo, carne asada, costillas de puerco, salchichas para asar, frijoles y todos los complementos necesarios para disfrutar la experiencia (verduras, desechables y más). Además, contarás con personal de servicio, incluyendo un parrillero y un mesero.',
  },
  {
    pregunta: '¿Cómo funciona el proceso de pago?',
    respuesta:
      'Puedes reservar tu zona con anticipación y contarás con 5 días para realizar un anticipo del 50%, con el cual se confirma tu reservación. El 50% restante deberá liquidarse a más tardar 5 días antes del juego.',
  },
  {
    pregunta: '¿Puedo reservar para más de un juego?',
    respuesta:
      'Sí. Puedes reservar tu zona para uno o varios juegos de la temporada, sujeto a disponibilidad.',
  },
  {
    pregunta: '¿Qué pasa si necesito cancelar mi reserva?',
    respuesta:
      'Si por alguna razón necesitas cancelar tu reservación, podemos ayudarte a reagendarla para otra fecha disponible. En caso de solicitar un reembolso, este se realizará de acuerdo con nuestras políticas de cancelación. Las cancelaciones realizadas dentro de los 3 días previos al juego no son elegibles para cambios ni reembolsos.',
  },
  {
    pregunta: '¿Cómo recibo mi confirmación de reserva?',
    respuesta:
      'Una vez confirmada tu reservación, recibirás un mensaje por WhatsApp con todos los detalles de tu reserva.',
  },
  {
    pregunta: '¿Puedo llevar comida o bebidas a la zona?',
    respuesta: (
      <>
        No está permitido ingresar alimentos o bebidas del exterior al Estadio Fernando Valenzuela.
        Sin embargo, puedes adquirir alimentos y bebidas dentro del estadio y llevarlos a tu zona de
        asadores.
        <br />
        En caso de que desees llevar un pastel para celebrar una ocasión especial, sí está
        permitido; únicamente te pedimos informarlo con anticipación al momento de tu reservación o
        antes del día del evento.
      </>
    ),
  },
  {
    pregunta: '¿A qué hora debo llegar al estadio?',
    respuesta:
      'El acceso al estadio y a tu zona reservada estará disponible 1 hora antes del inicio del juego, para que disfrutes la experiencia con tranquilidad.',
  },
  {
    pregunta: '¿Cómo me contacto si tengo algún problema?',
    respuesta: (
      <>
        Puedes comunicarte con nosotros vía WhatsApp al <strong>662 119 5169</strong> o visitarnos
        en nuestra oficina ubicada en Plaza Girasol, dentro de Tienda Naranjeros, en el siguiente
        horario:
        <br />
        <br />
        • Lunes a viernes: 10:00 a.m. a 6:00 p.m.
        <br />• Sábados: 10:00 a.m. a 2:00 p.m.
      </>
    ),
  },
]

export default faq_estatica
