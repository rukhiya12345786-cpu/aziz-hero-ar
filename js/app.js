const camera = document.getElementById("camera");

const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const mirrorBtn = document.getElementById("mirrorBtn");

const cameraStatus = document.getElementById("cameraStatus");
const globalStatus = document.getElementById("globalStatus");

let cameraStream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;

function setCameraStatus(text) {
    if (cameraStatus) {
        cameraStatus.textContent = text;
    }
}

function setGlobalStatus(text) {
    if (globalStatus) {
        globalStatus.textContent = text;
    }

    console.log(text);
}

function applyMirror() {
    if (!camera) return;

    if (mirrorEnabled) {
        camera.style.transform = "scaleX(-1)";
    } else {
        camera.style.transform = "scaleX(1)";
    }
}

async function startCamera() {
    try {
        setGlobalStatus("REQUESTING CAMERA...");
        setCameraStatus("STARTING");

        if (!navigator.mediaDevices) {
            throw new Error("Camera API unavailable");
        }

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => {
                track.stop();
            });

            cameraStream = null;
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: currentFacingMode
                },
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: true
        });

        camera.srcObject = cameraStream;

        camera.muted = true;
        camera.playsInline = true;
        camera.autoplay = true;

        await camera.play();

        applyMirror();

        setCameraStatus("ON");
        setGlobalStatus("CAMERA WORKING");

        console.log("CAMERA WORKING");

    } catch (error) {

        console.error("CAMERA ERROR:", error);

        setCameraStatus("ERROR");

        setGlobalStatus(
            "CAMERA ERROR: " +
            (error.message || error.name || "Unknown error")
        );
    }
}

function stopCamera() {

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        cameraStream = null;
    }

    if (camera) {
        camera.pause();
        camera.srcObject = null;
    }

    setCameraStatus("OFF");
    setGlobalStatus("CAMERA OFF");

    console.log("CAMERA OFF");
}

async function switchCamera() {

    currentFacingMode =
        currentFacingMode === "user"
            ? "environment"
            : "user";

    if (cameraStream) {
        await startCamera();
    } else {
        setGlobalStatus(
            "CAMERA READY: " +
            currentFacingMode.toUpperCase()
        );
    }
}

function toggleMirror() {

    mirrorEnabled = !mirrorEnabled;

    applyMirror();

    if (mirrorBtn) {
        mirrorBtn.textContent =
            mirrorEnabled
                ? "MIRROR: ON"
                : "MIRROR: OFF";
    }

    console.log(
        "MIRROR:",
        mirrorEnabled ? "ON" : "OFF"
    );
}

if (startCameraBtn) {
    startCameraBtn.addEventListener(
        "click",
        startCamera
    );
}

if (stopCameraBtn) {
    stopCameraBtn.addEventListener(
        "click",
        stopCamera
    );
}

if (switchCameraBtn) {
    switchCameraBtn.addEventListener(
        "click",
        switchCamera
    );
}

if (mirrorBtn) {
    mirrorBtn.addEventListener(
        "click",
        toggleMirror
    );
}

setCameraStatus("OFF");
setGlobalStatus("READY");

console.log("AZEEZ AI AR - CAMERA SYSTEM READY");
// ==========================================
// FACE TRACKING - START / STOP
// ==========================================

const startTrackingBtn =
    document.getElementById("startTrackingBtn");

const stopTrackingBtn =
    document.getElementById("stopTrackingBtn");

const trackingStatus =
    document.getElementById("trackingStatus");

const landmarkCanvas =
    document.getElementById("landmarkCanvas");

let faceLandmarker = null;
let trackingRunning = false;
let trackingAnimation = null;
let trackingLoading = false;

let lastVideoTime = -1;

function setTrackingStatus(text) {

    if (trackingStatus) {
        trackingStatus.textContent = text;
    }

    console.log("TRACKING:", text);
}

async function loadFaceTracking() {

    if (faceLandmarker) {
        return;
    }

    if (trackingLoading) {
        return;
    }

    trackingLoading = true;

    try {

        setGlobalStatus("LOADING FACE TRACKING...");
        setTrackingStatus("LOADING");

        /*
         * MediaPipe Tasks Vision is loaded only when
         * START TRACKING is pressed.
         *
         * Camera is completely independent.
         */

        const vision =
            await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
            );

        const {
            FaceLandmarker,
            FilesetResolver
        } = vision;

        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath:
                            "../models/face_landmarker.task"
                    },

                    runningMode: "VIDEO",

                    numFaces: 4,

                    outputFaceBlendshapes: true,

                    outputFacialTransformationMatrixes: true
                }
            );

        trackingLoading = false;

        console.log(
            "FACE LANDMARKER READY"
        );

    } catch (error) {

        trackingLoading = false;

        faceLandmarker = null;

        console.error(
            "FACE TRACKING LOAD ERROR:",
            error
        );

        setTrackingStatus("ERROR");

        setGlobalStatus(
            "TRACKING ERROR: " +
            (
                error.message ||
                error.name ||
                "Unknown error"
            )
        );

        throw error;
    }
}

async function startTracking() {

    try {

        if (!cameraStream || !camera) {

            setTrackingStatus("NO CAMERA");

            setGlobalStatus(
                "START CAMERA FIRST"
            );

            return;
        }

        if (trackingRunning) {
            return;
        }

        await loadFaceTracking();

        trackingRunning = true;

        lastVideoTime = -1;

        setTrackingStatus("ON");

        setGlobalStatus(
            "FACE TRACKING ON"
        );

        console.log(
            "FACE TRACKING STARTED"
        );

        trackingLoop();

    } catch (error) {

        trackingRunning = false;

        setTrackingStatus("ERROR");

        console.error(
            "TRACKING START ERROR:",
            error
        );
    }
}

function stopTracking() {

    trackingRunning = false;

    if (trackingAnimation) {

        cancelAnimationFrame(
            trackingAnimation
        );

        trackingAnimation = null;
    }

    lastVideoTime = -1;

    clearLandmarkCanvas();

    setTrackingStatus("OFF");

    setGlobalStatus(
        "FACE TRACKING OFF"
    );

    console.log(
        "FACE TRACKING STOPPED"
    );
}

function clearLandmarkCanvas() {

    if (!landmarkCanvas) {
        return;
    }

    const ctx =
        landmarkCanvas.getContext("2d");

    if (!ctx) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );
}

function resizeLandmarkCanvas() {

    if (!landmarkCanvas) {
        return;
    }

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    if (
        landmarkCanvas.width !== width ||
        landmarkCanvas.height !== height
    ) {

        landmarkCanvas.width = width;
        landmarkCanvas.height = height;
    }
}

function trackingLoop() {

    if (!trackingRunning) {
        return;
    }

    trackingAnimation =
        requestAnimationFrame(
            trackingLoop
        );

    if (
        !faceLandmarker ||
        !camera ||
        camera.readyState < 2
    ) {
        return;
    }

    resizeLandmarkCanvas();

    const currentTime =
        performance.now();

    if (
        camera.currentTime ===
        lastVideoTime
    ) {
        return;
    }

    lastVideoTime =
        camera.currentTime;

    try {

        const result =
            faceLandmarker.detectForVideo(
                camera,
                currentTime
            );

        handleFaceResults(result);

    } catch (error) {

        console.error(
            "FACE DETECTION ERROR:",
            error
        );
    }
}

function handleFaceResults(result) {

    if (!result) {
        return;
    }

    const faces =
        result.faceLandmarks || [];

    if (faces.length === 0) {

        setTrackingStatus(
            "ON - NO FACE"
        );

        clearLandmarkCanvas();

        return;
    }

    setTrackingStatus(
        "ON - " +
        faces.length +
        " FACE" +
        (faces.length > 1 ? "S" : "")
    );

    /*
     * We keep the complete result available
     * for the next step:
     *
     * - 3D head positioning
     * - rotation
     * - expression tracking
     * - 4-person assignment
     */

    window.latestFaceResult = result;

    drawFaceLandmarks(faces);
}

function drawFaceLandmarks(faces) {

    if (!landmarkCanvas) {
        return;
    }

    resizeLandmarkCanvas();

    const ctx =
        landmarkCanvas.getContext("2d");

    if (!ctx) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );

    ctx.fillStyle = "#00ff66";

    for (
        let faceIndex = 0;
        faceIndex < faces.length;
        faceIndex++
    ) {

        const landmarks =
            faces[faceIndex];

        /*
         * Draw a small number of points first.
         * This keeps the tracking test light.
         */

        for (
            let i = 0;
            i < landmarks.length;
            i += 8
        ) {

            const point =
                landmarks[i];

            const x =
                point.x *
                landmarkCanvas.width;

            const y =
                point.y *
                landmarkCanvas.height;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                2,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }
    }
}

if (startTrackingBtn) {

    startTrackingBtn.addEventListener(
        "click",
        startTracking
    );
}

if (stopTrackingBtn) {

    stopTrackingBtn.addEventListener(
        "click",
        stopTracking
    );
}

window.addEventListener(
    "resize",
    resizeLandmarkCanvas
);

setTrackingStatus("OFF");

console.log(
    "FACE TRACKING SYSTEM READY"
);
