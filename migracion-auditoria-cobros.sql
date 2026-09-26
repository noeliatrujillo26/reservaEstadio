-- ═══════════════════════════════════════════════════════════════════
-- migracion-auditoria-cobros.sql
-- Trazabilidad de auditoría por cobro: QUIÉN lo registró, DESDE DÓNDE y
-- QUÉ tipo de movimiento fue.
--
-- POR QUÉ HACE FALTA
-- `cobros.recibio` ya guarda un NOMBRE (usuario.nombre), pero un nombre no es
-- una identidad verificable: dos vendedoras pueden compartir apodo, y un
-- nombre cambiado en el perfil deja el historial apuntando a nadie. Para
-- controlar descuadres de caja hace falta el ID/correo REAL de la cuenta
-- autenticada, ademas de desde qué app se registró (el celular de
-- /reserva-express o el panel de escritorio) y si el dinero fue nuevo o una
-- redención del saldo a favor del cliente (usecobrosescritura.js ya
-- distingue las dos, ver la cabecera de esa función).
--
-- El TIMESTAMP exacto ya existe: `created_at` (ver migracion-cobros-hora.sql,
-- ya aplicada — lib/cobros.js la lee como `createdat`). No se duplica aquí.
--
-- Es aditiva y reversible: solo agrega columnas de texto que admiten NULL.
-- Si esta migración AÚN no corrió, insertar_verificado() (lib/escritura.js)
-- detecta el error de columna y reintenta solo con las columnas viejas — el
-- cobro se sigue guardando, nada más sin estos cuatro datos hasta que se
-- corra esto.
--
-- COMO CORRERLA: Supabase → SQL Editor → pegar y ejecutar.
-- ═══════════════════════════════════════════════════════════════════

alter table public.cobros
  add column if not exists creado_por_id text,
  add column if not exists creado_por_email text,
  add column if not exists origen text,
  add column if not exists tipo_movimiento text;

comment on column public.cobros.creado_por_id is
  'ID (uuid de auth.users / usuarios.id) de la cuenta que registró el cobro. NULL en registros previos a esta migración.';
comment on column public.cobros.creado_por_email is
  'Correo de la cuenta que registró el cobro, tal como estaba en su sesión al momento del cobro.';
comment on column public.cobros.origen is
  'Desde dónde se registró: RESERVA_EXPRESS_MOBILE (/reserva-express) o PIPELINE_ADMIN (panel de escritorio, Registro de Cobros).';
comment on column public.cobros.tipo_movimiento is
  'ABONO_DIRECTO (dinero nuevo, cualquier forma de pago) o REDENCION_SALDO_A_FAVOR (se gastó saldo ya acumulado del cliente).';

-- Comprobación: deben aparecer las cuatro columnas.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'cobros'
   and column_name in ('creado_por_id', 'creado_por_email', 'origen', 'tipo_movimiento')
 order by column_name;
