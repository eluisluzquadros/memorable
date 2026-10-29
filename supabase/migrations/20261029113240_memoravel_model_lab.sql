-- Laboratório de modelos: cada rodada (EXP pré-registrado) e cada saída de modelo, com custo,
-- tempo, notas dos juízes e checagens. Um item salvo nunca é pago de novo: a rodada retoma dele.
create table memoravel.bench_runs (
  id text primary key,
  experiment text not null,
  title text not null,
  task text not null,
  status text not null default 'running',
  budget_usd numeric(10,4),
  spent_usd numeric(10,4) not null default 0,
  config jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table memoravel.bench_items (
  key text primary key,
  run_id text not null references memoravel.bench_runs(id) on delete cascade,
  brief_id text,
  role text not null,
  model text not null,
  provider text not null default 'openrouter',
  output jsonb,
  checks jsonb,
  scores jsonb,
  mean numeric(5,2),
  cost_usd numeric(10,6),
  credits numeric(10,2),
  seconds numeric(8,1),
  input_tokens integer,
  output_tokens integer,
  status text not null default 'done',
  error text,
  created_at timestamptz not null default now()
);
create index bench_items_run_idx on memoravel.bench_items(run_id, role);
alter table memoravel.bench_runs enable row level security;
alter table memoravel.bench_items enable row level security;
