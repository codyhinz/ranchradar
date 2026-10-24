-- Cosmetic variants (Alcremie flavors, Florges colors, Furfrou trims, ...): reference data,
-- plus an optional variant on each roster entry. A variant must belong to the entry's form.

create table public.form_variants (
  id        text primary key,                 -- 'alcremie-ruby-cream'
  form_id   text not null references public.forms(id),
  position  int  not null,                    -- game order, 0 = default look
  unique (form_id, id)
);

create table public.variant_names (
  variant_id  text not null references public.form_variants(id),
  locale      text not null,
  name        text not null,
  primary key (variant_id, locale)
);

alter table public.roster_entries
  add column variant text,
  add constraint roster_entries_variant_fk
    foreign key (form_id, variant) references public.form_variants (form_id, id);

-- Reference data: readable by everyone, writable by no one but migrations and the seed.
alter table public.form_variants enable row level security;
alter table public.variant_names enable row level security;
create policy read_all on public.form_variants for select to anon, authenticated using (true);
create policy read_all on public.variant_names for select to anon, authenticated using (true);
grant select on public.form_variants, public.variant_names to anon, authenticated;
grant all on public.form_variants, public.variant_names to service_role;
