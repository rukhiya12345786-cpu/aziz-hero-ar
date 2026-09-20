// Start camera function
async function startCamera() {
try {
if (mediaStream) {
mediaStream.getTracks().forEach(track => track.stop());
}
mediaStream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
audio: true
});
video.srcObject = mediaStream;
message("Camera started successfully.");
$("start").disabled = true;
$("switchCam").disabled = false;
$("record").disabled = false;
$("stop").disabled = false;
} catch (err) {
console.error(err);
message("Error starting camera: " + err.message);
}
}

// Stop camera function
function stopCamera() {
if (mediaStream) {
mediaStream.getTracks().forEach(track => track.stop());
mediaStream = null;
}
video.srcObject = null;
message("Camera stopped.");
$("start").disabled = false;
$("switchCam").disabled = true;
$("record").disabled = true;
$("stop").disabled = true;
}

$("start").addEventListener("click", startCamera);
$("stop").addEventListener("click", stopCamera);
$("switchCam").addEventListener("click", () => {
currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
startCamera();
});

// Enable button on DOM content loaded
window.addEventListener("DOMContentLoaded", () => {
$("start").disabled = false;
message("Libraries loaded. Please click 'Camera Start'.");
});

// Animation loop
function animate() {
requestAnimationFrame(animate);
renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>
