// ═══════════════════════════════════════════════════════════════════
// portalcontext.jsx — sesion y datos del portal "Mis reservas".
// espejo de v1: leerSesion(), entrarPortal(), salirPortal() y
// cargarReservasUsuario() de panel-reserva.html.
//
// SOLO LECTURA: la unica peticion es GET /api/mis-reservas, que valida folio
// + correo y devuelve reservas y cobros. Las acciones de escritura del portal
// de la v1 (editar invitados, editar perfil, generar codigo de referido) NO
// se conectan en esta fase — ver VITE_ESCRITURA_PORTAL en el componente que
// las muestra.
//
// La sesion (folio + correo ya validados) vive en sessionStorage con la MISMA
// llave que escribe el checkout al confirmar un pago: asi "Ver reserva" entra
// al portal sin volver a teclear lo que el cliente acaba de usar.
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useState } from 'react'
import { map_reserva } from '../lib/reservas'

export const portalcontext = createContext(null)

export const sesion_key = 'nrj_portal_sesion'

// mientras no sea 'true', el portal no ofrece editar nada.
export const escritura_portal = import.meta.env.VITE_ESCRITURA_PORTAL === 'true'

function leer_sesion() {
  try {
    return JSON.parse(sessionStorage.getItem(sesion_key) || 'null')
  } catch (e) {
    return null
  }
}

export function portalprovider({ children }) {
  const [sesion, setsesion] = useState(() => leer_sesion())
  const [reservas, setreservas] = useState([])
  const [actualid, setactualid] = useState(null)
  const [perfil, setperfil] = useState(null)
  const [cargando, setcargando] = useState(false)
  const [error, seterror] = useState('')

  // ── carga principal: reservas + historial de pagos ───────────────
  const cargar = useCallback(async (folio, email) => {
    setcargando(true)
    seterror('')
    try {
      // refetch SIN cache (no-store + cache-buster): los pagos recien
      // registrados (al volver de la pasarela) llegan siempre frescos.
      const qs = new URLSearchParams({ folio, email, _t: String(Date.now()) })
      const resp = await fetch('/api/mis-reservas?' + qs.toString(), { cache: 'no-store' })
      const data = await resp.json()
      if (!resp.ok) {
        return { exito: false, mensaje: data.error || 'No se pudo consultar tus reservas.' }
      }

      const cobros = data.cobros || []
      const lista = (data.reservas || []).map((r) => map_reserva(r, cobros))
      if (lista.length === 0) {
        return { exito: false, mensaje: 'No encontramos reservas para ese correo.' }
      }

      // la reserva del folio con el que entro va seleccionada; activas primero.
      lista.sort(
        (a, b) => (a.estado === 'activa' ? 0 : 1) - (b.estado === 'activa' ? 0 : 1)
      )
      const sel = lista.find((r) => String(r.id) === String(folio)) || lista[0]

      setreservas(lista)
      setactualid(sel.id)
      const pf = data.perfil || {}
      setperfil({
        nombre: sel.cliente || '',
        correo: email,
        celular: sel.tel || '',
        nacimiento: pf.birth_date || '',
        genero: pf.gender || '',
      })
      return { exito: true }
    } catch (e) {
      console.error(e)
      return { exito: false, mensaje: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.' }
    } finally {
      setcargando(false)
    }
  }, [])

  const entrar = useCallback(
    async (folio_crudo, email_crudo) => {
      const folio = String(folio_crudo || '').trim()
      const email = String(email_crudo || '').trim().toLowerCase()
      if (!folio || !email) return { exito: false, mensaje: 'Ingresa tu folio y tu correo.' }
      const r = await cargar(folio, email)
      if (!r.exito) return r
      const s = { folio, email }
      setsesion(s)
      try {
        sessionStorage.setItem(sesion_key, JSON.stringify(s))
      } catch (e) {}
      return r
    },
    [cargar]
  )

  const salir = useCallback(() => {
    try {
      sessionStorage.removeItem(sesion_key)
    } catch (e) {}
    setsesion(null)
    setreservas([])
    setactualid(null)
    setperfil(null)
  }, [])

  // sesion ya guardada (o la que dejo el checkout al confirmar el pago):
  // se entra directo sin volver a pedir folio y correo.
  useEffect(() => {
    if (!sesion || reservas.length) return
    cargar(sesion.folio, sesion.email).then((r) => {
      if (!r.exito) {
        // la sesion guardada ya no sirve: volver a la pantalla de acceso.
        salir()
        seterror(r.mensaje)
      }
    })
  }, [sesion, reservas.length, cargar, salir])

  const actual = reservas.find((r) => r.id === actualid) || null

  const valor = {
    sesion, reservas, actual, actualid, setactualid, perfil,
    cargando, error, seterror, entrar, salir, escritura_portal,
  }

  return <portalcontext.Provider value={valor}>{children}</portalcontext.Provider>
}

export default portalprovider
