import { createPanda3D } from './panda-3d.mjs?v=20261126-3d';

(() => {
  'use strict';

  const history = document.querySelector('#career-history');
  if (!history) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 650px)');
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const make = (tag, attributes = {}, parent) => {
    const element = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    parent?.appendChild(element);
    return element;
  };
  const line = points => points.map(([x, y], index) =>
    `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  ).join(' ');

  const svg = make('svg', {
    class: 'tree-svg', role: 'presentation', 'aria-hidden': 'true', focusable: 'false'
  }, history);
  const defs = make('defs', {}, svg);
  const barkPattern = make('pattern', {
    id: 'bark-tile', patternUnits: 'userSpaceOnUse', width: 242, height: 367
  }, defs);
  make('image', {
    href: new URL('./assets/timeline-bark.jpg', import.meta.url).href,
    width: 242, height: 367, preserveAspectRatio: 'none'
  }, barkPattern);
  const softShadow = make('filter', {
    id: 'soft-shadow', x: '-45%', y: '-45%', width: '190%', height: '190%'
  }, defs);
  make('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 2.1 }, softShadow);
  const pandaShadow = make('filter', {
    id: 'panda-shadow', x: '-35%', y: '-35%', width: '170%', height: '170%'
  }, defs);
  make('feDropShadow', {
    dx: 0.5, dy: 2, stdDeviation: 1.5, 'flood-color': '#27302a', 'flood-opacity': 0.19
  }, pandaShadow);
  const fur = make('radialGradient', { id: 'panda-fur', cx: '40%', cy: '28%', r: '80%' }, defs);
  for (const [offset, color] of [['0%', '#fffef9'], ['68%', '#f3f4ed'], ['100%', '#d7ddd5']]) {
    make('stop', { offset, 'stop-color': color }, fur);
  }

  const branches = make('g', {}, svg);
  const ground = make('g', {}, svg);
  const groundPatch = make('ellipse', { class: 'panda-ground' }, ground);
  const footShadow = make('ellipse', { class: 'panda-foot-shadow' }, ground);
  const tree = make('g', { class: 'panda-tree' }, svg);
  const trunkShadow = make('path', { class: 'tree-trunk-shadow' }, tree);
  const trunk = make('path', { class: 'tree-trunk' }, tree);
  const bark = make('g', {}, tree);
  const trunkLight = make('path', { class: 'tree-trunk-light' }, tree);
  const roots = make('g', {}, tree);
  const panda = make('g', { class: 'panda-actor', 'data-pose': 'climbing' }, svg);
  const pose = make('g', {}, panda);

  // A small illustrated panda. Separate limbs let its paws grip and its feet waddle.
  make('circle', { class: 'panda-white', cx: 23, cy: 23, r: 6 }, pose);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = make('g', {}, pose);
    make('ellipse', { class: 'panda-black', cx: 0, cy: 0, rx: 10.5, ry: 14 }, leg);
    make('ellipse', { class: 'panda-pad', cx: side, cy: 7, rx: 5.4, ry: 3.3 }, leg);
    for (const x of [-4, 0, 4]) {
      make('circle', { class: 'panda-toe', cx: x, cy: 10.5, r: 1 }, leg);
    }
    legs.push(leg);
  }
  make('ellipse', { class: 'panda-black', cx: 0, cy: 10, rx: 25, ry: 28 }, pose);
  make('ellipse', { class: 'panda-white', cx: 0, cy: 15, rx: 19.5, ry: 22 }, pose);
  make('path', {
    class: 'panda-belly-glint', d: 'M-11 8 Q-15 19 -7 26'
  }, pose);

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = make('g', {}, pose);
    make('path', {
      class: 'panda-black',
      d: side < 0
        ? 'M1 -5 C-8 -9 -14 -3 -14 7 C-14 17 -8 23 -2 19 C4 17 5 10 4 2 Z'
        : 'M-1 -5 C8 -9 14 -3 14 7 C14 17 8 23 2 19 C-4 17 -5 10 -4 2 Z'
    }, arm);
    make('ellipse', { class: 'panda-pad', cx: side * 6, cy: 13, rx: 4.3, ry: 3 }, arm);
    arms.push(arm);
  }

  const head = make('g', { class: 'panda-head' }, pose);
  for (const side of [-1, 1]) {
    make('circle', { class: 'panda-black', cx: side * 21, cy: -35, r: 10 }, head);
    make('circle', { class: 'panda-ear-inner', cx: side * 21, cy: -35, r: 5.7 }, head);
  }
  make('path', {
    class: 'panda-white',
    d: 'M-29 -22 C-29 -40 -15 -45 0 -44 C15 -45 29 -40 29 -22 C32 -6 22 5 0 6 C-22 5 -32 -6 -29 -22 Z'
  }, head);
  for (const side of [-1, 1]) {
    make('ellipse', {
      class: 'panda-eye-patch', cx: side * 12.5, cy: -20, rx: 8.1, ry: 10.6,
      transform: `rotate(${side * 23} ${side * 12.5} -20)`
    }, head);
    make('ellipse', { class: 'panda-cheek', cx: side * 21, cy: -8.5, rx: 4.7, ry: 2.5 }, head);
  }
  const eyeLine = make('g', { transform: 'translate(0 -20)' }, head);
  const eyes = make('g', {}, eyeLine);
  for (const side of [-1, 1]) {
    make('ellipse', { fill: '#fffef9', cx: side * 11.2, cy: 0, rx: 3.6, ry: 4.7 }, eyes);
    make('ellipse', { fill: '#1e2828', cx: side * 10.7, cy: 0.5, rx: 2.3, ry: 3.2 }, eyes);
    make('circle', { fill: '#ffffff', cx: side * 10.7 - 0.8, cy: -1, r: 1.05 }, eyes);
  }
  make('ellipse', { fill: '#fffdf5', cx: 0, cy: -5, rx: 11, ry: 8 }, head);
  make('path', {
    fill: '#29312f', d: 'M-5 -9 Q0 -12 5 -9 Q6 -6 0 -3 Q-6 -6 -5 -9 Z'
  }, head);
  make('path', { class: 'panda-smile', d: 'M0 -3v3M0 0q-3 4-6 1M0 0q3 4 6 1' }, head);

  // The SVG character remains available if a device cannot create a 3D context.
  const character = createPanda3D(history);

  let width = 0;
  let height = 0;
  let center = 153;
  let groundY = 0;
  let endY = 0;
  let scale = 0.92;
  let current = 50;
  let target = 50;
  let historyTop = 0;
  let groundBlend = 0;
  let storyTime = 0;
  let renderSize = 128;
  let lastTime = 0;
  let raf = 0;
  let visible = false;
  let initialized = false;
  let behindTree = false;

  const treeX = y => center + 2.8 * Math.sin(y / 232) + 2.2 * Math.sin(y / 71);

  // A short, continuous story: climb, hide, peek from both sides, emerge and slide.
  const moments = [
    [0,    0,    0,  1, -0.16,  0, 0, 'climbing'],
    [2.2,  .25,-18,  1,  0.18,  0, 0, 'climbing'],
    [3.5,  1,  -24, .15,-0.85,  0, 0, 'going-behind'],
    [5,    .5, -32, -1, -2.70,  0, 0, 'hiding'],
    [5.8,  0,  -38, -1, -3.14,  0, 0, 'hiding'],
    [6.4,  0,  -38, -1,  0,     0, 0, 'peeking-right'],
    [7.8,  .9, -40, -1, -0.27,  1, 1, 'peeking-right'],
    [9.8,  .9, -40, -1, -0.27,  1, 1, 'hiding'],
    [11,   0,  -33, -1,  0.2,   0, 0, 'peeking-left'],
    [12.4,-.9, -29, -1,  0.27, -1, 1, 'peeking-left'],
    [14.3,-.9, -29, -1,  0.27, -1, 1, 'coming-out'],
    [15.6,-1,  -22, .15, 1.0,   0, 0, 'coming-out'],
    [17,  -.3, -12,  1,  0.2,   0, 0, 'climbing-up'],
    [18.5, 0,  -39,  1, -0.2,   0, 0, 'sliding-down'],
    [20,   .12,  0,  1,  0.2,   0, 0, 'resting'],
    [23,   0,    0,  1, -0.16,  0, 0, 'climbing']
  ];
  function story(time) {
    const local = time % 23;
    const index = moments.findIndex((moment, i) => i < moments.length - 1 && local < moments[i + 1][0]);
    const a = moments[Math.max(0,index)], b = moments[Math.max(0,index) + 1];
    const progress = (local - a[0]) / (b[0] - a[0]);
    const ease = (1 - Math.cos(progress * Math.PI)) / 2;
    const values = a.slice(1,7).map((value,i) => value + (b[i + 1] - value) * ease);
    return { x:values[0], lift:values[1], depth:values[2], yaw:values[3], peek:values[4], wave:values[5], mode:a[7] };
  }

  function updateTarget() {
    historyTop = history.getBoundingClientRect().top;
    target = clamp(innerHeight * 0.6 - historyTop, 50, endY);
  }

  function build() {
    const bounds = history.getBoundingClientRect();
    const first = history.querySelector('.position-content').getBoundingClientRect();
    const nextWidth = Math.round(bounds.width);
    const nextHeight = Math.max(300, Math.round(history.scrollHeight));
    if (initialized && nextWidth === width && nextHeight === height) return;

    width = nextWidth;
    height = nextHeight;
    scale = mobile.matches ? 0.56 : 0.92;
    center = mobile.matches ? 34 : first.left - bounds.left - 64;
    renderSize = mobile.matches ? 80 : 128;
    character?.resize(renderSize);
    groundY = height - 21;
    endY = groundY - renderSize * 0.37;
    const radius = mobile.matches ? 12.5 : 23;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const left = [];
    const right = [];
    for (let y = 8; y <= groundY - 5; y += 8) {
      const x = treeX(y);
      const edge = (Math.sin(y * 0.111) * 1.7 + Math.sin(y * 0.31) * 0.9) * (mobile.matches ? 0.6 : 1);
      left.push([x - radius + edge, y]);
      right.push([x + radius + edge * 0.75, y]);
    }
    const silhouette = `${line(left)} ${line(right.reverse()).replace(/^M/, 'L')} Z`;
    trunk.setAttribute('d', silhouette);
    trunkShadow.setAttribute('d', silhouette);
    trunkShadow.setAttribute('transform', 'translate(3 2)');
    const highlights = [];
    for (let y = 10; y < groundY - 8; y += 8) {
      highlights.push([treeX(y) - radius * 0.48, y]);
    }
    trunkLight.setAttribute('d', line(highlights));

    branches.replaceChildren();
    bark.replaceChildren();
    roots.replaceChildren();
    for (const [index, article] of [...history.querySelectorAll('article.position')].entries()) {
      const y = article.getBoundingClientRect().top - bounds.top + 19;
      const x = treeX(y);
      const endpoint = mobile.matches ? 67 : first.left - bounds.left - 16;
      const d = `M${x} ${y} C${x + 15} ${y - 15} ${endpoint - 21} ${y - 5} ${endpoint} ${y - 4}`;
      make('path', { class: 'tree-limb', d }, branches);
      make('path', { class: 'tree-limb-shine', d }, branches);
      if (index % 2 === 0) {
        for (const [dx, dy, angle, light] of [[-7, -8, -22, false], [5, 7, 39, true]]) {
          make('ellipse', {
            class: light ? 'tree-leaf-light' : 'tree-leaf', cx: endpoint + dx, cy: y + dy,
            rx: mobile.matches ? 2.8 : 4.1, ry: mobile.matches ? 6 : 9,
            transform: `rotate(${angle} ${endpoint + dx} ${y + dy})`
          }, branches);
        }
      }
    }
    for (let y = 25; y < groundY - 20; y += 32) {
      const x = treeX(y);
      const offset = Math.sin(y * 0.097 + 12.13) * Math.sin(y * 0.173 + 7.21) * 6;
      make('path', {
        class: 'tree-bark-rift', d: `M${x + offset - 4} ${y - 12} Q${x + offset - 8} ${y} ${x + offset - 4} ${y + 11}`
      }, bark);
      if (y % 3 < 1.5) make('path', {
        class: 'tree-bark-glint', d: `M${x + 9} ${y - 13} Q${x + 13} ${y} ${x + 9} ${y + 15}`
      }, bark);
    }
    const baseX = treeX(groundY - 8);
    for (const side of [-1, 1]) {
      make('path', {
        class: 'panda-tree-root',
        d: `M${baseX + side * radius * 0.6} ${groundY - 21} Q${baseX + side * radius * 0.7} ${groundY - 3} ${baseX + side * radius * 1.35} ${groundY + 1}`
      }, roots);
    }
    groundPatch.setAttribute('cx', baseX);
    groundPatch.setAttribute('cy', groundY + 3);
    groundPatch.setAttribute('rx', mobile.matches ? 29 : 53);
    groundPatch.setAttribute('ry', mobile.matches ? 7 : 10);

    updateTarget();
    current = reduced.matches ? endY : initialized ? clamp(current, 50, endY) : target;
    initialized = true;
    paint(performance.now(), 0);
    schedule();
  }

  function paint(time, speed) {
    const motion = reduced.matches
      ? { x:0, lift:0, depth:1, yaw:-0.16, peek:0, wave:0, mode:'resting' }
      : story(storyTime);
    const step = current / (mobile.matches ? 11 : 17) + storyTime * 2.3;
    const orbitRadius = mobile.matches ? 11 : 20;
    const x = treeX(current) + motion.x * orbitRadius;
    const y = clamp(current + motion.lift * (mobile.matches ? 0.55 : 1), 50, endY)
      + motion.depth * 3 * groundBlend;
    const tilt = Math.sin(step) * 2 * (1 - Math.abs(motion.peek)) - motion.peek * 8;
    const breath = reduced.matches ? 1 : 1 + Math.sin(time / 900) * 0.008;
    const move = reduced.matches ? 0 : clamp(speed / 1.5, 0.35, 1);
    const nextBehind = motion.depth < 0;
    if (nextBehind !== behindTree) {
      behindTree = nextBehind;
      if (behindTree) svg.insertBefore(panda, tree);
      else svg.appendChild(panda);
    }
    panda.setAttribute('data-pose', motion.mode);
    panda.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})`);
    pose.setAttribute('transform', `rotate(${tilt.toFixed(2)}) scale(1 ${breath.toFixed(4)})`);
    head.setAttribute('transform', `rotate(${(-motion.peek * 10).toFixed(2)} 0 -19)`);

    if (character) {
      const rendered = character.render({
        time:storyTime, yaw:motion.yaw, lean:tilt * Math.PI / 180,
        gait:reduced.matches ? 0 : step,
        grip:1 - groundBlend * 0.7, peek:motion.peek,
        wave:motion.wave * (mobile.matches ? 0.65 : 1),
        sit:groundBlend * (motion.mode === 'resting' ? 1 : 0), still:reduced.matches
      });
      panda.style.display = rendered ? 'none' : '';
      character.canvas.style.display = rendered ? 'block' : 'none';
      character.canvas.dataset.pose = motion.mode;
      character.canvas.dataset.behindTree = String(nextBehind);
      character.canvas.style.zIndex = nextBehind ? '1' : '3';
      character.canvas.style.transform = `translate3d(${(x-renderSize/2).toFixed(2)}px,${(y-renderSize/2).toFixed(2)}px,0)`;
    }

    for (const [index, side] of [-1, 1].entries()) {
      const gait = Math.sin(step + index * Math.PI) * move;
      arms[index].setAttribute('transform', `translate(${side * 20} ${-4 + gait * 3}) rotate(${side * -22 * (1 - groundBlend) + gait * 15})`);
      legs[index].setAttribute('transform', `translate(${side * 13} ${31 - gait * 3.5}) rotate(${side * -8 + gait * 10})`);
    }
    const blinkTime = time % 4700;
    const blink = !reduced.matches && blinkTime > 4450 ? Math.max(0.08, Math.abs(blinkTime - 4575) / 125) : 1;
    eyes.setAttribute('transform', `scale(1 ${blink.toFixed(3)})`);
    footShadow.setAttribute('cx', x);
    footShadow.setAttribute('cy', groundY + motion.depth * 3);
    footShadow.setAttribute('rx', 23 * scale);
    footShadow.setAttribute('ry', 5 * scale);
    footShadow.style.opacity = String(reduced.matches ? 0.14 : groundBlend * (motion.lift < -15 ? 0.055 : 0.14));
  }

  function frame(time) {
    raf = 0;
    if (reduced.matches || document.hidden || !visible) return;
    const elapsed = Math.min(1000, lastTime ? time - lastTime : 16.7);
    const dt = Math.min(80, elapsed);
    lastTime = time;
    const previous = current;
    current += (target - current) * (1 - Math.exp(-dt / 85));
    if (Math.abs(target - current) < 0.2) current = target;
    const atBase = target >= endY - 1 && current >= endY - 2;
    groundBlend += ((atBase ? 1 : 0) - groundBlend) * (1 - Math.exp(-dt / 350));
    storyTime += elapsed / 1000;
    paint(time, Math.abs(current - previous));
    const pandaInView = historyTop + current > -100 && historyTop + current < innerHeight + 100;
    if (pandaInView || Math.abs(target - current) > 0.2) schedule();
  }

  function schedule() {
    if (!raf && visible && !reduced.matches && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  }
  function onScroll() {
    updateTarget();
    schedule();
  }
  const resizeObserver = new ResizeObserver(build);
  resizeObserver.observe(history);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { updateTarget(); schedule(); }
    else stop();
  }, { rootMargin: '100px 0px' });
  visibilityObserver.observe(history);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { build(); updateTarget(); schedule(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { updateTarget(); schedule(); }
  });
  reduced.addEventListener('change', () => {
    stop();
    groundBlend = 0;
    storyTime = 0;
    updateTarget();
    current = reduced.matches ? endY : target;
    paint(performance.now(), 0);
    schedule();
  });
  build();
})();
