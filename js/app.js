import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

console.log("MediaPipe Face Landmarker loaded");

const video = document.getElementById("camera");
const status = document.getElementById("status");

console.log("Video:", video ? "FOUND" : "NOT FOUND");
console.log("Status:", status ? "FOUND" : "NOT FOUND");
