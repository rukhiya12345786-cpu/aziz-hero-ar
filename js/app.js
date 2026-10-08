import * as THREE from "three";

const camera = document.getElementById("camera");
const startButton = document.getElementById("startCameraBtn");
const switchButton = document.getElementById("switchCameraBtn");
const mirrorButton = document.getElementById("mirrorBtn");
const statusBox = document.getElementById("status");

let cameraStream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;


// ==========================================
// STATUS
// ==========================================

function setStatus(message) {
    if (statusBox) {
        statusBox.textContent = message;
    }

    console.log(message);
}


// ==========================================
// CAMERA
// ==========================================

async function startCamera() {

    try {

        setStatus("REQUESTING CAMERA...");


        if (!navigator.mediaDevices) {
            throw new Error(
                "Camera API unavailable"
            );
        }


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });
        }


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            ideal:
                                currentFacingMode
                        },

                        width: {
                            ideal: 1280
                        },

                        height: {
                            ideal: 720
                        }
                    },

                    audio: false
                });


        camera.srcObject =
            cameraStream;

        camera.muted = true;

        camera.playsInline = true;

        camera.autoplay = true;


        await camera.play();


        applyMirror();


        setStatus(
            "CAMERA WORKING"
        );


        console.log(
            "CAMERA WORKING"
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR",
            error
        );


        setStatus(
            "CAMERA ERROR: " +
            (
                error.message ||
                error.name ||
                "Unknown error"
            )
        );
    }
}


// ==========================================
// SWITCH CAMERA
// ==========================================

async function switchCamera() {

    currentFacingMode =
        currentFacingMode === "user"
            ? "environment"
            : "user";


    if (cameraStream) {
        await startCamera();
    }
}


// ==========================================
// MIRROR
// ==========================================

function applyMirror() {

    camera.style.transform =
        mirrorEnabled
            ? "scaleX(-1)"
            : "scaleX(1)";
}


function toggleMirror() {

    mirrorEnabled =
        !mirrorEnabled;


    applyMirror();


    if (mirrorButton) {

        mirrorButton.textContent =
            mirrorEnabled
                ? "MIRROR: ON"
                : "MIRROR: OFF";
    }
}


// ==========================================
// BUTTONS
// ==========================================

if (startButton) {

    startButton.addEventListener(
        "click",
        startCamera
    );
}


if (switchButton) {

    switchButton.addEventListener(
        "click",
        switchCamera
    );
}


if (mirrorButton) {

    mirrorButton.addEventListener(
        "click",
        toggleMirror
    );
}


// ==========================================
// THREE.JS
// ==========================================

const threeCanvas =
    document.getElementById(
        "threeCanvas"
    );


const renderer =
    new THREE.WebGLRenderer({

        canvas: threeCanvas,

        alpha: true,

        antialias: true
    });


renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);


const scene =
    new THREE.Scene();


const threeCamera =
    new THREE.PerspectiveCamera(

        45,

        window.innerWidth /
        window.innerHeight,

        0.1,

        100
    );


threeCamera.position.z = 5;


// ==========================================
// LIGHT
// ==========================================

const light =
    new THREE.HemisphereLight(
        0xffffff,
        0x444444,
        2
    );


scene.add(light);


// ==========================================
// CUBE
// ==========================================

const geometry =
    new THREE.BoxGeometry(
        1.2,
        1.2,
        1.2
    );


const material =
    new THREE.MeshNormalMaterial();


const cube =
    new THREE.Mesh(
        geometry,
        material
    );


scene.add(cube);


// ==========================================
// RESIZE
// ==========================================

window.addEventListener(
    "resize",
    () => {

        threeCamera.aspect =
            window.innerWidth /
            window.innerHeight;


        threeCamera
            .updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);


// ==========================================
// 3D LOOP
// ==========================================

function renderLoop() {

    requestAnimationFrame(
        renderLoop
    );


    cube.rotation.x += 0.01;

    cube.rotation.y += 0.015;


    renderer.render(
        scene,
        threeCamera
    );
}


renderLoop();


setStatus(
    "CAMERA TEST READY"
);


console.log(
    "AZEEZ CAMERA + 3D TEST READY"
);
