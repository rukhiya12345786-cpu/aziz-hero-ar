/* =====================================================
   AZEEZ AR STUDIO
   NEW MOBILE AR APP
   JAVASCRIPT PART 1 OF 3
   CAMERA + SWIPE PANEL + TRACKING SETUP
===================================================== */

const $ = (id) => document.getElementById(id);

const video = $("cameraVideo");
const dotsCanvas = $("dotsCanvas");
const dotsCtx = dotsCanvas.getContext("2d");

const arCanvas = $("arCanvas");

const panel = $("optionsPanel");
const backdrop = $("panelBackdrop");
const openHandle = $("openOptions");
const closeButton = $("closeOptions");

const state = {
  stream: null,

  facingMode: "user",
  mirrored: false,

  tracking: false,
  dotsVisible: true,

  landmarker: null,
  loadingTracking: false,

  lastVideoTime: -1,
  animationId: null,

  slots: [null, null, null, null],
  activeSlot: 0,

  modelVisible: true,

  three: null,
  renderer: null,
  scene: null,
  camera3D: null,

  recording: null,
  recordingChunks: [],

  micStream: null,
  micEnabled: false,

  touchStartX: 0,
  touchStartY: 0,

  faceResults: null
};

/* =====================================================
   STATUS
===================================================== */

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.style.opacity = "1";

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

function setStatus(message) {
  const element = $("status");

  if (element) {
    element.textContent = message;
  }
}

function setTrackingStatus(message) {
  const element = $("trackingStatus");

  if (element) {
    element.textContent = message;
  }

  const panelStatus = $("trackingPanelStatus");

  if (panelStatus) {
    panelStatus.textContent = message;
  }
}

function updateCameraMessage(message) {
  const element = $("cameraMessage");

  if (element) {
    element.textContent = message;
  }
}

function showCameraError(message) {
  const error = $("cameraError");

  if (!error) {
    showToast(message);
    return;
  }

  error.textContent = message;
  error.style.display = "block";

  setTimeout(() => {
    error.style.display = "none";
  }, 5000);
}

/* =====================================================
   SLIDING OPTIONS PANEL
===================================================== */

function openOptions() {
  panel.classList.add("open");
  backdrop.classList.add("visible");
}

function closeOptions() {
  panel.classList.remove("open");
  backdrop.classList.remove("visible");
}

function toggleOptions() {
  if (panel.classList.contains("open")) {
    closeOptions();
  } else {
    openOptions();
  }
}

openHandle.addEventListener("click", openOptions);

closeButton.addEventListener("click", closeOptions);

backdrop.addEventListener("click", closeOptions);

/* =====================================================
   MOBILE SWIPE CONTROL
===================================================== */

document.addEventListener(
  "touchstart",
  (event) => {

    const touch = event.touches[0];

    state.touchStartX = touch.clientX;
    state.touchStartY = touch.clientY;

  },
  { passive: true }
);

document.addEventListener(
  "touchend",
  (event) => {

    const touch = event.changedTouches[0];

    const deltaX =
      touch.clientX - state.touchStartX;

    const deltaY =
      touch.clientY - state.touchStartY;

    if (Math.abs(deltaX) < 65) {
      return;
    }

    if (Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    /*
      Swipe LEFT from right edge:
      open options panel.
    */

    if (
      deltaX < 0 &&
      state.touchStartX > window.innerWidth - 65
    ) {
      openOptions();
    }

    /*
      Swipe RIGHT:
      close options panel.
    */

    if (
      deltaX > 0 &&
      panel.classList.contains("open")
    ) {
      closeOptions();
    }

  },
  { passive: true }
);

/* =====================================================
   CANVAS RESIZE
===================================================== */

function resizeCanvases() {

  const width =
    video.clientWidth || window.innerWidth;

  const height =
    video.clientHeight || window.innerHeight;

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  for (const canvas of [
    dotsCanvas,
    arCanvas
  ]) {

    canvas.width =
      Math.round(width * dpr);

    canvas.height =
      Math.round(height * dpr);

    canvas.style.width =
      width + "px";

    canvas.style.height =
      height + "px";

    const context =
      canvas.getContext("2d");

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

  }

}

window.addEventListener(
  "resize",
  resizeCanvases
);

/* =====================================================
   CAMERA STOP
===================================================== */

async function stopCamera() {

  stopTracking();

  if (state.stream) {

    state.stream
      .getTracks()
      .forEach(track => track.stop());

  }

  state.stream = null;

  video.srcObject = null;

  setStatus("Camera stopped");

  updateCameraMessage(
    "Start camera from AR Options"
  );

}

/* =====================================================
   CAMERA START
===================================================== */

async function startCamera() {

  try {

    await stopCamera();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "Camera API unavailable. Open the website using HTTPS."
      );

    }

    setStatus("Starting camera...");

    updateCameraMessage(
      "Opening camera..."
    );

    state.stream =
      await navigator.mediaDevices.getUserMedia({

        audio: false,

        video: {

          facingMode:
            state.facingMode,

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          }

        }

      });

    video.srcObject =
      state.stream;

    await video.play();

    resizeCanvases();

    setStatus("Camera ON");

    updateCameraMessage("");

    showToast("Camera started");

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    setStatus("Camera error");

    updateCameraMessage(
      "Camera could not start"
    );

    showCameraError(
      error.message ||
      "Camera permission or device error"
    );

  }

}

/* =====================================================
   SWITCH CAMERA
===================================================== */

async function switchCamera() {

  state.facingMode =
    state.facingMode === "user"
      ? "environment"
      : "user";

  await startCamera();

}

/* =====================================================
   MIRROR
===================================================== */

function toggleMirror() {

  state.mirrored =
    !state.mirrored;

  video.classList.toggle(
    "mirrored",
    state.mirrored
  );

  $("flipBtn").textContent =
    state.mirrored
      ? "Mirror OFF"
      : "Mirror ON";

}

/* =====================================================
   CAMERA BUTTONS
===================================================== */

$("startCameraBtn").addEventListener(
  "click",
  startCamera
);

$("stopCameraBtn").addEventListener(
  "click",
  stopCamera
);

$("switchCameraBtn").addEventListener(
  "click",
  switchCamera
);

$("flipBtn").addEventListener(
  "click",
  toggleMirror
);

/* =====================================================
   FULLSCREEN
===================================================== */

$("fullscreenBtn").addEventListener(
  "click",
  async () => {

    try {

      if (!document.fullscreenElement) {

        await $("app").requestFullscreen();

      } else {

        await document.exitFullscreen();

      }

    } catch (error) {

      showToast(
        "Fullscreen not supported by browser"
      );

    }

  }
);

/* =====================================================
   PART 2 CONTINUES
===================================================== */
      
/* =====================================================
   AZEEZ AR STUDIO
   JAVASCRIPT PART 2 OF 3
   FACE TRACKING + GREEN DOTS + 3D MODEL SETUP
===================================================== */

/* =====================================================
   CLEAR FACE DOTS
===================================================== */

function clearDots() {

  dotsCtx.clearRect(
    0,
    0,
    dotsCanvas.width,
    dotsCanvas.height
  );

}

/* =====================================================
   LOAD MEDIAPIPE
===================================================== */

async function loadFaceLandmarker() {

  if (state.landmarker) {
    return state.landmarker;
  }

  if (state.loadingTracking) {
    throw new Error("Tracking is already loading");
  }

  state.loadingTracking = true;

  setTrackingStatus("Loading face model...");

  try {

    const vision =
      await import(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
      );

    const files =
      await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    state.landmarker =
      await vision.FaceLandmarker.createFromOptions(
        files,
        {
          baseOptions: {

            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

            delegate: "GPU"

          },

          runningMode: "VIDEO",

          numFaces: 4,

          outputFaceBlendshapes: true,

          outputFacialTransformationMatrixes: true

        }
      );

    setTrackingStatus("Face model loaded");

    return state.landmarker;

  } catch (error) {

    console.error(
      "Face model loading error:",
      error
    );

    state.landmarker = null;

    setTrackingStatus("Model loading failed");

    showCameraError(
      "Face tracking model could not load. Check internet connection."
    );

    throw error;

  } finally {

    state.loadingTracking = false;

  }

}

/* =====================================================
   START TRACKING
===================================================== */

async function startTracking() {

  if (!state.stream) {

    showToast("Start camera first");

    return;

  }

  if (state.tracking) {
    return;
  }

  try {

    await loadFaceLandmarker();

    state.tracking = true;

    state.lastVideoTime = -1;

    setTrackingStatus("Tracking ON");

    $("trackingBtn").textContent =
      "Stop Tracking";

    trackingLoop();

    showToast("Face tracking started");

  } catch (error) {

    console.error(
      "Tracking start error:",
      error
    );

    state.tracking = false;

    setTrackingStatus(
      "Tracking failed"
    );

  }

}

/* =====================================================
   STOP TRACKING
===================================================== */

function stopTracking() {

  state.tracking = false;

  state.faceResults = null;

  if (state.animationId !== null) {

    cancelAnimationFrame(
      state.animationId
    );

    state.animationId = null;

  }

  clearDots();

  setTrackingStatus("Tracking OFF");

  const button = $("trackingBtn");

  if (button) {

    button.textContent =
      "Start Tracking";

  }

}

/* =====================================================
   TRACKING BUTTON
===================================================== */

$("trackingBtn").addEventListener(
  "click",
  () => {

    if (state.tracking) {

      stopTracking();

    } else {

      startTracking();

    }

  }
);

/* =====================================================
   GREEN DOTS BUTTON
===================================================== */

function toggleDots() {

  state.dotsVisible =
    !state.dotsVisible;

  $("dotsBtn").textContent =
    state.dotsVisible
      ? "Green Dots ON"
      : "Green Dots OFF";

  if (!state.dotsVisible) {

    clearDots();

  }

}

$("dotsBtn").addEventListener(
  "click",
  toggleDots
);

/* =====================================================
   FACE TRACKING LOOP
===================================================== */

function trackingLoop() {

  if (!state.tracking) {
    return;
  }

  if (
    video.readyState >=
    HTMLMediaElement.HAVE_CURRENT_DATA
  ) {

    if (
      video.currentTime !==
      state.lastVideoTime
    ) {

      state.lastVideoTime =
        video.currentTime;

      try {

        state.faceResults =
          state.landmarker.detectForVideo(
            video,
            performance.now()
          );

        drawFaceDots(
          state.faceResults
        );

        updateFaceModel();

      } catch (error) {

        console.error(
          "Face detection error:",
          error
        );

      }

    }

  }

  state.animationId =
    requestAnimationFrame(
      trackingLoop
    );

}

/* =====================================================
   DRAW FACE DOTS
===================================================== */

function drawFaceDots(results) {

  clearDots();

  if (!state.dotsVisible) {
    return;
  }

  if (
    !results ||
    !results.faceLandmarks ||
    results.faceLandmarks.length === 0
  ) {

    setTrackingStatus(
      "Tracking ON • Face not found"
    );

    return;

  }

  const width =
    dotsCanvas.clientWidth;

  const height =
    dotsCanvas.clientHeight;

  dotsCtx.fillStyle =
    "#00ff66";

  dotsCtx.shadowColor =
    "#00ff66";

  dotsCtx.shadowBlur = 4;

  for (
    const landmarks of
    results.faceLandmarks
  ) {

    for (
      const landmark of
      landmarks
    ) {

      let x =
        landmark.x * width;

      let y =
        landmark.y * height;

      if (state.mirrored) {

        x = width - x;

      }

      dotsCtx.beginPath();

      dotsCtx.arc(
        x,
        y,
        2,
        0,
        Math.PI * 2
      );

      dotsCtx.fill();

    }

  }

  dotsCtx.shadowBlur = 0;

  setTrackingStatus(
    "Tracking ON • Face detected"
  );

}

/* =====================================================
   THREE.JS INITIALIZATION
===================================================== */

async function init3D() {

  if (state.renderer) {
    return;
  }

  try {

    const THREE =
      await import(
        "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
      );

    state.three = THREE;

    state.scene =
      new THREE.Scene();

    state.camera3D =
      new THREE.PerspectiveCamera(
        45,
        window.innerWidth /
          window.innerHeight,
        0.01,
        1000
      );

    state.camera3D.position.z = 5;

    state.renderer =
      new THREE.WebGLRenderer({

        canvas: arCanvas,

        alpha: true,

        antialias: true

      });

    state.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    state.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    state.renderer.setClearColor(
      0x000000,
      0
    );

    render3D();

    setStatus("3D engine ready");

  } catch (error) {

    console.error(
      "Three.js initialization error:",
      error
    );

    showToast(
      "3D engine failed to load"
    );

  }

}

/* =====================================================
   3D RENDER LOOP
===================================================== */

function render3D() {

  if (
    state.renderer &&
    state.scene &&
    state.camera3D
  ) {

    state.renderer.render(
      state.scene,
      state.camera3D
    );

  }

  requestAnimationFrame(
    render3D
  );

}

/* =====================================================
   ACTIVE MODEL
===================================================== */

function getActiveModel() {

  return state.slots[
    state.activeSlot
  ];

}

/* =====================================================
   MODEL SLOT SELECT
===================================================== */

function selectSlot(index) {

  if (
    index < 0 ||
    index >= state.slots.length
  ) {

    return;

  }

  state.activeSlot = index;

  updateSlotLabels();

  applyModelControls();

  showToast(
    "Selected Slot " +
    (index + 1)
  );

}

/* =====================================================
   SLOT BUTTONS
===================================================== */

document
  .querySelectorAll(".slotBtn")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const index =
          Number(
            button.dataset.slot
          );

        selectSlot(index);

      }
    );

  });

/* =====================================================
   UPDATE SLOT LABELS
===================================================== */

function updateSlotLabels() {

  document
    .querySelectorAll(".slotBtn")
    .forEach(button => {

      const index =
        Number(
          button.dataset.slot
        );

      const model =
        state.slots[index];

      button.textContent =
        "Slot " +
        (index + 1) +
        (
          model
            ? " • Loaded"
            : " • Empty"
        );

      button.style.borderColor =
        index === state.activeSlot
          ? "#00ff66"
          : "#333";

    });

}

/* =====================================================
   PART 3 CONTINUES
===================================================== */
/* =====================================================
   AZEEZ AR STUDIO
   JAVASCRIPT PART 3 OF 3
   MODEL IMPORT + CONTROLS + RECORDING + STARTUP
===================================================== */

/* =====================================================
   MODEL IMPORT
===================================================== */

async function importModel() {

  const fileInput = $("modelFile");

  const file = fileInput.files[0];

  if (!file) {

    showToast("Select a 3D model first");

    return;

  }

  if (!state.renderer) {

    await init3D();

  }

  if (!state.three) {

    showToast("3D engine unavailable");

    return;

  }

  try {

    showToast("Loading model...");

    const THREE = state.three;

    let object = null;

    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();

    const objectURL =
      URL.createObjectURL(file);

    if (extension === "glb" || extension === "gltf") {

      const { GLTFLoader } =
        await import(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"
        );

      const loader =
        new GLTFLoader();

      const gltf =
        await loader.loadAsync(
          objectURL
        );

      object = gltf.scene;

    } else if (extension === "obj") {

      const { OBJLoader } =
        await import(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js"
        );

      const loader =
        new OBJLoader();

      object =
        loader.parse(
          await file.text()
        );

    } else if (extension === "fbx") {

      const { FBXLoader } =
        await import(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js"
        );

      const loader =
        new FBXLoader();

      object =
        loader.parse(
          await file.arrayBuffer()
        );

    } else {

      throw new Error(
        "Unsupported model format"
      );

    }

    if (!object) {

      throw new Error(
        "Model could not be loaded"
      );

    }

    const box =
      new THREE.Box3()
        .setFromObject(object);

    const size =
      box.getSize(
        new THREE.Vector3()
      );

    const center =
      box.getCenter(
        new THREE.Vector3()
      );

    object.position.sub(center);

    const maxDimension =
      Math.max(
        size.x,
        size.y,
        size.z
      );

    if (maxDimension > 0) {

      object.scale.setScalar(
        2 / maxDimension
      );

    }

    object.userData.originalScale =
      object.scale.clone();

    const oldModel =
      state.slots[
        state.activeSlot
      ];

    if (oldModel) {

      state.scene.remove(
        oldModel
      );

    }

    state.slots[
      state.activeSlot
    ] = object;

    state.scene.add(
      object
    );

    state.modelVisible = true;

    object.visible = true;

    updateSlotLabels();

    applyModelControls();

    $("modelStatus").textContent =
      file.name;

    $("showModelBtn").textContent =
      "Hide Model";

    showToast("Model imported");

    URL.revokeObjectURL(
      objectURL
    );

  } catch (error) {

    console.error(
      "Model import error:",
      error
    );

    $("modelStatus").textContent =
      "Model import failed";

    showToast(
      error.message ||
      "Could not import model"
    );

  }

}

$("importModelBtn").addEventListener(
  "click",
  importModel
);

/* =====================================================
   MODEL POSITION + ROTATION + SCALE
===================================================== */

function applyModelControls() {

  const model =
    getActiveModel();

  if (!model) {
    return;
  }

  const value = (id) =>
    Number($(id).value);

  model.position.x =
    value("posX") +
    value("faceX");

  model.position.y =
    value("posY") +
    value("faceY");

  model.position.z =
    value("posZ") +
    value("faceZ");

  model.rotation.x =
    value("rotX") *
    Math.PI / 180;

  model.rotation.y =
    value("rotY") *
    Math.PI / 180;

  model.rotation.z =
    value("rotZ") *
    Math.PI / 180;

  const originalScale =
    model.userData.originalScale;

  const scale =
    value("modelScale") *
    value("faceSize");

  if (originalScale) {

    model.scale.copy(
      originalScale
    );

    model.scale.multiplyScalar(
      scale
    );

  }

  model.visible =
    state.modelVisible;

}

/* =====================================================
   SLIDER OUTPUTS
===================================================== */

const sliderIds = [

  "posX",
  "posY",
  "posZ",

  "rotX",
  "rotY",
  "rotZ",

  "modelScale",

  "faceX",
  "faceY",
  "faceZ",

  "faceSize",

  "leftEye",
  "rightEye",

  "mouthScale",
  "mouthOpen",

  "blinkLeft",
  "blinkRight"

];

function updateSliderOutput(id) {

  const input =
    $(id);

  const output =
    $(id + "Out");

  if (!input || !output) {
    return;
  }

  const value =
    Number(input.value);

  output.textContent =
    value.toFixed(2);

}

sliderIds.forEach(id => {

  const input =
    $(id);

  if (!input) {
    return;
  }

  input.addEventListener(
    "input",
    () => {

      updateSliderOutput(id);

      applyModelControls();

    }
  );

  updateSliderOutput(id);

});

/* =====================================================
   RESET TRANSFORM
===================================================== */

function resetTransform() {

  const ids = [

    "posX",
    "posY",
    "posZ",

    "rotX",
    "rotY",
    "rotZ",

    "modelScale"

  ];

  ids.forEach(id => {

    const input =
      $(id);

    if (!input) {
      return;
    }

    input.value =
      id === "modelScale"
        ? "1"
        : "0";

    updateSliderOutput(id);

  });

  applyModelControls();

}

$("resetTransformBtn").addEventListener(
  "click",
  resetTransform
);

/* =====================================================
   RESET FACE CONTROLS
===================================================== */

function resetFaceControls() {

  const defaults = {

    faceX: 0,
    faceY: 0,
    faceZ: 0,

    faceSize: 1,

    leftEye: 1,
    rightEye: 1,

    mouthScale: 1,
    mouthOpen: 0,

    blinkLeft: 0,
    blinkRight: 0

  };

  Object.entries(
    defaults
  ).forEach(([id, value]) => {

    $(id).value =
      String(value);

    updateSliderOutput(id);

  });

  applyModelControls();

}

$("resetFaceBtn").addEventListener(
  "click",
  resetFaceControls
);

/* =====================================================
   RESET ALL
===================================================== */

function resetAllControls() {

  resetTransform();

  resetFaceControls();

  showToast("Controls reset");

}

$("resetAllBtn").addEventListener(
  "click",
  resetAllControls
);

/* =====================================================
   UPDATE FACE MODEL
===================================================== */

function updateFaceModel() {

  /*
    Current version:
    model transform controls only.

    Automatic face attachment,
    eye animation and mouth animation
    are not implemented yet.
  */

  applyModelControls();

}

/* =====================================================
   MODEL VISIBILITY
===================================================== */

function toggleModelVisibility() {

  const model =
    getActiveModel();

  if (!model) {

    showToast(
      "Import a model first"
    );

    return;

  }

  state.modelVisible =
    !state.modelVisible;

  model.visible =
    state.modelVisible;

  $("showModelBtn").textContent =
    state.modelVisible
      ? "Hide Model"
      : "Show Model";

}

$("showModelBtn").addEventListener(
  "click",
  toggleModelVisibility
);

/* =====================================================
   REMOVE ACTIVE MODEL
===================================================== */

function removeActiveModel() {

  const model =
    getActiveModel();

  if (model && state.scene) {

    state.scene.remove(
      model
    );

  }

  state.slots[
    state.activeSlot
  ] = null;

  updateSlotLabels();

  $("modelStatus").textContent =
    "No model loaded";

  showToast("Model removed");

}

$("removeModelBtn").addEventListener(
  "click",
  removeActiveModel
);

/* =====================================================
   CLEAR ALL MODELS
===================================================== */

function clearAllModels() {

  state.slots.forEach(
    (model, index) => {

      if (model && state.scene) {

        state.scene.remove(
          model
        );

      }

      state.slots[index] =
        null;

    }
  );

  updateSlotLabels();

  $("modelStatus").textContent =
    "No model loaded";

  showToast("All models cleared");

}

$("clearModelBtn").addEventListener(
  "click",
  clearAllModels
);

/* =====================================================
   AUTO FIT
===================================================== */

function autoFitModel() {

  const model =
    getActiveModel();

  if (!model) {

    showToast(
      "Import a model first"
    );

    return;

  }

  resetTransform();

  showToast("Model fitted");

}

$("autoFitBtn").addEventListener(
  "click",
  autoFitModel
);

/* =====================================================
   RECORDING
===================================================== */

async function startRecording() {

  if (!state.stream) {

    showToast(
      "Start camera first"
    );

    return;

  }

  if (!window.MediaRecorder) {

    showToast(
      "Recording unavailable"
    );

    return;

  }

  try {

    state.recordingChunks = [];

    const recorder =
      new MediaRecorder(
        state.stream
      );

    state.recording =
      recorder;

    recorder.ondataavailable =
      (event) => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          state.recordingChunks.push(
            event.data
          );

        }

      };

    recorder.onstop =
      saveRecording;

    recorder.start();

    $("recordBtn").textContent =
      "Recording...";

    showToast("Recording started");

  } catch (error) {

    console.error(
      "Recording error:",
      error
    );

    showToast(
      "Recording failed"
    );

  }

}

function stopRecording() {

  if (
    state.recording &&
    state.recording.state !== "inactive"
  ) {

    state.recording.stop();

  }

}

function saveRecording() {

  if (
    state.recordingChunks.length === 0
  ) {

    showToast(
      "No recording data"
    );

    return;

  }

  const blob =
    new Blob(
      state.recordingChunks,
      {
        type:
          state.recording.mimeType ||
          "video/webm"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "azeez-ar-recording.webm";

  link.click();

  URL.revokeObjectURL(
    url
  );

  $("recordBtn").textContent =
    "Start Recording";

  showToast("Recording saved");

}

$("recordBtn").addEventListener(
  "click",
  startRecording
);

$("stopRecordBtn").addEventListener(
  "click",
  stopRecording
);

/* =====================================================
   MICROPHONE
===================================================== */

async function toggleMicrophone() {

  if (state.micEnabled) {

    if (state.micStream) {

      state.micStream
        .getTracks()
        .forEach(track => track.stop());

    }

    state.micStream = null;

    state.micEnabled = false;

    $("micBtn").textContent =
      "Microphone OFF";

    showToast("Microphone stopped");

    return;

  }

  try {

    state.micStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    state.micEnabled = true;

    $("micBtn").textContent =
      "Microphone ON";

    showToast("Microphone enabled");

  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );

    showToast(
      "Microphone permission denied"
    );

  }

}

$("micBtn").addEventListener(
  "click",
  toggleMicrophone
);

/* =====================================================
   EXPORT SETTINGS
===================================================== */

function exportSettings() {

  const settings = {};

  sliderIds.forEach(id => {

    settings[id] =
      Number(
        $(id).value
      );

  });

  settings.activeSlot =
    state.activeSlot;

  settings.facingMode =
    state.facingMode;

  settings.mirrored =
    state.mirrored;

  const blob =
    new Blob(
      [
        JSON.stringify(
          settings,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "azeez-ar-settings.json";

  link.click();

  URL.revokeObjectURL(
    url
  );

  showToast("Settings exported");

}

$("exportSettingsBtn").addEventListener(
  "click",
  exportSettings
);

/* =====================================================
   IMPORT SETTINGS
===================================================== */

function openSettingsFile() {

  $("settingsFile").click();

}

$("importSettingsBtn").addEventListener(
  "click",
  openSettingsFile
);

$("settingsFile").addEventListener(
  "change",
  async (event) => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    try {

      const settings =
        JSON.parse(
          await file.text()
        );

      sliderIds.forEach(id => {

        if (
          settings[id] !== undefined
        ) {

          $(id).value =
            String(
              settings[id]
            );

          updateSliderOutput(id);

        }

      });

      if (
        Number.isInteger(
          settings.activeSlot
        )
      ) {

        selectSlot(
          settings.activeSlot
        );

      }

      applyModelControls();

      showToast(
        "Settings imported"
      );

    } catch (error) {

      console.error(
        "Settings import error:",
        error
      );

      showToast(
        "Invalid settings file"
      );

    }

    event.target.value = "";

  }
);

/* =====================================================
   HIDE OPTIONS
===================================================== */

$("hideOptionsBtn").addEventListener(
  "click",
  closeOptions
);

/* =====================================================
   HIDE SLIDERS
===================================================== */

function toggleSliders() {

  panel.classList.toggle(
    "sliders-hidden"
  );

  $("hideSlidersBtn").textContent =
    panel.classList.contains(
      "sliders-hidden"
    )
      ? "Show Sliders"
      : "Hide Sliders";

}

$("hideSlidersBtn").addEventListener(
  "click",
  toggleSliders
);

/* =====================================================
   CLEAN PREVIEW
===================================================== */

function cleanPreview() {

  panel.classList.remove("open");

  backdrop.classList.remove(
    "visible"
  );

  $("topBar").style.display =
    "none";

  openHandle.style.display =
    "none";

  showToast(
    "Clean preview enabled"
  );

}

function exitCleanPreview() {

  $("topBar").style.display =
    "flex";

  openHandle.style.display =
    "flex";

  showToast(
    "Clean preview disabled"
  );

}

$("cleanScreenBtn").addEventListener(
  "click",
  cleanPreview
);

$("exitCleanBtn").addEventListener(
  "click",
  exitCleanPreview
);

/* =====================================================
   INITIALIZE APP
===================================================== */

async function initializeApp() {

  resizeCanvases();

  updateSlotLabels();

  setStatus(
    "Camera not started"
  );

  setTrackingStatus(
    "Tracking OFF"
  );

  updateCameraMessage(
    "Start camera from AR Options"
  );

  await init3D();

  showToast(
    "Azeez AR Studio ready"
  );

}

initializeApp();

/* =====================================================
   PAGE CLEANUP
===================================================== */

window.addEventListener(
  "beforeunload",
  () => {

    stopTracking();

    if (state.stream) {

      state.stream
        .getTracks()
        .forEach(track => track.stop());

    }

    if (state.micStream) {

      state.micStream
        .getTracks()
        .forEach(track => track.stop());

    }

    if (state.renderer) {

      state.renderer.dispose();

    }

    if (state.landmarker) {

      state.landmarker.close();

    }

  }
);

/* =====================================================
   END OF AZEEZ AR STUDIO JS
===================================================== */
    
