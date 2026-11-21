/* RecursiveCal CAD-linked illustrative rigid-body dynamics. SI units, not OEM. */
(function(root){'use strict';
const PI=Math.PI, MAX_Q=78*PI/180, HINGE_Z=1.76, AX=-.470,AZ=1.170,BX=.018,BD=.300;
const DT=.01,T_MAX=6.5,OPEN_TIME=4.8,G=9.81,J=12,FM=330;
const nominal=Object.freeze({hatch_mass:25,motor_eff:1,friction_factor:1,gas_factor:1,sensor_bias:0,extra_load:0});
const factory=Object.freeze({gain:1,damping_gain:1,gravity_comp:1,friction_ff:1,sensor_comp:0});
const plants={nominal:{},hinge_friction:{friction_factor:2.5},motor_fade:{motor_eff:.55},heavy_hatch:{hatch_mass:33},gas_leak:{gas_factor:.47},sensor_bias:{sensor_bias:.075},combined:{motor_eff:.62,friction_factor:2.5,hatch_mass:29}};
function clamp(x,l,h){return Math.min(h,Math.max(l,x));}
function geometry(q){
 const x=BX*Math.cos(q)+BD*Math.sin(q),z=HINGE_Z+BX*Math.sin(q)-BD*Math.cos(q);
 const dx=-BX*Math.sin(q)+BD*Math.cos(q),dz=BX*Math.cos(q)+BD*Math.sin(q);
 const ux=x-AX,uz=z-AZ,L=Math.hypot(ux,uz),lever=(ux*dx+uz*dz)/L;
 return {length_m:L,lever_m:lever,hatch_point_x_m:x,hatch_point_z_m:z};
}
const OPEN_LENGTH=geometry(MAX_Q).length_m,CLOSED_LENGTH=geometry(0).length_m;
function gasForce(q,p){let L=geometry(q).length_m,compression=clamp((OPEN_LENGTH-L)/(OPEN_LENGTH-CLOSED_LENGTH),0,1);return (165+47*compression)*p.gas_factor;}
function gravityTorque(q,p){return p.hatch_mass*G*.55*Math.sin(q+.15)+p.extra_load;}
function frictionTorque(v,p){return p.friction_factor*(6*Math.tanh(v/.026)+5*v);}
function reference(t){let r=clamp(t/OPEN_TIME,0,1),q=MAX_Q*(10*r**3-15*r**4+6*r**5);if(!(r>0&&r<1))return[q,0,0];return[q,MAX_Q*(30*r*r-60*r**3+30*r**4)/OPEN_TIME,MAX_Q*(60*r-180*r*r+120*r**3)/(OPEN_TIME**2)];}
function simulate(plant=nominal,control=factory){
 const p={...nominal,...plant},ctrl={...factory,...control};let q=0,v=0,frames=[],saturation=0,interventions=0,energy=0;
 const n=Math.round(T_MAX/DT);
 for(let i=0;i<=n;i++){
  const t=+((i*DT).toFixed(5)),[ref,refvel,refacc]=reference(t),geom=geometry(q),lever=geom.lever_m;
  const gas=gasForce(q,p),nomGas=gasForce(q,nominal),nomG=gravityTorque(q,nominal);
  const err=ref-(q+p.sensor_bias-ctrl.sensor_comp);
  const desired=J*refacc+ctrl.gain*178*err+ctrl.damping_gain*68*(refvel-v)+ctrl.gravity_comp*nomG-2*nomGas*lever+ctrl.friction_ff*6*Math.tanh(refvel/.05);
  const demand=desired/(2*lever),request=clamp(demand,-FM,FM),force=request*p.motor_eff;
  const tauGas=2*gas*lever,tauMotor=2*force*lever,tauGravity=gravityTorque(q,p),tauFriction=frictionTorque(v,p),damping=2*6*(lever*v)*lever;
  const net=tauMotor+tauGas-tauGravity-tauFriction-damping,acc=net/J,current=.55+Math.abs(force)/39;
  if(Math.abs(v)>1.15||current>9.5)interventions++;
  if(Math.abs(demand)>FM)saturation++;
  if(i%3===0||i===n){frames.push({t,q,q_target:ref,w:v,length_m:geom.length_m,stroke_m:geom.length_m-CLOSED_LENGTH,lever_m:lever,motor_force_N_each:force,gas_force_N_each:gas,motor_current_A_each:current,motor_torque_Nm_total:tauMotor,gas_torque_Nm_total:tauGas,gravity_torque_Nm:tauGravity,net_torque_Nm:net,angular_accel_rad_s2:acc,error_deg:(ref-q)*180/PI});}
  if(i<n){let newv=v+acc*DT,newq=q+newv*DT;if(newq<0){newq=0;newv=0;}if(newq>MAX_Q){newq=MAX_Q;newv=0;}energy+=Math.abs(2*force*lever*v)*DT;q=newq;v=newv;}
 }
 const mae=frames.reduce((s,f)=>s+Math.abs(f.error_deg),0)/frames.length;
 const metrics={mae_deg:+mae.toFixed(3),final_angle_deg:+(frames.at(-1).q*180/PI).toFixed(2),final_error_deg:+((MAX_Q-frames.at(-1).q)*180/PI).toFixed(2),peak_motor_current_A_each:+Math.max(...frames.map(f=>f.motor_current_A_each)).toFixed(2),peak_strut_force_N_each:+Math.max(...frames.map(f=>Math.abs(f.motor_force_N_each)+f.gas_force_N_each)).toFixed(1),motor_mechanical_energy_J_approx:+energy.toFixed(1),host_limit_events:interventions,force_saturation_steps:saturation};
 return {frames,metrics};
}
root.RecursivePhysics={MAX_Q,HINGE_Z,CLOSED_LENGTH,OPEN_LENGTH,DT,T_MAX,factory,nominal,plants,clamp,geometry,gasForce,gravityTorque,reference,simulate};
})(typeof window!=='undefined'?window:globalThis);
