import {pickIndex} from './rng.js';
export const VARIETIES=[
 {id:'royal',name:'御稻米',era:'清代',period:'康熙—乾隆',origin:'京西御稻田',growth:'中熟',yield:50,quality:'特优',attr:'御贡米·香糯'},
 {id:'purple',name:'紫金箍',era:'清代',period:'乾隆年间',origin:'京西山麓',growth:'中熟',yield:46,quality:'优',attr:'紫穗·耐寒'},
 {id:'bigPurple',name:'大粒紫金箍',era:'清代',period:'乾隆年间',origin:'京西稻区',growth:'中晚熟',yield:53,quality:'优',attr:'大粒·高淀粉'},
 {id:'mingMang',name:'大明芒',era:'清代',period:'清初承袭明制',origin:'华北稻作区',growth:'晚熟',yield:49,quality:'优',attr:'长芒·抗倒伏'},
 {id:'bigRed',name:'大红芒',era:'清代',period:'清代地方志',origin:'京畿水田',growth:'晚熟',yield:48,quality:'优',attr:'红芒·观赏'},
 {id:'smallRed',name:'小红芒',era:'民国',period:'民国农事档案',origin:'京郊农场',growth:'中熟',yield:88,quality:'优',attr:'早返青'},
 {id:'silver',name:'银坊',era:'民国',period:'民国二十年代',origin:'银坊试验田',growth:'中熟',yield:95,quality:'优',attr:'银白穗·高产'},
 {id:'water300',name:'水源三百粒',era:'建国初期',period:'1950年代',origin:'水源农场',growth:'中晚熟',yield:130,quality:'良',attr:'丰产·杂交亲本'},
 {id:'jingyue1',name:'京越一号',era:'建国初期',period:'1970年代育成',origin:'京西农科所',growth:'中熟',yield:160,quality:'特优',attr:'杂交·优质'},
 {id:'yuefu3',name:'越富系三',era:'建国初期',period:'1970年代',origin:'华北育种站',growth:'早熟',yield:150,quality:'优',attr:'早熟·耐旱'},
 {id:'jindao305',name:'津稻三零五',era:'现代',period:'1990年代',origin:'津冀联合育种',growth:'中熟',yield:200,quality:'特优',attr:'高产·抗病'},
 {id:'shangxiang1',name:'上香一号',era:'现代',period:'21世纪初',origin:'京西香稻项目',growth:'中熟',yield:200,quality:'特优',attr:'浓香·优质'},
 {id:'jingxi3',name:'京西稻三号',era:'现代',period:'现代保种计划',origin:'京西稻活态基因库',growth:'中熟',yield:205,quality:'特优',attr:'基因库·复壮'}
];
export const ERAS=['清代','民国','建国初期','现代'];
// —— 包 P：碎片不再是「20 个按钮随便点」——
// 20 片碎片按来源分成五组，只能靠对应玩法随机掉出来；集齐后才显影成完整卷轴。
export const FRAGMENT_POOLS={
 plant:[0,1,2,3,4,5],      // 秋收（品质良以上）
 process:[6,7,8,9],        // 作坊完成一批加工
 trade:[10,11,12,13],      // 市场交易达成
 social:[14,15,16],        // 社交认养与寄米
 story:[17,18,19]          // 穿越任务结算
};
export const FRAGMENT_SOURCE_LABEL={plant:'种植收获',process:'作坊加工',trade:'市场交易',social:'社交认养',story:'穿越剧情'};
export const FRAGMENT_SLOT_SOURCE=(()=>{const m={};for(const [k,list]of Object.entries(FRAGMENT_POOLS))for(const n of list)m[n]=k;return m;})();
// 品种收录的档案成本：不再是「点一下就收录」，需要送档案整理费并留出比对用的稻米。
export const UNLOCK_COST={wen:20,rice:30};
// 按玩法来源随机掉一片碎片。rng 走 state.rng，保证读档重放一致。返回新编号或 null。
export function awardFragment(s,pool){
 const b=s.varietyBook;if(!b)return null;
 const owned=new Set(b.artFragments||[]);
 const free=(FRAGMENT_POOLS[pool]||[]).filter(n=>!owned.has(n));
 if(!free.length)return null;
 const n=free[pickIndex(s,free.length)];
 b.artFragments=[...(b.artFragments||[]),n].sort((a,c)=>a-c);
 if(b.artFragments.length===20){b.artRestored=true;b.title=true;s.log.unshift('《京西稻耕织图》二十片终于补齐，卷轴在灯下慢慢显影。');}
 else s.log.unshift(`《京西稻耕织图》从${FRAGMENT_SOURCE_LABEL[pool]||'旧纸堆'}里寻得一片碎片（${b.artFragments.length} / 20）。`);
 s.log=s.log.slice(0,8);
 return n;
}
export function newVarietyBook(){return {era:'清代',unlocked:[],culture:0,hybrid:false,achievement:false,artFragments:[],artRestored:false,title:false};}
export function normalizeVarietyBook(b){if(b===undefined)return newVarietyBook();if(!b)return null;b.artFragments??=[];b.artRestored??=false;b.title??=false;if(!ERAS.includes(b.era)||!Array.isArray(b.unlocked)||b.unlocked.some(id=>!VARIETIES.find(v=>v.id===id))||new Set(b.unlocked).size!==b.unlocked.length||b.culture!==b.unlocked.length||typeof b.hybrid!=='boolean'||typeof b.achievement!=='boolean'||!Array.isArray(b.artFragments)||b.artFragments.some(n=>!Number.isInteger(n)||n<0||n>19)||typeof b.artRestored!=='boolean'||typeof b.title!=='boolean')return null;return b;}
export function reduceVarieties(current,action){const s=structuredClone(current);s.varietyBook??=newVarietyBook();const b=s.varietyBook;let error=null;const fail=t=>error=t;const idx=ERAS.indexOf(b.era);
 if(action.type==='book:era'){if(!ERAS.includes(action.era))fail('时代无效。');else if(ERAS.indexOf(action.era)>idx+1)fail('请按时间线逐时代推进。');else b.era=action.era;}
 else if(action.type==='book:unlock'){
  const v=VARIETIES.find(x=>x.id===action.id);
  if(!v)fail('品种不存在。');
  else if(ERAS.indexOf(v.era)>ERAS.indexOf(b.era))fail(`请推进到${v.era}时代。`);
  else if(b.unlocked.includes(v.id))fail('该品种已在图鉴中。');
  else if((s.sales?.wen||0)<UNLOCK_COST.wen)fail(`送档案房比对要 ${UNLOCK_COST.wen} 文，钱不够。`);
  else if(s.rice<UNLOCK_COST.rice)fail(`比对要留出 ${UNLOCK_COST.rice} kg 稻米，仓里不够。`);
  else{s.sales.wen-=UNLOCK_COST.wen;s.rice-=UNLOCK_COST.rice;b.unlocked.push(v.id);b.culture++;if(b.unlocked.length===13)b.achievement=true;s.log.unshift(`御贡图鉴：花 ${UNLOCK_COST.wen} 文、耗 ${UNLOCK_COST.rice} kg 稻米比对档案，收录${v.name}。`);}
 }
 else if(action.type==='book:hybrid'){if(b.hybrid)fail('杂交育种已解锁。');else if((s.sales?.wen||0)<120||s.rice<300)fail('农科所需要 120 文与 300 kg 稻米。');else if(!b.unlocked.includes('water300')||!b.unlocked.includes('yuefu3'))fail('请先收集水源三百粒与越路早生亲本（图鉴中的越富系三）。');else{s.sales.wen-=120;s.rice-=300;b.hybrid=true;s.log.unshift('农科所：以水源三百粒 × 越路早生培育京越一号。');}}
 else fail('未知图鉴操作。');return error?{state:current,error}:{state:s,error:null};}
