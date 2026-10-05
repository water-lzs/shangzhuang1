export const VARIETIES=[
 {id:'royal',name:'御稻米',era:'清代',period:'康熙—乾隆',origin:'京西御稻田',growth:'中熟',yield:420,quality:'特优',attr:'御贡米·香糯'},
 {id:'purple',name:'紫金箍',era:'清代',period:'乾隆年间',origin:'京西山麓',growth:'中熟',yield:390,quality:'优',attr:'紫穗·耐寒'},
 {id:'bigPurple',name:'大粒紫金箍',era:'清代',period:'乾隆年间',origin:'京西稻区',growth:'中晚熟',yield:450,quality:'优',attr:'大粒·高淀粉'},
 {id:'mingMang',name:'大明芒',era:'清代',period:'清初承袭明制',origin:'华北稻作区',growth:'晚熟',yield:410,quality:'优',attr:'长芒·抗倒伏'},
 {id:'bigRed',name:'大红芒',era:'清代',period:'清代地方志',origin:'京畿水田',growth:'晚熟',yield:400,quality:'优',attr:'红芒·观赏'},
 {id:'smallRed',name:'小红芒',era:'民国',period:'民国农事档案',origin:'京郊农场',growth:'中熟',yield:430,quality:'优',attr:'早返青'},
 {id:'silver',name:'银坊',era:'民国',period:'民国二十年代',origin:'银坊试验田',growth:'中熟',yield:460,quality:'优',attr:'银白穗·高产'},
 {id:'water300',name:'水源三百粒',era:'建国初期',period:'1950年代',origin:'水源农场',growth:'中晚熟',yield:500,quality:'良',attr:'丰产·杂交亲本'},
 {id:'jingyue1',name:'京越一号',era:'建国初期',period:'1970年代育成',origin:'京西农科所',growth:'中熟',yield:560,quality:'特优',attr:'杂交·优质'},
 {id:'yuefu3',name:'越富系三',era:'建国初期',period:'1970年代',origin:'华北育种站',growth:'早熟',yield:520,quality:'优',attr:'早熟·耐旱'},
 {id:'jindao305',name:'津稻三零五',era:'现代',period:'1990年代',origin:'津冀联合育种',growth:'中熟',yield:610,quality:'特优',attr:'高产·抗病'},
 {id:'shangxiang1',name:'上香一号',era:'现代',period:'21世纪初',origin:'京西香稻项目',growth:'中熟',yield:580,quality:'特优',attr:'浓香·优质'},
 {id:'jingxi3',name:'京西稻三号',era:'现代',period:'现代保种计划',origin:'京西稻活态基因库',growth:'中熟',yield:600,quality:'特优',attr:'基因库·复壮'}
];
export const ERAS=['清代','民国','建国初期','现代'];
export function newVarietyBook(){return {era:'清代',unlocked:[],culture:0,hybrid:false,achievement:false,artFragments:[],artRestored:false,title:false};}
export function normalizeVarietyBook(b){if(b===undefined)return newVarietyBook();if(!b)return null;b.artFragments??=[];b.artRestored??=false;b.title??=false;if(!ERAS.includes(b.era)||!Array.isArray(b.unlocked)||b.unlocked.some(id=>!VARIETIES.find(v=>v.id===id))||new Set(b.unlocked).size!==b.unlocked.length||b.culture!==b.unlocked.length||typeof b.hybrid!=='boolean'||typeof b.achievement!=='boolean'||!Array.isArray(b.artFragments)||b.artFragments.some(n=>!Number.isInteger(n)||n<0||n>19)||typeof b.artRestored!=='boolean'||typeof b.title!=='boolean')return null;return b;}
export function reduceVarieties(current,action){const s=structuredClone(current);s.varietyBook??=newVarietyBook();const b=s.varietyBook;let error=null;const fail=t=>error=t;const idx=ERAS.indexOf(b.era);
 if(action.type==='book:era'){if(!ERAS.includes(action.era))fail('时代无效。');else if(ERAS.indexOf(action.era)>idx+1)fail('请按时间线逐时代推进。');else b.era=action.era;}
 else if(action.type==='book:unlock'){const v=VARIETIES.find(x=>x.id===action.id);if(!v)fail('品种不存在。');else if(ERAS.indexOf(v.era)>ERAS.indexOf(b.era))fail(`请推进到${v.era}时代。`);else if(b.unlocked.includes(v.id))fail('该品种已在图鉴中。');else{b.unlocked.push(v.id);b.culture++;if(b.unlocked.length===13)b.achievement=true;s.log.unshift(`御贡图鉴：解锁${v.name}，文化碎片 +1。`);}}
 else if(action.type==='book:hybrid'){if(b.hybrid)fail('杂交育种已解锁。');else if((s.sales?.wen||0)<120||s.rice<300)fail('农科所需要 120 文与 300 kg 稻米。');else if(!b.unlocked.includes('water300')||!b.unlocked.includes('yuefu3'))fail('请先收集水源三百粒与越路早生亲本（图鉴中的越富系三）。');else{s.sales.wen-=120;s.rice-=300;b.hybrid=true;s.log.unshift('农科所：以水源三百粒 × 越路早生培育京越一号。');}}
 else if(action.type==='book:fragment'){const n=Number(action.fragment);if(!Number.isInteger(n)||n<0||n>19)fail('图鉴碎片编号无效。');else if(b.artFragments.includes(n))fail('该碎片已收集。');else{b.artFragments.push(n);b.artFragments.sort((a,c)=>a-c);if(b.artFragments.length===20){b.artRestored=true;b.title=true;s.log.unshift('《京西稻耕织图》已修复，获得“京西稻文化遗产守护者”称号。');}}}
 else fail('未知图鉴操作。');return error?{state:current,error}:{state:s,error:null};}
