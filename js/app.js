// AZEEZ AR HEAD TRACKER
// PART 1 OF 5
// Camera, UI visibility, basic controls

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const app = window.AZEEZ_AR = window.AZEEZ_AR || {};

  app.version = "1.0";
  app.cameraStream = null;
  app.facingMode = "user";
  app.mirrorEnabled = false;
  app.cameraStarted = false;
  app.trackingStarted = false;
  app.meshVisible = true;
  app.landmarksVisible = true;
  app.expressionsEnabled = true;
  app.headFitEnabled = false;
  app.autoHeadFit = false;
  app.recording = false;
  app.loadedModel = null;
  app.faceLandmarker = null;
  app.animationFrame = null;

  const video = $("cameraVideo");
  const placeholder = $("cameraPlaceholder");
  const cameraStatus = $("cameraStatus");
  const trackingStatus = $("trackingStatus");
  const faceStatus = $("faceStatus");
  const appStatus = $("appStatus");
  const generalStatus = $("generalStatus");

  const startCameraBtn = $("startCameraBtn");
  const stopCameraBtn = $("stopCameraBtn");
  const switchCameraBtn = $("switchCameraBtn");
  const mirrorBtn = $("mirrorBtn");

  const startTrackingBtn = $("startTrackingBtn");
  const stopTrackingBtn = $("stopTrackingBtn");

  const toggleSlidersBtn = $("toggleSlidersBtn");
  const toggleControlsBtn = $("toggleControlsBtn");

  const slidersPanel = $("slidersPanel");
  const controlsPanel = $("controlsPanel");
  const recordingControls = $("recordingControls");

  function setText(id, message) {
    const element = $(id);
    if (element) element.textContent = message;
  }

  function setStatus(message) {
    setText("generalStatus", message);
    setText("appStatus", app.cameraStarted ? "CAMERA ON" : "READY");
  }

  function setCameraMessage(message) {
    setText("cameraStatus", message);
    setText("trackingStatus", message);
  }

  function updateVideoMirror() {
    if (!video) return;

    video.style.transform = app.mirrorEnabled
      ? "scaleX(-1)"
      : "scaleX(1)";

    setText(
      "mirrorBtn",
      "MIRROR FLIP: " + (app.mirrorEnabled ? "ON" : "OFF")
    );
  }

  function updateCameraButtons() {
    if (startCameraBtn) {
      startCameraBtn.disabled = app.cameraStarted;
    }

    if (stopCameraBtn) {
      stopCameraBtn.disabled = !app.cameraStarted;
    }

    if (switchCameraBtn) {
      switchCameraBtn.disabled = !navigator.mediaDevices?.getUserMedia;
    }
  }

  async function startCamera() {
    if (!video) {
      setStatus("ERROR: cameraVideo element not found.");
      return;
    }

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
      setCameraMessage(
        "Camera unavailable. Open this site using HTTPS."
      );
      setStatus("Camera API unavailable.");
      return;
    }

    if (app.cameraStarted && app.cameraStream) {
      setCameraMessage("Camera is already running.");
      return;
    }

    setCameraMessage("Requesting camera permission...");
    setStatus("Starting camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: app.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      app.cameraStream = stream;
      video.srcObject = stream;

      await video.play();

      app.cameraStarted = true;

      if (placeholder) {
        placeholder.style.display = "none";
      }

      updateVideoMirror();
      updateCameraButtons();

      setCameraMessage("Camera running. Start face tracking next.");
      setText("faceStatus", "Waiting for face tracking to start.");
      setStatus("Camera started successfully.");

    } catch (error) {
      app.cameraStream = null;
      app.cameraStarted = false;

      updateCameraButtons();

      let message = "Camera failed to start.";

      if (error.name === "NotAllowedError") {
        message = "Camera permission denied. Allow camera access.";
      } else if (error.name === "NotFoundError") {
        message = "No compatible camera found.";
      } else if (error.name === "NotReadableError") {
        message = "Camera is busy. Close other camera apps.";
      } else if (error.name === "OverconstrainedError") {
        message = "Requested camera settings are unavailable.";
      }

      setCameraMessage(message);
      setStatus(message);
      console.error("Camera error:", error);
    }
  }

  function stopCamera() {
    stopTracking();

    if (app.cameraStream) {
      app.cameraStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    app.cameraStream = null;
    app.cameraStarted = false;

    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (placeholder) {
      placeholder.style.display = "flex";
    }

    updateCameraButtons();

    setCameraMessage("Camera stopped.");
    setText("faceStatus", "Face tracking stopped.");
    setStatus("Camera stopped.");
  }

  async function switchCamera() {
    const wasRunning = app.cameraStarted;

    if (!wasRunning) {
      app.facingMode =
        app.facingMode === "user" ? "environment" : "user";

      setCameraMessage(
        "Selected camera: " +
        (app.facingMode === "user" ? "Front" : "Back")
      );

      return;
    }

    const previousMode = app.facingMode;

    app.facingMode =
      app.facingMode === "user" ? "environment" : "user";

    stopCamera();

    await startCamera();

    if (!app.cameraStarted) {
      app.facingMode = previousMode;
    }
  }

  function toggleMirror() {
    app.mirrorEnabled = !app.mirrorEnabled;
    updateVideoMirror();

    setStatus(
      "Mirror flip " + (app.mirrorEnabled ? "enabled." : "disabled.")
    );
  }

  function toggleSliders() {
    if (!slidersPanel) return;

    const willHide =
      !slidersPanel.classList.contains("hidden-panel");

    slidersPanel.classList.toggle("hidden-panel", willHide);

    setText(
      "toggleSlidersBtn",
      willHide ? "SHOW SLIDERS" : "HIDE SLIDERS"
    );
  }

  function toggleControls() {
    if (!controlsPanel) return;

    const willHide =
      !controlsPanel.classList.contains("hidden-panel");

    controlsPanel.classList.toggle("hidden-panel", willHide);

    if (recordingControls) {
      recordingControls.classList.toggle("hidden-panel", willHide);
    }

    setText(
      "toggleControlsBtn",
      willHide ? "SHOW CONTROLS" : "HIDE CONTROLS"
    );
  }

  function stopTracking() {
    app.trackingStarted = false;

    if (app.animationFrame !== null) {
      cancelAnimationFrame(app.animationFrame);
      app.animationFrame = null;
    }

    setText("faceStatus", "Face tracking stopped.");
  }

  function startTracking() {
    if (!app.cameraStarted) {
      setText(
        "faceStatus",
        "Start the camera before starting face tracking."
      );
      return;
    }

    // MediaPipe tracking is implemented in a later part.
    if (typeof app.initializeFaceTracking === "function") {
      app.initializeFaceTracking();
    } else {
      setText(
        "faceStatus",
        "Camera ready. Complete the remaining app.js parts to enable tracking."
      );
    }
  }

  // Keep slider values visible while moving the sliders.

  const sliderIds = [
    "meshScale", "meshX", "meshY", "meshZ", "meshRotation",
    "modelScale", "modelX", "modelY", "modelZ",
    "modelPitch", "modelYaw", "modelRoll", "headFit"
  ];

  function updateSliderLabel(id) {
    const slider = $(id);
    const label = $(id + "Value");

    if (!slider || !label) return;

    let suffix = "";

    if (id === "meshScale" ||
        id === "modelScale" ||
        id === "headFit") {
      suffix = "%";
    } else if (
      id === "meshRotation" ||
      id === "modelPitch" ||
      id === "modelYaw" ||
      id === "modelRoll"
    ) {
      suffix = "°";
    }

    label.textContent = slider.value + suffix;
  }

  sliderIds.forEach((id) => {
    const slider = $(id);

    if (!slider) return;

    slider.addEventListener("input", () => {
      updateSliderLabel(id);

      if (typeof app.applySlider === "function") {
        app.applySlider(id, Number(slider.value));
      }
    });

    updateSliderLabel(id);
  });

  // Connect the buttons that already exist in index.html.

  startCameraBtn?.addEventListener("click", startCamera);
  stopCameraBtn?.addEventListener("click", stopCamera);
  switchCameraBtn?.addEventListener("click", switchCamera);
  mirrorBtn?.addEventListener("click", toggleMirror);

  startTrackingBtn?.addEventListener("click", startTracking);
  stopTrackingBtn?.addEventListener("click", stopTracking);

  toggleSlidersBtn?.addEventListener("click", toggleSliders);
  toggleControlsBtn?.addEventListener("click", toggleControls);

  // Publish functions for the following app.js parts.

  app.startCamera = startCamera;
  app.stopCamera = stopCamera;
  app.switchCamera = switchCamera;
  app.stopTracking = stopTracking;
  app.setStatus = setStatus;

  updateCameraButtons();
  updateVideoMirror();

  setStatus("Part 1 loaded. Press START CAMERA to begin.");

  console.log("Azeez AR: Part 1 initialized.");
})();
