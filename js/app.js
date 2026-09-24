alert("APP JS IS LOADING");
const video = document.getElementById("camera");
const status = document.getElementById("status");

status.textContent = "Loading Face Tracking...";

async function startFaceTracking() {
    try {
        const filesetResolver =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        status.textContent = "Loading Face Model...";

        const faceLandmarker =
            await FaceLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath:
                            new URL(
                                "../models/face_landmarker.task",
                                import.meta.url
                            ).href
                    },
                    runningMode: "VIDEO",
                    numFaces: 1
                }
            );

        status.textContent = "FACE TRACKING READY ✓";

        function detectFace() {
            if (video.readyState >= 2) {
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
        status.textContent = "ERROR: " + error.message;
    }
}

startFaceTracking();
