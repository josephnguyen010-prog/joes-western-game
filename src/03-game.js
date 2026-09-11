
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
       ads:false,adsHold:false,cylIndex:0,onWagon:false};
var EYE=1.66;

var ui={
  hud:$('hud'),left:$('left'),wave:$('wave'),objtxt:$('objtxt'),clock:$('clock'),
  tally:$('tally'),bars:$('bars'),state:$('state'),ammoN:$('ammoN'),cyl:$('cyl'),
  feed:$('feed'),prompt:$('prompt'),cross:$('cross'),mark:$('mark'),hurt:$('hurt'),strip:$('strip'),
  cal:$('cal'),scope:$('scope'),pause:$('pause'),ammoOf:$('ammoOf'),
  guns:$('guns'),gunColt:$('gunColt'),gunRifle:$('gunRifle'),perf:$('perf')
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
  if(e.code==='F3'){ e.preventDefault(); perfOn=!perfOn; ui.perf.hidden=!perfOn; }
  if(e.code==='Space'&&GAME.state==='play') e.preventDefault();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code)>=0) e.preventDefault();
});
window.addEventListener('keyup',function(e){ keys[e.code]=false; });
window.addEventListener('blur',function(){ keys={}; });
/* Capturing the pointer hands over a jump, not a movement. The first report
   after the cursor is taken carries the whole distance from wherever it happened
   to be sitting to the middle of the screen - one flick of several hundred
   pixels, arriving as though you had thrown the mouse - and the view snaps to
   whatever bearing that works out to. Chrome will post the odd one of those out
   of nowhere as well.

   Neither is anything a hand did, so neither is allowed to move the view. The
   first few reports after a capture are dropped outright, and after that
   anything the size of a teleport is ignored rather than trusted: a real flick
   arrives spread across many small reports, because the mouse is sampled far
   faster than the screen is drawn. */
var LOOK_DROP=600, LOOK_MAX=200, lookWarm=0;
function look(dx,dy){
  if(lookWarm>0){ lookWarm--; return; }
  if(Math.abs(dx)>LOOK_DROP||Math.abs(dy)>LOOK_DROP) return;
  mouseDX+=clamp(dx,-LOOK_MAX,LOOK_MAX);
  mouseDY+=clamp(dy,-LOOK_MAX,LOOK_MAX);
}
document.addEventListener('mousemove',function(e){
  if(document.pointerLockElement===canvas){ look(e.movementX||0,e.movementY||0); }
  else {
    if(dragging) look(e.movementX||0,e.movementY||0);
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
// The wheel swaps guns, the way it does in everything else - 1 and 2 still work.
window.addEventListener('wheel',function(e){
  if(GAME.state!=='play'||GAME.paused||!P.hasRifle)return;
  e.preventDefault();
  setWeapon(P.weapon==='colt'?'rifle':'colt');
},{passive:false});
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
    lookWarm=3;                        // the capture jump arrives on the next report
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
  /* No crosshair on the Springfield. It is a single-shot rifle with iron sights
     and no business being hip-shot at a mark it draws for you - if you want to
     know where it is pointed, put the sights up and look down the barrel. The
     Colt keeps its crosshair; that is a gun you fire from the hip. */
  ui.cross.style.visibility=(on||P.weapon==='rifle')?'hidden':'';
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
  if(Math.hypot(car.x-P.x,car.z-P.z)<30) car.hurry=1.75;   // the driver puts the whip on
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
  P.cylIndex++;
  var org=castShot((adsOn()?0.0016:0.0042)+P.moving*0.010+P.recoil*0.012+(P.inCar?0.012:0),58,140,220);
  FX.eject(org.addScaledVector(_v3,0.22).add(new THREE.Vector3(0,-0.12,0)),_v3,new THREE.Vector3(0,1,0));
}

function startReload(){
  if(GAME.state!=='play'||P.weapon!=='colt'||P.reloading||P.ammo>=6)return;
  P.reloading=true; P.reloadT=0; P.reloadFrom=P.ammo; P.nextRound=0.34;
  AU.click(0.24);
  say('loading '+(6-P.ammo)+(P.ammo===5?' round':' rounds'),1.6);
}
function reloadStep(dt){
  if(!P.reloading)return;
  P.reloadT+=dt;
  var need=6-P.reloadFrom, lastAt=0.34+(need-1)*0.26, total=lastAt+0.52;
  /* A while loop, gated on the round's own schedule rather than on the clock:
     a long frame used to step straight over a round's window and drop it. */
  while(P.ammo<6&&P.nextRound<=lastAt+0.0001&&P.reloadT>=P.nextRound){
    P.ammo++; P.cylIndex++; P.nextRound+=0.26; AU.clink();
    ui.cyl.classList.remove('spin'); void ui.cyl.offsetWidth; ui.cyl.classList.add('spin');
  }
  if(P.reloadT>=total){ P.reloading=false; P.ammo=6; AU.click(0.3); }
}

/* ============================================================
   15. collision and the player
   ============================================================ */
function collide(px,pz,r,feet,bigOnly){
  if(feet===undefined) feet=-999;
  if(inPortal(px,pz)){                       // a doorway is never blocked
    var pd=Math.sqrt(px*px+pz*pz), pl=WORLD_R-r;
    if(pd>pl){ var pk=pl/pd; px*=pk; pz*=pk; }
    return [px,pz];
  }
  for(var i=0;i<blockers.length;i++){
    var b=blockers[i];
    if(b.top<feet+0.15) continue;            // you are standing above it
    // A loaded wagon goes over scrub, barrels and cactus without noticing.
    // Only walls and the like are worth stopping for.
    if(bigOnly&&(b.x1-b.x0)<2.5&&(b.z1-b.z0)<2.5) continue;
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

/* Is a wagon-sized box at this spot clear of anything solid? Only the big
   blockers count, the same ones the wagon itself collides against. */
function carClear(x,z){
  var c=collide(x,z,2.2,0,true);
  return Math.abs(c[0]-x)<0.001&&Math.abs(c[1]-z)<0.001;
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

  var ox=P.x, oz=P.z;
  var nx=P.x+vx*dt, nz=P.z+vz*dt;
  /* Resolution should only ever take motion away. If it hands you back further
     from where you were than the step you asked for, it has ejected you out of
     something, which plays as being flung across the room or dumped back where
     you came from. Refuse the step instead - unless you were already embedded,
     in which case the push out is the only way free. */
  var c=collide(nx,nz,0.45,P.y);
  if(Math.hypot(c[0]-ox,c[1]-oz)>Math.hypot(nx-ox,nz-oz)+0.02){
    var was=collide(ox,oz,0.45,P.y);
    if(Math.abs(was[0]-ox)<1e-6&&Math.abs(was[1]-oz)<1e-6){ c[0]=ox; c[1]=oz; }
  }
  P.x=c[0]; P.z=c[1];
  if(Math.sqrt(P.x*P.x+P.z*P.z)>WORLD_R-0.6&&stateMsgT<=0) say('the valley ends at the cliffs',2);

  /* Sample the floor along the stride, not just where you ended up. Running
     up the stairs a single frame can carry you across a tread boundary, and
     testing only the new position could miss both treads and drop you through. */
  var gy=floorAt(P.x,P.z,P.y);
  if(P.onGround){
    var gy2=floorAt(ox,oz,P.y), gy3=floorAt((ox+P.x)*0.5,(oz+P.z)*0.5,P.y);
    if(gy2>gy) gy=gy2;
    if(gy3>gy) gy=gy3;
  }
  var wasOn=P.onGround;
  if(P.onGround&&keys.Space){ P.vy=6.0; P.onGround=false; wasOn=false; }
  P.vy-=17*dt; P.y+=P.vy*dt;
  if(P.y<=gy){ P.y=gy; P.vy=0; P.onGround=true; }
  // stepping down a tread should stay a step, not a moment of freefall
  else if(wasOn&&P.vy<0&&P.y-gy<0.48){ P.y=gy; P.vy=0; P.onGround=true; }
  else P.onGround=false;

  /* Land on whatever you clipped on the way down rather than being shoved out
     of it sideways. Only for things you could plausibly be standing on - a
     wall wants far more lift than this allows, and falls through to the
     horizontal push, which is guarded. */
  var need=clearanceAt(P.x,P.z,0.45);
  if(need>-1e8&&P.y<need-0.15&&need-P.y<1.25){ P.y=need; P.vy=0; P.onGround=true; }

  if(riflePickup&&!riflePickup.taken){
    riflePickup.t+=dt;
    riflePickup.g.rotation.y+=dt*0.5;
    riflePickup.g.position.y=riflePickup.y+0.10+Math.sin(riflePickup.t*1.8)*0.05;
    if(Math.hypot(P.x-riflePickup.x,P.z-riflePickup.z)<2.0&&Math.abs(P.y-riflePickup.y)<1.8){
      riflePickup.taken=true; world.remove(riflePickup.g);
      P.hasRifle=true; P.rifleAmmo=9; P.weapon='rifle'; P.rifleWork=0.9; P.reloading=false;
      feed('you have the <em>Springfield</em>');
      say('1 or the wheel goes back to the Colt, 2 for the rifle',6.5);
    }
  }
  if(P.moving>0.1&&P.onGround) P.bob+=dt*(run?13:8.4);   // still drives the weapon, not the view

  // The view is held level and still. Head bob and camera roll read as
  // gimmickry rather than motion, so neither is applied here.
  camera.position.set(P.x,P.y+EYE,P.z);
  camera.rotation.set(P.pitch,P.yaw,0,'YXZ');
}

/* --- the viewmodel --- */
/* One leg of a longer action: 0 before it starts, 1 once it is done, so a
   sequence can be written as the steps it is made of rather than as one curve
   that has to be all of them at once. */
function seg(u,a,b){ return clamp((u-a)/(b-a),0,1); }
function updateGun(dt){
  P.recoil=damp(P.recoil,0,11,dt);
  flash.m.opacity=Math.max(0,flash.m.opacity-dt*14);
  muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*40);
  worldFlash.intensity=Math.max(0,worldFlash.intensity-dt*30);
  cylGroup.rotation.z=damp(cylGroup.rotation.z,-P.cylIndex*(TAU/6),16,dt);
  gateG.rotation.y=damp(gateG.rotation.y,P.reloading?-1.35:0,14,dt);   // the gate swings open
  for(var ri=0;ri<rounds.length;ri++) rounds[ri].visible=ri<P.ammo;
  // Cocked, it lies back far enough to drop under the sight line; down on a
  // spent chamber it stands almost upright.
  hammer.rotation.x=damp(hammer.rotation.x,(P.ammo>0?0.68:0.06)+P.recoil*0.45,13,dt);

  var aim=adsOn(), aimBob=aim?0.35:1;
  var bobY=Math.sin(P.bob)*0.012*P.moving*aimBob, bobX=Math.cos(P.bob*0.5)*0.010*P.moving*aimBob;
  /* Hip pose, or up on the sights. Aiming puts the gun on the centreline and
     drops it by 0.039 - the height of the sight line off the bore - so the
     rear notch and the front blade both land on the middle of the screen,
     which is where the shot goes. Held out at 0.36 rather than up at 0.30:
     any closer and the frame swallows half the street. */
  var tx=(aim?0.000:0.145)+bobX+P.sway*(aim?0.02:0.06);
  var ty=(aim?-0.039:-0.075)+bobY+P.swayY*(aim?0.02:0.05);
  var tz=(aim?-0.400:-0.390)+P.recoil*0.075;
  var rx=P.recoil*0.55, rz=aim?0:-0.05, ry=aim?0:0.20;
  if(P.reloading){                                   // gun rolls over to the loading gate
    var need=6-P.reloadFrom, total=0.34+need*0.26+0.42;
    var u=clamp(P.reloadT/0.30,0,1)*clamp((total-P.reloadT)/0.34,0,1);
    rz=-1.32*u; rx-=0.30*u; ry=0.62*u; ty-=0.085*u; tx-=0.045*u;
  }
  if(cursorAim&&!aim){
    var cnx=clamp((curX/window.innerWidth)*2-1,-1,1);
    var cny=clamp((curY/window.innerHeight)*2-1,-1,1);
    ry-=cnx*0.15; rx-=cny*0.11; tx-=cnx*0.035; ty-=cny*0.02;
  }
  gunRig.position.set(damp(gunRig.position.x,tx,16,dt),damp(gunRig.position.y,ty,16,dt),damp(gunRig.position.z,tz,20,dt));
  gunRig.rotation.set(damp(gunRig.rotation.x,rx,18,dt),damp(gunRig.rotation.y,ry,14,dt),damp(gunRig.rotation.z,rz,14,dt));
  /* --- the Springfield's trapdoor, worked in the order a man actually works it.
     The block is thumbed up and forward, the spent case flips out of the open
     breech, a fresh round goes in and the block snaps down onto it. It used to
     be a single sine sweep that opened and shut the block in one motion with no
     brass at all, and the rifle simply held a fixed tilt for the whole second
     and a half and then snapped back level. */
  var working=P.rifleWork>0;
  var ru=working?clamp(1-P.rifleWork/1.55,0,1):0;
  if(working){
    P.rifleWork-=dt;
    var block=seg(ru,0.14,0.42)-seg(ru,0.68,0.90);       // 0 shut, 1 stood open
    if(rifleLever) rifleLever.rotation.x=-block*1.5;
    if(!P.rifleClicked&&ru>0.38){                        // the case comes out with the block
      P.rifleClicked=true; AU.clink();
      var rc=activeCam(); rc.getWorldQuaternion(_q);
      _v.set(0,0,-1).applyQuaternion(_q);
      _v3.set(1,0,0).applyQuaternion(_q);
      FX.eject(rc.position.clone().addScaledVector(_v,0.30).addScaledVector(_v3,0.09)
                 .add(new THREE.Vector3(0,-0.09,0)),_v3,new THREE.Vector3(0,1,0));
    }
    if(P.rifleWork<=0){ P.rifleWork=0; AU.click(0.22); }  // the latch
  }else if(rifleLever) rifleLever.rotation.x=damp(rifleLever.rotation.x,0,14,dt);
  /* He turns the rifle over to get at the breech and brings it back level, so
     the roll rises and falls across the cycle instead of being held. */
  var roll=working?Math.sin(seg(ru,0.02,0.96)*Math.PI):0;
  rflash.m.opacity=Math.max(0,rflash.m.opacity-dt*12);
  var rtx=(aim?0.000:0.115)+bobX*1.4+P.sway*(aim?0.02:0.05)+roll*0.020;
  /* The aim drop is the sight height, and it is the only aiming aid the rifle
     has now: it puts the top of the front blade on the middle of the screen,
     which is where the shot goes, with the rear notch sitting a few pixels above
     it. Line the blade up in the notch and you are on. */
  var rty=(aim?-0.0465:-0.110)+bobY*1.4+P.swayY*(aim?0.02:0.04)-roll*0.018;
  var rtz=(aim?-0.250:-0.400)+P.recoil*0.10+roll*0.030;
  var rrx=P.recoil*0.42+roll*0.17;
  if(cursorAim&&!aim){
    var rnx=clamp((curX/window.innerWidth)*2-1,-1,1), rny=clamp((curY/window.innerHeight)*2-1,-1,1);
    rtx-=rnx*0.03; rty-=rny*0.02; rrx-=rny*0.09;
  }
  rifleRig.position.set(damp(rifleRig.position.x,rtx,16,dt),damp(rifleRig.position.y,rty,16,dt),damp(rifleRig.position.z,rtz,20,dt));
  rifleRig.rotation.x=damp(rifleRig.rotation.x,rrx,16,dt);
  rifleRig.rotation.y=damp(rifleRig.rotation.y,aim?0:0.09,14,dt);
  rifleRig.rotation.z=damp(rifleRig.rotation.z,-0.34*roll,12,dt);

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
    if(f.reins){ f.armR.rotation.x=-1.28+Math.sin(GAME.t*1.7+f.ph)*0.06;
                 f.armL.rotation.x=-1.22+Math.sin(GAME.t*1.7+f.ph+1)*0.06; }
    else if(f.wipe){ f.armR.rotation.x=-1.15+Math.sin(GAME.t*2.4+f.ph)*0.40; f.armL.rotation.x=-0.25; }
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
  e.kick=1;                                        // the arm goes up with the shot
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

/* How high off the roof the Springfield lies now that he is prone. The muzzle,
   the sight line and the shot all have to come from the same place, or he fires
   from somewhere he cannot see from. */
var RIFLE_Y=0.30;
function riflemanShoot(e,d){
  /* Straight off the end of the barrel, wherever the tracking has put it. It
     used to be reckoned from his middle and then shoved forward by a fixed
     amount, which was near enough while he knelt in the open and is not now
     that he is lying behind a wall with a gap in it. */
  var mz=e.muzzle.getWorldPosition(new THREE.Vector3());
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
        /* A man on his feet falls over. This one is already down, so tipping him
           through a right angle stood him on his head - he slumps and rolls off
           the front instead. */
        e.g.rotation.x=(e.kind==='sniper')?-u*0.26:-u*Math.PI/2*0.94;
        if(e.kind==='sniper'){
          e.g.rotation.z=u*1.15;                       // he comes off the roof
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
      /* He is built kneeling towards +z - the braced knee, the arms and the
         rifle all lead that way - where the outlaws are built facing back down
         their own -z. So he takes the bearing straight, with no half turn on
         top of it: with one he tracked you perfectly and showed you his back
         the whole time, rifle pointed off the wrong side of the roof. */
      e.g.rotation.y=Math.atan2(sdx,sdz);
      e.yaw=e.g.rotation.y;
      /* The rifle now lies down the pivot's +z instead of its -z, so the sign of
         the elevation goes with it: he is above you, so the muzzle has to come
         down, and that is a positive turn about x once the barrel points the
         other way. */
      e.rifle.rotation.x=clamp(Math.atan2((e.y+RIFLE_Y)-(P.y+1.0),sd),-0.30,0.95);
      if(e.hitT>0) e.hitT-=dt;
      /* Being indoors used to be the only thing that stopped him, which meant
         everything else in the county - the water tower, the church, the corner
         of the building you were flattened against - was scenery to him and he
         shot straight through it. He is the hardest hitter in the game, so that
         was most of what "I was behind cover" felt like. Now he has to be able
         to see the spot he aims at, from where he is kneeling to where it is. */
      var mp=e.muzzle.getWorldPosition(_v4);
      var sees=losClear(mp.x,mp.z,P.x,P.z,mp.y,P.y+EYE-0.2);
      if(sees&&!insideBuilding(P.x,P.z)&&sd<95){
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

    /* A run cycle on jointed legs: the hip swings, the knee folds on the
       recovery stroke, the arms counter-swing and the body rises on each
       step. A rigid leg swinging from the hip reads as a shop dummy. */
    var wantMove=(!los||d>17), lift=0;
    if(wantMove){
      var s=e.speed*(e.alerted?1.3:1);
      var nx=e.x+dx/d*s*dt, nz=e.z+dz/d*s*dt;
      var c=collide(nx,nz,0.42,0); e.x=c[0]; e.z=c[1];
      e.phase+=dt*s*3.0;
      var amp=clamp(s/3.0,0.55,1.30);
      e.legL.hip.rotation.x  = Math.sin(e.phase)*0.88*amp;
      e.legR.hip.rotation.x  =-Math.sin(e.phase)*0.88*amp;
      e.legL.knee.rotation.x =-Math.max(0,Math.sin(e.phase+0.95))*1.05*amp;
      e.legR.knee.rotation.x =-Math.max(0,Math.sin(e.phase+0.95+Math.PI))*1.05*amp;
      e.armL.rotation.x=-Math.sin(e.phase)*0.68*amp;
      e.armR.rotation.x= Math.sin(e.phase)*0.52*amp;
      lift=Math.abs(Math.sin(e.phase))*0.055*amp;
    }else{
      e.strafeCd-=dt;
      if(e.strafeCd<=0){ e.strafe*=-1; e.strafeCd=rr(1.2,2.8); }
      var sx=-dz/d*e.strafe*1.5, sz=dx/d*e.strafe*1.5;
      var c2=collide(e.x+sx*dt,e.z+sz*dt,0.42,0); e.x=c2[0]; e.z=c2[1];
      e.phase+=dt*3.6;
      e.legL.hip.rotation.x  = Math.sin(e.phase)*0.30;
      e.legR.hip.rotation.x  =-Math.sin(e.phase)*0.30;
      e.legL.knee.rotation.x =-Math.max(0,Math.sin(e.phase+0.95))*0.34;
      e.legR.knee.rotation.x =-Math.max(0,Math.sin(e.phase+0.95+Math.PI))*0.34;
      /* An outlaw is built facing his own -z, so an arm swung round to +z is
         pointing out behind him. This pose was negative, which is how the whole
         town came to draw down over its own shoulder - it just never showed
         until the gun came up properly. Positive is out in front. */
      e.armL.rotation.x=damp(e.armL.rotation.x,-0.15,6,dt);
      e.armR.rotation.x=damp(e.armR.rotation.x,0.90,9,dt);   // gun out, held low
      lift=Math.abs(Math.sin(e.phase))*0.018;
    }
    p.x=e.x; p.z=e.z; p.y=terrainH(e.x,e.z)+lift;

    /* Presenting the pistol. The swings above are what the arms do while he is
       just closing the ground; this takes the gun arm over the moment he has
       you, so the Colt is levelled at you before the shot rather than hanging at
       his side through it. One arm, the way a man actually shoots a single
       action - the off hand stays where the walk put it. Blended by `present`
       rather than switched, so he brings it up instead of snapping to it, and
       the walk still shows through while he is only half round to you.

       Past a right angle the hand keeps climbing, so the recoil kick throws the
       muzzle up off the shot, which is what says who just fired at you. */
    var aiming=(los&&d<30)?1:0;
    e.present=damp(e.present,aiming,7,dt);
    e.kick=Math.max(0,e.kick-dt*4.5);
    if(e.present>0.005)
      e.armR.rotation.x=lerp(e.armR.rotation.x,1.52+e.kick*0.50,e.present);

    if(los&&d<30){
      e.fireCd-=dt*(e.alerted?1.2:1);
      if(e.fireCd<=0){ outlawShoot(e,d); e.fireCd=rr(1.15,2.5)+d*0.02; }
    }
  }
}

/* ============================================================
   17. the Ford, driven
   ============================================================ */
/* The stage runs a circuit of the town on its own. You flag it down and
   ride in the bed; the driver does the work. */
function toggleCar(){
  if(GAME.state!=='play')return;
  if(P.inCar){
    var ox=car.x-Math.cos(car.yaw)*2.7, oz=car.z+Math.sin(car.yaw)*2.7;
    var c=collide(ox,oz,0.5,0); P.x=c[0]; P.z=c[1]; P.y=terrainH(P.x,P.z);
    P.inCar=false; car.occupied=false;
    say('down off the wagon',1.4);
  }else{
    if(Math.hypot(P.x-car.x,P.z-car.z)>4.8)return;
    P.inCar=true; car.occupied=true; P.yaw=Math.PI-car.yaw;
    AU.whinny(); say('riding along',1.8);
  }
}

function updateCar(dt){
  // --- the driver picks his line toward the next waypoint ---
  var wp=ROUTE[car.wp], nw=ROUTE[(car.wp+1)%ROUTE.length];
  var tx=wp[0]-car.x, tz=wp[1]-car.z, td=Math.sqrt(tx*tx+tz*tz);
  if(td<8){
    car.wp=(car.wp+1)%ROUTE.length;
    wp=ROUTE[car.wp]; nw=ROUTE[(car.wp+1)%ROUTE.length];
    tx=wp[0]-car.x; tz=wp[1]-car.z; td=Math.sqrt(tx*tx+tz*tz);
  }
  var off=angWrap(Math.atan2(tx,tz)-car.yaw);

  /* He looks a wagon length up the road rather than driving by touch. If the
     pole is aimed at something solid he probes to either side and takes the
     clear one, which is what keeps him off the windmill on the turn into the
     south lane - the corner there is cut fine enough that the old line went
     straight through its legs. */
  var avoid=0;
  if(!carClear(car.x+Math.sin(car.yaw)*7.0,car.z+Math.cos(car.yaw)*7.0)){
    var la=car.yaw-0.7, ra=car.yaw+0.7;
    var lOK=carClear(car.x+Math.sin(la)*7.0,car.z+Math.cos(la)*7.0);
    var rOK=carClear(car.x+Math.sin(ra)*7.0,car.z+Math.cos(ra)*7.0);
    avoid=(lOK&&!rOK)?-1:((rOK&&!lOK)?1:(off<0?-1:1));
  }

  /* He slows for the corner he can see coming, not the one he is already in:
     the angle between this leg and the next, weighted by how close he is. */
  var corner=Math.abs(angWrap(Math.atan2(nw[0]-wp[0],nw[1]-wp[1])-Math.atan2(tx,tz)));
  var ease=Math.max(clamp((18-td)/12,0,1)*clamp(corner/1.3,0,1),clamp(Math.abs(off),0,1));
  car.hurry=damp(car.hurry,1,0.5,dt);
  var want=lerp(10.0,3.8,ease)*car.hurry;

  // backing out of a jam
  if(car.rev>0){
    car.rev-=dt; want=-3.2;
    /* Backing out, he takes his bearing from the nearest waypoint rather than
       the next one along. Stepping the route while off it was what turned one
       bump into a tour of the back lots: every jam advanced the target, and
       the new target was across somebody's building. */
    if(car.rev<=0){
      car.stuck=0;
      var best=car.wp, bd=1e9;
      for(var wi=0;wi<ROUTE.length;wi++){
        var wdx=ROUTE[wi][0]-car.x, wdz=ROUTE[wi][1]-car.z, wd=wdx*wdx+wdz*wdz;
        if(wd<bd){ bd=wd; best=wi; }
      }
      car.wp=best;
    }
  }
  car.steer=damp(car.steer,car.rev>0?-car.escape:clamp(off*1.9+avoid*1.5,-1,1),7,dt);

  var s=car.speed;
  s+=clamp(want-s,-1,1)*7.0*dt;
  s-=s*0.22*dt;
  s=clamp(s,-4,15);
  car.speed=s;

  // A floor under the grip, so a wagon pinned against something can still
  // turn its way out; without it, stopped meant stuck forever.
  var grip=clamp(Math.abs(s)/5,0.30,1);
  car.yaw+=car.steer*1.75*grip*(s<0?-1:1)*dt;

  var nx=car.x+Math.sin(car.yaw)*s*dt, nz=car.z+Math.cos(car.yaw)*s*dt;
  var c=collide(nx,nz,1.6,0,true);
  var bumped=Math.abs(c[0]-nx)>0.001||Math.abs(c[1]-nz)>0.001;
  var hx=c[0]+Math.sin(car.yaw)*3.7, hz=c[1]+Math.cos(car.yaw)*3.7;   // the team, out front
  var hc=collide(hx,hz,1.0,0,true);
  if(Math.abs(hc[0]-hx)>0.001||Math.abs(hc[1]-hz)>0.001){
    c[0]+=(hc[0]-hx)*0.9; c[1]+=(hc[1]-hz)*0.9; bumped=true;
  }
  if(bumped&&car.rev<=0){
    car.speed*=0.5; car.stuck+=dt;
    if(car.stuck>0.7){ car.rev=1.3; car.escape=(off<0?-1:1); }
  }else car.stuck=Math.max(0,car.stuck-dt*1.6);
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

  // the team trots on diagonal pairs, faster the harder he pushes them
  car.gait+=dt*(1.7+Math.abs(s)*0.80);
  var amp=clamp(Math.abs(s)/5.5,0.10,1);
  for(var hi=0;hi<car.horses.length;hi++){
    var H=car.horses[hi], ph=car.gait+hi*0.62;
    for(var L=0;L<4;L++){
      var lg=H.legs[L], lo=(L===0||L===3)?0:Math.PI;
      lg.up.rotation.x=Math.sin(ph+lo)*0.58*amp;
      lg.lo.rotation.x=-Math.max(0,Math.sin(ph+lo+0.9))*0.80*amp;
    }
    H.g.position.y=Math.abs(Math.sin(ph))*0.05*amp;
    H.neck.rotation.x=H.neckBase+Math.sin(ph*2)*0.06*amp;
    H.tail.rotation.z=Math.sin(car.gait*0.8+hi)*0.14;
  }
  if(Math.abs(s)>0.5){
    /* The beat used to be reset to a flat 1 and only ever fired once per frame,
       which threw the overshoot away every time - so the gap between hoofbeats
       was the frame it happened to be noticed on rather than the stride, and a
       long frame swallowed a beat outright. Carrying the remainder keeps the
       team in step, and placing each one on the audio clock at the moment it was
       actually due takes the frame timing out of it altogether. */
    var rate=(1.7+Math.abs(s)*0.80)/Math.PI;
    car.beat-=dt*rate;
    var guard=0;
    while(car.beat<=0&&guard++<4){
      var late=-car.beat/rate;                     // it fell due this far back
      AU.clop(clamp(Math.abs(s)/9,0.25,1),AU.now()+Math.max(0,0.06-late));
      car.beat+=1;
    }
  }
  if(Math.abs(s)>2&&rnd()<dt*12)
    FX.puff(new THREE.Vector3(car.x-Math.sin(car.yaw)*1.6,gy+0.2,car.z-Math.cos(car.yaw)*1.6),1,0xC2A177,0.32,0.6,0.5);
  if(s>5){                                        // he does not slow down for anybody
    var rx2=car.x+Math.sin(car.yaw)*3.4, rz2=car.z+Math.cos(car.yaw)*3.4;
    for(var i=0;i<enemies.length;i++){
      var e=enemies[i]; if(e.dead)continue;
      if(Math.hypot(e.x-rx2,e.z-rz2)<2.9||Math.hypot(e.x-car.x,e.z-car.z)<2.4){
        killOutlaw(e,'car');
        FX.puff(new THREE.Vector3(e.x,gy+1,e.z),6,0xB79468,0.32,2.2,1.4);
      }
    }
  }

  if(P.inCar){                                    // sitting in the bed, behind the driver
    P.x=car.x; P.z=car.z; P.y=gy;
    P.moving=clamp(Math.abs(s)/8,0,1);
    var aligned=Math.PI-car.yaw, look=angWrap(P.yaw-aligned);
    if(look> 2.4) look= 2.4; if(look<-2.4) look=-2.4;
    P.yaw=aligned+look;
    // shifted right of the driver so his back is not in the middle of the view
    camera.position.set(car.x-Math.sin(car.yaw)*0.72-Math.cos(car.yaw)*0.42,
                        gy+2.02,
                        car.z-Math.cos(car.yaw)*0.72+Math.sin(car.yaw)*0.42);
    camera.rotation.set(P.pitch,P.yaw,0,'YXZ');
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
  $('ovTitle').textContent=won?'The Street Is Quiet':'Buried in the Dust';
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
    ui.ammoOf.textContent=P.weapon==='rifle'?' / 9':' / 6';
    ui.guns.hidden=!P.hasRifle;
    ui.gunColt.classList.toggle('on',P.weapon==='colt');
    ui.gunRifle.classList.toggle('on',P.weapon==='rifle');
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
  ui.prompt.textContent=P.inCar?'F · step down':'F · ride along';
  if(P.weapon==='rifle'&&!near&&!P.inCar){
    ui.prompt.textContent='Hold right mouse to aim  ·  1 or wheel for the Colt';
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
/* Both pieces are written for the room they are in rather than borrowed: a
   twelve bar honky-tonk vamp in G for the Occidental, oom-pah in the left hand
   and the right hand mostly on the chord tones, and a slow eight bar chorale in
   F for the church. Bass and melody are separate tracks so each keeps its own
   place in the bar. Notes are MIDI numbers, then beats, then how hard. */
var bandStarted=false;
function bandStart(){
  if(bandStarted||!MUSIC.ok)return;
  bandStarted=true;

  // G G G G | C C G G | D C G D, as root, chord, fifth, chord
  var BARS=[43,43,43,43,48,48,43,43,50,48,43,50], bass=[], b, r;
  for(b=0;b<BARS.length;b++){
    r=BARS[b];
    bass.push([r,1,0.34]);
    bass.push([[r+12,r+16,r+19],1,0.16]);
    bass.push([r+7,1,0.30]);
    bass.push([[r+12,r+16,r+19],1,0.16]);
  }
  var tune=[
    [71,.5,.4],[74,.5,.4],[79,1,.5],[78,.5,.4],[76,.5,.4],[74,1,.42],
    [71,.5,.4],[74,.5,.4],[71,.5,.4],[69,.5,.4],[67,2,.46],
    [67,.5,.4],[71,.5,.4],[74,1,.46],[76,.5,.4],[74,.5,.4],[71,1,.42],
    [69,1,.42],[71,1,.42],[74,2,.46],
    [72,.5,.4],[76,.5,.4],[79,1,.5],[76,.5,.4],[72,.5,.4],[76,1,.42],
    [77,.5,.42],[76,.5,.4],[74,.5,.4],[72,.5,.4],[71,2,.46],
    [71,.5,.4],[74,.5,.4],[79,1,.5],[78,.5,.4],[76,.5,.4],[74,1,.42],
    [74,.5,.4],[71,.5,.4],[69,.5,.4],[67,.5,.4],[67,2,.46],
    [69,.5,.4],[74,.5,.4],[78,1,.48],[76,.5,.4],[74,.5,.4],[69,1,.42],
    [72,.5,.4],[76,.5,.4],[79,1,.48],[77,.5,.4],[76,.5,.4],[72,1,.42],
    [71,.5,.4],[74,.5,.4],[79,1,.5],[78,.5,.4],[76,.5,.4],[74,1,.42],
    [74,1,.44],[72,1,.42],[71,1,.42],[0,1,0]
  ];
  MUSIC.add('saloon0','piano',116,0.85,0.16,[bass,tune]);

  // F  Bb | C  F | Dm Bb | C  F, held long at the end and let go into the room
  var hymn=[
    [[41,65,69,72],4,.30],[[46,65,70,74],4,.30],
    [[48,64,67,72],4,.30],[[41,65,69,77],4,.30],
    [[50,65,69,74],4,.30],[[46,65,70,74],4,.30],
    [[48,64,67,72],2,.30],[[48,65,69,72],2,.30],
    [[41,65,69,72],6,.32],[0,2,0]
  ];
  MUSIC.add('church','organ',60,0.62,0.55,[hymn]);
}

function updateAmbient(dt,cam){
  MUSIC.update(P.x,P.z);
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
var perfOn=false, perfT=0, perfN=0, perfWorst=0;
function frame(now){
  requestAnimationFrame(frame);
  /* dt is clamped so that a stall cannot teleport anybody through a wall. The
     readout wants the real number though - a hitch is the whole complaint, and
     the clamp is exactly what would hide it. */
  var raw=(now-last)/1000;
  var dt=Math.min(0.05,raw); last=now;

  renderer.info.reset();                // autoReset is off, so both passes land in one count

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

  if(perfOn){
    perfT+=raw; perfN++;
    if(raw>perfWorst) perfWorst=raw;    // the drop is what you feel, not the average
    if(perfT>=0.5){
      var r=renderer.info.render;
      ui.perf.textContent=[
        Math.round(perfN/perfT)+' fps   '+(perfT/perfN*1000).toFixed(1)+' ms',
        'worst '+(perfWorst*1000).toFixed(0)+' ms',
        r.calls+' draws   '+(r.triangles/1000).toFixed(0)+'k tris'
      ].join('\n');
      perfT=0; perfN=0; perfWorst=0;
    }
  }
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
  AU.init(); AU.resume(); MUSIC.init(); bandStart();
  GAME.state='play'; GAME.paused=false;
  GAME.kills=0; GAME.left=0; GAME.wave=0; GAME.shots=0; GAME.hits=0; GAME.t=0; GAME.hp=100; GAME.nextWaveT=3.2;
  P.x=-34; P.z=0; P.y=terrainH(-34,0); P.vy=0; P.yaw=-Math.PI/2; P.pitch=-0.02;
  P.ammo=6; P.reloading=false; P.recoil=0; P.inCar=false; P.hurtT=0; P.fireHeld=false;
  dropAds();
  P.weapon='colt'; P.hasRifle=false; P.rifleAmmo=0; P.rifleWork=0;
  ui.guns.hidden=true;
  if(riflePickup){ if(!riflePickup.taken) world.remove(riflePickup.g); riflePickup=null; }
  ui.pause.classList.add('gone'); $('fullKeys').hidden=true;
  for(var dI=0;dI<doors.length;dI++){ doors[dI].a=0; doors[dI].v=0; doors[dI].hL.rotation.y=0; doors[dI].hR.rotation.y=0; }
  lastWeapon='';
  car.x=25; car.z=-39; car.yaw=-Math.PI/2; car.speed=6; car.steer=0; car.occupied=false;
  car.wp=4; car.hurry=1; car.stuck=0; car.rev=0; P.cylIndex=0;   // out on the back leg, westbound
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

/* Work through the queued stages a frame apart. The label goes up before the
   work it names rather than after, because that work blocks the frame it runs
   in - so by the time the browser paints the label, the stage it names is the
   one under way. Nothing is clickable until the last of them is done. */
function runBuild(){
  if(!BUILD.length){
    setLoad('Ready',1);
    requestAnimationFrame(frame);
    setTimeout(ready,420);
    return;
  }
  var s=BUILD[0];
  setLoad(s.label,0.12+0.88*(BUILT/BUILD_W));
  requestAnimationFrame(function(){
    BUILD.shift(); s.fn(); BUILT+=s.w;
    runBuild();
  });
}

/* Nothing gets you past this screen until the bar is full - same as the
   portfolio, where the sequence cannot be skipped. Then the button turns up
   and a click or a key anywhere will do, so you are not hunting for it. */
/* The bar hands its place over to the button, so the card never offers a way
   in before there is one. */
function ready(){
  $('loadRow').hidden=true;
  $('start').hidden=false;
  try{ $('start').focus(); }catch(e){}
}
runBuild();
}

setLoad('Mixing the paint',0.12);
requestAnimationFrame(function(){ requestAnimationFrame(boot); });
})();
