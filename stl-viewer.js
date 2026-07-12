// stl-viewer.js
// Reusable, dependency-light interactive STL viewer.
// Drop a <div class="stl-viewer" data-stl="path/to/model.stl"></div> anywhere
// on the page and call initSTLViewers() after the DOM is ready (or just
// include this file with type="module" — it self-initializes on load).
//
// Requires three.js, loaded via import map (see the <head> snippet in
// projects-stl-example.html). Nothing to npm install — everything comes
// from a CDN at runtime.

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ACCENT = 0x00b4d8;      // matches --accent in style.css
const BG = 0x0d1b2a;          // matches body background
const CARD_BG = 0x13233a;     // slightly lighter than page bg, for depth

function createViewer(container) {
    const stlPath = container.dataset.stl;
    if (!stlPath) return;

    const color = container.dataset.color
        ? parseInt(container.dataset.color.replace('#', '0x'))
        : ACCENT;

    // Optional rotation offset, in degrees, applied once after the model
    // loads and is centered. Use this to fix a model's default orientation
    // without re-exporting the STL. E.g. data-rotate-y="90" spins it a
    // quarter turn CCW around the vertical axis (viewed from above).
    const rotateX = THREE.MathUtils.degToRad(parseFloat(container.dataset.rotateX) || 0);
    const rotateY = THREE.MathUtils.degToRad(parseFloat(container.dataset.rotateY) || 0);
    const rotateZ = THREE.MathUtils.degToRad(parseFloat(container.dataset.rotateZ) || 0);

    // Loading label
    const label = document.createElement('div');
    label.className = 'stl-viewer-status';
    label.textContent = 'Loading model…';
    container.appendChild(label);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CARD_BG);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    container.appendChild(renderer.domElement);

    // Lighting — soft key + fill + rim, so geometry reads without needing
    // per-model material tweaking.
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8bb8d8, 0.5);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x00b4d8, 0.35);
    rim.position.set(0, -6, -8);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.4;
    controls.minDistance = 2;
    controls.maxDistance = 60;

    // Stop auto-rotate as soon as the person takes control; feels more
    // intentional than fighting their drag.
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    const loader = new STLLoader();
    loader.load(
        stlPath,
        (geometry) => {
            label.remove();

            geometry.computeVertexNormals();
            geometry.center();

            const material = new THREE.MeshStandardMaterial({
                color,
                metalness: 0.15,
                roughness: 0.55,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.set(rotateX, rotateY, rotateZ);

            // Frame the model: fit camera distance to its bounding sphere.
            // The 1.15 multiplier is just a small margin so the model
            // doesn't touch the edges — lower it further for an even
            // tighter fit, raise it for more breathing room.
            geometry.computeBoundingSphere();
            const radius = geometry.boundingSphere.radius || 1;
            const fitDistance = radius / Math.sin((Math.PI * camera.fov) / 360);
            camera.position.set(0, 0, fitDistance * 1.15);
            camera.near = fitDistance / 100;
            camera.far = fitDistance * 100;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();

            scene.add(mesh);
        },
        undefined,
        (err) => {
            label.textContent = 'Could not load model.';
            console.error('STL load error for', stlPath, err);
        }
    );

    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    }
    new ResizeObserver(onResize).observe(container);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

export function initSTLViewers() {
    document.querySelectorAll('.stl-viewer').forEach((el) => {
        if (el.dataset.stlInitialized) return;
        el.dataset.stlInitialized = 'true';
        createViewer(el);
    });
}

// Auto-init when loaded as a module script.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSTLViewers);
} else {
    initSTLViewers();
}