// ═══════════════════════════════════════════════════════════════════
// usecfdi.js — adjuntar el CFDI (PDF y XML) a un cobro.
// espejo de v1: _cargarFacturaArchivo() (js/modules/cobros.js 617-643).
//
// DESVIACION DELIBERADA, Y POR QUE.
// La v1 lee el archivo con FileReader y lo deja en memoria
// (`cobros[i].facturaPDF = { nombre, dataUrl }`). Nunca llega a Supabase: al
// recargar la pagina el CFDI desaparece, y en otro equipo nunca estuvo.
// Migrar eso tal cual seria peor aqui, porque la v2 RELEE de la base despues
// de cada escritura — el adjunto se borraria casi al instante.
//
// Asi que el archivo se sube a Storage (carpeta facturas/) y su liga se guarda
// en cobros.factura_pdf / factura_xml (migracion-cobros-cfdi.sql).
//
// Si esas columnas todavia no existen NO se pierde nada: el archivo YA quedo
// subido y su liga se registra en la bitacora de movimientos, con un aviso que
// nombra la migracion que falta. El CFDI es un documento fiscal; perderlo por
// una columna ausente no es una opcion.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, es_error_columna, mensajes_bloqueo, motivo_bloqueo,
  registrar_movimiento,
} from '../lib/escritura'
import { subir_comprobante } from '../lib/storage'

// campo del cobro → columna de la base, etiqueta y validacion del archivo.
const campos = {
  facturapdf: {
    columna: 'factura_pdf',
    etiqueta: 'PDF',
    valido: (f) => f.type === 'application/pdf',
    error: '⚠️ Selecciona un archivo PDF',
  },
  facturaxml: {
    columna: 'factura_xml',
    etiqueta: 'XML',
    valido: (f) => /\.xml$/i.test(f.name),
    error: '⚠️ Selecciona un archivo XML',
  },
}

export function usecfdi() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [subiendo, setsubiendo] = useState(null) // 'facturapdf' | 'facturaxml'

  const puede = motivo_bloqueo(usuario, 'cobros') === null

  const adjuntar = useCallback(
    async (cobro, campo, archivo) => {
      const def = campos[campo]
      if (!def || !archivo) return { ok: false }

      const bloqueo = motivo_bloqueo(usuario, 'cobros')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (!def.valido(archivo)) {
        mostrartoast(def.error)
        return { ok: false }
      }

      setsubiendo(campo)
      try {
        const subida = await subir_comprobante(sb, archivo, 'facturas')
        if (!subida.url) {
          mostrartoast(
            '⚠️ No se pudo subir el ' + def.etiqueta + ' del CFDI' +
            (subida.error && subida.error.message ? ': ' + subida.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        const res = await actualizar_verificado(
          sb, usuario, 'cobros', { [def.columna]: subida.url }, cobro.id, null
        )

        // El archivo YA esta guardado en Storage pase lo que pase. La bitacora
        // deja su liga siempre, asi que aunque la columna falte el CFDI es
        // recuperable desde Movimientos.
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc:
            'Factura CFDI cargada (' + def.etiqueta + ') · ' + (cobro.cliente || '—') +
            ' · ' + archivo.name + ' · ' + subida.url,
          ref: cobro.folio || '—',
          usuario: usuario ? usuario.nombre : '—',
        })

        if (!res.ok) {
          mostrartoast(
            es_error_columna(res.error)
              ? '⚠️ El ' + def.etiqueta + ' se subió y quedó registrado en Movimientos, pero no se ' +
                'pudo ligar al cobro: falta correr migracion-cobros-cfdi.sql en Supabase.'
              : '⚠️ El ' + def.etiqueta + ' se subió, pero no se pudo ligar al cobro' +
                (res.motivo === 'sin_filas' ? ' (la base no aceptó el cambio).' : '.'),
            9000
          )
          return { ok: false, subido: true, url: subida.url }
        }

        mostrartoast('✅ ' + def.etiqueta + ' de factura cargado')
        recargar()
        return { ok: true, url: subida.url }
      } finally {
        setsubiendo(null)
      }
    },
    [usuario, mostrartoast, recargar]
  )

  return { adjuntar, subiendo, puede }
}

export default usecfdi
