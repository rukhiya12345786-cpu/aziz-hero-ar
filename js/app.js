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
let recordedChunks = [];

let trackingRoot = null;
let currentModel = null;
let cube = null;

let animationFrameId = null;

let facingMode = "user";
let mirrorEnabled = false;

let isRecording = false;
let audioEnabled = false;

let faceLandmarker = null;
let trackingEnabled = false;
let trackingBusy = false;
let lastTrackingTime = 0;

let controlsHidden = false;
let showControlsButton = null;
let flipCameraButton = null;

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
  }, 1500);
}

window.addEventListener("error", (event) => {
  showError(
    event.message || "Unknown JavaScript error",
    "JavaScript error"
  );
});

window.addEventListener("unhandledrejection", (event) => {
  showError(
    event.reason || "Unknown async error",
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
  el.video.autoplay = true;
  el.video.playsInline = true;

  el.video.style.display = "block";
  el.video.style.transformOrigin = "center center";

  applyMirror();
}

function applyMirror() {
  if (!el.video) return;

  const value = mirrorEnabled ? "scaleX(-1)" : "scaleX(1)";

  el.video.style.transform = value;
  el.video.style.webkitTransform = value;
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
  currentModel.name = "MODEL_CONTROLS_ROOT";

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

function resizeRenderer() {
  if (!renderer || !camera3D || !el.canvas) {
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
}

function animate() {
  animationFrameId =
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
    !trackingBusy
  ) {
    const now =
      performance.now();

    if (
      now - lastTrackingTime >
      33
    ) {
      lastTrackingTime = now;
      updateFaceTracking(now);
    }
  }
}

function clearModelChildren() {
  if (!currentModel) return;

  while (
    currentModel.children.length
  ) {
    const child =
      currentModel.children[0];

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

        materials.forEach(
          (material) => {
            Object.values(
              material
            ).forEach((value) => {
              if (
                value &&
                value.isTexture
              ) {
                value.dispose();
              }
            });

            material.dispose();
          }
        );
      }
    });
  }

  cube = null;
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

  object.position.set(
    0,
    0,
    0
  );

  object.rotation.set(
    0,
    0,
    0
  );

  object.scale.set(
    1,
    1,
    1
  );

  fitModelToView(object);

  setStatus(
    `Model loaded: ${object.name}`
  );
}

function fitModelToView(object) {
  const bounds =
    new THREE.Box3()
      .setFromObject(object);

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
    largestDimension > 0
  ) {
    const fitScale =
      1.5 /
      largestDimension;

    object.scale.setScalar(
      fitScale
    );
  }
}// ==================== PART 2 / 5 ====================

async function startCamera() {
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

    activeCameraStream =
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

    el.video.srcObject =
      activeCameraStream;

    el.video.muted = true;
    el.video.playsInline = true;
    el.video.autoplay = true;

    applyMirror();

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
            "Could not stop camera:",
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

  await startCamera();
}

function toggleMirror() {
  mirrorEnabled =
    !mirrorEnabled;

  applyMirror();

  setButtonLabel(
    flipCameraButton,
    mirrorEnabled
      ? "Unflip Camera"
      : "Flip Camera"
  );

  setStatus(
    mirrorEnabled
      ? "Camera flip enabled."
      : "Camera flip disabled."
  );
}

function takePhoto() {
  try {
    if (
      !el.video ||
      el.video.readyState < 2
    ) {
      setStatus(
        "Start the camera first.",
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

    const photoCanvas =
      document.createElement(
        "canvas"
      );

    photoCanvas.width =
      width;

    photoCanvas.height =
      height;

    const ctx =
      photoCanvas.getContext(
        "2d"
      );

    if (!ctx) {
      throw new Error(
        "Could not create photo canvas."
      );
    }

    if (mirrorEnabled) {
      ctx.translate(
        width,
        0
      );

      ctx.scale(
        -1,
        1
      );
    }

    ctx.drawImage(
      el.video,
      0,
      0,
      width,
      height
    );

    if (mirrorEnabled) {
      ctx.setTransform(
        1,
        0,
        0,
        1,
        0,
        0
      );
    }

    if (el.canvas) {
      ctx.drawImage(
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
    if (!window.MediaRecorder) {
      throw new Error(
        "Video recording is not supported."
      );
    }

    if (!activeCameraStream) {
      setStatus(
        "Start the camera first.",
        true
      );
      return;
    }

    if (isRecording) {
      return;
    }

    recordedChunks = [];

    const tracks =
      activeCameraStream
        .getVideoTracks();

    if (!tracks.length) {
      throw new Error(
        "No camera video track."
      );
    }

    const recordingStream =
      new MediaStream(
        tracks
      );

    const mimeType =
      getSupportedRecorderMimeType();

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
      "Recording..."
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
    mediaRecorder.state ===
      "inactive"
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
    if (
      !recordedChunks.length
    ) {
      setStatus(
        "No recorded video data.",
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
}

async function toggleAudio() {
  try {
    if (!activeCameraStream) {
      setStatus(
        "Start the camera first.",
        true
      );
      return;
    }

    microphoneStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false
        });

    const audioTrack =
      microphoneStream
        .getAudioTracks()[0];

    if (!audioTrack) {
      throw new Error(
        "Microphone track was not created."
      );
    }

    activeCameraStream.addTrack(
      audioTrack
    );

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
}// ==================== PART 3 / 5 ====================

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
      "Could not read model.",
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

    reader.readAsArrayBuffer(
      file
    );
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

        addModelToScene(
          object
        );
      } catch (error) {
        showError(
          error,
          "OBJ error"
        );
      }
    };

    reader.readAsText(
      file
    );
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

        addModelToScene(
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
      "Use GLB, GLTF, OBJ, or STL.",
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
        const blob =
          result instanceof ArrayBuffer
            ? new Blob(
                [result],
                {
                  type:
                    "model/gltf-binary"
                }
              )
            : new Blob(
                [
                  JSON.stringify(
                    result
                  )
                ],
                {
                  type:
                    "application/json"
                }
              );

        const filename =
          result instanceof ArrayBuffer
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
          type:
            "text/plain"
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
      ?.toLowerCase() ||
    "glb";

  if (format === "obj") {
    exportModelOBJ();
  } else {
    exportModelGLTF();
  }
}

function resetModel() {
  if (!currentModel) {
    return;
  }

  clearModelChildren();

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
    "Model reset."
  );
}

function applyModelControls() {
  if (!currentModel) {
    return;
  }

  const scale =
    Number(
      el.scaleSlider?.value ??
      1
    );

  const x =
    Number(
      el.xSlider?.value ??
      0
    );

  const y =
    Number(
      el.ySlider?.value ??
      0
    );

  const z =
    Number(
      el.zSlider?.value ??
      0
    );

  const rx =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateXSlider?.value ??
        0
      )
    );

  const ry =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateYSlider?.value ??
        0
      )
    );

  const rz =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateZSlider?.value ??
        0
      )
    );

  currentModel.scale.setScalar(
    Number.isFinite(scale)
      ? scale
      : 1
  );

  currentModel.position.set(
    Number.isFinite(x)
      ? x
      : 0,
    Number.isFinite(y)
      ? y
      : 0,
    Number.isFinite(z)
      ? z
      : 0
  );

  currentModel.rotation.set(
    rx,
    ry,
    rz
  );
}

function createExtraButtons() {
  if (!document.body) {
    return;
  }

  if (!flipCameraButton) {
    flipCameraButton =
      document.createElement(
        "button"
      );

    flipCameraButton.id =
      "runtimeFlipCameraButton";

    flipCameraButton.type =
      "button";

    flipCameraButton.textContent =
      "Flip Camera";

    flipCameraButton.style.position =
      "fixed";

    flipCameraButton.style.bottom =
      "20px";

    flipCameraButton.style.left =
      "20px";

    flipCameraButton.style.zIndex =
      "99999";

    flipCameraButton.style.padding =
      "10px 14px";

    flipCameraButton.style.border =
      "0";

    flipCameraButton.style.borderRadius =
      "12px";

    flipCameraButton.style.background =
      "rgba(0,0,0,0.75)";

    flipCameraButton.style.color =
      "#fff";

    flipCameraButton.style.fontSize =
      "14px";

    flipCameraButton.style.fontWeight =
      "600";

    flipCameraButton.addEventListener(
      "click",
      toggleMirror
    );

    document.body.appendChild(
      flipCameraButton
    );
  }

  if (!showControlsButton) {
    showControlsButton =
      document.createElement(
        "button"
      );

    showControlsButton.id =
      "runtimeShowControlsButton";

    showControlsButton.type =
      "button";

    showControlsButton.textContent =
      "Show Controls";

    showControlsButton.style.position =
      "fixed";

    showControlsButton.style.top =
      "20px";

    showControlsButton.style.right =
      "20px";

    showControlsButton.style.zIndex =
      "100000";

    showControlsButton.style.display =
      "none";

    showControlsButton.style.padding =
      "10px 14px";

    showControlsButton.style.border =
      "0";

    showControlsButton.style.borderRadius =
      "12px";

    showControlsButton.style.background =
      "rgba(0,0,0,0.75)";

    showControlsButton.style.color =
      "#fff";

    showControlsButton.style.fontSize =
      "14px";

    showControlsButton.style.fontWeight =
      "600";

    showControlsButton.addEventListener(
      "click",
      showAllControls
    );

    document.body.appendChild(
      showControlsButton
    );
  }
}

function hideAllControls() {
  controlsHidden = true;

  if (el.sideControls) {
    el.sideControls.style.setProperty(
      "display",
      "none",
      "important"
    );

    el.sideControls.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  const controlIds = [
    "cameraButton",
    "switchCameraButton",
    "photoButton",
    "recordButton",
    "audioButton",
    "import3DButton",
    "export3DButton",
    "resetButton",
    "modelButton",
    "trackingButton"
  ];

  controlIds.forEach(
    (id) => {
      const node =
        document.getElementById(
          id
        );

      if (node) {
        node.dataset.arHidden =
          "true";

        node.style.setProperty(
          "display",
          "none",
          "important"
        );
      }
    }
  );

  if (flipCameraButton) {
    flipCameraButton.style.display =
      "none";
  }

  if (showControlsButton) {
    showControlsButton.style.display =
      "block";
  }

  if (el.canvas) {
    el.canvas.style.pointerEvents =
      "none";
  }

  setStatus(
    "Controls hidden. Face tracking only."
  );
}

function showAllControls() {
  controlsHidden = false;

  if (el.sideControls) {
    el.sideControls.style.removeProperty(
      "display"
    );

    el.sideControls.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  const controlIds = [
    "cameraButton",
    "switchCameraButton",
    "photoButton",
    "recordButton",
    "audioButton",
    "import3DButton",
    "export3DButton",
    "resetButton",
    "modelButton",
    "trackingButton"
  ];

  controlIds.forEach(
    (id) => {
      const node =
        document.getElementById(
          id
        );

      if (
        node &&
        node.dataset.arHidden ===
          "true"
      ) {
        node.style.removeProperty(
          "display"
        );

        delete node.dataset.arHidden;
      }
    }
  );

  if (flipCameraButton) {
    flipCameraButton.style.display =
      "block";
  }

  if (showControlsButton) {
    showControlsButton.style.display =
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
      }// ==================== PART 4 / 5 ====================

async function startFaceTracking() {
  if (trackingBusy) {
    return;
  }

  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Start the camera before tracking.",
      true
    );
    return;
  }

  trackingBusy = true;

  try {
    setStatus(
      "Loading face tracking..."
    );

    const visionModule =
      await import(
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
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },

          runningMode: "VIDEO",

          numFaces: 1,

          minFaceDetectionConfidence:
            0.45,

          minFacePresenceConfidence:
            0.45,

          minTrackingConfidence:
            0.45,

          outputFaceBlendshapes:
            false,

          outputFacialTransformationMatrixes:
            true
        }
      );

    trackingEnabled = true;

    if (el.trackingButton) {
      setButtonLabel(
        el.trackingButton,
        "Tracking On"
      );
    }

    setStatus(
      "Face tracking is ready."
    );
  } catch (error) {
    faceLandmarker = null;
    trackingEnabled = false;

    if (el.trackingButton) {
      setButtonLabel(
        el.trackingButton,
        "Face Tracking"
      );
    }

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
  }

  if (el.trackingButton) {
    setButtonLabel(
      el.trackingButton,
      "Face Tracking"
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

async function updateFaceTracking(
  timestamp
) {
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
      setStatus(
        "Face not detected."
      );
      return;
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
    !currentModel ||
    !landmarks ||
    landmarks.length < 468
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

  const leftCheek =
    landmarks[234];

  const rightCheek =
    landmarks[454];

  if (
    !leftEye ||
    !rightEye ||
    !nose ||
    !forehead ||
    !chin ||
    !leftCheek ||
    !rightCheek
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
      leftCheek.x +
      rightCheek.x
    ) * 0.5;

  const faceCenterY =
    (
      forehead.y +
      chin.y
    ) * 0.5;

  /*
   * IMPORTANT:
   * The tracking root controls the head.
   * The model controls remain inside it.
   *
   * This prevents the imported model
   * from behaving like a screen sticker.
   */

  const x =
    (0.5 - faceCenterX) *
    3.15;

  const y =
    (0.48 - faceCenterY) *
    2.75;

  const faceScale =
    THREE.MathUtils.clamp(
      eyeDistance * 6.0,
      0.55,
      2.25
    );

  const z =
    THREE.MathUtils.clamp(
      -0.75 -
        eyeDistance * 1.5,
      -2.0,
      0.25
    );

  /*
   * Roll:
   * Keep the model aligned with
   * the eyes.
   */
  const roll =
    Math.atan2(
      rightEye.y -
        leftEye.y,
      rightEye.x -
        leftEye.x
    );

  /*
   * Yaw:
   * Use both nose offset and
   * cheek depth difference.
   *
   * The sign is intentionally
   * corrected so the model follows
   * the same left/right direction.
   */
  const noseOffset =
    nose.x -
    eyeCenterX;

  const cheekDepth =
    (
      rightCheek.z -
      leftCheek.z
    );

  let yaw =
    noseOffset * 7.0 +
    cheekDepth * 2.5;

  yaw =
    THREE.MathUtils.clamp(
      yaw,
      -1.55,
      1.55
    );

  /*
   * Pitch:
   * Compare nose/eyes with
   * forehead/chin.
   */
  const faceHeight =
    Math.max(
      0.001,
      chin.y -
        forehead.y
    );

  const noseVertical =
    (
      nose.y -
      forehead.y
    ) /
    faceHeight;

  let pitch =
    (
      noseVertical -
      0.50
    ) * 2.4;

  pitch =
    THREE.MathUtils.clamp(
      pitch,
      -0.95,
      0.95
    );

  /*
   * Smooth tracking so the
   * character stays attached
   * instead of jumping.
   */
  const positionSmooth =
    0.28;

  const rotationSmooth =
    0.32;

  const scaleSmooth =
    0.24;

  trackingRoot.position.x =
    THREE.MathUtils.lerp(
      trackingRoot.position.x,
      x,
      positionSmooth
    );

  trackingRoot.position.y =
    THREE.MathUtils.lerp(
      trackingRoot.position.y,
      y,
      positionSmooth
    );

  trackingRoot.position.z =
    THREE.MathUtils.lerp(
      trackingRoot.position.z,
      z,
      positionSmooth
    );

  trackingRoot.rotation.x =
    THREE.MathUtils.lerp(
      trackingRoot.rotation.x,
      pitch,
      rotationSmooth
    );

  trackingRoot.rotation.y =
    THREE.MathUtils.lerp(
      trackingRoot.rotation.y,
      yaw,
      rotationSmooth
    );

  trackingRoot.rotation.z =
    THREE.MathUtils.lerp(
      trackingRoot.rotation.z,
      -roll,
      rotationSmooth
    );

  const targetScale =
    faceScale;

  trackingRoot.scale.x =
    THREE.MathUtils.lerp(
      trackingRoot.scale.x,
      targetScale,
      scaleSmooth
    );

  trackingRoot.scale.y =
    THREE.MathUtils.lerp(
      trackingRoot.scale.y,
      targetScale,
      scaleSmooth
    );

  trackingRoot.scale.z =
    THREE.MathUtils.lerp(
      trackingRoot.scale.z,
      targetScale,
      scaleSmooth
    );

  /*
   * Keep the model centered
   * around the head instead of
   * letting its imported origin
   * push it in front of the face.
   */
  currentModel.position.x =
    Number(
      el.xSlider?.value || 0
    );

  currentModel.position.y =
    Number(
      el.ySlider?.value || 0
    );

  currentModel.position.z =
    Number(
      el.zSlider?.value || 0
    );
}

function bindSlider(
  slider
) {
  if (!slider) {
    return;
  }

  slider.addEventListener(
    "input",
    applyModelControls
  );

  slider.addEventListener(
    "change",
    applyModelControls
  );
}

function bindEvents() {
  requireElement(
    el.cameraButton,
    "cameraButton"
  );

  el.cameraButton.addEventListener(
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

  createExtraButtons();
}

function cleanup() {
  if (animationFrameId) {
    cancelAnimationFrame(
      animationFrameId
    );

    animationFrameId = null;
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
          console.warn(error);
        }
      });

    microphoneStream = null;
  }

  if (mediaRecorder) {
    try {
      if (
        mediaRecorder.state !==
        "inactive"
      ) {
        mediaRecorder.stop();
      }
    } catch (error) {
      console.warn(error);
    }
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);// ==================== PART 5 / 5 ====================

function initialize() {
  try {
    checkRequiredElements();

    prepareVideoElement();

    initThree();

    bindEvents();

    applyModelControls();

    setStatus(
      "Ready. Open camera, then enable Face Tracking."
    );
  } catch (error) {
    showError(
      error,
      "Initialization error"
    );
  }
}

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
