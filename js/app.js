
/* =========================================================
   AZEEZ AI AR STUDIO
   APP.JS - PART 1 OF 4
   Camera, visibility controls and slider controls
   ========================================================= */

const $ = (id) => document.getElementById(id);

const camera = $("camera");
const trackingCanvas = $("trackingCanvas");

let cameraStream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;
let cameraStarting = false;
let controlsHidden = false;
let slidersHidden = false;

let mediaRecorder = null;
let recordedChunks = [];

function setStatus(id, message) {
    const element = $(id);
    if (element) element.textContent = message;
}

function setGlobalStatus(message) {
    setStatus("globalStatus", message);
    setStatus("systemStatus", message);
    console.log("[AZEEZ AR]", message);
}

function setCameraStatus(message) {
    setStatus("cameraStatus", message);
    setStatus("cameraStatusChip", message);
}

function applyCameraMirror() {
    if (!camera) return;

    camera.style.transform = mirrorEnabled
        ? "scaleX(-1)"
        : "scaleX(1)";
}

function updateCameraButtons() {
    const mirrorButton = $("mirrorBtn");

    if (mirrorButton) {
        mirrorButton.textContent = mirrorEnabled
            ? "MIRROR: ON"
            : "MIRROR: OFF";
    }
}

async function startCamera() {
    if (cameraStarting) return;

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        setCameraStatus("CAMERA ERROR: Use HTTPS");
        setGlobalStatus(
            "Camera requires a secure HTTPS website."
        );
        return;
    }

    cameraStarting = true;
    setCameraStatus("CAMERA: STARTING");
    setGlobalStatus("Requesting camera permission...");

    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        const constraints = {
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };

        try {
            cameraStream =
                await navigator.mediaDevices.getUserMedia(
                    constraints
                );
        } catch (audioError) {
            // Continue with camera-only access if microphone fails.
            cameraStream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: currentFacingMode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });
        }

        camera.srcObject = cameraStream;
        camera.muted = true;
        camera.playsInline = true;

        await camera.play();

        applyCameraMirror();

        setCameraStatus("CAMERA: ON");
        setGlobalStatus("Camera started successfully.");

        // Part 2 will provide this tracking function.
        if (typeof startTracking === "function") {
            try {
                await startTracking();
            } catch (error) {
                console.error("Tracking start failed:", error);
            }
        }

    } catch (error) {
        console.error("Camera error:", error);

        setCameraStatus("CAMERA: ERROR");
        setGlobalStatus(
            "Camera error: " +
            (error.message || "Permission denied")
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

    if (typeof stopTracking === "function") {
        try {
            stopTracking();
        } catch (error) {
            console.warn("Tracking stop:", error);
        }
    }

    setCameraStatus("CAMERA: OFF");
    setGlobalStatus("Camera stopped.");
}

async function selectCamera(mode) {
    currentFacingMode = mode;

    if (cameraStream) {
        await startCamera();
    } else {
        setGlobalStatus(
            mode === "user"
                ? "Front camera selected."
                : "Back camera selected."
        );
    }
}

async function switchCamera() {
    currentFacingMode =
        currentFacingMode === "user" ? "environment" : "user";

    await startCamera();
}

function toggleMirror() {
    mirrorEnabled = !mirrorEnabled;
    applyCameraMirror();
    updateCameraButtons();

    setGlobalStatus(
        mirrorEnabled ? "Mirror enabled." : "Mirror disabled."
    );
}

/* ---------------------------------------------------------
   TWO SEPARATE HIDE CONTROLS
   --------------------------------------------------------- */

function hideAllControls() {
    controlsHidden = true;
    document.body.classList.add("controls-hidden");

    // Keep the floating SHOW CONTROLS button available.
    const showButton = $("showControlsBtn");
    if (showButton) showButton.style.display = "block";
}

function showAllControls() {
    controlsHidden = false;
    document.body.classList.remove("controls-hidden");

    const showButton = $("showControlsBtn");
    if (showButton) showButton.style.display = "none";

    if (slidersHidden) {
        document.body.classList.add("sliders-hidden");
    }
}

function hideSliders() {
    slidersHidden = true;
    document.body.classList.add("sliders-hidden");

    const button = $("hideSlidersBtn");
    if (button) button.textContent = "SLIDERS HIDDEN";
}

function showSliders() {
    slidersHidden = false;
    document.body.classList.remove("sliders-hidden");

    const button = $("hideSlidersBtn");
    if (button) button.textContent = "HIDE SLIDERS";
}

function toggleSliders() {
    if (slidersHidden) {
        showSliders();
    } else {
        hideSliders();
    }
}

/* ---------------------------------------------------------
   SLIDER VALUE LABELS
   --------------------------------------------------------- */

const sliderDefinitions = [
    ["x", "xValue", ""],
    ["y", "yValue", ""],
    ["z", "zValue", ""],
    ["scale", "scaleValue", "%"],
    ["rotX", "rotXValue", "°"],
    ["rotY", "rotYValue", "°"],
    ["rotZ", "rotZValue", "°"]
];

function updateSliderLabels() {
    sliderDefinitions.forEach(([sliderId, labelId, suffix]) => {
        const slider = $(sliderId);
        const label = $(labelId);

        if (slider && label) {
            label.textContent = slider.value + suffix;
        }
    });
}

function getSliderValue(id, fallback = 0) {
    const slider = $(id);

    if (!slider) return fallback;

    const value = Number(slider.value);

    return Number.isFinite(value) ? value : fallback;
}

function resetSliders() {
    const defaults = {
        x: 0,
        y: 0,
        z: 0,
        scale: 100,
        rotX: 0,
        rotY: 0,
        rotZ: 0
    };

    Object.entries(defaults).forEach(([id, value]) => {
        const slider = $(id);
        if (slider) slider.value = String(value);
    });

    updateSliderLabels();

    // Part 3 will provide the model update function.
    if (typeof updateAllModels === "function") {
        updateAllModels();
    }
}

/* ---------------------------------------------------------
   EVENT CONNECTIONS
   --------------------------------------------------------- */

$("startCameraBtn")?.addEventListener("click", startCamera);
$("stopCameraBtn")?.addEventListener("click", stopCamera);

$("frontCameraBtn")?.addEventListener("click", () => {
    selectCamera("user");
});

$("backCameraBtn")?.addEventListener("click", () => {
    selectCamera("environment");
});

$("switchCameraBtn")?.addEventListener("click", switchCamera);
$("mirrorBtn")?.addEventListener("click", toggleMirror);

$("hideAllBtn")?.addEventListener("click", hideAllControls);
$("showControlsBtn")?.addEventListener("click", showAllControls);
$("hideSlidersBtn")?.addEventListener("click", toggleSliders);
$("showSlidersBtn")?.addEventListener("click", showSliders);
$("resetModelBtn")?.addEventListener("click", resetSliders);

sliderDefinitions.forEach(([sliderId]) => {
    $(sliderId)?.addEventListener("input", updateSliderLabels);
});

updateCameraButtons();
updateSliderLabels();

setCameraStatus("CAMERA: OFF");
setGlobalStatus("APP READY — Start the camera.");
  
