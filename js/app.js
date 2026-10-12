
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
