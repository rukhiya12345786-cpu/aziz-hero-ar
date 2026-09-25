import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const video = document.getElementById("camera");
const status = document.getElementById("status");

let faceLandmarker = null;

async function loadFaceTracking() {
    try {
        status.textContent = "LOADING FACE MODEL...";

        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        status.textContent = "LOADING FACE TRACKER...";

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
                    numFaces: 1
                }
            );

        status.textContent = "FACE TRACKING READY ✓";

        waitForCamera();

    } catch (error) {
        console.error("FACE TRACKING ERROR:", error);

        status.textContent =
            "FACE ERROR: " + error.message;
    }
}

function waitForCamera() {

    if (video.readyState >= 2) {
        detectFace();
        return;
    }

    setTimeout(waitForCamera, 200);
}

function detectFace() {

    if (!faceLandmarker) {
        return;
    }

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

        console.error("DETECTION ERROR:", error);

        status.textContent =
            "DETECTION ERROR: " + error.message;
    }

    requestAnimationFrame(detectFace);
}

loadFaceTracking();
