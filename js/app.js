// AZEEZ AI AR STUDIO
// APP.JS — PART 1 OF 4
// CAMERA AND CONTROL VISIBILITY

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
    if (globalStatus) globalStatus.textContent = message;
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
    if (camera) {
        camera.style.transform =
            mirrorEnabled ? "scaleX(-1)" : "scaleX(1)";
    }
}

async function startCamera() {
    if (cameraStarting) return;

    if (!camera || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("UNAVAILABLE");
        setGlobalStatus("CAMERA ERROR — OPEN THE HTTPS WEBSITE");
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
        camera.playsInline = true;
        camera.autoplay = true;

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

        camera.srcObject = null;
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

function hideControls() {
    controlsHidden = true;
    controls?.classList.add("hidden");

    if (controlToggle) {
        controlToggle.textContent = "SHOW CONTROLS";
        controlToggle.setAttribute("aria-expanded", "false");
    }

    setGlobalStatus("CONTROLS HIDDEN — CAMERA KEEPS RUNNING");
}

function showControls() {
    controlsHidden = false;
    controls?.classList.remove("hidden");

    if (controlToggle) {
        controlToggle.textContent = "HIDE CONTROLS";
        controlToggle.setAttribute("aria-expanded", "true");
    }

    setGlobalStatus("CONTROLS VISIBLE");
}

function toggleControls() {
    controlsHidden ? showControls() : hideControls();
}

startCameraBtn?.addEventListener("click", startCamera);
stopCameraBtn?.addEventListener("click", stopCamera);
frontCameraBtn?.addEventListener("click", () => selectCamera("user"));
backCameraBtn?.addEventListener("click", () => selectCamera("environment"));
switchCameraBtn?.addEventListener("click", switchCamera);
mirrorBtn?.addEventListener("click", toggleMirror);

hideControlsBtn?.addEventListener("click", hideControls);
showControlsBtn?.addEventListener("click", showControls);
controlToggle?.addEventListener("click", toggleControls);

setCameraStatus("OFF");
updateCameraButtons();
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

    console.log("[TRACKING]", message);
}

function clearTrackingDots() {
    if (!landmarkCanvas) return;

    const ctx = landmarkCanvas.getContext("2d");
    if (ctx) {
        ctx.clearRect(
            0, 0,
            landmarkCanvas.width,
            landmarkCanvas.height
        );
    }
}

function resizeTrackingCanvas() {
    if (!landmarkCanvas) return;

    const rect = landmarkCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    landmarkCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    landmarkCanvas.height = Math.max(1, Math.round(rect.height * dpr));
}

async function loadFaceTrackingModel() {
    if (faceLandmarker) return faceLandmarker;

    if (trackingLoading) {
        throw new Error("Tracking model is already loading.");
    }

    trackingLoading = true;
    setTrackingStatus("LOADING LIBRARY");
    setGlobalStatus("LOADING FACE TRACKING LIBRARY...");

    const sources = [
        {
            bundle:
                "https://unpkg.com/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs",
            wasm:
                "https://unpkg.com/@mediapipe/tasks-vision@0.10.21/wasm"
        },
        {
            bundle:
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs",
            wasm:
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
        }
    ];

    let lastError = null;

    try {
        let vision = null;
        let fileset = null;

        for (const source of sources) {
            try {
                setTrackingStatus("TRYING CDN");

                vision = await import(source.bundle);

                fileset =
                    await vision.FilesetResolver.forVisionTasks(
                        source.wasm
                    );

                console.log("MediaPipe loaded from:", source.bundle);
                break;

            } catch (error) {
                lastError = error;
                vision = null;
                fileset = null;

                console.warn("MediaPipe CDN failed:", source.bundle, error);
            }
        }

        if (!vision || !fileset) {
            throw new Error(
                "Both MediaPipe CDN links failed. Check internet access and reload."
            );
        }

        setTrackingStatus("LOADING FACE MODEL");

        const modelURL = new URL(
            "../models/face_landmarker.task",
            import.meta.url
        ).href;

        faceLandmarker =
            await vision.FaceLandmarker.createFromOptions(
                fileset,
                {
                    baseOptions: {
                        modelAssetPath: modelURL
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

        console.error("FACE TRACKING LOAD ERROR:", error, lastError);

        const message = error.message || error.name || "Unknown error";

        setTrackingStatus("ERROR — " + message);
        setGlobalStatus("TRACKING ERROR: " + message);

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

    if (camera.currentTime === lastVideoTime) return;

    lastVideoTime = camera.currentTime;

    try {
        const result = faceLandmarker.detectForVideo(
            camera,
            performance.now()
        );

        lastFaceResult = result;
        window.latestFaceResult = result;

        const faces = result.faceLandmarks || [];
        const requested = personCountSelect
            ? Math.max(1, Math.min(4, Number(personCountSelect.value) || 1))
            : 4;

        const visibleFaces = faces.slice(0, requested);

        if (visibleFaces.length > 0) {
            setTrackingStatus(
                "FACE DETECTED — " + visibleFaces.length
            );
        } else {
            setTrackingStatus("NO FACE");
        }

        if (showFaceLandmarks) {
            drawTrackingDots(visibleFaces);
        } else {
            clearTrackingDots();
        }

    } catch (error) {
        console.error("FACE DETECTION ERROR:", error);
        setTrackingStatus(
            "DETECTION ERROR — " +
            (error.message || error.name || "Unknown error")
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
        const requested = personCountSelect
            ? Math.max(1, Math.min(4, Number(personCountSelect.value) || 1))
            : 4;

        drawTrackingDots(
            (lastFaceResult.faceLandmarks || []).slice(0, requested)
        );
    }
}

function hideTrackingDots() {
    showFaceLandmarks = false;
    clearTrackingDots();
}

startTrackingBtn?.addEventListener("click", startTracking);
stopTrackingBtn?.addEventListener("click", stopTracking);

// Handle duplicate landmark button IDs if the HTML has them twice.
document.querySelectorAll("#showLandmarksBtn").forEach(button => {
    button.addEventListener("click", showTrackingDots);
});

document.querySelectorAll("#hideLandmarksBtn").forEach(button => {
    button.addEventListener("click", hideTrackingDots);
});

personCountSelect?.addEventListener("change", () => {
    setGlobalStatus(
        "FACE DISPLAY LIMIT: " + personCountSelect.value
    );
});

window.addEventListener("resize", () => {
    resizeTrackingCanvas();

    if (showFaceLandmarks && lastFaceResult) {
        showTrackingDots();
    } else {
        clearTrackingDots();
    }
});

setTrackingStatus("OFF");
console.log("AZEEZ AR PART 2 READY");
