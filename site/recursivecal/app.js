/* RecursiveCal: CAD-derived physical mechanism plus measured-in-simulation traces.
   Model-specific presets use known simulated faults, NOT AI diagnosis or RL. */
(function(){'use strict';
const P=window.RecursivePhysics, CAD=window.RecursiveCAD, $=id=>document.getElementById(id);
const names={nominal:'Reference plant. No injected degradation.',hinge_friction:'Coulomb + viscous hinge resistance increased by 2.5×.',motor_fade:'Power strut motor effectiveness reduced to 55%.',heavy_hatch:'Hatch mass increased from 25 kg to 33 kg.',gas_leak:'Gas strut assistance reduced to 47%.',sensor_bias:'Angular sensor reports a +4.3° offset.',combined:'Motor effectiveness 62%, hinge friction 2.5×, mass 29 kg.'};
const presets={
 nominal:{gain:1,damping_gain:1,gravity_comp:1,friction_ff:1,sensor_comp:0},
 hinge_friction:{gain:1.3,damping_gain:1,gravity_comp:1.12,friction_ff:1.7,sensor_comp:0},
 motor_fade:{gain:1.55,damping_gain:1.16,gravity_comp:1.2,friction_ff:1.5,sensor_comp:0},
 heavy_hatch:{gain:1.45,damping_gain:1.15,gravity_comp:1.25,friction_ff:1.6,sensor_comp:0},
 gas_leak:{gain:1.55,damping_gain:1.14,gravity_comp:1.25,friction_ff:1.5,sensor_comp:0},
 sensor_bias:{gain:1,damping_gain:1,gravity_comp:1,friction_ff:1,sensor_comp:.075},
 combined:{gain:1.55,damping_gain:1.16,gravity_comp:1.3,friction_ff:2,sensor_comp:0},
};
let scene;
try{scene=new window.PhysicalRenderer($('scene'));}catch(e){$('unsupported').hidden=false;$('unsupported').textContent='3D scene unavailable: '+e.message;console.error(e);return;}
let state={fault:'combined',controller:'factory',time:3.25,playing:false,compare:false,
  cal:{...P.factory},factoryRun:null,tunedRun:null,last:0,labels:false,debug:false};
window.__recursivecal={scene,physics:P,state};
const fmt=(n,nz=1)=>Number(n).toFixed(nz);
function interpolate(frames,time){if(time<=0)return frames[0];if(time>=frames.at(-1).t)return frames.at(-1);
 let lo=0,hi=frames.length-1;while(hi-lo>1){let mid=(lo+hi)>>1;if(frames[mid].t<time)lo=mid;else hi=mid;}
 let a=frames[lo],b=frames[hi],r=(time-a.t)/(b.t-a.t),out={};
 for(const k of ['t','q','q_target','w','length_m','stroke_m','lever_m','motor_force_N_each','gas_force_N_each','motor_current_A_each','motor_torque_Nm_total','gas_torque_Nm_total','gravity_torque_Nm','net_torque_Nm','error_deg'])out[k]=a[k]*(1-r)+b[k]*r;
 return out;
}
function activeRun(){return state.controller==='factory'?state.factoryRun:state.tunedRun;}
function refresh(){state.factoryRun=P.simulate(P.plants[state.fault],P.factory);state.tunedRun=P.simulate(P.plants[state.fault],state.cal);updateSummary();render();}
function updateSummary(){let m=state.factoryRun.metrics,n=state.tunedRun.metrics;
 $('resultSummary').innerHTML=`<strong>FACTORY:</strong> ${fmt(m.mae_deg,2)}° mean tracking error <span class="sep">·</span> <strong>MODIFIED:</strong> ${fmt(n.mae_deg,2)}° <span class="sep">·</span> <strong>MAX OPEN:</strong> 78°`;
}
function render(){if(!state.factoryRun||!state.tunedRun)return;
 const a=interpolate(state.factoryRun.frames,state.time),b=interpolate(state.tunedRun.frames,state.time),f=state.controller==='factory'?a:b;
 scene.draw(state.compare?a.q:f.q,b.q,state.compare);
 $('compareHalf').hidden=!state.compare;
 $('factoryAngle').textContent=fmt(a.q*180/Math.PI)+'°';
 $('tunedAngle').textContent=fmt(b.q*180/Math.PI)+'°';
 $('angleNow').innerHTML=`${fmt(f.q*180/Math.PI)}<span>deg</span>`;
 $('strokeNow').innerHTML=`${Math.round(f.stroke_m*1000)}<span>mm</span>`;
 $('currentNow').innerHTML=`${fmt(f.motor_current_A_each,2)}<span>A</span>`;
 $('errorNow').innerHTML=`${fmt(f.motor_torque_Nm_total,1)}<span>Nm</span>`;
 $('timeNow').textContent=fmt(state.time,2);$('scrubber').value=fmt(state.time,2);
 if(state.labels&&!state.compare){$('callouts').classList.add('visible');try{
   const hinge=scene.projectPoint([0,0,P.HINGE_Z]);let g=P.geometry(f.q),strut=scene.projectPoint([g.hatch_point_x_m*.5-.235,0,g.hatch_point_z_m*.5+.585]);
   $('callHinge').style.transform=`translate(${hinge.x-12}px,${hinge.y-42}px)`;
   $('callStrut').style.transform=`translate(${strut.x+12}px,${strut.y-18}px)`;
  }catch(e){$('callouts').classList.remove('visible');}}
 else $('callouts').classList.remove('visible');
 chart();
}
function chart(){const canvas=$('plot'),box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=box.width,h=box.height;
 const W=Math.max(1,Math.round(w*dpr)),H=Math.max(1,Math.round(h*dpr));if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const margin={left:30,right:w-10,top:7,bottom:h-20},x=t=>margin.left+t/P.T_MAX*(margin.right-margin.left),y=q=>margin.bottom-q/(P.MAX_Q*1.13)*(margin.bottom-margin.top);
 ctx.font='10px ui-monospace,monospace';ctx.textAlign='right';ctx.lineWidth=.65;
 for(const deg of [0,20,40,60,80]){let yy=y(deg*Math.PI/180);ctx.strokeStyle='#334757';ctx.beginPath();ctx.moveTo(margin.left,yy);ctx.lineTo(margin.right,yy);ctx.stroke();ctx.fillStyle='#8298a7';ctx.fillText(deg,margin.left-7,yy+3);}
 ctx.textAlign='center';ctx.fillStyle='#8298a7';for(const t of [0,2,4,6])ctx.fillText(t+'s',x(t),h-4);
 const draw=(frames,key,col,width,dash=false)=>{ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=width;ctx.setLineDash(dash?[4,4]:[]);frames.forEach((f,i)=>i?ctx.lineTo(x(f.t),y(f[key])):ctx.moveTo(x(f.t),y(f[key])));ctx.stroke();ctx.setLineDash([]);};
 draw(state.factoryRun.frames,'q_target','#70aff4',1.6,true);
 if(state.compare){draw(state.factoryRun.frames,'q','#e8ae55',2);draw(state.tunedRun.frames,'q','#43d1bd',2);}else draw(activeRun().frames,'q','#43d1bd',2.3);
 ctx.strokeStyle='#c4d7e3';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x(state.time),margin.top);ctx.lineTo(x(state.time),margin.bottom);ctx.stroke();
 const cur=interpolate(activeRun().frames,state.time);ctx.beginPath();ctx.arc(x(state.time),y(cur.q),3.1,0,Math.PI*2);ctx.fillStyle='#48d2bd';ctx.fill();ctx.setTransform(1,0,0,1,0,0);
}
function updatePlay(){let playing=state.playing;
 $('playLabel').textContent=playing?'PAUSE TEST':'RUN HINGE TEST';$('playSymbol').textContent=playing?'Ⅱ':'▶';$('overlayPlay').textContent=playing?'Ⅱ':'▶';
 $('testState').textContent=playing?'RUNNING':state.time>=P.T_MAX?'COMPLETE':state.time>0?'PAUSED':'READY';
}
function play(){if(state.time>=P.T_MAX)state.time=0;state.playing=!state.playing;state.last=performance.now();updatePlay();render();}
function reset(){state.playing=false;state.time=0;updatePlay();render();}
function tick(now){if(state.playing){const dt=Math.min(.065,Math.max(0,(now-state.last)/1000));state.time=Math.min(P.T_MAX,state.time+dt);
 if(state.time>=P.T_MAX){state.playing=false;updatePlay();} render();}state.last=now;requestAnimationFrame(tick);}
function setTuned(cal){state.cal={...P.factory,...cal};$('gainInput').value=state.cal.gain;$('frictionInput').value=state.cal.friction_ff;$('gravityInput').value=state.cal.gravity_comp;
 $('gainValue').textContent=fmt(state.cal.gain,2)+'×';$('frictionValue').textContent=fmt(state.cal.friction_ff,2)+'×';$('gravityValue').textContent=fmt(state.cal.gravity_comp,2)+'×';refresh();}
function selectController(which){state.controller=which;document.querySelectorAll('[data-controller]').forEach(el=>el.classList.toggle('active',el.dataset.controller===which));render();}
$('faultSelect').addEventListener('change',e=>{state.fault=e.target.value;state.cal={...P.factory};setTuned(state.cal);$('faultInfo').textContent=names[state.fault];reset();});
$('runBtn').addEventListener('click',play);$('resetBtn').addEventListener('click',reset);$('overlayPlay').addEventListener('click',play);
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){e.preventDefault();play();}});
document.querySelectorAll('[data-controller]').forEach(el=>el.addEventListener('click',()=>selectController(el.dataset.controller)));
for(const [id,key] of [['gainInput','gain'],['frictionInput','friction_ff'],['gravityInput','gravity_comp']]){
 $(id).addEventListener('input',e=>{state.cal[key]=Number(e.target.value);$(key==='gain'?'gainValue':key==='friction_ff'?'frictionValue':'gravityValue').textContent=fmt(state.cal[key],2)+'×';selectController('tuned');refresh();});
}
$('suggestBtn').addEventListener('click',()=>{setTuned(presets[state.fault]);selectController('tuned');reset();$('resultSummary').innerHTML='<strong>Modified preset loaded.</strong> Selected using known synthetic fault parameters. This is not learned RL or an autonomous diagnosis.';});
$('compareBtn').addEventListener('click',()=>{state.compare=!state.compare;$('compareBtn').classList.toggle('active',state.compare);$('compareBtn').innerHTML=state.compare?'<span class="square-icon"></span> Exit comparison':'<span class="square-icon"></span> Compare factory / modified';$('baselineLegend').hidden=!state.compare;render();});
$('viewVehicle').addEventListener('click',()=>{scene.setFocus('vehicle');$('viewVehicle').classList.add('active');$('viewMech').classList.remove('active');render();});
$('viewMech').addEventListener('click',()=>{scene.setFocus('mechanism');$('viewMech').classList.add('active');$('viewVehicle').classList.remove('active');render();});
$('resetCamera').addEventListener('click',()=>{scene.setFocus(scene.mechanics?'mechanism':'vehicle');render();});
$('fullscreenBtn').addEventListener('click',()=>{document.body.classList.toggle('immersive');requestAnimationFrame(()=>{scene.resize();render();});});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&document.body.classList.contains('immersive')){$('fullscreenBtn').click();}});
$('toggleLabels').addEventListener('click',()=>{state.labels=!state.labels;$('toggleLabels').classList.toggle('active',state.labels);render();});
$('scrubber').max=String(P.T_MAX);$('scrubber').addEventListener('input',e=>{state.playing=false;state.time=Number(e.target.value);updatePlay();render();});
window.addEventListener('resize',()=>{scene.resize();render();});
setTuned(P.factory);$('faultInfo').textContent=names[state.fault];selectController('factory');updatePlay();tick(performance.now());
})();
