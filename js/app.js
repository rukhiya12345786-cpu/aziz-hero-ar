
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js";

const $ = (id) => document.getElementById(id);

const video = $("cameraVideo");
const threeCanvas = $("threeCanvas");
const faceCanvas = $("faceCanvas");
const faceCtx = faceCanvas.getContext("2d");

const state = {
  stream: null,
  facingMode: "user",
  mirror: false,
  landmarker: null,
  tracking: false,
  detecting: false,
  meshVisible: false,
  landmarksVisible: false,
  autoHeadFit: true,
  expressionTracking: true,
  model: null,
  recorder: null,
  recordingChunks: [],
  animationId: 0,
  lastVideoTime: -1,
  slidersHidden: false,
  controlsHidden: false,
  modelScale: 1,
  headFit: 1,
  modelOpacity: 1,
  faceX: 0,
  faceY: 0,
  faceZ: 0,
  faceYaw: 0,
  facePitch: 0,
  faceRoll: 0
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  alpha: true,
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xffffff, 0x526070, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(1, 2, 5);
scene.add(keyLight);

const headAnchor = new THREE.Group();
scene.add(headAnchor);

const modelOffset = new THREE.Group();
headAnchor.add(modelOffset);

const trackingGroup = new THREE.Group();
scene.add(trackingGroup);

const faceGeometry = new THREE.BufferGeometry();
const faceMaterial = new THREE.PointsMaterial({
  color: 0x22ff88,
  size: 0.025,
  sizeAttenuation: true
});

const facePoints = new THREE.Points(faceGeometry, faceMaterial);
facePoints.visible = false;
scene.add(facePoints);

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setButtonText(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setGeneral(message) {
  setStatus("generalStatus", message);
}

function resizeScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  faceCanvas.width = Math.round(width * Math.min(window.devicePixelRatio || 1, 2));
  faceCanvas.height = Math.round(height * Math.min(window.devicePixelRatio || 1, 2));

  faceCanvas.style.width = width + "px";
  faceCanvas.style.height = height + "px";

  faceCtx.setTransform(
    faceCanvas.width / width,
    0,
    0,
    faceCanvas.height / height,
    0,
    0
  );
}

window.addEventListener("resize", resizeScene);
resizeScene();

function clearFaceDrawing() {
  faceCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function updateSliderValue(id, value) {
  const output = $(id + "Value");
  if (output) output.textContent = Number(value).toFixed(2);
}

function getNumber(id, fallback = 0) {
  const element = $(id);
  if (!element) return fallback;

  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}
async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera requires HTTPS and browser permission.");
    }

    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }

    setStatus("cameraStatus", "Requesting camera permission...");
    setGeneral("Starting camera...");

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
    video.muted = true;
    video.playsInline = true;

    await video.play();

    const placeholder = $("cameraPlaceholder");
    if (placeholder) placeholder.style.display = "none";

    video.style.transform = state.mirror ? "scaleX(-1)" : "none";

    setStatus("cameraStatus", "Camera working.");
    setGeneral("Camera started.");

    if (state.tracking) await startFaceTracking();
  } catch (error) {
    console.error("Camera error:", error);
    setStatus("cameraStatus", "Camera error: " + error.message);
    setGeneral("Check camera permission and HTTPS.");
  }
}

function stopCamera() {
  stopFaceTracking();

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  video.srcObject = null;

  const placeholder = $("cameraPlaceholder");
  if (placeholder) placeholder.style.display = "flex";

  setStatus("cameraStatus", "Camera stopped.");
  setGeneral("Camera stopped.");
}

async function switchCamera() {
  state.facingMode =
    state.facingMode === "user" ? "environment" : "user";

  if (state.stream) await startCamera();

  setGeneral("Selected camera: " + state.facingMode);
}

function toggleMirror() {
  state.mirror = !state.mirror;
  video.style.transform = state.mirror ? "scaleX(-1)" : "none";

  setButtonText(
    "mirrorBtn",
    state.mirror ? "MIRROR: ON" : "MIRROR: OFF"
  );
}

async function loadFaceLandmarker() {
  if (state.landmarker) return state.landmarker;

  setStatus("faceStatus", "Loading face tracking...");

  const vision = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
  );

  const files = await vision.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
  );

  state.landmarker = await vision.FaceLandmarker.createFromOptions(
    files,
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

  return state.landmarker;
}

async function startFaceTracking() {
  if (!state.stream) {
    setStatus("faceStatus", "Start the camera first.");
    return;
  }

  try {
    state.tracking = true;
    await loadFaceLandmarker();

    setStatus("faceStatus", "Face tracking running.");

    if (!state.detecting) {
      state.detecting = true;
      detectFaceLoop();
    }
  } catch (error) {
    state.tracking = false;
    console.error("Tracking error:", error);
    setStatus("faceStatus", "Tracking error: " + error.message);
  }
}

function stopFaceTracking() {
  state.tracking = false;
  state.detecting = false;
  state.lastVideoTime = -1;

  headAnchor.visible = false;
  facePoints.visible = false;

  faceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([], 3)
  );

  clearFaceDrawing();
  setStatus("faceStatus", "Face tracking stopped.");
}

function detectFaceLoop() {
  if (!state.detecting) return;

  if (
    state.tracking &&
    state.landmarker &&
    video.readyState >= 2 &&
    video.currentTime !== state.lastVideoTime
  ) {
    state.lastVideoTime = video.currentTime;

    try {
      const result = state.landmarker.detectForVideo(
        video,
        performance.now()
      );

      processFaceResult(result);
    } catch (error) {
      console.error("Face detection error:", error);
      setStatus("faceStatus", "Face detection error.");
    }
  }

  if (state.detecting) requestAnimationFrame(detectFaceLoop);
}

function processFaceResult(result) {
  const faces = result.faceLandmarks || [];

  if (!faces.length) {
    headAnchor.visible = false;
    clearFaceDrawing();
    setStatus("faceStatus", "Looking for face...");
    return;
  }

  const landmarks = faces[0];
  const nose = landmarks[1] || landmarks[4] || landmarks[0];

  if (!nose) return;

  headAnchor.visible = true;

  state.faceX = (0.5 - nose.x) * 4;
  state.faceY = (0.5 - nose.y) * 3;
  state.faceZ = -nose.z * 2;

  headAnchor.position.set(
    state.faceX + getNumber("meshXSlider"),
    state.faceY + getNumber("meshYSlider"),
    state.faceZ + getNumber("meshZSlider")
  );

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  if (leftEye && rightEye) {
    state.faceYaw = (nose.x - 0.5) * 1.5;
    state.faceRoll = -Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );
  }

  headAnchor.rotation.set(
    state.facePitch,
    state.faceYaw,
    state.faceRoll
  );

  const points = [];

  if (state.landmarksVisible) {
    for (const point of landmarks) {
      points.push(
        (point.x - 0.5) * 4,
        (0.5 - point.y) * 3,
        -point.z * 2
      );
    }
  }

  faceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );

  facePoints.visible = state.landmarksVisible;
  facePoints.scale.setScalar(getNumber("meshSizeSlider", 1));

  if (state.meshVisible) {
    drawFaceOutline(landmarks);
  } else {
    clearFaceDrawing();
  }

  setStatus("faceStatus", "Face detected.");
}

function drawFaceOutline(landmarks) {
  clearFaceDrawing();

  const width = window.innerWidth;
  const height = window.innerHeight;

  const outline = [
    10, 338, 297, 332, 284, 251, 389, 356,
    454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109
  ];

  faceCtx.strokeStyle = "#22ff88";
  faceCtx.lineWidth = 2;
  faceCtx.beginPath();

  outline.forEach((index, i) => {
    const point = landmarks[index];
    if (!point) return;

    const x = (state.mirror ? 1 - point.x : point.x) * width;
    const y = point.y * height;

    if (i === 0) faceCtx.moveTo(x, y);
    else faceCtx.lineTo(x, y);
  });

  faceCtx.closePath();
  faceCtx.stroke();
}

function applySettingsToScene() {
  const scale = getNumber("modelScaleSlider", 1);
  const fit = state.autoHeadFit ? getNumber("headFitSlider", 1) : 1;

  modelOffset.position.set(
    getNumber("modelXSlider"),
    getNumber("modelYSlider"),
    getNumber("modelZSlider")
  );

  modelOffset.rotation.set(
    THREE.MathUtils.degToRad(getNumber("modelPitchSlider")),
    THREE.MathUtils.degToRad(getNumber("modelYawSlider")),
    THREE.MathUtils.degToRad(getNumber("modelRollSlider"))
  );

  modelOffset.scale.setScalar(scale * fit);

  state.modelOpacity = getNumber("opacitySlider", 1);

  if (state.model) {
    state.model.traverse((object) => {
      if (!object.isMesh || !object.material) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        material.transparent = state.modelOpacity < 1;
        material.opacity = state.modelOpacity;
        material.needsUpdate = true;
      });
    });
  }

  const overlay = $("sliderOverlay");
  if (overlay) {
    overlay.style.setProperty(
      "--panel-alpha",
      String(getNumber("opacitySlider", 0.48))
    );
  }
}

function connectSlider(id, callback) {
  const element = $(id);
  if (!element) return;

  const update = () => {
    updateSliderValue(id, element.value);
    callback();
  };

  element.addEventListener("input", update);
  updateSliderValue(id, element.value);
}

function resetModel() {
  if (state.model) {
    modelOffset.remove(state.model);

    state.model.traverse((object) => {
      if (object.geometry) object.geometry.dispose();

      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((material) => material.dispose());
      }
    });

    state.model = null;
  }

  setStatus("modelStatus", "No model loaded.");
  setGeneral("Model reset.");
}

function loadModelFile(file) {
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();
  const url = URL.createObjectURL(file);

  setStatus("modelStatus", "Loading " + file.name + "...");

  let loader;

  if (extension === "glb" || extension === "gltf") {
    loader = new GLTFLoader();

    loader.load(
      url,
      (result) => {
        addLoadedModel(result.scene || result.scenes[0], file.name);
        URL.revokeObjectURL(url);
      },
      undefined,
      (error) => {
        console.error("GLTF load error:", error);
        setStatus("modelStatus", "Could not load GLB/GLTF model.");
        URL.revokeObjectURL(url);
      }
    );

    return;
  }

  if (extension === "obj") {
    loader = new OBJLoader();

    loader.load(
      url,
      (object) => {
        addLoadedModel(object, file.name);
        URL.revokeObjectURL(url);
      },
      undefined,
      (error) => {
        console.error("OBJ load error:", error);
        setStatus("modelStatus", "Could not load OBJ model.");
        URL.revokeObjectURL(url);
      }
    );

    return;
  }

  if (extension === "fbx") {
    loader = new FBXLoader();

    loader.load(
      url,
      (object) => {
        addLoadedModel(object, file.name);
        URL.revokeObjectURL(url);
      },
      undefined,
      (error) => {
        console.error("FBX load error:", error);
        setStatus("modelStatus", "Could not load FBX model.");
        URL.revokeObjectURL(url);
      }
    );

    return;
  }

  URL.revokeObjectURL(url);
  setStatus("modelStatus", "Supported files: GLB, GLTF, OBJ, FBX.");
}

function addLoadedModel(object, fileName) {
  if (state.model) {
    modelOffset.remove(state.model);
  }

  state.model = object;

  object.traverse((child) => {
    if (!child.isMesh) return;

    child.frustumCulled = false;

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    }
  });

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension > 0) {
    object.scale.setScalar(1 / maxDimension);
  }

  modelOffset.add(object);
  applySettingsToScene();

  setStatus("modelStatus", "Loaded: " + fileName);
  setGeneral("3D model imported.");
}

function toggleFaceMesh() {
  state.meshVisible = !state.meshVisible;

  setButtonText(
    "toggleMeshBtn",
    state.meshVisible ? "HIDE FACE MESH" : "SHOW FACE MESH"
  );

  if (!state.meshVisible) clearFaceDrawing();
}

function toggleLandmarks() {
  state.landmarksVisible = !state.landmarksVisible;
  facePoints.visible = state.landmarksVisible;

  setButtonText(
    "toggleLandmarksBtn",
    state.landmarksVisible ? "HIDE LANDMARKS" : "SHOW LANDMARKS"
  );
}

function toggleAutoHeadFit() {
  state.autoHeadFit = !state.autoHeadFit;

  setButtonText(
    "autoHeadFitBtn",
    state.autoHeadFit ? "AUTO HEAD FIT: ON" : "AUTO HEAD FIT: OFF"
  );

  applySettingsToScene();
}

function toggleExpressionTracking() {
  state.expressionTracking = !state.expressionTracking;

  setButtonText(
    "expressionTrackingBtn",
    state.expressionTracking
      ? "EXPRESSION TRACKING: ON"
      : "EXPRESSION TRACKING: OFF"
  );

  setGeneral(
    state.expressionTracking
      ? "Expression data enabled when available."
      : "Expression tracking display disabled."
  );
}

function toggleSliders() {
  state.slidersHidden = !state.slidersHidden;

  $("sliderOverlay").classList.toggle(
    "hidden-panel",
    state.slidersHidden
  );

  setButtonText(
    "toggleSlidersBtn",
    state.slidersHidden ? "SHOW SLIDERS" : "HIDE SLIDERS"
  );
}

function toggleControls() {
  state.controlsHidden = !state.controlsHidden;

  $("topControls").classList.toggle(
    "hidden-panel",
    state.controlsHidden
  );

  setButtonText(
    "toggleControlsBtn",
    state.controlsHidden ? "SHOW CONTROLS" : "HIDE CONTROLS"
  );
}

function exportSettings() {
  const settings = {};

  const ids = [
    "meshSizeSlider", "meshXSlider", "meshYSlider", "meshZSlider",
    "modelScaleSlider", "modelXSlider", "modelYSlider", "modelZSlider",
    "modelPitchSlider", "modelYawSlider", "modelRollSlider",
    "headFitSlider", "opacitySlider"
  ];

  ids.forEach((id) => {
    const element = $(id);
    if (element) settings[id] = element.value;
  });

  settings.facingMode = state.facingMode;
  settings.mirror = state.mirror;
  settings.autoHeadFit = state.autoHeadFit;
  settings.expressionTracking = state.expressionTracking;

  const blob = new Blob(
    [JSON.stringify(settings, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "azeez-ar-settings.json";
  link.click();

  URL.revokeObjectURL(url);
  setGeneral("Settings exported.");
}

function importSettingsFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const settings = JSON.parse(reader.result);

      Object.keys(settings).forEach((id) => {
        const element = $(id);

        if (element && element.type === "range") {
          element.value = settings[id];
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });

      if (typeof settings.mirror === "boolean") {
        state.mirror = settings.mirror;
        video.style.transform = state.mirror ? "scaleX(-1)" : "none";
        setButtonText("mirrorBtn", state.mirror ? "MIRROR: ON" : "MIRROR: OFF");
      }

      if (settings.facingMode === "user" || settings.facingMode === "environment") {
        state.facingMode = settings.facingMode;
      }

      if (typeof settings.autoHeadFit === "boolean") {
        state.autoHeadFit = settings.autoHeadFit;
        setButtonText("autoHeadFitBtn", state.autoHeadFit ? "AUTO HEAD FIT: ON" : "AUTO HEAD FIT: OFF");
      }

      if (typeof settings.expressionTracking === "boolean") {
        state.expressionTracking = settings.expressionTracking;
        setButtonText("expressionTrackingBtn", state.expressionTracking ? "EXPRESSION TRACKING: ON" : "EXPRESSION TRACKING: OFF");
      }

      applySettingsToScene();
      setGeneral("Settings imported.");
    } catch (error) {
      console.error("Settings import error:", error);
      setGeneral("Invalid settings file.");
    }
  };

  reader.readAsText(file);
}

async function startRecording() {
  if (!state.stream) {
    setStatus("recordingStatus", "Start the camera before recording.");
    return;
  }

  if (!window.MediaRecorder) {
    setStatus("recordingStatus", "Recording is not supported in this browser.");
    return;
  }

  try {
    const combined = document.createElement("canvas");
    combined.width = window.innerWidth;
    combined.height = window.innerHeight;

    const context = combined.getContext("2d");
    const drawFrame = () => {
      if (!state.recorder || state.recorder.state !== "recording") return;

      if (video.readyState >= 2) {
        context.drawImage(video, 0, 0, combined.width, combined.height);
      }

      context.drawImage(threeCanvas, 0, 0, combined.width, combined.height);
      context.drawImage(faceCanvas, 0, 0, combined.width, combined.height);

      requestAnimationFrame(drawFrame);
    };

    const stream = combined.captureStream(30);
    state.recordingChunks = [];

    const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? { mimeType: "video/webm;codecs=vp9" }
      : { mimeType: "video/webm" };

    state.recorder = new MediaRecorder(stream, options);

    state.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recordingChunks.push(event.data);
      }
    };

    state.recorder.onstop = () => {
      const blob = new Blob(state.recordingChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "azeez-ar-recording.webm";
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("recordingStatus", "Recording saved.");
      state.recorder = null;
    };

    state.recorder.start();
    drawFrame();

    setStatus("recordingStatus", "Recording...");
    setGeneral("Recording started. Audio is not included.");
  } catch (error) {
    console.error("Recording error:", error);
    setStatus("recordingStatus", "Recording error: " + error.message);
  }
}

function stopRecording() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
  } else {
    setStatus("recordingStatus", "No active recording.");
  }
}

function resetAllSettings() {
  const defaults = {
    meshSizeSlider: 1,
    meshXSlider: 0,
    meshYSlider: 0,
    meshZSlider: 0,
    modelScaleSlider: 1,
    modelXSlider: 0,
    modelYSlider: 0,
    modelZSlider: 0,
    modelPitchSlider: 0,
    modelYawSlider: 0,
    modelRollSlider: 0,
    headFitSlider: 1,
    opacitySlider: 0.48
  };

  Object.entries(defaults).forEach(([id, value]) => {
    const element = $(id);

    if (element) {
      element.value = String(value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      updateSliderValue(id, value);
    }
  });

  applySettingsToScene();
  setGeneral("Settings reset.");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch((error) => {
      console.warn("Fullscreen unavailable:", error);
    });
  } else {
    document.exitFullscreen?.();
  }
}

function connectButton(id, callback) {
  const element = $(id);

  if (!element) {
    console.warn("Missing HTML button:", id);
    return;
  }

  element.addEventListener("click", () => {
    try {
      const result = callback();

      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          console.error("Button action failed:", id, error);
          setGeneral("Action failed: " + id);
        });
      }
    } catch (error) {
      console.error("Button action failed:", id, error);
      setGeneral("Action failed: " + id);
    }
  });
}

function connectFileInput(buttonId, inputId, callback) {
  connectButton(buttonId, () => $(inputId)?.click());

  const input = $(inputId);

  if (input) {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) callback(file);
      input.value = "";
    });
  }
}

function initializeApp() {
  connectButton("startCameraBtn", startCamera);
  connectButton("placeholderStartBtn", startCamera);
  connectButton("stopCameraBtn", stopCamera);
  connectButton("switchCameraBtn", switchCamera);
  connectButton("mirrorBtn", toggleMirror);

  connectButton("startTrackingBtn", startFaceTracking);
  connectButton("stopTrackingBtn", stopFaceTracking);

  connectFileInput("importModelBtn", "modelFileInput", loadModelFile);
  connectButton("resetModelBtn", resetModel);
  connectButton("exportSettingsBtn", exportSettings);
  connectFileInput("importSettingsBtn", "settingsFileInput", importSettingsFile);

  connectButton("toggleMeshBtn", toggleFaceMesh);
  connectButton("toggleLandmarksBtn", toggleLandmarks);
  connectButton("autoHeadFitBtn", toggleAutoHeadFit);
  connectButton("expressionTrackingBtn", toggleExpressionTracking);

  connectButton("toggleSlidersBtn", toggleSliders);
  connectButton("toggleControlsBtn", toggleControls);

  connectButton("startRecordingBtn", startRecording);
  connectButton("stopRecordingBtn", stopRecording);
  connectButton("resetAllBtn", resetAllSettings);
  connectButton("toggleFullscreenBtn", toggleFullscreen);

  [
    "meshSizeSlider", "meshXSlider", "meshYSlider", "meshZSlider",
    "modelScaleSlider", "modelXSlider", "modelYSlider", "modelZSlider",
    "modelPitchSlider", "modelYawSlider", "modelRollSlider",
    "headFitSlider", "opacitySlider"
  ].forEach((id) => connectSlider(id, applySettingsToScene));

  setStatus("cameraStatus", "Camera stopped.");
  setStatus("faceStatus", "Face tracking not started.");
  setStatus("modelStatus", "No model loaded.");
  setStatus("recordingStatus", "Recording stopped.");
  setGeneral("Azeez AR ready.");
}

function animateScene() {
  state.animationId = requestAnimationFrame(animateScene);
  renderer.render(scene, camera);
}

initializeApp();
animateScene();
          
