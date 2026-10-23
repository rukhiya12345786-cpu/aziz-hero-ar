import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const view = $("view");
  const video = $("cameraVideo");
  const dotsCanvas = $("dotsCanvas");
  const dotsCtx = dotsCanvas.getContext("2d");
  const statusEl = $("status");
  const toastEl = $("toast");

  let stream = null;
  let facingMode = "user";
  let mirrored = true;
  let landmarker = null;
  let tracking = false;
  let showDots = true;
  let lastVideoTime = -1;
  let faceLandmarks = null;
  let recorder = null;
  let chunks = [];
  let micStream = null;
  let micOn = false;
  let recordCanvas = null;
  let recordCtx = null;
  let recordRAF = 0;
  let toastTimer = 0;
  let cleanMode = false;
  let slidersHidden = false;
  let optionsHidden = false;
  let autoFit = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = "threeCanvas";
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;z-index:1;";

  view.insertBefore(renderer.domElement, dotsCanvas);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 4, 5);
  scene.add(light);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);

  const transform = new TransformControls(camera, renderer.domElement);
  transform.setMode("translate");
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
    faceOffset: [0, 0, 0],
    headOffset: [0, 0, 0],
    faceSize: 1,
    partScale: { leftEye: 1, rightEye: 1, mouthScale: 1 },
    expressions: { mouthOpen: 0, blinkLeft: 0, blinkRight: 0 }
  }));

  let activeSlot = 0;
  let modelsVisible = true;
  let faceAnchor = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  let edgeStartX = null;
  let edgeStartY = null;

  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 2600);
  }

  function active() {
    return slots[activeSlot];
  }

  function activeModel() {
    return active().root;
  }

  function resizeDotsCanvas() {
    const rect = dotsCanvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);

    dotsCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    dotsCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    dotsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    const rect = view.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeDotsCanvas();

    if (recordCanvas) {
      recordCanvas.width = Math.max(2, Math.round(w));
      recordCanvas.height = Math.max(2, Math.round(h));
    }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();

  function disposeObject(root) {
    if (!root) return;

    root.traverse((node) => {
      if (node.geometry) node.geometry.dispose();

      if (node.material) {
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];

        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && value.isTexture) value.dispose();
          });
          material.dispose();
        });
      }
    });
  }

  function collectMorphTargets(root) {
    const result = [];

    root.traverse((node) => {
      if (
        node.isMesh &&
        node.morphTargetDictionary &&
        node.morphTargetInfluences
      ) {
        result.push({
          mesh: node,
          names: node.morphTargetDictionary,
          influences: node.morphTargetInfluences
        });
      }
    });

    return result;
  }

  function applySavedTransform() {
    const root = activeModel();
    if (!root) return;

    const s = active();
    root.position.set(...s.position);
    root.rotation.set(...s.rotation);
    root.scale.setScalar(s.scale);
  }

  function showActiveSlot() {
    modelGroup.clear();
    transform.detach();

    const root = activeModel();

    if (root) {
      modelGroup.add(root);
      root.visible = modelsVisible && active().visible;
      applySavedTransform();

      if (root.visible) transform.attach(root);
      setStatus("Filter " + (activeSlot + 1) + " selected");
    } else {
      setStatus("Filter " + (activeSlot + 1) + " — import a 3D model");
    }

    document.querySelectorAll(".slot").forEach((button) => {
      button.classList.toggle(
        "active",
        Number(button.dataset.slot) === activeSlot
      );
    });

    syncSlidersFromModel();
  }

  function syncSlidersFromModel() {
    const s = active();

    const pairs = [
      ["posX", s.position[0]],
      ["posY", s.position[1]],
      ["posZ", s.position[2]],
      ["rotX", THREE.MathUtils.radToDeg(s.rotation[0])],
      ["rotY", THREE.MathUtils.radToDeg(s.rotation[1])],
      ["rotZ", THREE.MathUtils.radToDeg(s.rotation[2])],
      ["modelScale", s.scale],
      ["faceX", s.faceOffset[0]],
      ["faceY", s.faceOffset[1]],
      ["faceZ", s.faceOffset[2]],
      ["faceSize", s.faceSize],
      ["yawOffset", s.headOffset[1]],
      ["pitchOffset", s.headOffset[0]],
      ["rollOffset", s.headOffset[2]],
      ["leftEye", s.partScale.leftEye],
      ["rightEye", s.partScale.rightEye],
      ["mouthScale", s.partScale.mouthScale],
      ["mouthOpen", s.expressions.mouthOpen],
      ["blinkLeft", s.expressions.blinkLeft],
      ["blinkRight", s.expressions.blinkRight]
    ];

    pairs.forEach(([id, value]) => {
      const input = $(id);
      if (!input) return;

      input.value = String(value);
      const output = $(id + "Out");
      if (output) output.value = Number(value).toFixed(2);
    });
  }

  function saveTransform() {
    const root = activeModel();
    if (!root) return;

    const s = active();
    s.position = [root.position.x, root.position.y, root.position.z];
    s.rotation = [root.rotation.x, root.rotation.y, root.rotation.z];
    s.scale = root.scale.x;
    syncSlidersFromModel();
  }

  transform.addEventListener("objectChange", saveTransform);
  
  // Model import and four filter slots.

  function fitModelForPreview(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(maxDim) || maxDim <= 0) {
      throw new Error("The model has no visible 3D geometry.");
    }

    root.scale.multiplyScalar(1.5 / maxDim);

    const centeredBox = new THREE.Box3().setFromObject(root);
    root.position.sub(centeredBox.getCenter(new THREE.Vector3()));
  }

  function makeModelReady(root, filename) {
    if (!root) throw new Error("No 3D model was found in this file.");

    fitModelForPreview(root);

    root.traverse((node) => {
      if (!node.isMesh) return;

      node.frustumCulled = false;

      if (node.material) {
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];

        materials.forEach((material) => {
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        });
      }
    });

    const s = active();

    if (s.root) {
      modelGroup.remove(s.root);
      transform.detach();
      disposeObject(s.root);
    }

    s.root = root;
    s.position = [root.position.x, root.position.y, root.position.z];
    s.rotation = [root.rotation.x, root.rotation.y, root.rotation.z];
    s.scale = root.scale.x;
    s.visible = true;

    showActiveSlot();
    setStatus("Loaded: " + filename);
    toast("Model loaded into Filter " + (activeSlot + 1));
  }

  async function importModel(file) {
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    const url = URL.createObjectURL(file);

    setStatus("Loading " + file.name + "…");

    try {
      let root;

      if (ext === "glb" || ext === "gltf") {
        const result = await loaders.gltf.loadAsync(url);
        root = result.scene || result.scenes?.[0];
      } else if (ext === "obj") {
        root = await loaders.obj.loadAsync(url);
      } else if (ext === "fbx") {
        root = await loaders.fbx.loadAsync(url);
      } else {
        throw new Error("Use a GLB, GLTF, OBJ, or FBX file.");
      }

      makeModelReady(root, file.name);
    } catch (error) {
      console.error("Model import failed:", error);
      setStatus("Model import failed");
      toast(error.message || "Could not load the model.");
    } finally {
      URL.revokeObjectURL(url);
      if ($("modelFile")) $("modelFile").value = "";
    }
  }

  $("modelFile").addEventListener("change", (event) => {
    importModel(event.target.files?.[0]);
  });

  document.querySelectorAll(".slot").forEach((button) => {
    button.addEventListener("click", () => {
      activeSlot = Number(button.dataset.slot);
      showActiveSlot();
    });
  });

  $("removeModelBtn").addEventListener("click", () => {
    const s = active();

    if (s.root) {
      modelGroup.remove(s.root);
      transform.detach();
      disposeObject(s.root);
    }

    s.root = null;
    s.position = [0, 0, 0];
    s.rotation = [0, 0, 0];
    s.scale = 1;

    showActiveSlot();
    toast("Active filter removed");
  });

  $("showModelBtn").addEventListener("click", () => {
    modelsVisible = !modelsVisible;

    const root = activeModel();
    if (root) root.visible = modelsVisible && active().visible;

    if (!modelsVisible) {
      transform.detach();
    } else if (root) {
      transform.attach(root);
    }

    $("showModelBtn").textContent =
      modelsVisible ? "Model On / Off" : "Model Hidden";
  });

  document.querySelectorAll("[data-transform]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.transform;

      if (!["translate", "rotate", "scale"].includes(mode)) return;

      transform.setMode(mode);
      active().transformMode = mode;
      toast(mode + " gizmo selected");
    });
  });

  function bindRange(id, callback, decimals = 2) {
    const input = $(id);
    if (!input) return;

    const output = $(id + "Out");

    input.addEventListener("input", () => {
      const value = Number(input.value);

      if (output) output.value = value.toFixed(decimals);
      callback(value);
    });
  }

  [
    ["posX", 0],
    ["posY", 1],
    ["posZ", 2]
  ].forEach(([id, axis]) => {
    bindRange(id, (value) => {
      active().position[axis] = value;
      applySavedTransform();
    });
  });

  [
    ["rotX", 0],
    ["rotY", 1],
    ["rotZ", 2]
  ].forEach(([id, axis]) => {
    bindRange(id, (value) => {
      active().rotation[axis] = THREE.MathUtils.degToRad(value);
      applySavedTransform();
    }, 0);
  });

  bindRange("modelScale", (value) => {
    active().scale = value;
    applySavedTransform();
  });

  bindRange("faceX", (value) => active().faceOffset[0] = value);
  bindRange("faceY", (value) => active().faceOffset[1] = value);
  bindRange("faceZ", (value) => active().faceOffset[2] = value);
  bindRange("faceSize", (value) => active().faceSize = value);
  bindRange("yawOffset", (value) => active().headOffset[1] = value, 0);
  bindRange("pitchOffset", (value) => active().headOffset[0] = value, 0);
  bindRange("rollOffset", (value) => active().headOffset[2] = value, 0);

  bindRange("leftEye", (value) => active().partScale.leftEye = value);
  bindRange("rightEye", (value) => active().partScale.rightEye = value);
  bindRange("mouthScale", (value) => active().partScale.mouthScale = value);

  bindRange("mouthOpen", (value) => active().expressions.mouthOpen = value);
  bindRange("blinkLeft", (value) => active().expressions.blinkLeft = value);
  bindRange("blinkRight", (value) => active().expressions.blinkRight = value);

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
    autoFit = !autoFit;
    $("autoFitBtn").textContent = autoFit ? "Auto Fit: On" : "Auto Fit: Off";
    toast(autoFit ? "Auto fit enabled" : "Auto fit disabled");
  });

  $("resetAllBtn").addEventListener("click", () => {
    slots.forEach((s) => {
      s.position = [0, 0, 0];
      s.rotation = [0, 0, 0];
      s.scale = 1;
      s.faceOffset = [0, 0, 0];
      s.faceSize = 1;
      s.headOffset = [0, 0, 0];
      s.partScale = { leftEye: 1, rightEye: 1, mouthScale: 1 };
      s.expressions = { mouthOpen: 0, blinkLeft: 0, blinkRight: 0 };
    });

    applySavedTransform();
    syncSlidersFromModel();
    toast("Settings reset");
  });

  // Independent visibility controls.
  $("hideSlidersBtn").addEventListener("click", () => {
    slidersHidden = !slidersHidden;
    $("slidersPanel").classList.toggle("hidden", slidersHidden);
    $("hideSlidersBtn").textContent =
      slidersHidden ? "Show Sliders" : "Hide Sliders";
  });

  $("hideOptionsBtn").addEventListener("click", () => {
    optionsHidden = !optionsHidden;
    $("optionsPanel").classList.toggle("hidden", optionsHidden);
    $("recordingOptions").classList.toggle("hidden", optionsHidden);
    $("hideOptionsBtn").textContent =
      optionsHidden ? "Show Options" : "Hide Options";
  });

  function setCleanMode(value) {
    cleanMode = value;
    view.classList.toggle("clean", value);

    if (toastEl) toastEl.classList.add("hidden");

    if (!value && $("cleanScreenBtn")) {
      $("cleanScreenBtn").textContent = "Clean Screen";
    }
  }

  $("cleanScreenBtn").addEventListener("click", () => setCleanMode(true));

  view.addEventListener("touchstart", (event) => {
    if (!cleanMode || !event.touches.length) return;

    edgeStartX = event.touches[0].clientX;
    edgeStartY = event.touches[0].clientY;
  }, { passive: true });

  view.addEventListener("touchend", (event) => {
    if (!cleanMode || edgeStartX === null || !event.changedTouches.length) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - edgeStartX;
    const dy = Math.abs(touch.clientY - edgeStartY);
    const edge =
      edgeStartX < 35 || edgeStartX > window.innerWidth - 35;

    if (edge && Math.abs(dx) > 45 && dy < 100) {
      setCleanMode(false);
      toast("Controls restored");
    }

    edgeStartX = null;
    edgeStartY = null;
  }, { passive: true });
  
  // Camera controls.

  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera needs HTTPS and browser permission.");
      }

      stopCamera(false);

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      video.srcObject = stream;
      video.style.transform = mirrored ? "scaleX(-1)" : "none";
      await video.play();

      resize();
      setStatus("Camera ready");
      toast("Camera started");
    } catch (error) {
      console.error(error);
      setStatus("Camera error: " + error.message);
      toast("Allow camera permission and use HTTPS.");
    }
  }

  function stopCamera(update = true) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    video.srcObject = null;
    tracking = false;
    faceLandmarks = null;
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
      if (!document.fullscreenElement) {
        await view.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      resize();
    } catch (error) {
      toast("Fullscreen is unavailable in this browser.");
    }
  });

  $("dotsBtn").addEventListener("click", () => {
    showDots = !showDots;
    $("dotsBtn").textContent = showDots ? "Dots: On" : "Dots: Off";
    if (!showDots) clearDots();
  });

  // Face tracking. If the CDN fails, the error is displayed clearly.
  async function loadLandmarker() {
    if (landmarker) return landmarker;

    setStatus("Loading face tracking…");

    const vision = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
    );

    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true
    });

    return landmarker;
  }

  function clearDots() {
    dotsCtx.clearRect(0, 0, dotsCanvas.width, dotsCanvas.height);
  }

  function drawDots(points) {
    clearDots();
    if (!showDots || !points) return;

    const rect = dotsCanvas.getBoundingClientRect();
    dotsCtx.fillStyle = "#00ff66";

    for (const point of points) {
      const x = (mirrored ? 1 - point.x : point.x) * rect.width;
      const y = point.y * rect.height;

      dotsCtx.beginPath();
      dotsCtx.arc(x, y, 1.5, 0, Math.PI * 2);
      dotsCtx.fill();
    }
  }

  function updateFaceAnchor(points) {
    if (!points || points.length < 455) return;

    const leftEye = points[33];
    const rightEye = points[263];
    const forehead = points[10];
    const chin = points[152];
    const faceLeft = points[234];
    const faceRight = points[454];

    const centerX = (faceLeft.x + faceRight.x) / 2;
    const centerY = (forehead.y + chin.y) / 2;
    const eyeAngle = Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );

    faceAnchor.x = ((mirrored ? 1 - centerX : centerX) - 0.5) * 3.1;
    faceAnchor.y = (0.5 - centerY) * 2.5;
    faceAnchor.z = 0;
    faceAnchor.roll = eyeAngle;

    // This is a simple 2D landmark-based approximation, not full 3D head pose.
    faceAnchor.yaw = 0;
    faceAnchor.pitch = 0;

    faceLandmarks = points;
  }

  function updateExpressions(result) {
    if (!result?.faceBlendshapes?.length) return;

    const categories = result.faceBlendshapes[0].categories || [];
    const values = {};

    categories.forEach(item => {
      values[item.categoryName] = item.score;
    });

    const root = activeModel();
    if (!root) return;

    const mappings = [
      [/mouth.?open|jaw.?open/i, values.jawOpen || values.mouthOpen || 0],
      [/eye.?blink.?left|blink.?left|left.?blink/i, values.eyeBlinkLeft || 0],
      [/eye.?blink.?right|blink.?right|right.?blink/i, values.eyeBlinkRight || 0]
    ];

    collectMorphTargets(root).forEach(entry => {
      Object.entries(entry.names).forEach(([name, index]) => {
        const match = mappings.find(([pattern]) => pattern.test(name));
        if (match) entry.influences[index] = match[1];
      });
    });
  }

  function faceLoop() {
    if (!tracking) return;

    if (stream && video.readyState >= 2 &&
        video.currentTime !== lastVideoTime && landmarker) {
      lastVideoTime = video.currentTime;

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const points = result.faceLandmarks?.[0];

        if (points) {
          drawDots(points);
          updateFaceAnchor(points);
          updateExpressions(result);
          setStatus("Face tracking active");
        } else {
          faceLandmarks = null;
          clearDots();
          setStatus("Searching for face…");
        }
      } catch (error) {
        console.error("Tracking frame failed:", error);
        setStatus("Tracking frame error");
      }
    }

    requestAnimationFrame(faceLoop);
  }

  $("trackingBtn").addEventListener("click", async () => {
    if (tracking) {
      tracking = false;
      $("trackingBtn").textContent = "Face Track: Off";
      clearDots();
      setStatus("Face tracking stopped");
      return;
    }

    try {
      if (!stream) await startCamera();
      if (!stream) throw new Error("Camera did not start.");

      await loadLandmarker();
      tracking = true;
      lastVideoTime = -1;
      $("trackingBtn").textContent = "Face Track: On";
      setStatus("Searching for face…");
      requestAnimationFrame(faceLoop);
    } catch (error) {
      console.error("Tracking setup failed:", error);
      setStatus("Tracking error: " + error.message);
      toast("Tracking failed. Check the internet connection.");
    }
  });

  function updateFaceAttachedModel() {
    const root = activeModel();

    if (!root || !tracking || !faceLandmarks || !modelsVisible) return;

    const s = active();

    root.position.set(
      faceAnchor.x + s.faceOffset[0] + s.position[0],
      faceAnchor.y + s.faceOffset[1] + s.position[1],
      faceAnchor.z + s.faceOffset[2] + s.position[2]
    );

    root.rotation.set(
      THREE.MathUtils.degToRad(s.headOffset[0]) + s.rotation[0],
      faceAnchor.yaw + THREE.MathUtils.degToRad(s.headOffset[1]) + s.rotation[1],
      faceAnchor.roll + THREE.MathUtils.degToRad(s.headOffset[2]) + s.rotation[2]
    );
  }

  // Composite camera and 3D overlay for recording.
  function drawCover(ctx, source, w, h, mirror = false) {
    if (!source?.videoWidth) return;

    const scale = Math.max(w / source.videoWidth, h / source.videoHeight);
    const dw = source.videoWidth * scale;
    const dh = source.videoHeight * scale;
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
    if (!recordCanvas || !recordCtx || !recorder ||
        recorder.state === "inactive") return;

    const w = recordCanvas.width;
    const h = recordCanvas.height;

    recordCtx.clearRect(0, 0, w, h);
    drawCover(recordCtx, video, w, h, mirrored);
    recordCtx.drawImage(renderer.domElement, 0, 0, w, h);

    if (showDots) {
      recordCtx.drawImage(dotsCanvas, 0, 0, w, h);
    }

    recordRAF = requestAnimationFrame(compositeFrame);
  }

  $("micBtn").addEventListener("click", async () => {
    if (micOn) {
      micStream?.getTracks().forEach(track => track.stop());
      micStream = null;
      micOn = false;
      $("micBtn").textContent = "Mic: Off";
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micOn = true;
      $("micBtn").textContent = "Mic: On";
    } catch (error) {
      toast("Microphone permission denied.");
    }
  });

  $("recordBtn").addEventListener("click", async () => {
    try {
      if (!stream) await startCamera();
      if (!stream) throw new Error("Camera did not start.");

      recordCanvas = document.createElement("canvas");
      const rect = view.getBoundingClientRect();
      recordCanvas.width = Math.max(2, Math.round(rect.width));
      recordCanvas.height = Math.max(2, Math.round(rect.height));
      recordCtx = recordCanvas.getContext("2d");

      const canvasStream = recordCanvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks()];

      if (micOn && micStream) {
        tracks.push(...micStream.getAudioTracks());
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

      chunks = [];
      recorder = new MediaRecorder(new MediaStream(tracks), { mimeType });

      recorder.ondataavailable = event => {
        if (event.data?.size) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "azeez-ar-recording.webm";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast("Recording saved");
      };

      recorder.start();
      compositeFrame();

      $("recordBtn").disabled = true;
      $("stopRecordBtn").disabled = false;
      setCleanMode(true);
      toast("Recording started");
    } catch (error) {
      console.error(error);
      toast("Recording failed: " + error.message);
    }
  });

  $("stopRecordBtn").addEventListener("click", () => {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    cancelAnimationFrame(recordRAF);

    $("recordBtn").disabled = false;
    $("stopRecordBtn").disabled = true;
    setCleanMode(false);
  });

  // Export/import the editable settings for all four filter slots.
  $("exportSettingsBtn").addEventListener("click", () => {
    const data = slots.map(s => ({
      position: s.position,
      rotation: s.rotation,
      scale: s.scale,
      faceOffset: s.faceOffset,
      headOffset: s.headOffset,
      faceSize: s.faceSize,
      partScale: s.partScale,
      expressions: s.expressions
    }));

    const blob = new Blob(
      [JSON.stringify({ version: 1, slots: data, activeSlot }, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "azeez-ar-settings.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  $("importSettingsBtn").addEventListener("click", () => {
    $("settingsFile").click();
  });

  $("settingsFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());

      if (!Array.isArray(data.slots) || data.slots.length !== 4) {
        throw new Error("Invalid settings file.");
      }

      data.slots.forEach((item, i) => {
        const s = slots[i];

        if (Array.isArray(item.position)) s.position = item.position.slice(0, 3);
        if (Array.isArray(item.rotation)) s.rotation = item.rotation.slice(0, 3);
        if (Number.isFinite(item.scale)) s.scale = item.scale;
        if (Array.isArray(item.faceOffset)) s.faceOffset = item.faceOffset.slice(0, 3);
        if (Array.isArray(item.headOffset)) s.headOffset = item.headOffset.slice(0, 3);
        if (Number.isFinite(item.faceSize)) s.faceSize = item.faceSize;
        if (item.partScale) s.partScale = { ...s.partScale, ...item.partScale };
        if (item.expressions) s.expressions = { ...s.expressions, ...item.expressions };
      });

      activeSlot = Math.max(0, Math.min(3, Number(data.activeSlot) || 0));
      showActiveSlot();
      toast("Settings imported");
    } catch (error) {
      toast("Import failed: " + error.message);
    } finally {
      $("settingsFile").value = "";
    }
  });

  // Initial UI and render loop.
  showActiveSlot();
  setStatus("Ready — tap Start Camera");

  renderer.setAnimationLoop(() => {
    updateFaceAttachedModel();
    renderer.render(scene, camera);
  });

  window.addEventListener("beforeunload", () => {
    stopCamera(false);
    micStream?.getTracks().forEach(track => track.stop());
    if (landmarker?.close) landmarker.close();
    renderer.dispose();
  });
})();
                 
