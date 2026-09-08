
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
var NICKEL=new THREE.MeshStandardMaterial({color:0xE7E9EB,metalness:0.95,roughness:0.13,envMap:ENV,envMapIntensity:1.3});
var STEEL =new THREE.MeshStandardMaterial({color:0xA9AEB4,metalness:0.90,roughness:0.24,envMap:ENV,envMapIntensity:1.1});
var BLUED =new THREE.MeshStandardMaterial({color:0x33353A,metalness:0.85,roughness:0.32,envMap:ENV});
var WALNUT=new THREE.MeshStandardMaterial({color:0x5A3416,metalness:0.03,roughness:0.58});
var BRASSY=new THREE.MeshStandardMaterial({color:0xC9A24A,metalness:0.90,roughness:0.28,envMap:ENV});
var gun=new THREE.Group();
var gunRig=new THREE.Group();   // holds recoil and reload motion
var cylGroup=new THREE.Group();
var hammer,flash;

/* A Colt Single Action Army at life size: 7.5in barrel, a 42mm cylinder, and
   an open frame window so you can see the cylinder turn. Earlier the cylinder
   was 69mm across, which is what made it read as a toy. */
(function buildGun(){
  function gb(w,h,d,mat,x,y,z,p){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(p||gun).add(m);return m;}
  function gc(r1,r2,len,seg,mat,x,y,z,axis,p){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,seg),mat);
    if(axis==='z') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.z=Math.PI/2;
    m.position.set(x,y,z); (p||gun).add(m); return m;
  }
  // --- frame: recoil shield, top strap, bottom rail, front post ---
  gb(0.032,0.050,0.028,NICKEL,0,0.002,0.040);                 // standing breech
  gc(0.023,0.023,0.011,18,NICKEL,0,0.000,0.028,'z');          // recoil shield face
  gb(0.024,0.010,0.072,NICKEL,0,0.029,0.006);                 // top strap
  gb(0.008,0.007,0.016,NICKEL,-0.007,0.036,0.036);            // rear sight ears
  gb(0.008,0.007,0.016,NICKEL, 0.007,0.036,0.036);
  gb(0.028,0.021,0.062,NICKEL,0,-0.026,0.014);                // bottom rail
  gb(0.030,0.050,0.014,NICKEL,0,0.002,-0.032);                // front frame post
  gc(0.0028,0.0028,0.035,8,BLUED,0,-0.020,0.038,'x');         // frame screws
  gc(0.0028,0.0028,0.035,8,BLUED,0,0.006,0.046,'x');
  gb(0.009,0.026,0.024,NICKEL,0.019,0.002,0.034).rotation.y=-0.12;   // loading gate

  // --- barrel, in line with the top chamber ---
  gc(0.0118,0.0100,0.190,16,NICKEL,0,0.0125,-0.126,'z');
  gb(0.009,0.006,0.150,NICKEL,0,0.0215,-0.120);               // sight rib
  gb(0.005,0.012,0.009,NICKEL,0,0.0255,-0.209);               // front sight blade
  gc(0.0075,0.0075,0.132,10,NICKEL,0.0165,0.0055,-0.104,'z'); // ejector rod housing
  gc(0.0100,0.0100,0.024,10,STEEL, 0.0165,0.0055,-0.181,'z'); // rod head
  gc(0.0045,0.0045,0.070,8,STEEL,0,0.0125,-0.048,'z');        // base pin

  // --- cylinder: 42mm, fluted, six mouths ---
  gc(0.0210,0.0210,0.041,20,NICKEL,0,0,0,'z',cylGroup);
  gc(0.0175,0.0175,0.006,18,STEEL,0,0,0.023,'z',cylGroup);
  gc(0.0115,0.0115,0.008,12,BLUED,0,0,0.026,'z',cylGroup);    // ratchet
  for(var f=0;f<6;f++){
    var a=f/6*TAU;
    var fl=gb(0.012,0.005,0.030,BLUED,Math.cos(a)*0.0187,Math.sin(a)*0.0187,-0.002,cylGroup);
    fl.rotation.z=a+Math.PI/2;                                 // flutes, sunk flush
    var ch=gc(0.0055,0.0055,0.044,8,MAT.dark,Math.cos(a+0.5236)*0.0125,Math.sin(a+0.5236)*0.0125,0,'z',cylGroup);
  }
  cylGroup.position.set(0,0,-0.004); gun.add(cylGroup);

  // --- trigger and guard ---
  var guard=new THREE.Mesh(new THREE.TorusGeometry(0.0205,0.0037,7,20),BRASSY);
  guard.rotation.y=Math.PI/2; guard.position.set(0,-0.033,0.018); gun.add(guard);
  gb(0.006,0.021,0.008,BLUED,0,-0.026,0.018).rotation.x=0.16;

  // --- the plow-handle grip, hung off one pivot so it reads as one shape ---
  var gripG=new THREE.Group(); gripG.position.set(0,-0.030,0.054); gripG.rotation.x=0.30; gun.add(gripG);
  gb(0.032,0.048,0.012,NICKEL,0,-0.022,0.020,gripG);           // backstrap, upper
  gb(0.026,0.040,0.011,NICKEL,0,-0.018,-0.019,gripG);          // front strap
  gb(0.026,0.040,0.031,WALNUT,0,-0.020,0.000,gripG);
  gb(0.005,0.038,0.029,WALNUT,-0.014,-0.020,0.000,gripG);
  gb(0.005,0.038,0.029,WALNUT, 0.014,-0.020,0.000,gripG);
  var lowG=new THREE.Group(); lowG.position.set(0,-0.040,0.002); lowG.rotation.x=0.26; gripG.add(lowG);
  gb(0.030,0.050,0.012,NICKEL,0,-0.024,0.019,lowG);            // backstrap, lower
  gb(0.029,0.048,0.030,WALNUT,0,-0.022,0.000,lowG);
  gb(0.006,0.046,0.028,WALNUT,-0.014,-0.022,0.000,lowG);
  gb(0.006,0.046,0.028,WALNUT, 0.014,-0.022,0.000,lowG);
  gb(0.035,0.009,0.035,NICKEL,0,-0.049,0.006,lowG);            // butt cap
  gc(0.0024,0.0024,0.032,8,BRASSY,0,-0.022,0.000,'x',lowG);    // grip screw

  // --- hammer on its own pivot, sitting cocked ---
  hammer=new THREE.Group(); hammer.position.set(0,0.024,0.046); gun.add(hammer);
  gb(0.010,0.034,0.012,STEEL,0,0.015,0.003,hammer);
  var spur=gb(0.013,0.009,0.020,STEEL,0,0.032,0.010,hammer); spur.rotation.x=0.55;
  for(var k=0;k<4;k++) gb(0.014,0.0018,0.003,BLUED,0,0.0345+k*0.0014,0.004+k*0.0048,hammer).rotation.x=0.55;

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
   10b. the Sharps, as you carry it
   ============================================================ */
var rifleRig=new THREE.Group(), rifleLever=null, rflash=null;
(function buildSharps(){
  var R=new THREE.Group();
  function rb(w,h,d,mat,x,y,z,p){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(p||R).add(m);return m;}
  function rc(r1,r2,len,seg,mat,x,y,z,axis,p){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,seg),mat);
    if(axis==='z') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.z=Math.PI/2;
    m.position.set(x,y,z); (p||R).add(m); return m;
  }
  rb(0.030,0.032,0.80,BLUED,0,0.012,-0.44);              // octagon barrel
  rb(0.034,0.020,0.80,BLUED,0,0.012,-0.44).rotation.z=Math.PI/4;
  rb(0.040,0.036,0.04,BLUED,0,0.012,-0.83);              // muzzle band
  rb(0.007,0.014,0.010,BLUED,0,0.032,-0.80);             // front sight
  rb(0.042,0.080,0.20,BLUED,0,-0.012,0.030);             // receiver
  rb(0.046,0.020,0.09,BLUED,0,0.030,0.020);              // tang and rear sight
  rb(0.008,0.016,0.014,BLUED,0,0.046,0.062);
  rb(0.038,0.058,0.15,WALNUT,0,-0.030,0.175);            // wrist
  rb(0.046,0.108,0.27,WALNUT,0,-0.046,0.340);            // butt
  rb(0.048,0.132,0.022,BLUED,0,-0.050,0.482);            // crescent buttplate
  rb(0.040,0.050,0.30,WALNUT,0,-0.014,-0.205);           // forend
  rb(0.046,0.048,0.03,BLUED,0,-0.012,-0.345);            // barrel band
  rifleLever=new THREE.Group(); rifleLever.position.set(0,-0.046,0.070); R.add(rifleLever);
  rb(0.016,0.062,0.020,BLUED,0,-0.028,-0.012,rifleLever);
  rb(0.016,0.018,0.070,BLUED,0,-0.052,0.020,rifleLever);
  rb(0.007,0.020,0.009,BLUED,0,-0.032,0.052).rotation.x=0.1;   // trigger
  rb(0.014,0.036,0.014,STEEL,0,0.034,0.086).rotation.x=-0.35;  // hammer
  // brass Malcolm scope
  rc(0.018,0.018,0.86,14,BRASSY,0,0.055,-0.30,'z');
  rc(0.024,0.024,0.05,14,BRASSY,0,0.055,-0.72,'z');
  rc(0.022,0.022,0.05,14,BRASSY,0,0.055,0.10,'z');
  rb(0.016,0.038,0.020,BLUED,0,0.036,-0.60);
  rb(0.016,0.038,0.020,BLUED,0,0.036,0.030);
  var fm=new THREE.MeshBasicMaterial({color:0xFFD98A,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  var fg=new THREE.Group();
  fg.add(new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.34),fm));
  var f2=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.34),fm); f2.rotation.z=Math.PI/2; f2.rotation.y=Math.PI/2; fg.add(f2);
  var f3=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.22,7,1,true),fm); f3.rotation.x=-Math.PI/2; f3.position.z=-0.10; fg.add(f3);
  fg.position.set(0,0.012,-0.88); R.add(fg);
  rflash={g:fg,m:fm};
  R.traverse(function(o){ if(o.isMesh) o.renderOrder=2; });
  rifleRig.add(R); gunScene.add(rifleRig);
  rifleRig.position.set(0.115,-0.110,-0.40);
  rifleRig.rotation.y=0.09;
  rifleRig.visible=false;
})();

/* a Sharps lying where its owner left it */
function makeRiflePickup(x,y,z){
  var g=new THREE.Group();
  function pb(w,h,d,mat,px,py,pz){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(px,py,pz);m.castShadow=true;g.add(m);return m;}
  pb(0.032,0.034,0.82,BLUED,0,0.10,-0.30);
  pb(0.044,0.082,0.20,BLUED,0,0.09,0.20);
  pb(0.048,0.100,0.30,WALNUT,0,0.08,0.48);
  pb(0.042,0.052,0.30,WALNUT,0,0.09,-0.06);
  var sc=new THREE.Mesh(new THREE.CylinderGeometry(0.019,0.019,0.86,12),BRASSY);
  sc.rotation.x=Math.PI/2; sc.position.set(0,0.145,-0.16); sc.castShadow=true; g.add(sc);
  g.position.set(x,y,z); g.rotation.y=0.6; g.rotation.z=0.06;
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

  var legL=bx(0.20,0.86,0.24,shirt,-0.15,0.43,0);
  var legR=bx(0.20,0.86,0.24,shirt, 0.15,0.43,0);
  legL.geometry.translate(0,-0.43,0); legL.position.y=0.86;
  legR.geometry.translate(0,-0.43,0); legR.position.y=0.86;
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
    legL:legL,legR:legR,armL:armL,armR:armR,torso:torso,head:head,fallT:0,hitT:0,speed:rr(2.4,3.3)
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

  // the Sharps
  var rifle=new THREE.Group(); rifle.position.set(0.05,1.40,0.10); g.add(rifle);
  bx(0.035,0.045,0.86,BLUED,0,0,-0.50,rifle);                 // barrel, octagon-ish
  bx(0.045,0.075,0.20,BLUED,0,-0.010,0.02,rifle);             // action
  bx(0.045,0.055,0.34,WALNUT,0,-0.020,0.24,rifle);            // stock
  bx(0.042,0.10,0.10,WALNUT,0,-0.055,0.38,rifle);
  bx(0.040,0.05,0.26,WALNUT,0,-0.030,-0.20,rifle);            // forend
  bx(0.020,0.055,0.030,BLUED,0,-0.055,0.10,rifle);            // lever
  var scope=new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.017,0.80,12),BRASSY);
  scope.rotation.x=Math.PI/2; scope.position.set(0,0.052,-0.28); rifle.add(scope);
  bx(0.020,0.045,0.020,BLUED,0,0.028,-0.60,rifle);
  bx(0.020,0.045,0.020,BLUED,0,0.028,0.02,rifle);
  var glint=new THREE.Mesh(new THREE.SphereGeometry(0.030,8,6),
    new THREE.MeshBasicMaterial({color:0xFFF0C0,transparent:true,opacity:0}));
  glint.position.set(0,0.052,0.13); rifle.add(glint);

  g.position.set(x,y,z); g.rotation.y=yaw; world.add(g);
  var e={
    g:g,name:name,kind:'sniper',hp:100,dead:false,state:'aim',
    x:x,y:y,z:z,yaw:yaw,rifle:rifle,glint:glint,glintM:glint.material,
    fireCd:4.2,charge:0,phase:0,strafe:1,strafeCd:9,hitT:0,fallT:0,speed:0,
    legL:{rotation:{x:0}},legR:{rotation:{x:0}},armL:armL,armR:armR,torso:torso,head:head
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
