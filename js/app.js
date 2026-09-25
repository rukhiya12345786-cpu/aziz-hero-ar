// AZIZ HERO AR - TEST

const statusBox = document.getElementById("status");
const cameraButton = document.getElementById("cameraButton");

statusBox.textContent = "JavaScript WORKING ✅";

cameraButton.addEventListener("click", () => {
  statusBox.textContent = "BUTTON WORKING ✅";
  alert("Camera button JavaScript is working!");
});
