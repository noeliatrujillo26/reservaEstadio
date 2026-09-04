// ═══════════════════════════════════════════════════════════════════
// cotizaciones.jsx — propuestas comerciales.
// espejo 1:1 de v1: #page-cotizaciones de index.html (lineas 2277-2350),
// renderCotizKPIs(), renderCotizTabs() y renderCotizLista()
// (js/modules/cotizaciones.js).
//
// ESCRITURA (Fase 2): crear/editar (cotizform.jsx), cambiar estado y enviar al
// Pipeline Comercial — ver usecotizacionesescritura.js y la cabecera de
// lib/cotizaciones.js para las deviaciones deliberadas frente a la v1. Sigue
// SIN MIGRAR: enviar por WhatsApp o correo, descargar PDF, eliminar y la
// plantilla de la cotizacion.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import usecotizacionesescritura from '../../hooks/usecotizacionesescritura'
import CotizForm from './cotizform'
import {
  cotiz_badge, cotiz_estados, cotiz_tabs, coincide_tab, cotizacion_activa_en_pipeline,
  filtrar_cotizaciones, kpis_cotizaciones, ordenar_cotizaciones,
} from '../../lib/cotizaciones'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

const columnas = [
  { id: 'id', texto: 'Folio' },
  { id: 'fecha', texto: 'Creación' },
  { id: 'cliente', texto: 'Cliente' },
  { id: null, texto: 'Vendedor' },
  { id: 'total', texto: 'Total' },
  { id: 'valida', texto: 'Válida hasta' },
  { id: null, texto: 'Estado' },
]

export default function cotizaciones() {
  const { cotizaciones: todas, pipeline, cargando, errores } = useadmindatos()
  const { puede, guardar, guardando, cambiar_estado, convertir_a_prospecto, moviendo } = usecotizacionesescritura()

  const [tab, settab] = useState('activas')
  const [busqueda, setbusqueda] = useState('')
  const [orden, setorden] = useState({ col: null, dir: 'asc' })
  const [detalle, setdetalle] = useState(null)
  const [form, setform] = useState(null) // { editando } | null

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') setdetalle(null) }
    if (detalle) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [detalle])

  // El detalle abierto sigue a la fila real: al guardar un cambio (estado,
  // edicion, envio al Pipeline) recargar() trae una fila nueva y el modal se
  // quedaria mostrando la version vieja si no se resincroniza aqui.
  useEffect(() => {
    if (!detalle) return
    const actual = todas.find((c) => c.id === detalle.id)
    if (actual && actual !== detalle) setdetalle(actual)
  }, [todas, detalle])

  // los 5 KPIs miran TODAS las cotizaciones, no la pestaña activa.
  const kpis = useMemo(() => kpis_cotizaciones(todas), [todas])

  const filas = useMemo(() => {
    const f = filtrar_cotizaciones(todas, busqueda, tab)
    return ordenar_cotizaciones(f, orden.col, orden.dir)
  }, [todas, busqueda, tab, orden])

  // el contador de cada pestaña ignora la busqueda, como en renderCotizTabs().
  const conteos = useMemo(() => {
    const m = {}
    cotiz_tabs.forEach((t) => { m[t.id] = todas.filter((c) => coincide_tab(c, t.id)).length })
    return m
  }, [todas])

  function ordenar_por(col) {
    if (!col) return
    setorden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  }

  const tarjetas = [
    { label: 'Total cotizado', valor: money(kpis.total), color: 'var(--naranja)', icono: '💼' },
    { label: 'Activas', valor: kpis.activas, color: 'var(--azul)', icono: '📋' },
    { label: 'Aprobadas', valor: kpis.aprobadas, color: 'var(--teal)', icono: '👍' },
    { label: 'Concretadas', valor: kpis.concretadas, color: 'var(--verde)', icono: '✅' },
    { label: 'Rechazadas', valor: kpis.rechazadas, color: 'var(--rojo)', icono: '❌' },
  ]

  return (
    <div className="page active" id="page-cotizaciones">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Cotizaciones</h2>
            <p>Propuestas de zonas de asadores y su seguimiento</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="input" id="cotiz-search" placeholder="Buscar cliente, descripción..."
              style={{ width: '240px', fontSize: '13px' }}
              value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
            />
            {puede && (
              <button className="btn btn-primary btn-sm" onClick={() => setform({ editando: null })}>
                + Nueva cotización
              </button>
            )}
          </div>
        </div>

        <div className="stats-grid" id="cotiz-kpis" style={{ marginBottom: '20px' }}>
          {tarjetas.map((k) => (
            <div className="stat-card" style={{ padding: '14px 16px' }} key={k.label}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icono}</div>
              <div className="stat-card-label">{k.label}</div>
              <div className="stat-card-value" style={{ fontSize: '22px', color: k.color }}>{k.valor}</div>
            </div>
          ))}
        </div>

        <div className="tab-bar" style={{ marginBottom: 0 }} id="cotiz-tabs">
          {cotiz_tabs.map((t) => (
            <button
              key={t.id}
              className={'tab-btn' + (tab === t.id ? ' active' : '')}
              onClick={() => settab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{t.icono}</span>
              {t.label}
              <span
                className="badge badge-gray"
                style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '100px' }}
              >
                {conteos[t.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="card" style={{ borderRadius: '0 0 10px 10px', borderTop: 'none' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th
                      key={c.texto}
                      onClick={() => ordenar_por(c.id)}
                      style={c.id ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                    >
                      {c.texto}{' '}
                      {c.id && (
                        <span style={{ color: orden.col === c.id ? 'var(--naranja)' : 'var(--text-3)' }}>
                          {orden.col === c.id ? (orden.dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody id="cotiz-tbody">
                {filas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--naranja)' }}>{c.id}</td>
                    <td style={{ whiteSpace: 'nowrap' }} className="td-muted">{c.fecha || '—'}</td>
                    <td className="td-name">
                      {c.cliente}
                      {c.empresa && (
                        <span className="badge badge-gray" style={{ fontSize: '9px', marginLeft: '6px' }}>
                          {c.empresa}
                        </span>
                      )}
                    </td>
                    <td className="td-muted">{c.vendedora || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{money(c.total)}</td>
                    <td className="td-muted">{c.valida || '—'}</td>
                    <td>
                      <span className={'badge ' + (cotiz_badge[c.estado] || 'badge-gray')}>
                        {c.estado || '—'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(c)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando cotizaciones…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div id="cotiz-empty" className="empty-state">
              <div className="empty-state-icon">💼</div>
              <p>
                {errores.includes('cotizaciones')
                  ? 'No se pudo leer la tabla de cotizaciones'
                  : 'Sin cotizaciones en esta pestaña'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── resumen financiero de la cotización ── */}
      {detalle && (
        <div
          className="modal-overlay open"
          style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setdetalle(null) }}
        >
          <div className="modal" style={{ width: '620px', margin: 'auto' }}>
            <div className="card-header" style={{ padding: '18px 22px' }}>
              <div>
                <div className="card-title">{detalle.id} · {detalle.cliente}</div>
                <div className="card-sub">
                  {[detalle.fecha, detalle.vendedora, detalle.zona].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {puede && (
                  <button className="btn btn-ghost btn-xs" onClick={() => setform({ editando: detalle })}>
                    ✎ Editar
                  </button>
                )}
                <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(null)}>✕</button>
              </div>
            </div>

            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
                {puede ? (
                  <select
                    className={'badge ' + (cotiz_badge[detalle.estado] || 'badge-gray')}
                    style={{ border: 'none', cursor: 'pointer', fontWeight: 600, padding: '3px 6px', borderRadius: '100px' }}
                    value={detalle.estado}
                    onChange={(e) => cambiar_estado(detalle, e.target.value)}
                  >
                    {cotiz_estados.map((e) => (
                      <option
                        key={e}
                        value={e}
                        disabled={e === 'Concretada' && detalle.estado !== 'Concretada'}
                        title={e === 'Concretada' && detalle.estado !== 'Concretada' ? 'Solo vía Pipeline Comercial' : undefined}
                      >
                        {e}{e === 'Concretada' && detalle.estado !== 'Concretada' ? ' (vía Pipeline)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={'badge ' + (cotiz_badge[detalle.estado] || 'badge-gray')}>
                    {detalle.estado || '—'}
                  </span>
                )}
                <span className="badge badge-gray">
                  {detalle.tipocomida === 'discada' ? '🌮 Discada' : '🥩 Carne asada'}
                </span>
                {detalle.enpipeline && <span className="badge badge-blue">En Pipeline</span>}
                {detalle.valida && <span className="badge badge-gray">Válida hasta {detalle.valida}</span>}
              </div>

              {detalle.descripcion && (
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '16px' }}>
                  {detalle.descripcion}
                </p>
              )}

              <div className="table-wrap">
                <table>
                  <tbody>
                    <tr><td className="td-muted">Área</td><td style={{ textAlign: 'right' }}>{money(detalle.areamonto)}</td></tr>
                    <tr><td className="td-muted">Consumo{detalle.consumodesc ? ' · ' + detalle.consumodesc : ''}</td><td style={{ textAlign: 'right' }}>{money(detalle.consumomonto)}</td></tr>
                    {detalle.adultoextracant > 0 && (
                      <tr>
                        <td className="td-muted">
                          Adultos extra ({detalle.adultoextracant} × {money(detalle.adultoextraprecio)})
                        </td>
                        <td style={{ textAlign: 'right' }}>{money(detalle.adultosextramonto)}</td>
                      </tr>
                    )}
                    {detalle.ninoextracant > 0 && (
                      <tr>
                        <td className="td-muted">
                          Niños extra ({detalle.ninoextracant} × {money(detalle.ninoextraprecio)})
                        </td>
                        <td style={{ textAlign: 'right' }}>{money(detalle.ninosextramonto)}</td>
                      </tr>
                    )}
                    {detalle.extramonto > 0 && (
                      <tr><td className="td-muted">Otros extras</td><td style={{ textAlign: 'right' }}>{money(detalle.extramonto)}</td></tr>
                    )}
                    <tr>
                      <td className="td-muted">Subtotal</td>
                      <td style={{ textAlign: 'right' }}>{money(detalle.subtotal)}</td>
                    </tr>
                    {detalle.descuento > 0 && (
                      <tr>
                        <td style={{ color: 'var(--verde)' }}>
                          Descuento {detalle.descuento}%
                          {detalle.volumenpct > 0 ? ' · grupo ' + detalle.volumenpct + '%' : ''}
                          {detalle.volumennombre ? ' (' + detalle.volumennombre + ')' : ''}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--verde)' }}>—</td>
                      </tr>
                    )}
                    {detalle.iva > 0 && (
                      <tr><td className="td-muted">IVA</td><td style={{ textAlign: 'right' }}>{money(detalle.iva)}</td></tr>
                    )}
                    <tr>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--naranja)' }}>
                        {money(detalle.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {detalle.personasincluidas && (
                <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '12px' }}>
                  Personas incluidas: <b>{detalle.personasincluidas}</b>
                </p>
              )}
              {Array.isArray(detalle.metodospago) && detalle.metodospago.length > 0 && (
                <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '6px' }}>
                  Métodos de pago: {detalle.metodospago.join(' · ')}
                </p>
              )}
              {detalle.notas && (
                <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '10px', whiteSpace: 'pre-line' }}>
                  {detalle.notas}
                </p>
              )}

              {puede && (
                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={cotizacion_activa_en_pipeline(detalle, pipeline) || moviendo === detalle.id}
                    title={cotizacion_activa_en_pipeline(detalle, pipeline) ? 'Ya está en el Pipeline / Concretadas' : undefined}
                    onClick={() => convertir_a_prospecto(detalle)}
                  >
                    {moviendo === detalle.id
                      ? 'Enviando…'
                      : cotizacion_activa_en_pipeline(detalle, pipeline)
                        ? '✓ Ya está en el Pipeline'
                        : '🔁 Enviar a Pipeline Comercial'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CotizForm
        abierto={!!form}
        editando={form ? form.editando : null}
        oncerrar={() => setform(null)}
        onguardar={guardar}
        guardando={guardando}
      />
    </div>
  )
}
