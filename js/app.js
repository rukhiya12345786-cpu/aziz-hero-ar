import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

alert("APP JS RUNNING");

const video = document.getElementById("camera");
const status = document.getElementById("status");

async function startFaceTracking() {
    try {
        status.textContent = "Loading Face Tracking...";

        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        status.textContent = "Loading Face Model...";

        const modelPath = new URL(
            "../models/face_landmarker.task",
            import.meta.url
        ).href;

        const faceLandmarker =
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

        function detectFace() {
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

        detectFace();

    } catch (error) {
        console.error("FACE TRACKING ERROR:", error);
        status.textContent =
            "ERROR: " + error.message;
    }
}

startFaceTracking();
