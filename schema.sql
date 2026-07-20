-- ============================================================
-- PRIMO SOCCER LEAGUE — SCHEMA NOVO (V2)
-- Banco relacional normalizado + histórico automático de versões
-- Corrige a causa raiz da perda de dados da versão anterior:
--   o app antigo salvava TUDO (todos os alunos, agenda, pontos,
--   mata-mata) em UMA ÚNICA LINHA de uma tabela (primo_app_state),
--   e qualquer "sincronizar" com o app carregado vazio sobrescrevia
--   essa linha inteira, apagando todos os alunos de uma vez.
--   Além disso, a anon key (que fica visível no código do site)
--   tinha permissão de escrita direta no banco, então qualquer
--   pessoa com o link podia, sem querer ou não, apagar tudo.
-- ============================================================

-- 1) EXTENSÕES
create extension if not exists pgcrypto;

-- 2) ALUNOS (uma linha por aluno, nunca mais um blob único)
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  category text not null,          -- ex: 'kids', 'adulto'
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) MATRÍCULA MENSAL (quais alunos estão ativos em cada mês/horário)
create table if not exists public.monthly_enrollment (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  schedule_slot text,              -- ex: 'Horário 1', 'Horário 2'
  created_at timestamptz not null default now(),
  unique (athlete_id, year, month, schedule_slot)
);

-- 4) PONTUAÇÃO (uma linha por lançamento de ponto, nunca substitui a anterior)
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  week int,
  points int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);

-- 5) MATA-MATA
create table if not exists public.bracket_matches (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  phase text not null,             -- 'quartas','semi','final'
  athlete_a uuid references public.athletes(id) on delete set null,
  athlete_b uuid references public.athletes(id) on delete set null,
  score_a int,
  score_b int,
  winner uuid references public.athletes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6) HISTÓRICO / BACKUP AUTOMÁTICO
-- Toda vez que um aluno é alterado ou apagado, guarda uma cópia aqui.
-- Isso permite restaurar mesmo que alguém apague por engano.
create table if not exists public.athletes_history (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  snapshot jsonb not null,
  action text not null,            -- 'insert','update','delete'
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);

create or replace function public.fn_athletes_history()
returns trigger language plpgsql as $$
begin
  insert into public.athletes_history(athlete_id, snapshot, action, changed_by)
  values (
    coalesce(new.id, old.id),
    to_jsonb(coalesce(new, old)),
    lower(tg_op),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_athletes_history on public.athletes;
create trigger trg_athletes_history
after insert or update or delete on public.athletes
for each row execute function public.fn_athletes_history();

-- 7) SEGURANÇA (RLS)
-- Leitura pública (para os links de aluno/pais), escrita SOMENTE autenticado (admin logado).
alter table public.athletes enable row level security;
alter table public.monthly_enrollment enable row level security;
alter table public.scores enable row level security;
alter table public.bracket_matches enable row level security;
alter table public.athletes_history enable row level security;

drop policy if exists "public read athletes" on public.athletes;
create policy "public read athletes" on public.athletes for select to anon, authenticated using (true);
drop policy if exists "admin write athletes" on public.athletes;
create policy "admin write athletes" on public.athletes for all to authenticated using (true) with check (true);

drop policy if exists "public read enrollment" on public.monthly_enrollment;
create policy "public read enrollment" on public.monthly_enrollment for select to anon, authenticated using (true);
drop policy if exists "admin write enrollment" on public.monthly_enrollment;
create policy "admin write enrollment" on public.monthly_enrollment for all to authenticated using (true) with check (true);

drop policy if exists "public read scores" on public.scores;
create policy "public read scores" on public.scores for select to anon, authenticated using (true);
drop policy if exists "admin write scores" on public.scores;
create policy "admin write scores" on public.scores for all to authenticated using (true) with check (true);

drop policy if exists "public read bracket" on public.bracket_matches;
create policy "public read bracket" on public.bracket_matches for select to anon, authenticated using (true);
drop policy if exists "admin write bracket" on public.bracket_matches;
create policy "admin write bracket" on public.bracket_matches for all to authenticated using (true) with check (true);

-- histórico só o admin logado pode ver/restaurar
drop policy if exists "admin read history" on public.athletes_history;
create policy "admin read history" on public.athletes_history for select to authenticated using (true);

-- ============================================================
-- IMPORTANTE: nenhuma tabela aqui permite que o público (anon)
-- escreva. Só um usuário autenticado (o professor logado via
-- Supabase Auth) consegue inserir, editar ou apagar. Isso, junto
-- com o histórico automático acima, é o que impede a perda total
-- de dados que aconteceu na versão anterior.
-- ============================================================
