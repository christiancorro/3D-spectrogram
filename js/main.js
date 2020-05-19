import * as THREE from 'https://unpkg.com/three@0.108.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.108.0/examples/jsm/controls/OrbitControls.js';
//import { TrackballControls } from 'https://unpkg.com/three@0.108.0/examples/jsm/controls/TrackballControls.js';
import { GLTFExporter } from 'https://unpkg.com/three@0.108.0/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'https://unpkg.com/three@0.108.0/examples/jsm/exporters/OBJExporter.js';
import Stats from 'https://unpkg.com/three@0.108.0/examples/jsm/libs/stats.module.js';

//TODO: improve coloring, set frequency limit, map linear to log


// Visual
let camera, controls, scene, renderer;
let geometry, material, mesh;

let fftSize = 512, maxFreq = 8000;
let width, height, widthDiv, heightDiv;
width = 1024;
height = width * 2.2;
widthDiv = fftSize / 2 - 1;
heightDiv = widthDiv;

let stats;
let update = true;

var vertex;

// Auditory
let data = [];
for (let i = 0; i < heightDiv; i++) {
    data.push(new Array(heightDiv).fill(0));
}

let date = new Date();

let isAudioReady = false;
let audio, analyser, fftData = [];

init();
initGUI();
initMic();
animate();

function init() {

    // Renderer
    let canvas = document.querySelector('#main-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Camera
    const cameraDistance = width;
    const fov = 60;
    const aspect = 2;
    const near = 0.1;
    const far = 8000;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.position.set(0, 1000, cameraDistance);

    // Controls
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    // scene.fog = new THREE.Fog(0x111111, 0.002)
    let axesHelper = new THREE.AxesHelper(100);
    //scene.add(axesHelper);

    // Lights
    let light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1, 1, 1);
    scene.add(light);

    light = new THREE.DirectionalLight(0x002288);
    light.position.set(- 1, - 1, - 1);
    scene.add(light);

    light = new THREE.AmbientLight(0x222222);
    scene.add(light);

    window.addEventListener('resize', onWindowResize, false);

    // -----------------------------------------------
    // Scene elements
    // -----------------------------------------------

    // Geometry

    geometry = new THREE.PlaneGeometry(width, height, widthDiv, heightDiv);
    geometry.rotateX(-Math.PI / 2);

    // Material
    material = new THREE.MeshStandardMaterial({
        // color: 0x2194CE,
        wireframe: true,
        vertexColors: THREE.FaceColors
    });

    // Mesh
    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = -Math.PI / 2;

    scene.add(mesh);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    stats.update();
    if (update) {
        updateGeometry();
    }
    render();
}


function render() {
    renderer.render(scene, camera);
}

function randomRange(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateGeometry() {
    if (isAudioReady) {
        analyser.getByteFrequencyData(fftData);
        if (data.length > heightDiv)
            data.shift();

        data.push(fftData.slice());

        if (data.length >= heightDiv)

            for (let i = 0; i < heightDiv; i++) {
                for (let j = 0; j < data[i].length; j++) {
                    vertex = geometry.vertices[i * (heightDiv + 1) + j];
                    vertex.lerp(new THREE.Vector3(vertex.x, data[i][j], vertex.z), 1);
                }
            }

        geometry.faces.forEach(function (face) {
            var val = geometry.vertices[face.a].y;
            face.color.setRGB(Math.abs(val) / 100, Math.abs(val) / 20, Math.abs(val) / 20);
        });

        geometry.colorsNeedUpdate = true;
        geometry.verticesNeedUpdate = true;
    }
}

function initMic() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(handleSuccess);

    function handleSuccess(stream) {
        var context = new AudioContext();  // create context
        audio = context.createMediaStreamSource(stream); //create src inside ctx
        analyser = context.createAnalyser(); //create analyser in ctx
        analyser.smoothingTimeConstant = 0.8;
        audio.connect(analyser);         //connect analyser node to the src
        // analyser.connect(context.destination); // connect the destination 
        // node to the analyser

        analyser.fftSize = fftSize;
        var bufferLength = analyser.frequencyBinCount;
        fftData = new Uint8Array(bufferLength);
        isAudioReady = true;
    }
}


function initGUI() {
    // DAT
    let params = {
        fftsize: fftSize,
        reset: init,
        update: update,
        download_OBJ: exportOBJ,
        download_GLTF: exportGLTF
    };

    let gui = new dat.GUI();

    // gui.add(params, 'fftsize', { 128: 128, 256: 256, 512: 512, 1024: 1024 }).name("FFT Size").onChange((value) => { fftSize = value; analyser.fftSize = fftSize });
    gui.add(params, 'update').name("Update geometry").listen().onChange((checked) => { update = checked });
    gui.add(params, 'reset').name("Reset");
    gui.add(params, 'download_GLTF').name("Download GLTF");
    gui.add(params, 'download_OBJ').name("Download OBJ");

    // STAT
    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// -----------------------------------------------
// Exporter
// -----------------------------------------------

// link element for download
var link = document.createElement('a');
link.style.display = 'none';
link = document.body.appendChild(link);

function save(blob, filename) {
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function exportOBJ() {
    let objExporter = new OBJExporter();
    let output = objExporter.parse(mesh);
    //console.log(output);
    saveString(output, 'sculpture-' + date.getTime() + '.obj');
}

function exportGLTF() {
    let gltfExporter = new GLTFExporter();

    let options = {
        trs: false,
        onlyVisible: false,
        truncateDrawRange: true,
        binary: false,
        forcePowerOfTwoTextures: false,
        maxTextureSize: 4096
    };

    gltfExporter.parse(mesh, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'sculpture-' + date.getTime() + '.glb');

        } else {
            let output = JSON.stringify(result, null, 2);
            //console.log(output);
            saveString(output, 'sculpture-' + date.getTime() + '.gltf');
        }
    }, options);

}

function saveString(text, filename) {
    save(new Blob([text], { type: 'text/plain' }), filename);
}
function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}


export { data }
