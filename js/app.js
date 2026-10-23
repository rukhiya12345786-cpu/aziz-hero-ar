// AZEEZ AR STUDIO — APP.JS — PART 1 OF 3

const $ = (id) => document.getElementById(id);

const app = $("app");
const video = $("cameraVideo");
const dotsCanvas = $("dotsCanvas");
const toastBox = $("toast");
const statusBox = $("status");
const trackingStatus = $("trackingStatus");
const dotsCtx = dotsCanvas?.getContext("2d");

const state = {
  stream: null,
  facingMode: "user",
  mirrored: false,
  tracking: false,
  dotsVisible: true,
  landmarker: null,
  landmarkerLoading: false,
  lastVideoTime: -1,
  faceResults: null,

  slots: [null, null, null, null],
  activeSlot: 0,
  renderer: null,
  scene: null,
  camera3D: null,
  three: null,
  modelVisible: true,
  preset: "none",

  recorder: null,
  recordedChunks: [],
  micStream: null,
  micEnabled: false,

  optionsVisible: true,
  slidersVisible: true,
  cleanPreview: false,
  animationId: 0
};

// ---------- MESSAGES AND BUTTON HELPERS ----------

function toast(message) {
  if (!toastBox) return;

  toastBox.textContent = message;
  toastBox.classList.remove("hidden");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    toastBox.classList.add("hidden");
  }, 2800);
}

function setStatus(message) {
  if (statusBox) {
    statusBox.textContent = "● " + message;
  }
}

function setTrackingStatus(message) {
  if (trackingStatus) {
    trackingStatus.textContent = message;
  }
}

function setButton(id, text, active = false) {
  const button = $(id);
  if (!button) return;

  button.textContent = text;
  button.classList.toggle("active", active);
}

function on(id, event, handler) {
  const element = $(id);
  if (element) {
    element.addEventListener(event, handler);
  }
}

function clearDots() {
  if (!dotsCtx || !dotsCanvas) return;

  dotsCtx.clearRect(
    0,
    0,
    dotsCanvas.width,
    dotsCanvas.height
  );
}

// ---------- RESIZE CAMERA CANVASES ----------

function resizeCanvases() {
  const view = $("view");

  if (!view || !dotsCanvas) return;

  const rect = view.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  dotsCanvas.width = Math.max(
    1,
    Math.round(rect.width * dpr)
  );

  dotsCanvas.height = Math.max(
    1,
    Math.round(rect.height * dpr)
  );

  if (state.renderer) {
    state.renderer.setPixelRatio(dpr);

    state.renderer.setSize(
      rect.width,
      rect.height,
      false
    );

    if (state.camera3D) {
      state.camera3D.aspect =
        rect.width / Math.max(1, rect.height);

      state.camera3D.updateProjectionMatrix();
    }
  }

  clearDots();
}

window.addEventListener("resize", resizeCanvases);

window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvases, 250);
});

// ---------- CAMERA ----------

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Camera needs HTTPS and a supported browser.");
    return;
  }

  try {
    await stopCamera(false);

    setStatus("OPENING CAMERA");

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: state.facingMode
          },
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        }
      });

    state.stream = stream;

    video.srcObject = stream;

    video.style.transform = state.mirrored
      ? "scaleX(-1)"
      : "none";

    await video.play();

    resizeCanvases();

    setStatus("CAMERA READY");
    toast("Camera started");

    if (state.tracking) {
      await startTracking();
    }
  } catch (error) {
    console.error("Camera error:", error);

    setStatus("CAMERA ERROR");

    toast(
      "Camera failed. Check permission and HTTPS."
    );
  }
}

async function stopCamera(showMessage = true) {
  if (state.stream) {
    state.stream.getTracks().forEach(track => {
      track.stop();
    });

    state.stream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  stopTracking();
  clearDots();

  if (showMessage) {
    setStatus("CAMERA STOPPED");
    toast("Camera stopped");
  }
}

async function switchCamera() {
  state.facingMode =
    state.facingMode === "user"
      ? "environment"
      : "user";

  if (state.stream) {
    await startCamera();
  } else {
    toast(
      state.facingMode === "user"
        ? "Front camera selected"
        : "Back camera selected"
    );
  }
}

function toggleMirror() {
  state.mirrored = !state.mirrored;

  if (video) {
    video.style.transform = state.mirrored
      ? "scaleX(-1)"
      : "none";
  }

  setButton(
    "flipBtn",
    state.mirrored ? "Mirror ON" : "Mirror OFF",
    state.mirrored
  );
}

// ---------- FACE TRACKING INITIALIZATION ----------

async function loadFaceLandmarker() {
  if (state.landmarker) {
    return state.landmarker;
  }

  if (state.landmarkerLoading) {
    while (state.landmarkerLoading) {
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });
    }

    if (state.landmarker) {
      return state.landmarker;
    }
  }

  state.landmarkerLoading = true;

  try {
    const vision = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
    );

    const fileset =
      await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    state.landmarker =
      await vision.FaceLandmarker.createFromOptions(
        fileset,
        {
          baseOptions: {
            modelAssetPath: new URL(
              "../models/face_landmarker.task",
              import.meta.url
            ).href
          },

          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        }
      );

    return state.landmarker;
  } catch (error) {
    console.error(
      "Face tracking initialization failed:",
      error
    );

    toast(
      "Tracking setup failed. Check internet and model file."
    );

    throw error;
  } finally {
    state.landmarkerLoading = false;
  }
}

// Part 2 will continue with tracking controls,
// landmark drawing and the tracking loop.
   
// ========== PART 2 OF 3 ==========

// ---------- TRACKING CONTROLS ----------

async function startTracking() {
  if (!state.stream) {
    toast("Start the camera first.");
    return;
  }

  try {
    setStatus("LOADING FACE TRACKING");
    await loadFaceLandmarker();

    state.tracking = true;
    state.lastVideoTime = -1;

    setButton("trackingBtn", "◎ Stop Tracking", true);
    setTrackingStatus("TRACKING ON");
    setStatus("FACE TRACKING ON");

    trackingLoop();
  } catch (error) {
    state.tracking = false;
    setButton("trackingBtn", "◎ Start Tracking");
    setTrackingStatus("TRACKING ERROR");
  }
}

function stopTracking() {
  state.tracking = false;

  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }

  setButton("trackingBtn", "◎ Start Tracking");
  setTrackingStatus("TRACKING OFF");
  clearDots();
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

  setButton(
    "dotsBtn",
    state.dotsVisible ? "● Green Dots ON" : "● Green Dots OFF",
    state.dotsVisible
  );

  if (!state.dotsVisible) clearDots();
}

// ---------- TRACKING LOOP ----------

function trackingLoop() {
  if (!state.tracking || !state.landmarker) return;

  if (
    video &&
    video.readyState >= 2 &&
    video.currentTime !== state.lastVideoTime
  ) {
    state.lastVideoTime = video.currentTime;

    try {
      state.faceResults = state.landmarker.detectForVideo(
        video,
        performance.now()
      );

      drawFaceDots(state.faceResults);
      updateFaceModel();
    } catch (error) {
      console.warn("Tracking frame failed:", error);
    }
  }

  state.animationId = requestAnimationFrame(trackingLoop);
}

// ---------- GREEN FACE LANDMARK DOTS ----------

function drawFaceDots(results) {
  if (!dotsCanvas || !dotsCtx || !state.dotsVisible) {
    clearDots();
    return;
  }

  const view = $("view");
  if (!view || !video) return;

  const rect = view.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  dotsCtx.clearRect(
    0,
    0,
    dotsCanvas.width,
    dotsCanvas.height
  );

  const faces = results?.faceLandmarks || [];

  if (!faces.length) {
    setTrackingStatus("FACE NOT DETECTED");
    return;
  }

  setTrackingStatus("FACE DETECTED");

  const videoW = video.videoWidth || rect.width;
  const videoH = video.videoHeight || rect.height;

  // Match the video element's object-fit: cover layout.
  const scale = Math.max(
    rect.width / videoW,
    rect.height / videoH
  );

  const drawW = videoW * scale;
  const drawH = videoH * scale;
  const offX = (rect.width - drawW) / 2;
  const offY = (rect.height - drawH) / 2;

  dotsCtx.fillStyle =
    state.preset === "neon"
      ? "#62f7ff"
      : "#36f5a2";

  for (const point of faces[0]) {
    let x = offX + point.x * drawW;
    const y = offY + point.y * drawH;

    if (state.mirrored) {
      x = rect.width - x;
    }

    const radius =
      Math.max(1.2, Math.min(2.6, rect.width / 170)) * dpr;

    dotsCtx.beginPath();
    dotsCtx.arc(
      x * dpr,
      y * dpr,
      radius,
      0,
      Math.PI * 2
    );
    dotsCtx.fill();
  }
}

// ---------- THREE.JS INITIALIZATION ----------

async function init3D() {
  if (state.renderer) return;

  try {
    const THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
    );

    state.three = THREE;
    state.scene = new THREE.Scene();

    state.camera3D = new THREE.PerspectiveCamera(
      45,
      1,
      0.01,
      1000
    );

    state.camera3D.position.set(0, 0, 8);

    const canvas = $("arCanvas");

    state.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    state.renderer.setClearColor(0x000000, 0);
    state.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    state.scene.add(
      new THREE.HemisphereLight(0xffffff, 0x404050, 2)
    );

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 4, 6);
    state.scene.add(light);

    resizeCanvases();
    render3D();

    setStatus("3D VIEW READY");
  } catch (error) {
    console.error("3D setup failed:", error);
    toast("3D setup failed. Check internet and WebGL support.");
  }
}

function render3D() {
  if (!state.renderer || !state.scene || !state.camera3D) return;

  state.renderer.render(state.scene, state.camera3D);

  requestAnimationFrame(render3D);
}

// ---------- MODEL IMPORT HELPERS ----------

async function loadModelFile(file) {
  if (!file) return;

  await init3D();

  if (!state.three || !state.scene) {
    toast("3D view is unavailable.");
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();

  try {
    let object;

    if (extension === "glb" || extension === "gltf") {
      const { GLTFLoader } = await import(
        "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"
      );

      const url = URL.createObjectURL(file);

      try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        object = gltf.scene;
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (extension === "obj") {
      const { OBJLoader } = await import(
        "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js"
      );

      object = new OBJLoader().parse(await file.text());
    } else if (extension === "fbx") {
      const { FBXLoader } = await import(
        "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js"
      );

      const buffer = await file.arrayBuffer();
      object = new FBXLoader().parse(buffer, "");
    } else {
      toast("Choose a GLB, GLTF, OBJ or FBX file.");
      return;
    }

    const slot = state.activeSlot;

    if (state.slots[slot]) {
      state.scene.remove(state.slots[slot]);
    }

    // Fit the imported object into a predictable starting size.
    const THREE = state.three;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      object.scale.multiplyScalar(2 / maxDim);
    }

    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);

    object.userData.originalPosition = object.position.clone();
    object.userData.originalScale = object.scale.clone();

    state.slots[slot] = object;
    state.scene.add(object);
    state.modelVisible = true;

    updateSlotLabels();
    applyModelControls();

    toast("Model imported into Slot " + (slot + 1));
  } catch (error) {
    console.error("Model import failed:", error);
    toast("Could not load this model. Check its format and files.");
  }
}

// ---------- MODEL SLOT HELPERS ----------

function updateSlotLabels() {
  document.querySelectorAll(".slot").forEach((button, index) => {
    const hasModel = Boolean(state.slots[index]);

    button.textContent =
      "Slot " + (index + 1) + (hasModel ? " · Loaded" : " · Empty");

    button.classList.toggle(
      "active",
      index === state.activeSlot
    );
  });
}

function selectSlot(index) {
  if (index < 0 || index >= state.slots.length) return;

  state.activeSlot = index;
  updateSlotLabels();
  applyModelControls();
}

function getActiveModel() {
  return state.slots[state.activeSlot] || null;
}

// Part 3 will add transforms, face-model updates,
// recording, interface controls and event handlers.
      
// ========== PART 3 OF 3 ==========

// ---------- MODEL TRANSFORMS ----------

function applyModelControls() {
  const model = getActiveModel();
  if (!model) return;

  const number = (id, fallback = 0) => {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  model.position.x = number("posX") + number("faceX");
  model.position.y = number("posY") + number("faceY");
  model.position.z = number("posZ") + number("faceZ");

  const toRadians = degrees => degrees * Math.PI / 180;

  model.rotation.x = toRadians(number("rotX"));
  model.rotation.y = toRadians(number("rotY"));
  model.rotation.z = toRadians(number("rotZ"));

  const scale = Math.max(0.01, number("modelScale", 1));
  const faceScale = Math.max(0.01, number("faceSize", 1));

  const baseScale = model.userData.originalScale;
  if (baseScale) {
    model.scale.set(
      baseScale.x * scale * faceScale,
      baseScale.y * scale * faceScale,
      baseScale.z * scale * faceScale
    );
  }

  model.visible = state.modelVisible;
  if ($("scaleOut")) {
    $("scaleOut").textContent = scale.toFixed(2) + "×";
  }
}

function resetTransform() {
  const defaults = {
    posX: 0, posY: 0, posZ: 0,
    rotX: 0, rotY: 0, rotZ: 0,
    modelScale: 1
  };

  Object.entries(defaults).forEach(([id, value]) => {
    if ($(id)) $(id).value = String(value);
  });

  applyModelControls();
}

function resetFaceControls() {
  const defaults = {
    faceX: 0, faceY: 0, faceZ: 0,
    faceSize: 1,
    leftEye: 1, rightEye: 1,
    mouthScale: 1, mouthOpen: 0,
    blinkLeft: 0, blinkRight: 0
  };

  Object.entries(defaults).forEach(([id, value]) => {
    if ($(id)) $(id).value = String(value);
  });

  applyModelControls();
}

function resetAllControls() {
  resetTransform();
  resetFaceControls();
}

function updateFaceModel() {
  // Face landmarks and expression data are available in
  // state.faceResults. This basic version does not yet
  // deform a model or attach it to a tracked face.
  if (!state.faceResults?.faceLandmarks?.length) return;

  // Do not overwrite the user's manual positioning sliders.
}

function removeActiveModel() {
  const model = getActiveModel();

  if (model && state.scene) {
    state.scene.remove(model);
    state.slots[state.activeSlot] = null;
    updateSlotLabels();
    toast("Model removed from current slot");
  }
}

function clearActiveSlot() {
  removeActiveModel();
}

function toggleModelVisibility() {
  state.modelVisible = !state.modelVisible;

  const model = getActiveModel();
  if (model) model.visible = state.modelVisible;

  setButton(
    "showModelBtn",
    state.modelVisible ? "Hide Model" : "Show Model",
    state.modelVisible
  );
}

function autoFitModel() {
  const model = getActiveModel();
  if (!model) {
    toast("Import a model first.");
    return;
  }

  resetTransform();
  toast("Model transform reset to starting size.");
}

// ---------- LENS PRESETS ----------

function setPreset(preset) {
  state.preset = preset;

  document.querySelectorAll(".preset-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.preset === preset
    );
  });

  if (preset === "green") {
    state.dotsVisible = true;
    setButton("dotsBtn", "● Green Dots ON", true);
  }

  if (preset === "neon") {
    state.dotsVisible = true;
    setButton("dotsBtn", "● Green Dots ON", true);
  }

  toast("Preview preset: " + preset);
}

// ---------- INTERFACE VISIBILITY ----------

function toggleButtonsVisibility() {
  state.optionsVisible = !state.optionsVisible;

  app?.classList.toggle(
    "buttons-hidden",
    !state.optionsVisible
  );

  setButton(
    "hideOptionsBtn",
    state.optionsVisible ? "Hide Buttons" : "Show Buttons"
  );
}

function toggleSlidersVisibility() {
  state.slidersVisible = !state.slidersVisible;

  app?.classList.toggle(
    "sliders-hidden",
    !state.slidersVisible
  );

  setButton(
    "hideSlidersBtn",
    state.slidersVisible ? "Hide Sliders" : "Show Sliders"
  );
}

function enterCleanPreview() {
  state.cleanPreview = true;
  app?.classList.add("clean-preview");
}

function exitCleanPreview() {
  state.cleanPreview = false;
  app?.classList.remove("clean-preview");
}

function openWorkspace() {
  exitCleanPreview();

  $("lensWorkspace")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function toggleFullscreen() {
  try {
    const target = $("previewPanel");

    if (!document.fullscreenElement) {
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      } else {
        toast("Fullscreen is not supported by this browser.");
      }
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
    toast("Fullscreen could not be started.");
  }
}

// ---------- RECORDING ----------

async function toggleMicrophone() {
  if (state.micEnabled) {
    state.micStream?.getTracks().forEach(track => track.stop());
    state.micStream = null;
    state.micEnabled = false;
    setButton("micBtn", "Mic OFF");
    toast("Microphone disabled");
    return;
  }

  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    state.micEnabled = true;
    setButton("micBtn", "Mic ON", true);
    toast("Microphone enabled");
  } catch (error) {
    console.error("Microphone error:", error);
    toast("Microphone permission was not granted.");
  }
}

function startRecording() {
  if (!state.stream) {
    toast("Start the camera first.");
    return;
  }

  if (!window.MediaRecorder) {
    toast("Recording is not supported by this browser.");
    return;
  }

  try {
    state.recordedChunks = [];

    const tracks = [
      ...state.stream.getVideoTracks(),
      ...(state.micEnabled && state.micStream
        ? state.micStream.getAudioTracks()
        : [])
    ];

    const recordingStream = new MediaStream(tracks);

    const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? { mimeType: "video/webm;codecs=vp8" }
      : {};

    state.recorder = new MediaRecorder(recordingStream, options);

    state.recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };

    state.recorder.onstop = () => {
      const blob = new Blob(state.recordedChunks, {
        type: state.recorder?.mimeType || "video/webm"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "azeez-ar-recording.webm";
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("Recording downloaded");
    };

    state.recorder.start();

    setButton("recordBtn", "● Recording", true);
    toast("Recording started");
  } catch (error) {
    console.error("Recording failed:", error);
    toast("Could not start recording.");
  }
}

function stopRecording() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
    setButton("recordBtn", "● Start Recording");
  } else {
    toast("No recording is active.");
  }
}

// ---------- SETTINGS IMPORT / EXPORT ----------

function exportSettings() {
  const ids = [
    "posX", "posY", "posZ",
    "rotX", "rotY", "rotZ", "modelScale",
    "faceX", "faceY", "faceZ", "faceSize",
    "leftEye", "rightEye", "mouthScale",
    "mouthOpen", "blinkLeft", "blinkRight"
  ];

  const values = {};

  ids.forEach(id => {
    if ($(id)) values[id] = $(id).value;
  });

  const settings = {
    version: 1,
    values,
    activeSlot: state.activeSlot,
    mirrored: state.mirrored,
    dotsVisible: state.dotsVisible,
    preset: state.preset
  };

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

async function importSettings(file) {
  if (!file) return;

  try {
    const settings = JSON.parse(await file.text());

    if (!settings || typeof settings !== "object") {
      throw new Error("Invalid settings file");
    }

    Object.entries(settings.values || {}).forEach(([id, value]) => {
      const element = $(id);

      if (
        element &&
        element.matches("input[type='range']") &&
        Number.isFinite(Number(value))
      ) {
        element.value = String(value);
      }
    });

    if (Number.isInteger(settings.activeSlot) &&
        settings.activeSlot >= 0 &&
        settings.activeSlot < state.slots.length) {
      selectSlot(settings.activeSlot);
    }

    if (typeof settings.mirrored === "boolean" &&
        settings.mirrored !== state.mirrored) {
      toggleMirror();
    }

    if (typeof settings.dotsVisible === "boolean" &&
        settings.dotsVisible !== state.dotsVisible) {
      toggleDots();
    }

    if (typeof settings.preset === "string") {
      setPreset(settings.preset);
    }

    applyModelControls();
    toast("Settings imported");
  } catch (error) {
    console.error("Settings import failed:", error);
    toast("Invalid settings JSON file.");
  }
}

// ---------- EVENT HANDLERS ----------

on("startCameraBtn", "click", startCamera);
on("switchCameraBtn", "click", switchCamera);
on("flipBtn", "click", toggleMirror);
on("fullscreenBtn", "click", toggleFullscreen);

on("trackingBtn", "click", toggleTracking);
on("dotsBtn", "click", toggleDots);

on("stopCameraBtn", "click", () => stopCamera());
on("hideOptionsBtn", "click", toggleButtonsVisibility);
on("showButtonsBtn", "click", () => {
  state.optionsVisible = true;
  app?.classList.remove("buttons-hidden");
});

on("hideSlidersBtn", "click", toggleSlidersVisibility);
on("showSlidersBtn", "click", () => {
  state.slidersVisible = true;
  app?.classList.remove("sliders-hidden");
});

on("cleanScreenBtn", "click", enterCleanPreview);
on("exitCleanBtn", "click", exitCleanPreview);
on("restoreInterfaceBtn", "click", exitCleanPreview);
on("showEditorBtn", "click", openWorkspace);

on("importModelBtn", "click", () => $("modelFile")?.click());
on("modelFile", "change", event => {
  const file = event.target.files?.[0];
  if (file) loadModelFile(file);
  event.target.value = "";
});

document.querySelectorAll(".slot").forEach((button, index) => {
  button.addEventListener("click", () => selectSlot(index));
});

document.querySelectorAll(".preset-btn").forEach(button => {
  button.addEventListener("click", () => {
    setPreset(button.dataset.preset || "none");
  });
});

[
  "posX", "posY", "posZ",
  "rotX", "rotY", "rotZ", "modelScale",
  "faceX", "faceY", "faceZ", "faceSize"
].forEach(id => {
  on(id, "input", applyModelControls);
});

on("resetTransformBtn", "click", resetTransform);
on("resetFaceBtn", "click", resetFaceControls);
on("resetAllBtn", "click", resetAllControls);
on("autoFitBtn", "click", autoFitModel);
on("removeModelBtn", "click", removeActiveModel);
on("clearModelBtn", "click", clearActiveSlot);
on("showModelBtn", "click", toggleModelVisibility);

on("recordBtn", "click", startRecording);
on("stopRecordBtn", "click", stopRecording);
on("micBtn", "click", toggleMicrophone);

on("exportSettingsBtn", "click", exportSettings);
on("importSettingsBtn", "click", () => $("settingsFile")?.click());
on("settingsFile", "change", event => {
  const file = event.target.files?.[0];
  if (file) importSettings(file);
  event.target.value = "";
});

// ---------- STARTUP ----------

function initializeApp() {
  resizeCanvases();
  updateSlotLabels();

  setStatus("SYSTEM READY");
  setTrackingStatus("TRACKING OFF");

  // Load 3D support without blocking camera controls.
  init3D();
}

initializeApp();

window.addEventListener("beforeunload", () => {
  stopTracking();

  state.stream?.getTracks().forEach(track => track.stop());
  state.micStream?.getTracks().forEach(track => track.stop());

  if (state.renderer) {
    state.renderer.dispose();
  }

  if (state.landmarker) {
    state.landmarker.close();
  }
});
          
