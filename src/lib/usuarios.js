// ═══════════════════════════════════════════════════════════════════
// usuarios.js — cuentas y permisos del sistema.
// espejo 1:1 de v1: cargarUsuariosDesdeSupabase() (js/30-init.js),
// renderUsuarios(), _ROLE_BADGE y _PERMS_GROUPS (js/22-usuarios-clientes.js).
//
// ESCRITURA (Fase 2): guardarUsuario(), eliminarUsuario(), toggleUsuario() y
// _passwordDebil()/MSG_PASSWORD_DEBIL (js/22-usuarios-clientes.js,
// js/modules/utils.js). La cuenta de ACCESO (alta y cambio de contraseña) se
// crea/edita via /api/usuarios con la service key — la anon key no puede
// tocar auth.users — exactamente igual que en la v1; ver
// hooks/useusuariosescritura.js. Aqui solo vive la logica PURA: validacion y
// el mapa de roles.
// ═══════════════════════════════════════════════════════════════════

import { email_valido } from './reservasadmin'
import { perms_default } from './permisos'

// espejo del map de cargarUsuariosDesdeSupabase().
export function map_usuario(u) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    estado: u.estado,
    acceso: u.acceso,
    // uuid de la cuenta Auth (perfiles nuevos); sin el, el servidor resuelve
    // por correo.
    authid: u.auth_id || null,
    // el modelo viejo guardaba permisos como LISTA; el nuevo usa un mapa
    // {modulo: 'ver'|'editar'}. Se aceptan los dos.
    permisos: Array.isArray(u.permisos)
      ? u.permisos.reduce((acc, p) => { acc[p] = 'editar'; return acc }, {})
      : u.permisos || {},
  }
}

export const role_badge = {
  Administrador: 'badge-purple',
  Vendedora: 'badge-blue',
  Cajero: 'badge-orange',
  'Solo lectura': 'badge-gray',
}

export function badge_estado_usuario(estado) {
  return estado === 'Activo' ? 'badge-green' : estado === 'Invitado' ? 'badge-blue' : 'badge-gray'
}

// agrupacion de permisos tal cual la muestra el panel de la v1.
export const perms_groups = [
  { label: 'Comercial', items: [
    { key: 'clientes', label: 'Clientes' },
    { key: 'cotizaciones', label: 'Cotizaciones' },
    { key: 'pipeline', label: 'Pipeline Comercial' },
    { key: 'palcos', label: 'Pipeline de Palcos' },
    { key: 'seccionesreservadas', label: 'Reservas' },
    { key: 'consumos', label: 'Saldo de Consumo' },
  ] },
  { label: 'Estadio', items: [
    { key: 'crear', label: 'Crear' },
    { key: 'temporadas', label: 'Temporadas' },
    { key: 'precios', label: 'Precios' },
    { key: 'landing', label: 'Landing' },
  ] },
  { label: 'Finanzas', items: [
    { key: 'cobros', label: 'Cobros' },
    { key: 'descuentos', label: 'Descuentos' },
    { key: 'metodos', label: 'Métodos de pago' },
    { key: 'reportes', label: 'Reportes' },
    { key: 'facturas', label: 'Facturas' },
  ] },
  { label: 'Comunicación', items: [{ key: 'mensajes', label: 'Mensajes' }] },
  { label: 'Sistema', items: [
    { key: 'usuarios', label: 'Usuarios' },
    { key: 'movimientos', label: 'Movimientos' },
    // 'ajustes' es modulo nuevo (app_config): sin equivalente en la v1, ver
    // lib/config.js.
    { key: 'ajustes', label: 'Ajustes' },
  ] },
]

// espejo del filtro de renderUsuarios().
export function filtrar_usuarios(lista, { busqueda, rol, estado }) {
  const q = String(busqueda || '').toLowerCase()
  return lista.filter(
    (u) =>
      (!q ||
        String(u.nombre || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q)) &&
      (!rol || u.rol === rol) &&
      (!estado || u.estado === estado)
  )
}

// permisos efectivos de un perfil, con la MISMA regla del panel: el rol
// Administrador tiene acceso total e irrestricto, y un perfil sin mapa hereda
// los de su rol.
export function permisos_efectivos(u) {
  const rol = String(u.rol || '').toLowerCase()
  if (rol === 'administrador' || rol === 'admin') return perms_default.Administrador
  if (u.permisos && Object.keys(u.permisos).length) return u.permisos
  return perms_default[u.rol] || {}
}

// los 4 roles del <select> de la v1, en el mismo orden.
export const roles_disponibles = ['Administrador', 'Vendedora', 'Cajero', 'Solo lectura']

// ── CONTRASEÑA ───────────────────────────────────────────────────
// espejo EXACTO de _passwordDebil()/MSG_PASSWORD_DEBIL (js/modules/utils.js):
// minimo 8 caracteres con al menos una letra y un numero. La MISMA regla
// vive en api/usuarios.js del lado del servidor — aqui es solo para dar el
// aviso al instante, sin esperar el viaje de ida y vuelta.
export const msg_password_debil =
  'La contraseña debe tener al menos 8 caracteres, incluir números y letras.'

export function password_debil(pass) {
  const p = String(pass || '')
  return p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)
}

// ── VALIDACION DEL ALTA/EDICION ──────────────────────────────────
// espejo del bloque inicial de guardarUsuario(): nombre y correo son
// siempre obligatorios. La contraseña es obligatoria SOLO al dar de alta
// (esalta=true) — al editar, vacia significa "no cambiarla".
export function validar_usuario(d, esalta) {
  const errores = []
  if (!String(d.nombre || '').trim()) {
    errores.push({ campo: 'nombre', mensaje: 'Nombre y correo son obligatorios.' })
  }
  const email = String(d.email || '').trim()
  if (!email) {
    errores.push({ campo: 'email', mensaje: 'Nombre y correo son obligatorios.' })
  } else if (!email_valido(email)) {
    errores.push({ campo: 'email', mensaje: 'El correo no es válido.' })
  }
  const pass = String(d.password || '')
  if (esalta ? password_debil(pass) : (pass && password_debil(pass))) {
    errores.push({ campo: 'password', mensaje: msg_password_debil })
  }
  return errores
}

// ── PERMISOS: armar el mapa desde el estado de los checkboxes ────
// espejo del bucle final de guardarUsuario(): un modulo SIN marcar no entra
// al mapa (queda fuera del menu); uno marcado entra con su nivel ('ver' por
// defecto, 'editar' si el switch esta prendido).
export function permisos_desde_estado(marcados, niveles) {
  const permisos = {}
  Object.keys(marcados || {}).forEach((k) => {
    if (!marcados[k]) return
    permisos[k] = niveles && niveles[k] === 'editar' ? 'editar' : 'ver'
  })
  return permisos
}
