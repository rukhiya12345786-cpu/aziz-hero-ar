
// AZEEZ AI AR STUDIO
// APP.JS - PART 1 OF 5
// Camera system

const camera = document.getElementById("camera");

const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const frontCameraBtn = document.getElementById("frontCameraBtn");
const backCameraBtn = document.getElementById("backCameraBtn");
const mirrorBtn = document.getElementById("mirrorBtn");

const globalStatus = document.getElementById("globalStatus");
const cameraStatus = document.getElementById("cameraStatus");
const cameraStatusChip = document.getElementById("cameraStatusChip");

let cameraStream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;
let cameraStarting = false;

function setGlobalStatus(message) {
    if (globalStatus) {
        globalStatus.textContent = message;
    }
    console.log("[AZEEZ AR]", message);
}

function setCameraStatus(message) {
    if (cameraStatus) {
        cameraStatus.textContent = "CAMERA: " + message;
    }

    if (cameraStatusChip) {
        cameraStatusChip.textContent = "CAMERA: " + message;
    }
}

function updateCameraButtons() {
    if (frontCameraBtn) {
        frontCameraBtn.textContent =
            currentFacingMode === "user"
                ? "FRONT CAMERA ✓"
                : "FRONT CAMERA";
    }

    if (backCameraBtn) {
        backCameraBtn.textContent =
            currentFacingMode === "environment"
                ? "BACK CAMERA ✓"
                : "BACK CAMERA";
    }

    if (mirrorBtn) {
        mirrorBtn.textContent =
            mirrorEnabled ? "MIRROR FLIP: ON" : "MIRROR FLIP: OFF";
    }
}

function applyCameraMirror() {
    if (!camera) return;

    camera.style.transform = mirrorEnabled
        ? "scaleX(-1)"
        : "scaleX(1)";
}

async function startCamera() {
    if (cameraStarting) return;

    if (!camera) {
        setGlobalStatus("ERROR: CAMERA VIDEO ELEMENT MISSING");
        return;
    }

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        setCameraStatus("UNAVAILABLE");
        setGlobalStatus(
            "CAMERA ERROR: OPEN THIS WEBSITE USING HTTPS"
        );
        return;
    }

    cameraStarting = true;
    setCameraStatus("STARTING");
    setGlobalStatus("REQUESTING CAMERA PERMISSION...");

    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(function(track) {
                track.stop();
            });
            cameraStream = null;
        }

        camera.srcObject = null;

        let stream;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        exact: currentFacingMode
                    },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
        } catch (firstError) {
            console.warn(
                "Preferred camera or audio unavailable; retrying:",
                firstError
            );

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: currentFacingMode
                    },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
        }

        cameraStream = stream;
        camera.srcObject = cameraStream;
        camera.muted = true;
        camera.autoplay = true;
        camera.playsInline = true;

        await camera.play();

        applyCameraMirror();
        updateCameraButtons();

        setCameraStatus("ON");
        setGlobalStatus("CAMERA WORKING");

        console.log("Camera started successfully.");

    } catch (error) {
        console.error("CAMERA ERROR:", error);

        setCameraStatus("ERROR");
        setGlobalStatus(
            "CAMERA ERROR: " +
            (error.message || error.name || "Unknown error")
        );

        if (cameraStream) {
            cameraStream.getTracks().forEach(function(track) {
                track.stop();
            });
            cameraStream = null;
        }

        camera.srcObject = null;

    } finally {
        cameraStarting = false;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(function(track) {
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
}

async function selectCamera(facingMode) {
    currentFacingMode = facingMode;
    updateCameraButtons();

    if (cameraStream) {
        await startCamera();
    } else {
        setGlobalStatus(
            "SELECTED: " +
            (facingMode === "user" ? "FRONT CAMERA" : "BACK CAMERA")
        );
    }
}

async function switchCamera() {
    const nextMode =
        currentFacingMode === "user"
            ? "environment"
            : "user";

    await selectCamera(nextMode);
}

function toggleMirror() {
    mirrorEnabled = !mirrorEnabled;

    applyCameraMirror();
    updateCameraButtons();

    setGlobalStatus(
        mirrorEnabled ? "MIRROR FLIP ON" : "MIRROR FLIP OFF"
    );
}

// Camera button connections

if (startCameraBtn) {
    startCameraBtn.addEventListener("click", startCamera);
}

if (stopCameraBtn) {
    stopCameraBtn.addEventListener("click", stopCamera);
}

if (frontCameraBtn) {
    frontCameraBtn.addEventListener("click", function() {
        selectCamera("user");
    });
}

if (backCameraBtn) {
    backCameraBtn.addEventListener("click", function() {
        selectCamera("environment");
    });
}

if (switchCameraBtn) {
    switchCameraBtn.addEventListener("click", switchCamera);
}

if (mirrorBtn) {
    mirrorBtn.addEventListener("click", toggleMirror);
}

// Initial state

setCameraStatus("OFF");
updateCameraButtons();
setGlobalStatus("READY — START CAMERA");

console.log("AZEEZ AI AR CAMERA SYSTEM READY");
// ==========================================
// PART 2 OF 5 — FACE TRACKING
// Requires the MediaPipe face_landmarker.task
// ==========================================

const startTrackingBtn = document.getElementById("startTrackingBtn");
const stopTrackingBtn = document.getElementById("stopTrackingBtn");
const personCountSelect = document.getElementById("personCount");
const trackingStatus = document.getElementById("trackingStatus");
const trackingStatusChip = document.getElementById("trackingStatusChip");
const landmarkCanvas = document.getElementById("landmarkCanvas");

let faceLandmarker = null;
let trackingRunning = false;
let trackingLoading = false;
let trackingAnimation = null;
let lastTrackingVideoTime = -1;
let showFaceLandmarks = false;
let lastFaceResult = null;

function setTrackingStatus(message) {
    if (trackingStatus) {
        trackingStatus.textContent = "TRACKING: " + message;
    }

    if (trackingStatusChip) {
        trackingStatusChip.textContent = "TRACKING: " + message;
    }
}

function resizeLandmarkCanvas() {
    if (!landmarkCanvas) return;

    const rect = landmarkCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    if (
        landmarkCanvas.width !== Math.round(width * pixelRatio) ||
        landmarkCanvas.height !== Math.round(height * pixelRatio)
    ) {
        landmarkCanvas.width = Math.round(width * pixelRatio);
        landmarkCanvas.height = Math.round(height * pixelRatio);
    }
}

function clearLandmarkCanvas() {
    if (!landmarkCanvas) return;

    const ctx = landmarkCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );
}

async function loadFaceLandmarker() {
    if (faceLandmarker) return faceLandmarker;
    if (trackingLoading) {
        throw new Error("Face tracking is already loading. Try again.");
    }

    trackingLoading = true;
    setTrackingStatus("LOADING MODEL");
    setGlobalStatus("LOADING FACE TRACKING LIBRARY...");

    try {
        const vision = await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
        );

        const resolver = await vision.FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );

        faceLandmarker = await vision.FaceLandmarker.createFromOptions(
            resolver,
            {
                baseOptions: {
                    modelAssetPath:
                        new URL("../models/face_landmarker.task", import.meta.url).href
                },
                runningMode: "VIDEO",
                numFaces: 4,
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true
            }
        );

        setGlobalStatus("FACE TRACKING MODEL READY");
        console.log("FaceLandmarker loaded.");

        return faceLandmarker;

    } catch (error) {
        faceLandmarker = null;
        console.error("FACE TRACKING LOAD ERROR:", error);

        setTrackingStatus("ERROR");
        setGlobalStatus(
            "TRACKING ERROR: " +
            (error.message || error.name || "Unknown error")
        );

        throw error;

    } finally {
        trackingLoading = false;
    }
}

async function startTracking() {
    if (trackingRunning) return;

    if (!cameraStream || !camera || camera.readyState < 2) {
        setTrackingStatus("CAMERA REQUIRED");
        setGlobalStatus("START CAMERA AND WAIT FOR VIDEO FIRST");
        return;
    }

    try {
        await loadFaceLandmarker();

        trackingRunning = true;
        lastTrackingVideoTime = -1;

        setTrackingStatus("STARTING");
        setGlobalStatus("FACE TRACKING STARTED");

        trackingLoop();

    } catch (error) {
        trackingRunning = false;
        setTrackingStatus("ERROR");
        console.error("Could not start tracking:", error);
    }
}

function stopTracking() {
    trackingRunning = false;

    if (trackingAnimation !== null) {
        cancelAnimationFrame(trackingAnimation);
        trackingAnimation = null;
    }

    lastTrackingVideoTime = -1;
    lastFaceResult = null;

    clearLandmarkCanvas();
    setTrackingStatus("OFF");
    setGlobalStatus("FACE TRACKING OFF");
}

function trackingLoop() {
    if (!trackingRunning) return;

    trackingAnimation = requestAnimationFrame(trackingLoop);

    if (!faceLandmarker || !camera || camera.readyState < 2) {
        return;
    }

    if (camera.currentTime === lastTrackingVideoTime) {
        return;
    }

    lastTrackingVideoTime = camera.currentTime;

    try {
        const maxFaces = personCountSelect
            ? Number(personCountSelect.value) || 4
            : 4;

        faceLandmarker.setOptions({
            numFaces: Math.max(1, Math.min(4, maxFaces))
        });

        const result = faceLandmarker.detectForVideo(
            camera,
            performance.now()
        );

        lastFaceResult = result;
        window.latestFaceResult = result;

        const faces = result.faceLandmarks || [];

        setTrackingStatus(
            faces.length > 0
                ? "ON — " + faces.length + " FACE" +
                  (faces.length === 1 ? "" : "S")
                : "ON — NO FACE"
        );

        if (showFaceLandmarks) {
            drawFaceLandmarks(faces);
        } else {
            clearLandmarkCanvas();
        }

    } catch (error) {
        console.error("FACE DETECTION ERROR:", error);
        setTrackingStatus("DETECTION ERROR");
    }
}

function drawFaceLandmarks(faces) {
    if (!landmarkCanvas) return;

    resizeLandmarkCanvas();

    const ctx = landmarkCanvas.getContext("2d");
    if (!ctx) return;

    const width = landmarkCanvas.width;
    const height = landmarkCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#00ff66";

    for (const face of faces) {
        for (let i = 0; i < face.length; i += 8) {
            const point = face[i];

            ctx.beginPath();
            ctx.arc(
                point.x * width,
                point.y * height,
                Math.max(2, width / 450),
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
}

function showFaceDots() {
    showFaceLandmarks = true;

    if (lastFaceResult) {
        drawFaceLandmarks(lastFaceResult.faceLandmarks || []);
    }
}

function hideFaceDots() {
    showFaceLandmarks = false;
    clearLandmarkCanvas();
}

// Connect tracking buttons.

if (startTrackingBtn) {
    startTrackingBtn.addEventListener("click", startTracking);
}

if (stopTrackingBtn) {
    stopTrackingBtn.addEventListener("click", stopTracking);
}

const showLandmarksBtn =
    document.getElementById("showLandmarksBtn");

const hideLandmarksBtn =
    document.getElementById("hideLandmarksBtn");

if (showLandmarksBtn) {
    showLandmarksBtn.addEventListener("click", showFaceDots);
}

if (hideLandmarksBtn) {
    hideLandmarksBtn.addEventListener("click", hideFaceDots);
}

if (personCountSelect) {
    personCountSelect.addEventListener("change", function() {
        setGlobalStatus(
            "TRACKING LIMIT: " + personCountSelect.value + " PERSON(S)"
        );
    });
}

window.addEventListener("resize", resizeLandmarkCanvas);

setTrackingStatus("OFF");
console.log("FACE TRACKING SYSTEM READY");
