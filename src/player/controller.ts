import * as THREE from 'three';
import { BASE_SPEED, PLANET, PLANET_RADIUS, PLAYER_PHYSICS as P } from '../config/world';
import { groundRadius, heightAt, slopeGradient } from '../world/terrain';
import type { InputState } from '../core/input';

const MAX_SLOPE = Math.tan(THREE.MathUtils.degToRad(PLANET.maxSlopeDeg));
const JUMP_BUFFER = 0.12; // un appui un peu trop tôt avant l'atterrissage compte quand même
const COYOTE = 0.1;       // on peut encore sauter juste après avoir quitté un rebord
import type { DecorCollider } from '../world/decor/collider';

/**
 * Déplacement sur la planète : gravité vers le centre, mouvement dans le plan tangent
 * relatif à la caméra, pentes trop raides bloquantes, collisions avec le décor.
 */
export class PlayerController {
  readonly pos: THREE.Vector3;
  /** Direction "avant" de la caméra, tangente au sol, transportée à chaque pas. */
  readonly camFwd = new THREE.Vector3();
  /** Direction du modèle. */
  readonly facing = new THREE.Vector3();
  readonly velocity = new THREE.Vector3(); // tangentielle
  /** Recul subi (coup reçu) : vitesse tangentielle qui s'amortit, en plus du déplacement voulu. */
  readonly knockVel = new THREE.Vector3();
  private knockDecay = 0.2;
  vr = 0;
  onGround = true;
  speed = BASE_SPEED;
  /** Collisions avec le décor (posé après le chargement). */
  decor?: DecorCollider;
  /**
   * Position et direction lissées pour l'affichage : interpolées entre les deux derniers pas de
   * physique, sinon le perso avance par à-coups dès que l'écran va plus vite que la physique.
   */
  readonly renderPos = new THREE.Vector3();
  readonly renderFacing = new THREE.Vector3();
  private prevPos = new THREE.Vector3();
  private prevFacing = new THREE.Vector3();
  /** Événements de la dernière mise à jour, pour l'animation et les sons. */
  events = { jumped: false, landed: false, landSpeed: 0 };

  private jumpBuffer = 0;
  private airTime = 0;
  private up = new THREE.Vector3();
  private right = new THREE.Vector3();
  private wish = new THREE.Vector3();
  private grad = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private sTmp = new THREE.Vector3();

  constructor(startDir: THREE.Vector3) {
    const d = startDir.clone().normalize();
    this.pos = d.clone().multiplyScalar(groundRadius(d));
    const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    this.camFwd.copy(ref).addScaledVector(d, -ref.dot(d)).normalize();
    this.facing.copy(this.camFwd);
    this.prevPos.copy(this.pos);
    this.prevFacing.copy(this.facing);
    this.interpolate(1);
  }

  /** alpha = fraction du pas suivant déjà écoulée (0 : état précédent, 1 : état courant). */
  interpolate(alpha: number) {
    const r = THREE.MathUtils.lerp(this.prevPos.length(), this.pos.length(), alpha);
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha).setLength(r);
    this.renderFacing.lerpVectors(this.prevFacing, this.facing, alpha);
    const up = this.tmp.copy(this.renderPos).normalize();
    this.renderFacing.addScaledVector(up, -this.renderFacing.dot(up)).normalize();
  }

  get upDir() { return this.up.copy(this.pos).normalize(); }

  /**
   * Rayon du sol qui porte le point p : le relief, ou le dessus d'un élément de décor situé sous p
   * s'il n'est pas plus haut que feetR + une marche (on ne se téléporte pas sur un mur qu'on longe).
   */
  supportAt(p: THREE.Vector3, feetR: number): number {
    const ground = PLANET_RADIUS + heightAt(this.sTmp.copy(p).normalize());
    return this.decor ? Math.max(ground, this.decor.supportAt(p, feetR)) : ground;
  }

  /** Replace le joueur au sol à une direction, immobile, regardant vers `facing` (nouvelle run). */
  reset(dir: THREE.Vector3, facing: THREE.Vector3) {
    const d = this.tmp.copy(dir).normalize();
    this.pos.copy(d).multiplyScalar(groundRadius(d));
    this.velocity.set(0, 0, 0);
    this.knockVel.set(0, 0, 0);
    this.vr = 0;
    this.onGround = true;
    this.facing.copy(facing);
    this.camFwd.copy(facing);
    this.prevPos.copy(this.pos);
    this.prevFacing.copy(this.facing);
    this.events.jumped = this.events.landed = false;
    this.interpolate(1);
  }

  /** Recul : projeté dans la direction `dir` (tangente), avec un petit saut. */
  knock(dir: THREE.Vector3, speed: number, lift: number, decay: number) {
    this.knockVel.copy(dir).multiplyScalar(speed);
    this.knockDecay = decay;
    if (lift > 0 && this.vr < lift) { this.vr = lift; this.onGround = false; }
  }

  /** Appelé une fois par frame avec l'entrée de la frame (le saut est mis en mémoire). */
  feed(input: InputState) {
    this.events.jumped = this.events.landed = false;
    if (input.jumpPressed) this.jumpBuffer = JUMP_BUFFER;
  }

  step(dt: number, input: InputState) {
    this.prevPos.copy(this.pos);
    this.prevFacing.copy(this.facing);
    const up = this.upDir;

    // Transport parallèle des directions sur le nouveau plan tangent
    this.camFwd.addScaledVector(up, -this.camFwd.dot(up)).normalize();
    this.facing.addScaledVector(up, -this.facing.dot(up)).normalize();
    this.velocity.addScaledVector(up, -this.velocity.dot(up));
    this.right.crossVectors(this.camFwd, up).normalize();

    // Vitesse visée, relative à la caméra
    this.wish.set(0, 0, 0)
      .addScaledVector(this.camFwd, input.moveY)
      .addScaledVector(this.right, input.moveX)
      .multiplyScalar(this.speed);

    // Pentes trop raides : on retire la composante qui monte (le joueur longe la paroi)
    if (this.wish.lengthSq() > 1e-6) {
      slopeGradient(up, this.camFwd, this.right, this.grad);
      const steep = this.grad.length();
      if (steep > MAX_SLOPE) {
        this.grad.divideScalar(steep);
        const uphill = this.wish.dot(this.grad);
        if (uphill > 0) this.wish.addScaledVector(this.grad, -uphill);
      }
    }

    // Accélération / freinage (légère inertie, pas de démarrage sec)
    const accelerating = this.wish.lengthSq() > this.velocity.lengthSq();
    const tau = accelerating ? P.accelTime : P.decelTime;
    const k = 1 - Math.exp(-dt / tau);
    this.velocity.lerp(this.wish, k);

    if (this.wish.lengthSq() > 1e-4) {
      this.tmp.copy(this.wish).normalize();
      this.facing.lerp(this.tmp, 1 - Math.exp(-dt * P.turnRate)).normalize();
    }

    // Déplacement tangent, reprojeté sur la sphère au même rayon
    const r = this.pos.length();
    this.knockVel.addScaledVector(up, -this.knockVel.dot(up)).multiplyScalar(Math.exp(-dt / this.knockDecay));
    this.pos.addScaledVector(this.velocity, dt).addScaledVector(this.knockVel, dt).setLength(r);

    // Collisions avec le décor (formes réelles des modèles)
    this.decor?.resolve(this.pos, P.radius);

    // Saut (mémoire d'appui + tolérance après un rebord)
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.airTime = this.onGround ? 0 : this.airTime + dt;
    if (this.jumpBuffer > 0 && (this.onGround || this.airTime < COYOTE) && this.vr <= 0) {
      this.vr = P.jumpSpeed;
      this.onGround = false;
      this.airTime = COYOTE;
      this.jumpBuffer = 0;
      this.events.jumped = true;
    }

    // Gravité et sol (relief ou dessus d'obstacle)
    let rad = this.pos.length();
    const ground = this.supportAt(this.pos, rad);
    const dir = this.tmp.copy(this.pos).normalize();
    this.vr -= P.gravity * dt;
    rad += this.vr * dt;
    const wasGround = this.onGround;
    if (rad <= ground || (wasGround && this.vr <= 0 && rad - ground < 0.6)) {
      if (!wasGround) { this.events.landed = true; this.events.landSpeed = -this.vr; }
      rad = ground; this.vr = 0; this.onGround = true;
    } else this.onGround = false;
    this.pos.copy(dir).multiplyScalar(rad);
  }
}
