import {awardFragment} from './variety-engine.js';
import {nextRandom} from './rng.js';
export function newSocial(){return {poster:null,adoptions:[],waterBonus:0,shipments:0};}
export function normalizeSocial(s){if(s===undefined)return newSocial();if(!s||!Array.isArray(s.adoptions)||s.adoptions.some(a=>!a||typeof a.friend!=='string'||typeof a.variety!=='string'||!Number.isSafeInteger(a.m2)||a.m2!==1)||!Number.isSafeInteger(s.waterBonus)||s.waterBonus<0||!Number.isSafeInteger(s.shipments)||s.shipments<0)return null;return s;}
export function reduceSocial(current,action){const s=structuredClone(current);s.social??=newSocial();const x=s.social;let error=null;const fail=t=>error=t;
 if(action.type==='social:poster'){x.poster={season:s.season,code:`JX-${s.year}-${Math.random().toString(36).slice(2,8).toUpperCase()}`};s.log.unshift(`时空求助海报已生成：${x.poster.code}。`);}
 else if(action.type==='social:adopt'){if(!action.friend||!action.variety)fail('请填写好友昵称和认养品种。');else if(x.adoptions.some(a=>a.friend===action.friend))fail('该好友已经认养过一平米。');else{x.adoptions.push({friend:String(action.friend).slice(0,20),variety:String(action.variety),m2:1,watered:0});s.log.unshift(`${action.friend} 认养 1 平米${action.variety}稻田。`);if(nextRandom(s)<.5)awardFragment(s,'social');}}
 else if(action.type==='social:water'){const a=x.adoptions.find(a=>a.friend===action.friend);if(!a)fail('找不到这位认养好友。');else{a.watered++;x.waterBonus++;s.log.unshift(`好友浇水：现代水源加成 +1（累计 ${x.waterBonus}）。`);}}
 else if(action.type==='social:ship'){if(!s.harvested)fail('秋收后才能寄出真实京西稻米。');else{x.shipments++;s.log.unshift(`已向认养好友寄出第 ${x.shipments} 份京西稻米。`);if(nextRandom(s)<.5)awardFragment(s,'social');}}
 else fail('未知社交操作。');return error?{state:current,error}:{state:s,error:null};}
