import * as THREE from "three";

import {
  FaceLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";


const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const status = document.getElementById("status");

const cameraButton = document.getElementById("cameraButton");
const switchCameraButton = document.getElementById("switchCameraButton");
const flipCameraButton = document.getElementById("flipCameraButton");
const photoButton = document.getElementById("photoButton");
const recordButton = document.getElementById("recordButton");
const audioButton = document.getElementById("audioButton");
const trackingButton = document.getElementById("trackingButton");
const modelButton = document.getElementById("modelButton");
const import3DButton = document.getElementById("import3DButton");
const export3DButton = document.getElementById("export3DButton");
const exportFormat = document.getElementById("exportFormat");
const resetButton = document.getElementById("resetButton");
const hideControlsButton = document.getElementById("hideControlsButton");
const showControlsButton = document.getElementById("showControlsButton");

const appControls = document.getElementById("appControls");
const sideControls = document.getElementById("sideControls");
const import3DInput = document.getElementById("import3DInput");

const scaleSlider = document.getElementById("scaleSlider");
const xSlider = document.getElementById("xSlider");
const ySlider = document.getElementById("ySlider");
const zSlider = document.getElementById("zSlider");

const rotateXSlider = document.getElementById("rotateXSlider");
const rotateYSlider = document.getElementById("rotateYSlider");
const rotateZSlider = document.getElementById("rotateZSlider");


let stream = null;
let currentFacingMode = "user";
let cameraMirrored = false;

let faceLandmarker = null;
let trackingEnabled = true;
let trackingReady = false;

let lastVideoTime = -1;
let lastTrackingTime = 0;

let mediaRecorder = null;
let recordedChunks = [];
let recording = false;
let audioEnabled = false;

let currentModel = null;
let modelRoot = null;

let modelScale = 1;
let modelOffsetX = 0;
let modelOffsetY = 0;
let modelOffsetZ = 0;

let modelRotationX = 0;
let modelRotationY = 0;
let modelRotationZ = 0;

let headAnchor = null;
let trackingAnchor = null;

let faceCenter = new THREE.Vector3();
let faceScale = 1;

let smoothedX = 0;
let smoothedY = 0;
let smoothedZ = 0;

let smoothYaw = 0;
let smoothPitch = 0;
let smoothRoll = 0;

let firstTrackingFrame = true;


const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
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


const camera3D = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);

camera3D.position.set(0, 0, 5);


const ambientLight = new THREE.AmbientLight(
  0xffffff,
  2.2
);

scene.add(ambientLight);


const keyLight = new THREE.DirectionalLight(
  0xffffff,
  2.5
);

keyLight.position.set(2, 4, 5);

scene.add(keyLight);


const fillLight = new THREE.DirectionalLight(
  0xffffff,
  1.5
);

fillLight.position.set(-3, 1, 3);

scene.add(fillLight);


headAnchor = new THREE.Group();
headAnchor.name = "HeadAnchor";

scene.add(headAnchor);


trackingAnchor = new THREE.Group();
trackingAnchor.name = "TrackingAnchor";

headAnchor.add(trackingAnchor);


function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}


function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);

  camera3D.aspect = width / height;
  camera3D.updateProjectionMatrix();
}


window.addEventListener(
  "resize",
  resizeRenderer
);


function updateCameraMirror() {
  const transform = cameraMirrored
    ? "scaleX(-1)"
    : "scaleX(1)";

  video.style.transform = transform;
  canvas.style.transform = transform;
}


function toggleCameraMirror() {
  cameraMirrored = !cameraMirrored;

  updateCameraMirror();

  setStatus(
    cameraMirrored
      ? "Camera flip: ON"
      : "Camera flip: OFF"
  );
}


function stopCamera() {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach(track => {
    track.stop();
  });

  stream = null;
  video.srcObject = null;
}


async function openCamera() {
  try {
    stopCamera();

    setStatus("Opening camera...");

    const constraints = {
      audio: false,
      video: {
        facingMode: {
          ideal: currentFacingMode
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(
      constraints
    );

    video.srcObject = stream;

    await video.play();

    updateCameraMirror();

    setStatus("Camera ready");

    if (!trackingReady) {
      await initializeTracking();
    }

  } catch (error) {
    console.error(error);

    setStatus(
      "Camera error: " +
      (error.message || "Unable to open camera")
    );
  }
}


async function switchCamera() {
  currentFacingMode =
    currentFacingMode === "user"
      ? "environment"
      : "user";

  cameraMirrored =
    currentFacingMode === "user"
      ? cameraMirrored
      : false;

  await openCamera();

  setStatus(
    currentFacingMode === "user"
      ? "Front camera"
      : "Back camera"
  );
}


cameraButton.addEventListener(
  "click",
  openCamera
);


switchCameraButton.addEventListener(
  "click",
  switchCamera
);


flipCameraButton.addEventListener(
  "click",
  toggleCameraMirror
);


function renderLoop() {
  requestAnimationFrame(renderLoop);

  updateTracking();

  renderer.render(
    scene,
    camera3D
  );
}


renderLoop();

resizeRenderer();

updateCameraMirror();

setStatus("Ready");async function initializeTracking() {
  try {
    setStatus("Loading face tracking...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
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

    trackingReady = true;

    setStatus("Face tracking ready");

  } catch (error) {

    console.error(
      "Face tracking initialization error:",
      error
    );

    trackingReady = false;

    setStatus(
      "Tracking error: " +
      (error.message || "Face tracker failed")
    );
  }
}


function updateTracking() {

  if (!trackingEnabled) {
    return;
  }

  if (!trackingReady) {
    return;
  }

  if (!faceLandmarker) {
    return;
  }

  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  const now = performance.now();

  if (video.currentTime === lastVideoTime) {
    return;
  }

  lastVideoTime = video.currentTime;

  try {

    const result =
      faceLandmarker.detectForVideo(
        video,
        now
      );

    processFaceResult(result);

  } catch (error) {

    console.error(
      "Tracking frame error:",
      error
    );
  }
}


function processFaceResult(result) {

  if (
    !result ||
    !result.faceLandmarks ||
    result.faceLandmarks.length === 0
  ) {

    if (
      performance.now() - lastTrackingTime >
      700
    ) {

      setStatus("Face not detected");
    }

    return;
  }

  lastTrackingTime = performance.now();

  const landmarks =
    result.faceLandmarks[0];

  updateHeadPosition(landmarks);

  updateHeadRotation(
    result,
    landmarks
  );

  updateHeadScale(landmarks);

  updateModelTransform();

  setStatus("Face tracking active");
}


function getLandmark(index, landmarks) {

  if (
    !landmarks ||
    !landmarks[index]
  ) {
    return null;
  }

  return landmarks[index];
}


function updateHeadPosition(landmarks) {

  const leftEye =
    getLandmark(33, landmarks);

  const rightEye =
    getLandmark(263, landmarks);

  const nose =
    getLandmark(1, landmarks);

  if (
    !leftEye ||
    !rightEye ||
    !nose
  ) {
    return;
  }

  const centerX =
    (
      leftEye.x +
      rightEye.x
    ) * 0.5;

  const centerY =
    (
      leftEye.y +
      rightEye.y
    ) * 0.5;

  const centerZ =
    nose.z || 0;


  const targetX =
    (0.5 - centerX) * 4.0;

  const targetY =
    (0.5 - centerY) * 3.0;

  const targetZ =
    -centerZ * 2.0;


  const smoothing = 0.25;


  smoothedX +=
    (targetX - smoothedX) *
    smoothing;

  smoothedY +=
    (targetY - smoothedY) *
    smoothing;

  smoothedZ +=
    (targetZ - smoothedZ) *
    smoothing;


  faceCenter.set(
    smoothedX,
    smoothedY,
    smoothedZ
  );
}


function updateHeadRotation(
  result,
  landmarks
) {

  let yaw = 0;
  let pitch = 0;
  let roll = 0;


  const leftEye =
    getLandmark(33, landmarks);

  const rightEye =
    getLandmark(263, landmarks);

  const nose =
    getLandmark(1, landmarks);

  const forehead =
    getLandmark(10, landmarks);

  const chin =
    getLandmark(152, landmarks);


  if (
    leftEye &&
    rightEye &&
    nose
  ) {

    const eyeVectorX =
      rightEye.x - leftEye.x;

    const eyeVectorY =
      rightEye.y - leftEye.y;


    roll =
      -Math.atan2(
        eyeVectorY,
        eyeVectorX
      );


    const eyeCenterX =
      (
        leftEye.x +
        rightEye.x
      ) * 0.5;


    const horizontalOffset =
      nose.x - eyeCenterX;


    yaw =
      horizontalOffset *
      3.0;


    if (
      forehead &&
      chin
    ) {

      const faceHeight =
        chin.y - forehead.y;

      const noseVertical =
        nose.y -
        (
          forehead.y +
          faceHeight * 0.5
        );

      pitch =
        noseVertical * 2.0;
    }
  }


  const rotationSmoothing =
    firstTrackingFrame
      ? 1
      : 0.22;


  smoothYaw +=
    (yaw - smoothYaw) *
    rotationSmoothing;

  smoothPitch +=
    (pitch - smoothPitch) *
    rotationSmoothing;

  smoothRoll +=
    (roll - smoothRoll) *
    rotationSmoothing;


  firstTrackingFrame = false;


  headAnchor.rotation.order =
    "YXZ";


  headAnchor.rotation.y =
    smoothYaw;

  headAnchor.rotation.x =
    smoothPitch;

  headAnchor.rotation.z =
    smoothRoll;
}


function updateHeadScale(landmarks) {

  const leftEye =
    getLandmark(33, landmarks);

  const rightEye =
    getLandmark(263, landmarks);

  if (
    !leftEye ||
    !rightEye
  ) {
    return;
  }


  const dx =
    rightEye.x -
    leftEye.x;

  const dy =
    rightEye.y -
    leftEye.y;

  const eyeDistance =
    Math.sqrt(
      dx * dx +
      dy * dy
    );


  if (
    !Number.isFinite(
      eyeDistance
    ) ||
    eyeDistance <= 0
  ) {
    return;
  }


  const targetScale =
    THREE.MathUtils.clamp(
      eyeDistance * 7.0,
      0.35,
      4.0
    );


  faceScale +=
    (
      targetScale -
      faceScale
    ) * 0.2;
}


function updateModelTransform() {

  if (!modelRoot) {
    return;
  }


  headAnchor.position.copy(
    faceCenter
  );


  const trackingScale =
    faceScale *
    modelScale;


  headAnchor.scale.set(
    trackingScale,
    trackingScale,
    trackingScale
  );


  trackingAnchor.position.set(
    modelOffsetX,
    modelOffsetY,
    modelOffsetZ
  );


  trackingAnchor.rotation.set(
    THREE.MathUtils.degToRad(
      modelRotationX
    ),

    THREE.MathUtils.degToRad(
      modelRotationY
    ),

    THREE.MathUtils.degToRad(
      modelRotationZ
    ),

    "YXZ"
  );
}


function resetTrackingSmoothing() {

  smoothedX = 0;
  smoothedY = 0;
  smoothedZ = 0;

  smoothYaw = 0;
  smoothPitch = 0;
  smoothRoll = 0;

  faceScale = 1;

  firstTrackingFrame = true;
}


trackingButton.addEventListener(
  "click",
  async () => {

    trackingEnabled =
      !trackingEnabled;

    if (trackingEnabled) {

      resetTrackingSmoothing();

      trackingButton.textContent =
        "Tracking";

      if (!trackingReady) {
        await initializeTracking();
      } else {
        setStatus(
          "Tracking ON"
        );
      }

    } else {

      trackingButton.textContent =
        "Tracking Off";

      setStatus(
        "Tracking OFF"
      );
    }
  }
);function clearCurrentModel() {

  if (!modelRoot) {
    return;
  }

  trackingAnchor.remove(modelRoot);

  modelRoot.traverse(object => {

    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {

      const materials =
        Array.isArray(object.material)
          ? object.material
          : [object.material];

      materials.forEach(material => {

        if (material.map) {
          material.map.dispose();
        }

        if (material.normalMap) {
          material.normalMap.dispose();
        }

        if (material.roughnessMap) {
          material.roughnessMap.dispose();
        }

        if (material.metalnessMap) {
          material.metalnessMap.dispose();
        }

        material.dispose();
      });
    }
  });

  modelRoot = null;
  currentModel = null;
}


function prepareModel(object) {

  clearCurrentModel();

  modelRoot = new THREE.Group();

  modelRoot.name =
    "Imported3DModel";

  modelRoot.add(object);

  trackingAnchor.add(
    modelRoot
  );

  currentModel =
    modelRoot;

  centerAndNormalizeModel(
    modelRoot
  );

  applyModelControls();

  setStatus(
    "3D model loaded"
  );
}


function centerAndNormalizeModel(
  object
) {

  const box =
    new THREE.Box3()
      .setFromObject(object);

  if (box.isEmpty()) {
    return;
  }


  const center =
    box.getCenter(
      new THREE.Vector3()
    );

  const size =
    box.getSize(
      new THREE.Vector3()
    );


  object.position.sub(
    center
  );


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

    const normalization =
      2.0 / maxSize;

    object.scale.setScalar(
      normalization
    );
  }
}


function applyModelControls() {

  if (!modelRoot) {
    return;
  }


  modelRoot.scale.setScalar(
    1
  );


  trackingAnchor.position.set(
    modelOffsetX,
    modelOffsetY,
    modelOffsetZ
  );


  trackingAnchor.rotation.set(
    THREE.MathUtils.degToRad(
      modelRotationX
    ),

    THREE.MathUtils.degToRad(
      modelRotationY
    ),

    THREE.MathUtils.degToRad(
      modelRotationZ
    ),

    "YXZ"
  );


  updateModelTransform();
}


async function loadGLTF(
  file
) {

  const loader =
    new GLTFLoader();

  const url =
    URL.createObjectURL(file);

  try {

    const gltf =
      await loader.loadAsync(
        url
      );

    prepareModel(
      gltf.scene
    );

  } finally {

    URL.revokeObjectURL(
      url
    );
  }
}


async function loadOBJ(
  file
) {

  const loader =
    new OBJLoader();

  const url =
    URL.createObjectURL(file);

  try {

    const object =
      await loader.loadAsync(
        url
      );

    prepareModel(
      object
    );

  } finally {

    URL.revokeObjectURL(
      url
    );
  }
}


async function loadSTL(
  file
) {

  const loader =
    new STLLoader();

  const url =
    URL.createObjectURL(file);

  try {

    const geometry =
      await loader.loadAsync(
        url
      );


    geometry.computeVertexNormals();


    const material =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.15,
        roughness: 0.65
      });


    const mesh =
      new THREE.Mesh(
        geometry,
        material
      );


    prepareModel(
      mesh
    );

  } finally {

    URL.revokeObjectURL(
      url
    );
  }
}


async function loadFBX(
  file
) {

  const loader =
    new FBXLoader();

  const url =
    URL.createObjectURL(file);

  try {

    const object =
      await loader.loadAsync(
        url
      );

    prepareModel(
      object
    );

  } finally {

    URL.revokeObjectURL(
      url
    );
  }
}


async function load3DFile(
  file
) {

  if (!file) {
    return;
  }


  const name =
    file.name.toLowerCase();


  try {

    setStatus(
      "Loading 3D model..."
    );


    if (
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    ) {

      await loadGLTF(
        file
      );

    } else if (
      name.endsWith(".obj")
    ) {

      await loadOBJ(
        file
      );

    } else if (
      name.endsWith(".stl")
    ) {

      await loadSTL(
        file
      );

    } else if (
      name.endsWith(".fbx")
    ) {

      await loadFBX(
        file
      );

    } else {

      setStatus(
        "Unsupported 3D format"
      );

      return;
    }


    setStatus(
      "3D model attached to head"
    );

  } catch (error) {

    console.error(
      "3D model loading error:",
      error
    );

    setStatus(
      "3D model error: " +
      (
        error.message ||
        "Unable to load model"
      )
    );
  }
}


import3DButton.addEventListener(
  "click",
  () => {

    import3DInput.value = "";

    import3DInput.click();
  }
);


import3DInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files &&
      event.target.files[0];

    await load3DFile(
      file
    );
  }
);


scaleSlider.addEventListener(
  "input",
  () => {

    modelScale =
      Number(
        scaleSlider.value
      );

    updateModelTransform();
  }
);


xSlider.addEventListener(
  "input",
  () => {

    modelOffsetX =
      Number(
        xSlider.value
      );

    updateModelTransform();
  }
);


ySlider.addEventListener(
  "input",
  () => {

    modelOffsetY =
      Number(
        ySlider.value
      );

    updateModelTransform();
  }
);


zSlider.addEventListener(
  "input",
  () => {

    modelOffsetZ =
      Number(
        zSlider.value
      );

    updateModelTransform();
  }
);


rotateXSlider.addEventListener(
  "input",
  () => {

    modelRotationX =
      Number(
        rotateXSlider.value
      );

    updateModelTransform();
  }
);


rotateYSlider.addEventListener(
  "input",
  () => {

    modelRotationY =
      Number(
        rotateYSlider.value
      );

    updateModelTransform();
  }
);


rotateZSlider.addEventListener(
  "input",
  () => {

    modelRotationZ =
      Number(
        rotateZSlider.value
      );

    updateModelTransform();
  }
);


modelButton.addEventListener(
  "click",
  () => {

    import3DInput.value = "";

    import3DInput.click();
  }
);


resetButton.addEventListener(
  "click",
  () => {

    modelScale = 1;

    modelOffsetX = 0;
    modelOffsetY = 0;
    modelOffsetZ = 0;

    modelRotationX = 0;
    modelRotationY = 0;
    modelRotationZ = 0;

    scaleSlider.value = "1";

    xSlider.value = "0";
    ySlider.value = "0";
    zSlider.value = "0";

    rotateXSlider.value = "0";
    rotateYSlider.value = "0";
    rotateZSlider.value = "0";

    resetTrackingSmoothing();

    updateModelTransform();

    setStatus(
      "3D controls reset"
    );
  }
);hideControlsButton.addEventListener(
  "click",
  () => {

    appControls.classList.add(
      "hiddenControls"
    );

    showControlsButton.style.display =
      "block";

    document.body.classList.add(
      "fullscreenTracking"
    );

    setStatus(
      "Full screen tracking"
    );
  }
);


showControlsButton.addEventListener(
  "click",
  () => {

    appControls.classList.remove(
      "hiddenControls"
    );

    showControlsButton.style.display =
      "none";

    document.body.classList.remove(
      "fullscreenTracking"
    );

    setStatus(
      "Controls visible"
    );
  }
);


function createPhotoCanvas() {

  const output =
    document.createElement(
      "canvas"
    );

  output.width =
    video.videoWidth ||
    window.innerWidth;

  output.height =
    video.videoHeight ||
    window.innerHeight;


  const context =
    output.getContext(
      "2d"
    );


  context.drawImage(
    video,
    0,
    0,
    output.width,
    output.height
  );


  return output;
}


photoButton.addEventListener(
  "click",
  () => {

    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {

      setStatus(
        "Open camera first"
      );

      return;
    }


    renderer.render(
      scene,
      camera3D
    );


    const output =
      createPhotoCanvas();


    const context =
      output.getContext(
        "2d"
      );


    context.drawImage(
      canvas,
      0,
      0,
      output.width,
      output.height
    );


    const link =
      document.createElement(
        "a"
      );

    link.download =
      "azeez-ar-photo.png";

    link.href =
      output.toDataURL(
        "image/png"
      );

    link.click();


    setStatus(
      "Photo saved"
    );
  }
);


function getRecordingMimeType() {

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

      return type;
    }
  }


  return "";
}


async function startRecording() {

  if (
    !video.srcObject
  ) {

    setStatus(
      "Open camera first"
    );

    return;
  }


  try {

    renderer.render(
      scene,
      camera3D
    );


    const cameraStream =
      canvas.captureStream(
        30
      );


    const videoTrack =
      cameraStream.getVideoTracks()[0];


    const combinedStream =
      new MediaStream();


    if (videoTrack) {
      combinedStream.addTrack(
        videoTrack
      );
    }


    if (
      audioEnabled &&
      stream
    ) {

      stream
        .getAudioTracks()
        .forEach(track => {

          combinedStream.addTrack(
            track
          );
        });
    }


    const mimeType =
      getRecordingMimeType();


    const options =
      mimeType
        ? { mimeType }
        : {};


    recordedChunks = [];


    mediaRecorder =
      new MediaRecorder(
        combinedStream,
        options
      );


    mediaRecorder.ondataavailable =
      event => {

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
      () => {

        saveRecording();

        recording = false;

        recordButton.textContent =
          "Record";
      };


    mediaRecorder.start(
      250
    );


    recording = true;

    recordButton.textContent =
      "Stop";


    setStatus(
      audioEnabled
        ? "Recording with audio"
        : "Recording"
    );

  } catch (error) {

    console.error(
      "Recording error:",
      error
    );

    recording = false;

    recordButton.textContent =
      "Record";

    setStatus(
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

    setStatus(
      "Saving recording..."
    );
  }
}


function saveRecording() {

  if (
    recordedChunks.length === 0
  ) {

    setStatus(
      "No recording data"
    );

    return;
  }


  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          mediaRecorder.mimeType ||
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

  link.href = url;

  link.download =
    "azeez-ar-video.webm";

  link.click();


  setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );


  setStatus(
    "Recording saved"
  );
}


recordButton.addEventListener(
  "click",
  () => {

    if (recording) {

      stopRecording();

    } else {

      startRecording();
    }
  }
);


audioButton.addEventListener(
  "click",
  () => {

    audioEnabled =
      !audioEnabled;


    audioButton.textContent =
      audioEnabled
        ? "Audio On"
        : "Audio Off";


    setStatus(
      audioEnabled
        ? "Audio enabled"
        : "Audio disabled"
    );
  }
);


function prepareExportRoot() {

  if (!modelRoot) {
    return null;
  }


  const exportRoot =
    modelRoot.clone(
      true
    );


  exportRoot.updateMatrixWorld(
    true
  );


  return exportRoot;
}


async function exportGLTF(
  binary
) {

  const root =
    prepareExportRoot();


  if (!root) {

    setStatus(
      "Load a 3D model first"
    );

    return;
  }


  const exporter =
    new GLTFExporter();


  exporter.parse(
    root,
    result => {

      let blob;


      if (binary) {

        blob =
          new Blob(
            [result],
            {
              type:
                "model/gltf-binary"
            }
          );

      } else {

        const json =
          JSON.stringify(
            result,
            null,
            2
          );

        blob =
          new Blob(
            [json],
            {
              type:
                "application/json"
            }
          );
      }


      downloadBlob(
        blob,
        binary
          ? "azeez-model.glb"
          : "azeez-model.gltf"
      );

    },
    error => {

      console.error(
        "GLTF export error:",
        error
      );

      setStatus(
        "GLTF export failed"
      );
    },
    {
      binary
    }
  );
}


function exportOBJ() {

  const root =
    prepareExportRoot();


  if (!root) {

    setStatus(
      "Load a 3D model first"
    );

    return;
  }


  try {

    const exporter =
      new OBJExporter();


    const result =
      exporter.parse(
        root
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
      "azeez-model.obj"
    );


    setStatus(
      "OBJ exported"
    );

  } catch (error) {

    console.error(
      "OBJ export error:",
      error
    );

    setStatus(
      "OBJ export failed"
    );
  }
}


function downloadBlob(
  blob,
  filename
) {

  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    filename;

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
}


export3DButton.addEventListener(
  "click",
  async () => {

    const format =
      exportFormat.value;


    if (format === "glb") {

      await exportGLTF(
        true
      );

    } else if (
      format === "gltf"
    ) {

      await exportGLTF(
        false
      );

    } else if (
      format === "obj"
    ) {

      exportOBJ();
    }
  }
);function ensureModelVisible() {

  if (!modelRoot) {
    return;
  }

  modelRoot.visible = true;

  modelRoot.traverse(object => {

    if (object.isMesh) {

      object.visible = true;

      if (object.material) {

        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach(material => {

          material.transparent = false;

          material.opacity = 1;

          material.depthWrite = true;

          material.needsUpdate = true;
        });
      }
    }
  });
}


function keepTrackingAnchorReady() {

  if (!headAnchor) {
    return;
  }

  headAnchor.visible = true;

  headAnchor.updateMatrixWorld(
    true
  );
}


function animationSafetyUpdate() {

  keepTrackingAnchorReady();

  ensureModelVisible();

  if (
    modelRoot &&
    trackingEnabled
  ) {
    updateModelTransform();
  }
}


const originalRenderLoop =
  renderLoop;


function finalAnimationLoop() {

  requestAnimationFrame(
    finalAnimationLoop
  );

  updateTracking();

  animationSafetyUpdate();

  renderer.render(
    scene,
    camera3D
  );
}


function updateCanvasSizeFromVideo() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return;
  }

  const width =
    window.innerWidth;

  const height =
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


video.addEventListener(
  "loadedmetadata",
  () => {

    updateCanvasSizeFromVideo();

    setStatus(
      "Camera ready"
    );
  }
);


window.addEventListener(
  "orientationchange",
  () => {

    setTimeout(
      updateCanvasSizeFromVideo,
      250
    );
  }
);


document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      lastVideoTime = -1;

      updateCanvasSizeFromVideo();
    }
  }
);


window.addEventListener(
  "beforeunload",
  () => {

    stopCamera();

    if (
      mediaRecorder &&
      mediaRecorder.state !==
        "inactive"
    ) {

      mediaRecorder.stop();
    }
  }
);


function initializeDefaultState() {

  cameraMirrored = false;

  currentFacingMode =
    "user";

  trackingEnabled = true;

  trackingReady = false;

  recording = false;

  audioEnabled = false;

  modelScale = 1;

  modelOffsetX = 0;
  modelOffsetY = 0;
  modelOffsetZ = 0;

  modelRotationX = 0;
  modelRotationY = 0;
  modelRotationZ = 0;


  scaleSlider.value = "1";

  xSlider.value = "0";
  ySlider.value = "0";
  zSlider.value = "0";

  rotateXSlider.value = "0";
  rotateYSlider.value = "0";
  rotateZSlider.value = "0";


  trackingButton.textContent =
    "Tracking";

  audioButton.textContent =
    "Audio Off";

  recordButton.textContent =
    "Record";


  updateCameraMirror();

  resetTrackingSmoothing();

  updateModelTransform();
}


initializeDefaultState();


cameraButton.addEventListener(
  "dblclick",
  () => {

    openCamera();
  }
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      appControls.classList.remove(
        "hiddenControls"
      );

      showControlsButton.style.display =
        "none";

      document.body.classList.remove(
        "fullscreenTracking"
      );
    }
  }
);


setTimeout(
  () => {

    setStatus(
      "Ready - Open Camera"
    );

  },
  100
);


finalAnimationLoop();
