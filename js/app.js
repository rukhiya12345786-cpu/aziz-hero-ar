/* AZEEZ AR STUDIO — PART 1/3 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js";

const $ = id => document.getElementById(id);
const video = $("cameraVideo");
const dotsCanvas = $("dotsCanvas");
const arCanvas = $("arCanvas");

if (!video || !dotsCanvas || !arCanvas) {
  throw new Error("index.html is missing cameraVideo, dotsCanvas, or arCanvas.");
}

const dotsCtx = dotsCanvas.getContext("2d");

const state = {
  stream: null,
  facingMode: "user",
  mirrored: false,
  tracking: false,
  dotsVisible: true,
  loadingTracking: false,
  landmarker: null,
  animationId: null,
  lastVideoTime: -1,
  faceResults: null,
  scene: null,
  camera3D: null,
  renderer: null,
  renderFrame: null,
  modelSlots: [null, null, null, null],
  activeSlot: 0,
  recording: null,
  recordingChunks: [],
  micStream: null,
  cleanPreview: false
};

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function setStatus(message) {
  if ($("status")) $("status").textContent = message;
}

function setTrackingStatus(message) {
  if ($("trackingStatus")) $("trackingStatus").textContent = message;
  if ($("trackingPanelStatus")) $("trackingPanelStatus").textContent = message;
}

function showCameraError(message) {
  const el = $("cameraError");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    toast(message);
  }
}

function hideCameraError() {
  if ($("cameraError")) $("cameraError").style.display = "none";
}

function showCameraMessage(message) {
  const el = $("cameraMessage");
  if (!el) return;
  el.textContent = message;
  el.style.display = message ? "block" : "none";
}

function clearDots() {
  dotsCtx.clearRect(0, 0, dotsCanvas.width, dotsCanvas.height);
}

function resizeCanvases() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (const canvas of [dotsCanvas, arCanvas]) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }

  dotsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.renderer && state.camera3D) {
    state.renderer.setPixelRatio(dpr);
    state.renderer.setSize(w, h, false);
    state.camera3D.aspect = w / h;
    state.camera3D.updateProjectionMatrix();
  }
}

function openOptions() {
  $("optionsPanel")?.classList.add("open");
  $("panelBackdrop")?.classList.add("show");
}

function closeOptions() {
  $("optionsPanel")?.classList.remove("open");
  $("panelBackdrop")?.classList.remove("show");
}

$("openOptions")?.addEventListener("click", openOptions);
$("closeOptions")?.addEventListener("click", closeOptions);
$("panelBackdrop")?.addEventListener("click", closeOptions);
$("hideOptionsBtn")?.addEventListener("click", closeOptions);

let touchX = 0;
let touchY = 0;

document.addEventListener("touchstart", event => {
  touchX = event.changedTouches[0].clientX;
  touchY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", event => {
  const t = event.changedTouches[0];
  const dx = t.clientX - touchX;
  const dy = t.clientY - touchY;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;

  if (dx < 0 && touchX > window.innerWidth - 45) openOptions();
  if (dx > 0 && $("optionsPanel")?.classList.contains("open")) closeOptions();
}, { passive: true });

function stopTracking() {
  state.tracking = false;
  state.faceResults = null;

  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  clearDots();
  setTrackingStatus("Tracking OFF");
  if ($("trackingBtn")) $("trackingBtn").textContent = "Start Tracking";
}

async function stopCamera() {
  stopTracking();

  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }

  video.srcObject = null;
  setStatus("Camera stopped");
  showCameraMessage("Press START CAMERA to begin.");
}

async function startCamera() {
  hideCameraError();

  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError("Camera requires HTTPS and a supported browser.");
    return;
  }

  const resumeTracking = state.tracking;
  await stopCamera();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = state.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    video.classList.toggle("mirrored", state.mirrored);

    resizeCanvases();
    setStatus("Camera ready");
    showCameraMessage("");

    if (resumeTracking) await startTracking();
    else toast("Camera started");
  } catch (error) {
    console.error("Camera error:", error);
    showCameraError("Camera failed: " + error.message);
    setStatus("Camera error");
  }
}

$("startCameraBtn")?.addEventListener("click", startCamera);
$("stopCameraBtn")?.addEventListener("click", stopCamera);

$("switchCameraBtn")?.addEventListener("click", async () => {
  const resumeTracking = state.tracking;
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  await startCamera();
  if (resumeTracking && state.stream) await startTracking();
});

$("flipBtn")?.addEventListener("click", () => {
  state.mirrored = !state.mirrored;
  video.classList.toggle("mirrored", state.mirrored);
  if ($("flipBtn")) {
    $("flipBtn").textContent = state.mirrored ? "Mirror Flip ON" : "Mirror Flip OFF";
  }
  if (state.faceResults) drawFaceDots(state.faceResults);
});

$("fullscreenBtn")?.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    toast("Fullscreen unavailable in this browser.");
  }
});

/* FACE LANDMARKER LOADING — GPU then CPU fallback */
async function loadFaceLandmarker() {
  if (state.landmarker) return state.landmarker;
  if (state.loadingTracking) throw new Error("Model is already loading.");

  state.loadingTracking = true;
  setTrackingStatus("Loading face model...");

  try {
    const vision = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
    );

    const files = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    const options = {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 4,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    };

    try {
      state.landmarker = await vision.FaceLandmarker.createFromOptions(files, options);
    } catch (gpuError) {
      console.warn("GPU failed; trying CPU:", gpuError);
      options.baseOptions.delegate = "CPU";
      state.landmarker = await vision.FaceLandmarker.createFromOptions(files, options);
    }

    setTrackingStatus("Face model loaded");
    return state.landmarker;
  } catch (error) {
    console.error("Face model loading error:", error);
    state.landmarker = null;
    setTrackingStatus("Model loading failed");
    showCameraError("Face tracking failed: " + (error?.message || String(error)));
    throw error;
  } finally {
    state.loadingTracking = false;
  }
}

async function startTracking() {
  if (!state.stream) {
    toast("Start camera first");
    return;
  }
  if (state.tracking || state.loadingTracking) return;

  try {
    await loadFaceLandmarker();
    if (!state.stream) throw new Error("Camera stopped.");

    state.tracking = true;
    state.lastVideoTime = -1;
    setTrackingStatus("Tracking ON");
    if ($("trackingBtn")) $("trackingBtn").textContent = "Stop Tracking";
    trackingLoop();
  } catch (error) {
    console.error("Tracking failed:", error);
    state.tracking = false;
    setTrackingStatus("Tracking failed");
    if ($("trackingBtn")) $("trackingBtn").textContent = "Start Tracking";
  }
}

$("trackingBtn")?.addEventListener("click", () => {
  if (state.tracking) stopTracking();
  else startTracking();
});

function toggleDots() {
  state.dotsVisible = !state.dotsVisible;
  if ($("dotsBtn")) {
    $("dotsBtn").textContent = state.dotsVisible ? "Green Dots ON" : "Green Dots OFF";
  }
  if (!state.dotsVisible) clearDots();
  else if (state.faceResults) drawFaceDots(state.faceResults);
}

$("dotsBtn")?.addEventListener("click", toggleDots);

function trackingLoop() {
  if (!state.tracking) {
    state.animationId = null;
    return;
  }

  if (
    state.stream &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.currentTime !== state.lastVideoTime
  ) {
    state.lastVideoTime = video.currentTime;

    try {
      state.faceResults = state.landmarker.detectForVideo(video, performance.now());
      drawFaceDots(state.faceResults);
      updateFaceModel();
    } catch (error) {
      console.error("Detection error:", error);
      setTrackingStatus("Detection error — check console");
    }
  }

  state.animationId = requestAnimationFrame(trackingLoop);
}

function drawFaceDots(results) {
  clearDots();
  if (!state.dotsVisible) return;

  if (!results?.faceLandmarks?.length) {
    setTrackingStatus("Tracking ON • Face not found");
    return;
  }

  const w = dotsCanvas.clientWidth;
  const h = dotsCanvas.clientHeight;

  dotsCtx.fillStyle = "#00ff66";
  dotsCtx.shadowColor = "#00ff66";
  dotsCtx.shadowBlur = 4;

  for (const face of results.faceLandmarks) {
    for (const p of face) {
      const x = (state.mirrored ? 1 - p.x : p.x) * w;
      const y = p.y * h;
      dotsCtx.beginPath();
      dotsCtx.arc(x, y, 2, 0, Math.PI * 2);
      dotsCtx.fill();
    }
  }

  dotsCtx.shadowBlur = 0;
  setTrackingStatus("Tracking ON • Face detected (" + results.faceLandmarks.length + ")");
}
   
/* AZEEZ AR STUDIO — PART 2/3 */

function init3D() {
  state.scene = new THREE.Scene();

  state.camera3D = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  );
  state.camera3D.position.set(0, 0, 5);

  state.renderer = new THREE.WebGLRenderer({
    canvas: arCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });

  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight, false);
  state.renderer.setClearColor(0x000000, 0);

  state.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 4, 5);
  state.scene.add(light);

  render3D();
}

function render3D() {
  if (!state.renderer || !state.scene || !state.camera3D) return;
  state.renderer.render(state.scene, state.camera3D);
  state.renderFrame = requestAnimationFrame(render3D);
}

function activeModel() {
  return state.modelSlots[state.activeSlot];
}

function selectSlot(index) {
  if (index < 0 || index > 3) return;

  state.activeSlot = index;
  document.querySelectorAll(".slotBtn").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.slot) === index);
  });

  updateSlotLabels();
  applyModelControls();
}

document.querySelectorAll(".slotBtn").forEach(button => {
  button.addEventListener("click", () => selectSlot(Number(button.dataset.slot)));
});

function updateSlotLabels() {
  document.querySelectorAll(".slotBtn").forEach(button => {
    const index = Number(button.dataset.slot);
    button.textContent = state.modelSlots[index]
      ? "Slot " + (index + 1) + " ✓"
      : "Slot " + (index + 1);
  });

  if ($("modelStatus")) {
    $("modelStatus").textContent = activeModel()
      ? "Model loaded in slot " + (state.activeSlot + 1)
      : "No model in selected slot";
  }
}

function centerAndScaleModel(object) {
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize > 0) object.scale.multiplyScalar(2 / maxSize);

  object.userData.originalScale = object.scale.clone();
}

async function parseModel(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "glb" || extension === "gltf") {
    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);
    try {
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (extension === "obj") {
    return new OBJLoader().parse(await file.text());
  }

  if (extension === "fbx") {
    return new FBXLoader().parse(await file.arrayBuffer(), "");
  }

  throw new Error("Unsupported file. Choose GLB, GLTF, OBJ, or FBX.");
}

async function importModel() {
  const picker = $("modelFile");
  const file = picker?.files?.[0];

  if (!file) {
    toast("Choose a 3D model file first");
    return;
  }

  try {
    if ($("modelStatus")) $("modelStatus").textContent = "Loading model...";

    const object = await parseModel(file);
    const previous = activeModel();

    if (previous) {
      state.scene.remove(previous);
      disposeObject(previous);
    }

    centerAndScaleModel(object);
    state.modelSlots[state.activeSlot] = object;
    state.scene.add(object);

    applyModelControls();
    updateSlotLabels();
    toast("Model imported");
  } catch (error) {
    console.error("Model import failed:", error);
    showCameraError("Model import failed: " + error.message);
    updateSlotLabels();
  } finally {
    if (picker) picker.value = "";
  }
}

$("importModelBtn")?.addEventListener("click", importModel);

function numberValue(id, fallback = 0) {
  const el = $(id);
  if (!el) return fallback;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function applyModelControls() {
  const model = activeModel();
  if (!model) return;

  model.position.set(
    numberValue("posX"),
    numberValue("posY"),
    numberValue("posZ")
  );

  model.rotation.set(
    THREE.MathUtils.degToRad(numberValue("rotX")),
    THREE.MathUtils.degToRad(numberValue("rotY")),
    THREE.MathUtils.degToRad(numberValue("rotZ"))
  );

  const original = model.userData.originalScale || new THREE.Vector3(1, 1, 1);
  const scale = Math.max(0.001, numberValue("modelScale", 1));
  model.scale.copy(original).multiplyScalar(scale);

  if ($("showModelBtn")) {
    $("showModelBtn").textContent = model.visible ? "Hide Model" : "Show Model";
  }
}

const sliderIds = [
  "posX", "posY", "posZ",
  "rotX", "rotY", "rotZ",
  "modelScale",
  "faceX", "faceY", "faceZ", "faceSize",
  "leftEye", "rightEye", "mouthScale",
  "mouthOpen", "blinkLeft", "blinkRight"
];

function updateSliderOutput(id) {
  const slider = $(id);
  if (!slider) return;

  const output = $(id + "Out") || (id === "modelScale" ? $("scaleOut") : null);
  if (output) output.textContent = slider.value;
}

sliderIds.forEach(id => {
  const slider = $(id);
  if (!slider) return;

  slider.addEventListener("input", () => {
    updateSliderOutput(id);
    applyModelControls();
  });

  updateSliderOutput(id);
});

function setSliderValues(values) {
  for (const [id, value] of Object.entries(values)) {
    if ($(id)) $(id).value = value;
    updateSliderOutput(id);
  }
}

function resetTransform() {
  setSliderValues({
    posX: 0, posY: 0, posZ: 0,
    rotX: 0, rotY: 0, rotZ: 0,
    modelScale: 1
  });
  applyModelControls();
}

function resetFaceControls() {
  setSliderValues({
    faceX: 0, faceY: 0, faceZ: 0,
    faceSize: 1,
    leftEye: 1, rightEye: 1,
    mouthScale: 1, mouthOpen: 0,
    blinkLeft: 0, blinkRight: 0
  });
  applyModelControls();
}

$("resetTransformBtn")?.addEventListener("click", resetTransform);
$("resetFaceBtn")?.addEventListener("click", resetFaceControls);

$("resetAllBtn")?.addEventListener("click", () => {
  resetTransform();
  resetFaceControls();

  state.mirrored = false;
  video.classList.remove("mirrored");
  if ($("flipBtn")) $("flipBtn").textContent = "Mirror Flip OFF";
});

$("showModelBtn")?.addEventListener("click", () => {
  const model = activeModel();
  if (!model) return toast("Import a model first");

  model.visible = !model.visible;
  applyModelControls();
});

$("removeModelBtn")?.addEventListener("click", () => {
  const model = activeModel();
  if (!model) return;

  state.scene.remove(model);
  disposeObject(model);
  state.modelSlots[state.activeSlot] = null;
  updateSlotLabels();
});

$("clearModelBtn")?.addEventListener("click", () => {
  state.modelSlots.forEach(model => {
    if (model) {
      state.scene.remove(model);
      disposeObject(model);
    }
  });

  state.modelSlots = [null, null, null, null];
  updateSlotLabels();
});

$("autoFitBtn")?.addEventListener("click", () => {
  if (!activeModel()) return toast("Import a model first");
  resetTransform();
});

function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach(material => {
        for (const value of Object.values(material)) {
          if (value?.isTexture) value.dispose();
        }
        material.dispose();
      });
    }
  });
       }

/* AZEEZ AR STUDIO — PART 3/3 */

/* Face sliders are manual controls.
   Automatic eye/mouth deformation requires a compatible rigged model. */
function updateFaceModel() {
  // Reserved for future rigged-model face attachment.
  // Tracking results remain available in state.faceResults.
}

function toggleCleanPreview(enabled) {
  state.cleanPreview = enabled;

  $("topBar")?.classList.toggle("clean-hidden", enabled);
  $("openOptions")?.classList.toggle("clean-hidden", enabled);

  if ($("exitCleanBtn")) {
    $("exitCleanBtn").style.display = enabled ? "block" : "none";
  }
}

$("cleanScreenBtn")?.addEventListener("click", () => {
  closeOptions();
  toggleCleanPreview(true);
});

$("exitCleanBtn")?.addEventListener("click", () => {
  toggleCleanPreview(false);
});

$("hideSlidersBtn")?.addEventListener("click", () => {
  $("optionsPanel")?.classList.toggle("sliders-hidden");
});

/* RECORD CAMERA VIDEO */
function recordingMimeType() {
  if (!window.MediaRecorder) return "";
  return [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ].find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function startRecording() {
  if (!state.stream) return toast("Start camera first");
  if (!window.MediaRecorder) return toast("Recording not supported");

  if (state.recording?.state === "recording") return;

  try {
    state.recordingChunks = [];

    const mimeType = recordingMimeType();
    state.recording = new MediaRecorder(
      state.stream,
      mimeType ? { mimeType } : undefined
    );

    state.recording.ondataavailable = event => {
      if (event.data?.size) state.recordingChunks.push(event.data);
    };

    state.recording.onerror = event => {
      console.error("Recording error:", event.error);
      toast("Recording error");
    };

    state.recording.onstop = () => {
      const type = state.recording?.mimeType || "video/webm";
      const blob = new Blob(state.recordingChunks, { type });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "azeez-ar-recording.webm";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);
      state.recordingChunks = [];
      toast("Recording saved");
    };

    state.recording.start(500);
    if ($("recordBtn")) $("recordBtn").disabled = true;
    if ($("stopRecordBtn")) $("stopRecordBtn").disabled = false;
    toast("Recording started");
  } catch (error) {
    console.error("Recording start failed:", error);
    showCameraError("Recording failed: " + error.message);
  }
}

function stopRecording() {
  if (state.recording?.state === "recording") {
    state.recording.stop();
  }

  if ($("recordBtn")) $("recordBtn").disabled = false;
  if ($("stopRecordBtn")) $("stopRecordBtn").disabled = true;
}

$("recordBtn")?.addEventListener("click", startRecording);
$("stopRecordBtn")?.addEventListener("click", stopRecording);

/* MICROPHONE PERMISSION */
async function toggleMicrophone() {
  if (state.micStream) {
    state.micStream.getTracks().forEach(track => track.stop());
    state.micStream = null;
    if ($("micBtn")) $("micBtn").textContent = "Microphone OFF";
    toast("Microphone OFF");
    return;
  }

  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    if ($("micBtn")) $("micBtn").textContent = "Microphone ON";
    toast("Microphone permission granted");
  } catch (error) {
    console.error("Microphone error:", error);
    showCameraError("Microphone unavailable: " + error.message);
  }
}

$("micBtn")?.addEventListener("click", toggleMicrophone);

/* SETTINGS EXPORT */
function exportSettings() {
  const settings = {
    version: 1,
    facingMode: state.facingMode,
    mirrored: state.mirrored,
    activeSlot: state.activeSlot,
    sliders: {}
  };

  sliderIds.forEach(id => {
    if ($(id)) settings.sliders[id] = $(id).value;
  });

  const blob = new Blob(
    [JSON.stringify(settings, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "azeez-ar-settings.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("Settings exported");
}

$("exportSettingsBtn")?.addEventListener("click", exportSettings);
$("importSettingsBtn")?.addEventListener("click", () => $("settingsFile")?.click());

$("settingsFile")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const settings = JSON.parse(await file.text());

    if (settings.sliders && typeof settings.sliders === "object") {
      sliderIds.forEach(id => {
        if (settings.sliders[id] !== undefined && $(id)) {
          $(id).value = settings.sliders[id];
          updateSliderOutput(id);
        }
      });
    }

    if (typeof settings.mirrored === "boolean") {
      state.mirrored = settings.mirrored;
      video.classList.toggle("mirrored", state.mirrored);
      if ($("flipBtn")) {
        $("flipBtn").textContent = state.mirrored
          ? "Mirror Flip ON"
          : "Mirror Flip OFF";
      }
    }

    if (settings.facingMode === "user" || settings.facingMode === "environment") {
      state.facingMode = settings.facingMode;
    }

    if (Number.isInteger(settings.activeSlot)) {
      selectSlot(Math.max(0, Math.min(3, settings.activeSlot)));
    }

    applyModelControls();
    toast("Settings imported");
  } catch (error) {
    console.error("Settings import failed:", error);
    showCameraError("Invalid settings file: " + error.message);
  } finally {
    event.target.value = "";
  }
});

/* STARTUP */
function initializeApp() {
  resizeCanvases();
  updateSlotLabels();

  if ($("trackingBtn")) $("trackingBtn").textContent = "Start Tracking";
  if ($("dotsBtn")) $("dotsBtn").textContent = state.dotsVisible
    ? "Green Dots ON"
    : "Green Dots OFF";

  if ($("stopRecordBtn")) $("stopRecordBtn").disabled = true;

  init3D();
  setStatus("Ready");
  setTrackingStatus("Tracking OFF");
  showCameraMessage("Press START CAMERA to begin.");
}

window.addEventListener("resize", resizeCanvases);

window.addEventListener("beforeunload", () => {
  stopTracking();

  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
  }

  if (state.micStream) {
    state.micStream.getTracks().forEach(track => track.stop());
  }

  if (state.recording?.state === "recording") {
    state.recording.stop();
  }

  if (state.landmarker) {
    try {
      state.landmarker.close();
    } catch (error) {
      console.warn("Could not close face model:", error);
    }
  }

  if (state.renderFrame !== null) {
    cancelAnimationFrame(state.renderFrame);
  }

  if (state.renderer) {
    state.renderer.dispose();
  }
});

initializeApp();
     
                
