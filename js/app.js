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
let microphoneStream = null;

let mediaRecorder = null;
let recordingCanvas = null;
let recordingContext = null;
let recordingCanvasStream = null;
let recordedChunks = [];

let currentModel = null;
let trackingRoot = null;
let cube = null;

let animationFrameId = null;

let facingMode = "user";
let isRecording = false;
let audioEnabled = false;

let faceLandmarker = null;
let trackingEnabled = false;
let trackingBusy = false;
let lastTrackingTime = 0;
let mediaPipePromise = null;
let lastVideoTime = -1;

const clock = new THREE.Clock();

const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

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

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

function setButtonLabel(button, label) {
  if (button) {
    button.textContent = label;
  }
}

window.addEventListener("error", (event) => {
  showError(
    event.message || "Unknown JavaScript error",
    "JavaScript error"
  );
});

window.addEventListener("unhandledrejection", (event) => {
  showError(
    event.reason || "Unknown promise error",
    "Async error"
  );
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

  const missing = required
    .filter(([, element]) => !element)
    .map(([id]) => id);

  if (missing.length) {
    throw new Error(
      `Missing HTML element IDs: ${missing.join(", ")}`
    );
  }
}

function prepareVideoElement() {
  if (!el.video) return;

  el.video.setAttribute("playsinline", "");
  el.video.setAttribute("autoplay", "");

  el.video.muted = true;
  el.video.playsInline = true;
  el.video.autoplay = true;

  el.video.style.display = "block";
  el.video.style.transform = "scaleX(1)";
  el.video.style.webkitTransform = "scaleX(1)";
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

  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  fillLight.position.set(-4, 1, 3);
  scene.add(fillLight);

  trackingRoot = new THREE.Group();
  trackingRoot.name = "FACE_TRACKING_ROOT";
  scene.add(trackingRoot);

  currentModel = new THREE.Group();
  currentModel.name = "AR_MODEL_ROOT";

  trackingRoot.add(currentModel);

  createDemoCube();

  resizeRenderer();

  window.addEventListener(
    "resize",
    resizeRenderer
  );

  animate();

  setStatus(
    "3D scene ready. Press Open Camera to start."
  );
}

function createDemoCube() {
  if (!currentModel) return;

  clearModelChildren();

  const geometry = new THREE.BoxGeometry(
    0.55,
    0.55,
    0.55
  );

  const material = new THREE.MeshStandardMaterial({
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
    width / height;

  camera3D.updateProjectionMatrix();
}

function animate() {
  animationFrameId =
    window.requestAnimationFrame(
      animate
    );

  const delta = clock.getDelta();

  if (
    cube &&
    !trackingEnabled
  ) {
    cube.rotation.x += delta * 0.45;
    cube.rotation.y += delta * 0.7;
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
    isRecording &&
    recordingContext &&
    recordingCanvas
  ) {
    drawRecordingFrame();
  }

  if (
    trackingEnabled &&
    faceLandmarker &&
    !trackingBusy
  ) {
    const now = performance.now();

    if (now - lastTrackingTime > 33) {
      lastTrackingTime = now;
      updateFaceTracking(now);
    }
  }
}function clearModelChildren() {
  if (!currentModel) return;

  while (currentModel.children.length) {
    const child = currentModel.children[0];

    currentModel.remove(child);

    child.traverse?.((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach((material) => {
          for (const value of Object.values(material)) {
            if (value && value.isTexture) {
              value.dispose();
            }
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

  object.name =
    object.name || "ImportedModel";

  currentModel.add(object);

  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);

  fitModelToView(object);

  applyModelControls();

  setStatus(
    `Model loaded: ${object.name}`
  );
}

function fitModelToView(object) {
  const bounds =
    new THREE.Box3().setFromObject(object);

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  bounds.getSize(size);
  bounds.getCenter(center);

  object.position.sub(center);

  const largestDimension =
    Math.max(
      size.x,
      size.y,
      size.z
    );

  if (
    Number.isFinite(largestDimension) &&
    largestDimension > 0
  ) {
    const fitScale =
      1.5 / largestDimension;

    object.scale.setScalar(
      fitScale
    );
  }
}

function applyCameraOrientation() {
  if (!el.video) return;

  el.video.style.transform = "scaleX(1)";
  el.video.style.webkitTransform = "scaleX(1)";
}

async function startCamera() {
  try {
    stopCamera();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Camera API is not supported in this browser."
      );
    }

    setStatus(
      "Requesting camera permission..."
    );

    let constraints = {
      video: {
        facingMode: {
          exact: facingMode
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: false
    };

    try {
      activeCameraStream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );
    } catch (firstError) {
      constraints = {
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
      };

      activeCameraStream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );
    }

    el.video.srcObject =
      activeCameraStream;

    el.video.muted = true;
    el.video.playsInline = true;
    el.video.autoplay = true;

    applyCameraOrientation();

    await el.video.play();

    setStatus(
      facingMode === "user"
        ? "Front camera is running."
        : "Back camera is running."
    );

    if (trackingEnabled) {
      await startFaceTracking();
    }
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
      .forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn(
            "Camera stop error:",
            error
          );
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
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  setStatus(
    facingMode === "user"
      ? "Switching to front camera..."
      : "Switching to back camera..."
  );

  await startCamera();
}

function getOutputSize() {
  const width =
    el.video?.videoWidth || 1280;

  const height =
    el.video?.videoHeight || 720;

  return {
    width: Math.max(
      320,
      Math.floor(width)
    ),
    height: Math.max(
      240,
      Math.floor(height)
    )
  };
}

function prepareRecordingCanvas() {
  const {
    width,
    height
  } = getOutputSize();

  if (!recordingCanvas) {
    recordingCanvas =
      document.createElement(
        "canvas"
      );
  }

  recordingCanvas.width = width;
  recordingCanvas.height = height;

  recordingContext =
    recordingCanvas.getContext(
      "2d",
      {
        alpha: false
      }
    );

  if (!recordingContext) {
    throw new Error(
      "Could not create recording canvas."
    );
  }
}

function drawCameraFrame(
  context,
  canvas,
  video
) {
  if (!context || !canvas || !video) {
    return;
  }

  context.save();

  context.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.restore();
}

function drawRecordingFrame() {
  if (
    !recordingContext ||
    !recordingCanvas ||
    !el.video
  ) {
    return;
  }

  if (el.video.readyState < 2) {
    return;
  }

  drawCameraFrame(
    recordingContext,
    recordingCanvas,
    el.video
  );

  if (el.canvas && renderer) {
    recordingContext.drawImage(
      el.canvas,
      0,
      0,
      recordingCanvas.width,
      recordingCanvas.height
    );
  }
}

function takePhoto() {
  try {
    if (
      !el.video ||
      el.video.readyState < 2
    ) {
      setStatus(
        "Start the camera before taking a photo.",
        true
      );
      return;
    }

    const {
      width,
      height
    } = getOutputSize();

    const photoCanvas =
      document.createElement(
        "canvas"
      );

    photoCanvas.width = width;
    photoCanvas.height = height;

    const context =
      photoCanvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Could not create photo canvas."
      );
    }

    drawCameraFrame(
      context,
      photoCanvas,
      el.video
    );

    if (el.canvas && renderer) {
      context.drawImage(
        el.canvas,
        0,
        0,
        width,
        height
      );
    }

    photoCanvas.toBlob(
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

        setStatus("Photo saved.");
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

function getSupportedRecorderMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  if (!window.MediaRecorder) {
    return "";
  }

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
  }function startRecording() {
  try {
    if (!window.MediaRecorder) {
      throw new Error(
        "Video recording is not supported."
      );
    }

    if (!activeCameraStream) {
      setStatus(
        "Start the camera before recording.",
        true
      );
      return;
    }

    if (isRecording) return;

    prepareRecordingCanvas();

    recordedChunks = [];

    drawRecordingFrame();

    recordingCanvasStream =
      recordingCanvas.captureStream(30);

    const recordingTracks = [
      ...recordingCanvasStream.getVideoTracks()
    ];

    if (
      microphoneStream &&
      microphoneStream.getAudioTracks().length
    ) {
      recordingTracks.push(
        ...microphoneStream.getAudioTracks()
      );
    }

    const recordingStream =
      new MediaStream(
        recordingTracks
      );

    const mimeType =
      getSupportedRecorderMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(
          recordingStream,
          { mimeType }
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
      () => {
        isRecording = false;

        setButtonLabel(
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

    setButtonLabel(
      el.recordButton,
      "Stop Recording"
    );

    setStatus(
      "Recording camera + 3D model..."
    );
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
    mediaRecorder.state === "inactive"
  ) {
    isRecording = false;

    setButtonLabel(
      el.recordButton,
      "Record"
    );

    return;
  }

  try {
    mediaRecorder.stop();
  } catch (error) {
    showError(
      error,
      "Stop recording error"
    );
  }

  isRecording = false;

  setButtonLabel(
    el.recordButton,
    "Record"
  );

  setStatus(
    "Finishing recording..."
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
  try {
    if (!recordedChunks.length) {
      setStatus(
        "No recorded video data was produced.",
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

    const extension =
      mimeType.includes("mp4")
        ? "mp4"
        : "webm";

    downloadBlob(
      blob,
      `aziz-ar-video-${Date.now()}.${extension}`
    );

    recordedChunks = [];

    if (recordingCanvasStream) {
      recordingCanvasStream
        .getTracks()
        .forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.warn(
              "Recording track stop error:",
              error
            );
          }
        });

      recordingCanvasStream = null;
    }

    mediaRecorder = null;

    setStatus(
      "Recording saved with 3D model."
    );
  } catch (error) {
    showError(
      error,
      "Save recording error"
    );
  }
}

async function toggleAudio() {
  try {
    if (!activeCameraStream) {
      setStatus(
        "Start the camera before enabling audio.",
        true
      );
      return;
    }

    if (audioEnabled) {
      if (microphoneStream) {
        microphoneStream
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch (error) {
              console.warn(
                "Microphone stop error:",
                error
              );
            }
          });

        microphoneStream = null;
      }

      audioEnabled = false;

      setButtonLabel(
        el.audioButton,
        "Audio"
      );

      setStatus(
        "Microphone disabled."
      );

      return;
    }

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    if (
      !microphoneStream.getAudioTracks().length
    ) {
      throw new Error(
        "Microphone track was not created."
      );
    }

    audioEnabled = true;

    setButtonLabel(
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

function handleModelImport(event) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  const filename =
    file.name.toLowerCase();

  setStatus(
    `Loading ${file.name}...`
  );

  const reader =
    new FileReader();

  reader.onerror = () => {
    setStatus(
      "Could not read the selected model.",
      true
    );
  };

  if (
    filename.endsWith(".glb") ||
    filename.endsWith(".gltf")
  ) {
    reader.onload = () => {
      const loader =
        new GLTFLoader();

      loader.parse(
        reader.result,
        "",
        (gltf) => {
          addModelToScene(
            gltf.scene
          );
        },
        (error) => {
          showError(
            error,
            "GLTF/GLB error"
          );
        }
      );
    };

    reader.readAsArrayBuffer(file);
  } else if (
    filename.endsWith(".obj")
  ) {
    reader.onload = () => {
      try {
        const loader =
          new OBJLoader();

        const object =
          loader.parse(
            reader.result
          );

        addModelToScene(object);
      } catch (error) {
        showError(
          error,
          "OBJ error"
        );
      }
    };

    reader.readAsText(file);
  } else if (
    filename.endsWith(".stl")
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

        addModelToScene(mesh);
      } catch (error) {
        showError(
          error,
          "STL error"
        );
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
  if (
    !currentModel ||
    currentModel.children.length === 0
  ) {
    setStatus(
      "There is no model to export.",
      true
    );
    return;
  }

  const exporter =
    new GLTFExporter();

  exporter.parse(
    currentModel,
    (result) => {
      try {
        const isBinary =
          result instanceof ArrayBuffer;

        const blob =
          isBinary
            ? new Blob(
                [result],
                {
                  type:
                    "model/gltf-binary"
                }
              )
            : new Blob(
                [JSON.stringify(result)],
                {
                  type:
                    "application/json"
                }
              );

        downloadBlob(
          blob,
          isBinary
            ? "aziz-ar-model.glb"
            : "aziz-ar-model.gltf"
        );

        setStatus(
          "3D model exported."
        );
      } catch (error) {
        showError(
          error,
          "GLTF export error"
        );
      }
    },
    (error) => {
      showError(
        error,
        "GLTF export error"
      );
    },
    {
      binary: true,
      onlyVisible: true
    }
  );
}

function exportModelOBJ() {
  if (
    !currentModel ||
    currentModel.children.length === 0
  ) {
    setStatus(
      "There is no model to export.",
      true
    );
    return;
  }

  try {
    const exporter =
      new OBJExporter();

    const result =
      exporter.parse(
        currentModel
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
      "OBJ model exported."
    );
  } catch (error) {
    showError(
      error,
      "OBJ export error"
    );
  }
}

function exportModel() {
  const format =
    el.exportFormat?.value
      ?.toLowerCase() || "glb";

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

  const defaults = [
    [el.scaleSlider, "1"],
    [el.xSlider, "0"],
    [el.ySlider, "0"],
    [el.zSlider, "0"],
    [el.rotateXSlider, "0"],
    [el.rotateYSlider, "0"],
    [el.rotateZSlider, "0"]
  ];

  defaults.forEach(
    ([slider, value]) => {
      if (slider) {
        slider.value = value;
      }
    }
  );

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

  applyModelControls();

  setStatus(
    "Model reset."
  );
}

function applyModelControls() {
  if (!currentModel) return;

  const scale =
    Number(
      el.scaleSlider?.value ?? 1
    );

  const x =
    Number(
      el.xSlider?.value ?? 0
    );

  const y =
    Number(
      el.ySlider?.value ?? 0
    );

  const z =
    Number(
      el.zSlider?.value ?? 0
    );

  const rx =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateXSlider?.value ?? 0
      )
    );

  const ry =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateYSlider?.value ?? 0
      )
    );

  const rz =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateZSlider?.value ?? 0
      )
    );

  currentModel.scale.setScalar(
    Number.isFinite(scale)
      ? scale
      : 1
  );

  currentModel.position.set(
    Number.isFinite(x) ? x : 0,
    Number.isFinite(y) ? y : 0,
    Number.isFinite(z) ? z : 0
  );

  currentModel.rotation.set(
    rx,
    ry,
    rz
  );
      }function toggleControls() {
  if (!el.sideControls) return;

  const isHidden =
    el.sideControls.dataset.open !== "true";

  el.sideControls.dataset.open =
    isHidden ? "true" : "false";

  el.sideControls.style.display =
    isHidden ? "flex" : "none";
}

async function loadMediaPipe() {
  if (mediaPipePromise) {
    return mediaPipePromise;
  }

  mediaPipePromise =
    import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
    );

  return mediaPipePromise;
}

async function startFaceTracking() {
  if (trackingBusy) return;

  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Start the camera before face tracking.",
      true
    );
    return;
  }

  trackingBusy = true;

  try {
    setStatus(
      "Loading face tracking..."
    );

    const vision =
      await loadMediaPipe();

    const {
      FaceLandmarker,
      FilesetResolver
    } = vision;

    if (!FaceLandmarker || !FilesetResolver) {
      throw new Error(
        "MediaPipe Face Landmarker could not be loaded."
      );
    }

    const fileset =
      await FilesetResolver.forVisionTasks(
        MEDIAPIPE_WASM_URL
      );

    faceLandmarker =
      await FaceLandmarker.createFromOptions(
        fileset,
        {
          baseOptions: {
            modelAssetPath:
              FACE_MODEL_URL,
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
    lastVideoTime = -1;

    if (trackingRoot) {
      trackingRoot.visible = true;
    }

    setButtonLabel(
      el.trackingButton,
      "Tracking On"
    );

    setStatus(
      "Face tracking is ready."
    );
  } catch (error) {
    faceLandmarker = null;
    trackingEnabled = false;

    setButtonLabel(
      el.trackingButton,
      "Face Tracking"
    );

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

  if (faceLandmarker) {
    try {
      faceLandmarker.close?.();
    } catch (error) {
      console.warn(
        "Face landmarker close error:",
        error
      );
    }
  }

  faceLandmarker = null;
  lastVideoTime = -1;

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

  setButtonLabel(
    el.trackingButton,
    "Face Tracking"
  );

  setStatus(
    "Face tracking stopped."
  );
}

async function toggleFaceTracking() {
  if (trackingEnabled) {
    stopFaceTracking();
    return;
  }

  if (
    !activeCameraStream ||
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Open the camera first.",
      true
    );
    return;
  }

  await startFaceTracking();
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
        timestamp
      );

    if (
      !result ||
      !result.faceLandmarks ||
      !result.faceLandmarks.length
    ) {
      if (trackingRoot) {
        trackingRoot.visible = false;
      }

      setStatus(
        "Face not detected."
      );

      return;
    }

    if (trackingRoot) {
      trackingRoot.visible = true;
    }

    const landmarks =
      result.faceLandmarks[0];

    updateModelFromFace(
      landmarks,
      result
    );
  } catch (error) {
    console.error(
      "Tracking frame error:",
      error
    );
  } finally {
    trackingBusy = false;
  }
}

function updateModelFromFace(
  landmarks,
  result
) {
  if (
    !trackingRoot ||
    !landmarks ||
    !landmarks.length
  ) {
    return;
  }

  const leftEye =
    landmarks[33];

  const rightEye =
    landmarks[263];

  const forehead =
    landmarks[10];

  const chin =
    landmarks[152];

  const nose =
    landmarks[1];

  if (
    !leftEye ||
    !rightEye ||
    !forehead ||
    !chin ||
    !nose
  ) {
    return;
  }

  const eyeCenterX =
    (leftEye.x +
      rightEye.x) * 0.5;

  const eyeCenterY =
    (leftEye.y +
      rightEye.y) * 0.5;

  const eyeDistance =
    Math.hypot(
      rightEye.x - leftEye.x,
      rightEye.y - leftEye.y
    );

  if (
    !Number.isFinite(eyeDistance) ||
    eyeDistance < 0.005
  ) {
    return;
  }

  const faceCenterX =
    nose.x;

  const faceCenterY =
    (forehead.y * 0.65) +
    (chin.y * 0.35);

  const horizontal =
    THREE.MathUtils.clamp(
      (faceCenterX - 0.5) * 4.2,
      -2.2,
      2.2
    );

  const vertical =
    THREE.MathUtils.clamp(
      -(faceCenterY - 0.5) * 3.4,
      -2.0,
      2.0
    );

  trackingRoot.position.x =
    horizontal;

  trackingRoot.position.y =
    vertical;

  const depth =
    THREE.MathUtils.clamp(
      -(eyeDistance * 7.0),
      -1.7,
      -0.35
    );

  trackingRoot.position.z =
    depth;

  const trackingScale =
    THREE.MathUtils.clamp(
      eyeDistance * 6.0,
      0.35,
      2.2
    );

  trackingRoot.scale.setScalar(
    trackingScale
  );

  const matrixList =
    result?.facialTransformationMatrixes;

  const matrixData =
    matrixList?.[0]?.data;

  if (
    matrixData &&
    matrixData.length >= 16
  ) {
    applyFaceTransformationMatrix(
      matrixData
    );
  } else {
    applyLandmarkRotation(
      leftEye,
      rightEye,
      eyeCenterX,
      eyeCenterY
    );
  }
}

function applyFaceTransformationMatrix(data) {
  try {
    const matrix =
      new THREE.Matrix4();

    matrix.fromArray(data);

    const position =
      new THREE.Vector3();

    const quaternion =
      new THREE.Quaternion();

    const scale =
      new THREE.Vector3();

    matrix.decompose(
      position,
      quaternion,
      scale
    );

    const euler =
      new THREE.Euler();

    euler.setFromQuaternion(
      quaternion,
      "YXZ"
    );

    let yaw = euler.y;
    let pitch = euler.x;
    let roll = euler.z;

    yaw =
      THREE.MathUtils.clamp(
        yaw,
        -Math.PI,
        Math.PI
      );

    pitch =
      THREE.MathUtils.clamp(
        pitch,
        -Math.PI / 2,
        Math.PI / 2
      );

    roll =
      THREE.MathUtils.clamp(
        roll,
        -Math.PI,
        Math.PI
      );

    trackingRoot.rotation.set(
      -pitch,
      -yaw,
      -roll
    );
  } catch (error) {
    console.warn(
      "Face matrix transform failed:",
      error
    );
  }
}

function applyLandmarkRotation(
  leftEye,
  rightEye,
  eyeCenterX,
  eyeCenterY
) {
  const headTilt =
    Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );

  const eyeWidth =
    rightEye.x - leftEye.x;

  const headTurn =
    THREE.MathUtils.clamp(
      (eyeWidth - 0.17) * 8,
      -1,
      1
    );

  const pitch =
    THREE.MathUtils.clamp(
      (eyeCenterY - 0.42) * 3,
      -0.8,
      0.8
    );

  trackingRoot.rotation.z =
    -headTilt;

  trackingRoot.rotation.y =
    -headTurn * 0.8;

  trackingRoot.rotation.x =
    pitch;
}

function setTrackingModelVisibility(
  visible
) {
  if (trackingRoot) {
    trackingRoot.visible = visible;
  }
}function bindEvents() {
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

function cleanupApp() {
  if (animationFrameId) {
    cancelAnimationFrame(
      animationFrameId
    );

    animationFrameId = null;
  }

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

  if (recordingCanvasStream) {
    recordingCanvasStream
      .getTracks()
      .forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn(
            "Recording cleanup error:",
            error
          );
        }
      });

    recordingCanvasStream = null;
  }

  stopFaceTracking();
  stopCamera();

  if (microphoneStream) {
    microphoneStream
      .getTracks()
      .forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn(
            "Microphone cleanup error:",
            error
          );
        }
      });

    microphoneStream = null;
  }

  mediaRecorder = null;
  recordedChunks = [];
}

window.addEventListener(
  "beforeunload",
  cleanupApp
);

function initializeApp() {
  try {
    checkRequiredElements();

    prepareVideoElement();

    initThree();

    bindEvents();

    if (el.sideControls) {
      el.sideControls.dataset.open =
        "true";

      el.sideControls.style.display =
        "flex";
    }

    if (el.trackingButton) {
      setButtonLabel(
        el.trackingButton,
        "Face Tracking"
      );
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
