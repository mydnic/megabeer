import * as THREE from 'three';
import { CAMERA as C } from '../config/world';
import { groundRadius } from '../world/terrain';
import type { InputState } from '../core/input';
import type { PlayerController } from './controller';

/**
 * Caméra orbitale dans le repère local du joueur : la verticale de la caméra est la normale
 * de la planète sous le joueur. Lissée, zoom molette, ne passe jamais sous le relief.
 */
export class CameraRig {
  pitch: number = C.pitch;
  distance: number = C.distance;
  private distTarget: number = C.distance;
  private target = new THREE.Vector3();
  private up = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private blockedDist: number = C.distance;
  private tmp = new THREE.Vector3();
  private initialized = false;
  /** Tremblement en cours (0 à 1) : l'amplitude suit son carré, il s'amortit tout seul. */
  private trauma = 0;
  private shakeAmp = 0.3;
  private shakeDecay = 2.5;
  private shakeT = 0;

  /** Cadrage imposé (mort) : distance et inclinaison visées, rejointes en douceur. null = libre. */
  private focus: { distance: number; pitch: number; sharpness: number } | null = null;
  setFocus(f: { distance: number; pitch: number; sharpness: number } | null) {
    this.focus = f;
    // Fin du cadrage imposé : retour direct au cadrage de départ (nouvelle run, coupe franche)
    if (!f) { this.distTarget = this.distance = this.blockedDist = C.distance; this.pitch = C.pitch; }
  }

  /** Ajoute un tremblement (coup reçu, explosion...). */
  shake(amount: number, amplitude: number, decay: number) {
    this.trauma = Math.min(1, this.trauma + amount);
    this.shakeAmp = amplitude;
    this.shakeDecay = decay;
  }

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  update(dt: number, input: InputState, player: PlayerController) {
    const up = this.up.copy(player.renderPos).normalize();
    // Lacet : rotation de la direction avant autour de la verticale locale
    const yaw = -input.mouseDX * C.mouseSensitivity - input.lookX * C.stickSensitivity * dt;
    player.camFwd.applyAxisAngle(up, yaw);
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + input.mouseDY * C.mouseSensitivity + input.lookY * C.stickSensitivity * 0.7 * dt,
      C.pitchMin, C.pitchMax,
    );
    if (this.focus) {
      const k = 1 - Math.exp(-dt * this.focus.sharpness);
      this.distTarget = this.focus.distance;
      this.pitch += (this.focus.pitch - this.pitch) * k;
    } else if (input.zoom) this.distTarget = THREE.MathUtils.clamp(this.distTarget * (input.zoom > 0 ? 1.12 : 0.89), C.distanceMin, C.distanceMax);
    this.distance += (this.distTarget - this.distance) * (1 - Math.exp(-dt * 10));

    // Cible lissée (amortit les petites secousses du relief), position calculée autour d'elle
    const goal = this.tmp.copy(player.renderPos).addScaledVector(up, C.targetHeight);
    if (!this.initialized) { this.target.copy(goal); this.initialized = true; }
    this.target.lerp(goal, 1 - Math.exp(-dt * C.followSharpness));

    // Axe de visée : de la cible vers la caméra
    const dir = this.dir.copy(player.camFwd).multiplyScalar(-Math.cos(this.pitch)).addScaledVector(up, Math.sin(this.pitch));

    // Distance libre le long de l'axe : on avance depuis le perso jusqu'au premier contact avec le
    // relief ou le décor (mur, tronc...) ; la caméra se place juste avant
    let free = this.distance;
    const STEPS = 32;
    for (let i = 1; i <= STEPS; i++) {
      const t = C.minDistanceToPlayer + (this.distance - C.minDistanceToPlayer) * (i / STEPS);
      const p = this.tmp.copy(this.target).addScaledVector(dir, t);
      const blockedByDecor = player.decor?.occupied(p, C.groundClearance) ?? false;
      const r = p.length();
      if (blockedByDecor || r < groundRadius(p.divideScalar(r)) + C.groundClearance) {
        free = Math.max(C.minDistanceToPlayer, C.minDistanceToPlayer + (this.distance - C.minDistanceToPlayer) * ((i - 1) / STEPS));
        break;
      }
    }
    // Se rapproche tout de suite (jamais dans le sol), repart en arrière en douceur
    if (free < this.blockedDist) this.blockedDist = free;
    else this.blockedDist += (free - this.blockedDist) * (1 - Math.exp(-dt * C.unblockSharpness));

    this.desired.copy(this.target).addScaledVector(dir, this.blockedDist);
    this.camera.position.copy(this.desired);
    this.camera.up.copy(up);
    this.camera.lookAt(this.target);
    // Tremblement : décalage latéral et vertical, bruit lisse (sinus décorrélés)
    if (this.trauma > 0) {
      this.shakeT += dt;
      const a = this.trauma * this.trauma * this.shakeAmp, t = this.shakeT * 38;
      this.camera.translateX(a * (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4));
      this.camera.translateY(a * (Math.sin(t * 1.3 + 4.1) * 0.6 + Math.sin(t * 2.9) * 0.4));
      this.trauma = Math.max(0, this.trauma - this.shakeDecay * dt);
    }
  }
}
