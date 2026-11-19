
(() => {
  'use strict';
  const history=document.querySelector('#career-history');
  if (!history) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 650px)');
  const NS='http://www.w3.org/2000/svg';
  const E=(tag,props={},parent)=>{
    const el=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(props)) el.setAttribute(k,String(v));
    if(parent)parent.appendChild(el);
    return el;
  };
  const svg=E('svg',{'class':'tree-svg',role:'presentation','aria-hidden':'true',focusable:'false'},history);
  const defs=E('defs',{},svg);
  function gradient(id,stops){
    const g=E('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'0%'},defs);
    stops.forEach(([offset,color])=>E('stop',{offset,'stop-color':color},g));
    return g;
  }
  gradient('head-shade',[['0%','#423b2c'],['22%','#937349'],['48%','#cfb47e'],['70%','#978051'],['100%','#483a2b']]);
  const tile=(id,src,w,h)=>{
    const p=E('pattern',{id,patternUnits:'userSpaceOnUse',width:w,height:h},defs);
    E('image',{href:src,width:w,height:h,preserveAspectRatio:'none'},p);
    return p;
  };
  tile('bark-tile','./assets/timeline-bark.jpg',242,367);
  tile('snake-texture','./assets/timeline-python-skin.jpg',225,225);
  const filter=(id,blur,dx=0,dy=0)=>{
    const f=E('filter',{id,x:'-45%',y:'-45%',width:'190%',height:'190%'},defs);
    E('feGaussianBlur',{in:'SourceGraphic',stdDeviation:blur},f);
    return f;
  };
  filter('soft-shadow',2.1);
  filter('coil-contact',4.7);
  const headFilter=E('filter',{id:'head-shadow',x:'-40%',y:'-40%',width:'180%',height:'180%'},defs);
  E('feDropShadow',{dx:1.5,dy:2.2,stdDeviation:2.4,'flood-color':'#21170f','flood-opacity':.35},headFilter);
  const clip=E('clipPath',{id:'snake-progress'},defs);
  const reveal=E('rect',{x:0,y:0,width:1000,height:0},clip);
  const branchGroup=E('g',{},svg);
  const behind=E('g',{'class':'snake-animated','clip-path':'url(#snake-progress)'},svg);
  const backShadow=E('path',{'class':'snake-behind-dark'},behind);
  const backSkin=E('path',{'class':'snake-behind-skin'},behind);
  const backShade=E('path',{'class':'snake-behind-shade'},behind);
  const treeGroup=E('g',{},svg);
  const trunkShadow=E('path',{'class':'tree-trunk-shadow'},treeGroup);
  const trunk=E('path',{'class':'tree-trunk'},treeGroup);
  const bark=E('g',{},treeGroup);
  const trunkLight=E('path',{'class':'tree-trunk-light'},treeGroup);
  const fore=E('g',{'class':'snake-animated','clip-path':'url(#snake-progress)'},svg);
  const coils=E('g',{},fore);
  const markings=E('g',{},fore);
  const specular=E('g',{},fore);
  const head=E('g',{'class':'python-head'},svg);
  // Ball-python-like head: wider cheekbones, narrow rounded snout, small dark eyes.
  E('path',{'class':'lower-jaw',d:'M-21 -16 C-20 7 -11 26 -5 30 Q0 33 5 30 C11 26 20 7 21 -16 Q0 -7 -21 -16 Z'},head);
  E('path',{'class':'head-top',d:'M-23 -29 Q-28 -18 -23 -4 L-19 8 Q-16 18 -8 27 Q0 35 8 27 Q16 18 19 8 L23 -4 Q28 -18 23 -29 Q12 -34 0 -29 Q-12 -34 -23 -29 Z'},head);
  E('path',{'class':'head-mottle',d:'M-22 -26 Q-10 -20 -10 -5 L-17 6 Q-22 -6 -22 -26 Z'},head);
  E('path',{'class':'head-mottle',d:'M22 -26 Q10 -20 10 -5 L17 6 Q22 -6 22 -26 Z'},head);
  E('path',{'class':'head-mottle',d:'M-8 -31 Q0 -15 8 -31 L5 -18 Q0 -11 -5 -18 Z'},head);
  E('path',{'class':'head-mottle-light',d:'M-7 5 Q0 9 7 5 L3 25 Q0 29 -3 25 Z'},head);
  for (const side of [-1,1]){
    E('ellipse',{'class':'eyelid',cx:side*16.4,cy:4.5,rx:4.8,ry:3.7},head);
    E('ellipse',{'class':'eye',cx:side*16.4,cy:4.5,rx:2.3,ry:2.4},head);
    E('circle',{'class':'eye-glint',cx:side*16.6-.45,cy:3.4,r:.65},head);
    E('ellipse',{'class':'nostril',cx:side*5,cy:25.3,rx:1.1,ry:.7},head);
  }
  E('path',{'class':'mouth',d:'M-13 19 Q0 29 13 19'},head);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const path=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
  let width=0,height=0,center=160,amplitude=30,period=225,current=0,target=0,raf=0;
  let eventCount=0;
  const theta=y=>Math.PI*2*y/period-.65;
  const wobble=y=>2.8*Math.sin(y/232)+2.2*Math.sin(y/71);
  const treeX=y=>center+wobble(y);
  const snakeX=y=>treeX(y)+amplitude*Math.sin(theta(y));
  const slope=y=>(snakeX(y+1)-snakeX(y-1))/2;
  const frontSide=y=>Math.cos(theta(y))>-0.10;
  const wobbleJitter=(y,c=1)=>Math.sin(y*.097+c*12.13)*Math.sin(y*.173+c*7.21);
  function build(){
    const bounds=history.getBoundingClientRect();
    const first=history.querySelector('.position-content').getBoundingClientRect();
    const onMobile=mobile.matches;
    width=Math.round(bounds.width);
    height=Math.max(300,Math.round(history.scrollHeight));
    center=onMobile?34:(first.left-bounds.left-71);
    amplitude=onMobile?14:30;
    period=onMobile?168:224;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    reveal.setAttribute('width',width);
    // Irregular tapered silhouette instead of a perfect cylindrical stroke.
    const left=[],right=[];
    for(let y=8;y<=height-7;y+=8){
      const x=treeX(y);
      const rad=onMobile?12.5:23;
      const barkEdge=(Math.sin(y*.111)*1.7+Math.sin(y*.31)*.9)*(onMobile?.6:1);
      left.push([x-rad+barkEdge,y]);
      right.push([x+rad+.75*barkEdge,y]);
    }
    const trunkPath=path(left)+ ' '+path(right.reverse()).replace(/^M/,'L')+' Z';
    trunk.setAttribute('d',trunkPath);
    trunkShadow.setAttribute('d',trunkPath);
    trunkShadow.setAttribute('transform','translate(3 2)');
    const lightPts=[];
    for(let y=10;y<height-5;y+=8)lightPts.push([treeX(y)-(onMobile?5:11),y]);
    trunkLight.setAttribute('d',path(lightPts));
    const snakePts=[];
    for(let y=7;y<height-5;y+=3)snakePts.push([snakeX(y),y]);
    snakePts.push([snakeX(height-5),height-5]);
    const snakePath=path(snakePts);
    backShadow.setAttribute('d',snakePath);
    backSkin.setAttribute('d',snakePath);
    backShade.setAttribute('d',snakePath);
    branchGroup.replaceChildren(); bark.replaceChildren();coils.replaceChildren();markings.replaceChildren();specular.replaceChildren();
    const articles=[...history.querySelectorAll('article.position')];
    articles.forEach((article,index)=>{
      const rect=article.getBoundingClientRect();
      const y=rect.top-bounds.top+19;
      const x=treeX(y);
      const endpoint=onMobile?67:(first.left-bounds.left-16);
      const d=`M${x.toFixed(1)} ${y.toFixed(1)} C${(x+15).toFixed(1)} ${(y-15).toFixed(1)} ${(endpoint-21).toFixed(1)} ${(y-5).toFixed(1)} ${endpoint.toFixed(1)} ${(y-4).toFixed(1)}`;
      E('path',{'class':'tree-limb',d},branchGroup);
      E('path',{'class':'tree-limb-shine',d},branchGroup);
      if(index%2===0){
        for(const [dx,dy,rot,light] of [[-7,-8,-22,false],[5,7,39,true]]){
          E('ellipse',{'class':light?'tree-leaf-light':'tree-leaf',cx:endpoint+dx,cy:y+dy,rx:onMobile?2.8:4.1,ry:onMobile?6:9,transform:`rotate(${rot} ${endpoint+dx} ${y+dy})`},branchGroup);
        }
      }
    });
    for(let y=25;y<height-20;y+=32){
      const x=treeX(y);
      const offset=wobbleJitter(y)*6;
      const d=`M${(x+offset-4).toFixed(1)} ${(y-12).toFixed(1)} Q${(x+offset-8).toFixed(1)} ${y.toFixed(1)} ${(x+offset-4).toFixed(1)} ${(y+11).toFixed(1)}`;
      E('path',{'class':'tree-bark-rift',d},bark);
      if(y%3<1.5){
        const d2=`M${(x+9).toFixed(1)} ${(y-13).toFixed(1)} Q${(x+13).toFixed(1)} ${y.toFixed(1)} ${(x+9).toFixed(1)} ${(y+15).toFixed(1)}`;
        E('path',{'class':'tree-bark-glint',d:d2},bark);
      }
    }
    // Draw front-depth arcs after the trunk, with contact shadows beneath skin.
    let segments=[], active=null;
    for(let y=7;y<=height-5;y+=2){
      if(frontSide(y)){if(!active)active=[];active.push([snakeX(y),y]);}
      else if(active){if(active.length>2)segments.push(active);active=null;}
    }
    if(active&&active.length>2)segments.push(active);
    for(const points of segments){
      const d=path(points);
      E('path',{'class':'snake-contact',d},coils);
      E('path',{'class':'snake-outer',d},coils);
      E('path',{'class':'snake-skin',d},coils);
      E('path',{'class':'snake-cool-shade',d},specular);
      E('path',{'class':'snake-highlight',d},specular);
    }
    // A few irregular saddle markings follow the curving body, not the page grid.
    for(let y=24;y<height-12;y+=66){
      if(!frontSide(y) || !frontSide(y-14)||!frontSide(y+14))continue;
      const angle=-Math.atan(slope(y))*180/Math.PI;
      const size=onMobile?.55:1;
      const g=E('g',{transform:`translate(${snakeX(y).toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)}) scale(${size})`},markings);
      const jiggle=wobbleJitter(y,2)*4;
      const main=`M${(-13+jiggle).toFixed(1)} -13 C-8 -22 1 -21 8 -17 Q16 -15 13 -7 L15 2 Q11 12 6 15 Q-5 11 -14 15 Q-20 4 -16 -4 Z`;
      E('path',{'class':'snake-mark',d:main},g);
      E('path',{'class':'snake-mark-inside',d:'M-7 -9 Q1 -13 7 -6 Q10 2 3 7 Q-6 8 -7 -9 Z'},g);
      for(const xx of [-23,22]) E('ellipse',{'class':'snake-speck',cx:xx,cy:7,rx:2.8,ry:5.4},g);
    }
    updateTarget();current=target;paint();
  }
  function updateTarget(){
    const r=history.getBoundingClientRect();
    target=clamp(innerHeight*.61-r.top,8,height-8);
    eventCount++;
  }
  function paint(){
    reveal.setAttribute('height',Math.max(0,current-16));
    const dx=slope(current);
    const scale=mobile.matches?.58:1;
    head.setAttribute('transform',`translate(${snakeX(current).toFixed(2)} ${current.toFixed(2)}) rotate(${(-Math.atan(dx)*180/Math.PI).toFixed(1)}) scale(${scale})`);
    head.style.opacity=(current>18&&!reduced.matches)?'1':'0';
  }
  function frame(){
    raf=0;
    if(reduced.matches)return;
    current+=(target-current)*.18;
    if(Math.abs(target-current)<.45)current=target;
    paint();
    if(current!==target)raf=requestAnimationFrame(frame);
  }
  function scroll(){updateTarget();if(!raf&&!reduced.matches)raf=requestAnimationFrame(frame);}
  const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=0;build();});
  ro.observe(history);
  addEventListener('scroll',scroll,{passive:true});
  addEventListener('resize',build,{passive:true});
  reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(raf);raf=0;head.style.opacity='0';}else scroll();});
  build();
})();
