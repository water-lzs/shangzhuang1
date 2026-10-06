import {newWorkshop,normalizeWorkshop,reduceProcessing} from './processing-engine.js';
import {newSales,normalizeSales,reduceSales} from './sales-engine.js';
import {newStory,normalizeStory,reduceStory} from './story-engine.js';
import {newVarietyBook,normalizeVarietyBook,reduceVarieties,awardFragment} from './variety-engine.js';
import {ECON,JIN_PER_KG,JIN_PER_STONE,QUALITY_ORDER,YIELD_TABLE} from './economy.js';
import {nextRandom} from './rng.js';
import {newSocial,normalizeSocial,reduceSocial} from './social-engine.js';
import {reduceEnding} from './ending-engine.js';
// Pure, serializable farming rules. All numbers here are game balancing parameters.
export const SAVE_KEY='jingxi-farm-v1';
export const TERMS={spring:['春','谷雨','插秧'],summer:['夏','小暑','生长'],autumn:['秋','秋分','收割'],winter:['冬','冬至','休耕']};
// —— 包 P：两个「生态抉择」不再是单选题，每个选项都有代价 ——
// 水源：玉泉最好但要花工钱与体力；河水免费却有把虫卵引进田的风险；井水最省事但伤生态。
export const WATER={
 yuquan:{name:'玉泉山水',quality:60,ecology:10,wen:15,stamina:8,desc:'水色最清，可要从山脚开渠引来，工钱与人工都不便宜。'},
 river:{name:'普通河水',quality:25,ecology:0,wen:0,stamina:4,riskPest:.3,riskPestAdd:20,desc:'不花钱，但河里带着虫卵，有概率把虫害一起引进田。'},
 tap:{name:'铁管井水',quality:10,ecology:-8,wen:0,stamina:2,desc:'离田最近、最省力气，但井水偏硬，田土与生态都要吃亏。'}
};
// 虫害：农药立竿见影但生态崩，投蟹要买蟹苗却能养生态还能捕来卖，人工不伤生态但费体力且除不净。
export const PEST={
 pesticide:{name:'喷洒农药',pests:0,ecology:-30,wen:8,stamina:4,desc:'虫子立时清光，代价是田埂上的那股生气。'},
 crab:{name:'投放稻田蟹',pestRate:.2,ecology:20,wen:20,stamina:10,yieldsCrabs:true,desc:'蟹苗要花钱，但蟹能压虫、养生态，秋后还能捕来卖。'},
 manual:{name:'人工捉虫',pestsDelta:-50,ecology:10,wen:0,stamina:30,desc:'不伤生态，可弯腰半日，还除不干净。'}
};
// —— 经济参数已抽到 economy.js（生产端与销售端共用，避免循环依赖）。这里只做转出，方便 UI 引用。——
export {ECON,JIN_PER_KG,JIN_PER_STONE,QUALITY_ORDER,YIELD_TABLE} from './economy.js';
// Narrative lines only. All balancing numbers stay in the rules above, never in the copy.
const NARR={
 plant:n=>`你弯腰插下 ${n} 亩秧苗，指尖沾满了泥水。`,
 waterNeed:()=>'田里的水见了底，该引一渠水进来了。',
 water:{yuquan:'你引了玉泉山水入田，水色清亮，稻叶似乎舒展了些。',river:'你引了河水入田，水面浮着碎草屑，说不上好坏。',tap:'铁管水注进田里，水面泛起一层白沫，泥腥味压了很久才散。'},
 pestOut:()=>'稻叶上爬起了虫影，叶脉一点点被啃薄。',
 pest:{pesticide:'药水泼下去，虫子是没了，田埂上那股生气也淡了。',crab:'稻田蟹下了田，水渠里多了窸窣的动静。',manual:'你卷起裤腿下田捉虫，弯腰半日，直起身时天都暗了。'},
 inspect:n=>`第 ${n} 次巡田：稻苗又抽高了一截，脚下的田土微微发干。`,
 harvest:()=>'秋收的稻谷入了仓。你按老规矩留下了一批种子，来年还得靠它们。',
 shortage:()=>'天时不顺，稻穗还没长实就塌了一片，这一季的收成薄得让人心慌。',
 settle:net=>net>=0?'入冬前算了账：地租、维护、修缮一笔笔支出去，进出相抵，钱袋还剩些。':'入冬前算了账：地租、维护、修缮支出去，钱袋眼见着瘪了。',
 bribe:()=>'衙门里来过人，说是有笔例钱要交，你没敢多问，数了铜钱递过去。',
 buySeed:n=>`你在集市的种摊前蹲了半晌，挑出 ${n} 份成色好的稻种。`,
 hire:()=>'你从镇上喊来两个短工搭手，田里的活计总算松快了些。',
 barter:()=>'钱袋空了，只好去邻家换工——搭上一份人情，总算把最要紧的活计赶开了。',
 crabCatch:n=>`秋后放水，田里爬出一篓稻田蟹，足有 ${n} 只。`,
 winter:()=>'休耕结束，土地缓过了劲，新一年的春播该开始了。'
};
const clamp=(x,min=0,max=100)=>Math.min(max,Math.max(min,x));
const round=x=>Math.round(x*10)/10;
export const planted=s=>s.plots.filter(Boolean).length;
export const tds=s=>Math.round(500-4*s.water);
export function pestLabel(p){return p===0?'无':p<=20?'轻度':p<=50?'中度':'重度';}
export function createFarm(seed=Date.now()>>>0){return {space:'home',ending:null,workshop:newWorkshop(),sales:newSales(),story:newStory(),varietyBook:newVarietyBook(),social:newSocial(),ui:{showNumbers:false},detect:null,barter:0,version:1,year:1,season:'spring',seeds:10,land:10,plots:Array(10).fill(false),previousPlots:Array(10).fill(false),moisture:70,water:40,ecology:50,pests:0,stamina:100,crabs:0,rice:0,riceLots:[],settle:null,tools:{level:0},riceVariety:'royal',growth:0,pending:null,plan:null,rng:seed>>>0,harvested:false,result:null,history:[],log:['林宇穿越回清代，绑定京西稻贡米系统。','林宇领到 10 份稻种与 10 亩初级地。']};}
const random=nextRandom; // 随机数实现在 rng.js，各玩法模块共用同一套种子，读档才能重放一致
function note(s,t){s.log.unshift(t);s.log=s.log.slice(0,8);}
export function yieldBaseOf(s){const t=s.plotVarieties;if(Array.isArray(t)&&t.length===10){const ids=[...new Set(t.filter(Boolean))];if(ids.length)return Math.round(ids.reduce((n,id)=>n+(YIELD_TABLE[id]||ECON.yieldBase),0)/ids.length);}return YIELD_TABLE[s.riceVariety]||ECON.yieldBase;}
export function estimate(s){
 const acres=planted(s),health=clamp(100-Math.max(0,60-s.moisture,s.moisture-80)*2);
 // 品质分把「生态值」也算进去：光引玉泉、不管生态，照样出不了特优。
 const score=round(ECON.qWaterW*s.water+ECON.qHealthW*health+ECON.qPestW*(100-s.pests)+ECON.qEcoW*s.ecology);
 const quality=score>=90&&s.water>=80&&s.pests<=10&&s.ecology>=70?'特优':score>=78&&s.water>=60&&s.pests<=25&&s.ecology>=50?'优':score>=58?'良':'劣';
 const multiplier={特优:1.35,优:1.2,良:1,劣:.65}[quality],ecoMultiplier=.8+.004*s.ecology,base=yieldBaseOf(s);
 // 留种不再是「收多少返多少」：只留六成，其余得花钱去集市买。
 return {year:s.year,acres,quality,score,health,base,qualityMultiplier:multiplier,ecoMultiplier:round(ecoMultiplier*100)/100,ecology:s.ecology,water:s.water,moisture:s.moisture,pests:s.pests,yieldKg:Math.floor(acres*base*multiplier*ecoMultiplier),reservedSeeds:acres?Math.max(2,Math.round(acres*ECON.seedKeepRate)):0};
}
// —— 包 O：季末结算。固定开销 + 随机例钱 + 稻米陈化，一次算清并留下面板数据。——
function settleSeason(s,ended){
 const x=s.sales??=newSales();
 const acres=planted(s)||(s.previousPlots||[]).filter(Boolean).length;
 const pieces=(s.tools?.level||0)+1;
 const rent=Math.round(ECON.rentPerAcre*acres),upkeep=Math.round(ECON.toolUpkeep*pieces),house=ECON.houseUpkeep;
 const income=Math.max(0,Math.floor(x.seasonIncome||0));
 let bribe=0;if(income>0&&random(s)<ECON.bribeChance)bribe=Math.floor(income*ECON.bribeRate);
 const cost=rent+upkeep+house+bribe,paid=Math.min(x.wen,cost);
 x.wen=Math.max(0,x.wen-paid);x.seasonIncome=0;x.foodSold=0;x.riceSoldKg=0;x.season=s.season;
 s.barter=0; // 每季重置「邻里换工」次数
 s.settle={year:s.year,ended,acres,income,rent,upkeep,house,bribe,cost,paid,short:cost-paid,net:income-cost};
 for(const lot of s.riceLots||[])lot.age++;
 // 体力保底：防止「体力耗尽 + 无钱雇工 + 生态事件挂着」把整局卡死。
 const before=s.stamina;s.stamina=Math.max(s.stamina,ECON.staminaFloor);
 if(s.stamina>before)note(s,'歇了一季，身上的乏总算缓过来些。');
 if(bribe>0)note(s,NARR.bribe());
 note(s,NARR.settle(s.settle.net));
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
 if(action.type==='detect'){
  if(s.detect&&s.detect.year===s.year&&s.detect.season===s.season)fail('本季的田情已经检测过了，等下一季再看。');
  else if(s.stamina<ECON.staminaDetect)fail(`体力不足 ${ECON.staminaDetect}，先歇一歇再检测。`);
  else{s.stamina-=ECON.staminaDetect;s.detect={year:s.year,season:s.season,at:Date.now()};note(s,'你在田埂上取了一瓢水样，蹲下来细细看了一遍。');}
 }else if(action.type==='plant'){
  const need=ECON.staminaPlant*(Number.isInteger(action.count)?action.count:0);
  if(s.season!=='spring')fail('只有春季谷雨可以插秧。');
  else if(!Number.isInteger(action.count)||action.count<1)fail('插秧亩数必须是正整数。');
  else if(action.count>s.seeds||action.count>10-planted(s))fail('种子或空地不足。');
  else if(action.plot!==undefined&&(!Number.isInteger(action.plot)||action.plot<0||action.plot>=10||s.plots[action.plot]||action.count!==1))fail('请选择一亩空地。');
  else if(s.stamina<need)fail(`插秧 ${action.count} 亩要 ${need} 点体力，先歇一歇，或去镇上雇两个短工。`);
  else {let remaining=action.count;if(action.plot!==undefined)s.plots[action.plot]=true;else for(let i=0;i<10&&remaining;i++)if(!s.plots[i]){s.plots[i]=true;remaining--;}
    s.seeds-=action.count;s.stamina-=need;note(s,NARR.plant(action.count));}
 }else if(action.type==='seed:buy'){
  const n=Math.floor(Number(action.count));
  if(!Number.isFinite(n)||n<1)fail('购买种子的数量必须是正整数。');
  else if(s.seeds+n>ECON.seedCap)fail(`种子最多存 ${ECON.seedCap} 份。`);
  else if((s.sales?.wen||0)<n*ECON.seedPrice)fail(`买 ${n} 份稻种要 ${n*ECON.seedPrice} 文，钱不够。`);
  else{s.sales.wen-=n*ECON.seedPrice;s.seeds+=n;note(s,NARR.buySeed(n));}
 }else if(action.type==='hire'){
  const key=`${s.year}-${s.season}`;
  if(s.stamina>=100)fail('体力是满的，不必再雇工。');
  else if((s.sales?.wen||0)>=ECON.hireCost){s.sales.wen-=ECON.hireCost;s.stamina=clamp(s.stamina+ECON.hireStamina);note(s,NARR.hire());}
  else if((s.barter||0)<ECON.barterPerSeason){
   // 逃生口：钱不够也能靠邻里换工回体力，否则「体力耗尽 + 无钱 + 事件挂着」会把整局卡死。
   s.barter=(s.barter||0)+1;s.stamina=clamp(s.stamina+ECON.hireStamina);note(s,NARR.barter());
  }
  else fail(`雇短工要 ${ECON.hireCost} 文，钱不够；本季的邻里换工也已经用过了。`);
 }else if(action.type==='inspect'){
  if(s.season!=='summer'||s.growth>=3)fail('当前无需巡田。');
  else if(s.pending)fail('请先处理眼前的生态事件。');
  else if(s.stamina<ECON.staminaInspect)fail(`巡田要 ${ECON.staminaInspect} 点体力，先歇一歇，或去镇上雇两个短工。`);
  else{
   s.stamina-=ECON.staminaInspect;s.growth++;s.moisture=clamp(s.moisture-8);
   if(s.growth===s.plan.waterTurn){s.pending={type:'water',id:`${s.year}-water`};note(s,NARR.waterNeed());}
   else if(s.growth===s.plan.pestTurn){s.pests=s.plan.pestSeverity;s.pending={type:'pest',id:`${s.year}-pest`};note(s,NARR.pestOut());}
   else note(s,NARR.inspect(s.growth));
  }
 }else if(action.type==='water'){
  const c=WATER[action.choice];
  if(s.season!=='summer'||s.pending?.type!=='water'||!c)fail('当前没有可处理的水源事件。');
  else if((s.sales?.wen||0)<(c.wen||0))fail(`引${c.name}要 ${c.wen} 文工钱，钱还不够。`);
  else if(s.stamina<(c.stamina||0))fail(`引${c.name}要 ${c.stamina} 点体力，先歇一歇，或去镇上雇两个短工。`);
  else{
   if(c.wen)s.sales.wen-=c.wen;s.stamina-=(c.stamina||0);
   s.water=clamp(s.water+c.quality);s.ecology=clamp(s.ecology+c.ecology);s.moisture=clamp(s.moisture+20);
   if(c.riskPest&&random(s)<c.riskPest){s.pests=clamp(s.pests+c.riskPestAdd);note(s,'河里的虫卵跟着水进了田，稻叶上很快起了虫影。');}
   s.pending=null;note(s,NARR.water[action.choice]);
  }
 }else if(action.type==='pest'){
  const c=PEST[action.choice];
  if(s.season!=='summer'||s.pending?.type!=='pest'||!c)fail('当前没有可处理的虫害事件。');
  else if((s.sales?.wen||0)<(c.wen||0))fail(`${c.name}要 ${c.wen} 文，钱还不够。`);
  else if(s.stamina<(c.stamina||0))fail(`${c.name}要 ${c.stamina} 点体力，先歇一歇，或去镇上雇两个短工。`);
  else{
   if(c.wen)s.sales.wen-=c.wen;s.stamina-=(c.stamina||0);
   if(c.pests!==undefined)s.pests=clamp(c.pests);
   if(c.pestRate!==undefined)s.pests=round(clamp(s.pests*c.pestRate));
   if(c.pestsDelta)s.pests=clamp(s.pests+c.pestsDelta);
   s.ecology=clamp(s.ecology+c.ecology);
   if(c.yieldsCrabs)s.plan={...s.plan,useCrab:true};
   s.pending=null;note(s,NARR.pest[action.choice]);
  }
 }else if(action.type==='harvest'){
  if(s.season!=='autumn'||s.harvested)fail('当前无法重复收获。');
  else if(s.stamina<ECON.staminaHarvest)fail(`收割要 ${ECON.staminaHarvest} 点体力，先歇一歇，或去镇上雇两个短工。`);
  else{
   s.stamina-=ECON.staminaHarvest;
   s.result=estimate(s);let kg=s.result.yieldKg,disaster=null;
   if(random(s)<ECON.disasterChance){const sev=ECON.disasterMin+random(s)*(ECON.disasterMax-ECON.disasterMin);disaster=Math.round(sev*100);kg=Math.floor(kg*(1-sev));}
   s.result.yieldKg=kg;s.result.disaster=disaster;
   s.rice+=kg;if(kg>0){s.riceLots=s.riceLots||[];s.riceLots.push({kg,age:0,quality:s.result.quality});}
   s.seeds=Math.min(ECON.seedCap,s.seeds+s.result.reservedSeeds);
   s.harvested=true;s.previousPlots=[...s.plots];s.history.unshift(s.result);s.history=s.history.slice(0,10);
   note(s,disaster?NARR.shortage():NARR.harvest());
   if(s.plan?.useCrab){const n=planted(s);if(n>0){s.crabs+=n;note(s,NARR.crabCatch(n));}}
   // 耕织图碎片只能靠玩法掉：秋收品质不低于「良」时才有机会寻得一片。
   if(s.result.quality!=='劣'&&random(s)<.6)awardFragment(s,'plant');
  }
 }else if(action.type==='advance'){
  if(s.pending)fail('生态事件尚未处理。');
  else if(s.season==='spring'){
   if(!planted(s))fail('至少插秧 1 亩才能进入生长季。');
   else{s.season='summer';const waterTurn=random(s)<.5?1:2;s.plan={waterTurn,pestTurn:waterTurn===2?3:(random(s)<.5?2:3),pestSeverity:40+Math.floor(random(s)*31)};note(s,'小暑到来。巡田三次，观察稻苗与生态变化。');settleSeason(s,'spring');}
  }else if(s.season==='summer'){
   if(s.growth<3)fail('请完成 3 次巡田和全部事件。');else{s.season='autumn';note(s,'秋分已至，金黄稻穗等待收割。');settleSeason(s,'summer');}
  }else if(s.season==='autumn'){
   if(!s.harvested)fail('请先收获并确认本年结算。');else{s.season='winter';note(s,'冬至休耕。土地休养，种子入库。');settleSeason(s,'autumn');}
  }else if(s.season==='winter'){
   s.year++;s.season='spring';s.plots.fill(false);s.moisture=70;s.water=40;s.ecology=clamp(s.ecology+10);s.pests=0;s.stamina=100;s.growth=0;s.pending=null;s.plan=null;s.harvested=false;s.result=null;note(s,NARR.winter());settleSeason(s,'winter');
  }
 }else fail('未知农事操作。');
 return error?{state:current,error}:{state:s,error:null};
}
export function readSave(raw){
 try{const s=JSON.parse(raw);if(!s||s.version!==1||!TERMS[s.season]||s.land!==10) return null;
  s.space??='home';s.ending??=null;if(!s.ui||typeof s.ui!=='object')s.ui={showNumbers:false};else if(typeof s.ui.showNumbers!=='boolean')s.ui.showNumbers=false;if(s.detect===undefined)s.detect=null;
  if(!Array.isArray(s.riceLots))s.riceLots=[];
  if(!Number.isSafeInteger(s.barter)||s.barter<0||s.barter>ECON.barterPerSeason)s.barter=0;
  s.riceLots=s.riceLots.filter(l=>l&&Number.isFinite(l.kg)&&l.kg>0&&Number.isFinite(l.age)&&l.age>=0).map(l=>({kg:Math.floor(l.kg),age:Math.floor(l.age),quality:QUALITY_ORDER.includes(l.quality)?l.quality:'良'}));
  if(s.settle===undefined)s.settle=null;
  if(!s.tools||typeof s.tools!=='object'||!Number.isFinite(s.tools.level)||s.tools.level<0||s.tools.level>7)s.tools={level:0};
  if(typeof s.riceVariety!=='string'||!YIELD_TABLE[s.riceVariety])s.riceVariety='royal';
  if(!['home','town'].includes(s.space)||!(s.ending===null||['merchant','hermit','traveler','corrupt'].includes(s.ending)))return null;
  for(const k of ['year','seeds','crabs','rice','growth','rng'])if(!Number.isSafeInteger(s[k])||s[k]<0)return null;
  if(s.year<1||s.growth>3||s.rng>4294967295||s.seeds>ECON.seedCap)return null;
  for(const k of ['moisture','water','ecology','pests','stamina'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>100)return null;
  if(![s.plots,s.previousPlots].every(a=>Array.isArray(a)&&a.length===10&&a.every(x=>typeof x==='boolean')))return null;
  if(!Array.isArray(s.log)||!s.log.every(x=>typeof x==='string')||!Array.isArray(s.history)||typeof s.harvested!=='boolean')return null;
  if(s.pending!==null&&(!['water','pest'].includes(s.pending?.type)||typeof s.pending.id!=='string'))return null;
  if(s.season==='summer'&&(!s.plan||![1,2].includes(s.plan.waterTurn)||![2,3].includes(s.plan.pestTurn)||s.plan.pestTurn<=s.plan.waterTurn||!Number.isInteger(s.plan.pestSeverity)||s.plan.pestSeverity<40||s.plan.pestSeverity>70))return null;
  if(s.pending&&s.season!=='summer')return null;
  if((s.season==='autumn'||s.season==='winter')&&s.growth!==3)return null;
  if(s.season==='winter'&&!s.harvested)return null;
  if(s.harvested&&(!s.result||!QUALITY_ORDER.includes(s.result.quality)||!['yieldKg','score','ecoMultiplier','reservedSeeds'].every(k=>Number.isFinite(s.result[k])&&s.result[k]>=0)))return null;
  const workshop=normalizeWorkshop(s.workshop);if(!workshop)return null;const sales=normalizeSales(s.sales);if(!sales)return null;const story=normalizeStory(s.story);if(!story)return null;const varietyBook=normalizeVarietyBook(s.varietyBook);if(!varietyBook)return null;const social=normalizeSocial(s.social);if(!social)return null;s.workshop=workshop;s.sales=sales;s.story=story;s.varietyBook=varietyBook;s.social=social;
  return s;
 }catch{return null;}
}
