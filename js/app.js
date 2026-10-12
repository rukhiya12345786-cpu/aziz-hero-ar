// AZEEZ AR - PART 1 OF 4
// Core setup, camera scene, model groups and settings.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js";

const $ = (id) => document.getElementById(id);

const video = $("cameraVideo");
const threeCanvas = $("threeCanvas");
const faceCanvas = $("faceCanvas");

const faceContext = faceCanvas
  ? faceCanvas.getContext("2d")
  : null;

const cameraStatus = $("cameraStatus");
const faceStatus = $("faceStatus");
const modelStatus = $("modelStatus");
const recordingStatus = $("recordingStatus");
const generalStatus = $("generalStatus");
const placeholder = $("cameraPlaceholder");

const topControls = $("topControls");
const sliderOverlay = $("sliderOverlay");

let mediaStream = null;
let animationFrameId = 0;
let faceMeshInstance = null;
let faceTrackingActive = false;
let cameraFacingMode = "user";
let mirrorEnabled = false;
let cameraStarting = false;

let mediaRecorder = null;
let recordedChunks = [];
let recordingActive = false;

let currentModel = null;
let currentModelUrl = null;
let currentModelFormat = "";
let lastFaceResults = null;

let showFaceMesh = false;
let showLandmarks = false;
let autoHeadFit = true;
let expressionTrackingEnabled = true;

let cameraWidth = 0;
let cameraHeight = 0;

const settings = {
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
  overlayOpacity: 0.48
};

const defaultSettings = { ...settings };

function setStatus(element, message) {
  if (element) element.textContent = message;
}

function setGeneralStatus(message) {
  setStatus(generalStatus, message);
}

function setCameraStatus(message) {
  setStatus(cameraStatus, message);
}

function setFaceStatus(message) {
  setStatus(faceStatus, message);
}

function setModelStatus(message) {
  setStatus(modelStatus, message);
}

function setRecordingStatus(message) {
  setStatus(recordingStatus, message);
}

function setButtonText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getNumber(id, fallback = 0) {
  const element = $(id);

  if (!element) return fallback;

  const value = Number(element.value);

  return Number.isFinite(value) ? value : fallback;
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function resizeCanvases() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  if (threeCanvas) {
    threeCanvas.width = Math.round(width * pixelRatio);
    threeCanvas.height = Math.round(height * pixelRatio);

    threeCanvas.style.width = width + "px";
    threeCanvas.style.height = height + "px";
  }

  if (faceCanvas) {
    faceCanvas.width = Math.round(width * pixelRatio);
    faceCanvas.height = Math.round(height * pixelRatio);

    faceCanvas.style.width = width + "px";
    faceCanvas.style.height = height + "px";
  }

  cameraWidth = width;
  cameraHeight = height;

  if (renderer) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
  }

  if (threeCamera) {
    threeCamera.aspect = width / Math.max(height, 1);
    threeCamera.updateProjectionMatrix();
  }
}

// Three.js scene.

const scene = new THREE.Scene();

const threeCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / Math.max(window.innerHeight, 1),
  0.01,
  1000
);

threeCamera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  alpha: true,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

scene.add(new THREE.HemisphereLight(0xffffff, 0x485064, 2));

const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
mainLight.position.set(2, 4, 5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
fillLight.position.set(-4, 1, 3);
scene.add(fillLight);

// Tracking anchor follows the detected face.

const headAnchor = new THREE.Group();
scene.add(headAnchor);

// Model offset controls are kept separate from face tracking.

const modelOffset = new THREE.Group();
headAnchor.add(modelOffset);

// Imported model is placed inside this group.

const modelContainer = new THREE.Group();
modelOffset.add(modelContainer);

// Face mesh and landmarks can be shown or hidden independently.

const faceVisuals = new THREE.Group();
scene.add(faceVisuals);

const faceGeometry = new THREE.BufferGeometry();
const faceMaterial = new THREE.MeshBasicMaterial({
  color: 0x22ff88,
  wireframe: true,
  transparent: true,
  opacity: 0.7,
  depthTest: false
});

const faceWireframe = new THREE.Mesh(
  faceGeometry,
  faceMaterial
);

faceWireframe.visible = false;
faceVisuals.add(faceWireframe);

const landmarkMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff99,
  depthTest: false
});

const landmarkGeometry = new THREE.BufferGeometry();
const landmarkPoints = new THREE.Points(
  landmarkGeometry,
  new THREE.PointsMaterial({
    color: 0x00ff99,
    size: 0.025,
    sizeAttenuation: true,
    depthTest: false
  })
);

landmarkPoints.visible = false;
faceVisuals.add(landmarkPoints);

// Model loader setup.

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();

function clearCurrentModel() {
  while (modelContainer.children.length > 0) {
    const child = modelContainer.children[0];

    modelContainer.remove(child);

    child.traverse((object) => {
      if (!object.isMesh) return;

      if (object.geometry) object.geometry.dispose();

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else if (object.material) {
        object.material.dispose();
      }
    });
  }

  currentModel = null;
  currentModelFormat = "";

  if (currentModelUrl) {
    URL.revokeObjectURL(currentModelUrl);
    currentModelUrl = null;
  }
}

function resetModelTransform() {
  settings.modelScale = defaultSettings.modelScale;
  settings.modelX = defaultSettings.modelX;
  settings.modelY = defaultSettings.modelY;
  settings.modelZ = defaultSettings.modelZ;

  settings.modelPitch = defaultSettings.modelPitch;
  settings.modelYaw = defaultSettings.modelYaw;
  settings.modelRoll = defaultSettings.modelRoll;

  settings.headFit = defaultSettings.headFit;

  applySettingsToScene();
}

function resetAllTransforms() {
  Object.assign(settings, defaultSettings);

  applySettingsToScene();
}

// Part 2 will add camera startup, tracking and model import.
// Part 3 will add controls, sliders, hide/show and recording.
// Part 4 will add settings import/export and final startup.

window.addEventListener("resize", resizeCanvases);
resizeCanvases();
// AZEEZ AR - PART 2 OF 4
// Camera, face tracking and 3D model import.

async function startCamera() {
  if (cameraStarting) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraStatus("Camera unavailable. Open this site using HTTPS.");
    setGeneralStatus("Camera access requires a supported secure browser.");
    return;
  }

  cameraStarting = true;

  try {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    setCameraStatus("Requesting camera permission...");

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: cameraFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    if (!video) {
      throw new Error("Camera video element was not found.");
    }

    video.srcObject = mediaStream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    if (placeholder) placeholder.style.display = "none";

    setCameraStatus("Camera working.");
    setGeneralStatus("Camera is running. Start face tracking when ready.");

    return true;
  } catch (error) {
    console.error("Camera startup error:", error);

    setCameraStatus("Camera error: " + error.message);
    setGeneralStatus(
      "Allow camera permission and open the site using HTTPS."
    );

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    return false;
  } finally {
    cameraStarting = false;
  }
}

function stopCamera() {
  stopFaceTracking();

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (placeholder) placeholder.style.display = "flex";

  setCameraStatus("Camera stopped.");
  setGeneralStatus("Camera stopped.");
}

async function switchCamera() {
  cameraFacingMode =
    cameraFacingMode === "user" ? "environment" : "user";

  if (mediaStream) {
    const started = await startCamera();

    if (started && faceTrackingActive) {
      await startFaceTracking();
    }
  }

  setGeneralStatus(
    cameraFacingMode === "user"
      ? "Front camera selected."
      : "Back camera selected."
  );
}

function updateMirror() {
  mirrorEnabled = !mirrorEnabled;

  if (video) {
    video.style.transform = mirrorEnabled ? "scaleX(-1)" : "none";
  }

  setButtonText(
    "mirrorBtn",
    mirrorEnabled ? "MIRROR: ON" : "MIRROR: OFF"
  );
}

async function startFaceTracking() {
  if (faceTrackingActive) return;

  if (!mediaStream || !video || video.readyState < 2) {
    const started = await startCamera();

    if (!started) return;
  }

  try {
    setFaceStatus("Loading face tracking...");

    const visionModule = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
    );

    const { FaceLandmarker, FilesetResolver } = visionModule;

    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    faceMeshInstance = await FaceLandmarker.createFromOptions(
      fileset,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      }
    );

    faceTrackingActive = true;
    setFaceStatus("Face tracking active.");

    processFaceFrame();
  } catch (error) {
    console.error("Face tracking startup error:", error);

    setFaceStatus("Tracking error: " + error.message);
    setGeneralStatus(
      "Face tracking could not load. Check internet and model access."
    );
  }
}

function stopFaceTracking() {
  faceTrackingActive = false;
  lastFaceResults = null;

  if (faceMeshInstance) {
    faceMeshInstance.close();
    faceMeshInstance = null;
  }

  if (faceContext && faceCanvas) {
    faceContext.clearRect(
      0,
      0,
      faceCanvas.width,
      faceCanvas.height
    );
  }

  setFaceStatus("Face tracking stopped.");
}

function processFaceFrame() {
  if (!faceTrackingActive || !faceMeshInstance || !video) return;

  try {
    if (video.readyState >= 2) {
      const now = performance.now();

      lastFaceResults = faceMeshInstance.detectForVideo(video, now);

      updateFaceFromResults(lastFaceResults);
    }
  } catch (error) {
    console.error("Face frame error:", error);
  }

  if (faceTrackingActive) {
    animationFrameId = requestAnimationFrame(processFaceFrame);
  }
}

function updateFaceFromResults(results) {
  const faces = results && results.faceLandmarks;

  if (!faces || faces.length === 0) {
    setFaceStatus("Camera working. No face detected.");
    headAnchor.visible = false;
    faceVisuals.visible = false;
    return;
  }

  headAnchor.visible = true;
  faceVisuals.visible = showFaceMesh || showLandmarks;

  const points = faces[0];

  const leftEye = points[33];
  const rightEye = points[263];
  const nose = points[1];
  const chin = points[152];
  const forehead = points[10];

  if (!leftEye || !rightEye || !nose || !chin || !forehead) return;

  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (forehead.y + chin.y) / 2;
  const eyeDistance = Math.hypot(
    rightEye.x - leftEye.x,
    rightEye.y - leftEye.y
  );

  const faceScale = clamp(eyeDistance * 8, 0.35, 3.5);

  headAnchor.position.set(
    (0.5 - centerX) * 4 + settings.meshX,
    (0.5 - centerY) * 3 + settings.meshY,
    settings.meshZ
  );

  headAnchor.scale.setScalar(faceScale * settings.meshSize);

  const roll = Math.atan2(
    rightEye.y - leftEye.y,
    rightEye.x - leftEye.x
  );

  headAnchor.rotation.z = -roll;

  const noseOffsetX = nose.x - centerX;
  const noseOffsetY = nose.y - centerY;

  headAnchor.rotation.y = clamp(noseOffsetX * 2.5, -0.8, 0.8);
  headAnchor.rotation.x = clamp(noseOffsetY * 2.0, -0.7, 0.7);

  drawFaceMesh(points);

  setFaceStatus("Face detected. Tracking active.");
}

function drawFaceMesh(points) {
  if (!faceContext || !faceCanvas || !video) return;

  const width = faceCanvas.width;
  const height = faceCanvas.height;

  faceContext.clearRect(0, 0, width, height);

  if (!showFaceMesh && !showLandmarks) return;

  faceContext.save();

  if (mirrorEnabled) {
    faceContext.translate(width, 0);
    faceContext.scale(-1, 1);
  }

  if (showLandmarks) {
    faceContext.fillStyle = "#00ff99";

    for (let i = 0; i < points.length; i += 3) {
      const point = points[i];

      faceContext.beginPath();
      faceContext.arc(
        point.x * width,
        point.y * height,
        2 * (window.devicePixelRatio || 1),
        0,
        Math.PI * 2
      );
      faceContext.fill();
    }
  }

  if (showFaceMesh) {
    faceContext.strokeStyle = "rgba(34,255,136,0.7)";
    faceContext.lineWidth = 1.2 * (window.devicePixelRatio || 1);

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      faceContext.beginPath();
      faceContext.moveTo(a.x * width, a.y * height);
      faceContext.lineTo(b.x * width, b.y * height);
      faceContext.stroke();
    }
  }

  faceContext.restore();
}

function import3DModel(file) {
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();
  const objectUrl = URL.createObjectURL(file);

  setModelStatus("Loading " + file.name + "...");

  const handleLoaded = (object, format) => {
    clearCurrentModel();

    currentModelUrl = objectUrl;
    currentModelFormat = format;
    currentModel = object;

    modelContainer.add(object);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object.position.sub(center);

    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

    object.scale.setScalar(1 / maxDimension);

    if (autoHeadFit) {
      object.scale.multiplyScalar(settings.headFit);
    }

    object.traverse((child) => {
      if (!child.isMesh) return;

      child.frustumCulled = false;

      if (child.material) {
        child.material.side = THREE.DoubleSide;
        child.material.needsUpdate = true;
      }
    });

    applySettingsToScene();

    setModelStatus("Model loaded: " + file.name);
    setGeneralStatus("3D model loaded successfully.");
  };

  const handleError = (error) => {
    console.error("Model import error:", error);

    URL.revokeObjectURL(objectUrl);

    setModelStatus("Model import failed: " + file.name);
  };

  if (extension === "glb" || extension === "gltf") {
    gltfLoader.load(
      objectUrl,
      (gltf) => handleLoaded(gltf.scene, extension),
      undefined,
      handleError
    );
  } else if (extension === "obj") {
    objLoader.load(
      objectUrl,
      (object) => handleLoaded(object, extension),
      undefined,
      handleError
    );
  } else if (extension === "fbx") {
    fbxLoader.load(
      objectUrl,
      (object) => handleLoaded(object, extension),
      undefined,
      handleError
    );
  } else {
    URL.revokeObjectURL(objectUrl);
    setModelStatus("Unsupported file. Use GLB, GLTF, OBJ or FBX.");
  }
      }
