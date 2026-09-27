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

let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];

let currentModel = null;
let cube = null;

let facingMode = "user";

let isRecording = false;
let audioEnabled = false;

let faceMeshDetector = null;
let trackingEnabled = false;
let trackingBusy = false;

let lastTrackingFrame = 0;

const clock = new THREE.Clock();

const trackingState = {
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

function setStatus(message, isError = false) {
  if (!el.status) return;

  el.status.textContent = String(message);

  el.status.dataset.state = isError
    ? "error"
    : "normal";

  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function showError(error, label = "App error") {
  const message =
    error?.message || String(error);

  setStatus(
    `${label}: ${message}`,
    true
  );
}

function setButtonLabel(button, text) {
  if (button) {
    button.textContent = text;
  }
}

function downloadBlob(blob, filename) {
  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

function numberValue(element, fallback = 0) {
  const value = Number(element?.value);

  return Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function lerp(current, target, amount) {
  return current +
    (target - current) * amount;
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

  const missing = required
    .filter(([, element]) => !element)
    .map(([id]) => id);

  if (missing.length) {
    throw new Error(
      `Missing HTML elements: ${missing.join(", ")}`
    );
  }
}

function prepareVideo() {
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
}

function resetTrackingState() {
  trackingState.x = 0;
  trackingState.y = 0;
  trackingState.z = 0;

  trackingState.rotX = 0;
  trackingState.rotY = 0;
  trackingState.rotZ = 0;

  trackingState.scale = 1;

  trackingState.targetX = 0;
  trackingState.targetY = 0;
  trackingState.targetZ = 0;

  trackingState.targetRotX = 0;
  trackingState.targetRotY = 0;
  trackingState.targetRotZ = 0;

  trackingState.targetScale = 1;
}function initThree() {
  scene = new THREE.Scene();

  camera3D =
    new THREE.PerspectiveCamera(
      45,
      window.innerWidth /
        window.innerHeight,
      0.01,
      100
    );

  camera3D.position.set(
    0,
    0,
    5
  );

  renderer =
    new THREE.WebGLRenderer({
      canvas: el.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      2
    )
  );

  renderer.setClearColor(
    0x000000,
    0
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  const hemi =
    new THREE.HemisphereLight(
      0xffffff,
      0x444466,
      2
    );

  scene.add(hemi);

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
    1,
    3
  );

  scene.add(fillLight);

  currentModel =
    new THREE.Group();

  currentModel.name =
    "AR_MODEL_ROOT";

  scene.add(currentModel);

  createDemoCube();

  resizeRenderer();

  window.addEventListener(
    "resize",
    resizeRenderer
  );

  animate();

  setStatus(
    "3D scene ready."
  );
}

function createDemoCube() {
  if (!currentModel) return;

  clearModelChildren();

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

  cube =
    new THREE.Mesh(
      geometry,
      material
    );

  cube.name =
    "DemoCube";

  currentModel.add(cube);

  resetTrackingState();

  applyModelControls();
}

function resizeRenderer() {
  if (!renderer || !camera3D) {
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
  requestAnimationFrame(
    animate
  );

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

  smoothTracking();

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
    faceMeshDetector &&
    !trackingBusy
  ) {
    const now =
      performance.now();

    if (
      now - lastTrackingFrame >
      33
    ) {
      lastTrackingFrame = now;
      sendFaceFrame();
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

    child.traverse?.(
      (object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          const materials =
            Array.isArray(
              object.material
            )
              ? object.material
              : [object.material];

          materials.forEach(
            (material) => {
              Object.values(
                material
              ).forEach(
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
            }
          );
        }
      }
    );
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

  fitModelToView(object);

  resetTrackingState();

  applyModelControls();

  setStatus(
    `Model loaded: ${object.name}`
  );
}

function fitModelToView(object) {
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
    const fitScale =
      1.5 / largest;

    object.scale.setScalar(
      fitScale
    );
  }
}

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
      "Opening camera..."
    );

    cameraStream =
      await navigator.mediaDevices
        .getUserMedia({
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
      cameraStream;

    el.video.muted = true;
    el.video.playsInline = true;
    el.video.autoplay = true;

    await el.video.play();

    setStatus(
      "Camera running."
    );

    if (
      trackingEnabled &&
      !faceMeshDetector
    ) {
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
  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach(
        (track) => {
          try {
            track.stop();
          } catch {}
        }
      );

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
}function takePhoto() {
  try {
    if (
      !el.video ||
      el.video.readyState < 2
    ) {
      setStatus(
        "Open Camera first.",
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
        "Photo canvas failed."
      );
    }

    ctx.drawImage(
      el.video,
      0,
      0,
      width,
      height
    );

    if (renderer) {
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
            "Photo failed.",
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

function getRecorderType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  return (
    types.find(
      (type) =>
        MediaRecorder.isTypeSupported(
          type
        )
    ) || ""
  );
}

function startRecording() {
  try {
    if (
      !window.MediaRecorder
    ) {
      throw new Error(
        "Recording is not supported."
      );
    }

    if (!cameraStream) {
      setStatus(
        "Open Camera first.",
        true
      );
      return;
    }

    recordedChunks = [];

    const videoTracks =
      cameraStream.getVideoTracks();

    if (!videoTracks.length) {
      throw new Error(
        "Camera video track missing."
      );
    }

    const stream =
      new MediaStream(
        videoTracks
      );

    const mimeType =
      getRecorderType();

    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            stream,
            { mimeType }
          )
        : new MediaRecorder(
            stream
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
      "No video data.",
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
}

async function toggleAudio() {
  try {
    if (!cameraStream) {
      setStatus(
        "Open Camera first.",
        true
      );
      return;
    }

    if (audioEnabled) {
      cameraStream
        .getAudioTracks()
        .forEach(
          (track) => track.stop()
        );

      audioEnabled = false;

      setButtonLabel(
        el.audioButton,
        "Audio"
      );

      setStatus(
        "Microphone off."
      );

      return;
    }

    const audioStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false
        });

    const track =
      audioStream.getAudioTracks()[0];

    if (!track) {
      throw new Error(
        "Microphone track missing."
      );
    }

    cameraStream.addTrack(
      track
    );

    audioEnabled = true;

    setButtonLabel(
      el.audioButton,
      "Audio On"
    );

    setStatus(
      "Microphone on."
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

  const name =
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
          addModelToScene(
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
      "Use GLB, GLTF, OBJ or STL.",
      true
    );
  }

  event.target.value = "";
  }function exportModel() {
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

  const format =
    el.exportFormat?.value
      ?.toLowerCase() || "glb";

  if (format === "obj") {
    exportOBJ();
  } else {
    exportGLB();
  }
}

function exportGLB() {
  const exporter =
    new GLTFExporter();

  exporter.parse(
    currentModel,
    (result) => {
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

      downloadBlob(
        blob,
        result instanceof ArrayBuffer
          ? "aziz-ar-model.glb"
          : "aziz-ar-model.gltf"
      );

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
}

function exportOBJ() {
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
      "OBJ exported."
    );
  } catch (error) {
    showError(
      error,
      "OBJ export error"
    );
  }
}

function readManualControls() {
  return {
    scale: clamp(
      numberValue(
        el.scaleSlider,
        1
      ),
      0.05,
      10
    ),

    x: clamp(
      numberValue(
        el.xSlider,
        0
      ),
      -10,
      10
    ),

    y: clamp(
      numberValue(
        el.ySlider,
        0
      ),
      -10,
      10
    ),

    z: clamp(
      numberValue(
        el.zSlider,
        0
      ),
      -10,
      10
    ),

    rotX: THREE.MathUtils.degToRad(
      numberValue(
        el.rotateXSlider,
        0
      )
    ),

    rotY: THREE.MathUtils.degToRad(
      numberValue(
        el.rotateYSlider,
        0
      )
    ),

    rotZ: THREE.MathUtils.degToRad(
      numberValue(
        el.rotateZSlider,
        0
      )
    )
  };
}

function applyModelControls() {
  if (!currentModel) return;

  const manual =
    readManualControls();

  currentModel.position.x =
    manual.x +
    trackingState.x;

  currentModel.position.y =
    manual.y +
    trackingState.y;

  currentModel.position.z =
    manual.z +
    trackingState.z;

  currentModel.rotation.x =
    manual.rotX +
    trackingState.rotX;

  currentModel.rotation.y =
    manual.rotY +
    trackingState.rotY;

  currentModel.rotation.z =
    manual.rotZ +
    trackingState.rotZ;

  const finalScale =
    manual.scale *
    trackingState.scale;

  currentModel.scale.setScalar(
    clamp(
      finalScale,
      0.02,
      20
    )
  );
}

function smoothTracking() {
  if (!trackingEnabled) {
    trackingState.x =
      lerp(
        trackingState.x,
        0,
        0.12
      );

    trackingState.y =
      lerp(
        trackingState.y,
        0,
        0.12
      );

    trackingState.z =
      lerp(
        trackingState.z,
        0,
        0.12
      );

    trackingState.rotX =
      lerp(
        trackingState.rotX,
        0,
        0.12
      );

    trackingState.rotY =
      lerp(
        trackingState.rotY,
        0,
        0.12
      );

    trackingState.rotZ =
      lerp(
        trackingState.rotZ,
        0,
        0.12
      );

    trackingState.scale =
      lerp(
        trackingState.scale,
        1,
        0.12
      );

    applyModelControls();

    return;
  }

  const smooth =
    0.16;

  trackingState.x =
    lerp(
      trackingState.x,
      trackingState.targetX,
      smooth
    );

  trackingState.y =
    lerp(
      trackingState.y,
      trackingState.targetY,
      smooth
    );

  trackingState.z =
    lerp(
      trackingState.z,
      trackingState.targetZ,
      smooth
    );

  trackingState.rotX =
    lerp(
      trackingState.rotX,
      trackingState.targetRotX,
      smooth
    );

  trackingState.rotY =
    lerp(
      trackingState.rotY,
      trackingState.targetRotY,
      smooth
    );

  trackingState.rotZ =
    lerp(
      trackingState.rotZ,
      trackingState.targetRotZ,
      smooth
    );

  trackingState.scale =
    lerp(
      trackingState.scale,
      trackingState.targetScale,
      0.10
    );

  applyModelControls();
}

function resetModel() {
  if (!currentModel) return;

  resetTrackingState();

  createDemoCube();

  if (el.scaleSlider)
    el.scaleSlider.value = "1";

  if (el.xSlider)
    el.xSlider.value = "0";

  if (el.ySlider)
    el.ySlider.value = "0";

  if (el.zSlider)
    el.zSlider.value = "0";

  if (el.rotateXSlider)
    el.rotateXSlider.value = "0";

  if (el.rotateYSlider)
    el.rotateYSlider.value = "0";

  if (el.rotateZSlider)
    el.rotateZSlider.value = "0";

  applyModelControls();

  setStatus(
    "Model reset."
  );
}

function toggleControls() {
  if (!el.sideControls) return;

  const hidden =
    el.sideControls.style.display ===
    "none";

  el.sideControls.style.display =
    hidden
      ? "flex"
      : "none";
}async function startFaceTracking() {
  if (trackingBusy) return;

  if (
    typeof FaceMesh ===
    "undefined"
  ) {
    setStatus(
      "FACE MESH LIBRARY NOT LOADED.",
      true
    );
    return;
  }

  if (
    !el.video ||
    el.video.readyState < 2
  ) {
    setStatus(
      "Open Camera first.",
      true
    );
    return;
  }

  trackingBusy = true;

  try {
    faceMeshDetector =
      new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

    faceMeshDetector.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,

      minDetectionConfidence:
        0.55,

      minTrackingConfidence:
        0.55
    });

    faceMeshDetector.onResults(
      handleFaceResults
    );

    trackingEnabled = true;

    resetTrackingState();

    setStatus(
      "FACE TRACKING ON"
    );
  } catch (error) {
    faceMeshDetector = null;
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

  faceMeshDetector = null;

  resetTrackingState();

  applyModelControls();

  setStatus(
    "FACE TRACKING OFF"
  );
}

async function sendFaceFrame() {
  if (
    !trackingEnabled ||
    !faceMeshDetector ||
    !el.video ||
    el.video.readyState < 2 ||
    trackingBusy
  ) {
    return;
  }

  trackingBusy = true;

  try {
    await faceMeshDetector.send({
      image: el.video
    });
  } catch (error) {
    console.error(
      "Face frame error:",
      error
    );
  } finally {
    trackingBusy = false;
  }
}

function handleFaceResults(results) {
  if (
    !results ||
    !results.multiFaceLandmarks ||
    !results.multiFaceLandmarks.length
  ) {
    setStatus(
      "NO FACE DETECTED"
    );

    trackingState.targetX =
      0;

    trackingState.targetY =
      0;

    trackingState.targetZ =
      0;

    trackingState.targetRotX =
      0;

    trackingState.targetRotY =
      0;

    trackingState.targetRotZ =
      0;

    trackingState.targetScale =
      1;

    return;
  }

  const landmarks =
    results.multiFaceLandmarks[0];

  updateModelFromFace(
    landmarks
  );

  setStatus(
    "FACE DETECTED"
  );
}

function updateModelFromFace(
  landmarks
) {
  if (
    !currentModel ||
    !landmarks ||
    landmarks.length < 264
  ) {
    return;
  }

  const nose =
    landmarks[1];

  const leftEye =
    landmarks[33];

  const rightEye =
    landmarks[263];

  const forehead =
    landmarks[10];

  const chin =
    landmarks[152];

  if (
    !nose ||
    !leftEye ||
    !rightEye ||
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
    eyeDistance < 0.01
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

  const moveX =
    clamp(
      (
        faceCenterX -
        0.5
      ) * 3.0,
      -2.0,
      2.0
    );

  const moveY =
    clamp(
      -(
        faceCenterY -
        0.5
      ) * 2.4,
      -2.0,
      2.0
    );

  const rawDepth =
    0.55 /
    eyeDistance;

  const moveZ =
    clamp(
      rawDepth,
      -1.0,
      3.0
    );

  const eyeAngle =
    Math.atan2(
      rightEye.y -
        leftEye.y,

      rightEye.x -
        leftEye.x
    );

  const rawYaw =
    (
      nose.x -
      eyeCenterX
    ) * 5.0;

  const yaw =
    clamp(
      rawYaw,
      -0.9,
      0.9
    );

  const rawPitch =
    (
      nose.y -
      eyeCenterY
    ) * 4.0;

  const pitch =
    clamp(
      rawPitch,
      -0.8,
      0.8
    );

  const normalizedFaceSize =
    clamp(
      eyeDistance /
        0.12,

      0.55,
      1.55
    );

  /*
   * IMPORTANT:
   * Tracking scale is only a multiplier.
   * It does NOT overwrite the user's
   * Scale slider.
   */

  const trackingScale =
    clamp(
      normalizedFaceSize,
      0.65,
      1.45
    );

  trackingState.targetX =
    moveX;

  trackingState.targetY =
    moveY;

  trackingState.targetZ =
    moveZ;

  trackingState.targetRotZ =
    -eyeAngle;

  trackingState.targetRotY =
    -yaw * 0.75;

  trackingState.targetRotX =
    pitch * 0.65;

  trackingState.targetScale =
    trackingScale;
}

function toggleFaceTracking() {
  if (trackingEnabled) {
    stopFaceTracking();

    setButtonLabel(
      el.trackingButton,
      "Face Tracking"
    );

    return;
  }

  startFaceTracking()
    .then(() => {
      if (
        trackingEnabled
      ) {
        setButtonLabel(
          el.trackingButton,
          "Tracking On"
        );
      }
    })
    .catch((error) => {
      showError(
        error,
        "Tracking error"
      );
    });
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

  sliders.forEach(
    (slider) => {
      slider?.addEventListener(
        "input",
        applyModelControls
      );
    }
  );
}

function initializeApp() {
  try {
    checkRequiredElements();

    prepareVideo();

    initThree();

    bindEvents();

    if (el.sideControls) {
      el.sideControls.style.display =
        "flex";
    }

    setStatus(
      "Ready. Open Camera."
    );
  } catch (error) {
    showError(
      error,
      "App initialization error"
    );
  }
}

window.addEventListener(
  "beforeunload",
  () => {
    stopFaceTracking();
    stopCamera();

    if (
      mediaRecorder &&
      mediaRecorder.state !==
        "inactive"
    ) {
      try {
        mediaRecorder.stop();
      } catch {}
    }
  }
);

window.addEventListener(
  "error",
  (event) => {
    if (
      event?.message &&
      !String(
        event.message
      ).includes(
        "Script error"
      )
    ) {
      console.error(
        "JavaScript error:",
        event.message
      );
    }
  }
);

initializeApp();
