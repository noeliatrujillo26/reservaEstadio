// ═══════════════════════════════════════════════════════════════════
// config.js — configuracion CENTRAL del cliente.
// espejo 1:1 de v1: js/00-config.js (ahi era el global window.APP_CONFIG).
//
// misma advertencia que la v1: api/_lib/config.js del servidor debe decir
// EXACTAMENTE lo mismo — test-config-paridad.js falla si divergen. para
// cambiar temporada, contacto o datos fiscales: editar AMBOS archivos.
//
// en la v1 un "estampador" recorria el dom buscando [data-config="ruta"] y
// escribia el texto. en la spa eso ya no hace falta: los componentes leen
// estos valores directo como props/variables.
// ═══════════════════════════════════════════════════════════════════

// origen absoluto: los recibos/pdf se imprimen en ventanas nuevas y los
// correos exigen urls absolutas — nada de rutas relativas para el logo.
const origen =
  typeof location !== 'undefined' && location.origin && location.origin.indexOf('http') === 0
    ? location.origin
    : 'https://reservaestadio.com'

const temporada = '2026-2027'

// comision de servicio del pago EN LINEA (stripe): fraccion sobre el monto
// base. cambiarla aqui Y en api/_lib/config.js (paridad vigilada por test).
const comision_pct = 0.07

export const app_config = {
  temporada,
  COMISION_PCT: comision_pct,
  temporadalabel: 'Temporada ' + temporada,
  marcasubtitulo: 'Zonas de Asadores · Temporada ' + temporada,

  logourl: origen + '/logo-naranjeros.png',

  contacto: {
    email: 'asistencia@naranjeros.com',
    telasistencia: '6626629029',
    telasistenciabonito: '(662) 662-9029',
    teloperaciones: '6621282950',
  },

  // notas legales de los recibos de pago (mismas lineas en panel y correos).
  leyendas: {
    comprobante:
      'Este comprobante ampara el pago recibido descrito arriba. Consérvalo para cualquier aclaración.',
    factura:
      'En caso de requerir factura, favor de solicitarla dentro del mes correspondiente a la fecha de compra.',
  },

  fiscal: {
    razonsocial: 'CLUB DEPORTIVO TRIPLE "A" S.A. DE C.V.',
    nombrecomercial: 'Naranjeros de Hermosillo',
    rfc: 'CDT 990319 SR7',
    domicilio:
      'BLVD. HECTOR ESPINO 2 A, COLONIA LAS PROVINCIAS · HERMOSILLO, SONORA, MEX. C.P. 83243',
    telefonos: '662 119 5169 y 662 260 6933',
  },
}

export default app_config
