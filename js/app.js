

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/TransformControls.js";

const view = document.getElementById("view");
const video = document.getElementById("cameraVideo");
const status = document.getElementById("status");

if (!view || !video) {
  throw new Error("Camera stage was not found.");
}

const state = {
  model: null,
  mode: "translate",
  selectedFilter: 0,
  filters: [null, null, null, null],
  selectedPart: "model",
  slidersHidden: false,
  menuHidden: false
};

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(view.clientWidth, view.clientHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = "ar3dCanvas";

Object.assign(renderer.domElement.style, {
  position: "absolute",
  inset: "0",
  width: "100%",
  height: "100%",
  zIndex: "5",
  touchAction: "none"
});

view.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  view.clientWidth / Math.max(1, view.clientHeight),
  0.01,
  1000
);

camera.position.set(0, 0, 5);

scene.add(new THREE.HemisphereLight(0xffffff, 0x455066, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(2, 4, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
fillLight.position.set(-3, 1, 2);
scene.add(fillLight);

const modelRoot = new THREE.Group();
scene.add(modelRoot);

const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setMode("translate");
gizmo.setSpace("local");
gizmo.setSize(0.8);
scene.add(gizmo.getHelper());

gizmo.addEventListener("dragging-changed", event => {
  renderer.domElement.style.touchAction =
    event.value ? "none" : "pan-y";
});

gizmo.addEventListener("objectChange", () => {
  updateTransformReadout();
});

const ui = document.createElement("div");
ui.id = "ar3dControls";

Object.assign(ui.style, {
  position: "absolute",
  top: "8px",
  right: "8px",
  zIndex: "20",
  width: "min(210px, 48%)",
  maxHeight: "75%",
  overflowY: "auto",
  padding: "9px",
  borderRadius: "12px",
  background: "rgba(5,12,24,0.88)",
  color: "white",
  font: "12px Arial,sans-serif"
});

view.appendChild(ui);

function makeButton(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;

  Object.assign(button.style, {
    minHeight: "36px",
    padding: "6px",
    border: "0",
    borderRadius: "7px",
    color: "white",
    background: "#1769db",
    fontWeight: "bold",
    fontSize: "11px",
    cursor: "pointer"
  });

  button.addEventListener("click", callback);
  return button;
}

function makeSection(title) {
  const heading = document.createElement("div");
  heading.textContent = title;

  Object.assign(heading.style, {
    fontWeight: "bold",
    margin: "9px 0 5px"
  });

  ui.appendChild(heading);
}

function makeGrid(columns = 2) {
  const grid = document.createElement("div");

  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: "5px",
    marginBottom: "6px"
  });

  ui.appendChild(grid);
  return grid;
}

function addSlider(label, min, max, value, step, callback) {
  const wrap = document.createElement("label");

  Object.assign(wrap.style, {
    display: "block",
    margin: "8px 0"
  });

  const title = document.createElement("div");
  title.textContent = `${label}: ${value}`;

  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;

  Object.assign(input.style, {
    width: "100%",
    display: "block"
  });

  input.addEventListener("input", () => {
    title.textContent = `${label}: ${input.value}`;
    callback(Number(input.value));
  });

  wrap.append(title, input);
  ui.appendChild(wrap);
  return input;
}

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".glb,.gltf,.obj,.fbx";
fileInput.hidden = true;
document.body.appendChild(fileInput);

makeSection("3D MODEL");

const importGrid = makeGrid(1);
importGrid.appendChild(
  makeButton("IMPORT 3D MODEL", () => fileInput.click())
);

makeSection("TRANSFORM TOOL");

const toolGrid = makeGrid(3);

for (const [label, mode] of [
  ["MOVE", "translate"],
  ["ROTATE", "rotate"],
  ["SCALE", "scale"]
]) {
  toolGrid.appendChild(makeButton(label, () => {
    state.mode = mode;
    gizmo.setMode(mode);
    report(`Tool selected: ${label}`);
  }));
}

makeSection("MODEL POSITION");

const transformReadout = document.createElement("div");
transformReadout.style.lineHeight = "1.6";
transformReadout.style.overflowWrap = "anywhere";
ui.appendChild(transformReadout);

function updateTransformReadout() {
  const object = state.model;
  if (!object) {
    transformReadout.textContent = "No model loaded";
    return;
  }

  transformReadout.textContent =
    `X: ${object.position.x.toFixed(2)} | ` +
    `Y: ${object.position.y.toFixed(2)} | ` +
    `Z: ${object.position.z.toFixed(2)} | ` +
    `Scale: ${object.scale.x.toFixed(2)}`;
}

function addTransformSliders() {
  makeSection("POSITION SLIDERS");

  for (const axis of ["x", "y", "z"]) {
    addSlider(
      `Position ${axis.toUpperCase()}`,
      -3, 3, 0, 0.01,
      value => {
        if (!state.model) return;
        state.model.position[axis] = value;
        updateTransformReadout();
      }
    );
  }

  makeSection("ROTATION SLIDERS");

  for (const axis of ["x", "y", "z"]) {
    addSlider(
      `Rotation ${axis.toUpperCase()}`,
      -180, 180, 0, 1,
      value => {
        if (!state.model) return;
        state.model.rotation[axis] =
          THREE.MathUtils.degToRad(value);
      }
    );
  }

  makeSection("MODEL SIZE");

  addSlider("Scale", 0.01, 3, 1, 0.01, value => {
    if (!state.model) return;
    state.model.scale.setScalar(value);
    updateTransformReadout();
  });
}

addTransformSliders();

makeSection("FOUR FILTER SLOTS");

const filterGrid = makeGrid(2);

for (let i = 0; i < 4; i++) {
  filterGrid.appendChild(
    makeButton(`FILTER ${i + 1}`, () => {
      state.selectedFilter = i;
      report(
        state.filters[i]
          ? `Selected filter ${i + 1}`
          : `Filter ${i + 1} is empty. Import support will be added next.`
      );
    })
  );
}

makeSection("VISIBILITY");

const visibilityGrid = makeGrid(2);

visibilityGrid.appendChild(
  makeButton("HIDE SLIDERS", () => {
    state.slidersHidden = !state.slidersHidden;

    ui.querySelectorAll("input[type=range]").forEach(input => {
      input.parentElement.style.display =
        state.slidersHidden ? "none" : "block";
    });

    visibilityGrid.children[0].textContent =
      state.slidersHidden ? "SHOW SLIDERS" : "HIDE SLIDERS";
  })
);

visibilityGrid.appendChild(
  makeButton("HIDE MENU", () => {
    state.menuHidden = !state.menuHidden;

    for (const child of [...ui.children]) {
      if (child !== visibilityGrid && child !== visibilityGrid.parentElement) {
        child.style.display = state.menuHidden ? "none" : "";
      }
    }

    visibilityGrid.children[1].textContent =
      state.menuHidden ? "SHOW MENU" : "HIDE MENU";
  })
);

function report(message) {
  if (status) status.textContent = message;
}

function disposeModel(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    }
  });
}

function showBlendShapes(object) {
  const meshes = [];

  object.traverse(child => {
    if (child.isMesh && child.morphTargetDictionary) {
      meshes.push(child);
    }
  });

  const names = new Set();

  for (const mesh of meshes) {
    Object.keys(mesh.morphTargetDictionary).forEach(name => {
      names.add(name);
    });
  }

  if (names.size === 0) {
    report("Model loaded. No facial morph targets found.");
    return;
  }

  makeSection("MODEL BLEND SHAPES");

  for (const name of names) {
    const mesh = meshes.find(
      item => item.morphTargetDictionary[name] !== undefined
    );

    const index = mesh.morphTargetDictionary[name];

    addSlider(name, 0, 100, 0, 1, value => {
      mesh.morphTargetInfluences[index] = value / 100;
    });
  }

  report(`Model loaded. Found ${names.size} morph targets.`);
}

async function loadModel(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const url = URL.createObjectURL(file);

  report(`Loading ${file.name}...`);

  try {
    let object;

    if (extension === "glb" || extension === "gltf") {
      const loader = new GLTFLoader();
      const result = await loader.loadAsync(url);
      object = result.scene;
    } else if (extension === "obj") {
      const loader = new OBJLoader();
      object = await loader.loadAsync(url);
    } else if (extension === "fbx") {
      const loader = new FBXLoader();
      object = await loader.loadAsync(url);
    } else {
      throw new Error("Unsupported model format.");
    }

    if (state.model) {
      gizmo.detach();
      modelRoot.remove(state.model);
      disposeModel(state.model);
    }

    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    if (maxSize > 0) {
      object.position.sub(center);
      object.scale.multiplyScalar(1.5 / maxSize);
    }

    modelRoot.add(object);
    state.model = object;
    gizmo.attach(object);

    showBlendShapes(object);
    updateTransformReadout();

    if (extension === "obj") {
      report("OBJ loaded. Textures may require separate MTL/material files.");
    } else {
      report(`Loaded ${file.name}. Check model alignment.`);
    }
  } catch (error) {
    report(`Model import failed: ${error.message}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

fileInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) loadModel(file);
  fileInput.value = "";
});

function resize() {
  const width = Math.max(1, view.clientWidth);
  const height = Math.max(1, view.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

new ResizeObserver(resize).observe(view);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

resize();
animate();
report("3D tools ready. Start camera, then import a 3D model.");
  
