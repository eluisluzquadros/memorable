import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpTools, mcpCall } from '../server/mcp-client.mjs';
const rpc = (id,result,headers={}) => new Response(JSON.stringify({jsonrpc:'2.0',id,result}), {headers:{'content-type':'application/json',...headers}});
function handshake(body) {
  if (body.method === 'initialize') return rpc(body.id,{protocolVersion:'2025-03-26',capabilities:{tools:{}}},{'mcp-session-id':'session-123'});
  if (body.method === 'notifications/initialized') return new Response(null,{status:202});
}

test('Higgsfield initializes, negotiates session/version and paginates tools', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    const body=JSON.parse(options.body); calls.push({url,options,body});
    const init=handshake(body);if(init)return init;
    return rpc(body.id,{tools:[{name:body.params.cursor ? 'video' : 'image',inputSchema:{type:'object'}}],...(!body.params.cursor?{nextCursor:'next'}:{})});
  });
  assert.deepEqual((await mcpTools('higgsfield','secret')).map(t=>t.name),['image','video']);
  assert.equal(calls[0].url,'https://mcp.higgsfield.ai/mcp');
  assert.equal(calls[0].options.headers.Authorization,'Bearer secret');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[1].body.id,undefined);
  assert.equal(calls[2].options.headers['Mcp-Session-Id'],'session-123');
  assert.equal(calls[2].options.headers['MCP-Protocol-Version'],'2025-03-26');
});

test('Blotato calls tool using its API header and reads chunked SSE notifications', async t => {
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.equal(url,'https://mcp.blotato.com/mcp');
    assert.equal(options.headers['blotato-api-key'],'secret');
    assert.equal(options.headers.Authorization,undefined);
    const body=JSON.parse(options.body);const init=handshake(body);if(init)return init;
    assert.equal(body.method,'tools/call');assert.deepEqual(body.params,{name:'create',arguments:{prompt:'test'}});
    const raw = `event: message\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\r\n\r\ndata: ${JSON.stringify({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'job-123'}]}})}\r\n\r\n`;
    return new Response(new ReadableStream({start(controller){for(const char of raw)controller.enqueue(new TextEncoder().encode(char));controller.close();}}),{headers:{'content-type':'text/event-stream'}});
  });
  assert.equal((await mcpCall('blotato','secret','create',{prompt:'test'})).content[0].text,'job-123');
});

test('remote HTTP/RPC/tool errors never expose token or response body', async t => {
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response('secret-token',{status:401}));
  await assert.rejects(mcpTools('higgsfield','secret-token'),e=>/credencial recusada/.test(e.message)&&!e.message.includes('secret-token'));
  mock.mock.mockImplementation(async (_url,options)=>{const body=JSON.parse(options.body);const init=handshake(body);if(init)return init;return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,error:{message:'secret-token'}}));});
  await assert.rejects(mcpCall('higgsfield','secret-token','create'),e=>!e.message.includes('secret-token'));
  mock.mock.mockImplementation(async (_url,options)=>{const body=JSON.parse(options.body);return handshake(body)||rpc(body.id,{isError:true,content:[{type:'text',text:'secret-token'}]});});
  const result=await mcpCall('higgsfield','secret-token','create');
  assert.equal(result.isError,true);assert.ok(!JSON.stringify(result).includes('secret-token'));
});

test('invalid providers and arguments fail before network; wrong response IDs rejected', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return rpc(999,{protocolVersion:'2025-06-18'});});
  await assert.rejects(mcpTools('constructor','secret'),/não suportado/);
  await assert.rejects(mcpCall('higgsfield','secret','create',[]),/objeto/);
  assert.equal(calls,0);
  await assert.rejects(mcpTools('higgsfield','secret'),/identificador/);
});
