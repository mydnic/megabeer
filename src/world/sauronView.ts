import * as THREE from 'three';
import { SAURON_LOOK } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Sauron } from '../game/sauron';
import { LAYER_SKY } from '../render/materials';
import { doomSite, heightAt } from './terrain';

/**
 * Marques au sol de Sauron : l'arc de son balayage (des rangs de disques en éventail), le point d'impact de sa masse,
 * et le regard de l'Oeil (le disque qui traque le joueur).
 */
export function createSauronMarksView(scene: THREE.Scene) {
  const arcs = createGroundMarks(scene, SAURON_LOOK.sweep);
  const slams = createGroundMarks(scene, SAURON_LOOK.slam);
  const gazes = createGroundMarks(scene, SAURON_LOOK.eye.gaze);
  const fan: GroundMark[] = [];
  for (const [, n] of SAURON_LOOK.sweepRows) for (let i = 0; i < n; i++) fan.push({ at: new THREE.Vector3(), radius: 0, t: 0 });
  const impact: GroundMark = { at: new THREE.Vector3(), radius: 0, t: 0 };
  const gaze: GroundMark = { at: new THREE.Vector3(), radius: 0, t: 1 };
  const a1: GroundMark[] = [], s1: GroundMark[] = [], g1: GroundMark[] = [];
  const axis = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    sync(boss: Sauron | null) {
      a1.length = 0; s1.length = 0; g1.length = 0;
      const live = boss && !boss.zombie.dead ? boss : null;
      const a = live?.arc;
      if (a) {
        up.copy(a.at).normalize();
        let k = 0;
        for (const [dist, n] of SAURON_LOOK.sweepRows) {
          for (let i = 0; i < n; i++) {
            const m = fan[k++];
            // Le long de l'arc, d'un bord à l'autre
            const ang = -a.half + (2 * a.half * i) / Math.max(1, n - 1);
            dir.copy(a.dir).applyAxisAngle(up, ang);
            axis.crossVectors(a.at, dir).normalize();
            m.at.copy(a.at).applyAxisAngle(axis, Math.min(dist, a.radius - SAURON_LOOK.sweepDisc * 0.5) / a.at.length());
            m.radius = SAURON_LOOK.sweepDisc;
            m.t = a.t;
            a1.push(m);
          }
        }
      }
      const m = live?.impact;
      if (m) { impact.at.copy(m.at); impact.radius = m.radius; impact.t = m.t; s1.push(impact); }
      const g = live?.gaze;
      if (g) { gaze.at.copy(g.at); gaze.radius = g.radius; g1.push(gaze); }
      arcs.sync(a1);
      slams.sync(s1);
      gazes.sync(g1);
    },
  };
}

/**
 * L'Oeil de Sauron (phase 2) : un oeil de feu qui flotte au-dessus du cratère, sa pupille fendue tournée vers son
 * regard, et un faisceau qui descend jusqu'au disque qu'il pose au sol. Il s'allume en grandissant, s'éteint à la mort.
 */
export function createSauronEyeView(scene: THREE.Scene) {
  const E = SAURON_LOOK.eye;
  const fire = new THREE.Color(E.fire).multiplyScalar(E.glow);
  const sphere = new THREE.SphereGeometry(0.5, 32, 16);
  // Le globe de feu (aplati en amande), un coeur plus chaud, la pupille fendue, un halo
  const globe = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: fire, toneMapped: false }));
  globe.scale.set(E.size, E.size * 0.55, E.size * 0.35);
  // Le coeur, plus chaud, sous la pupille (devant le globe, derrière la pupille)
  const core = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(E.core).multiplyScalar(E.glow), toneMapped: false }));
  core.scale.set(E.size * 0.55, E.size * 0.38, E.size * 0.2);
  core.position.z = E.size * 0.07;
  const pupil = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: E.pupil }));
  pupil.scale.set(E.size * 0.13, E.size * 0.5, E.size * 0.1);
  pupil.position.z = E.size * 0.18;
  const halo = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(E.fire), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  const eye = new THREE.Group();
  eye.add(globe, core, pupil, halo);
  // Le faisceau : un cône ouvert, pointe à l'Oeil, base au sol (longueur 1 le long de +Z, mis à l'échelle à chaque image)
  const beamGeo = new THREE.CylinderGeometry(1, 0.15, 1, 24, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: E.beam.color, transparent: true, opacity: E.beam.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  for (const o of [globe, core, pupil, halo, beam]) { o.layers.set(LAYER_SKY); o.frustumCulled = false; }
  eye.visible = beam.visible = false;
  scene.add(eye, beam);
  const target = new THREE.Vector3(), up = new THREE.Vector3(), g0 = new THREE.Vector3();
  let on = 0, t = 0;
  return {
    /** L'Oeil allumé (0 à 1) : la colonne du volcan s'efface d'autant (elle le traverserait). */
    get on() { return on; },
    sync(boss: Sauron | null, dt: number) {
      t += dt;
      const g = boss && !boss.zombie.dead ? boss.gaze : null;
      on = g ? Math.min(1, on + dt / 0.8) : Math.max(0, on - dt / 0.6);
      eye.visible = beam.visible = on > 0;
      if (on <= 0) return;
      up.copy(doomSite.dir);
      eye.position.copy(up).multiplyScalar(PLANET_RADIUS + heightAt(up) + E.height);
      if (g) {
        g0.copy(g.at).normalize();
        target.copy(g0).multiplyScalar(PLANET_RADIUS + heightAt(g0));
      }
      eye.up.copy(up);
      eye.lookAt(target);
      eye.scale.setScalar(on * (1 + 0.04 * Math.sin(t * 6)));
      halo.scale.set(E.size * 1.6 * (1 + 0.08 * Math.sin(t * 3)), E.size * (1 + 0.08 * Math.sin(t * 3.4)), E.size * 0.6);
      // Le faisceau, de l'Oeil au sol
      beam.position.copy(eye.position);
      beam.up.copy(up);
      beam.lookAt(target);
      const r = (g?.radius ?? E.size * 0.4) * on;
      beam.scale.set(r, r, eye.position.distanceTo(target));
      beamMat.opacity = E.beam.opacity * on * (0.85 + 0.15 * Math.sin(t * 9));
    },
  };
}
