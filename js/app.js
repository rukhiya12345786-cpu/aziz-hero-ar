console.log("AZIZ AR - Camera Test");

const video = document.getElementById("camera");

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = stream;

        document.getElementById("status").textContent =
            "Camera Working ✓";

        console.log("Camera started");
    } catch (error) {
        document.getElementById("status").textContent =
            "Camera Error: " + error.message;

        console.error(error);
    }
}

startCamera();
