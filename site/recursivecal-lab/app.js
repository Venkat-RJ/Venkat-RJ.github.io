/* RecursiveCal local workbench. No external scripts or persistent browser storage. */
"use strict";

const RUN_SCHEMA = "recursivecal.run/1";
const EXPERIMENT_SCHEMA = "recursivecal.experiment.v1";
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const TRACE_FIELDS = ["time_s", "angle_rad", "target_angle_rad", "velocity_rad_s", "motor_force_N_each", "gas_force_N_each", "motor_torque_Nm", "stroke_m"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRun(run) {
  if (!isRecord(run) || run.schema_version !== RUN_SCHEMA) throw new Error(`Expected schema_version ${RUN_SCHEMA}.`);
  if (run.model_id !== "recursivecal.si-liftgate/1") throw new Error("This view accepts the SI liftgate model. Import diagnostic experiment summaries in Evidence.");
  if (!Array.isArray(run.trace) || run.trace.length < 1 || run.trace.length > 250001) throw new Error("The run must contain between 1 and 250001 trace samples.");
  let previous = -Infinity;
  for (let index = 0; index < run.trace.length; index += 1) {
    const row = run.trace[index];
    if (!isRecord(row)) throw new Error(`Trace sample ${index + 1} must be an object.`);
    for (const field of TRACE_FIELDS) {
      if (typeof row[field] !== "number" || !Number.isFinite(row[field])) throw new Error(`Trace sample ${index + 1}: ${field} must be a finite number.`);
    }
    if (row.time_s < 0 || row.time_s <= previous) throw new Error("Trace times must be nonnegative and strictly increasing.");
    previous = row.time_s;
  }
  if (!isRecord(run.metrics) || !isRecord(run.parameters) || !isRecord(run.provenance)) throw new Error("The run is missing metrics, parameters or provenance.");
  for (const key of ["tracking_rmse_deg", "peak_speed_rad_s", "mechanical_work_abs_J", "force_saturation_fraction", "completed_duration_s"]) {
    if (typeof run.metrics[key] !== "number" || !Number.isFinite(run.metrics[key])) throw new Error(`Metric ${key} must be a finite number.`);
  }
  if (typeof run.metrics.termination !== "string") throw new Error("The run must record its termination status.");
  for (const [name, value] of Object.entries(run.parameters)) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Model parameter ${name} must be a finite number.`);
  }
  if (run.events !== undefined && (!Array.isArray(run.events) || run.events.some(event => !isRecord(event) || typeof event.type !== "string" || typeof event.time_s !== "number" || !Number.isFinite(event.time_s)))) throw new Error("Events must contain a type and finite time_s.");
  return run;
}

function validateEvidence(value) {
  if (!isRecord(value) || value.schema_version !== EXPERIMENT_SCHEMA) throw new Error(`Expected schema_version ${EXPERIMENT_SCHEMA}. Choose the experiment's summary.json.`);
  if (!isRecord(value.results) || Object.keys(value.results).length === 0) throw new Error("The experiment summary has no cohort results.");
  for (const [cohort, record] of Object.entries(value.results)) {
    if (!isRecord(record) || !isRecord(record.policies)) throw new Error(`Cohort ${cohort} is missing its policies.`);
    for (const [policy, result] of Object.entries(record.policies)) {
      if (!isRecord(result) || typeof result.mean_reward !== "number" || !Number.isFinite(result.mean_reward)) throw new Error(`Cohort ${cohort}, policy ${policy}: mean_reward must be finite.`);
    }
  }
  return value;
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+@]/.test(text) || (/^-/.test(text) && !Number.isFinite(Number(text)))) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function traceToCsv(run) {
  validateRun(run);
  const columns = Object.keys(run.trace[0]).filter(key => typeof run.trace[0][key] === "number" || typeof run.trace[0][key] === "boolean");
  return [columns.map(csvCell).join(","), ...run.trace.map(row => columns.map(key => csvCell(row[key])).join(","))].join("\n") + "\n";
}

function humanize(value) {
  return String(value).replaceAll("_", " ").replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

function numeric(value, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { validateRun, validateEvidence, traceToCsv, csvCell, numeric };
}

if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const state = { connected: false, capabilities: null, parameters: {}, parameterProvenance: null, fittedBaseline: null, run: null, pinned: null, fit: null, replay: null, evidence: null, index: 0, frame: null, lastFrame: null, playTime: 0, sequence: 0 };
  const NS = "http://www.w3.org/2000/svg";
  const scenarios = {
    open: "A smooth opening command followed by a hold. Feedforward uses the nominal controller model.",
    close: "Start at the open stop and command a smooth closing motion.",
    passive_hold: "Start fully open with the motor disabled. Inspect the assumed static force balance and any descent.",
    power_loss: "Open the hatch, then disable motor demand at the configured power-loss time. Residual force decays with actuator lag."
  };

  function setText(id, value) { $(id).textContent = String(value); }
  function message(text, kind = "info", id = "globalMessage") {
    const element = $(id);
    element.textContent = text;
    element.className = (id === "globalMessage" ? "message" : "inline-message") + (kind !== "info" ? " " + kind : "");
    element.hidden = false;
  }
  function clearMessage(id = "globalMessage") { $(id).hidden = true; $(id).textContent = ""; }
  function create(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function svg(tag, attributes, text) {
    const element = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes || {})) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function download(name, value, type) {
    const blob = new Blob([value], { type });
    const url = URL.createObjectURL(blob);
    const anchor = create("a"); anchor.href = url; anchor.download = name; anchor.hidden = true;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadJson(name, value) { download(name, JSON.stringify(value, null, 2) + "\n", "application/json"); }
  async function fileText(file) {
    if (!file) throw new Error("Choose a file first.");
    if (file.size > MAX_FILE_BYTES) throw new Error("The file is larger than the 32 MiB workbench limit. Use the CLI for larger datasets.");
    return file.text();
  }
  async function api(path, body) {
    const response = await fetch(path, body === undefined ? { headers: { Accept: "application/json" } } : { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("This page is not connected to the RecursiveCal API. Start the local workbench with recursivecal serve.");
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || value.detail || `The server returned HTTP ${response.status}.`);
    return value;
  }
  function switchView(name) {
    if (!["simulation", "measurements", "evidence"].includes(name)) name = "simulation";
    document.querySelectorAll(".workspace-view").forEach(element => { element.hidden = element.id !== "view-" + name; });
    document.querySelectorAll(".nav-button").forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (name !== "simulation") stopPlayback();
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }
  function resetConfiguration() {
    $("simulationForm").reset();
    state.parameterProvenance = null; state.fittedBaseline = null;
    const defaults = state.capabilities?.defaults || {};
    state.parameters = { ...(state.capabilities?.default_parameters || defaults.parameters || {}) };
    for (const input of document.querySelectorAll("[data-param]")) {
      const value = state.parameters[input.dataset.param];
      if (typeof value === "number" && Number.isFinite(value)) input.value = value;
    }
    if (typeof defaults.duration_s === "number") $("duration").value = defaults.duration_s;
    if (typeof defaults.dt_s === "number") $("timestep").value = defaults.dt_s;
    if (typeof defaults.seed === "number") $("seed").value = defaults.seed;
    $("scenarioDescription").textContent = scenarios[$("scenario").value];
  }
  function configuration() {
    if (!$("simulationForm").reportValidity()) throw new Error("Please correct the highlighted simulation settings.");
    const parameters = { ...state.parameters };
    document.querySelectorAll("[data-param]").forEach(input => { parameters[input.dataset.param] = Number(input.value); });
    const duration_s = Number($("duration").value), dt_s = Number($("timestep").value);
    const limit = state.capabilities?.limits?.max_steps || 50000;
    if (duration_s / dt_s > limit) throw new Error(`The local API allows at most ${limit.toLocaleString()} steps. Increase the time step or use a shorter duration.`);
    if (parameters.friction_static_Nm < parameters.friction_coulomb_Nm) throw new Error("Static friction must be at least Coulomb friction.");
    const parameter_provenance = state.parameterProvenance ? { ...state.parameterProvenance } : null;
    if (parameter_provenance && state.fittedBaseline) parameter_provenance.workbench_overrides_after_fit = Object.fromEntries(Object.entries(parameters).filter(([key, value]) => state.fittedBaseline[key] !== value));
    return { parameters, parameter_provenance, duration_s, dt_s, seed: Number($("seed").value), scenario: $("scenario").value, controller: $("controller").value, initial_angle_rad: $("initialAngle").value === "" ? null : Number($("initialAngle").value), initial_velocity_rad_s: Number($("initialVelocity").value), abort_on_limit: $("abortOnLimit").checked };
  }
  async function runSimulation() {
    if (!state.connected) { message("The local API is unavailable. Imported runs can still be inspected and exported.", "warning"); return; }
    let config;
    try { config = configuration(); } catch (error) { message(error.message, "error"); return; }
    clearMessage(); stopPlayback();
    $("runButton").disabled = true; $("runButton").textContent = "Running…";
    setText("runStatus", "Running"); $("runStatus").className = "run-state";
    try {
      const run = validateRun(await api("/api/simulate", config));
      loadRun(run, "Local simulation");
      if (run.metrics.termination !== "completed") message(`Simulation stopped: ${humanize(run.metrics.termination)} at ${numeric(run.metrics.completed_duration_s, 3)} s. Inspect the event record and configured limits.`, "warning");
      else message(`Simulation completed. ${run.trace.length.toLocaleString()} samples are ready for inspection and export.`);
    } catch (error) { message(error.message, "error"); setText("runStatus", "Run failed"); $("runStatus").className = "run-state warning"; }
    finally { $("runButton").disabled = !state.connected; $("runButton").textContent = "▶ Run simulation"; }
  }
  function loadRun(run, label) {
    stopPlayback(); state.run = validateRun(run); state.sequence += 1;
    const config = run.configuration || {};
    state.parameters = { ...run.parameters };
    state.parameterProvenance = isRecord(run.provenance.parameter_provenance) ? { ...run.provenance.parameter_provenance } : null;
    state.fittedBaseline = state.parameterProvenance ? { ...run.parameters } : null;
    for (const input of document.querySelectorAll("[data-param]")) {
      const value = run.parameters[input.dataset.param];
      if (typeof value === "number" && Number.isFinite(value)) input.value = value;
    }
    for (const [key, id] of [["duration_s", "duration"], ["dt_s", "timestep"], ["seed", "seed"]]) if (typeof config[key] === "number") $(id).value = config[key];
    if (Object.hasOwn(scenarios, config.scenario)) $("scenario").value = config.scenario;
    if (["nominal", "disabled"].includes(config.controller)) $("controller").value = config.controller;
    $("initialAngle").value = typeof config.initial_angle_rad === "number" ? config.initial_angle_rad : "";
    $("initialVelocity").value = typeof config.initial_velocity_rad_s === "number" ? config.initial_velocity_rad_s : 0;
    if (typeof config.abort_on_limit === "boolean") $("abortOnLimit").checked = config.abort_on_limit;
    $("scenarioDescription").textContent = scenarios[$("scenario").value];
    const complete = run.metrics.termination === "completed";
    const outcome = complete ? "Completed" : humanize(run.metrics.termination || "termination not recorded");
    setText("runStatus", label.startsWith("Recorded") ? "Recorded · " + outcome : outcome);
    $("runStatus").className = "run-state " + (complete ? "complete" : "warning");
    setText("runIdentity", label + " · " + (config.scenario || "imported"));
    setText("sampleCount", run.trace.length.toLocaleString() + " samples");
    setText("durationReadout", numeric(run.trace.at(-1).time_s, 2) + " s");
    $("scrubber").max = run.trace.length - 1; $("scrubber").disabled = false; $("playbackButton").disabled = run.trace.length < 2;
    for (const id of ["exportRun", "exportTrace", "pinRun"]) $(id).disabled = false;
    $("replayButton").disabled = !state.connected;
    state.replay = null; $("replayResults").hidden = true;
    setText("replayRunLabel", "Current: " + (config.scenario || "imported") + " · " + numeric(run.trace.at(-1).time_s, 2) + " s");
    setText("metricRmse", numeric(run.metrics.tracking_rmse_deg, 3));
    setText("metricSpeed", numeric(run.metrics.peak_speed_rad_s, 3));
    setText("metricWork", numeric(run.metrics.mechanical_work_abs_J, 2));
    setText("metricSaturation", numeric(run.metrics.force_saturation_fraction, 3));
    const provenance = { schema_version: run.schema_version, model_id: run.model_id, provenance: run.provenance, configuration: run.configuration, parameters: run.parameters, controller_parameters: run.controller_parameters, metrics: run.metrics };
    setText("runProvenance", JSON.stringify(provenance, null, 2));
    $("emptyPlots").hidden = true; $("plotGrid").hidden = false;
    renderEvents(); renderPlots(); setSample(run.trace.length - 1);
  }
  function setReadout(id, value, unit, digits) {
    const element = $(id); element.replaceChildren(document.createTextNode(numeric(value, digits)), create("small", unit));
  }
  function setSample(index) {
    if (!state.run) return;
    state.index = Math.max(0, Math.min(state.run.trace.length - 1, Math.round(index)));
    const row = state.run.trace[state.index], angle = row.angle_rad * 180 / Math.PI;
    $("scrubber").value = state.index;
    setText("timeReadout", numeric(row.time_s, 2) + " s");
    setText("schematicAngle", numeric(angle, 1) + "°");
    setReadout("angleValue", angle, "deg", 2);
    setReadout("targetValue", row.target_angle_rad * 180 / Math.PI, "deg", 2);
    setReadout("velocityValue", row.velocity_rad_s, "rad/s", 3);
    setReadout("forceValue", row.motor_force_N_each, "N", 1);
    setReadout("gasValue", row.gas_force_N_each, "N", 1);
    setReadout("strokeValue", row.stroke_m * 1000, "mm", 1);
    $("hatchGroup").setAttribute("transform", `rotate(${-angle} 300 70)`);
    const x = 300 + 120 * Math.sin(row.angle_rad), y = 70 + 120 * Math.cos(row.angle_rad);
    $("strutLine").setAttribute("x2", x); $("strutLine").setAttribute("y2", y);
    $("strutRod").setAttribute("x1", 190 + (x - 190) * 0.5); $("strutRod").setAttribute("y1", 218 + (y - 218) * 0.5);
    $("strutRod").setAttribute("x2", x); $("strutRod").setAttribute("y2", y);
    const arcX = 300 + 42 * Math.sin(row.angle_rad), arcY = 70 + 42 * Math.cos(row.angle_rad);
    $("angleArc").setAttribute("d", `M300 112A42 42 0 ${row.angle_rad > Math.PI ? 1 : 0} 0 ${arcX} ${arcY}`);
    $("mechanism").setAttribute("aria-label", `Illustrative liftgate hinge at ${numeric(angle, 1)} degrees, trace time ${numeric(row.time_s, 2)} seconds.`);
    document.querySelectorAll(".plot-cursor").forEach(line => {
      const xmax = Number(line.dataset.xmax), xmin = Number(line.dataset.xmin);
      const cx = 48 + (row.time_s - xmin) / (xmax - xmin || 1) * 516;
      line.setAttribute("x1", cx); line.setAttribute("x2", cx);
    });
  }
  function renderPlot(id, key, scale = 1, targetKey = null) {
    const element = $(id), trace = state.run.trace;
    const series = [{ rows: trace, key, color: "#087f77", dash: null }];
    if (targetKey) series.push({ rows: trace, key: targetKey, color: "#8d9ba7", dash: "5 4" });
    if (state.pinned) series.push({ rows: state.pinned.trace, key, color: "#9b67b1", dash: "4 3" });
    let low = 0, high = 0, xmax = trace.at(-1).time_s, xmin = trace[0].time_s;
    for (const item of series) for (const row of item.rows) {
      const value = row[item.key] * scale;
      if (Number.isFinite(value)) { low = Math.min(low, value); high = Math.max(high, value); }
      xmax = Math.max(xmax, row.time_s); xmin = Math.min(xmin, row.time_s);
    }
    if (high - low < 1e-8) { high += 1; low -= 0.1; }
    const range = high - low; low -= range * 0.07; high += range * 0.10;
    const X = t => 48 + (t - xmin) / (xmax - xmin || 1) * 516;
    const Y = v => 146 - (v - low) / (high - low) * 128;
    element.replaceChildren();
    for (let tick = 0; tick <= 3; tick += 1) {
      const value = low + (high - low) * tick / 3, y = Y(value);
      element.append(svg("line", { x1: 48, x2: 564, y1: y, y2: y, stroke: "#e7eef2", "stroke-width": 1 }));
      element.append(svg("text", { x: 40, y: y + 4, fill: "#8298a5", "font-size": 11, "text-anchor": "end" }, numeric(value, Math.abs(high - low) < 5 ? 2 : 0)));
    }
    for (let tick = 0; tick <= 4; tick += 1) {
      const t = xmin + (xmax - xmin) * tick / 4;
      element.append(svg("text", { x: X(t), y: 166, fill: "#8298a5", "font-size": 11, "text-anchor": "middle" }, numeric(t, 1)));
    }
    element.append(svg("text", { x: 564, y: 180, fill: "#8298a5", "font-size": 10, "text-anchor": "end" }, "time / s"));
    for (const item of [...series].reverse()) {
      const points = [], stride = Math.max(1, Math.ceil(item.rows.length / 1400));
      for (let index = 0; index < item.rows.length; index += stride) points.push(item.rows[index]);
      if (points.at(-1) !== item.rows.at(-1)) points.push(item.rows.at(-1));
      const path = points.map((row, index) => `${index ? "L" : "M"}${X(row.time_s).toFixed(2)} ${Y(row[item.key] * scale).toFixed(2)}`).join(" ");
      element.append(svg("path", { d: path, stroke: item.color, "stroke-width": item.dash ? 1.7 : 2.2, fill: "none", "stroke-linecap": "round", ...(item.dash ? { "stroke-dasharray": item.dash } : {}) }));
    }
    element.append(svg("line", { class: "plot-cursor", x1: 48, x2: 48, y1: 18, y2: 146, stroke: "#aec3cd", "stroke-width": 1, "stroke-dasharray": "2 3", "data-xmax": xmax, "data-xmin": xmin }));
  }
  function renderPlots() {
    if (!state.run) return;
    renderPlot("anglePlot", "angle_rad", 180 / Math.PI, "target_angle_rad");
    renderPlot("velocityPlot", "velocity_rad_s"); renderPlot("forcePlot", "motor_force_N_each"); renderPlot("torquePlot", "motor_torque_Nm");
    $("compareLegend").hidden = !state.pinned;
    setSample(state.index);
  }
  function renderEvents() {
    const events = Array.isArray(state.run.events) ? state.run.events : [];
    setText("eventCount", events.length + " events"); $("events").replaceChildren();
    if (!events.length) $("events").append(create("p", "No events were recorded for this run.", "muted"));
    for (const event of events.slice(0, 200)) {
      const row = create("div", undefined, "event-row");
      row.append(create("span", numeric(event.time_s, 3) + " s", "mono"), create("strong", humanize(event.type || "event")), create("span", typeof event.details === "string" ? event.details : JSON.stringify(event.details || {})));
      $("events").append(row);
    }
    if (events.length > 200) $("events").append(create("p", `${events.length - 200} additional events are included in the exported JSON.`, "muted"));
    const hold = state.run.metrics.passive_hold;
    if (isRecord(hold)) {
      const holds = hold.can_hold_open_without_motor === true;
      const text = `Assumed passive hold at the open stop: ${holds ? "sufficient holding capacity" : "insufficient holding capacity"}. Margin ${numeric(hold.holding_margin_Nm, 2)} N·m. Additional holding torque required ${numeric(hold.additional_holding_torque_required_Nm, 2)} N·m. This calculation includes the configured static friction and brake capacity; no hardware validation is established.`;
      setText("holdSummary", text); $("holdSummary").className = "hold-summary" + (holds ? "" : " warning");
    } else { setText("holdSummary", "No passive-hold calculation is present in the imported run."); $("holdSummary").className = "hold-summary"; }
  }
  function stopPlayback() {
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null; state.lastFrame = null;
    $("playbackButton").textContent = "▶"; $("playbackButton").setAttribute("aria-label", "Play trace");
  }
  function playbackFrame(timestamp) {
    if (!state.run) { stopPlayback(); return; }
    if (state.lastFrame !== null) state.playTime += (timestamp - state.lastFrame) / 1000;
    state.lastFrame = timestamp;
    const rows = state.run.trace;
    let index = state.index;
    while (index < rows.length - 1 && rows[index + 1].time_s <= state.playTime) index += 1;
    setSample(index);
    if (state.playTime >= rows.at(-1).time_s) { setSample(rows.length - 1); stopPlayback(); return; }
    state.frame = requestAnimationFrame(playbackFrame);
  }
  function togglePlayback() {
    if (!state.run) return;
    if (state.frame !== null) { stopPlayback(); return; }
    if (state.index >= state.run.trace.length - 1) setSample(0);
    state.playTime = state.run.trace[state.index].time_s;
    $("playbackButton").textContent = "Ⅱ"; $("playbackButton").setAttribute("aria-label", "Pause trace");
    state.frame = requestAnimationFrame(playbackFrame);
  }
  function renderScalarMetrics(containerId, object) {
    const dl = create("dl", undefined, "result-dl");
    const entries = [];
    function visit(value, prefix, depth) {
      if (depth > 2 || !isRecord(value)) return;
      for (const [key, item] of Object.entries(value)) {
        const label = prefix ? prefix + " / " + humanize(key) : humanize(key);
        if (typeof item === "number" && Number.isFinite(item)) entries.push([label, numeric(item, 5)]);
        else if (typeof item === "boolean") entries.push([label, item ? "Yes" : "No"]);
        else if (isRecord(item) && !["provenance", "metadata", "units", "source_hashes"].includes(key)) visit(item, label, depth + 1);
      }
    }
    visit(object, "", 0);
    for (const [label, value] of entries.slice(0, 18)) dl.append(create("dt", label), create("dd", value));
    $(containerId).replaceChildren(dl);
  }
  function measurementInput(prefix) {
    const csv_text = $(prefix + "Csv").value.trim(), source = $(prefix + "Source").value.trim();
    if (!csv_text) throw new Error("Load or paste CSV data first.");
    if (!source) { $(prefix + "Source").focus(); throw new Error("Add a source or acquisition ID so the data provenance is retained."); }
    if (new Blob([csv_text]).size > MAX_FILE_BYTES) throw new Error("The CSV exceeds the 32 MiB workbench limit. Use the CLI for larger data.");
    return { csv_text, metadata: { source_kind: $(prefix + "Kind").value, source, units: prefix === "force" ? { length_m: "m", force_N_each: "N", temperature_C: "degC" } : { time_s: "s", angle_rad: "rad", velocity_rad_s: "rad/s" } } };
  }
  async function fitForce() {
    if (!state.connected) return;
    state.fit = null; $("forceResults").hidden = true;
    clearMessage("forceMessage"); $("fitButton").disabled = true; $("fitButton").textContent = "Fitting…";
    try {
      state.fit = await api("/api/fit-force", measurementInput("force"));
      setText("forceJson", JSON.stringify(state.fit, null, 2)); renderScalarMetrics("forceMetrics", state.fit);
      $("forceResults").hidden = false;
      $("applyFit").disabled = !state.connected || state.fit.application?.can_apply_to_default_geometry !== true;
      setText("fitApplicationNote", state.fit.application?.reason || "The curve is only applied when the model range is covered by the training data. The current trace stays unchanged until you run again.");
      message("Curve fit completed. Inspect validation error and provenance before using the fitted coefficients.", "info", "forceMessage");
    } catch (error) { message(error.message, "error", "forceMessage"); }
    finally { $("fitButton").disabled = !state.connected; $("fitButton").textContent = "Fit and validate curve"; }
  }
  async function compareReplay() {
    if (!state.connected || !state.run) return;
    state.replay = null; $("replayResults").hidden = true;
    clearMessage("replayMessage"); $("replayButton").disabled = true; $("replayButton").textContent = "Comparing…";
    try {
      state.replay = await api("/api/replay", { ...measurementInput("replay"), simulation: state.run });
      setText("replayJson", JSON.stringify(state.replay, null, 2)); renderScalarMetrics("replayMetrics", state.replay);
      $("replayResults").hidden = false;
      message("Trajectory comparison completed. This comparison does not modify model parameters or establish hardware validity.", "info", "replayMessage");
    } catch (error) { message(error.message, "error", "replayMessage"); }
    finally { $("replayButton").disabled = !state.connected || !state.run; $("replayButton").textContent = "Compare with current run"; }
  }
  async function applyForceFit() {
    if (!state.connected || !state.fit) return;
    $("applyFit").disabled = true;
    try {
      const result = await api("/api/apply-force-fit", { fit: state.fit, parameters: configuration().parameters });
      if (!isRecord(result.parameters) || !isRecord(result.parameter_provenance)) throw new Error("The API did not return a complete parameter set with provenance.");
      state.parameters = { ...result.parameters };
      state.fittedBaseline = { ...result.parameters };
      state.parameterProvenance = { ...result.parameter_provenance, workbench_note: "This provenance describes the fitted gas-force curve. Other plant parameters remain explicit assumptions." };
      for (const input of document.querySelectorAll("[data-param]")) {
        const value = state.parameters[input.dataset.param];
        if (typeof value === "number" && Number.isFinite(value)) input.value = value;
      }
      message("Fitted curve applied to the configuration with its data provenance. Run the simulation to generate a new trace. The trace remains synthetic, including when fitted parameters come from measured data.");
      switchView("simulation");
    } catch (error) { message(error.message, "error", "forceMessage"); }
    finally { $("applyFit").disabled = !state.connected || state.fit?.application?.can_apply_to_default_geometry !== true; }
  }
  function table(headers, rows) {
    const element = create("table"), head = create("thead"), header = create("tr"), body = create("tbody");
    headers.forEach(text => { const cell = create("th", text); cell.scope = "col"; header.append(cell); });
    head.append(header);
    for (const row of rows) { const tr = create("tr"); row.forEach(value => tr.append(create("td", String(value)))); body.append(tr); }
    element.append(head, body); const wrapper = create("div", undefined, "table-scroll"); wrapper.append(element); return wrapper;
  }
  function renderEvidence(value, filename) {
    state.evidence = validateEvidence(value); $("evidenceEmpty").hidden = true; $("evidenceContent").hidden = false;
    setText("evidenceTitle", filename || "Experiment summary");
    setText("evidenceScope", value.scope || "Synthetic normalized actuator research. These results do not validate the SI liftgate or hardware performance.");
    const metadata = $("evidenceMetadata"); metadata.replaceChildren();
    for (const [name, text] of [["Model", value.model_id || "Not recorded"], ["Training seeds", Array.isArray(value.seeds) ? value.seeds.join(", ") : "Not recorded"], ["Schema", value.schema_version], ["Protocol", value.protocol_status || value.status || "Exploratory unless the saved protocol establishes otherwise"], ["Cohorts", String(Object.keys(value.results).length)], ["Artifact", filename || "Imported summary"]]) {
      const div = create("div"); div.append(create("dt", name), create("dd", text)); metadata.append(div);
    }
    setText("evidenceJson", JSON.stringify(value, null, 2)); $("evidenceTables").replaceChildren();
    for (const [cohort, result] of Object.entries(value.results)) {
      const section = create("section", undefined, "panel evidence-cohort"), heading = create("div", undefined, "panel-head");
      const title = create("div"); title.append(create("h2", humanize(cohort)));
      if (result.description || result.scope) title.append(create("p", String(result.description || result.scope)));
      heading.append(title, create("span", String(result.n || Object.values(result.policies)[0]?.n || "n/a") + " cases", "chip")); section.append(heading);
      const rows = Object.entries(result.policies).map(([policy, metrics]) => [humanize(policy), numeric(metrics.mean_reward, 6), numeric(metrics.mean_quality, 6), numeric(metrics.mean_cost, 3), numeric(metrics.mean_probes, 3), String(metrics.n ?? "n/a")]);
      section.append(table(["Policy", "Net reward", "Quality", "Cost", "Probes", "N"], rows));
      const comparisons = result.paired_comparisons || result.comparisons;
      if (isRecord(comparisons) && Object.keys(comparisons).length) {
        section.append(create("h3", "Paired comparisons", "comparison-heading"));
        const comparisonRows = Object.entries(comparisons).map(([name, record]) => {
          const interval = record.ci95 || record.ci_95 || record.confidence_interval;
          return [humanize(name), numeric(record.mean_difference ?? record.mean_delta, 6), Array.isArray(interval) ? `[${numeric(interval[0], 6)}, ${numeric(interval[1], 6)}]` : (record.method?.includes("descriptive") ? "Descriptive control; no interval" : "Not recorded")];
        });
        section.append(table(["Comparison", "Mean difference", "95% interval"], comparisonRows));
      }
      section.append(create("p", "Net reward includes diagnostic cost. No-probe uses a prior-selected fixed calibration. A confidence interval over cases is not proof of generalization to hardware.", "context-note"));
      $("evidenceTables").append(section);
    }
  }
  async function connect() {
    try {
      if (!["http:", "https:"].includes(location.protocol) || !["127.0.0.1", "localhost"].includes(location.hostname)) throw new Error("Static viewer mode");
      const capabilities = await api("/api/capabilities");
      if (!isRecord(capabilities) || capabilities.model_id !== "recursivecal.si-liftgate/1") throw new Error("Unexpected local API model.");
      state.capabilities = capabilities; state.connected = true;
      $("serviceStatus").className = "service-state connected"; $("serviceStatus").replaceChildren(create("i"), document.createTextNode("Local API connected"));
      $("runButton").disabled = false; $("fitButton").disabled = false; $("replayButton").disabled = !state.run;
      resetConfiguration(); document.body.dataset.ready = "connected";
    } catch (error) {
      state.connected = false;
      $("serviceStatus").className = "service-state offline"; $("serviceStatus").replaceChildren(create("i"), document.createTextNode("Import-only mode"));
      document.body.dataset.ready = "offline";
      message("The local simulation API is unavailable. Open exported run and experiment JSON files to inspect them here. To compute new runs or fit data, start recursivecal serve and use its local address.", "warning");
    }
  }

  document.querySelectorAll(".nav-button").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  document.querySelector(".brand").addEventListener("click", event => { event.preventDefault(); switchView("simulation"); });
  window.addEventListener("hashchange", () => switchView(location.hash.slice(1)));
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopPlayback(); });
  $("scenario").addEventListener("change", () => { $("scenarioDescription").textContent = scenarios[$("scenario").value]; $("initialAngle").value = ""; });
  $("runButton").addEventListener("click", runSimulation);
  $("simulationForm").addEventListener("submit", event => { event.preventDefault(); runSimulation(); });
  $("resetConfig").addEventListener("click", () => { resetConfiguration(); message("Configuration reset to the API defaults. The displayed trace still belongs to the last run."); });
  $("scrubber").addEventListener("input", () => { stopPlayback(); setSample(Number($("scrubber").value)); });
  $("playbackButton").addEventListener("click", togglePlayback);
  $("pinRun").addEventListener("click", () => {
    if (!state.run) return; state.pinned = state.run; $("clearComparison").hidden = false;
    setText("pinRun", "Replace pinned run"); renderPlots();
    message("Current run pinned. Change the configuration and run again to compare traces. Pinning does not alter either run.");
  });
  $("clearComparison").addEventListener("click", () => { state.pinned = null; $("clearComparison").hidden = true; setText("pinRun", "Pin for comparison"); renderPlots(); });
  $("exportRun").addEventListener("click", () => { if (state.run) downloadJson("recursivecal_run.json", state.run); });
  $("exportTrace").addEventListener("click", () => { if (state.run) download("recursivecal_trace.csv", traceToCsv(state.run), "text/csv"); });
  $("importRun").addEventListener("change", async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      const value = validateRun(JSON.parse(await fileText(file))); loadRun(value, "Imported " + file.name); switchView("simulation");
      message("Run imported. Provenance and metrics are the file's recorded values; import does not independently verify them.");
    } catch (error) { message("Could not import run: " + error.message, "error"); }
    finally { event.target.value = ""; }
  });
  for (const prefix of ["force", "replay"]) $(prefix + "File").addEventListener("change", async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      $(prefix + "Csv").value = await fileText(file);
      if (!$(prefix + "Source").value.trim()) $(prefix + "Source").value = file.name;
      message("CSV loaded. Confirm its origin, units and source before submitting.", "info", prefix + "Message");
    } catch (error) { message(error.message, "error", prefix + "Message"); }
    finally { event.target.value = ""; }
  });
  $("forceExample").addEventListener("click", () => {
    $("forceCsv").value = "length_m,force_N_each,split\n0.55,215.0,train\n0.65,202.1,train\n0.75,189.0,train\n0.85,175.9,train\n0.95,163.0,train\n0.60,208.6,validation\n0.80,182.3,validation\n0.90,169.7,validation\n";
    $("forceKind").value = "synthetic"; $("forceSource").value = "Built-in illustrative force-length example";
    message("Synthetic example loaded. These invented samples exercise the fitting workflow and are not measurements.", "warning", "forceMessage");
  });
  $("fitButton").addEventListener("click", fitForce); $("applyFit").addEventListener("click", applyForceFit); $("replayButton").addEventListener("click", compareReplay);
  $("exportFit").addEventListener("click", () => { if (state.fit) downloadJson("recursivecal_force_fit.json", state.fit); });
  $("exportReplay").addEventListener("click", () => { if (state.replay) downloadJson("recursivecal_trajectory_comparison.json", state.replay); });
  $("importEvidence").addEventListener("change", async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      const value = validateEvidence(JSON.parse(await fileText(file))); renderEvidence(value, file.name); switchView("evidence");
      message("Experiment summary imported. Values and provenance are displayed as recorded in the artifact.");
    } catch (error) { message("Could not import experiment: " + error.message, "error"); }
    finally { event.target.value = ""; }
  });
  $("exportEvidence").addEventListener("click", () => { if (state.evidence) downloadJson("recursivecal_experiment_summary.json", state.evidence); });
  $("loadReferenceRun").disabled = !isRecord(window.RecursiveCalReference?.run);
  $("loadReferenceEvidence").disabled = !isRecord(window.RecursiveCalReference?.experiment);
  $("loadReferenceRun").addEventListener("click", () => {
    try {
      loadRun(validateRun(window.RecursiveCalReference.run), "Recorded synthetic example");
      switchView("simulation");
      message("Loaded a recorded synthetic run shipped with this release. These are saved results, not a new simulation. Model assumptions and provenance are included below.");
    } catch (error) { message("Could not load recorded example: " + error.message, "error"); }
  });
  $("loadReferenceEvidence").addEventListener("click", () => {
    try {
      renderEvidence(validateEvidence(window.RecursiveCalReference.experiment), "Recorded release benchmark");
      switchView("evidence");
      message("Loaded the recorded release benchmark. No training or evaluation was run in this browser. Use the experiment protocol and saved artifacts to reproduce it.");
    } catch (error) { message("Could not load recorded benchmark: " + error.message, "error"); }
  });
  switchView(location.hash.slice(1)); connect();
}
