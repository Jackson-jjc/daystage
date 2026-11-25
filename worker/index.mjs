// Build injects the sole canonical HTML. No poster content reaches this Worker.
const HTML = __DAYSTAGE_HTML__;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/creations'){
   if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
   if(!env.DB)return json({error:'Counter unavailable'},503);
   try{
    if(request.method==='POST'){
     if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Origin not allowed'},403);
     if(!request.headers.get('Content-Type')?.startsWith('application/json')||Number(request.headers.get('Content-Length')||0)>128)return json({error:'Invalid request'},400);
     const raw=await request.text();if(raw.length>128)return json({error:'Invalid request'},400);
     let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
     if(!body||body.event!=='poster_use'||Object.keys(body).length!==2||typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return json({error:'Invalid event'},400);
     // A schema-owned trigger increments the total only on a new anonymous event.
     // Replaying a request after a lost response cannot increment the count twice.
     await env.DB.prepare('INSERT INTO poster_uses (event_id,created_at) VALUES (?,?) ON CONFLICT(event_id) DO NOTHING').bind(body.id.toLowerCase(),new Date().toISOString()).run();
    }
    const row=await env.DB.prepare('SELECT total,started_at FROM visit_counter WHERE counter_key=?').bind('poster_uses').first();
    return json({uses:row?.total??0,since:row?.started_at??null,metric:'poster_use_sessions'});
   }catch{return json({error:'Counter unavailable'},503)}
  }
  if(url.pathname==='/api/visits'){
   if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
   if(!env.DB)return json({error:'Counter unavailable'},503);
   try{
    let row;
    if(request.method==='POST'){
     if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Origin not allowed'},403);
     if(!request.headers.get('Content-Type')?.startsWith('application/json')||Number(request.headers.get('Content-Length')||0)>128)return json({error:'Invalid request'},400);
     const raw=await request.text();if(raw.length>128)return json({error:'Invalid request'},400);
     let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
     if(!body||typeof body!=='object'||Array.isArray(body)||body.event!=='pageview'||Object.keys(body).length!==1)return json({error:'Invalid event'},400);
     row=await env.DB.prepare('INSERT INTO visit_counter (counter_key,total,started_at) VALUES (?,1,?) ON CONFLICT(counter_key) DO UPDATE SET total=total+1 RETURNING total,started_at').bind('pageviews',new Date().toISOString()).first();
    }else row=await env.DB.prepare('SELECT total,started_at FROM visit_counter WHERE counter_key=?').bind('pageviews').first();
    return json({visits:row?.total??0,since:row?.started_at??null,metric:'page_views'});
   }catch{return json({error:'Counter unavailable'},503)}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
  if(!['/','/index.html','/daystage_mvp.html'].includes(url.pathname))return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
};
