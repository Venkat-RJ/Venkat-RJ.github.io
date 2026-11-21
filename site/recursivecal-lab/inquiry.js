"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const state = {connected:false, report:null, renderer:null, profile:0, time:0, playing:false, frame:null};
  const labels = {low_sweep:"Move to 20 degrees", high_sweep:"Move to 60 degrees", mid_sweep:"Move to 40 degrees", hold:"Hold and observe", coast:"Release motor briefly", reference:"Check the encoder fixture"};
  const profiles = {full_open:"Full opening · 20°C", full_close:"Full closing · 20°C", partial_reverse:"Partial reversal · 20°C", cold_open:"Cold opening · −10°C"};
  const params = {mass_kg:["Hatch mass", "kg",1], motor_efficiency:["Drive effectiveness","×",3], gas_scale:["Gas assistance","×",3], friction_coulomb_Nm:["Hinge friction","N·m",2], sensor_bias_rad:["Encoder offset","rad",4]};
  const fmt = (x, n=2) => Number.isFinite(x) ? x.toFixed(n) : "n/a";
  const text = (id,value) => {$(id).textContent=value;};
  const node = (tag,content,cls) => {const element=document.createElement(tag);if(content!==undefined)element.textContent=content;if(cls)element.className=cls;return element;};
  function message(value, kind="") {text("message",value);$("message").className="message "+kind;}
  function canonical(item) {
    if(item===null)return ["null"];
    if(typeof item==="boolean")return ["bool",item];
    if(typeof item==="number") {
      if(!Number.isFinite(item))throw new Error("Report contains a nonfinite number.");
      const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,item===0?0:item,false);
      return ["number",Array.from(new Uint8Array(data.buffer),x=>x.toString(16).padStart(2,"0")).join("")];
    }
    if(typeof item==="string")return ["string",item];
    if(Array.isArray(item))return ["array",item.map(canonical)];
    if(typeof item==="object")return ["object",Object.keys(item).sort().map(key=>[key,canonical(item[key])])];
    throw new Error("Unsupported report value.");
  }
  async function sha(value) {
    if(!globalThis.crypto?.subtle)throw new Error("Integrity checking requires localhost or HTTPS.");
    const bytes=new TextEncoder().encode(JSON.stringify(canonical(value)));
    const hash=await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");
  }
  async function validate(report) {
    if(report?.schema_version!=="recursivecal.physical-inquiry/1" || report.model_id!=="recursivecal.physical-rig/1")throw new Error("This is not a supported physical inquiry report.");
    if(!Array.isArray(report.verification?.comparisons) || report.verification.comparisons.length!==4 || !Array.isArray(report.agent_history) || report.agent_history.length>6)throw new Error("Report structure is incomplete.");
    if(!["verified_in_simulation","verification_failed","abstained"].includes(report.outcome))throw new Error("Invalid report outcome.");
    const {report_sha256,...payload}=report;
    if(await sha(payload)!==report_sha256)throw new Error("Report integrity check failed. The contents differ from the saved digest.");
    if(await sha(report.agent_history)!==report.commitment?.history_sha256)throw new Error("The observations differ from the committed history.");
    for(const pair of report.verification.comparisons)for(const side of ["before","after"]) {
      const rows=pair[side]?.trace;
      if(!Array.isArray(rows)||!rows.length||rows.length>20000)throw new Error("Invalid verification trace.");
      let previous=-Infinity;
      for(const row of rows) {
        if(![row.time_s,row.true_angle_rad,row.target_angle_rad].every(Number.isFinite)||row.time_s<=previous)throw new Error("Trace times or signals are invalid.");
        previous=row.time_s;
      }
    }
    return report;
  }
  function stop() {state.playing=false;cancelAnimationFrame(state.frame);text("play","▶");$("play").setAttribute("aria-label","Play comparison");}
  function sample(rows,time) {
    if(time<=rows[0].time_s)return rows[0];
    if(time>=rows.at(-1).time_s)return rows.at(-1);
    let low=0,high=rows.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(rows[mid].time_s<=time)low=mid;else high=mid;}
    const a=rows[low],b=rows[high],mix=(time-a.time_s)/(b.time_s-a.time_s);
    return {true_angle_rad:a.true_angle_rad+(b.true_angle_rad-a.true_angle_rad)*mix};
  }
  function currentPair(){return state.report.verification.comparisons[state.profile];}
  function duration(){const pair=currentPair();return Math.max(pair.before.trace.at(-1).time_s,pair.after.trace.at(-1).time_s);}
  function setTime(time) {
    if(!state.report)return;
    const pair=currentPair(),end=duration();state.time=Math.max(0,Math.min(end,time));
    const before=sample(pair.before.trace,state.time),after=sample(pair.after.trace,state.time);
    state.renderer?.draw(before.true_angle_rad,after.true_angle_rad,true);
    text("beforeAngle",fmt(before.true_angle_rad*180/Math.PI,1)+"°");text("afterAngle",fmt(after.true_angle_rad*180/Math.PI,1)+"°");
    text("cursorTime",fmt(state.time)+" s");text("endTime",fmt(end)+" s");$("scrubber").value=Math.round(state.time/end*1000);
    const cursor=$("trajectoryCursor");if(cursor){const {left,right}=state.plot;const x=left+state.time/end*(right-left);cursor.setAttribute("x1",x);cursor.setAttribute("x2",x);}
  }
  function svgElement(tag,attributes,textValue) {
    const el=document.createElementNS("http://www.w3.org/2000/svg",tag);
    for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);
    if(textValue!==undefined)el.textContent=textValue;return el;
  }
  function drawPlot() {
    const pair=currentPair(),end=duration(),svg=$("trajectory"),narrow=window.innerWidth<760;svg.replaceChildren();
    const width=narrow?520:1000,left=narrow?45:53,right=width-22,bottom=narrow?200:188,font=narrow?13:10,ticks=narrow?3:6;
    state.plot={left,right};svg.setAttribute("viewBox",`0 0 ${width} ${bottom+32}`);
    const X=t=>left+t/end*(right-left),Y=q=>bottom-q/Math.PI*180/90*(bottom-25);
    for(let angle=0;angle<=90;angle+=30){const y=bottom-angle/90*(bottom-25);svg.append(svgElement("line",{x1:left,x2:right,y1:y,y2:y,stroke:"#e8edf0"}),svgElement("text",{x:left-10,y:y+4,fill:"#7e909a","font-size":font,"text-anchor":"end"},angle+"°"));}
    for(let i=0;i<=ticks;i++){const t=end*i/ticks;svg.append(svgElement("text",{x:X(t),y:bottom+23,fill:"#7e909a","font-size":font,"text-anchor":"middle"},fmt(t,1)+" s"));}
    for(const [rows,key,color,dash] of [[pair.after.trace,"target_angle_rad","#8c9ca4","5 4"],[pair.before.trace,"true_angle_rad","#bb7136",null],[pair.after.trace,"true_angle_rad","#087e77",null]]) {
      const d=rows.map((row,index)=>(index?"L":"M")+fmt(X(row.time_s),2)+","+fmt(Y(row[key]),2)).join(" ");
      const attrs={d,fill:"none",stroke:color,"stroke-width":1.8};if(dash)attrs["stroke-dasharray"]=dash;svg.append(svgElement("path",attrs));
    }
    svg.append(svgElement("line",{id:"trajectoryCursor",x1:left,x2:left,y1:22,y2:bottom,stroke:"#a8babf","stroke-width":1}));
  }
  function showJournal(report) {
    const journal=$("journal");journal.replaceChildren();
    if(!report.agent_history.length)journal.append(node("li","No diagnostic experiments. The nominal controller was sent directly to independent verification.","empty"));
    report.agent_history.forEach((record,index)=>{
      const li=node("li");li.dataset.step=index+1;li.append(node("strong",labels[record.action]||record.action));
      const belief=report.belief_history[index],decision=report.decisions.find(x=>x.step===index+1);
      const observation=record.final_observation;
      li.append(node("p",`Angle ${fmt(observation.angle_rad*180/Math.PI,1)}° · Rate ${fmt(observation.velocity_rad_s,3)} rad/s · Force ${fmt(observation.strut_force_N_each,1)} N`,"sensor-line"));
      li.append(node("p",`Cost ${fmt(record.cost,1)} · Belief entropy ${fmt(belief?.entropy_before_nats,3)} → ${fmt(belief?.entropy_after_nats,3)} nats`));
      if(decision)li.append(node("p",decision.reason));journal.append(li);
    });
    text("testCount",report.agent_history.length+" tests");
    text("commitment",(report.commitment.disposition==="candidate"?"Calibration committed. ":"Abstained. Nominal controller retained. ")+report.commitment.reason+".");
  }
  function tables(report) {
    const belief=$("beliefTable"),verification=$("verificationTable");belief.replaceChildren();verification.replaceChildren();
    for(const [key,[label,unit,places]] of Object.entries(params)) {
      const row=node("tr");row.append(node("td",label),node("td",fmt(report.final_belief.posterior_mean[key],places)+" "+unit),node("td",fmt(report.final_belief.posterior_std[key],places)));belief.append(row);
    }
    for(const pair of report.verification.comparisons) {
      const row=node("tr");row.append(node("td",profiles[pair.name]||pair.name),node("td",fmt(pair.before.metrics.tracking_rmse_deg)+"°"),node("td",fmt(pair.after.metrics.tracking_rmse_deg)+"°"),node("td",pair.after.accepted?"PASS":"FAIL",pair.after.accepted?"good":"bad"));verification.append(row);
    }
  }
  async function load(report,kind) {
    await validate(report);stop();state.report=report;state.profile=0;
    const v=report.verification,passed=v.comparisons.filter(pair=>pair.after.accepted).length;
    text("runKind",kind+" · seed "+report.configuration.seed);
    text("motionResult",passed+" / 4 passed");text("motionDetail",report.outcome.replaceAll("_"," "));
    text("errorResult",fmt(v.before_mean_rmse_deg)+" → "+fmt(v.after_mean_rmse_deg));
    text("costResult",report.agent_history.length+" tests / "+fmt(report.cost,1));text("budgetDetail",fmt(report.configuration.budget,1)+" test-cost units available");
    text("modelResult",report.final_belief.model_mismatch?"Mismatch":report.agent_history.length?"Consistent":"Unchecked");
    text("modelDetail",report.final_belief.model_mismatch?"No declared hypothesis explains the data":report.agent_history.length?"Consistency within the declared model bank":"Initial sensors only; no diagnostic test");
    $("profile").replaceChildren(...v.comparisons.map((pair,index)=>{const option=node("option",profiles[pair.name]||pair.name);option.value=index;return option;}));
    for(const id of ["profile","scrubber","play","exportStudy"])$(id).disabled=false;
    for(const [key,id] of [["case","case"],["policy","policy"],["seed","seed"],["budget","budget"],["max_tests","maxTests"]])if(report.configuration[key]!==undefined)$(id).value=report.configuration[key];
    showJournal(report);tables(report);drawPlot();setTime(0);
    const support=v.passive_hold.static;
    text("supportDetail",`At full opening, the modeled mechanism needs ${fmt(support.additional_holding_torque_required_Nm,1)} N·m of additional holding torque. Passive test: ${v.passive_hold.run.metrics.termination.replaceAll("_"," ")}. Power-loss test: ${v.power_loss.metrics.termination.replaceAll("_"," ")}.`);
    text("evidenceDetail",`Integrity checked · ${report.model_id} · Report SHA-256 ${report.report_sha256}. Full observations and verification traces are included in the export.`);
    text("provenance",JSON.stringify({configuration:report.configuration,commitment:report.commitment,final_belief:report.final_belief,provenance:report.provenance,limitations:report.limitations},null,2));
    const context=kind.startsWith("Recorded")?"Recorded evidence, not a new simulation. ":"";
    if(report.outcome==="verified_in_simulation")message(context+"The calibration passed all four independent motion checks. Hardware readiness still requires physical validation and adequate unpowered support.","success");
    else if(report.outcome==="verification_failed")message(context+"The agent committed a calibration, but independent verification rejected it. Inspect the failed profile before changing the design or controller.","warning");
    else message(context+"The investigator withheld a new calibration: "+report.commitment.reason+".","warning");
    document.body.dataset.report="loaded";
  }
  $("inquiryForm").addEventListener("submit",async event=>{
    event.preventDefault();if(!state.connected||!$("inquiryForm").checkValidity())return;
    stop();$("runStudy").disabled=true;$("loadRecorded").disabled=true;$("importStudy").disabled=true;
    text("runStudy","Running the physical rig…");message("Running bounded experiments, updating the belief, then verifying the committed calibration on new trajectories.");
    try {
      const response=await fetch("api/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({case:$("case").value,policy:$("policy").value,seed:Number($("seed").value),budget:Number($("budget").value),max_tests:Number($("maxTests").value)})});
      const report=await response.json();if(!response.ok)throw new Error(report.error||"Investigation failed.");await load(report,"Live simulation");
    } catch(error){message(error.message,"error");}finally{$("runStudy").disabled=!state.connected;$("loadRecorded").disabled=false;$("importStudy").disabled=false;text("runStudy","Run investigation ↗");}
  });
  $("loadRecorded").addEventListener("click",async()=>{try{
    if(!window.RecursiveCalInquiryReferenceGzip)throw new Error("No recorded investigation is bundled.");
    const bytes=Uint8Array.from(atob(window.RecursiveCalInquiryReferenceGzip),c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    await load(JSON.parse(await new Response(stream).text()),"Recorded evidence");
  }catch(error){message(error.message,"error");}});
  $("importStudy").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw new Error("Report exceeds the 8 MiB limit.");await load(JSON.parse(await file.text()),"Imported report");}catch(error){message("Import rejected. "+error.message+(state.report?" The previous report remains displayed.":""),"error");}finally{event.target.value="";}});
  $("profile").addEventListener("change",()=>{stop();state.profile=Number($("profile").value);drawPlot();setTime(0);});
  $("scrubber").addEventListener("input",()=>{stop();setTime(Number($("scrubber").value)/1000*duration());});
  $("cutaway").addEventListener("click",()=>{const active=$("cutaway").getAttribute("aria-pressed")!=="true";$("cutaway").setAttribute("aria-pressed",String(active));text("cutaway",active?"Show full assembly":"Show mechanism");state.renderer?.setFocus(active?"mechanism":"assembly");});
  $("play").addEventListener("click",()=>{if(state.playing){stop();return;}if(state.time>=duration())setTime(0);state.playing=true;text("play","Ⅱ");$("play").setAttribute("aria-label","Pause comparison");let previous=performance.now();const tick=now=>{if(!state.playing)return;setTime(state.time+Math.min(.1,(now-previous)/1000));previous=now;if(state.time>=duration())stop();else state.frame=requestAnimationFrame(tick);};state.frame=requestAnimationFrame(tick);});
  $("exportStudy").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state.report,null,2)+"\n"],{type:"application/json"}),url=URL.createObjectURL(blob),link=node("a");link.href=url;link.download=`recursivecal-${state.report.configuration.case}-seed${state.report.configuration.seed}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener("resize",()=>{if(state.report){drawPlot();setTime(state.time);}});
  async function init(){
    try{state.renderer=new window.PhysicalRenderer($("cad"));state.renderer.draw(0,0,true);}catch(error){$("cadFallback").hidden=false;}
    if(["127.0.0.1","localhost"].includes(location.hostname)) {
      try{const response=await fetch("api/inquiry/capabilities");const data=await response.json();state.connected=response.ok&&data.schema_version==="recursivecal.physical-inquiry/1";}catch(error){state.connected=false;}
    }
    text("connection",state.connected?"Live local simulator":"Recorded / import mode");$("runStudy").disabled=!state.connected;document.body.dataset.ready=state.connected?"connected":"offline";
    if(!state.connected){message("Recorded and imported investigations can be inspected here. Run recursivecal serve to compute new experiments with the local SI simulator.");$("loadRecorded").click();}
  }
  init();
})();
