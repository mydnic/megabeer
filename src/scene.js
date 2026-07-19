import * as THREE from 'three';
import { stoneMaterial } from './textures.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2a30);
scene.fog = new THREE.Fog(0x2b2a30, 60, 220);

export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);

export function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

scene.add(new THREE.AmbientLight(0xffffff, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 0.35);
sun.position.set(50, 80, 30);
scene.add(sun);

export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  stoneMaterial(250, 250)
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

export const grid = new THREE.GridHelper(4000, 400, 0x555148, 0x555148);
grid.position.y = 0.01;
scene.add(grid);
