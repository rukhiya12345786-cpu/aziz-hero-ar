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
/* =========================================================
   AZEEZ AI AR STUDIO - PART 3
   3D renderer, model import, head attachment and controls
   ========================================================= */

let ar3THREE = null;
let ar3Scene = null;
let ar3Camera = null;
let ar3Renderer = null;
let ar3Canvas = null;
let ar3AnimationFrame = 0;
let ar3Ready = false;
let ar3Loading = false;

const ar3ModelSlots = [null, null, null, null];
const ar3ObjectUrls = new Set();

function ar3Status(message) {
    const ids = [
        "globalStatus",
        "modelStatus",
        "threeStatus",
        "cameraStatusChip"
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = message;
    });

    if (typeof setGlobalStatus === "function") {
        try {
            setGlobalStatus(message);
        } catch (_) {}
    }

    console.log("[AZEEZ AR]", message);
}

function ar3GetNumber(ids, fallback = 0) {
    for (const id of ids) {
        const el = document.getElementById(id);

        if (el && el.value !== "") {
            const value = Number(el.value);
            if (Number.isFinite(value)) return value;
        }
    }

    return fallback;
}

function ar3GetControl(name, fallback = 0) {
    const names = {
        x: ["x", "xSlider", "positionX", "modelX"],
        y: ["y", "ySlider", "positionY", "modelY"],
        z: ["z", "zSlider", "positionZ", "modelZ"],
        scale: ["scale", "scaleSlider", "modelScale"],
        rotX: ["rotX", "rotationX", "rotateX"],
        rotY: ["rotY", "rotationY", "rotateY"],
        rotZ: ["rotZ", "rotationZ", "rotateZ"]
    };

    return ar3GetNumber(names[name] || [name], fallback);
}

function ar3FindCanvas() {
    let canvas = document.getElementById("threeCanvas");

    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "threeCanvas";
        document.body.appendChild(canvas);
    }

    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "5";
    canvas.style.pointerEvents = "none";
    canvas.style.display = "block";
    canvas.style.background = "transparent";

    return canvas;
}

function ar3Resize() {
    if (!ar3Renderer || !ar3Camera) return;

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const aspect = width / height;

    ar3Camera.left = -aspect;
    ar3Camera.right = aspect;
    ar3Camera.top = 1;
    ar3Camera.bottom = -1;
    ar3Camera.near = 0.01;
    ar3Camera.far = 100;
    ar3Camera.updateProjectionMatrix();

    ar3Renderer.setSize(width, height, false);
    ar3Renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );
}

async function ar3Initialize() {
    if (ar3Ready) return true;
    if (ar3Loading) return false;

    ar3Loading = true;
    ar3Status("Loading 3D engine...");

    try {
        ar3THREE = await import("three");

        const THREE = ar3THREE;
        ar3Canvas = ar3FindCanvas();

        ar3Scene = new THREE.Scene();

        ar3Camera = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0.01, 100
        );
        ar3Camera.position.set(0, 0, 10);
        ar3Camera.lookAt(0, 0, 0);

        ar3Renderer = new THREE.WebGLRenderer({
            canvas: ar3Canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });

        ar3Renderer.setClearColor(0x000000, 0);
        ar3Renderer.outputColorSpace = THREE.SRGBColorSpace;
        ar3Renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        );

        ar3Scene.add(
            new THREE.HemisphereLight(0xffffff, 0x444455, 2)
        );

        const keyLight = new THREE.DirectionalLight(
            0xffffff, 2.5
        );
        keyLight.position.set(2, 4, 8);
        ar3Scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(
            0xffffff, 1.2
        );
        fillLight.position.set(-4, 1, 3);
        ar3Scene.add(fillLight);

        ar3Resize();
        window.addEventListener("resize", ar3Resize);

        ar3Ready = true;
        ar3Status("3D engine ready. Import a model.");
        return true;

    } catch (error) {
        console.error("3D initialization failed:", error);
        ar3Status("3D ERROR: " + (error.message || error));
        return false;

    } finally {
        ar3Loading = false;
    }
}

/* ---------------------------------------------------------
   MODEL LOADING
   --------------------------------------------------------- */

async function ar3Loaders() {
    const [
        gltfModule,
        objModule,
        fbxModule
    ] = await Promise.all([
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/loaders/OBJLoader.js"),
        import("three/addons/loaders/FBXLoader.js")
    ]);

    return {
        gltf: new gltfModule.GLTFLoader(),
        obj: new objModule.OBJLoader(),
        fbx: new fbxModule.FBXLoader()
    };
}

function ar3NormalizeModel(object) {
    const THREE = ar3THREE;

    object.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(object);

    if (box.isEmpty()) {
        throw new Error("The selected model is empty.");
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const largest = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(largest) || largest <= 0) {
        throw new Error("Could not measure the model.");
    }

    object.position.sub(center);
    object.scale.multiplyScalar(1 / largest);

    object.traverse(child => {
        if (child.isMesh) {
            child.frustumCulled = false;

            if (child.material) {
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                materials.forEach(material => {
                    material.side = THREE.DoubleSide;
                    material.needsUpdate = true;
                });
            }
        }
    });

    return object;
}

function ar3CreateSlot(object, slotIndex) {
    const THREE = ar3THREE;

    const root = new THREE.Group();
    root.name = "AzeezARModelSlot" + (slotIndex + 1);

    const normalized = ar3NormalizeModel(object);
    root.add(normalized);
    ar3Scene.add(root);

    return {
        root,
        object: normalized,
        slotIndex,
        faceIndex: slotIndex,
        lastX: 0,
        lastY: 0,
        lastScale: 0.55
    };
}

async function ar3ImportModel(file, slotIndex = 0) {
    if (!file) return;

    if (slotIndex < 0 || slotIndex > 3) {
        ar3Status("Choose a model slot from 1 to 4.");
        return;
    }

    const ready = await ar3Initialize();
    if (!ready) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["glb", "gltf", "obj", "fbx"].includes(extension)) {
        ar3Status("Unsupported file. Choose GLB, GLTF, OBJ or FBX.");
        return;
    }

    ar3Status("Loading model: " + file.name);

    try {
        const loaders = await ar3Loaders();
        let object;

        if (extension === "glb" || extension === "gltf") {
            const url = URL.createObjectURL(file);
            ar3ObjectUrls.add(url);

            object = await new Promise((resolve, reject) => {
                loaders.gltf.load(
                    url,
                    result => resolve(result.scene),
                    undefined,
                    reject
                );
            });

            URL.revokeObjectURL(url);
            ar3ObjectUrls.delete(url);

        } else if (extension === "obj") {
            const text = await file.text();
            object = loaders.obj.parse(text);

        } else if (extension === "fbx") {
            const buffer = await file.arrayBuffer();
            object = loaders.fbx.parse(buffer, "");
        }

        if (!object) {
            throw new Error("The model could not be opened.");
        }

        const newSlot = ar3CreateSlot(object, slotIndex);

        if (ar3ModelSlots[slotIndex]) {
            ar3Scene.remove(ar3ModelSlots[slotIndex].root);

            ar3ModelSlots[slotIndex].root.traverse(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                }
            });
        }

        ar3ModelSlots[slotIndex] = newSlot;

        ar3ApplyModelControls(newSlot);
        ar3Status(
            "MODEL " + (slotIndex + 1) +
            " LOADED: " + file.name
        );

    } catch (error) {
        console.error("Model import failed:", error);
        ar3Status(
            "MODEL ERROR: " + (error.message || "Import failed")
        );
    }
}

/* ---------------------------------------------------------
   CONNECT EXISTING MODEL FILE INPUTS
   --------------------------------------------------------- */

function ar3ConnectFileInputs() {
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById("model" + (i + 1));

        if (!input || input.dataset.ar3Connected === "yes") {
            continue;
        }

        input.dataset.ar3Connected = "yes";

        input.addEventListener("change", event => {
            const file = event.target.files?.[0];
            if (file) ar3ImportModel(file, i);

            // Allow selecting the same file again.
            event.target.value = "";
        });
    }

    // Support additional file inputs marked with data-model-slot.
    document.querySelectorAll("[data-model-slot]").forEach(input => {
        if (input.dataset.ar3Connected === "yes") return;

        input.dataset.ar3Connected = "yes";

        input.addEventListener("change", event => {
            const file = event.target.files?.[0];
            const slot = Number(input.dataset.modelSlot) - 1;

            if (file && slot >= 0 && slot < 4) {
                ar3ImportModel(file, slot);
            }

            input.value = "";
        });
    });
}

/* ---------------------------------------------------------
   FACE TRACKING CONNECTION
   Uses landmarks provided by Part 2.
   --------------------------------------------------------- */

function ar3GetFaceList() {
    const result = window.latestFaceResult;

    if (!result) return [];

    if (Array.isArray(result.faceLandmarks)) {
        return result.faceLandmarks;
    }

    if (result.landmarks && Array.isArray(result.landmarks)) {
        return result.landmarks;
    }

    return [];
}

function ar3Landmark(face, index) {
    const point = face?.[index];

    if (!point) return null;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
    }

    return point;
}

function ar3ApplyModelControls(slot) {
    if (!slot || !slot.root) return;

    const THREE = ar3THREE;

    const x = ar3GetControl("x", 0) / 100;
    const y = ar3GetControl("y", 0) / 100;
    const z = ar3GetControl("z", 0) / 100;

    const scalePercent = ar3GetControl("scale", 100);
    const scaleMultiplier = Math.max(
        0.01,
        Math.min(10, scalePercent / 100)
    );

    const rx = THREE.MathUtils.degToRad(
        ar3GetControl("rotX", 0)
    );
    const ry = THREE.MathUtils.degToRad(
        ar3GetControl("rotY", 0)
    );
    const rz = THREE.MathUtils.degToRad(
        ar3GetControl("rotZ", 0)
    );

    slot.root.position.x += x;
    slot.root.position.y += y;
    slot.root.position.z = z;

    slot.root.scale.setScalar(
        slot.lastScale * scaleMultiplier
    );

    slot.root.rotation.set(rx, ry, rz);
}

function ar3UpdateSlotFromFace(slot, face) {
    const THREE = ar3THREE;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const aspect = width / height;

    const leftEye = ar3Landmark(face, 33);
    const rightEye = ar3Landmark(face, 263);
    const forehead = ar3Landmark(face, 10);
    const chin = ar3Landmark(face, 152);
    const nose = ar3Landmark(face, 1);

    if (!leftEye || !rightEye || !forehead || !chin) {
        return;
    }

    const centerX = (leftEye.x + rightEye.x) / 2;
    const centerY = (forehead.y + chin.y) / 2;

    const targetX = (centerX - 0.5) * 2 * aspect;
    const targetY = (0.5 - centerY) * 2;

    const eyeDX = rightEye.x - leftEye.x;
    const eyeDY = rightEye.y - leftEye.y;
    const eyeDistance = Math.sqrt(
        eyeDX * eyeDX + eyeDY * eyeDY
    );

    const targetScale = Math.max(
        0.08,
        Math.min(1.5, eyeDistance * 2 * aspect * 2.5)
    );

    const roll = Math.atan2(eyeDY, eyeDX);

    let yaw = 0;

    if (nose) {
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const relativeNose = nose.x - eyeCenterX;
        yaw = THREE.MathUtils.clamp(
            relativeNose * 2.2,
            -0.9,
            0.9
        );
    }

    // Keep the imported model visible while tracking updates.
    slot.root.visible = true;

    // Smooth small movements to reduce jitter.
    slot.lastX += (targetX - slot.lastX) * 0.35;
    slot.lastY += (targetY - slot.lastY) * 0.35;
    slot.lastScale += (targetScale - slot.lastScale) * 0.25;

    const offsetX = ar3GetControl("x", 0) / 100;
    const offsetY = ar3GetControl("y", 0) / 100;
    const offsetZ = ar3GetControl("z", 0) / 100;

    slot.root.position.set(
        slot.lastX + offsetX,
        slot.lastY + offsetY,
        offsetZ
    );

    const scaleMultiplier = Math.max(
        0.01,
        Math.min(10, ar3GetControl("scale", 100) / 100)
    );

    slot.root.scale.setScalar(
        slot.lastScale * scaleMultiplier
    );

    slot.root.rotation.set(
        THREE.MathUtils.degToRad(ar3GetControl("rotX", 0)),
        yaw + THREE.MathUtils.degToRad(
            ar3GetControl("rotY", 0)
        ),
        -roll + THREE.MathUtils.degToRad(
            ar3GetControl("rotZ", 0)
        )
    );
}

/* ---------------------------------------------------------
   RENDER LOOP
   --------------------------------------------------------- */

function ar3Animate() {
    ar3AnimationFrame = requestAnimationFrame(ar3Animate);

    if (!ar3Ready || !ar3Renderer || !ar3Scene || !ar3Camera) {
        return;
    }

    const faces = ar3GetFaceList();

    ar3ModelSlots.forEach((slot, index) => {
        if (!slot) return;

        // Do not hide the model when tracking temporarily loses a face.
        slot.root.visible = true;

        const face = faces[index];

        if (face) {
            ar3UpdateSlotFromFace(slot, face);
        } else {
            // Keep the model available at the last known position.
            // This also makes it visible immediately after import.
            slot.root.position.z = ar3GetControl("z", 0) / 100;
        }
    });

    ar3Renderer.render(ar3Scene, ar3Camera);
}

/* ---------------------------------------------------------
   OPTIONAL MANUAL IMPORT BUTTONS
   --------------------------------------------------------- */

function ar3ConnectManualImportButtons() {
    for (let i = 0; i < 4; i++) {
        const button = document.getElementById(
            "importModel" + (i + 1) + "Btn"
        );

        if (!button || button.dataset.ar3Connected === "yes") {
            continue;
        }

        button.dataset.ar3Connected = "yes";

        button.addEventListener("click", () => {
            let input = document.getElementById(
                "model" + (i + 1)
            );

            if (input && input.type === "file") {
                input.click();
                return;
            }

            const picker = document.createElement("input");
            picker.type = "file";
            picker.accept = ".glb,.gltf,.obj,.fbx";
            picker.style.display = "none";
            document.body.appendChild(picker);

            picker.addEventListener("change", () => {
                const file = picker.files?.[0];
                if (file) ar3ImportModel(file, i);
                picker.remove();
            });

            picker.click();
        });
    }
}

/* ---------------------------------------------------------
   START PART 3
   --------------------------------------------------------- */

async function ar3Start() {
    const ready = await ar3Initialize();
    if (!ready) return;

    ar3ConnectFileInputs();
    ar3ConnectManualImportButtons();

    if (!ar3AnimationFrame) {
        ar3Animate();
    }
}

ar3Start().catch(error => {
    console.error("AR 3D startup failed:", error);
    ar3Status("START ERROR: " + (error.message || error));
});
        
