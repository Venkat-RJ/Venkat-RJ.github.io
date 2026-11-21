/* Standalone WebGL 3D renderer. No remote assets or npm dependency.
   Procedural automotive geometry with articulated liftgate and telescoping struts.
   Physical geometry and simulation are illustrative, not vehicle-CAD data. */
(function(global){
'use strict';
const P=global.RecursivePhysics;const CAD=global.RecursiveCAD;
const PI=Math.PI;
const V={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm:(a)=>{const d=Math.hypot(...a)||1;return a.map(x=>x/d);},
  mul:(a,s)=>a.map(x=>x*s),
};
const M={
 id:()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
 mul:(a,b)=>{const o=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];return o;},
 translate:(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1],
 scale:(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1],
 ry:(a)=>[Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1],
 rz:(a)=>[Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1],
 lookAt:(eye,target,up=[0,0,1])=>{const z=V.norm(V.sub(eye,target)),x=V.norm(V.cross(up,z)),y=V.cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1];},
 persp:(fov,aspect,n=0.1,f=60)=>{const c=1/Math.tan(fov/2);return [c/aspect,0,0,0,0,c,0,0,0,0,-(f+n)/(f-n),-1,0,0,-2*f*n/(f-n),0];},
 box:(pos,size,rot=0)=>M.mul(M.translate(...pos),M.mul(M.ry(rot),M.scale(...size))),
 between:(a,b,r,ry=r)=>{
  const axis=V.sub(b,a),d=Math.hypot(...axis),z=V.norm(axis),helper=Math.abs(z[2])>.92?[0,1,0]:[0,0,1];
  const x=V.norm(V.cross(helper,z)),y=V.cross(z,x),mid=V.mul(V.add(a,b),.5);
  return [x[0]*r,x[1]*r,x[2]*r,0,y[0]*ry,y[1]*ry,y[2]*ry,0,z[0]*d,z[1]*d,z[2]*d,0,...mid,1];
 },
 transform:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
};
function hex(h){h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function color(c){return Array.isArray(c)?c:hex(c)}
function createGeometry(){
 const g={box:null,cylinder:null,sphere:null,loft:null};
 function mesh(){return {positions:[],normals:[]}}
 function tri(m,a,b,c){const n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));for(const p of [a,b,c]){m.positions.push(...p);m.normals.push(...n)}}
 function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
 let cube=mesh();const [l,r]=[-.5,.5];
 quad(cube,[r,l,l],[r,r,l],[r,r,r],[r,l,r]);
 quad(cube,[l,r,l],[l,l,l],[l,l,r],[l,r,r]);
 quad(cube,[l,l,r],[r,l,r],[r,r,r],[l,r,r]);
 quad(cube,[l,r,l],[r,r,l],[r,l,l],[l,l,l]);
 quad(cube,[l,r,l],[l,r,r],[r,r,r],[r,r,l]);
 quad(cube,[r,l,l],[r,l,r],[l,l,r],[l,l,l]);
 g.box=cube;
 let cyl=mesh(),s=24;
 for(let i=0;i<s;i++){
  const a=i*2*PI/s,b=(i+1)*2*PI/s;
  let a1=[Math.cos(a),Math.sin(a),-.5],b1=[Math.cos(b),Math.sin(b),-.5],a2=[Math.cos(a),Math.sin(a),.5],b2=[Math.cos(b),Math.sin(b),.5];
  quad(cyl,a1,b1,b2,a2);tri(cyl,[0,0,.5],a2,b2);tri(cyl,[0,0,-.5],b1,a1);
 }g.cylinder=cyl;
 let sphere=mesh(),lat=12,lon=20;
 for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){
  const p=(j,i)=>{const v=(j/lat)*PI,u=i/lon*2*PI;return [Math.sin(v)*Math.cos(u),Math.sin(v)*Math.sin(u),Math.cos(v)];};
  const a=p(j,i),b=p(j,i+1),c=p(j+1,i+1),d=p(j+1,i);
  quad(sphere,a,b,c,d);
 }g.sphere=sphere;
 return {g,mesh,tri,quad};
}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;
uniform mat4 uModel,uPV;
out vec3 vNormal,vWorld,vView;
void main(){vec4 w=uModel*vec4(position,1.);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*normal);gl_Position=uPV*w;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vNormal,vWorld,vView;out vec4 outColor;
uniform vec4 uColor;uniform float uMetal,uEmissive;uniform vec3 uEye;uniform float uFog;
void main(){vec3 n=normalize(vNormal),v=normalize(uEye-vWorld);
 vec3 ld1=normalize(vec3(-0.60,-0.48,1.8)),ld2=normalize(vec3(.70,.85,1.1));
 float lambert=max(dot(n,ld1),0.)*.78+max(dot(n,ld2),0.)*.35;
 float shiny=pow(max(dot(reflect(-ld1,n),v),0.),mix(14.,100.,uMetal));
 float rim=pow(1.-max(0.,dot(n,v)),3.);
 vec3 base=uColor.rgb*(.28+lambert);
 vec3 spec=vec3(.88,.95,1.)*(shiny*(.10+.38*uMetal)+.055*rim*uMetal);
 vec3 col=base+spec+uColor.rgb*uEmissive;
 float dist=distance(vWorld,uEye),fog=clamp((dist-7.)/16.,0.,.35)*uFog;
 col=mix(col,vec3(.055,.078,.112),fog);
 col=pow(max(col,vec3(0.)),vec3(.88));
 outColor=vec4(col,uColor.a);
}`;
function compile(gl,t,src){let s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function makeProgram(gl){let p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function gpuGeometry(gl,obj){const vao=gl.createVertexArray();gl.bindVertexArray(vao);for(const [name,data] of [['position',obj.positions],['normal',obj.normals]]){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);let i=name==='position'?0:1;gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);}gl.bindVertexArray(null);return {vao,count:obj.positions.length/3};}
class PhysicalRenderer {
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  this.software=!this.gl;
  if(this.software){this.ctx=canvas.getContext('2d',{alpha:false});}
  else {
   this.gl.getExtension('EXT_color_buffer_float');
   this.p=makeProgram(this.gl);this.gl.useProgram(this.p);
   this.attrib={};this.u={};for(const n of ['uPV','uModel','uColor','uMetal','uEmissive','uEye','uFog'])this.u[n]=this.gl.getUniformLocation(this.p,n);
  }
  const b=createGeometry();this.G={};for(const n of ['box','cylinder','sphere'])this.G[n]=this.software?b.g[n]:gpuGeometry(this.gl,b.g[n]);
  this.custom=(vertices)=>this.software?vertices:gpuGeometry(this.gl,vertices);
  this.parts=[];this.q=0;this.q2=0;this.compare=false;this.mechanics=false;this.labels=false;
  this.yaw=.73;this.elev=.34;this.radius=3.45;this.target=[-.12,0,1.27];
  this.drag=null;this.pointerStart=null;
  this.makeScene(b);
  this.hatchTr=(q)=>M.mul(M.translate(0,0,CAD.hinge_z),M.ry(-q));
  this.attachControls();this.resize();
  this.draw(0);
 }
 add(geo,model,material,group='body',metadata={}){this.parts.push({geo,model,material,group,...metadata});}
 box(pos,size,mat,group='body',parent=null){this.add('box',parent?((q)=>M.mul(parent(q),M.box(pos,size))):M.box(pos,size),mat,group);}
 ball(pos,r,mat,group='metal',parent=null){this.add('sphere',parent?((q)=>M.mul(parent(q),M.box(pos,[r,r,r]))):M.box(pos,[r,r,r]),mat,group);}
 rod(a,b,r,mat,group='metal',parent=null){this.add('cylinder',parent?((q)=>M.mul(parent(q),M.between(a,b,r))):M.between(a,b,r),mat,group);}
 polygon(points,mat,group='body',parent=null){let m={positions:[],normals:[]};for(let i=1;i<points.length-1;i++){let a=points[0],b=points[i],c=points[i+1],n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));for(const p of [a,b,c]){m.positions.push(...p);m.normals.push(...n);}}this.add(this.custom(m),parent?((q)=>parent(q)):M.id(),mat,group,{double:true});}
 makeScene(b){
  // All vehicle/hatch triangle meshes are tessellated from the STEP CAD source.
  // Strut cylinders use the exact CAD outer diameters and CAD mount points with
  // length/orientation recomputed from the hinge angle for every simulation frame.
  this.box([-.15,0,.423],[3.1,3.1,.02],{c:'#1a2730',metal:.1},'floor');
  for(let i=-10;i<=10;i++){
   this.box([i*.15,0,.435],[.0015,2.75,.001],{c:'#415563',a:.22},'floorLine');
   this.box([-.15,i*.14,.435],[2.9,.0015,.001],{c:'#415563',a:.22},'floorLine');
  }
  for(const part of CAD.parts){
   const model=part.group==='hatch'?((q)=>M.mul(M.translate(0,0,CAD.hinge_z),M.ry(-q))):M.id();
   const material={c:part.c,metal:part.metal};
   if(part.c==='#29485a')material.a=.73;
   const group=part.group==='hatch'?'hatch':(part.name.includes('BODY')?'body':'mechanism');
   this.add(this.custom({positions:part.positions,normals:part.normals}),model,material,group,{name:part.name});
  }
  const len=(q)=>P.geometry(q).length_m;
  for(const sign of [-1,1]){
   const a=[CAD.body_anchor[0],sign*CAD.strut_y,CAD.body_anchor[1]];
   const b=(q)=>{const p=P.geometry(q);return[p.hatch_point_x_m,sign*CAD.strut_y,p.hatch_point_z_m]};
   const point=(q,at)=>{const B=b(q),d=V.norm(V.sub(B,a));return V.add(a,V.mul(d,at));};
   const cyl=(from,to,r,material)=>this.add('cylinder',(q)=>M.between(point(q,from),point(q,typeof to==='function'?to(len(q)):to),r),material,'mechanism');
   cyl(.035,.155,.038,{c:'#3c5260',metal:.63}); // motor
   cyl(.140,.402,.031,{c:'#3c5260',metal:.72}); // outer housing
   cyl(.391,.421,.035,{c:'#bdccd7',metal:.91}); // gland
   cyl(.412,L=>L-.018,.0125,{c:'#e3e9f0',metal:.99}); // telescopic steel rod
   cyl(.396,.401,.034,{c:'#151b25',metal:.08}); // seal
   cyl(.037,.063,.040,{c:'#263440',metal:.45}); // rear motor cap
   this.ball(a,.015,{c:'#c6ced8',metal:.95},'mechanism');
   this.add('sphere',(q)=>M.box(b(q),[.014,.014,.014]),{c:'#c6ced8',metal:.95},'mechanism');
  }
 }
 attachControls(){
  const canvas=this.canvas;
  canvas.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,elev:this.elev};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw=this.drag.yaw+(e.clientX-this.drag.x)*.006;
   this.elev=Math.max(-.05,Math.min(1.18,this.drag.elev+(e.clientY-this.drag.y)*.004));this.draw();});
  const stop=()=>{this.drag=null;canvas.style.cursor='grab';};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.radius=P.clamp(this.radius*Math.exp(e.deltaY*.0008),2.65,11);this.draw();},{passive:false});
  canvas.addEventListener('dblclick',()=>{this.yaw=.73;this.elev=.34;this.radius=3.45;this.draw();});
  window.addEventListener('resize',()=>this.resize());
 }
 setFocus(mode){if(mode==='mechanism'){this.mechanics=true;this.target=[-.18,0,1.32];this.radius=2.75;this.yaw=.78;this.elev=.25;}
  else{this.mechanics=false;this.target=[-.12,0,1.27];this.radius=3.45;this.yaw=.73;this.elev=.34;}this.draw();}
 resize(){let w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.8);let W=Math.max(1,Math.floor(w*dpr)),H=Math.max(1,Math.floor(h*dpr));if(this.canvas.width!==W||this.canvas.height!==H){this.canvas.width=W;this.canvas.height=H;}this.draw();}
 eye(){return [this.target[0]+this.radius*Math.cos(this.elev)*Math.cos(this.yaw),this.target[1]+this.radius*Math.cos(this.elev)*Math.sin(this.yaw),this.target[2]+this.radius*Math.sin(this.elev)];}
 draw(q=this.q,q2=this.q2,compare=this.compare){
  this.q=q;this.q2=q2;this.compare=compare;
  if(this.software){this.drawSoftware(q,q2,compare);return;}
  const gl=this.gl;
  if(!gl)return;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(.047,.067,.091,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  const eye=this.eye();gl.useProgram(this.p);
  gl.uniform3fv(this.u.uEye,new Float32Array(eye));gl.uniform1f(this.u.uFog,1);
  let views=compare?[{left:0,width:Math.floor(this.canvas.width/2),q},{left:Math.floor(this.canvas.width/2),width:this.canvas.width-Math.floor(this.canvas.width/2),q:q2}]:[{left:0,width:this.canvas.width,q}];
  gl.enable(gl.SCISSOR_TEST);
  for(const view of views){
   gl.viewport(view.left,0,view.width,this.canvas.height);gl.scissor(view.left,0,view.width,this.canvas.height);
   gl.clearColor(.047,.067,.091,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const proj=M.persp((compare?47:43)*PI/180,view.width/this.canvas.height,.06,55);
   const pv=M.mul(proj,M.lookAt(eye,this.target));
   gl.uniformMatrix4fv(this.u.uPV,false,new Float32Array(pv));
   // Draw opaque meshes first, then transparent shadow and grid overlays.
   for(const pass of [0,1])for(const part of this.parts){
    let alpha=part.material.a===undefined?1:part.material.a;
    if(this.mechanics && ['body','window','hatch'].includes(part.group)){
      if(part.group==='window')continue;
      alpha=part.group==='body'?.08:.16;
    }
    const isTransparent=alpha<.99;
    if((pass===0&&isTransparent)||(pass===1&&!isTransparent))continue;
    if(alpha<.01)continue;
    const mat=typeof part.model==='function'?part.model(view.q):part.model;
    const geom=typeof part.geo==='string'?this.G[part.geo]:part.geo;
    gl.bindVertexArray(geom.vao);
    gl.uniformMatrix4fv(this.u.uModel,false,new Float32Array(mat));
    gl.uniform4fv(this.u.uColor,new Float32Array([...color(part.material.c),alpha]));
    gl.uniform1f(this.u.uMetal,part.material.metal||0);
    gl.uniform1f(this.u.uEmissive,part.material.emit||0);
    if(isTransparent)gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES,0,geom.count);
    if(isTransparent)gl.depthMask(true);
   }
   gl.bindVertexArray(null);
  }
  gl.disable(gl.SCISSOR_TEST);
  // Overlay DOM callouts can use projectPoint() with the same camera.
 }
 drawSoftware(q,q2,compare){
  // Perspective mesh renderer for restricted browsers without WebGL. The exact
  // same 3D meshes, camera, hinge transforms and strut positions are used.
  const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1421';ctx.fillRect(0,0,w,h);
  const views=compare?[{left:0,width:Math.floor(w/2),q},{left:Math.floor(w/2),width:w-Math.floor(w/2),q:q2}]:[{left:0,width:w,q}];
  for(const view of views){
   const eye=this.eye(),proj=M.persp((compare?47:43)*PI/180,view.width/h,.06,55);
   const pv=M.mul(proj,M.lookAt(eye,this.target));
   const light1=V.norm([-.6,-.48,1.8]),light2=V.norm([.7,.85,1.1]);
   const polys=[];
   for(const part of this.parts){
    let alpha=part.material.a===undefined?1:part.material.a;
    if(this.mechanics&&['body','window','hatch'].includes(part.group)){
      if(part.group==='window')continue;
      alpha=part.group==='body'?.07:.16;
    }
    if(alpha<.01)continue;
    const mat=typeof part.model==='function'?part.model(view.q):part.model;
    const geo=typeof part.geo==='string'?this.G[part.geo]:part.geo;
    let xyz=geo.positions;const rawColor=color(part.material.c);
    const stride=part.geo==='cylinder'?2:part.geo==='sphere'?3:1;
    for(let i=0;i<xyz.length;i+=9*stride){
      const points=[],worldPoints=[];let d=0,clipped=false;
      for(let j=0;j<3;j++){
       const pos=[xyz[i+j*3],xyz[i+j*3+1],xyz[i+j*3+2]];
       const world=M.transform(mat,pos),clip=[0,0,0,0];worldPoints.push(world);
       for(let k=0;k<4;k++){
        clip[k]=pv[k]*world[0]+pv[4+k]*world[1]+pv[8+k]*world[2]+pv[12+k];
       }
       if(clip[3]<.04||Math.abs(clip[0]/clip[3])>4||Math.abs(clip[1]/clip[3])>4){clipped=true;break;}
       points.push([(clip[0]/clip[3]*.5+.5)*view.width+view.left,(1-(clip[1]/clip[3]*.5+.5))*h]);
       d+=Math.hypot(world[0]-eye[0],world[1]-eye[1],world[2]-eye[2]);
      }
      if(clipped||points.length!==3)continue;
      const normal=V.norm(V.cross(V.sub(worldPoints[1],worldPoints[0]),V.sub(worldPoints[2],worldPoints[0])));
      const l=Math.abs(V.dot(normal,light1))*.53+Math.abs(V.dot(normal,light2))*.24+.28;
      const metallic=part.material.metal||0,emissive=part.material.emit||0;
      const rgb=rawColor.map((c,ii)=>Math.min(255,Math.round(255*Math.pow(Math.min(1,c*(l+emissive)+metallic*.10),.88))));
      const fill=`rgba(${rgb.join(',')},${alpha})`;
      polys.push({points,fill,d:d/3,alpha,ground:['floor','floorLine','shadow'].includes(part.group)});
    }
   }
   polys.sort((a,b)=>(a.ground&&!b.ground?-1:!a.ground&&b.ground?1:b.d-a.d));
   ctx.save();ctx.beginPath();ctx.rect(view.left,0,view.width,h);ctx.clip();
   for(const poly of polys){const t=poly.points;ctx.beginPath();ctx.moveTo(t[0][0],t[0][1]);ctx.lineTo(t[1][0],t[1][1]);ctx.lineTo(t[2][0],t[2][1]);ctx.closePath();ctx.fillStyle=poly.fill;ctx.fill();}
   ctx.restore();
  }
 }
 projectPoint(p,side=0){const eye=this.eye(),split=this.compare,half=split?this.canvas.clientWidth/2:this.canvas.clientWidth;
  const pv=M.mul(M.persp((split?47:43)*PI/180,half/this.canvas.clientHeight,.06,55),M.lookAt(eye,this.target));
  const v=[p[0],p[1],p[2],1],clip=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)clip[r]+=pv[c*4+r]*v[c];
  const x=(clip[0]/clip[3]*.5+.5)*half+(split?side*half:0),y=(1-(clip[1]/clip[3]*.5+.5))*this.canvas.clientHeight;
  return {x,y,visible:clip[3]>0};
 }
}
global.PhysicalRenderer=PhysicalRenderer;
})(window);
