import {mountImmersive} from './immersive.js';
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
let farmState=null,requestedSeason=null,requestedSpace=null,techEffects=null,techAnim=0,townGroup=null,townRaycaster=new THREE.Raycaster(),townPointer=new THREE.Vector2();
const cropUniforms={farmMask:{value:new Float32Array(10)},farmGrowth:{value:1}};
function syncFarm(state){
 const changed=farmState&&farmState.space!==state.space;farmState=state;document.title='穿越京西稻 · '+(state.activity==='processing'?'御米作坊':state.activity==='sales'?'时空交易行':state.activity==='variety'?'御贡图鉴':SEASONS[state.season].label);const mask=state.activity==='processing'||state.activity==='sales'||state.activity==='variety'?Array(10).fill(true):state.season==='winter'?state.previousPlots:state.harvested?Array(10).fill(false):state.plots;
 if(changed){const el=document.querySelector('#space-transition');el?.classList.add('show');setTimeout(()=>el?.classList.remove('show'),2000);}
 removeTownHotspots();
 cropUniforms.farmMask.value.set(mask.map(Number));cropUniforms.farmGrowth.value=state.season==='summer'?.55+.45*state.growth/3:1;
 if(requestedSeason!==state.season||requestedSpace!==state.space){requestedSeason=state.season;requestedSpace=state.space;changeSeason(state.season);}
 applyTechEffects(state.story?.tech||{});
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
function townLabel(text){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='#4d2b12';x.fillRect(4,4,248,56);x.strokeStyle='#e9c66b';x.strokeRect(4,4,248,56);x.fillStyle='#ffe8a0';x.font='bold 26px serif';x.textAlign='center';x.fillText(text,128,41);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(5,1.25,1);return s;}
function buildTownHotspots(){if(townGroup)scene.remove(townGroup);townGroup=new THREE.Group();townGroup.name='ShangzhuangTownHotspots';const spots=[['老宅','farm',[-12,1,-4],0x8f6a3c],['作坊','processing',[-2,1,-8],0xb67b3e],['市场','sales',[6,1,-5],0xd1a34a],['酒楼','sales',[12,1,1],0x9e4937],['社交驿站','social',[5,1,7],0x6f9c70]];for(const [name,activity,pos,color] of spots){const m=new THREE.Mesh(new THREE.BoxGeometry(3,2,2.5),new THREE.MeshStandardMaterial({color,roughness:.8}));m.position.set(...pos);m.userData.activity=activity;m.castShadow=true;m.add(townLabel(name));m.children[0].position.y=1.7;townGroup.add(m);}scene.add(townGroup);}
function removeTownHotspots(){if(townGroup){scene.remove(townGroup);townGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});townGroup=null;}}
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
function resizeView(){if(!renderer)return;const r=document.querySelector('#viewport').getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(Math.min(1200,Math.round(r.width)),Math.min(900,Math.round(r.width<=1200?r.height:r.height*1200/r.width)),false);diagnostics.renderSize=[renderer.domElement.width,renderer.domElement.height];}

let slowSamples=0,qualityScale=1,lastFrame=0,seasonStarted=0;
const diagnostics={iteration:ALIGN.iteration,renderSize:[ALIGN.width,ALIGN.height],frameTimes:[],renderer:'Three.js WebGL',threeVersion:THREE.REVISION,modelLoaded:false,frames:[],errors:[],season:'spring',triangles:0,drawCalls:0,antialias:false,softShadows:true};
window.addEventListener('error',e=>{diagnostics.errors.push(String(e.message));});
window.addEventListener('unhandledrejection',e=>{diagnostics.errors.push(String(e.reason));});

function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(ALIGN.width,ALIGN.height,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
 renderer.shadowMap.autoUpdate=false;
 diagnostics.antialias=renderer.getContext().getContextAttributes().antialias;
 $('#viewport').appendChild(renderer.domElement);
 renderer.domElement.addEventListener('pointerdown',e=>{if(!townGroup)return;const r=renderer.domElement.getBoundingClientRect();townPointer.x=((e.clientX-r.left)/r.width)*2-1;townPointer.y=-((e.clientY-r.top)/r.height)*2+1;townRaycaster.setFromCamera(townPointer,camera);const hit=townRaycaster.intersectObjects(townGroup.children)[0];if(hit?.object.userData.activity)document.querySelector(`[data-activity="${hit.object.userData.activity}"]`)?.click();});
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(ALIGN.fov,4/3,.1,240);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=200;controls.maxPolarAngle=Math.PI*.55;controls.target.set(0,3,0);
 hemi=new THREE.HemisphereLight(0xe3f2fc,0xb5ad7c,1.35);scene.add(hemi);
 sun=new THREE.DirectionalLight(0xffe5bf,3);sun.castShadow=true;sun.shadow.mapSize.set(ALIGN.shadowSize,ALIGN.shadowSize);
 Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:120});sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;sun.shadow.radius=3;sun.shadow.blurSamples=6;sun.target.position.set(0,0,-3);scene.add(sun,sun.target);
 pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.07);room.dispose();scene.environment=environment.texture;scene.environmentIntensity=.32;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:0xd6d4b7,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.145;ground.receiveShadow=true;ground.name='BackdropGround';scene.add(ground);
 renderer.setAnimationLoop(t=>{
  if(lastFrame&&diagnostics.modelLoaded&&t-seasonStarted>4000){diagnostics.frameTimes.push(t-lastFrame);if(diagnostics.frameTimes.length>3600)diagnostics.frameTimes.shift();}lastFrame=t;controls.update();renderer.render(scene,camera);frameCount++;
  if(t-frameStart>=1000){fps=Math.round(frameCount*1000/(t-frameStart));$('#fps').textContent=fps;diagnostics.frames.push({at:Math.round(t),season:activeSeason,fps});if(diagnostics.frames.length>180)diagnostics.frames.shift();frameStart=t;frameCount=0;if(diagnostics.modelLoaded&&fps<57)slowSamples++;else slowSamples=0;if(false&&slowSamples>=3&&qualityScale>.7){qualityScale=Math.max(.7,qualityScale-.1);renderer.setPixelRatio(Math.min(devicePixelRatio,qualityScale));slowSamples=0;}$('#viewport').dataset.diagnostics=JSON.stringify({...diagnostics,fps,viewport:{width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio()},camera:camera.position.toArray(),target:controls.target.toArray()});}
  diagnostics.triangles=renderer.info.render.triangles;diagnostics.drawCalls=renderer.info.render.calls;
 });
 addEventListener('resize',resizeView);resizeView();
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
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
async function changeSeason(season){
 if(!SEASONS[season])season='spring';const token=++loadToken;activeSeason=season;diagnostics.season=season;diagnostics.modelLoaded=false;diagnostics.frames=[];diagnostics.frameTimes=[];seasonStarted=performance.now();
 document.body.dataset.season=season;document.title=`穿越京西稻 · ${farmState?.activity==='processing'?'御米作坊':farmState?.activity==='sales'?'时空交易行':farmState?.activity==='variety'?'御贡图鉴':SEASONS[season].label}`;
 const url=new URL(location.href);url.searchParams.set('season',season);history.replaceState({},'',url);
 $('#season-number').textContent=SEASONS[season].num;$('#season-note').textContent=SEASONS[season].note;$('#view-description').textContent='京西御田 · '+SEASONS[season].label;
 
 document.querySelectorAll('nav [data-season]').forEach(b=>{b.classList.toggle('active',b.dataset.season===season);b.setAttribute('aria-current',b.dataset.season===season?'page':'false');});
 const c=SEASONS[season];if(scene.background?.dispose)scene.background.dispose();scene.background=skyTexture(c.sky);if(farmState?.space==='town'){try{const townTex=await new THREE.TextureLoader().loadAsync('./assets/shangzhuang.jpg');townTex.colorSpace=THREE.SRGBColorSpace;scene.background=townTex;}catch{}}scene.fog=new THREE.FogExp2(c.fog,c.density);hemi.color.set(c.ambient||'#e4f1f7');hemi.intensity=ALIGN.ambientIntensity;sun.color.setHex(c.sun);sun.intensity=c.power;sun.position.fromArray(c.sunPos);setView(season);
 scene.getObjectByName('BackdropGround').material.color.set(season==='winter'?'#c6d2cc':season==='autumn'?'#c6b07a':'#b4bf99');
 if(activeModel){scene.remove(activeModel);activeModel=null;}
 $('#asset-message').textContent='正在加载 '+c.file+'…';$('#render-mode').textContent='GLB · LOADING';
 try{
  let model=cache.get(season);
  if(!model){
   const match=assets.find(a=>a.name===c.file)||assets.find(a=>a.name.toLowerCase().includes(season));
   if(!match)throw new Error('模型目录中缺少 '+c.file);
   const gltf=await loader.loadAsync('./'+match.path.split('./').map(encodeURIComponent).join('./'));model=gltf.scene;
   model.updateMatrixWorld(true);const basicCache=new Map();const groups=new Map();const originals=[];
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
    if(/Rice_/.test(o.name))cropShader(o.material);
    const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;const group=groups.get(key)||{geometries:[],material:o.material,cast:o.castShadow,receive:o.receiveShadow};group.geometries.push(g);groups.set(key,group);originals.push(o);
   });
   for(const [key,group]of groups){const geom=mergeGeometries(group.geometries,false);if(!geom)throw new Error('静态模型合批失败');const mesh=new THREE.Mesh(geom,group.material);mesh.name='StaticBatch_'+key;mesh.castShadow=group.cast;mesh.receiveShadow=group.receive;model.add(mesh);group.geometries.forEach(g=>g.dispose());}
   originals.forEach(o=>{o.parent.remove(o);o.geometry.dispose();});cache.set(season,model);
  }
  if(token!==loadToken)return;activeModel=model;scene.add(model);renderer.shadowMap.needsUpdate=true;await renderer.compileAsync(scene,camera);
  if(token!==loadToken)return;diagnostics.modelLoaded=true;diagnostics.model=c.file;diagnostics.error=null;
  $('#asset-message').textContent=`${c.file} · 模型已加载 · 四季对齐 · 第 ${ALIGN.iteration-1} 轮`;
  $('#render-mode').textContent='GLB · WebGL';
 }catch(err){if(token!==loadToken)return;errorMessage=String(err.message);diagnostics.error=errorMessage;diagnostics.errors.push(errorMessage);$('#asset-message').textContent=errorMessage;$('#render-mode').textContent='模型待导入';}
}
$('#reset-view').addEventListener('click',()=>{setView(activeSeason);toast('已恢复田野镜头');});
try{init();assets=(await (await fetch('./manifest.json')).json()).files;const game=mountFarm({onChange:syncFarm});mountImmersive(game);resizeView();}catch(err){$('#farm-root').textContent='页面初始化失败：'+err.message;diagnostics.errors.push(String(err));}
