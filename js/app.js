import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const video = document.getElementById("camera");
const status = document.getElementById("status");

let faceLandmarker = null;
let detecting = false;

async function startFaceTracking() {
    try {
        status.textContent = "Loading Face Model...";

        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        const modelPath =
            new URL(
                "../models/face_landmarker.task",
                import.meta.url
            ).href;

        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath: modelPath
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.3,
                    minFacePresenceConfidence: 0.3,
                    minTrackingConfidence: 0.3
                }
            );

        status.textContent = "FACE TRACKING READY ✓";

        detecting = true;
        detectFace();

    } catch (error) {
        console.error(error);
        status.textContent =
            "FACE MODEL ERROR: " + error.message;
    }
}

function detectFace() {
    if (!detecting || !faceLandmarker) return;

    if (video.readyState >= 2) {
        try {
            const results =
                faceLandmarker.detectForVideo(
                    video,
                    performance.now()
                );

            if (
                results.faceLandmarks &&
                results.faceLandmarks.length > 0
            ) {
                status.textContent = "FACE DETECTED ✓";
            } else {
                status.textContent = "FACE NOT DETECTED";
            }

        } catch (error) {
            console.error(error);
            status.textContent =
                "DETECTION ERROR: " + error.message;
        }
    }

    requestAnimationFrame(detectFace);
}

/* Wait until the camera is actually running */
video.addEventListener("playing", () => {
    if (!faceLandmarker) {
        startFaceTracking();
    }
});
