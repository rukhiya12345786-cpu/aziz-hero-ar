import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

"use strict";

const $ = (id) => document.getElementById(id);

const ui = {
  camera: $("camera"),
  canvas: $("threeCanvas"),
  status: $("status"),

  cameraButton: $("cameraButton"),
  switchCameraButton: $("switchCameraButton"),
  photoButton: $("photoButton"),
  recordButton: $("recordButton"),
  audioButton: $("audioButton"),

  trackingButton: $("trackingButton"),
  modelButton: $("modelButton"),

  import3DButton: $("import3DButton"),
  import3DInput: $("import3DInput"),

  export3DButton: $("export3DButton"),
  exportFormat: $("exportFormat"),

  resetButton: $("resetButton"),

  sideControls: $("sideControls"),

  scaleSlider: $("scaleSlider"),
  xSlider: $("xSlider"),
  ySlider: $("ySlider"),
  zSlider: $("zSlider"),

  rotateXSlider: $("rotateXSlider"),
  rotateYSlider: $("rotateYSlider"),
  rotateZSlider: $("rotateZSlider")
};

let scene = null;
let threeCamera = null;
let renderer = null;

let modelRoot = null;
let demoCube = null;

let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];

let facingMode = "user";
let recording = false;
let microphoneEnabled = false;

let faceLandmarker = null;
let trackingEnabled = false;
let trackingLoading = false;
let lastTrackingTime = 0;

const requiredElements = [
  "camera",
  "threeCanvas",
  "status",
  "cameraButton",
  "switchCameraButton",
  "photoButton",
  "recordButton",
  "import3DButton",
  "import3DInput",
  "export3DButton",
  "resetButton"
];

function setStatus(message, error = false) {
  if (!ui.status) return;

  ui.status.textContent = String(message);
  ui.status.dataset.state = error ? "error" : "normal";
}

function reportError(label, error) {
  const message =
    error && error.message
      ? error.message
      : String(error);

  console.error(label, error);
  setStatus(`${label}: ${message}`, true);
}

function checkElements() {
  const missing = requiredElements.filter(
    (id) => !$(id)
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing HTML elements: ${missing.join(", ")}`
    );
  }
}

function setButtonText(button, text) {
  if (button) {
    button.textContent = text;
  }
}

function downloadBlob(blob, filename) {
  if (!blob) {
    throw new Error("Download data is empty.");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

function initThree() {
  if (!ui.canvas) {
    throw new Error("3D canvas is missing.");
  }

  scene = new THREE.Scene();

  threeCamera = new THREE.PerspectiveCamera(
    45,
    1,
    0.01,
    100
  );

  threeCamera.position.set(0, 0, 5);

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: ui.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
  } catch (error) {
    throw new Error(
      `WebGL renderer failed: ${error.message}`
    );
  }

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setClearColor(0x000000, 0);

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  const hemisphereLight =
    new THREE.HemisphereLight(
      0xffffff,
      0x333333,
      2
    );

  scene.add(hemisphereLight);

  const keyLight =
    new THREE.DirectionalLight(
      0xffffff,
      2.5
    );

  keyLight.position.set(
    3,
    5,
    5
  );

  scene.add(keyLight);

  const fillLight =
    new THREE.DirectionalLight(
      0xffffff,
      1.2
    );

  fillLight.position.set(
    -4,
    2,
    3
  );

  scene.add(fillLight);

  modelRoot = new THREE.Group();
  modelRoot.name = "AR_MODEL_ROOT";

  scene.add(modelRoot);

  createDemoCube();

  resizeRenderer();

  window.addEventListener(
    "resize",
    resizeRenderer
  );
}

function createDemoCube() {
  if (!modelRoot) return;

  clearModel();

  const geometry =
    new THREE.BoxGeometry(
      0.6,
      0.6,
      0.6
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x299cff,
      metalness: 0.2,
      roughness: 0.4
    });

  demoCube =
    new THREE.Mesh(
      geometry,
      material
    );

  demoCube.name = "DemoCube";

  modelRoot.add(
    demoCube
  );
}

function clearModel() {
  if (!modelRoot) return;

  while (
    modelRoot.children.length > 0
  ) {
    const object =
      modelRoot.children[
        modelRoot.children.length - 1
      ];

    modelRoot.remove(object);

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

  demoCube = null;
}

function resizeRenderer() {
  if (!renderer || !threeCamera) {
    return;
  }

  const width =
    ui.canvas.clientWidth ||
    window.innerWidth;

  const height =
    ui.canvas.clientHeight ||
    window.innerHeight;

  renderer.setSize(
    width,
    height,
    false
  );

  threeCamera.aspect =
    width / height;

  threeCamera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(
    animate
  );

  if (
    demoCube &&
    !trackingEnabled
  ) {
    demoCube.rotation.x += 0.008;
    demoCube.rotation.y += 0.012;
  }

  if (
    trackingEnabled &&
    faceLandmarker &&
    !trackingLoading
  ) {
    const now =
      performance.now();

    if (
      now - lastTrackingTime >
      50
    ) {
      lastTrackingTime = now;

      updateFaceTracking(
        now
      );
    }
  }

  if (
    renderer &&
    scene &&
    threeCamera
  ) {
    renderer.render(
      scene,
      threeCamera
    );
  }
}

function resetControls() {
  const values = {
    scaleSlider: "1",
    xSlider: "0",
    ySlider: "0",
    zSlider: "0",
    rotateXSlider: "0",
    rotateYSlider: "0",
    rotateZSlider: "0"
  };

  Object.entries(values).forEach(
    ([id, value]) => {
      const element = $(id);

      if (element) {
        element.value = value;
      }
    }
  );
}

function initializeBase() {
  checkElements();

  if (ui.camera) {
    ui.camera.setAttribute(
      "playsinline",
      ""
    );

    ui.camera.setAttribute(
      "autoplay",
      ""
    );

    ui.camera.muted = true;
  }

  initThree();
  resetControls();
  animate();

  setStatus(
    "Ready. Press Open Camera."
  );
}

window.addEventListener(
  "error",
  (event) => {
    if (event.message) {
      setStatus(
        `JavaScript error: ${event.message}`,
        true
      );
    }
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    reportError(
      "Async error",
      event.reason
    );
  }
);

initializeBase();async function openCamera() {
  try {
    stopCamera();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Camera access is not supported by this browser."
      );
    }

    setStatus(
      "Requesting camera permission..."
    );

    cameraStream =
      await navigator.mediaDevices.getUserMedia({
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
        },
        audio: false
      });

    ui.camera.srcObject =
      cameraStream;

    ui.camera.muted = true;
    ui.camera.playsInline = true;

    await ui.camera.play();

    setStatus(
      "Camera is running."
    );

    if (trackingEnabled) {
      await startFaceTracking();
    }

  } catch (error) {
    reportError(
      "Camera error",
      error
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
        } catch (error) {
          console.warn(
            "Camera track stop error:",
            error
          );
        }
      });

    cameraStream = null;
  }

  if (ui.camera) {
    ui.camera.pause();
    ui.camera.srcObject = null;
  }
}

async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  setStatus(
    facingMode === "user"
      ? "Switching to front camera..."
      : "Switching to back camera..."
  );

  await openCamera();
}

function takePhoto() {
  try {
    if (
      !ui.camera ||
      ui.camera.readyState < 2
    ) {
      setStatus(
        "Open the camera first.",
        true
      );
      return;
    }

    const width =
      ui.camera.videoWidth ||
      1280;

    const height =
      ui.camera.videoHeight ||
      720;

    const photo =
      document.createElement(
        "canvas"
      );

    photo.width = width;
    photo.height = height;

    const context =
      photo.getContext(
        "2d"
      );

    if (!context) {
      throw new Error(
        "Could not create photo canvas."
      );
    }

    context.drawImage(
      ui.camera,
      0,
      0,
      width,
      height
    );

    if (ui.canvas) {
      context.drawImage(
        ui.canvas,
        0,
        0,
        width,
        height
      );
    }

    photo.toBlob(
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
    reportError(
      "Photo error",
      error
    );
  }
}

function getRecorderType() {
  if (
    !window.MediaRecorder
  ) {
    return "";
  }

  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  for (
    const type of types
  ) {
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

function startRecording() {
  try {
    if (
      !window.MediaRecorder
    ) {
      throw new Error(
        "Video recording is not supported."
      );
    }

    if (!cameraStream) {
      setStatus(
        "Open the camera first.",
        true
      );
      return;
    }

    if (recording) {
      return;
    }

    recordedChunks = [];

    const videoTracks =
      cameraStream.getVideoTracks();

    if (
      videoTracks.length === 0
    ) {
      throw new Error(
        "Camera video track is unavailable."
      );
    }

    const recordingStream =
      new MediaStream(
        videoTracks
      );

    const mimeType =
      getRecorderType();

    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            recordingStream,
            {
              mimeType
            }
          )
        : new MediaRecorder(
            recordingStream
          );

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
      (event) => {
        console.error(
          "MediaRecorder error:",
          event
        );

        recording = false;

        setButtonText(
          ui.recordButton,
          "Record"
        );

        setStatus(
          "Recording error.",
          true
        );
      };

    mediaRecorder.start(
      250
    );

    recording = true;

    setButtonText(
      ui.recordButton,
      "Stop Recording"
    );

    setStatus(
      "Recording..."
    );

  } catch (error) {
    reportError(
      "Recording error",
      error
    );
  }
}

function stopRecording() {
  if (
    !mediaRecorder ||
    mediaRecorder.state ===
      "inactive"
  ) {
    recording = false;

    setButtonText(
      ui.recordButton,
      "Record"
    );

    return;
  }

  mediaRecorder.stop();

  recording = false;

  setButtonText(
    ui.recordButton,
    "Record"
  );

  setStatus(
    "Saving recording..."
  );
}

function toggleRecording() {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function saveRecording() {
  try {
    if (
      recordedChunks.length === 0
    ) {
      setStatus(
        "No video data was recorded.",
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
        {
          type: mimeType
        }
      );

    const extension =
      mimeType.includes(
        "mp4"
      )
        ? "mp4"
        : "webm";

    downloadBlob(
      blob,
      `aziz-ar-video-${Date.now()}.${extension}`
    );

    recordedChunks = [];
    mediaRecorder = null;

    setStatus(
      "Recording saved."
    );

  } catch (error) {
    reportError(
      "Save recording error",
      error
    );
  }
  }async function toggleMicrophone() {
  try {
    if (!cameraStream) {
      setStatus(
        "Open the camera first.",
        true
      );
      return;
    }

    if (
      microphoneEnabled &&
      cameraStream.getAudioTracks().length > 0
    ) {
      cameraStream
        .getAudioTracks()
        .forEach((track) => {
          track.stop();
          cameraStream.removeTrack(track);
        });

      microphoneEnabled = false;

      setButtonText(
        ui.audioButton,
        "Audio"
      );

      setStatus(
        "Microphone disabled."
      );

      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Microphone access is not supported."
      );
    }

    setStatus(
      "Requesting microphone permission..."
    );

    const audioStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

    const audioTracks =
      audioStream.getAudioTracks();

    if (
      audioTracks.length === 0
    ) {
      throw new Error(
        "Microphone track was not created."
      );
    }

    audioTracks.forEach(
      (track) => {
        cameraStream.addTrack(
          track
        );
      }
    );

    microphoneEnabled = true;

    setButtonText(
      ui.audioButton,
      "Audio On"
    );

    setStatus(
      "Microphone enabled."
    );

  } catch (error) {
    reportError(
      "Microphone error",
      error
    );
  }
}

function addImportedModel(object) {
  if (!modelRoot || !object) {
    throw new Error(
      "3D model could not be added."
    );
  }

  clearModel();

  object.name =
    object.name ||
    "ImportedModel";

  modelRoot.add(
    object
  );

  normalizeModel(
    object
  );

  setStatus(
    "3D model loaded."
  );
}

function normalizeModel(object) {
  const box =
    new THREE.Box3()
      .setFromObject(object);

  if (box.isEmpty()) {
    throw new Error(
      "The selected model contains no visible geometry."
    );
  }

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
    const targetSize = 1.5;

    const factor =
      targetSize /
      largest;

    object.scale.setScalar(
      factor
    );
  }
}

function importModelFile(event) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  const name =
    file.name.toLowerCase();

  setStatus(
    `Loading ${file.name}...`
  );

  try {
    if (
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    ) {
      importGLTF(file);
    } else if (
      name.endsWith(".obj")
    ) {
      importOBJ(file);
    } else if (
      name.endsWith(".stl")
    ) {
      importSTL(file);
    } else {
      throw new Error(
        "Supported formats: GLB, GLTF, OBJ, STL."
      );
    }
  } catch (error) {
    reportError(
      "Import error",
      error
    );
  } finally {
    event.target.value = "";
  }
}

function importGLTF(file) {
  const reader =
    new FileReader();

  reader.onerror =
    () => {
      setStatus(
        "Could not read the GLB/GLTF file.",
        true
      );
    };

  reader.onload =
    () => {
      try {
        const loader =
          new GLTFLoader();

        loader.parse(
          reader.result,
          "",
          (gltf) => {
            if (
              !gltf ||
              !gltf.scene
            ) {
              throw new Error(
                "GLB/GLTF scene is empty."
              );
            }

            addImportedModel(
              gltf.scene
            );
          },
          (error) => {
            reportError(
              "GLB/GLTF error",
              error
            );
          }
        );
      } catch (error) {
        reportError(
          "GLB/GLTF error",
          error
        );
      }
    };

  reader.readAsArrayBuffer(
    file
  );
}

function importOBJ(file) {
  const reader =
    new FileReader();

  reader.onerror =
    () => {
      setStatus(
        "Could not read the OBJ file.",
        true
      );
    };

  reader.onload =
    () => {
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
        reportError(
          "OBJ error",
          error
        );
      }
    };

  reader.readAsText(
    file
  );
}

function importSTL(file) {
  const reader =
    new FileReader();

  reader.onerror =
    () => {
      setStatus(
        "Could not read the STL file.",
        true
      );
    };

  reader.onload =
    () => {
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
        reportError(
          "STL error",
          error
        );
      }
    };

  reader.readAsArrayBuffer(
    file
  );
}

function exportModel() {
  if (
    !modelRoot ||
    modelRoot.children.length === 0
  ) {
    setStatus(
      "There is no 3D model to export.",
      true
    );
    return;
  }

  const format =
    ui.exportFormat?.value ||
    "glb";

  if (
    format === "obj"
  ) {
    exportOBJ();
  } else {
    exportGLB();
  }
}

function exportGLB() {
  const exporter =
    new GLTFExporter();

  try {
    exporter.parse(
      modelRoot,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          setStatus(
            "GLB export did not produce binary data.",
            true
          );
          return;
        }

        const blob =
          new Blob(
            [result],
            {
              type: "model/gltf-binary"
            }
          );

        downloadBlob(
          blob,
          `aziz-ar-model-${Date.now()}.glb`
        );

        setStatus(
          "GLB exported."
        );
      },
      (error) => {
        reportError(
          "GLB export error",
          error
        );
      },
      {
        binary: true,
        onlyVisible: true
      }
    );
  } catch (error) {
    reportError(
      "GLB export error",
      error
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
      `aziz-ar-model-${Date.now()}.obj`
    );

    setStatus(
      "OBJ exported."
    );
  } catch (error) {
    reportError(
      "OBJ export error",
      error
    );
  }
}function applyModelControls() {
  if (!modelRoot) return;

  const scale = Number(
    ui.scaleSlider?.value ?? 1
  );

  const x = Number(
    ui.xSlider?.value ?? 0
  );

  const y = Number(
    ui.ySlider?.value ?? 0
  );

  const z = Number(
    ui.zSlider?.value ?? 0
  );

  const rx = THREE.MathUtils.degToRad(
    Number(
      ui.rotateXSlider?.value ?? 0
    )
  );

  const ry = THREE.MathUtils.degToRad(
    Number(
      ui.rotateYSlider?.value ?? 0
    )
  );

  const rz = THREE.MathUtils.degToRad(
    Number(
      ui.rotateZSlider?.value ?? 0
    )
  );

  modelRoot.scale.setScalar(
    Number.isFinite(scale)
      ? scale
      : 1
  );

  modelRoot.position.set(
    Number.isFinite(x) ? x : 0,
    Number.isFinite(y) ? y : 0,
    Number.isFinite(z) ? z : 0
  );

  modelRoot.rotation.set(
    rx,
    ry,
    rz
  );
}

function resetModel() {
  if (!modelRoot) return;

  trackingEnabled = false;

  clearModel();

  createDemoCube();

  resetControls();

  setButtonText(
    ui.trackingButton,
    "Face Tracking"
  );

  setStatus(
    "Model reset."
  );
}

function resetControls() {
  const defaults = {
    scaleSlider: "1",
    xSlider: "0",
    ySlider: "0",
    zSlider: "0",
    rotateXSlider: "0",
    rotateYSlider: "0",
    rotateZSlider: "0"
  };

  Object.entries(
    defaults
  ).forEach(
    ([id, value]) => {
      const element =
        $(id);

      if (element) {
        element.value =
          value;
      }
    }
  );

  applyModelControls();
}

function toggleModelControls() {
  if (!ui.sideControls) {
    return;
  }

  const currentlyVisible =
    ui.sideControls.style.display !==
    "none";

  ui.sideControls.style.display =
    currentlyVisible
      ? "none"
      : "flex";
}

async function loadFaceTrackingLibrary() {
  if (
    window.FaceLandmarker &&
    window.FilesetResolver
  ) {
    return {
      FaceLandmarker:
        window.FaceLandmarker,
      FilesetResolver:
        window.FilesetResolver
    };
  }

  throw new Error(
    "MediaPipe library is not available. Add the MediaPipe library script to index.html before enabling tracking."
  );
}

async function startFaceTracking() {
  if (trackingLoading) {
    return;
  }

  if (
    !ui.camera ||
    ui.camera.readyState < 2
  ) {
    setStatus(
      "Open the camera first.",
      true
    );
    return;
  }

  trackingLoading = true;

  try {
    setStatus(
      "Loading face tracking..."
    );

    const {
      FaceLandmarker,
      FilesetResolver
    } =
      await loadFaceTrackingLibrary();

    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );

    faceLandmarker =
      await FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "./models/face_landmarker.task",

            delegate: "GPU"
          },

          runningMode: "VIDEO",

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

    trackingEnabled = true;

    setButtonText(
      ui.trackingButton,
      "Tracking On"
    );

    setStatus(
      "Face tracking ready."
    );

  } catch (error) {
    faceLandmarker = null;
    trackingEnabled = false;

    setButtonText(
      ui.trackingButton,
      "Face Tracking"
    );

    reportError(
      "Face tracking error",
      error
    );

  } finally {
    trackingLoading = false;
  }
}

function stopFaceTracking() {
  trackingEnabled = false;

  faceLandmarker = null;

  setButtonText(
    ui.trackingButton,
    "Face Tracking"
  );

  if (modelRoot) {
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
  }

  setStatus(
    "Face tracking stopped."
  );
}

async function toggleFaceTracking() {
  if (trackingEnabled) {
    stopFaceTracking();
    return;
  }

  await startFaceTracking();
}

function updateFaceTracking(timestamp) {
  if (
    !trackingEnabled ||
    !faceLandmarker ||
    !ui.camera ||
    ui.camera.readyState < 2
  ) {
    return;
  }

  try {
    const result =
      faceLandmarker.detectForVideo(
        ui.camera,
        timestamp
      );

    if (
      !result ||
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {
      return;
    }

    const landmarks =
      result.faceLandmarks[0];

    updateModelFromLandmarks(
      landmarks
    );

  } catch (error) {
    console.error(
      "Face tracking frame error:",
      error
    );
  }
}

function updateModelFromLandmarks(
  landmarks
) {
  if (
    !modelRoot ||
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
    (leftEye.x +
      rightEye.x) /
    2;

  const eyeCenterY =
    (leftEye.y +
      rightEye.y) /
    2;

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
    eyeDistance <= 0.001
  ) {
    return;
  }

  const faceCenterX =
    (forehead.x +
      chin.x) /
    2;

  const faceCenterY =
    (forehead.y +
      chin.y) /
    2;

  const screenX =
    (faceCenterX -
      0.5) *
    3.0;

  const screenY =
    -(faceCenterY -
      0.5) *
    2.4;

  const tilt =
    Math.atan2(
      rightEye.y -
        leftEye.y,

      rightEye.x -
        leftEye.x
    );

  const turn =
    THREE.MathUtils.clamp(
      (nose.x -
        eyeCenterX) *
        5.0,

      -1,
      1
    );

  const pitch =
    THREE.MathUtils.clamp(
      (nose.y -
        eyeCenterY) *
        3.0,

      -1,
      1
    );

  const trackingScale =
    THREE.MathUtils.clamp(
      eyeDistance *
        4.5,

      0.45,
      2.5
    );

  modelRoot.position.x =
    screenX;

  modelRoot.position.y =
    screenY;

  modelRoot.position.z =
    -0.5;

  modelRoot.scale.setScalar(
    trackingScale
  );

  modelRoot.rotation.z =
    -tilt;

  modelRoot.rotation.y =
    -turn * 0.8;

  modelRoot.rotation.x =
    pitch;
}function bindEvents() {
  ui.cameraButton?.addEventListener(
    "click",
    openCamera
  );

  ui.switchCameraButton?.addEventListener(
    "click",
    switchCamera
  );

  ui.photoButton?.addEventListener(
    "click",
    takePhoto
  );

  ui.recordButton?.addEventListener(
    "click",
    toggleRecording
  );

  ui.audioButton?.addEventListener(
    "click",
    toggleMicrophone
  );

  ui.trackingButton?.addEventListener(
    "click",
    toggleFaceTracking
  );

  ui.modelButton?.addEventListener(
    "click",
    toggleModelControls
  );

  ui.import3DButton?.addEventListener(
    "click",
    () => {
      ui.import3DInput?.click();
    }
  );

  ui.import3DInput?.addEventListener(
    "change",
    importModelFile
  );

  ui.export3DButton?.addEventListener(
    "click",
    exportModel
  );

  ui.resetButton?.addEventListener(
    "click",
    resetModel
  );

  const sliders = [
    ui.scaleSlider,
    ui.xSlider,
    ui.ySlider,
    ui.zSlider,
    ui.rotateXSlider,
    ui.rotateYSlider,
    ui.rotateZSlider
  ];

  sliders.forEach(
    (slider) => {
      slider?.addEventListener(
        "input",
        applyModelControls
      );
    }
  );
}

function cleanup() {
  trackingEnabled = false;
  trackingLoading = false;
  faceLandmarker = null;

  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {
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

  stopCamera();
}

function startApp() {
  try {
    bindEvents();

    setStatus(
      "Ready. Press Open Camera."
    );

  } catch (error) {
    reportError(
      "Startup error",
      error
    );
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);

startApp();
