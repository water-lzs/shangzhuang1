import {TECHS} from './story-engine.js';
export function createStory({getState,dispatch}){
 function render(message=''){
  const s=getState(),w=s.story||{},tech=w.tech||{};const intro=!w.introSeen;const quest=w.quest;
  const hint=(s.space==='home'&&(s.sales?.wen||0)>0)?'主子，钱袋鼓了，老宅也该翻修了。':s.season==='spring'?'主子，本季该种稻了。':s.season==='summer'?'主子，稻苗正在长，别忘了巡田。':s.season==='autumn'?'主子，稻穗压弯了腰，该收割并加工了。':'主子，土地要休养，来年再战。';
  document.querySelector('#system-panel').innerHTML=`<div class="system-title"><span>穿越系统</span><b>京西稻贡米系统</b></div><p class="system-tip">${hint}</p>${intro?`<div class="story-intro"><b>绑定成功</b><p>现代程序员林宇穿越回清代，绑定“京西稻贡米系统”。从今天起，用现代知识复兴皇家御稻。</p><button data-story="ack">接受使命</button></div>`:''}<details class="tech-tree" open><summary>天工开物科技树</summary><p>消耗文与稻米，把现代技术变成场景中的光效与器具。</p><div class="tech-list">${Object.entries(TECHS).map(([id,t])=>`<button data-tech="${id}" ${tech[id]?'disabled':''}><b>${t.name}</b><span>${tech[id]?'已解锁':`${t.wen} 文 · ${t.rice} kg 稻米`}</span></button>`).join('')}</div></details>${(['summer','autumn'].includes(s.season)&&!quest)?`<button class="quest-trigger" data-story="trigger">触发历史穿越任务</button>`:''}${quest?`<div class="quest-card"><b>${quest.title}</b><p>${quest.text}</p>${quest.phase==='ready'?`<button data-reward="card">带回古代科技卡</button><button data-reward="fragment">带回稻种碎片 ×3</button>`:'<span>任务已完成</span>'}</div>`:''}<small class="system-log">${(w.systemLog||[]).slice(0,2).join(' · ')}</small><div class="system-message" role="status">${message}</div>`;
  document.querySelector('[data-story="ack"]')?.addEventListener('click',()=>{dispatch({type:'story:ack'});});
  document.querySelector('[data-story="trigger"]')?.addEventListener('click',()=>{dispatch({type:'story:trigger'});});
  document.querySelectorAll('[data-tech]').forEach(b=>b.addEventListener('click',()=>dispatch({type:'story:unlock',tech:b.dataset.tech})));
  document.querySelectorAll('[data-reward]').forEach(b=>b.addEventListener('click',()=>dispatch({type:'story:resolve',reward:b.dataset.reward})));
 }
 return {render};
}
