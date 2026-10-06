import {mountImmersive} from './immersive.js';
import {unlock as audioUnlock,setScene as audioScene,sfx as audioSfx,isOn as audioOn,toggle as audioToggle} from './audio.js';
import {mountFarm} from './farm-ui.js';
import * as THREE from 'three';
import {OrbitControls} from './OrbitControls.js';
import {GLTFLoader} from './GLTFLoader.js';
import {RoomEnvironment} from './RoomEnvironment.js';
import {mergeGeometries} from './BufferGeometryUtils.js';

const ALIGN=await (await fetch('./alignment.json',{cache:'no-store'})).json();
const $=s=>document.querySelector(s);
const SEASONS={
 spring:{num:'壹',note:'春生 · 万物有时',label:'谷雨插秧',file:'JingXi_Spring.glb',sky:['#93bdcc','#e6d6cf','#fff4d1'],fog:'#d9e5dc',density:.007,sun:0xffe0b2,power:2.0,sunPos:[-24,15,10],target:[0,3,0],camera:[29,29,42]},
 summer:{num:'贰',note:'夏长 · 稻香渐浓',label:'小暑生长',file:'JingXi_Summer.glb',sky:['#469dd4','#9ddded','#f2f5cc'],fog:'#cee2d8',density:.004,sun:0xfff2d2,power:2.6,sunPos:[-15,35,10],target:[-3,.4,5],camera:[23,25,32]},
 autumn:{num:'叁',note:'秋收 · 满仓金粟',label:'秋分收割',file:'JingXi_Autumn.glb',sky:['#dd9a63','#f1c688','#f8e3b1'],fog:'#e5d0aa',density:.006,sun:0xffd49c,power:2.3,sunPos:[-25,18,12],target:[-2,2.8,-7],camera:[24,23,24]},
 winter:{num:'肆',note:'冬藏 · 静候来年',label:'冬至休耕',file:'JingXi_Winter.glb',sky:['#809dad','#bdcbd1','#e8efeb'],fog:'#cbd9de',density:.012,sun:0xdeebff,power:1.5,sunPos:[-20,25,12],target:[0,2,0],camera:[28,30,42]}
};
for(const [s,c]of Object.entries(SEASONS)){c.file='JingXi_Aligned_'+s[0].toUpperCase()+s.slice(1)+'.glb';Object.assign(c,ALIGN.seasons[s]);}
let renderer,scene,camera,controls,sun,hemi,pmrem,environment;
let activeModel=null,activeSeason='spring',loadToken=0,frameStart=performance.now(),frameCount=0,fps=0,assets=[],errorMessage='';
const cache=new Map();const loader=new GLTFLoader();
let farmState=null,requestedSeason=null,requestedSpace=null,techEffects=null,techAnim=0;
let waterMats=[],riceMats=[],tintMats=[],ecoGroup=null,ecoAnim=0,prevFarm=null;
const cropUniforms={farmMask:{value:new Float32Array(10)},farmGrowth:{value:1}};
function syncFarm(state){
 const changed=farmState&&farmState.space!==state.space;farmState=state;document.title='穿越京西稻 · '+(state.activity==='processing'?'御米作坊':state.activity==='sales'?'时空交易行':state.activity==='variety'?'御贡图鉴':SEASONS[state.season].label);const mask=state.activity==='processing'||state.activity==='sales'||state.activity==='variety'?Array(10).fill(true):state.season==='winter'?state.previousPlots:state.harvested?Array(10).fill(false):state.plots;
 if(changed){const el=document.querySelector('#space-transition');el?.classList.add('show');setTimeout(()=>el?.classList.remove('show'),2000);}
 cropUniforms.farmMask.value.set(mask.map(Number));cropUniforms.farmGrowth.value=state.season==='summer'?.55+.45*state.growth/3:1;
 if(requestedSeason!==state.season||requestedSpace!==state.space){requestedSeason=state.season;requestedSpace=state.space;changeSeason(state.season);}
 applyTechEffects(state.story?.tech||{});
 syncSurface(state);syncAudio(state);
}
// 「隐性感知」：把 engine 里的数值翻译成看得见的画面——水色、稻色、生气、天光。
function syncSurface(state){
 if(!scene)return;
 const w=Math.max(0,Math.min(1,state.water/100)),p=Math.max(0,Math.min(1,state.pests/100)),e=Math.max(0,Math.min(1,state.ecology/100));
 const clear=new THREE.Color(0x8fd0e3),murk=new THREE.Color(0x6d6144);
 for(const m of waterMats)m.color.copy(murk).lerp(clear,w);
 const healthy=new THREE.Color(0xa9c46c),pale=new THREE.Color(0x8b9a72),sick=new THREE.Color(0x9c9756);
 for(const m of riceMats)m.color.copy(healthy).lerp(pale,1-w).lerp(sick,p*.85);
 const gray=1-e,cfg=SEASONS[activeSeason];
 if(scene.fog){scene.fog.color.set(cfg.fog).lerp(new THREE.Color(0x9a9c97),gray*.72);scene.fog.density=cfg.density*(1+gray*.55);}
 if(hemi)hemi.intensity=ALIGN.ambientIntensity*(1-gray*.22);
 if(sun)sun.intensity=cfg.power*(1-gray*.18);
 scene.environmentIntensity=.32*(1-gray*.45);
 for(const m of tintMats){if(!m.userData.baseTint)m.userData.baseTint=m.color.clone();m.color.copy(m.userData.baseTint).lerp(new THREE.Color(0x8f918a),gray*.5);}
 syncCreatures(e);
}
function syncCreatures(e){
 if(!scene)return;
 if(!ecoGroup)buildCreatures();
 const frog=e>=.7,dragon=e>=.4,egret=e>=.7;
 for(const o of ecoGroup.children){const k=o.userData.kind;o.visible=(k==='frog'&&frog)||(k==='dragonfly'&&dragon)||(k==='egret'&&egret);}
}
function buildCreatures(){
 ecoGroup=new THREE.Group();ecoGroup.name='EcoCreatures';
 const frogMat=new THREE.MeshStandardMaterial({color:0x4f7a3b,roughness:.85});
 const wingMat=new THREE.MeshStandardMaterial({color:0xc8b780,roughness:.6,transparent:true,opacity:.8,side:THREE.DoubleSide});
 const birdMat=new THREE.MeshStandardMaterial({color:0xf0f2ea,roughness:.75});
 for(let i=0;i<4;i++){const f=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),frogMat);body.scale.set(1.25,.8,1);f.add(body);f.position.set(-8+i*5.2,.02,-9.4+(i%2)*18.6);f.userData={kind:'frog',baseY:.02,phase:i*1.7};ecoGroup.add(f);}
 for(let i=0;i<6;i++){const d=new THREE.Group();const b=new THREE.Mesh(new THREE.CapsuleGeometry(.02,.22,3,6),wingMat);b.rotation.z=Math.PI/2;const l=new THREE.Mesh(new THREE.PlaneGeometry(.34,.09),wingMat),r=l.clone();l.position.x=-.16;r.position.x=.16;d.add(b,l,r);const bx=-10+i*4,by=.9+((i*37)%10)/14,bz=-8+(i%3)*7;d.position.set(bx,by,bz);d.userData={kind:'dragonfly',baseX:bx,baseY:by,baseZ:bz,phase:i*.9};ecoGroup.add(d);}
 for(let i=0;i<2;i++){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),birdMat);body.scale.set(1.5,.75,.9);const neck=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.42,6),birdMat);neck.position.set(.16,.26,0);const head=new THREE.Mesh(new THREE.SphereGeometry(.07,7,5),birdMat);head.position.set(.2,.48,0);g.add(body,neck,head);const bx=-14+i*11;g.position.set(bx,.2,10.5-i*3);g.userData={kind:'egret',baseX:bx,phase:i*2.2};ecoGroup.add(g);}
 scene.add(ecoGroup);
 const t0=performance.now();
 (function step(){
  const t=performance.now()-t0;
  ecoGroup.children.forEach(o=>{const k=o.userData.kind,ph=o.userData.phase||0;
   if(k==='frog')o.position.y=o.userData.baseY+Math.abs(Math.sin(t*.0016+ph))*.11;
   else if(k==='dragonfly'){o.position.x=o.userData.baseX+Math.sin(t*.0009+ph)*1.7;o.position.z=o.userData.baseZ+Math.sin(t*.0018+ph)*.9;o.position.y=o.userData.baseY+Math.sin(t*.0032+ph)*.14;}
   else o.position.x=o.userData.baseX+Math.sin(t*.00021+ph)*3.2;
  });
  ecoAnim=requestAnimationFrame(step);
 })();
}
// 声音反馈：水质好有流水与鸟鸣，生态差几乎只剩风声。
function syncAudio(state){
 if(!audioOn()){prevFarm=state;return;}
 if(prevFarm){
  if(state.rice>prevFarm.rice)audioSfx('harvest');
  else if(state.stamina<prevFarm.stamina)audioSfx(state.season==='spring'?'plant':'inspect');
  else if(state.season!==prevFarm.season)audioSfx('reward');
 }
 prevFarm=state;audioScene({water:state.water,ecology:state.ecology});
}
function applyTechEffects(tech){
 if(!scene||!renderer)return;if(techAnim){cancelAnimationFrame(techAnim);techAnim=0;}
 if(!techEffects){techEffects=new THREE.Group();techEffects.name='SystemTechEffects';scene.add(techEffects);}
 while(techEffects.children.length){const o=techEffects.children.pop();o.traverse(c=>{c.geometry?.dispose();c.material?.dispose();});}
 const wood=new THREE.MeshStandardMaterial({color:0x6f4d2e,roughness:.85,transparent:true,opacity:0});
 const iron=new THREE.MeshStandardMaterial({color:0x7d766b,roughness:.5,metalness:.35,transparent:true,opacity:0});
 const soil=new THREE.MeshStandardMaterial({color:0x5a4632,roughness:.95,transparent:true,opacity:0});
 const shell=new THREE.MeshStandardMaterial({color:0x8f4534,roughness:.7,transparent:true,opacity:0});
 const glowMat=()=>new THREE.MeshBasicMaterial({color:0xffd98a,transparent:true,opacity:0});
 const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
 if(tech.plow){
  const plow=new THREE.Group(),beam=box(2.3,.13,.13,wood),handle=box(.13,1.05,.13,wood),base=box(.2,.55,.5,wood),share=box(.55,.28,.66,iron);
  beam.position.set(-.2,1.05,0);beam.rotation.z=.16;handle.position.set(.85,.55,0);handle.rotation.z=-.35;base.position.set(-.55,.5,0);share.position.set(-.95,.16,0);share.rotation.z=.55;
  plow.add(beam,handle,base,share);plow.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  plow.position.set(-12,.05,-2);plow.rotation.y=.6;techEffects.add(plow);
 }
 if(tech.compost){
  const g=new THREE.Group(),heap=box(1.7,.24,1.7,soil);heap.position.y=.12;heap.castShadow=true;g.add(heap);
  for(let i=0;i<14;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),glowMat());p.position.set((Math.random()-.5)*1.5,.35+Math.random()*1.3,(Math.random()-.5)*1.5);p.userData={rise:.0035+Math.random()*.004,phase:Math.random()*6.28};g.add(p);}
  g.position.set(7,0,-8);techEffects.add(g);
 }
 if(tech.crab){
  const g=new THREE.Group();
  for(let i=0;i<3;i++){const c=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),shell);body.scale.set(1.5,.6,1);const cl=box(.1,.07,.14,shell),cr=box(.1,.07,.14,shell);cl.position.set(.26,0,.12);cr.position.set(.26,0,-.12);c.add(body,cl,cr);c.traverse(o=>{if(o.isMesh)o.castShadow=true;});c.position.set(-1.1+i*1.1,.09,(i-1)*.55);c.userData={drift:i%2?1:-1,speed:.005+.002*i,baseX:c.position.x};c.rotation.y=c.userData.drift>0?0:Math.PI;g.add(c);}
  g.position.set(0,0,7);techEffects.add(g);
 }
 renderer.shadowMap.needsUpdate=true;
 const t0=performance.now(),statics=[wood,iron,soil,shell];
 (function step(){
  const k=Math.min(1,(performance.now()-t0)/700),now=performance.now();
  statics.forEach(m=>m.opacity=.95*k);
  techEffects.traverse(o=>{
   if(o.isMesh&&o.userData.rise){o.position.y+=o.userData.rise;if(o.position.y>1.85)o.position.y=.3;o.material.opacity=k*(.85-.45*(o.position.y-.3)/1.55)*(.8+.2*Math.sin(now*.004+o.userData.phase));}
   if(o.userData?.drift){o.position.x+=o.userData.drift*o.userData.speed;if(Math.abs(o.position.x-o.userData.baseX)>.7){o.userData.drift*=-1;o.rotation.y=o.userData.drift>0?0:Math.PI;}}
  });
  techAnim=requestAnimationFrame(step);
 })();
}
function cropShader(material){
 if(material.userData.farmCrop)return;material.userData.farmCrop=true;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,cropUniforms);
  shader.vertexShader='varying vec3 vFarmPosition;uniform float farmGrowth;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y *= farmGrowth;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vFarmPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
  shader.fragmentShader='varying vec3 vFarmPosition;uniform float farmMask[10];\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nint fieldColumn=int(clamp(floor((vFarmPosition.x+40.0)/16.0),0.0,4.0));int fieldRow=vFarmPosition.z < -3.0 ? 5 : 0;if(farmMask[fieldColumn+fieldRow]<0.5)discard;');
 };
 material.customProgramCacheKey=()=> 'farm-crop-v1';
}
function resizeView(){
 if(!renderer)return;
 const el=document.querySelector('#viewport');if(!el)return;
 const r=el.getBoundingClientRect();
 // 按容器真实尺寸渲染（不再硬顶 1200×900），并跟随设备像素比，避免大屏发糊。
 // qualityScale 是自适应分辨率系数：帧率吃紧时由渲染循环下调，缓过来再升回去。
 const base=Math.min(ALIGN.maxPixelRatio??2,window.devicePixelRatio||1);
 const dpr=Math.max(ALIGN.minQualityScale??.7,base*qualityScale);
 renderer.setPixelRatio(dpr);
 renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);
 // 关键：相机宽高比取「实际绘制缓冲」的比例，竖屏/平板下才不会与 CSS 尺寸不一致而拉伸。
 const buf=renderer.getDrawingBufferSize(new THREE.Vector2());
 camera.aspect=buf.x/Math.max(1,buf.y);
 camera.updateProjectionMatrix();
 diagnostics.renderSize=[buf.x,buf.y];
}

let slowSamples=0,fastSamples=0,qualityScale=1,lastFrame=0,seasonStarted=0;
const diagnostics={iteration:ALIGN.iteration,renderSize:[ALIGN.width,ALIGN.height],frameTimes:[],renderer:'Three.js WebGL',threeVersion:THREE.REVISION,modelLoaded:false,frames:[],errors:[],season:'spring',triangles:0,drawCalls:0,antialias:false,softShadows:true};
window.addEventListener('error',e=>{diagnostics.errors.push(String(e.message));});
window.addEventListener('unhandledrejection',e=>{diagnostics.errors.push(String(e.reason));});

function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.max(ALIGN.minQualityScale??.7,Math.min(ALIGN.maxPixelRatio??2,window.devicePixelRatio||1)*qualityScale));renderer.setSize(ALIGN.width,ALIGN.height,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
 renderer.shadowMap.autoUpdate=false;
 diagnostics.antialias=renderer.getContext().getContextAttributes().antialias;
 $('#viewport').appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(ALIGN.fov,4/3,.1,240);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=200;controls.maxPolarAngle=Math.PI*.55;controls.target.set(0,3,0);
 hemi=new THREE.HemisphereLight(0xe3f2fc,0xb5ad7c,1.35);scene.add(hemi);
 sun=new THREE.DirectionalLight(0xffe5bf,3);sun.castShadow=true;sun.shadow.mapSize.set(ALIGN.shadowSize,ALIGN.shadowSize);
 Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:120});sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;sun.shadow.radius=3;sun.shadow.blurSamples=6;sun.target.position.set(0,0,-3);scene.add(sun,sun.target);
 pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.07);room.dispose();scene.environment=environment.texture;scene.environmentIntensity=.32;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:0xd6d4b7,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.145;ground.receiveShadow=true;ground.name='BackdropGround';scene.add(ground);
 renderer.setAnimationLoop(t=>{
  if(lastFrame&&diagnostics.modelLoaded&&t-seasonStarted>4000){diagnostics.frameTimes.push(t-lastFrame);if(diagnostics.frameTimes.length>3600)diagnostics.frameTimes.shift();}lastFrame=t;controls.update();renderer.render(scene,camera);frameCount++;
  if(t-frameStart>=1000){fps=Math.round(frameCount*1000/(t-frameStart));$('#fps').textContent=fps;diagnostics.frames.push({at:Math.round(t),season:activeSeason,fps});if(diagnostics.frames.length>180)diagnostics.frames.shift();frameStart=t;frameCount=0;
   // 自适应分辨率：把渲染分辨率当阀门用，而不是把帧率锁死。
   // 低于 40 fps 连续 3 秒 → 降一档（下限 ALIGN.minQualityScale）；高于 55 fps 连续 12 秒 → 升回一档。
   // 两档之间有 15 fps 的回差，避免在阈值上反复抖动把画面弄得忽清忽糊。
   if(diagnostics.modelLoaded){
    if(fps<40){slowSamples++;fastSamples=0;}else if(fps>55){fastSamples++;slowSamples=0;}else{slowSamples=0;fastSamples=0;}
    const floor=ALIGN.minQualityScale??.7;
    if(slowSamples>=3&&qualityScale>floor){qualityScale=Math.max(floor,qualityScale-.1);slowSamples=0;resizeView();}
    else if(fastSamples>=12&&qualityScale<1){qualityScale=Math.min(1,qualityScale+.05);fastSamples=0;resizeView();}
   }
   $('#viewport').dataset.diagnostics=JSON.stringify({...diagnostics,fps,qualityScale:Math.round(qualityScale*100)/100,viewport:{width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio()},camera:camera.position.toArray(),target:controls.target.toArray()});}
  diagnostics.triangles=renderer.info.render.triangles;diagnostics.drawCalls=renderer.info.render.calls;
 });
 addEventListener('resize',resizeView);
 addEventListener('orientationchange',()=>setTimeout(resizeView,120));
 if(window.visualViewport)window.visualViewport.addEventListener('resize',resizeView);
 if(window.ResizeObserver){const ro=new ResizeObserver(resizeView);ro.observe(document.querySelector('#viewport'));}
 resizeView();
 // 首屏布局（100dvh / 移动端地址栏收起等）落定前测量可能拿到瞬时值，再补两拍。
 requestAnimationFrame(()=>resizeView());
 setTimeout(resizeView,300);
}
function skyTexture(colors){
 const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d');
 const g=ctx.createLinearGradient(0,0,0,768);g.addColorStop(0,colors[0]);g.addColorStop(.52,colors[1]);g.addColorStop(1,colors[2]);ctx.fillStyle=g;ctx.fillRect(0,0,1024,768);
 const cfg=SEASONS[activeSeason];let seed=45;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 ctx.globalAlpha=cfg.cloudAlpha??.5;ctx.fillStyle=cfg.cloudColor||'#ffffff';
 for(let i=0;i<22;i++){let x=rnd()*1024,y=120+rnd()*270;for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(x+j*16,y+Math.sin(j)*4,20+rnd()*45,3+rnd()*9,0,0,Math.PI*2);ctx.fill();}}
 ctx.globalAlpha=1;const glow=ctx.createRadialGradient(490,345,0,490,345,190);glow.addColorStop(0,cfg.glow||'#fff3cbaa');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(280,100,450,490);
 const image=ctx.getImageData(0,0,1024,768);for(let i=0;i<image.data.length;i+=4){const v=(rnd()-.5)*(ALIGN.grain??6);image.data[i]+=v;image.data[i+1]+=v;image.data[i+2]+=v;}ctx.putImageData(image,0,0);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function setView(season){const c=SEASONS[season];camera.position.fromArray(c.camera);controls.target.fromArray(c.target);controls.update();}
const SEASON_ORDER=['spring','summer','autumn','winter'];
// 按季懒加载：初始化只解析当前季，其余三季在空闲时按需预取、进入后再解析。
// 四季模型静态合批后几何体常驻显存很可观，因此缓存只保留最近 MAX_CACHED_SEASONS 季，
// 更早的季连同材质贴图一起 dispose，下次进入时重新走网络/HTTP 缓存。
const MAX_CACHED_SEASONS=3;
function modelURL(m){return './'+m.path.split('./').map(encodeURIComponent).join('./');}
const prefetched=new Set();
function prefetchModel(season){
 const conn=navigator.connection;if(conn&&(conn.saveData||/2g|3g/.test(conn.effectiveType||'')))return;
 if(cache.has(season)||prefetched.has(season))return;
 const m=assets.find(a=>a.name===SEASONS[season].file)||assets.find(a=>a.name.toLowerCase().includes(season));
 if(!m)return;
 prefetched.add(season);
 const url=modelURL(m);
 const idle=window.requestIdleCallback||(fn=>setTimeout(fn,1200));
 try{idle(()=>{fetch(url,{cache:'force-cache'}).then(r=>r.blob()).catch(()=>{prefetched.delete(season);});},{timeout:8000});}catch{prefetched.delete(season);}
}
// 当前季加载完后在空闲时把下一季拉进浏览器缓存，切季就不用再等下载。
function schedulePrefetch(season){
 const next=SEASON_ORDER[(SEASON_ORDER.indexOf(season)+1)%SEASON_ORDER.length];
 prefetchModel(next);
}
function disposeSeasonModel(model){
 model.traverse(o=>{
  if(!o.isMesh)return;
  if(o.geometry)o.geometry.dispose();
  for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   if(!m)continue;
   if(m.map&&m.map.dispose)m.map.dispose();
   if(m.normalMap&&m.normalMap.dispose)m.normalMap.dispose();
   if(m.roughnessMap&&m.roughnessMap.dispose)m.roughnessMap.dispose();
   m.dispose();
  }
 });
}
function trimCache(keep){
 if(cache.size<=MAX_CACHED_SEASONS)return;
 for(const s of [...cache.keys()]){
  if(cache.size<=MAX_CACHED_SEASONS)break;
  if(s===keep||s===activeSeason)continue;
  const m=cache.get(s);if(m&&m===activeModel)continue;
  cache.delete(s);prefetched.delete(s);disposeSeasonModel(m);
 }
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
async function changeSeason(season){
 if(!SEASONS[season])season='spring';const token=++loadToken;activeSeason=season;diagnostics.season=season;diagnostics.modelLoaded=false;diagnostics.frames=[];diagnostics.frameTimes=[];seasonStarted=performance.now();
 document.body.dataset.season=season;document.title=`穿越京西稻 · ${farmState?.activity==='processing'?'御米作坊':farmState?.activity==='sales'?'时空交易行':farmState?.activity==='variety'?'御贡图鉴':SEASONS[season].label}`;
 const url=new URL(location.href);url.searchParams.set('season',season);history.replaceState({},'',url);
 $('#season-number').textContent=SEASONS[season].num;$('#season-note').textContent=SEASONS[season].note;$('#view-description').textContent='京西御田 · '+SEASONS[season].label;
 
 document.querySelectorAll('nav [data-season]').forEach(b=>{b.classList.toggle('active',b.dataset.season===season);b.setAttribute('aria-current',b.dataset.season===season?'page':'false');});
 const c=SEASONS[season];if(scene.background?.dispose)scene.background.dispose();scene.background=skyTexture(c.sky);scene.fog=new THREE.FogExp2(c.fog,c.density);hemi.color.set(c.ambient||'#e4f1f7');hemi.intensity=ALIGN.ambientIntensity;sun.color.setHex(c.sun);sun.intensity=c.power;sun.position.fromArray(c.sunPos);setView(season);
 scene.getObjectByName('BackdropGround').material.color.set(season==='winter'?'#c6d2cc':season==='autumn'?'#c6b07a':'#b4bf99');
 if(activeModel){scene.remove(activeModel);activeModel=null;}
 $('#asset-message').textContent='正在加载 '+c.file+'…';$('#render-mode').textContent='GLB · LOADING';
 try{
  let model=cache.get(season);
  if(!model){
   const match=assets.find(a=>a.name===c.file)||assets.find(a=>a.name.toLowerCase().includes(season));
   if(!match)throw new Error('模型目录中缺少 '+c.file);
   const gltf=await new Promise((resolve,reject)=>loader.load(modelURL(match),resolve,ev=>{
     if(ev&&ev.total){const pct=Math.round(ev.loaded/ev.total*100);$('#asset-message').textContent=`正在加载 ${c.file}… ${pct}%（${(ev.loaded/1048576).toFixed(1)} / ${(ev.total/1048576).toFixed(1)} MB）`;}
     else if(ev&&ev.loaded)$('#asset-message').textContent=`正在加载 ${c.file}… ${(ev.loaded/1048576).toFixed(1)} MB`;
    },reject));model=gltf.scene;
   model.updateMatrixWorld(true);const basicCache=new Map();const groups=new Map();const originals=[];
   waterMats=[];riceMats=[];tintMats=[];
   model.traverse(o=>{
    if(!o.isMesh)return;o.castShadow=!/Water|System|Rice_|Mountain/.test(o.name);o.receiveShadow=!/System|Mountain|Rice_/.test(o.name);
    if(/TreeCrowns/.test(o.name)){o.position.y-=1.4;o.scale.y=1.3;o.updateMatrixWorld(true);}
 if(!Array.isArray(o.material)&&!/Village/i.test(o.name)){
 const old=o.material;const key=old.uuid;if(!basicCache.has(key))basicCache.set(key,new THREE.MeshBasicMaterial({map:old.map,color:old.color,side:THREE.DoubleSide}));o.material=basicCache.get(key);
}
o.castShadow=/Village|TreeTrunks/.test(o.name);o.receiveShadow=/FieldEarth|Village/.test(o.name);
const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){m.side=THREE.DoubleSide;if(m.isMeshBasicMaterial){const tint=ALIGN.seasons[season].tint||'#ffffff';m.color.set(tint);}m.forceSinglePass=true;if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(/water/i.test(m.name)){m.roughness=.10;m.envMapIntensity=1.25;m.depthWrite=false;} }
    if(Array.isArray(o.material))return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);for(const attr of Object.keys(g.attributes))if(!['position','normal','uv'].includes(attr))g.deleteAttribute(attr);
    if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const selMats=Array.isArray(o.material)?o.material:[o.material];
    if(/Rice_/.test(o.name)){cropShader(o.material);selMats.forEach(m=>{if(!riceMats.includes(m))riceMats.push(m);});}
    if(/water/i.test(o.name))selMats.forEach(m=>{if(!waterMats.includes(m))waterMats.push(m);});
    else if(/FieldEarth|Village|Ground|Field/i.test(o.name))selMats.forEach(m=>{if(!waterMats.includes(m)&&!riceMats.includes(m)&&!tintMats.includes(m))tintMats.push(m);});
    const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;const group=groups.get(key)||{geometries:[],material:o.material,cast:o.castShadow,receive:o.receiveShadow};group.geometries.push(g);groups.set(key,group);originals.push(o);
   });
   for(const [key,group]of groups){const geom=mergeGeometries(group.geometries,false);if(!geom)throw new Error('静态模型合批失败');const mesh=new THREE.Mesh(geom,group.material);mesh.name='StaticBatch_'+key;mesh.castShadow=group.cast;mesh.receiveShadow=group.receive;model.add(mesh);group.geometries.forEach(g=>g.dispose());}
   originals.forEach(o=>{o.parent.remove(o);o.geometry.dispose();});cache.set(season,model);trimCache(season);
  }
  if(token!==loadToken)return;activeModel=model;scene.add(model);renderer.shadowMap.needsUpdate=true;await renderer.compileAsync(scene,camera);
  if(farmState)syncSurface(farmState);
  if(token!==loadToken)return;diagnostics.modelLoaded=true;diagnostics.model=c.file;diagnostics.error=null;
  $('#asset-message').textContent=`${c.file} · 模型已加载 · 四季对齐 · 第 ${ALIGN.iteration-1} 轮`;
  $('#render-mode').textContent='GLB · WebGL';
  schedulePrefetch(season);
 }catch(err){if(token!==loadToken)return;errorMessage=String(err.message);diagnostics.error=errorMessage;diagnostics.errors.push(errorMessage);$('#asset-message').textContent=errorMessage;$('#render-mode').textContent='模型待导入';}
}
$('#reset-view').addEventListener('click',()=>{setView(activeSeason);toast('已恢复田野镜头');});
document.addEventListener('pointerdown',()=>{audioUnlock();if(farmState)audioScene({water:farmState.water,ecology:farmState.ecology});},{once:true});
window.jingxiAudio={toggle:()=>{const on=audioToggle();toast(on?'音效已开启':'音效已关闭');return on;}};
try{init();assets=(await (await fetch('./manifest.json')).json()).files;const game=mountFarm({onChange:syncFarm});mountImmersive(game);resizeView();}catch(err){$('#farm-root').textContent='页面初始化失败：'+err.message;diagnostics.errors.push(String(err));}
