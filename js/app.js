import * as THREE from "three";

import { GLTFLoader } from
  "three/addons/loaders/GLTFLoader.js";

import { OBJLoader } from
  "three/addons/loaders/OBJLoader.js";

import { STLLoader } from
  "three/addons/loaders/STLLoader.js";

import { GLTFExporter } from
  "three/addons/exporters/GLTFExporter.js";

import { OBJExporter } from
  "three/addons/exporters/OBJExporter.js";

"use strict";

const $ = (id) =>
  document.getElementById(id);

const el = {
  video: $("camera"),
  canvas: $("threeCanvas"),
  status: $("status"),

  cameraButton:
    $("cameraButton"),

  switchCameraButton:
    $("switchCameraButton"),

  photoButton:
    $("photoButton"),

  recordButton:
    $("recordButton"),

  audioButton:
    $("audioButton"),

  import3DButton:
    $("import3DButton"),

  import3DInput:
    $("import3DInput"),

  export3DButton:
    $("export3DButton"),

  exportFormat:
    $("exportFormat"),

  resetButton:
    $("resetButton"),

  modelButton:
    $("modelButton"),

  sideControls:
    $("sideControls"),

  scaleSlider:
    $("scaleSlider"),

  xSlider:
    $("xSlider"),

  ySlider:
    $("ySlider"),

  zSlider:
    $("zSlider"),

  rotateXSlider:
    $("rotateXSlider"),

  rotateYSlider:
    $("rotateYSlider"),

  rotateZSlider:
    $("rotateZSlider"),

  trackingButton:
    $("trackingButton")
};

let scene = null;
let camera3D = null;
let renderer = null;

let activeCameraStream = null;
let microphoneStream = null;

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

let mediaPipePromise = null;

const clock =
  new THREE.Clock();

function setStatus(
  message,
  isError = false
) {
  if (el.status) {
    el.status.textContent =
      String(message);

    el.status.dataset.state =
      isError
        ? "error"
        : "normal";
  }

  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function showError(
  error,
  label = "App error"
) {
  const message =
    error?.message ||
    String(error);

  setStatus(
    `${label}: ${message}`,
    true
  );
}

function requireElement(
  element,
  id
) {
  if (!element) {
    throw new Error(
      `Required HTML element is missing: #${id}`
    );
  }

  return element;
}

function setButtonLabel(
  button,
  label
) {
  if (button) {
    button.textContent =
      label;
  }
}

function downloadBlob(
  blob,
  filename
) {
  if (!blob) {
    throw new Error(
      "Download data is empty."
    );
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
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1500
  );
}

window.addEventListener(
  "error",
  (event) => {
    if (event.message) {
      showError(
        event.message,
        "JavaScript error"
      );
    }
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    showError(
      event.reason,
      "Async error"
    );
  }
);

function checkRequiredElements() {
  const required = [
    ["camera", el.video],
    ["threeCanvas", el.canvas],
    ["status", el.status],
    ["cameraButton", el.cameraButton],
    [
      "switchCameraButton",
      el.switchCameraButton
    ],
    ["photoButton", el.photoButton],
    ["recordButton", el.recordButton],
    [
      "import3DButton",
      el.import3DButton
    ],
    [
      "import3DInput",
      el.import3DInput
    ],
    [
      "export3DButton",
      el.export3DButton
    ],
    ["resetButton", el.resetButton]
  ];

  const missing =
    required
      .filter(
        ([, element]) =>
          !element
      )
      .map(
        ([id]) => id
      );

  if (missing.length) {
    throw new Error(
      `Missing HTML element IDs: ${missing.join(", ")}`
    );
  }
}

function initThree() {
  requireElement(
    el.canvas,
    "threeCanvas"
  );

  scene =
    new THREE.Scene();

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
      window.devicePixelRatio ||
        1,
      2
    )
  );

  renderer.setClearColor(
    0x000000,
    0
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  const hemisphere =
    new THREE.HemisphereLight(
      0xffffff,
      0x444466,
      2
    );

  scene.add(
    hemisphere
  );

  const key =
    new THREE.DirectionalLight(
      0xffffff,
      2.5
    );

  key.position.set(
    3,
    5,
    5
  );

  scene.add(key);

  const fill =
    new THREE.DirectionalLight(
      0xffffff,
      1.2
    );

  fill.position.set(
    -4,
    1,
    3
  );

  scene.add(fill);

  currentModel =
    new THREE.Group();

  currentModel.name =
    "AR_MODEL_ROOT";

  scene.add(
    currentModel
  );

  createDemoCube();

  resizeRenderer();

  window.addEventListener(
    "resize",
    resizeRenderer
  );

  animate();

  setStatus(
    "3D scene ready. Press Open Camera."
  );
}

function createDemoCube() {
  if (!currentModel) {
    return;
  }

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

  currentModel.add(
    cube
  );
}

function clearModelChildren() {
  if (!currentModel) {
    return;
  }

  while (
    currentModel.children.length
  ) {
    const child =
      currentModel.children[0];

    currentModel.remove(
      child
    );

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

function resizeRenderer() {
  if (
    !renderer ||
    !camera3D
  ) {
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
    window.requestAnimationFrame(
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
      delta * 0.70;
  }

  if (
    trackingEnabled &&
    faceLandmarker &&
    !trackingBusy
  ) {
    const now =
      performance.now();

    if (
      now -
        lastTrackingTime >
      50
    ) {
      lastTrackingTime =
        now;

      updateFaceTracking(
        now
      );
    }
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
        el.rotateXSlider
          ?.value ?? 0
      )
    );

  const ry =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateYSlider
          ?.value ?? 0
      )
    );

  const rz =
    THREE.MathUtils.degToRad(
      Number(
        el.rotateZSlider
          ?.value ?? 0
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

  Object.entries(
    values
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
}async function startCamera() {
  try {
    stopCamera();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .getUserMedia
    ) {
      throw new Error(
        "Camera API is not supported in this browser."
      );
    }

    setStatus(
      "Requesting camera permission..."
    );

    activeCameraStream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: {
              ideal:
                facingMode
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

    el.video.muted =
      true;

    el.video.playsInline =
      true;

    el.video.autoplay =
      true;

    await el.video.play();

    setStatus(
      "Camera is running."
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
  if (
    microphoneStream
  ) {
    microphoneStream
      .getTracks()
      .forEach(
        (track) => {
          try {
            track.stop();
          } catch {}
        }
      );

    microphoneStream =
      null;
  }

  if (
    activeCameraStream
  ) {
    activeCameraStream
      .getTracks()
      .forEach(
        (track) => {
          try {
            track.stop();
          } catch {}
        }
      );

    activeCameraStream =
      null;
  }

  audioEnabled =
    false;

  setButtonLabel(
    el.audioButton,
    "Audio"
  );

  if (el.video) {
    el.video.pause();
    el.video.srcObject =
      null;
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

    if (
      !activeCameraStream
    ) {
      setStatus(
        "Start the camera before recording.",
        true
      );

      return;
    }

    if (isRecording) {
      return;
    }

    recordedChunks =
      [];

    const tracks =
      activeCameraStream
        .getTracks();

    const videoTracks =
      activeCameraStream
        .getVideoTracks();

    if (!videoTracks.length) {
      throw new Error(
        "No camera video track is available."
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
          event.data.size >
            0
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

        isRecording =
          false;

        setButtonLabel(
          el.recordButton,
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

    isRecording =
      true;

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
    isRecording =
      false;

    setButtonLabel(
      el.recordButton,
      "Record"
    );

    return;
  }

  mediaRecorder.stop();

  isRecording =
    false;

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

    recordedChunks =
      [];

    mediaRecorder =
      null;

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
    if (
      !activeCameraStream
    ) {
      setStatus(
        "Start the camera before enabling audio.",
        true
      );

      return;
    }

    if (
      audioEnabled
    ) {
      stopMicrophone();

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
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation:
              true,

            noiseSuppression:
              true,

            autoGainControl:
              true
          },

          video: false
        });

    const audioTracks =
      microphoneStream
        .getAudioTracks();

    if (!audioTracks.length) {
      throw new Error(
        "Microphone track was not created."
      );
    }

    audioTracks.forEach(
      (track) => {
        activeCameraStream.addTrack(
          track
        );
      }
    );

    audioEnabled =
      true;

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

function stopMicrophone() {
  if (
    microphoneStream
  ) {
    microphoneStream
      .getTracks()
      .forEach(
        (track) => {
          try {
            track.stop();
          } catch {}
        }
      );

    microphoneStream =
      null;
  }

  if (
    activeCameraStream
  ) {
    activeCameraStream
      .getAudioTracks()
      .forEach(
        (track) => {
          try {
            track.stop();
            activeCameraStream
              .removeTrack(track);
          } catch {}
        }
      );
  }

  audioEnabled =
    false;
}

function addModelToScene(
  object
) {
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

  currentModel.add(
    object
  );

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

  fitModelToView(
    object
  );

  setStatus(
    `Model loaded: ${object.name}`
  );
}

function fitModelToView(
  object
) {
  const bounds =
    new THREE.Box3()
      .setFromObject(
        object
      );

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  bounds.getSize(
    size
  );

  bounds.getCenter(
    center
  );

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
    Number.isFinite(
      largest
    ) &&
    largest > 0
  ) {
    object.scale.setScalar(
      1.5 / largest
    );
  }
}function handleModelImport(
  event
) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  const filename =
    file.name.toLowerCase();

  setStatus(
    `Loading ${file.name}...`
  );

  try {
    if (
      filename.endsWith(
        ".glb"
      ) ||
      filename.endsWith(
        ".gltf"
      )
    ) {
      importGLTF(
        file
      );

    } else if (
      filename.endsWith(
        ".obj"
      )
    ) {
      importOBJ(
        file
      );

    } else if (
      filename.endsWith(
        ".stl"
      )
    ) {
      importSTL(
        file
      );

    } else {
      throw new Error(
        "Unsupported format. Use GLB, GLTF, OBJ, or STL."
      );
    }

  } catch (error) {
    showError(
      error,
      "Import error"
    );
  }

  event.target.value =
    "";
}

function importGLTF(
  file
) {
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

      } catch (error) {
        showError(
          error,
          "GLTF/GLB error"
        );
      }
    };

  reader.readAsArrayBuffer(
    file
  );
}

function importOBJ(
  file
) {
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
}

function importSTL(
  file
) {
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
}

function exportModel() {
  const format =
    el.exportFormat?.value
      ?.toLowerCase() ||
    "glb";

  if (
    format === "obj"
  ) {
    exportModelOBJ();
  } else {
    exportModelGLTF(
      format === "gltf"
        ? false
        : true
    );
  }
}

function exportModelGLTF(
  binary = true
) {
  if (
    !currentModel ||
    !currentModel.children.length
  ) {
    setStatus(
      "There is no model to export.",
      true
    );

    return;
  }

  const exporter =
    new GLTFExporter();

  try {
    exporter.parse(
      currentModel,

      (result) => {
        try {
          if (
            binary &&
            result instanceof
              ArrayBuffer
          ) {
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
              `aziz-ar-model-${Date.now()}.glb`
            );

            setStatus(
              "GLB model exported."
            );

          } else if (
            typeof result ===
            "string"
          ) {
            const blob =
              new Blob(
                [result],
                {
                  type:
                    "model/gltf+json"
                }
              );

            downloadBlob(
              blob,
              `aziz-ar-model-${Date.now()}.gltf`
            );

            setStatus(
              "GLTF model exported."
            );

          } else {
            const blob =
              new Blob(
                [
                  JSON.stringify(
                    result
                  )
                ],
                {
                  type:
                    "model/gltf+json"
                }
              );

            downloadBlob(
              blob,
              `aziz-ar-model-${Date.now()}.gltf`
            );

            setStatus(
              "GLTF model exported."
            );
          }

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
        binary,
        onlyVisible: true
      }
    );

  } catch (error) {
    showError(
      error,
      "GLTF export error"
    );
  }
}

function exportModelOBJ() {
  if (
    !currentModel ||
    !currentModel.children.length
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
      `aziz-ar-model-${Date.now()}.obj`
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

function resetModel() {
  if (!currentModel) {
    return;
  }

  clearModelChildren();

  createDemoCube();

  resetControls();

  if (
    trackingEnabled
  ) {
    stopFaceTracking();
  }

  setStatus(
    "Model reset."
  );
}

function toggleControls() {
  if (!el.sideControls) {
    return;
  }

  const isHidden =
    el.sideControls.style.display ===
    "none";

  el.sideControls.style.display =
    isHidden
      ? "flex"
      : "none";
}

async function loadMediaPipe() {
  if (
    mediaPipePromise
  ) {
    return mediaPipePromise;
  }

  mediaPipePromise =
    import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
    )
      .then(
        (module) => {
          if (
            !module.FaceLandmarker ||
            !module.FilesetResolver
          ) {
            throw new Error(
              "MediaPipe FaceLandmarker module loaded without the required classes."
            );
          }

          return module;
        }
      )
      .catch(
        (error) => {
          mediaPipePromise =
            null;

          throw error;
        }
      );

  return mediaPipePromise;
}

async function startFaceTracking() {
  if (
    trackingBusy
  ) {
    return;
  }

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

  trackingBusy =
    true;

  try {
    setStatus(
      "Loading face tracking..."
    );

    const vision =
      await loadMediaPipe();

    const FilesetResolver =
      vision.FilesetResolver;

    const FaceLandmarker =
      vision.FaceLandmarker;

    const fileset =
      await FilesetResolver
        .forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );

    faceLandmarker =
      await FaceLandmarker
        .createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                "./models/face_landmarker.task",

              delegate:
                "GPU"
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

    trackingEnabled =
      true;

    setButtonLabel(
      el.trackingButton,
      "Tracking On"
    );

    setStatus(
      "Face tracking is ready."
    );

  } catch (error) {
    faceLandmarker =
      null;

    trackingEnabled =
      false;

    setButtonLabel(
      el.trackingButton,
      "Face Tracking"
    );

    showError(
      error,
      "Face tracking error"
    );

  } finally {
    trackingBusy =
      false;
  }
}

function stopFaceTracking() {
  trackingEnabled =
    false;

  faceLandmarker =
    null;

  if (currentModel) {
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
  if (
    trackingEnabled
  ) {
    stopFaceTracking();
    return;
  }

  await startFaceTracking();
}

function updateFaceTracking(
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

  trackingBusy =
    true;

  try {
    const result =
      faceLandmarker
        .detectForVideo(
          el.video,
          timestamp
        );

    if (
      !result ||
      !result.faceLandmarks ||
      !result.faceLandmarks.length
    ) {
      return;
    }

    updateModelFromFace(
      result.faceLandmarks[0]
    );

  } catch (error) {
    console.error(
      "Tracking frame error:",
      error
    );

  } finally {
    trackingBusy =
      false;
  }
}

function updateModelFromFace(
  landmarks
) {
  if (
    !currentModel ||
    !landmarks ||
    landmarks.length <
      264
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
      rightEye.x) *
    0.5;

  const eyeCenterY =
    (leftEye.y +
      rightEye.y) *
    0.5;

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
    eyeDistance <=
      0.001
  ) {
    return;
  }

  const faceCenterX =
    (forehead.x +
      chin.x) *
    0.5;

  const faceCenterY =
    (forehead.y +
      chin.y) *
    0.5;

  const horizontalOffset =
    (faceCenterX -
      0.5) *
    3.0;

  const verticalOffset =
    -(faceCenterY -
      0.5) *
    2.4;

  const headTilt =
    Math.atan2(
      rightEye.y -
        leftEye.y,

      rightEye.x -
        leftEye.x
    );

  const headTurn =
    THREE.MathUtils.clamp(
      (nose.x -
        eyeCenterX) *
        5,

      -1,
      1
    );

  const pitch =
    THREE.MathUtils.clamp(
      (nose.y -
        eyeCenterY) *
        2.5,

      -0.8,
      0.8
    );

  const trackingScale =
    THREE.MathUtils.clamp(
      eyeDistance *
        4.5,

      0.45,
      2.5
    );

  currentModel.position.x =
    horizontalOffset;

  currentModel.position.y =
    verticalOffset;

  currentModel.position.z =
    -0.55;

  currentModel.scale.setScalar(
    trackingScale
  );

  currentModel.rotation.z =
    -headTilt;

  currentModel.rotation.y =
    -headTurn * 0.8;

  currentModel.rotation.x =
    pitch;
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

function prepareVideoElement() {
  if (!el.video) {
    return;
  }

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

  el.video.style.display =
    "block";
}

function cleanupApp() {
  if (
    animationFrameId
  ) {
    cancelAnimationFrame(
      animationFrameId
    );

    animationFrameId =
      null;
  }

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {
    try {
      mediaRecorder.stop();
    } catch {}
  }

  mediaRecorder =
    null;

  recordedChunks =
    [];

  stopFaceTracking();

  stopCamera();
}

function initializeApp() {
  try {
    checkRequiredElements();

    prepareVideoElement();

    initThree();

    bindEvents();

    if (
      el.sideControls
    ) {
      el.sideControls.style.display =
        "flex";
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

window.addEventListener(
  "beforeunload",
  cleanupApp
);

initializeApp();
