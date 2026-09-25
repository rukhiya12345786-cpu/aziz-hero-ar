// ======================================================
// AZIZ HERO AR
// app.js — PART 1 / 5
// Camera + Three.js + Basic 3D Model
// ======================================================

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


// ======================================================
// BASIC ELEMENTS
// ======================================================

const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const statusBox = document.getElementById("status");

const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById("switchCameraButton");

const photoButton =
  document.getElementById("photoButton");

const recordButton =
  document.getElementById("recordButton");

const audioButton =
  document.getElementById("audioButton");

const import3DButton =
  document.getElementById("import3DButton");

const modelButton =
  document.getElementById("modelButton");

const export3DButton =
  document.getElementById("export3DButton");

const resetButton =
  document.getElementById("resetButton");

const import3DInput =
  document.getElementById("import3DInput");

const modelPanel =
  document.getElementById("modelPanel");


// ======================================================
// STATUS
// ======================================================

function setStatus(message) {

  if (statusBox) {
    statusBox.textContent = message;
  }

}


// ======================================================
// CAMERA VARIABLES
// ======================================================

let mediaStream = null;

let cameraFacing = "user";


// ======================================================
// THREE.JS VARIABLES
// ======================================================

let renderer;
let scene;
let arCamera;

let currentModel = null;


// ======================================================
// INITIALIZE THREE.JS
// ======================================================

function initThree() {

  renderer = new THREE.WebGLRenderer({

    canvas: canvas,

    alpha: true,

    antialias: true,

    preserveDrawingBuffer: true

  });


  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );


  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );


  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  scene = new THREE.Scene();


  arCamera = new THREE.PerspectiveCamera(

    45,

    window.innerWidth /
    window.innerHeight,

    0.01,

    100

  );


  arCamera.position.set(
    0,
    0,
    5
  );


  // LIGHT 1

  const ambientLight =
    new THREE.AmbientLight(
      0xffffff,
      1.5
    );

  scene.add(ambientLight);


  // LIGHT 2

  const directionalLight =
    new THREE.DirectionalLight(
      0xffffff,
      2
    );

  directionalLight.position.set(
    2,
    3,
    5
  );

  scene.add(directionalLight);


  // DEFAULT 3D CUBE

  createDefaultModel();


  // START RENDER LOOP

  animate();

}


// ======================================================
// DEFAULT 3D MODEL
// ======================================================

function createDefaultModel() {

  if (currentModel) {

    scene.remove(currentModel);

    currentModel = null;

  }


  const geometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );


  const material =
    new THREE.MeshStandardMaterial({

      color: 0x2196f3,

      roughness: 0.55,

      metalness: 0.15

    });


  const cube =
    new THREE.Mesh(
      geometry,
      material
    );


  cube.position.set(
    0,
    0,
    0
  );


  cube.rotation.set(
    0,
    0,
    0
  );


  cube.scale.set(
    1,
    1,
    1
  );


  currentModel = cube;

  scene.add(currentModel);

}


// ======================================================
// RENDER LOOP
// ======================================================

function animate() {

  requestAnimationFrame(animate);


  if (currentModel) {

    currentModel.rotation.y += 0.008;

  }


  renderer.render(
    scene,
    arCamera
  );

}


// ======================================================
// CAMERA START
// ======================================================

async function startCamera() {

  try {

    setStatus("Camera starting...");


    // STOP OLD CAMERA

    if (mediaStream) {

      mediaStream
        .getTracks()
        .forEach(track => track.stop());

    }


    // REQUEST CAMERA + MICROPHONE

    mediaStream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: cameraFacing
          },

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          }

        },

        audio: true

      });


    video.srcObject =
      mediaStream;


    await video.play();


    // FRONT CAMERA MIRROR

    if (cameraFacing === "user") {

      video.classList.add(
        "camera-mirrored"
      );

    } else {

      video.classList.remove(
        "camera-mirrored"
      );

    }


    setStatus("Camera Ready");

  }

  catch (error) {

    console.error(
      "Camera Error:",
      error
    );

    setStatus(
      "Camera permission required"
    );

  }

}


// ======================================================
// CAMERA BUTTON
// ======================================================

cameraButton?.addEventListener(
  "click",
  startCamera
);


// ======================================================
// SWITCH FRONT / BACK CAMERA
// ======================================================

switchCameraButton?.addEventListener(
  "click",
  async () => {

    cameraFacing =
      cameraFacing === "user"
        ? "environment"
        : "user";


    await startCamera();

  }
);


// ======================================================
// WINDOW RESIZE
// ======================================================

window.addEventListener(
  "resize",
  () => {

    if (!renderer || !arCamera) {
      return;
    }


    arCamera.aspect =
      window.innerWidth /
      window.innerHeight;


    arCamera.updateProjectionMatrix();


    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

  }
);


// ======================================================
// 3D PANEL OPEN / CLOSE
// ======================================================

modelButton?.addEventListener(
  "click",
  () => {

    modelPanel?.classList.toggle(
      "show"
    );

  }
);


// ======================================================
// INITIALIZE
// ======================================================

initThree();

setStatus(
  "Ready — Tap ▶"
);// ======================================================
// AZIZ HERO AR
// app.js — PART 2 / 5
// 3D POSITION + ROTATION + SCALE CONTROLS
// ======================================================


// ======================================================
// SLIDER ELEMENTS
// ======================================================

const posX =
  document.getElementById("posX");

const posY =
  document.getElementById("posY");

const posZ =
  document.getElementById("posZ");

const rotX =
  document.getElementById("rotX");

const rotY =
  document.getElementById("rotY");

const rotZ =
  document.getElementById("rotZ");

const scaleControl =
  document.getElementById("scale");


// ======================================================
// VALUE LABELS
// ======================================================

const posXValue =
  document.getElementById("posXValue");

const posYValue =
  document.getElementById("posYValue");

const posZValue =
  document.getElementById("posZValue");

const rotXValue =
  document.getElementById("rotXValue");

const rotYValue =
  document.getElementById("rotYValue");

const rotZValue =
  document.getElementById("rotZValue");

const scaleValue =
  document.getElementById("scaleValue");


// ======================================================
// DEGREES TO RADIANS
// ======================================================

function degreesToRadians(degrees) {

  return (
    Number(degrees) *
    Math.PI /
    180
  );

}


// ======================================================
// UPDATE MODEL POSITION
// ======================================================

function updateModelPosition() {

  if (!currentModel) {
    return;
  }


  const x =
    Number(posX?.value || 0);

  const y =
    Number(posY?.value || 0);

  const z =
    Number(posZ?.value || 0);


  currentModel.position.set(
    x,
    y,
    z
  );


  if (posXValue) {
    posXValue.textContent =
      x.toFixed(2);
  }


  if (posYValue) {
    posYValue.textContent =
      y.toFixed(2);
  }


  if (posZValue) {
    posZValue.textContent =
      z.toFixed(2);
  }

}


// ======================================================
// UPDATE MODEL ROTATION
// ======================================================

function updateModelRotation() {

  if (!currentModel) {
    return;
  }


  const x =
    Number(rotX?.value || 0);

  const y =
    Number(rotY?.value || 0);

  const z =
    Number(rotZ?.value || 0);


  currentModel.rotation.set(

    degreesToRadians(x),

    degreesToRadians(y),

    degreesToRadians(z)

  );


  if (rotXValue) {
    rotXValue.textContent =
      `${x}°`;
  }


  if (rotYValue) {
    rotYValue.textContent =
      `${y}°`;
  }


  if (rotZValue) {
    rotZValue.textContent =
      `${z}°`;
  }

}


// ======================================================
// UPDATE MODEL SCALE
// ======================================================

function updateModelScale() {

  if (!currentModel) {
    return;
  }


  const value =
    Number(
      scaleControl?.value || 1
    );


  currentModel.scale.set(
    value,
    value,
    value
  );


  if (scaleValue) {

    scaleValue.textContent =
      value.toFixed(2);

  }

}


// ======================================================
// POSITION SLIDERS
// ======================================================

posX?.addEventListener(
  "input",
  updateModelPosition
);


posY?.addEventListener(
  "input",
  updateModelPosition
);


posZ?.addEventListener(
  "input",
  updateModelPosition
);


// ======================================================
// ROTATION SLIDERS
// ======================================================

rotX?.addEventListener(
  "input",
  updateModelRotation
);


rotY?.addEventListener(
  "input",
  updateModelRotation
);


rotZ?.addEventListener(
  "input",
  updateModelRotation
);


// ======================================================
// SCALE SLIDER
// ======================================================

scaleControl?.addEventListener(
  "input",
  updateModelScale
);


// ======================================================
// RESET 3D CONTROLS
// ======================================================

function reset3DControls() {

  if (posX) {
    posX.value = 0;
  }

  if (posY) {
    posY.value = 0;
  }

  if (posZ) {
    posZ.value = 0;
  }


  if (rotX) {
    rotX.value = 0;
  }

  if (rotY) {
    rotY.value = 0;
  }

  if (rotZ) {
    rotZ.value = 0;
  }


  if (scaleControl) {
    scaleControl.value = 1;
  }


  updateModelPosition();

  updateModelRotation();

  updateModelScale();

}


// ======================================================
// RESET BUTTON
// ======================================================

resetButton?.addEventListener(
  "click",
  () => {

    reset3DControls();

    if (currentModel) {

      currentModel.rotation.y = 0;

    }


    setStatus(
      "3D Reset"
    );

  }
);


// ======================================================
// INITIALIZE SLIDER VALUES
// ======================================================

updateModelPosition();

updateModelRotation();

updateModelScale();


// ======================================================
// IMPORT 3D BUTTON
// ======================================================

import3DButton?.addEventListener(
  "click",
  () => {

    import3DInput?.click();

  }
);


// ======================================================
// GLB / GLTF LOADER
// ======================================================

const gltfLoader =
  new GLTFLoader();


// ======================================================
// IMPORT GLB / GLTF
// ======================================================

function loadGLTFModel(file) {

  const reader =
    new FileReader();


  reader.onload =
    event => {

      try {

        gltfLoader.parse(

          event.target.result,

          "",

          gltf => {

            if (currentModel) {

              scene.remove(
                currentModel
              );

            }


            currentModel =
              gltf.scene;


            currentModel.position.set(
              0,
              0,
              0
            );


            currentModel.rotation.set(
              0,
              0,
              0
            );


            currentModel.scale.set(
              1,
              1,
              1
            );


            scene.add(
              currentModel
            );


            reset3DControls();


            setStatus(
              "3D Model Loaded"
            );

          },

          error => {

            console.error(
              "GLTF Error:",
              error
            );

            setStatus(
              "3D Model Load Failed"
            );

          }

        );

      }

      catch (error) {

        console.error(
          error
        );

        setStatus(
          "Invalid 3D File"
        );

      }

    };


  reader.readAsArrayBuffer(
    file
  );

}


// ======================================================
// FILE SELECT
// ======================================================

import3DInput?.addEventListener(
  "change",
  event => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    const name =
      file.name.toLowerCase();


    if (
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    ) {

      loadGLTFModel(file);

    } else {

      setStatus(
        "Use GLB / GLTF for now"
      );

    }


    // Allow selecting same file again

    event.target.value = "";

  }
);// ======================================================
// AZIZ HERO AR
// app.js — PART 3 / 5
// 3D IMPORT + PHOTO CAPTURE
// ======================================================


// ======================================================
// ADDITIONAL THREE.JS LOADERS
// ======================================================

import {
  OBJLoader
} from "three/addons/loaders/OBJLoader.js";

import {
  STLLoader
} from "three/addons/loaders/STLLoader.js";


// ======================================================
// LOADERS
// ======================================================

const objLoader =
  new OBJLoader();

const stlLoader =
  new STLLoader();


// ======================================================
// REMOVE OLD MODEL
// ======================================================

function removeCurrentModel() {

  if (!currentModel) {
    return;
  }


  scene.remove(
    currentModel
  );


  currentModel.traverse(
    object => {

      if (object.geometry) {
        object.geometry.dispose();
      }


      if (object.material) {

        if (Array.isArray(
          object.material
        )) {

          object.material.forEach(
            material => {

              material.dispose();

            }
          );

        } else {

          object.material.dispose();

        }

      }

    }
  );


  currentModel = null;

}


// ======================================================
// CENTER AND NORMALIZE MODEL
// ======================================================

function prepareModel(model) {

  const box =
    new THREE.Box3()
      .setFromObject(model);


  const center =
    box.getCenter(
      new THREE.Vector3()
    );


  const size =
    box.getSize(
      new THREE.Vector3()
    );


  model.position.sub(
    center
  );


  const maxSize =
    Math.max(
      size.x,
      size.y,
      size.z
    );


  if (
    maxSize > 0 &&
    Number.isFinite(maxSize)
  ) {

    const targetSize = 2;

    const scale =
      targetSize /
      maxSize;

    model.scale.setScalar(
      scale
    );

  }


  model.position.set(
    0,
    0,
    0
  );


  model.rotation.set(
    0,
    0,
    0
  );

}


// ======================================================
// LOAD OBJ
// ======================================================

function loadOBJModel(file) {

  const reader =
    new FileReader();


  reader.onload =
    event => {

      try {

        const text =
          event.target.result;


        const object =
          objLoader.parse(
            text
          );


        removeCurrentModel();


        currentModel =
          object;


        prepareModel(
          currentModel
        );


        scene.add(
          currentModel
        );


        reset3DControls();


        setStatus(
          "OBJ Model Loaded"
        );

      }

      catch (error) {

        console.error(
          "OBJ Error:",
          error
        );

        setStatus(
          "OBJ Load Failed"
        );

      }

    };


  reader.readAsText(
    file
  );

}


// ======================================================
// LOAD STL
// ======================================================

function loadSTLModel(file) {

  const reader =
    new FileReader();


  reader.onload =
    event => {

      try {

        const geometry =
          stlLoader.parse(
            event.target.result
          );


        geometry.computeVertexNormals();


        const material =
          new THREE.MeshStandardMaterial({

            color: 0xcccccc,

            roughness: 0.55,

            metalness: 0.15

          });


        const mesh =
          new THREE.Mesh(
            geometry,
            material
          );


        removeCurrentModel();


        currentModel =
          mesh;


        prepareModel(
          currentModel
        );


        scene.add(
          currentModel
        );


        reset3DControls();


        setStatus(
          "STL Model Loaded"
        );

      }

      catch (error) {

        console.error(
          "STL Error:",
          error
        );

        setStatus(
          "STL Load Failed"
        );

      }

    };


  reader.readAsArrayBuffer(
    file
  );

}


// ======================================================
// REPLACE IMPORT HANDLER
// ======================================================

import3DInput?.addEventListener(
  "change",
  event => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    const name =
      file.name.toLowerCase();


    if (
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    ) {

      loadGLTFModel(
        file
      );

    }

    else if (
      name.endsWith(".obj")
    ) {

      loadOBJModel(
        file
      );

    }

    else if (
      name.endsWith(".stl")
    ) {

      loadSTLModel(
        file
      );

    }

    else if (
      name.endsWith(".fbx")
    ) {

      setStatus(
        "FBX loader will be added next"
      );

    }

    else {

      setStatus(
        "Unsupported 3D file"
      );

    }


    event.target.value = "";

  }
);


// ======================================================
// PHOTO CAPTURE
// ======================================================

function takePhoto() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {

    setStatus(
      "Start camera first"
    );

    return;

  }


  const output =
    document.createElement(
      "canvas"
    );


  output.width =
    video.videoWidth;

  output.height =
    video.videoHeight;


  const ctx =
    output.getContext(
      "2d"
    );


  if (!ctx) {

    setStatus(
      "Photo failed"
    );

    return;

  }


  // CAMERA IMAGE

  if (cameraFacing === "user") {

    ctx.save();

    ctx.translate(
      output.width,
      0
    );

    ctx.scale(
      -1,
      1
    );

    ctx.drawImage(
      video,
      0,
      0,
      output.width,
      output.height
    );

    ctx.restore();

  } else {

    ctx.drawImage(
      video,
      0,
      0,
      output.width,
      output.height
    );

  }


  // 3D OVERLAY

  if (canvas.width && canvas.height) {

    ctx.drawImage(
      canvas,
      0,
      0,
      output.width,
      output.height
    );

  }


  output.toBlob(
    blob => {

      if (!blob) {

        setStatus(
          "Photo failed"
        );

        return;

      }


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
        `aziz-ar-photo-${Date.now()}.png`;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );


      setStatus(
        "Photo Saved"
      );

    },

    "image/png"

  );

}


// ======================================================
// PHOTO BUTTON
// ======================================================

photoButton?.addEventListener(
  "click",
  takePhoto
);


// ======================================================
// BASIC FACE POSITION HELPER
// ======================================================

// This will be connected to MediaPipe
// in Part 4.

function moveModelToFace(
  x,
  y,
  z = 0
) {

  if (!currentModel) {
    return;
  }


  currentModel.position.x =
    Number(x) || 0;


  currentModel.position.y =
    Number(y) || 0;


  currentModel.position.z =
    Number(z) || 0;

}


// ======================================================
// PART 3 END
// ======================================================// ======================================================
// AZIZ HERO AR
// app.js — PART 4 / 5
// FACE TRACKING + VIDEO RECORDING
// ======================================================


// ======================================================
// MEDIAPIPE
// ======================================================

import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


// ======================================================
// FACE TRACKING VARIABLES
// ======================================================

let faceLandmarker = null;

let faceTrackingReady = false;

let lastFaceX = 0;

let lastFaceY = 0;


// ======================================================
// MEDIAPIPE INITIALIZE
// ======================================================

async function initFaceTracking() {

  try {

    setStatus(
      "Loading face tracking..."
    );


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
              "./models/face_landmarker.task"

          },

          runningMode:
            "VIDEO",

          numFaces:
            1,

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


    faceTrackingReady = true;


    setStatus(
      "Face Tracking Ready"
    );


  } catch (error) {

    console.error(
      "Face Tracking Error:",
      error
    );


    faceTrackingReady = false;


    setStatus(
      "Face Tracking Failed"
    );

  }

}


// ======================================================
// FACE TRACKING
// ======================================================

function updateFaceTracking() {

  if (
    !faceTrackingReady ||
    !faceLandmarker ||
    video.readyState < 2
  ) {

    return;

  }


  try {

    const now =
      performance.now();


    const result =
      faceLandmarker.detectForVideo(
        video,
        now
      );


    if (
      result.faceLandmarks &&
      result.faceLandmarks.length > 0
    ) {

      const landmarks =
        result.faceLandmarks[0];


      // NOSE LANDMARK

      const nose =
        landmarks[1];


      if (nose) {

        const targetX =
          (nose.x - 0.5) * 4;


        const targetY =
          -(nose.y - 0.5) * 3;


        // SMOOTH MOVEMENT

        lastFaceX +=
          (targetX - lastFaceX) *
          0.15;


        lastFaceY +=
          (targetY - lastFaceY) *
          0.15;


        if (currentModel) {

          currentModel.position.x =
            lastFaceX;


          currentModel.position.y =
            lastFaceY;

        }

      }

    }

  } catch (error) {

    console.warn(
      "Face tracking frame error:",
      error
    );

  }

}


// ======================================================
// ADD FACE TRACKING TO ANIMATION
// ======================================================

const originalAnimate =
  animate;


// Keep the existing render loop working.
// Face tracking runs separately.

function faceTrackingLoop() {

  updateFaceTracking();

  requestAnimationFrame(
    faceTrackingLoop
  );

}

faceTrackingLoop();


// ======================================================
// VIDEO RECORDING
// ======================================================

let videoRecorder = null;

let recordedVideoChunks = [];

let recordingCanvas = null;

let recordingContext = null;

let recordingStream = null;

let recordingAnimation = null;


// ======================================================
// CREATE RECORDING CANVAS
// ======================================================

function createRecordingCanvas() {

  if (recordingCanvas) {
    return;
  }


  recordingCanvas =
    document.createElement(
      "canvas"
    );


  recordingCanvas.width =
    1280;

  recordingCanvas.height =
    720;


  recordingContext =
    recordingCanvas.getContext(
      "2d"
    );

}


// ======================================================
// DRAW CAMERA + 3D
// ======================================================

function drawRecordingFrame() {

  if (
    !recordingContext ||
    !recordingCanvas
  ) {

    return;

  }


  const ctx =
    recordingContext;


  const width =
    recordingCanvas.width;

  const height =
    recordingCanvas.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  // CAMERA

  if (video.readyState >= 2) {

    if (cameraFacing === "user") {

      ctx.save();

      ctx.translate(
        width,
        0
      );

      ctx.scale(
        -1,
        1
      );

      ctx.drawImage(
        video,
        0,
        0,
        width,
        height
      );

      ctx.restore();

    } else {

      ctx.drawImage(
        video,
        0,
        0,
        width,
        height
      );

    }

  }


  // 3D CANVAS

  if (
    canvas &&
    canvas.width > 0 &&
    canvas.height > 0
  ) {

    ctx.drawImage(
      canvas,
      0,
      0,
      width,
      height
    );

  }


  if (videoRecorder) {

    recordingAnimation =
      requestAnimationFrame(
        drawRecordingFrame
      );

  }

}


// ======================================================
// START VIDEO RECORDING
// ======================================================

function startVideoRecording() {

  if (!mediaStream) {

    setStatus(
      "Start camera first"
    );

    return;

  }


  if (
    !window.MediaRecorder
  ) {

    setStatus(
      "Video recording not supported"
    );

    return;

  }


  createRecordingCanvas();


  const canvasStream =
    recordingCanvas.captureStream(
      30
    );


  const audioTracks =
    mediaStream.getAudioTracks();


  audioTracks.forEach(
    track => {

      canvasStream.addTrack(
        track
      );

    }
  );


  recordingStream =
    canvasStream;


  recordedVideoChunks = [];


  let mimeType =
    "video/webm;codecs=vp9";


  if (
    !MediaRecorder.isTypeSupported(
      mimeType
    )
  ) {

    mimeType =
      "video/webm";

  }


  try {

    videoRecorder =
      new MediaRecorder(
        recordingStream,
        {
          mimeType
        }
      );

  } catch (error) {

    console.error(
      error
    );

    setStatus(
      "Recording unavailable"
    );

    return;

  }


  videoRecorder.ondataavailable =
    event => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordedVideoChunks.push(
          event.data
        );

      }

    };


  videoRecorder.onstop =
    saveRecordedVideo;


  videoRecorder.start(
    250
  );


  recordButton?.classList.add(
    "recording"
  );


  recordButton.textContent =
    "⏹";


  setStatus(
    "Recording..."
  );


  drawRecordingFrame();

}


// ======================================================
// STOP VIDEO RECORDING
// ======================================================

function stopVideoRecording() {

  if (!videoRecorder) {
    return;
  }


  if (
    videoRecorder.state !==
    "inactive"
  ) {

    videoRecorder.stop();

  }


  if (recordingAnimation) {

    cancelAnimationFrame(
      recordingAnimation
    );

    recordingAnimation =
      null;

  }


  recordButton?.classList.remove(
    "recording"
  );


  recordButton.textContent =
    "⏺";

}


// ======================================================
// SAVE VIDEO
// ======================================================

function saveRecordedVideo() {

  const blob =
    new Blob(
      recordedVideoChunks,
      {
        type:
          videoRecorder?.mimeType ||
          "video/webm"
      }
    );


  if (!blob.size) {

    setStatus(
      "Video recording failed"
    );

    videoRecorder = null;

    return;

  }


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
    `aziz-ar-video-${Date.now()}.webm`;


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
    2000
  );


  recordedVideoChunks = [];

  videoRecorder = null;

  recordingStream = null;


  setStatus(
    "Video Saved"
  );

}


// ======================================================
// RECORD BUTTON
// ======================================================

recordButton?.addEventListener(
  "click",
  () => {

    if (
      videoRecorder &&
      videoRecorder.state ===
      "recording"
    ) {

      stopVideoRecording();

    } else {

      startVideoRecording();

    }

  }
);


// ======================================================
// START FACE TRACKING
// ======================================================

initFaceTracking();


// ======================================================
// PART 4 END
// ======================================================// ======================================================
// AZIZ HERO AR
// app.js — PART 5 / 5
// AUDIO + 3D EXPORT + EXTRA CONTROLS
// ======================================================


// ======================================================
// AUDIO RECORDING
// ======================================================

let audioRecorder = null;

let audioChunks = [];

let audioStream = null;


// ======================================================
// START AUDIO RECORDING
// ======================================================

async function startAudioRecording() {

  try {

    if (!window.MediaRecorder) {

      setStatus(
        "Audio recording not supported"
      );

      return;

    }


    audioStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });


    audioChunks = [];


    audioRecorder =
      new MediaRecorder(
        audioStream
      );


    audioRecorder.ondataavailable =
      event => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          audioChunks.push(
            event.data
          );

        }

      };


    audioRecorder.onstop =
      saveAudioRecording;


    audioRecorder.start();


    audioButton?.classList.add(
      "recording"
    );


    audioButton.textContent =
      "⏹";


    setStatus(
      "Audio Recording..."
    );

  }

  catch (error) {

    console.error(
      "Audio Error:",
      error
    );


    setStatus(
      "Microphone permission required"
    );

  }

}


// ======================================================
// STOP AUDIO RECORDING
// ======================================================

function stopAudioRecording() {

  if (!audioRecorder) {
    return;
  }


  if (
    audioRecorder.state !==
    "inactive"
  ) {

    audioRecorder.stop();

  }


  audioButton?.classList.remove(
    "recording"
  );


  audioButton.textContent =
    "🎙";

}


// ======================================================
// SAVE AUDIO
// ======================================================

function saveAudioRecording() {

  const blob =
    new Blob(
      audioChunks,
      {
        type:
          audioRecorder?.mimeType ||
          "audio/webm"
      }
    );


  if (!blob.size) {

    setStatus(
      "Audio recording failed"
    );

    audioRecorder = null;

    return;

  }


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
    `aziz-ar-audio-${Date.now()}.webm`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {
      URL.revokeObjectURL(url);
    },
    2000
  );


  if (audioStream) {

    audioStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

  }


  audioStream = null;

  audioRecorder = null;

  audioChunks = [];


  setStatus(
    "Audio Saved"
  );

}


// ======================================================
// AUDIO BUTTON
// ======================================================

audioButton?.addEventListener(
  "click",
  () => {

    if (
      audioRecorder &&
      audioRecorder.state ===
      "recording"
    ) {

      stopAudioRecording();

    } else {

      startAudioRecording();

    }

  }
);


// ======================================================
// EXPORT HELPERS
// ======================================================

function downloadBlob(
  blob,
  filename
) {

  if (!blob) {

    setStatus(
      "Export failed"
    );

    return;

  }


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
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {
      URL.revokeObjectURL(url);
    },
    2000
  );

}


// ======================================================
// EXPORT GLB
// ======================================================

async function exportGLB() {

  if (!currentModel) {

    setStatus(
      "No 3D model"
    );

    return;

  }


  try {

    const { GLTFExporter } =
      await import(
        "three/addons/exporters/GLTFExporter.js"
      );


    const exporter =
      new GLTFExporter();


    exporter.parse(

      currentModel,

      result => {

        const json =
          JSON.stringify(
            result
          );


        const blob =
          new Blob(
            [json],
            {
              type:
                "model/gltf+json"
            }
          );


        downloadBlob(
          blob,
          `aziz-model-${Date.now()}.gltf`
        );


        setStatus(
          "GLTF Exported"
        );

      },

      error => {

        console.error(
          error
        );

        setStatus(
          "GLTF Export Failed"
        );

      },

      {
        binary: false
      }

    );

  }

  catch (error) {

    console.error(
      error
    );

    setStatus(
      "GLTF Export Failed"
    );

  }

}


// ======================================================
// EXPORT GLTF / GLB
// ======================================================

async function exportGLTF(
  binary = true
) {

  if (!currentModel) {

    setStatus(
      "No 3D model"
    );

    return;

  }


  try {

    const { GLTFExporter } =
      await import(
        "three/addons/exporters/GLTFExporter.js"
      );


    const exporter =
      new GLTFExporter();


    exporter.parse(

      currentModel,

      result => {

        if (binary) {

          const blob =
            new Blob(
              [result],
              {
                type:
                  "model/gltf-binary"
              }
            );


          downloadBlob(
            blob,
            `aziz-model-${Date.now()}.glb`
          );


          setStatus(
            "GLB Exported"
          );

        } else {

          const json =
            JSON.stringify(
              result,
              null,
              2
            );


          const blob =
            new Blob(
              [json],
              {
                type:
                  "model/gltf+json"
              }
            );


          downloadBlob(
            blob,
            `aziz-model-${Date.now()}.gltf`
          );


          setStatus(
            "GLTF Exported"
          );

        }

      },

      error => {

        console.error(
          error
        );

        setStatus(
          "3D Export Failed"
        );

      },

      {
        binary
      }

    );

  }

  catch (error) {

    console.error(
      error
    );

    setStatus(
      "Export Error"
    );

  }

}


// ======================================================
// EXPORT OBJ
// ======================================================

async function exportOBJ() {

  if (!currentModel) {

    setStatus(
      "No 3D model"
    );

    return;

  }


  try {

    const { OBJExporter } =
      await import(
        "three/addons/exporters/OBJExporter.js"
      );


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
      `aziz-model-${Date.now()}.obj`
    );


    setStatus(
      "OBJ Exported"
    );

  }

  catch (error) {

    console.error(
      error
    );

    setStatus(
      "OBJ Export Failed"
    );

  }

}


// ======================================================
// EXPORT STL
// ======================================================

async function exportSTL() {

  if (!currentModel) {

    setStatus(
      "No 3D model"
    );

    return;

  }


  try {

    const { STLExporter } =
      await import(
        "three/addons/exporters/STLExporter.js"
      );


    const exporter =
      new STLExporter();


    const result =
      exporter.parse(
        currentModel
      );


    const blob =
      new Blob(
        [result],
        {
          type:
            "application/octet-stream"
        }
      );


    downloadBlob(
      blob,
      `aziz-model-${Date.now()}.stl`
    );


    setStatus(
      "STL Exported"
    );

  }

  catch (error) {

    console.error(
      error
    );

    setStatus(
      "STL Export Failed"
    );

  }

}


// ======================================================
// EXPORT BUTTON
// ======================================================

export3DButton?.addEventListener(
  "click",
  async () => {

    if (!currentModel) {

      setStatus(
        "No 3D model"
      );

      return;

    }


    // Simple export:
    // GLB is the main recommended format.

    await exportGLTF(true);

  }
);


// ======================================================
// ZOOM BUTTONS
// ======================================================

const zoomInButton =
  document.getElementById(
    "zoomInButton"
  );

const zoomOutButton =
  document.getElementById(
    "zoomOutButton"
  );


zoomInButton?.addEventListener(
  "click",
  () => {

    if (!currentModel) {
      return;
    }


    currentModel.scale.multiplyScalar(
      1.15
    );


    const value =
      currentModel.scale.x;


    if (scaleControl) {

      scaleControl.value =
        Math.min(
          4,
          value
        );

    }


    updateModelScale();

  }
);


zoomOutButton?.addEventListener(
  "click",
  () => {

    if (!currentModel) {
      return;
    }


    currentModel.scale.multiplyScalar(
      0.87
    );


    const value =
      currentModel.scale.x;


    if (scaleControl) {

      scaleControl.value =
        Math.max(
          0.1,
          value
        );

    }


    updateModelScale();

  }
);


// ======================================================
// HIDE / SHOW CONTROLS
// ======================================================

const hideControlsButton =
  document.getElementById(
    "hideControlsButton"
  );


let controlsHidden = false;


hideControlsButton?.addEventListener(
  "click",
  () => {

    controlsHidden =
      !controlsHidden;


    if (sideControls) {

      sideControls.style.display =
        controlsHidden
          ? "none"
          : "flex";

    }


    if (modelPanel) {

      modelPanel.classList.remove(
        "show"
      );

    }

  }
);


// ======================================================
// PAGE VISIBILITY
// ======================================================

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.hidden &&
      videoRecorder &&
      videoRecorder.state ===
      "recording"
    ) {

      stopVideoRecording();

    }

  }
);


// ======================================================
// FINAL READY
// ======================================================

setStatus(
  "Aziz Hero AR Ready"
);


// ======================================================
// app.js COMPLETE
// ======================================================
