// Configuración CENTRAL del servidor (correos, recibos hospedados,
// cotizaciones por email). ESPEJO de js/00-config.js — el cliente y el
// servidor no comparten módulos (scripts clásicos vs CommonJS), así que
// test-config-paridad.js exige que ambos digan EXACTAMENTE lo mismo.
// Para cambiar temporada/contacto/fiscales: editar ambos archivos.

const SITE_URL = process.env.SITE_URL || 'https://reservaestadio.com';

const temporada = '2026-2027';

// Comisión de servicio del pago EN LÍNEA (Stripe): fracción sobre el monto
// base. Cambiarla aquí Y en js/00-config.js (paridad vigilada por test).
const COMISION_PCT = 0.07;

module.exports = {
  SITE_URL,
  temporada,
  COMISION_PCT,
  temporadaLabel: 'Temporada ' + temporada,
  marcaSubtitulo: 'Zonas de Asadores · Temporada ' + temporada,

  // Logo servido desde NUESTRO dominio (URL absoluta: los correos lo exigen).
  logoUrl: SITE_URL + '/logo-naranjeros.png',

  contacto: {
    email: 'asistencia@naranjeros.com',
    telAsistencia: '6626629029',
    telAsistenciaBonito: '(662) 662-9029',
    telOperaciones: '6621282950',
  },


  // Notas legales de los recibos de pago (mismas líneas en panel y correos).
  leyendas: {
    comprobante: 'Este comprobante ampara el pago recibido descrito arriba. Consérvalo para cualquier aclaración.',
    factura: 'En caso de requerir factura, favor de solicitarla dentro del mes correspondiente a la fecha de compra.',
  },
  fiscal: {
    razonSocial: 'CLUB DEPORTIVO TRIPLE "A" S.A. DE C.V.',
    nombreComercial: 'Naranjeros de Hermosillo',
    rfc: 'CDT 990319 SR7',
    domicilio: 'BLVD. HECTOR ESPINO 2 A, COLONIA LAS PROVINCIAS · HERMOSILLO, SONORA, MEX. C.P. 83243',
    telefonos: '662 119 5169 y 662 260 6933',
  },
};
