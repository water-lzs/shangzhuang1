export const SALES_PRODUCTS={
 riceball:{name:'饭团',kind:'food',unit:'份',price:{market:12,store:8,restaurant:24}},
 flour:{name:'米粉',kind:'food',unit:'份',price:{market:12,store:8,restaurant:24}},
 friedrice:{name:'蛋炒饭',kind:'food',unit:'份',price:{market:14,store:9,restaurant:28}},
 noodle:{name:'米线',kind:'food',unit:'份',price:{market:14,store:9,restaurant:28}},
 roll:{name:'肠粉',kind:'food',unit:'份',price:{market:15,store:10,restaurant:30}},
 cake:{name:'米糕',kind:'food',unit:'份',price:{market:13,store:9,restaurant:26}},
 wine:{name:'米酒',kind:'food',unit:'瓶',price:{market:28,store:20,restaurant:48}},
 rice:{name:'稻米',kind:'rice',unit:'kg',price:{market:180,store:150}}
};
export const CHANNELS={
 market:{name:'市场',fee:5,description:'每季食物最多 1000 份；稻米最多 5 石。现货价。'},
 store:{name:'粮店',fee:3,description:'不限量，大宗价。'},
 restaurant:{name:'酒楼',fee:5,description:'不限量，高端价；只收优质食物。'}
};
export const RICE_PER_STONE=50;
export function newSales(){return {wen:0,season:'spring',foodSold:0,riceSoldKg:0,history:[]};}
export function normalizeSales(s){
 if(s===undefined)return newSales();
 if(!s||!Number.isSafeInteger(s.wen)||s.wen<0||!['spring','summer','autumn','winter'].includes(s.season)||!Number.isSafeInteger(s.foodSold)||s.foodSold<0||!Number.isSafeInteger(s.riceSoldKg)||s.riceSoldKg<0||!Array.isArray(s.history))return null;
 return s;
}
export function productQuantity(state,id){if(id==='rice')return state.rice;return state.workshop?.foods?.[id]||0;}
export function qualityForSale(state){return state.result?.quality||state.history?.[0]?.quality||'良';}
export function saleQuote(state,channel,id,quantity){
 const p=SALES_PRODUCTS[id],c=CHANNELS[channel];if(!p||!c)return null;
 const unitPrice=p.price[channel];if(unitPrice===undefined)return null;
 const q=Math.max(0,Math.floor(quantity||0));const gross=unitPrice*q;const fee=c.fee*q;
 return {channel,id,quantity:q,unitPrice,fee,gross,net:gross-fee,quality:qualityForSale(state),unit:p.unit};
}
export function reduceSales(current,action){
 const s=structuredClone(current);s.sales??=newSales();const x=s.sales;let error=null;const fail=t=>{error=t;};
 if(action.type==='sales:season'){if(!['spring','summer','autumn','winter'].includes(action.season))fail('季节无效。');else{x.season=action.season;x.foodSold=0;x.riceSoldKg=0;}} 
 else if(action.type==='sales:sell'){
  const p=SALES_PRODUCTS[action.product],c=CHANNELS[action.channel],q=Math.floor(Number(action.quantity));
  if(!p||!c)fail('请选择有效的销售渠道和商品。');
  else if(!Number.isFinite(q)||q<1)fail('出售数量必须是正整数。');
  else if(action.channel==='restaurant'&&p.kind!=='food')fail('酒楼只收优质加工食品。');
  else if(action.channel==='restaurant'&&qualityForSale(s)!=='优')fail('酒楼只收品质为“优”的产品。');
  else if(action.channel==='market'&&p.kind==='food'&&x.foodSold+q>1000)fail(`本季市场食物额度还剩 ${1000-x.foodSold} 份。`);
  else if(action.channel==='market'&&p.kind==='rice'&&x.riceSoldKg+q*RICE_PER_STONE>5*RICE_PER_STONE)fail('本季市场稻米额度为 5 石。');
  else if(productQuantity(s,action.product)<q*(p.kind==='rice'?RICE_PER_STONE:1))fail(`${p.name}库存不足。`);
  else{const quote=saleQuote(s,action.channel,action.product,q);if(p.kind==='rice'){s.rice-=q*RICE_PER_STONE;x.riceSoldKg+=q*RICE_PER_STONE;}else{s.workshop.foods[action.product]-=q;x.foodSold+=q;} x.wen+=quote.net;x.history.unshift({...quote,season:x.season,at:Date.now()});x.history=x.history.slice(0,20);s.log.unshift(`销售${p.name}：${q}${p.kind==='rice'?'石':p.unit}，${c.name}净得 ${quote.net} 文。`);s.log=s.log.slice(0,8);}
 } else fail('未知销售操作。');
 return error?{state:current,error}:{state:s,error:null};
}
