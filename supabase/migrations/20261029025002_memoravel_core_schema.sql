-- Memorável: espelho do que hoje vive em SQLite (contas, sessões, estado por conta,
-- colaboradores/sugestões, conexões de integração e registro de chamadas de IA).
-- Schema privado: não é exposto pela API pública (PostgREST). O servidor acessa por conexão direta.
create schema if not exists memoravel;
revoke all on schema memoravel from public, anon, authenticated;

create table memoravel.users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  salt text not null,
  created_at timestamptz not null default now()
);

create table memoravel.sessions (
  token_hash text primary key,
  user_id text not null references memoravel.users(id) on delete cascade,
  expires_at bigint not null
);
create index sessions_user_idx on memoravel.sessions(user_id);
create index sessions_expires_idx on memoravel.sessions(expires_at);

create table memoravel.account_state (
  user_id text primary key references memoravel.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null,
  updated_at timestamptz not null default now()
);

create table memoravel.account_state_backups (
  user_id text not null references memoravel.users(id) on delete cascade,
  revision integer not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision)
);

create table memoravel.contributors (
  id text primary key,
  owner_id text not null references memoravel.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  area text not null,
  workspaces jsonb not null default '[]'::jsonb,
  password_hash text not null,
  salt text not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index contributors_owner_idx on memoravel.contributors(owner_id);

create table memoravel.contributor_sessions (
  token_hash text primary key,
  contributor_id text not null references memoravel.contributors(id) on delete cascade,
  expires_at bigint not null
);

create table memoravel.suggestions (
  id text primary key,
  owner_id text not null references memoravel.users(id) on delete cascade,
  contributor_id text not null references memoravel.contributors(id) on delete cascade,
  workspace text not null,
  title text not null,
  why text not null,
  knowledge text not null,
  reference_url text not null,
  reference_text text not null,
  status text not null,
  reason text not null,
  source_id text,
  decided_by text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index suggestions_owner_idx on memoravel.suggestions(owner_id, workspace);

-- "secret" já vem criptografado pelo serviço (AES-256-GCM); nunca guarde a credencial em claro.
create table memoravel.connections (
  owner text not null,
  provider text not null,
  secret text not null,
  primary key (owner, provider)
);

create table memoravel.jobs (
  seq bigint generated always as identity,
  owner text not null,
  id text not null,
  request_key text,
  data jsonb not null,
  primary key (owner, id),
  unique (owner, request_key)
);

create table memoravel.llm_calls (
  id text primary key,
  at timestamptz not null,
  owner text,
  route text,
  role text,
  provider text,
  model text,
  ms integer,
  input_tokens integer,
  output_tokens integer,
  cost numeric(12,6),
  cost_source text,
  ok boolean not null,
  error text,
  run_tag text
);
create index llm_calls_at_idx on memoravel.llm_calls(at);
create index llm_calls_owner_at_idx on memoravel.llm_calls(owner, at);

-- Defesa em profundidade: RLS ligado e sem políticas = nenhum acesso por chaves públicas.
alter table memoravel.users enable row level security;
alter table memoravel.sessions enable row level security;
alter table memoravel.account_state enable row level security;
alter table memoravel.account_state_backups enable row level security;
alter table memoravel.contributors enable row level security;
alter table memoravel.contributor_sessions enable row level security;
alter table memoravel.suggestions enable row level security;
alter table memoravel.connections enable row level security;
alter table memoravel.jobs enable row level security;
alter table memoravel.llm_calls enable row level security;
