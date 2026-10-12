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
// ==========================================
// PART 3 OF 4 — 3D FACE MESH AND MODEL IMPORT
// ==========================================

let THREE = null;
let scene3D = null;
let camera3D = null;
let renderer3D = null;
let threeReady = false;
let threeStarting = false;
let animation3D = null;

const threeCanvas = document.getElementById("threeCanvas");
const threeOnBtn = document.getElementById("threeOnBtn");
const threeOffBtn = document.getElementById("threeOffBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const modelSlots = [null, null, null, null];
const modelInputs = [
    document.getElementById("model1"),
    document.getElementById("model2"),
    document.getElementById("model3"),
    document.getElementById("model4")
];

const modelLoaders = {};
let activeModelSlot = 0;

const modelControls = {
    scale: document.getElementById("scale"),
    width: document.getElementById("modelWidth"),
    height: document.getElementById("modelHeight"),
    x: document.getElementById("posX"),
    y: document.getElementById("posY"),
    z: document.getElementById("posZ"),
    rx: document.getElementById("rotX"),
    ry: document.getElementById("rotY"),
    rz: document.getElementById("rotZ")
};

function set3DStatus(message) {
    const status = document.getElementById("threeStatus");
    const chip = document.getElementById("threeStatusChip");

    if (status) status.textContent = "3D: " + message;
    if (chip) chip.textContent = "3D: " + message;

    console.log("[3D]", message);
}

async function initialize3D() {
    if (threeReady) return true;
    if (threeStarting) return false;

    threeStarting = true;
    set3DStatus("LOADING");

    try {
        THREE = await import("three");

        const { GLTFLoader } =
            await import("three/addons/loaders/GLTFLoader.js");
        const { OBJLoader } =
            await import("three/addons/loaders/OBJLoader.js");
        const { FBXLoader } =
            await import("three/addons/loaders/FBXLoader.js");

        modelLoaders.gltf = new GLTFLoader();
        modelLoaders.obj = new OBJLoader();
        modelLoaders.fbx = new FBXLoader();

        scene3D = new THREE.Scene();

        camera3D = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0.01, 100
        );
        camera3D.position.set(0, 0, 5);

        renderer3D = new THREE.WebGLRenderer({
            canvas: threeCanvas,
            alpha: true,
            antialias: true
        });

        renderer3D.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        );

        renderer3D.setSize(
            Math.max(1, threeCanvas.clientWidth),
            Math.max(1, threeCanvas.clientHeight)
        );

        scene3D.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));

        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(0, 2, 5);
        scene3D.add(light);

        threeReady = true;
        set3DStatus("READY");
        animate3D();

        return true;

    } catch (error) {
        console.error("3D INITIALIZATION ERROR:", error);
        set3DStatus("ERROR — " + (error.message || error.name));
        setGlobalStatus("3D ERROR: " + (error.message || error.name));
        return false;

    } finally {
        threeStarting = false;
    }
}

function resize3D() {
    if (!renderer3D || !threeCanvas) return;

    renderer3D.setSize(
        Math.max(1, threeCanvas.clientWidth),
        Math.max(1, threeCanvas.clientHeight)
    );
}

function getActiveModel() {
    return modelSlots[activeModelSlot];
}

function readControlValue(name, fallback) {
    const control = modelControls[name];
    return control ? Number(control.value) : fallback;
}

function applyModelControls(slot) {
    if (!slot || !slot.root) return;

    const scale = readControlValue("scale", 100) / 100;
    const width = readControlValue("width", 100) / 100;
    const height = readControlValue("height", 100) / 100;

    slot.root.scale.set(
        slot.baseScale * scale * width,
        slot.baseScale * scale * height,
        slot.baseScale * scale
    );

    slot.root.position.x = readControlValue("x", 0) / 100;
    slot.root.position.y = readControlValue("y", 0) / 100;
    slot.userZ = readControlValue("z", 0) / 100;

    slot.root.rotation.x =
        THREE.MathUtils.degToRad(readControlValue("rx", 0));

    slot.root.rotation.y =
        THREE.MathUtils.degToRad(readControlValue("ry", 0));

    slot.root.rotation.z =
        THREE.MathUtils.degToRad(readControlValue("rz", 0));
}

async function importModelFile(file, slotIndex) {
    if (!file) return;

    const ready = await initialize3D();
    if (!ready) return;

    const extension = file.name.split(".").pop().toLowerCase();
    const objectURL = URL.createObjectURL(file);

    set3DStatus("IMPORTING " + file.name);

    try {
        let object;

        if (extension === "glb" || extension === "gltf") {
            const result = await new Promise((resolve, reject) => {
                modelLoaders.gltf.load(
                    objectURL,
                    resolve,
                    undefined,
                    reject
                );
            });

            object = result.scene;

        } else if (extension === "obj") {
            object = modelLoaders.obj.parse(await file.text());

        } else if (extension === "fbx") {
            object = modelLoaders.fbx.parse(
                await file.arrayBuffer(),
                ""
            );

        } else {
            throw new Error("Choose GLB, GLTF, OBJ, or FBX.");
        }

        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z);

        if (!Number.isFinite(largest) || largest <= 0) {
            throw new Error("The model has no usable 3D geometry.");
        }

        object.position.sub(center);

        const fitScale = 1.25 / largest;
        object.scale.setScalar(fitScale);

        const root = new THREE.Group();
        root.add(object);
        scene3D.add(root);

        const old = modelSlots[slotIndex];
        if (old && old.root) scene3D.remove(old.root);

        modelSlots[slotIndex] = {
            root,
            baseScale: 1,
            userZ: 0,
            loadedName: file.name
        };

        activeModelSlot = slotIndex;
        applyModelControls(modelSlots[slotIndex]);

        set3DStatus("MODEL LOADED — PERSON " + (slotIndex + 1));
        setGlobalStatus("3D MODEL IMPORTED: " + file.name);

    } catch (error) {
        console.error("MODEL IMPORT ERROR:", error);

        set3DStatus("IMPORT ERROR — " + (error.message || error.name));
        setGlobalStatus("MODEL ERROR: " + (error.message || error.name));

    } finally {
        URL.revokeObjectURL(objectURL);
    }
}

function animate3D() {
    animation3D = requestAnimationFrame(animate3D);

    if (!threeReady || !renderer3D || !scene3D || !camera3D) return;

    const faces = window.latestFaceResult?.faceLandmarks || [];

    // Attach each imported model to its matching detected face.
    modelSlots.forEach((slot, index) => {
        if (!slot || !slot.root) return;

        const face = faces[index];

        if (!face) {
            slot.root.visible = false;
            return;
        }

        slot.root.visible = true;

        // Face landmark positions are normalized from 0 to 1.
        const leftEye = face[33];
        const rightEye = face[263];
        const nose = face[1];
        const forehead = face[10];
        const chin = face[152];

        if (!leftEye || !rightEye || !nose || !forehead || !chin) {
            return;
        }

        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (forehead.y + chin.y) / 2;

        slot.root.position.x =
            (centerX - 0.5) * 2 +
            readControlValue("x", 0) / 100;

        slot.root.position.y =
            (0.5 - centerY) * 2 +
            readControlValue("y", 0) / 100;

        slot.root.position.z = readControlValue("z", 0) / 100;

        // Approximate head roll and yaw from eye and nose landmarks.
        const eyeAngle = Math.atan2(
            rightEye.y - leftEye.y,
            rightEye.x - leftEye.x
        );

        const eyeMidX = (leftEye.x + rightEye.x) / 2;
        const eyeDistance = Math.max(
            0.001,
            Math.abs(rightEye.x - leftEye.x)
        );

        const yawEstimate =
            (nose.x - eyeMidX) / eyeDistance;

        slot.root.rotation.z =
            eyeAngle + THREE.MathUtils.degToRad(
                readControlValue("rz", 0)
            );

        slot.root.rotation.y =
            THREE.MathUtils.clamp(yawEstimate, -0.8, 0.8) +
            THREE.MathUtils.degToRad(readControlValue("ry", 0));

        slot.root.rotation.x =
            THREE.MathUtils.degToRad(readControlValue("rx", 0));

        const userScale = readControlValue("scale", 100) / 100;
        const width = readControlValue("width", 100) / 100;
        const height = readControlValue("height", 100) / 100;

        slot.root.scale.set(
            1.25 * userScale * width,
            1.25 * userScale * height,
            1.25 * userScale
        );
    });

    renderer3D.render(scene3D, camera3D);
}

function resetActiveModel() {
    const slot = getActiveModel();
    if (!slot) return;

    Object.entries(modelControls).forEach(([name, control]) => {
        if (!control) return;

        const defaults = {
            scale: 100,
            width: 100,
            height: 100,
            x: 0, y: 0, z: 0,
            rx: 0, ry: 0, rz: 0
        };

        control.value = defaults[name];

        const valueLabel = document.getElementById(
            name === "width" ? "modelWidthValue" :
            name === "height" ? "modelHeightValue" :
            name === "x" ? "posXValue" :
            name === "y" ? "posYValue" :
            name === "z" ? "posZValue" :
            name === "rx" ? "rotXValue" :
            name === "ry" ? "rotYValue" :
            name === "rz" ? "rotZValue" :
            name + "Value"
        );

        if (valueLabel) valueLabel.textContent = control.value;
    });

    applyModelControls(slot);
}

modelInputs.forEach((input, index) => {
    input?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) importModelFile(file, index);
    });
});

for (let index = 0; index < 4; index++) {
    const selectButton = document.getElementById(
        "selectModel" + (index + 1) + "Btn"
    );

    const clearButton = document.getElementById(
        "clearModel" + (index + 1) + "Btn"
    );

    selectButton?.addEventListener("click", () => {
        activeModelSlot = index;
        modelInputs[index]?.click();
    });

    clearButton?.addEventListener("click", () => {
        const slot = modelSlots[index];
        if (slot?.root && scene3D) scene3D.remove(slot.root);

        modelSlots[index] = null;
        set3DStatus("PERSON " + (index + 1) + " MODEL CLEARED");
    });
}

const activePersonSelect = document.getElementById("activePerson");

activePersonSelect?.addEventListener("change", () => {
    activeModelSlot = Math.max(
        0,
        Math.min(3, Number(activePersonSelect.value) - 1)
    );

    applyModelControls(getActiveModel());
});

Object.entries(modelControls).forEach(([name, control]) => {
    control?.addEventListener("input", () => {
        const slot = getActiveModel();
        applyModelControls(slot);

        const labelId =
            name === "width" ? "modelWidthValue" :
            name === "height" ? "modelHeightValue" :
            name === "x" ? "posXValue" :
            name === "y" ? "posYValue" :
            name === "z" ? "posZValue" :
            name === "rx" ? "rotXValue" :
            name === "ry" ? "rotYValue" :
            name === "rz" ? "rotZValue" :
            name + "Value";

        const label = document.getElementById(labelId);
        if (label) label.textContent = control.value;
    });
});

threeOnBtn?.addEventListener("click", async () => {
    await initialize3D();
    set3DStatus("ON");
});

threeOffBtn?.addEventListener("click", () => {
    modelSlots.forEach(slot => {
        if (slot?.root) slot.root.visible = false;
    });
    set3DStatus("MODELS HIDDEN");
});

document.getElementById("showModelsBtn")?.addEventListener("click", () => {
    modelSlots.forEach(slot => {
        if (slot?.root) slot.root.visible = true;
    });
    set3DStatus("MODELS SHOWN");
});

document.getElementById("hideModelsBtn")?.addEventListener("click", () => {
    modelSlots.forEach(slot => {
        if (slot?.root) slot.root.visible = false;
    });
    set3DStatus("MODELS HIDDEN");
});

document.getElementById("headFitBtn")?.addEventListener("click", () => {
    const scale = modelControls.scale;
    if (scale) {
        scale.value = 100;
        scale.dispatchEvent(new Event("input"));
    }
});

document.getElementById("resetModelBtn")?.addEventListener(
    "click",
    resetActiveModel
);

resetAllBtn?.addEventListener("click", resetActiveModel);

window.addEventListener("resize", resize3D);

set3DStatus("OFF — IMPORT A MODEL TO BEGIN");
console.log("AZEEZ AR PART 3 READY");
