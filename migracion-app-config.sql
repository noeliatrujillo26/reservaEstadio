-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: app_config — parámetros globales del sistema.
-- Ejecutar completa en Supabase → SQL Editor. Requiere que
-- migracion-roles-rls.sql ya se haya corrido antes (usa la funcion
-- public.puede_editar_alguno(), creada ahi) — si "public.puede_editar_alguno"
-- no existe, esta migración fallará al crear las políticas.
--
-- POR QUÉ: la v1 NO tiene una tabla de configuración. Sus "ajustes" viven
-- repartidos en tres sitios distintos, ninguno editable desde el panel:
--   · datos fiscales / contacto → hardcodeados en js/00-config.js (cambiar
--     algo exige editar el código y volver a desplegar)
--   · plantilla de recibos/cotizaciones → en localStorage de CADA navegador
--     (nrj_cotiz_plantilla) — no se comparte entre sesiones ni dispositivos
--   · no existe página de Ajustes en absoluto
-- Este modulo es NUEVO, no una migración 1:1 de algo existente.
--
-- ALCANCE: esta tabla es para el PANEL ADMIN únicamente por ahora. El sitio
-- público (recibos/checkout) sigue leyendo su copia estática de
-- js/00-config.js / api/_lib/config.js sin cambios — conectar esos flujos a
-- esta tabla es trabajo aparte, deliberadamente fuera de esta migración para
-- no arriesgar el checkout en producción.
--
-- FORMA: fila única (singleton, id=1) con los tres bloques que pidió el
-- negocio. "Cuenta bancaria predeterminada" NO duplica los datos del banco:
-- apunta por id a una fila ya existente en `metodos_pago` (evita tener el
-- mismo dato de banco en dos tablas que se puedan desincronizar).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.app_config (
  id integer primary key default 1,
  fiscal jsonb not null default '{}'::jsonb,
  cuenta_bancaria_default_id integer references public.metodos_pago(id) on delete set null,
  plantilla_recibos jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  actualizado_por text,
  constraint app_config_fila_unica check (id = 1)
);

-- fila inicial: sin ella el panel tendría que distinguir "sin fila todavía"
-- de "fila con campos vacíos" en cada lectura.
insert into public.app_config (id) values (1)
  on conflict (id) do nothing;

alter table public.app_config enable row level security;

-- LECTURA: cualquier cuenta con sesión (mismo criterio que el resto de los
-- catálogos del panel — Métodos de pago, Descuentos, etc.).
drop policy if exists app_config_lectura on public.app_config;
create policy app_config_lectura on public.app_config
  as permissive for select to authenticated using (true);

-- ESCRITURA: solo quien tenga nivel 'editar' en el módulo 'ajustes' — la
-- MISMA función que ya protege reservas/clientes/cobros/cotizaciones
-- (migracion-roles-rls.sql). El rol Administrador siempre pasa (bypass
-- incluido en esa función). Sin política de DELETE a propósito: la fila
-- única no se borra nunca, ni siquiera un Administrador debería poder
-- hacerlo por accidente desde afuera del panel.
drop policy if exists app_config_escritura_upd on public.app_config;
create policy app_config_escritura_upd on public.app_config
  as restrictive for update to authenticated
  using (public.puede_editar_alguno(array['ajustes']))
  with check (public.puede_editar_alguno(array['ajustes']));

-- Verificación: debe listar 2 políticas.
select policyname, cmd, permissive
  from pg_policies
 where schemaname = 'public' and tablename = 'app_config'
 order by cmd;
