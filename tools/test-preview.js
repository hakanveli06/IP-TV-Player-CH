'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const elements={};
function node(id){return elements[id]||(elements[id]={style:{},className:'',innerHTML:'',textContent:'',getBoundingClientRect:()=>({left:1347,top:189,width:506,height:285})});}
const timers=new Map();let timerId=0,opens=0,stops=0,engine='html5';
const sandbox={Api:{liveCandidates(){return [];},shortEpg(){return Promise.resolve([]);}},window:{addEventListener(){}},document:{body:{className:''},readyState:'loading',addEventListener(){},getElementById:node},
setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},setInterval(){},clearInterval(){},
Nav:{setOverlay(fn){this.overlay=fn;},clearOverlay(){this.overlay=null;},focus(id){this.focused=id;},zoneById(){return null;}},
Player:{playing:true,_failed:false,pick(){return engine;},setViewport(r){this.rect=r;},previewBodyClass(){return 'playing live-preview';},stop(){stops++;this.playing=false;},position(){return 0;},duration(){return 0;}},
LiveBuffer:{end(){}},LiveHistory:{add(){},previous(){return null;},list(){return[];}},CategoryVisibility:{visibleList(k,l){return l;}},
AccountData:{get(k,f){return f;},set(){}},Favs:{list(){return[];}},Settings:{get(){return true;}},
UI:{toast(){},spin(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(sandbox);
for(const f of ['util.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),sandbox);
const p=sandbox.Playback,a=sandbox.App;
a.live.chans={items:[{stream_id:1,name:'One'},{stream_id:2,name:'Two'}],index:0,
  setItems(items){this.items=items;this.index=0;},jumpTo(i){this.index=i;},setCurrent(id){this.current=id;}};
p.startLiveCandidate=()=>{opens++;sandbox.Player.playing=true;};
p.renderLiveOsd=()=>{};

engine='html5';
a.live.open(0);
let pending=p.channelOpenTimer;timers.get(pending)();timers.delete(pending);
assert.equal(opens,1);assert.equal(p.previewOn,true,'HTML5 first OK starts preview');
assert.equal(sandbox.Player.rect.width,506);
a.live.open(0);
assert.equal(opens,1,'Same HTML5 preview goes fullscreen without another stream');
assert.equal(p.previewOn,false);assert.equal(sandbox.Player.rect,null);
p.returnToPreview();assert.equal(p.previewOn,true);assert.equal(opens,1);

engine='avplay';
a.live.open(1);
pending=p.channelOpenTimer;timers.get(pending)();timers.delete(pending);
assert.equal(opens,2);assert.equal(p.previewOn,true,'AVPlay first OK starts preview');
assert.equal(p.previewAvailable,true,'AVPlay preview remains available from fullscreen');
assert.equal(sandbox.Player.rect.width,506);assert.equal(sandbox.Player.rect.height,285);
a.live.open(1);
assert.equal(opens,2,'Same AVPlay preview goes fullscreen without opening a second stream');
assert.equal(p.previewOn,false);assert.equal(sandbox.Player.rect,null);
p.returnToPreview();assert.equal(p.previewOn,true);assert.equal(opens,2,'Returning to AVPlay preview reuses the same stream');

/* Saglayici Sugar'i yanlis uzantiyla etiketlese veya capability bilgisi
   guvenilmez olsa bile hata ekranindaki OK yerel deneyi baslatmali. */
let localStarted=false;
sandbox.Servis={destekli(){return false;}};
p.mode='vod';p.vodPanel='error';p.vodMeta={url:'http://example.invalid/sugar.mkv',extension:'mkv'};
p.startLocalMp4Fallback=()=>{localStarted=true;};
p.keyVod({keyCode:sandbox.KEY.ENTER,preventDefault(){}});
assert.equal(localStarted,true,'VOD hata ekraninda OK yerel uyumluluk yontemini baslatmali');

const schedule=a.live.epgHtml([
  {title:'<One>',description:'SUMMARY_MUST_NOT_RENDER',start:'2026-09-05 12:00:00',end:'2026-09-05 13:00:00'},
  {title:'Next',description:'SUMMARY_MUST_NOT_RENDER',start:'2026-09-05 13:00:00',end:'2026-09-05 14:00:00'},
  {title:'THIRD_MUST_NOT_RENDER'}
]);
assert(schedule.includes('&lt;One&gt;'));assert(schedule.includes('Next'));
assert(!schedule.includes('SUMMARY_MUST_NOT_RENDER'));assert(!schedule.includes('THIRD_MUST_NOT_RENDER'));

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/app.css'),'utf8');
assert(!html.includes('av-preview-masks'),'Obsolete native preview masks must not ship');
assert(!html.includes('mp4box.all.min.js'));
assert(!html.includes('js/compat.js'), 'Eski AVPlay on izleme deneyi geri donmemeli');
assert(html.includes('js/servis.js'), 'Family VOD deneyi paket icindeki yerel servisi kullanmali');
assert(!html.includes('js/wasm-compat.js'), 'Basarisiz WASM deneyi pakete geri donmemeli');
assert(!css.includes('av-preview-masked'));
assert(css.includes('body.av-preview .live-preview-slot'));
assert(css.includes('body.av-preview .live-info-panel #lv-info'));
console.log('Preview: HTML5 and AVPlay two-stage, single-session fullscreen, compact EPG PASS');
