// ═══════════════════════════════════════════════════════════════════
// useclientesescritura.js — EDITAR ficha, AUTORIZAR/REVOCAR crédito,
// ELIMINAR e IMPORTAR (CSV) un cliente.
//
// Mismo patron que usecotizacionesescritura.js: tres candados de escritura.js
// (bandera, permiso del rol sobre el modulo 'clientes', RLS) y verificacion
// de la respuesta antes de dar por hecha la escritura.
//
// Un cliente derivado SOLO de sus reservas (nunca dado de alta en la tabla
// `clientes`, id === null) no tiene fila propia: editar crea la fila, y
// autorizar/eliminar no tienen nada que tocar todavia — se avisa en vez de
// escribir sobre un id inexistente.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import { buscar_cliente } from '../lib/clientes'
import {
  actualizar_verificado, borrar_verificado, insertar_verificado, mensajes_bloqueo,
  motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'

const claves_cliente = ['nombre', 'email', 'tel', 'empresa', 'credito_autorizado', 'saldo_favor', 'facturacion']

export function useclientesescritura() {
  const { usuario } = useadmin()
  const { clientes, recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [borrando, setborrando] = useState(null)
  const [importando, setimportando] = useState(false)

  const puede = motivo_bloqueo(usuario, 'clientes') === null

  // ── EDITAR (o dar de alta la ficha, si el cliente solo existia por sus
  // reservas) ──────────────────────────────────────────────────────
  // datos = { nombre, email, tel, empresa, facturacion: {...} | null }
  const editar = useCallback(
    async (cliente, datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'clientes')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (guardando) return { ok: false }
      const faltan = []
      if (!String(datos.nombre || '').trim()) faltan.push('nombre')
      if (!String(datos.email || '').trim()) faltan.push('email')
      if (faltan.length) {
        mostrartoast('⚠️ Nombre y email son obligatorios')
        return { ok: false, campos: faltan }
      }

      setguardando(true)
      try {
        const payload = {
          nombre: String(datos.nombre).trim(),
          email: datos.email || '',
          tel: datos.tel || '',
          empresa: datos.empresa || '',
          facturacion: datos.facturacion || null,
        }

        const res = cliente.id != null
          ? await actualizar_verificado(sb, usuario, 'clientes', payload, cliente.id, claves_cliente)
          : await insertar_verificado(sb, usuario, 'clientes', payload, claves_cliente)

        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `clientes`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        mostrartoast('✅ Cliente ' + payload.nombre + ' guardado')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: (cliente.id != null ? 'Cliente editado · ' : 'Cliente creado · ') + payload.nombre,
          ref: payload.nombre,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } catch (err) {
        console.error('editar cliente:', err)
        mostrartoast('⚠️ No se pudo guardar el cliente. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, mostrartoast, recargar]
  )

  // ── AUTORIZAR / REVOCAR crédito ──────────────────────────────────
  const autorizar_credito = useCallback(
    async (cliente, autorizado) => {
      const bloqueo = motivo_bloqueo(usuario, 'clientes')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (cliente.id == null) {
        mostrartoast('⚠️ Este cliente todavía no tiene ficha propia — edítalo primero para crearla.')
        return { ok: false }
      }

      const res = await actualizar_verificado(
        sb, usuario, 'clientes', { credito_autorizado: !!autorizado }, cliente.id, ['credito_autorizado']
      )
      if (!res.ok) {
        mostrartoast(
          res.motivo === 'sin_filas'
            ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `clientes`.'
            : '⚠️ No se pudo actualizar en Supabase' +
              ((res.error && res.error.message) ? ': ' + res.error.message : '.')
        )
        return { ok: false }
      }
      mostrartoast(autorizado ? '✅ Crédito autorizado para ' + cliente.nombre : 'Crédito revocado para ' + cliente.nombre)
      registrar_movimiento(sb, {
        tipo: 'Admin',
        desc: (autorizado ? 'Crédito autorizado · ' : 'Crédito revocado · ') + cliente.nombre,
        ref: cliente.nombre,
        usuario: usuario ? usuario.nombre : '—',
      })
      await recargar()
      return { ok: true }
    },
    [usuario, mostrartoast, recargar]
  )

  // ── ELIMINAR ──────────────────────────────────────────────────────
  // Borrado real (no hay estado "cancelado" en `clientes`): solo la ficha
  // desaparece, su historial de reservas y cobros sigue intacto.
  const eliminar = useCallback(
    async (cliente) => {
      const bloqueo = motivo_bloqueo(usuario, 'clientes')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (cliente.id == null) {
        mostrartoast('⚠️ Este cliente todavía no tiene ficha propia que eliminar.')
        return { ok: false }
      }
      if (borrando) return { ok: false }

      setborrando(cliente.id)
      try {
        const res = await borrar_verificado(sb, usuario, 'clientes', cliente.id)
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la eliminación (0 filas). Revisa las políticas RLS de `clientes`.'
              : '⚠️ No se pudo eliminar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }
        mostrartoast('🗑️ Cliente ' + cliente.nombre + ' eliminado')
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Cliente eliminado · ' + cliente.nombre,
          ref: cliente.nombre,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } catch (err) {
        console.error('eliminar cliente:', err)
        mostrartoast('⚠️ No se pudo eliminar el cliente. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setborrando(null)
      }
    },
    [usuario, borrando, mostrartoast, recargar]
  )

  // ── IMPORTAR (CSV) ────────────────────────────────────────────────
  // filas = [{ nombre, email, tel, empresa }, …] — ver filas_csv_a_clientes()
  // en lib/clientes.js. Cada fila se cruza por identidad (buscar_cliente,
  // la MISMA regla de nombre+telefono/correo que usa el resto del panel)
  // contra la tabla `clientes` YA CARGADA: si coincide, actualiza esa ficha;
  // si no, da de alta una nueva. Fila por fila y no en un solo upsert,
  // porque cada una pasa por el mismo candado de escritura y verificacion
  // que una edicion manual.
  const importar = useCallback(
    async (filas) => {
      const bloqueo = motivo_bloqueo(usuario, 'clientes')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (importando) return { ok: false }
      const validas = (filas || []).filter((f) => String(f.nombre || '').trim() || String(f.email || '').trim())
      if (!validas.length) {
        mostrartoast('⚠️ El archivo no tiene filas con nombre o email')
        return { ok: false }
      }

      setimportando(true)
      try {
        let creados = 0
        let actualizados = 0
        let fallidos = 0
        for (const fila of validas) {
          const payload = {
            nombre: String(fila.nombre || '').trim() || '—',
            email: fila.email || '',
            tel: fila.tel || '',
            empresa: fila.empresa || '',
          }
          const existente = buscar_cliente(clientes, payload)
          const res = existente
            ? await actualizar_verificado(sb, usuario, 'clientes', payload, existente.id, claves_cliente)
            : await insertar_verificado(sb, usuario, 'clientes', payload, claves_cliente)
          if (res.ok) { if (existente) actualizados++; else creados++ } else fallidos++
        }

        mostrartoast(
          '✅ Importación: ' + creados + ' nuevo(s), ' + actualizados + ' actualizado(s)' +
          (fallidos ? ', ' + fallidos + ' con error' : ''),
          8000
        )
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Importación de clientes (CSV) · ' + creados + ' nuevos, ' + actualizados + ' actualizados' + (fallidos ? ', ' + fallidos + ' con error' : ''),
          ref: 'CSV',
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true, creados, actualizados, fallidos }
      } catch (err) {
        console.error('importar clientes:', err)
        mostrartoast('⚠️ No se pudo completar la importación. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setimportando(false)
      }
    },
    [usuario, importando, clientes, mostrartoast, recargar]
  )

  return { puede, editar, guardando, autorizar_credito, eliminar, borrando, importar, importando }
}

export default useclientesescritura
