import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const view = $("view");
  const video = $("cameraVideo");
  const dotsCanvas = $("dotsCanvas");
  const dotsCtx = dotsCanvas.getContext("2d");
  const statusEl = $("status");
  const toastEl = $("toast");

  let cameraStream = null;
  let facingMode = "user";
  let mirrored = true;
  let faceLandmarker = null;
  let trackingOn = false;
  let showDots = true;
  let lastVideoTime = -1;
  let mediaRecorder = null;
  let recordedChunks = [];
  let micStream = null;
  let micOn = false;
  let recordingCanvas = null;
  let recordingCtx = null;
  let recordingRAF = 0;
  let toastTimer = 0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = "threeCanvas";
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:auto;";
  view.insertBefore(renderer.domElement, dotsCanvas);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(2, 4, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);

  const transform = new TransformControls(camera, renderer.domElement);
  transform.setMode("translate");
  transform.setSize(0.8);
  scene.add(transform.getHelper());

  const loaders = {
    gltf: new GLTFLoader(),
    obj: new OBJLoader(),
    fbx: new FBXLoader()
  };

  const slots = Array.from({ length: 4 }, () => ({
    root: null,
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    faceSize: 1,
    faceOffset: [0, 0, 0],
    headOffset: [0, 0, 0],
    partScale: { leftEye: 1, rightEye: 1, mouthScale: 1 },
    expressions: { mouthOpen: 0, blinkLeft: 0, blinkRight: 0 },
    morphNames: []
  }));

  let activeSlot = 0;
  let modelsVisible = true;
  let autoFit = true;
  let currentLandmarks = null;
  let faceAnchor = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, width: 0.8 };
  let lastFitWidth = null;
  let cleanMode = false;
  let slidersHidden = false;
  let optionsHidden = false;
  let edgeStartX = null;
  let edgeStartY = null;

  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2600);
  }

  function active() {
    return slots[activeSlot];
  }

  function activeModel() {
    return active().root;
  }

  function resize() {
    const rect = view.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeDotsCanvas();
    if (recordingCanvas) {
      recordingCanvas.width = Math.max(2, Math.round(w));
      recordingCanvas.height = Math.max(2, Math.round(h));
    }
  }

  function resizeDotsCanvas() {
    const rect = dotsCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dotsCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    dotsCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    dotsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();

  function disposeObject(root) {
    if (!root) return;
    root.traverse(node => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          for (const key of Object.keys(material)) {
            const value = material[key];
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        }
      }
    });
  }

  function fitModelForPreview(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (Number.isFinite(maxDim) && maxDim > 0) {
      root.scale.multiplyScalar(1.5 / maxDim);
      const centeredBox = new THREE.Box3().setFromObject(root);
      const center = centeredBox.getCenter(new THREE.Vector3());
      root.position.sub(center);
    }
  }

  function collectMorphTargets(root) {
    const result = [];
    root.traverse(node => {
      if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
        result.push({
          mesh: node,
          names: node.morphTargetDictionary,
          influences: node.morphTargetInfluences
        });
      }
    });
    return result;
  }

  function showActiveSlot() {
    modelGroup.clear();
    const root = activeModel();
    transform.detach();
    if (root) {
      modelGroup.add(root);
      root.visible = modelsVisible && active().visible;
      applySavedTransform();
      if (root.visible) transform.attach(root);
      setStatus("Filter " + (activeSlot + 1) + " selected");
    } else {
      setStatus("Filter " + (activeSlot + 1) + " — import a 3D model");
    }
    updateSlotButtons();
    syncSlidersFromModel();
  }

  function updateSlotButtons() {
    document.querySelectorAll(".slot").forEach(button => {
      button.classList.toggle("active", Number(button.dataset.slot) === activeSlot);
    });
  }

  function applySavedTransform() {
    const root = activeModel();
    if (!root) return;
    const s = active();
    root.position.set(...s.position);
    root.rotation.set(...s.rotation);
    root.scale.setScalar(s.scale);
  }

  function syncSlidersFromModel() {
    const s = active();
    const pairs = [
      ["posX", s.position[0]], ["posY", s.position[1]], ["posZ", s.position[2]],
      ["rotX", THREE.MathUtils.radToDeg(s.rotation[0])],
      ["rotY", THREE.MathUtils.radToDeg(s.rotation[1])],
      ["rotZ", THREE.MathUtils.radToDeg(s.rotation[2])],
      ["modelScale", s.scale],
      ["faceX", s.faceOffset[0]], ["faceY", s.faceOffset[1]], ["faceZ", s.faceOffset[2]],
      ["faceSize", s.faceSize],
      ["yawOffset", s.headOffset[1]], ["pitchOffset", s.headOffset[0]], ["rollOffset", s.headOffset[2]],
      ["leftEye", s.partScale.leftEye], ["rightEye", s.partScale.rightEye], ["mouthScale", s.partScale.mouthScale],
      ["mouthOpen", s.expressions.mouthOpen], ["blinkLeft", s.expressions.blinkLeft], ["blinkRight", s.expressions.blinkRight]
    ];
    for (const [id, value] of pairs) {
      const input = $(id);
      if (input) {
        input.value = String(value);
        const output = $(id + "Out");
        if (output) output.value = Number(value).toFixed(id.startsWith("rot") || id.includes("Offset") ? 0 : 2);
      }
    }
  }

  function readTransformIntoSlot() {
    const root = activeModel();
    if (!root) return;
    const s = active();
    s.position = [root.position.x, root.position.y, root.position.z];
    s.rotation = [root.rotation.x, root.rotation.y, root.rotation.z];
    s.scale = root.scale.x;
    syncSlidersFromModel();
  }

  transform.addEventListener("objectChange", readTransformIntoSlot);

  function makeModelReady(root, filename) {
    if (!root) throw new Error("This file did not contain a 3D model.");
    fitModelForPreview(root);
    root.traverse(node => {
      if (node.isMesh) {
        node.frustumCulled = false;
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach(material => {
            if ("side" in material) material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          });
        }
      }
    });
    const s = active();
    if (s.root) disposeObject(s.root);
    s.root = root;
    s.position = [root.position.x, root.position.y, root.position.z];
    s.rotation = [root.rotation.x, root.rotation.y, root.rotation.z];
    s.scale = root.scale.x;
    s.visible = true;
    s.morphNames = collectMorphTargets(root).flatMap(item => Object.keys(item.names));
    showActiveSlot();
    reportModel("Loaded " + filename + (s.morphNames.length ? " — morph targets detected" : " — no morph targets detected"));
    toast("Model loaded into Filter " + (activeSlot + 1));
  }

  function reportModel(message) {
    setStatus(message);
    toast(message);
  }

  async function importModel(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const url = URL.createObjectURL(file);
    setStatus("Loading " + file.name + "…");
    try {
      let root;
      if (ext === "glb" || ext === "gltf") {
        const gltf = await loaders.gltf.loadAsync(url);
        root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      } else if (ext === "obj") {
        root = await loaders.obj.loadAsync(url);
      } else if (ext === "fbx") {
        root = await loaders.fbx.loadAsync(url);
      } else {
        throw new Error("Supported formats: GLB, GLTF, OBJ and FBX.");
      }
      makeModelReady(root, file.name);
    } catch (error) {
      console.error("Model import failed:", error);
      setStatus("Model import failed");
      toast("Could not load this model. GLB is recommended. " + (error.message || ""));
    } finally {
      URL.revokeObjectURL(url);
      $("modelFile").value = "";
    }
  }

  $("modelFile").addEventListener("change", event => importModel(event.target.files[0]));

  document.querySelectorAll(".slot").forEach(button => {
    button.addEventListener("click", () => {
      activeSlot = Number(button.dataset.slot);
      showActiveSlot();
    });
  });

  $("removeModelBtn").addEventListener("click", () => {
    const s = active();
    if (s.root) disposeObject(s.root);
    s.root = null;
    s.position = [0, 0, 0];
    s.rotation = [0, 0, 0];
    s.scale = 1;
    s.morphNames = [];
    showActiveSlot();
    toast("Active filter model removed");
  });

  $("showModelBtn").addEventListener("click", () => {
    modelsVisible = !modelsVisible;
    const root = activeModel();
    if (root) root.visible = modelsVisible && active().visible;
    if (!modelsVisible) transform.detach();
    else if (root) transform.attach(root);
    $("showModelBtn").textContent = modelsVisible ? "Model On / Off" : "Model Hidden";
  });

  document.querySelectorAll("[data-transform]").forEach(button => {
    button.addEventListener("click", () => {
      const mode = button.dataset.transform;
      transform.setMode(mode);
      active().transformMode = mode;
      toast(mode[0].toUpperCase() + mode.slice(1) + " gizmo selected");
    });
  });

  function bindRange(id, fn, decimals = 2) {
    const input = $(id);
    const output = $(id + "Out");
    if (!input) return;
    const update = () => {
      const value = Number(input.value);
      if (output) output.value = value.toFixed(decimals);
      fn(value);
    };
    input.addEventListener("input", update);
    update();
  }

  [
    ["posX", (v, s) => s.position[0] = v], ["posY", (v, s) => s.position[1] = v],
    ["posZ", (v, s) => s.position[2] = v]
  ].forEach(([id, setter]) => bindRange(id, value => {
    const s = active(); setter(value, s); if (activeModel()) activeModel().position.set(...s.position);
  }));

  [
    ["rotX", 0], ["rotY", 1], ["rotZ", 2]
  ].forEach(([id, axis]) => bindRange(id, value => {
    const s = active(); s.rotation[axis] = THREE.MathUtils.degToRad(value);
    if (activeModel()) activeModel().rotation.set(...s.rotation);
  }, 0));

  bindRange("modelScale", value => {
    active().scale = value;
    if (activeModel()) activeModel().scale.setScalar(value);
  });

  bindRange("faceX", value => active().faceOffset[0] = value);
  bindRange("faceY", value => active().faceOffset[1] = value);
  bindRange("faceZ", value => active().faceOffset[2] = value);
  bindRange("faceSize", value => active().faceSize = value);
  bindRange("yawOffset", value => active().headOffset[1] = value, 0);
  bindRange("pitchOffset", value => active().headOffset[0] = value, 0);
  bindRange("rollOffset", value => active().headOffset[2] = value, 0);
  bindRange("leftEye", value => active().partScale.leftEye = value);
  bindRange("rightEye", value => active().partScale.rightEye = value);
  bindRange("mouthScale", value => active().partScale.mouthScale = value);
  bindRange("mouthOpen", value => active().expressions.mouthOpen = value);
  bindRange("blinkLeft", value => active().expressions.blinkLeft = value);
  bindRange("blinkRight", value => active().expressions.blinkRight = value);

  $("resetTransformBtn").addEventListener("click", () => {
    const s = active();
    s.position = [0, 0, 0];
    s.rotation = [0, 0, 0];
    s.scale = 1;
    applySavedTransform();
    syncSlidersFromModel();
  });

  $("resetFaceBtn").addEventListener("click", () => {
    const s = active();
    s.faceOffset = [0, 0, 0];
    s.faceSize = 1;
    s.headOffset = [0, 0, 0];
    syncSlidersFromModel();
  });

  $("autoFitBtn").addEventListener("click", () => {
    autoFit = true;
    lastFitWidth = null;
    toast("Auto face fit enabled");
  });

  $("resetAllBtn").addEventListener("click", () => {
    for (const s of slots) {
      s.position = [0, 0, 0];
      s.rotation = [0, 0, 0];
      s.scale = 1;
      s.faceSize = 1;
      s.faceOffset = [0, 0, 0];
      s.headOffset = [0, 0, 0];
      s.partScale = { leftEye: 1, rightEye: 1, mouthScale: 1 };
      s.expressions = { mouthOpen: 0, blinkLeft: 0, blinkRight: 0 };
    }
    applySavedTransform();
    syncSlidersFromModel();
    toast("Settings reset");
  });

  // Independent hide controls. Clean Screen hides every normal UI element.
  $("hideSlidersBtn").addEventListener("click", () => {
    slidersHidden = !slidersHidden;
    $("slidersPanel").classList.toggle("hidden", slidersHidden);
    $("hideSlidersBtn").textContent = slidersHidden ? "Show Sliders" : "Hide Sliders";
  });

  $("hideOptionsBtn").addEventListener("click", () => {
    optionsHidden = !optionsHidden;
    $("optionsPanel").classList.toggle("hidden", optionsHidden);
    $("recordingOptions").classList.toggle("hidden", optionsHidden);
    $("hideOptionsBtn").textContent = optionsHidden ? "Show Options" : "Hide Options";
  });

  function setCleanMode(value) {
    cleanMode = value;
    view.classList.toggle("clean", cleanMode);
    toastEl.classList.add("hidden");
    if (!cleanMode) {
      $("cleanScreenBtn").textContent = "Clean Screen";
    }
  }

  $("cleanScreenBtn").addEventListener("click", () => {
    setCleanMode(true);
  });

  // Edge swipe restores the controls while clean mode is active.
  view.addEventListener("touchstart", event => {
    if (!cleanMode || !event.touches.length) return;
    const touch = event.touches[0];
    edgeStartX = touch.clientX;
    edgeStartY = touch.clientY;
  }, { passive: true });

  view.addEventListener("touchend", event => {
    if (!cleanMode || edgeStartX === null || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - edgeStartX;
    const dy = Math.abs(touch.clientY - edgeStartY);
    const edge = edgeStartX < 35 || edgeStartX > window.innerWidth - 35;
    if (edge && Math.abs(dx) > 45 && dy < 100) {
      setCleanMode(false);
      toast("Controls restored — tap Clean Screen to hide again");
    }
    edgeStartX = null;
    edgeStartY = null;
  }, { passive: true });

  // Camera.
  async function startCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API unavailable. Open this site through HTTPS.");
      }
      stopCamera(false);
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      video.srcObject = cameraStream;
      video.style.transform = mirrored ? "scaleX(-1)" : "none";
      await video.play();
      resize();
      setStatus("Camera ready");
      toast("Camera started");
    } catch (error) {
      console.error("Camera error:", error);
      setStatus("Camera error: " + error.message);
      toast("Allow camera permission and use the HTTPS GitHub Pages URL.");
    }
  }

  function stopCamera(update = true) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    video.srcObject = null;
    trackingOn = false;
    clearDots();
    if (update) setStatus("Camera stopped");
  }

  $("startCameraBtn").addEventListener("click", startCamera);
  $("stopCameraBtn").addEventListener("click", () => stopCamera());

  $("switchCameraBtn").addEventListener("click", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    mirrored = facingMode === "user";
    await startCamera();
  });

  $("flipBtn").addEventListener("click", () => {
    mirrored = !mirrored;
    video.style.transform = mirrored ? "scaleX(-1)" : "none";
    toast(mirrored ? "Mirror on" : "Mirror off");
  });

  $("fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await view.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      toast("Fullscreen is not available in this browser.");
    }
  });

  $("dotsBtn").addEventListener("click", () => {
    showDots = !showDots;
    $("dotsBtn").textContent = showDots ? "Dots: On" : "Dots: Off";
    if (!showDots) clearDots();
  });

  // MediaPipe Face Landmarker, lazy-loaded only when tracking is enabled.
  async function loadLandmarker() {
    if (faceLandmarker) return faceLandmarker;
    setStatus("Loading face tracking model…");
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );
    faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
    return faceLandmarker;
  }

  function clearDots() {
    dotsCtx.clearRect(0, 0, dotsCanvas.width, dotsCanvas.height);
  }

  function drawDots(landmarks) {
    clearDots();
    if (!showDots || !landmarks) return;
    const rect = dotsCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    dotsCtx.fillStyle = "#00ff66";
    for (const p of landmarks) {
      const x = (mirrored ? 1 - p.x : p.x) * width;
      const y = p.y * height;
      dotsCtx.beginPath();
      dotsCtx.arc(x, y, 1.45, 0, Math.PI * 2);
      dotsCtx.fill();
    }
  }

  function updateFaceAnchor(landmarks) {
    if (!landmarks || landmarks.length < 264) return;
    const p = landmarks;
    const center = p[1] || p[4];
    const leftEye = p[33];
    const rightEye = p[263];
    const forehead = p[10];
    const chin = p[152];
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const width = Math.max(0.05, eyeDist * 2.15);
    const centerX = (p[234].x + p[454].x) / 2;
    const centerY = (forehead.y + chin.y) / 2;
    const yaw = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const roll = yaw;
    const noseOffset = (center.x - (leftEye.x + rightEye.x) / 2);
    faceAnchor = {
      x: (mirrored ? (1 - centerX) : centerX) * 3.1 - 1.55,
      y: (0.5 - centerY) * 2.5,
      z: THREE.MathUtils.clamp(noseOffset * 2, -0.6, 0.6),
      yaw: THREE.MathUtils.clamp((p[263].x - p[33].x) * 0.0, -0.5, 0.5),
      pitch: THREE.MathUtils.clamp((centerY - center.y) * 2, -0.5, 0.5),
      roll,
      width
    };
    currentLandmarks = landmarks;
    if (autoFit && activeModel()) {
      const s = active();
      if (lastFitWidth === null) lastFitWidth = width;
      const fitScale = THREE.MathUtils.clamp((0.8 / Math.max(0.1, width)) * 0.18, 0.4, 2.5) * s.faceSize;
      activeModel().scale.setScalar(Math.max(0.02, s.scale * fitScale));
    }
  }

  function updateExpressions(blendshapeResult) {
    if (!blendshapeResult || !blendshapeResult.length) return;
    const categories = blendshapeResult[0].categories || [];
    const values = {};
    categories.forEach(item => values[item.categoryName] = item.score);

    const mouth = Math.max(values.mouthOpen || 0, active().expressions.mouthOpen);
    const blinkL = Math.max(values.eyeBlinkLeft || 0, active().expressions.blinkLeft);
    const blinkR = Math.max(values.eyeBlinkRight || 0, active().expressions.blinkRight);

    // Apply matching expression values to any compatible morph targets.
    const root = activeModel();
    if (!root) return;
    const morphs = collectMorphTargets(root);
    const mappings = [
      [/mouth.?open|jaw.?open/i, mouth],
      [/eye.?blink.?left|blink.?left|left.?blink/i, blinkL],
      [/eye.?blink.?right|blink.?right|right.?blink/i, blinkR]
    ];
    morphs.forEach(entry => {
      Object.entries(entry.names).forEach(([name, index]) => {
        const match = mappings.find(([pattern]) => pattern.test(name));
        if (match) entry.influences[index] = match[1];
      });
    });
  }

  function faceLoop() {
    if (!trackingOn) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime && faceLandmarker) {
      lastVideoTime = video.currentTime;
      try {
        const result = faceLandmarker.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks && result.faceLandmarks[0];
        if (landmarks) {
          drawDots(landmarks);
          updateFaceAnchor(landmarks);
          updateExpressions(result.faceBlendshapes);
          setStatus("Face tracking: active");
        } else {
          clearDots();
          setStatus("Face tracking: searching…");
        }
      } catch (error) {
        console.error("Face tracking frame failed:", error);
        setStatus("Tracking frame error");
      }
    }
    requestAnimationFrame(faceLoop);
  }

  $("trackingBtn").addEventListener("click", async () => {
    if (trackingOn) {
      trackingOn = false;
      $("trackingBtn").textContent = "Face Track: Off";
      clearDots();
      setStatus("Face tracking stopped");
      return;
    }
    try {
      if (!cameraStream) await startCamera();
      await loadLandmarker();
      trackingOn = true;
      lastVideoTime = -1;
      $("trackingBtn").textContent = "Face Track: On";
      setStatus("Face tracking starting…");
      requestAnimationFrame(faceLoop);
    } catch (error) {
      console.error("Face tracking setup failed:", error);
      setStatus("Tracking setup error: " + error.message);
      toast("Could not start face tracking. Check internet connection.");
    }
  });

  // Render the active filter as a face-attached overlay.
  function updateFaceAttachedModel() {
    const root = activeModel();
    if (!root || !trackingOn || !currentLandmarks || !modelsVisible) return;
    const s = active();
    root.position.x = faceAnchor.x + s.faceOffset[0] + s.position[0];
    root.position.y = faceAnchor.y + s.faceOffset[1] + s.position[1];
    root.position.z = faceAnchor.z + s.faceOffset[2] + s.position[2];
    root.rotation.x = faceAnchor.pitch + THREE.MathUtils.degToRad(s.headOffset[0]) + s.rotation[0];
    root.rotation.y = faceAnchor.yaw + THREE.MathUtils.degToRad(s.headOffset[1]) + s.rotation[1];
    root.rotation.z = faceAnchor.roll + THREE.MathUtils.degToRad(s.headOffset[2]) + s.rotation[2];
  }

  // Composite canvas makes camera + WebGL overlay recordable together.
  function drawCover(ctx, source, w, h, mirror = false) {
    if (!source || !source.videoWidth) return;
    const sw = source.videoWidth;
    const sh = source.videoHeight;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.save();
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, dx, dy, dw, dh);
    ctx.restore();
  }

  function compositeFrame() {
    if (!recordingCanvas || !recordingCtx) return;
    const w = recordingCanvas.width;
    const h = recordingCanvas.height;
    recordingCtx.clearRect(0, 0, w, h);
    if (video.readyState >= 2) drawCover(recordingCtx, video, w, h, mirrored);
    recordingCtx.drawImage(renderer.domElement, 0, 0, w, h);
    if (showDots) recordingCtx.drawImage(dotsCanvas, 0, 0, w, h);
    recordingRAF = requestAnimationFrame(compositeFrame);
  }

  $("micBtn").addEventListener("click", async () => {
    if (micOn) {
      if (micStream) micStream.getTracks().forEach(track => track.stop());
      micStream = null;
      micOn = false;
      $("micBtn").textContent = "Mic: Off";
      toast("Microphone off");
      return;
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micOn = true;
      $("micBtn").textContent = "Mic: On";
      toast("Microphone enabled");
    } catch (error) {
      toast("Microphone permission denied or unavailable.");
    }
  });

  $("recordBtn").addEventListener("click", async () => {
    try {
      if (!cameraStream) await startCamera();
      if (!cameraStream) throw new Error("Camera did not start.");
      recordingCanvas = document.createElement("canvas");
      const rect = view.getBoundingClientRect();
      recordingCanvas.width = Math.max(2, Math.round(rect.width));
      recordingCanvas.height = Math.max(2, Math.round(rect.height));
      recordingCtx = recordingCanvas.getContext("2d");
      const canvasStream = recordingCanvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks()];
      if (micOn && micStream) tracks.push(...micStream.getAudioTracks());
      const combined = new MediaStream(tracks);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(combined, { mimeType: mime });
      mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size) recordedChunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "azeez-ar-recording.webm";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast("Recording saved");
      };
      compositeFrame();
      mediaRecorder.start();
      $("recordBtn").disabled = true;
      $("stopRecordBtn").disabled = false;
      toast("Recording started");
      // Hide UI after recording starts so it doesn't appear in the recording.
      setCleanMode(true);
    } catch (error) {
      console.error("Recording failed:", error);
      toast("Recording could not start: " + error.message);
    }
  });

  $("stopRecordBtn").addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    cancelAnimationFrame(recordingRAF);
    $("recordBtn").disabled = false;
    $("stopRecordBtn").disabled = true;
    setCleanMode(false);
  });

  // Stop recording when leaving clean mode by edge-swipe is not required;
  // the dedicated Stop Recording control returns after edge-swipe.
  const originalSetCleanMode = setCleanMode;
  // Re-enable recording stop after controls return; handler remains available.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && trackingOn) {
      // Browsers may throttle camera rendering in background tabs.
      setStatus("App in background — return to continue tracking");
    }
  });

  $("exportSettingsBtn").addEventListener("click", () => {
    const data = slots.map(s => ({
      position: s.position, rotation: s.rotation, scale: s.scale,
      faceSize: s.faceSize, faceOffset: s.faceOffset, headOffset: s.headOffset,
      partScale: s.partScale, expressions: s.expressions
    }));
    const blob = new Blob([JSON.stringify({ version: 1, slots: data, activeSlot }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "azeez-ar-settings.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  $("importSettingsBtn").addEventListener("click", () => $("settingsFile").click());
  $("settingsFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.slots) || data.slots.length !== 4) throw new Error("Invalid settings file.");
      data.slots.forEach((item, i) => {
        const s = slots[i];
        if (Array.isArray(item.position)) s.position = item.position.slice(0, 3);
        if (Array.isArray(item.rotation)) s.rotation = item.rotation.slice(0, 3);
        if (Number.isFinite(item.scale)) s.scale = item.scale;
        if (Number.isFinite(item.faceSize)) s.faceSize = item.faceSize;
        if (Array.isArray(item.faceOffset)) s.faceOffset = item.faceOffset.slice(0, 3);
        if (Array.isArray(item.headOffset)) s.headOffset = item.headOffset.slice(0, 3);
        if (item.partScale) s.partScale = { ...s.partScale, ...item.partScale };
        if (item.expressions) s.expressions = { ...s.expressions, ...item.expressions };
      });
      activeSlot = Math.max(0, Math.min(3, Number(data.activeSlot) || 0));
      showActiveSlot();
      toast("Settings imported");
    } catch (error) {
      toast("Could not import settings: " + error.message);
    } finally {
      $("settingsFile").value = "";
    }
  });

  // Start without opening the camera automatically; browser permission is user-triggered.
  showActiveSlot();
  setStatus("Ready — tap Start Camera");
  renderer.setAnimationLoop(() => {
    updateFaceAttachedModel();
    renderer.render(scene, camera);
  });

  // Clean up resources if the page is closed.
  window.addEventListener("beforeunload", () => {
    stopCamera(false);
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    if (faceLandmarker && faceLandmarker.close) faceLandmarker.close();
    renderer.dispose();
  });
})();
