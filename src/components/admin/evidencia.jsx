// ═══════════════════════════════════════════════════════════════════
// evidencia.jsx — visor de comprobantes (imagen o PDF).
// espejo 1:1 de v1: mostrarEvidenciaPreview() (js/modules/utils.js).
//
// El modal abre DE INMEDIATO con la liga guardada y la firma se renueva en
// segundo plano: asi no se retrasa la apertura y, cuando el bucket deje de ser
// publico, los registros antiguos —que guardaron una URL publica— se reparan
// solos sin tocar la base.
//
// Si la liga esta rota (404 de Storage, firma vencida) se muestra el aviso con
// Reintentar y Descargar, no el icono roto del navegador.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { sb } from '../../supabaseclient'
import { expira_url_visor, firmar_comprobante } from '../../lib/storage'
import { mxn2 } from '../../lib/dinero'

function evidencia_visor({ abierto, archivo, concepto, monto, fecha, oncerrar }) {
  const [src, setsrc] = useState(archivo || null)
  const [fallo, setfallo] = useState(false)
  // cambia al reintentar: fuerza al navegador a volver a pedir la imagen.
  const [intento, setintento] = useState(0)

  useEffect(() => {
    setsrc(archivo || null)
    setfallo(false)
    setintento(0)
  }, [archivo])

  // Re-firma en segundo plano. Si el usuario cerro el modal o cambio de
  // archivo mientras tanto, el resultado se descarta.
  useEffect(() => {
    if (!abierto || !archivo) return undefined
    let vivo = true
    firmar_comprobante(sb, archivo, expira_url_visor).then((fresca) => {
      if (vivo && fresca && fresca !== archivo) {
        setsrc(fresca)
        setfallo(false)
      }
    })
    return () => { vivo = false }
  }, [abierto, archivo])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    if (abierto) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [abierto, oncerrar])

  if (!abierto) return null

  const es_url = /^https?:\/\//i.test(archivo || '')
  const es_pdf = /\.pdf(\?|#|$)/i.test(archivo || '')

  async function reintentar() {
    const fresca = await firmar_comprobante(sb, archivo, expira_url_visor)
    setsrc(fresca || archivo)
    setfallo(false)
    setintento((n) => n + 1)
  }

  let vista
  if (src && es_pdf) {
    // PDF: visor embebido mas un boton claro por si el navegador bloquea el
    // iframe (varios lo hacen con documentos de otro origen).
    vista = (
      <>
        <iframe
          src={src} title="Comprobante PDF"
          style={{ width: '100%', height: '60vh', border: 'none', borderRadius: '8px', background: '#fff' }}
        />
        <button
          onClick={() => window.open(src, '_blank')}
          style={{
            marginTop: '8px', width: '100%', background: 'var(--surface-2)', color: 'var(--text)',
            border: '1px solid var(--border)', padding: '9px', borderRadius: '8px',
            fontWeight: 600, cursor: 'pointer', fontSize: '12px',
          }}
        >
          📄 Abrir / Descargar el PDF en pestaña nueva
        </button>
      </>
    )
  } else if (src && !fallo) {
    vista = (
      <img
        key={intento}
        src={src} alt="Comprobante" title="Clic para ver en tamaño completo"
        onClick={() => window.open(src, '_blank')}
        onError={() => setfallo(true)}
        style={{
          maxHeight: '60vh', objectFit: 'contain', width: '100%', borderRadius: '8px',
          display: 'block', cursor: 'zoom-in',
        }}
      />
    )
  } else if (src && fallo) {
    vista = (
      <div style={{
        background: 'var(--surface-2)', border: '2px dashed var(--border)', borderRadius: '8px',
        padding: '28px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚠️</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          No se pudo cargar el archivo original
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', margin: '6px 0 14px' }}>
          La liga pudo expirar o el archivo ya no existe en Storage.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reintentar}
            style={{ background: 'var(--naranja)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
          >
            🔄 Reintentar
          </button>
          <button
            onClick={() => window.open(src, '_blank')}
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
          >
            ⬇️ Descargar archivo
          </button>
        </div>
      </div>
    )
  } else {
    // Registro antiguo: solo se guardo el NOMBRE del archivo, sin liga. No hay
    // documento que mostrar, y se dice tal cual en vez de fingir uno.
    vista = (
      <div style={{
        background: 'var(--surface-2)', border: '2px dashed var(--border)', borderRadius: '8px',
        padding: '40px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>{es_pdf ? '📄' : '🖼️'}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
          {archivo || 'Comprobante'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
          {es_url
            ? 'No se pudo preparar la vista previa de este archivo.'
            : 'Registro antiguo: solo se guardó el nombre del archivo, sin liga al documento original.'}
        </div>
      </div>
    )
  }

  const dato = (k, v, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ color: 'var(--text-3)' }}>{k}</span>
      <span style={{ fontWeight: 600, color }}>{v}</span>
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: '12px', maxWidth: '680px', width: '100%',
        padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            Vista previa de comprobante
          </div>
          <button
            onClick={oncerrar} aria-label="Cerrar"
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ marginBottom: '12px' }}>{vista}</div>
        <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
          {dato('Concepto:', concepto || '—')}
          {dato('Monto:', monto != null ? '$' + Number(monto).toLocaleString('es-MX', mxn2) : '—', 'var(--naranja)')}
          {dato('Fecha:', fecha || '—')}
        </div>
        <button
          onClick={oncerrar}
          style={{
            marginTop: '14px', width: '100%', background: 'var(--naranja)', color: '#fff',
            border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

const Evidencia = evidencia_visor
export default Evidencia
