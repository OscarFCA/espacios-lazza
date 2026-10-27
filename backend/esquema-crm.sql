-- Legato Capital — esquema del CRM (segunda ronda).
-- Pégalo completo en Supabase → SQL Editor → Run. Es idempotente.
--
-- Qué resuelve: hasta ahora los interesados, sus mensajes y la actividad vivían
-- en el localStorage del navegador de cada persona. Un cliente se registraba en
-- su teléfono, pedía una visita, y el Kanban del equipo nunca se enteraba.
-- Esto es el hallazgo T9 de la auditoría del 25-oct-2026.
--
-- Requiere haber corrido antes `esquema.sql`, que crea public.equipo y
-- public.es_equipo().

-- ======================= la regla que gobierna todo =======================
--
-- Los clientes NO tienen cuenta de Supabase: se "registran" con nombre, correo
-- y teléfono, sin contraseña. Escriben con la llave anon, que es pública y
-- viaja en el HTML. De ahí la regla:
--
--     anon PUEDE INSERTAR.  anon NO PUEDE LEER.
--
-- Si se le diera lectura, cualquiera con la llave —es decir, cualquiera que
-- abra el sitio y mire el código— se bajaría la lista entera de interesados
-- con sus teléfonos y presupuestos. El cliente sigue viendo SU conversación
-- desde la copia de su propio navegador, igual que hasta hoy; la copia del
-- servidor es la del equipo.

-- ============================== clientes ==============================

create table if not exists public.clientes (
  id         text primary key,          -- el mismo uid que ya genera el navegador
  nombre     text not null,
  correo     text not null default '',
  telefono   text not null default '',
  pais       text not null default 'MX',
  whatsapp   text not null default '',
  pais_wa    text not null default '',
  creado     timestamptz not null default now()
);

comment on table public.clientes is
  'Quien se registra en el sitio. Sin contraseña: no son cuentas de Supabase.';

-- ============================== interesados ==============================
-- Una ficha del Kanban. Nace del registro o del primer mensaje.

create table if not exists public.leads (
  id            text primary key,
  cliente_id    text references public.clientes(id) on delete set null,
  nombre        text not null,
  correo        text not null default '',
  correos_extra text not null default '',
  telefono      text not null default '',
  pais          text not null default 'MX',
  whatsapp      text not null default '',
  pais_wa       text not null default '',
  empresa       text not null default '',
  presupuesto   bigint not null default 0,
  etapa         text not null default 'nuevo',
  propiedad     text not null default '',
  notas         jsonb not null default '[]'::jsonb,
  origen        text not null default '',
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

create index if not exists leads_etapa on public.leads (etapa, actualizado desc);
create index if not exists leads_cliente on public.leads (cliente_id);

-- ============================== mensajes ==============================

create table if not exists public.mensajes (
  id         text primary key,
  lead_id    text references public.leads(id) on delete cascade,
  cliente_id text,
  de         text not null check (de in ('cliente','equipo')),
  tipo       text not null default 'contacto',
  canal      text not null default '',
  texto      text not null default '',
  slug       text not null default '',
  dia        text not null default '',
  hora       text not null default '',
  confirmada boolean not null default false,
  leido      boolean not null default false,
  fecha      timestamptz not null default now()
);

create index if not exists mensajes_lead on public.mensajes (lead_id, fecha);
create index if not exists mensajes_sinleer on public.mensajes (leido) where de = 'cliente';

-- ============================== actividad ==============================

create table if not exists public.actividad (
  id         text primary key,
  tipo       text not null,
  cliente_id text,
  nombre     text not null default '',
  slug       text not null default '',
  fecha      timestamptz not null default now()
);

create index if not exists actividad_fecha on public.actividad (fecha desc);

-- ============================== ajustes ==============================
-- La agenda de visitas es una sola para todo el negocio: no es de nadie en
-- particular, así que vive aquí y no en una tabla por usuario. El cliente SÍ
-- la lee —necesita saber qué horarios puede pedir—, y solo el equipo la cambia.

create table if not exists public.ajustes (
  clave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

comment on table public.ajustes is
  'Configuración del negocio. Hoy: la clave "agenda" con los horarios de visita.';

-- `actualizado` se mantiene solo.
-- OJO: NO sirve la función del catálogo, `tocar_actualizada()`, porque allá la
-- columna se llama `actualizada` y aquí `actualizado`. Reutilizarla hacía
-- fallar toda edición con «record "new" has no field "actualizada"»: el equipo
-- movía una ficha de etapa y el servidor la rechazaba en silencio.
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

drop trigger if exists leads_actualizada on public.leads;
drop trigger if exists leads_actualizado on public.leads;
create trigger leads_actualizado
  before update on public.leads
  for each row execute function public.tocar_actualizado();

drop trigger if exists ajustes_actualizado on public.ajustes;
create trigger ajustes_actualizado
  before update on public.ajustes
  for each row execute function public.tocar_actualizado();

-- ============================== seguridad ==============================

alter table public.clientes  enable row level security;
alter table public.leads     enable row level security;
alter table public.mensajes  enable row level security;
alter table public.actividad enable row level security;
alter table public.ajustes   enable row level security;

-- ---- clientes: cualquiera se registra; solo el equipo lee ----
drop policy if exists "cualquiera se registra" on public.clientes;
create policy "cualquiera se registra"
  on public.clientes for insert
  to anon, authenticated
  with check (true);

drop policy if exists "el equipo ve clientes" on public.clientes;
create policy "el equipo ve clientes"
  on public.clientes for select
  to authenticated
  using (public.es_equipo());

drop policy if exists "el equipo edita clientes" on public.clientes;
create policy "el equipo edita clientes"
  on public.clientes for update
  to authenticated
  using (public.es_equipo()) with check (public.es_equipo());

/* El aviso de privacidad del sitio promete derechos ARCO, y la C es de
   cancelación: si alguien pide que borremos sus datos, tiene que poderse.
   Sin esta política el equipo podía leerlos pero no eliminarlos, y la
   promesa del aviso no se habría podido cumplir. */
drop policy if exists "el equipo borra clientes" on public.clientes;
create policy "el equipo borra clientes"
  on public.clientes for delete
  to authenticated
  using (public.es_equipo());

-- ---- leads: cualquiera deja el suyo; solo el equipo los ve y los mueve ----
drop policy if exists "cualquiera deja su ficha" on public.leads;
create policy "cualquiera deja su ficha"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "el equipo ve leads" on public.leads;
create policy "el equipo ve leads"
  on public.leads for select
  to authenticated
  using (public.es_equipo());

drop policy if exists "el equipo edita leads" on public.leads;
create policy "el equipo edita leads"
  on public.leads for update
  to authenticated
  using (public.es_equipo()) with check (public.es_equipo());

drop policy if exists "el equipo borra leads" on public.leads;
create policy "el equipo borra leads"
  on public.leads for delete
  to authenticated
  using (public.es_equipo());

-- ---- mensajes ----
-- Ojo al `de = 'cliente'`: sin eso, cualquiera con la llave pública podría
-- insertar un mensaje firmado como si lo hubiera escrito el equipo.
drop policy if exists "el cliente escribe" on public.mensajes;
create policy "el cliente escribe"
  on public.mensajes for insert
  to anon
  with check (de = 'cliente');

drop policy if exists "el equipo responde" on public.mensajes;
create policy "el equipo responde"
  on public.mensajes for insert
  to authenticated
  with check (public.es_equipo());

drop policy if exists "el equipo ve mensajes" on public.mensajes;
create policy "el equipo ve mensajes"
  on public.mensajes for select
  to authenticated
  using (public.es_equipo());

drop policy if exists "el equipo marca mensajes" on public.mensajes;
create policy "el equipo marca mensajes"
  on public.mensajes for update
  to authenticated
  using (public.es_equipo()) with check (public.es_equipo());

drop policy if exists "el equipo borra mensajes" on public.mensajes;
create policy "el equipo borra mensajes"
  on public.mensajes for delete
  to authenticated
  using (public.es_equipo());

-- ---- actividad ----
drop policy if exists "cualquiera deja rastro" on public.actividad;
create policy "cualquiera deja rastro"
  on public.actividad for insert
  to anon, authenticated
  with check (true);

drop policy if exists "el equipo ve actividad" on public.actividad;
create policy "el equipo ve actividad"
  on public.actividad for select
  to authenticated
  using (public.es_equipo());

-- Por lo mismo: el rastro de una persona se va con ella.
drop policy if exists "el equipo borra actividad" on public.actividad;
create policy "el equipo borra actividad"
  on public.actividad for delete
  to authenticated
  using (public.es_equipo());

-- ---- ajustes: esta sí la lee cualquiera ----
-- El cliente necesita los horarios para poder pedir una visita.
drop policy if exists "los horarios son publicos" on public.ajustes;
create policy "los horarios son publicos"
  on public.ajustes for select
  to anon, authenticated
  using (true);

drop policy if exists "el equipo fija ajustes" on public.ajustes;
create policy "el equipo fija ajustes"
  on public.ajustes for insert
  to authenticated
  with check (public.es_equipo());

drop policy if exists "el equipo cambia ajustes" on public.ajustes;
create policy "el equipo cambia ajustes"
  on public.ajustes for update
  to authenticated
  using (public.es_equipo()) with check (public.es_equipo());

-- ============================== comprobación ==============================
select
  (select count(*) from public.clientes)  as clientes,
  (select count(*) from public.leads)     as leads,
  (select count(*) from public.mensajes)  as mensajes,
  (select count(*) from public.actividad) as actividad,
  (select count(*) from public.ajustes)   as ajustes;
