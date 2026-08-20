(async()=>{
  const STORAGE_KEY="jukenWeaknessRecordsV1";
  const SUMMARY_KEY="jukenKnowledgeSummaryV1";
  const NOTICE_KEY="jukenImportNotice";
  const COOKIE_KEY="jukenKb1";

  function fromBase64Url(value){
    const base64=value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4);
    const raw=atob(base64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }

  async function inflateJson(value){
    if(typeof DecompressionStream==="undefined")throw new Error("This Safari version does not support private import.");
    const stream=new Blob([fromBase64Url(value)]).stream().pipeThrough(new DecompressionStream("deflate"));
    const text=await new Response(stream).text();
    return JSON.parse(text);
  }

  function expandPayload(data){
    if(!data||data.v!==1||!Array.isArray(data.r))throw new Error("Invalid knowledge pack");
    const summary={};
    for(const [subject,v] of Object.entries(data.s||{})){
      summary[subject]={strengths:v.t||[],priorityWeaknesses:v.p||[],observation:v.o||""};
    }
    const records=data.r.map(row=>({
      id:row[0],subject:row[1],unit:row[2],score:row[3],total:row[4],level:row[5],cause:row[6],sequence:row[7],
      historical:true,source:"past-link",date:null
    }));
    return {summary,records};
  }

  function getCookie(name){
    const prefix=name+"=";
    for(const part of document.cookie.split(";")){
      const value=part.trim();
      if(value.startsWith(prefix))return value.slice(prefix.length);
    }
    return "";
  }

  function setTransferCookie(value){
    document.cookie=`${COOKIE_KEY}=${value}; Path=/juken-weakness/; Max-Age=7200; SameSite=Strict; Secure`;
  }

  function clearTransferCookie(){
    document.cookie=`${COOKIE_KEY}=; Path=/juken-weakness/; Max-Age=0; SameSite=Strict; Secure`;
  }

  async function importPayload(encoded,source){
    const pack=expandPayload(await inflateJson(encoded));
    let current=[];
    try{current=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{}
    if(!Array.isArray(current))current=[];
    const ids=new Set(current.map(r=>r&&r.id).filter(Boolean));
    let added=0;
    for(const r of pack.records){
      if(r.id&&ids.has(r.id))continue;
      current.push(r);if(r.id)ids.add(r.id);added++;
    }
    localStorage.setItem(STORAGE_KEY,JSON.stringify(current));
    localStorage.setItem(SUMMARY_KEY,JSON.stringify(pack.summary));
    sessionStorage.setItem(NOTICE_KEY,JSON.stringify({ok:true,added,total:pack.records.length,source}));
    return {added,total:pack.records.length};
  }

  async function bootstrapKnowledge(){
    const match=location.hash.match(/^#kb1=([A-Za-z0-9_-]+)$/);
    if(match){
      try{
        setTransferCookie(match[1]);
        await importPayload(match[1],"link");
      }catch(error){
        sessionStorage.setItem(NOTICE_KEY,JSON.stringify({ok:false,message:"初期データを取り込めませんでした"}));
      }
      history.replaceState(null,"",location.pathname+location.search);
      return;
    }

    const carried=getCookie(COOKIE_KEY);
    if(carried){
      try{
        await importPayload(carried,"cookie");
        clearTransferCookie();
      }catch(error){
        sessionStorage.setItem(NOTICE_KEY,JSON.stringify({ok:false,message:"引き継ぎデータを取り込めませんでした"}));
      }
    }
  }

  await bootstrapKnowledge();

  const script=document.createElement("script");
  script.src="app.js?v=8";
  script.onload=()=>{
    const raw=sessionStorage.getItem(NOTICE_KEY);
    if(!raw)return;
    sessionStorage.removeItem(NOTICE_KEY);
    try{
      const n=JSON.parse(raw);
      setTimeout(()=>{
        if(typeof window.showToast==="function"){
          const msg=n.ok
            ?(n.added?`📦 過去データ${n.added}件を自動登録しました`:`📦 過去データ${n.total}件は登録済みです`)
            :(n.message||"初期データを取り込めませんでした");
          window.showToast(msg);
        }
      },500);
    }catch{}
  };
  document.body.appendChild(script);
})();