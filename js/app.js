import * as THREE from "three";

import { GLTFLoader } from
  "three/addons/loaders/GLTFLoader.js";

import { OBJLoader } from
  "three/addons/loaders/OBJLoader.js";

import { STLLoader } from
  "three/addons/loaders/STLLoader.js";

import { GLTFExporter } from
  "three/addons/exporters/GLTFExporter.js";

import {
  FilesetResolver,
  FaceLandmarker
} from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";


const $ = (id) => document.getElementById(id);

const el = {
  video: $("video"),
  canvas: $("canvas"),

  openCameraButton:
    $("openCameraButton") ||
    $("openCameraBtn") ||
    $("openCamera"),

  startTrackingButton:
    $("startTrackingButton") ||
    $("startTrackingBtn") ||
    $("startTracking"),

  switchCameraButton:
    $("switchCameraButton") ||
    $("switchCameraBtn") ||
    $("switchCamera"),

  flipCameraButton:
    $("flipCameraButton") ||
    $("flipCameraBtn") ||
    $("flipCamera"),

  recordButton:
    $("recordButton") ||
    $("recordBtn") ||
    $("record"),

  captureButton:
    $("captureButton") ||
    $("captureBtn") ||
    $("capturePhoto"),

  modelFileInput:
    $("modelFileInput") ||
    $("modelInput") ||
    $("fileInput"),

  exportButton:
    $("exportButton") ||
    $("exportBtn") ||
    $("exportModel"),

  resetControlsButton:
    $("resetControlsButton") ||
    $("resetControlsBtn") ||
    $("resetControls"),

  hideControlsButton:
    $("hideControlsButton") ||
    $("hideControlsBtn"),

  showControlsButton:
    $("showControlsButton") ||
    $("showControlsBtn"),

  appControls:
    $("appControls") ||
    $("controls"),

  scaleSlider:
    $("scaleSlider") ||
    $("scale"),

  xSlider:
    $("xSlider") ||
    $("posX"),

  ySlider:
    $("ySlider") ||
    $("posY"),

  zSlider:
    $("zSlider") ||
    $("posZ"),

  rotateXSlider:
    $("rotateXSlider") ||
    $("rotationX"),

  rotateYSlider:
    $("rotateYSlider") ||
    $("rotationY"),

  rotateZSlider:
    $("rotateZSlider") ||
    $("rotationZ"),

  status:
    $("status") ||
    $("statusText")
};


function status(message) {
  if (el.status) {
    el.status.textContent = message;
  }

  console.log("[Azeez AR]", message);
}


function setButtonText(button, text) {
  if (button) {
    button.textContent = text;
  }
}


function degreesToRadians(value) {
  return THREE.MathUtils.degToRad(
    Number(value) || 0
  );
}


let scene;
let camera;
let renderer;

let cameraStream = null;

let facingMode = "user";
let cameraFlipped = false;

let currentModel = null;
let modelRoot = null;
let testCube = null;

let modelBaseScale = 1;
let modelBasePosition = new THREE.Vector3();
let modelBaseRotation = new THREE.Euler();

let faceLandmarker = null;
let trackingReady = false;
let trackingLoopStarted = false;

let faceDetected = false;

let headX = 0.5;
let headY = 0.5;

let headYaw = 0;
let headPitch = 0;
let headRoll = 0;

let lastTrackingTime = 0;

let recorder = null;
let recordChunks = [];
let recording = false;

let modelURL = null;


function createRenderer() {
  if (!el.canvas) {
    throw new Error("Canvas element not found.");
  }

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
    el.canvas.clientWidth || window.innerWidth,
    el.canvas.clientHeight || window.innerHeight,
    false
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;
}


function createScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    1,
    0.01,
    100
  );

  camera.position.set(
    0,
    0,
    5
  );

  modelRoot = new THREE.Group();

  scene.add(modelRoot);

  const ambient =
    new THREE.AmbientLight(
      0xffffff,
      2.2
    );

  scene.add(ambient);

  const keyLight =
    new THREE.DirectionalLight(
      0xffffff,
      2.5
    );

  keyLight.position.set(
    2,
    4,
    5
  );

  scene.add(keyLight);

  const fillLight =
    new THREE.DirectionalLight(
      0xffffff,
      1.2
    );

  fillLight.position.set(
    -3,
    1,
    2
  );

  scene.add(fillLight);
}


function resizeRenderer() {
  if (!renderer || !camera) return;

  const width =
    el.canvas?.clientWidth ||
    window.innerWidth;

  const height =
    el.canvas?.clientHeight ||
    window.innerHeight;

  if (width <= 0 || height <= 0) return;

  camera.aspect =
    width / height;

  camera.updateProjectionMatrix();

  renderer.setSize(
    width,
    height,
    false
  );
}


function createTestCube() {
  if (!modelRoot) return;

  if (testCube) {
    modelRoot.remove(testCube);

    testCube.geometry.dispose();
    testCube.material.dispose();

    testCube = null;
  }

  const geometry =
    new THREE.BoxGeometry(
      0.8,
      0.8,
      0.8
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x4aa3ff,
      roughness: 0.5,
      metalness: 0.1
    });

  testCube =
    new THREE.Mesh(
      geometry,
      material
    );

  testCube.position.set(
    0,
    0,
    0
  );

  modelRoot.add(testCube);
}


function renderLoop() {
  requestAnimationFrame(
    renderLoop
  );

  if (testCube) {
    testCube.rotation.x += 0.008;
    testCube.rotation.y += 0.012;
  }

  if (renderer && scene && camera) {
    renderer.render(
      scene,
      camera
    );
  }
}


window.addEventListener(
  "resize",
  resizeRenderer
);


try {
  createRenderer();
  createScene();
  createTestCube();
  resizeRenderer();

  status(
    "Camera and 3D system ready."
  );

  renderLoop();

} catch (error) {
  console.error(error);
  status(
    "3D initialization error."
  );
      }function clearCurrentModel() {
  if (
    currentModel &&
    currentModel !== testCube
  ) {
    modelRoot.remove(
      currentModel
    );

    currentModel.traverse(
      (object) => {
        if (!object.isMesh) return;

        if (object.geometry) {
          object.geometry.dispose();
        }

        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach(
          (material) => {
            if (!material) return;

            for (const key in material) {
              const value =
                material[key];

              if (
                value &&
                value.isTexture
              ) {
                value.dispose();
              }
            }

            material.dispose();
          }
        );
      }
    );
  }

  if (testCube) {
    modelRoot.remove(
      testCube
    );

    testCube.geometry.dispose();
    testCube.material.dispose();

    testCube = null;
  }

  currentModel = null;
}


function centerAndFitModel(object) {
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

  const maxDimension =
    Math.max(
      size.x,
      size.y,
      size.z
    );

  if (maxDimension > 0) {
    const fitScale =
      1.5 / maxDimension;

    object.scale.setScalar(
      fitScale
    );

    modelBaseScale =
      fitScale;

  } else {
    object.scale.setScalar(1);
    modelBaseScale = 1;
  }

  modelBasePosition.set(
    0,
    0,
    0
  );

  modelBaseRotation.set(
    0,
    0,
    0
  );

  object.position.copy(
    modelBasePosition
  );

  object.rotation.copy(
    modelBaseRotation
  );

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
}


function addLoadedModel(
  object,
  label
) {
  clearCurrentModel();

  object.traverse(
    (child) => {
      if (!child.isMesh) return;

      child.frustumCulled = false;

      if (child.material) {
        const materials =
          Array.isArray(child.material)
            ? child.material
            : [child.material];

        materials.forEach(
          (material) => {
            material.side =
              THREE.DoubleSide;

            material.needsUpdate =
              true;
          }
        );
      }
    }
  );

  centerAndFitModel(
    object
  );

  currentModel = object;

  modelRoot.add(
    currentModel
  );

  status(
    label +
    " loaded. Adjust the 3D controls."
  );
}


function loadModelFile(file) {
  if (!file) return;

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  const objectUrl =
    URL.createObjectURL(
      file
    );

  modelURL =
    objectUrl;

  status(
    "Loading " +
    file.name +
    "..."
  );

  if (
    extension === "glb" ||
    extension === "gltf"
  ) {
    const loader =
      new GLTFLoader();

    loader.load(
      objectUrl,

      (gltf) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        addLoadedModel(
          gltf.scene,
          file.name
        );
      },

      undefined,

      (error) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        console.error(error);

        status(
          "Could not load GLB/GLTF."
        );
      }
    );

    return;
  }

  if (extension === "obj") {
    const loader =
      new OBJLoader();

    loader.load(
      objectUrl,

      (object) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        addLoadedModel(
          object,
          file.name
        );
      },

      undefined,

      (error) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        console.error(error);

        status(
          "Could not load OBJ."
        );
      }
    );

    return;
  }

  if (extension === "stl") {
    const loader =
      new STLLoader();

    loader.load(
      objectUrl,

      (geometry) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        geometry.computeVertexNormals();

        const material =
          new THREE.MeshStandardMaterial({
            color: 0xb8c4d4,
            metalness: 0.15,
            roughness: 0.65,
            side: THREE.DoubleSide
          });

        const mesh =
          new THREE.Mesh(
            geometry,
            material
          );

        addLoadedModel(
          mesh,
          file.name
        );
      },

      undefined,

      (error) => {
        URL.revokeObjectURL(
          objectUrl
        );

        modelURL = null;

        console.error(error);

        status(
          "Could not load STL."
        );
      }
    );

    return;
  }

  URL.revokeObjectURL(
    objectUrl
  );

  modelURL = null;

  status(
    "Unsupported file. Use GLB, GLTF, OBJ or STL."
  );
}


function applyCameraOrientation() {
  const transform =
    cameraFlipped
      ? "scaleX(-1)"
      : "scaleX(1)";

  if (el.video) {
    el.video.style.transform =
      transform;
  }

  if (el.canvas) {
    el.canvas.style.transform =
      transform;
  }

  setButtonText(
    el.flipCameraButton,
    cameraFlipped
      ? "Flip: ON"
      : "Flip: OFF"
  );
}


async function stopCamera() {
  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach(
        (track) => {
          track.stop();
        }
      );

    cameraStream = null;
  }

  if (el.video) {
    el.video.srcObject =
      null;
  }
}


async function startCamera() {
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    status(
      "Camera is not supported."
    );

    return;
  }

  await stopCamera();

  status(
    "Opening camera..."
  );

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

  try {
    cameraStream =
      await navigator.mediaDevices
        .getUserMedia(
          constraints
        );

    el.video.srcObject =
      cameraStream;

    await el.video.play();

    applyCameraOrientation();

    status(
      "Camera ready."
    );

  } catch (error) {
    console.error(error);

    status(
      "Camera error: " +
      error.message
    );
  }
}


async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  await startCamera();

  setButtonText(
    el.switchCameraButton,

    facingMode === "user"
      ? "Front Camera"
      : "Back Camera"
  );
}


function toggleCameraFlip() {
  cameraFlipped =
    !cameraFlipped;

  applyCameraOrientation();

  status(
    cameraFlipped
      ? "Camera mirror enabled."
      : "Camera mirror disabled."
  );
          }function applyModelControls() {
  if (!currentModel) return;

  const scaleValue =
    Number(
      el.scaleSlider?.value
    ) || 1;

  currentModel.scale.setScalar(
    modelBaseScale *
    scaleValue
  );

  currentModel.position.set(
    Number(
      el.xSlider?.value
    ) || 0,

    Number(
      el.ySlider?.value
    ) || 0,

    Number(
      el.zSlider?.value
    ) || 0
  );

  currentModel.rotation.set(
    degreesToRadians(
      el.rotateXSlider?.value
    ),

    degreesToRadians(
      el.rotateYSlider?.value
    ),

    degreesToRadians(
      el.rotateZSlider?.value
    )
  );
}


function resetModelControls() {
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

  status(
    "Model controls reset."
  );
}


function toggleControlsVisibility(
  hide
) {
  if (el.appControls) {
    el.appControls.style.display =
      hide
        ? "none"
        : "block";
  }

  if (el.showControlsButton) {
    el.showControlsButton.style.display =
      hide
        ? "block"
        : "none";
  }
}


async function createFaceTracker() {
  if (trackingReady) {
    return true;
  }

  try {
    status(
      "Loading face tracking..."
    );

    const vision =
      await FilesetResolver
        .forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );

    faceLandmarker =
      await FaceLandmarker
        .createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

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

    trackingReady =
      true;

    status(
      "Face tracking ready."
    );

    return true;

  } catch (error) {
    console.error(
      "FACE TRACKING ERROR:",
      error
    );

    trackingReady =
      false;

    status(
      "Face tracking error."
    );

    return false;
  }
}


function updateFaceTracking() {
  if (
    !trackingReady ||
    !faceLandmarker
  ) {
    return;
  }

  if (
    !el.video ||
    !el.video.videoWidth ||
    !el.video.videoHeight
  ) {
    return;
  }

  if (
    el.video.readyState < 2
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    now - lastTrackingTime <
    33
  ) {
    return;
  }

  lastTrackingTime =
    now;

  try {
    const result =
      faceLandmarker
        .detectForVideo(
          el.video,
          now
        );

    if (
      !result ||
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {
      faceDetected =
        false;

      return;
    }

    faceDetected =
      true;

    const landmarks =
      result.faceLandmarks[0];

    updateHeadPose(
      landmarks
    );

  } catch (error) {
    console.error(
      "Tracking frame error:",
      error
    );
  }
}


function updateHeadPose(
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
    eyeDistance <= 0
  ) {
    return;
  }

  const faceHeight =
    Math.hypot(
      chin.x -
        forehead.x,

      chin.y -
        forehead.y
    );

  if (
    faceHeight <= 0
  ) {
    return;
  }

  const yawRaw =
    (
      nose.x -
      eyeCenterX
    ) / eyeDistance;

  const pitchRaw =
    (
      nose.y -
      eyeCenterY
    ) / faceHeight;

  const rollRaw =
    Math.atan2(
      rightEye.y -
        leftEye.y,

      rightEye.x -
        leftEye.x
    );

  const yaw =
    THREE.MathUtils.clamp(
      yawRaw * 1.8,
      -1,
      1
    );

  const pitch =
    THREE.MathUtils.clamp(
      pitchRaw * 4,
      -1,
      1
    );

  const roll =
    THREE.MathUtils.clamp(
      rollRaw,
      -1.2,
      1.2
    );

  headX +=
    (
      eyeCenterX -
      headX
    ) * 0.35;

  headY +=
    (
      eyeCenterY -
      headY
    ) * 0.35;

  headYaw +=
    (
      yaw -
      headYaw
    ) * 0.25;

  headPitch +=
    (
      pitch -
      headPitch
    ) * 0.25;

  headRoll +=
    (
      roll -
      headRoll
    ) * 0.25;

  applyHeadTracking();
}


function applyHeadTracking() {
  if (
    !currentModel ||
    !faceDetected
  ) {
    return;
  }

  const baseX =
    Number(
      el.xSlider?.value
    ) || 0;

  const baseY =
    Number(
      el.ySlider?.value
    ) || 0;

  const baseZ =
    Number(
      el.zSlider?.value
    ) || 0;

  const trackedX =
    (
      headX - 0.5
    ) * 1.6;

  const trackedY =
    -(
      headY - 0.5
    ) * 1.4;

  currentModel.position.x =
    baseX +
    trackedX;

  currentModel.position.y =
    baseY +
    trackedY;

  currentModel.position.z =
    baseZ;

  const rx =
    degreesToRadians(
      el.rotateXSlider?.value
    );

  const ry =
    degreesToRadians(
      el.rotateYSlider?.value
    );

  const rz =
    degreesToRadians(
      el.rotateZSlider?.value
    );

  currentModel.rotation.x =
    rx +
    headPitch * 0.65;

  currentModel.rotation.y =
    ry +
    headYaw * 1.25;

  currentModel.rotation.z =
    rz -
    headRoll;
}function capturePhoto() {
  if (
    !el.canvas ||
    !renderer
  ) {
    status(
      "Canvas is not ready."
    );

    return;
  }

  try {
    renderer.render(
      scene,
      camera
    );

    const link =
      document.createElement(
        "a"
      );

    link.download =
      "azeez-ar-photo.png";

    link.href =
      el.canvas.toDataURL(
        "image/png"
      );

    link.click();

    status(
      "Photo saved."
    );

  } catch (error) {
    console.error(error);

    status(
      "Photo capture error."
    );
  }
}


function startRecording() {
  if (
    recording ||
    !el.canvas
  ) {
    return;
  }

  try {
    const stream =
      el.canvas.captureStream(
        30
      );

    let mimeType = "";

    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];

    for (
      const type of types
    ) {
      if (
        MediaRecorder.isTypeSupported(
          type
        )
      ) {
        mimeType =
          type;

        break;
      }
    }

    recorder =
      new MediaRecorder(
        stream,
        mimeType
          ? { mimeType }
          : undefined
      );

    recordChunks = [];

    recorder.ondataavailable =
      (event) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordChunks.push(
            event.data
          );
        }
      };

    recorder.onstop = () => {
      if (
        recordChunks.length === 0
      ) {
        return;
      }

      const blob =
        new Blob(
          recordChunks,
          {
            type:
              recorder.mimeType ||
              "video/webm"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        "azeez-ar-recording.webm";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        1000
      );

      status(
        "Recording saved."
      );
    };

    recorder.start(200);

    recording =
      true;

    setButtonText(
      el.recordButton,
      "STOP RECORDING"
    );

    status(
      "Recording..."
    );

  } catch (error) {
    console.error(error);

    recording =
      false;

    status(
      "Recording error."
    );
  }
}


function stopRecording() {
  if (
    !recorder ||
    recorder.state ===
      "inactive"
  ) {
    return;
  }

  try {
    recorder.stop();

  } catch (error) {
    console.error(error);
  }

  recording =
    false;

  setButtonText(
    el.recordButton,
    "RECORD"
  );
}


function toggleRecording() {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
}


function exportGLB() {
  if (
    !currentModel
  ) {
    status(
      "No 3D model loaded."
    );

    return;
  }

  try {
    status(
      "Exporting 3D model..."
    );

    const exporter =
      new GLTFExporter();

    exporter.parse(
      currentModel,

      (result) => {
        const blob =
          result instanceof
          ArrayBuffer
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

        const url =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href =
          url;

        link.download =
          result instanceof
          ArrayBuffer
            ? "azeez-ar-model.glb"
            : "azeez-ar-model.gltf";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(
          () => {
            URL.revokeObjectURL(
              url
            );
          },
          1000
        );

        status(
          "3D model exported."
        );
      },

      (error) => {
        console.error(error);

        status(
          "3D export error."
        );
      },

      {
        binary: true
      }
    );

  } catch (error) {
    console.error(error);

    status(
      "3D export error."
    );
  }
}


function bindSlider(
  slider
) {
  if (!slider) return;

  slider.addEventListener(
    "input",
    () => {
      applyModelControls();
    }
  );
}


[
  el.scaleSlider,
  el.xSlider,
  el.ySlider,
  el.zSlider,
  el.rotateXSlider,
  el.rotateYSlider,
  el.rotateZSlider
].forEach(
  bindSlider
);


if (el.modelFileInput) {
  el.modelFileInput.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files?.[0];

      if (file) {
        loadModelFile(
          file
        );
      }

      event.target.value =
        "";
    }
  );
}


if (
  el.openCameraButton
) {
  el.openCameraButton.addEventListener(
    "click",
    async () => {
      await startCamera();
    }
  );
}


if (
  el.startTrackingButton
) {
  el.startTrackingButton.addEventListener(
    "click",
    async () => {
      await startCamera();

      await createFaceTracker();

      if (
        trackingReady
      ) {
        startTrackingLoop();
      }
    }
  );
}if (
  el.switchCameraButton
) {
  el.switchCameraButton.addEventListener(
    "click",
    switchCamera
  );
}


if (
  el.flipCameraButton
) {
  el.flipCameraButton.addEventListener(
    "click",
    toggleCameraFlip
  );
}


if (el.recordButton) {
  el.recordButton.addEventListener(
    "click",
    toggleRecording
  );
}


if (el.captureButton) {
  el.captureButton.addEventListener(
    "click",
    capturePhoto
  );
}


if (el.exportButton) {
  el.exportButton.addEventListener(
    "click",
    exportGLB
  );
}


if (
  el.resetControlsButton
) {
  el.resetControlsButton.addEventListener(
    "click",
    resetModelControls
  );
}


if (
  el.hideControlsButton
) {
  el.hideControlsButton.addEventListener(
    "click",
    () => {
      toggleControlsVisibility(
        true
      );
    }
  );
}


if (
  el.showControlsButton
) {
  el.showControlsButton.addEventListener(
    "click",
    () => {
      toggleControlsVisibility(
        false
      );
    }
  );
}


function startTrackingLoop() {
  if (trackingLoopStarted) {
    return;
  }

  trackingLoopStarted =
    true;

  function frame() {
    updateFaceTracking();

    if (
      renderer &&
      scene &&
      camera
    ) {
      renderer.render(
        scene,
        camera
      );
    }

    requestAnimationFrame(
      frame
    );
  }

  requestAnimationFrame(
    frame
  );
}


window.addEventListener(
  "beforeunload",
  () => {
    try {
      if (
        recorder &&
        recorder.state !==
          "inactive"
      ) {
        recorder.stop();
      }
    } catch (error) {}

    try {
      if (cameraStream) {
        cameraStream
          .getTracks()
          .forEach(
            (track) => {
              track.stop();
            }
          );
      }
    } catch (error) {}

    try {
      if (modelURL) {
        URL.revokeObjectURL(
          modelURL
        );
      }
    } catch (error) {}
  }
);


if (el.video) {
  el.video.setAttribute(
    "playsinline",
    ""
  );

  el.video.setAttribute(
    "autoplay",
    ""
  );

  el.video.muted =
    true;
}


applyCameraOrientation();

toggleControlsVisibility(
  false
);

status(
  "Ready. Press OPEN CAMERA."
);


/*
  Start the renderer once.
  The test cube stays visible until
  a real 3D model is loaded.
*/

if (
  renderer &&
  scene &&
  camera
) {
  renderer.render(
    scene,
    camera
  );
}


/*
  Face tracking is loaded only when
  the user starts tracking.
  This keeps camera startup independent
  from the tracking model.
*/


console.log(
  "AZEEZ AR APP READY"
);
