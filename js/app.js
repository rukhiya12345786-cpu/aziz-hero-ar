import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

alert("FACE SCRIPT LOADED");

const video = document.getElementById("camera");
const status = document.getElementById("status");

let faceLandmarker = null;
let lastVideoTime = -1;
let trackingStarted = false;

function showStatus(message) {
    console.log("[AZIZ AR]", message);

    if (status) {
        status.textContent = message;
    }
}

async function startFaceTracking() {

    try {

        showStatus("FACE: Loading MediaPipe...");

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        showStatus("FACE: Loading Face Model...");

        const modelPath =
            new URL(
                "../models/face_landmarker.task",
                import.meta.url
            ).href;

        console.log(
            "[AZIZ AR] Model path:",
            modelPath
        );

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

        showStatus(
            "FACE TRACKING READY ✓"
        );

        waitForCamera();

    } catch (error) {

        console.error(
            "[AZIZ AR] FACE TRACKING ERROR:",
            error
        );

        showStatus(
            "FACE ERROR: " +
            (
                error && error.message
                    ? error.message
                    : String(error)
            )
        );
    }
}

function waitForCamera() {

    if (!video) {

        showStatus(
            "ERROR: CAMERA ELEMENT NOT FOUND"
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

    showStatus(
        "FACE: WAITING FOR CAMERA..."
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

    if (
        video.currentTime ===
        lastVideoTime
    ) {

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

            showStatus(
                "FACE DETECTED ✓"
            );

            console.log(
                "[AZIZ AR] Face landmarks:",
                results.faceLandmarks[0]
            );

        } else {

            showStatus(
                "FACE NOT DETECTED"
            );
        }

    } catch (error) {

        console.error(
            "[AZIZ AR] DETECTION ERROR:",
            error
        );

        showStatus(
            "DETECTION ERROR: " +
            (
                error && error.message
                    ? error.message
                    : String(error)
            )
        );
    }

    requestAnimationFrame(
        detectFace
    );
}

startFaceTracking();
