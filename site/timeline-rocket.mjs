// Scroll-driven rocket launch for the Experience timeline.
// Decorative only: all original company descriptions remain semantic HTML.
(() => {
  'use strict';
  const history = document.getElementById('career-history');
  if (!history || history.querySelector('.rocket-lane')) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lane = document.createElement('div');
  lane.className = 'rocket-lane';
  lane.setAttribute('aria-hidden', 'true');
  lane.innerHTML = `
    <div class="rocket-stage">
      <svg class="rocket-scene" viewBox="0 0 150 460" preserveAspectRatio="xMidYMid meet" role="presentation" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="launch-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#d4e5f3"/>
            <stop offset=".48" stop-color="#9cbbd3"/>
            <stop offset=".83" stop-color="#566c83"/>
            <stop offset="1" stop-color="#263646"/>
          </linearGradient>
          <linearGradient id="rocket-metal" x1="0" x2="1">
            <stop offset="0" stop-color="#5d6870"/>
            <stop offset=".16" stop-color="#b6c0c8"/>
            <stop offset=".40" stop-color="#fcffff"/>
            <stop offset=".67" stop-color="#e6edf1"/>
            <stop offset=".88" stop-color="#8997a4"/>
            <stop offset="1" stop-color="#394a58"/>
          </linearGradient>
          <linearGradient id="booster-metal" x1="0" x2="1">
            <stop offset="0" stop-color="#58616b"/>
            <stop offset=".27" stop-color="#f3f7fa"/>
            <stop offset=".67" stop-color="#bec9d0"/>
            <stop offset="1" stop-color="#697983"/>
          </linearGradient>
          <linearGradient id="rocket-carbon" x1="0" x2="1">
            <stop offset="0" stop-color="#0f1720"/>
            <stop offset=".55" stop-color="#37424c"/>
            <stop offset="1" stop-color="#131b25"/>
          </linearGradient>
          <linearGradient id="launch-flame" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffef0"/>
            <stop offset=".16" stop-color="#fffce5"/>
            <stop offset=".36" stop-color="#fff0a5"/>
            <stop offset=".67" stop-color="#ff9d2d"/>
            <stop offset="1" stop-color="#c34113" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="exhaust-core" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity=".96"/>
            <stop offset=".23" stop-color="#fff6bc" stop-opacity=".9"/>
            <stop offset=".65" stop-color="#ffb35d" stop-opacity=".40"/>
            <stop offset="1" stop-color="#b3a7a0" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="ground-glow">
            <stop offset="0" stop-color="#fffde9" stop-opacity=".99"/>
            <stop offset=".24" stop-color="#ffba45" stop-opacity=".87"/>
            <stop offset=".57" stop-color="#f06927" stop-opacity=".35"/>
            <stop offset="1" stop-color="#f06927" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="launch-smoke">
            <stop offset="0" stop-color="#fff6eb" stop-opacity=".96"/>
            <stop offset=".47" stop-color="#d4dae0" stop-opacity=".78"/>
            <stop offset="1" stop-color="#8194a4" stop-opacity="0"/>
          </radialGradient>
          <filter id="launch-bloom" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="rocket-shadow" x="-45%" y="-35%" width="190%" height="180%"><feDropShadow dx="1.8" dy="3" stdDeviation="2.5" flood-color="#0f2737" flood-opacity=".48"/></filter>
          <clipPath id="launch-clip"><rect x="0" y="0" width="150" height="460" rx="10"/></clipPath>
        </defs>
        <g clip-path="url(#launch-clip)">
          <rect width="150" height="460" rx="10" fill="url(#launch-sky)"/>
          <g class="rocket-sky-grain" opacity=".22" fill="#f8fbff">
            <circle cx="21" cy="43" r="1"/><circle cx="110" cy="62" r=".65"/><circle cx="46" cy="105" r=".6"/>
            <circle cx="125" cy="157" r="1"/><circle cx="14" cy="189" r=".7"/><circle cx="112" cy="243" r=".8"/>
            <circle cx="30" cy="292" r=".7"/><circle cx="120" cy="347" r=".9"/><circle cx="45" cy="213" r=".6"/>
          </g>
          <g class="rocket-distance" opacity=".20" fill="#edf4f8">
            <path d="M0 323Q25 307 54 323T111 318T150 319v19H0Z"/>
            <path d="M0 360Q35 346 65 361T125 355T150 362v24H0Z" opacity=".75"/>
          </g>
          <g id="rocket-exhaust-lane" opacity="0">
            <path id="rocket-exhaust-glow" d="M77 358L61 418H97Z" fill="url(#ground-glow)" filter="url(#launch-bloom)"/>
            <path id="rocket-exhaust-ribbon" d="M78 358Q63 398 59 442L100 442Q92 396 88 358Z" fill="url(#exhaust-core)" opacity=".76"/>
          </g>
          <g class="launch-tower" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 423V176L48 166V423" fill="none" stroke="#14232e" stroke-width="6" opacity=".65"/>
            <path d="M18 423V176L48 166V423" fill="none" stroke="#8295a0" stroke-width="2.3"/>
            <path d="M22 421L46 391L22 362L46 334L22 307L46 278L22 249L46 221L22 193L44 169" fill="none" stroke="#6b7e89" stroke-width="1.7"/>
            <path d="M46 421L22 391L46 362L22 334L46 307L22 278L46 249L22 221L46 193" fill="none" stroke="#2e4453" stroke-width="1.7"/>
            <path d="M12 203H64V211H12zM14 277H55v7H14zM12 352H58v8H12z" fill="#455968" stroke="#9fb4bd" stroke-width="1"/>
            <path d="M45 232H68M45 302H68M45 369H70" stroke="#2f4352" stroke-width="5"/>
            <path d="M46 230H70M46 300H70M46 367H71" stroke="#9db1bd" stroke-width="1.4"/>
            <rect x="22" y="167" width="25" height="5" rx="1" fill="#2d4656"/>
            <circle cx="36" cy="164" r="2" fill="#edbd62"/>
            <path d="M33 162V150" stroke="#8fa6b5" stroke-width="1.6"/>
          </g>
          <g id="launch-pad" stroke-linejoin="round">
            <path d="M8 437H142V446H8z" fill="#273747" stroke="#94a9b7" stroke-width="1.3"/>
            <path d="M18 446L9 461M131 446L142 461M31 446v14M119 446v14" stroke="#2a3a48" stroke-width="6"/>
            <path d="M27 433H121L127 438H21Z" fill="#7a8b96"/>
            <rect x="51" y="421" width="53" height="12" rx="2" fill="#2f4554" stroke="#a7b5bb" stroke-width="1"/>
            <rect x="61" y="415" width="35" height="10" rx="1" fill="#455561"/>
            <path d="M0 459H150" stroke="#182834" stroke-width="9"/>
            <path d="M0 454H150" stroke="#667d8d" stroke-width="3"/>
          </g>
          <ellipse id="ignition-bloom" cx="83" cy="427" rx="83" ry="52" fill="url(#ground-glow)" opacity="0"/>
          <ellipse id="ignition-bloom-soft" cx="83" cy="429" rx="58" ry="34" fill="url(#ground-glow)" filter="url(#launch-bloom)" opacity="0"/>
          <ellipse id="ignition-shockwave" cx="82" cy="432" rx="22" ry="9" stroke="#ffe0a3" stroke-width="2" fill="none" opacity="0"/>
          <g id="smoke-particles"></g>
          <g id="rocket-vehicle" filter="url(#rocket-shadow)">
            <g id="rocket-engine-flame" opacity="0">
              <path d="M78 369Q68 396 68 417Q82 444 96 417Q101 398 90 369Z" fill="url(#ground-glow)" filter="url(#launch-bloom)" opacity=".87"/>
              <path id="rocket-flame-shell" d="M75 366Q66 391 77 421Q83 435 88 421Q102 393 92 366Z" fill="url(#launch-flame)"/>
              <path d="M79 365Q76 383 80 411Q83 422 86 411Q91 383 87 365Z" fill="#fffde6" opacity=".96"/>
            </g>
            <g class="rocket-booster-left">
              <path d="M55 303Q55 291 60 285Q66 289 66 302V358L70 368L66 378H54L50 368L55 358Z" fill="url(#booster-metal)" stroke="#344b5b" stroke-width="1.5"/>
              <path d="M59 288V364M55 338H66" stroke="#f9fdff" stroke-opacity=".65" stroke-width="1"/>
              <path d="M54 372H66L63 382H57Z" fill="#26333b"/>
            </g>
            <g class="rocket-booster-right">
              <path d="M100 303Q100 291 106 285Q112 289 112 303V359L116 368L111 379H100L96 369L100 358Z" fill="url(#booster-metal)" stroke="#344b5b" stroke-width="1.5"/>
              <path d="M105 288V364M100 339H112" stroke="#fff" stroke-opacity=".65" stroke-width="1"/>
              <path d="M99 373H112L108 383H103Z" fill="#25353e"/>
            </g>
            <g class="rocket-main-stage">
              <path d="M66 244Q67 212 82 184Q98 212 99 244V362L94 371H71L66 362Z" fill="url(#rocket-metal)" stroke="#445969" stroke-width="1.5"/>
              <path d="M79 190Q82 185 84 191L91 224L91 355" stroke="#fff" stroke-width="2.3" opacity=".66"/>
              <rect x="67" y="248" width="31" height="23" rx="1" fill="url(#rocket-carbon)"/>
              <path d="M67 245H98M67 274H98M68 304H97M68 330H97M69 348H96" stroke="#4d616d" stroke-opacity=".55" stroke-width="1"/>
              <path d="M73 306V350M94 282v66" stroke="#fff" stroke-opacity=".30" stroke-width="1"/>
              <rect x="70" y="300" width="25" height="5" fill="#344652" opacity=".46"/>
              <path d="M71 362H94L91 372H75Z" fill="#263847"/>
              <path d="M75 371H91L88 378H79Z" fill="#242a2e" stroke="#607b89" stroke-width=".8"/>
              <path d="M82 201V222" stroke="#5f778a" stroke-width="1" opacity=".50"/>
              <path d="M77 224H87M76 231H88M75 281H92" stroke="#718595" stroke-width="1" opacity=".56"/>
              <path d="M75 295H78M85 295H90M75 316H89" stroke="#dce7ed" stroke-width=".9" opacity=".55"/>
              <path d="M79 224l3-2 3 2" fill="none" stroke="#bf7742" stroke-width="1.5"/>
              <path d="M84 290h6" stroke="#b45e40" stroke-width="1.2"/>
            </g>
          </g>
          <g id="spark-particles"></g>
          <g id="ground-smoke"></g>
        </g>
        <rect x=".6" y=".6" width="148.8" height="458.8" rx="9.4" fill="none" stroke="#68859c" stroke-opacity=".50" stroke-width="1.2"/>
      </svg>
      <span class="rocket-altitude" aria-hidden="true">PRELAUNCH</span>
    </div>`;
  history.prepend(lane);
  const q = selector => lane.querySelector(selector);
  const vehicle = q('#rocket-vehicle');
  const flame = q('#rocket-engine-flame');
  const exhaustLane = q('#rocket-exhaust-lane');
  const exhaustRibbon = q('#rocket-exhaust-ribbon');
  const exhaustGlow = q('#rocket-exhaust-glow');
  const groundGlow = q('#ignition-bloom');
  const groundGlowSoft = q('#ignition-bloom-soft');
  const shockwave = q('#ignition-shockwave');
  const status = q('.rocket-altitude');
  const smokeGroup = q('#smoke-particles');
  const sparkGroup = q('#spark-particles');
  const groundSmokeGroup = q('#ground-smoke');
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
  const smooth = t => t*t*(3-2*t);
  const node = (tag, parent, attrs={}) => {
    const e = document.createElementNS(NS, tag);
    for (const [name,value] of Object.entries(attrs)) e.setAttribute(name, value);
    parent.appendChild(e);
    return e;
  };
  // Particles are deterministic and recycle. No permanent DOM allocations while scrolling.
  const smoke = Array.from({length:30}, (_, i) => ({
    element:node('ellipse',smokeGroup,{fill:'url(#launch-smoke)',opacity:'0'}),
    i,
    offset:((i*19)%29)/29,
    drift:Math.sin(i*7.31)*1.2,
    side:i%2?1:-1
  }));
  const groundSmoke = Array.from({length:30}, (_, i) => ({
    element:node('ellipse',groundSmokeGroup,{fill:'url(#launch-smoke)',opacity:'0'}),
    i,
    offset:((i*13)%23)/23,
    side:i%2?1:-1
  }));
  const sparks = Array.from({length:36}, (_, i) => ({
    element:node('line',sparkGroup,{stroke:i%4===0?'#fffde4':i%2===0?'#ffd17a':'#ff6e19','stroke-linecap':'round','stroke-width':i%5===0?'2.4':'1.5',opacity:'0'}),
    i,
    offset:((i*17)%31)/31,
    side:Math.sin(i*9.137)
  }));
  let target=0, progress=0, frameId=0, lastFrame=0, lastRender=0;
  let visible=true;
  const refreshVisibility=() => {
    const r=history.getBoundingClientRect();
    visible=r.bottom>0 && r.top<innerHeight;
  };
  const updateTarget=() => {
    const rect=history.getBoundingClientRect();
    const total=history.offsetHeight + innerHeight*.35;
    target=clamp((innerHeight*.76-rect.top)/Math.max(1,total));
    refreshVisibility();
    if (!visible || reduceMotion.matches) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId=0;
      if (reduceMotion.matches) render(0,0);
      return;
    }
    if (!frameId) frameId=requestAnimationFrame(frame);
  };
  function render(p, time) {
    const ignition=smooth(clamp((p-.035)/.11));
    const flight=smooth(clamp((p-.14)/.75));
    const rise=flight*242;
    const engineY=376-rise;
    const wobble=flight>0 ? Math.sin(time*.00082)*1.05 : 0;
    const tilt=flight>0 ? Math.sin(time*.00043)*.75 : 0;
    const live=ignition * (1-.25*smooth(clamp((p-.90)/.10)));
    vehicle.setAttribute('transform',`translate(${wobble.toFixed(2)} ${(-rise).toFixed(2)}) rotate(${tilt.toFixed(2)} 82 310)`);
    flame.setAttribute('opacity',String(reduceMotion.matches?0:live));
    const flicker=1.02+.12*Math.sin(time*.027)+.065*Math.sin(time*.059);
    flame.setAttribute('transform',`translate(82 373) scale(${(0.90+.09*live).toFixed(3)} ${(flicker).toFixed(3)}) translate(-82 -373)`);
    exhaustLane.setAttribute('opacity',String(live*.68));
    const plumeEnd=435;
    if (engineY < plumeEnd) {
      const mid=(engineY+plumeEnd)/2;
      const plumeWidth=8+(plumeEnd-engineY)*.17;
      exhaustRibbon.setAttribute('d',`M77 ${engineY}Q${77-plumeWidth*.5} ${mid} ${82-plumeWidth} ${plumeEnd}L${82+plumeWidth} ${plumeEnd}Q${88+plumeWidth*.5} ${mid} 89 ${engineY}Z`);
      exhaustGlow.setAttribute('d',`M74 ${engineY}Q${58-plumeWidth*.5} ${mid} ${82-plumeWidth*1.15} ${plumeEnd}L${82+plumeWidth*1.15} ${plumeEnd}Q${105+plumeWidth*.5} ${mid} 92 ${engineY}Z`);
    }
    groundGlow.setAttribute('opacity',String(live*(1-flight*.58)));
    groundGlowSoft.setAttribute('opacity',String(live*(1-flight*.43)));
    const shockPhase=clamp((p-.075)/.12);
    shockwave.setAttribute('rx',String(17+shockPhase*65));
    shockwave.setAttribute('ry',String(6+shockPhase*15));
    shockwave.setAttribute('opacity',String(ignition*Math.sin(shockPhase*Math.PI)*.66));
    status.textContent=reduceMotion.matches||p<.07?'PRELAUNCH':p<.21?'IGNITION':p<.86?'ASCENT':'UPRANGE';
    const t=time*.0003;
    const phase=(n,m)=>((t*m+n)%1);
    smoke.forEach(({element,i,offset,drift,side}) => {
      const age=phase(offset+i*.13,2.0);
      const spread=age*(13+15*age);
      element.setAttribute('cx',(82+side*spread+Math.sin(t*6+i)*3+drift*9).toFixed(2));
      element.setAttribute('cy',(engineY+12+age*(67+flight*40)).toFixed(2));
      element.setAttribute('rx',(3+age*20).toFixed(1));
      element.setAttribute('ry',(5+age*28).toFixed(1));
      element.setAttribute('opacity',String(live*(1-age)**1.35*.67));
    });
    groundSmoke.forEach(({element,i,offset,side}) => {
      const age=phase(offset+i*.12,1.35);
      const d=age*(38+i%3*9);
      element.setAttribute('cx',(82+side*d+Math.sin(i*1.7+time*.00045)*6).toFixed(1));
      element.setAttribute('cy',(430-age*30+Math.sin(i*1.2+time*.00024)*3).toFixed(1));
      element.setAttribute('rx',(8+age*28).toFixed(1));
      element.setAttribute('ry',(5+age*14).toFixed(1));
      element.setAttribute('opacity',String(live*(1-age)**.65*.68*(1-flight*.36)));
    });
    sparks.forEach(({element,i,offset,side}) => {
      const age=phase(offset+i*.07,4.1);
      const speed=(i%3===0?40:26);
      element.setAttribute('x1',(82+side*age*(12+i%5*7)).toFixed(2));
      element.setAttribute('y1',(engineY+age*speed).toFixed(2));
      element.setAttribute('x2',(82+side*age*(12+i%5*7)-side*(2+i%4*2)).toFixed(2));
      element.setAttribute('y2',(engineY+age*speed+6+i%5*3).toFixed(2));
      element.setAttribute('opacity',String(live*(1-age)**.72*(i%4===0?1:.85)));
    });
  }
  function frame(now) {
    frameId=0;
    if (reduceMotion.matches || !visible) return;
    // 30 fps cap limits SVG filters and particle updates on mobile and laptops.
    if(now-lastRender<32){frameId=requestAnimationFrame(frame);return;}
    lastRender=now;
    const delta=clamp((now-lastFrame)/16.66,.65,3);
    lastFrame=now;
    progress+= (target-progress)*Math.min(.27,.11*delta);
    if(Math.abs(target-progress)<.0005)progress=target;
    render(progress,now);
    if(progress<.018 && target<.018){frameId=0;return;}
    // Keep effects alive while the timeline is in view; stop immediately when not visible.
    frameId=requestAnimationFrame(frame);
  }
  const ro=new ResizeObserver(updateTarget);
  ro.observe(history);
  addEventListener('scroll',updateTarget,{passive:true});
  addEventListener('resize',updateTarget,{passive:true});
  reduceMotion.addEventListener('change',updateTarget);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(frameId)cancelAnimationFrame(frameId);frameId=0;}
    else updateTarget();
  });
  if(reduceMotion.matches) render(0,0);
  updateTarget();
})();
