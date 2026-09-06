-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: configuracion_panel — parámetros del panel en clave/valor.
-- Ejecutar completa en Supabase → SQL Editor. Idempotente: se puede correr
-- mas de una vez sin duplicar nada.
--
-- QUÉ ES: la MISMA tabla que la v1 agrego el 01 sep 2026
-- (migracion-configuracion-panel.sql de su propio repositorio) para sacar de
-- localStorage tres configuraciones que antes variaban por navegador
-- ('mensajes', 'cotiz_plantilla', 'desc_max_sin_autorizacion'). Si esa
-- migracion YA se corrio en esta base, el CREATE TABLE de abajo es un no-op
-- (IF NOT EXISTS) y las filas de la v1 quedan intactas.
--
-- POR QUE SE REUTILIZA EN V2: el modulo Ajustes de v2 (fiscal, cuenta
-- bancaria por defecto, plantilla de recibos/cotizaciones) vivia en una tabla
-- APARTE (app_config, ver migracion-app-config.sql) con fila unica y columnas
-- fijas. Esa tabla NO se borra ni se toca por esta migracion —sigue en pie
-- como respaldo— pero sus datos SI se copian aqui abajo: de ahora en
-- adelante v2 lee y escribe configuracion_panel, igual que la v1.
--
-- LLAVES QUE USA V2 (nuevas, sin equivalente en la v1 — datos fiscales y
-- cuenta bancaria no existen en su configuracion_panel):
--   · 'fiscal'                     → razon social, RFC, domicilio, telefonos
--   · 'cuenta_bancaria_default_id' → id de metodos_pago sugerido primero
--   · 'cotiz_plantilla'            → MISMA llave que usa la v1 para la
--     plantilla del PDF de cotizacion/recibo (logo/color/nombre); v2 guarda
--     su propia forma de este bloque (nombre/color/logourl, sin el campo
--     'condiciones' que trae la v1) bajo la MISMA llave, para que el nombre
--     coincida si algun dia ambas versiones leen la misma fila.
--
-- RLS: PERMISIVA (using(true)/with check(true)), igual que la v1 la definio
-- originalmente — NO la politica restrictiva (puede_editar_alguno) que usa
-- el resto del panel v2 para sus tablas propias. Es una decision deliberada:
-- no esta confirmado si esta base es la MISMA que usa la v1 en produccion, y
-- una politica restrictiva nueva conviviria con la permisiva de la v1 sin
-- reemplazarla (Postgres evalua ambas), asi que agregar una NO cierra nada y
-- si se corre esto en una base ya gobernada por la v1 no hay riesgo de
-- interferir con lo que ya funciona ahi. El candado real en v2 sigue siendo
-- el de la interfaz: motivo_bloqueo()/tabla_modulo_edicion exige el modulo
-- 'ajustes' antes de intentar el upsert (ver src/lib/escritura.js).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.configuracion_panel (
  clave          text primary key,
  valor          jsonb,
  actualizado_en timestamptz not null default now()
);

comment on table public.configuracion_panel is
  'Configuraciones del panel admin (clave → valor jsonb): plantillas de mensajes, plantilla del PDF de cotización, política de descuento, datos fiscales y cuenta bancaria por defecto (v2). La base es la fuente de verdad.';

alter table public.configuracion_panel enable row level security;

drop policy if exists "configuracion_panel_lectura" on public.configuracion_panel;
create policy "configuracion_panel_lectura" on public.configuracion_panel
  for select to authenticated using (true);
drop policy if exists "configuracion_panel_escritura" on public.configuracion_panel;
create policy "configuracion_panel_escritura" on public.configuracion_panel
  for all to authenticated using (true) with check (true);
revoke select, insert, update, delete on public.configuracion_panel from anon;


-- ── MIGRAR LOS DATOS YA CAPTURADOS EN app_config (si la tabla existe) ──────
-- Copia la fila unica (id=1) de app_config a sus tres llaves nuevas. Sobre
-- una fila que ya exista en configuracion_panel (por ejemplo, si esto se
-- corre dos veces) actualiza en vez de duplicar. app_config NO se toca: sigue
-- ahi como respaldo, sin usarse desde el panel a partir de esta migracion.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'app_config') then

    insert into public.configuracion_panel (clave, valor, actualizado_en)
    select 'fiscal', coalesce(fiscal, '{}'::jsonb), now()
      from public.app_config where id = 1
    on conflict (clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en;

    insert into public.configuracion_panel (clave, valor, actualizado_en)
    select 'cuenta_bancaria_default_id', to_jsonb(cuenta_bancaria_default_id), now()
      from public.app_config where id = 1
    on conflict (clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en;

    insert into public.configuracion_panel (clave, valor, actualizado_en)
    select 'cotiz_plantilla', coalesce(plantilla_recibos, '{}'::jsonb), now()
      from public.app_config where id = 1
    on conflict (clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en;

  end if;
end $$;


-- ── COMPROBAR ──────────────────────────────────────────────────────────────
select clave, valor, actualizado_en from public.configuracion_panel order by clave;
-- Debe listar (al menos) 'fiscal', 'cuenta_bancaria_default_id' y
-- 'cotiz_plantilla' con los datos que ya tenias capturados en Ajustes.
