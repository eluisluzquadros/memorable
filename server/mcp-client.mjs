const ENDPOINTS = Object.freeze({
  higgsfield: { url: 'https://mcp.higgsfield.ai/mcp', header: 'Authorization', prefix: 'Bearer ' },
  blotato: { url: 'https://mcp.blotato.com/mcp', header: 'blotato-api-key', prefix: '' },
});
const TIMEOUT = 90000;
const MAX_BYTES = 8 * 1024 * 1024;

// Do not include remote error bodies: they can reflect authorization headers.
const failure = message => new Error(`MCP: ${message}`);
async function responseMessage(response, id) {
  if (response.status === 202 || response.status === 204) {
    if (id !== undefined) throw failure('o servidor não retornou a resposta solicitada.');
    return null;
  }
  if (!response.body) throw failure('resposta vazia do servidor.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const stream = /text\/event-stream/i.test(response.headers.get('content-type') || '');
  let buffer = '', bytes = 0;
  const parse = raw => { try { return JSON.parse(raw); } catch { throw failure('resposta inválida do servidor.'); } };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        bytes += value.length;
        if (bytes > MAX_BYTES) throw failure('resposta excedeu o limite de 8 MB.');
        buffer += decoder.decode(value, { stream: true });
      }
      if (done) buffer += decoder.decode();
      if (stream) {
        // Normalize complete CRLF boundaries, including those split across chunks.
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
          if (!data || data === '[DONE]') continue;
          const message = parse(data);
          if (id !== undefined && message.id === id) return message;
        }
      }
      if (done) {
        if (!stream) {
          if (id === undefined && !buffer.trim()) return null;
          const message = parse(buffer);
          if (id === undefined) return null;
          if (message.id !== id) throw failure('identificador de resposta não corresponde à solicitação.');
          return message;
        }
        if (id === undefined) return null;
        throw failure('fluxo encerrado antes de concluir a solicitação.');
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
}

async function connect(provider, key) {
  if (!Object.hasOwn(ENDPOINTS, provider)) throw failure('provedor não suportado.');
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw failure('configure uma credencial válida para o provedor.');
  const endpoint = ENDPOINTS[provider];
  let session, version = '2025-06-18', nextId = 0;
  async function request(method, params, notification = false) {
    const id = notification ? undefined : ++nextId;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', [endpoint.header]: endpoint.prefix + key.trim() };
    if (session) headers['Mcp-Session-Id'] = session;
    if (method !== 'initialize') headers['MCP-Protocol-Version'] = version;
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST', redirect: 'error', headers,
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ jsonrpc: '2.0', ...(id !== undefined ? { id } : {}), method, ...(params !== undefined ? { params } : {}) }),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if ([401,403].includes(response.status)) throw failure('credencial recusada pelo provedor. Verifique a chave e suas permissões.');
        throw failure(`provedor respondeu HTTP ${response.status}.`);
      }
      if (method === 'initialize') session = response.headers.get('mcp-session-id') || undefined;
      const message = await responseMessage(response, id);
      if (!message) return null;
      if (message.jsonrpc !== '2.0' || message.error || !Object.hasOwn(message, 'result')) throw failure('o provedor recusou a operação ou retornou um protocolo inválido.');
      return message.result;
    } catch (error) {
      if (error.message?.startsWith('MCP: ')) throw error;
      if (['TimeoutError','AbortError'].includes(error.name)) throw failure('tempo limite de 90 segundos excedido. Consulte o provedor antes de repetir uma criação.');
      throw failure('não foi possível concluir a conexão com o provedor.');
    }
  }
  const initialized = await request('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'memorable', version: '0.1.0' } });
  if (!initialized || typeof initialized.protocolVersion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(initialized.protocolVersion)) throw failure('versão de protocolo inválida.');
  version = initialized.protocolVersion;
  await request('notifications/initialized', undefined, true);
  return request;
}

export async function mcpTools(provider, key) {
  const request = await connect(provider, key);
  const tools = [], cursors = new Set(); let cursor;
  for (let page = 0; page < 30; page++) {
    const result = await request('tools/list', cursor ? { cursor } : {});
    if (!Array.isArray(result?.tools) || result.tools.some(tool => typeof tool.name !== 'string' || !tool.inputSchema)) throw failure('catálogo de ferramentas inválido.');
    tools.push(...result.tools);
    if (!result.nextCursor) return tools;
    if (typeof result.nextCursor !== 'string' || cursors.has(result.nextCursor)) throw failure('paginação inválida no catálogo.');
    cursor = result.nextCursor; cursors.add(cursor);
  }
  throw failure('catálogo excedeu o limite de páginas.');
}

export async function mcpCall(provider, key, name, args = {}) {
  if (typeof name !== 'string' || !name.trim() || name.length > 200) throw failure('nome da ferramenta inválido.');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw failure('argumentos da ferramenta devem ser um objeto.');
  const request = await connect(provider, key);
  const result = await request('tools/call', { name, arguments: args });
  if (!result || typeof result !== 'object') throw failure('resultado da ferramenta inválido.');
  // Tool errors may echo request headers or provider credentials. Keep only a generic error.
  if (result.isError) return { isError: true, content: [{ type: 'text', text: 'O provedor não conseguiu executar a ferramenta. Verifique os parâmetros e a disponibilidade no painel do provedor.' }] };
  return result;
}
