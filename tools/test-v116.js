'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const overlay = { className:'', innerHTML:'' };
const buttons = [{ className:'btn primary' }, { className:'btn focus' }];
const sandbox = {
  window:{ addEventListener(){} },
  document:{
    readyState:'loading', addEventListener(){},
    getElementById(id){ return id === 'overlay' ? overlay : { style:{}, className:'', innerHTML:'', textContent:'' }; },
    querySelectorAll(){ return buttons; }
  },
  localStorage:{ getItem(){return null;}, setItem(){}, removeItem(){}, length:0, key(){return null;} },
  setTimeout(){ return 1; }, clearTimeout(){}, setInterval(){ return 1; }, clearInterval(){},
  Nav:{ setOverlay(fn){this.handler=fn;}, clearOverlay(){this.handler=null;} },
  Player:{
    paused:false, aspect:'auto', aspectOrder:['auto','ratio16x9','ratio4x3','zoom4x3','cinema21x9','zoom21x9'],
    engine:'avplay', pick(){return 'avplay';}, normalizeAspect(v){return v;},
    aspectLabel(v){return v;}, isPreparing(){return false;}
  }
};
vm.createContext(sandbox);
for (const file of ['util.js','app.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'), sandbox);
const app = sandbox.App;

app.confirmExit();
assert.strictEqual(app._confirmIndex, 1, 'Destructive confirmation must focus Cancel by default');
sandbox.Nav.handler({ keyCode:sandbox.KEY.LEFT, preventDefault(){} });
assert.strictEqual(app._confirmIndex, 0);
assert(buttons[0].className.includes('focus'), 'Left must visibly focus confirmation');
sandbox.Nav.handler({ keyCode:sandbox.KEY.RIGHT, preventDefault(){} });
assert.strictEqual(app._confirmIndex, 1);
sandbox.Nav.handler({ keyCode:sandbox.KEY.ENTER, preventDefault(){} });
assert.strictEqual(app._exitPromptOn, false, 'OK on Cancel must close without exiting');

let confirmed = 0;
app.confirmDialog('Test','Message','Apply',function(){ confirmed++; });
sandbox.Nav.handler({ keyCode:sandbox.KEY.UP, preventDefault(){} });
assert.strictEqual(app._confirmIndex, 0, 'Up/down must also move between the two choices');
sandbox.Nav.handler({ keyCode:sandbox.KEY.ENTER, preventDefault(){} });
assert.strictEqual(confirmed, 1, 'OK must invoke only the focused confirmation action');

const controls = sandbox.Playback.vodControls();
assert.deepStrictEqual(Array.from(controls, x => x.id), ['tracks','subtitleSize','aspect','engine']);
const appSource = fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const stopAt = appSource.indexOf('Player.stop(true);', appSource.indexOf('switchVodEngine:'));
const waitAt = appSource.indexOf('setTimeout(function ()', stopAt);
const restartAt = appSource.indexOf('self.startVod(meta, target);', waitAt);
assert(stopAt > 0 && waitAt > stopAt && restartAt > waitAt, 'Engine switch must stop before its delayed restart');
assert(appSource.slice(waitAt, restartAt + 100).includes('}, 500);'), 'Engine switch must include the single-connection safety interval');

const playerSource = fs.readFileSync(path.join(root,'js/player.js'),'utf8');
assert(playerSource.includes("_scheduleNativeSubtitleReselect('buffer')"));
assert(playerSource.includes("_scheduleNativeSubtitleReselect('playtime')"));

const learned = { audio:[], text:['tr'] };
const playerSandbox = {
  window:{}, setTimeout(){return 1;}, clearTimeout(){},
  norm(v){return String(v || '').toLowerCase();},
  Settings:{get(){return 'auto';},set(){}}, UI:{spin(){},toast(){}},
  Diag:{set(){},add(){}}, TrackLabels:{get(){return learned;},set(){}},
  document:{body:{className:''},getElementById(){return {style:{},className:'',textTracks:null,audioTracks:null};}},
  webapis:{avplay:{
    getTotalTrackInfo(){return [
      {type:'AUDIO',index:4,extra_info:'{"TRACK_LANG":"tur","CHANNEL_COUNT":2,"four_cc":"aac"}'},
      {type:'TEXT',index:7,extra_info:'{}'}
    ];},
    getCurrentStreamInfo(){return [{type:'TEXT',index:7,extra_info:'{}'}];}
  }}
};
vm.createContext(playerSandbox);
vm.runInContext(playerSource, playerSandbox);
const trackPlayer = playerSandbox.Player;
trackPlayer.engine='avplay'; trackPlayer.cb={subtitleCacheKey:'ep:labels'}; trackPlayer.subtitleMuted=false;
const tracks=trackPlayer.refreshTracks();
assert.strictEqual(tracks.audio[0].label.indexOf('Türkçe') === 0, true, 'Case-insensitive AVPlay language fields must be read');
assert.strictEqual(tracks.audio[0].label.includes('Stereo'), true);
assert.strictEqual(tracks.text[0].label, 'Türkçe', 'A learned HTML5/TX3G language must complete missing AVPlay metadata');
console.log('v1.16 exit safety, compact VOD controls, engine switch and subtitle reselect PASS');
