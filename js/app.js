// ==========================================
// AZEEZ AI AR
// CAMERA + 3D CUBE STABLE TEST
// ==========================================

const camera =
    document.getElementById("camera");

const startButton =
    document.getElementById("startCameraBtn");

const switchButton =
    document.getElementById("switchCameraBtn");

const mirrorButton =
    document.getElementById("mirrorBtn");

const statusBox =
    document.getElementById("status");

const threeCanvas =
    document.getElementById("threeCanvas");


let cameraStream = null;

let currentFacingMode = "user";

let mirrorEnabled = false;

let THREE = null;

let cube = null;

let renderer = null;

let threeCamera = null;

let scene = null;


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
// CAMERA START
// ==========================================

async function startCamera() {

    try {

        setStatus("CAMERA REQUESTING...");


        if (!navigator.mediaDevices) {

            throw new Error(
                "Camera API unavailable"
            );
        }


        if (!navigator.mediaDevices.getUserMedia) {

            throw new Error(
                "getUserMedia unavailable"
            );
        }


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });

            cameraStream = null;
        }


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode:
                        currentFacingMode,

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

        camera.autoplay = true;

        camera.playsInline = true;


        await camera.play();


        applyMirror();


        setStatus(
            "CAMERA WORKING"
        );


        console.log(
            "CAMERA WORKING"
        );


        // Start Three.js only after camera works
        await startThree();


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        setStatus(
            "CAMERA ERROR: " +
            (
                error.name ||
                error.message ||
                "UNKNOWN"
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
// THREE.JS LOAD
// ==========================================

async function loadThree() {

    if (THREE) {
        return THREE;
    }


    setStatus(
        "LOADING 3D..."
    );


    const module =
        await import(
            "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
        );


    THREE = module;


    console.log(
        "THREE.JS LOADED"
    );


    return THREE;
}


// ==========================================
// START THREE.JS
// ==========================================

async function startThree() {

    try {

        if (!threeCanvas) {

            throw new Error(
                "3D canvas not found"
            );
        }


        await loadThree();


        if (renderer) {

            setStatus(
                "CAMERA + 3D WORKING"
            );

            return;
        }


        renderer =
            new THREE.WebGLRenderer({

                canvas:
                    threeCanvas,

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


        renderer.setClearColor(
            0x000000,
            0
        );


        scene =
            new THREE.Scene();


        threeCamera =
            new THREE.PerspectiveCamera(

                45,

                window.innerWidth /
                window.innerHeight,

                0.1,

                100
            );


        threeCamera.position.z = 5;


        // ==================================
        // LIGHT
        // ==================================

        const light =
            new THREE.HemisphereLight(
                0xffffff,
                0x444444,
                2
            );


        scene.add(light);


        // ==================================
        // CUBE
        // ==================================

        const geometry =
            new THREE.BoxGeometry(
                1.2,
                1.2,
                1.2
            );


        const material =
            new THREE.MeshNormalMaterial();


        cube =
            new THREE.Mesh(
                geometry,
                material
            );


        scene.add(cube);


        // Make sure canvas is visible
        threeCanvas.style.display =
            "block";


        threeCanvas.style.opacity =
            "1";


        setStatus(
            "CAMERA + 3D WORKING"
        );


        console.log(
            "3D CUBE READY"
        );


        renderLoop();


    } catch (error) {

        console.error(
            "THREE ERROR:",
            error
        );


        setStatus(
            "3D ERROR: " +
            (
                error.message ||
                "UNKNOWN"
            )
        );
    }
}


// ==========================================
// RENDER LOOP
// ==========================================

function renderLoop() {

    requestAnimationFrame(
        renderLoop
    );


    if (!cube || !renderer) {
        return;
    }


    cube.rotation.x +=
        0.01;


    cube.rotation.y +=
        0.015;


    renderer.render(
        scene,
        threeCamera
    );
}


// ==========================================
// RESIZE
// ==========================================

window.addEventListener(
    "resize",
    () => {

        if (!renderer || !threeCamera) {
            return;
        }


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
// INITIAL
// ==========================================

setStatus(
    "CAMERA TEST READY"
);


console.log(
    "AZEEZ STABLE CAMERA TEST LOADED"
);
// ==========================================
// FACE TRACKING TEST - SAFE VERSION
// CAMERA CODE IS NOT CHANGED
// ==========================================

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

let faceLandmarker = null;
let faceTrackingReady = false;
let lastFrameTime = -1;


// ==========================================
// LANDMARK CANVAS
// ==========================================

const landmarkCanvas =
    document.getElementById(
        "landmarkCanvas"
    );

const landmarkContext =
    landmarkCanvas
        ? landmarkCanvas.getContext("2d")
        : null;


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
// LOAD MEDIAPIPE
// ==========================================

async function startFaceTracking() {

    try {

        console.log(
            "Loading Face Tracking..."
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


        console.log(
            "FACE TRACKING READY"
        );


        if (statusBox) {

            statusBox.textContent =
                "FACE TRACKING READY";
        }


        requestAnimationFrame(
            faceTrackingLoop
        );


    } catch (error) {

        console.error(
            "FACE TRACKING ERROR:",
            error
        );


        /*
           IMPORTANT:
           Camera stays running even
           if face tracking fails.
        */

        if (statusBox) {

            statusBox.textContent =
                "FACE ERROR";
        }
    }
}


// ==========================================
// DRAW LANDMARKS
// ==========================================

function drawLandmarks(
    landmarks
) {

    if (
        !landmarkCanvas ||
        !landmarkContext
    ) {
        return;
    }


    landmarkContext.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );


    if (!landmarks) {
        return;
    }


    landmarkContext.fillStyle =
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


        landmarkContext.beginPath();


        landmarkContext.arc(
            x,
            y,
            2,
            0,
            Math.PI * 2
        );


        landmarkContext.fill();
    }
}


// ==========================================
// TRACKING LOOP
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
        lastFrameTime
    ) {

        lastFrameTime =
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

                drawLandmarks(
                    result.faceLandmarks[0]
                );


                console.log(
                    "FACE DETECTED"
                );


                window.azizFaceLandmarks =
                    result.faceLandmarks[0];


            } else {

                drawLandmarks(null);
            }


        } catch (error) {

            console.error(
                "TRACKING ERROR:",
                error
            );
        }
    }


    requestAnimationFrame(
        faceTrackingLoop
    );
}


// ==========================================
// START TRACKING ONLY AFTER PAGE LOAD
// CAMERA IS NOT TOUCHED
// ==========================================

setTimeout(
    () => {

        startFaceTracking();

    },
    1000
);


console.log(
    "SAFE FACE TRACKING TEST LOADED"
);
