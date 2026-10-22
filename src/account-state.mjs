import { initialState, workspaces } from './workflow.mjs';
import { BRAND_TONES } from './brand-tones.mjs';
import { hydrateOperations } from './operations.mjs';

export function workspaceList(state,{includeArchived=false}={}) {
  const list=state?.workspaces?.length ? state.workspaces : workspaces;
  return includeArchived ? list : list.filter(w=>!w.archived);
}
export const brandInitials = name => name.split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
export function organizationType(state) {
  return state.organizationType || (workspaceList(state,{includeArchived:true}).length>1?'group':'single');
}
export function organizationSetup(input,fallback='Meu negócio') {
  if(input==null)return {type:'single',name:fallback,brands:[{name:fallback}]};
  if(!['single','group'].includes(input.type))throw new Error('Escolha uma marca ou um grupo de marcas.');
  const name=String(input.name||'').trim();
  if(name.length<2||name.length>80)throw new Error('Informe o nome da organização entre 2 e 80 caracteres.');
  if(!Array.isArray(input.brands)||input.brands.length<(input.type==='group'?2:1)||input.brands.length>20||(input.type==='single'&&input.brands.length!==1))throw new Error(input.type==='group'?'Cadastre de 2 a 20 marcas para começar o grupo.':'Cadastre uma marca para começar.');
  const brands=input.brands.map(b=>({name:String(b?.name||'').trim()}));
  if(brands.some(b=>b.name.length<2||b.name.length>80))throw new Error('Cada marca precisa de um nome entre 2 e 80 caracteres.');
  if(new Set(brands.map(b=>b.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).size!==brands.length)throw new Error('Use um nome diferente para cada marca.');
  return {type:input.type,name,brands};
}
const freshVoice=()=>({tone:'Claro, próximo e responsável',audience:'',positioning:'',pillars:'',say:'',avoid:'Promessas sem fundamento\nInformações não verificadas',examples:'',checklist:'Conferir fontes\nPreservar privacidade\nRevisar adequação à marca'});
const makeSpace=(id,name,index=0)=>({id,name,initials:brandInitials(name),color:BRAND_TONES[index%BRAND_TONES.length],voice:'Claro, próximo e responsável',audience:'',budget:300});
export function createAccountState(user,setup) {
  const org=organizationSetup(setup,String(user.name || 'Meu negócio').trim());
  const spaces=org.brands.map((b,i)=>makeSpace(`workspace-${user.id}${i?`-${i+1}`:''}`,b.name,i));
  return hydrateOperations({version:1,accountSchemaVersion:1,organizationName:org.name,organizationType:org.type,workspaces:spaces,workspace:spaces[0].id,role:'Administrador',pieces:[],sources:[],events:[],rules:[],budgets:Object.fromEntries(spaces.map(w=>[w.id,w.budget])),voices:Object.fromEntries(spaces.map(w=>[w.id,freshVoice()]))},spaces);
}
function assertOrganizationAdmin(state){if(state.role!=='Administrador')throw new Error('Use o papel Administrador para gerenciar a organização.');}
function validBrandName(state,name,excludeId){
  const value=String(name||'').trim();
  if(value.length<2||value.length>80)throw new Error('Informe um nome entre 2 e 80 caracteres.');
  if(workspaceList(state,{includeArchived:true}).some(w=>w.id!==excludeId&&w.name.localeCompare(value,'pt-BR',{sensitivity:'base'})===0))throw new Error('Já existe uma marca com esse nome, inclusive entre as arquivadas.');
  return value;
}
export function addBrand(state,name){
  assertOrganizationAdmin(state);const value=validBrandName(state,name);
  if(workspaceList(state,{includeArchived:true}).length>=50)throw new Error('Esta versão permite até 50 marcas por organização.');
  const space=makeSpace(`workspace-${crypto.randomUUID()}`,value,workspaceList(state,{includeArchived:true}).length),spaces=[...workspaceList(state,{includeArchived:true}),space];
  return hydrateOperations({...state,workspaces:spaces,organizationType:'group',budgets:{...state.budgets,[space.id]:space.budget},voices:{...state.voices,[space.id]:freshVoice()}},spaces);
}
export function renameBrand(state,id,name){
  assertOrganizationAdmin(state);if(!state.workspaces?.some(w=>w.id===id))throw new Error('Marca indisponível.');
  const value=validBrandName(state,name,id);
  return {...state,workspaces:state.workspaces.map(w=>w.id===id?{...w,name:value,initials:brandInitials(value)}:w)};
}
export function archiveBrand(state,id,archived=true){
  assertOrganizationAdmin(state);const target=state.workspaces?.find(w=>w.id===id);if(!target)throw new Error('Marca indisponível.');
  if(archived&&!target.archived&&workspaceList(state).length===1)throw new Error('Mantenha pelo menos uma marca ativa.');
  const spaces=state.workspaces.map(w=>w.id===id?{...w,archived}:w);
  return {...state,workspaces:spaces,workspace:archived&&state.workspace===id?spaces.find(w=>!w.archived).id:state.workspace,radar:archived?{...state.radar,[id]:{...state.radar[id],enabled:false,nextRun:null}}:state.radar};
}
export function renameOrganization(state,name){
  assertOrganizationAdmin(state);const value=String(name||'').trim();if(value.length<2||value.length>80)throw new Error('Informe um nome entre 2 e 80 caracteres.');
  return {...state,organizationName:value};
}
function stable(value) {
  if(Array.isArray(value)) return value.map(stable);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().filter(k=>!['date','deadline','createdAt','updatedAt','nextRun','at'].includes(k)).map(k=>[k,stable(value[k])]));
  return value;
}
export function isUntouchedDemo(state) {
  if(!state || state.accountSchemaVersion || state.workspaces?.length) return false;
  const base=initialState();
  const keys=[...new Set([...Object.keys(base),...Object.keys(state)])].filter(key=>!['version','schemaRevision','workspace','role','onboarding'].includes(key));
  return keys.every(key=>JSON.stringify(stable(state[key]))===JSON.stringify(stable(base[key])));
}
export function prepareAccountState(user, saved) {
  if(!saved) return createAccountState(user);
  if(isUntouchedDemo(saved)) return {...createAccountState(user),onboarding:saved.onboarding,accountMigration:{from:'demo-seed',backupAvailable:true}};
  const spaces=workspaceList(saved,{includeArchived:true});
  return hydrateOperations({...saved,accountSchemaVersion:1,organizationName:saved.organizationName || user.name,workspaces:spaces},spaces);
}
