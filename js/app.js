/* AZEEZ AI AR STUDIO
   app.js — Part 1 of 3
   Add Part 2 and Part 3 below this code.
*/

import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const $ = (id) => document.getElementById(id);

const view = $("view");
const video = $("cameraVideo");
const dotsCanvas = $("dotsCanvas");
const statusBox = $("status");
const toastBox = $("toast");

const ctx = dotsCanvas.getContext("2d");

const state = {
  stream: null,
  facingMode: "user",
  mirror: false,
  tracking: false,
  dotsVisible: true,
  cameraReady: false,
  faceLandmarker: null,
  lastVideoTime: -1,
  animationId: 0,
  renderer: null,
  scene: null,
  camera3D: null,
  slots: [null, null, null, null],
  activeSlot: 0,
  selectedModel: null,
  recording: null,
  recordedChunks: [],
  mediaStreamDestination: null,
  micStream: null,
  micEnabled: false,
  cleanScreen: false,
  slidersVisible: true,
  optionsVisible: true
};

function setStatus(message) {
  if (statusBox) statusBox.textContent = message;
}

function showToast(message) {
  if (!toastBox) return;
  toastBox.textContent = message;
  toastBox.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastBox.classList.add("hidden");
  }, 2500);
}

function getElement(id) {
  const element = $(id);
  if (!element) {
    console.warn(`Missing HTML element: #${id}`);
  }
  return element;
}

function setButtonText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function resizeCanvas() {
  const width = Math.max(1, view.clientWidth);
  const height = Math.max(1, view.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (const canvas of [dotsCanvas]) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (state.renderer) {
    state.renderer.setPixelRatio(dpr);
    state.renderer.setSize(width, height, false);
  }

  if (state.camera3D) {
    state.camera3D.aspect = width / height;
    state.camera3D.updateProjectionMatrix();
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 250);
});

function clearDots() {
  ctx.clearRect(0, 0, view.clientWidth, view.clientHeight);
}

function stopAnimation() {
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }
}

async function loadFaceTracking() {
  if (state.faceLandmarker) return state.faceLandmarker;

  setStatus("Loading face tracking model…");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
  );

  state.faceLandmarker = await FaceLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath: new URL(
          "../models/face_landmarker.task",
          import.meta.url
        ).href,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    }
  );

  return state.faceLandmarker;
}
/* PART 2 — CAMERA, FACE TRACKING AND GREEN DOTS */

async function startCamera() {
  try {
    stopAnimation();

    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      state.stream = null;
    }

    state.cameraReady = false;
    video.srcObject = null;
    clearDots();
    setStatus("Starting camera…");

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API unavailable. Open this site through HTTPS.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    state.stream = stream;
    video.srcObject = stream;
    video.style.transform = state.mirror ? "scaleX(-1)" : "none";

    await video.play();

    state.cameraReady = true;
    resizeCanvas();
    setStatus("Camera ready");
    showToast("Camera started");

    if (state.tracking) {
      await startTracking();
    }
  } catch (error) {
    console.error("Camera error:", error);
    setStatus(`Camera error: ${error.message}`);
    showToast("Camera failed. Check camera permission.");
  }
}

function stopCamera() {
  stopAnimation();

  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
  }

  state.stream = null;
  state.cameraReady = false;
  state.tracking = false;
  video.srcObject = null;

  clearDots();
  setButtonText("trackingBtn", "Face Track: Off");
  setStatus("Camera stopped");
}

async function switchCamera() {
  const wasTracking = state.tracking;

  state.facingMode =
    state.facingMode === "user" ? "environment" : "user";

  state.tracking = wasTracking;
  await startCamera();
}

function toggleMirror() {
  state.mirror = !state.mirror;
  video.style.transform = state.mirror ? "scaleX(-1)" : "none";
  setButtonText("flipBtn", `Mirror: ${state.mirror ? "On" : "Off"}`);
  clearDots();
}

async function startTracking() {
  try {
    if (!state.cameraReady || !state.stream) {
      showToast("Start the camera first");
      return;
    }

    setStatus("Loading face tracker…");
    await loadFaceTracking();

    state.tracking = true;
    state.lastVideoTime = -1;
    setButtonText("trackingBtn", "Face Track: On");
    setStatus("Face tracking active");

    stopAnimation();
    trackingLoop();
  } catch (error) {
    state.tracking = false;
    console.error("Tracking error:", error);
    setButtonText("trackingBtn", "Face Track: Off");
    setStatus(`Tracking error: ${error.message}`);
    showToast("Tracking could not start");
  }
}

function stopTracking() {
  state.tracking = false;
  stopAnimation();
  clearDots();

  setButtonText("trackingBtn", "Face Track: Off");
  setStatus(state.cameraReady ? "Camera ready" : "Camera stopped");
}

function toggleTracking() {
  if (state.tracking) {
    stopTracking();
  } else {
    startTracking();
  }
}

function toggleDots() {
  state.dotsVisible = !state.dotsVisible;

  setButtonText(
    "dotsBtn",
    `Green Dots: ${state.dotsVisible ? "On" : "Off"}`
  );

  if (!state.dotsVisible) clearDots();
}

function trackingLoop() {
  if (!state.tracking || !state.cameraReady) return;

  state.animationId = requestAnimationFrame(trackingLoop);

  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.currentTime === state.lastVideoTime
  ) {
    return;
  }

  state.lastVideoTime = video.currentTime;

  try {
    const result = state.faceLandmarker.detectForVideo(
      video,
      performance.now()
    );

    drawFaceDots(result);
  } catch (error) {
    console.error("Face detection error:", error);
    setStatus("Face detection error");
  }
}

function drawFaceDots(result) {
  clearDots();

  if (!state.dotsVisible) return;

  const faces = result.faceLandmarks || [];
  if (faces.length === 0) {
    setStatus("Looking for a face…");
    return;
  }

  setStatus("Face detected");

  const width = view.clientWidth;
  const height = view.clientHeight;

  ctx.fillStyle = "#00ff66";

  for (const landmark of faces[0]) {
    const x = state.mirror
      ? (1 - landmark.x) * width
      : landmark.x * width;

    const y = landmark.y * height;

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* PART 3 — 3D MODELS, SLIDERS, SETTINGS AND CONTROLS */

const arCanvas = $("arCanvas");
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();

const transforms = {
  x: 0, y: 0, z: 0,
  rx: 0, ry: 0, rz: 0,
  scale: 1
};

function init3D() {
  state.scene = new THREE.Scene();

  state.camera3D = new THREE.PerspectiveCamera(
    45,
    Math.max(1, view.clientWidth) / Math.max(1, view.clientHeight),
    0.01,
    100
  );
  state.camera3D.position.set(0, 0, 5);

  state.renderer = new THREE.WebGLRenderer({
    canvas: arCanvas,
    alpha: true,
    antialias: true
  });
  state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  state.renderer.setSize(view.clientWidth, view.clientHeight, false);
  state.renderer.setClearColor(0x000000, 0);

  state.scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2));

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 4, 5);
  state.scene.add(light);

  render3D();
}

function render3D() {
  requestAnimationFrame(render3D);
  if (state.renderer && state.scene && state.camera3D) {
    state.renderer.render(state.scene, state.camera3D);
  }
}

function currentModel() {
  return state.slots[state.activeSlot];
}

function applyTransform() {
  const model = currentModel();
  if (!model) return;

  model.position.set(transforms.x, transforms.y, transforms.z);
  model.rotation.set(
    THREE.MathUtils.degToRad(transforms.rx),
    THREE.MathUtils.degToRad(transforms.ry),
    THREE.MathUtils.degToRad(transforms.rz)
  );
  model.scale.setScalar(transforms.scale);
}

function resetTransform() {
  Object.assign(transforms, {
    x: 0, y: 0, z: 0,
    rx: 0, ry: 0, rz: 0,
    scale: 1
  });

  const values = {
    posX: 0, posY: 0, posZ: 0,
    rotX: 0, rotY: 0, rotZ: 0,
    modelScale: 1
  };

  for (const [id, value] of Object.entries(values)) {
    const el = $(id);
    if (el) el.value = value;
  }

  applyTransform();
  updateSliderOutputs();
}

function updateSliderOutputs() {
  for (const id of [
    "posX", "posY", "posZ",
    "rotX", "rotY", "rotZ", "modelScale"
  ]) {
    const input = $(id);
    const output = $(`${id}Out`);
    if (input && output) {
      output.value = Number(input.value).toFixed(
        id === "modelScale" ? 2 : 0
      );
      output.textContent = output.value;
    }
  }
}

function loadModel(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop().toLowerCase();

    const done = (object) => {
      URL.revokeObjectURL(url);
      resolve(object);
    };

    const fail = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    if (ext === "glb" || ext === "gltf") {
      gltfLoader.load(url, result => done(result.scene), undefined, fail);
    } else if (ext === "obj") {
      objLoader.load(url, done, undefined, fail);
    } else if (ext === "fbx") {
      fbxLoader.load(url, done, undefined, fail);
    } else {
      fail(new Error("Choose a GLB, GLTF, OBJ or FBX file."));
    }
  });
}

async function importModel(file) {
  if (!file) return;

  try {
    setStatus("Loading 3D model…");

    const model = await loadModel(file);
    model.visible = true;

    const old = state.slots[state.activeSlot];
    if (old) state.scene.remove(old);

    state.slots[state.activeSlot] = model;
    state.scene.add(model);

    // Fit model around its center for initial viewing.
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      model.scale.setScalar(2 / maxDim);
    }

    transforms.scale = model.scale.x;
    const scaleInput = $("modelScale");
    if (scaleInput) scaleInput.value = transforms.scale;

    updateSliderOutputs();
    setStatus(`Model loaded: ${file.name}`);
    showToast("Model imported");
  } catch (error) {
    console.error("Model import error:", error);
    setStatus(`Model error: ${error.message}`);
    showToast("Could not load model");
  }
}

function selectSlot(index) {
  state.activeSlot = index;

  document.querySelectorAll(".slot").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.slot) === index
    );
  });

  const model = currentModel();
  if (model) {
    transforms.x = model.position.x;
    transforms.y = model.position.y;
    transforms.z = model.position.z;
    transforms.rx = THREE.MathUtils.radToDeg(model.rotation.x);
    transforms.ry = THREE.MathUtils.radToDeg(model.rotation.y);
    transforms.rz = THREE.MathUtils.radToDeg(model.rotation.z);
    transforms.scale = model.scale.x;
  }

  syncTransformInputs();
}

function syncTransformInputs() {
  const values = {
    posX: transforms.x, posY: transforms.y, posZ: transforms.z,
    rotX: transforms.rx, rotY: transforms.ry, rotZ: transforms.rz,
    modelScale: transforms.scale
  };

  for (const [id, value] of Object.entries(values)) {
    const el = $(id);
    if (el) el.value = value;
  }

  updateSliderOutputs();
}

function bindTransformSliders() {
  const mapping = {
    posX: "x", posY: "y", posZ: "z",
    rotX: "rx", rotY: "ry", rotZ: "rz",
    modelScale: "scale"
  };

  for (const [id, property] of Object.entries(mapping)) {
    const el = $(id);
    if (!el) continue;

    el.addEventListener("input", () => {
      transforms[property] = Number(el.value);
      applyTransform();
      updateSliderOutputs();
    });
  }
}

function bindFaceSliders() {
  for (const id of [
    "faceX", "faceY", "faceZ", "faceSize",
    "yawOffset", "pitchOffset", "rollOffset",
    "leftEye", "rightEye", "mouthScale", "mouthOpen",
    "blinkLeft", "blinkRight"
  ]) {
    const el = $(id);
    if (el) {
      el.addEventListener("input", () => {
        const model = currentModel();
        if (!model) return;

        model.position.x = Number($("faceX").value);
        model.position.y = Number($("faceY").value);
        model.position.z = Number($("faceZ").value);

        const s = Number($("faceSize").value);
        model.scale.setScalar(s);
      });
    }
  }
}

function togglePanel(id, visible) {
  const panel = $(id);
  if (panel) panel.classList.toggle("hidden", !visible);
}

function bindButtons() {
  getElement("startCameraBtn")?.addEventListener("click", startCamera);
  getElement("switchCameraBtn")?.addEventListener("click", switchCamera);
  getElement("flipBtn")?.addEventListener("click", toggleMirror);
  getElement("trackingBtn")?.addEventListener("click", toggleTracking);
  getElement("stopCameraBtn")?.addEventListener("click", stopCamera);
  getElement("dotsBtn")?.addEventListener("click", toggleDots);

  getElement("modelFile")?.addEventListener("change", event => {
    importModel(event.target.files?.[0]);
    event.target.value = "";
  });

  document.querySelectorAll(".slot").forEach(button => {
    button.addEventListener("click", () => {
      selectSlot(Number(button.dataset.slot));
    });
  });

  getElement("removeModelBtn")?.addEventListener("click", () => {
    const model = currentModel();
    if (model) state.scene.remove(model);
    state.slots[state.activeSlot] = null;
    showToast("Active model removed");
  });

  getElement("showModelBtn")?.addEventListener("click", () => {
    const model = currentModel();
    if (model) model.visible = true;
  });

  getElement("resetTransformBtn")?.addEventListener("click", resetTransform);
  getElement("autoFitBtn")?.addEventListener("click", () => {
    const model = currentModel();
    if (!model) return;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.setScalar(1);
    resetTransform();
  });

  getElement("resetFaceBtn")?.addEventListener("click", () => {
    for (const id of [
      "faceX", "faceY", "faceZ", "yawOffset",
      "pitchOffset", "rollOffset", "mouthOpen",
      "blinkLeft", "blinkRight"
    ]) {
      const el = $(id);
      if (el) el.value = 0;
    }
    for (const id of ["faceSize", "leftEye", "rightEye", "mouthScale"]) {
      const el = $(id);
      if (el) el.value = 1;
    }
    bindFaceSliders();
  });

  getElement("resetAllBtn")?.addEventListener("click", () => {
    resetTransform();
    clearDots();
  });

  getElement("hideOptionsBtn")?.addEventListener("click", () => {
    state.optionsVisible = false;
    togglePanel("editor", false);
  });

  getElement("showEditorBtn")?.addEventListener("click", () => {
    state.optionsVisible = true;
    togglePanel("editor", true);
  });

  getElement("hideSlidersBtn")?.addEventListener("click", () => {
    state.slidersVisible = false;
    document.querySelectorAll("#editor .field").forEach(el => {
      el.classList.add("hidden");
    });
  });

  getElement("showSlidersBtn")?.addEventListener("click", () => {
    state.slidersVisible = true;
    document.querySelectorAll("#editor .field").forEach(el => {
      el.classList.remove("hidden");
    });
  });

  getElement("cleanScreenBtn")?.addEventListener("click", () => {
    state.cleanScreen = true;
    view.classList.add("clean");
  });

  getElement("exitCleanBtn")?.addEventListener("click", () => {
    state.cleanScreen = false;
    view.classList.remove("clean");
  });

  getElement("fullscreenBtn")?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await view.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      resizeCanvas();
    } catch (error) {
      showToast("Fullscreen is not supported here");
    }
  });

  document.querySelectorAll("[data-transform]").forEach(button => {
    button.addEventListener("click", () => {
      showToast(`${button.dataset.transform} mode selected`);
    });
  });

  getElement("exportSettingsBtn")?.addEventListener("click", exportSettings);
  getElement("importSettingsBtn")?.addEventListener("click", () => {
    $("settingsFile")?.click();
  });

  getElement("settingsFile")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) importSettings(file);
    event.target.value = "";
  });

  getElement("recordBtn")?.addEventListener("click", startRecording);
  getElement("stopRecordBtn")?.addEventListener("click", stopRecording);
  getElement("micBtn")?.addEventListener("click", toggleMic);
}

function getSettings() {
  const settings = {};
  document.querySelectorAll("#editor input[type=range]").forEach(el => {
    settings[el.id] = Number(el.value);
  });
  settings.mirror = state.mirror;
  settings.facingMode = state.facingMode;
  settings.dotsVisible = state.dotsVisible;
  return settings;
}

function exportSettings() {
  const blob = new Blob(
    [JSON.stringify(getSettings(), null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "azeez-ar-settings.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importSettings(file) {
  try {
    const settings = JSON.parse(await file.text());

    for (const [id, value] of Object.entries(settings)) {
      const el = $(id);
      if (el && el.type === "range" && Number.isFinite(Number(value))) {
        el.value = value;
        el.dispatchEvent(new Event("input"));
      }
    }

    if (typeof settings.mirror === "boolean") {
      state.mirror = settings.mirror;
      video.style.transform = state.mirror ? "scaleX(-1)" : "none";
      setButtonText("flipBtn", `Mirror: ${state.mirror ? "On" : "Off"}`);
    }

    if (typeof settings.dotsVisible === "boolean") {
      state.dotsVisible = settings.dotsVisible;
      setButtonText("dotsBtn", `Green Dots: ${state.dotsVisible ? "On" : "Off"}`);
    }

    showToast("Settings imported");
  } catch (error) {
    showToast("Invalid settings file");
  }
}

async function toggleMic() {
  try {
    if (state.micEnabled) {
      state.micStream?.getTracks().forEach(track => track.stop());
      state.micStream = null;
      state.micEnabled = false;
    } else {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.micEnabled = true;
    }

    setButtonText("micBtn", `Mic: ${state.micEnabled ? "On" : "Off"}`);
  } catch (error) {
    showToast("Microphone permission unavailable");
  }
}

function startRecording() {
  if (!state.stream) {
    showToast("Start camera before recording");
    return;
  }

  try {
    const tracks = [...state.stream.getVideoTracks()];
    if (state.micEnabled && state.micStream) {
      tracks.push(...state.micStream.getAudioTracks());
    }

    const recordingStream = new MediaStream(tracks);
    state.recordedChunks = [];
    state.recording = new MediaRecorder(recordingStream);

    state.recording.ondataavailable = event => {
      if (event.data.size) state.recordedChunks.push(event.data);
    };

    state.recording.onstop = () => {
      const blob = new Blob(state.recordedChunks, {
        type: state.recording.mimeType || "video/webm"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "azeez-ar-recording.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    state.recording.start();
    showToast("Recording started");
  } catch (error) {
    showToast("Recording could not start");
  }
}

function stopRecording() {
  if (state.recording?.state === "recording") {
    state.recording.stop();
    showToast("Recording stopped");
  }
}

/* START APP */
try {
  init3D();
  bindTransformSliders();
  bindFaceSliders();
  bindButtons();
  resizeCanvas();
  setStatus("Ready — tap Start Camera");
} catch (error) {
  console.error("App initialization error:", error);
  setStatus(`App error: ${error.message}`);
      }
  
                  
