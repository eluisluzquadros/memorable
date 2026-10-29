-- Estado do serviço que não pertence a uma conta: referências coletadas pelo Radar e agendamentos.
create table if not exists memoravel.service_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table memoravel.service_state enable row level security;
