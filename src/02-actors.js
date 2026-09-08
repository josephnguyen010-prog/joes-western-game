
/* ============================================================
   8. line of sight against the town footprints
   ============================================================ */
function losClear(ax,az,bx,bz){
  var dx=bx-ax, dz=bz-az;
  for(var i=0;i<blockers.length;i++){
    var b=blockers[i], t0=0, t1=1, ok=true;
    for(var a=0;a<2;a++){
      var p=a?dz:dx, o=a?az:ax, lo=a?b.z0:b.x0, hi=a?b.z1:b.x1;
      if(Math.abs(p)<1e-6){ if(o<lo||o>hi){ok=false;break;} continue; }
      var ta=(lo-o)/p, tb=(hi-o)/p;
      if(ta>tb){var s=ta;ta=tb;tb=s;}
      if(ta>t0)t0=ta; if(tb<t1)t1=tb;
      if(t0>t1){ok=false;break;}
    }
    if(ok) return false;
  }
  return true;
}

/* ============================================================
   9. effect pools - tracers, impacts, puffs, brass
   ============================================================ */
var FX=(function(){
  var tracers=[],impacts=[],puffs=[],brass=[];
  var tMat=new THREE.LineBasicMaterial({color:0xFFE2A8,transparent:true,opacity:0.9});
  var i,g,m;
  for(i=0;i<24;i++){
    g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
    m=new THREE.Line(g,tMat.clone()); m.visible=false; m.frustumCulled=false;
    scene.add(m); tracers.push({m:m,life:0});
  }
  var hMat=new THREE.MeshBasicMaterial({color:0x1a1310,transparent:true,opacity:0.85,depthWrite:false});
  var hGeo=new THREE.CircleGeometry(0.075,7);
  for(i=0;i<34;i++){ m=new THREE.Mesh(hGeo,hMat.clone()); m.visible=false; scene.add(m); impacts.push({m:m,life:0}); }
  var pGeo=new THREE.SphereGeometry(1,6,5);
  for(i=0;i<54;i++){
    m=new THREE.Mesh(pGeo,new THREE.MeshBasicMaterial({color:0xCBA271,transparent:true,opacity:0,depthWrite:false}));
    m.visible=false; scene.add(m); puffs.push({m:m,life:0,max:1,vy:0,vx:0,vz:0,grow:1});
  }
  var bGeo=new THREE.CylinderGeometry(0.008,0.008,0.026,6);
  var bMat=new THREE.MeshStandardMaterial({color:0xD9A441,metalness:0.9,roughness:0.3});
  for(i=0;i<14;i++){ m=new THREE.Mesh(bGeo,bMat); m.visible=false; scene.add(m); brass.push({m:m,life:0,v:new THREE.Vector3(),s:new THREE.Vector3()}); }

  function tracer(a,b){
    for(var i=0;i<tracers.length;i++) if(tracers[i].life<=0){
      var t=tracers[i], p=t.m.geometry.attributes.position;
      p.setXYZ(0,a.x,a.y,a.z); p.setXYZ(1,b.x,b.y,b.z); p.needsUpdate=true;
      t.m.geometry.computeBoundingSphere();
      t.m.visible=true; t.m.material.opacity=0.95; t.life=0.075; return;
    }
  }
  function impact(p,n){
    for(var i=0;i<impacts.length;i++) if(impacts[i].life<=0){
      var h=impacts[i];
      h.m.position.copy(p).addScaledVector(n,0.02);
      h.m.lookAt(p.clone().add(n));
      h.m.material.opacity=0.85; h.m.visible=true; h.life=7; return;
    }
  }
  function puff(p,count,color,size,speed,rise){
    for(var k=0;k<count;k++){
      for(var i=0;i<puffs.length;i++) if(puffs[i].life<=0){
        var q=puffs[i];
        q.m.position.copy(p);
        q.m.material.color.setHex(color);
        q.m.material.opacity=0.75; q.m.visible=true;
        var s=size*rr(0.55,1.35); q.m.scale.setScalar(s); q.grow=s*rr(1.6,3.0);
        q.vx=rr(-speed,speed); q.vz=rr(-speed,speed); q.vy=rise*rr(0.5,1.4);
        q.max=q.life=rr(0.45,0.95);
        break;
      }
    }
  }
  function eject(p,dir,up){
    for(var i=0;i<brass.length;i++) if(brass[i].life<=0){
      var b=brass[i];
      b.m.position.copy(p); b.m.visible=true;
      b.v.copy(dir).multiplyScalar(rr(1.4,2.6)).addScaledVector(up,rr(1.6,2.6));
      b.s.set(rr(-14,14),rr(-14,14),rr(-14,14));
      b.life=1.6; return;
    }
  }
  function step(dt){
    var i,t;
    for(i=0;i<tracers.length;i++){ t=tracers[i]; if(t.life>0){ t.life-=dt; t.m.material.opacity=Math.max(0,t.life/0.075)*0.95; if(t.life<=0)t.m.visible=false; } }
    for(i=0;i<impacts.length;i++){ t=impacts[i]; if(t.life>0){ t.life-=dt; if(t.life<1.2)t.m.material.opacity=t.life/1.2*0.85; if(t.life<=0)t.m.visible=false; } }
    for(i=0;i<puffs.length;i++){ t=puffs[i]; if(t.life>0){
      t.life-=dt; var u=1-t.life/t.max;
      t.m.position.x+=t.vx*dt; t.m.position.z+=t.vz*dt; t.m.position.y+=t.vy*dt;
      t.vy-=1.2*dt; t.vx*=0.94; t.vz*=0.94;
      t.m.scale.setScalar(lerp(t.m.scale.x,t.grow,dt*3));
      t.m.material.opacity=0.75*(1-u)*(1-u);
      if(t.life<=0)t.m.visible=false;
    } }
    for(i=0;i<brass.length;i++){ t=brass[i]; if(t.life>0){
      t.life-=dt; t.v.y-=13*dt;
      t.m.position.addScaledVector(t.v,dt);
      t.m.rotation.x+=t.s.x*dt; t.m.rotation.y+=t.s.y*dt; t.m.rotation.z+=t.s.z*dt;
      var gy=terrainH(t.m.position.x,t.m.position.z)+0.02;
      if(t.m.position.y<gy){ t.m.position.y=gy; t.v.y*=-0.32; t.v.x*=0.6; t.v.z*=0.6; t.s.multiplyScalar(0.5);
        if(Math.abs(t.v.y)>0.6) AU.clink(); }
      if(t.life<=0)t.m.visible=false;
    } }
  }
  return {tracer:tracer,impact:impact,puff:puff,eject:eject,step:step};
})();

/* ============================================================
   10. the revolver - single action, six chambers, loaded one at a time
   ============================================================ */
var BLUE  =new THREE.MeshStandardMaterial({color:0x353D46,metalness:0.92,roughness:0.22,envMap:ENV,envMapIntensity:1.20});
var CASE  =new THREE.MeshStandardMaterial({color:0x4B5157,metalness:0.86,roughness:0.34,envMap:ENV,envMapIntensity:1.00});
var STEEL =new THREE.MeshStandardMaterial({color:0x454B52,metalness:0.90,roughness:0.28,envMap:ENV,envMapIntensity:1.05});
var WALNUT=new THREE.MeshStandardMaterial({color:0x7A4A26,metalness:0.03,roughness:0.54});
var BRASSY=new THREE.MeshStandardMaterial({color:0xC9A24A,metalness:0.90,roughness:0.28,envMap:ENV});
var gun=new THREE.Group();
var gunRig=new THREE.Group();   // holds recoil and aim motion
var cylGroup=new THREE.Group();
var hammer,flash;

/* A Colt Single Action Army at life size: 7.5in barrel, 42mm cylinder,
   blued barrel and cylinder against a case-hardened frame, steel grip
   frame and trigger guard, one-piece walnut grips flaring to the butt. */
(function buildGun(){
  function gb(w,h,d,mat,x,y,z,p){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(p||gun).add(m);return m;}
  function gc(r1,r2,len,seg,mat,x,y,z,axis,p){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,seg),mat);
    if(axis==='z') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.z=Math.PI/2;
    m.position.set(x,y,z); (p||gun).add(m); return m;
  }
  // --- frame: standing breech, top strap, bottom rail, front post ---
  gb(0.032,0.050,0.028,CASE,0,0.002,0.040);                   // standing breech
  gc(0.023,0.023,0.011,18,CASE,0,0.000,0.028,'z');            // recoil shield
  gb(0.024,0.010,0.072,CASE,0,0.029,0.006);                   // top strap
  gb(0.014,0.005,0.070,BLUE,0,0.034,0.006);                   // sighting groove down the strap
  gb(0.028,0.021,0.062,CASE,0,-0.026,0.014);                  // bottom rail
  gb(0.030,0.050,0.014,CASE,0,0.002,-0.032);                  // front frame post
  gc(0.0030,0.0030,0.034,8,STEEL,0,-0.020,0.038,'x');         // frame screws
  gc(0.0030,0.0030,0.034,8,STEEL,0,0.006,0.046,'x');
  gc(0.0026,0.0026,0.034,8,STEEL,0,-0.030,0.062,'x');
  gb(0.009,0.026,0.024,CASE,0.019,0.002,0.034).rotation.y=-0.12;   // loading gate

  // --- barrel, blued, in line with the top chamber ---
  gc(0.0118,0.0100,0.190,16,BLUE,0,0.0125,-0.126,'z');
  gb(0.009,0.006,0.150,BLUE,0,0.0215,-0.120);                 // sight rib
  gb(0.005,0.012,0.009,BLUE,0,0.0255,-0.209);                 // front sight blade
  /* The ejector rod housing rides UNDER the barrel at about four o'clock,
     tucked slightly to the right - not out on the flank. Offsetting it
     0.0137 down and 0.0068 right leaves it overlapping the barrel by 5mm,
     so the two read as brazed together the way they are on the real gun. */
  gc(0.0078,0.0078,0.132,10,BLUE,0.0068,-0.0012,-0.104,'z');  // ejector rod housing
  gc(0.0102,0.0102,0.024,10,STEEL,0.0068,-0.0012,-0.181,'z'); // rod head
  gc(0.0040,0.0040,0.030,8,STEEL,0.0068,-0.0012,-0.030,'z');  // the rod itself, out the back
  gc(0.0048,0.0048,0.026,8,STEEL,0,0.0035,-0.036,'z');        // base pin head, under the barrel

  // --- cylinder: 42mm, fluted, six mouths ---
  gc(0.0210,0.0210,0.041,20,BLUE,0,0,0,'z',cylGroup);
  gc(0.0175,0.0175,0.006,18,STEEL,0,0,0.023,'z',cylGroup);
  gc(0.0115,0.0115,0.008,12,STEEL,0,0,0.026,'z',cylGroup);    // ratchet
  for(var f=0;f<6;f++){
    var a=f/6*TAU;
    var fl=gb(0.012,0.005,0.030,MAT.dark,Math.cos(a)*0.0187,Math.sin(a)*0.0187,-0.002,cylGroup);
    fl.rotation.z=a+Math.PI/2;                                 // flutes, sunk flush
    gc(0.0055,0.0055,0.044,8,MAT.dark,Math.cos(a+0.5236)*0.0125,Math.sin(a+0.5236)*0.0125,0,'z',cylGroup);
  }
  cylGroup.position.set(0,0,-0.004); gun.add(cylGroup);

  // --- trigger and steel guard, part of the grip frame ---
  var guard=new THREE.Mesh(new THREE.TorusGeometry(0.0205,0.0038,7,20),STEEL);
  guard.rotation.y=Math.PI/2; guard.position.set(0,-0.033,0.018); gun.add(guard);
  gb(0.007,0.021,0.008,STEEL,0,-0.026,0.018).rotation.x=0.16;

  /* The plow handle. One pivot at the frame and a second lower down, so the
     grip curves and flares to the butt the way the real one does. */
  var gripG=new THREE.Group(); gripG.position.set(0,-0.030,0.054); gripG.rotation.x=0.30; gun.add(gripG);
  gb(0.033,0.048,0.013,STEEL,0,-0.022,0.021,gripG);           // backstrap
  gb(0.027,0.040,0.012,STEEL,0,-0.018,-0.019,gripG);          // front strap
  gb(0.027,0.040,0.032,WALNUT,0,-0.020,0.000,gripG);
  gb(0.006,0.038,0.030,WALNUT,-0.0145,-0.020,0.000,gripG);
  gb(0.006,0.038,0.030,WALNUT, 0.0145,-0.020,0.000,gripG);
  var lowG=new THREE.Group(); lowG.position.set(0,-0.040,0.002); lowG.rotation.x=0.27; gripG.add(lowG);
  gb(0.032,0.050,0.013,STEEL,0,-0.024,0.020,lowG);            // backstrap, lower
  gb(0.031,0.048,0.031,WALNUT,0,-0.022,0.000,lowG);
  gb(0.007,0.046,0.029,WALNUT,-0.0155,-0.022,0.000,lowG);
  gb(0.007,0.046,0.029,WALNUT, 0.0155,-0.022,0.000,lowG);
  gb(0.036,0.020,0.034,WALNUT,0,-0.042,0.004,lowG);           // the flare at the heel
  gb(0.009,0.020,0.032,WALNUT,-0.0175,-0.042,0.004,lowG);
  gb(0.009,0.020,0.032,WALNUT, 0.0175,-0.042,0.004,lowG);
  gb(0.038,0.010,0.036,STEEL,0,-0.055,0.006,lowG);            // butt cap
  gc(0.0024,0.0024,0.032,8,STEEL,0,-0.022,0.000,'x',lowG);    // grip screw

  /* The hammer: a wide checkered spur sweeping up and back, which is most
     of what makes the profile read as a Colt. */
  hammer=new THREE.Group(); hammer.position.set(0,0.024,0.046); gun.add(hammer);
  gb(0.011,0.036,0.013,CASE,0,0.016,0.003,hammer);            // hammer body
  gb(0.013,0.014,0.012,CASE,0,0.033,0.007,hammer);            // the throat of the spur
  var spur=gb(0.018,0.011,0.030,CASE,0,0.040,0.019,hammer); spur.rotation.x=0.72;
  var tip=gb(0.018,0.009,0.014,CASE,0,0.045,0.034,hammer); tip.rotation.x=1.15;
  for(var k=0;k<5;k++){
    gb(0.019,0.0018,0.0035,BLUE,0,0.0435+k*0.0016,0.010+k*0.0056,hammer).rotation.x=0.72;
  }

  // --- muzzle flash ---
  var fg=new THREE.Group();
  var fm=new THREE.MeshBasicMaterial({color:0xFFC963,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  fg.add(new THREE.Mesh(new THREE.PlaneGeometry(0.24,0.24),fm));
  var f2=new THREE.Mesh(new THREE.PlaneGeometry(0.24,0.24),fm); f2.rotation.z=Math.PI/2; f2.rotation.y=Math.PI/2; fg.add(f2);
  var f3=new THREE.Mesh(new THREE.ConeGeometry(0.036,0.14,7,1,true),fm); f3.rotation.x=-Math.PI/2; f3.position.z=-0.06; fg.add(f3);
  fg.position.set(0,0.0125,-0.235); gun.add(fg);
  flash={g:fg,m:fm};

  gun.traverse(function(o){ if(o.isMesh) o.renderOrder=2; });
  gunRig.add(gun); gunScene.add(gunRig);
  gunRig.position.set(0.145,-0.075,-0.39);
  gunRig.rotation.y=0.20;
})();

/* ============================================================
   10b. the Springfield, as you carry it
   ============================================================ */
var rifleRig=new THREE.Group(), rifleLever=null, rflash=null;
function springfield(R,detail){
  function rb(w,h,d,mat,x,y,z,p){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(p||R).add(m);return m;}
  function rc(r1,r2,len,seg,mat,x,y,z,axis,p){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,seg),mat);
    if(axis==='z') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.z=Math.PI/2;
    m.position.set(x,y,z); (p||R).add(m); return m;
  }
  rc(0.0138,0.0104,0.840,14,BLUE,0,0.016,-0.420,'z');          // barrel
  rb(0.046,0.050,0.680,WALNUT,0,-0.010,-0.360);                // forestock
  rb(0.054,0.054,0.030,STEEL,0,0.004,-0.300);                  // barrel bands
  rb(0.054,0.054,0.030,STEEL,0,0.004,-0.620);
  rb(0.052,0.050,0.044,STEEL,0,0.002,-0.706);                  // nose cap
  rc(0.0048,0.0048,0.600,7,STEEL,0,-0.020,-0.400,'z');         // ramrod
  rb(0.044,0.056,0.175,CASE,0,0.004,0.055);                    // receiver
  rb(0.050,0.048,0.115,WALNUT,0,-0.020,0.108);                 // lock plate seat
  rb(0.040,0.054,0.140,WALNUT,0,-0.030,0.190);                 // wrist
  rb(0.048,0.100,0.265,WALNUT,0,-0.046,0.362);                 // butt
  rb(0.048,0.040,0.090,WALNUT,0,0.006,0.268);                  // comb
  rb(0.050,0.128,0.022,STEEL,0,-0.050,0.498);                  // buttplate
  rb(0.007,0.021,0.009,STEEL,0,-0.036,0.078).rotation.x=0.12;  // trigger
  rb(0.014,0.010,0.088,STEEL,0,-0.046,0.088);                  // guard, bottom strap
  rb(0.012,0.026,0.011,STEEL,0,-0.036,0.048);                  // guard, front post
  rb(0.012,0.026,0.011,STEEL,0,-0.036,0.130);                  // guard, rear post
  // the trapdoor breechblock, hinged at its forward edge
  rifleLever=new THREE.Group(); rifleLever.position.set(0,0.030,-0.018); R.add(rifleLever);
  rb(0.038,0.024,0.076,CASE,0,0.005,0.040,rifleLever);
  rb(0.030,0.012,0.018,CASE,0,0.020,0.070,rifleLever);         // the thumb latch
  // side hammer, on the right of the lock
  var hm=new THREE.Group(); hm.position.set(0.024,0.010,0.104); R.add(hm);
  rb(0.010,0.038,0.014,CASE,0,0.016,0,hm);
  rb(0.012,0.012,0.022,CASE,0,0.033,0.008,hm).rotation.x=0.7;
  // iron sights: a ladder rear leaf and a front blade
  rb(0.022,0.010,0.046,STEEL,0,0.030,-0.098);
  rb(0.018,0.014,0.006,STEEL,0,0.041,-0.098);
  rb(0.005,0.011,0.006,STEEL,-0.0065,0.049,-0.098);            // the notch, either side
  rb(0.005,0.011,0.006,STEEL, 0.0065,0.049,-0.098);
  rb(0.016,0.011,0.026,STEEL,0,0.028,-0.800);                  // front sight base
  rb(0.005,0.013,0.008,STEEL,0,0.040,-0.800);                  // front blade
  if(detail){
    var sw1=new THREE.Mesh(new THREE.TorusGeometry(0.012,0.0028,5,10),STEEL);
    sw1.rotation.y=Math.PI/2; sw1.position.set(0,-0.040,-0.300); R.add(sw1);
    var sw2=new THREE.Mesh(new THREE.TorusGeometry(0.012,0.0028,5,10),STEEL);
    sw2.rotation.y=Math.PI/2; sw2.position.set(0,-0.076,0.300); R.add(sw2);
  }
  return R;
}
(function buildRifle(){
  var R=new THREE.Group();
  springfield(R,true);
  var fm=new THREE.MeshBasicMaterial({color:0xFFD98A,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  var fg=new THREE.Group();
  fg.add(new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.32),fm));
  var f2=new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.32),fm); f2.rotation.z=Math.PI/2; f2.rotation.y=Math.PI/2; fg.add(f2);
  var f3=new THREE.Mesh(new THREE.ConeGeometry(0.048,0.20,7,1,true),fm); f3.rotation.x=-Math.PI/2; f3.position.z=-0.09; fg.add(f3);
  fg.position.set(0,0.016,-0.860); R.add(fg);
  rflash={g:fg,m:fm};
  R.traverse(function(o){ if(o.isMesh) o.renderOrder=2; });
  rifleRig.add(R); gunScene.add(rifleRig);
  rifleRig.position.set(0.115,-0.110,-0.40);
  rifleRig.rotation.y=0.09;
  rifleRig.visible=false;
})();

/* a Springfield lying where its owner left it */
function makeRiflePickup(x,y,z){
  var g=new THREE.Group();
  var R=new THREE.Group(); springfield(R,false); g.add(R);
  g.traverse(function(o){ if(o.isMesh) o.castShadow=true; });
  g.position.set(x,y,z); g.rotation.y=0.6; g.rotation.z=0.06;
  R.position.y=0.10;
  world.add(g);
  return {g:g,x:x,y:y,z:z,taken:false,t:0};
}

/* ============================================================
   11. the outlaws
   ============================================================ */
var COATS=[0x4a3f34,0x5b4636,0x3b3a40,0x6b5a3f,0x554438];
var enemies=[];

function Outlaw(x,z,name){
  var g=new THREE.Group();
  var coat=new THREE.MeshLambertMaterial({color:pick(COATS)});
  var shirt=new THREE.MeshLambertMaterial({color:pick([0x8a7f66,0x7a6a58,0x93856a])});
  var skin=new THREE.MeshLambertMaterial({color:0xC59A72});
  var hatm=new THREE.MeshLambertMaterial({color:pick([0x2c241c,0x3d3226,0x4a3a28])});
  function bx(w,h,d,m,px,py,pz,p){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(px,py,pz);q.castShadow=true;(p||g).add(q);return q;}

  // jointed legs: hip pivot, knee pivot, foot - a straight box cannot run
  function limb(px){
    var hipG=new THREE.Group(); hipG.position.set(px,0.95,0); g.add(hipG);
    var up=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.46,0.22),shirt);
    up.position.y=-0.23; up.castShadow=true; hipG.add(up);
    var kneeG=new THREE.Group(); kneeG.position.y=-0.46; hipG.add(kneeG);
    var lo=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.44,0.18),shirt);
    lo.position.y=-0.22; lo.castShadow=true; kneeG.add(lo);
    var ft=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.10,0.29),MAT.dark);
    ft.position.set(0,-0.49,0.05); ft.castShadow=true; kneeG.add(ft);
    return {hip:hipG,knee:kneeG};
  }
  var legL=limb(-0.15), legR=limb(0.15);
  bx(0.62,0.52,0.40,coat,0,1.02,0);                                   // coat skirt
  var torso=bx(0.58,0.62,0.34,coat,0,1.50,0);
  torso.userData={owner:null,part:'body'};
  var armL=bx(0.15,0.58,0.17,coat,-0.36,1.52,0.02);
  var armR=bx(0.15,0.58,0.17,coat, 0.36,1.52,0.02);
  armL.geometry.translate(0,-0.29,0); armL.position.y=1.76;
  armR.geometry.translate(0,-0.29,0); armR.position.y=1.76;
  var pistol=bx(0.05,0.07,0.20,MAT.metal,0,-0.52,-0.10,armR);
  var head=new THREE.Mesh(new THREE.SphereGeometry(0.155,10,8),skin);
  head.position.y=1.95; head.castShadow=true; g.add(head);
  head.userData={owner:null,part:'head'};
  bx(0.30,0.09,0.32,shirt,0,1.78,0);                                  // bandana
  var crown=new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.175,0.17,10),hatm);
  crown.position.y=2.10; crown.castShadow=true; g.add(crown);
  var brim=new THREE.Mesh(new THREE.CylinderGeometry(0.33,0.33,0.028,12),hatm);
  brim.position.y=2.02; brim.castShadow=true; g.add(brim);

  var e={
    g:g,name:name,hp:100,dead:false,state:'walk',
    x:x,z:z,yaw:0,phase:rr(0,TAU),fireCd:rr(0.8,2.6),strafe:rr(-1,1)>0?1:-1,strafeCd:rr(1,3),
    legL:legL,legR:legR,armL:armL,armR:armR,torso:torso,head:head,fallT:0,hitT:0,speed:rr(2.6,3.5)
  };
  torso.userData.owner=e; head.userData.owner=e;
  g.position.set(x,terrainH(x,z),z);
  world.add(g);
  hitables.push(torso); hitables.push(head);
  enemies.push(e);
  return e;
}

function killOutlaw(e,how){
  if(e.dead)return;
  e.dead=true; e.state='dead'; e.fallT=0;
  if(e.kind==='sniper') dropRifle(e.x,e.y,e.z);
  var i=hitables.indexOf(e.torso); if(i>=0)hitables.splice(i,1);
  i=hitables.indexOf(e.head); if(i>=0)hitables.splice(i,1);
  var p=e.g.position;
  FX.puff(new THREE.Vector3(p.x,p.y+1.3,p.z),5,0x7a2b1e,0.18,1.1,0.7);
  FX.puff(new THREE.Vector3(p.x,p.y+0.2,p.z),4,0xC2A177,0.30,1.4,0.5);
  AU.thud();
  GAME.kills++; GAME.left--;
  feed(e.kind==='sniper' ? 'the rifle on the Occidental is quiet'
     : how==='car' ? '<em>'+e.name+'</em> trampled by the team'
     : '<em>'+e.name+'</em> is down');
}

/* ============================================================
   11b. the rifleman on the Occidental roof
   A Sharps with a brass Malcolm scope - the 1870s answer to a sniper.
   He does not move, he ranges you, and the scope catches the sun a
   moment before he fires, which is your cue to get behind something.
   ============================================================ */
function Rifleman(x,y,z,yaw,name){
  var g=new THREE.Group();
  var coat=new THREE.MeshLambertMaterial({color:0x3E3A31});
  var shirt=new THREE.MeshLambertMaterial({color:0x7C6F58});
  var skin=new THREE.MeshLambertMaterial({color:0xC59A72});
  var hatm=new THREE.MeshLambertMaterial({color:0x2A231B});
  function bx(w,h,d,m,px,py,pz,p){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(px,py,pz);q.castShadow=true;(p||g).add(q);return q;}

  bx(0.22,0.62,0.24,shirt,-0.15,0.31,0);                      // braced on one knee
  var kneel=bx(0.22,0.24,0.62,shirt,0.16,0.12,0.14);
  bx(0.20,0.46,0.22,shirt,0.16,0.35,-0.12);
  bx(0.60,0.50,0.38,coat,0,0.80,0);
  var torso=bx(0.56,0.58,0.34,coat,0,1.26,0);
  torso.userData={owner:null,part:'body'};
  var armL=bx(0.14,0.52,0.16,coat,-0.32,1.44,0.04);
  armL.geometry.translate(0,-0.26,0); armL.position.y=1.50; armL.rotation.x=-1.25;
  var armR=bx(0.14,0.52,0.16,coat, 0.32,1.44,0.04);
  armR.geometry.translate(0,-0.26,0); armR.position.y=1.50; armR.rotation.x=-1.05;
  var head=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8),skin);
  head.position.set(0,1.70,0.02); head.castShadow=true; g.add(head);
  head.userData={owner:null,part:'head'};
  var crown=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.17,0.16,10),hatm);
  crown.position.y=1.84; crown.castShadow=true; g.add(crown);
  var brim=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.026,12),hatm);
  brim.position.y=1.76; brim.castShadow=true; g.add(brim);

  // the same Springfield you will be taking off him
  var rifle=new THREE.Group(); rifle.position.set(0.05,1.40,0.30); g.add(rifle);
  springfield(rifle,false);
  var glint=new THREE.Mesh(new THREE.SphereGeometry(0.026,8,6),
    new THREE.MeshBasicMaterial({color:0xFFF0C0,transparent:true,opacity:0}));
  glint.position.set(0,0.020,-0.30); rifle.add(glint);        // sun off the barrel band

  g.position.set(x,y,z); g.rotation.y=yaw; world.add(g);
  var e={
    g:g,name:name,kind:'sniper',hp:100,dead:false,state:'aim',
    x:x,y:y,z:z,yaw:yaw,rifle:rifle,glint:glint,glintM:glint.material,
    fireCd:4.2,charge:0,phase:0,strafe:1,strafeCd:9,hitT:0,fallT:0,speed:0,
    legL:{hip:{rotation:{x:0}},knee:{rotation:{x:0}}},
    legR:{hip:{rotation:{x:0}},knee:{rotation:{x:0}}},armL:armL,armR:armR,torso:torso,head:head
  };
  torso.userData.owner=e; head.userData.owner=e;
  hitables.push(torso); hitables.push(head);
  enemies.push(e);
  return e;
}

/* ============================================================
   12. the buckboard and the team
   ============================================================ */
var HIDE=[new THREE.MeshLambertMaterial({color:0x4A3223}),
          new THREE.MeshLambertMaterial({color:0x2B211C})];
var HOOF=new THREE.MeshLambertMaterial({color:0x241C16});
var TACK=new THREE.MeshLambertMaterial({color:0x3A2415});
var WOODW=new THREE.MeshLambertMaterial({map:woodTex('#7d6141','#402d1b')});
var IRONW=new THREE.MeshStandardMaterial({color:0x4A4642,metalness:0.75,roughness:0.5,envMap:ENV});

function makeHorse(px,coat){
  var H=new THREE.Group(); H.position.x=px;
  var hide=HIDE[coat], mane=HIDE[1-coat];
  function hb(w,h,d,m,x,y,z,p){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=true;(p||H).add(q);return q;}

  var barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.37,0.35,1.42,12),hide);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,1.14,0); barrel.castShadow=true; H.add(barrel);
  var chest=new THREE.Mesh(new THREE.SphereGeometry(0.37,10,8),hide);
  chest.position.set(0,1.14,0.66); chest.scale.z=0.8; chest.castShadow=true; H.add(chest);
  var rump=new THREE.Mesh(new THREE.SphereGeometry(0.38,10,8),hide);
  rump.position.set(0,1.16,-0.68); rump.scale.z=0.85; rump.castShadow=true; H.add(rump);

  var neck=new THREE.Group(); neck.position.set(0,1.36,0.60); neck.rotation.x=-0.62; H.add(neck);
  hb(0.30,0.76,0.34,hide,0,0.36,0,neck);
  hb(0.10,0.78,0.16,mane,0,0.38,-0.15,neck);                      // mane
  var head=new THREE.Group(); head.position.set(0,0.74,0.02); head.rotation.x=0.95; neck.add(head);
  hb(0.24,0.26,0.46,hide,0,0.02,0.16,head);
  hb(0.19,0.19,0.26,hide,0,-0.02,0.46,head);                      // muzzle
  hb(0.05,0.05,0.10,HOOF,0,-0.06,0.60,head);
  var e1=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.16,6),hide); e1.position.set(-0.10,0.18,0.02); head.add(e1);
  var e2=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.16,6),hide); e2.position.set(0.10,0.18,0.02); head.add(e2);
  var bit=new THREE.Mesh(new THREE.TorusGeometry(0.11,0.018,5,10),TACK);
  bit.position.set(0,-0.01,0.34); head.add(bit);
  hb(0.30,0.09,0.30,TACK,0,0.06,0.20,head);                       // browband

  var tail=new THREE.Group(); tail.position.set(0,1.30,-0.86); tail.rotation.x=0.85; H.add(tail);
  var tm=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.03,0.72,7),mane);
  tm.position.y=-0.34; tail.add(tm);

  hb(0.44,0.30,0.44,TACK,0,1.22,0.42);                            // collar
  hb(0.50,0.10,0.10,TACK,0,1.30,-0.10);
  hb(0.10,0.10,1.10,TACK,0.24,1.28,-0.30);
  hb(0.10,0.10,1.10,TACK,-0.24,1.28,-0.30);

  function limb(x,z,upLen,loLen){
    var up=new THREE.Group(); up.position.set(x,1.06,z); H.add(up);
    var uM=new THREE.Mesh(new THREE.BoxGeometry(0.16,upLen,0.19),hide);
    uM.position.y=-upLen/2; uM.castShadow=true; up.add(uM);
    var lo=new THREE.Group(); lo.position.y=-upLen; up.add(lo);
    var lM=new THREE.Mesh(new THREE.BoxGeometry(0.11,loLen,0.13),hide);
    lM.position.y=-loLen/2; lM.castShadow=true; lo.add(lM);
    var hf=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.12,0.18),HOOF);
    hf.position.y=-loLen-0.06; lo.add(hf);
    return {up:up,lo:lo};
  }
  var legs=[limb(-0.21,0.54,0.52,0.46), limb(0.21,0.54,0.52,0.46),
            limb(-0.22,-0.58,0.54,0.44), limb(0.22,-0.58,0.54,0.44)];
  return {g:H,legs:legs,neck:neck,neckBase:-0.62,head:head,tail:tail};
}

function wheelMesh(r){
  var W=new THREE.Group();
  var tyre=new THREE.Mesh(new THREE.TorusGeometry(r,0.045,6,20),IRONW);
  tyre.rotation.y=Math.PI/2; tyre.castShadow=true; W.add(tyre);
  var felloe=new THREE.Mesh(new THREE.TorusGeometry(r-0.05,0.048,5,20),WOODW);
  felloe.rotation.y=Math.PI/2; W.add(felloe);
  for(var i=0;i<7;i++){
    var sp=new THREE.Mesh(new THREE.BoxGeometry(0.05,r*1.88,0.05),WOODW);
    sp.rotation.x=i/7*Math.PI; W.add(sp);
  }
  var hub=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.22,10),WOODW);
  hub.rotation.z=Math.PI/2; W.add(hub);
  W.userData.r=r;
  return W;
}

var car=(function(){
  var g=new THREE.Group();
  function cb(w,h,d,m,x,y,z,p){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=true;(p||g).add(q);return q;}

  cb(1.70,0.16,2.70,WOODW,0,0.92,-0.30);                    // bed
  cb(0.10,0.34,2.70,WOODW,-0.86,1.12,-0.30);                // side rails
  cb(0.10,0.34,2.70,WOODW, 0.86,1.12,-0.30);
  cb(1.72,0.36,0.10,WOODW,0,1.13,-1.62);                    // tailboard
  cb(1.72,0.30,0.10,WOODW,0,1.10,1.02);
  cb(1.46,0.14,0.52,WOODW,0,1.46,0.62);                     // spring seat
  cb(1.46,0.46,0.10,WOODW,0,1.71,0.86);
  cb(1.30,0.10,0.42,WOODW,0,1.20,1.16);                     // footboard
  cb(0.12,0.10,0.12,IRONW,-0.55,1.58,0.36);                 // brake lever
  cb(0.08,0.52,0.08,IRONW,-0.62,1.78,0.30).rotation.z=0.28;
  cb(1.60,0.10,0.14,IRONW,0,0.80,-1.22);                    // axles
  cb(1.60,0.10,0.14,IRONW,0,0.66,0.92);
  cb(0.13,0.11,3.30,WOODW,0,0.62,2.55);                     // wagon tongue
  cb(1.50,0.10,0.10,WOODW,0,0.62,3.30);                     // doubletree
  var lant=cb(0.16,0.22,0.16,IRONW,0.92,1.42,0.88);
  var glow=new THREE.Mesh(new THREE.SphereGeometry(0.06,7,6),
    new THREE.MeshLambertMaterial({color:0xFFD79A,emissive:0xC98A24}));
  glow.position.set(0.92,1.42,0.88); g.add(glow);
  for(var cr=0;cr<3;cr++){                                   // freight in the bed
    var b=cb(rr(0.45,0.7),rr(0.4,0.6),rr(0.5,0.8),PLANKS[4],rr(-0.4,0.4),1.22,-1.1+cr*0.7);
    b.rotation.y=rr(0,1);
  }

  var wheels=[],pivots=[],i,pv,W;
  for(i=0;i<4;i++){
    var front=i<2, r=front?0.46:0.66;
    pv=new THREE.Group();
    pv.position.set(i%2?0.90:-0.90, r, front?0.92:-1.22);
    W=wheelMesh(r); pv.add(W); g.add(pv);
    wheels.push(W); pivots.push(pv);
  }

  var horses=[makeHorse(-0.62,0),makeHorse(0.62,1)];
  var team=new THREE.Group(); team.position.z=4.05;
  team.add(horses[0].g); team.add(horses[1].g); g.add(team);
  for(i=0;i<2;i++){                                          // traces back to the doubletree
    var tr=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,1.5),TACK);
    tr.position.set((i?0.62:-0.62)+ (i?0.24:-0.24),0.90,3.35); tr.rotation.x=0.18; g.add(tr);
  }
  var reins=[];
  for(i=0;i<2;i++){
    var pts=[new THREE.Vector3((i?0.62:-0.62),1.62,4.66),
             new THREE.Vector3((i?0.5:-0.5),1.60,3.9),
             new THREE.Vector3((i?0.3:-0.3),1.54,2.4),
             new THREE.Vector3((i?0.18:-0.18),1.52,0.9)];
    var ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0x3A2415}));
    g.add(ln); reins.push(ln);
  }

  g.position.set(14,terrainH(14,6.5),6.5); g.rotation.y=-0.5;
  world.add(g);
  return {g:g,wheels:wheels,pivots:pivots,horses:horses,
          x:14,z:6.5,yaw:-0.5,speed:0,steer:0,occupied:false,gait:0,beat:1};
})();
