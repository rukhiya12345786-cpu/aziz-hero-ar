import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

console.log("MediaPipe Face Landmarker loaded");

const video = document.getElementById("camera");
const status = document.getElementById("status");

console.log("Video:", video ? "FOUND" : "NOT FOUND");
console.log("Status:", status ? "FOUND" : "NOT FOUND");
const filesetResolver =
    await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

const faceLandmarker =
    await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
            baseOptions: {
                modelAssetPath: "../models/face_landmarker.task"
            },
            runningMode: "VIDEO",
            numFaces: 1
        }
    );

console.log("FACE LANDMARKER READY ✓");
status.textContent = "Face Tracking Ready ✓";
