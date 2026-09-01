// ═══════════════════════════════════════════════════════════════════
// landing.jsx — configuracion del sitio publico.
// espejo 1:1 de v1: #page-landing de index.html (las 6 tarjetas: Hero, Barra
// de estadisticas, Banner de promocion, Banner de Promociones, Carrusel y FAQ).
//
// DOS FUENTES, como en la v1:
//   · hero y barra de estadisticas → localStorage 'nrj_landing' (no hay
//     columnas para ellos en la base; ya lo documentamos al migrar la portada)
//   · banner, promo strip, faq → configuracion_landing
//   · carrusel → carousel_slides
//
// SOLO LECTURA: se omiten todos los campos editables, la subida de imagenes y
// "Guardar cambios".
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import useadmindatos from '../../hooks/useadmindatos'

const est_valor = {
  fontSize: '13px', color: 'var(--text-1)', background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px',
  minHeight: '20px', wordBreak: 'break-word',
}

function campo({ label, valor }) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{label}</label>
      <div style={est_valor}>{valor || <span style={{ color: 'var(--text-3)' }}>—</span>}</div>
    </div>
  )
}

const Campo = campo

export default function landing() {
  const { configlanding: cfg, slides, cargando, errores } = useadmindatos()

  // hero y stats viven SOLO en el navegador del admin que los edito.
  const local = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('nrj_landing') || 'null')
    } catch (e) {
      return null
    }
  }, [])

  const stats = (local && local.stats) || []
  const faq = cfg && Array.isArray(cfg.faq) ? cfg.faq : []
  const cards = cfg && Array.isArray(cfg.promo_strip_cards) ? cfg.promo_strip_cards : []

  return (
    <div className="page active" id="page-landing">
      <div style={{ padding: '28px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="page-header" style={{ marginBottom: '24px' }}>
          <div>
            <h2>Landing</h2>
            <p>Contenido del sitio público de reservas</p>
          </div>
        </div>

        {cargando && <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Cargando configuración…</p>}
        {!cargando && errores.includes('configuracion_landing') && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px' }}>
            ⚠ No se pudo leer configuracion_landing.
          </div>
        )}

        {/* ── Hero ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Banner principal (Hero)</div>
              <div className="card-sub">
                Guardado en este navegador · no hay columnas para estos textos en la base
              </div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: '16px' }}>
            <Campo label="Eyebrow" valor={local && local.heroEyebrow} />
            <Campo label="Título" valor={local && local.heroH1} />
            <Campo label="Título destacado" valor={local && local.heroEm} />
            <Campo label="Subtítulo" valor={local && local.heroSub} />
            <Campo label="Texto del botón" valor={local && local.heroCta} />
            <Campo label="Imagen de fondo" valor={local && local.heroBg} />
          </div>
        </div>

        {/* ── Barra de estadísticas ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Barra de estadísticas</div>
              <div className="card-sub">Las 4 cifras bajo el hero · también guardadas localmente</div>
            </div>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Cifra</th><th>Etiqueta</th></tr></thead>
                <tbody>
                  {[0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td className="td-muted">{i + 1}</td>
                      <td className="td-name">{(stats[i] && stats[i].num) || '—'}</td>
                      <td className="td-muted">{(stats[i] && stats[i].lbl) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Banner de promoción ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Banner de promoción</div>
              <div className="card-sub">La franja sobre el encabezado del sitio</div>
            </div>
            <span className={'badge ' + (cfg && cfg.banner_activo ? 'badge-green' : 'badge-gray')}>
              {cfg && cfg.banner_activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: '16px' }}>
            <Campo label="Texto" valor={cfg && cfg.banner_texto} />
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: (cfg && cfg.banner_color) || '#e63946', border: '1px solid var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px' }}>{(cfg && cfg.banner_color) || '—'}</span>
              </div>
            </div>
            <Campo label="Enlace" valor={cfg && cfg.banner_enlace} />
          </div>
        </div>

        {/* ── Promo strip ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Banner de Promociones</div>
              <div className="card-sub">La franja dentro del hero, con sus tarjetas</div>
            </div>
            <span className={'badge ' + (cfg && cfg.promo_strip_enabled ? 'badge-green' : 'badge-gray')}>
              {cfg && cfg.promo_strip_enabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: '16px' }}>
            <Campo label="Título" valor={cfg && cfg.promo_strip_titulo} />
            <Campo label="Subtítulo" valor={cfg && cfg.promo_strip_subtitulo} />
            <Campo label="Texto del botón" valor={cfg && cfg.promo_strip_btn_texto} />
            <Campo label="URL del botón" valor={cfg && cfg.promo_strip_btn_url} />
          </div>
          {cards.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ícono</th><th>Título</th><th>Descripción</th><th>Estado</th></tr></thead>
                <tbody>
                  {cards.map((c, i) => (
                    <tr key={i}>
                      <td className="td-muted">{c.icono || '—'}</td>
                      <td className="td-name">{c.titulo || '—'}</td>
                      <td className="td-muted">{c.descripcion || '—'}</td>
                      <td>
                        <span className={'badge ' + (c.activa !== false ? 'badge-green' : 'badge-gray')}>
                          {c.activa !== false ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Carrusel ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Carrusel Landing (Banners)</div>
              <div className="card-sub">
                Imágenes de fondo del hero · sin imágenes activas se conserva el fondo estático
              </div>
            </div>
            <span className="badge badge-gray">{slides.filter((s) => s.is_active).length} activas</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th style={{ width: '90px' }}>Imagen</th><th>Título</th><th>Orden</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {slides.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <img
                        src={s.image_url} alt={s.title || 'Slide'}
                        style={{ width: '72px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                      />
                    </td>
                    <td className="td-name">{s.title || '—'}</td>
                    <td className="td-muted">{s.order_index}</td>
                    <td>
                      <span className={'badge ' + (s.is_active ? 'badge-green' : 'badge-gray')}>
                        {s.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {slides.length === 0 && !cargando && (
            <div className="empty-state">
              <div className="empty-state-icon">🖼️</div>
              <p>Sin imágenes en el carrusel</p>
            </div>
          )}
        </div>

        {/* ── FAQ ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Preguntas Frecuentes (FAQ)</div>
              <div className="card-sub">
                Reemplazan a las preguntas estáticas del sitio · si están vacías, se muestran esas
              </div>
            </div>
            <span className="badge badge-gray">{faq.length} preguntas</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: '14px' }}>
            {faq.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{f.pregunta}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                  {f.respuesta}
                </div>
              </div>
            ))}
            {faq.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                Sin preguntas configuradas · el sitio muestra las 8 estáticas.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
