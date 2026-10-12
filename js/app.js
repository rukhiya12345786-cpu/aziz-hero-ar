import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js";

const $ = (id) => document.getElementById(id);

const video = $("cameraVideo");
const canvas = $("threeCanvas");
const faceCanvas = $("faceCanvas");
const stage = $("cameraStage");

const state = {
  stream: null,
  facingMode: "user",
  mirror: false,
  tracking: false,
  detecting: false,
  landmarker: null,
  animationId: null,
  meshVisible: false,
  landmarksVisible: false,
  autoHeadFit: true,
  expressionTracking: true,
  model: null,
  recorder: null,
  recordedChunks: [],
  recordingStream: null,
  cameraDevices: [],
  activeDeviceId: null,
  settings: {},
  lastFace: null,
  lastVideoTime: -1,
  destroyed: false
};

let scene;
let camera;
let renderer;
let ambientLight;
let keyLight;
let headAnchor;
let modelOffset;
let facePoints;
let faceLine;
let resizeObserver;

const defaultSettings = {
  meshSize: 1,
  meshX: 0,
  meshY: 0,
  meshZ: 0,
  modelScale: 1,
  modelX: 0,
  modelY: 0,
  modelZ: 0,
  modelPitch: 0,
  modelYaw: 0,
  modelRoll: 0,
  headFit: 1,
  opacity: 1
};

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setGeneral(message) {
  setStatus("generalStatus", message);
}

function setButtonText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function setButtonEnabled(id, enabled) {
  const element = $(id);
  if (element) element.disabled = !enabled;
}

function getNumber(id, fallback = 0) {
  const element = $(id);
  if (!element) return fallback;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function updateSliderValue(id) {
  const slider = $(id);
  const output = $(`${id}Value`);
  if (!slider || !output) return;

  const value = Number(slider.value);
  output.textContent = Number.isFinite(value)
    ? String(Math.round(value * 100) / 100)
    : slider.value;
}

function setSlider(id, value) {
  const slider = $(id);
  if (!slider) return;
  slider.value = String(value);
  updateSliderValue(id);
}

function applyPanelVisibility() {
  const controls = $("topControls");
  const sliders = $("sliderOverlay");
  const sliderButton = $("toggleSlidersBtn");
  const controlsButton = $("toggleControlsBtn");

  if (sliders) {
    sliders.classList.toggle("is-hidden", state.slidersHidden === true);
  }

  if (controls) {
    controls.classList.toggle("is-hidden", state.controlsHidden === true);
  }

  if (sliderButton) {
    sliderButton.textContent = state.slidersHidden
      ? "SHOW SLIDERS"
      : "HIDE SLIDERS";
  }

  if (controlsButton) {
    controlsButton.textContent = state.controlsHidden
      ? "SHOW CONTROLS"
      : "HIDE CONTROLS";
  }
}

function resizeScene() {
  if (!renderer || !camera || !stage) return;

  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (faceCanvas) {
    faceCanvas.width = Math.round(width * Math.min(window.devicePixelRatio || 1, 2));
    faceCanvas.height = Math.round(height * Math.min(window.devicePixelRatio || 1, 2));
    faceCanvas.style.width = `${width}px`;
    faceCanvas.style.height = `${height}px`;
  }
}

function createScene() {
  if (!canvas || !stage) {
    throw new Error("Required 3D canvas or camera stage is missing.");
  }

  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  ambientLight = new THREE.HemisphereLight(0xffffff, 0x505060, 2.2);
  scene.add(ambientLight);

  keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(2, 3, 5);
  scene.add(keyLight);

  headAnchor = new THREE.Group();
  headAnchor.name = "HeadAnchor";
  scene.add(headAnchor);

  modelOffset = new THREE.Group();
  modelOffset.name = "ModelOffset";
  headAnchor.add(modelOffset);

  facePoints = new THREE.Group();
  facePoints.name = "FaceLandmarks";
  headAnchor.add(facePoints);

  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([], 3)
  );

  const pointsMaterial = new THREE.PointsMaterial({
    color: 0x00ff88,
    size: 0.018,
    sizeAttenuation: true
  });

  const pointsObject = new THREE.Points(pointsGeometry, pointsMaterial);
  pointsObject.name = "LandmarkPoints";
  pointsObject.visible = false;
  facePoints.add(pointsObject);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.65
  });

  const lineGeometry = new THREE.BufferGeometry();
  faceLine = new THREE.Line(lineGeometry, lineMaterial);
  faceLine.name = "FaceOutline";
  faceLine.visible = false;
  facePoints.add(faceLine);

  resizeScene();

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(resizeScene);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener("resize", resizeScene);
  }

  renderer.setAnimationLoop(() => {
    if (state.destroyed) return;
    renderer.render(scene, camera);
  });

  setStatus("modelStatus", "No 3D model loaded");
  setStatus("faceStatus", "Face tracking not started");
  setStatus("cameraStatus", "Camera not started");
}

function clearFaceDrawing() {
  if (faceCanvas) {
    const context = faceCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    }
  }

  if (facePoints) {
    facePoints.visible = state.landmarksVisible || state.meshVisible;
  }
}

function disposeObject(object) {
  if (!object) return;

  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        if (material.map) material.map.dispose();
        material.dispose();
      }
    }
  });
}

function removeCurrentModel() {
  if (!state.model) return;

  modelOffset.remove(state.model);
  disposeObject(state.model);
  state.model = null;

  setStatus("modelStatus", "No 3D model loaded");
}

function applyModelTransform() {
  if (!modelOffset) return;

  modelOffset.position.set(
    getNumber("modelXSlider", defaultSettings.modelX),
    getNumber("modelYSlider", defaultSettings.modelY),
    getNumber("modelZSlider", defaultSettings.modelZ)
  );

  modelOffset.rotation.set(
    THREE.MathUtils.degToRad(
      getNumber("modelPitchSlider", defaultSettings.modelPitch)
    ),
    THREE.MathUtils.degToRad(
      getNumber("modelYawSlider", defaultSettings.modelYaw)
    ),
    THREE.MathUtils.degToRad(
      getNumber("modelRollSlider", defaultSettings.modelRoll)
    )
  );

  const scale = Math.max(
    0.001,
    getNumber("modelScaleSlider", defaultSettings.modelScale)
  );

  modelOffset.scale.setScalar(scale);

  if (state.model) {
    const opacity = THREE.MathUtils.clamp(
      getNumber("opacitySlider", defaultSettings.opacity),
      0,
      1
    );

    state.model.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity >= 1;
        material.needsUpdate = true;
      }
    });
  }
}

function applyHeadSettings() {
  if (!headAnchor) return;

  headAnchor.scale.setScalar(
    Math.max(0.01, getNumber("meshSizeSlider", defaultSettings.meshSize))
  );

  headAnchor.position.set(
    getNumber("meshXSlider", defaultSettings.meshX),
    getNumber("meshYSlider", defaultSettings.meshY),
    getNumber("meshZSlider", defaultSettings.meshZ)
  );
}

function applyAllTransforms() {
  applyHeadSettings();
  applyModelTransform();
}

function initializeDefaultSliders() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const sliderIds = {
      meshSize: "meshSizeSlider",
      meshX: "meshXSlider",
      meshY: "meshYSlider",
      meshZ: "meshZSlider",
      modelScale: "modelScaleSlider",
      modelX: "modelXSlider",
      modelY: "modelYSlider",
      modelZ: "modelZSlider",
      modelPitch: "modelPitchSlider",
      modelYaw: "modelYawSlider",
      modelRoll: "modelRollSlider",
      headFit: "headFitSlider",
      opacity: "opacitySlider"
    };

    const sliderId = sliderIds[key];
    if (sliderId && $(sliderId)) {
      setSlider(sliderId, value);
    }
  }

  applyAllTransforms();
}

function initializeApp() {
  try {
    createScene();
    initializeDefaultSliders();
    applyPanelVisibility();
    setGeneral("3D scene ready. Start the camera to continue.");
  } catch (error) {
    console.error("App initialization error:", error);
    setGeneral(`Initialization error: ${error.message}`);
  }
}

initializeApp();

async function listCameraDevices() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error("Camera selection is not supported by this browser.");
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    state.cameraDevices = devices.filter((device) => device.kind === "videoinput");

    const picker = $("pickCameraBtn");
    if (picker) {
      picker.title = state.cameraDevices
        .map((device, index) => `${index + 1}. ${device.label || "Camera"}`)
        .join("\n") || "No cameras found";
    }

    return state.cameraDevices;
  } catch (error) {
    console.warn("Unable to list cameras:", error);
    return [];
  }
}

function stopCameraStream() {
  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
  }

  state.stream = null;
  state.activeDeviceId = null;

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  setStatus("cameraStatus", "Camera stopped");
}

async function startCamera(deviceId = null) {
  if (!video) {
    setGeneral("Camera video element is missing from index.html.");
    return false;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setGeneral("Camera access requires HTTPS and a supported browser.");
    return false;
  }

  stopCameraStream();
  setStatus("cameraStatus", "Requesting camera permission...");
  setGeneral("Opening camera...");

  try {
    const videoConstraints = deviceId
      ? {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      : {
          facingMode: { ideal: state.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: true
    });

    state.stream = stream;
    state.activeDeviceId = deviceId || null;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    await listCameraDevices();

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack?.getSettings?.();

    if (settings?.deviceId) {
      state.activeDeviceId = settings.deviceId;
    }

    setStatus("cameraStatus", "Camera working");
    setGeneral("Camera started. Start face tracking next.");

    setButtonEnabled("startCameraBtn", false);
    setButtonEnabled("stopCameraBtn", true);
    setButtonEnabled("startTrackingBtn", true);

    return true;
  } catch (error) {
    console.error("Camera start error:", error);

    stopCameraStream();

    const message =
      error.name === "NotAllowedError"
        ? "Camera permission denied. Allow camera access in browser settings."
        : error.name === "NotFoundError"
          ? "No compatible camera was found."
          : error.name === "NotReadableError"
            ? "Camera is busy. Close other apps using the camera and try again."
            : `Camera error: ${error.message}`;

    setStatus("cameraStatus", "Camera failed");
    setGeneral(message);
    return false;
  }
}

async function switchCamera() {
  if (state.facingMode === "user") {
    state.facingMode = "environment";
  } else {
    state.facingMode = "user";
  }

  if (state.stream) {
    await startCamera();
  }

  setButtonText(
    "switchCameraBtn",
    state.facingMode === "user" ? "FRONT CAMERA" : "BACK CAMERA"
  );
}

async function pickCamera() {
  const devices = await listCameraDevices();

  if (!devices.length) {
    setGeneral("No camera devices found. Start the camera and grant permission first.");
    return;
  }

  if (devices.length === 1) {
    setGeneral("Only one camera is available on this device.");
    return;
  }

  const currentIndex = devices.findIndex(
    (device) => device.deviceId === state.activeDeviceId
  );

  const options = devices
    .map((device, index) => {
      const name = device.label || `Camera ${index + 1}`;
      return `${index + 1}. ${name}`;
    })
    .join("\n");

  const answer = window.prompt(
    `Enter the camera number:\n${options}`,
    String((currentIndex + 1) % devices.length + 1)
  );

  if (answer === null) return;

  const index = Number.parseInt(answer, 10) - 1;

  if (!Number.isInteger(index) || index < 0 || index >= devices.length) {
    setGeneral("Invalid camera number.");
    return;
  }

  const selected = devices[index];
  const started = await startCamera(selected.deviceId);

  if (started) {
    const label = selected.label || `Camera ${index + 1}`;
    setGeneral(`Selected camera: ${label}`);
  }
}

function setMirrorMode() {
  state.mirror = !state.mirror;

  if (video) {
    video.style.transform = state.mirror ? "scaleX(-1)" : "none";
  }

  if (canvas) {
    canvas.style.transform = state.mirror ? "scaleX(-1)" : "none";
  }

  if (faceCanvas) {
    faceCanvas.style.transform = state.mirror ? "scaleX(-1)" : "none";
  }

  setButtonText(
    "mirrorBtn",
    state.mirror ? "MIRROR FLIP: ON" : "MIRROR FLIP: OFF"
  );
}

async function loadFaceLandmarker() {
  if (state.landmarker) return state.landmarker;

  setStatus("faceStatus", "Loading face tracking model...");
  setGeneral("Loading MediaPipe face tracker. Please wait...");

  try {
    const visionModuleUrl =
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

    const vision = await import(visionModuleUrl);

    const files = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    state.landmarker = await vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });

    setStatus("faceStatus", "Face tracker loaded");
    return state.landmarker;
  } catch (error) {
    console.error("Face tracker loading error:", error);
    setStatus("faceStatus", "Face tracker failed");
    setGeneral(
      `Face tracker failed to load: ${error.message}. Check your internet connection and reload the page.`
    );
    throw error;
  }
}

async function startTracking() {
  if (!state.stream) {
    const started = await startCamera();
    if (!started) return;
  }

  if (state.tracking) return;

  try {
    await loadFaceLandmarker();

    state.tracking = true;
    state.lastVideoTime = -1;

    setStatus("faceStatus", "Searching for face...");
    setGeneral("Face tracking started.");

    setButtonEnabled("startTrackingBtn", false);
    setButtonEnabled("stopTrackingBtn", true);

    detectFaceFrame();
  } catch (error) {
    state.tracking = false;
    setButtonEnabled("startTrackingBtn", true);
    setButtonEnabled("stopTrackingBtn", false);
  }
}

function stopTracking() {
  state.tracking = false;

  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  state.lastFace = null;

  if (headAnchor) {
    headAnchor.position.set(0, 0, 0);
    headAnchor.rotation.set(0, 0, 0);
  }

  clearFaceDrawing();

  setStatus("faceStatus", "Face tracking stopped");
  setButtonEnabled("startTrackingBtn", true);
  setButtonEnabled("stopTrackingBtn", false);
}

function detectFaceFrame() {
  if (!state.tracking || !state.landmarker || !video) return;

  state.animationId = requestAnimationFrame(detectFaceFrame);

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (video.currentTime === state.lastVideoTime) return;

  state.lastVideoTime = video.currentTime;

  try {
    const result = state.landmarker.detectForVideo(video, performance.now());

    if (result.faceLandmarks?.length) {
      state.lastFace = result.faceLandmarks[0];
      state.lastFaceResult = result;
      updateFaceTracking(result);
      setStatus("faceStatus", "Face detected");
    } else {
      state.lastFace = null;
      setStatus("faceStatus", "Searching for face...");
      clearFaceDrawing();
    }
  } catch (error) {
    console.error("Face detection error:", error);
    setStatus("faceStatus", "Face detection error");
  }
}

function updateFaceTracking(result) {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || !headAnchor) return;

  const nose = landmarks[1] || landmarks[4];
  if (nose) {
    const x = (0.5 - nose.x) * 4;
    const y = (0.5 - nose.y) * 3;

    headAnchor.position.x = x;
    headAnchor.position.y = y;
  }

  const matrixData = result.facialTransformationMatrixes?.[0]?.data;

  if (matrixData && matrixData.length >= 16) {
    const matrix = new THREE.Matrix4().fromArray(matrixData);
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

    headAnchor.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  drawFaceOverlay(landmarks);
}

function drawFaceOverlay(landmarks) {
  if (!faceCanvas) return;

  const context = faceCanvas.getContext("2d");
  if (!context) return;

  const width = faceCanvas.width;
  const height = faceCanvas.height;

  context.clearRect(0, 0, width, height);

  if (!state.meshVisible && !state.landmarksVisible) return;

  context.save();
  context.lineWidth = Math.max(1, width / 500);
  context.strokeStyle = "rgba(0, 255, 136, 0.85)";
  context.fillStyle = "rgba(0, 255, 136, 0.9)";

  if (state.meshVisible) {
    for (let i = 0; i < landmarks.length; i += 1) {
      const point = landmarks[i];
      const x = point.x * width;
      const y = point.y * height;

      context.beginPath();
      context.arc(x, y, Math.max(1, width / 450), 0, Math.PI * 2);
      context.fill();
    }
  }

  if (state.landmarksVisible) {
    const outlineIndices = [
      10, 338, 297, 332, 284, 251, 389, 356,
      454, 323, 361, 288, 397, 365, 379, 378,
      400, 377, 152, 148, 176, 149, 150, 136,
      172, 58, 132, 93, 234, 127, 162, 21,
      54, 103, 67, 109, 10
    ];

    context.beginPath();

    outlineIndices.forEach((index, position) => {
      const point = landmarks[index];
      if (!point) return;

      const x = point.x * width;
      const y = point.y * height;

      if (position === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  }

  context.restore();
}

function centerAndNormalizeModel(object) {
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    throw new Error("The imported model contains no visible geometry.");
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  object.position.sub(center);

  if (maxDimension > 0) {
    object.scale.multiplyScalar(1 / maxDimension);
  }

  return object;
}

function prepareModelMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;

    child.frustumCulled = false;

    const materials = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : [];

    for (const material of materials) {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }

    child.castShadow = false;
    child.receiveShadow = false;
  });
}

function loadModelFile(file) {
  return new Promise((resolve, reject) => {
    const extension = file.name.split(".").pop().toLowerCase();
    const objectUrl = URL.createObjectURL(file);

    const cleanupUrl = () => URL.revokeObjectURL(objectUrl);

    if (extension === "glb" || extension === "gltf") {
      const loader = new GLTFLoader();

      loader.load(
        objectUrl,
        (gltf) => {
          cleanupUrl();
          resolve(gltf.scene);
        },
        undefined,
        (error) => {
          cleanupUrl();
          reject(error);
        }
      );

      return;
    }

    if (extension === "obj") {
      const loader = new OBJLoader();

      loader.load(
        objectUrl,
        (object) => {
          cleanupUrl();
          resolve(object);
        },
        undefined,
        (error) => {
          cleanupUrl();
          reject(error);
        }
      );

      return;
    }

    if (extension === "fbx") {
      const loader = new FBXLoader();

      loader.load(
        objectUrl,
        (object) => {
          cleanupUrl();
          resolve(object);
        },
        undefined,
        (error) => {
          cleanupUrl();
          reject(error);
        }
      );

      return;
    }

    cleanupUrl();
    reject(new Error("Unsupported file type. Choose GLB, GLTF, OBJ, or FBX."));
  });
}

async function importModelFile(file) {
  if (!file) return;

  if (!modelOffset) {
    setGeneral("3D scene is not ready yet.");
    return;
  }

  setStatus("modelStatus", `Loading ${file.name}...`);
  setGeneral("Importing 3D model...");

  try {
    const object = await loadModelFile(file);

    centerAndNormalizeModel(object);
    prepareModelMaterials(object);

    removeCurrentModel();

    object.name = file.name;
    modelOffset.add(object);
    state.model = object;

    applyModelTransform();

    setStatus("modelStatus", `Loaded: ${file.name}`);
    setGeneral("3D model imported. Adjust its fit with the sliders.");
  } catch (error) {
    console.error("Model import error:", error);
    setStatus("modelStatus", "Model import failed");
    setGeneral(`Model import failed: ${error.message}`);
  }
}

function resetModelTransform() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const ids = {
      meshSize: "meshSizeSlider",
      meshX: "meshXSlider",
      meshY: "meshYSlider",
      meshZ: "meshZSlider",
      modelScale: "modelScaleSlider",
      modelX: "modelXSlider",
      modelY: "modelYSlider",
      modelZ: "modelZSlider",
      modelPitch: "modelPitchSlider",
      modelYaw: "modelYawSlider",
      modelRoll: "modelRollSlider",
      headFit: "headFitSlider",
      opacity: "opacitySlider"
    };

    if (ids[key]) setSlider(ids[key], value);
  }

  applyAllTransforms();
  setGeneral("Model and head controls reset.");
}

function applyHeadFit() {
  const fit = Math.max(0.1, getNumber("headFitSlider", 1));

  if (state.model && state.autoHeadFit) {
    state.model.scale.setScalar(fit);
  }

  applyHeadSettings();
  applyModelTransform();
}

function toggleFaceMesh() {
  state.meshVisible = !state.meshVisible;

  setButtonText(
    "toggleMeshBtn",
    state.meshVisible ? "HIDE FACE MESH" : "SHOW FACE MESH"
  );

  if (!state.meshVisible && !state.landmarksVisible) {
    clearFaceDrawing();
  }

  setGeneral(state.meshVisible ? "Face mesh display enabled." : "Face mesh display hidden.");
}

function toggleLandmarks() {
  state.landmarksVisible = !state.landmarksVisible;

  setButtonText(
    "toggleLandmarksBtn",
    state.landmarksVisible ? "HIDE LANDMARKS" : "SHOW LANDMARKS"
  );

  if (!state.meshVisible && !state.landmarksVisible) {
    clearFaceDrawing();
  }

  setGeneral(state.landmarksVisible ? "Face outline enabled." : "Face outline hidden.");
}

function toggleAutoHeadFit() {
  state.autoHeadFit = !state.autoHeadFit;

  setButtonText(
    "autoHeadFitBtn",
    state.autoHeadFit ? "HEAD FIT: ON" : "HEAD FIT: OFF"
  );

  applyHeadFit();
}

function toggleExpressionTracking() {
  state.expressionTracking = !state.expressionTracking;

  setButtonText(
    "expressionTrackingBtn",
    state.expressionTracking ? "EXPRESSIONS: ON" : "EXPRESSIONS: OFF"
  );

  setGeneral(
    state.expressionTracking
      ? "Expression tracking enabled."
      : "Expression tracking disabled."
  );
}

function attachSliderEvents() {
  const sliderIds = [
    "meshSizeSlider",
    "meshXSlider",
    "meshYSlider",
    "meshZSlider",
    "modelScaleSlider",
    "modelXSlider",
    "modelYSlider",
    "modelZSlider",
    "modelPitchSlider",
    "modelYawSlider",
    "modelRollSlider",
    "headFitSlider",
    "opacitySlider"
  ];

  sliderIds.forEach((id) => {
    const slider = $(id);
    if (!slider) return;

    slider.addEventListener("input", () => {
      updateSliderValue(id);

      if (id === "headFitSlider") {
        applyHeadFit();
      } else {
        applyAllTransforms();
      }
    });
  });
}

function attachModelEvents() {
  const importButton = $("importModelBtn");
  const fileInput = $("modelFileInput");
  const resetButton = $("resetModelBtn");

  if (importButton && fileInput) {
    importButton.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (file) {
        await importModelFile(file);
      }

      fileInput.value = "";
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetModelTransform);
  }

  const meshButton = $("toggleMeshBtn");
  if (meshButton) meshButton.addEventListener("click", toggleFaceMesh);

  const landmarksButton = $("toggleLandmarksBtn");
  if (landmarksButton) landmarksButton.addEventListener("click", toggleLandmarks);

  const headFitButton = $("autoHeadFitBtn");
  if (headFitButton) headFitButton.addEventListener("click", toggleAutoHeadFit);

  const expressionButton = $("expressionTrackingBtn");
  if (expressionButton) {
    expressionButton.addEventListener("click", toggleExpressionTracking);
  }

  const resetAllButton = $("resetAllBtn");
  if (resetAllButton) {
    resetAllButton.addEventListener("click", resetModelTransform);
  }
}

function attachCameraEvents() {
  const startButton = $("startCameraBtn");
  const placeholderButton = $("placeholderStartBtn");
  const stopButton = $("stopCameraBtn");
  const switchButton = $("switchCameraBtn");
  const pickButton = $("pickCameraBtn");
  const mirrorButton = $("mirrorBtn");
  const startTrackingButton = $("startTrackingBtn");
  const stopTrackingButton = $("stopTrackingBtn");
  const fullscreenButton = $("toggleFullscreenBtn");

  if (startButton) {
    startButton.addEventListener("click", () => startCamera());
  }

  if (placeholderButton) {
    placeholderButton.addEventListener("click", () => startCamera());
  }

  if (stopButton) {
    stopButton.addEventListener("click", () => {
      stopTracking();
      stopCameraStream();

      setButtonEnabled("startCameraBtn", true);
      setButtonEnabled("stopCameraBtn", false);
      setButtonEnabled("startTrackingBtn", true);
      setButtonEnabled("stopTrackingBtn", false);

      setGeneral("Camera stopped.");
    });
  }

  if (switchButton) {
    switchButton.addEventListener("click", async () => {
      await switchCamera();
    });
  }

  if (pickButton) {
    pickButton.addEventListener("click", async () => {
      await pickCamera();
    });
  }

  if (mirrorButton) {
    mirrorButton.addEventListener("click", setMirrorMode);
  }

  if (startTrackingButton) {
    startTrackingButton.addEventListener("click", startTracking);
  }

  if (stopTrackingButton) {
    stopTrackingButton.addEventListener("click", stopTracking);
  }

  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await stage.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        setGeneral(`Fullscreen error: ${error.message}`);
      }
    });
  }
}

function attachVisibilityEvents() {
  const slidersButton = $("toggleSlidersBtn");
  const controlsButton = $("toggleControlsBtn");

  if (slidersButton) {
    slidersButton.addEventListener("click", () => {
      state.slidersHidden = !state.slidersHidden;
      applyPanelVisibility();
    });
  }

  if (controlsButton) {
    controlsButton.addEventListener("click", () => {
      state.controlsHidden = !state.controlsHidden;
      applyPanelVisibility();
    });
  }
}

function startRecording() {
  if (!state.stream) {
    setGeneral("Start the camera before recording.");
    return;
  }

  if (!window.MediaRecorder) {
    setGeneral("Recording is not supported by this browser.");
    return;
  }

  try {
    state.recordedChunks = [];

    const tracks = state.stream.getTracks();
    state.recordingStream = new MediaStream(tracks);

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    const mimeType = mimeTypes.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    state.recorder = mimeType
      ? new MediaRecorder(state.recordingStream, { mimeType })
      : new MediaRecorder(state.recordingStream);

    state.recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    });

    state.recorder.addEventListener("stop", () => {
      if (!state.recordedChunks.length) {
        setStatus("recordingStatus", "No recording data");
        return;
      }

      const blob = new Blob(state.recordedChunks, {
        type: state.recorder?.mimeType || "video/webm"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `azeez-ar-${Date.now()}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 30000);

      setStatus("recordingStatus", "Recording saved");
      setGeneral("Recording downloaded to your device.");
      state.recordingStream = null;
    });

    state.recorder.addEventListener("error", (event) => {
      console.error("Recording error:", event.error);
      setStatus("recordingStatus", "Recording error");
      setGeneral("Recording failed. Check browser permissions and storage.");
    });

    state.recorder.start(500);

    setStatus("recordingStatus", "Recording...");
    setButtonEnabled("startRecordingBtn", false);
    setButtonEnabled("stopRecordingBtn", true);
    setGeneral("Recording started.");
  } catch (error) {
    console.error("Could not start recording:", error);
    setStatus("recordingStatus", "Recording failed");
    setGeneral(`Recording error: ${error.message}`);
  }
}

function stopRecording() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
    setStatus("recordingStatus", "Preparing recording...");
  }

  setButtonEnabled("startRecordingBtn", true);
  setButtonEnabled("stopRecordingBtn", false);
}

function attachRecordingEvents() {
  const startButton = $("startRecordingBtn");
  const stopButton = $("stopRecordingBtn");

  if (startButton) {
    startButton.addEventListener("click", startRecording);
  }

  if (stopButton) {
    stopButton.addEventListener("click", stopRecording);
  }
}

function exportSettings() {
  const settings = {
    version: 1,
    facingMode: state.facingMode,
    mirror: state.mirror,
    meshVisible: state.meshVisible,
    landmarksVisible: state.landmarksVisible,
    autoHeadFit: state.autoHeadFit,
    expressionTracking: state.expressionTracking,
    sliders: {
      meshSize: getNumber("meshSizeSlider", 1),
      meshX: getNumber("meshXSlider", 0),
      meshY: getNumber("meshYSlider", 0),
      meshZ: getNumber("meshZSlider", 0),
      modelScale: getNumber("modelScaleSlider", 1),
      modelX: getNumber("modelXSlider", 0),
      modelY: getNumber("modelYSlider", 0),
      modelZ: getNumber("modelZSlider", 0),
      modelPitch: getNumber("modelPitchSlider", 0),
      modelYaw: getNumber("modelYawSlider", 0),
      modelRoll: getNumber("modelRollSlider", 0),
      headFit: getNumber("headFitSlider", 1),
      opacity: getNumber("opacitySlider", 1)
    }
  };

  const blob = new Blob(
    [JSON.stringify(settings, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "azeez-ar-settings.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
  setGeneral("Settings exported.");
}

async function importSettingsFile(file) {
  if (!file) return;

  try {
    const settings = JSON.parse(await file.text());

    if (!settings || typeof settings !== "object" || !settings.sliders) {
      throw new Error("This file is not a valid Azeez AR settings file.");
    }

    const sliderMap = {
      meshSize: "meshSizeSlider",
      meshX: "meshXSlider",
      meshY: "meshYSlider",
      meshZ: "meshZSlider",
      modelScale: "modelScaleSlider",
      modelX: "modelXSlider",
      modelY: "modelYSlider",
      modelZ: "modelZSlider",
      modelPitch: "modelPitchSlider",
      modelYaw: "modelYawSlider",
      modelRoll: "modelRollSlider",
      headFit: "headFitSlider",
      opacity: "opacitySlider"
    };

    for (const [key, id] of Object.entries(sliderMap)) {
      const value = settings.sliders[key];

      if (Number.isFinite(value)) {
        setSlider(id, value);
      }
    }

    if (typeof settings.mirror === "boolean" &&
        settings.mirror !== state.mirror) {
      setMirrorMode();
    }

    if (typeof settings.meshVisible === "boolean") {
      state.meshVisible = settings.meshVisible;
    }

    if (typeof settings.landmarksVisible === "boolean") {
      state.landmarksVisible = settings.landmarksVisible;
    }

    if (typeof settings.autoHeadFit === "boolean") {
      state.autoHeadFit = settings.autoHeadFit;
    }

    if (typeof settings.expressionTracking === "boolean") {
      state.expressionTracking = settings.expressionTracking;
    }

    setButtonText(
      "toggleMeshBtn",
      state.meshVisible ? "HIDE FACE MESH" : "SHOW FACE MESH"
    );

    setButtonText(
      "toggleLandmarksBtn",
      state.landmarksVisible ? "HIDE LANDMARKS" : "SHOW LANDMARKS"
    );

    setButtonText(
      "autoHeadFitBtn",
      state.autoHeadFit ? "HEAD FIT: ON" : "HEAD FIT: OFF"
    );

    setButtonText(
      "expressionTrackingBtn",
      state.expressionTracking ? "EXPRESSIONS: ON" : "EXPRESSIONS: OFF"
    );

    applyAllTransforms();
    setGeneral("Settings imported successfully.");
  } catch (error) {
    console.error("Settings import error:", error);
    setGeneral(`Settings import failed: ${error.message}`);
  }
}

function attachSettingsEvents() {
  const exportButton = $("exportSettingsBtn");
  const importButton = $("importSettingsBtn");
  const input = $("settingsFileInput");

  if (exportButton) {
    exportButton.addEventListener("click", exportSettings);
  }

  if (importButton && input) {
    importButton.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files?.[0];

      if (file) {
        await importSettingsFile(file);
      }

      input.value = "";
    });
  }
}

function attachAllEvents() {
  attachCameraEvents();
  attachSliderEvents();
  attachModelEvents();
  attachVisibilityEvents();
  attachRecordingEvents();
  attachSettingsEvents();

  setButtonEnabled("stopCameraBtn", false);
  setButtonEnabled("stopTrackingBtn", false);
  setButtonEnabled("stopRecordingBtn", false);

  setButtonText("mirrorBtn", "MIRROR FLIP: OFF");
  setButtonText("toggleMeshBtn", "SHOW FACE MESH");
  setButtonText("toggleLandmarksBtn", "SHOW LANDMARKS");
  setButtonText("autoHeadFitBtn", "HEAD FIT: ON");
  setButtonText("expressionTrackingBtn", "EXPRESSIONS: ON");

  applyPanelVisibility();
  applyAllTransforms();
}

attachAllEvents();

        
