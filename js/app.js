const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const status = document.getElementById("status");

const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById("switchCameraButton");

const flipCameraButton =
  document.getElementById("flipCameraButton");

const modelInput =
  document.getElementById("import3DInput");

const modelButtonElement =
  document.getElementById("modelButton");

let cameraStream = null;
let facingMode = "user";
let isMirrored = false;

function showStatus(message) {
  if (status) {
    status.textContent = message;
  }

  console.log(message);
}

function updateMirror() {
  const transform =
    isMirrored
      ? "scaleX(-1)"
      : "scaleX(1)";

  video.style.transform = transform;
  canvas.style.transform = transform;
}

async function openCamera() {
  try {
    showStatus("Requesting camera...");

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });

      cameraStream = null;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      showStatus(
        "Camera API not available. Use HTTPS."
      );

      return;
    }

    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

    video.srcObject = cameraStream;

    await video.play();

    updateMirror();

    if (typeof cube !== "undefined") {
      cube.visible = false;
    }

    showStatus(
      facingMode === "user"
        ? "Front camera ON"
        : "Back camera ON"
    );

  } catch (error) {
    console.error(error);

    showStatus(
      "CAMERA ERROR: " +
      (error.message ||
        "Camera could not start")
    );
  }
}

async function switchCamera() {
  facingMode =
    facingMode === "user"
      ? "environment"
      : "user";

  if (facingMode === "environment") {
    isMirrored = false;
  }

  await openCamera();
}

function flipCamera() {
  isMirrored = !isMirrored;

  updateMirror();

  showStatus(
    isMirrored
      ? "Flip ON"
      : "Flip OFF"
  );
}

if (cameraButton) {
  cameraButton.addEventListener(
    "click",
    openCamera
  );
}

if (switchCameraButton) {
  switchCameraButton.addEventListener(
    "click",
    switchCamera
  );
}

if (flipCameraButton) {
  flipCameraButton.addEventListener(
    "click",
    flipCamera
  );
}

window.addEventListener("error", event => {
  showStatus(
    "ERROR: " +
    (event.message ||
      "Unknown error")
  );
});

window.addEventListener(
  "unhandledrejection",
  event => {
    showStatus(
      "ERROR: " +
      (
        event.reason?.message ||
        String(event.reason)
      )
    );
  }
);

updateMirror();

showStatus("Loading 3D engine...");

const THREE =
  await import(
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
  );

const scene =
  new THREE.Scene();

const renderer =
  new THREE.WebGLRenderer({
    canvas: canvas,
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

const threeCamera =
  new THREE.PerspectiveCamera(
    45,
    window.innerWidth /
      window.innerHeight,
    0.1,
    100
  );

threeCamera.position.z = 5;

const light =
  new THREE.DirectionalLight(
    0xffffff,
    3
  );

light.position.set(
  2,
  3,
  5
);

scene.add(light);

scene.add(
  new THREE.AmbientLight(
    0xffffff,
    1.5
  )
);

const cube =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.7,
      0.7,
      0.7
    ),
    new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      roughness: 0.5,
      metalness: 0.1
    })
  );

cube.position.set(
  0,
  0,
  0
);

cube.visible = true;

scene.add(cube);

function resize3D() {
  const width =
    window.innerWidth;

  const height =
    window.innerHeight;

  renderer.setSize(
    width,
    height,
    false
  );

  threeCamera.aspect =
    width / height;

  threeCamera.updateProjectionMatrix();
}

function animate3D() {
  requestAnimationFrame(
    animate3D
  );

  if (cube.visible) {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;
  }

  renderer.render(
    scene,
    threeCamera
  );
}

resize3D();

window.addEventListener(
  "resize",
  resize3D
);

animate3D();

showStatus(
  "Camera + 3D ready"
);

let importedModel = null;

async function loadThreeAddon(path) {
  return await import(path);
}

async function import3DModel(file) {
  if (!file) {
    return;
  }

  try {
    showStatus(
      "Loading 3D model..."
    );

    const fileName =
      file.name.toLowerCase();

    let object = null;

    if (
      fileName.endsWith(".glb") ||
      fileName.endsWith(".gltf")
    ) {
      const module =
        await loadThreeAddon(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"
        );

      const loader =
        new module.GLTFLoader();

      const url =
        URL.createObjectURL(file);

      const result =
        await loader.loadAsync(
          url
        );

      URL.revokeObjectURL(
        url
      );

      object =
        result.scene;

    } else if (
      fileName.endsWith(".obj")
    ) {
      const module =
        await loadThreeAddon(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js"
        );

      const loader =
        new module.OBJLoader();

      const url =
        URL.createObjectURL(file);

      object =
        await loader.loadAsync(
          url
        );

      URL.revokeObjectURL(
        url
      );

    } else if (
      fileName.endsWith(".stl")
    ) {
      const module =
        await loadThreeAddon(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/STLLoader.js"
        );

      const loader =
        new module.STLLoader();

      const url =
        URL.createObjectURL(file);

      const geometry =
        await loader.loadAsync(
          url
        );

      URL.revokeObjectURL(
        url
      );

      geometry.computeVertexNormals();

      const material =
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.6,
          metalness: 0.1
        });

      object =
        new THREE.Mesh(
          geometry,
          material
        );

    } else {
      showStatus(
        "Unsupported 3D format"
      );

      return;
    }

    if (!object) {
      showStatus(
        "3D model could not be loaded"
      );

      return;
    }

    if (importedModel) {
      scene.remove(
        importedModel
      );

      importedModel.traverse(
        child => {
          if (child.geometry) {
            child.geometry.dispose();
          }

          if (child.material) {
            const materials =
              Array.isArray(
                child.material
              )
                ? child.material
                : [child.material];

            materials.forEach(
              material => {
                if (material.map) {
                  material.map.dispose();
                }

                material.dispose();
              }
            );
          }
        }
      );
    }

    importedModel =
      object;

    cube.visible = false;

    importedModel.visible =
      true;

    scene.add(
      importedModel
    );

    fitModelToView(
      importedModel
    );

    showStatus(
      "3D model imported"
    );

  } catch (error) {
    console.error(
      "3D import error:",
      error
    );

    showStatus(
      "3D IMPORT ERROR: " +
      (
        error.message ||
        "Unable to load model"
      )
    );
  }
}

function fitModelToView(object) {
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
    maxSize > 0 &&
    Number.isFinite(maxSize)
  ) {
    const scale =
      1.5 / maxSize;

    object.scale.setScalar(
      scale
    );
  }

  object.position.z = 0;
}

if (modelButtonElement) {
  modelButtonElement.addEventListener(
    "click",
    () => {
      modelInput.value = "";
      modelInput.click();
    }
  );
}

if (modelInput) {
  modelInput.addEventListener(
    "change",
    event => {
      const file =
        event.target.files &&
        event.target.files[0];

      import3DModel(file);
    }
  );
}const scaleSlider =
  document.getElementById("scaleSlider");

const xSlider =
  document.getElementById("xSlider");

const ySlider =
  document.getElementById("ySlider");

const zSlider =
  document.getElementById("zSlider");

const rotateXSlider =
  document.getElementById("rotateXSlider");

const rotateYSlider =
  document.getElementById("rotateYSlider");

const rotateZSlider =
  document.getElementById("rotateZSlider");

function updateImportedModelControls() {
  if (!importedModel) {
    showStatus("Import a 3D model first");
    return;
  }

  const scale =
    Number(scaleSlider.value);

  importedModel.scale.setScalar(
    scale
  );

  importedModel.position.x =
    Number(xSlider.value);

  importedModel.position.y =
    Number(ySlider.value);

  importedModel.position.z =
    Number(zSlider.value);

  importedModel.rotation.x =
    THREE.MathUtils.degToRad(
      Number(rotateXSlider.value)
    );

  importedModel.rotation.y =
    THREE.MathUtils.degToRad(
      Number(rotateYSlider.value)
    );

  importedModel.rotation.z =
    THREE.MathUtils.degToRad(
      Number(rotateZSlider.value)
    );
}

[
  scaleSlider,
  xSlider,
  ySlider,
  zSlider,
  rotateXSlider,
  rotateYSlider,
  rotateZSlider
].forEach(slider => {
  if (slider) {
    slider.addEventListener(
      "input",
      updateImportedModelControls
    );
  }
});

function resetImportedModelControls() {
  if (!importedModel) {
    return;
  }

  scaleSlider.value = "1";
  xSlider.value = "0";
  ySlider.value = "0";
  zSlider.value = "0";

  rotateXSlider.value = "0";
  rotateYSlider.value = "0";
  rotateZSlider.value = "0";

  updateImportedModelControls();

  showStatus(
    "3D controls reset"
  );
}

const resetButton =
  document.getElementById("resetButton");

if (resetButton) {
  resetButton.addEventListener(
    "click",
    resetImportedModelControls
  );
}const sideControls =
  document.getElementById("sideControls");

const hideControlsButton =
  document.getElementById("hideControlsButton");

const showControlsButton =
  document.getElementById("showControlsButton");

if (
  sideControls &&
  hideControlsButton &&
  showControlsButton
) {
  hideControlsButton.addEventListener(
    "click",
    () => {
      sideControls.classList.add(
        "hiddenControls"
      );

      hideControlsButton.style.display =
        "none";

      showControlsButton.style.display =
        "block";

      showStatus(
        "Controls hidden"
      );
    }
  );

  showControlsButton.addEventListener(
    "click",
    () => {
      sideControls.classList.remove(
        "hiddenControls"
      );

      hideControlsButton.style.display =
        "block";

      showControlsButton.style.display =
        "none";

      showStatus(
        "Controls visible"
      );
    }
  );
}
