import {awardFragment} from './variety-engine.js';
export const TECHS={
 plow:{name:'曲辕犁',desc:'提高耕作效率，田边出现青铜犁具特效。',wen:90,rice:300},
 compost:{name:'堆肥',desc:'改良土壤，田块出现金色养分光环。',wen:150,rice:450},
 crab:{name:'稻蟹共生',desc:'把生态经验固化为系统科技，水渠出现蟹纹光效。',wen:240,rice:600}
};
export const QUESTS={
 summer:{title:'康熙三十八年 · 水患后的稻种',text:'系统捕捉到历史回声：康熙年间的农官正在寻找耐湿稻种。完成问答后，可带回古代科技卡或稻种碎片。'},
 autumn:{title:'乾隆十六年 · 御稻试种',text:'一页旧档案穿越而来：乾隆年间的御稻试种缺少肥力记录。你要把现代经验交给农官，换取稻种碎片或科技卡。'}
};
export function newStory(){return {introSeen:false,systemLog:['系统连接成功：京西稻贡米系统已绑定。'],tech:{plow:false,compost:false,crab:false},quest:null,questsDone:0,fragments:0,cards:[]};}
export function normalizeStory(s){
 if(s===undefined)return newStory();if(!s||typeof s.introSeen!=='boolean'||!s.tech||Object.keys(TECHS).some(k=>typeof s.tech[k]!=='boolean')||!Array.isArray(s.systemLog)||!Array.isArray(s.cards)||!Number.isSafeInteger(s.fragments)||s.fragments<0||!Number.isSafeInteger(s.questsDone)||s.questsDone<0)return null;
 if(s.quest!==null&&(!s.quest||!QUESTS[s.quest.season]||!['ready','resolved'].includes(s.quest.phase)))return null;return s;
}
export function reduceStory(current,action){
 const s=structuredClone(current);s.story??=newStory();const w=s.story;let error=null;const fail=t=>{error=t;};
 if(action.type==='story:ack'){w.introSeen=true;w.systemLog.unshift('林宇：我会让京西稻重新成为御贡米。');}
 else if(action.type==='story:unlock'){const t=TECHS[action.tech];if(!t)fail('科技不存在。');else if(w.tech[action.tech])fail('该科技已经解锁。');else if((s.sales?.wen||0)<t.wen)fail(`文不足，需要 ${t.wen} 文。`);else if(s.rice<t.rice)fail(`稻米不足，需要 ${t.rice} kg。`);else{s.sales.wen-=t.wen;s.rice-=t.rice;w.tech[action.tech]=true;w.systemLog.unshift(`天工开物：解锁${t.name}。`);}}
 else if(action.type==='story:trigger'){if(w.quest?.phase==='ready')fail('当前已有待完成的穿越任务。');else if(!['summer','autumn'].includes(s.season))fail('只有夏季生长瓶颈或秋季收获前后会出现历史回声。');else{w.quest={season:s.season,phase:'ready',title:QUESTS[s.season].title,text:QUESTS[s.season].text};w.systemLog.unshift(`时空裂隙开启：${w.quest.title}。`);}}
 else if(action.type==='story:resolve'){if(!w.quest||w.quest.phase!=='ready')fail('当前没有待完成的穿越任务。');else if(!['card','fragment'].includes(action.reward))fail('请选择奖励。');else{w.quest.phase='resolved';w.questsDone++;if(action.reward==='card')w.cards.push('御稻古法卡');else w.fragments+=3;w.systemLog.unshift(action.reward==='card'?'带回古代科技卡：御稻古法卡。':'带回稻种碎片 ×3。');s.log.unshift('穿越任务了结，旧纸堆里落下半张描着耕织的图样。');s.log=s.log.slice(0,8);awardFragment(s,'story');}}
 else fail('未知叙事操作。');
 return error?{state:current,error}:{state:s,error:null};
}
