import {ECON} from './economy.js';
import {awardFragment} from './variety-engine.js';
import {nextRandom} from './rng.js';
export const RECIPES={
 riceball:{name:'饭团',glyph:'团',rice:2,base:12,unit:'份',cost:1,requires:[],step:'塑形'},
 flour:{name:'米粉',glyph:'粉',rice:3,base:18,unit:'份',cost:1,requires:[],step:'磨粉'},
 friedrice:{name:'蛋炒饭',glyph:'炒',rice:3,base:15,unit:'份',cost:1,requires:['riceball'],step:'翻锅'},
 noodle:{name:'米线',glyph:'线',rice:4,base:20,unit:'份',cost:1,requires:['flour'],step:'拉丝'},
 roll:{name:'肠粉',glyph:'卷',rice:4,base:20,unit:'份',cost:1,requires:['flour'],step:'揭皮'},
 cake:{name:'米糕',glyph:'糕',rice:5,base:24,unit:'份',cost:1,requires:['riceball'],step:'捣米'},
 wine:{name:'酿酒',product:'米酒',glyph:'酿',rice:8,base:12,unit:'瓶',cost:2,requires:['cake'],step:'拌曲'}
};
export const ROUTES={industrial:{name:'现代工业路线',output:1.2,perfect:90,good:210,interval:650,description:'产量 +20%；节奏更快，精准判定 ±90ms'},traditional:{name:'生态古法路线',output:1,perfect:140,good:280,interval:850,description:'节奏更舒缓；精准判定 ±140ms，更易高完成度'}};
export const NOTE_COUNT=12;
export function newWorkshop(){return {route:null,points:2,learned:[],foods:Object.fromEntries(Object.keys(RECIPES).map(k=>[k,0])),serial:0,completed:0,active:null,last:null};}
export function normalizeWorkshop(w){
 if(w===undefined)return newWorkshop();
 if(!w||!(w.route===null||ROUTES[w.route])||!Number.isSafeInteger(w.points)||w.points<0||!Array.isArray(w.learned)||w.learned.some(k=>!RECIPES[k])||new Set(w.learned).size!==w.learned.length)return null;
 if(!['serial','completed'].every(k=>Number.isSafeInteger(w[k])&&w[k]>=0)||w.completed>w.serial)return null;
 if(!w.foods||Object.keys(RECIPES).some(k=>!Number.isSafeInteger(w.foods[k])||w.foods[k]<0))return null;
 if(w.last!==null&&(!w.last||!RECIPES[w.last.recipe]||!Number.isFinite(w.last.completion)||!Number.isSafeInteger(w.last.quantity)||w.last.quantity<0||typeof w.last.unit!=='string'))return null;
 const a=w.active;
 if(a){
  if(!ROUTES[w.route]||!RECIPES[a.recipe]||!w.learned.includes(a.recipe)||!Number.isSafeInteger(a.id)||a.id!==w.serial||!['ready','running','paused'].includes(a.phase))return null;
  if(!Array.isArray(a.hits)||a.hits.length!==NOTE_COUNT||a.hits.some(x=>![null,0,.65,1].includes(x)))return null;
  if(!Number.isFinite(a.elapsed)||a.elapsed<0||a.elapsed>duration(w)||!Number.isSafeInteger(a.strays)||a.strays<0||!Number.isFinite(a.lastTap))return null;
  // A refreshed/backgrounded page resumes a paid batch; it never pays for it again.
  if(a.phase==='running')a.phase='paused';
 }
 return w;
}
export const targetTime=(w,i)=>1600+i*ROUTES[w.route].interval;
export const duration=w=>targetTime(w,NOTE_COUNT-1)+ROUTES[w.route].good+650;
export function completion(a){return Math.max(0,Math.min(1,a.hits.reduce((n,h)=>n+(h||0),0)/NOTE_COUNT-a.strays*.025));}
// 包 O：加工损耗随技能等级下降——一个配方没学时 30%，每多学一个降 2.5%，最低 10%。
export const processLoss=w=>{const n=w?.learned?.length||0;return Math.max(ECON.lossMin,Math.min(ECON.lossMax,ECON.lossMax-n*ECON.lossStep));};
export function processEstimate(w,recipe,score){const r=RECIPES[recipe]||{};const route=ROUTES[w.route]||ROUTES.traditional;return Math.max(1,Math.floor((r.base||0)*(.5+score)*route.output*(1-processLoss(w))));}
function tick(w,elapsed){const a=w.active;a.elapsed=Math.max(a.elapsed,Math.min(duration(w),elapsed));for(let i=0;i<NOTE_COUNT;i++)if(a.hits[i]===null&&a.elapsed>targetTime(w,i)+ROUTES[w.route].good)a.hits[i]=0;}
export function reduceProcessing(current,action){
 const s=structuredClone(current);s.workshop??=newWorkshop();const w=s.workshop;let error=null;
 const fail=t=>{error=t;};const a=w.active;
 switch(action.type){
 case 'process:route':if(a||w.serial>0)fail('首批加工开始后，本局科技路线固定。');else if(!ROUTES[action.route])fail('请选择有效路线。');else w.route=action.route;break;
 case 'process:learn':{const r=RECIPES[action.recipe];if(a)fail('请先完成当前加工。');else if(!r)fail('配方不存在。');else if(w.learned.includes(action.recipe))fail('已学习该技能。');else if(r.requires.some(k=>!w.learned.includes(k)))fail('请先学习前置技能。');else if(w.points<r.cost)fail('技艺点不足；完成度达到 50% 的加工可获得 1 点。');else{w.points-=r.cost;w.learned.push(action.recipe);}break;}
 case 'process:start':{const r=RECIPES[action.recipe];if(a)fail('已有一批加工，请继续完成。');else if(!w.route)fail('请先选择科技路线。');else if(!r||!w.learned.includes(action.recipe))fail('请先学习配方。');else if(s.rice<r.rice)fail('稻米不足，请先在御田完成秋收。');else{s.rice-=r.rice;w.serial++;w.active={id:w.serial,recipe:action.recipe,phase:'ready',elapsed:0,hits:Array(NOTE_COUNT).fill(null),strays:0,lastTap:-1000};}break;}
 case 'process:resume':if(!a||a.phase==='running')fail('当前没有暂停的加工。');else a.phase='running';break;
 case 'process:tick':case 'process:pause':case 'process:tap':{
  if(!a||a.phase!=='running')fail('请先开始或继续节奏。');else if(!Number.isFinite(action.elapsed)||action.elapsed<0)fail('无效计时。');else{
   tick(w,action.elapsed);
   if(action.type==='process:pause')a.phase='paused';
   if(action.type==='process:tap'&&a.elapsed-a.lastTap>=110){
    a.lastTap=a.elapsed;let best=-1,delta=Infinity;for(let i=0;i<NOTE_COUNT;i++)if(a.hits[i]===null){const d=Math.abs(a.elapsed-targetTime(w,i));if(d<delta){best=i;delta=d;}}
    if(best>=0&&delta<=ROUTES[w.route].good)a.hits[best]=delta<=ROUTES[w.route].perfect?1:.65;else a.strays++;
   }
  }break;
 }
 case 'process:finish':
  if(!a||a.elapsed<duration(w))fail('请先完成全部节拍。');
  else{const score=completion(a),r=RECIPES[a.recipe],quantity=processEstimate(w,a.recipe,score);w.foods[a.recipe]+=quantity;w.completed++;const point=score>=.5?1:0;w.points+=point;
   w.last={id:a.id,recipe:a.recipe,name:r.product||r.name,completion:Math.round(score*100),quantity,unit:r.unit,rice:r.rice,route:w.route,point,perfect:a.hits.filter(x=>x===1).length,good:a.hits.filter(x=>x===.65).length,miss:a.hits.filter(x=>!x).length,strays:a.strays};
   s.log.unshift(`加工${r.product||r.name}：完成度 ${w.last.completion}%，入库 ${quantity}${r.unit}，消耗 ${r.rice}kg 稻米。`);s.log=s.log.slice(0,8);w.active=null;
   // 耕织图碎片：作坊每完成一批就有机会从旧纸堆里翻出一片
   if(nextRandom(s)<.35)awardFragment(s,'process');
  }break;
 default:fail('未知加工操作。');
 }
 return error?{state:current,error}:{state:s,error:null};
}
