-- Ambang — skema Supabase. Jalankan sekali di SQL Editor (aman diulang untuk fungsi/policy).
-- Prinsip: kolom question_options.score TIDAK bisa dibaca klien sama sekali (column grant).
-- Skor hanya keluar lewat RPC: check_answer (latihan, ditolak saat ada tryout aktif) dan submit_tryout.

create extension if not exists pgcrypto;

-- ---------- Tabel ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  ai_quota_used int not null default 0,
  ai_quota_date date
);

create table if not exists categories (
  id text primary key,                 -- kode: TWK, TIU-NUM, …
  parent_id text references categories,
  name text not null,
  tooltip_text text
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references categories,
  type text not null check (type in ('single', 'weighted')),
  body text not null,
  image_path text,
  explanation text,
  difficulty smallint default 2 check (difficulty between 1 and 3),
  source text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  owner_id uuid references auth.users on delete set null default auth.uid(),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);
create index if not exists questions_cat_idx on questions (category_id) where status = 'published' and visibility = 'public';

create table if not exists question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions on delete cascade,
  label char(1) not null check (label in ('A', 'B', 'C', 'D', 'E')),
  body text not null,
  score smallint not null check (score between 0 and 5),
  unique (question_id, label)
);

create table if not exists ai_explanations (
  question_id uuid primary key references questions on delete cascade,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists exam_configs (
  id text primary key,
  name text not null,
  year int not null,
  per_category_count jsonb not null,   -- [{"category":"TWK","count":30}, …] — array agar urutan terjaga
  duration_min int not null,
  passing_grade jsonb not null         -- {"TWK":65,"TIU":80,"TKP":166}
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  mode text not null check (mode in ('practice', 'tryout')),
  config_id text references exam_configs,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score_breakdown jsonb
);
create index if not exists attempts_user_idx on attempts (user_id, started_at desc);

create table if not exists attempt_answers (
  attempt_id uuid not null references attempts on delete cascade,
  question_id uuid not null references questions on delete cascade,
  position int not null,
  option_id uuid references question_options on delete set null,
  is_flagged boolean not null default false,
  time_spent_s int,
  primary key (attempt_id, question_id)
);

create table if not exists excel_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  exercise_id text not null,           -- materi Excel statis di lib/excel-lessons.ts
  formulas jsonb not null,
  score numeric not null,
  graded boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null default auth.uid(),
  question_id uuid not null references questions on delete cascade,
  kind text not null check (kind in ('soal', 'ai')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Helper ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Soal terlihat oleh pemanggil? (publik+terbit, milik sendiri, atau admin)
create or replace function can_see_question(q questions) returns boolean
language sql stable as $$
  select (q.visibility = 'public' and q.status = 'published') or q.owner_id = auth.uid() or is_admin();
$$;

-- Pemanggil sedang mengerjakan tryout yang memuat soal ini?
create or replace function in_active_tryout(p_question uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from attempts a
    join exam_configs c on c.id = a.config_id
    join attempt_answers aa on aa.attempt_id = a.id and aa.question_id = p_question
    where a.user_id = auth.uid() and a.mode = 'tryout' and a.finished_at is null
      and a.started_at > now() - make_interval(mins => c.duration_min + 10)
  );
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table categories enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table ai_explanations enable row level security;
alter table exam_configs enable row level security;
alter table attempts enable row level security;
alter table attempt_answers enable row level security;
alter table excel_submissions enable row level security;
alter table reports enable row level security;

drop policy if exists p_profiles_read on profiles;
create policy p_profiles_read on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists p_profiles_update on profiles;
create policy p_profiles_update on profiles for update using (id = auth.uid());
-- Pengguna hanya boleh mengubah nama; role & kuota hanya lewat server.
revoke update on profiles from anon, authenticated;
grant update (name) on profiles to authenticated;

drop policy if exists p_cat_read on categories;
create policy p_cat_read on categories for select using (true);
drop policy if exists p_cat_admin on categories;
create policy p_cat_admin on categories for all using (is_admin()) with check (is_admin());

drop policy if exists p_q_read on questions;
create policy p_q_read on questions for select using (can_see_question(questions));
drop policy if exists p_q_insert on questions;
create policy p_q_insert on questions for insert to authenticated
  with check (owner_id = auth.uid() and visibility = 'private' and status in ('draft', 'review'));
drop policy if exists p_q_update_own on questions;
create policy p_q_update_own on questions for update to authenticated
  using (owner_id = auth.uid() and visibility = 'private')
  with check (owner_id = auth.uid() and visibility = 'private' and status in ('draft', 'review'));
drop policy if exists p_q_delete_own on questions;
create policy p_q_delete_own on questions for delete to authenticated using (owner_id = auth.uid() and visibility = 'private');
drop policy if exists p_q_admin on questions;
create policy p_q_admin on questions for all using (is_admin()) with check (is_admin());

-- Opsi: baca tanpa kolom score; tulis hanya untuk soal pribadi milik sendiri.
revoke all on question_options from anon, authenticated;
grant select (id, question_id, label, body) on question_options to anon, authenticated;
grant insert, delete on question_options to authenticated;
drop policy if exists p_opt_read on question_options;
create policy p_opt_read on question_options for select
  using (exists (select 1 from questions q where q.id = question_id));   -- RLS questions ikut berlaku
drop policy if exists p_opt_write_own on question_options;
create policy p_opt_write_own on question_options for insert to authenticated
  with check (exists (select 1 from questions q where q.id = question_id and q.owner_id = auth.uid() and q.visibility = 'private'));
drop policy if exists p_opt_delete_own on question_options;
create policy p_opt_delete_own on question_options for delete to authenticated
  using (exists (select 1 from questions q where q.id = question_id and q.owner_id = auth.uid() and q.visibility = 'private'));

-- ai_explanations: tanpa policy = hanya service role (route /api/explain) yang bisa baca/tulis.
-- Sengaja tidak "publik baca" agar pembahasan tidak bocor saat tryout berjalan.

drop policy if exists p_cfg_read on exam_configs;
create policy p_cfg_read on exam_configs for select using (true);
drop policy if exists p_cfg_admin on exam_configs;
create policy p_cfg_admin on exam_configs for all using (is_admin()) with check (is_admin());

drop policy if exists p_att_read on attempts;
create policy p_att_read on attempts for select using (user_id = auth.uid() or is_admin());
drop policy if exists p_att_insert on attempts;
create policy p_att_insert on attempts for insert to authenticated with check (user_id = auth.uid() and mode = 'practice');

drop policy if exists p_aa_read on attempt_answers;
create policy p_aa_read on attempt_answers for select
  using (exists (select 1 from attempts a where a.id = attempt_id and a.user_id = auth.uid()));

drop policy if exists p_xl_own on excel_submissions;
create policy p_xl_own on excel_submissions for select using (user_id = auth.uid());
drop policy if exists p_xl_insert on excel_submissions;
create policy p_xl_insert on excel_submissions for insert to authenticated with check (user_id = auth.uid());

drop policy if exists p_rep_insert on reports;
create policy p_rep_insert on reports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists p_rep_admin on reports;
create policy p_rep_admin on reports for select using (is_admin());

-- ---------- RPC ----------
-- Bentuk JSON soal untuk klien (tanpa skor & pembahasan).
create or replace function question_json(q questions) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', q.id,
    'category', q.category_id,
    'group', coalesce(c.parent_id, c.id),
    'categoryName', coalesce(c.parent_id, c.id) || ' · ' || c.name,
    'type', q.type,
    'body', q.body,
    'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body) order by o.label)
                from question_options o where o.question_id = q.id)
  )
  from categories c where c.id = q.category_id;
$$;

-- Latihan: soal acak dari kategori/subkategori, atau 'PRIBADI' untuk soal milik sendiri.
create or replace function practice_set(p_category text, p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(question_json(q)), '[]'::jsonb) from (
    select q.* from questions q join categories c on c.id = q.category_id
    where case when p_category = 'PRIBADI'
               then q.owner_id = auth.uid() and q.visibility = 'private'
               else (q.visibility = 'public' and q.status = 'published') and (c.id = p_category or c.parent_id = p_category) end
    order by random() limit least(greatest(p_limit, 1), 50)
  ) q;
$$;

-- Kunci + pembahasan satu soal, setelah pengguna menjawab di mode latihan.
create or replace function check_answer(p_question uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q questions;
begin
  select * into q from questions where id = p_question;
  if q.id is null or not can_see_question(q) then raise exception 'Soal tidak ditemukan'; end if;
  if in_active_tryout(p_question) then raise exception 'Soal ini sedang ada di tryout aktif Anda'; end if;
  return jsonb_build_object(
    'scores', (select jsonb_object_agg(label, score) from question_options where question_id = p_question),
    'explanation', coalesce(q.explanation, ''));
end $$;

-- Mulai tryout: pilih soal acak per kategori sesuai konfigurasi, simpan urutannya, kirim tanpa skor.
create or replace function start_tryout(p_config text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg exam_configs;
  att attempts;
  part jsonb;
  pos int := 0;
begin
  if auth.uid() is null then raise exception 'Masuk dulu untuk tryout'; end if;
  select * into cfg from exam_configs where id = p_config;
  if cfg.id is null then raise exception 'Konfigurasi tryout tidak ada'; end if;

  -- tutup tryout lama yang belum selesai
  update attempts set finished_at = now() where user_id = auth.uid() and mode = 'tryout' and finished_at is null;

  insert into attempts (user_id, mode, config_id) values (auth.uid(), 'tryout', cfg.id) returning * into att;

  for part in select * from jsonb_array_elements(cfg.per_category_count) loop
    insert into attempt_answers (attempt_id, question_id, position)
    select att.id, q.id, pos + row_number() over ()
    from (select q.id from questions q join categories c on c.id = q.category_id
          where q.visibility = 'public' and q.status = 'published'
            and (c.id = part->>'category' or c.parent_id = part->>'category')
          order by random() limit (part->>'count')::int) q;
    select coalesce(max(position), pos) into pos from attempt_answers where attempt_id = att.id;
  end loop;

  return jsonb_build_object(
    'attemptId', att.id,
    'startedAt', att.started_at,
    'durationMin', cfg.duration_min,
    'questions', (select coalesce(jsonb_agg(question_json(q) order by aa.position), '[]'::jsonb)
                  from attempt_answers aa join questions q on q.id = aa.question_id where aa.attempt_id = att.id));
end $$;

-- Submit tryout: simpan jawaban, hitung skor di server dari konfigurasi, kembalikan skor + kunci untuk ditinjau.
create or replace function submit_tryout(p_attempt uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  att attempts;
  cfg exam_configs;
  groups jsonb;
  result jsonb;
begin
  select * into att from attempts where id = p_attempt and user_id = auth.uid() and mode = 'tryout';
  if att.id is null then raise exception 'Tryout tidak ditemukan'; end if;
  if att.finished_at is not null then raise exception 'Tryout sudah dikumpulkan'; end if;
  select * into cfg from exam_configs where id = att.config_id;

  -- option_id hanya diterima bila memang milik soal tersebut
  update attempt_answers aa set
    option_id = (select o.id from question_options o where o.id = nullif(x->>'option_id', '')::uuid and o.question_id = aa.question_id),
    is_flagged = coalesce((x->>'is_flagged')::boolean, false)
  from jsonb_array_elements(p_answers) x
  where aa.attempt_id = att.id and aa.question_id = (x->>'question_id')::uuid;

  select jsonb_agg(g order by g.ord) into groups from (
    select coalesce(c.parent_id, c.id) as code,
           sum(coalesce(o.score, 0))::int as score,
           sum(mx.m)::int as max,
           count(aa.option_id)::int as answered,
           count(*)::int as total,
           (cfg.passing_grade->>coalesce(c.parent_id, c.id))::int as passing,
           sum(coalesce(o.score, 0)) >= coalesce((cfg.passing_grade->>coalesce(c.parent_id, c.id))::int, 0) as passed,
           min(aa.position) as ord
    from attempt_answers aa
    join questions q on q.id = aa.question_id
    join categories c on c.id = q.category_id
    left join question_options o on o.id = aa.option_id
    left join lateral (select max(score) m from question_options where question_id = aa.question_id) mx on true
    where aa.attempt_id = att.id
    group by coalesce(c.parent_id, c.id)
  ) g;

  result := jsonb_build_object(
    'groups', coalesce((select jsonb_agg(e - 'ord') from jsonb_array_elements(groups) e), '[]'::jsonb),
    'total', coalesce((select sum((e->>'score')::int) from jsonb_array_elements(groups) e), 0),
    'passed', coalesce((select bool_and((e->>'passed')::boolean) from jsonb_array_elements(groups) e), false));

  update attempts set finished_at = now(), score_breakdown = result where id = att.id;

  return jsonb_build_object(
    'breakdown', result,
    'review', (select jsonb_object_agg(q.id, jsonb_build_object(
                  'scores', (select jsonb_object_agg(label, score) from question_options where question_id = q.id),
                  'explanation', coalesce(q.explanation, '')))
               from attempt_answers aa join questions q on q.id = aa.question_id where aa.attempt_id = att.id));
end $$;

-- Supabase memberi EXECUTE ke public/anon/authenticated secara default; persempit.
revoke execute on function start_tryout(text), submit_tryout(uuid, jsonb), question_json(questions), in_active_tryout(uuid) from public, anon, authenticated;
grant execute on function start_tryout(text), submit_tryout(uuid, jsonb) to authenticated;

-- ---------- Data awal ----------
insert into exam_configs (id, name, year, per_category_count, duration_min, passing_grade) values
  ('skd-2024', 'Tryout SKD · Paket 1', 2024,
   '[{"category":"TWK","count":30},{"category":"TIU","count":35},{"category":"TKP","count":45}]', 100,
   '{"TWK":65,"TIU":80,"TKP":166}')
on conflict (id) do nothing;
-- Kategori & soal contoh: jalankan `npm run import-soal -- data/soal-contoh.json` (lihat README).
-- Jadikan diri Anda admin: update profiles set role = 'admin' where id = '<uuid akun Anda>';
