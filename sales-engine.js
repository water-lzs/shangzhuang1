import {ECON,JIN_PER_STONE,RICE_BASE_PRICE,QUALITY_RATE,ricePricePerStone} from './economy.js';
import {awardFragment} from './variety-engine.js';
import {nextRandom} from './rng.js';
// 加工品价格（包 O·经济平衡）：渠道基准 3 / 2 / 5 文/份，即原价压缩到约 30%。
// 各产品保留原有相对价差（米酒最贵，米糕/饭团最便宜），实际值见下表。
// 例：饭团原市场价 12 文 → 现 3 文；米酒原 28 文 → 现 7 文。
export const SALES_PRODUCTS={
 riceball:{name:'饭团',kind:'food',unit:'份',price:{market:3,store:2,restaurant:5}},
 flour:{name:'米粉',kind:'food',unit:'份',price:{market:3,store:2,restaurant:5}},
 friedrice:{name:'蛋炒饭',kind:'food',unit:'份',price:{market:4,store:3,restaurant:7}},
 noodle:{name:'米线',kind:'food',unit:'份',price:{market:4,store:3,restaurant:7}},
 roll:{name:'肠粉',kind:'food',unit:'份',price:{market:4,store:3,restaurant:7}},
 cake:{name:'米糕',kind:'food',unit:'份',price:{market:3,store:2,restaurant:5}},
 wine:{name:'米酒',kind:'food',unit:'瓶',price:{market:7,store:5,restaurant:12}},
 // 稻田蟹是「投放稻田蟹」的副产品：不再是只进不出的死资源，可卖钱，也可留作来年蟹苗。
 crab:{name:'稻田蟹',kind:'good',unit:'只',price:{market:6,store:5,restaurant:12}},
 rice:{name:'稻米',kind:'rice',unit:'kg',price:{market:300,store:200,restaurant:500}}
};
export const CHANNELS={
 market:{name:'市场',fee:5,description:'每季食物最多 1000 份、稻米最多 5 石；手续费 5 文/笔。'},
 store:{name:'粮店',fee:3,description:'不限量，大宗价；手续费 3 文/笔。'},
 restaurant:{name:'酒楼',fee:5,description:'不限量，高端价；只收优等以上；手续费 5 文/笔。'}
};
export const RICE_PER_STONE=50;
export function newSales(){return {wen:0,season:'spring',foodSold:0,riceSoldKg:0,seasonIncome:0,history:[]};}
export function normalizeSales(s){
 if(s===undefined)return newSales();
 if(!s||!Number.isSafeInteger(s.wen)||s.wen<0||!['spring','summer','autumn','winter'].includes(s.season)||!Number.isSafeInteger(s.foodSold)||s.foodSold<0||!Number.isSafeInteger(s.riceSoldKg)||s.riceSoldKg<0||!Array.isArray(s.history))return null;
 s.seasonIncome=Number.isSafeInteger(s.seasonIncome)&&s.seasonIncome>=0?s.seasonIncome:0;
 return s;
}
export function productQuantity(state,id){if(id==='rice')return state.rice;if(id==='crab')return state.crabs||0;return state.workshop?.foods?.[id]||0;}
export function qualityForSale(state){return state.result?.quality||state.history?.[0]?.quality||'良';}
export function restaurantAccepts(quality){return quality==='优'||quality==='特优';}
// 陈化比例：按入库先后（FIFO）从最老的批次取，超过 agedSeasons 季的那部分算陈米
export function riceAgedRatio(state,quantityKg){const lots=state.riceLots||[];if(!lots.length||!quantityKg)return 0;let left=quantityKg,aged=0;for(const lot of lots){if(left<=0)break;const take=Math.min(lot.kg||0,left);if((lot.age||0)>ECON.agedSeasons)aged+=take;left-=take;}return Math.min(1,aged/quantityKg);}
export function saleQuote(state,channel,id,quantity){
 const p=SALES_PRODUCTS[id],c=CHANNELS[channel];if(!p||!c)return null;
 // 酒楼只收优质加工食品与稻田蟹：稻米在酒楼没有销路。这里直接返回 null，
 // 让 UI 的「可售/不可售」判定与 reduceSales 的校验保持同一套规则（否则按钮会显示可售但一点就报错）。
 if(channel==='restaurant'&&p.kind==='rice')return null;
 const q=Math.max(0,Math.floor(quantity||0));const quality=qualityForSale(state);let agedRatio=0,unitPrice;
 if(p.kind==='rice'){
  const rate=QUALITY_RATE[quality]||1,fresh=ricePricePerStone(channel,quality,false),old=ricePricePerStone(channel,quality,true);
  agedRatio=riceAgedRatio(state,q*RICE_PER_STONE);
  unitPrice=Math.round(fresh*(1-agedRatio)+old*agedRatio);
 }else unitPrice=p.price[channel];
 if(unitPrice===undefined)return null;
 const gross=unitPrice*q,fee=Math.min(c.fee,gross);
 return {channel,id,quantity:q,unitPrice,fee,gross,net:gross-fee,quality,unit:p.unit,agedRatio:Math.round(agedRatio*100)/100,perJin:Math.round(RICE_BASE_PRICE[channel]*(QUALITY_RATE[quality]||1)*100)/100};
}
export function reduceSales(current,action){
 const s=structuredClone(current);s.sales??=newSales();const x=s.sales;let error=null;const fail=t=>{error=t;};
 if(action.type==='sales:sell'){
  const p=SALES_PRODUCTS[action.product],c=CHANNELS[action.channel],q=Math.floor(Number(action.quantity));
  if(!p||!c)fail('请选择有效的销售渠道和商品。');
  else if(!Number.isFinite(q)||q<1)fail('出售数量必须是正整数。');
  else if(action.channel==='restaurant'&&p.kind==='rice')fail('酒楼只收优质加工食品与稻田蟹。');
  else if(action.channel==='restaurant'&&p.kind==='food'&&!restaurantAccepts(qualityForSale(s)))fail('酒楼只收优等（优/特优）的产品。');
  else if(action.channel==='market'&&p.kind==='food'&&x.foodSold+q>1000)fail(`本季市场食物额度还剩 ${1000-x.foodSold} 份。`);
  else if(action.channel==='market'&&p.kind==='rice'&&x.riceSoldKg+q*RICE_PER_STONE>5*RICE_PER_STONE)fail('本季市场稻米额度为 5 石。');
  else if(productQuantity(s,action.product)<q*(p.kind==='rice'?RICE_PER_STONE:1))fail(`${p.name}库存不足。`);
  else{const quote=saleQuote(s,action.channel,action.product,q);
   if(p.kind==='rice'){const kg=q*RICE_PER_STONE;s.rice-=kg;x.riceSoldKg+=kg;let left=kg;s.riceLots=(s.riceLots||[]).filter(l=>{if(left<=0)return true;const take=Math.min(l.kg||0,left);l.kg-=take;left-=take;return l.kg>0;});}
   else if(p.kind==='good'){s.crabs-=q;}
   else{s.workshop.foods[action.product]-=q;x.foodSold+=q;}
   x.wen+=quote.net;x.seasonIncome=(x.seasonIncome||0)+quote.net;x.history.unshift({...quote,season:x.season,at:Date.now()});x.history=x.history.slice(0,20);
   s.log.unshift(`${c.name}收去${p.name} ${q}${p.kind==='rice'?'石':p.unit}，净得 ${quote.net} 文${quote.agedRatio>0?'（其中有陈米，折了价）':''}。`);s.log=s.log.slice(0,8);
   // 耕织图碎片：成笔的买卖谈成时，账房先生翻账本夹出一片旧纸
   if(q>=5&&nextRandom(s)<.3)awardFragment(s,'trade');}
 } else fail('未知销售操作。');
 return error?{state:current,error}:{state:s,error:null};
}
