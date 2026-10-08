// ==========================================
// AZEEZ AI AR - CAMERA TEST
// ==========================================

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
// CAMERA SUPPORT CHECK
// ==========================================

function checkCameraSupport() {

    if (!window.isSecureContext) {

        setStatus("HTTPS REQUIRED");

        return false;
    }

    if (!navigator.mediaDevices) {

        setStatus("CAMERA API NOT AVAILABLE");

        return false;
    }

    if (!navigator.mediaDevices.getUserMedia) {

        setStatus("CAMERA NOT SUPPORTED");

        return false;
    }

    if (!camera) {

        setStatus("VIDEO ELEMENT NOT FOUND");

        return false;
    }

    return true;
}


// ==========================================
// STOP CAMERA
// ==========================================

function stopCamera() {

    if (!cameraStream) {
        return;
    }

    cameraStream
        .getTracks()
        .forEach(track => {
            track.stop();
        });

    cameraStream = null;

    if (camera) {
        camera.srcObject = null;
    }
}


// ==========================================
// START CAMERA
// ==========================================

async function startCamera() {

    console.log("START CAMERA BUTTON PRESSED");

    if (!checkCameraSupport()) {
        return;
    }

    try {

        setStatus("REQUESTING CAMERA...");

        stopCamera();


        const constraints = {

            video: {

                facingMode: {
                    ideal: currentFacingMode
                },

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                },

                frameRate: {
                    ideal: 30
                }
            },

            audio: false
        };


        console.log(
            "Camera constraints:",
            constraints
        );


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );


        console.log(
            "Camera stream received"
        );


        camera.srcObject =
            cameraStream;


        camera.muted = true;

        camera.autoplay = true;

        camera.playsInline = true;


        await camera.play();


        applyMirror();


        setStatus("CAMERA WORKING");


        console.log(
            "CAMERA WORKING SUCCESSFULLY"
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        let message =
            error.message ||
            "Unknown camera error";


        if (
            error.name ===
            "NotAllowedError"
        ) {

            message =
                "CAMERA PERMISSION DENIED";
        }


        if (
            error.name ===
            "NotFoundError"
        ) {

            message =
                "NO CAMERA FOUND";
        }


        if (
            error.name ===
            "NotReadableError"
        ) {

            message =
                "CAMERA BUSY";
        }


        if (
            error.name ===
            "OverconstrainedError"
        ) {

            message =
                "CAMERA SETTINGS ERROR";
        }


        if (
            error.name ===
            "SecurityError"
        ) {

            message =
                "CAMERA SECURITY ERROR";
        }


        setStatus(
            "ERROR: " + message
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


    setStatus(
        currentFacingMode === "user"
            ? "FRONT CAMERA"
            : "BACK CAMERA"
    );


    if (cameraStream) {

        await startCamera();
    }
}


// ==========================================
// MIRROR
// ==========================================

function applyMirror() {

    if (!camera) {
        return;
    }


    camera.style.transform =
        mirrorEnabled
            ? "scaleX(-1)"
            : "scaleX(1)";
}


// ==========================================
// MIRROR BUTTON
// ==========================================

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
// BUTTON EVENTS
// ==========================================

if (startButton) {

    startButton.addEventListener(
        "click",
        startCamera
    );

} else {

    console.error(
        "START CAMERA BUTTON NOT FOUND"
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
// INITIAL STATUS
// ==========================================

if (camera) {

    camera.muted = true;

    camera.autoplay = true;

    camera.playsInline = true;
}


setStatus("CAMERA TEST READY");

console.log(
    "AZEEZ CAMERA TEST LOADED"
);// ==========================================
// THREE.JS 3D TEST
// ==========================================

import * as THREE from "three";

const threeCanvas =
    document.getElementById("threeCanvas");

const renderer =
    new THREE.WebGLRenderer({
        canvas: threeCanvas,
        alpha: true,
        antialias: true
    });

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setClearColor(
    0x000000,
    0
);


// ==========================================
// SCENE
// ==========================================

const scene =
    new THREE.Scene();


// ==========================================
// 3D CAMERA
// ==========================================

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

        threeCamera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);


// ==========================================
// 3D LOOP
// ==========================================

function threeLoop() {

    requestAnimationFrame(
        threeLoop
    );

    cube.rotation.x += 0.01;

    cube.rotation.y += 0.015;

    renderer.render(
        scene,
        threeCamera
    );
}

threeLoop();

console.log(
    "THREE.JS 3D TEST READY"
);
