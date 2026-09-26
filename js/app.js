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
let mediaRecorder = null;
let recordedChunks = [];
let currentModel = null;
let cube = null;
let animationFrameId = null;
let facingMode = "user";
let isRecording = false;
let audioEnabled = false;
let faceLandmarker = null;
let trackingEnabled = false;
let trackingBusy = false;
let lastTrackingTime = 0;

const clock = new THREE.Clock();

function setStatus(message, isError = false) {
  if (el.status) {
    el.status.textContent = String(message);
    el.status.dataset.state = isError ? "error" : "normal";
  }
  if (isError) console.error(message);
  else console.log(message);
}

function showError(error, label = "App error") {
  const message = error?.message || String(error);
  setStatus(`${label}: ${message}`, true);
}

function requireElement(element, id) {
  if (!element) {
    throw new Error(`Required HTML element is missing: #${id}`);
  }
  return element;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setButtonLabel(button, label) {
  if (button) button.textContent = label;
}

window.addEventListener("error", (event) => {
  showError(event.message || "Unknown JavaScript error", "JavaScript error");
});

window.addEventListener("unhandledrejection", (event) => {
  showError(event.reason, "Async error");
});

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

  const missing = required.filter(([, element]) => !element).map(([id]) => id);

  if (missing.length) {
    throw new Error(`Missing HTML element IDs: ${missing.join(", ")}`);
  }
      }function initThree() {
  requireElement(el.canvas, "threeCanvas");

  scene = new THREE.Scene();

  camera3D = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera3D.position.set(0, 0, 5);

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: el.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
  } catch (error) {
    throw new Error(`Could not start 3D renderer: ${error.message}`);
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
  fillLight.position.set(-4, 1, 3);
  scene.add(fillLight);

  const modelGroup = new THREE.Group();
  modelGroup.name = "AR_MODEL_ROOT";
  scene.add(modelGroup);
  currentModel = modelGroup;

  createDemoCube();
  resizeRenderer();

  window.addEventListener("resize", resizeRenderer);
  animate();

  setStatus("3D scene ready. Press Open Camera to start.");
}

function createDemoCube() {
  if (!currentModel) return;

  if (cube) {
    currentModel.remove(cube);
    cube.geometry?.dispose();
    cube.material?.dispose();
  }

  const geometry = new THREE.BoxGeometry(0.65, 0.65, 0.65);
  const material = new THREE.MeshStandardMaterial({
    color: 0x29a8ff,
    metalness: 0.25,
    roughness: 0.35
  });

  cube = new THREE.Mesh(geometry, material);
  cube.name = "DemoCube";
  cube.position.set(0, 0, 0);
  currentModel.add(cube);
}

function resizeRenderer() {
  if (!renderer || !camera3D) return;

  const width = el.canvas.clientWidth || window.innerWidth;
  const height = el.canvas.clientHeight || window.innerHeight;

  renderer.setSize(width, height, false);
  camera3D.aspect = width / height;
  camera3D.updateProjectionMatrix();
}

function animate() {
  animationFrameId = window.requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (cube && !trackingEnabled) {
    cube.rotation.x += delta * 0.45;
    cube.rotation.y += delta * 0.7;
  }

  if (renderer && scene && camera3D) {
    renderer.render(scene, camera3D);
  }

  if (trackingEnabled && faceLandmarker && !trackingBusy) {
    const now = performance.now();

    if (now - lastTrackingTime > 50) {
      lastTrackingTime = now;
      updateFaceTracking(now);
    }
  }
}

function clearModelChildren() {
  if (!currentModel) return;

  while (currentModel.children.length) {
    const child = currentModel.children[0];
    currentModel.remove(child);

    child.traverse?.((object) => {
      if (object.geometry) object.geometry.dispose();

      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((material) => {
          for (const value of Object.values(material)) {
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        });
      }
    });
  }

  cube = null;
}

function addModelToScene(object) {
  if (!currentModel || !object) return;

  clearModelChildren();

  object.name = object.name || "ImportedModel";
  currentModel.add(object);

  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);

  fitModelToView(object);
  setStatus(`Model loaded: ${object.name}`);
}

function fitModelToView(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  bounds.getSize(size);
  bounds.getCenter(center);

  object.position.sub(center);

  const largestDimension = Math.max(size.x, size.y, size.z);

  if (largestDimension > 0) {
    const fitScale = 1.5 / largestDimension;
    object.scale.setScalar(fitScale);
  }
}async function startCamera() {
  try {
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera API is not supported in this browser.");
    }

    setStatus("Requesting camera permission...");

    activeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    el.video.srcObject = activeCameraStream;
    el.video.muted = true;
    el.video.playsInline = true;
    el.video.autoplay = true;

    await el.video.play();

    setStatus("Camera is running.");

    if (trackingEnabled) {
      await startFaceTracking();
    }
  } catch (error) {
    showError(error, "Camera error");
  }
}

function stopCamera() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        console.warn("Could not stop camera track:", error);
      }
    });
    activeCameraStream = null;
  }

  if (el.video) {
    el.video.pause();
    el.video.srcObject = null;
  }
}

async function switchCamera() {
  facingMode = facingMode === "user" ? "environment" : "user";

  setStatus(
    facingMode === "user"
      ? "Switching to front camera..."
      : "Switching to back camera..."
  );

  await startCamera();
}

function takePhoto() {
  try {
    if (!el.video || el.video.readyState < 2) {
      setStatus("Start the camera before taking a photo.", true);
      return;
    }

    const width = el.video.videoWidth || 1280;
    const height = el.video.videoHeight || 720;

    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = width;
    photoCanvas.height = height;

    const ctx = photoCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create photo canvas.");
    }

    ctx.drawImage(el.video, 0, 0, width, height);

    if (renderer && el.canvas) {
      ctx.drawImage(
        el.canvas,
        0,
        0,
        width,
        height
      );
    }

    photoCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Photo creation failed.", true);
        return;
      }

      downloadBlob(
        blob,
        `aziz-ar-photo-${Date.now()}.png`
      );

      setStatus("Photo saved.");
    }, "image/png");
  } catch (error) {
    showError(error, "Photo error");
  }
}

function getSupportedRecorderMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  if (!window.MediaRecorder) return "";

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

function startRecording() {
  try {
    if (!window.MediaRecorder) {
      throw new Error("Video recording is not supported.");
    }

    if (!activeCameraStream) {
      setStatus("Start the camera before recording.", true);
      return;
    }

    if (isRecording) return;

    recordedChunks = [];

    const tracks = activeCameraStream.getVideoTracks();

    if (!tracks.length) {
      throw new Error("No camera video track is available.");
    }

    const recordingStream = new MediaStream(tracks);

    const mimeType = getSupportedRecorderMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(recordingStream, { mimeType })
      : new MediaRecorder(recordingStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = saveRecording;

    mediaRecorder.onerror = (event) => {
      console.error("Recorder error:", event);
      setStatus("Recording error.", true);
      isRecording = false;
      setButtonLabel(el.recordButton, "Record");
    };

    mediaRecorder.start(250);

    isRecording = true;
    setButtonLabel(el.recordButton, "Stop Recording");
    setStatus("Recording...");
  } catch (error) {
    showError(error, "Recording error");
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    isRecording = false;
    setButtonLabel(el.recordButton, "Record");
    return;
  }

  mediaRecorder.stop();
  isRecording = false;
  setButtonLabel(el.recordButton, "Record");
  setStatus("Finishing recording...");
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function saveRecording() {
  try {
    if (!recordedChunks.length) {
      setStatus("No recorded video data was produced.", true);
      return;
    }

    const mimeType =
      mediaRecorder?.mimeType || "video/webm";

    const blob = new Blob(recordedChunks, {
      type: mimeType
    });

    const extension = mimeType.includes("mp4")
      ? "mp4"
      : "webm";

    downloadBlob(
      blob,
      `aziz-ar-video-${Date.now()}.${extension}`
    );

    recordedChunks = [];
    mediaRecorder = null;

    setStatus("Recording saved.");
  } catch (error) {
    showError(error, "Save recording error");
  }
    }async function toggleAudio() {
  try {
    if (!activeCameraStream) {
      setStatus("Start the camera before enabling audio.", true);
      return;
    }

    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    const audioTrack = audioStream.getAudioTracks()[0];

    if (!audioTrack) {
      throw new Error("Microphone track was not created.");
    }

    activeCameraStream.addTrack(audioTrack);
    audioEnabled = true;

    if (el.audioButton) {
      setButtonLabel(el.audioButton, "Audio On");
    }

    setStatus("Microphone enabled.");
  } catch (error) {
    showError(error, "Audio error");
  }
}

function handleModelImport(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const filename = file.name.toLowerCase();

  setStatus(`Loading ${file.name}...`);

  const reader = new FileReader();

  reader.onerror = () => {
    setStatus("Could not read the selected model.", true);
  };

  if (filename.endsWith(".glb") || filename.endsWith(".gltf")) {
    reader.onload = () => {
      const loader = new GLTFLoader();

      loader.parse(
        reader.result,
        "",
        (gltf) => {
          addModelToScene(gltf.scene);
        },
        (error) => {
          showError(error, "GLTF/GLB error");
        }
      );
    };

    reader.readAsArrayBuffer(file);
  } else if (filename.endsWith(".obj")) {
    reader.onload = () => {
      try {
        const loader = new OBJLoader();
        const object = loader.parse(reader.result);
        addModelToScene(object);
      } catch (error) {
        showError(error, "OBJ error");
      }
    };

    reader.readAsText(file);
  } else if (filename.endsWith(".stl")) {
    reader.onload = () => {
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(reader.result);

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.15,
          roughness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "ImportedSTL";

        addModelToScene(mesh);
      } catch (error) {
        showError(error, "STL error");
      }
    };

    reader.readAsArrayBuffer(file);
  } else {
    setStatus(
      "Unsupported format. Use GLB, GLTF, OBJ, or STL.",
      true
    );
  }

  event.target.value = "";
}

function exportModelGLTF() {
  if (!currentModel || currentModel.children.length === 0) {
    setStatus("There is no model to export.", true);
    return;
  }

  const exporter = new GLTFExporter();

  exporter.parse(
    currentModel,
    (result) => {
      try {
        const blob = result instanceof ArrayBuffer
          ? new Blob([result], {
              type: "model/gltf-binary"
            })
          : new Blob(
              [JSON.stringify(result)],
              { type: "application/json" }
            );

        const filename = result instanceof ArrayBuffer
          ? "aziz-ar-model.glb"
          : "aziz-ar-model.gltf";

        downloadBlob(blob, filename);
        setStatus("3D model exported.");
      } catch (error) {
        showError(error, "GLTF export error");
      }
    },
    (error) => {
      showError(error, "GLTF export error");
    },
    {
      binary: true,
      onlyVisible: true
    }
  );
}

function exportModelOBJ() {
  if (!currentModel || currentModel.children.length === 0) {
    setStatus("There is no model to export.", true);
    return;
  }

  try {
    const exporter = new OBJExporter();
    const result = exporter.parse(currentModel);

    const blob = new Blob(
      [result],
      { type: "text/plain" }
    );

    downloadBlob(blob, "aziz-ar-model.obj");
    setStatus("OBJ model exported.");
  } catch (error) {
    showError(error, "OBJ export error");
  }
}

function exportModel() {
  const format =
    el.exportFormat?.value?.toLowerCase() || "glb";

  if (format === "obj") {
    exportModelOBJ();
  } else {
    exportModelGLTF();
  }
}

function resetModel() {
  if (!currentModel) return;

  clearModelChildren();
  createDemoCube();

  if (el.scaleSlider) el.scaleSlider.value = "1";
  if (el.xSlider) el.xSlider.value = "0";
  if (el.ySlider) el.ySlider.value = "0";
  if (el.zSlider) el.zSlider.value = "0";
  if (el.rotateXSlider) el.rotateXSlider.value = "0";
  if (el.rotateYSlider) el.rotateYSlider.value = "0";
  if (el.rotateZSlider) el.rotateZSlider.value = "0";

  applyModelControls();

  setStatus("Model reset.");
}

function applyModelControls() {
  if (!currentModel) return;

  const scale = Number(el.scaleSlider?.value ?? 1);
  const x = Number(el.xSlider?.value ?? 0);
  const y = Number(el.ySlider?.value ?? 0);
  const z = Number(el.zSlider?.value ?? 0);

  const rx = THREE.MathUtils.degToRad(
    Number(el.rotateXSlider?.value ?? 0)
  );

  const ry = THREE.MathUtils.degToRad(
    Number(el.rotateYSlider?.value ?? 0)
  );

  const rz = THREE.MathUtils.degToRad(
    Number(el.rotateZSlider?.value ?? 0)
  );

  currentModel.scale.setScalar(
    Number.isFinite(scale) ? scale : 1
  );

  currentModel.position.set(
    Number.isFinite(x) ? x : 0,
    Number.isFinite(y) ? y : 0,
    Number.isFinite(z) ? z : 0
  );

  currentModel.rotation.set(rx, ry, rz);
}

function toggleControls() {
  if (!el.sideControls) return;

  const isHidden =
    el.sideControls.dataset.open !== "true";

  el.sideControls.dataset.open = isHidden
    ? "true"
    : "false";

  el.sideControls.style.display =
    isHidden ? "flex" : "none";
      }async function startFaceTracking() {
  if (trackingBusy) return;

  if (!el.video || el.video.readyState < 2) {
    setStatus("Start the camera before face tracking.", true);
    return;
  }

  trackingBusy = true;

  try {
    setStatus("Loading face tracking...");

    const visionModule = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
    );

    const {
      FaceLandmarker,
      FilesetResolver
    } = visionModule;

    const filesetResolver =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    faceLandmarker =
      await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: "./models/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true
        }
      );

    trackingEnabled = true;
    setStatus("Face tracking is ready.");
  } catch (error) {
    faceLandmarker = null;
    trackingEnabled = false;

    showError(
      error,
      "Face tracking error"
    );
  } finally {
    trackingBusy = false;
  }
}

function stopFaceTracking() {
  trackingEnabled = false;
  faceLandmarker = null;

  if (currentModel) {
    currentModel.position.set(0, 0, 0);
    currentModel.rotation.set(0, 0, 0);
  }

  setStatus("Face tracking stopped.");
}

async function toggleFaceTracking() {
  if (trackingEnabled) {
    stopFaceTracking();

    if (el.trackingButton) {
      setButtonLabel(
        el.trackingButton,
        "Face Tracking"
      );
    }

    return;
  }

  await startFaceTracking();

  if (trackingEnabled && el.trackingButton) {
    setButtonLabel(
      el.trackingButton,
      "Tracking On"
    );
  }
}

async function updateFaceTracking(timestamp) {
  if (
    !trackingEnabled ||
    !faceLandmarker ||
    !el.video ||
    el.video.readyState < 2 ||
    trackingBusy
  ) {
    return;
  }

  trackingBusy = true;

  try {
    const result =
      faceLandmarker.detectForVideo(
        el.video,
        timestamp
      );

    if (
      !result ||
      !result.faceLandmarks ||
      !result.faceLandmarks.length
    ) {
      setStatus("Face not detected.");
      return;
    }

    const landmarks =
      result.faceLandmarks[0];

    updateModelFromFace(landmarks);
  } catch (error) {
    console.error(
      "Tracking frame error:",
      error
    );
  } finally {
    trackingBusy = false;
  }
}

function updateModelFromFace(landmarks) {
  if (!currentModel || !landmarks?.length) {
    return;
  }

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];

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
    (leftEye.x + rightEye.x) * 0.5;

  const eyeCenterY =
    (leftEye.y + rightEye.y) * 0.5;

  const eyeDistance =
    Math.hypot(
      rightEye.x - leftEye.x,
      rightEye.y - leftEye.y
    );

  if (!Number.isFinite(eyeDistance) ||
      eyeDistance <= 0.001) {
    return;
  }

  const faceCenterX =
    (forehead.x + chin.x) * 0.5;

  const faceCenterY =
    (forehead.y + chin.y) * 0.5;

  const horizontalOffset =
    (faceCenterX - 0.5) * 3.0;

  const verticalOffset =
    -(faceCenterY - 0.5) * 2.4;

  const depth =
    THREE.MathUtils.clamp(
      1.1 / eyeDistance,
      2.0,
      8.0
    );

  const headTilt =
    Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );

  const noseToEye =
    Math.hypot(
      nose.x - eyeCenterX,
      nose.y - eyeCenterY
    );

  const headTurn =
    THREE.MathUtils.clamp(
      (nose.x - eyeCenterX) * 5,
      -1,
      1
    );

  currentModel.position.x =
    horizontalOffset;

  currentModel.position.y =
    verticalOffset;

  currentModel.position.z =
    -THREE.MathUtils.clamp(
      depth * 0.12,
      0.2,
      1.2
    );

  const trackingScale =
    THREE.MathUtils.clamp(
      eyeDistance * 4.5,
      0.45,
      2.5
    );

  currentModel.scale.setScalar(
    trackingScale
  );

  currentModel.rotation.z =
    -headTilt;

  currentModel.rotation.y =
    -headTurn * 0.8;

  const pitch =
    THREE.MathUtils.clamp(
      (nose.y - eyeCenterY) * 2.5,
      -0.8,
      0.8
    );

  currentModel.rotation.x =
    pitch;

  void noseToEye;
}

function setTrackingModelVisibility(visible) {
  if (!currentModel) return;
  currentModel.visible = visible;
}

function cleanupApp() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  stopCamera();

  if (mediaRecorder &&
      mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch (error) {
      console.warn(
        "Recorder cleanup error:",
        error
      );
    }
  }

  mediaRecorder = null;
  recordedChunks = [];
  faceLandmarker = null;
  trackingEnabled = false;
}

window.addEventListener(
  "beforeunload",
  cleanupApp
);function bindEvents() {
  el.cameraButton?.addEventListener("click", startCamera);

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
    handleModelImport
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
    toggleFaceTracking
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

  sliders.forEach((slider) => {
    slider?.addEventListener(
      "input",
      applyModelControls
    );
  });
}

function prepareVideoElement() {
  if (!el.video) return;

  el.video.setAttribute(
    "playsinline",
    ""
  );

  el.video.setAttribute(
    "autoplay",
    ""
  );

  el.video.muted = true;

  el.video.style.display = "block";
}

function initializeApp() {
  try {
    checkRequiredElements();
    prepareVideoElement();
    initThree();
    bindEvents();

    if (el.sideControls) {
      el.sideControls.dataset.open = "true";
    }

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
