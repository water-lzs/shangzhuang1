import {SALES_PRODUCTS,CHANNELS,RICE_PER_STONE,saleQuote} from './sales-engine.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSales({getState,dispatch}){
 let selected='riceball',channel='market',quantity=1,message='';
 function render(msg=''){
  message=msg;const s=getState(),x=s.sales||{wen:0,foodSold:0,riceSoldKg:0,season:s.season};const quality=s.result?.quality||'良';
  const products=Object.entries(SALES_PRODUCTS).filter(([id,p])=>p.kind==='rice'||(s.workshop?.foods?.[id]||0)>0);
  if(!products.some(([id])=>id===selected))selected=products[0]?.[0]||'riceball';const p=SALES_PRODUCTS[selected],stock=selected==='rice'?s.rice:s.workshop?.foods?.[selected]||0;
  const q=saleQuote(s,channel,selected,quantity);const cap=channel==='market'?(p?.kind==='food'?1000-x.foodSold:5-x.riceSoldKg/RICE_PER_STONE):null;const unitLabel=p?.kind==='rice'?'石':(p?.unit||'份');const maxQuantity=p?.kind==='rice'?Math.floor(stock/RICE_PER_STONE):stock;
  document.querySelector('#sales-root').innerHTML=`<div class="sales-heading"><span>京西商路 · 三产销售</span><h1>时空交易行</h1><button class="space-switch" data-space="home">← 回家</button><p>第 ${s.year} 年 · ${s.season==='spring'?'春 · 谷雨':s.season==='summer'?'夏 · 小暑':s.season==='autumn'?'秋 · 秋分':'冬 · 冬至'} · 根据品质与库存选择销路</p></div>
  <section class="sales-stats"><div><span>持有文</span><strong>${x.wen.toLocaleString()} 文</strong><small>用于招工、买地、升级种子</small></div><div><span>食物本季已售</span><strong>${x.foodSold} / 1000 份</strong><small>市场额度</small></div><div><span>稻米本季已售</span><strong>${x.riceSoldKg/RICE_PER_STONE} / 5 石</strong><small>市场额度</small></div><div><span>可售品质</span><strong>${quality}</strong><small>${quality==='优'?'酒楼可接收':'酒楼要求品质优'}</small></div></section>
  <div class="sales-columns"><section class="sales-card"><h2>选择货品</h2><div class="sales-products">${products.map(([id,v])=>`<button class="sales-product ${id===selected?'active':''}" data-sale-product="${id}"><b>${v.name}</b><span>库存 ${id==='rice'?s.rice+' kg':(s.workshop?.foods?.[id]||0)+' '+v.unit}</span></button>`).join('')}</div><label class="sales-label">出售数量（${unitLabel}）<input id="sale-quantity" type="number" min="1" max="${Math.max(1,maxQuantity)}" value="${quantity}"></label><p class="sales-hint">市场本季剩余：${cap===null?'不限':Math.max(0,cap)+' '+(p?.kind==='rice'?'石':'份')}</p></section>
  <section class="sales-card"><h2>三个销售渠道</h2><div class="sales-channels">${Object.entries(CHANNELS).map(([id,c])=>{const quote=saleQuote(s,id,selected,quantity);const eligible=quote&&!(id==='restaurant'&&quality!=='优')&&!(id==='restaurant'&&p?.kind!=='food');return `<button class="sales-channel ${id===channel?'active':''}" data-sale-channel="${id}" ${!eligible?'disabled':''}><b>${c.name}</b><span>${c.description}</span><strong>${quote?quote.net.toLocaleString()+' 文净得':'不可售'}</strong><small>单价 ${quote?quote.unitPrice:'—'} · 手续费 ${c.fee} 文/${unitLabel}</small></button>`}).join('')}</div><button class="sales-primary" data-sale-submit ${!q||q.quantity<1||q.quantity>maxQuantity?'disabled':''}>出售 ${quantity} ${unitLabel} · 预计净得 ${q?.net||0} 文</button><div class="sales-message" role="status">${esc(message)}</div></section></div>
  <section class="sales-card sales-log"><h2>最近交易</h2>${x.history?.length?`<ol>${x.history.slice(0,5).map(h=>`<li>${CHANNELS[h.channel].name} · ${SALES_PRODUCTS[h.id].name} ×${h.quantity} · 净得 ${h.net} 文</li>`).join('')}</ol>`:'<p>暂无交易，先从食物仓库选择货品。</p>'}</section>`;
  document.querySelectorAll('[data-sale-product]').forEach(b=>b.onclick=()=>{selected=b.dataset.saleProduct;quantity=1;render();});
  document.querySelectorAll('[data-sale-channel]').forEach(b=>b.onclick=()=>{channel=b.dataset.saleChannel;render();});
  document.querySelector('#sale-quantity')?.addEventListener('input',e=>{quantity=Math.max(1,Math.floor(Number(e.target.value)||1));render();});
  document.querySelector('[data-sale-submit]')?.addEventListener('click',()=>{const ok=dispatch({type:'sales:sell',channel,product:selected,quantity});if(!ok)render('交易失败，请检查库存、品质或本季额度。');});
 }
 return {render};
}
