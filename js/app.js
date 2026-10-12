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
