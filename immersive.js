const $=s=>document.querySelector(s);
export function mountImmersive(game){
 document.body.classList.add('immersive');
 const shell=document.createElement('div');shell.id='world-shell';
 shell.innerHTML=`<div id="town-map" hidden><div id="town-art"><img src="./assets/reference/2eb97a6e8f11e8058579213232e025b7.png" alt="上庄镇俯视地图"></div></div><div id="world-status"></div><div id="world-points"></div><div id="world-toolbar"><button data-world="travel">去镇上 →</button><button data-world="variety">御贡图鉴</button><button data-world="system">天工开物</button><button data-world="ending">四时终章</button><button data-world="guide">新手引导</button></div><button id="close-panel" hidden>收起面板 ×</button><div id="world-hint"></div><section id="guide-card" hidden aria-label="新手引导"><small id="guide-step"></small><h2 id="guide-title"></h2><p id="guide-copy"></p><button id="guide-do">开始</button><button id="guide-skip">稍后再看</button></section>`;
 $('#app').append(shell);
 const close=()=>{document.body.classList.remove('panel-open','system-open');$('#close-panel').hidden=true;};
 function open(activity){close();if(activity==='system')document.body.classList.add('system-open');else{game.setActivity(activity);document.body.classList.add('panel-open');}$('#close-panel').hidden=false;}
 function travel(space){close();game.switchSpace(space);}
 $('#close-panel').onclick=close;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 const points={home:[['十亩御田','farm',49,58],['老宅 · 系统','system',23,38]],town:[['老宅 · 回家','home',26,27],['御米作坊','processing',23,69],['集市 · 销售','sales',51,46],['酒楼 · 高端交易','restaurant',76,33],['社交驿站','social',67,76]]};
 let lastSpace;
 function sync(){const s=game.getState();document.body.dataset.space=s.space;$('#town-map').hidden=s.space!=='town';$('#world-status').textContent=`${s.space==='town'?'上庄镇 · 烟火人间':'家 · 四时御田'}　｜　第 ${s.year} 年 · ${{spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[s.season]}　｜　稻米 ${s.rice} kg`;
 $('#world-hint').textContent=s.space==='town'?'拖动地图 · 滚轮缩放 · 点击建筑进入玩法':'拖动环视 · 滚轮缩放 · 点击御田开始种植';
 $('[data-world="travel"]').textContent=s.space==='town'?'← 回家':'去镇上 →';
 if(lastSpace===s.space)return;lastSpace=s.space;
 const target=s.space==='town'?$('#town-art'):$('#world-points');$('#town-art').querySelectorAll('button').forEach(b=>b.remove());$('#world-points').replaceChildren();
 for(const [name,action,x,y] of points[s.space]||points.home){const b=document.createElement('button');b.className='world-point';b.style.left=x+'%';b.style.top=y+'%';b.textContent=name;b.onclick=()=>{if(action==='home')travel('home');else{open(action==='restaurant'?'sales':action);if(action==='restaurant')document.querySelector('[data-channel="restaurant"]')?.click();}};target.append(b);}
 }
 $('#world-toolbar').onclick=e=>{const a=e.target.dataset.world;if(!a)return;if(a==='travel')travel(game.getState().space==='town'?'home':'town');else if(a==='guide'){step=0;showGuide();}else open(a);};
 const observer=new MutationObserver(sync);observer.observe($('#farm-root'),{attributes:true,attributeFilter:['data-state']});
 let scale=1,x=0,y=0,drag=null;const map=$('#town-map'),art=$('#town-art');const transform=()=>art.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
 map.onwheel=e=>{e.preventDefault();scale=Math.max(1,Math.min(2.4,scale-e.deltaY*.001));const r=map.getBoundingClientRect();x=Math.max(-Math.max(0,(art.offsetWidth*scale-r.width)/2),Math.min(Math.max(0,(art.offsetWidth*scale-r.width)/2),x));y=Math.max(-Math.max(0,(art.offsetHeight*scale-r.height)/2),Math.min(Math.max(0,(art.offsetHeight*scale-r.height)/2),y));transform();};
 map.onpointerdown=e=>{if(e.target.closest('button'))return;drag=[e.clientX-x,e.clientY-y];map.setPointerCapture(e.pointerId);};
 map.onpointermove=e=>{if(!drag)return;const r=map.getBoundingClientRect();x=Math.max(-Math.max(0,(art.offsetWidth*scale-r.width)/2),Math.min(Math.max(0,(art.offsetWidth*scale-r.width)/2),e.clientX-drag[0]));y=Math.max(-Math.max(0,(art.offsetHeight*scale-r.height)/2),Math.min(Math.max(0,(art.offsetHeight*scale-r.height)/2),e.clientY-drag[1]));transform();};map.onpointerup=map.onpointercancel=()=>drag=null;
 const steps=[['穿越京西，重启一生','你是程序员林宇，初到清代，获得京西稻贡米系统。先认识自己的十亩御田。','前往御田',()=>{travel('home');open('farm');}],['春播一粒，秋收万颗','点击空地或“确认插秧”播种。每份种子对应一亩，随后按季节巡田、选择水源、应对虫害、收割。','认识上庄镇',()=>travel('town')],['把收获带进烟火人间','镇上点击作坊学习配方并加工，点击集市或酒楼比较收益。加工需要稻米，先完成一次种植收获。','看看作坊',()=>open('processing')],['从这里开始你的故事','收起面板即可回到场景。御贡图鉴记录收藏，天工开物开启科技与穿越任务。随时可重新打开本引导。','开始自由探索',()=>close()]];
 let step=0;function showGuide(){const a=steps[step];$('#guide-card').hidden=false;$('#guide-step').textContent=`初入京西 · ${step+1} / ${steps.length}`;$('#guide-title').textContent=a[0];$('#guide-copy').textContent=a[1];$('#guide-do').textContent=a[2];}
 function finish(){ $('#guide-card').hidden=true;try{localStorage.setItem('jingxi-world-guide-v1','done');}catch{}}
 $('#guide-do').onclick=()=>{steps[step][3]();step++;if(step===steps.length)finish();else showGuide();};$('#guide-skip').onclick=finish;
 close();sync();try{if(!localStorage.getItem('jingxi-world-guide-v1'))showGuide();}catch{showGuide();}
 return {open,close};
}

