import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const video = document.getElementById("camera");
const status = document.getElementById("status");

let faceLandmarker = null;
let lastVideoTime = -1;
let trackingStarted = false;

function statusMessage(message) {
    console.log("[AZIZ AR]", message);

    if (status) {
        status.textContent = message;
    }
}

async function loadFaceTracker() {
    try {
        statusMessage("FACE: Loading MediaPipe...");

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        statusMessage("FACE: Loading model...");

        const modelPath =
            new URL(
                "../models/face_landmarker.task",
                import.meta.url
            ).href;

        console.log("[AZIZ AR] Model:", modelPath);

        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                vision,
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

        statusMessage("FACE TRACKING READY");

        waitForCamera();

    } catch (error) {

        console.error(
            "[AZIZ AR] Face tracker error:",
            error
        );

        statusMessage(
            "FACE ERROR: " +
            (error && error.message
                ? error.message
                : String(error))
        );
    }
}

function waitForCamera() {

    if (!video) {

        statusMessage(
            "ERROR: Camera element not found"
        );

        return;
    }

    if (video.readyState >= 2) {

        if (!trackingStarted) {

            trackingStarted = true;

            requestAnimationFrame(
                detectFace
            );
        }

        return;
    }

    statusMessage(
        "FACE: Waiting for camera..."
    );

    setTimeout(
        waitForCamera,
        300
    );
}

function detectFace() {

    if (!faceLandmarker) {

        requestAnimationFrame(
            detectFace
        );

        return;
    }

    if (!video) {

        requestAnimationFrame(
            detectFace
        );

        return;
    }

    if (video.readyState < 2) {

        requestAnimationFrame(
            detectFace
        );

        return;
    }

    if (video.currentTime === lastVideoTime) {

        requestAnimationFrame(
            detectFace
        );

        return;
    }

    lastVideoTime =
        video.currentTime;

    try {

        const results =
            faceLandmarker.detectForVideo(
                video,
                performance.now()
            );

        if (
            results &&
            results.faceLandmarks &&
            results.faceLandmarks.length > 0
        ) {

            statusMessage(
                "FACE DETECTED ✓"
            );

        } else {

            statusMessage(
                "FACE NOT DETECTED"
            );
        }

    } catch (error) {

        console.error(
            "[AZIZ AR] Detection error:",
            error
        );

        statusMessage(
            "DETECTION ERROR: " +
            (error && error.message
                ? error.message
                : String(error))
        );
    }

    requestAnimationFrame(
        detectFace
    );
}

loadFaceTracker();
