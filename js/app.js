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
