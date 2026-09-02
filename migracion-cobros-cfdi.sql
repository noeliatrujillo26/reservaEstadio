-- ═══════════════════════════════════════════════════════════════════
-- migracion-cobros-cfdi.sql
-- Guarda el CFDI (PDF y XML) de un cobro EN LA BASE, no en la sesion.
--
-- POR QUE HACE FALTA
-- La v1 adjunta el CFDI en memoria: _cargarFacturaArchivo() lee el archivo con
-- FileReader y lo deja en `cobros[i].facturaPDF = { nombre, dataUrl }`. Nunca
-- llega a Supabase. Al recargar la pagina el adjunto desaparece, y en otro
-- equipo nunca estuvo. En la v2 se perderia todavia antes, porque despues de
-- cada escritura el panel RELEE de la base.
--
-- Aqui el archivo se sube a Storage (bucket comprobantes_pagos, carpeta
-- facturas/) y en estas dos columnas queda su liga. El archivo se sube
-- SIEMPRE, existan o no las columnas: si faltan, el panel avisa nombrando esta
-- migracion y deja la liga en la bitacora de movimientos, para que el CFDI no
-- se pierda mientras tanto.
--
-- Es aditiva y reversible: solo agrega dos columnas de texto que admiten NULL.
-- No toca ninguna fila existente ni ningun dato de la v1.
--
-- COMO CORRERLA: Supabase → SQL Editor → pegar y ejecutar.
-- ═══════════════════════════════════════════════════════════════════

alter table public.cobros
  add column if not exists factura_pdf text,
  add column if not exists factura_xml text;

comment on column public.cobros.factura_pdf is
  'URL firmada del PDF del CFDI en comprobantes_pagos/facturas/. NULL = sin CFDI adjunto.';
comment on column public.cobros.factura_xml is
  'URL firmada del XML del CFDI en comprobantes_pagos/facturas/. NULL = sin CFDI adjunto.';

-- Comprobacion: deben aparecer las dos columnas.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'cobros'
   and column_name in ('factura_pdf', 'factura_xml')
 order by column_name;
