// ═══════════════════════════════════════════════════════════════════
// zonadetalle.jsx — panel derecho con el detalle de la zona seleccionada.
// espejo 1:1 de v1: el bloque #detalle-content del html (lineas 728-786),
// selectZone() (linea 1738) y _detalleActualizar() (linea 1535).
//
// TODO el dinero sale de lib/precios.js, el mismo desglose que usara el
// checkout: lo que se muestra es exactamente lo que se cobra.
//
// carga segura, tal cual la v1: si la tarifa aun no llega de supabase jamas
// se muestra "$0 MXN" ni se deja reservar — se avisa "Cargando precio…" y el
// boton se rehabilita solo cuando el precio real esta disponible.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react'
import usemapa from '../../hooks/usemapa'
import usereserva from '../../hooks/usereserva'
import uselandingconfig from '../../hooks/uselandingconfig'
import usecheckout from '../../hooks/usecheckout'
import { mxn2 } from '../../lib/dinero'
import {
  con_extras,
  desglose_total_zona,
  min_zona,
  precio_zona,
  tope_adultos_zona,
} from '../../lib/precios'
import { es_jue_sab } from '../../lib/fechas'
import ZonaGaleria from './zonagaleria'
import Stepper from './stepper'

const fmt = (n) => Number(n).toLocaleString('es-MX', mxn2)

export default function zonadetalle() {
  const { zonas, zonaactiva, personas, setpersonas, ninos, setninos } = usemapa()
  const { juegoactivofecha, juegoactivoid, dv_mejor_regla, dv_proxima_regla } = usereserva()
  const { politica } = uselandingconfig()
  const { iniciar_reserva } = usecheckout()

  // la zona enriquecida con el respaldo local de tarifas (_loadExtras).
  const z = useMemo(() => {
    const base = zonaactiva ? zonas[zonaactiva] : null
    return base ? con_extras(base) : null
  }, [zonas, zonaactiva])

  // espejo del final de selectZone(): al abrir una zona, los adultos arrancan
  // en el minimo incluido y los ninos en cero.
  useEffect(() => {
    if (!z) return
    setpersonas(min_zona(z, juegoactivofecha))
    setninos(0)
    // solo al cambiar de zona o de dia de juego, no en cada repintado.
  }, [zonaactiva, juegoactivofecha])

  const d = useMemo(
    () => (z ? desglose_total_zona(z, juegoactivofecha, personas, ninos) : null),
    [z, juegoactivofecha, personas, ninos]
  )

  // log de depuracion con la formula aplicada, igual que _logDesglosePrecio().
  useEffect(() => {
    if (!z || !d) return
    console.debug(
      '[Abona2 · precio] ' + z.nombre +
        ' (tarifa ' + (es_jue_sab(juegoactivofecha) ? 'JUE-SÁB' : 'DOM-MIÉ') + ')' +
        ': $' + fmt(d.pp) + ' base (' + d.min + ' pers incluidas)' +
        ' + (' + d.ext_adultos_cant + ' adulto(s) extra × $' + fmt(d.extra) + ')' +
        ' + (' + d.ninos_extra_cant + ' niño(s) extra × $' + fmt(d.nino) + ')' +
        ' + $0 cargos/impuestos = $' + fmt(d.total)
    )
  }, [z, d, juegoactivofecha])

  if (!z || !d) return null

  const { pp, extra, nino, min, ninos_incluidos, total } = d
  const hay_precio = pp > 0
  const enganche_pct = politica.enganche_minimo

  // DESCUENTO POR GRUPO: el total estimado ya lo refleja, con la MISMA
  // aritmetica que el Paso 2 y que cobra el servidor (primero el tramo,
  // luego el descuento sobre el) para que las tres cifras coincidan.
  const g_personas = (Number(personas) || 0) + (Number(ninos) || 0)
  const g_regla = dv_mejor_regla(g_personas, zonaactiva, juegoactivoid)
  const g_pct = g_regla ? Number(g_regla.porcentaje) || 0 : 0
  const g_desc = g_pct > 0 ? Math.round((total * g_pct) / 100) : 0
  const g_total = Math.max(0, total - g_desc)
  const g_base = Math.round((total * enganche_pct) / 100)
  const g_eng = Math.max(0, g_base - (g_pct > 0 ? Math.round((g_base * g_pct) / 100) : 0))
  const g_prox = g_pct > 0 ? null : dv_proxima_regla(g_personas, zonaactiva, juegoactivoid)
  const faltan = g_prox ? (Number(g_prox.min_personas) || 0) - g_personas : 0

  // descripcion corta bajo el nombre; sin ella, respaldo con la completa
  // recortada. ambas vacias -> el bloque se oculta.
  let desc_corta = String(z.shortDesc || '').trim()
  if (!desc_corta) {
    const full = String(z.descripcion || '').trim()
    desc_corta = full.length > 90 ? full.slice(0, 87).trimEnd() + '…' : full
  }

  const hint_adulto =
    personas <= min
      ? 'Primeros ' + min + ' incluidos en $' + fmt(pp)
      : min + ' base + ' + (personas - min) + ' extra a $' + fmt(extra) + '/pers.'

  const hint_nino =
    nino > 0
      ? ninos_incluidos > 0
        ? ninos_incluidos + ' sin cargo (dentro del mínimo) · luego $' + fmt(nino) + '/niño'
        : '$' + fmt(nino) + '/niño'
      : 'Sin cargo'

  // el boton exige disponibilidad Y que la tarifa real ya haya llegado.
  const puede_reservar = z.disponible && precio_zona(z, juegoactivofecha) > 0

  return (
    <div className="detalle-content visible" id="detalle-content">
      <ZonaGaleria zona={z} />

      <div
        id="detalle-badge"
        className={'detalle-badge ' + (z.disponible ? 'estado-disponible' : 'estado-agotado')}
      >
        <span className="dot"></span> <span id="badge-texto">{z.disponible ? 'Disponible' : 'No disponible'}</span>
      </div>
      <div className="detalle-nombre" id="detalle-nombre">{z.nombre}</div>

      <div
        id="detalle-desc-corta"
        style={{
          display: desc_corta ? '' : 'none',
          fontSize: '12.5px',
          fontWeight: 600,
          color: '#E05C1A',
          background: 'rgba(224,92,26,0.08)',
          borderRadius: '6px',
          padding: '5px 10px',
          margin: '6px 0 2px',
          lineHeight: 1.4,
        }}
      >
        {desc_corta}
      </div>

      <div className="detalle-precio-wrap">
        <Stepper
          titulo="Adultos"
          hint={hint_adulto}
          valor={personas}
          idvalor="detalle-personas"
          idmenos="detalle-menos"
          idmas="detalle-mas"
          onmenos={() => personas > min && setpersonas(personas - 1)}
          onmas={() => personas < tope_adultos_zona(z, juegoactivofecha) && setpersonas(personas + 1)}
          menosdesactivado={personas <= min}
          masdesactivado={personas >= tope_adultos_zona(z, juegoactivofecha)}
        />
        <Stepper
          titulo="Niños (menores de 10 años)"
          hint={hint_nino}
          valor={ninos}
          idvalor="detalle-ninos"
          idmenos="detalle-nino-menos"
          idmas="detalle-nino-mas"
          onmenos={() => ninos > 0 && setninos(ninos - 1)}
          onmas={() => ninos < 20 && setninos(ninos + 1)}
          menosdesactivado={ninos <= 0}
          masdesactivado={ninos >= 20}
        />

        <div className="precio-label">Total estimado</div>
        <div className="precio-valor" id="detalle-total" style={{ whiteSpace: 'nowrap' }}>
          {hay_precio ? '$' + fmt(g_total) + ' MXN' : 'Cargando precio…'}
        </div>
        <div className="precio-enganche" id="detalle-enganche">
          {hay_precio && total > 0
            ? 'Enganche (' + enganche_pct + '%): $' + fmt(g_eng) + ' MXN'
            : '—'}
        </div>

        {/* descuento por grupo: el ya ganado, o lo que falta para lograrlo */}
        <div
          id="detalle-grupo"
          style={{
            display: hay_precio && (g_pct > 0 || g_prox) ? 'block' : 'none',
            marginTop: '9px',
            borderRadius: '9px',
            padding: '8px 10px',
            fontSize: '12px',
            fontWeight: 700,
            lineHeight: 1.35,
            textAlign: 'center',
            background: g_pct > 0 ? '#DCFCE7' : '#FEF3C7',
            color: g_pct > 0 ? '#166534' : '#92400E',
          }}
        >
          {g_pct > 0 ? (
            <>
              🏷️ −{g_pct}% por grupo aplicado
              <div style={{ fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                Ahorras ${fmt(g_desc)} MXN{g_regla.nombre ? ' · ' + g_regla.nombre : ''}
              </div>
            </>
          ) : g_prox ? (
            <>
              🎉 Descuento disponible: {Number(g_prox.porcentaje) || 0}% a partir de{' '}
              {Number(g_prox.min_personas) || 0} personas
              <div style={{ fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                Te falta{faltan === 1 ? ' 1 persona' : 'n ' + faltan + ' personas'} para lograrlo
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="detalle-info">
        <div className="info-chip">
          <div className="info-chip-label">Cap. máx.</div>
          <div className="info-chip-val" id="detalle-cap">{(z.cap || '—') + ' pers.'}</div>
        </div>
        <div className="info-chip">
          <div className="info-chip-label">Sección</div>
          <div className="info-chip-val" id="detalle-seccion">{z.seccion}</div>
        </div>
      </div>

      <button
        className="btn-reservar"
        id="btn-reservar"
        onClick={iniciar_reserva}
        disabled={!puede_reservar}
        style={{ opacity: hay_precio ? 1 : 0.5 }}
      >
        {z.disponible ? (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 3H3a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M1 6h14M5 3V1M11 3V1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>{' '}
            Reservar esta zona
          </>
        ) : (
          'Zona no disponible'
        )}
      </button>
      <p className="politica-nota">
        Al reservar aceptas la política de cancelación.{' '}
        <span id="txt-pct-nota">{enganche_pct}</span>% de enganche no reembolsable.
      </p>
    </div>
  )
}
