/* v11: prize-wheel selector motion */
let v11ArrowDirection=0;
let v11ArrowTimer=0;
let v11ArrowSpinning=false;
let v11SpinToken=0;

function v11RandomInt(min,max){
  const range=max-min+1;
  if(globalThis.crypto?.getRandomValues){
    const a=new Uint32Array(1);crypto.getRandomValues(a);
    return min+(a[0]%range);
  }
  return min+Math.floor(Math.random()*range);
}
function v11Sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function v11EnsureTrackRoom(direction){
  if(!films.length)return;
  const low=films.length*2, high=films.length*(REPEATS-2);
  if((direction<0&&virtualIndex<=low)||(direction>0&&virtualIndex>=high)){
    virtualIndex=MIDDLE_REPEAT*films.length+filmIndex;
    updateTrack(0);
  }
}
function v11Step(direction,transition=55){
  if(!films.length)return;
  v11EnsureTrackRoom(direction);
  virtualIndex+=direction;
  filmIndex=mod(virtualIndex,films.length);
  localStorage.setItem(STORAGE.selected,String(filmIndex));
  updateTrack(transition);
  updateFilmDetails();
  tick();
}
async function v11Coast(direction,token,originIndex,extraEnergy=0){
  const steps=v11RandomInt(20,28)+Math.min(10,Math.floor(extraEnergy/180));
  for(let i=0;i<steps;i++){
    if(token!==v11SpinToken||locked||!films.length)return;
    const p=i/Math.max(1,steps-1);
    const delay=44+Math.pow(p,2.35)*235;
    v11Step(direction,Math.min(150,Math.max(28,delay*.72)));
    await v11Sleep(delay);
  }
  if(token!==v11SpinToken)return;
  if(settings.avoidSame!==false&&films.length>1&&filmIndex===originIndex){
    v11Step(direction,145);
    await v11Sleep(170);
  }
  spinning=false;
  v11ArrowSpinning=false;
  recenter();
}
async function v11RunArrowHold(direction,token,originIndex){
  spinning=true;
  v11ArrowSpinning=true;
  const started=performance.now();
  while(token===v11SpinToken&&v11ArrowDirection===direction&&!locked){
    const held=(performance.now()-started)/1000;
    const delay=Math.max(42,132-held*34);
    v11Step(direction,Math.min(90,Math.max(28,delay*.67)));
    await v11Sleep(delay);
  }
  if(token!==v11SpinToken)return;
  v11ArrowSpinning=false;
  await v11Coast(direction,token,originIndex,420);
}
function v11ArrowDown(direction){
  if(locked||spinning||!films.length||v11ArrowDirection)return;
  v11ArrowDirection=direction;
  const originIndex=filmIndex;
  clearTimeout(v11ArrowTimer);
  v11ArrowTimer=setTimeout(()=>{
    if(v11ArrowDirection!==direction||locked||spinning)return;
    const token=++v11SpinToken;
    v11RunArrowHold(direction,token,originIndex);
  },330);
}
function v11ArrowUp(direction){
  if(v11ArrowDirection!==direction)return;
  clearTimeout(v11ArrowTimer);
  v11ArrowTimer=0;
  const wasSpinning=v11ArrowSpinning;
  v11ArrowDirection=0;
  if(!wasSpinning&&!spinning)move(direction);
}
async function spin(direction=0,energy=0){
  if(locked||spinning||films.length<2)return;
  direction=direction===-1?-1:direction===1?1:(v11RandomInt(0,1)?1:-1);
  const originIndex=filmIndex;
  const token=++v11SpinToken;
  spinning=true;
  v11ArrowSpinning=false;
  virtualIndex=MIDDLE_REPEAT*films.length+filmIndex;
  updateTrack(0);
  const launchSteps=v11RandomInt(4,7)+Math.min(5,Math.floor(energy/260));
  for(let i=0;i<launchSteps;i++){
    if(token!==v11SpinToken)return;
    v11Step(direction,30);
    await v11Sleep(Math.max(38,68-i*5));
  }
  await v11Coast(direction,token,originIndex,energy);
}
function v11CancelSelectorMotion(){
  clearTimeout(v11ArrowTimer);
  v11ArrowTimer=0;
  v11ArrowDirection=0;
  v11ArrowSpinning=false;
  v11SpinToken++;
  spinning=false;
  if(films.length)recenter();
}
