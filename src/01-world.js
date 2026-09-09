(function(){
'use strict';

/* Everything below lives in boot(), which is called two frames from now.
   The build blocks the main thread for the best part of a second and the
   loading card has to be on screen before that happens, or the first thing
   you see is a frozen page. The expensive pieces of the build are queued as
   stages rather than run where they stand, so the card can put a name and a
   bar to each one. The weights are milliseconds measured on a software
   renderer - only their ratio matters. */
var BUILD=[], BUILT=0, BUILD_W=0;
function stage(label,weight,fn){ BUILD.push({label:label,w:weight,fn:fn}); BUILD_W+=weight; }
var loadTxt=document.getElementById('loadTxt'), barFill=document.getElementById('barFill'),
    loadPct=document.getElementById('loadPct');
function setLoad(text,frac){
  if(loadTxt) loadTxt.textContent=text;
  if(loadPct) loadPct.textContent=Math.round(frac*100)+'%';
  if(!barFill) return;
  barFill.style.animation='none';        // the creep hands over to real numbers
  barFill.style.transform='scaleX('+frac.toFixed(3)+')';
}

function boot(){
if(!window.THREE){ setLoad('could not load the renderer',0); return; }

/* ============================================================
   1. small utilities
   ============================================================ */
var TAU=Math.PI*2;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
var rnd=mulberry(97531);
function rr(a,b){return a+rnd()*(b-a);}
function ri(a,b){return Math.floor(a+rnd()*(b-a+1));}
function pick(arr){return arr[Math.floor(rnd()*arr.length)];}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function lerp(a,b,t){return a+(b-a)*t;}
function damp(a,b,l,dt){return lerp(a,b,1-Math.exp(-l*dt));}
function angWrap(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}
function $(id){return document.getElementById(id);}

/* the wash is a bowl: flat floor, cliff walls, and a hard edge at WORLD_R */
var WORLD_R=88;

/* ============================================================
   2. synthesized audio - every sound is generated, no files
   ============================================================ */
var AU={
  ok:false,ctx:null,master:null,noise:null,eng:null,engGain:null,engFilt:null,
  init:function(){
    if(this.ok)return;
    var AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    try{this.ctx=new AC();}catch(e){return;}
    var c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=0.5; this.master.connect(c.destination);
    /* One buffer of noise, which every burst - shots, hooves, impacts - plays a
       slice of. It used to also feed a permanent bandpassed loop with an LFO
       gusting it, which was the only thing you could hear with nothing going
       on. That bed is gone; what is left all belongs to something happening. */
    var n=c.sampleRate*1.2, b=c.createBuffer(1,n,c.sampleRate), d=b.getChannelData(0);
    for(var i=0;i<n;i++) d[i]=Math.random()*2-1;
    this.noise=b;
    this.eng=c.createOscillator(); this.eng.type='sawtooth'; this.eng.frequency.value=42;
    this.engFilt=c.createBiquadFilter(); this.engFilt.type='lowpass'; this.engFilt.frequency.value=380;
    this.engGain=c.createGain(); this.engGain.gain.value=0;
    this.eng.connect(this.engFilt); this.engFilt.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.start();
    this.ok=true;
  },
  resume:function(){ if(this.ok&&this.ctx.state==='suspended') this.ctx.resume(); },
  burst:function(vol,cut,dur,q){
    var c=this.ctx,s=c.createBufferSource(); s.buffer=this.noise;
    s.playbackRate.value=rr(0.85,1.15);
    var f=c.createBiquadFilter(); f.type='lowpass'; f.Q.value=q||1;
    var t=c.currentTime;
    f.frequency.setValueAtTime(cut,t); f.frequency.exponentialRampToValueAtTime(Math.max(120,cut*0.14),t+dur);
    var g=c.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t+dur+0.05);
  },
  thump:function(vol,f0,f1,dur){
    var c=this.ctx,o=c.createOscillator(); o.type='sine';
    var t=c.currentTime;
    o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    var g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.05);
  },
  shot:function(dist){
    if(!this.ok)return;
    var v=1/(1+(dist||0)*0.10);
    this.burst(0.85*v,4200-Math.min(3200,(dist||0)*70),0.34,0.9);
    this.thump(0.55*v,150,38,0.20);
    if(dist>14) this.burst(0.18*v,900,0.75,0.6);
  },
  rifle:function(dist){
    if(!this.ok)return;
    var v=1/(1+(dist||0)*0.055);
    this.burst(0.95*v,7000,0.16,1.6);
    this.thump(0.40*v,320,70,0.14);
    this.burst(0.30*v,1100,0.95,0.5);            // the crack rolling back off the false fronts
  },
  creak:function(){
    if(!this.ok)return;
    var c=this.ctx,o=c.createOscillator(); o.type='sawtooth';
    var f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=760; f.Q.value=6;
    var g=c.createGain(), t=c.currentTime;
    o.frequency.setValueAtTime(rr(150,240),t);
    o.frequency.linearRampToValueAtTime(rr(80,130),t+0.22);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.045,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0005,t+0.26);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.3);
  },
  click:function(v){ if(!this.ok)return; this.burst(v||0.2,5200,0.035,3); },
  clink:function(){ if(!this.ok)return; this.thump(0.10,1900,900,0.06); this.burst(0.09,7000,0.05,2); },
  ric:function(){ if(!this.ok)return;
    var c=this.ctx,o=c.createOscillator(); o.type='triangle'; var t=c.currentTime;
    o.frequency.setValueAtTime(rr(1500,2600),t); o.frequency.exponentialRampToValueAtTime(rr(300,600),t+0.22);
    var g=c.createGain(); g.gain.setValueAtTime(0.14,t); g.gain.exponentialRampToValueAtTime(0.0005,t+0.24);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.3);
  },
  thud:function(){ if(!this.ok)return; this.burst(0.4,700,0.16,1.2); this.thump(0.3,90,45,0.16); },
  hurt:function(){ if(!this.ok)return; this.thump(0.42,220,60,0.35); this.burst(0.25,600,0.25,1); },
  clop:function(v){
    if(!this.ok)return;
    this.burst(0.16*v,2000,0.055,2.2);
    this.thump(0.13*v,150,62,0.075);
  },
  whinny:function(){
    if(!this.ok)return;
    var c=this.ctx,t=c.currentTime;
    for(var i=0;i<3;i++){
      var o=c.createOscillator(); o.type='sawtooth';
      var f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=980; f.Q.value=3.5;
      var g=c.createGain(), t0=t+i*0.07;
      o.frequency.setValueAtTime(540+i*95,t0);
      o.frequency.exponentialRampToValueAtTime(290+i*35,t0+0.34);
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(0.085,t0+0.035);
      g.gain.exponentialRampToValueAtTime(0.0005,t0+0.38);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(t0); o.stop(t0+0.42);
    }
  },
  /* --- the two instruments in town, further down this file --- */
  engine:function(on,rpm){
    if(!this.ok)return;
    var g=this.engGain.gain, t=this.ctx.currentTime;
    g.setTargetAtTime(on?0.075:0,t,0.15);
    if(on){ this.eng.frequency.setTargetAtTime(36+rpm*46,t,0.08);
            this.engFilt.frequency.setTargetAtTime(300+rpm*900,t,0.1); }
  }
};

/* ============================================================
   4b. the piano in the Occidental and the organ in the church
   ============================================================
   Both are built out of oscillators like everything else here. The piano is a
   struck string - harmonics on a hard attack and a long decay, laid down
   twice with the second copy a few cents sharp, which is most of what gives a
   saloon upright its out-of-tune shimmer. The organ is drawbars, held flat for
   as long as the note lasts, through a hall made from a burst of noise
   decaying, because an organ with no room around it sounds like a toy.

   Neither is a bed: each one sits in a room and belongs to it. Out on the
   street it is far off and muffled through the wall, and it opens up as you
   come through the door. It also keeps playing whether you are listening or
   not - the clock runs, and the notes are only built when someone is close
   enough to hear them. */
function midiHz(n){ return 440*Math.pow(2,(n-69)/12); }

var MUSIC={
  ok:false, verb:null, places:[],
  init:function(){
    if(this.ok||!AU.ok)return;
    var c=AU.ctx, ch, i;
    var len=Math.floor(c.sampleRate*2.4), ir=c.createBuffer(2,len,c.sampleRate);
    for(ch=0;ch<2;ch++){
      var d=ir.getChannelData(ch);
      for(i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8);
    }
    this.verb=c.createConvolver(); this.verb.buffer=ir;
    var vg=c.createGain(); vg.gain.value=0.6;
    this.verb.connect(vg); vg.connect(AU.master);
    this.ok=true;
  },
  /* A room with something playing in it. `tracks` run independently, so the
     left hand and the right hand keep their own place in the bar. */
  add:function(kind,voice,bpm,level,wet,tracks){
    if(!this.ok)return;
    var c=AU.ctx, i;
    var input=c.createGain(); input.gain.value=0;          // how near you are
    var filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=380;
    var send=c.createGain(); send.gain.value=wet;
    input.connect(filt); filt.connect(AU.master);
    filt.connect(send); send.connect(this.verb);
    var tl=[];
    for(i=0;i<tracks.length;i++) tl.push({seq:tracks[i],i:0,at:0});
    this.places.push({kind:kind,voice:voice,spb:60/bpm,level:level,
                      box:null,in:input,filt:filt,tracks:tl});
  },
  room:function(kind){
    for(var i=0;i<interiors.length;i++) if(interiors[i].kind===kind) return interiors[i];
    return null;
  },
  pianoNote:function(dest,f,t,dur,vel){
    var c=AU.ctx, k, dt;
    var g=c.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vel,t+0.006);      // the hammer
    g.gain.exponentialRampToValueAtTime(vel*0.30,t+0.16);  // and the string letting go
    g.gain.exponentialRampToValueAtTime(0.0004,t+dur);
    var lp=c.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.setValueAtTime(Math.min(9000,f*10),t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600,f*3),t+dur);
    g.connect(lp); lp.connect(dest);
    var part=[[1,1],[2,0.40],[3,0.17],[4,0.08]];
    for(k=0;k<part.length;k++){
      for(dt=0;dt<(k<2?2:1);dt++){                          // two strings to a note, low down
        var o=c.createOscillator();
        o.type=k?'sine':'triangle';
        o.frequency.value=f*part[k][0];
        o.detune.value=dt?6:0;                              // a few cents sharp
        var pg=c.createGain(); pg.gain.value=part[k][1]*(dt?0.5:1);
        o.connect(pg); pg.connect(g);
        o.start(t); o.stop(t+dur+0.08);
      }
    }
  },
  organNote:function(dest,f,t,dur,vel){
    var c=AU.ctx, k;
    var g=c.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vel,t+0.08);        // wind takes a moment
    g.gain.setValueAtTime(vel,t+Math.max(0.10,dur-0.05));
    g.gain.exponentialRampToValueAtTime(0.0004,t+dur+0.22);
    g.connect(dest);
    var draw=[[1,1],[2,0.52],[3,0.26],[4,0.18],[6,0.08]];   // 8ft, 4ft, twelfth, 2ft, larigot
    for(k=0;k<draw.length;k++){
      var o=c.createOscillator(); o.type='sine';
      o.frequency.value=f*draw[k][0];
      o.detune.value=(k%2)?5:-5;                            // ranks never quite agree
      var pg=c.createGain(); pg.gain.value=draw[k][1];
      o.connect(pg); pg.connect(g);
      o.start(t); o.stop(t+dur+0.30);
    }
  },
  strike:function(p,note,t,dur,vel){
    var f=this[p.voice==='organ'?'organNote':'pianoNote'], i;
    if(note instanceof Array){ for(i=0;i<note.length;i++) f.call(this,p.in,midiHz(note[i]),t,dur,vel/Math.sqrt(note.length)); }
    else f.call(this,p.in,midiHz(note),t,dur,vel);
  },
  update:function(px,pz){
    if(!this.ok)return;
    var c=AU.ctx, now=c.currentTime, i, j;
    for(i=0;i<this.places.length;i++){
      var p=this.places[i];
      if(!p.box){ p.box=this.room(p.kind); if(!p.box) continue; }
      var dx=Math.max(p.box.x0-px,0,px-p.box.x1), dz=Math.max(p.box.z0-pz,0,pz-p.box.z1);
      var v=clamp(1-Math.sqrt(dx*dx+dz*dz)/11,0,1);
      p.in.gain.setTargetAtTime(p.level*v*v,now,0.30);
      p.filt.frequency.setTargetAtTime(360+10600*v*v*v,now,0.30);   // the wall comes off it
      for(j=0;j<p.tracks.length;j++){
        var tr=p.tracks[j];
        if(tr.at<now) tr.at=now+0.05;         // back after a spell away, pick it up here
        while(tr.at<now+0.8){
          var ev=tr.seq[tr.i];
          if(v>0.02&&ev[0]) this.strike(p,ev[0],tr.at,ev[1]*p.spb*0.96,ev[2]||0.5);
          tr.at+=ev[1]*p.spb;
          tr.i=(tr.i+1)%tr.seq.length;
        }
      }
    }
  }
};

/* ============================================================
   3. procedural textures - canvas only, no image files
   ============================================================ */
function cvs(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function toTex(c,rx,ry){
  var t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
  t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t;
}
function groundTex(){
  var c=cvs(512,512),g=c.getContext('2d');
  g.fillStyle='#b0855a'; g.fillRect(0,0,512,512);
  for(var i=0;i<24000;i++){
    var x=rnd()*512,y=rnd()*512,v=rnd();
    g.fillStyle='rgba('+(150+v*70|0)+','+(115+v*60|0)+','+(75+v*45|0)+','+(0.05+rnd()*0.3).toFixed(2)+')';
    g.fillRect(x,y,1+rnd()*2,1+rnd()*2);
  }
  for(var k=0;k<70;k++){
    g.strokeStyle='rgba(120,90,58,'+(0.05+rnd()*0.10).toFixed(2)+')'; g.lineWidth=1+rnd()*3;
    g.beginPath(); var yy=rnd()*512; g.moveTo(0,yy);
    for(var x2=0;x2<512;x2+=32) g.lineTo(x2,yy+Math.sin(x2*0.03+k)*7);
    g.stroke();
  }
  return toTex(c,42,42);
}
function woodTex(base,dark){
  var c=cvs(128,128),g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,128,128);
  for(var p=0;p<8;p++){
    var x=p*16;
    g.fillStyle=dark; g.globalAlpha=0.5; g.fillRect(x,0,1,128); g.globalAlpha=1;
    for(var i=0;i<70;i++){
      g.strokeStyle='rgba(0,0,0,'+(0.03+rnd()*0.10).toFixed(2)+')'; g.lineWidth=rnd()*1.6;
      g.beginPath(); var yy=rnd()*128; g.moveTo(x,yy); g.lineTo(x+16,yy+rr(-3,3)); g.stroke();
    }
  }
  for(var s=0;s<160;s++){ g.fillStyle='rgba(255,240,215,'+(rnd()*0.07).toFixed(2)+')'; g.fillRect(rnd()*128,rnd()*128,rnd()*10,1); }
  return toTex(c,1,1);
}
function signTex(text,bg,fg){
  var c=cvs(512,128),g=c.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,512,128);
  for(var i=0;i<900;i++){ g.fillStyle='rgba(0,0,0,'+(rnd()*0.12).toFixed(2)+')'; g.fillRect(rnd()*512,rnd()*128,rnd()*7,rnd()*2); }
  g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle';
  g.font='bold '+(text.length>16?38:52)+'px Georgia, "Times New Roman", serif';
  g.fillText(text,256,66);
  g.strokeStyle=fg; g.globalAlpha=0.5; g.lineWidth=3; g.strokeRect(12,12,488,104); g.globalAlpha=1;
  for(var k=0;k<520;k++){ g.fillStyle='rgba(190,160,120,'+(rnd()*0.30).toFixed(2)+')'; g.fillRect(rnd()*512,rnd()*128,rnd()*5,rnd()*3); }
  return toTex(c,1,1);
}
var NAMES=['Early Prine','Dutch Vandiver','Ollie Prine','Coy Renfro','Mack Suggs','Tully Prine',
           'Hoyt Beadle','Lem Crabtree','Arliss Ward','Sonny Prine','Doss Yeager','Newt Fannin'];
var CRIMES=['MURDER','TRAIN ROBBERY','HORSE THEFT','BANK ROBBERY','CATTLE RUSTLING','ARSON'];
function posterTex(){
  var c=cvs(256,340),g=c.getContext('2d'),i;
  g.fillStyle='#DCCCA6'; g.fillRect(0,0,256,340);
  g.fillStyle='#2A2018'; g.textAlign='center';
  g.font='bold 46px Georgia, serif'; g.fillText('WANTED',128,50);
  g.font='15px Georgia, serif'; g.fillText('DEAD OR ALIVE',128,74);
  g.strokeStyle='#2A2018'; g.lineWidth=2; g.strokeRect(56,88,144,132);
  g.fillStyle='#9B8A6C'; g.fillRect(58,90,140,128);
  g.fillStyle='#4A3E2E'; g.beginPath(); g.ellipse(128,166,40,50,0,0,TAU); g.fill();
  g.fillStyle='#241C15'; g.fillRect(90,124,76,20); g.fillRect(96,114,64,12);
  g.fillStyle='#5A4A38'; g.fillRect(104,206,48,14);
  g.fillStyle='#2A2018';
  var nm=pick(NAMES);
  g.font='bold '+(nm.length>13?19:23)+'px Georgia, serif'; g.fillText(nm.toUpperCase(),128,248);
  g.font='13px Georgia, serif'; g.fillText('FOR '+pick(CRIMES),128,270);
  g.font='bold 30px Georgia, serif'; g.fillText('$'+ri(2,9)*100,128,304);
  g.font='12px Georgia, serif'; g.fillText('REWARD',128,324);
  for(i=0;i<700;i++){ g.fillStyle='rgba(90,68,42,'+(rnd()*0.13).toFixed(3)+')'; g.fillRect(rnd()*256,rnd()*340,rnd()*6,rnd()*3); }
  g.fillStyle='rgba(120,96,62,0.30)';
  g.beginPath(); g.moveTo(0,0); g.lineTo(34,0); g.lineTo(0,26); g.fill();
  g.beginPath(); g.moveTo(256,340); g.lineTo(216,340); g.lineTo(256,306); g.fill();
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
/* rotY is the way the paper faces. A plane faces its own +z and every wall
   these go on fronts local -z, so the callers pass PI - hung the other way the
   sheet is double-sided enough to draw, but you are reading the back of it and
   WANTED comes out mirrored. */
function poster(parent,lx,ly,lz,rotY,scale){
  var sc=scale||1;
  var m=new THREE.Mesh(new THREE.PlaneGeometry(0.42*sc,0.56*sc),
    new THREE.MeshLambertMaterial({map:posterTex(),emissive:0x2a2016,side:THREE.DoubleSide}));
  m.position.set(lx,ly,lz); m.rotation.y=rotY; m.rotation.z=rr(-0.05,0.05);
  parent.add(m); hitables.push(m);
  return m;
}
function stoneTex(){
  var c=cvs(256,256),g=c.getContext('2d'),i,j;
  g.fillStyle='#9C9184'; g.fillRect(0,0,256,256);
  var rows=8, hgt=256/rows;
  for(j=0;j<rows;j++){
    var off=(j%2)?32:0, wdt=64;
    for(i=-1;i<5;i++){
      var x=i*wdt+off, y=j*hgt;
      var v=rr(-16,16);
      g.fillStyle='rgb('+(150+v|0)+','+(140+v|0)+','+(128+v|0)+')';
      g.fillRect(x+1.5,y+1.5,wdt-3,hgt-3);
    }
  }
  for(i=0;i<2600;i++){ g.fillStyle='rgba(70,62,52,'+(rnd()*0.15).toFixed(3)+')'; g.fillRect(rnd()*256,rnd()*256,rnd()*4,rnd()*3); }
  return toTex(c,1,1);
}
function skyTex(){
  var c=cvs(8,256),g=c.getContext('2d');
  var grd=g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0.00,'#4A5567'); grd.addColorStop(0.34,'#8E8064');
  grd.addColorStop(0.58,'#D9A870'); grd.addColorStop(0.72,'#F0C68C');
  grd.addColorStop(0.80,'#C98F5C'); grd.addColorStop(1.00,'#7E5A3C');
  g.fillStyle=grd; g.fillRect(0,0,8,256);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
function cloudTex(){
  var c=cvs(1024,512),g=c.getContext('2d');
  for(var k=0;k<30;k++){
    var cx=rnd()*1024, cy=90+rnd()*170, sp=55+rnd()*150;
    for(var b=0;b<24;b++){
      var bx=cx+rr(-sp,sp), by=cy+rr(-sp*0.26,sp*0.26), br=sp*rr(0.16,0.44);
      var rg=g.createRadialGradient(bx,by,0,bx,by,br);
      var al=(0.045+rnd()*0.095).toFixed(3);
      rg.addColorStop(0,'rgba(255,247,234,'+al+')');
      rg.addColorStop(0.55,'rgba(246,226,203,'+(al*0.6).toFixed(3)+')');
      rg.addColorStop(1,'rgba(240,215,190,0)');
      g.fillStyle=rg; g.beginPath(); g.arc(bx,by,br,0,TAU); g.fill();
    }
  }
  var t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  t.encoding=THREE.sRGBEncoding; return t;
}
function sunTex(){
  var c=cvs(128,128),g=c.getContext('2d');
  var rg=g.createRadialGradient(64,64,0,64,64,64);
  rg.addColorStop(0.00,'rgba(255,253,244,1)');
  rg.addColorStop(0.13,'rgba(255,243,206,0.96)');
  rg.addColorStop(0.30,'rgba(255,206,132,0.44)');
  rg.addColorStop(0.58,'rgba(242,163,92,0.15)');
  rg.addColorStop(1.00,'rgba(238,150,80,0)');
  g.fillStyle=rg; g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
function pictureTex(kind){
  var c=cvs(256,320),g=c.getContext('2d'),i;
  g.fillStyle='#C9B48C'; g.fillRect(0,0,256,320);
  if(kind==='portrait'){
    g.fillStyle='#6E5F49'; g.fillRect(0,0,256,320);
    g.fillStyle='#3A3026'; g.beginPath(); g.ellipse(128,150,66,84,0,0,TAU); g.fill();
    g.fillStyle='#C7A480'; g.beginPath(); g.ellipse(128,132,40,50,0,0,TAU); g.fill();
    g.fillStyle='#241C15'; g.fillRect(78,96,100,26);            // hat
    g.fillRect(84,86,88,16);
    g.fillStyle='#2B2119'; g.beginPath(); g.moveTo(88,220); g.lineTo(168,220); g.lineTo(190,320); g.lineTo(66,320); g.fill();
    g.fillStyle='#D8CBB0'; g.fillRect(112,222,32,42);
  }else if(kind==='landscape'){
    var sk=g.createLinearGradient(0,0,0,200);
    sk.addColorStop(0,'#6E7E92'); sk.addColorStop(1,'#E4B983');
    g.fillStyle=sk; g.fillRect(0,0,256,200);
    g.fillStyle='#8A6A52'; g.beginPath(); g.moveTo(0,200); g.lineTo(52,120); g.lineTo(96,120); g.lineTo(130,200); g.fill();
    g.fillStyle='#6F5340'; g.beginPath(); g.moveTo(120,200); g.lineTo(178,142); g.lineTo(214,142); g.lineTo(256,200); g.fill();
    g.fillStyle='#B08B5E'; g.fillRect(0,196,256,124);
    g.fillStyle='#7C6A44';
    for(i=0;i<40;i++) g.fillRect(rnd()*256,200+rnd()*118,rnd()*7,2);
  }else if(kind==='wanted'){
    g.fillStyle='#DCCBA4'; g.fillRect(0,0,256,320);
    g.fillStyle='#2A2018'; g.textAlign='center';
    g.font='bold 44px Georgia, serif'; g.fillText('WANTED',128,52);
    g.font='16px Georgia, serif'; g.fillText('DEAD OR ALIVE',128,76);
    g.fillStyle='#8A7A5E'; g.fillRect(52,92,152,140);
    g.fillStyle='#4A3E2E'; g.beginPath(); g.ellipse(128,168,42,54,0,0,TAU); g.fill();
    g.fillStyle='#241C15'; g.fillRect(88,124,80,20);
    g.fillStyle='#2A2018';
    g.font='bold 30px Georgia, serif'; g.fillText('$500', 128,268);
    g.font='15px Georgia, serif'; g.fillText('REWARD',128,292);
  }else if(kind==='horse'){
    g.fillStyle='#8E7A56'; g.fillRect(0,0,256,320);
    g.fillStyle='#33291E';
    g.beginPath(); g.ellipse(128,180,74,44,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(186,126,26,32,0.5,0,TAU); g.fill();
    g.fillRect(196,96,20,44);
    g.fillRect(70,214,14,74); g.fillRect(96,214,14,74);
    g.fillRect(150,214,14,74); g.fillRect(176,214,14,74);
    g.beginPath(); g.moveTo(56,152); g.lineTo(74,214); g.lineTo(46,214); g.fill();
  }else{ // stove-side still life
    g.fillStyle='#6A5A44'; g.fillRect(0,0,256,320);
    g.fillStyle='#2C2318'; g.fillRect(40,180,176,110);
    g.fillStyle='#8E6A3A'; g.beginPath(); g.ellipse(96,164,34,44,0,0,TAU); g.fill();
    g.fillStyle='#3E5A3A'; g.fillRect(140,120,26,96);
    g.fillStyle='#C2A45E'; g.beginPath(); g.ellipse(180,196,26,20,0,0,TAU); g.fill();
  }
  for(i=0;i<600;i++){ g.fillStyle='rgba(60,44,28,'+(rnd()*0.10).toFixed(3)+')'; g.fillRect(rnd()*256,rnd()*320,rnd()*5,rnd()*3); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}

/* a scrap of sky and ground for the nickel to reflect - without this, polished
   metal in three.js has nothing to mirror and renders nearly black */
function envTex(){
  var c=cvs(256,128),g=c.getContext('2d');
  var grd=g.createLinearGradient(0,0,0,128);
  grd.addColorStop(0.00,'#FFF6E2'); grd.addColorStop(0.42,'#CFB994');
  grd.addColorStop(0.50,'#8B6E4C'); grd.addColorStop(0.58,'#6B4F35');
  grd.addColorStop(1.00,'#241A12');
  g.fillStyle=grd; g.fillRect(0,0,256,128);
  var rg=g.createRadialGradient(64,28,1,64,28,34);
  rg.addColorStop(0,'#FFFFFF'); rg.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=rg; g.fillRect(0,0,256,128);
  g.fillStyle='rgba(30,22,16,0.55)'; g.fillRect(150,44,54,16); g.fillRect(20,52,40,10);
  var t=new THREE.CanvasTexture(c);
  t.mapping=THREE.EquirectangularReflectionMapping; t.encoding=THREE.sRGBEncoding;
  return t;
}
var ENV=envTex();

/* ============================================================
   4. renderer, scene, sky, light
   ============================================================ */
var canvas=$('view');
var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.setSize(window.innerWidth,window.innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
renderer.autoClear=false;

var scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xC9A171,0.0055);

var camera=new THREE.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.08,900);
var chase=new THREE.PerspectiveCamera(68,window.innerWidth/window.innerHeight,0.1,900);
var gunScene=new THREE.Scene();
var gunCam=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.01,6);

var sky=new THREE.Mesh(new THREE.SphereGeometry(420,32,20),
  new THREE.MeshBasicMaterial({map:skyTex(),side:THREE.BackSide,fog:false,depthWrite:false}));
scene.add(sky);

var clouds=new THREE.Mesh(new THREE.SphereGeometry(400,36,18,0,TAU,0,Math.PI*0.52),
  new THREE.MeshBasicMaterial({map:cloudTex(),side:THREE.BackSide,transparent:true,
    depthWrite:false,fog:false,opacity:0.9}));
scene.add(clouds);
var sunDisc=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex(),transparent:true,
  depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
sunDisc.scale.set(64,64,1);
scene.add(sunDisc);
var SUNDIR=new THREE.Vector3(74,58,-46).normalize();

scene.add(new THREE.HemisphereLight(0xE9C08C,0x6B4E33,0.62));
var sun=new THREE.DirectionalLight(0xFFD8A4,1.15);
sun.position.set(74,58,-46);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=260;
var SD=58;
sun.shadow.camera.left=-SD; sun.shadow.camera.right=SD;
sun.shadow.camera.top=SD; sun.shadow.camera.bottom=-SD;
sun.shadow.bias=-0.0009;
scene.add(sun); scene.add(sun.target);
var backLight=new THREE.DirectionalLight(0x8FA6C4,0.22); backLight.position.set(-50,30,60); scene.add(backLight);

gunScene.add(new THREE.AmbientLight(0xC9A98A,0.55));
var gunKey=new THREE.DirectionalLight(0xFFE8C6,1.9); gunKey.position.set(-0.7,1.0,0.8); gunScene.add(gunKey);
var gunRim=new THREE.DirectionalLight(0xBFD2EA,0.9); gunRim.position.set(1.0,0.3,-0.6); gunScene.add(gunRim);
var muzzleLight=new THREE.PointLight(0xFFC163,0,7,2); muzzleLight.position.set(0.2,-0.1,-0.7); gunScene.add(muzzleLight);
var worldFlash=new THREE.PointLight(0xFFB24D,0,16,2); scene.add(worldFlash);

/* ============================================================
   5. terrain - flat floor, a dry wash, and cliffs that close the world
   ============================================================ */
function terrainH(x,z){
  // A dead-flat pad under the whole townsite - buildings sit on y=0, so any
  // dip or rise beneath them would leave them hanging in the air.
  var px=Math.max(0,Math.abs(x)-80), pz=Math.max(0,Math.abs(z)-30);
  var flat=clamp(Math.sqrt(px*px+pz*pz)/26,0,1);
  var h=Math.sin(x*0.0210)*1.9+Math.cos(z*0.0184)*1.7+Math.sin((x*0.7+z)*0.031)*0.9;
  h*=flat;
  var w=z+58+Math.sin(x*0.020)*9;               // the wash itself, running east and west
  h-=4.8*Math.exp(-(w*w)/300)*clamp((Math.abs(z)-36)/14,0,1);
  var d=Math.sqrt(x*x+z*z);
  var rim=clamp((d-(WORLD_R+4))/22,0,1);        // the cliffs, right where you run out of ground
  h+=rim*rim*(3-2*rim)*40;
  return h;
}
var groundMat=new THREE.MeshLambertMaterial({map:groundTex()});
var groundGeo=new THREE.PlaneGeometry(300,300,140,140);
(function(){
  var p=groundGeo.attributes.position;
  for(var i=0;i<p.count;i++) p.setZ(i,terrainH(p.getX(i),-p.getY(i)));
  groundGeo.computeVertexNormals();
})();
var ground=new THREE.Mesh(groundGeo,groundMat);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
scene.add(ground);

/* ============================================================
   6. shared materials
   ============================================================ */
function plank(base,dark,em){
  var m=new THREE.MeshLambertMaterial({map:woodTex(base,dark)});
  if(em) m.emissive=new THREE.Color(em);
  return m;
}
var MAT={
  wood1:plank('#8a6a45','#4a3220'),
  dark:new THREE.MeshLambertMaterial({color:0x241a13}),
  glass:new THREE.MeshLambertMaterial({color:0x14100E}),
  metal:new THREE.MeshStandardMaterial({color:0x6b6560,metalness:0.7,roughness:0.55,envMap:ENV}),
  rust:new THREE.MeshLambertMaterial({color:0x7a4a30}),
  stone:new THREE.MeshLambertMaterial({color:0x8d7a63}),
  cliff:new THREE.MeshLambertMaterial({color:0x7c6349}),
  sage:new THREE.MeshLambertMaterial({color:0x6E7A5A}),
  cactus:new THREE.MeshLambertMaterial({color:0x53704a}),
  bone:new THREE.MeshLambertMaterial({color:0xD8C9A8}),
  inside:plank('#6b543a','#3a2b1c',0x1d150d),
  floor:plank('#7a6042','#43301e',0x181008),
  cloth:new THREE.MeshLambertMaterial({color:0x6a3630,emissive:0x140807}),
  bottle:new THREE.MeshLambertMaterial({color:0x3d5a3a,emissive:0x0d1409}),
  pane:new THREE.MeshStandardMaterial({color:0x9FB6C0,metalness:0.15,roughness:0.06,
        transparent:true,opacity:0.34,envMap:ENV,envMapIntensity:1.4}),
  felt:new THREE.MeshLambertMaterial({color:0x2F5540,emissive:0x0b1610}),
  drape:new THREE.MeshLambertMaterial({color:0x7A2A28,emissive:0x1a0806}),
  brass:new THREE.MeshStandardMaterial({color:0xB78D3E,metalness:0.85,roughness:0.30,envMap:ENV}),
  mirror:new THREE.MeshStandardMaterial({color:0xB9C6CC,metalness:0.9,roughness:0.10,envMap:ENV,envMapIntensity:1.5}),
  gunmetal:new THREE.MeshStandardMaterial({color:0x3A3C40,metalness:0.8,roughness:0.35,envMap:ENV}),
  hide:new THREE.MeshLambertMaterial({color:0x6B4A2E})
};
var PLANKS=[
  plank('#8a6a45','#4a3220'), plank('#C6BBA2','#8E8471'), plank('#6f5940','#3a2b1c'),
  plank('#A05442','#5C2A20'), plank('#7d6248','#412e1e'),
  plank('#7C8574','#48513F'), plank('#B39A6C','#6A5533')
];
var STONEMAT=null;                       // built on demand, only the bank needs it

/* ============================================================
   7. the town
   ============================================================ */
var world=new THREE.Group(); scene.add(world);
var blockers=[];
var hitables=[];

function addBlocker(x,z,w,d,top){
  blockers.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:top===undefined?999:top});
}
var platforms=[];      // walkable surfaces above the dirt: roofs, stairs, landings
var portals=[];        // doorways, where nothing may ever block you
function floorAt(x,z,feet){
  // Inclusive bounds: exclusive ones leave a hairline at a shared edge that a
  // footfall can land exactly on. The step-up allowance clears one stair tread
  // with room to spare.
  var h=terrainH(x,z), i;
  for(i=0;i<platforms.length;i++){
    var p=platforms[i];
    if(x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1&&p.y>h&&p.y<=feet+0.62) h=p.y;
  }
  /* Anything solid with a real top is also something you can come down on top
     of. Collision ignores whatever is below your feet so a roof can be walked,
     which means a jump carries you over a table or a counter - and without this
     you land inside it, and the next step ejects you across the room. Landing
     on the thing you jumped onto is both what you expect and what stops that.
     Barrels and the like carry no top at all and stay solid all the way up. */
  for(i=0;i<blockers.length;i++){
    var b=blockers[i];
    if(b.top<90&&b.top>h&&b.top<=feet+0.62&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1) h=b.top;
  }
  return h;
}
/* The height your feet would have to be at for this spot to be clear of
   anything solid. Collision treats you as a disc and the floor treats you as a
   point, so a jump can set you down standing over the lip of a counter with
   your middle off it: the floor says there is nothing under you, the walls say
   you are inside one, and the next step throws you clear. This says how high
   the thing you clipped is, so you can come down on top of it instead. */
function clearanceAt(x,z,r){
  var top=-1e9;
  for(var i=0;i<blockers.length;i++){
    var b=blockers[i];
    if(b.top>=90) continue;                       // no top to stand on
    if(x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r&&b.top>top) top=b.top;
  }
  return top;
}

/* The wagon's figure of eight. It lives up here because the prop scatter
   needs it: cactus and rock are placed everywhere except along this line. */
var ROUTE=[
  [-44,  5],  //  0  street, west end, south lane
  [ 44,  5],  //  1  EASTBOUND down main street
  [ 58, -9],  //  2  swing north at the east end   -- the crossing is on this leg
  [ 50,-39],  //  3
  [-50,-39],  //  4  westbound behind the north row
  [-52,-13],  //  5  turn south into the gap by the church
  [-52, 13],  //  6  through the gap
  [-50, 39],  //  7
  [ 50, 39],  //  8  eastbound behind the south row
  [ 58,  9],  //  9  swing north at the east end   -- and crosses leg 2 here
  [ 44, -5],  // 10  street, east end, north lane
  [-44, -5]   // 11  WESTBOUND back down main street
];
function segDist(px,pz,ax,az,bx,bz){
  var dx=bx-ax, dz=bz-az, l2=dx*dx+dz*dz;
  var t=l2>0?clamp(((px-ax)*dx+(pz-az)*dz)/l2,0,1):0;
  var qx=ax+t*dx-px, qz=az+t*dz-pz;
  return Math.sqrt(qx*qx+qz*qz);
}
function onRoute(x,z,m){
  for(var i=0;i<ROUTE.length;i++){
    var a=ROUTE[i], b=ROUTE[(i+1)%ROUTE.length];
    if(segDist(x,z,a[0],a[1],b[0],b[1])<m) return true;
  }
  return false;
}
function inPortal(x,z){
  for(var i=0;i<portals.length;i++){
    var r=portals[i];
    if(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1) return true;
  }
  return false;
}
function box(w,h,d,mat,x,y,z,parent){
  var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true;
  (parent||world).add(m); return m;
}

/* A structure is authored in local space with its front face at -Z, then dropped
   into the world at a right-angle rotation. Every wall registers its own
   footprint, so doorways are genuinely open and you walk through them. */
function Structure(x,z,face){
  var g=new THREE.Group();
  g.position.set(x,terrainH(x,z),z); g.rotation.y=face; world.add(g);
  var c=Math.cos(face), s=Math.sin(face), swap=Math.abs(s)>0.5;
  var S={g:g,noShadow:false};
  S.part=function(lw,lh,ld,mat,lx,ly,lz,solid){
    var m=box(lw,lh,ld,mat,lx,ly,lz,g);
    if(S.noShadow) m.castShadow=false;
    hitables.push(m);
    if(solid!==false) addBlocker(x+lx*c+lz*s, z-lx*s+lz*c, swap?ld:lw, swap?lw:ld, ly+lh/2);
    return m;
  };
  S.add=function(o){ g.add(o); return o; };
  S.blocker=function(lx,lz,lw,ld,top){ addBlocker(x+lx*c+lz*s, z-lx*s+lz*c, swap?ld:lw, swap?lw:ld, top); };
  S.platform=function(lx,lz,lw,ld,py){
    var wx=x+lx*c+lz*s, wz=z-lx*s+lz*c, pw=swap?ld:lw, pd=swap?lw:ld;
    platforms.push({x0:wx-pw/2,x1:wx+pw/2,z0:wz-pd/2,z1:wz+pd/2,y:py});
  };
  return S;
}

var WALLT=0.22, DOORW=2.2, DOORH=2.4, SILL=1.12, HEAD=2.28;
var interiors=[];                       // rooms you can stand in, in world space
function insideBuilding(x,z){
  for(var i=0;i<interiors.length;i++){
    var r=interiors[i];
    if(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1) return true;
  }
  return false;
}

/* A handful of trades hang a shingle out over the boardwalk as well as
   carrying a name board up on the false front. These are the ones you have to
   go looking for - a saloon or a hotel you can see from the far end of the
   street, but nobody knows where the doctor is until he says so. The shingle
   hangs square to the wall, so it reads walking the boardwalk where the name
   board reads from across the road. */
var TRADE={
  barber:'SHAVE & HAIRCUT', doctor:'PHYSICIAN & SURGEON', telegraph:'TELEGRAMS SENT',
  undertaker:'COFFINS MADE', office:'ASSAYS - GOLD & SILVER', livery:'HORSES BOARDED'
};
function shingle(g,text,x,y,z){
  var tex=signTex(text,'#3d2a1a','#E8DCC0');
  for(var i=-1;i<=1;i+=2){          // two faces back to back, so it reads from either end
    var f=new THREE.Mesh(new THREE.PlaneGeometry(1.7,0.44),
      new THREE.MeshLambertMaterial({map:tex}));
    f.position.set(x+i*0.02,y,z); f.rotation.y=i*Math.PI/2; g.add(f);
  }
  box(0.05,0.34,0.05,MAT.metal,x,y+0.39,z-0.70,g);   // the irons it swings from
  box(0.05,0.34,0.05,MAT.metal,x,y+0.39,z+0.70,g);
  box(0.06,0.06,1.62,MAT.metal,x,y+0.52,z,g);        // and the rail they hang off
}

function building(x,z,face,w,d,h,name,kind,lowFront,style,paint){
  var S=Structure(x,z,face), g=S.g;
  style=style||'front';
  var shell=PLANKS[(paint===undefined?0:paint)%PLANKS.length], open=!!kind;
  if(style==='stone'){
    if(!STONEMAT) STONEMAT=new THREE.MeshLambertMaterial({map:stoneTex()});
    shell=STONEMAT;
  }
  var wallMat=shell;
  if(open){ wallMat=shell.clone(); wallMat.emissive=new THREE.Color(0x140e08); }

  if(open){
    S.part(w,0.14,d,MAT.floor,0,0.05,0,false);                       // floorboards
    S.part(w,0.18,d,wallMat,0,h,0,false);                            // ceiling
    for(var sg=-1;sg<=1;sg+=2){                                       // side walls, cut for a window
      var sx=sg*(w/2-WALLT/2), swz=d*0.10, y0=1.30, y1=2.58, ow=1.55;
      S.part(WALLT,y0,d,wallMat,sx,y0/2,0);
      S.part(WALLT,h-y1,d,wallMat,sx,(h+y1)/2,0);
      var fl=(swz-ow/2)+d/2, rl=d/2-(swz+ow/2);
      S.part(WALLT,y1-y0,fl,wallMat,sx,(y0+y1)/2,-d/2+fl/2);
      S.part(WALLT,y1-y0,rl,wallMat,sx,(y0+y1)/2,d/2-rl/2);
      /* The glass is cut a touch larger than the hole and tucked inside the
         wall, not trimmed to fit it. Cut smaller it leaves a slot right the
         way round the pane that you can see daylight - and shoot - through. */
      S.part(0.05,y1-y0+0.04,ow+0.04,MAT.pane,sx,(y0+y1)/2,swz,false);
      S.part(0.085,y1-y0-0.10,0.06,MAT.wood1,sx,(y0+y1)/2,swz,false);
      S.part(0.085,0.055,ow-0.10,MAT.wood1,sx,(y0+y1)/2,swz,false);
      S.part(0.13,0.11,ow+0.26,MAT.wood1,sx,y1+0.05,swz,false);
      S.part(0.13,0.11,ow+0.26,MAT.wood1,sx,y0-0.05,swz,false);
      S.part(0.13,y1-y0+0.22,0.11,MAT.wood1,sx,(y0+y1)/2,swz-ow/2-0.06,false);
      S.part(0.13,y1-y0+0.22,0.11,MAT.wood1,sx,(y0+y1)/2,swz+ow/2+0.06,false);
      /* A wall is a wall at every height. Each piece of it only blocks up to
         its own top, and collision ignores anything below your feet so you can
         walk a roof - so the panel under a window stops blocking the moment a
         jump lifts you past 0.97, and the opening above it never blocked at
         all. You could hop straight through the glass and get spat back out on
         landing. One blocker over the whole column closes it. */
      S.blocker(sx,0,WALLT,d,h);
    }
    var by0=1.32, by1=2.58, bow=1.60, bside=(w-bow)/2;                // back wall, also cut
    S.part(w,by0,WALLT,wallMat,0,by0/2,d/2-WALLT/2);
    S.part(w,h-by1,WALLT,wallMat,0,(h+by1)/2,d/2-WALLT/2);
    S.part(bside,by1-by0,WALLT,wallMat,-(bow+bside)/2,(by0+by1)/2,d/2-WALLT/2);
    S.part(bside,by1-by0,WALLT,wallMat, (bow+bside)/2,(by0+by1)/2,d/2-WALLT/2);
    S.part(bow+0.04,by1-by0+0.04,0.05,MAT.pane,0,(by0+by1)/2,d/2-0.13,false);
    S.part(0.06,by1-by0-0.10,0.085,MAT.wood1,0,(by0+by1)/2,d/2-0.11,false);
    S.part(bow-0.10,0.055,0.085,MAT.wood1,0,(by0+by1)/2,d/2-0.11,false);
    S.part(bow+0.28,0.11,0.13,MAT.wood1,0,by1+0.06,d/2-0.02,false);
    S.part(bow+0.28,0.11,0.13,MAT.wood1,0,by0-0.06,d/2-0.02,false);
    S.part(0.12,by1-by0+0.24,0.13,MAT.wood1,-bow/2-0.06,(by0+by1)/2,d/2-0.02,false);
    S.part(0.12,by1-by0+0.24,0.13,MAT.wood1, bow/2+0.06,(by0+by1)/2,d/2-0.02,false);
    S.blocker(0,d/2-WALLT/2,w,WALLT,h);
    var pw=(w-DOORW)/2;                                              // front, either side of the door
    for(var sgn=-1;sgn<=1;sgn+=2){
      var cx=sgn*(DOORW/2+pw/2), ww=Math.min(pw-0.9,2.1);
      if(ww>0.7){
        var jw=(pw-ww)/2;
        S.part(pw,SILL,WALLT,wallMat,cx,SILL/2,-d/2+WALLT/2);
        S.part(pw,h-HEAD,WALLT,wallMat,cx,(h+HEAD)/2,-d/2+WALLT/2);
        S.part(jw,HEAD-SILL,WALLT,wallMat,cx-ww/2-jw/2,(SILL+HEAD)/2,-d/2+WALLT/2);
        S.part(jw,HEAD-SILL,WALLT,wallMat,cx+ww/2+jw/2,(SILL+HEAD)/2,-d/2+WALLT/2);
        S.part(ww,0.10,0.34,MAT.wood1,cx,SILL+0.05,-d/2+0.04,false); // sill board
        var wy=(SILL+HEAD)/2, wh=HEAD-SILL;
        S.part(ww+0.04,wh+0.04,0.035,MAT.pane,cx,wy,-d/2+0.13,false);  // glazing, lapped into the jambs
        S.part(0.045,wh-0.06,0.065,MAT.wood1,cx,wy,-d/2+0.11,false);   // muntins
        S.part(ww-0.05,0.045,0.065,MAT.wood1,cx,wy,-d/2+0.11,false);
        S.part(ww+0.20,0.10,0.12,MAT.wood1,cx,HEAD+0.06,-d/2+0.02,false);   // trim
        S.part(0.10,wh+0.22,0.12,MAT.wood1,cx-ww/2-0.08,wy,-d/2+0.02,false);
        S.part(0.10,wh+0.22,0.12,MAT.wood1,cx+ww/2+0.08,wy,-d/2+0.02,false);
      } else S.part(pw,h,WALLT,wallMat,cx,h/2,-d/2+WALLT/2);
      S.blocker(cx,-d/2+WALLT/2,pw,WALLT,h);      // the doorway stays the only way in
    }
    S.part(DOORW,h-DOORH,WALLT,wallMat,0,(h+DOORH)/2,-d/2+WALLT/2,false);  // header: no footprint, you walk under it
    S.part(DOORW+0.36,0.14,0.16,MAT.wood1,0,DOORH+0.08,-d/2+0.02,false);   // door casing
    S.part(0.14,DOORH+0.16,0.16,MAT.wood1,-DOORW/2-0.07,DOORH/2,-d/2+0.02,false);
    S.part(0.14,DOORH+0.16,0.16,MAT.wood1, DOORW/2+0.07,DOORH/2,-d/2+0.02,false);
    for(var pj=-1;pj<=1;pj+=2){                                      // notices nailed by the door
      // below the lamp, not behind it - at 1.62 the sheet came out through the glass
      if(rnd()<0.55) poster(g,pj*(DOORW/2+0.42),1.26,-d/2-0.03,Math.PI,rr(0.9,1.15));
    }
    hangDoors(S,face,x,z,d,kind);
    for(var lp=-1;lp<=1;lp+=2){                                      // coach lamps at the door
      S.part(0.09,0.34,0.09,MAT.metal,lp*(DOORW/2+0.34),2.05,-d/2-0.06,false);
      S.part(0.20,0.24,0.20,MAT.metal,lp*(DOORW/2+0.34),1.80,-d/2-0.06,false);
      var fl2=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.16,0.13),
        new THREE.MeshLambertMaterial({color:0xFFD79A,emissive:0xC98A24}));
      fl2.position.set(lp*(DOORW/2+0.34),1.80,-d/2-0.06); g.add(fl2);
    }
    dressInterior(S,kind,w,d,h);
    var swp=Math.abs(Math.sin(face))>0.5;
    var iw=(swp?d:w)/2-WALLT-0.15, id=(swp?w:d)/2-WALLT-0.15;
    interiors.push({x0:x-iw,x1:x+iw,z0:z-id,z1:z+id,kind:kind});
  }else{
    S.part(w,h,d,shell,0,h/2,0);                                     // shuttered: a solid mass
    S.part(1.2,2.2,0.14,MAT.dark,0,1.1,-d/2-0.08,false);
    var b1=box(1.5,0.2,0.08,MAT.wood1,0,1.5,-d/2-0.16,g); b1.rotation.z=0.5; hitables.push(b1);
    var b2=box(1.5,0.2,0.08,MAT.wood1,0,1.5,-d/2-0.16,g); b2.rotation.z=-0.5; hitables.push(b2);
    S.part(1.5,1.2,0.12,MAT.glass,-w/2+1.5,1.75,-d/2-0.07,false);
    S.part(1.5,1.2,0.12,MAT.glass, w/2-1.5,1.75,-d/2-0.07,false);
  }

  var fh=h+(lowFront?0.95:rr(1.5,2.3)), i, deck=0;
  S.part(0.30,h,0.34,shell,-w/2-0.12,h/2,-d/2-0.14,false);           // corner pilasters
  S.part(0.30,h,0.34,shell, w/2+0.12,h/2,-d/2-0.14,false);
  S.part(w+0.34,0.20,0.42,MAT.wood1,0,h+0.02,-d/2-0.16,false);       // cornice
  if(style==='stepped'){                                             // a parapet in three tiers
    S.part(w*0.40,fh-h,0.36,shell,0,(h+fh)/2,-d/2-0.14,false);
    var t2=(fh-h)*0.70, t3=(fh-h)*0.42;
    S.part(w*0.24,t2,0.36,shell,-w*0.32,h+t2/2,-d/2-0.14,false);
    S.part(w*0.24,t2,0.36,shell, w*0.32,h+t2/2,-d/2-0.14,false);
    S.part(w*0.16,t3,0.36,shell,-w*0.54,h+t3/2,-d/2-0.14,false);
    S.part(w*0.16,t3,0.36,shell, w*0.54,h+t3/2,-d/2-0.14,false);
  }else if(style==='gable'){
    /* A false front on the street with the pitched roof behind it, which is
       how these were actually put up - and it leaves a flat deck along the
       front that you can run and jump across. */
    S.part(w+0.34,fh-h,0.36,shell,0,(h+fh)/2,-d/2-0.14,false);
    deck=3.2;
    var rz0=-d/2+deck, rdep=d-deck;
    var half=(w+0.5)/2, riseR=1.7, slope=Math.hypot(half,riseR), angR=Math.atan2(riseR,half);
    var g1=box(slope,0.18,rdep+0.6,MAT.wood1,-half/2,h+riseR/2+0.10,rz0+rdep/2,g); g1.rotation.z= angR;
    var g2=box(slope,0.18,rdep+0.6,MAT.wood1, half/2,h+riseR/2+0.10,rz0+rdep/2,g); g2.rotation.z=-angR;
    hitables.push(g1); hitables.push(g2);
    var shp=new THREE.Shape();
    shp.moveTo(-half,0); shp.lineTo(half,0); shp.lineTo(0,riseR); shp.closePath();
    var gg=new THREE.ExtrudeGeometry(shp,{depth:0.26,bevelEnabled:false});
    var e1=new THREE.Mesh(gg,shell); e1.position.set(0,h+0.10,rz0-0.26); g.add(e1);
    var e2=new THREE.Mesh(gg,shell); e2.position.set(0,h+0.10,d/2); g.add(e2);
    box(0.26,0.26,rdep+0.7,MAT.wood1,0,h+riseR+0.10,rz0+rdep/2,g);
  }else if(style==='stone'){                                         // the bank
    S.part(w+0.34,fh-h,0.44,shell,0,(h+fh)/2,-d/2-0.16,false);
    S.part(w+0.70,0.26,0.58,shell,0,fh-0.13,-d/2-0.20,false);        // heavy cap
    S.part(w+0.60,0.22,0.54,shell,0,h+0.30,-d/2-0.18,false);
    for(i=0;i<9;i++) S.part(0.16,0.16,0.50,shell,-w*0.42+i*(w*0.105),h+0.52,-d/2-0.20,false);  // dentils
    S.part(0.52,h,0.46,shell,-DOORW/2-0.55,h/2,-d/2-0.20,false);     // pilasters flanking the door
    S.part(0.52,h,0.46,shell, DOORW/2+0.55,h/2,-d/2-0.20,false);
    S.part(0.62,0.20,0.56,shell,-DOORW/2-0.55,h-0.10,-d/2-0.22,false);
    S.part(0.62,0.20,0.56,shell, DOORW/2+0.55,h-0.10,-d/2-0.22,false);
    for(i=0;i<5;i++){                                                // a fanlight arch over the door
      var aw=DOORW+0.5-i*0.34;
      S.part(aw,0.13,0.42,shell,0,DOORH+0.30+i*0.12,-d/2-0.18,false);
    }
    for(i=0;i<6;i++){                                                // quoins down the corners
      var qy=0.5+i*(h/6);
      S.part(0.44,0.36,0.40,shell,-w/2-0.10,qy,-d/2-0.16,false);
      S.part(0.44,0.36,0.40,shell, w/2+0.10,qy,-d/2-0.16,false);
    }
  }else{
    S.part(w+0.34,fh-h,0.36,shell,0,(h+fh)/2,-d/2-0.14,false);       // plain false front
  }
  if(style==='two'){
    var by=h*0.52;                                                   // the balcony deck
    box(w+0.8,0.18,2.9,MAT.wood1,0,by,-d/2-1.65,g);
    for(i=0;i<4;i++) S.part(0.15,by,0.15,MAT.wood1,-w/2+0.4+i*((w-0.8)/3),by/2,-d/2-2.85,false);
    for(i=0;i<4;i++) S.part(0.13,h-by-0.3,0.13,MAT.wood1,-w/2+0.4+i*((w-0.8)/3),by+(h-by)/2,-d/2-2.85,false);
    box(w+0.9,0.16,3.0,MAT.wood1,0,h-0.15,-d/2-1.70,g);              // roof over the gallery
    box(w+0.8,0.10,0.10,MAT.wood1,0,by+1.05,-d/2-3.05,g);            // rail
    box(w+0.8,0.08,0.08,MAT.wood1,0,by+0.58,-d/2-3.05,g);
    for(i=0;i<18;i++) box(0.055,0.95,0.055,MAT.wood1,-w/2-0.3+i*((w+0.6)/17),by+0.55,-d/2-3.05,g);
    for(i=-1;i<=1;i+=2){                                             // second-floor windows
      var wx=i*(w*0.24);
      S.part(1.20,1.35,0.10,MAT.pane,wx,by+1.45,-d/2-0.03,false);
      S.part(0.12,1.55,0.14,MAT.wood1,wx-0.66,by+1.45,-d/2-0.05,false);
      S.part(0.12,1.55,0.14,MAT.wood1,wx+0.66,by+1.45,-d/2-0.05,false);
      S.part(1.44,0.13,0.16,MAT.wood1,wx,by+2.25,-d/2-0.05,false);
      S.part(1.44,0.13,0.20,MAT.wood1,wx,by+0.66,-d/2-0.06,false);
      S.part(0.07,1.35,0.06,MAT.wood1,wx,by+1.45,-d/2-0.06,false);
    }
  }else{
    box(w+0.7,0.16,2.6,MAT.wood1,0,h*0.62,-d/2-1.5,g);               // awning
  }
  if(style!=='two'){
    S.part(0.17,h*0.62,0.17,MAT.wood1,-w/2+0.3,h*0.31,-d/2-2.6);
    S.part(0.17,h*0.62,0.17,MAT.wood1, w/2-0.3,h*0.31,-d/2-2.6);
    // sized to the post it is nailed to, rather than hanging over both edges of it
    if(rnd()<0.5) poster(g,(rnd()<0.5?-1:1)*(w/2-0.3),1.55,-d/2-2.70,Math.PI,0.40);
  }
  var bw=box(w+0.9,0.2,3.0,MAT.wood1,0,0.1,-d/2-1.6,g); bw.castShadow=false;
  // hung from the awning, clear of the door and well over head height
  if(TRADE[kind]&&style!=='two') shingle(g,TRADE[kind],-w/2+1.6,h*0.62-0.64,-d/2-1.9);

  /* Roofs are platforms, so the whole street can be crossed over the tops.
     The false front doubles as a parapet once you are up there. */
  if(open){
    if(deck) S.platform(0,-d/2+deck/2,w+0.30,deck,h+0.09);
    else     S.platform(0,0,w+0.30,d+0.30,h+0.09);
  }
  /* The face of the building, as a wall you cannot walk through - but in two
     pieces, with the doorway between them. Run across the whole front it sits
     over the opening as well, and the only thing letting you in is the portal
     turning collision off; stand at the edge of that and you are exempt while
     half inside the wall, and the step that leaves the exemption throws you
     half a metre. Leaving a real gap means nothing has to be excused. */
  if(open){
    var fbw=(w+0.34-DOORW)/2;
    S.blocker(-(DOORW+fbw)/2,-d/2-0.14,fbw,0.36,fh);
    S.blocker( (DOORW+fbw)/2,-d/2-0.14,fbw,0.36,fh);
  }else S.blocker(0,-d/2-0.14,w+0.34,0.36,fh);

  /* The name board on the false front. A plane faces its own +z, and the
     front of the building is local -z, so it has to be turned about to face
     the street - without this it is hung backwards and the whole town reads
     as unsigned. Turning the mesh rather than doubling the material keeps
     the lettering the right way round. */
  var sw=Math.min(w-0.4,5.4);
  var sign=new THREE.Mesh(new THREE.PlaneGeometry(sw,sw*0.25),
    new THREE.MeshLambertMaterial({map:signTex(name,'#4b3421','#E8DCC0')}));
  sign.position.set(0,h+0.74,-d/2-0.34); sign.rotation.y=Math.PI; g.add(sign);
  return S;
}

/* --- people who live here: they do not shoot, they duck --- */
var folk=[];
function person(g,x,y,z,yaw,cfg){
  var G=new THREE.Group(); G.position.set(x,y,z); G.rotation.y=yaw; g.add(G);
  var coat=new THREE.MeshLambertMaterial({color:cfg.coat});
  var shirt=new THREE.MeshLambertMaterial({color:cfg.shirt});
  var skin=new THREE.MeshLambertMaterial({color:cfg.skin||0xC59A72});
  function b(bw,bh,bd,m,px,py,pz,p){
    var q=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),m);
    q.position.set(px,py,pz); (p||G).add(q); return q;
  }
  var seated=!!cfg.seated, hip=seated?0.54:0.86;
  var tY=hip+(seated?0.56:0.64), hY=tY+0.45;
  var torsoH=seated?0.52:0.60, tBot=tY-torsoH/2;   // where the hips have to reach up to
  if(cfg.robe){
    var rb=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.44,seated?0.98:1.30,10),coat);
    rb.position.y=(seated?0.98:1.30)/2; G.add(rb);
  }else{
    var legMat=cfg.trews?new THREE.MeshLambertMaterial({color:cfg.trews}):coat;
    /* Hips. The legs hang off a pivot at hip height and the torso sits well
       above it, so without something bridging the two the body floats over the
       legs - which you cannot miss once they sit down and the thighs swing
       forward out from under it. */
    b(0.44,tBot-hip+0.08,0.30,legMat,0,(hip+tBot)/2,0);
    for(var lg=0;lg<2;lg++){
      var pv=new THREE.Group(); pv.position.set(lg?0.14:-0.14,hip,0); G.add(pv);
      var up=b(0.19,0.46,0.21,legMat,0,-0.23,0,pv);
      if(seated){ pv.rotation.x=-1.45; }
      var kn=new THREE.Group(); kn.position.y=-0.46; pv.add(kn);
      b(0.16,0.44,0.18,coat,0,-0.22,0,kn);
      if(seated) kn.rotation.x=1.48;
      b(0.18,0.10,0.26,MAT.dark,0,-0.46,0.04,kn);
    }
  }
  b(0.56,torsoH,0.32,shirt,0,tY,0);
  if(cfg.vest) b(0.58,0.44,0.34,new THREE.MeshLambertMaterial({color:cfg.vest}),0,tY-0.03,0);
  if(cfg.apron) b(0.46,0.62,0.20,new THREE.MeshLambertMaterial({color:0xD9CDB4}),0,tY-0.16,0.17);
  if(cfg.collar) b(0.30,0.09,0.30,new THREE.MeshLambertMaterial({color:0xEDE6D4}),0,tY+0.29,0);
  var armL=new THREE.Group(); armL.position.set(-0.34,tY+0.24,0.02); G.add(armL);
  b(0.14,0.50,0.15,shirt,0,-0.25,0,armL);
  b(0.11,0.12,0.11,skin,0,-0.53,0,armL);
  var armR=new THREE.Group(); armR.position.set(0.34,tY+0.24,0.02); G.add(armR);
  b(0.14,0.50,0.15,shirt,0,-0.25,0,armR);
  b(0.11,0.12,0.11,skin,0,-0.53,0,armR);
  var head=new THREE.Group(); head.position.set(0,hY,0); G.add(head);
  var hd=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8),skin); head.add(hd);
  if(cfg.hair) b(0.30,0.13,0.30,new THREE.MeshLambertMaterial({color:cfg.hair}),0,0.07,-0.02,head);
  if(cfg.hat==='derby'){
    var cr=new THREE.Mesh(new THREE.CylinderGeometry(0.145,0.155,0.15,10),MAT.dark);
    cr.position.y=0.16; head.add(cr);
    var br=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.026,12),MAT.dark);
    br.position.y=0.10; head.add(br);
  }else if(cfg.hat==='slouch'){
    var cr2=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.17,0.16,10),
      new THREE.MeshLambertMaterial({color:0x4A3A28}));
    cr2.position.y=0.17; head.add(cr2);
    var br2=new THREE.Mesh(new THREE.CylinderGeometry(0.31,0.31,0.026,12),
      new THREE.MeshLambertMaterial({color:0x4A3A28}));
    br2.position.y=0.11; head.add(br2);
  }else if(cfg.hat==='bonnet'){
    var bn=new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8,0,TAU,0,Math.PI*0.6),
      new THREE.MeshLambertMaterial({color:0xC8B79A}));
    bn.position.y=0.05; head.add(bn);
  }
  G.traverse(function(o){ if(o.isMesh){ o.castShadow=false; } });
  var f={g:G,head:head,armL:armL,armR:armR,baseY:y,ph:rr(0,TAU),
         wipe:!!cfg.wipe,play:!!cfg.play,reins:!!cfg.reins,scare:0,seated:seated};
  folk.push(f);
  return f;
}

/* --- the drinking establishments, each fitted out differently --- */
function dressSaloon(S,g,w,d,h,v){
  var back=d/2-0.9, i;
  function it(lw,lh,ld,mat,lx,ly,lz,solid){ return S.part(lw,lh,ld,mat,lx,ly,lz,solid===true); }
  function cyl(r1,r2,hh,seg,mat,lx,ly,lz){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,hh,seg),mat);
    m.position.set(lx,ly,lz); g.add(m); hitables.push(m); return m;
  }
  function picture(kind,pw,ph,lx,ly,lz,rotY){
    var nx=Math.sin(rotY), nz=Math.cos(rotY);
    var fr=new THREE.Mesh(new THREE.BoxGeometry(pw+0.14,ph+0.14,0.06),
      new THREE.MeshLambertMaterial({color:v===1?0x8A6A2E:0x4A3520,emissive:0x120c06}));
    fr.position.set(lx,ly,lz); fr.rotation.y=rotY; g.add(fr); hitables.push(fr);
    var pl=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),
      new THREE.MeshLambertMaterial({map:pictureTex(kind),emissive:0x241a10}));
    pl.position.set(lx+nx*0.04,ly,lz+nz*0.04); pl.rotation.y=rotY; g.add(pl);
  }
  function wallGun(lx,ly,lz,rotY){
    var G=new THREE.Group(); G.position.set(lx,ly,lz); G.rotation.y=rotY; g.add(G);
    function q(bw,bh,bd,m,px,py,pz){var e=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),m);e.position.set(px,py,pz);G.add(e);hitables.push(e);return e;}
    q(0.78,0.030,0.028,MAT.gunmetal,-0.20,0.02,0);
    q(0.20,0.068,0.040,MAT.gunmetal,0.14,0.00,0);
    q(0.34,0.082,0.046,MAT.inside,0.40,-0.02,0);
    q(0.05,0.10,0.09,MAT.metal,-0.42,-0.05,0);
    q(0.05,0.10,0.09,MAT.metal,0.30,-0.05,0);
  }
  function chandelier(lx,lz,rad,warm){
    var C=new THREE.Group(); C.position.set(lx,h-0.62,lz); g.add(C);
    var ring=new THREE.Mesh(new THREE.TorusGeometry(rad,0.035,6,18),MAT.inside);
    ring.rotation.x=Math.PI/2; C.add(ring);
    for(var k=0;k<8;k++){
      var an=k/8*TAU;
      var sp=new THREE.Mesh(new THREE.BoxGeometry(rad*2,0.03,0.03),MAT.inside);
      sp.rotation.y=an; C.add(sp);
      var cd=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.026,0.14,6),MAT.bone);
      cd.position.set(Math.cos(an)*rad,0.09,Math.sin(an)*rad); C.add(cd);
      var fl=new THREE.Mesh(new THREE.SphereGeometry(0.030,6,5),
        new THREE.MeshBasicMaterial({color:0xFFD79A}));
      fl.position.set(Math.cos(an)*rad,0.19,Math.sin(an)*rad); fl.scale.y=1.8; C.add(fl);
    }
    var ch=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.55,5),MAT.inside);
    ch.position.y=0.34; C.add(ch);
    var lamp=new THREE.PointLight(warm,0.85,12,2); lamp.position.y=0.15; C.add(lamp);
  }
  function stove(lx,lz){
    cyl(0.34,0.38,1.05,12,MAT.gunmetal,lx,0.52,lz);
    cyl(0.20,0.20,0.06,10,MAT.gunmetal,lx,1.08,lz);
    cyl(0.09,0.09,h-1.1,8,MAT.gunmetal,lx,1.10+(h-1.1)/2,lz);
    var glow=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.20,0.03),
      new THREE.MeshLambertMaterial({color:0xE0641E,emissive:0xB43C0C}));
    glow.position.set(lx,0.50,lz-0.375); g.add(glow);
    it(0.6,0.06,0.6,MAT.gunmetal,lx,0.02,lz);
  }
  function bottles(lx,ly,lz,n,along){
    for(var k=0;k<n;k++){
      var bx=along?lx-n*0.09+k*0.18:lx, bz=along?lz:lz-n*0.09+k*0.18;
      cyl(0.042,0.05,rr(0.22,0.32),7,MAT.bottle,bx,ly+0.13,bz);
    }
  }
  function table(lx,lz,felt){
    cyl(0.66,0.62,0.09,14,felt?MAT.felt:MAT.wood1,lx,0.78,lz);
    cyl(0.09,0.13,0.78,8,MAT.inside,lx,0.39,lz);
    cyl(0.30,0.30,0.05,10,MAT.inside,lx,0.03,lz);
    for(var k=0;k<3;k++){
      var an=k/3*TAU+lx;
      cyl(0.20,0.19,0.075,8,MAT.wood1,lx+Math.cos(an)*1.06,0.52,lz+Math.sin(an)*1.06);
      cyl(0.055,0.055,0.48,6,MAT.inside,lx+Math.cos(an)*1.06,0.26,lz+Math.sin(an)*1.06);
    }
  }
  function barTop(lx,lz,len,along,plank){
    // along=true: the bar runs along z against a side wall
    var bw=along?0.88:len, bd=along?len:0.88;
    it(bw,1.10,bd,plank?PLANKS[2]:MAT.inside,lx,0.55,lz,true);
    it(bw+0.22,0.10,bd+0.22,MAT.wood1,lx,1.15,lz);
    var fr=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,len*0.8,8),MAT.brass);
    if(along) fr.rotation.x=Math.PI/2; else fr.rotation.z=Math.PI/2;
    fr.position.set(lx+(along?0.55:0),0.20,lz+(along?0:0.55)); g.add(fr);
  }

  if(v===0){
    // THE OCCIDENTAL - long bar down the left, piano at the back
    barTop(-w/2+1.80,0.3,d*0.60,true,false);
    it(0.44,2.20,d*0.50,MAT.inside,-w/2+0.46,1.10,0.3,true);              // back bar
    var mir=new THREE.Mesh(new THREE.PlaneGeometry(d*0.34,1.25),MAT.mirror);
    mir.position.set(-w/2+0.70,1.95,0.3); mir.rotation.y=Math.PI/2; g.add(mir);
    bottles(-w/2+0.62,1.30,-0.9,6,false); bottles(-w/2+0.62,1.92,1.4,4,false);
    it(0.9,0.06,d*0.46,MAT.wood1,-w/2+0.62,1.28,0.3);
    it(0.9,0.06,d*0.46,MAT.wood1,-w/2+0.62,1.90,0.3);
    // longhorn skull over the mirror
    var sk=cyl(0.16,0.20,0.30,8,MAT.bone,-w/2+0.66,2.86,0.3); sk.rotation.z=Math.PI/2;
    for(i=0;i<2;i++){
      var hn=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.012,0.85,6),MAT.bone);
      hn.position.set(-w/2+0.66,2.98,0.3+(i?0.42:-0.42));
      hn.rotation.x=(i?1:-1)*1.25; hn.rotation.z=0.2; g.add(hn);
    }
    it(0.72,1.30,1.95,MAT.inside,w/2-1.1,0.65,back-1.1,true);             // upright piano
    it(0.16,0.10,1.75,MAT.bone,w/2-1.52,1.06,back-1.1);
    it(0.10,0.05,1.60,MAT.dark,w/2-1.58,1.11,back-1.1);
    it(0.80,0.08,2.05,MAT.wood1,w/2-1.1,1.32,back-1.1);
    cyl(0.22,0.22,0.07,10,MAT.wood1,w/2-1.95,0.56,back-1.1);
    cyl(0.06,0.06,0.52,6,MAT.inside,w/2-1.95,0.28,back-1.1);
    table(w*0.10,-d*0.22,false); table(w*0.20,d*0.10,false);
    picture('portrait',0.62,0.78,w/2-WALLT-0.10,2.20,-d*0.24,-Math.PI/2);
    picture('horse',0.86,0.66,w/2-WALLT-0.10,2.20,-d*0.06,-Math.PI/2);
    picture('wanted',0.54,0.68,-w/2+WALLT+0.10,2.35,-d*0.32,Math.PI/2);
    wallGun(0,2.45,back+0.62,0);
    chandelier(0,-d*0.06,0.52,0xFFB566);
    cyl(0.17,0.13,0.16,10,MAT.brass,-w/2+2.4,0.09,-d*0.30);              // spittoon
    person(g,-w/2+1.00,0,0.3,-Math.PI/2,{coat:0x5A4A38,shirt:0xD6CBB2,apron:1,wipe:1,hair:0x3A2C1E});
    person(g,w/2-2.05,0.02,back-1.1,Math.PI/2,{coat:0x3E3830,shirt:0xC8BCA2,vest:0x2E2A26,seated:1,play:1,hair:0x2A1F16});
    person(g,w*0.10+1.0,0.02,-d*0.22-0.35,2.4,{coat:0x46403A,shirt:0xBFB39A,vest:0x5A3A30,seated:1,hat:'slouch'});
    person(g,w*0.10-1.0,0.02,-d*0.22+0.35,-0.7,{coat:0x3A3630,shirt:0xC2B69C,vest:0x36302A,seated:1,hat:'derby'});
  }else if(v===1){
    // THE PALACE - the good room. Bar across the back, faro in the middle
    barTop(0,back-0.95,w-3.2,false,false);
    it(w-3.6,2.30,0.44,MAT.inside,0,1.15,back+0.42,true);
    var mir2=new THREE.Mesh(new THREE.PlaneGeometry(w-4.6,1.35),MAT.mirror);
    mir2.position.set(0,2.00,back+0.19); mir2.rotation.y=Math.PI; g.add(mir2);
    it(w-4.4,0.06,0.7,MAT.wood1,0,1.32,back+0.30);
    it(w-4.4,0.06,0.7,MAT.wood1,0,1.94,back+0.30);
    bottles(-1.4,1.34,back+0.30,7,true); bottles(1.1,1.96,back+0.30,5,true);
    table(0,-d*0.06,true);                                                // faro layout
    for(i=0;i<10;i++) cyl(0.055,0.055,0.05,8,i%2?MAT.drape:MAT.bone,rr(-0.4,0.4),0.86,-d*0.06+rr(-0.4,0.4));
    it(0.16,0.012,0.11,MAT.bone,0.30,0.835,-d*0.06+0.22);
    it(0.16,0.012,0.11,MAT.bone,0.10,0.835,-d*0.06+0.30);
    table(-w*0.24,d*0.16,false);
    for(i=0;i<2;i++){                                                     // velvet drapes
      var sg=i?1:-1;
      it(0.10,1.60,0.42,MAT.drape,sg*(w/2-WALLT-0.10),2.10,-d*0.16-0.70);
      it(0.10,1.60,0.42,MAT.drape,sg*(w/2-WALLT-0.10),2.10,-d*0.16+0.70);
      it(0.10,1.60,0.42,MAT.drape,sg*(w/2-WALLT-0.10),2.10,d*0.18-0.70);
      it(0.10,1.60,0.42,MAT.drape,sg*(w/2-WALLT-0.10),2.10,d*0.18+0.70);
    }
    it(w-2.2,0.05,1.9,MAT.drape,0,0.13,-d*0.06);                          // rug
    picture('landscape',1.15,0.86,-w/2+WALLT+0.10,2.30,-d*0.14,Math.PI/2);
    picture('portrait',0.66,0.84,w/2-WALLT-0.10,2.30,-d*0.10,-Math.PI/2);
    picture('still',0.70,0.86,w/2-WALLT-0.10,2.30,d*0.30,-Math.PI/2);
    stove(-w/2+1.2,-d*0.30);
    chandelier(0,-d*0.06,0.62,0xFFC98A);
    person(g,0,0,back-0.15,Math.PI,{coat:0x4A4038,shirt:0xE0D6C0,apron:1,wipe:1,hair:0x4A3A28});
    person(g,0,0,-d*0.06+1.35,0,{coat:0x2E2A26,shirt:0xE4DAC4,vest:0x3A2E28,hat:'derby',hair:0x2A2018});
    person(g,1.25,0.02,-d*0.06-0.9,-2.3,{coat:0x44362C,shirt:0xC9BDA2,vest:0x5A4232,seated:1,hat:'slouch'});
    person(g,-1.25,0.02,-d*0.06-0.9,2.3,{coat:0x36322C,shirt:0xCEC2A8,vest:0x2E2A26,seated:1,hair:0x1E1812});
  }else{
    // THE BULLHEAD - planks over barrels, and a rack of guns
    barTop(w/2-1.85,-0.1,d*0.55,true,true);
    for(i=0;i<4;i++) cyl(0.40,0.36,0.95,10,PLANKS[2],w/2-1.85,0.47,-d*0.22+i*1.15);
    it(0.40,1.90,d*0.45,PLANKS[2],w/2-0.52,0.95,-0.1,true);
    bottles(w/2-0.60,1.22,-0.6,5,false);
    it(0.8,0.06,d*0.40,MAT.wood1,w/2-0.60,1.20,-0.1);
    it(1.1,0.12,3.4,MAT.wood1,-w*0.10,0.80,d*0.04,true);                  // trestle table
    it(0.14,0.72,0.14,MAT.inside,-w*0.10,0.40,d*0.04-1.4);
    it(0.14,0.72,0.14,MAT.inside,-w*0.10,0.40,d*0.04+1.4);
    for(i=0;i<5;i++) cyl(0.34,0.30,0.82,9,PLANKS[2],-w*0.10+(i%2?1.15:-1.15),0.41,d*0.04-1.3+i*0.7);
    for(i=0;i<3;i++) wallGun(-w/2+WALLT+0.22,1.35+i*0.62,back-1.6,Math.PI/2);
    it(0.12,0.10,2.4,MAT.wood1,-w/2+WALLT+0.30,1.05,back-1.6);
    picture('wanted',0.52,0.66,-w/2+WALLT+0.10,2.45,-d*0.26,Math.PI/2);
    picture('wanted',0.52,0.66,-w/2+WALLT+0.10,2.45,-d*0.02,Math.PI/2);
    for(i=0;i<2;i++){                                                     // antlers
      var an2=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.015,0.78,6),MAT.bone);
      an2.position.set((i?0.34:-0.34),2.62,back+0.55);
      an2.rotation.z=(i?-1:1)*0.75; an2.rotation.x=-0.3; g.add(an2);
    }
    it(0.30,0.26,0.22,MAT.hide,0,2.44,back+0.58);
    stove(-w/2+1.3,-d*0.28);
    for(i=0;i<16;i++){ var st=it(rr(0.3,0.7),0.03,rr(0.05,0.12),MAT.sage,rr(-w*0.3,w*0.3),0.13,rr(-d*0.3,d*0.3)); st.rotation.y=rr(0,3); }
    person(g,w/2-1.02,0,-0.1,Math.PI/2,{coat:0x4E4236,shirt:0xCFC3AA,apron:1,wipe:1,hat:'slouch'});
    person(g,-w*0.10+1.9,0.02,d*0.04-0.5,-1.9,{coat:0x3E3228,shirt:0xB8AC94,vest:0x4A3A2C,seated:1,hat:'slouch'});
    person(g,-w*0.10-1.9,0.02,d*0.04+0.6,1.9,{coat:0x463A2E,shirt:0xC4B89E,seated:1,hair:0x3A2C1E});
    var lamp2=new THREE.PointLight(0xFF9A4E,0.75,10,2);
    lamp2.position.set(0,h-0.8,0); g.add(lamp2);
    cyl(0.16,0.22,0.24,8,MAT.rust,0,h-0.62,0);
  }
}

/* --- doors on real hinges: they swing the way you push and flap back --- */
var doors=[];
var DOORMAT=new THREE.MeshLambertMaterial({map:woodTex('#8E4A30','#4A2214'),emissive:0x1a0c06});
var PLANKDOOR=new THREE.MeshLambertMaterial({map:woodTex('#9c7b4e','#4f3a22'),emissive:0x140d07});
function isSaloon(kind){ return kind&&kind.indexOf('saloon')===0; }
function hangDoors(S,face,x,z,d,kind){
  var g=S.g, lw=DOORW/2-0.05, dz=-d/2+0.26, bat=isSaloon(kind)||kind==='hotel';
  var hL=new THREE.Group(); hL.position.set(-DOORW/2+0.06,0,dz); g.add(hL);
  var hR=new THREE.Group(); hR.position.set( DOORW/2-0.06,0,dz); g.add(hR);
  function leaf(p,dir){
    var cx=dir*lw/2, i, y0=0.46, y1=1.98;
    if(bat){
      var SEG=9, sw=lw/SEG, t, rise, dip;
      // domed head and scalloped foot, cut from stepped segments
      for(i=0;i<SEG;i++){
        t=(i+0.5)/SEG;
        rise=Math.sin(t*Math.PI)*0.13;
        dip =Math.sin(t*Math.PI)*0.10;
        box(sw*1.06,0.13+rise,0.085,DOORMAT,dir*(sw*0.5+i*sw),y1-0.065-rise*0.5+rise,0,p);
        box(sw*1.06,0.15+dip,0.075,DOORMAT,dir*(sw*0.5+i*sw),y0+0.075+dip*0.5-dip,0,p);
      }
      // stiles
      box(0.085,y1-y0-0.10,0.090,DOORMAT,dir*0.042,(y0+y1)/2,0,p);
      box(0.075,y1-y0-0.20,0.090,DOORMAT,dir*(lw-0.037),(y0+y1)/2,0,p);
      // raised lower panel
      box(lw-0.11,0.40,0.072,DOORMAT,cx,y0+0.34,0,p);
      box(lw-0.30,0.28,0.088,DOORMAT,cx,y0+0.34,0,p);
      box(lw-0.11,0.085,0.092,DOORMAT,cx,y0+0.58,0,p);          // mid rail
      // louvres
      for(i=0;i<9;i++){
        var sl=box(lw-0.12,0.050,0.064,DOORMAT,cx,y0+0.70+i*0.072,0,p);
        sl.rotation.x=-0.42;
      }
      box(lw-0.11,0.075,0.092,DOORMAT,cx,y1-0.20,0,p);          // rail under the head
      box(0.036,0.125,0.125,MAT.brass,dir*0.088,y0+0.42,0,p);   // brass hinge plates
      box(0.036,0.125,0.125,MAT.brass,dir*0.088,y1-0.40,0,p);
      box(0.030,0.085,0.085,MAT.brass,dir*(lw-0.05),y0+0.86,0,p);
    }else{
      /* A shop door fills its frame. The opening is DOORH tall and DOORW wide
         and the leaf hangs behind it, so the leaf is cut to the whole opening
         and then some - short of that you get daylight over the head and down
         the shut edge of a door that is supposed to be closed. The batwings
         above are meant to leave the frame open; these are not. */
      var sl=DOORW/2, scx=dir*(sl/2-0.06), sh=DOORH+0.04, sy=sh/2-0.02;
      box(sl,sh,0.06,PLANKDOOR,scx,sy,0,p);
      box(sl,0.11,0.080,PLANKDOOR,scx,DOORH-0.10,0,p);            // head rail
      box(sl,0.11,0.080,PLANKDOOR,scx,0.14,0,p);                  // kick rail
      box(sl*0.62,0.66,0.04,MAT.pane,scx,1.70,-0.030,p);
      box(0.05,0.66,0.055,PLANKDOOR,scx,1.70,-0.035,p);
      box(sl*0.62,0.05,0.055,PLANKDOOR,scx,1.70,-0.035,p);
      box(0.055,0.055,0.11,MAT.brass,dir*(sl-0.16),1.06,-0.06,p);
    }
    p.traverse(function(o){ if(o.isMesh){ o.castShadow=false; hitables.push(o); } });
  }
  leaf(hL,1); leaf(hR,-1);
  var c=Math.cos(face), sn=Math.sin(face);
  doors.push({hL:hL,hR:hR,x:x+dz*sn,z:z+dz*c,nx:-sn,nz:-c,a:0,v:0,snd:0,
              sw:bat?1:0,ph:rr(0,TAU)});
  /* The doorway turns collision off outright, so it has to be the corridor a
     body actually fits down, not the width of the hole. The opening is DOORW
     across; anyone whose centre is inside DOORW/2 minus their own radius has
     all of themselves in the clear. Any wider - it used to be 1.16, wider than
     the half opening - and you can stand with half of you inside a jamb, exempt
     from everything, and get flung out the moment you step past the edge. */
  var pcx=x+(-d/2)*sn, pcz=z+(-d/2)*c, swp=Math.abs(sn)>0.5, pw2=DOORW/2-0.48;
  portals.push({x0:pcx-(swp?0.95:pw2),x1:pcx+(swp?0.95:pw2),
                z0:pcz-(swp?pw2:0.95),z1:pcz+(swp?pw2:0.95)});
}

/* --- what is actually inside each door --- */
function dressInterior(S,kind,w,d,h){
  var g=S.g;
  S.noShadow=true;                       // fittings skip the shadow pass, walls do not
  function it(lw,lh,ld,mat,lx,ly,lz,solid){ return S.part(lw,lh,ld,mat,lx,ly,lz,solid===true); }
  function cyl(r1,r2,hh,seg,mat,lx,ly,lz){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,hh,seg),mat);
    m.position.set(lx,ly,lz); g.add(m); hitables.push(m); return m;
  }
  var back=d/2-0.9, i;
  if(isSaloon(kind)){ dressSaloon(S,g,w,d,h,+kind.charAt(6));
  }else if(kind==='bank'){
    it(w-2.6,1.16,0.5,MAT.inside,-0.7,0.58,-0.6,true);               // teller counter
    it(w-2.6,0.09,0.72,MAT.wood1,-0.7,1.19,-0.6);
    for(i=0;i<7;i++) cyl(0.026,0.026,1.5,6,MAT.metal,-w/2+1.4+i*0.62,1.95,-0.6);
    it(1.7,2.0,1.2,MAT.metal,w/2-1.6,1.0,back,true);                 // the safe
    cyl(0.62,0.62,0.16,20,MAT.metal,w/2-1.6,1.05,back-0.68).rotation.x=Math.PI/2;
    cyl(0.08,0.08,0.5,8,MAT.rust,w/2-1.6,1.05,back-0.84).rotation.z=Math.PI/2;
    it(0.9,0.78,0.6,MAT.inside,-w/2+1.2,0.39,back-0.5);
  }else if(kind==='store'){
    for(i=0;i<3;i++){
      it(0.6,2.1,3.0,MAT.inside,-w/2+0.7,1.05,-1.2+i*3.2,true);
      it(0.75,0.08,2.9,MAT.wood1,-w/2+0.75,1.35,-1.2+i*3.2);
    }
    it(2.8,1.05,0.7,MAT.inside,w/2-2.2,0.53,-d*0.15,true);
    for(i=0;i<5;i++) cyl(0.34,0.30,0.86,10,PLANKS[2],w/2-1.2,0.48,back-i*1.1);
    for(i=0;i<4;i++){ var cs=rr(0.5,0.8); it(cs,cs,cs,PLANKS[4],rr(-1,1),cs/2+0.1,rr(-2,2)); }
  }else if(kind==='hotel'){
    it(2.6,1.12,0.62,MAT.inside,-w/2+2.0,0.56,-d*0.2,true);          // front desk
    it(2.8,0.09,0.8,MAT.wood1,-w/2+2.0,1.17,-d*0.2);
    it(1.0,1.4,0.18,MAT.inside,-w/2+0.7,1.8,-d*0.2);
    for(i=0;i<7;i++){                                                 // stairs to a floor you cannot reach
      it(2.0,0.22,0.42,MAT.wood1,w/2-1.6,0.16+i*0.30,back-i*0.44,true);
    }
    it(0.14,2.4,0.14,MAT.inside,w/2-2.6,1.2,back-2.6);
    it(1.3,0.06,2.0,MAT.cloth,0,0.13,0.6);                            // rug
  }else if(kind==='office'){
    it(1.9,0.94,0.9,MAT.inside,0,0.47,-d*0.1,true);
    it(2.1,0.08,1.05,MAT.wood1,0,0.98,-d*0.1);
    cyl(0.24,0.22,0.08,8,MAT.wood1,0,0.52,-d*0.1+1.0);
    it(0.5,1.9,2.2,MAT.inside,-w/2+0.8,0.95,back-1.0,true);
    cyl(0.10,0.10,0.30,8,MAT.metal,0.5,1.17,-d*0.1);                  // assay scales
    it(0.5,0.03,0.16,MAT.metal,0.5,1.33,-d*0.1);
  }else if(kind==='undertaker'){
    for(i=0;i<3;i++){                                                 // coffins on their edge
      var cf=cyl(0.42,0.30,1.95,6,MAT.inside,-w/2+1.2+i*1.25,1.02,back-0.4);
      cf.scale.z=0.42; cf.rotation.x=0.16;
    }
    it(2.2,0.92,0.85,MAT.inside,w/2-1.8,0.46,-d*0.15,true);
    it(2.4,0.07,1.0,MAT.wood1,w/2-1.8,0.96,-d*0.15);
    for(i=0;i<3;i++) it(0.2,0.05,1.3,MAT.wood1,w/2-2.6+i*0.3,1.02,-d*0.15);
  }else if(kind==='barber'){
    cyl(0.42,0.46,0.16,12,MAT.inside,-w*0.18,0.62,-d*0.1);           // the chair
    cyl(0.14,0.20,0.54,10,MAT.metal,-w*0.18,0.30,-d*0.1);
    it(0.7,0.72,0.16,MAT.cloth,-w*0.18,1.02,-d*0.1+0.34);
    it(0.62,0.10,0.4,MAT.wood1,-w*0.18,0.30,-d*0.1-0.46);
    it(0.3,1.5,2.4,MAT.inside,-w/2+0.7,0.75,back-1.4,true);
    var mir=new THREE.Mesh(new THREE.PlaneGeometry(1.0,1.5),
      new THREE.MeshLambertMaterial({color:0x8FA0A8,emissive:0x1a2226}));
    mir.position.set(w/2-0.25,1.9,-d*0.1); mir.rotation.y=-Math.PI/2; g.add(mir);
    it(1.6,0.9,0.5,MAT.inside,w/2-1.1,0.45,-d*0.1,true);
    for(i=0;i<5;i++) cyl(0.045,0.05,0.22,7,MAT.bottle,w/2-1.1,1.02,-d*0.1-0.9+i*0.45);
    cyl(0.26,0.26,0.16,12,MAT.bone,w/2-1.1,0.98,-d*0.1+0.9);          // shaving basin
  }else if(kind==='livery'){
    for(i=0;i<2;i++){
      it(0.24,1.5,3.6,MAT.inside,-w/2+2.6+i*2.9,0.75,back-1.9,true);
      it(2.6,0.16,0.16,MAT.wood1,-w/2+1.3+i*2.9,1.35,back-3.7);
    }
    for(i=0;i<6;i++){ var hb=it(0.9,0.6,0.7,MAT.sage,w/2-1.4-(i%2)*1.0,0.3+Math.floor(i/2)*0.62,-d*0.2+ (i%3)*0.85); hb.rotation.y=rr(-0.2,0.2); }
    it(2.2,0.5,0.8,MAT.inside,0,0.25,-d*0.32,true);                    // water trough
    it(2.0,0.16,0.6,MAT.glass,0,0.46,-d*0.32);
    for(i=0;i<4;i++){ var tk=it(0.1,0.5,0.28,MAT.inside,-w/2+0.4,1.9,-2.0+i*1.1); tk.rotation.z=0.2; }
  }else if(kind==='forge'){
    it(2.0,1.0,1.6,MAT.stone,-w/2+1.8,0.5,back-1.2,true);              // brick forge
    var coals=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8),
      new THREE.MeshLambertMaterial({color:0xE0641E,emissive:0xC4400C}));
    coals.position.set(-w/2+1.8,1.02,back-1.2); coals.scale.y=0.35; g.add(coals);
    var forgeLight=new THREE.PointLight(0xFF7A2A,0.8,8,2);
    forgeLight.position.set(-w/2+1.8,1.5,back-1.2); g.add(forgeLight);
    it(0.5,0.6,0.5,MAT.inside,-w/2+1.8,1.9,back-0.4);                  // hood
    cyl(0.26,0.20,0.9,10,MAT.inside,0.4,0.45,-d*0.1);                  // anvil block
    it(0.34,0.28,1.1,MAT.metal,0.4,1.04,-d*0.1,true);
    it(0.30,0.24,0.34,MAT.metal,0.4,1.04,-d*0.1-0.66);
    cyl(0.42,0.38,0.9,12,PLANKS[2],w/2-1.2,0.45,-d*0.1);               // quench barrel
    for(i=0;i<5;i++) it(0.06,0.62,0.06,MAT.metal,w/2-0.5,1.6,-2.2+i*0.5);
  }else if(kind==='telegraph'){
    it(w-3.0,1.10,0.55,MAT.inside,0,0.55,-d*0.05,true);
    it(w-2.8,0.09,0.75,MAT.wood1,0,1.13,-d*0.05);
    it(0.26,0.10,0.34,MAT.metal,-0.8,1.20,-d*0.05);                    // the key
    it(0.10,0.06,0.16,MAT.metal,-0.8,1.27,-d*0.05-0.12);
    it(0.5,0.4,0.4,MAT.inside,0.6,1.34,-d*0.05,false);
    for(i=0;i<3;i++) cyl(0.22,0.22,0.30,10,MAT.wood1,w/2-1.2,1.34+i*0.0,back-1.0-i*0.7);
    it(0.4,1.8,2.0,MAT.inside,-w/2+0.6,0.9,back-1.2,true);
    cyl(0.10,0.10,0.62,8,MAT.inside,0,0.31,-d*0.05-1.1);               // stool
    cyl(0.22,0.22,0.07,10,MAT.wood1,0,0.65,-d*0.05-1.1);
  }else if(kind==='millinery'){
    for(i=0;i<4;i++){
      var sx=-w/2+1.6+i*1.5;
      cyl(0.05,0.16,1.35,8,MAT.inside,sx,0.68,back-1.0);
      cyl(0.30,0.24,0.20,12,MAT.cloth,sx,1.44,back-1.0);
      cyl(0.44,0.44,0.03,14,MAT.cloth,sx,1.35,back-1.0);
    }
    it(2.6,1.02,0.7,MAT.inside,0,0.51,-d*0.12,true);
    it(2.8,0.08,0.9,MAT.wood1,0,1.05,-d*0.12);
    var mir2=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.6),
      new THREE.MeshLambertMaterial({color:0x8FA0A8,emissive:0x1a2226}));
    mir2.position.set(-w/2+0.24,1.7,-d*0.12); mir2.rotation.y=Math.PI/2; g.add(mir2);
    it(1.2,0.06,1.6,MAT.cloth,w/2-1.4,0.13,-d*0.12);
  }else if(kind==='doctor'){
    it(0.9,0.78,2.0,MAT.inside,-w*0.15,0.39,-d*0.08,true);             // examination table
    it(1.0,0.10,2.1,MAT.bone,-w*0.15,0.83,-d*0.08);
    it(0.5,2.0,1.6,MAT.inside,-w/2+0.7,1.0,back-1.0,true);             // cabinet
    for(i=0;i<8;i++) cyl(0.045,0.05,0.20,7,MAT.bottle,-w/2+0.7,0.7+Math.floor(i/4)*0.62,back-1.7+(i%4)*0.42);
    it(1.4,0.92,0.7,MAT.inside,w/2-1.3,0.46,-d*0.08,true);
    it(1.6,0.08,0.9,MAT.wood1,w/2-1.3,0.96,-d*0.08);
    cyl(0.20,0.18,0.06,10,MAT.metal,w/2-1.3,1.03,-d*0.08);
  }else if(kind==='land'){
    it(1.9,0.94,0.9,MAT.inside,0,0.47,-d*0.1,true);
    it(2.1,0.08,1.05,MAT.wood1,0,0.98,-d*0.1);
    cyl(0.24,0.22,0.08,8,MAT.wood1,0,0.52,-d*0.1+1.0);
    var mapp=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.6),
      new THREE.MeshLambertMaterial({color:0xC9B58C,emissive:0x241c12}));
    mapp.position.set(0,2.2,back+0.55); mapp.rotation.y=Math.PI; g.add(mapp);
    for(i=0;i<3;i++) it(2.0,1.5,0.5,MAT.inside,-w/2+1.3,0.75,-2.0+i*1.6,true);
  }
  S.noShadow=false;
}

/* every door on the street opens */
/* name, interior, width, facade style, plank colour */
var TOWN_S=[
  ['OCCIDENTAL SALOON','saloon0',13.5,'front',0],['DRY GOODS','store',11.5,'stepped',1],
  ['HOTEL DRURY','hotel',12,'two',4],['BARBER','barber',10,'gable',5],
  ['LIVERY & FEED','livery',12,'gable',2],['BULLHEAD SALOON','saloon2',12,'front',6],
  ['BLACKSMITH','forge',11,'gable',3]
];
var TOWN_N=[
  ['BANK OF CIMARRON','bank',12.5,'stone',0],['J. PRINE UNDERTAKER','undertaker',11,'stepped',2],
  ['ASSAY OFFICE','office',10.5,'front',1],['WESTERN UNION','telegraph',10,'gable',6],
  ['THE PALACE','saloon1',12,'two',3],['MILLINERY','millinery',10,'stepped',5],
  ['DOC MERRIWEATHER','doctor',10.5,'front',4]
];
var PERCH=null;
function saloonRoof(bx,bz,w,d,h){
  var rY=h+0.09, i;
  PERCH={x:bx-1.6,z:bz-d/2+1.25,y:rY,yaw:0};
  platforms.push({x0:bx-w/2-0.2,x1:bx+w/2+0.2,z0:bz-d/2-0.1,z1:bz+d/2+0.9,y:rY});

  var N=14, run=0.48, rise=rY/N;
  var sz=bz+d/2+1.55;                      // centre line of the flight
  var x0=bx-3.6, span=N*run;
  var len=Math.sqrt(span*span+rY*rY), ang=Math.atan2(rY,span);
  var midx=x0+span/2;

  for(var sd=-1;sd<=1;sd+=2){              // the two stringers carrying the treads
    var str=box(len+0.30,0.30,0.11,MAT.wood1,midx,rY/2-0.10,sz+sd*0.66);
    str.rotation.z=ang;
  }
  for(i=0;i<N;i++){                        // tread and riser for every step
    var sy=(i+1)*rise;
    box(run+0.07,0.075,1.30,MAT.wood1,x0+i*run+run/2,sy-0.037,sz);
    box(0.055,rise,1.28,MAT.wood1,x0+i*run,sy-rise/2,sz);
    platforms.push({x0:x0+i*run-0.06,x1:x0+i*run+run+0.06,z0:sz-0.65,z1:sz+0.65,y:sy});
  }
  for(sd=-1;sd<=1;sd+=2){                  // newel posts and a raked handrail
    for(i=0;i<=4;i++){
      var px=x0+i*(span/4), py=(px-x0)/span*rY;
      box(0.09,1.02,0.09,MAT.wood1,px,py+0.51,sz+sd*0.66);
    }
    var rail=box(len+0.30,0.085,0.085,MAT.wood1,midx,rY/2+0.94,sz+sd*0.66);
    rail.rotation.z=ang;
    var mid=box(len+0.30,0.06,0.06,MAT.wood1,midx,rY/2+0.50,sz+sd*0.66);
    mid.rotation.z=ang;
  }

  // landing: a proper deck bridging the top step onto the roof
  var lx=x0+span+0.75;
  box(1.9,0.16,3.10,MAT.wood1,lx,rY-0.08,sz-0.70);
  platforms.push({x0:lx-0.95,x1:lx+0.95,z0:sz-2.25,z1:sz+0.85,y:rY});
  for(i=0;i<4;i++) box(0.12,rY,0.12,MAT.wood1,lx+(i<2?-0.8:0.8),rY/2,sz+(i%2?0.72:-1.45));
  box(0.09,1.02,0.09,MAT.wood1,lx+0.88,rY+0.51,sz+0.72);
  box(0.09,1.02,0.09,MAT.wood1,lx+0.88,rY+0.51,sz-2.05);
  box(0.09,1.02,0.09,MAT.wood1,lx-0.88,rY+0.51,sz+0.72);
  box(0.16,0.09,2.95,MAT.wood1,lx+0.88,rY+0.98,sz-0.68);
  box(1.85,0.09,0.09,MAT.wood1,lx,rY+0.98,sz+0.76);
}
stage('raising the town',291,function buildTown(){
  var xs=-48,i,e;
  for(i=0;i<TOWN_S.length;i++){
    e=TOWN_S[i];
    var bd=rr(9.5,11), bh=(e[3]==='two')?7.6:rr(4.7,5.5), bx=xs+e[2]/2, bz=14+bd/2;
    if(i===0) bh=5.6;
    building(bx,bz,0,e[2],bd,bh,e[0],e[1],i===0,e[3],e[4]);
    if(i===0) saloonRoof(bx,bz,e[2],bd,bh);
    xs+=e[2]+rr(1.3,2.6);
  }
  xs=-46;
  for(i=0;i<TOWN_N.length;i++){
    e=TOWN_N[i];
    var nd=rr(9.5,11), nh=(e[3]==='two')?7.6:rr(4.7,5.5);
    building(xs+e[2]/2,-14-nd/2,Math.PI,e[2],nd,nh,e[0],e[1],false,e[3],e[4]);
    xs+=e[2]+rr(1.3,2.6);
  }
});

/* --- the church: nave, gabled roof, bell tower over the door, facing the street --- */
stage('the church',5,function church(){
  var CX=-70, CZ=0, FACE=-Math.PI/2;      // front faces east, down the street
  var W=11, D=16, H=6.4, RISE=3.6;
  var S=Structure(CX,CZ,FACE), g=S.g;
  var mat=PLANKS[3], inMat=mat.clone(); inMat.emissive=new THREE.Color(0x160f09);

  S.part(W,0.14,D,MAT.floor,0,0.05,0,false);
  S.part(WALLT,H,D,inMat,-W/2+WALLT/2,H/2,0);
  S.part(WALLT,H,D,inMat, W/2-WALLT/2,H/2,0);
  S.part(W,H,WALLT,inMat,0,H/2,D/2-WALLT/2);                       // chancel wall
  var pw=(W-2.2)/2;
  S.part(pw,H,WALLT,inMat,-(1.1+pw/2),H/2,-D/2+WALLT/2);           // front, doorway left open
  S.part(pw,H,WALLT,inMat, (1.1+pw/2),H/2,-D/2+WALLT/2);
  S.part(2.2,H-DOORH,WALLT,inMat,0,(H+DOORH)/2,-D/2+WALLT/2,false);   // header over the doors
  S.part(2.56,0.14,0.16,MAT.wood1,0,DOORH+0.08,-D/2+0.02,false);      // and its casing
  S.part(0.14,DOORH+0.16,0.16,MAT.wood1,-1.17,DOORH/2,-D/2+0.02,false);
  S.part(0.14,DOORH+0.16,0.16,MAT.wood1, 1.17,DOORH/2,-D/2+0.02,false);
  hangDoors(S,FACE,CX,CZ,D,'church');    // it had stood open since it was built

  // gable: two slabs meeting at a ridge, sized to the walls instead of a scaled pyramid
  var half=W/2, slope=Math.hypot(half,RISE), ang=Math.atan2(RISE,half);
  var rl=box(slope,0.22,D+1.1,MAT.wood1,-half/2,H+RISE/2,0,g); rl.rotation.z= ang;
  var rr2=box(slope,0.22,D+1.1,MAT.wood1, half/2,H+RISE/2,0,g); rr2.rotation.z=-ang;
  hitables.push(rl); hitables.push(rr2);
  var shp=new THREE.Shape();
  shp.moveTo(-half,0); shp.lineTo(half,0); shp.lineTo(0,RISE); shp.closePath();
  var gGeo=new THREE.ExtrudeGeometry(shp,{depth:0.22,bevelEnabled:false});
  var gb1=new THREE.Mesh(gGeo,inMat); gb1.position.set(0,H,D/2-0.22); gb1.castShadow=true; g.add(gb1);
  var gb2=new THREE.Mesh(gGeo,inMat); gb2.position.set(0,H,-D/2); gb2.castShadow=true; g.add(gb2);
  hitables.push(gb1); hitables.push(gb2);
  box(0.3,0.3,D+1.2,MAT.wood1,0,H+RISE,0,g);                       // ridge beam

  // bell tower, standing over the entrance
  var TW=4.4, TH=11.5;
  S.part(WALLT,TH,TW,mat,-TW/2+WALLT/2,TH/2,-D/2-TW/2);
  S.part(WALLT,TH,TW,mat, TW/2-WALLT/2,TH/2,-D/2-TW/2);
  var tpw=(TW-2.2)/2;
  S.part(tpw,TH,WALLT,mat,-(1.1+tpw/2),TH/2,-D/2-TW+WALLT/2);
  S.part(tpw,TH,WALLT,mat, (1.1+tpw/2),TH/2,-D/2-TW+WALLT/2);
  S.part(2.2,TH-3.0,WALLT,mat,0,(TH+3.0)/2,-D/2-TW+WALLT/2,false);
  S.part(TW,0.2,TW,mat,0,TH,-D/2-TW/2,false);
  for(var c2=0;c2<4;c2++){                                          // open belfry
    var ax=(c2<2?-1:1)*(TW/2-0.3), az=-D/2-TW/2+((c2%2)?-1:1)*(TW/2-0.3);
    box(0.26,3.0,0.26,MAT.wood1,ax,TH+1.5,az,g);
  }
  var belfry=box(TW+0.8,0.22,TW+0.8,MAT.wood1,0,TH+3.1,-D/2-TW/2,g);
  hitables.push(belfry);
  var bell=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.62,0.8,12),
    new THREE.MeshStandardMaterial({color:0x8a6a2e,metalness:0.85,roughness:0.4,envMap:ENV}));
  bell.position.set(0,TH+2.1,-D/2-TW/2); bell.castShadow=true; g.add(bell); hitables.push(bell);
  var spire=new THREE.Mesh(new THREE.ConeGeometry(TW*0.78,5.4,4),MAT.dark);
  spire.rotation.y=Math.PI/4; spire.position.set(0,TH+5.9,-D/2-TW/2); spire.castShadow=true; g.add(spire);
  box(0.16,1.9,0.16,MAT.dark,0,TH+9.4,-D/2-TW/2,g);
  box(0.9,0.16,0.16,MAT.dark,0,TH+9.9,-D/2-TW/2,g);

  // pews and altar
  for(var p=0;p<6;p++){
    var pz=-D/2+3.4+p*1.9;
    S.part(3.4,0.14,0.42,MAT.wood1,-2.2,0.62,pz,true);
    S.part(3.4,0.72,0.14,MAT.inside,-2.2,0.98,pz+0.2,false);
    S.part(3.4,0.14,0.42,MAT.wood1, 2.2,0.62,pz,true);
    S.part(3.4,0.72,0.14,MAT.inside, 2.2,0.98,pz+0.2,false);
  }
  S.part(2.2,1.0,0.8,MAT.inside,0,0.5,D/2-2.0,true);
  S.part(2.4,0.08,0.95,MAT.wood1,0,1.04,D/2-2.0,false);
  S.part(0.14,1.5,0.14,MAT.dark,0,1.8,D/2-2.0,false);
  S.part(0.7,0.14,0.14,MAT.dark,0,2.15,D/2-2.0,false);
  /* A harmonium off to the side of the altar. Something has to be making the
     noise you hear in here. */
  var ox=-3.4, oz=D/2-3.6;
  S.part(1.70,1.02,0.72,MAT.inside,ox,0.51,oz,true);                // the case
  S.part(1.78,0.08,0.80,MAT.wood1,ox,1.06,oz,false);                // its top
  S.part(1.30,0.09,0.26,MAT.bone,ox,0.86,oz-0.40,false);            // the manual
  S.part(1.24,0.05,0.13,MAT.dark,ox,0.91,oz-0.44,false);
  S.part(1.66,0.26,0.10,MAT.wood1,ox,0.36,oz-0.40,false);           // the knee panel
  for(var pi=0;pi<9;pi++){                                          // and the case pipes
    var ph=0.46+(4-Math.abs(4-pi))*0.15;                            // graded up to the middle
    var pp=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,ph,8),MAT.metal);
    pp.position.set(ox-0.62+pi*0.155,1.14+ph/2,oz+0.10); g.add(pp); hitables.push(pp);
    var cap=new THREE.Mesh(new THREE.ConeGeometry(0.058,0.11,8),MAT.metal);
    cap.position.set(ox-0.62+pi*0.155,1.14+ph+0.05,oz+0.10); g.add(cap);
  }
  S.part(1.60,0.10,0.16,MAT.wood1,ox,1.11,oz+0.10,false);           // the rack they stand in
  S.part(0.90,0.10,0.34,MAT.wood1,ox+0.05,0.52,oz-0.95,true);       // and a bench to sit at it
  S.part(0.09,0.46,0.09,MAT.wood1,ox-0.32,0.25,oz-0.95,false);
  S.part(0.09,0.46,0.09,MAT.wood1,ox+0.42,0.25,oz-0.95,false);
  person(g,ox+0.05,0.03,oz-0.95,0,{coat:0x33302A,shirt:0xCEC2A8,seated:1,hat:'bonnet'});
  person(g,0,0,D/2-3.1,Math.PI,{coat:0x22201E,shirt:0x26241F,robe:1,collar:1,hair:0x4A4038});
  person(g,-2.2,0.15,-D/2+5.3,Math.PI,{coat:0x3A342C,shirt:0xC6BAA0,seated:1,hat:'bonnet'});
  person(g,2.2,0.15,-D/2+7.2,Math.PI,{coat:0x2E2A24,shirt:0xBFB399,vest:0x3A3028,seated:1,hat:'slouch'});
  interiors.push({x0:CX-D/2+0.4,x1:CX+D/2-0.4,z0:CZ-W/2+0.4,z1:CZ+W/2-0.4,kind:'church'});
  var win=new THREE.Mesh(new THREE.PlaneGeometry(1.6,3.0),
    new THREE.MeshLambertMaterial({color:0x2f4a63,emissive:0x101a24,side:THREE.DoubleSide}));
  win.position.set(0,3.4,D/2-WALLT-0.02); g.add(win);
});

/* ============================================================
   8. water tower, windmill, props
   ============================================================ */
stage('the water tower',7,function tower(){
  var g=new THREE.Group(); g.position.set(28,terrainH(28,-34),-34); world.add(g);
  var tank=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.4,5.2,16),PLANKS[2]);
  tank.position.y=12.6; tank.castShadow=true; g.add(tank); hitables.push(tank);
  var cap=new THREE.Mesh(new THREE.ConeGeometry(3.8,1.8,16),MAT.rust);
  cap.position.y=16.1; cap.castShadow=true; g.add(cap);
  for(var i=0;i<4;i++){
    var a=i*Math.PI/2+Math.PI/4;
    var leg=box(0.3,10.2,0.3,MAT.wood1,Math.cos(a)*2.6,5.1,Math.sin(a)*2.6,g);
    leg.rotation.z=Math.cos(a)*0.045; leg.rotation.x=-Math.sin(a)*0.045;
    addBlocker(28+Math.cos(a)*2.6,-34+Math.sin(a)*2.6,0.6,0.6);
  }
  /* The legs are battered - 2.6 out at mid height, leaning in by 0.045 - so a
     girt has to be cut to the spread at its own height and laid along the side
     it joins, not dropped through the middle of the tower at whatever angle.
     Four sides, three levels, and an X in each bay to stop it racking. */
  function spread(y){ return 2.6+0.045*(5.1-y); }            // leg centres at height y
  function girt(y){
    var c=spread(y)/Math.SQRT2, L=2*c+0.3;
    box(L,0.16,0.16,MAT.wood1,0,y,c,g);   box(L,0.16,0.16,MAT.wood1,0,y,-c,g);
    box(0.16,0.16,L,MAT.wood1,c,y,0,g);   box(0.16,0.16,L,MAT.wood1,-c,y,0,g);
  }
  function brace(y0,y1){
    var c0=spread(y0)/Math.SQRT2, c1=spread(y1)/Math.SQRT2;
    var my=(y0+y1)/2, mc=(c0+c1)/2;
    var run=c0+c1, rise=y1-y0;
    var len=Math.sqrt(run*run+rise*rise), t=Math.atan2(rise,run);
    for(var sd=-1;sd<=1;sd+=2){
      box(len,0.11,0.11,MAT.wood1,0,my,sd*mc,g).rotation.z= t;   // the two sides square to z
      box(len,0.11,0.11,MAT.wood1,0,my,sd*mc,g).rotation.z=-t;
      box(0.11,0.11,len,MAT.wood1,sd*mc,my,0,g).rotation.x=-t;   // and the two square to x
      box(0.11,0.11,len,MAT.wood1,sd*mc,my,0,g).rotation.x= t;
    }
  }
  girt(1.5); girt(5.1); girt(8.7);
  brace(1.5,5.1); brace(5.1,8.7);
});

var windmill=null;
stage('the windmill',2,function mill(){
  var g=new THREE.Group(); g.position.set(-34,terrainH(-34,32),32); world.add(g);
  for(var i=0;i<4;i++){
    var a=i*Math.PI/2+Math.PI/4;
    var leg=box(0.22,9.4,0.22,MAT.wood1,Math.cos(a)*1.7,4.7,Math.sin(a)*1.7,g);
    leg.rotation.z=Math.cos(a)*0.06; leg.rotation.x=-Math.sin(a)*0.06;
  }
  var hub=new THREE.Group(); hub.position.set(0,9.9,0.4); g.add(hub);
  hub.add(new THREE.Mesh(new THREE.TorusGeometry(2.3,0.06,6,20),MAT.metal));
  for(var b=0;b<16;b++){
    var bl=new THREE.Mesh(new THREE.BoxGeometry(0.42,1.5,0.03),MAT.metal);
    var ang=b/16*TAU;
    bl.position.set(Math.cos(ang)*1.6,Math.sin(ang)*1.6,0);
    bl.rotation.z=ang+0.5; bl.castShadow=true; hub.add(bl);
  }
  box(0.06,1.5,2.6,MAT.rust,0,9.9,-2.4,g);
  addBlocker(-34,32,3.4,3.4); windmill=hub;
});

function barrel(x,z){
  var m=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.38,1.05,12),PLANKS[2]);
  m.position.set(x,terrainH(x,z)+0.52,z); m.castShadow=true; m.receiveShadow=true;
  world.add(m); hitables.push(m); addBlocker(x,z,0.9,0.9);
}
function crate(x,z){
  var s=rr(0.6,1.0);
  var m=box(s,s,s,PLANKS[4],x,terrainH(x,z)+s/2,z);
  m.rotation.y=rr(0,TAU); hitables.push(m);
}
function rail(x,z,len){
  var g=new THREE.Group(); g.position.set(x,terrainH(x,z),z); world.add(g);
  box(0.13,1.15,0.13,MAT.wood1,-len/2,0.58,0,g);
  box(0.13,1.15,0.13,MAT.wood1, len/2,0.58,0,g);
  box(len,0.11,0.11,MAT.wood1,0,1.05,0,g);
}
function pole(x,z){
  var y=terrainH(x,z);
  var p=box(0.24,8.4,0.24,MAT.wood1,x,y+4.2,z);
  box(1.9,0.14,0.14,MAT.wood1,x,y+7.7,z);
  hitables.push(p);
  return new THREE.Vector3(x,y+7.7,z);
}
var CACTI=[new THREE.MeshLambertMaterial({color:0x53704a}),
           new THREE.MeshLambertMaterial({color:0x46653F}),
           new THREE.MeshLambertMaterial({color:0x5F7A4E})];
function cactus(x,z,kind){
  var y=terrainH(x,z), g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=rr(0,TAU);
  world.add(g);
  var m=pick(CACTI), i, blockR=0.7;
  if(kind===undefined) kind=ri(0,4);
  if(kind===0||kind===1){                                   // saguaro
    var hgt=rr(2.2,4.2);
    var t=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,hgt,10),m);
    t.position.y=hgt/2; t.castShadow=true; g.add(t); hitables.push(t);
    var cap=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,6),m);
    cap.position.y=hgt; cap.scale.y=0.7; g.add(cap);
    for(i=0;i<ri(1,3);i++){
      var side=(i%2?1:-1), ay=rr(hgt*0.35,hgt*0.66), al=rr(0.55,1.0), ul=rr(0.7,1.5);
      var a=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.19,al,8),m);
      a.position.set(side*al*0.45,ay,0); a.rotation.z=-side*Math.PI/2.4; a.castShadow=true; g.add(a);
      var up=new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.175,ul,8),m);
      up.position.set(side*(al*0.82),ay+ul/2-0.06,0); up.castShadow=true; g.add(up);
      var uc=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),m);
      uc.position.set(side*(al*0.82),ay+ul-0.06,0); uc.scale.y=0.7; g.add(uc);
    }
  }else if(kind===2){                                       // prickly pear
    blockR=0.9;
    var pads=ri(4,7), px=0, py=0.24, pr=0;
    for(i=0;i<pads;i++){
      var pd=new THREE.Mesh(new THREE.SphereGeometry(rr(0.26,0.40),9,7),m);
      pd.position.set(px,py,rr(-0.12,0.12));
      pd.scale.set(1,1.25,0.30); pd.rotation.z=pr; pd.castShadow=true; g.add(pd);
      hitables.push(pd);
      pr=rr(-0.7,0.7); px+=Math.sin(pr)*0.34; py+=rr(0.26,0.40);
    }
  }else if(kind===3){                                       // barrel cactus, ribbed
    blockR=0.55;
    var br=rr(0.28,0.46), bh=rr(0.42,0.80);
    var bd=new THREE.Mesh(new THREE.CylinderGeometry(br*0.86,br*0.78,bh,11),m);
    bd.position.y=bh/2; bd.castShadow=true; g.add(bd); hitables.push(bd);
    var bc=new THREE.Mesh(new THREE.SphereGeometry(br*0.86,11,6),m);
    bc.position.y=bh; bc.scale.y=0.5; g.add(bc);
    for(i=0;i<9;i++){
      var an=i/9*TAU;
      var rib=new THREE.Mesh(new THREE.BoxGeometry(0.035,bh*0.94,0.05),m);
      rib.position.set(Math.cos(an)*br*0.84,bh/2,Math.sin(an)*br*0.84);
      rib.rotation.y=-an; g.add(rib);
    }
  }else{                                                    // ocotillo, or a yucca
    blockR=0.5;
    if(rnd()<0.5){
      for(i=0;i<ri(5,9);i++){
        var wl=rr(1.6,3.0), wa=i/7*TAU;
        var cane=new THREE.Mesh(new THREE.CylinderGeometry(0.030,0.055,wl,6),m);
        cane.position.set(Math.cos(wa)*wl*0.16,wl/2,Math.sin(wa)*wl*0.16);
        cane.rotation.z=-Math.cos(wa)*0.30; cane.rotation.x=Math.sin(wa)*0.30;
        cane.castShadow=true; g.add(cane);
      }
    }else{
      var st=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.16,rr(0.5,1.1),8),MAT.wood1);
      st.position.y=0.35; g.add(st);
      for(i=0;i<14;i++){
        var ya=i/14*TAU, yl=rr(0.5,1.0);
        var bl=new THREE.Mesh(new THREE.ConeGeometry(0.055,yl,4),m);
        bl.position.set(Math.cos(ya)*0.22,0.62+yl*0.36,Math.sin(ya)*0.22);
        bl.rotation.z=-Math.cos(ya)*0.85; bl.rotation.x=Math.sin(ya)*0.85;
        bl.castShadow=true; g.add(bl);
      }
    }
  }
  addBlocker(x,z,blockR,blockR,2.5);
}
function rock(x,z,s,mat,noBlock){
  var m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),mat||MAT.stone);
  m.position.set(x,terrainH(x,z)+s*0.42,z);
  m.rotation.set(rr(0,3),rr(0,3),rr(0,3));
  m.scale.set(1,rr(0.5,0.9),rr(0.8,1.2));
  m.castShadow=true; m.receiveShadow=true; world.add(m); hitables.push(m);
  if(s>0.9&&!noBlock) addBlocker(x,z,s*1.7,s*1.7);
}
function skull(x,z){
  var g=new THREE.Group(); g.position.set(x,terrainH(x,z),z); g.rotation.y=rr(0,TAU); world.add(g);
  var s=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),MAT.bone); s.position.y=0.2; s.scale.z=1.35; g.add(s);
  var h1=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.05,5,10,Math.PI),MAT.bone);
  h1.position.set(-0.2,0.3,0); h1.rotation.set(0,0,-0.5); g.add(h1);
  var h2=h1.clone(); h2.position.x=0.2; h2.rotation.z=0.5+Math.PI; g.add(h2);
}

/* The boardwalk strip these get scattered along is also where every door lets
   out, and a barrel dropped on a doorstep does not look like clutter, it looks
   like the building is shut: the crate that landed on the Hotel Drury step
   walled the place off completely. Nothing is placed in the corridor in front
   of a door any more. */
/* The scatter used to be laid down blind, which is how a landmark boulder ended
   up standing in the nave: the church is 70 out from the middle of the map and
   the outcrops are thrown between 58 and 78. A room has no blockers in it, so
   being clear of the walls is not the same as being outside, and both have to
   be checked. */
function clearOfTown(x,z,m){
  var i;
  for(i=0;i<interiors.length;i++){
    var r=interiors[i];
    if(x>r.x0-m&&x<r.x1+m&&z>r.z0-m&&z<r.z1+m) return false;
  }
  for(i=0;i<blockers.length;i++){
    var b=blockers[i];
    if(x>b.x0-m&&x<b.x1+m&&z>b.z0-m&&z<b.z1+m) return false;
  }
  return true;
}
function doorwayClear(x,z,half){
  for(var i=0;i<doors.length;i++){
    var dr=doors[i], dx=x-dr.x, dz=z-dr.z;
    var out=dx*dr.nx+dz*dr.nz;                  // how far out in front of it
    var lat=Math.abs(dx*(-dr.nz)+dz*dr.nx);     // and how far off the centre line
    if(out>-0.8&&out<5.2&&lat<half) return false;
  }
  return true;
}
function placeClear(half,x0,x1,z0,z1,fn){
  for(var g=0;g<60;g++){
    var px=rr(x0,x1), pz=(rnd()<0.5?1:-1)*rr(z0,z1);
    if(doorwayClear(px,pz,half)){ fn(px,pz); return; }
  }
}
stage('barrels, crates and cactus',80,function dressTheSet(){
  var i;
  for(i=0;i<7;i++) placeClear(1.8,-40,40,10.6,12.2,function(px,pz){ barrel(px,pz); });
  for(i=0;i<8;i++) placeClear(1.9,-42,42,10.6,12.4,function(px,pz){ crate(px,pz); });
  for(i=0;i<6;i++){
    var rl=rr(2.4,4);
    placeClear(1.8+rl/2,-40,40,9.6,10.3,function(px,pz){ rail(px,pz,rl); });
  }
  var pts=[];
  for(i=0;i<7;i++) pts.push(pole(-46+i*16,-17.8));
  var wireMat=new THREE.LineBasicMaterial({color:0x2a2018});
  for(i=0;i<pts.length-1;i++){
    var a=pts[i],b=pts[i+1],v=[];
    for(var s=0;s<=8;s++){ var t=s/8; v.push(new THREE.Vector3(lerp(a.x,b.x,t),lerp(a.y,b.y,t)-Math.sin(t*Math.PI)*0.7,lerp(a.z,b.z,t))); }
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v),wireMat));
  }
  var cn=0, cg=0;
  while(cn<86&&cg++<2000){
    var cx=rr(-84,84),cz=rr(-84,84);
    if(Math.hypot(cx,cz)>84) continue;
    if(Math.abs(cz)<28&&cx>-92&&cx<56) continue;      // not on the street, not in the church yard
    if(onRoute(cx,cz,7)) continue;                    // and not in the wagon's way
    if(!clearOfTown(cx,cz,2.2)) continue;             // nor up against the tower or the mill
    cactus(cx,cz); cn++;
  }
  for(i=0;i<5;i++){                                   // a few landmark outcrops, well clear of town
    var la=rr(0,TAU), lr=rr(58,78);
    var lox=Math.cos(la)*lr, loz=Math.sin(la)*lr;
    if(onRoute(lox,loz,9)) continue;
    if(!clearOfTown(lox,loz,4)) continue;             // and not through the church roof
    rock(lox,loz,rr(1.8,2.8),MAT.cliff);
  }
  for(i=0;i<4;i++){
    for(var sg2=0;sg2<40;sg2++){
      var sx2=rr(-70,70), sz2=rr(-70,70);
      if(!clearOfTown(sx2,sz2,1.6)) continue;
      skull(sx2,sz2); break;
    }
  }
  // boulders piled at the foot of the cliffs so the edge of the world reads as rock
  for(i=0;i<16;i++){                                 // scree, in a few clumps rather than a scatter
    var a2=rr(0,TAU), r2=rr(WORLD_R+2,WORLD_R+9);
    var cbx=Math.cos(a2)*r2, cbz=Math.sin(a2)*r2;
    rock(cbx,cbz,rr(2.4,4.6),MAT.cliff,true);
    if(rnd()<0.6) rock(cbx+rr(-3,3),cbz+rr(-3,3),rr(1.2,2.2),MAT.cliff,true);
  }
});

stage('scrub on the flats',4,function scrub(){
  var mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5,0),MAT.sage,260);
  var d=new THREE.Object3D();
  var placed=0, guard=0;
  while(placed<260&&guard++<4000){
    var a=rr(0,TAU), r=Math.sqrt(rnd())*(WORLD_R-4);
    var x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(Math.abs(z)<30&&x>-90&&x<52) continue;       // keep it out of town
    var i=placed++;
    d.position.set(x,terrainH(x,z)+0.15,z);
    d.rotation.set(rr(0,3),rr(0,3),rr(0,3));
    d.scale.set(rr(0.5,1.5),rr(0.3,0.7),rr(0.5,1.5));
    d.updateMatrix(); mesh.setMatrixAt(i,d.matrix);
  }
  mesh.count=placed;
  mesh.castShadow=true; world.add(mesh);
});

var dust=(function(){
  var n=1400,pos=new Float32Array(n*3);
  for(var i=0;i<n;i++){ pos[i*3]=rr(-60,60); pos[i*3+1]=rr(0,24); pos[i*3+2]=rr(-60,60); }
  var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var m=new THREE.PointsMaterial({color:0xE0BE92,size:0.10,transparent:true,opacity:0.5,depthWrite:false,sizeAttenuation:true});
  var p=new THREE.Points(g,m); p.frustumCulled=false; scene.add(p);
  return {pts:p,pos:pos,n:n};
})();

var weeds=[];
stage('weeds along the street',24,function scatterWeeds(){
  var twig=new THREE.MeshLambertMaterial({color:0x8E7647});
  var twig2=new THREE.MeshLambertMaterial({color:0x6E5A38});
  function tumbleweed(){
    var G=new THREE.Group(), R=rr(0.42,0.62), i;
    for(i=0;i<46;i++){                                  // a snarl of dry branches
      var len=R*rr(0.55,1.55), th=rr(0.012,0.026);
      var br=new THREE.Mesh(new THREE.BoxGeometry(th,th,len),i%4?twig:twig2);
      var a1=rr(0,TAU), a2=Math.acos(rr(-1,1)), rad=R*rr(0.05,0.55);
      br.position.set(Math.sin(a2)*Math.cos(a1)*rad,Math.sin(a2)*Math.sin(a1)*rad,Math.cos(a2)*rad);
      br.rotation.set(rr(0,TAU),rr(0,TAU),rr(0,TAU));
      G.add(br);
    }
    for(i=0;i<10;i++){                                  // a few long whips arcing round the outside
      var wl=R*rr(1.5,2.0);
      var wb=new THREE.Mesh(new THREE.BoxGeometry(0.014,0.014,wl),twig2);
      wb.position.set(rr(-R*0.2,R*0.2),rr(-R*0.2,R*0.2),rr(-R*0.2,R*0.2));
      wb.rotation.set(rr(0,TAU),rr(0,TAU),rr(0,TAU));
      G.add(wb);
    }
    G.traverse(function(o){ if(o.isMesh) o.castShadow=true; });
    return {g:G,r:R};
  }
  for(var i=0;i<8;i++){
    var tw=tumbleweed();
    tw.g.position.set(rr(-80,80),0,rr(-80,80));
    world.add(tw.g);
    weeds.push({m:tw.g,r:tw.r,vx:rr(2.5,6.5),vz:rr(-1.4,1.4),spin:rr(-1,1)});
  }
});
