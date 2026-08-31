// ═══════════════════════════════════════════════════════════════════
// legales.jsx — pagina de informacion legal.
// espejo 1:1 de v1: legales.html completo, incluido mostrarLegal() y el
// deep-link por hash (_abrirDesdeHash).
//
// el css original vive en styles/legales.css. UNICO cambio respecto a la v1:
// sus reglas quedan acotadas bajo .pagina-legales. En la v1 esto era un .html
// aparte con su propia hoja; en la spa todo el css se junta y :root, * y body
// chocaban con panel-inicio.css (--negro, --gris, --borde, fondo y
// line-height). Las declaraciones no se tocaron.
//
// /legales#privacidad abre directo esa pestana, igual que la v1, y cambiar de
// pestana reescribe el hash sin ensuciar el historial.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { legales_docs, tabs_legal, titulos_tab } from '../lib/legalesdocs'
import '../styles/legales.css'

export default function legales() {
  const location = useLocation()
  const navigate = useNavigate()

  // el hash manda cual pestana se ve; si trae basura, cae a 'terminos'.
  const desde_hash = (location.hash || '#terminos').slice(1)
  const inicial = tabs_legal.indexOf(desde_hash) >= 0 ? desde_hash : 'terminos'
  const [activa, setactiva] = useState(inicial)

  // deep-link y boton atras del navegador: seguir al hash.
  useEffect(() => {
    const h = (location.hash || '#terminos').slice(1)
    setactiva(tabs_legal.indexOf(h) >= 0 ? h : 'terminos')
  }, [location.hash])

  // mismo scroll al tope que hacia mostrarLegal().
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activa])

  function mostrar(cual) {
    const destino = tabs_legal.indexOf(cual) >= 0 ? cual : 'terminos'
    setactiva(destino)
    // replace: cambiar de pestana no debe llenar el historial, igual que el
    // history.replaceState de la v1.
    navigate('#' + destino, { replace: true })
  }

  useEffect(() => {
    document.title = 'Información Legal — Naranjeros de Hermosillo'
  }, [])

  return (
    <div className="pagina-legales">
      <div className="top">
        <a className="volver" href="/">← Volver al sitio</a>
        <div className="titulo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/logo-naranjeros.png"
            alt="Naranjeros de Hermosillo"
            style={{ height: '24px', width: 'auto', objectFit: 'contain' }}
          />
          <span>Naranjeros de Hermosillo · Información Legal</span>
        </div>
      </div>

      <div className="wrap">
        <div className="tabs">
          {tabs_legal.map((t) => (
            <button
              key={t}
              className={'tab' + (activa === t ? ' activa' : '')}
              id={'tab-' + t}
              onClick={() => mostrar(t)}
            >
              {titulos_tab[t]}
            </button>
          ))}
        </div>

        {tabs_legal.map((t) => (
          <div
            key={t}
            className={'doc' + (activa === t ? ' visible' : '')}
            id={'doc-' + t}
            dangerouslySetInnerHTML={{ __html: legales_docs[t] }}
          />
        ))}
      </div>
    </div>
  )
}
