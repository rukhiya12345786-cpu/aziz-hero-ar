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
// ==========================================
// MEDIAPIPE FACE TRACKING TEST
// ==========================================

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


// ==========================================
// TRACKING VARIABLES
// ==========================================

let faceLandmarker = null;
let faceTrackingReady = false;
let lastVideoTime = -1;

const landmarkCanvas =
    document.getElementById("landmarkCanvas");

const landmarkCtx =
    landmarkCanvas
        ? landmarkCanvas.getContext("2d")
        : null;


// ==========================================
// LANDMARK CANVAS SIZE
// ==========================================

function resizeLandmarkCanvas() {

    if (!landmarkCanvas) {
        return;
    }

    landmarkCanvas.width =
        window.innerWidth;

    landmarkCanvas.height =
        window.innerHeight;
}

resizeLandmarkCanvas();

window.addEventListener(
    "resize",
    resizeLandmarkCanvas
);


// ==========================================
// LOAD FACE LANDMARKER
// ==========================================

async function loadFaceTracking() {

    try {

        setStatus(
            "LOADING FACE TRACKING..."
        );

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );


        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath:
                            "../models/face_landmarker.task",

                        delegate: "GPU"
                    },

                    runningMode: "VIDEO",

                    numFaces: 1,

                    minFaceDetectionConfidence:
                        0.5,

                    minFacePresenceConfidence:
                        0.5,

                    minTrackingConfidence:
                        0.5
                }
            );


        faceTrackingReady = true;

        setStatus(
            "FACE TRACKING READY"
        );

        console.log(
            "FACE TRACKING READY"
        );


        requestAnimationFrame(
            faceTrackingLoop
        );


    } catch (error) {

        console.error(
            "FACE TRACKING ERROR:",
            error
        );

        setStatus(
            "FACE ERROR: " +
            error.message
        );
    }
}


// ==========================================
// DRAW FACE LANDMARKS
// ==========================================

function drawFaceLandmarks(
    landmarks
) {

    if (
        !landmarkCtx ||
        !landmarkCanvas
    ) {
        return;
    }


    landmarkCtx.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );


    if (
        !landmarks ||
        landmarks.length === 0
    ) {
        return;
    }


    landmarkCtx.fillStyle =
        "#00ff55";


    for (
        const point of landmarks
    ) {

        const x =
            point.x *
            landmarkCanvas.width;

        const y =
            point.y *
            landmarkCanvas.height;


        landmarkCtx.beginPath();

        landmarkCtx.arc(
            x,
            y,
            2,
            0,
            Math.PI * 2
        );

        landmarkCtx.fill();
    }
}


// ==========================================
// FACE TRACKING LOOP
// ==========================================

function faceTrackingLoop() {

    if (!faceTrackingReady) {
        return;
    }


    if (
        !camera ||
        camera.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

        requestAnimationFrame(
            faceTrackingLoop
        );

        return;
    }


    if (
        camera.currentTime !==
        lastVideoTime
    ) {

        lastVideoTime =
            camera.currentTime;


        try {

            const result =
                faceLandmarker.detectForVideo(
                    camera,
                    performance.now()
                );


            if (
                result.faceLandmarks &&
                result.faceLandmarks.length > 0
            ) {

                drawFaceLandmarks(
                    result.faceLandmarks[0]
                );


                setStatus(
                    "FACE DETECTED"
                );


                window.azizFaceLandmarks =
                    result.faceLandmarks[0];


            } else {

                if (landmarkCtx) {

                    landmarkCtx.clearRect(
                        0,
                        0,
                        landmarkCanvas.width,
                        landmarkCanvas.height
                    );
                }


                setStatus(
                    "SEARCHING FACE..."
                );
            }


        } catch (error) {

            console.error(
                "TRACKING LOOP ERROR:",
                error
            );
        }
    }


    requestAnimationFrame(
        faceTrackingLoop
    );
}


// ==========================================
// START TRACKING AFTER CAMERA START
// ==========================================

const originalStartCamera =
    startCamera;


startCamera =
    async function () {

        await originalStartCamera();


        if (
            cameraStream &&
            !faceTrackingReady
        ) {

            await loadFaceTracking();
        }
    };


console.log(
    "FACE TRACKING TEST CODE READY"
);
