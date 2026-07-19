import * as THREE from 'three';
import { stoneMaterial } from './textures.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Night palette: desaturated blue-grey rather than neutral grey, so it actually
// reads as "night" instead of "flat daylight with the brightness turned down".
const NIGHT_COLOR = 0x141826;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT_COLOR);
scene.fog = new THREE.Fog(NIGHT_COLOR, 50, 200);

export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);

export function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// Low ambient so the directional key light does the work of defining form —
// toon banding only reads when there's real light/shadow contrast to band.
scene.add(new THREE.AmbientLight(0x8891b8, 0.45));

// Moonlight key light. Follows the player each frame (see updateSceneLighting)
// so its shadow camera frustum stays centered on the action in this infinite map.
export const moon = new THREE.DirectionalLight(0xcfe0ff, 1.4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -35;
moon.shadow.camera.right = 35;
moon.shadow.camera.top = 35;
moon.shadow.camera.bottom = -35;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 120;
moon.shadow.bias = -0.0015;
scene.add(moon);
scene.add(moon.target);

// Cool, dim fill from the opposite side so unlit faces aren't pure black.
const fill = new THREE.DirectionalLight(0x39406b, 0.35);
fill.position.set(-40, 20, -30);
scene.add(fill);

export function updateSceneLighting(px, pz) {
  moon.position.set(px + 40, 65, pz + 25);
  moon.target.position.set(px, 0, pz);
}

export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  stoneMaterial(250, 250)
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

export const grid = new THREE.GridHelper(4000, 400, 0x353a52, 0x353a52);
grid.position.y = 0.01;
scene.add(grid);
