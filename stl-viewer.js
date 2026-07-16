// Reusable STL viewer.
// Usage: <div class="stl-viewer" data-model="../models/file.stl"></div>
// Optional attributes: data-color="#8BA3B8"  data-bg="#0D1B2A"
//
// Key gotchas this file works around (see notes inline):
// 1. renderer.setSize()'s 3rd arg must be `false`, otherwise Three.js writes
//    inline pixel width/height on the <canvas>, which fights our responsive
//    CSS (canvas gets stuck at its initial size on window resize / layout change).
// 2. STL files are usually authored Z-up; most viewers expect Y-up, so the
//    mesh is rotated -90deg on X after load.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

function initViewer(container) {
    const modelPath = container.dataset.model;
    const bgColor = container.dataset.bg || '#0D1B2A';
    const modelColor = container.dataset.color || '#8BA3B8';

    if (!modelPath) {
        container.innerHTML = '<p class="stl-viewer-hint">No model path set (missing data-model attribute).</p>';
        return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);

    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
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
            mesh.rotation.x = -Math.PI / 2; // STL is typically Z-up, scene is Y-up
            scene.add(mesh);

            const distance = radius * 2.4;
            camera.position.set(distance, distance * 0.7, distance);
            camera.near = radius / 100;
            camera.far = radius * 20;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();
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