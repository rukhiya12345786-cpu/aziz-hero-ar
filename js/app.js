import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const video = document.getElementById("camera");
const status = document.getElementById("status");

let faceLandmarker = null;
let lastVideoTime = -1;

function setStatus(message) {
    if (status) {
        status.textContent = message;
    }
    console.log(message);
}

async function startFaceTracking() {
    try {
        setStatus("FACE: Loading MediaPipe...");

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );

        setStatus("FACE: Loading model...");

        const modelPath = new URL(
            "../models/face_landmarker.task",
            import.meta.url
        ).href;

        console.log("MODEL:", modelPath);

        faceLandmarker = await FaceLandmarker.createFromOptions(
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

        setStatus("FACE TRACKING READY");

        waitForVideo();

    } catch (error) {
        console.error("FACE TRACKING ERROR:", error);

        setStatus(
            "FACE ERROR: " +
            (error && error.message
                ? error.message
                : String(error))
        );
    }
}

function waitForVideo() {

    if (!video) {
        setStatus("VIDEO ERROR");
        return;
    }

    if (video.readyState >= 2) {
        requestAnimationFrame(detectFace);
        return;
    }

    setStatus("FACE: Waiting for camera...");

    setTimeout(waitForVideo, 300);
}

function detectFace() {

    if (!faceLandmarker || !video) {
        requestAnimationFrame(detectFace);
        return;
    }

    if (video.readyState < 2) {
        requestAnimationFrame(detectFace);
        return;
    }

    if (video.currentTime === lastVideoTime) {
        requestAnimationFrame(detectFace);
        return;
    }

    lastVideoTime = video.currentTime;

    try {

        const results = faceLandmarker.detectForVideo(
            video,
            performance.now()
        );

        if (
            results &&
            results.faceLandmarks &&
            results.faceLandmarks.length > 0
        ) {
            setStatus("FACE DETECTED");
        } else {
            setStatus("FACE NOT DETECTED");
        }

    } catch (error) {

        console.error("DETECTION ERROR:", error);

        setStatus(
            "DETECTION ERROR: " +
            (error && error.message
                ? error.message
                : String(error))
        );
    }

    requestAnimationFrame(detectFace);
}

startFaceTracking();
