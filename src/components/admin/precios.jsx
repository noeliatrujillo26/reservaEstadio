// ═══════════════════════════════════════════════════════════════════
// precios.jsx — catalogo de tarifas por zona.
// espejo 1:1 de v1: #page-precios de index.html (lineas 2068-2113) y
// renderPrecios() (js/modules/precios-mapa.js).
//
// El precio base aplica a TODOS los juegos de la temporada; lo que cambia es
// el bloque de dia: DOM-MIE vs JUE-SAB. La v1 elimino los "Precios por Juego"
// (overrides individuales) justo para que exista una sola fuente de tarifas.
//
// SOLO LECTURA: se omiten la edicion por fila, importar/exportar CSV y las dos
// politicas (enganche y descuento), que escriben en la base.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import {
  aplicar_imagenes_locales, aplicar_overrides_locales, badge_seccion, fila_precio,
  filtrar_precios, map_precio,
} from '../../lib/preciosadmin'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// los dos bloques de dia, con el color que usa la v1.
const az = 'rgba(37,99,235,0.05)'
const nj = 'var(--naranja-muted)'
const der = { textAlign: 'right', whiteSpace: 'nowrap' }

// Campos de solo lectura, con el MISMO estilo que la v1. Son la razon de que
// alli la cuadricula no se deforme: tienen altura fija propia, asi que el
// texto largo se desplaza dentro del campo en vez de estirar la fila.
// El textarea conserva resize:vertical — quien necesite leer una descripcion
// larga puede estirar su cuadro, igual que en la version original.
const est_desc_corta = {
  width: '100%',
  minWidth: '280px',
  fontSize: '12px',
  background: 'var(--surface-2)',
  color: 'var(--text-2)',
}

const est_desc = {
  width: '220px',
  fontSize: '12px',
  resize: 'vertical',
  background: 'var(--surface-2)',
  color: 'var(--text-2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '6px 8px',
  fontFamily: 'inherit',
}

const est_sku = {
  width: '90px',
  textTransform: 'uppercase',
  background: 'var(--surface-2)',
  color: 'var(--text-2)',
}

// miniatura de 44px, el mismo tamaño que usa la v1 en Imagen y Sitio.
function miniatura({ src, alt }) {
  if (!src) return <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</span>
  return (
    <img
      src={src} alt={alt} loading="lazy"
      style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }}
    />
  )
}

const Miniatura = miniatura

export default function precios() {
  const { secciones, cargando, errores } = useadmindatos()
  const [busqueda, setbusqueda] = useState('')

  const catalogo = useMemo(() => {
    const base = (secciones || []).map(map_precio)
    // el cache local del admin RELLENA campos; nunca pisa lo de la base con
    // un valor ausente. Lo mismo para las fotos.
    return aplicar_imagenes_locales(aplicar_overrides_locales(base))
  }, [secciones])

  const filas = useMemo(
    () => filtrar_precios(catalogo, busqueda).map(fila_precio),
    [catalogo, busqueda]
  )

  return (
    <div className="page active" id="page-precios">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Administrar Precios</h2>
            <p>Precio base por zona · aplica a todos los juegos de la temporada</p>
          </div>
          <input
            className="input" placeholder="Buscar zona, sección o SKU…"
            style={{ width: '240px', fontSize: '13px' }}
            value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
          />
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Precios Catálogo</div>
              <div className="card-sub">
                {filas.length} zona(s) · el bloque de día decide la tarifa: DOM–MIÉ o JUE–SÁB
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Sección</th>
                  <th>SKU</th>
                  <th>Descripción corta</th>
                  <th>Descripción</th>
                  <th colSpan={8} style={{ textAlign: 'center', background: 'rgba(37,99,235,0.12)', color: 'var(--azul)', borderLeft: '2px solid var(--azul)' }}>
                    🔵 DOM – MIÉ
                  </th>
                  <th colSpan={5} style={{ textAlign: 'center', background: nj, color: 'var(--naranja)', borderLeft: '2px solid var(--naranja)' }}>
                    🟠 JUE – SÁB
                  </th>
                  <th>Imagen</th>
                  <th>Sitio</th>
                </tr>
                <tr>
                  <th></th><th></th><th></th><th></th><th></th>
                  <th style={{ background: 'rgba(37,99,235,0.06)', borderLeft: '2px solid var(--azul)' }}>Mín. pers.</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }}>Cap. máx.</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }}>Precio base</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }}>Extra adulto</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }}>Extra niño</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)', borderLeft: '1px dashed var(--azul)' }} title="Tarifa alterna Discada (solo DOM–MIÉ)">🌮 Base</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }} title="Adulto extra con Discada">🌮 Extra</th>
                  <th style={{ background: 'rgba(37,99,235,0.06)' }} title="Niño extra con Discada">🌮 Niño</th>
                  <th style={{ background: nj, borderLeft: '2px solid var(--naranja)' }}>Mín. pers.</th>
                  <th style={{ background: nj }}>Cap. máx.</th>
                  <th style={{ background: nj }}>Precio base</th>
                  <th style={{ background: nj }}>Extra adulto</th>
                  <th style={{ background: nj }}>Extra niño</th>
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody id="precios-table">
                {filas.map((p) => (
                  <tr key={p.pinid} style={{ verticalAlign: 'top' }}>
                    <td className="td-name" style={{ whiteSpace: 'nowrap' }} title={p.zona}>
                      {p.zona}
                      {p.escompartida && (
                        <span className="badge badge-purple" style={{ fontSize: '9px', marginLeft: '6px' }}>
                          Compartido
                        </span>
                      )}
                    </td>
                    <td><span className={'badge ' + (badge_seccion[p.seccion] || 'badge-gray')}>{p.seccion}</span></td>
                    <td>
                      <input className="input" style={est_sku} value={p.sku || ''} readOnly />
                    </td>
                    <td>
                      <input
                        className="input" style={est_desc_corta}
                        value={p.shortdescription || ''} title={p.shortdescription || undefined}
                        readOnly
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2} style={est_desc}
                        value={p.descripcion || ''} title={p.descripcion || undefined}
                        readOnly
                      />
                    </td>

                    <td style={{ ...der, background: az, borderLeft: '2px solid var(--azul)' }}>{p.minv}</td>
                    <td style={{ ...der, background: az }}>{p.capv}</td>
                    <td style={{ ...der, background: az, fontWeight: 700 }}>{money(p.precio)}</td>
                    <td style={{ ...der, background: az }}>{p.precioextra != null ? money(p.precioextra) : '—'}</td>
                    <td style={{ ...der, background: az }}>{p.precionino != null ? money(p.precionino) : '—'}</td>
                    <td style={{ ...der, background: az, borderLeft: '1px dashed var(--azul)' }}>{money(p.discadav)}</td>
                    <td style={{ ...der, background: az }}>{money(p.extradiscadav)}</td>
                    <td style={{ ...der, background: az }}>{money(p.ninodiscadav)}</td>

                    <td style={{ ...der, background: nj, borderLeft: '2px solid var(--naranja)' }}>{p.min2v}</td>
                    <td style={{ ...der, background: nj }}>{p.cap2v}</td>
                    <td style={{ ...der, background: nj, fontWeight: 700 }}>{money(p.precio2v)}</td>
                    <td style={{ ...der, background: nj }}>{p.extra2v != null ? money(p.extra2v) : '—'}</td>
                    <td style={{ ...der, background: nj }}>{p.nino2v != null ? money(p.nino2v) : '—'}</td>

                    <td><Miniatura src={p.img} alt={'Imagen de ' + p.zona} /></td>
                    <td><Miniatura src={p.img2} alt={'Foto de sitio de ' + p.zona} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando catálogo…
            </div>
          )}
          {!cargando && filas.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">💲</div>
              <p>
                {errores.includes('mapa_secciones')
                  ? 'No se pudo leer las secciones del mapa'
                  : 'Sin zonas configuradas'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
