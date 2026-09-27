import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

const el = {
  app: document.getElementById("app"),
  camera: document.getElementById("camera"),
  canvas: document.getElementById("threeCanvas"),
  status: document.getElementById("status"),

  cameraButton: document.getElementById("cameraButton"),
  switchCameraButton: document.getElementById("switchCameraButton"),
  flipCameraButton: document.getElementById("flipCameraButton"),
  photoButton: document.getElementById("photoButton"),
  recordButton: document.getElementById("recordButton"),
  audioButton: document.getElementById("audioButton"),
  trackingButton: document.getElementById("trackingButton"),
  modelButton: document.getElementById("modelButton"),
  import3DButton: document.getElementById("import3DButton"),
  export3DButton: document.getElementById("export3DButton"),
  exportFormat: document.getElementById("exportFormat"),
  resetButton: document.getElementById("resetButton"),
  hideControlsButton: document.getElementById("hideControlsButton"),
  showControlsButton: document.getElementById("showControlsButton"),

  sideControls: document.getElementById("sideControls"),
  import3DInput: document.getElementById("import3DInput"),

  scaleSlider: document.getElementById("scaleSlider"),
  xSlider: document.getElementById("xSlider"),
  ySlider: document.getElementById("ySlider"),
  zSlider: document.getElementById("zSlider"),
  rotateXSlider: document.getElementById("rotateXSlider"),
  rotateYSlider: document.getElementById("rotateYSlider"),
  rotateZSlider: document.getElementById("rotateZSlider")
};

let scene;
let threeCamera;
let renderer;

let modelRoot;
let currentModel = null;

let activeCameraStream = null;
let facingMode = "user";

let audioEnabled = false;

let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

let faceMesh = null;
let trackingEnabled = false;
let trackingBusy = false;
let trackingTimer = null;

let controlsHidden = false;

const manual = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rx: 0,
  ry: 0,
  rz: 0
};

const tracking = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rx: 0,
  ry: 0,
  rz: 0
};

const targetTracking = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rx: 0,
  ry: 0,
  rz: 0
};

function setStatus(message, error = false) {
  if (!el.status) return;

  el.status.textContent = message;
  el.status.style.background = error
    ? "rgba(150,0,0,0.82)"
    : "rgba(0,0,0,0.70)";
}

function setButtonLabel(button, label) {
  if (button) {
    button.textContent = label;
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
  }, 1000);
}

function showError(error, prefix) {
  console.error(prefix, error);

  const message =
    error && error.message
      ? error.message
      : String(error);

  setStatus(`${prefix}: ${message}`, true);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smooth(current, target, amount) {
  return current + (target - current) * amount;
}

function prepareVideo() {
  if (!el.camera) return;

  el.camera.autoplay = true;
  el.camera.playsInline = true;
  el.camera.muted = true;

  el.camera.style.transform = "none";
  el.camera.style.webkitTransform = "none";
}

function validateElements() {
  const required = [
    "camera",
    "threeCanvas",
    "cameraButton",
    "switchCameraButton",
    "photoButton",
    "recordButton",
    "trackingButton",
    "import3DButton",
    "export3DButton",
    "resetButton",
    "sideControls"
  ];

  const missing = required.filter((id) => !el[id]);

  if (missing.length) {
    setStatus(
      `Missing HTML elements: ${missing.join(", ")}`,
      true
    );

    return false;
  }

  return true;
}

function readManualControls() {
  manual.scale = Number(el.scaleSlider?.value ?? 1);
  manual.x = Number(el.xSlider?.value ?? 0);
  manual.y = Number(el.ySlider?.value ?? 0);
  manual.z = Number(el.zSlider?.value ?? 0);

  manual.rx = THREE.MathUtils.degToRad(
    Number(el.rotateXSlider?.value ?? 0)
  );

  manual.ry = THREE.MathUtils.degToRad(
    Number(el.rotateYSlider?.value ?? 0)
  );

  manual.rz = THREE.MathUtils.degToRad(
    Number(el.rotateZSlider?.value ?? 0)
  );
}

function resetTrackingValues() {
  tracking.x = 0;
  tracking.y = 0;
  tracking.z = 0;
  tracking.scale = 1;
  tracking.rx = 0;
  tracking.ry = 0;
  tracking.rz = 0;

  targetTracking.x = 0;
  targetTracking.y = 0;
  targetTracking.z = 0;
  targetTracking.scale = 1;
  targetTracking.rx = 0;
  targetTracking.ry = 0;
  targetTracking.rz = 0;
}

prepareVideo();

if (!validateElements()) {
  throw new Error("Required HTML elements are missing.");
}function initThree() {
  scene = new THREE.Scene();

  threeCamera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  );

  threeCamera.position.set(0, 0, 8);

  renderer = new THREE.WebGLRenderer({
    canvas: el.canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight,
    false
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.8
  );

  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  keyLight.position.set(3, 5, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(
    0xffffff,
    1.2
  );

  fillLight.position.set(-4, 2, 4);
  scene.add(fillLight);

  modelRoot = new THREE.Group();
  modelRoot.name = "ARModelRoot";

  scene.add(modelRoot);

  createDemoCube();

  window.addEventListener("resize", resizeThree);

  setStatus("3D engine ready.");
}

function resizeThree() {
  if (!renderer || !threeCamera) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
}

function disposeObject(object) {
  if (!object) return;

  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (!material) return;

        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) {
          material.roughnessMap.dispose();
        }
        if (material.metalnessMap) {
          material.metalnessMap.dispose();
        }
        if (material.emissiveMap) {
          material.emissiveMap.dispose();
        }

        material.dispose();
      });
    }
  });
}

function clearModelChildren() {
  if (!modelRoot) return;

  while (modelRoot.children.length > 0) {
    const child = modelRoot.children[0];

    modelRoot.remove(child);
    disposeObject(child);
  }

  currentModel = null;
}

function createDemoCube() {
  clearModelChildren();

  const geometry = new THREE.BoxGeometry(
    1.2,
    1.2,
    1.2
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    metalness: 0.25,
    roughness: 0.5
  });

  const cube = new THREE.Mesh(
    geometry,
    material
  );

  cube.name = "DemoCube";

  modelRoot.add(cube);

  currentModel = cube;

  resetTrackingValues();
  readManualControls();
  applyFinalTransform();
}

function applyFinalTransform() {
  if (!modelRoot) return;

  const finalX =
    manual.x + tracking.x;

  const finalY =
    manual.y + tracking.y;

  const finalZ =
    manual.z + tracking.z;

  const finalScale =
    manual.scale * tracking.scale;

  const finalRX =
    manual.rx + tracking.rx;

  const finalRY =
    manual.ry + tracking.ry;

  const finalRZ =
    manual.rz + tracking.rz;

  modelRoot.position.set(
    finalX,
    finalY,
    finalZ
  );

  modelRoot.rotation.set(
    finalRX,
    finalRY,
    finalRZ
  );

  const safeScale = clamp(
    finalScale,
    0.02,
    20
  );

  modelRoot.scale.setScalar(
    Number.isFinite(safeScale)
      ? safeScale
      : 1
  );
}

function updateTrackingSmoothly() {
  tracking.x = smooth(
    tracking.x,
    targetTracking.x,
    0.16
  );

  tracking.y = smooth(
    tracking.y,
    targetTracking.y,
    0.16
  );

  tracking.z = smooth(
    tracking.z,
    targetTracking.z,
    0.16
  );

  tracking.scale = smooth(
    tracking.scale,
    targetTracking.scale,
    0.10
  );

  tracking.rx = smooth(
    tracking.rx,
    targetTracking.rx,
    0.14
  );

  tracking.ry = smooth(
    tracking.ry,
    targetTracking.ry,
    0.14
  );

  tracking.rz = smooth(
    tracking.rz,
    targetTracking.rz,
    0.14
  );
}

function animate() {
  requestAnimationFrame(animate);

  updateTrackingSmoothly();

  applyFinalTransform();

  if (
    currentModel &&
    currentModel.name === "DemoCube" &&
    !trackingEnabled
  ) {
    currentModel.rotation.y += 0.008;
    currentModel.rotation.x += 0.003;
  }

  if (renderer && scene && threeCamera) {
    renderer.render(
      scene,
      threeCamera
    );
  }
}

function bindSliderEvents() {
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
    if (!slider) return;

    slider.addEventListener(
      "input",
      () => {
        readManualControls();
        applyFinalTransform();
      }
    );

    slider.addEventListener(
      "change",
      () => {
        readManualControls();
        applyFinalTransform();
      }
    );
  });
}

function initializeControlValues() {
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

initThree();

initializeControlValues();

readManualControls();

bindSliderEvents();

animate();async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported.");
    }

    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => {
        track.stop();
      });

      activeCameraStream = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
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

    activeCameraStream = stream;
    el.camera.srcObject = stream;

    el.camera.style.transform = "none";
    el.camera.style.webkitTransform = "none";

    await el.camera.play();

    setStatus(
      facingMode === "user"
        ? "Front camera ready."
        : "Back camera ready."
    );

    if (trackingEnabled) {
      startTrackingLoop();
    }
  } catch (error) {
    showError(error, "Camera error");
  }
}

async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  await startCamera();
}

function flipCameraView() {
  if (!el.camera) return;

  const current =
    el.camera.style.transform;

  if (
    current === "scaleX(-1)" ||
    current === "matrix(-1, 0, 0, 1, 0, 0)"
  ) {
    el.camera.style.transform = "none";
    el.canvas.style.transform = "none";

    setStatus("Camera view normal.");
  } else {
    el.camera.style.transform = "scaleX(-1)";
    el.canvas.style.transform = "scaleX(-1)";

    setStatus("Camera view flipped.");
  }
}

function capturePhoto() {
  try {
    if (!el.camera.videoWidth || !el.camera.videoHeight) {
      setStatus(
        "Start the camera before taking a photo.",
        true
      );
      return;
    }

    const photoCanvas =
      document.createElement("canvas");

    photoCanvas.width =
      el.camera.videoWidth;

    photoCanvas.height =
      el.camera.videoHeight;

    const context =
      photoCanvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Could not create photo canvas."
      );
    }

    const scaleX =
      photoCanvas.width /
      window.innerWidth;

    const scaleY =
      photoCanvas.height /
      window.innerHeight;

    context.drawImage(
      el.camera,
      0,
      0,
      photoCanvas.width,
      photoCanvas.height
    );

    if (renderer && el.canvas) {
      context.save();

      context.globalAlpha = 1;

      context.drawImage(
        el.canvas,
        0,
        0,
        el.canvas.width,
        el.canvas.height,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
      );

      context.restore();
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

  if (!window.MediaRecorder) {
    return "";
  }

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

function createRecordingStream() {
  if (!renderer || !el.camera) {
    throw new Error(
      "Recording canvas is not ready."
    );
  }

  const recordingCanvas =
    document.createElement("canvas");

  const width =
    el.camera.videoWidth ||
    window.innerWidth;

  const height =
    el.camera.videoHeight ||
    window.innerHeight;

  recordingCanvas.width = width;
  recordingCanvas.height = height;

  const context =
    recordingCanvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not create recording canvas."
    );
  }

  const drawFrame = () => {
    if (!isRecording) return;

    context.clearRect(
      0,
      0,
      width,
      height
    );

    context.drawImage(
      el.camera,
      0,
      0,
      width,
      height
    );

    context.drawImage(
      el.canvas,
      0,
      0,
      el.canvas.width,
      el.canvas.height,
      0,
      0,
      width,
      height
    );

    requestAnimationFrame(drawFrame);
  };

  const canvasStream =
    recordingCanvas.captureStream(30);

  const cameraTracks =
    activeCameraStream
      ? activeCameraStream.getVideoTracks()
      : [];

  if (!cameraTracks.length) {
    throw new Error(
      "No camera video track is available."
    );
  }

  const outputStream =
    new MediaStream();

  canvasStream
    .getVideoTracks()
    .forEach((track) => {
      outputStream.addTrack(track);
    });

  if (audioEnabled && activeCameraStream) {
    activeCameraStream
      .getAudioTracks()
      .forEach((track) => {
        outputStream.addTrack(track);
      });
  }

  drawFrame();

  return outputStream;
}

function startRecording() {
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

    recordedChunks = [];

    const recordingStream =
      createRecordingStream();

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
      (event) => {
        console.error(
          "Recorder error:",
          event
        );

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

    setStatus("Recording...");
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

  mediaRecorder.stop();

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
    mediaRecorder = null;

    setStatus(
      "Recording saved."
    );
  } catch (error) {
    showError(
      error,
      "Save recording error"
    );
  }
        }async function toggleAudio() {
  try {
    if (!activeCameraStream) {
      setStatus(
        "Start the camera before enabling audio.",
        true
      );
      return;
    }

    if (audioEnabled) {
      activeCameraStream
        .getAudioTracks()
        .forEach((track) => {
          track.stop();
        });

      audioEnabled = false;

      setButtonLabel(
        el.audioButton,
        "Audio Off"
      );

      setStatus("Audio disabled.");
      return;
    }

    const audioStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    audioStream
      .getAudioTracks()
      .forEach((track) => {
        activeCameraStream.addTrack(track);
      });

    audioEnabled = true;

    setButtonLabel(
      el.audioButton,
      "Audio On"
    );

    setStatus("Audio enabled.");
  } catch (error) {
    showError(
      error,
      "Audio error"
    );
  }
}

function fitImportedModel(object) {
  const box =
    new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    return;
  }

  const center =
    box.getCenter(new THREE.Vector3());

  const size =
    box.getSize(new THREE.Vector3());

  object.position.sub(center);

  const maxSize =
    Math.max(
      size.x,
      size.y,
      size.z
    );

  if (
    Number.isFinite(maxSize) &&
    maxSize > 0
  ) {
    const fitScale =
      2 / maxSize;

    object.scale.setScalar(
      fitScale
    );
  }

  object.position.y = 0;
}

function addModelToScene(object) {
  if (!object) {
    setStatus(
      "Invalid 3D model.",
      true
    );
    return;
  }

  clearModelChildren();

  fitImportedModel(object);

  object.name = "ImportedModel";

  modelRoot.add(object);

  currentModel = object;

  resetTrackingValues();
  readManualControls();
  applyFinalTransform();

  setStatus(
    "3D model loaded."
  );
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

        const blob = isBinary
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

        const filename =
          isBinary
            ? "aziz-ar-model.glb"
            : "aziz-ar-model.gltf";

        downloadBlob(
          blob,
          filename
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

  resetTrackingValues();
  readManualControls();
  applyFinalTransform();

  setStatus(
    "Model reset."
  );
}

function toggleControls() {
  controlsHidden =
    !controlsHidden;

  if (controlsHidden) {
    el.sideControls.classList.add(
      "hiddenControls"
    );

    el.showControlsButton.style.display =
      "block";

    setButtonLabel(
      el.hideControlsButton,
      "Show Controls"
    );
  } else {
    el.sideControls.classList.remove(
      "hiddenControls"
    );

    el.showControlsButton.style.display =
      "none";

    setButtonLabel(
      el.hideControlsButton,
      "Hide Controls"
    );
  }
}

function showControls() {
  controlsHidden = false;

  el.sideControls.classList.remove(
    "hiddenControls"
  );

  el.showControlsButton.style.display =
    "none";

  setButtonLabel(
    el.hideControlsButton,
    "Hide Controls"
  );
}function initializeFaceMesh() {
  if (!window.FaceMesh) {
    setStatus(
      "Face Mesh library not loaded.",
      true
    );
    return false;
  }

  try {
    faceMesh = new window.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    faceMesh.onResults(handleFaceResults);

    setStatus(
      "Face tracking ready."
    );

    return true;
  } catch (error) {
    showError(
      error,
      "Face Mesh error"
    );

    return false;
  }
}

function landmarkDistance(a, b) {
  if (!a || !b) return 0;

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);

  return Math.sqrt(
    dx * dx +
    dy * dy +
    dz * dz
  );
}

function handleFaceResults(results) {
  if (
    !results ||
    !results.multiFaceLandmarks ||
    !results.multiFaceLandmarks.length
  ) {
    return;
  }

  const landmarks =
    results.multiFaceLandmarks[0];

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

  const centerX =
    (leftEye.x + rightEye.x) * 0.5;

  const centerY =
    (forehead.y + chin.y) * 0.5;

  const eyeDistance =
    landmarkDistance(
      leftEye,
      rightEye
    );

  if (
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY) ||
    !Number.isFinite(eyeDistance) ||
    eyeDistance <= 0
  ) {
    return;
  }

  const normalizedX =
    (centerX - 0.5);

  const normalizedY =
    (centerY - 0.5);

  const noseOffsetX =
    nose.x - centerX;

  const noseOffsetY =
    nose.y - centerY;

  targetTracking.x =
    clamp(
      -normalizedX * 3.0,
      -2.5,
      2.5
    );

  targetTracking.y =
    clamp(
      -normalizedY * 2.4,
      -2.0,
      2.0
    );

  targetTracking.z =
    clamp(
      (0.18 - eyeDistance) * 7.0,
      -1.5,
      1.5
    );

  const size =
    clamp(
      eyeDistance / 0.16,
      0.70,
      1.30
    );

  targetTracking.scale =
    size;

  const yaw =
    clamp(
      noseOffsetX * 7.0,
      -0.65,
      0.65
    );

  const pitch =
    clamp(
      noseOffsetY * 5.0,
      -0.50,
      0.50
    );

  const roll =
    Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );

  targetTracking.ry =
    yaw;

  targetTracking.rx =
    pitch;

  targetTracking.rz =
    clamp(
      roll,
      -0.65,
      0.65
    );
}

async function sendFaceFrame() {
  if (
    !trackingEnabled ||
    !faceMesh ||
    !el.camera ||
    !el.camera.videoWidth ||
    !el.camera.videoHeight
  ) {
    return;
  }

  if (trackingBusy) {
    return;
  }

  trackingBusy = true;

  try {
    await faceMesh.send({
      image: el.camera
    });
  } catch (error) {
    console.error(
      "Face tracking frame error:",
      error
    );
  } finally {
    trackingBusy = false;
  }
}

function startTrackingLoop() {
  if (trackingTimer) {
    clearInterval(
      trackingTimer
    );
  }

  trackingTimer =
    setInterval(
      sendFaceFrame,
      60
    );
}

function stopTrackingLoop() {
  if (trackingTimer) {
    clearInterval(
      trackingTimer
    );

    trackingTimer = null;
  }

  resetTrackingValues();
}

function toggleTracking() {
  if (!faceMesh) {
    const ready =
      initializeFaceMesh();

    if (!ready) {
      return;
    }
  }

  trackingEnabled =
    !trackingEnabled;

  if (trackingEnabled) {
    startTrackingLoop();

    setButtonLabel(
      el.trackingButton,
      "Tracking On"
    );

    setStatus(
      "Face tracking ON."
    );
  } else {
    stopTrackingLoop();

    setButtonLabel(
      el.trackingButton,
      "Tracking Off"
    );

    setStatus(
      "Face tracking OFF."
    );
  }
}

function bindButtons() {
  const buttons = [
    [el.cameraButton, startCamera],
    [el.switchCameraButton, switchCamera],
    [el.flipCameraButton, flipCameraView],
    [el.photoButton, capturePhoto],
    [el.recordButton, toggleRecording],
    [el.audioButton, toggleAudio],
    [el.trackingButton, toggleTracking],
    [el.import3DButton, () => el.import3DInput?.click()],
    [el.export3DButton, exportModel],
    [el.resetButton, resetModel],
    [el.hideControlsButton, toggleControls],
    [el.showControlsButton, showControls]
  ];

  buttons.forEach(([button, action]) => {
    if (!button) return;

    button.style.pointerEvents = "auto";

    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        action();
      } catch (error) {
        showError(error, "Button error");
      }
    };
  });

  if (el.modelButton) {
    el.modelButton.style.pointerEvents = "auto";

    el.modelButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!el.sideControls) return;

      const hidden =
        el.sideControls.classList.contains("hiddenControls");

      if (hidden) {
        showControls();
      } else {
        el.sideControls.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    };
  }

  if (el.import3DInput) {
    el.import3DInput.onchange = handleModelImport;
  }
}
  
function cleanup() {
  if (trackingTimer) {
    clearInterval(
      trackingTimer
    );

    trackingTimer = null;
  }

  if (activeCameraStream) {
    activeCameraStream
      .getTracks()
      .forEach((track) => {
        track.stop();
      });

    activeCameraStream = null;
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);

bindButtons();

initializeUI();

initializeFaceMesh();

setStatus(
  "Ready. Open Camera to begin."
);
