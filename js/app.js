// AZEEZ AI AR STUDIO
// APP.JS — PART 1 OF 4
// Camera + Hide/Show Controls

const camera = document.getElementById("camera");
const controls = document.getElementById("controls");

const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const frontCameraBtn = document.getElementById("frontCameraBtn");
const backCameraBtn = document.getElementById("backCameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const mirrorBtn = document.getElementById("mirrorBtn");

const controlToggle = document.getElementById("controlToggle");
const hideControlsBtn = document.getElementById("hideControlsBtn");
const showControlsBtn = document.getElementById("showControlsBtn");

const globalStatus = document.getElementById("globalStatus");
const cameraStatus = document.getElementById("cameraStatus");
const cameraStatusChip = document.getElementById("cameraStatusChip");

let cameraStream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;
let cameraStarting = false;
let controlsHidden = false;

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
        mirrorBtn.textContent = mirrorEnabled
            ? "MIRROR FLIP: ON"
            : "MIRROR FLIP: OFF";
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

    if (!camera || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("UNAVAILABLE");
        setGlobalStatus("CAMERA ERROR: USE HTTPS");
        return;
    }

    cameraStarting = true;
    setCameraStatus("STARTING");
    setGlobalStatus("REQUESTING CAMERA PERMISSION...");

    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        camera.srcObject = null;

        let stream;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { exact: currentFacingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
        } catch (error) {
            console.warn("Retrying camera without audio:", error);

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: currentFacingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
        }

        cameraStream = stream;
        camera.srcObject = stream;
        camera.muted = true;
        camera.autoplay = true;
        camera.playsInline = true;

        await camera.play();

        applyCameraMirror();
        updateCameraButtons();

        setCameraStatus("ON");
        setGlobalStatus("CAMERA WORKING");

    } catch (error) {
        console.error("CAMERA ERROR:", error);

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        if (camera) camera.srcObject = null;

        setCameraStatus("ERROR");
        setGlobalStatus(
            "CAMERA ERROR: " + (error.message || error.name)
        );

    } finally {
        cameraStarting = false;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    if (camera) {
        camera.pause();
        camera.srcObject = null;
    }

    setCameraStatus("OFF");
    setGlobalStatus("CAMERA OFF");
}

async function selectCamera(mode) {
    currentFacingMode = mode;
    updateCameraButtons();

    if (cameraStream) {
        await startCamera();
    } else {
        setGlobalStatus(
            mode === "user"
                ? "FRONT CAMERA SELECTED"
                : "BACK CAMERA SELECTED"
        );
    }
}

function switchCamera() {
    selectCamera(
        currentFacingMode === "user" ? "environment" : "user"
    );
}

function toggleMirror() {
    mirrorEnabled = !mirrorEnabled;
    applyCameraMirror();
    updateCameraButtons();

    setGlobalStatus(
        mirrorEnabled ? "MIRROR FLIP ON" : "MIRROR FLIP OFF"
    );
}

// Hide and show the controls without stopping the camera.

function hideControls() {
    controlsHidden = true;

    if (controls) {
        controls.classList.add("hidden");
    }

    if (controlToggle) {
        controlToggle.textContent = "SHOW CONTROLS";
        controlToggle.setAttribute("aria-expanded", "false");
    }

    setGlobalStatus("CONTROLS HIDDEN — CAMERA KEEPS RUNNING");
}

function showControls() {
    controlsHidden = false;

    if (controls) {
        controls.classList.remove("hidden");
    }

    if (controlToggle) {
        controlToggle.textContent = "HIDE CONTROLS";
        controlToggle.setAttribute("aria-expanded", "true");
    }

    setGlobalStatus("CONTROLS VISIBLE");
}

function toggleControls() {
    if (controlsHidden) {
        showControls();
    } else {
        hideControls();
    }
}

// Button connections.

startCameraBtn?.addEventListener("click", startCamera);
stopCameraBtn?.addEventListener("click", stopCamera);

frontCameraBtn?.addEventListener("click", () => {
    selectCamera("user");
});

backCameraBtn?.addEventListener("click", () => {
    selectCamera("environment");
});

switchCameraBtn?.addEventListener("click", switchCamera);
mirrorBtn?.addEventListener("click", toggleMirror);

hideControlsBtn?.addEventListener("click", hideControls);
showControlsBtn?.addEventListener("click", showControls);
controlToggle?.addEventListener("click", toggleControls);

// Initial status.

setCameraStatus("OFF");
updateCameraButtons();

if (controlToggle) {
    controlToggle.textContent = "HIDE CONTROLS";
    controlToggle.setAttribute("aria-expanded", "true");
}

setGlobalStatus("READY — START CAMERA");
console.log("AZEEZ AR PART 1 READY");
// ==========================================
// AZEEZ AI AR STUDIO
// APP.JS — PART 2 OF 4
// FACE TRACKING
// ==========================================

const startTrackingBtn =
    document.getElementById("startTrackingBtn");

const stopTrackingBtn =
    document.getElementById("stopTrackingBtn");

const personCountSelect =
    document.getElementById("personCount");

const trackingStatus =
    document.getElementById("trackingStatus");

const trackingStatusChip =
    document.getElementById("trackingStatusChip");

const landmarkCanvas =
    document.getElementById("landmarkCanvas");

const showLandmarksButtons =
    document.querySelectorAll("#showLandmarksBtn");

const hideLandmarksButtons =
    document.querySelectorAll("#hideLandmarksBtn");

let faceLandmarker = null;
let trackingRunning = false;
let trackingLoading = false;
let trackingFrame = null;
let lastVideoTime = -1;
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

function clearTrackingDots() {
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

function resizeTrackingCanvas() {
    if (!landmarkCanvas) return;

    const rect = landmarkCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    landmarkCanvas.width =
        Math.max(1, Math.round(rect.width * dpr));

    landmarkCanvas.height =
        Math.max(1, Math.round(rect.height * dpr));
}

async function loadFaceTrackingModel() {
    if (faceLandmarker) return faceLandmarker;

    if (trackingLoading) {
        throw new Error("Tracking model is already loading.");
    }

    trackingLoading = true;
    setTrackingStatus("LOADING MODEL");
    setGlobalStatus("LOADING FACE TRACKING LIBRARY...");

    try {
        const vision = await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
        );

        const fileset =
            await vision.FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        faceLandmarker =
            await vision.FaceLandmarker.createFromOptions(
                fileset,
                {
                    baseOptions: {
                        modelAssetPath: new URL(
                            "../models/face_landmarker.task",
                            import.meta.url
                        ).href
                    },
                    runningMode: "VIDEO",
                    numFaces: 4,
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true
                }
            );

        setTrackingStatus("MODEL READY");
        return faceLandmarker;

    } catch (error) {
        faceLandmarker = null;

        console.error("TRACKING MODEL ERROR:", error);

        setTrackingStatus(
            "ERROR — " +
            (error.message || error.name || "MODEL LOAD FAILED")
        );

        setGlobalStatus(
            "TRACKING ERROR: " +
            (error.message || error.name || "UNKNOWN ERROR")
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
        setGlobalStatus("START CAMERA BEFORE TRACKING");
        return;
    }

    setTrackingStatus("STARTING");

    try {
        await loadFaceTrackingModel();

        trackingRunning = true;
        lastVideoTime = -1;

        setTrackingStatus("SEARCHING FOR FACE");
        setGlobalStatus("FACE TRACKING RUNNING");

        trackingLoop();

    } catch (error) {
        trackingRunning = false;
        console.error("START TRACKING FAILED:", error);
    }
}

function stopTracking() {
    trackingRunning = false;

    if (trackingFrame !== null) {
        cancelAnimationFrame(trackingFrame);
        trackingFrame = null;
    }

    lastVideoTime = -1;
    lastFaceResult = null;

    clearTrackingDots();
    setTrackingStatus("OFF");
    setGlobalStatus("FACE TRACKING OFF");
}

function trackingLoop() {
    if (!trackingRunning) return;

    trackingFrame = requestAnimationFrame(trackingLoop);

    if (!faceLandmarker || !camera || camera.readyState < 2) {
        return;
    }

    if (camera.currentTime === lastVideoTime) {
        return;
    }

    lastVideoTime = camera.currentTime;

    try {
        const result = faceLandmarker.detectForVideo(
            camera,
            performance.now()
        );

        lastFaceResult = result;
        window.latestFaceResult = result;

        const faces = result.faceLandmarks || [];
        const requestedFaces = personCountSelect
            ? Math.max(1, Math.min(4, Number(personCountSelect.value) || 1))
            : 4;

        const visibleFaces = faces.slice(0, requestedFaces);

        setTrackingStatus(
            visibleFaces.length
                ? "FACE DETECTED — " + visibleFaces.length
                : "NO FACE"
        );

        if (showFaceLandmarks) {
            drawTrackingDots(visibleFaces);
        } else {
            clearTrackingDots();
        }

    } catch (error) {
        console.error("FACE DETECTION ERROR:", error);

        setTrackingStatus(
            "DETECTION ERROR — " +
            (error.message || error.name || "UNKNOWN")
        );
    }
}

function drawTrackingDots(faces) {
    if (!landmarkCanvas) return;

    const rect = landmarkCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (
        landmarkCanvas.width !== Math.round(rect.width * dpr) ||
        landmarkCanvas.height !== Math.round(rect.height * dpr)
    ) {
        resizeTrackingCanvas();
    }

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

function showTrackingDots() {
    showFaceLandmarks = true;

    if (lastFaceResult) {
        const faces = lastFaceResult.faceLandmarks || [];
        drawTrackingDots(faces);
    }
}

function hideTrackingDots() {
    showFaceLandmarks = false;
    clearTrackingDots();
}

// Connect tracking buttons.

startTrackingBtn?.addEventListener("click", startTracking);
stopTrackingBtn?.addEventListener("click", stopTracking);

showLandmarksButtons.forEach(button => {
    button.addEventListener("click", showTrackingDots);
});

hideLandmarksButtons.forEach(button => {
    button.addEventListener("click", hideTrackingDots);
});

window.addEventListener("resize", () => {
    if (showFaceLandmarks && lastFaceResult) {
        drawTrackingDots(lastFaceResult.faceLandmarks || []);
    } else {
        clearTrackingDots();
    }
});

setTrackingStatus("OFF");
console.log("AZEEZ AR FACE TRACKING PART READY");
