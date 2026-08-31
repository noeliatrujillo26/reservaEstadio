// ═══════════════════════════════════════════════════════════════════
// admindatoscontext.jsx — carga de datos del panel (solo lectura).
// espejo de v1: cargarCobrosDesdeSupabase(), cargarReservasDesdeSupabase(),
// cargarZonaEstadosDesdeSupabase(), cargarAreasDesdeSupabase() y el loader de
// movimientos de js/30-init.js.
//
// Se monta SOLO con sesion iniciada: estas tablas exigen usuario autenticado
// (la llave anon no las lee). Todo son SELECT.
//
// La v1 pagina `cobros` y `reservas` con sbSelectTodas porque supabase corta
// en 1000 filas y, con orden ascendente, los registros MAS NUEVOS eran justo
// los que se caian del resultado. Ese paginado se conserva aqui.
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useState } from 'react'
import { sb } from '../supabaseclient'
import areas_data from '../lib/areasdata'
import { map_usuario } from '../lib/usuarios'
import { map_movimiento } from '../lib/movimientos'
import { map_descuento, map_descuento_volumen, map_metodo } from '../lib/catalogos'

export const admindatoscontext = createContext(null)

const PAGINA = 1000

// espejo de sbSelectTodas(): trae la tabla completa por paginas.
async function select_todas(tabla, orden) {
  let filas = []
  let desde = 0
  for (;;) {
    const { data, error } = await sb
      .from(tabla)
      .select('*')
      .order(orden, { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) return { data: null, error }
    filas = filas.concat(data || [])
    if (!data || data.length < PAGINA) break
    desde += PAGINA
  }
  return { data: filas, error: null }
}

// espejo de _mapCobroFila(): solo los campos que consume el dashboard.
function map_cobro(c) {
  return {
    id: c.id,
    fecha: c.fecha || '',
    mes: c.mes || '',
    cliente: c.cliente || '—',
    concepto: c.concepto || '',
    monto: Number(c.monto) || 0,
    formapago: c.forma_pago || '',
    folio: c.folio || '',
    estado: c.estado || '', // 'cancelado' = borrado suave (no suma en nada)
    createdat: c.created_at || null,
  }
}

// espejo del map de cargarReservasDesdeSupabase().
function map_reserva_admin(r) {
  return {
    id: r.id,
    cliente: r.cliente,
    zona: r.zona,
    juego: r.juego,
    juegoid: r.juego_id != null ? String(r.juego_id) : '',
    zonaid: r.zona_id || '',
    monto: r.monto,
    montopagado: r.monto_pagado,
    descuentomonto: r.descuento_monto || 0,
    estadopago: r.estado_pago,
    pago: r.pago,
    estado: r.estado,
    email: r.email || '',
    tel: r.tel || '',
    personas: r.personas,
    // adultos conserva el NULL de la base: marca que la fila NUNCA la gestiono
    // el panel (el checkout en linea no escribe esa columna). El conteo de
    // personas depende de esa distincion para no sumar ninos dos veces.
    adultos: r.adultos != null ? r.adultos : null,
    ninos: r.ninos || 0,
    saldoconsumo: r.saldo_consumo || 0,
  }
}

// espejo de syncAreasDesdeCrear() (js/01-nucleo.js): el catalogo de zonas son
// las SECCIONES REALES del mapa (tabla mapa_secciones), no la lista quemada.
//
// Esto importa mucho mas de lo que parece: zona_juego_estado.zona_id apunta a
// ESTOS ids. Con el catalogo quemado ('td-1', 'ti-7'…) ninguna fila cruzaba,
// asi que todos los juegos caian al estado base de la tabla `areas` y las
// tarjetas de Reservas mostraban las mismas cifras para cualquier juego. De
// aqui sale tambien `escompartida`, sin la cual el filtro "Palcos
// compartidos" no encontraba ninguno.
function map_seccion(s) {
  return {
    id: s.id || 'sec-' + s.num,
    nombre: s.nombre || 'Sección ' + s.num,
    cap: s.cap || 50,
    // configuracion de palco compartido (migracion-palcos-compartidos.sql).
    escompartida: s.es_compartida === true,
    capacidadmaxima: s.capacidad_maxima != null ? Number(s.capacidad_maxima) : null,
    estado: 'libre',
  }
}

// espejo del map de cargarJuegosDesdeSupabase().
// El `id` va normalizado a STRING a proposito: los <select> siempre entregan
// strings, y las comparaciones estrictas contra un id numerico fallaban
// dejando la tabla de Reservas vacia y los KPIs en 0. La v1 lo documenta con
// esas mismas palabras; migrarlo con un select crudo se salto esa
// normalizacion y reintrodujo el bug.
function map_juego(j) {
  return {
    id: String(j.id),
    mes: j.mes,
    fecha: j.fecha || '',
    hora: j.hora,
    rival: j.rival,
    num: j.num,
    serie: j.serie,
    estado: j.estado,
    notas: j.notas,
  }
}

// las llaves de zona_juego_estado tambien se normalizan a string, para que
// crucen con los ids de arriba sin depender del tipo que devuelva la base.
function map_estados_zona(filas) {
  const mapa = {}
  filas.forEach((row) => {
    const k = String(row.juego_id)
    if (!mapa[k]) mapa[k] = {}
    mapa[k][String(row.zona_id)] = row.estado
  })
  return mapa
}

export function admindatosprovider({ children }) {
  const [cobros, setcobros] = useState([])
  const [reservas, setreservas] = useState([])
  const [juegos, setjuegos] = useState([])
  const [areas, setareas] = useState(areas_data)
  const [areasestados, setareasestados] = useState({})
  const [movimientos, setmovimientos] = useState([])
  const [clientes, setclientes] = useState([])
  const [usuarios, setusuarios] = useState([])
  const [descuentos, setdescuentos] = useState([])
  const [descuentosvolumen, setdescuentosvolumen] = useState([])
  const [metodos, setmetodos] = useState([])
  const [cargando, setcargando] = useState(true)
  const [errores, seterrores] = useState([])

  const cargar = useCallback(async () => {
    setcargando(true)
    const fallos = []

    // cada consulta por separado: si una falla, las demas siguen y el panel
    // pinta lo que si tenga — mismo criterio de la v1, que aisla los renders.
    const [rcobros, rreservas, rjuegos, rareas, rsecciones, restados, rmovs, rclientes, rusuarios,
      rdescuentos, rdescvolumen, rmetodos] = await Promise.allSettled([
      select_todas('cobros', 'id'),
      select_todas('reservas', 'id'),
      sb.from('juegos').select('*').order('fecha'),
      sb.from('areas').select('*'),
      sb.from('mapa_secciones').select('*').order('orden'),
      sb.from('zona_juego_estado').select('*'),
      sb.from('movimientos').select('*').order('created_at', { ascending: false }).limit(50),
      select_todas('clientes', 'id'),
      sb.from('usuarios').select('*').order('id'),
      sb.from('descuentos').select('*'),
      sb.from('descuentos_volumen').select('*').order('min_personas'),
      sb.from('metodos_pago').select('*').order('id'),
    ])

    const ok = (r, etiqueta) => {
      if (r.status !== 'fulfilled' || r.value.error) {
        fallos.push(etiqueta)
        console.error('Dashboard · ' + etiqueta + ':', r.reason || (r.value && r.value.error))
        return null
      }
      return r.value.data || []
    }

    const dc = ok(rcobros, 'cobros')
    if (dc) setcobros(dc.map(map_cobro))

    const dr = ok(rreservas, 'reservas')
    if (dr) setreservas(dr.map(map_reserva_admin))

    const dj = ok(rjuegos, 'juegos')
    if (dj) setjuegos(dj.map(map_juego))

    // el catalogo sale de mapa_secciones; solo si no hay secciones se usa la
    // lista quemada, igual que syncAreasDesdeCrear() cuando no encuentra nada.
    const ds = ok(rsecciones, 'mapa_secciones')
    const catalogo = ds && ds.length ? ds.map(map_seccion) : areas_data
    // la tabla `areas` solo aporta el estado base de cada zona.
    const da = ok(rareas, 'areas')
    setareas(
      catalogo.map((a) => {
        const fila = da ? da.find((x) => String(x.id) === String(a.id)) : null
        return fila ? { ...a, estado: fila.estado } : a
      })
    )

    const de = ok(restados, 'zona_juego_estado')
    if (de) setareasestados(map_estados_zona(de))

    const dm = ok(rmovs, 'movimientos')
    if (dm) setmovimientos(dm.map(map_movimiento))

    // la tabla `clientes` viaja cruda: lib/clientes.js la normaliza al armar
    // el expediente.
    const dcl = ok(rclientes, 'clientes')
    if (dcl) setclientes(dcl)

    const du = ok(rusuarios, 'usuarios')
    if (du) setusuarios(du.map(map_usuario))

    const dd = ok(rdescuentos, 'descuentos')
    if (dd) setdescuentos(dd.map(map_descuento))

    // tolerante: si la tabla aun no existe (migracion pendiente) queda vacia y
    // solo se avisa en consola, igual que la v1.
    const ddv = ok(rdescvolumen, 'descuentos_volumen')
    if (ddv) setdescuentosvolumen(ddv.map(map_descuento_volumen))

    const dme = ok(rmetodos, 'metodos_pago')
    if (dme) setmetodos(dme.map(map_metodo))

    seterrores(fallos)
    setcargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const valor = {
    cobros, reservas, juegos, areas, areasestados, movimientos, clientes, usuarios,
    descuentos, descuentosvolumen, metodos,
    cargando, errores, recargar: cargar,
  }

  return <admindatoscontext.Provider value={valor}>{children}</admindatoscontext.Provider>
}

export default admindatosprovider
