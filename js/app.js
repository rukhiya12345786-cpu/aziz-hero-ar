import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

console.log("AZIZ AR - Face Tracking Starting");

const video = document.getElementById("camera");
const status = document.getElementById("status");

console.log("Video:", video ? "FOUND" : "NOT FOUND");
console.log("Status:", status ? "FOUND" : "NOT FOUND");

async function startFaceTracking() {

    try {

        status.textContent = "Loading Face Tracking...";

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

        console.log("FACE LANDMARKER READY ✓");

        status.textContent = "Face Tracking Ready ✓";

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

                    status.textContent =
                        "FACE DETECTED ✓";

                    console.log("FACE DETECTED");

                } else {

                    status.textContent =
                        "FACE NOT DETECTED";
                }
            }

            requestAnimationFrame(detectFace);
        }

        if (video.readyState >= 2) {

            detectFace();

        } else {

            video.addEventListener(
                "loadeddata",
                detectFace,
                { once: true }
            );
        }

    } catch (error) {

        console.error(
            "Face Tracking Error:",
            error
        );

        status.textContent =
            "Face Tracking Error";
    }
}

startFaceTracking();
