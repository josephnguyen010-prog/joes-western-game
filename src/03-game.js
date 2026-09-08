
/* ============================================================
   13. game state, player, input
   ============================================================ */
hitables.push(ground);

var GAME={state:'title',paused:false,kills:0,left:0,wave:0,shots:0,hits:0,t:0,hp:100,nextWaveT:0};
var WAVES=[5,4,4];
var P={x:-34,z:0,y:0,vy:0,yaw:-Math.PI/2,pitch:-0.02,onGround:true,ammo:6,
       reloading:false,reloadT:0,reloadFrom:6,nextRound:0,recoil:0,bob:0,sway:0,swayY:0,
       inCar:false,moving:0,hurtT:0,fireHeld:false,cockT:0,
       weapon:'colt',hasRifle:false,rifleAmmo:0,rifleWork:0,rifleClicked:false,
       ads:false,adsHold:false};
var EYE=1.66;

var ui={
  hud:$('hud'),left:$('left'),wave:$('wave'),objtxt:$('objtxt'),clock:$('clock'),
  tally:$('tally'),bars:$('bars'),state:$('state'),ammoN:$('ammoN'),cyl:$('cyl'),
  feed:$('feed'),prompt:$('prompt'),cross:$('cross'),mark:$('mark'),hurt:$('hurt'),strip:$('strip'),
  cal:$('cal'),scope:$('scope'),pause:$('pause')
};
(function initHud(){
  var i,b;
  for(i=0;i<10;i++){ b=document.createElement('b'); ui.bars.appendChild(b); }
  for(i=0;i<6;i++){
    var u=document.createElement('u'), a=i/6*TAU-Math.PI/2;
    u.style.transform='translate('+(Math.cos(a)*29).toFixed(1)+'px,'+(Math.sin(a)*29).toFixed(1)+'px)';
    ui.cyl.appendChild(u);
  }
  var CARD=['N','NE','E','SE','S','SW','W','NW'];
  for(i=0;i<24;i++){
    var s=document.createElement('span'), deg=i*15;
    if(deg%45===0){ s.textContent=CARD[deg/45]; s.className='card'; }
    else s.textContent='|';
    s.dataset.deg=deg; ui.strip.appendChild(s);
  }
})();
var barEls=ui.bars.children, cylEls=ui.cyl.children, stripEls=ui.strip.children;

function feed(html){
  var d=document.createElement('div'); d.innerHTML=html; ui.feed.appendChild(d);
  setTimeout(function(){ if(d.parentNode)d.parentNode.removeChild(d); },3400);
  while(ui.feed.children.length>4) ui.feed.removeChild(ui.feed.firstChild);
}
var stateMsgT=0, lastStateTxt=null;
function say(msg,dur){ ui.state.textContent=msg; stateMsgT=dur||2.2; lastStateTxt=null; }

/* --- input --- */
var keys={},mouseDX=0,mouseDY=0;
var curX=window.innerWidth/2, curY=window.innerHeight/2;
var cursorAim=false, lockFails=0, lastLockTry=0, dragging=false;
window.addEventListener('keydown',function(e){
  keys[e.code]=true;
  if(GAME.state==='over'&&(e.code==='Enter'||e.code==='Space'||e.code==='KeyR')){ e.preventDefault(); beginRun(); return; }
  if(e.code==='Escape'&&GAME.state==='play'){ e.preventDefault(); if(GAME.paused) closePause(); else openPause(); return; }
  if(e.code==='KeyR') startReload();
  if(e.code==='KeyF') toggleCar();
  if(e.code==='Digit1') setWeapon('colt');
  if(e.code==='Digit2') setWeapon('rifle');
  if(e.code==='KeyZ'){ P.adsHold=!P.adsHold; AU.click(0.13); }   // sticky aim, if you prefer it
  if(e.code==='Space'&&GAME.state==='play') e.preventDefault();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code)>=0) e.preventDefault();
});
window.addEventListener('keyup',function(e){ keys[e.code]=false; });
window.addEventListener('blur',function(){ keys={}; });
document.addEventListener('mousemove',function(e){
  if(document.pointerLockElement===canvas){ mouseDX+=e.movementX||0; mouseDY+=e.movementY||0; }
  else {
    if(dragging){ mouseDX+=e.movementX||0; mouseDY+=e.movementY||0; }
    curX=e.clientX; curY=e.clientY;
  }
});
document.addEventListener('mousedown',function(e){
  if(GAME.state!=='play'||GAME.paused)return;
  // Right holds the sights up. Under cursor aim it also steers the view
  // directly, which is the same thing your hand is already doing.
  if(e.button===2){ P.ads=true; dragging=true; e.preventDefault(); return; }
  if(e.button!==0)return;
  P.fireHeld=true; fire();
});
document.addEventListener('mouseup',function(e){
  if(e.button===0) P.fireHeld=false;
  if(e.button===2){ P.ads=false; dragging=false; }
});
window.addEventListener('blur',function(){ dragging=false; P.fireHeld=false; P.ads=false; });
document.addEventListener('contextmenu',function(e){ if(GAME.state==='play') e.preventDefault(); });

// Two aiming modes. Pointer lock is the good one: the system cursor vanishes and
// the crosshair sits dead centre. Where the browser refuses it - an iframe without
// the pointer-lock permission, or Chrome throttling a re-lock straight after Esc -
// we fall to cursor aim: the crosshair rides the real mouse and the shot is cast
// through that exact pixel, so the two can never disagree.
function setCursorAim(on){
  if(cursorAim===on)return;
  cursorAim=on;
  document.body.classList.toggle('cursoraim',on);
  if(on){
    GAME.paused=false;
    say('cursor aiming - the crosshair follows your mouse, push to an edge to turn',6);
  }else{
    ui.cross.style.left='50%'; ui.cross.style.top='50%';
    ui.mark.style.left='50%';  ui.mark.style.top='50%';
    say('mouse captured',1.6);
  }
}
function lock(){
  GAME.paused=false;
  if(!canvas.requestPointerLock){ setCursorAim(true); return; }
  if(lockFails>=3){ setCursorAim(true); return; }
  var now=performance.now();
  if(now-lastLockTry<1100) return;
  lastLockTry=now;
  var p;
  try{ p=canvas.requestPointerLock(); }catch(err){ lockFails++; setCursorAim(true); return; }
  if(p&&p.catch) p.catch(function(){ lockFails++; setCursorAim(true); });
  setTimeout(function(){
    if(GAME.state==='play'&&document.pointerLockElement!==canvas){ lockFails++; setCursorAim(true); }
  },900);
}
document.addEventListener('pointerlockerror',function(){ lockFails++; setCursorAim(true); });
document.addEventListener('pointerlockchange',function(){
  if(document.pointerLockElement===canvas){
    lockFails=0; GAME.paused=false; setCursorAim(false);
    if(stateMsgT>90){ ui.state.textContent=''; stateMsgT=0; }
  }else if(GAME.state==='play'&&!cursorAim){
    openPause();                       // the mouse got away, so put the menu up
  }
});

/* ============================================================
   14. shooting
   ============================================================ */
var ray=new THREE.Raycaster();
var _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_q=new THREE.Quaternion();
var _ndc=new THREE.Vector2(), _v4=new THREE.Vector3();
function activeCam(){ return camera; }   // the wagon is driven from the seat, not from behind
function aimNDC(){
  if(cursorAim&&!adsOn()) return _ndc.set((curX/window.innerWidth)*2-1,-(curY/window.innerHeight)*2+1);
  return _ndc.set(0,0);
}

function openPause(){
  if(GAME.state!=='play'||GAME.paused)return;
  GAME.paused=true;
  P.fireHeld=false; dragging=false; P.ads=false;
  if(document.exitPointerLock) document.exitPointerLock();
  document.body.classList.remove('playing');          // the cursor comes back
  var left=GAME.left, cut=GAME.kills;
  $('pauseStat').textContent=
    (cut?('You have cut '+cut+' notch'+(cut===1?'':'es')+'. '):'No notches cut yet. ')+
    (left===1?'One outlaw still afoot.':left+' outlaws still afoot.');
  ui.pause.classList.remove('gone');
  setTimeout(function(){ try{ $('resume').focus(); }catch(err){} },60);
}
function closePause(){
  if(!GAME.paused)return;
  ui.pause.classList.add('gone');
  $('fullKeys').hidden=true;
  document.body.classList.add('playing');
  GAME.paused=false;
  lock();
}
function clearEnemies(){
  for(var i=enemies.length-1;i>=0;i--){
    var e=enemies[i];
    world.remove(e.g);
    var a=hitables.indexOf(e.torso); if(a>=0)hitables.splice(a,1);
    a=hitables.indexOf(e.head); if(a>=0)hitables.splice(a,1);
  }
  enemies.length=0;
}
function toTitle(){
  GAME.state='title'; GAME.paused=false;
  dropAds();
  if(document.exitPointerLock) document.exitPointerLock();
  document.body.classList.remove('playing');
  ui.hud.classList.remove('live');
  ui.pause.classList.add('gone');
  $('over').classList.add('gone');
  $('title').classList.remove('gone');
  $('fullKeys').hidden=true;
  clearEnemies();
  P.inCar=false; car.occupied=false; car.speed=0;
  P.fireHeld=false; dragging=false;
  ui.feed.innerHTML=''; ui.state.textContent=''; stateMsgT=0; lastStateTxt=null;
  titleT=0;
  setTimeout(function(){ try{ $('start').focus(); }catch(err){} },60);
}

function setWeapon(w){
  if(GAME.state!=='play')return;
  if(w==='rifle'&&!P.hasRifle){ say('you have no rifle',1.6); return; }
  if(P.weapon===w)return;
  P.adsHold=false;
  P.weapon=w; P.reloading=false; P.rifleWork=0.45;
  AU.click(0.20);
  say(w==='colt'?'Colt in hand':'Springfield in hand',1.4);
}
function adsOn(){ return (P.ads||P.adsHold)&&GAME.state==='play'&&!GAME.paused; }
function dropAds(){ P.ads=false; P.adsHold=false; camera.fov=74; camera.updateProjectionMatrix(); }
/* The sights come up over about a tenth of a second, and the view narrows
   with them - iron sights, so no scope picture, you just look down the barrel. */
function aimStep(dt){
  var on=adsOn();
  var want=on?(P.weapon==='rifle'?30:54):74;
  if(Math.abs(camera.fov-want)>0.04){
    camera.fov=damp(camera.fov,want,16,dt);
    camera.updateProjectionMatrix();
  }
  ui.scope.classList.toggle('on',on&&P.weapon==='rifle');
  ui.cross.style.visibility=on?'hidden':'';
}

/* one hitscan, shared by both guns */
function castShot(spread,bodyDmg,headDmg,far){
  var cam=activeCam();
  ray.setFromCamera(aimNDC(),cam);
  _v.copy(ray.ray.direction);
  var origin=_v2.copy(cam.position).addScaledVector(_v,0.4).clone();
  _v.x+=rr(-spread,spread); _v.y+=rr(-spread,spread); _v.z+=rr(-spread,spread); _v.normalize();
  _v3.set(1,0,0).applyQuaternion(cam.getWorldQuaternion(_q));
  ray.set(origin,_v); ray.far=far;
  var hits=ray.intersectObjects(hitables,false);
  var end=origin.clone().addScaledVector(_v,far);
  if(hits.length){
    var h=hits[0]; end.copy(h.point);
    var ud=h.object.userData;
    if(ud&&ud.owner&&!ud.owner.dead){
      var e=ud.owner; GAME.hits++;
      e.hp-=(ud.part==='head')?headDmg:bodyDmg; e.hitT=0.18;
      FX.puff(h.point,3,0x7a2b1e,0.13,0.9,0.5);
      ui.mark.classList.remove('hit'); void ui.mark.offsetWidth; ui.mark.classList.add('hit');
      if(e.hp<=0) killOutlaw(e,'shot'); else AU.ric();
    }else{
      var n=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):new THREE.Vector3(0,1,0);
      FX.impact(h.point,n);
      FX.puff(h.point,2,0xB79468,0.10,0.7,0.6);
      if(rnd()<0.45) AU.ric();
    }
  }
  var mz=origin.clone().addScaledVector(_v3,0.12).add(new THREE.Vector3(0,-0.06,0));
  FX.tracer(mz,end);
  worldFlash.position.copy(mz);
  for(var i=0;i<enemies.length;i++){ if(!enemies[i].dead) enemies[i].alerted=true; }
  for(var k=0;k<folk.length;k++){                       // everyone within earshot gets down
    var fp=folk[k].g.getWorldPosition(_v4);
    if(Math.abs(fp.x-P.x)<22&&Math.abs(fp.z-P.z)<22) folk[k].scare=2.4;
  }
  return origin;
}

function fire(){
  if(GAME.state!=='play'||GAME.paused)return;
  if(P.weapon==='rifle'){
    if(P.rifleWork>0)return;
    if(P.rifleAmmo<=0){ AU.click(0.30); say('out of cartridges',2); return; }
    P.rifleAmmo--; GAME.shots++;
    P.recoil=Math.min(2.4,P.recoil+2.0);
    AU.rifle(0);
    rflash.m.opacity=1; rflash.g.rotation.z=rr(0,TAU);
    muzzleLight.intensity=5.5; worldFlash.intensity=4.4;
    P.rifleWork=1.55; P.rifleClicked=false;
    castShot(adsOn()?0.0010:0.013+P.moving*0.020,150,300,300);
    return;
  }
  if(P.reloading)return;
  if(P.ammo<=0){ AU.click(0.32); say('cylinder empty - press R',2); return; }
  P.ammo--; GAME.shots++;
  P.recoil=Math.min(1.6,P.recoil+1.0);
  AU.shot(0);
  flash.m.opacity=1; flash.g.rotation.z=rr(0,TAU); flash.g.scale.setScalar(rr(0.8,1.25));
  muzzleLight.intensity=4.5; worldFlash.intensity=3.4;
  cylGroup.rotation.z-=TAU/6;
  var org=castShot((adsOn()?0.0016:0.0042)+P.moving*0.010+P.recoil*0.012+(P.inCar?0.012:0),58,140,220);
  FX.eject(org.addScaledVector(_v3,0.22).add(new THREE.Vector3(0,-0.12,0)),_v3,new THREE.Vector3(0,1,0));
}

function startReload(){
  if(GAME.state!=='play'||P.weapon!=='colt'||P.reloading||P.ammo>=6)return;
  P.reloading=true; P.reloadT=0; P.reloadFrom=P.ammo; P.nextRound=0.34;
  AU.click(0.24);
  say('loading '+(6-P.ammo)+' rounds',1.6);
}
function reloadStep(dt){
  if(!P.reloading)return;
  P.reloadT+=dt;
  var need=6-P.reloadFrom, total=0.34+need*0.26+0.42;
  if(P.reloadT>=P.nextRound&&P.ammo<6&&P.reloadT<0.34+need*0.26){
    P.ammo++; P.nextRound+=0.26; AU.clink();
    if(ui.cyl.classList){ ui.cyl.classList.remove('spin'); void ui.cyl.offsetWidth; ui.cyl.classList.add('spin'); }
  }
  if(P.reloadT>=total){ P.reloading=false; P.ammo=6; AU.click(0.3); }
}

/* ============================================================
   15. collision and the player
   ============================================================ */
function collide(px,pz,r,feet){
  if(feet===undefined) feet=-999;
  if(inPortal(px,pz)){                       // a doorway is never blocked
    var pd=Math.sqrt(px*px+pz*pz), pl=WORLD_R-r;
    if(pd>pl){ var pk=pl/pd; px*=pk; pz*=pk; }
    return [px,pz];
  }
  for(var i=0;i<blockers.length;i++){
    var b=blockers[i];
    if(b.top<feet+0.15) continue;            // you are standing above it
    if(px>b.x0-r&&px<b.x1+r&&pz>b.z0-r&&pz<b.z1+r){
      var d1=(b.x1+r)-px, d0=px-(b.x0-r), d3=(b.z1+r)-pz, d2=pz-(b.z0-r);
      var m=Math.min(d1,d0,d3,d2);
      if(m===d1)px=b.x1+r; else if(m===d0)px=b.x0-r; else if(m===d3)pz=b.z1+r; else pz=b.z0-r;
    }
  }
  var dd=Math.sqrt(px*px+pz*pz), lim=WORLD_R-r;   // the cliffs are the end of it
  if(dd>lim){ var k=lim/dd; px*=k; pz*=k; }
  return [px,pz];
}

function updatePlayer(dt){
  // look
  var sens=0.0021*(camera.fov/74);
  P.yaw-=mouseDX*sens; P.pitch-=mouseDY*sens;
  P.sway=damp(P.sway,clamp(-mouseDX*0.02,-1,1),9,dt);
  P.swayY=damp(P.swayY,clamp(-mouseDY*0.02,-1,1),9,dt);
  mouseDX=0; mouseDY=0;
  if(cursorAim&&!dragging){
    // a small dead zone in the middle for aiming, then it turns hard
    var nx=clamp((curX/window.innerWidth)*2-1,-1,1);
    var ny=clamp((curY/window.innerHeight)*2-1,-1,1);
    var dz=0.18;
    var ex=Math.abs(nx)>dz?(nx-(nx<0?-dz:dz))/(1-dz):0;
    var ey=Math.abs(ny)>dz?(ny-(ny<0?-dz:dz))/(1-dz):0;
    var sc=camera.fov/74;
    P.yaw-=(ex<0?-1:1)*ex*ex*5.0*sc*dt;
    P.pitch-=(ey<0?-1:1)*ey*ey*2.6*sc*dt;
  }
  var kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0)+(keys.KeyE?1:0)-(keys.KeyQ?1:0);
  var ky=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0);
  P.yaw-=kx*3.0*dt; P.pitch-=ky*1.6*dt;
  P.pitch=clamp(P.pitch,-1.35,1.35);

  if(P.inCar) return;

  var fx=-Math.sin(P.yaw), fz=-Math.cos(P.yaw);
  var rx= Math.cos(P.yaw), rz=-Math.sin(P.yaw);
  var ix=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  var iz=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  var len=Math.hypot(ix,iz)||1;
  var run=keys.ShiftLeft||keys.ShiftRight;
  var spd=(run?6.4:3.5)*(P.reloading?0.75:1);
  var vx=(fx*iz+rx*ix)/len*spd, vz=(fz*iz+rz*ix)/len*spd;
  P.moving=damp(P.moving,Math.hypot(ix,iz)?(run?1:0.55):0,10,dt);

  var nx=P.x+vx*dt, nz=P.z+vz*dt;
  var c=collide(nx,nz,0.45,P.y); P.x=c[0]; P.z=c[1];
  if(Math.sqrt(P.x*P.x+P.z*P.z)>WORLD_R-0.6&&stateMsgT<=0) say('the wash ends at the cliffs',2);

  var gy=floorAt(P.x,P.z,P.y);
  if(P.onGround&&keys.Space){ P.vy=5.1; P.onGround=false; }
  P.vy-=17*dt; P.y+=P.vy*dt;
  if(P.y<=gy){ P.y=gy; P.vy=0; P.onGround=true; }

  if(riflePickup&&!riflePickup.taken){
    riflePickup.t+=dt;
    riflePickup.g.rotation.y+=dt*0.5;
    riflePickup.g.position.y=riflePickup.y+0.10+Math.sin(riflePickup.t*1.8)*0.05;
    if(Math.hypot(P.x-riflePickup.x,P.z-riflePickup.z)<2.0&&Math.abs(P.y-riflePickup.y)<1.8){
      riflePickup.taken=true; world.remove(riflePickup.g);
      P.hasRifle=true; P.rifleAmmo=9; P.weapon='rifle'; P.rifleWork=0.9; P.reloading=false;
      feed('you have the <em>Springfield</em>');
      say('1 Colt, 2 rifle, hold right mouse to aim',6);
    }
  }
  if(P.moving>0.1&&P.onGround) P.bob+=dt*(run?13:8.4);
  var bobY=Math.sin(P.bob)*0.045*P.moving, bobX=Math.cos(P.bob*0.5)*0.03*P.moving;

  camera.position.set(P.x+bobX*0.2,P.y+EYE+bobY,P.z);
  camera.rotation.set(P.pitch,P.yaw,Math.sin(P.bob*0.5)*0.012*P.moving,'YXZ');
}

/* --- the viewmodel --- */
function updateGun(dt){
  P.recoil=damp(P.recoil,0,11,dt);
  flash.m.opacity=Math.max(0,flash.m.opacity-dt*14);
  muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*40);
  worldFlash.intensity=Math.max(0,worldFlash.intensity-dt*30);
  cylGroup.rotation.z=damp(cylGroup.rotation.z,Math.round(cylGroup.rotation.z/(TAU/6))*(TAU/6),14,dt);
  hammer.rotation.x=damp(hammer.rotation.x,(P.ammo>0?0.42:0.06)+P.recoil*0.45,13,dt);

  var aim=adsOn(), aimBob=aim?0.35:1;
  var bobY=Math.sin(P.bob)*0.012*P.moving*aimBob, bobX=Math.cos(P.bob*0.5)*0.010*P.moving*aimBob;
  // hip pose, or up on the sights: barrel centred, rear notch on the front blade
  var tx=(aim?0.000:0.145)+bobX+P.sway*(aim?0.02:0.06);
  var ty=(aim?-0.034:-0.075)+bobY+P.swayY*(aim?0.02:0.05);
  var tz=(aim?-0.300:-0.390)+P.recoil*0.075;
  var rx=P.recoil*0.55, rz=aim?0:-0.05, ry=aim?0:0.20;
  if(P.reloading){                                   // gun rolls over to the loading gate
    var need=6-P.reloadFrom, total=0.34+need*0.26+0.42;
    var u=clamp(P.reloadT/0.30,0,1)*clamp((total-P.reloadT)/0.34,0,1);
    rz=-1.15*u; rx-=0.35*u; ry=0.10+0.55*u; ty-=0.075*u; tx-=0.035*u;
    cylGroup.rotation.z-=dt*2.2*u;
  }
  if(cursorAim&&!aim){
    var cnx=clamp((curX/window.innerWidth)*2-1,-1,1);
    var cny=clamp((curY/window.innerHeight)*2-1,-1,1);
    ry-=cnx*0.15; rx-=cny*0.11; tx-=cnx*0.035; ty-=cny*0.02;
  }
  gunRig.position.set(damp(gunRig.position.x,tx,16,dt),damp(gunRig.position.y,ty,16,dt),damp(gunRig.position.z,tz,20,dt));
  gunRig.rotation.set(damp(gunRig.rotation.x,rx,18,dt),damp(gunRig.rotation.y,ry,14,dt),damp(gunRig.rotation.z,rz,14,dt));
  // the Sharps
  if(P.rifleWork>0){
    P.rifleWork-=dt;
    var ru=clamp(1-P.rifleWork/1.55,0,1);
    if(rifleLever) rifleLever.rotation.x=-Math.sin(clamp(ru*1.6,0,1)*Math.PI)*1.35;
    if(!P.rifleClicked&&ru>0.62){ P.rifleClicked=true; AU.clink(); }
    if(P.rifleWork<=0){ P.rifleWork=0; AU.click(0.22); }
  }
  rflash.m.opacity=Math.max(0,rflash.m.opacity-dt*12);
  var rtx=(aim?0.000:0.115)+bobX*1.4+P.sway*(aim?0.02:0.05);
  var rty=(aim?-0.046:-0.110)+bobY*1.4+P.swayY*(aim?0.02:0.04);
  var rtz=(aim?-0.250:-0.400)+P.recoil*0.10;
  var rrx=P.recoil*0.42+(P.rifleWork>0?0.10:0);
  if(cursorAim&&!aim){
    var rnx=clamp((curX/window.innerWidth)*2-1,-1,1), rny=clamp((curY/window.innerHeight)*2-1,-1,1);
    rtx-=rnx*0.03; rty-=rny*0.02; rrx-=rny*0.09;
  }
  rifleRig.position.set(damp(rifleRig.position.x,rtx,16,dt),damp(rifleRig.position.y,rty,16,dt),damp(rifleRig.position.z,rtz,20,dt));
  rifleRig.rotation.x=damp(rifleRig.rotation.x,rrx,16,dt);
  rifleRig.rotation.y=damp(rifleRig.rotation.y,aim?0:0.09,14,dt);
  rifleRig.rotation.z=damp(rifleRig.rotation.z,P.rifleWork>0?-0.22:0,10,dt);

  gunRig.visible=P.weapon==='colt';
  rifleRig.visible=P.weapon==='rifle';
}

/* the people who live here: small idle motion, and they get down when it starts */
function updateFolk(dt){
  for(var i=0;i<folk.length;i++){
    var f=folk[i];
    if(f.scare>0){
      f.scare-=dt;
      var c=clamp(f.scare,0,1);
      f.g.position.y=f.baseY-0.42*c;
      f.g.rotation.x=0.42*c;
      f.armL.rotation.x=-2.1*c; f.armR.rotation.x=-2.1*c;
      f.head.rotation.y=0;
      continue;
    }
    f.g.rotation.x=0;
    f.g.position.y=f.baseY+Math.sin(GAME.t*1.15+f.ph)*0.012;
    f.head.rotation.y=Math.sin(GAME.t*0.42+f.ph)*0.38;
    f.head.rotation.x=Math.sin(GAME.t*0.7+f.ph)*0.06;
    if(f.wipe){ f.armR.rotation.x=-1.15+Math.sin(GAME.t*2.4+f.ph)*0.40; f.armL.rotation.x=-0.25; }
    else if(f.play){ f.armR.rotation.x=-1.32+Math.sin(GAME.t*7+f.ph)*0.10;
                     f.armL.rotation.x=-1.32+Math.sin(GAME.t*7+f.ph+1.6)*0.10; }
    else { f.armR.rotation.x=Math.sin(GAME.t*0.9+f.ph)*0.07;
           f.armL.rotation.x=Math.sin(GAME.t*0.9+f.ph+2)*0.07; }
  }
}

/* doors swing the way you push through them, then flap back */
function updateDoors(dt){
  for(var i=0;i<doors.length;i++){
    var D=doors[i];
    var dx=P.x-D.x, dz=P.z-D.z, dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>30&&D.a===0&&D.v===0) continue;
    var target=0;
    if(dist<4.2){                                  // they start moving well before you reach them
      var side=dx*D.nx+dz*D.nz;
      target=(side>0?1:-1)*1.45*clamp((4.2-dist)/2.3,0,1);
    }
    if(D.sw&&dist<30) target+=Math.sin(GAME.t*1.15+D.ph)*0.05;   // batwings never sit quite still
    D.v+=(target-D.a)*34*dt; D.v*=Math.exp(-5.0*dt); D.a+=D.v*dt;
    D.hL.rotation.y=-D.a; D.hR.rotation.y=D.a;
    if(D.snd>0) D.snd-=dt;
    else if(Math.abs(D.v)>1.3&&dist<9){ AU.creak(); D.snd=0.5; }
  }
}

/* ============================================================
   16. outlaw behaviour
   ============================================================ */
function outlawShoot(e,d){
  var mz=new THREE.Vector3(e.g.position.x,e.g.position.y+1.35,e.g.position.z);
  var fx=P.x-e.x, fz=P.z-e.z, il=1/(d||1);
  mz.x+=fx*il*0.45; mz.z+=fz*il*0.45;
  var target=new THREE.Vector3(P.x,P.y+EYE-0.25,P.z);
  var chance=clamp(0.42-d*0.009-P.moving*0.10-(P.inCar?0.12:0),0.05,0.44);
  var hit=rnd()<chance;
  if(!hit){ target.x+=rr(-1.4,1.4); target.y+=rr(-0.9,1.4); target.z+=rr(-1.4,1.4); }
  FX.tracer(mz,target);
  FX.puff(mz,1,0xFFC963,0.10,0.4,0.4);
  AU.shot(d);
  if(hit){
    var dmg=rr(7,13);
    GAME.hp-=dmg; P.hurtT=0.5;
    AU.hurt();
    if(GAME.hp<=0){ GAME.hp=0; endGame(false); }
  } else if(rnd()<0.5) setTimeout(function(){AU.ric();},60);
}

var riflePickup=null;
function dropRifle(x,y,z){
  if(riflePickup)return;
  riflePickup=makeRiflePickup(x,y+0.1,z);
  feed('his <em>Sharps</em> is still on the roof');
}

function riflemanShoot(e,d){
  var mz=new THREE.Vector3(e.x,e.y+1.42,e.z);
  var il=1/(d||1);
  mz.x+=(P.x-e.x)*il*0.95; mz.z+=(P.z-e.z)*il*0.95;
  var target=new THREE.Vector3(P.x,P.y+EYE-0.2,P.z);
  var chance=clamp(0.60-P.moving*0.34-d*0.0022,0.10,0.60);
  var hit=rnd()<chance;
  if(!hit){ target.x+=rr(-1.1,1.1); target.y+=rr(-0.7,1.3); target.z+=rr(-1.1,1.1); }
  FX.tracer(mz,target);
  FX.puff(mz,2,0xFFD08A,0.14,0.5,0.5);
  AU.rifle(d);
  if(hit){
    GAME.hp-=rr(20,29); P.hurtT=0.8; AU.hurt();
    feed('<em>'+e.name+'</em> has your range');
    if(GAME.hp<=0){ GAME.hp=0; endGame(false); }
  }else if(rnd()<0.7) setTimeout(function(){AU.ric();},70);
}

function updateEnemies(dt){
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i], p=e.g.position;
    if(e.dead){
      if(e.fallT<1){
        e.fallT+=dt*(e.kind==='sniper'?1.15:2.2);
        var u=Math.min(1,e.fallT);
        e.g.rotation.x=-u*Math.PI/2*0.94;
        if(e.kind==='sniper'){
          e.g.rotation.z=u*0.85;                       // he comes off the roof
          p.y=lerp(e.y,terrainH(e.x,e.z),u*u);
          p.x=e.x-Math.sin(e.yaw)*u*1.7;
          p.z=e.z-Math.cos(e.yaw)*u*1.7;
          if(u>=1){ AU.thud(); FX.puff(new THREE.Vector3(p.x,p.y+0.3,p.z),4,0xC2A177,0.3,1.3,0.5); }
        }else{
          p.y=terrainH(e.x,e.z)+Math.sin(u*Math.PI)*0.12-u*0.05;
        }
      }
      continue;
    }
    if(e.kind==='sniper'){
      var sdx=P.x-e.x, sdz=P.z-e.z, sd=Math.sqrt(sdx*sdx+sdz*sdz)||0.001;
      e.g.rotation.y=Math.atan2(sdx,sdz)+Math.PI;
      e.yaw=e.g.rotation.y;
      e.rifle.rotation.x=clamp(-Math.atan2((e.y+1.35)-(P.y+1.0),sd),-0.95,0.30);
      if(e.hitT>0) e.hitT-=dt;
      if(!insideBuilding(P.x,P.z)&&sd<95){
        e.charge+=dt;
        var tell=clamp((e.charge-(e.fireCd-1.25))/1.25,0,1);
        if(tell>0&&!e.told){ e.told=true; AU.click(0.10); }
        e.glintM.opacity=tell*tell*0.95;
        if(e.charge>=e.fireCd){
          riflemanShoot(e,sd);
          e.charge=0; e.told=false; e.fireCd=rr(3.2,4.8); e.glintM.opacity=0;
        }
      }else{
        e.charge=Math.max(0,e.charge-dt*0.7); e.told=false; e.glintM.opacity=0;
      }
      continue;
    }
    var dx=P.x-e.x, dz=P.z-e.z, d=Math.hypot(dx,dz)||0.001;
    var los=losClear(e.x,e.z,P.x,P.z);
    e.g.rotation.y=Math.atan2(dx,dz)+Math.PI;
    if(e.hitT>0){ e.hitT-=dt; e.g.position.x=e.x+rr(-0.03,0.03); }

    var wantMove=(!los||d>17);
    if(wantMove){
      var s=e.speed*(e.alerted?1.25:1);
      var nx=e.x+dx/d*s*dt, nz=e.z+dz/d*s*dt;
      var c=collide(nx,nz,0.42); e.x=c[0]; e.z=c[1];
      e.phase+=dt*s*2.6;
      e.legL.rotation.x=Math.sin(e.phase)*0.72;
      e.legR.rotation.x=-Math.sin(e.phase)*0.72;
      e.armL.rotation.x=-Math.sin(e.phase)*0.5;
      e.armR.rotation.x=Math.sin(e.phase)*0.4;
    }else{
      e.strafeCd-=dt;
      if(e.strafeCd<=0){ e.strafe*=-1; e.strafeCd=rr(1.2,2.8); }
      var sx=-dz/d*e.strafe*1.5, sz=dx/d*e.strafe*1.5;
      var c2=collide(e.x+sx*dt,e.z+sz*dt,0.42); e.x=c2[0]; e.z=c2[1];
      e.phase+=dt*3.4;
      e.legL.rotation.x=Math.sin(e.phase)*0.28;
      e.legR.rotation.x=-Math.sin(e.phase)*0.28;
      e.armL.rotation.x=damp(e.armL.rotation.x,-0.15,6,dt);
      e.armR.rotation.x=damp(e.armR.rotation.x,-1.42,9,dt);
    }
    p.x=e.x; p.z=e.z; p.y=terrainH(e.x,e.z);

    if(los&&d<30){
      e.fireCd-=dt*(e.alerted?1.2:1);
      if(e.fireCd<=0){ outlawShoot(e,d); e.fireCd=rr(1.15,2.5)+d*0.02; }
    }
  }
}

/* ============================================================
   17. the Ford, driven
   ============================================================ */
function toggleCar(){
  if(GAME.state!=='play')return;
  if(P.inCar){
    var ox=car.x-Math.cos(car.yaw)*2.7, oz=car.z+Math.sin(car.yaw)*2.7;
    var c=collide(ox,oz,0.5); P.x=c[0]; P.z=c[1]; P.y=terrainH(P.x,P.z);
    P.inCar=false; car.occupied=false; car.speed*=0.3;
    say('on foot',1.4);
  }else{
    if(Math.hypot(P.x-car.x,P.z-car.z)>4.8)return;
    P.inCar=true; car.occupied=true; P.yaw=Math.PI-car.yaw;
    AU.whinny(); say('you have the reins',1.8);
  }
}

function updateCar(dt){
  var drive=0,haul=0,steerIn=0;
  if(P.inCar){
    drive=(keys.KeyW?1:0); haul=(keys.KeyS?1:0);
    steerIn=(keys.KeyA?1:0)-(keys.KeyD?1:0);
  }
  car.steer=damp(car.steer,steerIn,7,dt);
  var s=car.speed;
  s+=drive*8.5*dt;
  if(haul) s-=(s>0?14:6)*dt;
  s-=s*0.85*dt+(s<0?-1:1)*s*s*0.012*dt;
  s=clamp(s,-3.5,14);
  if(Math.abs(s)<0.05&&!drive&&!haul) s=0;
  car.speed=s;

  var grip=clamp(Math.abs(s)/6,0,1);
  car.yaw+=car.steer*1.9*grip*(s<0?-1:1)*dt;

  var nx=car.x+Math.sin(car.yaw)*s*dt, nz=car.z+Math.cos(car.yaw)*s*dt;
  var c=collide(nx,nz,1.6);
  var bumped=Math.abs(c[0]-nx)>0.001||Math.abs(c[1]-nz)>0.001;
  var hx=c[0]+Math.sin(car.yaw)*3.7, hz=c[1]+Math.cos(car.yaw)*3.7;   // the team gets its own probe
  var hc=collide(hx,hz,1.0);
  if(Math.abs(hc[0]-hx)>0.001||Math.abs(hc[1]-hz)>0.001){
    c[0]+=(hc[0]-hx)*0.9; c[1]+=(hc[1]-hz)*0.9; bumped=true;
  }
  if(bumped){
    if(Math.abs(car.speed)>3){ AU.thud(); FX.puff(new THREE.Vector3(car.x,car.g.position.y+1,car.z),4,0xB79468,0.3,1.6,0.7); }
    car.speed*=-0.18;
  }
  car.x=c[0]; car.z=c[1];

  var gy=terrainH(car.x,car.z);
  car.g.position.set(car.x,gy,car.z);
  car.g.rotation.y=car.yaw;
  var ahead=terrainH(car.x+Math.sin(car.yaw)*2.4,car.z+Math.cos(car.yaw)*2.4);
  var side=terrainH(car.x+Math.cos(car.yaw)*1.4,car.z-Math.sin(car.yaw)*1.4);
  car.g.rotation.x=damp(car.g.rotation.x,clamp((gy-ahead)*0.26,-0.28,0.28),6,dt);
  car.g.rotation.z=damp(car.g.rotation.z,clamp((side-gy)*0.26,-0.28,0.28),6,dt);

  for(var w=0;w<4;w++){
    car.wheels[w].rotation.x-=s*dt/(car.wheels[w].userData.r||0.5);
    if(w<2) car.pivots[w].rotation.y=car.steer*0.30;
  }

  // the team trots on diagonal pairs, faster the harder you push them
  car.gait+=dt*(1.7+Math.abs(s)*0.80);
  var amp=clamp(Math.abs(s)/5.5,0.10,1);
  for(var hi=0;hi<car.horses.length;hi++){
    var H=car.horses[hi], ph=car.gait+hi*0.62;
    for(var L=0;L<4;L++){
      var lg=H.legs[L], off=(L===0||L===3)?0:Math.PI;
      lg.up.rotation.x=Math.sin(ph+off)*0.58*amp;
      lg.lo.rotation.x=-Math.max(0,Math.sin(ph+off+0.9))*0.80*amp;
    }
    H.g.position.y=Math.abs(Math.sin(ph))*0.05*amp;
    H.neck.rotation.x=H.neckBase+Math.sin(ph*2)*0.06*amp;
    H.tail.rotation.z=Math.sin(car.gait*0.8+hi)*0.14;
  }
  if(Math.abs(s)>0.5){
    car.beat-=dt*(1.7+Math.abs(s)*0.80)/Math.PI;
    if(car.beat<=0){ AU.clop(clamp(Math.abs(s)/9,0.25,1)); car.beat=1; }
  }

  if(P.inCar){
    P.x=car.x; P.z=car.z; P.y=gy;
    P.moving=clamp(Math.abs(s)/8,0,1);
    if(Math.abs(s)>2&&rnd()<dt*12)
      FX.puff(new THREE.Vector3(car.x-Math.sin(car.yaw)*1.6,gy+0.2,car.z-Math.cos(car.yaw)*1.6),1,0xC2A177,0.32,0.6,0.5);
    if(Math.abs(s)>5){
      var tx=car.x+Math.sin(car.yaw)*3.4, tz=car.z+Math.cos(car.yaw)*3.4;
      for(var i=0;i<enemies.length;i++){
        var e=enemies[i]; if(e.dead)continue;
        if(Math.hypot(e.x-tx,e.z-tz)<2.9||Math.hypot(e.x-car.x,e.z-car.z)<2.4){
          killOutlaw(e,'car'); car.speed*=0.86;
          FX.puff(new THREE.Vector3(e.x,gy+1,e.z),6,0xB79468,0.32,2.2,1.4);
        }
      }
    }
    // up on the spring seat, reins in hand
    var aligned=Math.PI-car.yaw, off=angWrap(P.yaw-aligned);
    if(off> 1.9) off= 1.9; if(off<-1.9) off=-1.9;            // you can only crane so far
    off=damp(off,0,0.7,dt);
    P.yaw=aligned+off;
    var jolt=Math.sin(car.gait*2)*0.022*amp+Math.sin(car.gait*3.1)*0.010*amp;
    camera.position.set(car.x+Math.sin(car.yaw)*0.5,gy+2.16+jolt,car.z+Math.cos(car.yaw)*0.5);
    camera.rotation.set(P.pitch+jolt*0.35,P.yaw,car.g.rotation.z*0.6+Math.sin(car.gait)*0.010*amp,'YXZ');
  }
}

/* ============================================================
   18. waves
   ============================================================ */
function spawnWave(){
  GAME.wave++;
  var n=WAVES[GAME.wave-1]||0, placed=0, guard=0;
  if(GAME.wave===1){
    var spots=[[14,-4],[26,4],[7,7],[33,-7]];
    for(var i=0;i<4;i++) Outlaw(spots[i][0],spots[i][1],NAMES[i]);
    if(PERCH){
      Rifleman(PERCH.x,PERCH.y,PERCH.z,0,'Ott Prine');
      feed('a rifle on the <em>Occidental</em> roof');
    }
  }else{
    while(placed<n&&guard++<400){
      var a=rr(0,TAU), r=rr(36,58);
      var x=Math.cos(a)*r, z=Math.sin(a)*r;
      var blocked=false;
      for(var b=0;b<blockers.length;b++){
        var q=blockers[b];
        if(x>q.x0-1&&x<q.x1+1&&z>q.z0-1&&z<q.z1+1){blocked=true;break;}
      }
      if(blocked)continue;
      var e=Outlaw(x,z,NAMES[(GAME.wave*4+placed)%NAMES.length]); e.alerted=true;
      placed++;
    }
  }
  GAME.left+=n;
  ui.wave.textContent=GAME.wave;
  ui.objtxt.textContent=GAME.wave===1?'they know you are here':(GAME.wave===2?'more riding in from the flats':'the last of the Prines');
  say('riders coming in',2.6);
  if(GAME.wave>1) feed('<em>'+n+' more</em> off the flats');
}

function endGame(won){
  if(GAME.state==='over')return;
  GAME.state='over';
  if(document.exitPointerLock) document.exitPointerLock();
  dropAds();
  document.body.classList.remove('playing');   // give the mouse pointer back
  ui.hud.classList.remove('live');
  $('ovEye').textContent=won?'Cimarron County Register':'Coroner’s inquest';
  $('ovTitle').textContent=won?'The Wash Is Quiet':'Buried at Nine Mile';
  $('ovSub').textContent=won
    ? 'Thirteen Prines and hangers-on laid out along the boardwalk, the man on the Occidental roof among them. The bank still has no money in it, but the street is yours until sundown.'
    : 'You went down in the street outside the Occidental. The Prine brothers keep the town, and No Man\u2019s Land keeps no records.';
  $('sKills').textContent=GAME.kills;
  $('sAcc').textContent=(GAME.shots?Math.round(GAME.hits/GAME.shots*100):0)+'%';
  $('sTime').textContent=fmtTime(GAME.t);
  $('sShots').textContent=GAME.shots;
  $('over').classList.remove('gone');
  setTimeout(function(){ try{ $('again').focus(); }catch(err){} },60);
}
function fmtTime(t){ var m=Math.floor(t/60), s=Math.floor(t%60); return m+':'+(s<10?'0':'')+s; }

/* ============================================================
   19. hud refresh
   ============================================================ */
var lastAmmo=-1,lastKills=-1,lastHp=-1,lastLeft=-1,lastClock='',lastWeapon='';
function updateHud(dt){
  var shown=P.weapon==='rifle'?P.rifleAmmo:P.ammo;
  if(shown!==lastAmmo||P.weapon!==lastWeapon){
    lastAmmo=shown; lastWeapon=P.weapon;
    ui.ammoN.textContent=shown;
    ui.cal.textContent=P.weapon==='rifle'?'.45-70 Springfield':'.45 Colt';
    var lit=P.weapon==='rifle'?Math.min(6,shown):shown;
    for(var i=0;i<6;i++) cylEls[i].className=i<lit?'loaded':'';
  }
  if(GAME.kills!==lastKills){
    lastKills=GAME.kills; ui.tally.innerHTML='';
    var full=Math.floor(GAME.kills/5), rem=GAME.kills%5, g,k,s;
    for(g=0;g<full;g++){
      var d=document.createElement('div'); d.className='grp';
      for(k=0;k<4;k++) d.appendChild(document.createElement('s'));
      s=document.createElement('s'); s.className='x'; d.appendChild(s);
      ui.tally.appendChild(d);
    }
    if(rem){
      var d2=document.createElement('div'); d2.className='grp';
      for(k=0;k<rem;k++) d2.appendChild(document.createElement('s'));
      ui.tally.appendChild(d2);
    }
  }
  var hp=Math.max(0,Math.round(GAME.hp));
  if(hp!==lastHp){
    lastHp=hp; var on=Math.ceil(hp/10);
    for(var b=0;b<10;b++) barEls[b].className=b<on?(on<=3?'low':'on'):'';
  }
  if(GAME.left!==lastLeft){ lastLeft=GAME.left; ui.left.textContent=GAME.left; }
  var c=fmtTime(GAME.t); if(c!==lastClock){ lastClock=c; ui.clock.textContent=c; }

  ui.cross.style.setProperty('--spread',(4+P.moving*7+P.recoil*9).toFixed(1)+'px');
  if(cursorAim){
    ui.cross.style.left=curX+'px'; ui.cross.style.top=curY+'px';
    ui.mark.style.left=curX+'px';  ui.mark.style.top=curY+'px';
  }
  ui.hurt.style.opacity=P.hurtT>0?clamp(P.hurtT,0,1)*0.9:(GAME.hp<32?0.16+Math.sin(GAME.t*3)*0.05:0);

  var near=!P.inCar&&Math.hypot(P.x-car.x,P.z-car.z)<4.8;
  ui.prompt.textContent=P.inCar?'F · step down':'F · take the reins';
  if(P.weapon==='rifle'&&!near&&!P.inCar){
    ui.prompt.textContent='Hold right mouse to aim  ·  1 · Colt';
  }
  ui.prompt.classList.toggle('on',near||P.inCar||(P.weapon==='rifle'));

  var head=(-P.yaw*180/Math.PI)%360; if(head<0)head+=360;
  for(var s2=0;s2<24;s2++){
    var el=stripEls[s2], deg=+el.dataset.deg;
    var rel=((deg-head+540)%360)-180;
    if(Math.abs(rel)>76){ el.style.opacity=0; }
    else { el.style.opacity=1-Math.abs(rel)/90; el.style.left=(140+rel*1.8)+'px'; }
  }
  if(stateMsgT>0) stateMsgT-=dt;
  if(stateMsgT<=0){
    var st=insideBuilding(P.x,P.z)?'under cover':(cursorAim?'cursor aim · edges turn':'');
    if(st!==lastStateTxt){ lastStateTxt=st; ui.state.textContent=st; }
  }
}

/* ============================================================
   20. ambient world motion
   ============================================================ */
function updateAmbient(dt,cam){
  if(windmill) windmill.rotation.z-=dt*1.35;
  for(var i=0;i<weeds.length;i++){
    var w=weeds[i], m=w.m;
    m.position.x+=w.vx*dt; m.position.z+=w.vz*dt;
    if(m.position.x>84){ m.position.x=-84; m.position.z=rr(-78,78); w.vx=rr(2.5,6.5); }
    var hop=Math.abs(Math.sin(m.position.x*1.7+m.position.z))*0.16;
    m.position.y=terrainH(m.position.x,m.position.z)+w.r*0.92+hop;
    m.rotation.z-=w.vx*dt/w.r;                  // rolls on its own diameter, wobbling as it goes
    m.rotation.x+=w.vz*dt/w.r+w.spin*dt*0.6;
    m.rotation.y+=w.spin*dt*0.35;
  }
  var pos=dust.pos, cx=cam.position.x, cz=cam.position.z;
  for(var k=0;k<dust.n;k++){
    var j=k*3;
    pos[j]+=dt*3.1; pos[j+1]-=dt*0.16; pos[j+2]+=dt*0.6;
    if(pos[j]-cx>60)pos[j]-=120; if(pos[j]-cx<-60)pos[j]+=120;
    if(pos[j+2]-cz>60)pos[j+2]-=120; if(pos[j+2]-cz<-60)pos[j+2]+=120;
    if(pos[j+1]<0)pos[j+1]=26;
  }
  dust.pts.geometry.attributes.position.needsUpdate=true;
  sky.position.set(cam.position.x,0,cam.position.z);
  clouds.position.set(cam.position.x,0,cam.position.z);
  clouds.rotation.y+=dt*0.0045;
  sunDisc.position.set(cam.position.x+SUNDIR.x*340,SUNDIR.y*340,cam.position.z+SUNDIR.z*340);
  sun.position.set(cam.position.x+74,58,cam.position.z-46);
  sun.target.position.set(cam.position.x,0,cam.position.z);
  sun.target.updateMatrixWorld();
}

/* ============================================================
   21. loop
   ============================================================ */
var last=performance.now(), titleT=0;   // titleT also drives the opening dolly after a quit
function frame(now){
  requestAnimationFrame(frame);
  var dt=Math.min(0.05,(now-last)/1000); last=now;

  if(GAME.state==='title'){
    titleT+=dt;
    var tx=-47+titleT*0.55, tz=1.4+Math.sin(titleT*0.15)*1.2;
    camera.position.set(tx,terrainH(tx,tz)+1.72,tz);
    camera.rotation.set(-0.03+Math.sin(titleT*0.21)*0.012,-Math.PI/2+Math.sin(titleT*0.13)*0.05,0,'YXZ');
    updateAmbient(dt,camera);
    FX.step(dt);
  }else if(GAME.state==='play'&&!GAME.paused){
    GAME.t+=dt;
    if(P.hurtT>0)P.hurtT-=dt;
    updatePlayer(dt);
    updateDoors(dt);
    updateFolk(dt);
    reloadStep(dt);
    updateCar(dt);
    updateEnemies(dt);
    updateGun(dt);
    aimStep(dt);
    FX.step(dt);
    updateAmbient(dt,activeCam());
    updateHud(dt);
    if(P.fireHeld&&P.ammo>0&&!P.reloading){          // fanning the hammer
      P.cockT-=dt;
      if(P.cockT<=0){ fire(); P.cockT=0.34; }
    }else P.cockT=0.12;
    if(GAME.left<=0){
      GAME.nextWaveT-=dt;
      if(GAME.nextWaveT<=0){
        if(GAME.wave<WAVES.length){ spawnWave(); GAME.nextWaveT=3.2; }
        else endGame(true);
      }
    }else GAME.nextWaveT=3.2;
  }else{
    updateAmbient(dt,activeCam());
    updateGun(dt);
  }

  renderer.clear();
  var cam=activeCam();
  renderer.render(scene,cam);
  if(GAME.state!=='title'){ renderer.clearDepth(); renderer.render(gunScene,gunCam); }
}

window.addEventListener('resize',function(){
  var w=window.innerWidth,h=window.innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=chase.aspect=gunCam.aspect=w/h;
  camera.updateProjectionMatrix(); chase.updateProjectionMatrix(); gunCam.updateProjectionMatrix();
});

/* ============================================================
   22. start, restart
   ============================================================ */
function beginRun(){
  AU.init(); AU.resume();
  GAME.state='play'; GAME.paused=false;
  GAME.kills=0; GAME.left=0; GAME.wave=0; GAME.shots=0; GAME.hits=0; GAME.t=0; GAME.hp=100; GAME.nextWaveT=3.2;
  P.x=-34; P.z=0; P.y=terrainH(-34,0); P.vy=0; P.yaw=-Math.PI/2; P.pitch=-0.02;
  P.ammo=6; P.reloading=false; P.recoil=0; P.inCar=false; P.hurtT=0; P.fireHeld=false;
  dropAds();
  P.weapon='colt'; P.hasRifle=false; P.rifleAmmo=0; P.rifleWork=0;
  if(riflePickup){ if(!riflePickup.taken) world.remove(riflePickup.g); riflePickup=null; }
  ui.pause.classList.add('gone'); $('fullKeys').hidden=true;
  for(var dI=0;dI<doors.length;dI++){ doors[dI].a=0; doors[dI].v=0; doors[dI].hL.rotation.y=0; doors[dI].hR.rotation.y=0; }
  lastWeapon='';
  car.x=14; car.z=6.5; car.yaw=-0.5; car.speed=0; car.steer=0; car.occupied=false;
  clearEnemies();
  lastAmmo=lastKills=lastHp=lastLeft=-1; lastClock='';
  ui.feed.innerHTML='';
  $('title').classList.add('gone');
  $('over').classList.add('gone');
  document.body.classList.add('playing');
  ui.hud.classList.add('live');
  spawnWave();
  lock();
  say('left click to fire, R to reload',3.4);
}
$('start').addEventListener('click',beginRun);
$('again').addEventListener('click',beginRun);
$('resume').addEventListener('click',closePause);
$('quit').addEventListener('click',toTitle);
$('menuBtn').addEventListener('click',function(){ if(GAME.paused) closePause(); else openPause(); });
$('showKeys').addEventListener('click',function(){
  var k=$('fullKeys'); k.hidden=!k.hidden;
  $('showKeys').textContent=k.hidden?'Controls':'Hide controls';
});

$('loading').style.display='none';
requestAnimationFrame(frame);
})();
