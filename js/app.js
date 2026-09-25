// CAMERA TEST

const video = document.getElementById("camera");
const statusBox = document.getElementById("status");
const cameraButton = document.getElementById("cameraButton");

statusBox.textContent = "Camera Test Ready";

cameraButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: true
    });

    video.srcObject = stream;
    video.play();

    statusBox.textContent = "CAMERA WORKING ✅";
  } catch (error) {
    statusBox.textContent = "CAMERA ERROR: " + error.name;
    alert("Camera Error: " + error.name);
  }
});
