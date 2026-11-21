"use strict";
// Geometry adapter only. There is no browser-side dynamics engine in this view.
// Coordinates match physics.py and the authored CAD mount specification.
window.RecursivePhysics = {
  clamp: (x, low, high) => Math.min(high, Math.max(low, x)),
  geometry: q => {
    const x = 0.018 * Math.cos(q) + 0.300 * Math.sin(q);
    const z = 1.76 + 0.018 * Math.sin(q) - 0.300 * Math.cos(q);
    const ux = x + 0.470, uz = z - 1.170, length = Math.hypot(ux, uz);
    return {hatch_point_x_m: x, hatch_point_z_m: z, length_m: length,
      lever_m: (ux * (-0.018 * Math.sin(q) + 0.300 * Math.cos(q)) + uz * (0.018 * Math.cos(q) + 0.300 * Math.sin(q))) / length};
  }
};
