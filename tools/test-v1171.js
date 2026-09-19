'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const calls = [], diagnostics = {}, timers = new Map(); let timerId = 0;
const avNode = { style:{}, offsetWidth:506 }, videoNode = { style:{} };
const settings = { avplayCompatibility:'auto' };
const sandbox = {
  navigator:{ userAgent:'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebKit/538.1' },
  setTimeout(fn, ms){ timers.set(++timerId,{fn,ms}); return timerId; },
  clearTimeout(id){ timers.delete(id); },
  webapis:{ avplay:{
    state:'PLAYING', getState(){ return this.state; },
    pause(){ calls.push({type:'pause'}); this.state='PAUSED'; },
    play(){ calls.push({type:'play'}); this.state='PLAYING'; },
    setDisplayRect(x,y,w,h){ calls.push({type:'rect',args:[x,y,w,h]}); },
    setDisplayMethod(mode){ calls.push({type:'method',mode}); },
    getVideoSize(){ return {width:1280,height:720}; }, getCurrentStreamInfo(){ return []; }
  } },
  Settings:{ get(k){ return settings[k]; }, set(k,v){ settings[k]=v; } },
  Diag:{ set(k,v){ diagnostics[k]=v; }, add(){} },
  document:{ body:{className:''}, getElementById(id){ return id === 'avplayer' ? avNode : videoNode; } },
  window:{}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/player.js'),'utf8'),sandbox);
const p=sandbox.Player;
p.engine='avplay'; p.playing=true; p.live=true; p.aspect='auto'; p._sessionId=7;

assert.strictEqual(p.resolvedAvCompatibility(),'legacySync','Tizen 5.0 must select old-TV sync in Auto');
p.setViewport({x:1347,y:189,width:506,height:285});
assert.deepStrictEqual([avNode.style.left,avNode.style.top,avNode.style.width,avNode.style.height],
  ['1347px','189px','506px','285px'],'Old-TV mode must synchronize the AVPlay DOM rectangle');
calls.length=0;
p.setViewport(null);
assert.deepStrictEqual([avNode.style.left,avNode.style.top,avNode.style.width,avNode.style.height],
  ['0px','0px','1920px','1080px'],'Old-TV fullscreen must expand the AVPlay DOM rectangle');
assert(calls.filter(x=>x.type==='rect' && x.args.join(',')==='0,0,1920,1080').length>=2,
  'Old-TV transition must finish with a repeated native fullscreen rectangle');
assert.strictEqual(diagnostics['AVPlay uyumluluk yontemi'],'Eski TV modu: Açık');

settings.avplayCompatibility='legacySync';
assert.strictEqual(p.resolvedAvCompatibility(),'legacySync','Manual old-TV override must win');

settings.avplayCompatibility='standard';
assert.strictEqual(p.resolvedAvCompatibility(),'standard','Manual standard override must win');
assert.strictEqual(p.avCompatibilityLabel('standard'),'Eski TV modu: Kapalı');
console.log('Legacy Samsung AVPlay viewport compatibility PASS');
