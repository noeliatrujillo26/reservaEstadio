// ═══════════════════════════════════════════════════════════════════
// permisos.js — control de acceso por rol del panel.
// espejo 1:1 de v1: puedoAcceder() de js/modules/utils.js y _PERMS_DEFAULT
// de js/22-usuarios-clientes.js.
//
// REGLA DE ORO: el rol Administrador tiene acceso TOTAL e IRRESTRICTO,
// SIEMPRE — ignora por completo los permisos individuales. Para los demas
// roles se evalua el mapa {seccion: 'ver'|'editar'} del perfil con sesion.
// Sin sesion cargada (arranque, detras del login) no se bloquea nada.
// ═══════════════════════════════════════════════════════════════════

// todas las secciones que puede tener un perfil, tomadas del menu lateral.
// 'ajustes' no lo trae la v1 (no tiene pagina de Ajustes) — se agrega para
// app_config, el modulo NUEVO de parametros globales. Administrador-only por
// defecto, igual que 'usuarios': no se agrega a los perfiles de Vendedora,
// Cajero ni 'Solo lectura' de abajo.
export const perms_all = [
  'dashboard', 'clientes', 'cotizaciones', 'palcos', 'pipeline', 'completados',
  'seccionesreservadas', 'consumos', 'crear', 'temporadas', 'precios', 'landing',
  'cobros', 'descuentos', 'metodos', 'reportes', 'mensajes', 'usuarios', 'movimientos',
  'ajustes',
]

export const perms_default = {
  Administrador: perms_all.reduce((o, k) => { o[k] = 'editar'; return o }, {}),
  Vendedora: {
    clientes: 'editar', cotizaciones: 'editar', pipeline: 'editar',
    seccionesreservadas: 'editar', consumos: 'ver', reportes: 'ver',
  },
  Cajero: { cobros: 'editar', consumos: 'editar', seccionesreservadas: 'ver' },
  'Solo lectura': { reportes: 'ver' },
}

export function puedo_acceder(usuario, seccion, accion) {
  if (!usuario) return true
  const rol = String(usuario.rol || '').toLowerCase()
  if (rol === 'administrador' || rol === 'admin') return true // BYPASS ABSOLUTO
  // "Completados" es el archivo del Pipeline: hereda sus permisos sin
  // requerir una llave propia en los perfiles existentes.
  const s = seccion === 'completados' ? 'pipeline' : seccion
  const nivel = (usuario.permisos || {})[s]
  if (!nivel) return false
  return (accion || 'ver') === 'ver' ? true : nivel === 'editar'
}

// ¿la seccion se puede editar? (false = modo solo lectura para esa vista)
export function puede_editar_vista(usuario, seccion) {
  return puedo_acceder(usuario, seccion, 'editar')
}
