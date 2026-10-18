-- Tipo de cada preventa (Profesional, Líder o Gerente), gestionado desde Leads > Presales > Gestionar preventas.
-- La ocupación global de la vista Presales solo cuenta a los de tipo 'profesional'.
alter table public.presales_status
  add column if not exists kind text not null default 'profesional'
  check (kind in ('profesional', 'lider', 'gerente'));

notify pgrst, 'reload schema';
