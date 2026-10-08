const camera = document.getElementById("camera");
const startBtn = document.getElementById("startCameraBtn");
const status = document.getElementById("status");

let stream = null;

function setStatus(text) {
    if (status) {
        status.textContent = text;
    }
}

async function startCamera() {
    try {
        setStatus("Requesting Camera...");

        if (!navigator.mediaDevices) {
            throw new Error("Camera API unavailable");
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: false
        });

        camera.srcObject = stream;

        await camera.play();

        setStatus("Camera Working");

        console.log("CAMERA WORKING");

    } catch (error) {

        console.error(error);

        setStatus(
            "Camera Error: " +
            error.message
        );
    }
}

if (startBtn) {
    startBtn.addEventListener(
        "click",
        startCamera
    );
}

console.log("CAMERA TEST APP READY");
