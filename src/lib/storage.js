// ═══════════════════════════════════════════════════════════════════
// storage.js — comprobantes de pago en Supabase Storage.
// espejo 1:1 de v1: _subirComprobante(), _comprobanteExcedeLimite(),
// _esCarpetaPublica() y las constantes del bucket (js/modules/utils.js
// 954-1050).
//
// El bucket `comprobantes_pagos` mezcla dos clases de objetos con necesidades
// OPUESTAS, y confundirlas rompe cosas en direcciones distintas:
//   · recibos/, cotizaciones/, pipeline/ → documentos de CLIENTES (nombre,
//     correo, telefono, desglose de pagos). Van FIRMADOS: con URL publica
//     basta conocer la ruta para descargarlos sin credenciales.
//   · zonas/ → fotos que pinta la LANDING PUBLICA. Las descarga el navegador
//     de un visitante anonimo, asi que firmarlas las romperia.
// ═══════════════════════════════════════════════════════════════════

const bucket = 'comprobantes_pagos'
const carpetas_publicas = ['zonas']
// Un anio: la URL se guarda en la base y puede viajar por correo.
const expira_url_guardada = 60 * 60 * 24 * 365
// Limite de tamanio para comprobantes adjuntos (imagen o PDF): 10 MB.
export const limite_comprobante_bytes = 10 * 1024 * 1024

export function comprobante_excede_limite(file) {
  return !!file && file.size >= limite_comprobante_bytes
}

export function es_carpeta_publica(carpeta) {
  return carpetas_publicas.indexOf(String(carpeta || '').split('/')[0]) !== -1
}

// Nombre de objeto seguro: sin acentos ni espacios, con marca de tiempo para
// que dos archivos con el mismo nombre no se pisen.
export function ruta_comprobante(file, carpeta, ahora) {
  const ext = (String(file.name || '').match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase()
  const limpio = String(file.name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)
  return carpeta + '/' + (ahora != null ? ahora : Date.now()) + '_' + limpio + ext
}

// Devuelve { url, ruta, error }. NUNCA lanza: quien llama decide si el fallo
// del archivo debe frenar la operacion. En el registro de cobros NO frena — el
// dinero ya se recibio, y perder el registro por un archivo seria peor.
export async function subir_comprobante(sb, file, carpeta) {
  if (!file) return { url: null, ruta: null, error: null }
  if (comprobante_excede_limite(file)) {
    return {
      url: null, ruta: null,
      error: { message: 'El archivo supera el límite permitido. Por favor sube un comprobante menor a 10 MB.' },
    }
  }
  try {
    const ruta = ruta_comprobante(file, carpeta)
    const { error: uperr } = await sb.storage.from(bucket).upload(ruta, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uperr) return { url: null, ruta: null, error: uperr }

    if (es_carpeta_publica(carpeta)) {
      const { data } = sb.storage.from(bucket).getPublicUrl(ruta)
      return { url: data.publicUrl, ruta, error: null }
    }
    const { data, error: firmaerr } = await sb.storage
      .from(bucket).createSignedUrl(ruta, expira_url_guardada)
    if (firmaerr || !data || !data.signedUrl) {
      return {
        url: null, ruta,
        error: firmaerr || { message: 'No se pudo firmar la URL del comprobante.' },
      }
    }
    return { url: data.signedUrl, ruta, error: null }
  } catch (e) {
    return { url: null, ruta: null, error: e }
  }
}
