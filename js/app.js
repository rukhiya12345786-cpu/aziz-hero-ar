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
// CONTROL PANEL HIDE / SHOW

const controls = document.getElementById("controls");
const controlToggle = document.getElementById("controlToggle");
const hideControlsBtn = document.getElementById("hideControlsBtn");
const showControlsBtn = document.getElementById("showControlsBtn");

function hideControls() {
    if (controls) {
        controls.classList.add("hidden");
    }

    if (controlToggle) {
        controlToggle.textContent = "SHOW CONTROLS";
    }
}

function showControls() {
    if (controls) {
        controls.classList.remove("hidden");
    }

    if (controlToggle) {
        controlToggle.textContent = "HIDE CONTROLS";
    }
}

if (controlToggle) {
    controlToggle.addEventListener("click", function() {

        if (controls && controls.classList.contains("hidden")) {
            showControls();
        } else {
            hideControls();
        }

    });
}

if (hideControlsBtn) {
    hideControlsBtn.addEventListener(
        "click",
        hideControls
    );
}

if (showControlsBtn) {
    showControlsBtn.addEventListener(
        "click",
        showControls
    );
}

console.log("CONTROL HIDE / SHOW READY");
// ==========================================
// 3D ENGINE - CUBE TEST
// ==========================================

const threeCanvas = document.getElementById("threeCanvas");

const threeOnBtn = document.getElementById("threeOnBtn");
const threeOffBtn = document.getElementById("threeOffBtn");

const threeStatus = document.getElementById("threeStatus");

let THREE = null;

let renderer3D = null;
let scene3D = null;
let threeCamera = null;

let testCube = null;

let threeEnabled = false;
let animationFrame3D = null;

async function start3D() {

    try {

        if (threeEnabled) {
            return;
        }

        setGlobalStatus("STARTING 3D...");

        // Load Three.js only when 3D is requested.
        if (!THREE) {
            THREE = await import("three");
        }

        create3DScene();

        threeEnabled = true;

        if (threeStatus) {
            threeStatus.textContent = "ON";
        }

        setGlobalStatus("3D ON");

        start3DLoop();

        console.log("3D CUBE ON");

    } catch (error) {

        console.error("3D ERROR:", error);

        if (threeStatus) {
            threeStatus.textContent = "ERROR";
        }

        setGlobalStatus(
            "3D ERROR: " +
            (error.message || "Unknown error")
        );
    }
}

function create3DScene() {

    if (!THREE || !threeCanvas) {
        throw new Error("3D canvas unavailable");
    }

    // Remove any previous 3D system.
    destroy3DScene();

    renderer3D = new THREE.WebGLRenderer({
        canvas: threeCanvas,
        alpha: true,
        antialias: true
    });

    renderer3D.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer3D.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    scene3D = new THREE.Scene();

    threeCamera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );

    threeCamera.position.z = 5;

    const light = new THREE.HemisphereLight(
        0xffffff,
        0x444444,
        2
    );

    scene3D.add(light);

    // Test cube
    const geometry = new THREE.BoxGeometry(
        1.4,
        1.4,
        1.4
    );

    const material = new THREE.MeshNormalMaterial();

    testCube = new THREE.Mesh(
        geometry,
        material
    );

    scene3D.add(testCube);

    threeCanvas.style.display = "block";
}

function start3DLoop() {

    if (animationFrame3D) {
        cancelAnimationFrame(animationFrame3D);
    }

    function render3D() {

        if (!threeEnabled) {
            return;
        }

        animationFrame3D =
            requestAnimationFrame(render3D);

        if (testCube) {

            testCube.rotation.x += 0.01;
            testCube.rotation.y += 0.015;
        }

        if (
            renderer3D &&
            scene3D &&
            threeCamera
        ) {

            renderer3D.render(
                scene3D,
                threeCamera
            );
        }
    }

    render3D();
}

function stop3D() {

    threeEnabled = false;

    // Stop rotation/render loop.
    if (animationFrame3D) {

        cancelAnimationFrame(
            animationFrame3D
        );

        animationFrame3D = null;
    }

    destroy3DScene();

    if (threeStatus) {
        threeStatus.textContent = "OFF";
    }

    setGlobalStatus("3D OFF");

    console.log("3D CUBE OFF");
}

function destroy3DScene() {

    if (testCube) {

        if (scene3D) {
            scene3D.remove(testCube);
        }

        if (testCube.geometry) {
            testCube.geometry.dispose();
        }

        if (testCube.material) {

            if (Array.isArray(testCube.material)) {

                testCube.material.forEach(
                    material => material.dispose()
                );

            } else {

                testCube.material.dispose();
            }
        }

        testCube = null;
    }

    if (scene3D) {

        scene3D.traverse(object => {

            if (object.geometry) {
                object.geometry.dispose();
            }

            if (object.material) {

                if (Array.isArray(object.material)) {

                    object.material.forEach(
                        material => material.dispose()
                    );

                } else {

                    object.material.dispose();
                }
            }
        });

        scene3D.clear();
    }

    if (renderer3D) {

        renderer3D.dispose();

        renderer3D = null;
    }

    scene3D = null;
    threeCamera = null;

    if (threeCanvas) {

        const context =
            threeCanvas.getContext("webgl2") ||
            threeCanvas.getContext("webgl");

        if (context) {
            // Canvas remains available for the next 3D start.
        }

        threeCanvas.style.display = "none";
    }
}

function resize3D() {

    if (
        !renderer3D ||
        !threeCamera
    ) {
        return;
    }

    threeCamera.aspect =
        window.innerWidth /
        window.innerHeight;

    threeCamera.updateProjectionMatrix();

    renderer3D.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );
}

window.addEventListener(
    "resize",
    resize3D
);

if (threeOnBtn) {

    threeOnBtn.addEventListener(
        "click",
        start3D
    );
}

if (threeOffBtn) {

    threeOffBtn.addEventListener(
        "click",
        stop3D
    );
}

if (threeStatus) {
    threeStatus.textContent = "OFF";
}

if (threeCanvas) {
    threeCanvas.style.display = "none";
}

console.log("3D ENGINE READY");
