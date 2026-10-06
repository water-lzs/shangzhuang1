import {createProcessing} from './processing-ui.js';
import {createSales} from './sales-ui.js';
import {createStory} from './story-ui.js';
import {createVariety} from './variety-ui.js';
import {createSocial} from './social-ui.js';
import {createEnding} from './ending-ui.js';
import {SAVE_KEY,TERMS,WATER,PEST,createFarm,reduceFarm,readSave,planted,tds,pestLabel,estimate} from './farm-engine.js';
import {ECON} from './economy.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 「隐性感知」文案表：所有数值都在 engine 里，这里只把状态翻成看得懂的话。
const waterWord=v=>v>=70?'水色清亮，能照见云影':v>=40?'水色寻常，说不上好坏':v>=20?'水面泛浑，风过有股闷味':'水浑得发褐，田里透着死气';
const soilWord=v=>v>=80?'田土过湿，脚陷得深':v>=60?'田土润得正好，踩下去陷一指':v>=40?'田面见干，该引水了':'田土发白，裂出了细纹';
const ecoWord=v=>v>=70?'田埂上蛙鸣虫飞，鸟雀也不怕人':v>=40?'草木寻常，一切如故':v>=20?'田边静了些，少见虫鸟':'田里死寂，连风过都显得空';
const leafWord=v=>v<=20?'稻叶干净，虫影都少见':v<=50?'叶背有零星虫斑，还不碍事':'叶子被啃得斑斑驳驳';
const growthWord=q=>q==='特优'?'稻穗沉得压弯了腰，粒粒饱实':q==='优'?'稻穗长得壮实':q==='良'?'稻穗长得齐整':'谷粒看着有些发瘪';
const QUAL_CLASS={'特优':'q-gold',优:'q-silver',良:'q-bronze',中:'q-bronze',劣:'q-gray'};
const qualityChip=(q,extra='')=>`<i class="q-chip ${QUAL_CLASS[q]||'q-gray'}" title="品质：${q}${extra}"></i>`;
const WATER_NARR={yuquan:'引一渠山泉入田，费工费时，水色最清',river:'就着河渠引水，省力，也说不上讲究',tap:'接井上的铁管水，图快，田里不太受用'};
const PEST_NARR={pesticide:'重药下去，虫是没了，田也伤了',crab:'把稻田蟹放进田里，虫少，田也活',manual:'卷起裤腿下田捉虫，费力气，稳当'};
// 包 P：每个选项都有代价，把「代价」直接写在按钮上，玩家才知道自己在拿什么换什么。
const costText=c=>[c.wen?`${c.wen} 文`:'',c.stamina?`${c.stamina} 点体力`:''].filter(Boolean).join(' · ')||'不花钱';
function statusCards(s){
 if(s.ui?.showNumbers)return [['土壤湿度',s.moisture+'%','适宜 60–80%'],['水质 TDS',tds(s)+' mg/L','水质 '+s.water+' / 100'],['生态值',s.ecology+' / 100','产量系数 ×'+(.8+.004*s.ecology).toFixed(2)],['病虫害',pestLabel(s.pests),s.pests+' / 100']];
 return [['田水',waterWord(s.water),'近前细看'],['田土',soilWord(s.moisture),'脚下的感觉'],['生气',ecoWord(s.ecology),'田埂上的动静'],['稻叶',leafWord(s.pests),'低头翻叶背']];
}
export function mountFarm({onChange}){
 const demo=new URLSearchParams(location.search).get('demo')==='1';let storageWarning='';let raw=null;
 const key=demo?SAVE_KEY+'-demo':SAVE_KEY;
 try{raw=(demo?sessionStorage:localStorage).getItem(key);}catch{storageWarning='浏览器存档不可用，本局仅保存在内存中。';}
 let state=readSave(raw)||createFarm();if(raw&&!readSave(raw))storageWarning='旧存档无法读取，已开启新一局。';
 let message='',resetPending=false,granaryOpen=false,detectTimer=0;let view=new URLSearchParams(location.search).get('view');let activity=['processing','sales','variety','social','ending'].includes(view)?view:'farm';if(state.space==='home'&&['processing','sales','social'].includes(activity))activity='farm';if(state.space==='town'&&activity==='farm')activity='sales';let processing,sales,story,variety,social,ending;
 function persist(){try{(demo?sessionStorage:localStorage).setItem(key,JSON.stringify(state));}catch{storageWarning='存档写入失败，请保持页面开启。';}}
 function dispatch(action,{quiet=false}={}){const oldSeason=state.season;const result=reduceFarm(state,action);message=result.error||'';if(!result.error){state=result.state;persist();if(!quiet)onChange({...state,activity});}document.querySelector('#farm-root').dataset.state=JSON.stringify(state);if(!quiet){render();if(state.pending&&activity==='farm')requestAnimationFrame(()=>document.querySelector('.farm-event')?.scrollIntoView({behavior:'smooth',block:'center'}));else if(state.season!==oldSeason)window.scrollTo({top:0,behavior:'smooth'});}return !result.error;}
 function setActivity(next){if(next==='farm'&&state.space!=='home')dispatch({type:'space:switch',space:'home'});if(['processing','sales','social'].includes(next)&&state.space!=='town')dispatch({type:'space:switch',space:'town'});if(activity==='processing'&&next!=='processing')processing.pause();activity=next;const u=new URL(location.href);u.searchParams.set('view',next);history.replaceState({},'',u);onChange({...state,activity});render();window.scrollTo({top:0,behavior:'smooth'});}

 function eventHTML(){
  const can=c=>(state.sales?.wen||0)>=(c.wen||0)&&state.stamina>=(c.stamina||0);
  const label=c=>`<small class="event-cost">${c.desc||''}<br>代价：${costText(c)}${can(c)?'':' · 眼下办不到'}</small>`;
  if(state.pending?.type==='water')return `<section class="farm-event" aria-label="水源选择"><div class="farm-kicker">生态抉择 · 引水入田</div><h2>今年用哪一汪水？</h2><p>田里等着水。选哪一汪，往后几年的田土都记着。</p><div class="event-choices">${Object.entries(WATER).map(([k,c])=>`<button data-action="water" data-choice="${k}" ${can(c)?'':'disabled'}><b>${c.name}</b><span>${WATER_NARR[k]}</span>${label(c)}</button>`).join('')}</div></section>`;
  if(state.pending?.type==='pest')return `<section class="farm-event" aria-label="虫害应对"><div class="farm-kicker">生态抉择 · 田间虫害</div><h2>稻叶遭虫，如何应对？</h2><p>虫一天天啃下去，稻叶会先薄下去。</p><div class="event-choices">${Object.entries(PEST).map(([k,c])=>`<button data-action="pest" data-choice="${k}" ${can(c)?'':'disabled'}><b>${c.name}</b><span>${PEST_NARR[k]}</span>${label(c)}</button>`).join('')}</div></section>`;
  return '';
 }
 function actions(){
  if(state.season==='spring'){
   const room=Math.min(state.seeds,10-planted(state));
   const byStamina=Math.floor(state.stamina/ECON.staminaPlant);
   const canPlant=room>0&&byStamina>0;
   return `<div class="plant-control"><label for="plant-count">本次插秧亩数</label><input id="plant-count" type="number" min="1" max="${Math.max(1,Math.min(room,byStamina))}" step="1" value="1" ${canPlant?'':'disabled'}><button data-action="plant-count" ${canPlant?'':'disabled'}>确认插秧</button><button data-action="plant-all" ${canPlant?'':'disabled'}>种满空地</button></div><p class="farm-hint">插秧 1 亩耗 ${ECON.staminaPlant} 点体力，现有体力最多插 ${byStamina} 亩。</p><button class="farm-primary" data-action="advance" ${!planted(state)?'disabled':''}>进入小暑 · 生长 →</button>`;
  }
  if(state.season==='summer')return `<div class="growth-track" aria-label="生长进度 ${state.growth}/3"><span style="width:${state.growth/3*100}%"></span></div><p>已巡田 ${state.growth} / 3 回 · ${state.pending?'田里还有事没了结':'一趟趟走下来，田土会慢慢发干，人也乏'}</p><button class="farm-primary" data-action="${state.growth<3?'inspect':'advance'}" ${state.pending||(state.growth<3&&state.stamina<ECON.staminaInspect)?'disabled':''}>${state.growth<3?`下田巡一趟 · 费 ${ECON.staminaInspect} 点体力`:'进入秋分 · 收割 →'}</button>`;
  if(state.season==='autumn')return `<button class="farm-primary" data-action="${state.harvested?'advance':'harvest'}" ${!state.harvested&&state.stamina<ECON.staminaHarvest?'disabled':''}>${state.harvested?'进入冬至 · 休耕 →':`收割并结算 · 费 ${ECON.staminaHarvest} 点体力`}</button>`;
  return `<p>休耕后生态 +10，体力恢复至 100。留种只留六成，仓库存量与银钱保留——明年要种满十亩，得先去集市补种。</p><button class="farm-primary" data-action="advance">完成休耕 · 迎接第 ${state.year+1} 年 →</button>`;
 }
 function granaryHTML(){
  const now=state.result;
  return `<div class="farm-card-head"><h2>粮仓</h2><span>存粮 ${state.rice.toLocaleString()} kg</span></div>
  <div class="granary-now">${now?`<span>本季入库</span><strong>${now.yieldKg.toLocaleString()} <small>kg</small></strong>${qualityChip(now.quality,state.ui?.showNumbers?` · 综合分 ${now.score}`:'')}<small class="muted">鼠标停在色块上看品质</small>`:'<span class="muted">本季还没有新谷入仓。</span>'}</div>
  <ol class="granary-history">${state.history.map(h=>`<li><span>第 ${h.year} 年</span>${qualityChip(h.quality)}<b>${h.yieldKg.toLocaleString()} kg</b></li>`).join('')||'<li class="muted">还没有往年的记录。</li>'}</ol>
  <button class="farm-primary" data-action="granary">收起粮仓</button>`;
 }
 // 包 O：季末结算单。收入与开销逐项列清，让玩家看得见钱是怎么没的。
function settleHTML(){
 const t=state.settle;if(!t)return '';
 const rows=[['本季毛收入',t.income],['地租（'+t.acres+' 亩）',-t.rent],['工具维护',-t.upkeep],['老宅修缮',-t.house]];
 if(t.bribe>0)rows.push(['衙门例钱',-t.bribe]);
 return `<div class="farm-card-head"><h2>季末结算</h2><span>${TERMS[t.ended]?TERMS[t.ended][0]:t.ended}季末</span></div>
 <ul class="settle-list">${rows.map(([k,v])=>`<li><span>${k}</span><b class="${v>=0?'in':'out'}">${v>=0?'+':''}${v.toLocaleString()} 文</b></li>`).join('')}</ul>
 <div class="settle-net"><span>本季净收益</span><strong class="${t.net>=0?'in':'out'}">${t.net>=0?'+':''}${t.net.toLocaleString()} 文</strong></div>
 ${t.short>0?`<p class="muted">钱不够，还欠着 ${t.short} 文没结清。</p>`:''}
 <p class="muted">存粮 ${state.rice.toLocaleString()} kg · 银钱 ${(state.sales?.wen||0).toLocaleString()} 文</p>`;
}
function showDetect(){
  const s=state;let el=document.querySelector('#detect-panel');
  if(!el){el=document.createElement('div');el.id='detect-panel';el.className='detect-panel';document.body.append(el);}
  el.innerHTML=`<b>田情检测</b><div><span>水质 TDS</span><strong>${tds(s)} mg/L</strong></div><div><span>生态值</span><strong>${s.ecology} / 100</strong></div><div><span>病虫害</span><strong>${pestLabel(s.pests)}（${s.pests}）</strong></div><div><span>土壤湿度</span><strong>${s.moisture}%</strong></div><small>这一瓢水看明白了 · 3 秒后收起</small>`;
  el.classList.add('show');clearTimeout(detectTimer);detectTimer=setTimeout(()=>el.classList.remove('show'),3000);
 }
 function render(){
  const term=TERMS[state.season],n=planted(state),q=state.result||estimate(state),showNum=!!state.ui?.showNumbers;
  document.querySelector('#farm-root').innerHTML=`<div class="farm-heading"><span>京西御田 · 一产种植</span><h1>第 ${state.year} 年 · ${term[0]}季 ${term[1]}</h1><p>${term[2]}期 · ${demo?'试玩局，不影响正式存档':'自动保存本机进度'}</p><button class="space-switch" data-space="town">去上庄镇 →</button>${(()=>{const done=state.detect&&state.detect.year===state.year&&state.detect.season===state.season;const dis=done||state.stamina<ECON.staminaDetect;return `<button class="detect-btn" data-action="detect" ${dis?'disabled':''} title="${done?'本季已检测过，等下一季':''}">${done?'本季已检测田情':`检测田情 · 费 ${ECON.staminaDetect} 点体力`}</button>`;})()}</div>
  <section class="farm-stats${showNum?' debug':' fuzzy'}" aria-label="田间观察">${statusCards(state).map(([a,b,c])=>`<div><span>${a}</span><strong>${b}</strong><small>${c}</small></div>`).join('')}</section>
  <div class="farm-columns"><section class="farm-card plot-card"><div class="farm-card-head"><h2>十亩御田</h2><span>${n} / 10 亩已插秧</span><button class="granary-btn" data-action="granary">${granaryOpen?'收起粮仓':'开仓看看'}</button></div><div class="farm-resources"><span>种子 <b>${state.seeds}</b> 份</span><span>体力 <b>${state.stamina}</b></span><span>稻田蟹 <b>${state.crabs}</b> 只</span><span>稻米 <b>${state.rice.toLocaleString()}</b> kg</span><span>银钱 <b>${(state.sales?.wen||0).toLocaleString()}</b> 文</span></div><div class="farm-tools"><button class="tool-btn" data-action="buy-seeds" ${(state.sales?.wen||0)<ECON.seedPrice*5?'disabled':''}>买 5 份种子 · ${ECON.seedPrice*5} 文</button><button class="tool-btn" data-action="hire" ${state.stamina>=100||((state.sales?.wen||0)<ECON.hireCost&&(state.barter||0)>=ECON.barterPerSeason)?'disabled':''}>${(state.sales?.wen||0)>=ECON.hireCost?`雇短工 · ${ECON.hireCost} 文（体力 +${ECON.hireStamina}）`:((state.barter||0)<ECON.barterPerSeason?`邻里换工 · 不花钱（体力 +${ECON.hireStamina}，本季限 ${ECON.barterPerSeason} 次）`:'雇短工 · 钱不够')}</button></div><div class="farm-plots">${state.plots.map((p,i)=>`<button data-action="plant-one" data-plot="${i}" ${state.season!=='spring'||p||!state.seeds||state.stamina<ECON.staminaPlant?'disabled':''} aria-label="第 ${i+1} 亩，${p?'已插秧':'空地'}"><small>${String(i+1).padStart(2,'0')} / 初级</small><span>${state.season==='winter'?'冬藏':state.harvested?'已收割':p?term[2]:'空地'}</span><i>${p?'稻':'田'}</i></button>`).join('')}</div><p class="farm-hint">1 份种子 = 1 亩地，插 1 亩耗 ${ECON.staminaPlant} 点体力。春季可点击空地逐亩插秧，田中稻苗同步出现。</p>${actions()}</section>
  <aside class="farm-card journal-card">${eventHTML()||(granaryOpen?granaryHTML():`<div class="farm-card-head"><h2>田间手记</h2><span>${term[1]}</span></div><div class="yield-preview">${state.harvested?`<span>本季稻谷已入仓</span><p class="muted">仓里有今年的谷子，开仓才看得清成色与斤数。</p>`:`<span>眼下的田</span><p class="muted">稻子还得慢慢养，收成如何，等秋收开仓才知分晓。</p>`}${showNum?`<small class="debug-note">估算 ${q.yieldKg.toLocaleString()} kg · 品质 ${q.quality} · 综合分 ${q.score} · 生态系数 ×${q.ecoMultiplier.toFixed(2)}</small>`:''}</div>`)}${settleHTML()}<ol class="farm-log">${state.log.slice(0,3).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="farm-message" role="status">${esc(message||storageWarning)}</div><details class="farm-rules" ${showNum?'hidden':''}><summary>老农的经验</summary><p>水要清，田要润，虫要早除。这三样缺一样，谷粒就瘪几分。</p><p>天时占一半，人算一半——剩下的，秋收那天开仓就知道了。</p></details><details class="farm-rules" ${showNum?'':'hidden'}><summary>查看品质与产量规则（调试）</summary><p>基础亩产按品种（kg）：御稻米 50 / 紫金箍 46 / 大粒紫金箍 53 / 大明芒 49 / 大红芒 48 / 小红芒 88 / 银坊 95 / 水源三百粒 130 / 越富系三 150 / 京越一号 160 / 津稻三零五 200 / 上香一号 200 / 京西稻三号 205。品质系数：特优 1.35 / 优 1.2 / 良 1.0 / 劣 0.65。产量向下取整：亩数 × 品种亩产 × 品质系数 × (0.8 + 0.004 × 生态)。</p><p>适湿分 = 100 − 距离 60–80% 区间的差值 × 2（最低 0）。品质分 = 40% 水质 + 25% 适湿分 + 20% (100 − 病虫害值) + 15% 生态值。特优需分数≥90、水质≥80、虫害≤10、生态≥70；优需分数≥78、水质≥60、虫害≤25、生态≥50；良需分数≥58；其余为劣。</p><p>售价（文/斤，良级基准）：市场 3 / 粮店 2 / 酒楼 5；品质倍率 特优 ×3.33、优 ×2、良 ×1、劣 ×0.33。1 石 = 50 kg = 100 斤。手续费按笔计：市场 5 / 粮店 3 / 酒楼 5 文。稻田蟹可售：市场 6 / 粮店 5 / 酒楼 12 文/只。</p><p>季末结算：地租 ${ECON.rentPerAcre} 文/亩、工具维护 ${ECON.toolUpkeep} 文/件、老宅修缮 ${ECON.houseUpkeep} 文；有收入的季末 30% 概率被衙门索去 20%。秋收有 30% 概率遇天灾减产 30–50%。存粮超过 3 季按半价出售。加工损耗从 30% 随已学配方递减至 10%。天工开物科技费用已按 3 倍计。</p><p>体力：插秧 ${ECON.staminaPlant}/亩、巡田 ${ECON.staminaInspect}/次、收割 ${ECON.staminaHarvest}/次、检测 ${ECON.staminaDetect}/次（每季限一次）；玉泉 8、河水 4、井水 2；投蟹 10、农药 4、人工捉虫 30。每次季节推进体力保底回到 ${ECON.staminaFloor}，冬至休耕直接回满 100；雇短工 ${ECON.hireCost} 文换 ${ECON.hireStamina} 点体力，钱不够时每季可邻里换工 ${ECON.barterPerSeason} 次（不花钱，同样回 ${ECON.hireStamina} 点）——这是防止「体力耗尽 + 无钱 + 事件挂着」卡死的兜底。种子：收获只留已种亩数的六成，其余到集市买（${ECON.seedPrice} 文/份，上限 ${ECON.seedCap} 份）。</p><p>TDS = 500 − 4 × 水质评分，仅为游戏模拟映射，并非真实水质评价。夏季 3 次巡田，水源事件在第 1/2 次随机出现，虫害在其后第 2/3 次随机出现；虫害初值随机 40–70。河水有三成概率把虫卵带进田（虫害 +20）。投蟹的蟹在秋收时捕出，每已种亩 1 只。</p><p>《京西稻耕织图》碎片只能靠玩法掉落：秋收（品质良以上）、作坊加工、市场大笔交易、社交认养、穿越任务各掉一组，不能自己点开。收录老品种要送档案房 20 文 + 30 kg 稻米。</p></details><div class="farm-reset">${resetPending?'<span>将清空本机这一局。</span><button data-action="reset-confirm">确认重新开局</button><button data-action="reset-cancel">取消</button>':'<button data-action="reset-request">重新开局</button>'}</div></aside></div>`;
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
   if(a==='granary'){granaryOpen=!granaryOpen;render();return;}
   if(a==='detect'){if(dispatch({type:'detect'}))showDetect();return;}
   if(a==='reset-confirm'){state=createFarm();resetPending=false;persist();onChange({...state,activity});render();return;}
   if(a==='plant-count')return dispatch({type:'plant',count:Number(document.querySelector('#plant-count').value)});
   if(a==='buy-seeds')return dispatch({type:'seed:buy',count:5});
   if(a==='plant-one')return dispatch({type:'plant',count:1,plot:Number(b.dataset.plot)});
   if(a==='plant-all'){const room=Math.min(state.seeds,10-planted(state));return dispatch({type:'plant',count:Math.max(1,Math.min(room,Math.floor(state.stamina/ECON.staminaPlant)))});}
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
 persist();render();onChange({...state,activity});return {getState:()=>structuredClone(state),setActivity,setSaleChannel:id=>sales.setChannel(id),switchSpace:space=>{dispatch({type:'space:switch',space});setActivity(space==='town'?'sales':'farm');}};
}

