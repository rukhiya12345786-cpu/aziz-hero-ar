import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
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
  trackingButton: $("trackingButton"),

  sideControls: $("sideControls"),

  scaleSlider: $("scaleSlider"),
  xSlider: $("xSlider"),
  ySlider: $("ySlider"),
  zSlider: $("zSlider"),
  rotateXSlider: $("rotateXSlider"),
  rotateYSlider: $("rotateYSlider"),
  rotateZSlider: $("rotateZSlider")
};

let scene;
let camera3D;
let renderer;
let modelRoot;
let currentObject;
let demoCube;

let cameraStream = null;
let facingMode = "user";

let mediaRecorder = null;
let recordedChunks = [];
let recordingCanvas = null;
let recordingContext = null;
let recordingStream = null;
let recordingTimer = null;

let audioStream = null;
let audioEnabled = false;
let isRecording = false;

let faceMesh = null;
let trackingEnabled = false;
let trackingLoading = false;
let lastFaceTime = 0;
let faceVisible = false;

const manual = {
  scale: 1,
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0
};

const tracking = {
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1,

  targetX: 0,
  targetY: 0,
  targetZ: 0,
  targetRotX: 0,
  targetRotY: 0,
  targetRotZ: 0,
  targetScale: 1
};

let trackingLostFrames = 0;

const clock = new THREE.Clock();

function setStatus(message, error = false) {
  if (!el.status) return;

  el.status.textContent = String(message);
  el.status.dataset.state = error ? "error" : "normal";

  if (error) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function showError(error, label = "Error") {
  const message = error?.message || String(error);
  setStatus(`${label}: ${message}`, true);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function setButtonText(button, text) {
  if (button) button.textContent = text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

window.addEventListener("error", (event) => {
  if (event?.message) {
    showError(event.message, "JavaScript error");
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (event?.reason) {
    showError(event.reason, "Async error");
  }
});

function validateElements() {
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

  const missing = required
    .filter((item) => !item[1])
    .map((item) => item[0]);

  if (missing.length) {
    throw new Error(
      `Missing HTML elements: ${missing.join(", ")}`
    );
  }
}

function prepareVideo() {
  if (!el.video) return;

  el.video.setAttribute("autoplay", "");
  el.video.setAttribute("playsinline", "");
  el.video.setAttribute("webkit-playsinline", "");

  el.video.autoplay = true;
  el.video.muted = true;
  el.video.playsInline = true;

  el.video.style.display = "block";

  // Keep the camera non-mirrored.
  el.video.style.transform = "none";
}function initThree() {
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

  scene.add(
    new THREE.HemisphereLight(
      0xffffff,
      0x444466,
      2
    )
  );

  const keyLight = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(
    0xffffff,
    1.2
  );

  fillLight.position.set(-4, 2, 3);
  scene.add(fillLight);

  modelRoot = new THREE.Group();
  modelRoot.name = "AR_MODEL_ROOT";

  scene.add(modelRoot);

  createDemoCube();
  applyManualControls();
  resizeRenderer();

  window.addEventListener(
    "resize",
    resizeRenderer
  );

  requestAnimationFrame(renderLoop);
}

function resizeRenderer() {
  if (!renderer || !camera3D) return;

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
    width / Math.max(height, 1);

  camera3D.updateProjectionMatrix();
}

function createDemoCube() {
  if (!modelRoot) return;

  clearCurrentModel();

  const geometry =
    new THREE.BoxGeometry(
      0.65,
      0.65,
      0.65
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x29a8ff,
      metalness: 0.25,
      roughness: 0.35
    });

  demoCube =
    new THREE.Mesh(
      geometry,
      material
    );

  demoCube.name = "DemoCube";

  modelRoot.add(demoCube);
  currentObject = demoCube;
}

function disposeObject(object) {
  if (!object) return;

  object.traverse?.((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials =
        Array.isArray(child.material)
          ? child.material
          : [child.material];

      materials.forEach((material) => {
        Object.values(material).forEach(
          (value) => {
            if (value?.isTexture) {
              value.dispose();
            }
          }
        );

        material.dispose();
      });
    }
  });
}

function clearCurrentModel() {
  if (!modelRoot) return;

  while (modelRoot.children.length) {
    const child =
      modelRoot.children[
        modelRoot.children.length - 1
      ];

    modelRoot.remove(child);
    disposeObject(child);
  }

  currentObject = null;
  demoCube = null;
}

function renderLoop() {
  requestAnimationFrame(renderLoop);

  const delta = clock.getDelta();

  if (
    demoCube &&
    !trackingEnabled &&
    !currentObject?.userData?.imported
  ) {
    demoCube.rotation.x +=
      delta * 0.45;

    demoCube.rotation.y +=
      delta * 0.70;
  }

  updateTrackingSmooth();
  applyFinalTransform();

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
    faceMesh &&
    el.video &&
    el.video.readyState >= 2
  ) {
    const now = performance.now();

    if (
      now - lastFaceTime >= 50
    ) {
      lastFaceTime = now;
      sendFaceFrame();
    }
  }
}

function updateTrackingSmooth() {
  const positionSmooth = 0.16;
  const rotationSmooth = 0.14;
  const scaleSmooth = 0.10;

  tracking.x = lerp(
    tracking.x,
    tracking.targetX,
    positionSmooth
  );

  tracking.y = lerp(
    tracking.y,
    tracking.targetY,
    positionSmooth
  );

  tracking.z = lerp(
    tracking.z,
    tracking.targetZ,
    positionSmooth
  );

  tracking.rotX = lerp(
    tracking.rotX,
    tracking.targetRotX,
    rotationSmooth
  );

  tracking.rotY = lerp(
    tracking.rotY,
    tracking.targetRotY,
    rotationSmooth
  );

  tracking.rotZ = lerp(
    tracking.rotZ,
    tracking.targetRotZ,
    rotationSmooth
  );

  tracking.scale = lerp(
    tracking.scale,
    tracking.targetScale,
    scaleSmooth
  );

  tracking.x = clamp(
    tracking.x,
    -2.2,
    2.2
  );

  tracking.y = clamp(
    tracking.y,
    -1.8,
    1.8
  );

  tracking.z = clamp(
    tracking.z,
    -2,
    2
  );

  tracking.scale = clamp(
    tracking.scale,
    0.70,
    1.35
  );
}

function applyFinalTransform() {
  if (!modelRoot) return;

  modelRoot.position.set(
    manual.x + tracking.x,
    manual.y + tracking.y,
    manual.z + tracking.z
  );

  modelRoot.rotation.set(
    manual.rotX + tracking.rotX,
    manual.rotY + tracking.rotY,
    manual.rotZ + tracking.rotZ
  );

  const finalScale =
    manual.scale *
    tracking.scale;

  modelRoot.scale.setScalar(
    clamp(
      finalScale,
      0.02,
      20
    )
  );
}

function readManualControls() {
  manual.scale = Number(
    el.scaleSlider?.value ?? 1
  );

  manual.x = Number(
    el.xSlider?.value ?? 0
  );

  manual.y = Number(
    el.ySlider?.value ?? 0
  );

  manual.z = Number(
    el.zSlider?.value ?? 0
  );

  manual.rotX = THREE.MathUtils.degToRad(
    Number(
      el.rotateXSlider?.value ?? 0
    )
  );

  manual.rotY = THREE.MathUtils.degToRad(
    Number(
      el.rotateYSlider?.value ?? 0
    )
  );

  manual.rotZ = THREE.MathUtils.degToRad(
    Number(
      el.rotateZSlider?.value ?? 0
    )
  );
}

function applyManualControls() {
  readManualControls();
  applyFinalTransform();
}async function startCamera() {
  try {
    stopCamera();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Camera API is not supported."
      );
    }

    setStatus(
      "Requesting camera permission..."
    );

    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        },
        audio: false
      });

    el.video.srcObject =
      cameraStream;

    el.video.muted = true;
    el.video.playsInline = true;

    // Never mirror the camera.
    el.video.style.transform =
      "none";

    await el.video.play();

    setStatus(
      facingMode === "user"
        ? "Front camera ready."
        : "Back camera ready."
    );

    if (trackingEnabled) {
      await startTrackingIfNeeded();
    }
  } catch (error) {
    showError(
      error,
      "Camera error"
    );
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });

    cameraStream = null;
  }

  if (el.video) {
    el.video.pause();
    el.video.srcObject = null;
  }
}

async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  await startCamera();
}

function takePhoto() {
  try {
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

    if (!ctx) {
      throw new Error(
        "Photo canvas failed."
      );
    }

    // Camera is intentionally drawn without mirroring.
    ctx.drawImage(
      el.video,
      0,
      0,
      width,
      height
    );

    if (el.canvas) {
      ctx.drawImage(
        el.canvas,
        0,
        0,
        width,
        height
      );
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus(
            "Photo creation failed.",
            true
          );
          return;
        }

        downloadBlob(
          blob,
          `aziz-ar-photo-${Date.now()}.png`
        );

        setStatus(
          "Photo saved."
        );
      },
      "image/png"
    );
  } catch (error) {
    showError(
      error,
      "Photo error"
    );
  }
}

function getRecorderMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  for (const type of types) {
    if (
      MediaRecorder.isTypeSupported(
        type
      )
    ) {
      return type;
    }
  }

  return "";
}

function createRecordingCanvas() {
  const width =
    el.video.videoWidth ||
    1280;

  const height =
    el.video.videoHeight ||
    720;

  recordingCanvas =
    document.createElement(
      "canvas"
    );

  recordingCanvas.width =
    width;

  recordingCanvas.height =
    height;

  recordingContext =
    recordingCanvas.getContext(
      "2d"
    );

  return (
    recordingCanvas &&
    recordingContext
  );
}

function drawRecordingFrame() {
  if (
    !isRecording ||
    !recordingContext ||
    !recordingCanvas
  ) {
    return;
  }

  const width =
    recordingCanvas.width;

  const height =
    recordingCanvas.height;

  recordingContext.clearRect(
    0,
    0,
    width,
    height
  );

  recordingContext.drawImage(
    el.video,
    0,
    0,
    width,
    height
  );

  if (el.canvas) {
    recordingContext.drawImage(
      el.canvas,
      0,
      0,
      width,
      height
    );
  }

  recordingTimer =
    requestAnimationFrame(
      drawRecordingFrame
    );
}

function startRecording() {
  try {
    if (!window.MediaRecorder) {
      throw new Error(
        "Recording is not supported."
      );
    }

    if (!cameraStream) {
      setStatus(
        "Open the camera first.",
        true
      );
      return;
    }

    if (isRecording) return;

    if (!createRecordingCanvas()) {
      throw new Error(
        "Recording canvas failed."
      );
    }

    const canvasStream =
      recordingCanvas.captureStream(
        30
      );

    const videoTracks =
      canvasStream.getVideoTracks();

    if (!videoTracks.length) {
      throw new Error(
        "Recording video track failed."
      );
    }

    recordingStream =
      new MediaStream(
        videoTracks
      );

    if (
      audioEnabled &&
      audioStream
    ) {
      audioStream
        .getAudioTracks()
        .forEach((track) => {
          recordingStream.addTrack(
            track
          );
        });
    }

    const mimeType =
      getRecorderMimeType();

    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            recordingStream,
            { mimeType }
          )
        : new MediaRecorder(
            recordingStream
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

    mediaRecorder.onerror =
      () => {
        isRecording = false;

        setButtonText(
          el.recordButton,
          "Record"
        );

        setStatus(
          "Recording error.",
          true
        );
      };

    mediaRecorder.start(250);

    isRecording = true;

    setButtonText(
      el.recordButton,
      "Stop Recording"
    );

    setStatus(
      "Recording..."
    );

    drawRecordingFrame();
  } catch (error) {
    showError(
      error,
      "Recording error"
    );
  }
}

function stopRecording() {
  if (
    !mediaRecorder ||
    mediaRecorder.state ===
      "inactive"
  ) {
    isRecording = false;
    setButtonText(
      el.recordButton,
      "Record"
    );
    return;
  }

  isRecording = false;

  if (recordingTimer) {
    cancelAnimationFrame(
      recordingTimer
    );

    recordingTimer = null;
  }

  mediaRecorder.stop();

  setButtonText(
    el.recordButton,
    "Record"
  );

  setStatus(
    "Saving recording..."
  );
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
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

  const mimeType =
    mediaRecorder?.mimeType ||
    "video/webm";

  const blob =
    new Blob(
      recordedChunks,
      { type: mimeType }
    );

  downloadBlob(
    blob,
    `aziz-ar-video-${Date.now()}.webm`
  );

  recordedChunks = [];
  mediaRecorder = null;
  recordingStream = null;

  setStatus(
    "Recording saved."
  );
}async function toggleAudio() {
  try {
    if (!navigator.mediaDevices) {
      throw new Error(
        "Media devices are not supported."
      );
    }

    if (audioEnabled) {
      stopAudio();
      return;
    }

    audioStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    if (
      !audioStream.getAudioTracks().length
    ) {
      throw new Error(
        "Microphone was not available."
      );
    }

    audioEnabled = true;

    setButtonText(
      el.audioButton,
      "Audio On"
    );

    setStatus(
      "Microphone enabled."
    );
  } catch (error) {
    showError(
      error,
      "Audio error"
    );
  }
}

function stopAudio() {
  if (audioStream) {
    audioStream
      .getTracks()
      .forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
  }

  audioStream = null;
  audioEnabled = false;

  setButtonText(
    el.audioButton,
    "Audio"
  );

  setStatus(
    "Microphone disabled."
  );
}

function handleImport(event) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  const name =
    file.name.toLowerCase();

  setStatus(
    `Loading ${file.name}...`
  );

  const reader =
    new FileReader();

  reader.onerror = () => {
    setStatus(
      "Could not read model file.",
      true
    );
  };

  if (
    name.endsWith(".glb") ||
    name.endsWith(".gltf")
  ) {
    reader.onload = () => {
      const loader =
        new GLTFLoader();

      loader.parse(
        reader.result,
        "",
        (gltf) => {
          addImportedModel(
            gltf.scene
          );
        },
        (error) => {
          showError(
            error,
            "GLB/GLTF error"
          );
        }
      );
    };

    reader.readAsArrayBuffer(
      file
    );
  } else if (
    name.endsWith(".obj")
  ) {
    reader.onload = () => {
      try {
        const loader =
          new OBJLoader();

        const object =
          loader.parse(
            reader.result
          );

        addImportedModel(
          object
        );
      } catch (error) {
        showError(
          error,
          "OBJ error"
        );
      }
    };

    reader.readAsText(file);
  } else if (
    name.endsWith(".stl")
  ) {
    reader.onload = () => {
      try {
        const loader =
          new STLLoader();

        const geometry =
          loader.parse(
            reader.result
          );

        geometry.computeVertexNormals();

        const material =
          new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.15,
            roughness: 0.7
          });

        const mesh =
          new THREE.Mesh(
            geometry,
            material
          );

        mesh.name =
          "ImportedSTL";

        addImportedModel(
          mesh
        );
      } catch (error) {
        showError(
          error,
          "STL error"
        );
      }
    };

    reader.readAsArrayBuffer(
      file
    );
  } else {
    setStatus(
      "Use GLB, GLTF, OBJ or STL.",
      true
    );
  }

  event.target.value = "";
}

function addImportedModel(object) {
  if (!modelRoot || !object) {
    return;
  }

  clearCurrentModel();

  object.userData.imported =
    true;

  object.name =
    object.name ||
    "ImportedModel";

  modelRoot.add(object);

  fitImportedModel(
    object
  );

  currentObject =
    object;

  resetTrackingValues();

  applyManualControls();

  setStatus(
    `Model loaded: ${object.name}`
  );
}

function fitImportedModel(object) {
  const box =
    new THREE.Box3()
      .setFromObject(object);

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  object.position.sub(
    center
  );

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
    const fit =
      1.5 / largest;

    object.scale.setScalar(
      fit
    );
  }
}

function exportModel() {
  if (
    !modelRoot ||
    !modelRoot.children.length
  ) {
    setStatus(
      "There is no 3D model.",
      true
    );
    return;
  }

  const format =
    (
      el.exportFormat?.value ||
      "glb"
    ).toLowerCase();

  if (format === "obj") {
    exportOBJ();
  } else {
    exportGLB();
  }
}

function exportGLB() {
  try {
    const exporter =
      new GLTFExporter();

    exporter.parse(
      modelRoot,
      (result) => {
        if (
          result instanceof
          ArrayBuffer
        ) {
          downloadBlob(
            new Blob(
              [result],
              {
                type:
                  "model/gltf-binary"
              }
            ),
            "aziz-ar-model.glb"
          );
        } else {
          downloadBlob(
            new Blob(
              [
                JSON.stringify(
                  result
                )
              ],
              {
                type:
                  "application/json"
              }
            ),
            "aziz-ar-model.gltf"
          );
        }

        setStatus(
          "3D model exported."
        );
      },
      (error) => {
        showError(
          error,
          "GLB export error"
        );
      },
      {
        binary: true,
        onlyVisible: true
      }
    );
  } catch (error) {
    showError(
      error,
      "Export error"
    );
  }
}

function exportOBJ() {
  try {
    const exporter =
      new OBJExporter();

    const result =
      exporter.parse(
        modelRoot
      );

    const blob =
      new Blob(
        [result],
        {
          type: "text/plain"
        }
      );

    downloadBlob(
      blob,
      "aziz-ar-model.obj"
    );

    setStatus(
      "OBJ exported."
    );
  } catch (error) {
    showError(
      error,
      "OBJ export error"
    );
  }
}

function resetTrackingValues() {
  tracking.x = 0;
  tracking.y = 0;
  tracking.z = 0;
  tracking.rotX = 0;
  tracking.rotY = 0;
  tracking.rotZ = 0;
  tracking.scale = 1;

  tracking.targetX = 0;
  tracking.targetY = 0;
  tracking.targetZ = 0;
  tracking.targetRotX = 0;
  tracking.targetRotY = 0;
  tracking.targetRotZ = 0;
  tracking.targetScale = 1;
}

function resetModel() {
  if (!modelRoot) return;

  resetTrackingValues();

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

  manual.scale = 1;
  manual.x = 0;
  manual.y = 0;
  manual.z = 0;
  manual.rotX = 0;
  manual.rotY = 0;
  manual.rotZ = 0;

  modelRoot.position.set(
    0,
    0,
    0
  );

  modelRoot.rotation.set(
    0,
    0,
    0
  );

  modelRoot.scale.setScalar(
    1
  );

  createDemoCube();

  setStatus(
    "Model reset."
  );
}

function toggleControls() {
  if (!el.sideControls) {
    setStatus(
      "Controls panel not found.",
      true
    );
    return;
  }

  const currentlyOpen =
    el.sideControls.dataset.open ===
    "true";

  if (currentlyOpen) {
    el.sideControls.dataset.open =
      "false";

    el.sideControls.style.display =
      "none";

    setButtonText(
      el.modelButton,
      "Show Controls"
    );
  } else {
    el.sideControls.dataset.open =
      "true";

    el.sideControls.style.display =
      "flex";

    el.sideControls.style.visibility =
      "visible";

    el.sideControls.style.opacity =
      "1";

    setButtonText(
      el.modelButton,
      "Hide Controls"
    );
  }
      }function setupFaceMesh() {
  if (typeof window.FaceMesh !== "function") {
    throw new Error(
      "Face Mesh library is not loaded."
    );
  }

  faceMesh =
    new window.FaceMesh({
      locateFile: (file) => {
        return (
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/" +
          file
        );
      }
    });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(
    onFaceResults
  );
}

function onFaceResults(results) {
  if (
    !results ||
    !results.multiFaceLandmarks ||
    !results.multiFaceLandmarks.length
  ) {
    trackingLostFrames++;

    if (
      trackingLostFrames > 4
    ) {
      faceVisible = false;

      tracking.targetX = 0;
      tracking.targetY = 0;
      tracking.targetZ = 0;

      tracking.targetRotX = 0;
      tracking.targetRotY = 0;
      tracking.targetRotZ = 0;

      tracking.targetScale = 1;

      setStatus(
        "Face not detected."
      );
    }

    return;
  }

  trackingLostFrames = 0;
  faceVisible = true;

  const landmarks =
    results.multiFaceLandmarks[0];

  updateTrackingFromLandmarks(
    landmarks
  );

  setStatus(
    "Face tracking active."
  );
}

function updateTrackingFromLandmarks(
  landmarks
) {
  if (
    !landmarks ||
    landmarks.length < 264
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

  if (
    !leftEye ||
    !rightEye ||
    !nose ||
    !forehead ||
    !chin
  ) {
    return;
  }

  const eyeCenterX =
    (
      leftEye.x +
      rightEye.x
    ) * 0.5;

  const eyeCenterY =
    (
      leftEye.y +
      rightEye.y
    ) * 0.5;

  const eyeDistance =
    Math.hypot(
      rightEye.x -
        leftEye.x,
      rightEye.y -
        leftEye.y
    );

  if (
    !Number.isFinite(
      eyeDistance
    ) ||
    eyeDistance < 0.001
  ) {
    return;
  }

  const faceCenterX =
    (
      forehead.x +
      chin.x
    ) * 0.5;

  const faceCenterY =
    (
      forehead.y +
      chin.y
    ) * 0.5;

  // Position tracking.
  const targetX =
    (
      faceCenterX -
      0.5
    ) * 2.4;

  const targetY =
    -(
      faceCenterY -
      0.5
    ) * 2.0;

  // Depth changes only a little.
  const rawDepth =
    (
      0.11 -
      eyeDistance
    ) * 7;

  const targetZ =
    clamp(
      rawDepth,
      -0.8,
      0.8
    );

  // Roll.
  const roll =
    Math.atan2(
      rightEye.y -
        leftEye.y,
      rightEye.x -
        leftEye.x
    );

  // Yaw approximation.
  const eyeMidX =
    (
      leftEye.x +
      rightEye.x
    ) * 0.5;

  const yaw =
    clamp(
      (
        nose.x -
        eyeMidX
      ) * 4.0,
      -0.8,
      0.8
    );

  // Pitch approximation.
  const eyeMidY =
    (
      leftEye.y +
      rightEye.y
    ) * 0.5;

  const pitch =
    clamp(
      (
        nose.y -
        eyeMidY
      ) * 2.4,
      -0.6,
      0.6
    );

  /*
   * IMPORTANT:
   * Tracking scale is only a multiplier.
   * The manual Scale slider remains independent.
   */
  const faceSize =
    clamp(
      eyeDistance /
        0.115,
      0.72,
      1.30
    );

  tracking.targetX =
    clamp(
      targetX,
      -2.0,
      2.0
    );

  tracking.targetY =
    clamp(
      targetY,
      -1.6,
      1.6
    );

  tracking.targetZ =
    targetZ;

  tracking.targetRotZ =
    clamp(
      -roll,
      -0.7,
      0.7
    );

  tracking.targetRotY =
    clamp(
      -yaw * 0.65,
      -0.65,
      0.65
    );

  tracking.targetRotX =
    clamp(
      pitch * 0.50,
      -0.45,
      0.45
    );

  tracking.targetScale =
    faceSize;
}

async function startTrackingIfNeeded() {
  if (trackingLoading) {
    return;
  }

  if (!faceMesh) {
    try {
      setupFaceMesh();
    } catch (error) {
      showError(
        error,
        "Face Mesh error"
      );
      trackingEnabled = false;
      return;
    }
  }

  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Start the camera first.",
      true
    );
    trackingEnabled = false;
    return;
  }

  trackingLoading = true;

  try {
    setStatus(
      "Starting face tracking..."
    );

    trackingEnabled = true;

    await sendFaceFrame();

    setButtonText(
      el.trackingButton,
      "Tracking On"
    );

    setStatus(
      "Face tracking ready."
    );
  } catch (error) {
    trackingEnabled = false;

    showError(
      error,
      "Tracking error"
    );
  } finally {
    trackingLoading = false;
  }
}

async function sendFaceFrame() {
  if (
    !trackingEnabled ||
    !faceMesh ||
    !el.video ||
    el.video.readyState < 2
  ) {
    return;
  }

  try {
    await faceMesh.send({
      image: el.video
    });
  } catch (error) {
    console.error(
      "Face Mesh frame error:",
      error
    );
  }
}

function stopTracking() {
  trackingEnabled = false;
  faceVisible = false;

  resetTrackingValues();

  setButtonText(
    el.trackingButton,
    "Face Tracking"
  );

  setStatus(
    "Face tracking stopped."
  );
}

async function toggleTracking() {
  if (trackingEnabled) {
    stopTracking();
    return;
  }

  if (
    !cameraStream ||
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Open the camera first.",
      true
    );
    return;
  }

  await startTrackingIfNeeded();
}

function bindEvents() {
  el.cameraButton?.addEventListener(
    "click",
    startCamera
  );

  el.switchCameraButton?.addEventListener(
    "click",
    switchCamera
  );

  el.photoButton?.addEventListener(
    "click",
    takePhoto
  );

  el.recordButton?.addEventListener(
    "click",
    toggleRecording
  );

  el.audioButton?.addEventListener(
    "click",
    toggleAudio
  );

  el.import3DButton?.addEventListener(
    "click",
    () => {
      el.import3DInput?.click();
    }
  );

  el.import3DInput?.addEventListener(
    "change",
    handleImport
  );

  el.export3DButton?.addEventListener(
    "click",
    exportModel
  );

  el.resetButton?.addEventListener(
    "click",
    resetModel
  );

  el.modelButton?.addEventListener(
    "click",
    toggleControls
  );

  el.trackingButton?.addEventListener(
    "click",
    toggleTracking
  );

  const sliders = [
    el.scaleSlider,
    el.xSlider,
    el.ySlider,
    el.zSlider,
    el.rotateXSlider,
    el.rotateYSlider,
    el.rotateZSlider
  ];

  sliders.forEach(
    (slider) => {
      slider?.addEventListener(
        "input",
        applyManualControls
      );

      slider?.addEventListener(
        "change",
        applyManualControls
      );
    }
  );
      }function initializeControlPanel() {
  if (!el.sideControls) {
    return;
  }

  /*
   * Start with controls visible.
   * The Model button can hide them.
   */
  el.sideControls.dataset.open =
    "true";

  el.sideControls.style.display =
    "flex";

  el.sideControls.style.visibility =
    "visible";

  el.sideControls.style.opacity =
    "1";

  setButtonText(
    el.modelButton,
    "Hide Controls"
  );
}

function initializeSliderValues() {
  if (el.scaleSlider) {
    if (!el.scaleSlider.value) {
      el.scaleSlider.value = "1";
    }
  }

  if (el.xSlider) {
    if (!el.xSlider.value) {
      el.xSlider.value = "0";
    }
  }

  if (el.ySlider) {
    if (!el.ySlider.value) {
      el.ySlider.value = "0";
    }
  }

  if (el.zSlider) {
    if (!el.zSlider.value) {
      el.zSlider.value = "0";
    }
  }

  if (el.rotateXSlider) {
    if (!el.rotateXSlider.value) {
      el.rotateXSlider.value = "0";
    }
  }

  if (el.rotateYSlider) {
    if (!el.rotateYSlider.value) {
      el.rotateYSlider.value = "0";
    }
  }

  if (el.rotateZSlider) {
    if (!el.rotateZSlider.value) {
      el.rotateZSlider.value = "0";
    }
  }

  readManualControls();
}

function initializeFaceMesh() {
  /*
   * The HTML loads the classic MediaPipe Face Mesh
   * library before app.js.
   */
  if (
    typeof window.FaceMesh ===
    "function"
  ) {
    try {
      setupFaceMesh();

      console.log(
        "FACE MESH LIBRARY LOADED"
      );
    } catch (error) {
      console.error(
        "Face Mesh setup failed:",
        error
      );
    }
  } else {
    console.warn(
      "Face Mesh library is not available yet."
    );
  }
}

function cleanup() {
  try {
    if (recordingTimer) {
      cancelAnimationFrame(
        recordingTimer
      );

      recordingTimer = null;
    }

    if (
      mediaRecorder &&
      mediaRecorder.state !==
        "inactive"
    ) {
      mediaRecorder.stop();
    }
  } catch (_) {}

  stopCamera();
  stopAudio();

  trackingEnabled = false;
  faceMesh = null;

  if (renderer) {
    renderer.dispose();
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);

function initializeApp() {
  try {
    validateElements();
    prepareVideo();

    initializeSliderValues();

    initThree();

    bindEvents();

    initializeControlPanel();

    initializeFaceMesh();

    setButtonText(
      el.cameraButton,
      "Open Camera"
    );

    setButtonText(
      el.switchCameraButton,
      "Switch Camera"
    );

    setButtonText(
      el.photoButton,
      "Photo"
    );

    setButtonText(
      el.recordButton,
      "Record"
    );

    setButtonText(
      el.audioButton,
      "Audio"
    );

    setButtonText(
      el.import3DButton,
      "Import 3D"
    );

    setButtonText(
      el.export3DButton,
      "Export 3D"
    );

    setButtonText(
      el.resetButton,
      "Reset"
    );

    setButtonText(
      el.trackingButton,
      "Face Tracking"
    );

    setStatus(
      "Ready. Open Camera to begin."
    );
  } catch (error) {
    showError(
      error,
      "App initialization error"
    );
  }
}

initializeApp();
