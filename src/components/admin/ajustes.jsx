// ═══════════════════════════════════════════════════════════════════
// ajustes.jsx — parámetros globales del sistema.
// SIN EQUIVALENTE 1:1 EN LA V1 — ver la cabecera de lib/config.js y
// migracion-app-config.sql. Datos fiscales y de contacto vivían
// hardcodeados en js/00-config.js (un despliegue de código para cambiar
// algo); la plantilla de recibos, en el localStorage de cada navegador. Esta
// pantalla los junta en un solo lugar, compartido y con permisos.
//
// ALCANCE: solo el panel admin. El sitio público (recibos/checkout) sigue
// leyendo su copia estática — conectarlo es trabajo aparte, deliberadamente
// fuera de este módulo para no arriesgar el checkout en producción.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useconfigescritura from '../../hooks/useconfigescritura'
import { map_config } from '../../lib/ajustes'

const vacio = map_config(null)

export default function ajustes() {
  const { config, metodos, cargando, errores } = useadmindatos()
  const { puede, guardar, guardando } = useconfigescritura()

  // SIN useEffect a proposito: `config` llega asincrono del contexto (la
  // carga inicial del panel), y un efecto para sincronizarlo a `d` deja el
  // PRIMER render siempre vacio — el mismo punto ciego que ya documentan
  // palcos.jsx/detalleprospecto.jsx en este panel, y que el banco de
  // pruebas (que no ejecuta efectos) atrapa como una vista que nunca
  // termina de pintar su contenido real.
  //
  // `editado` es SOLO lo que el usuario ya toco en esta sesion; mientras
  // este en null, la pantalla refleja `config` directo — se actualiza sola
  // en cuanto el contexto termina de cargar, sin esperar un efecto.
  const [editado, seteditado] = useState(null)
  const [campos, setcampos] = useState([])
  const d = editado || config || vacio

  const cuentas = (metodos || []).filter((m) => m.tipo === 'Transferencia')

  const set = (rama, k, v) => seteditado((x) => {
    const base = x || config || vacio
    return { ...base, [rama]: { ...base[rama], [k]: v } }
  })
  const err = (k) => (campos.includes(k) ? ' input-error' : '')

  async function guardar_click() {
    setcampos([])
    const r = await guardar(d)
    // exito: se limpia el borrador y la pantalla vuelve a seguir a `config`
    // (que recargar() ya trae actualizado) en vez de quedarse con una copia
    // local que podria quedar desincronizada.
    if (r && r.ok) seteditado(null)
    else if (r && r.campos) setcampos(r.campos)
  }

  const soloLectura = !puede

  return (
    <div className="page active" id="page-ajustes">
      <div style={{ padding: '28px', flex: 1, minHeight: 0, maxWidth: '720px' }}>
        <div className="page-header" style={{ marginBottom: '20px' }}>
          <div>
            <h2>Ajustes</h2>
            <p>Parámetros generales del sistema</p>
          </div>
        </div>

        {cargando && !config && (
          <p style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '14px' }}>Cargando parámetros…</p>
        )}
        {!cargando && !config && (
          <div className="empty-state" style={{ marginBottom: '20px' }}>
            <div className="empty-state-icon">⚙️</div>
            <p>
              {errores.includes('app_config')
                ? 'No se pudo leer la tabla app_config. Si el módulo es nuevo, corre migracion-app-config.sql en Supabase.'
                : 'Sin parámetros configurados todavía.'}
            </p>
          </div>
        )}

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><div className="card-title">Datos fiscales</div></div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Razón social</label>
                <input
                  className="input" disabled={soloLectura} value={d.fiscal.razonsocial}
                  onChange={(e) => set('fiscal', 'razonsocial', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre comercial</label>
                <input
                  className="input" disabled={soloLectura} value={d.fiscal.nombrecomercial}
                  onChange={(e) => set('fiscal', 'nombrecomercial', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">RFC</label>
              <input
                className={'input' + err('rfc')} disabled={soloLectura} value={d.fiscal.rfc}
                onChange={(e) => set('fiscal', 'rfc', e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Domicilio fiscal</label>
              <textarea
                className="input" rows={2} style={{ width: '100%', resize: 'vertical' }}
                disabled={soloLectura} value={d.fiscal.domicilio}
                onChange={(e) => set('fiscal', 'domicilio', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Teléfonos</label>
              <input
                className="input" disabled={soloLectura} value={d.fiscal.telefonos}
                onChange={(e) => set('fiscal', 'telefonos', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Cuenta bancaria predeterminada</div>
              <div className="card-sub">La que se sugiere primero en cotizaciones y recibos</div>
            </div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <select
              className="input select" disabled={soloLectura} value={d.cuentabancariadefaultid}
              onChange={(e) => setd((x) => ({ ...x, cuentabancariadefaultid: e.target.value }))}
            >
              <option value="">— Sin definir —</option>
              {cuentas.map((m) => (
                <option key={m.id} value={String(m.id)}>{m.nombre}{m.detalle ? ' · ' + m.detalle : ''}</option>
              ))}
            </select>
            {!cuentas.length && (
              <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '6px' }}>
                No hay métodos de pago de tipo «Transferencia» en el catálogo todavía.
              </p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Plantilla de recibos y cotizaciones</div>
              <div className="card-sub">Antes vivía en el navegador de cada quien; ahora es una sola, compartida</div>
            </div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nombre a mostrar</label>
              <input
                className="input" disabled={soloLectura} placeholder="Naranjeros de Hermosillo"
                value={d.plantillarecibos.nombre}
                onChange={(e) => set('plantillarecibos', 'nombre', e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Color</label>
                <input
                  className="input" type="color" disabled={soloLectura}
                  style={{ height: '38px', padding: '4px' }}
                  value={d.plantillarecibos.color || '#E05C1A'}
                  onChange={(e) => set('plantillarecibos', 'color', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">URL del logo</label>
                <input
                  className="input" disabled={soloLectura} placeholder="https://…/logo.png"
                  value={d.plantillarecibos.logourl}
                  onChange={(e) => set('plantillarecibos', 'logourl', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {puede && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {d.actualizadoen && (
              <span style={{ fontSize: '11.5px', color: 'var(--text-3)', alignSelf: 'center', marginRight: 'auto' }}>
                Última actualización: {new Date(d.actualizadoen).toLocaleString('es-MX')}
                {d.actualizadopor ? ' · ' + d.actualizadopor : ''}
              </span>
            )}
            <button
              className="btn btn-primary" onClick={guardar_click} disabled={guardando}
              style={guardando ? { opacity: 0.6 } : undefined}
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
