// A compact, locally rendered 3D character. No model downloads or external runtime.
export function createPanda3D(parent) {
  const canvas = document.createElement('canvas');
  canvas.className = 'panda-3d';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power'
  });
  const context = gl ? null : canvas.getContext('2d', { alpha:true });
  if (!gl && !context) return null;

  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return out;
  }
  function translation(x, y, z) {
    const m = identity(); m[12] = x; m[13] = y; m[14] = z; return m;
  }
  function scaling(x, y, z) {
    const m = identity(); m[0] = x; m[5] = y; m[10] = z; return m;
  }
  function rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
  }
  function rotateY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
  }
  function rotateZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
  }
  function normalMatrix(m) {
    const a=m[0], b=m[4], c=m[8], d=m[1], e=m[5], f=m[9], g=m[2], h=m[6], i=m[10];
    const inv = 1 / (a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g));
    return new Float32Array([
      (e*i-f*h)*inv, (c*h-b*i)*inv, (b*f-c*e)*inv,
      (f*g-d*i)*inv, (a*i-c*g)*inv, (c*d-a*f)*inv,
      (d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv
    ]);
  }

  const vertexSource = `
    attribute vec3 a_position;
    uniform mat4 u_model;
    uniform mat4 u_projection;
    uniform mat3 u_normal;
    varying vec3 v_normal;
    varying vec3 v_world;
    varying vec3 v_local;
    void main() {
      vec4 world = u_model * vec4(a_position, 1.0);
      v_world = world.xyz;
      v_local = a_position;
      v_normal = normalize(u_normal * a_position);
      gl_Position = u_projection * vec4(world.x, world.y - 0.25, world.z - 5.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec3 u_color;
    uniform float u_gloss;
    uniform float u_ao;
    varying vec3 v_normal;
    varying vec3 v_world;
    varying vec3 v_local;
    void main() {
      vec3 n = normalize(v_normal);
      vec3 light = normalize(vec3(-0.65, 0.9, 1.4));
      vec3 view = normalize(vec3(0.0, 0.25, 5.0) - v_world);
      float key = max(dot(n, light), 0.0);
      float fill = max(dot(n, normalize(vec3(0.9, 0.1, 0.6))), 0.0);
      float rim = pow(1.0 - max(dot(n, view), 0.0), 3.0);
      float grain = fract(sin(dot(floor(v_local * 165.0), vec3(12.9898,78.233,39.425))) * 43758.5453);
      float shade = (0.32 + key * 0.67 + fill * 0.13) * (0.98 + grain * 0.04);
      float contact = 1.0 - u_ao * exp(-pow((v_world.y - 0.38) * 5.0, 2.0));
      float specular = pow(max(dot(n, normalize(light + view)), 0.0), mix(20.0, 65.0, u_gloss));
      vec3 color = u_color * shade * contact + vec3(0.025) * rim + vec3(specular * (0.018 + u_gloss * 0.19));
      gl_FragColor = vec4(pow(max(color, vec3(0.0)), vec3(0.4545)), 1.0);
    }
  `;
  const positions = [], indices = [];
  const rings = gl ? 20 : 14, slices = gl ? 28 : 22;
  for (let r = 0; r <= rings; r++) {
    const theta = r * Math.PI / rings;
    for (let s = 0; s <= slices; s++) {
      const phi = s * Math.PI * 2 / slices;
      positions.push(Math.sin(theta)*Math.cos(phi), Math.cos(theta), Math.sin(theta)*Math.sin(phi));
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < slices; s++) {
    const a = r * (slices + 1) + s, b = a + slices + 1;
    indices.push(a,b,a+1, b,b+1,a+1);
  }

  let program, locations, available = false, size = 144;
  let pixels, depths, lastDraw = -1;
  function initialize() {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    locations = Object.fromEntries(['model','projection','normal','color','gloss','ao'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const f = 1 / Math.tan(Math.PI / 10);
    gl.uniformMatrix4fv(locations.projection, false, new Float32Array([
      f,0,0,0, 0,f,0,0, 0,0,-1.020202,-1, 0,0,-0.2020202,0
    ]));
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0,0,0,0);
    available = true;
    resize(size);
  }
  function resize(nextSize) {
    size = nextSize;
    const resolution = Math.round(size * Math.min(devicePixelRatio || 1, gl ? 2 : 1.5));
    if (canvas.width !== resolution || !pixels) {
      canvas.width = resolution; canvas.height = resolution;
      if (context) {
        pixels = context.createImageData(resolution,resolution);
        depths = new Float32Array(resolution * resolution);
      }
    }
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    if (available && gl) gl.viewport(0,0,resolution,resolution);
    lastDraw = -1;
  }
  if (gl) {
    try { initialize(); } catch (error) { console.warn('Panda 3D fallback:', error.message); return null; }
  } else { available = true; resize(size); }
  canvas.dataset.renderer = gl ? 'webgl' : 'software-3d';
  parent.appendChild(canvas);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); available = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { initialize(); } catch { available = false; }
  });

  const white = [0.87,0.87,0.80], black = [0.022,0.029,0.031];
  const inner = [0.055,0.067,0.066], eyeWhite = [0.97,0.97,0.93], eyeBlack = [0.006,0.009,0.012];

  // The same sphere meshes, transforms, lights and depth buffer are used without WebGL.
  // Keeping the drawing surface small makes this fallback practical on ordinary phones.
  function rasterSphere(model, normals, color, gloss, ao) {
    const width = canvas.width, factor = width * 0.5 / Math.tan(Math.PI / 10);
    const vertices = new Float32Array(positions.length * 2);
    const lx=-0.3644, ly=0.5046, lz=0.7827;
    for (let i=0,j=0; i<positions.length; i+=3,j+=6) {
      const x=positions[i], y=positions[i+1], z=positions[i+2];
      const wx=model[0]*x+model[4]*y+model[8]*z+model[12];
      const wy=model[1]*x+model[5]*y+model[9]*z+model[13];
      const wz=model[2]*x+model[6]*y+model[10]*z+model[14];
      let nx=normals[0]*x+normals[3]*y+normals[6]*z;
      let ny=normals[1]*x+normals[4]*y+normals[7]*z;
      let nz=normals[2]*x+normals[5]*y+normals[8]*z;
      const length=1/Math.hypot(nx,ny,nz); nx*=length; ny*=length; nz*=length;
      const inv=1/(5-wz), key=Math.max(0,nx*lx+ny*ly+nz*lz);
      const fill=Math.max(0,nx*.828+ny*.092+nz*.552);
      let vx=-wx, vy=.25-wy, vz=5-wz;
      const viewLength=1/Math.hypot(vx,vy,vz); vx*=viewLength; vy*=viewLength; vz*=viewLength;
      const rim=Math.pow(1-Math.max(0,nx*vx+ny*vy+nz*vz),3)*.025;
      const hx=lx+vx, hy=ly+vy, hz=lz+vz, halfLength=1/Math.hypot(hx,hy,hz);
      const specular=Math.pow(Math.max(0,(nx*hx+ny*hy+nz*hz)*halfLength),20+45*gloss)*(.018+gloss*.19);
      const shade=(.32+key*.67+fill*.13)*(1-ao*Math.exp(-Math.pow((wy-.38)*5,2)));
      vertices[j]=width*.5+wx*inv*factor;
      vertices[j+1]=width*.5-(wy-.25)*inv*factor;
      vertices[j+2]=inv;
      for(let channel=0;channel<3;channel++) vertices[j+3+channel]=Math.pow(Math.max(0,color[channel]*shade+rim+specular),.4545)*255*inv;
    }
    const data=pixels.data;
    for (let t=0;t<indices.length;t+=3) {
      const a=indices[t]*6,b=indices[t+1]*6,c=indices[t+2]*6;
      const ax=vertices[a],ay=vertices[a+1],bx=vertices[b],by=vertices[b+1],cx=vertices[c],cy=vertices[c+1];
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(area<=.00001)continue;
      const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
      const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(width-1,Math.ceil(Math.max(ay,by,cy)));
      const inverseArea=1/area;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
        const px=x+.5,py=y+.5;
        const wa=((bx-px)*(cy-py)-(by-py)*(cx-px))*inverseArea;
        const wb=((cx-px)*(ay-py)-(cy-py)*(ax-px))*inverseArea;
        const wc=1-wa-wb;
        if(wa<0||wb<0||wc<0)continue;
        const inverseDepth=wa*vertices[a+2]+wb*vertices[b+2]+wc*vertices[c+2];
        const pixel=y*width+x;
        if(inverseDepth<=depths[pixel])continue;
        depths[pixel]=inverseDepth;
        const offset=pixel*4;
        for(let channel=0;channel<3;channel++)data[offset+channel]=(wa*vertices[a+3+channel]+wb*vertices[b+3+channel]+wc*vertices[c+3+channel])/inverseDepth;
        data[offset+3]=255;
      }
    }
  }
  function ellipsoid(parentMatrix, position, scale, color, rotation = 0, gloss = 0, ao = 0) {
    let model = multiply(parentMatrix, translation(...position));
    if (rotation) model = multiply(model, rotateZ(rotation));
    model = multiply(model, scaling(...scale));
    if (context) { rasterSphere(model,normalMatrix(model),color,gloss,ao); return; }
    gl.uniformMatrix4fv(locations.model, false, model);
    gl.uniformMatrix3fv(locations.normal, false, normalMatrix(model));
    gl.uniform3fv(locations.color, color); gl.uniform1f(locations.gloss, gloss); gl.uniform1f(locations.ao, ao);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  function render({ time = 0, yaw = 0, lean = 0, gait = 0, grip = 0, peek = 0, wave = 0, sit = 0, still = false }) {
    if (!available) return false;
    if (context && !still && lastDraw >= 0 && time-lastDraw < 1/30) return true;
    lastDraw = time;
    if (gl) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    else { pixels.data.fill(0); depths.fill(0); }
    const breath = still ? 0 : Math.sin(time * 1.8) * 0.012;
    let root = multiply(rotateZ(lean), rotateY(yaw));
    root = multiply(root, scaling(1 + breath, 1 - sit * 0.07, 1 + breath));
    const draw = (p,s,c,r=0,g=0,a=0) => ellipsoid(root,p,s,c,r,g,a);
    draw([0,-0.36,-0.55],[0.22,0.22,0.20],white);
    // The belly is intentionally wider than the head and sits low between short legs.
    draw([0,-0.05,0],[0.84,0.75,0.60],black);
    draw([0,-0.10,0.32],[0.74,0.64,0.41],white,0,0,0.18);
    for (const side of [-1,1]) {
      const step = Math.sin(gait + (side > 0 ? Math.PI : 0));
      const lift = grip * step * 0.08;
      let leg = multiply(root, translation(side * 0.38,-0.69 + lift,0.14 + sit * 0.16));
      leg = multiply(leg, rotateX(step * 0.12 * (1 - sit)));
      ellipsoid(leg,[0,0,0],[0.28,0.24,0.36],black,side * -0.08);
      ellipsoid(leg,[0,-0.025,0.32],[0.15,0.105,0.045],inner);
      for (const toe of [-1,0,1]) ellipsoid(leg,[toe * 0.075,0.07,0.32],[0.025,0.032,0.025],inner);

      const waving = wave * (side === (peek >= 0 ? 1 : -1) ? 1 : 0);
      let arm = multiply(root, translation(side * 0.65,0.22 + lift,0.06 + grip * 0.16));
      arm = multiply(arm, rotateZ(side * (0.15 + grip * 0.34 + waving * (1.65 + Math.sin(time * 8) * 0.18))));
      arm = multiply(arm, rotateX(grip * -0.36 + step * 0.13 * (1 - grip)));
      ellipsoid(arm,[0,-0.20,0],[0.235,0.37,0.25],black);
      ellipsoid(arm,[0,-0.39,0.18],[0.13,0.12,0.065],inner);
    }

    const headYaw = -yaw * (peek ? 0.85 : 0.60) + peek * 0.02;
    let head = multiply(root, translation(peek * 0.10,0.70,0.07));
    head = multiply(head, rotateY(headYaw));
    head = multiply(head, rotateZ(peek * -0.13 + (still ? 0 : Math.sin(time * 1.2) * 0.025)));
    head = multiply(head, rotateX(still ? 0 : Math.sin(time * 1.4) * 0.025));
    const face = (p,s,c,r=0,g=0) => ellipsoid(head,p,s,c,r,g);
    for (const side of [-1,1]) {
      face([side * 0.48,0.43,-0.06],[0.23,0.24,0.18],black);
      face([side * 0.48,0.44,0.085],[0.125,0.14,0.05],inner);
    }
    face([0,0,0],[0.66,0.57,0.53],white);
    const blinkAt = time % 5.4;
    const blink = !still && blinkAt > 5.13 ? Math.max(0.08,Math.abs(blinkAt - 5.265) / 0.135) : 1;
    for (const side of [-1,1]) {
      face([side * 0.245,0.055,0.46],[0.185,0.245,0.10],black,side * 0.29);
      face([side * 0.229,0.085,0.548],[0.083,0.108 * blink,0.045],eyeWhite,0,0.25);
      face([side * 0.218 - peek * 0.012,0.073,0.587],[0.059,0.079 * blink,0.026],eyeBlack,0,0.5);
      face([side * 0.218 - 0.018,-0.001 + 0.105 * blink,0.609],[0.023,0.027 * blink,0.009],eyeWhite,0,0.5);
      face([side * 0.105,-0.22,0.515],[0.17,0.125,0.105],white);
    }
    face([0,-0.16,0.627],[0.10,0.069,0.061],eyeBlack,0,0.65);
    face([0,-0.241,0.619],[0.013,0.047,0.012],black);
    for (const side of [-1,1]) {
      for (let point = 0; point < 5; point++) {
        const t = point / 4;
        face([side * (0.012 + t * 0.085),-0.275 - Math.sin(t * Math.PI) * 0.017,0.612],[0.016,0.011,0.009],black);
      }
    }
    if (context) context.putImageData(pixels,0,0);
    return true;
  }
  return { canvas, resize, render, isAvailable: () => available };
}
