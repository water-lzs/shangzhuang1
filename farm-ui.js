import {createProcessing} from './processing-ui.js';
import {createSales} from './sales-ui.js';
import {createStory} from './story-ui.js';
import {createVariety} from './variety-ui.js';
import {createSocial} from './social-ui.js';
import {createEnding} from './ending-ui.js';
import {SAVE_KEY,TERMS,WATER,createFarm,reduceFarm,readSave,planted,tds,pestLabel,estimate} from './farm-engine.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountFarm({onChange}){
 const demo=new URLSearchParams(location.search).get('demo')==='1';let storageWarning='';let raw=null;
 const key=demo?SAVE_KEY+'-demo':SAVE_KEY;
 try{raw=(demo?sessionStorage:localStorage).getItem(key);}catch{storageWarning='浏览器存档不可用，本局仅保存在内存中。';}
 let state=readSave(raw)||createFarm();if(raw&&!readSave(raw))storageWarning='旧存档无法读取，已开启新一局。';
 let message='',resetPending=false;let view=new URLSearchParams(location.search).get('view');let activity=['processing','sales','variety','social','ending'].includes(view)?view:'farm';if(state.space==='home'&&['processing','sales','social'].includes(activity))activity='farm';if(state.space==='town'&&activity==='farm')activity='sales';let processing,sales,story,variety,social,ending;
 function persist(){try{(demo?sessionStorage:localStorage).setItem(key,JSON.stringify(state));}catch{storageWarning='存档写入失败，请保持页面开启。';}}
 function dispatch(action,{quiet=false}={}){const oldSeason=state.season;const result=reduceFarm(state,action);message=result.error||'';if(!result.error){state=result.state;persist();if(!quiet)onChange({...state,activity});}document.querySelector('#farm-root').dataset.state=JSON.stringify(state);if(!quiet){render();if(state.pending&&activity==='farm')requestAnimationFrame(()=>document.querySelector('.farm-event')?.scrollIntoView({behavior:'smooth',block:'center'}));else if(state.season!==oldSeason)window.scrollTo({top:0,behavior:'smooth'});}return !result.error;}
 function setActivity(next){if(next==='farm'&&state.space!=='home')dispatch({type:'space:switch',space:'home'});if(['processing','sales','social'].includes(next)&&state.space!=='town')dispatch({type:'space:switch',space:'town'});if(activity==='processing'&&next!=='processing')processing.pause();activity=next;const u=new URL(location.href);u.searchParams.set('view',next);history.replaceState({},'',u);onChange({...state,activity});render();window.scrollTo({top:0,behavior:'smooth'});}

 function eventHTML(){
  if(state.pending?.type==='water')return `<section class="farm-event" aria-label="水源选择"><div class="farm-kicker">生态抉择 · 引水入田</div><h2>今年用哪一汪水？</h2><p>三种水源均令湿度 +20；水质评分独立于模拟 TDS。</p><div class="event-choices">${Object.entries(WATER).map(([k,c])=>`<button data-action="water" data-choice="${k}"><b>${c.name}</b><span>水质 ${c.quality>0?'+':''}${c.quality} · 生态 ${c.ecology>0?'+':''}${c.ecology}</span></button>`).join('')}</div></section>`;
  if(state.pending?.type==='pest')return `<section class="farm-event" aria-label="虫害应对"><div class="farm-kicker">生态抉择 · 田间虫害</div><h2>稻叶遭虫，如何应对？</h2><p>当前病虫害值 ${state.pests} / 100；选择后立即生效。</p><div class="event-choices"><button data-action="pest" data-choice="pesticide"><b>喷洒农药</b><span>虫害清零 · 生态 −30</span></button><button data-action="pest" data-choice="crab"><b>投放稻田蟹</b><span>虫害 −80% · 生态 +20<br>获得 ${planted(state)} 份稻田蟹</span></button><button data-action="pest" data-choice="manual" ${state.stamina<30?'disabled':''}><b>人工捉虫</b><span>体力 −30 · 生态 +10<br>病虫害值 −50</span></button></div></section>`;
  return '';
 }
 function actions(){
  if(state.season==='spring')return `<div class="plant-control"><label for="plant-count">本次插秧亩数</label><input id="plant-count" type="number" min="1" max="${Math.min(state.seeds,10-planted(state))||1}" step="1" value="1" ${state.seeds===0?'disabled':''}><button data-action="plant-count" ${state.seeds===0?'disabled':''}>确认插秧</button><button data-action="plant-all" ${state.seeds===0?'disabled':''}>种满空地</button></div><button class="farm-primary" data-action="advance" ${!planted(state)?'disabled':''}>进入小暑 · 生长 →</button>`;
  if(state.season==='summer')return `<div class="growth-track" aria-label="生长进度 ${state.growth}/3"><span style="width:${state.growth/3*100}%"></span></div><p>巡田 ${state.growth} / 3 · ${state.pending?'请先完成生态抉择':'每次巡田湿度 −8'}</p><button class="farm-primary" data-action="${state.growth<3?'inspect':'advance'}" ${state.pending?'disabled':''}>${state.growth<3?'巡田一次':'进入秋分 · 收割 →'}</button>`;
  if(state.season==='autumn')return `<button class="farm-primary" data-action="${state.harvested?'advance':'harvest'}">${state.harvested?'进入冬至 · 休耕 →':'收割并结算'}</button>`;
  return `<p>休耕后生态 +10，体力恢复至 100。留种和仓库存量保留。</p><button class="farm-primary" data-action="advance">完成休耕 · 迎接第 ${state.year+1} 年 →</button>`;
 }
 function render(){
  const term=TERMS[state.season],n=planted(state),q=state.result||estimate(state);
  document.querySelector('#farm-root').innerHTML=`<div class="farm-heading"><span>京西御田 · 一产种植</span><h1>第 ${state.year} 年 · ${term[0]}季 ${term[1]}</h1><p>${term[2]}期 · ${demo?'试玩局，不影响正式存档':'自动保存本机进度'}</p><button class="space-switch" data-space="town">去上庄镇 →</button></div>
  <section class="farm-stats" aria-label="实时田间数据">${[['土壤湿度',state.moisture+'%','适宜 60–80%'],['水质 TDS',tds(state)+' mg/L','模拟值 · 水质 '+state.water+'./100'],['生态值',state.ecology+'./100','产量系数 ×'+(.8+.004*state.ecology).toFixed(2)],['病虫害',pestLabel(state.pests),state.pests+'./100']].map(([a,b,c])=>`<div><span>${a}</span><strong>${b}</strong><small>${c}</small></div>`).join('')}</section>
  <div class="farm-columns"><section class="farm-card plot-card"><div class="farm-card-head"><h2>十亩御田</h2><span>${n} / 10 亩已插秧</span></div><div class="farm-resources"><span>种子 <b>${state.seeds}</b> 份</span><span>体力 <b>${state.stamina}</b></span><span>稻田蟹 <b>${state.crabs}</b> 份</span><span>稻米 <b>${state.rice.toLocaleString()}</b> kg</span><span>银钱 <b>${(state.sales?.wen||0).toLocaleString()}</b> 文</span></div><div class="farm-plots">${state.plots.map((p,i)=>`<button data-action="plant-one" data-plot="${i}" ${state.season!=='spring'||p||!state.seeds?'disabled':''} aria-label="第 ${i+1} 亩，${p?'已插秧':'空地'}"><small>${String(i+1).padStart(2,'0')} / 初级</small><span>${state.season==='winter'?'冬藏':state.harvested?'已收割':p?term[2]:'空地'}</span><i>${p?'稻':'田'}</i></button>`).join('')}</div><p class="farm-hint">1 份种子 = 1 亩地。春季可点击空地逐亩插秧，田中稻苗同步出现。</p>${actions()}</section>
  <aside class="farm-card journal-card">${eventHTML()||`<div class="farm-card-head"><h2>${state.harvested?'本年收获':'田间手记'}</h2><span>${term[1]}</span></div><div class="yield-preview"><span>${state.harvested?'已入库':'按当前状态估算'}</span><strong>${q.yieldKg.toLocaleString()} <small>kg</small></strong><p>品质 <b>${q.quality}</b> · 综合分 ${q.score} · 生态系数 ×${q.ecoMultiplier.toFixed(2)}</p>${state.harvested?`<p>本次留种 ${q.reservedSeeds} 份，已加入种子库存。</p>`:''}</div>`}<ol class="farm-log">${state.log.slice(0,3).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="farm-message" role="status">${esc(message||storageWarning)}</div><details class="farm-rules"><summary>查看品质与产量规则</summary><p>基础亩产 500 kg；品质系数：优 1.2 / 良 1.0 / 劣 0.65。最终产量向下取整：亩数 × 500 × 品质系数 × (0.8 + 0.004 × 生态)。</p><p>适湿分 = 100 − 距离 60–80% 区间的差值 × 2（最低 0）。品质分 = 45% 水质 + 30% 适湿分 + 25% (100 − 病虫害值)。优需分数≥80、水质≥70、虫害≤20；良需分数≥60、水质≥40、虫害≤50；其余为劣。</p><p>TDS = 500 − 4 × 水质评分，仅为游戏模拟映射，并非真实水质评价。夏季 3 次巡田，水源事件在第 1/2 次随机出现，虫害在其后第 2/3 次随机出现；虫害初值随机 40–70。人工捉虫额外降低 50 点虫害。投蟹额外奖励每已种亩 1 份蟹。收获返还每已种亩 1 份留种。</p></details><div class="farm-reset">${resetPending?'<span>将清空本机这一局。</span><button data-action="reset-confirm">确认重新开局</button><button data-action="reset-cancel">取消</button>':'<button data-action="reset-request">重新开局</button>'}</div></aside></div>`;
  document.querySelectorAll('nav [data-season]').forEach(b=>{b.disabled=true;b.classList.toggle('active',b.dataset.season===state.season);b.setAttribute('aria-current',b.dataset.season===state.season?'step':'false');b.querySelector('span').textContent=TERMS[b.dataset.season][2];});
  document.querySelector('#farm-root').hidden=activity!=='farm';document.querySelector('#processing-root').hidden=activity!=='processing';document.querySelector('#sales-root').hidden=activity!=='sales';document.querySelector('#variety-root').hidden=activity!=='variety';document.querySelector('#social-root').hidden=activity!=='social';document.querySelector('#ending-root').hidden=activity!=='ending';
  document.querySelectorAll('[data-activity]').forEach(b=>{b.classList.toggle('active',b.dataset.activity===activity);b.setAttribute('aria-selected',b.dataset.activity===activity?'true':'false');});
  if(activity==='processing')processing?.render(message||storageWarning);
  if(activity==='sales')sales?.render(message||storageWarning);
  if(activity==='variety')variety?.render(message||storageWarning);
  if(activity==='social')social?.render(message||storageWarning);
  if(activity==='ending')ending?.render(message||storageWarning);
  story?.render(message||storageWarning);
  const host=document.querySelector('#farm-root');host.dataset.state=JSON.stringify(state);
  document.querySelectorAll('button[data-space]').forEach(b=>b.onclick=()=>{if(dispatch({type:'space:switch',space:b.dataset.space}))setActivity(b.dataset.space==='town'?'sales':'farm');});
  host.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
   const a=b.dataset.action;
   if(a==='reset-request'){resetPending=true;render();return;}if(a==='reset-cancel'){resetPending=false;render();return;}
   if(a==='reset-confirm'){state=createFarm();resetPending=false;persist();onChange({...state,activity});render();return;}
   if(a==='plant-count')return dispatch({type:'plant',count:Number(document.querySelector('#plant-count').value)});
   if(a==='plant-one')return dispatch({type:'plant',count:1,plot:Number(b.dataset.plot)});
   if(a==='plant-all')return dispatch({type:'plant',count:Math.min(state.seeds,10-planted(state))});
   dispatch({type:a,choice:b.dataset.choice});
  }));
 }
 processing=createProcessing({getState:()=>state,dispatch,goFarm:()=>setActivity('farm')});
 sales=createSales({getState:()=>state,dispatch});
 story=createStory({getState:()=>state,dispatch});
 variety=createVariety({getState:()=>state,dispatch});
 social=createSocial({getState:()=>state,dispatch});
 ending=createEnding({getState:()=>state,dispatch});
 document.querySelectorAll('[data-activity]').forEach(b=>b.addEventListener('click',()=>setActivity(b.dataset.activity)));
 persist();render();onChange({...state,activity});return {getState:()=>structuredClone(state),setActivity,switchSpace:space=>{dispatch({type:'space:switch',space});setActivity(space==='town'?'sales':'farm');}};
}

