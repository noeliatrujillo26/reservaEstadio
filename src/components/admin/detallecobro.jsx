// ═══════════════════════════════════════════════════════════════════
// detallecobro.jsx — modal de detalle de un cobro.
// espejo 1:1 de v1: verDetalleCobro() y #modal-cobro-detalle
// (js/modules/cobros.js 687-808 · index.html).
//
// Reune en un solo sitio lo que estaba repartido: los datos del cobro, los
// DATOS FISCALES del titular (para poder facturar sin ir a su ficha), el CFDI
// adjunto, el comprobante de pago y las dos acciones — recibo y cancelacion.
//
// El interruptor de "Requiere factura" es el MISMO de la tabla: un solo hook,
// para que no puedan divergir. En un cobro cancelado queda estatico, porque el
// registro se conserva tal cual.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { usetoast } from '../../context/toastcontext'
import usefactura from '../../hooks/usefactura'
import usecfdi from '../../hooks/usecfdi'
import Evidencia from './evidencia'
import {
  cobro_cancelado, concepto_color, folio_reserva, formato_fecha, hora_cobro,
  requiere_factura,
} from '../../lib/cobros'
import { es_cobro_credito } from '../../lib/dashboard'
import { buscar_facturacion_cliente, regimen_legible } from '../../lib/facturacion'
import { mxn2 } from '../../lib/dinero'
import { abrir_recibo_cobro } from '../../lib/recibo'
import { es_recibo_auto } from '../../lib/storage'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

function chip({ label, children, color }) {
  return (
    <div className="info-chip">
      <div className="info-chip-label">{label}</div>
      <div className="info-chip-val" style={color ? { color } : undefined}>{children}</div>
    </div>
  )
}
const Chip = chip

function detalle_cobro({ cobro, oncerrar, oncancelar, cancelando }) {
  const { reservas, areas, clientes } = useadmindatos()
  const { mostrartoast } = usetoast()
  const { alternar: alternar_factura, guardando, puede: puede_editar } = usefactura()
  const { adjuntar, subiendo } = usecfdi()
  const [verevidencia, setverevidencia] = useState(false)
  const refpdf = useRef(null)
  const refxml = useRef(null)

  // El telefono no vive en `cobros`: sale de la reserva a la que apunta el
  // folio, que es donde el panel lo tiene.
  const reserva = useMemo(
    () => (cobro && cobro.folio
      ? (reservas || []).find((r) => String(r.id) === String(cobro.folio)) || null
      : null),
    [cobro, reservas]
  )
  const facturacion = useMemo(
    () => (cobro
      ? buscar_facturacion_cliente(cobro.email, cobro.cliente, reserva ? reserva.tel : '', clientes)
      : null),
    [cobro, reserva, clientes]
  )

  if (!cobro) return null

  const cancelado = cobro_cancelado(cobro)
  const hora = hora_cobro(cobro)
  const recibo_auto = es_recibo_auto(cobro.evidencia)

  function descargar_recibo() {
    // No se puede saber si el navegador bloqueo la ventana sin intentarlo;
    // cuando pasa hay que decirlo, o el boton parece no hacer nada.
    if (!abrir_recibo_cobro(cobro, { reservas, areas })) {
      mostrartoast('⚠️ Permite ventanas emergentes para ver el recibo')
    }
  }

  function ver_comprobante() {
    if (recibo_auto) window.open(cobro.evidencia, '_blank')
    else setverevidencia(true)
  }

  const archivo_cfdi = (campo) => (campo === 'facturapdf' ? cobro.facturapdf : cobro.facturaxml)

  function bloque_cfdi(campo, etiqueta, accept, ref) {
    const url = archivo_cfdi(campo)
    return (
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Archivo {etiqueta}</label>
        {url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--verde)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ✅ {etiqueta} adjunto
            </span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => window.open(url, '_blank')}>
              Ver
            </button>
            {puede_editar && (
              <button
                type="button" className="btn btn-ghost btn-xs"
                onClick={() => ref.current && ref.current.click()}
                disabled={subiendo === campo}
              >
                {subiendo === campo ? '…' : 'Reemplazar'}
              </button>
            )}
          </div>
        ) : puede_editar ? (
          <button
            type="button" className="btn btn-outline btn-sm w-full"
            onClick={() => ref.current && ref.current.click()}
            disabled={subiendo === campo}
          >
            {subiendo === campo ? 'Subiendo…' : '📎 Cargar ' + etiqueta}
          </button>
        ) : (
          <span className="td-muted" style={{ fontSize: '12px' }}>Sin {etiqueta}</span>
        )}
        <input
          ref={ref} type="file" accept={accept} style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            e.target.value = '' // permite volver a elegir el mismo archivo
            if (f) adjuntar(cobro, campo, f)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '620px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{cobro.cliente}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
              {(cobro.folio ? 'Recibo ' + cobro.folio + ' · ' : '') + formato_fecha(cobro.fecha)}
            </div>
          </div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '4px' }}>
            <Chip label="Fecha">
              {formato_fecha(cobro.fecha) + (hora ? ' · ' + hora : '') + ' · ' + (cobro.mes || '')}
            </Chip>
            <Chip label="Monto" color="var(--naranja)">{money(cobro.monto)}</Chip>
            <Chip label="Concepto">
              <span className={'badge ' + (concepto_color[cobro.concepto] || 'badge-gray')}>
                {cobro.concepto}
              </span>
              {es_cobro_credito(cobro) && (
                <span
                  className="badge badge-orange"
                  style={{ marginLeft: '6px' }}
                  title="Compromiso de pago a crédito: NO es dinero cobrado"
                >
                  Pendiente de cobro
                </span>
              )}
            </Chip>
            <Chip label="Forma de pago">{cobro.formapago || '—'}</Chip>
            <Chip label="Área / Zona">{(cobro.area || '—') + ' · ' + (cobro.zona || '—')}</Chip>
            <Chip label="Recibió">{cobro.recibio || '—'}</Chip>
            <Chip label="N° Recibo">{cobro.folio || '—'}</Chip>
            <Chip label="Folio de Reserva">{folio_reserva(cobro, reservas, areas) || '—'}</Chip>
            {/* Mismo interruptor que la tabla. En un cancelado queda estatico. */}
            <Chip label="Requiere factura" color={requiere_factura(cobro) ? 'var(--rojo)' : 'var(--text-3)'}>
              {cancelado || !puede_editar ? (
                requiere_factura(cobro) ? '✓ Sí' : 'No'
              ) : (
                <button
                  type="button"
                  onClick={() => alternar_factura(cobro)}
                  disabled={guardando === cobro.id}
                  title="Clic para cambiar el estado de factura"
                  style={{
                    cursor: 'pointer', borderRadius: '999px', padding: '3px 10px',
                    fontSize: '12px', fontWeight: 700,
                    ...(requiere_factura(cobro)
                      ? { background: 'var(--rojo-bg, #FEE2E2)', border: '1px solid var(--rojo)', color: 'var(--rojo)' }
                      : { background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)' }),
                  }}
                >
                  {guardando === cobro.id ? '…' : requiere_factura(cobro) ? '✓ Sí · cambiar' : 'No · cambiar'}
                </button>
              )}
            </Chip>
            <Chip label="Email">{cobro.email || '—'}</Chip>
          </div>

          {cobro.notas && (
            <div className="info-chip" style={{ marginTop: 0, marginBottom: '4px' }}>
              <div className="info-chip-label">Notas</div>
              <div className="info-chip-val" style={{ fontSize: '13px', fontWeight: 500 }}>
                {cobro.notas}
              </div>
            </div>
          )}

          {/* ── Datos fiscales del titular ── */}
          {facturacion && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: '8px' }}>
                🧾 Datos de facturación
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Chip label="RFC">{facturacion.rfc || '—'}</Chip>
                <Chip label="Régimen fiscal">{regimen_legible(facturacion.regimen)}</Chip>
                <Chip label="Razón social">{facturacion.razonSocial || '—'}</Chip>
                <Chip label="Uso de CFDI">{facturacion.usoCfdi || '—'}</Chip>
                <Chip label="Código postal">{facturacion.cp || '—'}</Chip>
              </div>
              {/* La constancia enlazada evita ir a la ficha del cliente para
                  emitir la factura desde aqui. */}
              {facturacion.constanciaUrl ? (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={facturacion.constanciaUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--naranja)', textDecoration: 'none' }}
                  >
                    📄 Ver Constancia de Situación Fiscal
                    {facturacion.constanciaArchivo && (
                      <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
                        ({facturacion.constanciaArchivo})
                      </span>
                    )}
                  </a>
                </div>
              ) : facturacion.constanciaArchivo ? (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)' }}>
                  📄 {facturacion.constanciaArchivo} · cargada en otro equipo, sin enlace disponible
                </div>
              ) : null}
            </div>
          )}

          {/* ── CFDI: solo cuando el cobro lo requiere ── */}
          {requiere_factura(cobro) && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: '8px' }}>
                📑 Factura (CFDI)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {bloque_cfdi('facturapdf', 'PDF', 'application/pdf', refpdf)}
                {bloque_cfdi('facturaxml', 'XML', '.xml,text/xml', refxml)}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          {cobro.evidencia && (
            <button className="btn btn-outline btn-sm" onClick={ver_comprobante}
              title={recibo_auto ? 'Recibo digital generado automáticamente por el sistema' : ''}>
              {recibo_auto ? '🧾 Ver recibo' : '📎 Ver comprobante'}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={descargar_recibo}>📄 Recibo PDF</button>
          <div style={{ flex: 1 }} />
          {puede_editar && !cancelado && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => oncancelar(cobro)}
              disabled={cancelando === cobro.id}
            >
              {cancelando === cobro.id ? '…' : '⛔ Cancelar cobro'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={oncerrar}>Cerrar</button>
        </div>
      </div>

      <Evidencia
        abierto={verevidencia}
        archivo={cobro.evidencia}
        concepto={cobro.concepto}
        monto={cobro.monto}
        fecha={formato_fecha(cobro.fecha)}
        oncerrar={() => setverevidencia(false)}
      />
    </div>
  )
}

const DetalleCobro = detalle_cobro
export default DetalleCobro
