-- Legato Capital — esquema de la base.
-- Pégalo completo en Supabase → SQL Editor → Run. Es idempotente: se puede
-- volver a correr sin romper nada.
--
-- Qué resuelve: hoy las propiedades y sus fotos viven en el localStorage del
-- navegador de quien las sube, así que nadie más las ve. Esto las saca de ahí.

-- ============================== propiedades ==============================

create table if not exists public.propiedades (
  slug         text primary key,
  op           text    not null default 'venta' check (op in ('venta','renta')),
  tipo         text    not null default 'Casa',
  condicion    text    not null default 'Lista para habitar',
  negociable   boolean not null default false,
  exclusiva    boolean not null default false,   -- acceso anticipado
  publicada    boolean not null default true,    -- borrador vs visible
  title        text    not null,
  zona         text    not null,
  price        bigint  not null default 0,
  terreno      integer not null default 0,
  construido   integer not null default 0,
  rec          integer not null default 0,
  ban          integer not null default 0,
  autos        integer not null default 0,
  frente       text    not null default '—',
  -- `desc` es palabra reservada en SQL; el cliente la mapea a `desc`.
  descripcion  text    not null default '',
  potencial    text    not null default '',
  maps         text    not null default '',
  fotos        jsonb   not null default '[]'::jsonb,   -- [{src, alt}]
  orden        integer not null default 0,             -- para ordenar a mano
  creada       timestamptz not null default now(),
  actualizada  timestamptz not null default now()
);

comment on table public.propiedades is
  'Catálogo público. Lo escribe el equipo desde el panel; lo lee cualquiera.';

-- `actualizada` se mantiene sola
create or replace function public.tocar_actualizada()
returns trigger language plpgsql as $$
begin
  new.actualizada = now();
  return new;
end $$;

drop trigger if exists propiedades_actualizada on public.propiedades;
create trigger propiedades_actualizada
  before update on public.propiedades
  for each row execute function public.tocar_actualizada();

-- Buscar por zona o título sin que los acentos estorben
create index if not exists propiedades_busqueda
  on public.propiedades using gin (
    to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(zona,''))
  );
create index if not exists propiedades_op_tipo on public.propiedades (op, tipo);

-- ============================== quién es el equipo =======================
-- Supabase deja el registro abierto por omisión: cualquiera puede crearse una
-- cuenta con la llave anon, que es pública. Por eso "estar autenticado" NO
-- puede ser el permiso para escribir —lo sería para cualquier desconocido que
-- se registre—. El permiso es estar en esta lista.

create table if not exists public.equipo (
  correo   text primary key,
  nombre   text not null default '',
  agregado timestamptz not null default now()
);

comment on table public.equipo is
  'Quién puede escribir el catálogo. Agregar a alguien = un insert aquí, más su usuario en Authentication.';

insert into public.equipo (correo, nombre)
values ('info@lazza.com.mx', 'Jaime Lavín')
on conflict (correo) do nothing;

-- Nadie la lee desde el navegador: RLS encendida y sin ninguna política.
alter table public.equipo enable row level security;

-- `security definer` para que la función sí pueda leerla pese a lo anterior.
create or replace function public.es_equipo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.equipo e
    where lower(e.correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.es_equipo() from public;
grant execute on function public.es_equipo() to anon, authenticated;

-- ============================== seguridad ==============================
-- Regla: el catálogo publicado lo lee cualquiera, aunque no tenga cuenta.
-- Escribir —crear, editar, borrar— solo el equipo de la tabla de arriba.

alter table public.propiedades enable row level security;

drop policy if exists "catalogo publico" on public.propiedades;
create policy "catalogo publico"
  on public.propiedades for select
  to anon, authenticated
  using (publicada = true);

drop policy if exists "el equipo ve todo" on public.propiedades;
create policy "el equipo ve todo"
  on public.propiedades for select
  to authenticated
  using (public.es_equipo());

drop policy if exists "el equipo publica" on public.propiedades;
create policy "el equipo publica"
  on public.propiedades for insert
  to authenticated
  with check (public.es_equipo());

drop policy if exists "el equipo edita" on public.propiedades;
create policy "el equipo edita"
  on public.propiedades for update
  to authenticated
  using (public.es_equipo()) with check (public.es_equipo());

drop policy if exists "el equipo retira" on public.propiedades;
create policy "el equipo retira"
  on public.propiedades for delete
  to authenticated
  using (public.es_equipo());

-- ============================== fotografías ==============================
-- Bucket público: las fotos de un catálogo se ven sin iniciar sesión.
-- Subirlas y borrarlas, solo con sesión.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propiedades', 'propiedades', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "fotos publicas" on storage.objects;
create policy "fotos publicas"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'propiedades');

drop policy if exists "el equipo sube fotos" on storage.objects;
create policy "el equipo sube fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'propiedades' and public.es_equipo());

drop policy if exists "el equipo borra fotos" on storage.objects;
create policy "el equipo borra fotos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'propiedades' and public.es_equipo());

-- ============================== comprobación ==============================
-- Al terminar deberías ver la tabla vacía y sin error:
select count(*) as propiedades from public.propiedades;
-- Y quién puede escribirlas:
select correo from public.equipo;
