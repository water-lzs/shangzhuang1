// 经济参数总表（包 O·经济平衡）。全部数值集中在这一个文件，要调档只改这里。
// 单位约定：1 kg = 2 斤；1 石 = 50 kg = 100 斤。价格基准是“良”级稻米的渠道价（文/斤）。
import {VARIETIES} from './variety-engine.js';
export const ECON={
 yieldBase:50,          // 御稻米亩产基准 kg（原 500，压缩 90%）
 rentPerAcre:20,        // 地租 文/亩/季（原 5，只占毛收 2% 形同虚设，已提到 20）
 toolUpkeep:4,          // 工具维护 文/件/季（件数 = 工具等级 + 1）
 houseUpkeep:20,        // 老宅修缮 文/季
 bribeChance:.3,        // 贪官索贿概率
 bribeRate:.2,          // 索贿扣当季收入比例
 disasterChance:.3,     // 天灾概率
 disasterMin:.3,        // 减产下限
 disasterMax:.5,        // 减产上限
 agedSeasons:3,         // 存放超过几季开始陈化
 agedDiscount:.5,       // 陈化后售价倍率
 lossMax:.30,           // 加工损耗上限（一个配方都没学）
 lossMin:.10,           // 加工损耗下限（配方全学会）
 lossStep:.025,         // 每多学一个配方，损耗降低

 // —— 经营压力（包 P）：留种不再全额返还，体力要省着用，钱成了真正的约束 ——
 seedKeepRate:.6,       // 收获留种比例（按已种亩数），其余要花钱买
 seedPrice:8,           // 集市买种 文/份
 seedCap:99,            // 种子库存上限
 hireCost:20,           // 雇短工 文/次
 hireStamina:40,        // 雇短工恢复体力
 staminaPlant:3,        // 插秧 体力/亩
 staminaInspect:7,      // 巡田 体力/次
 staminaHarvest:8,      // 收割 体力/次
 staminaDetect:5,       // 检测田情 体力/次（每季限一次）
 // 防卡死：一年靠 100 点体力不够用，但也不能让玩家「体力耗尽 + 无钱雇工 +
 // 生态事件挂着」三条同时成立 —— 那样夏季事件三个选项全不可用，而 advance 又被
 // pending 挡住，整局就死在这儿了。两道保险：
 //   ① 每次季节推进给一个体力保底（农闲总能缓过来）
 //   ② 雇短工钱不够时，每季可「邻里换工」一次（不花钱也回体力）—— 这才是真正的逃生口，
 //      因为保底只在 advance 时结算，而卡死状态下恰恰推不动 advance。
 staminaFloor:60,
 barterPerSeason:1,     // 每季可换工次数（不花钱，回 hireStamina 点体力）

 // —— 品质门槛（包 P）：不再是「选玉泉 = 优」，生态值也进公式 ——
 qWaterW:.40,           // 水质权重
 qHealthW:.25,          // 适湿权重
 qPestW:.20,            // 无虫害权重
 qEcoW:.15,             // 生态权重
 maxPixelRatio:2        // 渲染像素比上限（大屏清晰度与性能的折中）
};
export const JIN_PER_KG=2;
export const JIN_PER_STONE=100;
export const QUALITY_ORDER=['劣','良','优','特优'];
export const QUALITY_RATE={'特优':10/3,'优':2,'良':1,'劣':1/3};
// 渠道基准价（文/斤，良级）：市场 3、粮店 2（大宗）、酒楼 5（高端，只收优及以上）
export const RICE_BASE_PRICE={market:3,store:2,restaurant:5};
// 加工增值率：成品售价 = 原料成本 ×(1+PROCESS_MARKUP)
export const PROCESS_MARKUP=.3;
export const YIELD_TABLE=Object.fromEntries(VARIETIES.map(v=>[v.id,v.yield]));
export const ricePricePerStone=(channel,quality,aged)=>{const base=RICE_BASE_PRICE[channel]||3;const rate=QUALITY_RATE[quality]||1;return Math.round(base*rate*(aged?ECON.agedDiscount:1)*JIN_PER_STONE);};
