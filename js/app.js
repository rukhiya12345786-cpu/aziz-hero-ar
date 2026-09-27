const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const status = document.getElementById("status");

const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById("switchCameraButton");

const flipCameraButton =
  document.getElementById("flipCameraButton");

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

    if (
      cameraStream
    ) {

      cameraStream
        .getTracks()
        .forEach(track => {
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
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        },
        audio: false
      });


    video.srcObject =
      cameraStream;


    await video.play();


    updateMirror();


    showStatus(
      facingMode === "user"
        ? "Front camera ON"
        : "Back camera ON"
    );

  } catch (error) {

    console.error(error);

    showStatus(
      "CAMERA ERROR: " +
      (
        error.message ||
        "Camera could not start"
      )
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

  isMirrored =
    !isMirrored;

  updateMirror();


  showStatus(
    isMirrored
      ? "Flip ON"
      : "Flip OFF"
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
  flipCamera
);


window.addEventListener(
  "error",
  event => {

    showStatus(
      "ERROR: " +
      (
        event.message ||
        "Unknown error"
      )
    );
  }
);


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


showStatus(
  "Camera test ready"
);
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
      1,
      1,
      1
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


  cube.rotation.x +=
    0.01;

  cube.rotation.y +=
    0.015;


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
