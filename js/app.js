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
