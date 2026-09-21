-- Estado activo/inactivo de cada preventa (gestionado desde Leads > Presales).
-- Se accede solo con la service-role key desde /api/presales/status; RLS activado sin políticas
-- para que la anon key no pueda leer ni escribir.
create table if not exists public.presales_status (
  name        text primary key,
  active      boolean     not null default true,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.presales_status enable row level security;

notify pgrst, 'reload schema';
