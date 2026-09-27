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
