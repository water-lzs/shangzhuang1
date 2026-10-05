import {newWorkshop,normalizeWorkshop,reduceProcessing} from './processing-engine.js';
import {newSales,normalizeSales,reduceSales} from './sales-engine.js';
import {newStory,normalizeStory,reduceStory} from './story-engine.js';
import {newVarietyBook,normalizeVarietyBook,reduceVarieties} from './variety-engine.js';
import {newSocial,normalizeSocial,reduceSocial} from './social-engine.js';
import {reduceEnding} from './ending-engine.js';
// Pure, serializable farming rules. All numbers here are game balancing parameters.
export const SAVE_KEY='jingxi-farm-v1';
export const TERMS={spring:['春','谷雨','插秧'],summer:['夏','小暑','生长'],autumn:['秋','秋分','收割'],winter:['冬','冬至','休耕']};
export const WATER={yuquan:{name:'玉泉山水',quality:60,ecology:10},river:{name:'普通河水',quality:20,ecology:0},tap:{name:'自来水',quality:-10,ecology:-5}};
export const PEST={pesticide:{name:'喷洒农药'},crab:{name:'投放稻田蟹'},manual:{name:'人工捉虫'}};
const clamp=(x,min=0,max=100)=>Math.min(max,Math.max(min,x));
const round=x=>Math.round(x*10)/10;
export const planted=s=>s.plots.filter(Boolean).length;
export const tds=s=>Math.round(500-4*s.water);
export function pestLabel(p){return p===0?'无':p<=20?'轻度':p<=50?'中度':'重度';}
export function createFarm(seed=Date.now()>>>0){return {space:'home',ending:null,workshop:newWorkshop(),sales:newSales(),story:newStory(),varietyBook:newVarietyBook(),social:newSocial(),version:1,year:1,season:'spring',seeds:10,land:10,plots:Array(10).fill(false),previousPlots:Array(10).fill(false),moisture:70,water:40,ecology:50,pests:0,stamina:100,crabs:0,rice:0,growth:0,pending:null,plan:null,rng:seed>>>0,harvested:false,result:null,history:[],log:['林宇穿越回清代，绑定京西稻贡米系统。','林宇领到 10 份稻种与 10 亩初级地。']};}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function note(s,t){s.log.unshift(t);s.log=s.log.slice(0,8);}
export function estimate(s){
 const acres=planted(s),health=clamp(100-Math.max(0,60-s.moisture,s.moisture-80)*2);
 const score=round(.45*s.water+.30*health+.25*(100-s.pests));
 const quality=score>=80&&s.water>=70&&s.pests<=20?'优':score>=60&&s.water>=40&&s.pests<=50?'良':'劣';
 const multiplier={优:1.2,良:1,劣:.65}[quality],ecoMultiplier=.8+.004*s.ecology;
 return {year:s.year,acres,quality,score,health,base:500,qualityMultiplier:multiplier,ecoMultiplier:round(ecoMultiplier*100)/100,ecology:s.ecology,water:s.water,moisture:s.moisture,pests:s.pests,yieldKg:Math.floor(acres*500*multiplier*ecoMultiplier),reservedSeeds:acres};
}
export function reduceFarm(current,action){
 if(action.type==='space:switch'){const s=structuredClone(current);if(!['home','town'].includes(action.space))return {state:current,error:'空间无效。'};if(s.space===action.space)return {state:current,error:null};s.space=action.space;s.log.unshift(action.space==='town'?'沿碎石路前往上庄镇：市场、粮店和酒楼已开放。':'回到家：主子，钱袋鼓了，老宅也该翻修了。');return {state:s,error:null};}
 if(action.type.startsWith('process:'))return reduceProcessing(current,action);
 if(action.type.startsWith('sales:'))return reduceSales(current,action);
 if(action.type.startsWith('story:'))return reduceStory(current,action);
 if(action.type.startsWith('book:'))return reduceVarieties(current,action);
 if(action.type.startsWith('social:'))return reduceSocial(current,action);
 if(action.type.startsWith('ending:'))return reduceEnding(current,action);
 if(current.workshop?.active&&action.type==='advance')return {state:current,error:'请先完成当前批次加工，再推进季节。'};
 const s=structuredClone(current);let error='';const fail=t=>{error=t;};
 if(action.type==='plant'){
  if(s.season!=='spring')fail('只有春季谷雨可以插秧。');
  else if(!Number.isInteger(action.count)||action.count<1)fail('插秧亩数必须是正整数。');
  else if(action.count>s.seeds||action.count>10-planted(s))fail('种子或空地不足。');
  else if(action.plot!==undefined&&(!Number.isInteger(action.plot)||action.plot<0||action.plot>=10||s.plots[action.plot]||action.count!==1))fail('请选择一亩空地。');
  else {let remaining=action.count;if(action.plot!==undefined)s.plots[action.plot]=true;else for(let i=0;i<10&&remaining;i++)if(!s.plots[i]){s.plots[i]=true;remaining--;}
    s.seeds-=action.count;note(s,`插秧 ${action.count} 亩，消耗 ${action.count} 份种子。`);}
 }else if(action.type==='inspect'){
  if(s.season!=='summer'||s.growth>=3)fail('当前无需巡田。');
  else if(s.pending)fail('请先处理眼前的生态事件。');
  else{
   s.growth++;s.moisture=clamp(s.moisture-8);
   if(s.growth===s.plan.waterTurn){s.pending={type:'water',id:`${s.year}-water`};note(s,'水源选择：为御田引入生长用水。');}
   else if(s.growth===s.plan.pestTurn){s.pests=s.plan.pestSeverity;s.pending={type:'pest',id:`${s.year}-pest`};note(s,`虫害出现：病虫害值升至 ${s.pests}。`);}
   else note(s,`第 ${s.growth} 次巡田：稻苗抽长，湿度降低 8。`);
  }
 }else if(action.type==='water'){
  if(s.season!=='summer'||s.pending?.type!=='water'||!WATER[action.choice])fail('当前没有可处理的水源事件。');
  else{const c=WATER[action.choice];s.water=clamp(s.water+c.quality);s.ecology=clamp(s.ecology+c.ecology);s.moisture=clamp(s.moisture+20);s.pending=null;note(s,`采用${c.name}：水质 ${s.water}，生态 ${s.ecology}，湿度 ${s.moisture}%。`);}
 }else if(action.type==='pest'){
  if(s.season!=='summer'||s.pending?.type!=='pest'||!PEST[action.choice])fail('当前没有可处理的虫害事件。');
  else if(action.choice==='manual'&&s.stamina<30)fail('体力不足 30，无法人工捉虫。');
  else{
   if(action.choice==='pesticide'){s.pests=0;s.ecology=clamp(s.ecology-30);}
   if(action.choice==='crab'){s.pests=round(s.pests*.2);s.ecology=clamp(s.ecology+20);s.crabs+=planted(s);}
   if(action.choice==='manual'){s.pests=clamp(s.pests-50);s.stamina-=30;s.ecology=clamp(s.ecology+10);}
   s.pending=null;note(s,`${PEST[action.choice].name}：虫害 ${s.pests}，生态 ${s.ecology}${action.choice==='crab'?`，获得 ${planted(s)} 份稻田蟹`:''}。`);
  }
 }else if(action.type==='harvest'){
  if(s.season!=='autumn'||s.harvested)fail('当前无法重复收获。');
  else{s.result=estimate(s);s.rice+=s.result.yieldKg;s.seeds+=s.result.reservedSeeds;s.harvested=true;s.previousPlots=[...s.plots];s.history.unshift(s.result);s.history=s.history.slice(0,10);note(s,`秋收 ${s.result.yieldKg} kg（${s.result.quality}），留种 ${s.result.reservedSeeds} 份。`);}
 }else if(action.type==='advance'){
  if(s.pending)fail('生态事件尚未处理。');
  else if(s.season==='spring'){
   if(!planted(s))fail('至少插秧 1 亩才能进入生长季。');
   else{s.season='summer';const waterTurn=random(s)<.5?1:2;s.plan={waterTurn,pestTurn:waterTurn===2?3:(random(s)<.5?2:3),pestSeverity:40+Math.floor(random(s)*31)};note(s,'小暑到来。巡田三次，观察稻苗与生态变化。');}
  }else if(s.season==='summer'){
   if(s.growth<3)fail('请完成 3 次巡田和全部事件。');else{s.season='autumn';note(s,'秋分已至，金黄稻穗等待收割。');}
  }else if(s.season==='autumn'){
   if(!s.harvested)fail('请先收获并确认本年结算。');else{s.season='winter';note(s,'冬至休耕。土地休养，种子入库。');}
  }else if(s.season==='winter'){
   s.year++;s.season='spring';s.plots.fill(false);s.moisture=70;s.water=40;s.ecology=clamp(s.ecology+10);s.pests=0;s.stamina=100;s.growth=0;s.pending=null;s.plan=null;s.harvested=false;s.result=null;note(s,'休耕完成：生态 +10，体力恢复 100；新年春播开始。');
  }
 }else fail('未知农事操作。');
 return error?{state:current,error}:{state:s,error:null};
}
export function readSave(raw){
 try{const s=JSON.parse(raw);if(!s||s.version!==1||!TERMS[s.season]||s.land!==10) return null;
  s.space??='home';s.ending??=null;if(!['home','town'].includes(s.space)||!(s.ending===null||['merchant','hermit','traveler','corrupt'].includes(s.ending)))return null;
  for(const k of ['year','seeds','crabs','rice','growth','rng'])if(!Number.isSafeInteger(s[k])||s[k]<0)return null;
  if(s.year<1||s.growth>3||s.rng>4294967295||s.seeds>10)return null;
  for(const k of ['moisture','water','ecology','pests','stamina'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>100)return null;
  if(![s.plots,s.previousPlots].every(a=>Array.isArray(a)&&a.length===10&&a.every(x=>typeof x==='boolean')))return null;
  if(!Array.isArray(s.log)||!s.log.every(x=>typeof x==='string')||!Array.isArray(s.history)||typeof s.harvested!=='boolean')return null;
  if(s.pending!==null&&(!['water','pest'].includes(s.pending?.type)||typeof s.pending.id!=='string'))return null;
  if(s.season==='summer'&&(!s.plan||![1,2].includes(s.plan.waterTurn)||![2,3].includes(s.plan.pestTurn)||s.plan.pestTurn<=s.plan.waterTurn||!Number.isInteger(s.plan.pestSeverity)||s.plan.pestSeverity<40||s.plan.pestSeverity>70))return null;
  if(s.pending&&s.season!=='summer')return null;
  if((s.season==='autumn'||s.season==='winter')&&s.growth!==3)return null;
  if(s.season==='winter'&&!s.harvested)return null;
  if(s.harvested&&(!s.result||!['优','良','劣'].includes(s.result.quality)||!['yieldKg','score','ecoMultiplier','reservedSeeds'].every(k=>Number.isFinite(s.result[k])&&s.result[k]>=0)))return null;
  const workshop=normalizeWorkshop(s.workshop);if(!workshop)return null;const sales=normalizeSales(s.sales);if(!sales)return null;const story=normalizeStory(s.story);if(!story)return null;const varietyBook=normalizeVarietyBook(s.varietyBook);if(!varietyBook)return null;const social=normalizeSocial(s.social);if(!social)return null;s.workshop=workshop;s.sales=sales;s.story=story;s.varietyBook=varietyBook;s.social=social;
  return s;
 }catch{return null;}
}
