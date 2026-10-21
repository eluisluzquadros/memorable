// Curated OpenRouter models for writing, observability and benchmarks (ids verified 2026-10-20).
// Prices here are fallbacks in US$ per million tokens; the service refreshes them from OpenRouter.
export const LLM_TIERS = [
  ["frontier", "Fronteira"],
  ["challenger", "Rivais"],
  ["budget", "Econômicos"],
  ["free", "Gratuitos e abertos"],
];

export const LLM_CATALOG = [
  { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", vendor: "Anthropic", tier: "frontier", input: 4, output: 20 },
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", vendor: "Anthropic", tier: "frontier", input: 2, output: 10 },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", vendor: "OpenAI", tier: "frontier", input: 2, output: 10 },
  { id: "google/gemini-4-argon", label: "Gemini 4 Argon", vendor: "Google", tier: "frontier", input: 2, output: 10 },
  { id: "x-ai/grok-4.7", label: "Grok 4.7", vendor: "xAI", tier: "frontier", input: 2, output: 6 },
  { id: "deepseek/deepseek-v4-pro-0813", label: "DeepSeek V4 Pro", vendor: "DeepSeek", tier: "challenger", input: 0.66, output: 1.98, open: true },
  { id: "z-ai/glm-5.3", label: "GLM 5.3", vendor: "Zhipu (Z.ai)", tier: "challenger", input: 0.08, output: 1.4, open: true },
  { id: "qwen/qwen3.8-max-0902", label: "Qwen 3.8 Max", vendor: "Alibaba (Qwen)", tier: "challenger", input: 2, output: 6 },
  { id: "mistralai/mistral-large-4-0", label: "Mistral Large 4", vendor: "Mistral", tier: "challenger", input: 1.36, output: 4.18 },
  { id: "moonshotai/kimi-k3", label: "Kimi K3", vendor: "Moonshot", tier: "challenger", input: 0.24, output: 11.94, open: true },
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", vendor: "Anthropic", tier: "budget", input: 0.1, output: 0.5 },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", vendor: "OpenAI", tier: "budget", input: 0.1, output: 0.5 },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", vendor: "Google", tier: "budget", input: 0.83, output: 4.13 },
  { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", vendor: "DeepSeek", tier: "budget", input: 0.07, output: 0.5, open: true },
  { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash", vendor: "Zhipu (Z.ai)", tier: "budget", input: 0.15, output: 0.5, open: true },
  { id: "qwen/qwen3.8-flash", label: "Qwen 3.8 Flash", vendor: "Alibaba (Qwen)", tier: "budget", input: 0.15, output: 0.47, open: true },
  { id: "mistralai/mistral-small-2603", label: "Mistral Small", vendor: "Mistral", tier: "budget", input: 0.15, output: 0.6, open: true },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", vendor: "Meta", tier: "free", input: 0.19, output: 0.65, open: true },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (grátis)", vendor: "Google", tier: "free", input: 0, output: 0, open: true },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super (grátis)", vendor: "NVIDIA", tier: "free", input: 0, output: 0, open: true },
  { id: "minimax/minimax-m3.1-flash:free", label: "MiniMax M3.1 Flash (grátis)", vendor: "MiniMax", tier: "free", input: 0, output: 0, open: true },
];

export const catalogModel = (id) => LLM_CATALOG.find((m) => m.id === id);

// Cost in US$ from token counts, using per-million prices.
export const estimateCost = (model, inputTokens = 0, outputTokens = 0) =>
  model ? (inputTokens * model.input + outputTokens * model.output) / 1e6 : null;
