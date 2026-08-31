// ═══════════════════════════════════════════════════════════════════
// usuarios.js — cuentas y permisos del sistema.
// espejo 1:1 de v1: cargarUsuariosDesdeSupabase() (js/30-init.js),
// renderUsuarios(), _ROLE_BADGE y _PERMS_GROUPS (js/22-usuarios-clientes.js).
// ═══════════════════════════════════════════════════════════════════

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
