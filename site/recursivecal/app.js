/* RecursiveCal test workbench. Synthetic model playback, not a hardware connection.
   Fault presets use known plant parameters. Physics equations remain in physics_v2.js. */
(function () {
  'use strict';
  const P = window.RecursivePhysics;
  const $ = id => document.getElementById(id);
  const DEG = 180 / Math.PI;
  const fmt = (value, places = 1) => Number(value).toFixed(places);
  const faultNames = {
    nominal: 'Reference plant with no injected degradation.',
    hinge_friction: 'Coulomb and viscous hinge resistance increased to 2.5×.',
    motor_fade: 'Motor effectiveness reduced to 55% of nominal.',
    heavy_hatch: 'Hatch mass increased from 25 kg to 33 kg.',
    sensor_bias: 'The angle sensor reports a +4.3° offset.',
    gas_leak: 'Gas spring assistance reduced to 47% of nominal.',
    combined: 'Motor effectiveness 62%, hinge friction 2.5×, mass 29 kg.'
  };
  const presets = {
    nominal: {gain: 1, damping_gain: 1, gravity_comp: 1, friction_ff: 1, sensor_comp: 0},
    hinge_friction: {gain: 1.3, damping_gain: 1, gravity_comp: 1.12, friction_ff: 1.7, sensor_comp: 0},
    motor_fade: {gain: 1.55, damping_gain: 1.16, gravity_comp: 1.2, friction_ff: 1.5, sensor_comp: 0},
    heavy_hatch: {gain: 1.45, damping_gain: 1.15, gravity_comp: 1.25, friction_ff: 1.6, sensor_comp: 0},
    gas_leak: {gain: 1.55, damping_gain: 1.14, gravity_comp: 1.25, friction_ff: 1.5, sensor_comp: 0},
    sensor_bias: {gain: 1, damping_gain: 1, gravity_comp: 1, friction_ff: 1, sensor_comp: .075},
    combined: {gain: 1.55, damping_gain: 1.16, gravity_comp: 1.3, friction_ff: 2, sensor_comp: 0}
  };
  const thresholds = {mean_tracking_error_deg: 5, absolute_final_error_deg: 2, sampled_peak_current_A_each: 9.5};
  let scene = null;
  try {
    scene = new window.PhysicalRenderer($('scene'));
  } catch (error) {
    $('unsupported').hidden = false;
    console.warn('CAD rendering unavailable; simulation controls remain usable.', error);
  }
  const state = {
    fault: 'combined', controller: 'factory', time: 3.25, playing: false,
    preview: true, compare: false, modified: false, source: 'factory-copy',
    signal: 'angle', speed: 1, panel: 'workbench', labels: false,
    cal: {...P.factory}, factoryRun: null, tunedRun: null, last: 0
  };
  window.__recursivecal = {scene, physics: P, state};
  let animation = null;
  let toastTimeout = null;

  function interpolate(frames, time) {
    if (time <= 0) return frames[0];
    if (time >= frames[frames.length - 1].t) return frames[frames.length - 1];
    let lo = 0, hi = frames.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t < time) lo = mid; else hi = mid;
    }
    const a = frames[lo], b = frames[hi], ratio = (time - a.t) / (b.t - a.t);
    const frame = {};
    for (const key of Object.keys(a)) frame[key] = a[key] * (1 - ratio) + b[key] * ratio;
    return frame;
  }
  function activeRun() { return state.controller === 'factory' ? state.factoryRun : state.tunedRun; }
  function scenarioLabel() { return $('faultSelect').selectedOptions[0].textContent; }
  function toast(message) {
    clearTimeout(toastTimeout);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function syncControls() {
    const control = state.controller === 'factory' ? P.factory : state.cal;
    for (const [input, output, key] of [
      ['gainInput', 'gainValue', 'gain'],
      ['frictionInput', 'frictionValue', 'friction_ff'],
      ['gravityInput', 'gravityValue', 'gravity_comp']
    ]) {
      $(input).value = control[key];
      $(output).textContent = fmt(control[key], 2) + '×';
    }
    $('dampingValue').textContent = fmt(control.damping_gain, 2) + '×';
    $('sensorValue').textContent = fmt(control.sensor_comp * DEG, 2) + '°';
    const label = state.controller === 'factory' ? 'Factory' : 'Modified';
    $('controllerTag').textContent = label;
    $('monitorController').textContent = label;
    document.querySelectorAll('[data-controller]').forEach(button => {
      const active = button.dataset.controller === state.controller;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('compareBtn').classList.toggle('active', state.compare);
    $('compareBtn').setAttribute('aria-pressed', String(state.compare));
    $('compareBtn').querySelector('span').textContent = state.compare ? 'Comparing' : 'Compare';
    $('compareHalf').hidden = !state.compare;
    const both = state.compare;
    const responseName = both || state.controller === 'factory' ? 'Factory' : 'Modified';
    $('responseLegend').innerHTML = `<i class="${responseName === 'Factory' ? 'factory' : 'modified'}"></i>${responseName}`;
    $('baselineLegend').hidden = !both;
    $('targetLegend').hidden = state.signal !== 'angle';
    const descriptions = {angle: 'Opening angle · degrees', current: 'Motor current · A per actuator', torque: 'Motor torque · Nm at hinge'};
    $('traceDescription').textContent = descriptions[state.signal];
    $('plot').setAttribute('aria-label', descriptions[state.signal] + '. Click or use arrow keys to inspect time.');
    document.querySelectorAll('[data-signal]').forEach(button => {
      const active = button.dataset.signal === state.signal;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function syncPlant() {
    const plant = {...P.nominal, ...P.plants[state.fault]};
    $('faultInfo').textContent = faultNames[state.fault];
    $('faultInfo').classList.toggle('nominal', state.fault === 'nominal');
    $('scenarioBadge').textContent = scenarioLabel();
    $('scenarioBadge').classList.toggle('nominal', state.fault === 'nominal');
    $('plantMass').innerHTML = `${fmt(plant.hatch_mass, 0)} <span>kg</span>`;
    $('plantMotor').innerHTML = `${fmt(plant.motor_eff * 100, 0)} <span>%</span>`;
    $('plantFriction').innerHTML = `${fmt(plant.friction_factor, 2)}<span>×</span>`;
    $('plantGas').innerHTML = `${fmt(plant.gas_factor * 100, 0)} <span>%</span>`;
  }
  function refresh() {
    state.factoryRun = P.simulate(P.plants[state.fault], P.factory);
    state.tunedRun = P.simulate(P.plants[state.fault], state.cal);
    const a = state.factoryRun.metrics, b = state.tunedRun.metrics;
    $('resultSummary').innerHTML = `<strong>Factory</strong> ${fmt(a.mae_deg, 2)}° MAE` +
      (state.modified ? ` <span aria-hidden="true">·</span> <strong>Modified</strong> ${fmt(b.mae_deg, 2)}° MAE` : '') +
      ` <span aria-hidden="true">·</span> ${state.factoryRun.frames.length} samples / cycle`;
    syncControls();
    renderResults();
    render();
  }
  function renderResults() {
    const a = state.factoryRun.metrics, b = state.tunedRun.metrics;
    $('resultScenario').textContent = `${scenarioLabel()} · ${fmt(P.T_MAX, 2)} s opening cycle`;
    $('factoryMae').innerHTML = `${fmt(a.mae_deg, 2)}<small>deg MAE</small>`;
    $('modifiedMae').innerHTML = `${fmt(b.mae_deg, 2)}<small>deg MAE</small>`;
    const reduction = a.mae_deg > 0 ? 100 * (a.mae_deg - b.mae_deg) / a.mae_deg : null;
    $('improvement').innerHTML = reduction === null ? 'N/A' : `${fmt(Math.abs(reduction), 1)}<small>% ${reduction < 0 ? 'higher' : 'lower'}</small>`;
    $('improvement').parentElement.classList.toggle('worse', reduction < 0);
    $('improvementNote').textContent = !state.modified ? 'Same controller settings' : 'Relative to factory mean error';
    if (reduction === 0) $('improvement').innerHTML = '0.0<small>% change</small>';
    const metrics = [
      ['Mean absolute tracking error', 'mae_deg', 'deg', 3],
      ['Final opening angle', 'final_angle_deg', 'deg', 2],
      ['Final tracking error', 'final_error_deg', 'deg', 2],
      ['Peak motor current / actuator', 'peak_motor_current_A_each', 'A', 2],
      ['Peak |motor| + gas force / strut', 'peak_strut_force_N_each', 'N', 1],
      ['Approx. absolute motor mechanical work', 'motor_mechanical_energy_J_approx', 'J', 1],
      ['Force saturation integration steps', 'force_saturation_steps', 'steps', 0]
    ];
    $('metricsBody').innerHTML = metrics.map(([label, key, unit, places]) =>
      `<tr><td>${label}</td><td>${fmt(a[key], places)}</td><td>${fmt(b[key], places)}</td><td>${unit}</td></tr>`).join('');
    const checks = [
      {label: 'Tracking accuracy', pass: b.mae_deg <= thresholds.mean_tracking_error_deg, value: `${fmt(b.mae_deg, 2)}° MAE / limit 5°`},
      {label: 'Final position', pass: Math.abs(b.final_error_deg) <= thresholds.absolute_final_error_deg, value: `${fmt(Math.abs(b.final_error_deg), 2)}° error / limit 2°`},
      {label: 'Sampled peak current', pass: b.peak_motor_current_A_each <= thresholds.sampled_peak_current_A_each, value: `${fmt(b.peak_motor_current_A_each, 2)} A / limit 9.5 A`}
    ];
    $('checksGrid').innerHTML = checks.map(check => `<div class="check"><div><span class="check-badge${check.pass ? '' : ' fail'}">${check.pass ? 'Within limit' : 'Outside limit'}</span>${check.label}</div><p>${check.value}</p></div>`).join('');
    $('checkSummary').textContent = `Modified · ${checks.filter(check => check.pass).length} / 3 within limits`;
  }
  function render() {
    if (!state.factoryRun) return;
    const a = interpolate(state.factoryRun.frames, state.time);
    const b = interpolate(state.tunedRun.frames, state.time);
    const frame = state.controller === 'factory' ? a : b;
    if (scene && state.panel === 'workbench') scene.draw(state.compare ? a.q : frame.q, b.q, state.compare);
    $('factoryAngle').textContent = fmt(a.q * DEG) + '°';
    $('tunedAngle').textContent = fmt(b.q * DEG) + '°';
    $('angleNow').innerHTML = `${fmt(frame.q * DEG)}<span>deg</span>`;
    $('strokeNow').innerHTML = `${fmt(frame.stroke_m * 1000, 0)}<span>mm</span>`;
    $('currentNow').innerHTML = `${fmt(frame.motor_current_A_each, 2)}<span>A</span>`;
    $('errorNow').innerHTML = `${fmt(frame.motor_torque_Nm_total)}<span>Nm</span>`;
    $('trackingNow').textContent = fmt(frame.error_deg, 2) + '°';
    $('targetNow').textContent = fmt(frame.q_target * DEG) + '°';
    $('angleMeter').style.width = `${P.clamp(frame.q / P.MAX_Q * 100, 0, 100)}%`;
    $('angleMeter').nextElementSibling.style.left = `${P.clamp(frame.q_target / P.MAX_Q * 100, 0, 100)}%`;
    $('timeNow').textContent = fmt(state.time, 2);
    $('scrubber').value = fmt(state.time, 2);
    $('scrubber').setAttribute('aria-valuetext', fmt(state.time, 2) + ' seconds');
    $('callouts').hidden = !state.labels || state.compare || !scene;
    if (state.labels && !state.compare && scene) {
      const hinge = scene.projectPoint([0, 0, P.HINGE_Z]);
      const g = P.geometry(frame.q);
      const strut = scene.projectPoint([g.hatch_point_x_m * .5 - .235, 0, g.hatch_point_z_m * .5 + .585]);
      const width = $('viewport').clientWidth;
      const height = $('viewport').clientHeight;
      $('callHinge').style.transform = `translate(${P.clamp(hinge.x - 12, 8, Math.max(8, width - 100))}px,${P.clamp(hinge.y - 42, 8, Math.max(8, height - 30))}px)`;
      $('callStrut').style.transform = `translate(${P.clamp(strut.x + 12, 8, Math.max(8, width - 100))}px,${P.clamp(strut.y - 18, 8, Math.max(8, height - 30))}px)`;
    }
    if (state.panel === 'workbench') chart();
  }
  function chart() {
    const canvas = $('plot'), rect = canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (width < 10 || height < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const margins = {left: 43, right: width - 15, top: 14, bottom: height - 25};
    const key = {angle: 'q', current: 'motor_current_A_each', torque: 'motor_torque_Nm_total'}[state.signal];
    const scale = state.signal === 'angle' ? DEG : 1;
    let low = 0, high = state.signal === 'angle' ? 90 : 10;
    if (state.signal === 'torque') {
      const values = [...state.factoryRun.frames, ...state.tunedRun.frames].map(frame => frame[key]);
      low = Math.floor(Math.min(0, ...values) / 25) * 25;
      high = Math.ceil(Math.max(25, ...values) / 25) * 25;
    } else if (state.signal === 'current') {
      high = Math.max(10, Math.ceil(Math.max(...state.factoryRun.frames.map(frame => frame[key]), ...state.tunedRun.frames.map(frame => frame[key]))));
    }
    const x = time => margins.left + time / P.T_MAX * (margins.right - margins.left);
    const y = value => margins.bottom - (value - low) / (high - low) * (margins.bottom - margins.top);
    ctx.font = '11px ui-monospace, monospace';
    ctx.lineWidth = .7; ctx.textAlign = 'right';
    for (let index = 0; index <= 3; index++) {
      const value = low + (high - low) * index / 3, yy = y(value);
      ctx.strokeStyle = '#e6ecf4'; ctx.beginPath(); ctx.moveTo(margins.left, yy); ctx.lineTo(margins.right, yy); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.fillText(fmt(value, state.signal === 'current' ? 1 : 0), margins.left - 10, yy + 3);
    }
    ctx.textAlign = 'center';
    for (const time of [0, 1, 2, 3, 4, 5, 6]) {
      if (width < 450 && time % 2) continue;
      const xx = x(time);
      ctx.strokeStyle = '#f0f3f8'; ctx.beginPath(); ctx.moveTo(xx, margins.top); ctx.lineTo(xx, margins.bottom); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.fillText(time + '.0', xx, height - 8);
    }
    ctx.textAlign = 'right'; ctx.fillStyle = '#64748b'; ctx.fillText('s', margins.right, height - 8);
    const draw = (frames, property, factor, color, dash = false) => {
      ctx.strokeStyle = color; ctx.lineWidth = dash ? 1.4 : 2; ctx.setLineDash(dash ? [4, 4] : []); ctx.beginPath();
      frames.forEach((frame, index) => index ? ctx.lineTo(x(frame.t), y(frame[property] * factor)) : ctx.moveTo(x(frame.t), y(frame[property] * factor)));
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (state.signal === 'angle') draw(state.factoryRun.frames, 'q_target', DEG, '#7d91af', true);
    if (state.compare) {
      draw(state.factoryRun.frames, key, scale, '#3974db');
      draw(state.tunedRun.frames, key, scale, '#168c79');
    } else draw(activeRun().frames, key, scale, state.controller === 'factory' ? '#3974db' : '#168c79');
    const cursor = x(state.time);
    ctx.strokeStyle = '#bbcbe0'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cursor, margins.top - 5); ctx.lineTo(cursor, margins.bottom); ctx.stroke(); ctx.setLineDash([]);
    const point = interpolate(activeRun().frames, state.time);
    ctx.beginPath(); ctx.arc(cursor, y(point[key] * scale), 3, 0, 2 * Math.PI);
    ctx.fillStyle = state.controller === 'factory' ? '#3974db' : '#168c79'; ctx.fill();
    const label = fmt(state.time, 2) + ' s';
    const labelWidth = ctx.measureText(label).width + 12;
    const labelX = P.clamp(cursor - labelWidth / 2, margins.left, Math.max(margins.left, margins.right - labelWidth));
    ctx.fillStyle = '#f0f5fd'; ctx.fillRect(labelX, 0, labelWidth, 14);
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b8db9'; ctx.fillText(label, labelX + labelWidth / 2, 10);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function updatePlay() {
    const status = state.playing ? 'Running' : state.preview ? 'Preview' : state.time >= P.T_MAX ? 'Complete' : state.time > 0 ? 'Paused' : 'Ready';
    $('testState').textContent = status;
    $('testState').dataset.state = status.toLowerCase();
    $('playLabel').textContent = state.playing ? 'Pause test' : state.time >= P.T_MAX ? 'Replay test' : !state.preview && state.time > 0 ? 'Resume' : 'Run test';
    $('playSymbol').textContent = state.playing ? 'Ⅱ' : '▶';
    $('overlayPlay').textContent = state.playing ? 'Ⅱ' : '▶';
    $('overlayPlay').setAttribute('aria-label', state.playing ? 'Pause simulation playback' : 'Play simulation');
  }
  function stop() {
    state.playing = false;
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
  }
  function play() {
    if (state.playing) stop();
    else {
      if (state.preview || state.time >= P.T_MAX) state.time = 0;
      state.preview = false; state.playing = true; state.last = performance.now();
      animation = requestAnimationFrame(tick);
    }
    updatePlay(); render();
  }
  function tick(now) {
    animation = null;
    if (!state.playing) return;
    const delta = Math.min(.1, Math.max(0, (now - state.last) / 1000));
    state.time = Math.min(P.T_MAX, state.time + delta * state.speed);
    state.last = now;
    if (state.time >= P.T_MAX) { stop(); updatePlay(); }
    render();
    if (state.playing) animation = requestAnimationFrame(tick);
  }
  function reset() {
    stop(); state.time = 0; state.preview = false;
    updatePlay(); render();
  }
  function scrub(time) {
    stop(); state.preview = false; state.time = P.clamp(time, 0, P.T_MAX);
    updatePlay(); render();
  }
  function applyPreset(announce = true) {
    stop(); state.cal = {...P.factory, ...presets[state.fault]};
    state.modified = true; state.source = 'known-fault'; state.controller = 'tuned';
    state.preview = false; state.time = 0;
    refresh(); updatePlay();
    if (announce) toast('Modified preset applied using the selected synthetic fault.');
  }
  function resize() {
    if (state.panel !== 'workbench') return;
    if (scene) scene.resize();
    render();
  }
  function showPanel(name) {
    state.panel = name;
    $('workbench').hidden = name !== 'workbench';
    $('results').hidden = name !== 'results';
    document.querySelectorAll('[data-panel]').forEach(button => {
      const active = button.dataset.panel === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (name === 'workbench') requestAnimationFrame(resize);
    else renderResults();
  }
  function download(name, content, mime) {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCSV() {
    const header = ['scenario', 'controller', 'time_s', 'command_deg', 'angle_deg', 'angular_speed_rad_s', 'strut_length_m', 'stroke_mm', 'motor_current_A_each', 'motor_force_N_each', 'motor_torque_Nm_total', 'gas_force_N_each', 'tracking_error_deg'];
    const rows = [header.join(',')];
    for (const [controller, run] of [['factory', state.factoryRun], ['modified', state.tunedRun]]) {
      for (const frame of run.frames) rows.push([state.fault, controller, frame.t, frame.q_target * DEG, frame.q * DEG, frame.w, frame.length_m, frame.stroke_m * 1000, frame.motor_current_A_each, frame.motor_force_N_each, frame.motor_torque_Nm_total, frame.gas_force_N_each, frame.error_deg].map(value => typeof value === 'number' ? fmt(value, 6) : value).join(','));
    }
    download(`recursivecal_${state.fault}_traces.csv`, rows.join('\n') + '\n', 'text/csv;charset=utf-8');
    toast(`Exported ${state.factoryRun.frames.length * 2} trace rows for both controllers.`);
  }
  function exportJSON() {
    const report = {
      schema: 'recursivecal-workbench/v0.3', generated_at: new Date().toISOString(),
      scope: 'Synthetic model demonstration. No hardware or OEM measurements. Presets use known faults, not learned RL.',
      scenario: state.fault, plant: {...P.nominal, ...P.plants[state.fault]},
      cycle: {duration_s: P.T_MAX, integration_step_s: P.DT, trace_sampling: 'Every third integration step and the final frame'},
      inspection: {time_s: state.time, controller: state.controller, compare: state.compare, signal: state.signal},
      modified_controller_source: state.source,
      illustrative_thresholds: {...thresholds},
      controllers: {
        factory: {parameters: {...P.factory}, ...state.factoryRun},
        modified: {parameters: {...state.cal}, ...state.tunedRun}
      }
    };
    download(`recursivecal_${state.fault}_run.json`, JSON.stringify(report, null, 2) + '\n', 'application/json');
    toast('Exported the plant, controllers, full traces, and computed metrics.');
  }

  $('faultSelect').addEventListener('change', event => {
    if (!(event.target.value in P.plants)) return;
    stop(); state.fault = event.target.value; state.cal = {...P.factory};
    state.controller = 'factory'; state.modified = false; state.source = 'factory-copy';
    state.compare = false; state.time = 0; state.preview = false;
    syncPlant(); refresh(); updatePlay();
  });
  $('runBtn').addEventListener('click', play);
  $('overlayPlay').addEventListener('click', play);
  $('resetBtn').addEventListener('click', reset);
  $('suggestBtn').addEventListener('click', () => applyPreset());
  document.querySelectorAll('[data-controller]').forEach(button => button.addEventListener('click', () => {
    state.controller = button.dataset.controller;
    syncControls(); render();
  }));
  for (const [id, key] of [['gainInput', 'gain'], ['frictionInput', 'friction_ff'], ['gravityInput', 'gravity_comp']]) {
    $(id).addEventListener('input', event => {
      stop();
      if (state.controller === 'factory') state.cal = {...P.factory};
      state.cal[key] = Number(event.target.value);
      state.controller = 'tuned'; state.modified = true; state.source = 'manual';
      refresh(); updatePlay();
    });
  }
  $('compareBtn').addEventListener('click', () => {
    const compare = !state.compare;
    if (compare && !state.modified) {
      const time = state.time;
      applyPreset(false); state.time = time;
      toast('Comparison loaded with the fault-informed modified preset.');
    }
    state.compare = compare;
    syncControls(); updatePlay(); render();
  });
  function focusView(mechanism) {
    if (scene) scene.setFocus(mechanism ? 'mechanism' : 'vehicle');
    for (const [id, active] of [['viewVehicle', !mechanism], ['viewMech', mechanism]]) {
      $(id).classList.toggle('active', active);
      $(id).setAttribute('aria-pressed', String(active));
    }
    render();
  }
  $('viewVehicle').addEventListener('click', () => focusView(false));
  $('viewMech').addEventListener('click', () => focusView(true));
  $('resetCamera').addEventListener('click', () => { if (scene) scene.setFocus(scene.mechanics ? 'mechanism' : 'vehicle'); render(); });
  $('toggleLabels').addEventListener('click', () => {
    state.labels = !state.labels;
    $('toggleLabels').classList.toggle('active', state.labels);
    $('toggleLabels').setAttribute('aria-pressed', String(state.labels));
    $('toggleLabels').setAttribute('aria-label', state.labels ? 'Hide component labels' : 'Show component labels');
    render();
  });
  $('fullscreenBtn').addEventListener('click', () => {
    const expanded = document.body.classList.toggle('immersive');
    $('fullscreenBtn').setAttribute('aria-pressed', String(expanded));
    $('fullscreenBtn').setAttribute('aria-label', expanded ? 'Exit expanded assembly view' : 'Expand assembly view');
    requestAnimationFrame(resize);
  });
  $('scrubber').max = String(P.T_MAX);
  $('scrubber').addEventListener('input', event => scrub(Number(event.target.value)));
  $('speedSelect').addEventListener('change', event => { state.speed = Number(event.target.value); });
  document.querySelectorAll('[data-signal]').forEach(button => button.addEventListener('click', () => {
    state.signal = button.dataset.signal;
    syncControls(); chart();
  }));
  $('plot').addEventListener('pointerdown', event => {
    const rect = $('plot').getBoundingClientRect();
    if (rect.width > 58) scrub((event.clientX - rect.left - 43) / (rect.width - 58) * P.T_MAX);
  });
  $('plot').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    scrub(event.key === 'Home' ? 0 : event.key === 'End' ? P.T_MAX : state.time + (event.key === 'ArrowRight' ? .05 : -.05));
  });
  $('scene').addEventListener('keydown', event => {
    if (!scene || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', '0'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') scene.yaw -= .1;
    if (event.key === 'ArrowRight') scene.yaw += .1;
    if (event.key === 'ArrowUp') scene.elev = P.clamp(scene.elev + .06, -.05, 1.18);
    if (event.key === 'ArrowDown') scene.elev = P.clamp(scene.elev - .06, -.05, 1.18);
    if (event.key === '+' || event.key === '=') scene.radius = P.clamp(scene.radius / 1.08, 2.65, 11);
    if (event.key === '-') scene.radius = P.clamp(scene.radius * 1.08, 2.65, 11);
    if (event.key === '0') scene.setFocus(scene.mechanics ? 'mechanism' : 'vehicle');
    render();
  });
  $('scene').addEventListener('pointermove', () => { if (state.labels) render(); });
  $('scene').addEventListener('wheel', () => { if (state.labels) render(); }, {passive: true});
  document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.panel)));
  $('viewResultsBtn').addEventListener('click', () => showPanel('results'));
  $('exportBtn').addEventListener('click', exportCSV);
  $('exportJsonBtn').addEventListener('click', exportJSON);
  $('setupToggle').addEventListener('click', () => {
    const expanded = document.body.classList.toggle('setup-open');
    $('setupToggle').setAttribute('aria-expanded', String(expanded));
  });
  $('modelInfoBtn').addEventListener('click', () => $('modelDialog').showModal());
  $('closeModelBtn').addEventListener('click', () => $('modelDialog').close());
  $('modelDialog').addEventListener('click', event => {
    if (event.target !== $('modelDialog')) return;
    const box = $('modelDialog').getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('modelDialog').close();
  });
  window.addEventListener('keydown', event => {
    const editing = document.activeElement && (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY', 'A'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);
    if (event.code === 'Space' && !editing && !$('modelDialog').open) { event.preventDefault(); play(); }
    if (event.code === 'Escape' && document.body.classList.contains('immersive') && !$('modelDialog').open) $('fullscreenBtn').click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) { stop(); updatePlay(); } });
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(resize);
    observer.observe($('viewport')); observer.observe($('plot').parentElement);
  }
  syncPlant(); refresh(); updatePlay();
})();
