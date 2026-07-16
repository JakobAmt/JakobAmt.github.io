// Reusable STL viewer.
// Usage: <div class="stl-viewer" data-stl="models/file.stl"></div>
// Optional attributes:
//   data-color="#8BA3B8"     mesh color
//   data-rotate-x="-90"      degrees, correct Z-up STL to Y-up scene
//   data-rotate-z="90"       degrees, additional correction per-model
//
// Key gotchas this file works around:
// 1. renderer.setSize()'s 3rd arg must be `false`, otherwise Three.js writes
//    inline pixel width/height on the <canvas>, which fights our responsive
//    CSS (canvas gets stuck at its initial size on window resize / layout change).
// 2. STL files are usually authored Z-up; the fix isn't one fixed rotation for
//    every model, it varies per-export, hence the data-rotate-x / data-rotate-z
//    attributes instead of a hardcoded value.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

function initViewer(container) {
    const modelPath = container.dataset.stl;
    const modelColor = container.dataset.color || '#8BA3B8';
    const rotateX = parseFloat(container.dataset.rotateX || '0');
    const rotateZ = parseFloat(container.dataset.rotateZ || '0');

    if (!modelPath) {
        container.innerHTML = '<p class="stl-viewer-hint">No model path set (missing data-stl attribute).</p>';
        return;
    }

    const status = document.createElement('div');
    status.className = 'stl-viewer-status';
    status.textContent = 'Loading model…';
    container.appendChild(status);

    const scene = new THREE.Scene(); // no scene.background set -> canvas stays transparent, container CSS background shows through

    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false); // false = responsive CSS controls size, not Three.js
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(1, 1.5, 1);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-1, -0.5, -1);
    scene.add(fillLight);

    const loader = new STLLoader();
    loader.load(
        modelPath,
        (geometry) => {
            geometry.center();
            geometry.computeBoundingSphere();
            const radius = geometry.boundingSphere ? geometry.boundingSphere.radius : 50;

            const material = new THREE.MeshStandardMaterial({
                color: modelColor,
                metalness: 0.15,
                roughness: 0.55,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = THREE.MathUtils.degToRad(rotateX);
            mesh.rotation.z = THREE.MathUtils.degToRad(rotateZ);
            scene.add(mesh);

            const distance = radius * 2.4;
            camera.position.set(distance, distance * 0.7, distance);
            camera.near = radius / 100;
            camera.far = radius * 20;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();

            status.remove();
        },
        undefined,
        (error) => {
            container.innerHTML =
                '<p class="stl-viewer-hint">Couldn\'t load the 3D model. ' +
                '<a href="' + modelPath + '">Download the STL directly</a>.</p>';
            console.error('STL load error:', error);
        }
    );

    function onResize() {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight, false);
    }
    window.addEventListener('resize', onResize);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

document.querySelectorAll('.stl-viewer').forEach(initViewer);