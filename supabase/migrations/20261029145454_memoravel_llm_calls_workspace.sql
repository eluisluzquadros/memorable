-- Gasto real por marca: cada chamada de IA guarda a marca do pedido (quando há uma).
alter table memoravel.llm_calls add column if not exists workspace text;
create index if not exists llm_calls_owner_ws_at_idx on memoravel.llm_calls(owner, workspace, at);
