import {SALES_PRODUCTS,CHANNELS,RICE_PER_STONE,saleQuote,restaurantAccepts} from './sales-engine.js';
import {ECON,JIN_PER_STONE,JIN_PER_KG} from './economy.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSales({getState,dispatch}){
 let selected='riceball',channel='market',quantity=1,kgMode=false,message='';
 const unitInfo=(s,id)=>{const p=SALES_PRODUCTS[id],stock=id==='rice'?s.rice:id==='crab'?(s.crabs||0):(s.workshop?.foods?.[id]||0);return p?.kind==='rice'?{label:'石',max:Math.max(1,Math.floor(stock/RICE_PER_STONE)),stock,kg:RICE_PER_STONE}:{label:p?.unit||'份',max:Math.max(1,stock),stock,kg:0};};
 // 渠道能否成交的唯一判定。render 与 refresh 共用同一套规则，避免「按钮写着可售、一点就报错」。
 const eligibleFor=(s,id,product,quality)=>{const q=saleQuote(s,id,product,quantity);if(!q)return false;if(id!=='restaurant')return true;const p=SALES_PRODUCTS[product];return p?.kind==='crab'||(p?.kind==='food'&&restaurantAccepts(quality));};
 function refresh(){
  const s=getState(),p=SALES_PRODUCTS[selected],u=unitInfo(s,selected),quality=s.result?.quality||'良';
  // 关键修复：以前这里只更新价格文案，从不更新 .active —— 点了「酒楼」渠道后高亮永远停在「市场」。
  document.querySelectorAll('[data-sale-channel]').forEach(b=>{const id=b.dataset.saleChannel,q2=saleQuote(s,id,selected,quantity);
   b.disabled=!eligibleFor(s,id,selected,quality);
   const on=id===channel;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');
   const strong=b.querySelector('strong');if(strong)strong.textContent=q2?q2.net.toLocaleString()+' 文净得':'不可售';
   const small=b.querySelector('small');if(small)small.textContent=q2?`${q2.unitPrice} 文/${p.kind==='rice'?'石':p.unit}${p.kind==='rice'?`（${q2.perJin} 文/斤）`:''} · 手续费 ${CHANNELS[id].fee} 文/笔`:'不可售';});
  const q=saleQuote(s,channel,selected,quantity),submit=document.querySelector('[data-sale-submit]');
  if(submit){submit.disabled=!(q&&quantity>=1&&quantity<=u.max);submit.textContent=`出售 ${quantity} ${p.kind==='rice'?'石':p.unit} · 预计净得 ${q?.net||0} 文`;}
  const conv=document.querySelector('#sale-convert');
  const agedKg=(s.riceLots||[]).filter(l=>(l.age||0)>ECON.agedSeasons&&l.kg>0).reduce((n,l)=>n+l.kg,0);
  if(conv)conv.textContent=p.kind==='rice'?`1 石 = ${RICE_PER_STONE} kg = ${JIN_PER_STONE} 斤 · 库存 ${u.stock.toLocaleString()} kg ≈ ${u.max} 石 · 品质「${quality}」${agedKg>0?` · ⚠ ${agedKg} kg 已陈化，只能半价`:''}${kgMode?` · 当前输入 ${quantity*RICE_PER_STONE} kg`:''}`:`库存 ${u.stock} ${u.label} · 渠道价 市场 ${p.price.market} / 粮店 ${p.price.store}${p.price.restaurant?` / 酒楼 ${p.price.restaurant}`:''} 文/${p.unit}${p.kind==='good'?'（投放稻田蟹的副产品，留作来年蟹苗也行）':''}`;
  const capEl=document.querySelector('#sale-cap');
  if(capEl){const x=s.sales;if(channel==='market'){const cap=p.kind==='food'?1000-(x?.foodSold||0):5-(x?.riceSoldKg||0)/RICE_PER_STONE;capEl.textContent=`市场本季剩余：${Math.max(0,Math.round(cap*10)/10)} ${p.kind==='rice'?'石':'份'}${p.kind==='rice'?`（≈ ${Math.max(0,Math.floor(cap*RICE_PER_STONE))} kg）`:''}`;}else capEl.textContent='当前渠道不限量，按需出售。';}
 }
 function render(msg=''){
  message=msg;const s=getState(),x=s.sales||{wen:0,foodSold:0,riceSoldKg:0,season:s.season};const quality=s.result?.quality||'良';
  const products=Object.entries(SALES_PRODUCTS).filter(([id,p])=>p.kind==='rice'||(id==='crab'?(s.crabs||0)>0:(s.workshop?.foods?.[id]||0)>0));
  if(!products.some(([id])=>id===selected))selected=products[0]?.[0]||'riceball';
  const p=SALES_PRODUCTS[selected],stock=selected==='rice'?s.rice:s.workshop?.foods?.[selected]||0;
  const q=saleQuote(s,channel,selected,quantity);const u=unitInfo(s,selected);const unitLabel=p?.kind==='rice'?(kgMode?'kg':'石'):(p?.unit||'份');const maxQuantity=p?.kind==='rice'?(kgMode?u.max*RICE_PER_STONE:u.max):u.max;
  const shownQuantity=p?.kind==='rice'&&kgMode?quantity*RICE_PER_STONE:quantity;
  document.querySelector('#sales-root').innerHTML=`<div class="sales-heading"><span>京西商路 · 三产销售</span><h1>时空交易行</h1><button class="space-switch" data-space="home">← 回家</button><p>第 ${s.year} 年 · ${s.season==='spring'?'春 · 谷雨':s.season==='summer'?'夏 · 小暑':s.season==='autumn'?'秋 · 秋分':'冬 · 冬至'} · 根据品质与库存选择销路</p></div>
  <section class="sales-stats"><div><span>持有文</span><strong>${x.wen.toLocaleString()} 文</strong><small>用于交地租、买种子、雇短工</small></div><div><span>食物本季已售</span><strong>${x.foodSold} / 1000 份</strong><small>本季额度 · 每季归零</small></div><div><span>稻米本季已售</span><strong>${x.riceSoldKg/RICE_PER_STONE} / 5 石</strong><small>≈ ${x.riceSoldKg} / 250 kg · 每季归零</small></div><div><span>可售品质</span><strong>${quality}</strong><small>${restaurantAccepts(quality)?'酒楼可接收':'酒楼只收优等以上'}</small></div><div><span>本季毛收入</span><strong>${(x.seasonIncome||0).toLocaleString()} 文</strong><small>季末要扣地租、维护与修缮</small></div></section>
  <div class="sales-columns"><section class="sales-card"><h2>选择货品</h2><div class="sales-products">${products.map(([id,v])=>`<button class="sales-product ${id===selected?'active':''}" data-sale-product="${id}"><b>${v.name}</b><span>库存 ${id==='rice'?s.rice+' kg ≈ '+Math.floor(s.rice/RICE_PER_STONE)+' 石':id==='crab'?(s.crabs||0)+' 只':(s.workshop?.foods?.[id]||0)+' '+v.unit}</span></button>`).join('')}</div><label class="sales-label">出售数量（${unitLabel}）<input id="sale-quantity" type="number" min="1" max="${Math.max(1,maxQuantity)}" step="1" value="${shownQuantity}"></label>${p?.kind==='rice'?`<button class="text-button" data-kg-toggle>按${kgMode?'石':'kg'}输入</button>`:''}<p class="sales-hint" id="sale-convert"></p><p class="sales-hint" id="sale-cap"></p></section>
  <section class="sales-card"><h2>三个销售渠道</h2><div class="sales-channels">${Object.entries(CHANNELS).map(([id,c])=>{const quote=saleQuote(s,id,selected,quantity);const on=id===channel;const eligible=eligibleFor(s,id,selected,quality);return `<button class="sales-channel ${on?'active':''}" data-sale-channel="${id}" aria-pressed="${on?'true':'false'}" ${!eligible?'disabled':''}><b>${c.name}</b><span>${c.description}</span><strong>${quote?quote.net.toLocaleString()+' 文净得':'不可售'}</strong><small>${!eligible&&id==='restaurant'?`品质「${quality}」未达门槛 · 只收「优」以上，把水质和生态养上去再来`:quote?`单价 ${quote.unitPrice} · 手续费 ${c.fee} 文/笔`:`手续费 ${c.fee} 文/笔`}</small></button>`}).join('')}</div><button class="sales-primary" data-sale-submit ${!q||q.quantity<1||q.quantity>u.max?'disabled':''}>出售 ${quantity} ${unitLabel} · 预计净得 ${q?.net||0} 文</button><div class="sales-message" role="status">${esc(message)}</div></section></div>
  <section class="sales-card sales-log"><h2>最近交易</h2>${x.history?.length?`<ol>${x.history.slice(0,5).map(h=>`<li>${CHANNELS[h.channel].name} · ${SALES_PRODUCTS[h.id].name} ×${h.quantity}${h.id==='rice'?' 石（'+h.quantity*RICE_PER_STONE+' kg）':' '+SALES_PRODUCTS[h.id].unit} · 净得 ${h.net} 文</li>`).join('')}</ol>`:'<p>暂无交易，先从食物仓库选择货品。</p>'}</section>`;
  document.querySelectorAll('[data-sale-product]').forEach(b=>b.onclick=()=>{selected=b.dataset.saleProduct;quantity=1;kgMode=false;render();});
  document.querySelectorAll('[data-sale-channel]').forEach(b=>b.onclick=()=>{channel=b.dataset.saleChannel;refresh();});  const input=document.querySelector('#sale-quantity');
  input?.addEventListener('input',e=>{const raw=Math.floor(Number(e.target.value)||0);if(p?.kind==='rice'&&kgMode)quantity=Math.min(Math.max(0,Math.floor(raw/RICE_PER_STONE)),u.max);else quantity=Math.max(1,raw);refresh();});
  input?.addEventListener('blur',e=>{let fixed;if(p?.kind==='rice'&&kgMode){fixed=Math.max(1,Math.min(Math.floor(Number(e.target.value)||0),u.max*RICE_PER_STONE));quantity=Math.floor(fixed/RICE_PER_STONE);}else{fixed=Math.max(1,Math.min(Math.floor(Number(e.target.value)||1),u.max));quantity=fixed;}if(String(fixed)!==e.target.value)e.target.value=fixed;refresh();});
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector('[data-sale-submit]')?.click();}});
  document.querySelector('[data-kg-toggle]')?.addEventListener('click',()=>{kgMode=!kgMode;render();});
  document.querySelector('[data-sale-submit]')?.addEventListener('click',()=>{const ok=dispatch({type:'sales:sell',channel,product:selected,quantity});if(!ok)render('交易失败，请检查库存、品质或本季额度。');});
  refresh();
 }
 // setChannel：给沉浸层「酒楼 · 高端交易」这类外部入口用。直接设渠道并刷新，
 // 不依赖「去找按钮再 click」——那样在按钮 disabled（品质不够）时会静默失败。
 return {render,setChannel:id=>{if(!CHANNELS[id])return false;channel=id;refresh();return true;}};
}
