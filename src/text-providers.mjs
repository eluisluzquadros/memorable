// Mirrors DEFAULT_TEXT_MODELS in server/text-model.mjs; the server stays the authority.
const models = { anthropic: 'claude-opus-5-5', openai: 'gpt-4.1-mini', gemini: 'gemini-2.5-flash' };
const labels = { server: 'Provedor do servidor', anthropic: 'Claude conectado', openai: 'OpenAI conectado', gemini: 'Gemini conectado' };
export const defaultTextModel = (provider) => models[provider] || models.anthropic;
export const textProviderLabel = (provider) => labels[provider] || provider;
