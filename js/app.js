import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

alert("APP.JS WORKING");

const video = document.getElementById("camera");
const status = document.getElementById("status");

status.textContent = "Loading Face Tracking...";

async function startFaceTracking() {
    try {
        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        const faceLandmarker =
            await FaceLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath:
                            "../models/face_landmarker.task"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1
                }
            );

        status.textContent = "FACE TRACKING READY ✓";

        let lastVideoTime = -1;

        function detectFace() {
            if (
                video.readyState >= 2 &&
                video.currentTime !== lastVideoTime
            ) {
                lastVideoTime = video.currentTime;

                const results =
                    faceLandmarker.detectForVideo(
                        video,
                        performance.now()
                    );

                if (results.faceLandmarks.length > 0) {
                    status.textContent = "FACE DETECTED ✓";
                } else {
                    status.textContent = "FACE NOT DETECTED";
                }
            }

            requestAnimationFrame(detectFace);
        }

        detectFace();

    } catch (error) {
        console.error(error);
        status.textContent = "FACE TRACKING ERROR";
    }
}

startFaceTracking();
