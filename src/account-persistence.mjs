export function accountWriter(revision, report, userId, request) {
  let pending=null,running=null,timer=null,latest=null,stopped=false;
  async function flush() {
    clearTimeout(timer);
    if(stopped)return;
    if(running){await running;if(pending)return flush();return;}
    running=(async()=>{
      while(pending&&!stopped){
        const state=pending;pending=null;
        try {
          const result=await request('/api/account/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision,userId})});
          revision=result.revision;report('Salvo no SQLite');
        }catch(error){if(!pending)pending=state;report(error.message);throw error;}
      }
    })();
    try{await running;}finally{running=null;}
  }
  return {
    isPending:()=>Boolean(pending||running),snapshot:()=>latest,
    enqueue(state){if(stopped)return;latest=state;pending=state;report('Salvando…');clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),400);},
    flush,stop(){stopped=true;clearTimeout(timer);pending=null;},
  };
}
