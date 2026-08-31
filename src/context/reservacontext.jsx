// ═══════════════════════════════════════════════════════════════════
// reservacontext.jsx — estado compartido del flujo de reserva.
// espejo de las variables globales de v1 en panel-inicio.html:
//   _juegosPorFecha, _juegoActivoFecha, _calJuegoActual, _capMin, _dispoJuegos
//
// vive en un contexto porque lo comparten la seccion de juegos, el mini
// calendario, el filtro de capacidad y —mas adelante— el mapa y el checkout.
//
// FUENTE DE DATOS: las tablas `juegos`, `mapa_secciones` y `zona_juego_estado`
// NO son legibles con la llave anon: fix-rls-escritura-anonima.sql le revoco
// el acceso a proposito y la v1 las sirve solo por /api/sitio.js con la
// service_role. Aqui se conserva ese diseno: se piden a los mismos endpoints,
// con los mismos respaldos que la v1 (localStorage y luego juegos_default).
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import juegos_default from '../lib/juegosdefault'
import { hoy_hermosillo } from '../lib/fechas'

export const reservacontext = createContext(null)

// espejo de cargarJuegos(): cache local primero, respaldo quemado despues.
function leer_juegos_cache() {
  try {
    const raw = localStorage.getItem('naranjeros-juegos')
    return raw ? JSON.parse(raw) : juegos_default
  } catch (e) {
    return juegos_default
  }
}

export function reservaprovider({ children }) {
  const [juegos, setjuegos] = useState(() =>
    [...leer_juegos_cache()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  )
  // disponibilidad real por juego (zona_juego_estado). mismo objeto que la v1.
  const [dispo, setdispo] = useState({ totalZonas: 0, ocupadasPorJuego: {} })
  // _capMin arranca en 20: el filtro "20+" es la opcion por defecto, igual que
  // el boton que trae la clase .active en el html de la v1.
  const [capmin, setcapmin] = useState(20)
  const [juegoactivofecha, setjuegoactivofecha] = useState(null)
  // juego mostrado en el panel del calendario (_calJuegoActual de la v1).
  const [caljuegoactual, setcaljuegoactual] = useState(null)
  // reglas de descuento por grupo (Admin -> Descuentos por volumen).
  // las usan el panel de detalle y, mas adelante, el paso 2 del checkout.
  const [dvreglas, setdvreglas] = useState([])

  useEffect(() => {
    let vivo = true

    // espejo de _sincronizarJuegosDesdeSupabase(): patron de dos fases, ya se
    // pinto con el cache y esto sobrescribe con el calendario real.
    async function sincronizar_juegos() {
      try {
        const resp = await fetch('/api/sitio?r=juegos')
        const data = await resp.json()
        if (!vivo) return
        if (resp.ok && Array.isArray(data.juegos) && data.juegos.length) {
          try {
            localStorage.setItem('naranjeros-juegos', JSON.stringify(data.juegos))
          } catch (e) {}
          setjuegos([...data.juegos].sort((a, b) => a.fecha.localeCompare(b.fecha)))
        }
      } catch (e) {
        console.warn(
          'No se pudo cargar el calendario de juegos desde la base; se usa el caché local si existe.',
          e
        )
      }
    }

    // espejo de _cargarDisponibilidadJuegos(): fail-open, sin datos las
    // tarjetas se quedan en el amarillo intermedio.
    async function cargar_disponibilidad() {
      try {
        const resp = await fetch('/api/sitio?r=disponibilidad-juegos')
        const data = await resp.json()
        if (!vivo) return
        if (resp.ok && data.totalZonas != null) setdispo(data)
      } catch (e) {
        console.warn(
          'No se pudo cargar la disponibilidad de juegos; las tarjetas quedan en verde por defecto.',
          e
        )
      }
    }

    // espejo de _cargarReglasVolumen(): si la red falla NO se marcan como
    // cargadas, para que el siguiente intento (al entrar al checkout) las
    // vuelva a pedir.
    async function cargar_reglas_volumen() {
      try {
        const resp = await fetch('/api/sitio?r=descuentos-volumen')
        const d = await resp.json()
        if (!vivo) return
        if (d && Array.isArray(d.reglas)) setdvreglas(d.reglas)
      } catch (e) {}
    }

    sincronizar_juegos()
    cargar_disponibilidad()
    cargar_reglas_volumen()
    return () => { vivo = false }
  }, [])

  // mapa fecha → juego, igual que _juegosPorFecha de la v1.
  const juegosporfecha = useMemo(() => {
    const m = {}
    juegos.forEach((j) => { m[j.fecha] = j })
    return m
  }, [juegos])

  // los 3 proximos: futuros si los hay, si no la lista completa. espejo de
  // cargarJuegos().
  const proximos = useMemo(() => {
    const hoy = hoy_hermosillo()
    const futuros = juegos.filter((j) => j.fecha >= hoy)
    return (futuros.length ? futuros : juegos).slice(0, 3)
  }, [juegos])

  // semaforo de disponibilidad — espejo exacto de _estadoDisponibilidadJuego():
  //   > 5 zonas libres → verde    "Zonas disponibles"
  //   1-5 zonas        → amarillo "Pocas zonas disponibles"
  //   0 zonas          → rojo     "Zonas no disponibles" (tarjeta sin clic)
  // sin datos todavia cae al amarillo intermedio, para no prometer de mas ni
  // alarmar en falso.
  const estado_disponibilidad = useCallback(
    (juegoid) => {
      const total = dispo.totalZonas
      if (!total) {
        return { estado: 'limitado', texto: 'Pocas zonas disponibles', clase: 'estado-limitado' }
      }
      const ocupadas = dispo.ocupadasPorJuego[juegoid] || 0
      const libres = Math.max(0, total - ocupadas)
      if (libres <= 0) {
        return { estado: 'agotado', texto: 'Zonas no disponibles', clase: 'estado-critico' }
      }
      if (libres <= 5) {
        return { estado: 'limitado', texto: 'Pocas zonas disponibles', clase: 'estado-limitado' }
      }
      return { estado: 'disponible', texto: 'Zonas disponibles', clase: 'estado-disponible' }
    },
    [dispo]
  )

  // el identificador REAL del juego activo (j.id, ej. 'j17'), no la fecha.
  // espejo de _juegoActivoId(): mandar la fecha rompia los cupones
  // restringidos a juegos, que nunca hacian match en juegos_aplicables.
  const juegoactivoid = useMemo(() => {
    const j = juegoactivofecha ? juegosporfecha[juegoactivofecha] : null
    return (j && j.id) || ''
  }, [juegoactivofecha, juegosporfecha])

  // ── descuentos por grupo ────────────────────────────────────────
  // espejo de _dvActiva(): solo lo AFIRMATIVO cuenta (true / 'true' /
  // 'Activo' / 1). antes se rechazaba unicamente `activo === false`, asi que
  // una regla 'Inactivo' —o sin el campo— se aplicaba igual.
  const dv_activa = useCallback((rg) => {
    if (!rg) return false
    const crudo = rg.activo != null ? rg.activo : rg.estado
    if (crudo == null) return false
    if (typeof crudo === 'boolean') return crudo
    const n = String(crudo).trim().toLowerCase()
    return n === 'true' || n === 'activo' || n === 'active' || n === '1' || n === 'si' || n === 'sí'
  }, [])

  // reglas ACTIVAS que cubren esta zona y este juego (sin mirar el minimo de
  // personas), ordenadas por minimo ascendente.
  const dv_reglas_de_zona = useCallback(
    (zonaid, juegoid) =>
      (dvreglas || [])
        .filter((rg) => {
          if (!dv_activa(rg)) return false
          const js = Array.isArray(rg.juegos) && rg.juegos.length ? rg.juegos.map(String) : null
          if (js && (!juegoid || js.indexOf(String(juegoid)) < 0)) return false
          const zs = Array.isArray(rg.zonas) && rg.zonas.length ? rg.zonas.map(String) : null
          if (zs && (!zonaid || zs.indexOf(String(zonaid)) < 0)) return false
          return true
        })
        .sort((a, b) => (Number(a.min_personas) || 0) - (Number(b.min_personas) || 0)),
    [dvreglas, dv_activa]
  )

  // la MEJOR regla ya ganada (mayor %) con las personas actuales.
  const dv_mejor_regla = useCallback(
    (personas, zonaid, juegoid) => {
      let mejor = null
      dv_reglas_de_zona(zonaid, juegoid).forEach((rg) => {
        if ((Number(personas) || 0) < (Number(rg.min_personas) || 0)) return
        if (!mejor || (Number(rg.porcentaje) || 0) > (Number(mejor.porcentaje) || 0)) mejor = rg
      })
      return mejor
    },
    [dv_reglas_de_zona]
  )

  // la SIGUIENTE regla por alcanzar (para invitar a sumar personas).
  const dv_proxima_regla = useCallback(
    (personas, zonaid, juegoid) =>
      dv_reglas_de_zona(zonaid, juegoid).find(
        (rg) => (Number(personas) || 0) < (Number(rg.min_personas) || 0)
      ) || null,
    [dv_reglas_de_zona]
  )

  const valor = {
    juegos,
    juegosporfecha,
    proximos,
    dispo,
    estado_disponibilidad,
    capmin,
    setcapmin,
    juegoactivofecha,
    setjuegoactivofecha,
    juegoactivoid,
    caljuegoactual,
    setcaljuegoactual,
    dv_mejor_regla,
    dv_proxima_regla,
  }

  return <reservacontext.Provider value={valor}>{children}</reservacontext.Provider>
}

export default reservaprovider
