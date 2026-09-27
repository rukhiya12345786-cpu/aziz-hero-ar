import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

"use strict";

const $ = (id) => document.getElementById(id);

const el = {
  video: $("camera"),
  canvas: $("threeCanvas"),
  status: $("status"),
  cameraButton: $("cameraButton"),
  switchCameraButton: $("switchCameraButton"),
  photoButton: $("photoButton"),
  recordButton: $("recordButton"),
  audioButton: $("audioButton"),
  import3DButton: $("import3DButton"),
  import3DInput: $("import3DInput"),
  export3DButton: $("export3DButton"),
  exportFormat: $("exportFormat"),
  resetButton: $("resetButton"),
  modelButton: $("modelButton"),
  sideControls: $("sideControls"),
  scaleSlider: $("scaleSlider"),
  xSlider: $("xSlider"),
  ySlider: $("ySlider"),
  zSlider: $("zSlider"),
  rotateXSlider: $("rotateXSlider"),
  rotateYSlider: $("rotateYSlider"),
  rotateZSlider: $("rotateZSlider"),
  trackingButton: $("trackingButton")
};

let scene = null;
let camera3D = null;
let renderer = null;

let activeCameraStream = null;
let microphoneStream = null;
let mediaRecorder = null;
let recordedChunks = [];

let trackingRoot = null;
let currentModel = null;
let cube = null;

let faceLandmarker = null;
let trackingEnabled = false;
let trackingBusy = false;
let lastTrackingTime = 0;
let lastVideoTime = -1;

let facingMode = "user";
let mirrorEnabled = false;
let controlsHidden = false;
let isRecording = false;
let audioEnabled = false;

let runtimeFlipButton = null;
let runtimeShowButton = null;

let captureCanvas = null;
let captureContext = null;

const clock = new THREE.Clock();

function setStatus(message, isError = false) {
  if (el.status) {
    el.status.textContent = String(message);
    el.status.dataset.state = isError ? "error" : "normal";
  }

  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function showError(error, label = "Error") {
  const message = error?.message || String(error);
  setStatus(`${label}: ${message}`, true);
}

function requireElement(element, id) {
  if (!element) {
    throw new Error(`Missing HTML element: #${id}`);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

function prepareVideo() {
  if (!el.video) return;

  el.video.autoplay = true;
  el.video.muted = true;
  el.video.playsInline = true;

  el.video.setAttribute("autoplay", "");
  el.video.setAttribute("muted", "");
  el.video.setAttribute("playsinline", "");

  el.video.style.display = "block";
  el.video.style.transformOrigin = "center center";

  applyMirror();
}

function applyMirror() {
  if (!el.video) return;

  const transform = mirrorEnabled
    ? "scaleX(-1)"
    : "scaleX(1)";

  el.video.style.transform = transform;
  el.video.style.webkitTransform = transform;
}

function initThree() {
  requireElement(el.canvas, "threeCanvas");

  scene = new THREE.Scene();

  camera3D = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );

  camera3D.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({
    canvas: el.canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setClearColor(0x000000, 0);

  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const hemi = new THREE.HemisphereLight(
    0xffffff,
    0x333344,
    2
  );

  scene.add(hemi);

  const key = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  key.position.set(3, 5, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(
    0xffffff,
    1.2
  );

  fill.position.set(-4, 1, 3);
  scene.add(fill);

  trackingRoot = new THREE.Group();
  trackingRoot.name = "HEAD_TRACKING_ROOT";
  scene.add(trackingRoot);

  currentModel = new THREE.Group();
  currentModel.name = "MODEL_ROOT";

  trackingRoot.add(currentModel);

  createDemoCube();

  resizeRenderer();
  createCaptureCanvas();

  window.addEventListener(
    "resize",
    resizeRenderer
  );

  animate();

  setStatus(
    "3D ready. Open camera, then start Face Tracking."
  );
}

function createDemoCube() {
  if (!currentModel) return;

  clearModelChildren();

  const geometry =
    new THREE.BoxGeometry(
      0.55,
      0.55,
      0.55
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x29a8ff,
      metalness: 0.25,
      roughness: 0.35
    });

  cube = new THREE.Mesh(
    geometry,
    material
  );

  cube.name = "DemoCube";

  currentModel.add(cube);
}

function clearModelChildren() {
  if (!currentModel) return;

  while (currentModel.children.length) {
    const child =
      currentModel.children[0];

    currentModel.remove(child);

    child.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach((material) => {
          Object.values(material).forEach(
            (value) => {
              if (
                value &&
                value.isTexture
              ) {
                value.dispose();
              }
            }
          );

          material.dispose();
        });
      }
    });
  }

  cube = null;
}

function resizeRenderer() {
  if (
    !renderer ||
    !camera3D ||
    !el.canvas
  ) {
    return;
  }

  const width =
    el.canvas.clientWidth ||
    window.innerWidth;

  const height =
    el.canvas.clientHeight ||
    window.innerHeight;

  renderer.setSize(
    width,
    height,
    false
  );

  camera3D.aspect =
    width / height;

  camera3D.updateProjectionMatrix();

  resizeCaptureCanvas();
}

function createCaptureCanvas() {
  captureCanvas =
    document.createElement("canvas");

  captureContext =
    captureCanvas.getContext("2d");

  resizeCaptureCanvas();
}

function resizeCaptureCanvas() {
  if (!captureCanvas) return;

  const width =
    el.video?.videoWidth ||
    window.innerWidth;

  const height =
    el.video?.videoHeight ||
    window.innerHeight;

  if (width > 0 && height > 0) {
    captureCanvas.width = width;
    captureCanvas.height = height;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta =
    clock.getDelta();

  if (
    cube &&
    !trackingEnabled
  ) {
    cube.rotation.x +=
      delta * 0.45;

    cube.rotation.y +=
      delta * 0.7;
  }

  if (
    renderer &&
    scene &&
    camera3D
  ) {
    renderer.render(
      scene,
      camera3D
    );
  }

  if (
    trackingEnabled &&
    faceLandmarker &&
    !trackingBusy &&
    el.video &&
    el.video.readyState >= 2
  ) {
    const now =
      performance.now();

    if (
      now - lastTrackingTime >
      30
    ) {
      lastTrackingTime = now;
      updateFaceTracking(now);
    }
  }
}

function checkRequiredElements() {
  const required = [
    ["camera", el.video],
    ["threeCanvas", el.canvas],
    ["status", el.status],
    ["cameraButton", el.cameraButton],
    ["switchCameraButton", el.switchCameraButton],
    ["photoButton", el.photoButton],
    ["recordButton", el.recordButton],
    ["import3DButton", el.import3DButton],
    ["import3DInput", el.import3DInput],
    ["export3DButton", el.export3DButton],
    ["resetButton", el.resetButton]
  ];

  const missing =
    required
      .filter((item) => !item[1])
      .map((item) => item[0]);

  if (missing.length) {
    throw new Error(
      `Missing HTML element IDs: ${missing.join(", ")}`
    );
  }
}async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera API is not available."
      );
    }

    if (activeCameraStream) {
      activeCameraStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: {
          ideal: facingMode
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      }
    };

    const stream =
      await navigator.mediaDevices
        .getUserMedia(
          constraints
        );

    activeCameraStream = stream;

    el.video.srcObject = stream;

    applyMirror();

    await el.video.play();

    resizeCaptureCanvas();

    setStatus(
      facingMode === "user"
        ? "Front camera ready."
        : "Back camera ready."
    );
  } catch (error) {
    showError(
      error,
      "Camera error"
    );
  }
}

function stopCamera() {
  if (activeCameraStream) {
    activeCameraStream
      .getTracks()
      .forEach((track) =>
        track.stop()
      );

    activeCameraStream = null;
  }

  if (el.video) {
    el.video.srcObject = null;
  }
}

async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  await startCamera();

  setStatus(
    facingMode === "user"
      ? "Front camera."
      : "Back camera."
  );
}

function toggleMirror() {
  mirrorEnabled =
    !mirrorEnabled;

  applyMirror();

  setStatus(
    mirrorEnabled
      ? "Camera mirror ON."
      : "Camera mirror OFF."
  );
}

function takePhoto() {
  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Open the camera first.",
      true
    );
    return;
  }

  const width =
    el.video.videoWidth ||
    1280;

  const height =
    el.video.videoHeight ||
    720;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");

  ctx.save();

  if (mirrorEnabled) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(
    el.video,
    0,
    0,
    width,
    height
  );

  ctx.restore();

  if (renderer) {
    ctx.drawImage(
      renderer.domElement,
      0,
      0,
      width,
      height
    );
  }

  canvas.toBlob(
    (blob) => {
      if (blob) {
        downloadBlob(
          blob,
          `ar-photo-${Date.now()}.png`
        );
      }
    },
    "image/png"
  );
}

function getRecorderMimeType() {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  for (const type of types) {
    if (
      window.MediaRecorder &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }

  return "";
}

function drawRecordingFrame() {
  if (
    !captureCanvas ||
    !captureContext ||
    !el.video
  ) {
    return;
  }

  const width =
    captureCanvas.width;

  const height =
    captureCanvas.height;

  captureContext.clearRect(
    0,
    0,
    width,
    height
  );

  captureContext.save();

  if (mirrorEnabled) {
    captureContext.translate(
      width,
      0
    );

    captureContext.scale(
      -1,
      1
    );
  }

  captureContext.drawImage(
    el.video,
    0,
    0,
    width,
    height
  );

  captureContext.restore();

  if (renderer) {
    captureContext.drawImage(
      renderer.domElement,
      0,
      0,
      width,
      height
    );
  }
}

function startRecordingLoop() {
  if (!isRecording) return;

  drawRecordingFrame();

  requestAnimationFrame(
    startRecordingLoop
  );
}

async function startRecording() {
  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Open camera before recording.",
      true
    );
    return;
  }

  if (
    !window.MediaRecorder ||
    !captureCanvas
  ) {
    setStatus(
      "Video recording is not supported.",
      true
    );
    return;
  }

  try {
    resizeCaptureCanvas();

    drawRecordingFrame();

    const videoStream =
      captureCanvas.captureStream(30);

    let finalStream =
      videoStream;

    if (audioEnabled) {
      if (
        !microphoneStream
      ) {
        microphoneStream =
          await navigator.mediaDevices
            .getUserMedia({
              audio: true
            });
      }

      microphoneStream
        .getAudioTracks()
        .forEach((track) => {
          finalStream.addTrack(track);
        });
    }

    const mimeType =
      getRecorderMimeType();

    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            finalStream,
            { mimeType }
          )
        : new MediaRecorder(
            finalStream
          );

    recordedChunks = [];

    mediaRecorder.ondataavailable =
      (event) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordedChunks.push(
            event.data
          );
        }
      };

    mediaRecorder.onstop =
      saveRecording;

    mediaRecorder.start(250);

    isRecording = true;

    if (el.recordButton) {
      el.recordButton.textContent =
        "Stop Recording";
    }

    setStatus(
      "Recording..."
    );

    startRecordingLoop();
  } catch (error) {
    showError(
      error,
      "Recording error"
    );
  }
}

function stopRecording() {
  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {
    mediaRecorder.stop();
  }

  isRecording = false;

  if (el.recordButton) {
    el.recordButton.textContent =
      "Record";
  }
}

function saveRecording() {
  if (!recordedChunks.length) {
    setStatus(
      "No recording data.",
      true
    );
    return;
  }

  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          mediaRecorder?.mimeType ||
          "video/webm"
      }
    );

  downloadBlob(
    blob,
    `ar-video-${Date.now()}.webm`
  );

  recordedChunks = [];

  setStatus(
    "Recording saved."
  );
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function toggleAudio() {
  audioEnabled =
    !audioEnabled;

  if (audioEnabled) {
    try {
      microphoneStream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true
          });

      if (el.audioButton) {
        el.audioButton.textContent =
          "Audio ON";
      }

      setStatus(
        "Audio ON."
      );
    } catch (error) {
      audioEnabled = false;

      showError(
        error,
        "Microphone error"
      );
    }
  } else {
    if (microphoneStream) {
      microphoneStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      microphoneStream = null;
    }

    if (el.audioButton) {
      el.audioButton.textContent =
        "Audio OFF";
    }

    setStatus(
      "Audio OFF."
    );
  }
}function fitImportedModel(object) {
  const box =
    new THREE.Box3()
      .setFromObject(object);

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);

  const largest =
    Math.max(
      size.x,
      size.y,
      size.z
    );

  if (
    Number.isFinite(largest) &&
    largest > 0
  ) {
    object.scale.setScalar(
      1.5 / largest
    );
  }
}

function addModelToScene(object) {
  if (
    !currentModel ||
    !object
  ) {
    return;
  }

  clearModelChildren();

  object.name =
    object.name ||
    "ImportedModel";

  currentModel.add(object);

  object.rotation.set(
    0,
    0,
    0
  );

  object.position.set(
    0,
    0,
    0
  );

  object.scale.set(
    1,
    1,
    1
  );

  fitImportedModel(
    object
  );

  setStatus(
    `Model loaded: ${object.name}`
  );
}

async function importModelFile(file) {
  if (!file) return;

  const name =
    file.name.toLowerCase();

  try {
    if (
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    ) {
      const loader =
        new GLTFLoader();

      const url =
        URL.createObjectURL(file);

      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(
            url
          );

          addModelToScene(
            gltf.scene
          );
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(
            url
          );

          showError(
            error,
            "GLB/GLTF import error"
          );
        }
      );

      return;
    }

    if (name.endsWith(".obj")) {
      const loader =
        new OBJLoader();

      const text =
        await file.text();

      const object =
        loader.parse(text);

      addModelToScene(object);
      return;
    }

    if (name.endsWith(".stl")) {
      const loader =
        new STLLoader();

      const buffer =
        await file.arrayBuffer();

      const geometry =
        loader.parse(buffer);

      const material =
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.15,
          roughness: 0.5
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      addModelToScene(mesh);
      return;
    }

    if (
      name.endsWith(".fbx")
    ) {
      const loader =
        new FBXLoader();

      const buffer =
        await file.arrayBuffer();

      const object =
        loader.parse(
          buffer,
          ""
        );

      addModelToScene(object);
      return;
    }

    throw new Error(
      "Supported formats: GLB, GLTF, OBJ, STL, FBX."
    );
  } catch (error) {
    showError(
      error,
      "3D import error"
    );
  }
}

function exportModelGLTF() {
  if (
    !currentModel ||
    !currentModel.children.length
  ) {
    setStatus(
      "No model to export.",
      true
    );
    return;
  }

  const exporter =
    new GLTFExporter();

  const exportScene =
    new THREE.Scene();

  currentModel.children.forEach(
    (child) => {
      exportScene.add(
        child.clone(true)
      );
    }
  );

  exporter.parse(
    exportScene,
    (result) => {
      const json =
        JSON.stringify(
          result,
          null,
          2
        );

      downloadBlob(
        new Blob(
          [json],
          {
            type:
              "application/json"
          }
        ),
        "model.gltf"
      );
    },
    (error) => {
      showError(
        error,
        "GLTF export error"
      );
    }
  );
}

function exportModelOBJ() {
  if (
    !currentModel ||
    !currentModel.children.length
  ) {
    setStatus(
      "No model to export.",
      true
    );
    return;
  }

  const exporter =
    new OBJExporter();

  const object =
    currentModel.children[0];

  const result =
    exporter.parse(object);

  downloadBlob(
    new Blob(
      [result],
      {
        type:
          "text/plain"
      }
    ),
    "model.obj"
  );
}

function exportModel() {
  const format =
    (
      el.exportFormat?.value ||
      "gltf"
    ).toLowerCase();

  if (
    format === "obj"
  ) {
    exportModelOBJ();
  } else {
    exportModelGLTF();
  }
}

function resetModel() {
  createDemoCube();

  if (el.scaleSlider) {
    el.scaleSlider.value = "1";
  }

  if (el.xSlider) {
    el.xSlider.value = "0";
  }

  if (el.ySlider) {
    el.ySlider.value = "0";
  }

  if (el.zSlider) {
    el.zSlider.value = "0";
  }

  if (el.rotateXSlider) {
    el.rotateXSlider.value = "0";
  }

  if (el.rotateYSlider) {
    el.rotateYSlider.value = "0";
  }

  if (el.rotateZSlider) {
    el.rotateZSlider.value = "0";
  }

  applyModelControls();

  setStatus(
    "Demo model reset."
  );
}

function numberValue(
  element,
  fallback = 0
) {
  if (!element) {
    return fallback;
  }

  const value =
    Number(element.value);

  return Number.isFinite(value)
    ? value
    : fallback;
}

function applyModelControls() {
  if (!currentModel) return;

  const scale =
    numberValue(
      el.scaleSlider,
      1
    );

  const x =
    numberValue(
      el.xSlider,
      0
    );

  const y =
    numberValue(
      el.ySlider,
      0
    );

  const z =
    numberValue(
      el.zSlider,
      0
    );

  const rx =
    THREE.MathUtils.degToRad(
      numberValue(
        el.rotateXSlider,
        0
      )
    );

  const ry =
    THREE.MathUtils.degToRad(
      numberValue(
        el.rotateYSlider,
        0
      )
    );

  const rz =
    THREE.MathUtils.degToRad(
      numberValue(
        el.rotateZSlider,
        0
      )
    );

  currentModel.userData.manualPosition =
    new THREE.Vector3(
      x,
      y,
      z
    );

  currentModel.userData.manualRotation =
    new THREE.Euler(
      rx,
      ry,
      rz
    );

  currentModel.userData.manualScale =
    scale;

  currentModel.position.copy(
    currentModel.userData.manualPosition
  );

  currentModel.rotation.copy(
    currentModel.userData.manualRotation
  );

  currentModel.scale.setScalar(
    scale
  );
}

function createExtraButtons() {
  if (
    runtimeFlipButton ||
    runtimeShowButton
  ) {
    return;
  }

  runtimeFlipButton =
    document.createElement(
      "button"
    );

  runtimeFlipButton.textContent =
    "Flip Camera";

  runtimeFlipButton.style.position =
    "fixed";

  runtimeFlipButton.style.left =
    "12px";

  runtimeFlipButton.style.bottom =
    "12px";

  runtimeFlipButton.style.zIndex =
    "99999";

  runtimeFlipButton.style.padding =
    "10px 14px";

  runtimeFlipButton.style.border =
    "0";

  runtimeFlipButton.style.borderRadius =
    "10px";

  runtimeFlipButton.style.background =
    "rgba(0,0,0,.7)";

  runtimeFlipButton.style.color =
    "#fff";

  runtimeFlipButton.addEventListener(
    "click",
    toggleMirror
  );

  document.body.appendChild(
    runtimeFlipButton
  );

  runtimeShowButton =
    document.createElement(
      "button"
    );

  runtimeShowButton.textContent =
    "Show Controls";

  runtimeShowButton.style.position =
    "fixed";

  runtimeShowButton.style.top =
    "12px";

  runtimeShowButton.style.right =
    "12px";

  runtimeShowButton.style.zIndex =
    "99999";

  runtimeShowButton.style.display =
    "none";

  runtimeShowButton.style.padding =
    "10px 14px";

  runtimeShowButton.style.border =
    "0";

  runtimeShowButton.style.borderRadius =
    "10px";

  runtimeShowButton.style.background =
    "rgba(0,0,0,.7)";

  runtimeShowButton.style.color =
    "#fff";

  runtimeShowButton.addEventListener(
    "click",
    showAllControls
  );

  document.body.appendChild(
    runtimeShowButton
  );
    }function hideAllControls() {
  controlsHidden = true;

  const selectors = [
    "button",
    "input",
    "select",
    "label",
    "#sideControls"
  ];

  selectors.forEach(
    (selector) => {
      document
        .querySelectorAll(
          selector
        )
        .forEach((node) => {
          if (
            node !==
            runtimeShowButton
          ) {
            node.dataset.wasVisible =
              node.style.display ||
              "";

            node.style.setProperty(
              "display",
              "none",
              "important"
            );
          }
        });
    }
  );

  if (el.status) {
    el.status.style.display =
      "none";
  }

  if (runtimeFlipButton) {
    runtimeFlipButton.style.display =
      "none";
  }

  if (runtimeShowButton) {
    runtimeShowButton.style.display =
      "block";
  }

  if (el.video) {
    el.video.style.pointerEvents =
      "none";
  }

  if (el.canvas) {
    el.canvas.style.pointerEvents =
      "none";
  }

  setStatus(
    "Controls hidden."
  );
}

function showAllControls() {
  controlsHidden = false;

  document
    .querySelectorAll(
      "button, input, select, label, #sideControls"
    )
    .forEach((node) => {
      if (
        node !==
        runtimeShowButton
      ) {
        node.style.removeProperty(
          "display"
        );
      }
    });

  if (el.status) {
    el.status.style.removeProperty(
      "display"
    );
  }

  if (runtimeFlipButton) {
    runtimeFlipButton.style.display =
      "block";
  }

  if (runtimeShowButton) {
    runtimeShowButton.style.display =
      "none";
  }

  setStatus(
    "Controls visible."
  );
}

function toggleControls() {
  if (controlsHidden) {
    showAllControls();
  } else {
    hideAllControls();
  }
}

function bindSlider(element) {
  if (!element) return;

  element.addEventListener(
    "input",
    applyModelControls
  );

  element.addEventListener(
    "change",
    applyModelControls
  );
}

async function loadFaceVision() {
  const urls = [
    "https://esm.sh/@mediapipe/tasks-vision@0.10.22",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      setStatus(
        "Loading Face Tracking..."
      );

      const module =
        await import(url);

      if (
        module &&
        module.FaceLandmarker &&
        module.FilesetResolver
      ) {
        return module;
      }

      throw new Error(
        "MediaPipe module loaded but required exports are missing."
      );
    } catch (error) {
      lastError = error;
      console.warn(
        "MediaPipe CDN failed:",
        url,
        error
      );
    }
  }

  throw new Error(
    `Face Tracking library could not be loaded. ${lastError?.message || ""}`
  );
}

async function startFaceTracking() {
  if (
    !el.video ||
    !el.video.srcObject
  ) {
    setStatus(
      "Open camera first.",
      true
    );
    return;
  }

  if (
    !el.video.videoWidth
  ) {
    setStatus(
      "Waiting for camera video..."
    );

    await new Promise(
      (resolve) => {
        const timer =
          setInterval(() => {
            if (
              el.video.videoWidth
            ) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
      }
    );
  }

  try {
    if (!faceLandmarker) {
      const vision =
        await loadFaceVision();

      const {
        FaceLandmarker,
        FilesetResolver
      } = vision;

      const wasmRoot =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

      const modelUrl =
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

      const fileset =
        await FilesetResolver.forVisionTasks(
          wasmRoot
        );

      faceLandmarker =
        await FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                modelUrl,
              delegate: "GPU"
            },

            runningMode:
              "VIDEO",

            numFaces: 1,

            minFaceDetectionConfidence:
              0.5,

            minFacePresenceConfidence:
              0.5,

            minTrackingConfidence:
              0.5,

            outputFaceBlendshapes:
              false,

            outputFacialTransformationMatrixes:
              true
          }
        );
    }

    trackingEnabled = true;
    lastVideoTime = -1;

    if (el.trackingButton) {
      el.trackingButton.textContent =
        "Stop Tracking";
    }

    setStatus(
      "Face Tracking ON."
    );
  } catch (error) {
    faceLandmarker = null;
    trackingEnabled = false;

    if (el.trackingButton) {
      el.trackingButton.textContent =
        "Start Tracking";
    }

    showError(
      error,
      "Face tracking error"
    );
  }
}

function stopFaceTracking() {
  trackingEnabled = false;

  if (el.trackingButton) {
    el.trackingButton.textContent =
      "Start Tracking";
  }

  if (trackingRoot) {
    trackingRoot.position.set(
      0,
      0,
      0
    );

    trackingRoot.rotation.set(
      0,
      0,
      0
    );

    trackingRoot.scale.set(
      1,
      1,
      1
    );
  }

  setStatus(
    "Face Tracking OFF."
  );
}

async function toggleFaceTracking() {
  if (trackingEnabled) {
    stopFaceTracking();
  } else {
    await startFaceTracking();
  }
}

async function updateFaceTracking(now) {
  if (
    !faceLandmarker ||
    !el.video ||
    trackingBusy
  ) {
    return;
  }

  const videoTime =
    el.video.currentTime;

  if (
    videoTime === lastVideoTime
  ) {
    return;
  }

  lastVideoTime = videoTime;
  trackingBusy = true;

  try {
    const result =
      faceLandmarker.detectForVideo(
        el.video,
        now
      );

    if (
      result &&
      result.faceLandmarks &&
      result.faceLandmarks.length
    ) {
      updateModelFromFace(
        result
      );
    }
  } catch (error) {
    console.warn(
      "Tracking frame error:",
      error
    );
  } finally {
    trackingBusy = false;
  }
      }function updateModelFromFace(result) {
  if (
    !trackingRoot ||
    !currentModel
  ) {
    return;
  }

  const landmarks =
    result.faceLandmarks?.[0];

  if (
    !landmarks ||
    landmarks.length < 455
  ) {
    return;
  }

  const leftEye =
    landmarks[33];

  const rightEye =
    landmarks[263];

  const nose =
    landmarks[1];

  const forehead =
    landmarks[10];

  const chin =
    landmarks[152];

  const leftSide =
    landmarks[234];

  const rightSide =
    landmarks[454];

  const eyeDistance =
    Math.hypot(
      rightEye.x -
        leftEye.x,
      rightEye.y -
        leftEye.y
    );

  const faceWidth =
    Math.hypot(
      rightSide.x -
        leftSide.x,
      rightSide.y -
        leftSide.y
    );

  if (
    !Number.isFinite(
      faceWidth
    ) ||
    faceWidth <= 0
  ) {
    return;
  }

  const faceCenterX =
    (
      leftSide.x +
      rightSide.x
    ) * 0.5;

  const eyeCenterY =
    (
      leftEye.y +
      rightEye.y
    ) * 0.5;

  const headCenterY =
    eyeCenterY +
    (
      chin.y -
      forehead.y
    ) *
      0.08;

  const visibleWidth =
    camera3D
      ? 2 *
        Math.tan(
          THREE.MathUtils.degToRad(
            camera3D.fov * 0.5
          )
        ) *
        5
      : 4.14;

  const visibleHeight =
    visibleWidth /
    (
      camera3D?.aspect ||
      1.777
    );

  const targetX =
    (
      0.5 -
      faceCenterX
    ) *
    visibleWidth;

  const targetY =
    (
      0.5 -
      headCenterY
    ) *
    visibleHeight;

  const targetZ =
    THREE.MathUtils.clamp(
      -0.15 -
        eyeDistance * 1.2,
      -1.2,
      0.2
    );

  /*
   * Keep the head model around the head center,
   * not directly in front of the face.
   */

  const targetPosition =
    new THREE.Vector3(
      targetX,
      targetY,
      targetZ
    );

  /*
   * Head yaw from eye/nose geometry.
   * The sign is intentionally inverted so
   * non-mirrored camera movement matches
   * the real head direction.
   */

  const eyeMidX =
    (
      leftEye.x +
      rightEye.x
    ) * 0.5;

  const yawOffset =
    nose.x -
    eyeMidX;

  const targetYaw =
    THREE.MathUtils.clamp(
      -yawOffset * 7.5,
      -1.55,
      1.55
    );

  const eyeSlope =
    Math.atan2(
      rightEye.y -
        leftEye.y,
      rightEye.x -
        leftEye.x
    );

  const targetRoll =
    -eyeSlope;

  const faceHeight =
    Math.max(
      0.001,
      chin.y -
        forehead.y
    );

  const pitchOffset =
    nose.y -
    (
      forehead.y +
      faceHeight * 0.52
    );

  const targetPitch =
    THREE.MathUtils.clamp(
      pitchOffset * 5.0,
      -1.0,
      1.0
    );

  /*
   * Use the MediaPipe 3D facial transformation
   * matrix when available.
   *
   * This gives the model a real 3D head orientation
   * instead of treating it as a flat screen sticker.
   */

  let matrixYaw = 0;
  let matrixPitch = 0;
  let matrixRoll = 0;

  const matrixData =
    result
      .facialTransformationMatrixes?.[0]
      ?.data;

  if (
    matrixData &&
    matrixData.length === 16
  ) {
    try {
      const matrix =
        new THREE.Matrix4();

      matrix.fromArray(
        matrixData
      );

      const euler =
        new THREE.Euler();

      euler.setFromRotationMatrix(
        matrix,
        "YXZ"
      );

      matrixPitch =
        THREE.MathUtils.clamp(
          -euler.x,
          -1.2,
          1.2
        );

      matrixYaw =
        THREE.MathUtils.clamp(
          -euler.y,
          -1.55,
          1.55
        );

      matrixRoll =
        THREE.MathUtils.clamp(
          -euler.z,
          -1.2,
          1.2
        );
    } catch (error) {
      console.warn(
        "Transformation matrix error:",
        error
      );
    }
  }

  /*
   * Blend landmark direction with
   * transformation-matrix direction.
   */

  const finalYaw =
    THREE.MathUtils.lerp(
      targetYaw,
      matrixYaw,
      0.65
    );

  const finalPitch =
    THREE.MathUtils.lerp(
      targetPitch,
      matrixPitch,
      0.65
    );

  const finalRoll =
    THREE.MathUtils.lerp(
      targetRoll,
      matrixRoll,
      0.65
    );

  /*
   * Model scale is based on the user's
   * actual face/head width.
   */

  const targetScale =
    THREE.MathUtils.clamp(
      faceWidth * 4.3,
      0.35,
      2.8
    );

  const smoothPosition =
    0.28;

  const smoothRotation =
    0.22;

  const smoothScale =
    0.22;

  trackingRoot.position.lerp(
    targetPosition,
    smoothPosition
  );

  const desiredRotation =
    new THREE.Euler(
      finalPitch,
      finalYaw,
      finalRoll,
      "YXZ"
    );

  const desiredQuaternion =
    new THREE.Quaternion();

  desiredQuaternion.setFromEuler(
    desiredRotation
  );

  trackingRoot.quaternion.slerp(
    desiredQuaternion,
    smoothRotation
  );

  const desiredScale =
    new THREE.Vector3(
      targetScale,
      targetScale,
      targetScale
    );

  trackingRoot.scale.lerp(
    desiredScale,
    smoothScale
  );

  /*
   * Preserve manual model controls.
   * They stay local to the tracked head.
   */

  if (
    currentModel.userData
      .manualPosition
  ) {
    currentModel.position.copy(
      currentModel.userData
        .manualPosition
    );
  }

  if (
    currentModel.userData
      .manualRotation
  ) {
    currentModel.rotation.copy(
      currentModel.userData
        .manualRotation
    );
  }

  if (
    currentModel.userData
      .manualScale
  ) {
    currentModel.scale.setScalar(
      currentModel.userData
        .manualScale
    );
  }
}

function bindEvents() {
  createExtraButtons();

  if (el.cameraButton) {
    el.cameraButton.addEventListener(
      "click",
      startCamera
    );
  }

  if (el.switchCameraButton) {
    el.switchCameraButton.addEventListener(
      "click",
      switchCamera
    );
  }

  if (el.photoButton) {
    el.photoButton.addEventListener(
      "click",
      takePhoto
    );
  }

  if (el.recordButton) {
    el.recordButton.addEventListener(
      "click",
      toggleRecording
    );
  }

  if (el.audioButton) {
    el.audioButton.addEventListener(
      "click",
      toggleAudio
    );
  }

  if (el.import3DButton) {
    el.import3DButton.addEventListener(
      "click",
      () => {
        el.import3DInput?.click();
      }
    );
  }

  if (el.import3DInput) {
    el.import3DInput.addEventListener(
      "change",
      async () => {
        const file =
          el.import3DInput.files?.[0];

        if (file) {
          await importModelFile(
            file
          );
        }

        el.import3DInput.value =
          "";
      }
    );
  }

  if (el.export3DButton) {
    el.export3DButton.addEventListener(
      "click",
      exportModel
    );
  }

  if (el.resetButton) {
    el.resetButton.addEventListener(
      "click",
      resetModel
    );
  }

  if (el.modelButton) {
    el.modelButton.addEventListener(
      "click",
      toggleControls
    );
  }

  if (el.trackingButton) {
    el.trackingButton.addEventListener(
      "click",
      toggleFaceTracking
    );
  }

  bindSlider(
    el.scaleSlider
  );

  bindSlider(
    el.xSlider
  );

  bindSlider(
    el.ySlider
  );

  bindSlider(
    el.zSlider
  );

  bindSlider(
    el.rotateXSlider
  );

  bindSlider(
    el.rotateYSlider
  );

  bindSlider(
    el.rotateZSlider
  );
}

function cleanup() {
  stopFaceTracking();
  stopCamera();

  if (microphoneStream) {
    microphoneStream
      .getTracks()
      .forEach((track) =>
        track.stop()
      );

    microphoneStream = null;
  }

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {
    mediaRecorder.stop();
  }

  if (faceLandmarker) {
    try {
      faceLandmarker.close();
    } catch (error) {
      console.warn(error);
    }

    faceLandmarker = null;
  }
}

function initialize() {
  try {
    checkRequiredElements();
    prepareVideo();
    initThree();
    bindEvents();
    applyModelControls();

    setStatus(
      "Ready. Open Camera, then Start Face Tracking."
    );
  } catch (error) {
    showError(
      error,
      "Initialization error"
    );
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "JavaScript error:",
      event.error || event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "Unhandled error:",
      event.reason
    );
  }
);

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once: true
    }
  );
} else {
  initialize();
  }
