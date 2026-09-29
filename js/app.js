import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

import {
    FilesetResolver,
    FaceLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";


const $ = (id) => document.getElementById(id);


const el = {

    video: $("video"),

    canvas: $("canvas"),

    openCameraButton:
        $("openCameraButton") ||
        $("openCameraBtn") ||
        $("openCamera"),

    startTrackingButton:
        $("startTrackingButton") ||
        $("startTrackingBtn") ||
        $("startTracking"),

    switchCameraButton:
        $("switchCameraButton") ||
        $("switchCameraBtn") ||
        $("switchCamera"),

    flipCameraButton:
        $("flipCameraButton") ||
        $("flipCameraBtn") ||
        $("flipCamera"),

    recordButton:
        $("recordButton") ||
        $("recordBtn") ||
        $("record"),

    captureButton:
        $("captureButton") ||
        $("captureBtn") ||
        $("capturePhoto"),

    modelFileInput:
        $("modelFileInput") ||
        $("modelInput") ||
        $("fileInput"),

    exportButton:
        $("exportButton") ||
        $("exportBtn") ||
        $("exportModel"),

    resetControlsButton:
        $("resetControlsButton") ||
        $("resetControlsBtn") ||
        $("resetControls"),

    hideControlsButton:
        $("hideControlsButton") ||
        $("hideControlsBtn"),

    showControlsButton:
        $("showControlsButton") ||
        $("showControlsBtn"),

    appControls:
        $("appControls") ||
        $("controls"),

    scaleSlider:
        $("scaleSlider") ||
        $("scale"),

    xSlider:
        $("xSlider") ||
        $("posX"),

    ySlider:
        $("ySlider") ||
        $("posY"),

    zSlider:
        $("zSlider") ||
        $("posZ"),

    rotateXSlider:
        $("rotateXSlider") ||
        $("rotationX"),

    rotateYSlider:
        $("rotateYSlider") ||
        $("rotationY"),

    rotateZSlider:
        $("rotateZSlider") ||
        $("rotationZ"),

    status:
        $("status") ||
        $("statusText")
};


function status(message) {

    if (el.status) {
        el.status.textContent = message;
    }

    console.log("[Azeez AR]", message);
}


function setButtonText(button, text) {

    if (button) {
        button.textContent = text;
    }
}


function degreesToRadians(value) {

    return THREE.MathUtils.degToRad(
        Number(value) || 0
    );
}


let scene = null;

let camera = null;

let renderer = null;

let cameraStream = null;

let facingMode = "user";

let cameraFlipped = false;


let modelRoot = null;

let currentModel = null;

let testCube = null;

let modelURL = null;


let modelBaseScale = 1;

let modelBasePosition =
    new THREE.Vector3();

let modelBaseRotation =
    new THREE.Euler();


let faceLandmarker = null;

let trackingReady = false;

let trackingRunning = false;

let faceDetected = false;

let lastDetectionTime = 0;

let detectionInterval = 33;


let headX = 0.5;

let headY = 0.5;

let headDepth = 1;

let headYaw = 0;

let headPitch = 0;

let headRoll = 0;


let smoothX = 0.5;

let smoothY = 0.5;

let smoothDepth = 1;

let smoothYaw = 0;

let smoothPitch = 0;

let smoothRoll = 0;


let recorder = null;

let recordChunks = [];

let recording = false;


let trackingFrameId = null;


function createRenderer() {

    if (!el.canvas) {
        throw new Error("Canvas element not found.");
    }

    renderer = new THREE.WebGLRenderer({

        canvas: el.canvas,

        alpha: true,

        antialias: true,

        preserveDrawingBuffer: true

    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.setClearColor(
        0x000000,
        0
    );
}


function createScene() {

    scene = new THREE.Scene();


    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth /
            Math.max(window.innerHeight, 1),
        0.01,
        100
    );

    camera.position.set(
        0,
        0,
        5
    );


    modelRoot =
        new THREE.Group();

    modelRoot.name =
        "HeadTrackedModel";

    scene.add(modelRoot);


    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            1.5
        );

    scene.add(ambient);


    const keyLight =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );

    keyLight.position.set(
        2,
        3,
        5
    );

    scene.add(keyLight);


    const fillLight =
        new THREE.DirectionalLight(
            0xffffff,
            1
        );

    fillLight.position.set(
        -3,
        1,
        2
    );

    scene.add(fillLight);
}


function resizeRenderer() {

    if (!renderer || !camera) {
        return;
    }

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    camera.aspect =
        width /
        Math.max(height, 1);

    camera.updateProjectionMatrix();

    renderer.setSize(
        width,
        height,
        false
    );
}


function createTestCube() {

    const geometry =
        new THREE.BoxGeometry(
            0.55,
            0.55,
            0.55
        );

    const material =
        new THREE.MeshStandardMaterial({

            color: 0x1683ff,

            roughness: 0.45,

            metalness: 0.1

        });

    testCube =
        new THREE.Mesh(
            geometry,
            material
        );

    testCube.position.set(
        0,
        0,
        0
    );

    testCube.name =
        "TestCube";

    modelRoot.add(
        testCube
    );
}


function renderScene() {

    if (!renderer || !scene || !camera) {
        return;
    }

    renderer.render(
        scene,
        camera
    );
}


function renderLoop() {

    requestAnimationFrame(
        renderLoop
    );

    renderScene();
}


window.addEventListener(
    "resize",
    resizeRenderer
);


try {

    createRenderer();

    createScene();

    createTestCube();

    resizeRenderer();

    status(
        "Camera and 3D system ready."
    );

    renderLoop();

} catch (error) {

    console.error(error);

    status(
        "3D ERROR: " +
        error.message
    );
}function clearCurrentModel() {

    if (!modelRoot) {
        return;
    }

    while (
        modelRoot.children.length > 0
    ) {

        const child =
            modelRoot.children[
                modelRoot.children.length - 1
            ];

        modelRoot.remove(child);

        child.traverse((object) => {

            if (object.geometry) {
                object.geometry.dispose();
            }

            if (object.material) {

                const materials =
                    Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                materials.forEach((material) => {

                    if (material.map) {
                        material.map.dispose();
                    }

                    if (material.normalMap) {
                        material.normalMap.dispose();
                    }

                    if (material.roughnessMap) {
                        material.roughnessMap.dispose();
                    }

                    if (material.metalnessMap) {
                        material.metalnessMap.dispose();
                    }

                    material.dispose();
                });
            }
        });
    }

    currentModel = null;
    testCube = null;
}


function centerAndFitModel(object) {

    const box =
        new THREE.Box3()
            .setFromObject(object);

    const size =
        box.getSize(
            new THREE.Vector3()
        );

    const center =
        box.getCenter(
            new THREE.Vector3()
        );


    object.position.sub(center);


    const maxSize =
        Math.max(
            size.x,
            size.y,
            size.z
        );


    if (
        Number.isFinite(maxSize) &&
        maxSize > 0
    ) {

        const targetSize = 1.8;

        const fitScale =
            targetSize /
            maxSize;

        object.scale.multiplyScalar(
            fitScale
        );
    }


    object.traverse((child) => {

        if (child.isMesh) {

            child.castShadow = false;

            child.receiveShadow = false;

            if (child.material) {

                const materials =
                    Array.isArray(child.material)
                        ? child.material
                        : [child.material];

                materials.forEach(
                    (material) => {

                        material.side =
                            THREE.DoubleSide;

                        material.needsUpdate =
                            true;
                    }
                );
            }
        }
    });


    modelBaseScale = 1;

    modelBasePosition.set(
        0,
        0,
        0
    );

    modelBaseRotation.set(
        0,
        0,
        0
    );


    object.position.copy(
        modelBasePosition
    );

    object.rotation.copy(
        modelBaseRotation
    );
}


function addLoadedModel(object) {

    clearCurrentModel();

    currentModel = object;

    modelRoot.add(
        currentModel
    );

    centerAndFitModel(
        currentModel
    );


    if (el.scaleSlider) {
        el.scaleSlider.value = "1";
    }

    if (el.xSlider) {
        el.xSlider.value = "0";
    }

    if (el.ySlider) {
        el.ySlider.value = "0";
    }

    if (el.zSlider) {
        el.zSlider.value = "0";
    }

    if (el.rotateXSlider) {
        el.rotateXSlider.value = "0";
    }

    if (el.rotateYSlider) {
        el.rotateYSlider.value = "0";
    }

    if (el.rotateZSlider) {
        el.rotateZSlider.value = "0";
    }


    applyModelControls();


    status(
        "3D model loaded."
    );
}


async function loadModelFile(file) {

    if (!file) {
        return;
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    status(
        "Loading 3D model..."
    );


    try {

        if (modelURL) {

            URL.revokeObjectURL(
                modelURL
            );

            modelURL = null;
        }


        modelURL =
            URL.createObjectURL(
                file
            );


        if (
            extension === "glb" ||
            extension === "gltf"
        ) {

            const loader =
                new GLTFLoader();


            const result =
                await new Promise(
                    (resolve, reject) => {

                        loader.load(

                            modelURL,

                            resolve,

                            undefined,

                            reject

                        );
                    }
                );


            addLoadedModel(
                result.scene
            );


        } else if (
            extension === "obj"
        ) {

            const loader =
                new OBJLoader();


            const object =
                await new Promise(
                    (resolve, reject) => {

                        loader.load(

                            modelURL,

                            resolve,

                            undefined,

                            reject

                        );
                    }
                );


            addLoadedModel(
                object
            );


        } else if (
            extension === "stl"
        ) {

            const loader =
                new STLLoader();


            const geometry =
                await new Promise(
                    (resolve, reject) => {

                        loader.load(

                            modelURL,

                            resolve,

                            undefined,

                            reject

                        );
                    }
                );


            const material =
                new THREE.MeshStandardMaterial({

                    color: 0xffffff,

                    roughness: 0.5,

                    metalness: 0.05,

                    side:
                        THREE.DoubleSide

                });


            const mesh =
                new THREE.Mesh(
                    geometry,
                    material
                );


            addLoadedModel(
                mesh
            );


        } else {

            throw new Error(
                "Unsupported 3D format."
            );
        }

    } catch (error) {

        console.error(
            "MODEL ERROR:",
            error
        );

        status(
            "MODEL ERROR: " +
            error.message
        );
    }
}


function applyCameraOrientation() {

    if (!el.video || !el.canvas) {
        return;
    }


    const transform =
        cameraFlipped
            ? "scaleX(-1)"
            : "scaleX(1)";


    el.video.style.transform =
        transform;

    el.canvas.style.transform =
        transform;
}


async function startCamera() {

    if (!el.video) {

        status(
            "Camera error: video element not found."
        );

        return;
    }


    try {

        if (cameraStream) {
            stopCamera();
        }


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: {
                        ideal: facingMode
                    },

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    },

                    frameRate: {
                        ideal: 30,
                        max: 30
                    }

                },

                audio: true

            });


        el.video.srcObject =
            cameraStream;


        await el.video.play();


        applyCameraOrientation();


        status(
            "Camera started."
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );

        status(
            "Camera error: " +
            error.message
        );
    }
}


function stopCamera() {

    if (!cameraStream) {
        return;
    }


    cameraStream
        .getTracks()
        .forEach(
            (track) => track.stop()
        );


    cameraStream = null;


    if (el.video) {
        el.video.srcObject = null;
    }
}


async function switchCamera() {

    facingMode =
        facingMode === "user"
            ? "environment"
            : "user";


    await startCamera();


    status(
        facingMode === "user"
            ? "Front camera."
            : "Back camera."
    );
}


function toggleCameraFlip() {

    cameraFlipped =
        !cameraFlipped;


    applyCameraOrientation();


    status(
        cameraFlipped
            ? "Camera flipped."
            : "Camera normal."
    );
}function applyModelControls() {

    if (!currentModel) {
        return;
    }


    const scale =
        Number(
            el.scaleSlider
                ? el.scaleSlider.value
                : 1
        );


    const x =
        Number(
            el.xSlider
                ? el.xSlider.value
                : 0
        );


    const y =
        Number(
            el.ySlider
                ? el.ySlider.value
                : 0
        );


    const z =
        Number(
            el.zSlider
                ? el.zSlider.value
                : 0
        );


    const rx =
        Number(
            el.rotateXSlider
                ? el.rotateXSlider.value
                : 0
        );


    const ry =
        Number(
            el.rotateYSlider
                ? el.rotateYSlider.value
                : 0
        );


    const rz =
        Number(
            el.rotateZSlider
                ? el.rotateZSlider.value
                : 0
        );


    modelBaseScale =
        scale;


    modelBasePosition.set(
        x,
        y,
        z
    );


    modelBaseRotation.set(
        degreesToRadians(rx),
        degreesToRadians(ry),
        degreesToRadians(rz)
    );


    currentModel.scale.setScalar(
        scale
    );


    currentModel.position.copy(
        modelBasePosition
    );


    currentModel.rotation.copy(
        modelBaseRotation
    );


    updateSliderLabels();
}


function updateSliderLabels() {

    const pairs = [

        ["scaleSlider", "scaleValue"],

        ["xSlider", "xValue"],

        ["ySlider", "yValue"],

        ["zSlider", "zValue"],

        ["rotateXSlider", "rotateXValue"],

        ["rotateYSlider", "rotateYValue"],

        ["rotateZSlider", "rotateZValue"]

    ];


    pairs.forEach(
        ([sliderId, valueId]) => {

            const slider =
                $(sliderId);

            const value =
                $(valueId);

            if (
                slider &&
                value
            ) {

                value.textContent =
                    slider.value;
            }
        }
    );
}


function resetModelControls() {

    const defaults = {

        scaleSlider: "1",

        xSlider: "0",

        ySlider: "0",

        zSlider: "0",

        rotateXSlider: "0",

        rotateYSlider: "0",

        rotateZSlider: "0"

    };


    Object.entries(defaults)
        .forEach(
            ([id, value]) => {

                const input =
                    $(id);

                if (input) {
                    input.value =
                        value;
                }
            }
        );


    applyModelControls();
}


function toggleControlsVisibility(
    visible
) {

    if (
        !el.appControls ||
        !el.showControlsButton
    ) {
        return;
    }


    el.appControls.style.display =
        visible
            ? "block"
            : "none";


    el.showControlsButton.style.display =
        visible
            ? "none"
            : "block";
}


async function createFaceTracker() {

    if (faceLandmarker) {
        return true;
    }


    status(
        "Loading face tracking..."
    );


    try {

        const vision =
            await FilesetResolver
                .forVisionTasks(

                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"

                );


        faceLandmarker =
            await FaceLandmarker
                .createFromOptions(

                    vision,

                    {

                        baseOptions: {

                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                            delegate:
                                "GPU"

                        },

                        runningMode:
                            "VIDEO",

                        numFaces:
                            1,

                        minFaceDetectionConfidence:
                            0.45,

                        minFacePresenceConfidence:
                            0.45,

                        minTrackingConfidence:
                            0.45

                    }

                );


        trackingReady = true;


        status(
            "Face tracking ready."
        );


        return true;

    } catch (error) {

        console.error(
            "FACE TRACKER ERROR:",
            error
        );


        trackingReady = false;


        status(
            "FACE TRACKING ERROR: " +
            error.message
        );


        return false;
    }
}


function landmarkPoint(
    landmarks,
    index
) {

    if (
        !landmarks ||
        !landmarks[index]
    ) {

        return null;
    }


    return landmarks[index];
}


function calculateHeadValues(
    landmarks
) {

    const nose =
        landmarkPoint(
            landmarks,
            1
        );


    const leftEye =
        landmarkPoint(
            landmarks,
            33
        );


    const rightEye =
        landmarkPoint(
            landmarks,
            263
        );


    const forehead =
        landmarkPoint(
            landmarks,
            10
        );


    const chin =
        landmarkPoint(
            landmarks,
            152
        );


    if (
        !nose ||
        !leftEye ||
        !rightEye
    ) {

        return null;
    }


    const eyeCenterX =
        (
            leftEye.x +
            rightEye.x
        ) * 0.5;


    const eyeCenterY =
        (
            leftEye.y +
            rightEye.y
        ) * 0.5;


    const eyeDistance =
        Math.hypot(

            rightEye.x -
            leftEye.x,

            rightEye.y -
            leftEye.y

        );


    if (
        eyeDistance <
        0.0001
    ) {

        return null;
    }


    const centerX =
        (
            eyeCenterX * 0.55 +
            nose.x * 0.45
        );


    const centerY =
        (
            eyeCenterY * 0.35 +
            nose.y * 0.65
        );


    const roll =
        Math.atan2(

            rightEye.y -
            leftEye.y,

            rightEye.x -
            leftEye.x

        );


    const eyeMidDepth =
        (
            leftEye.z +
            rightEye.z
        ) * 0.5;


    const yawRaw =
        (
            nose.x -
            eyeCenterX
        ) / eyeDistance;


    const yaw =
        THREE.MathUtils.clamp(
            yawRaw * 1.15,
            -1.25,
            1.25
        );


    let pitch = 0;


    if (
        forehead &&
        chin
    ) {

        const faceHeight =
            Math.max(
                Math.abs(
                    chin.y -
                    forehead.y
                ),
                0.001
            );


        const noseVertical =
            (
                nose.y -
                forehead.y
            ) /
            faceHeight;


        pitch =
            THREE.MathUtils.clamp(

                (
                    noseVertical -
                    0.42
                ) * 2.1,

                -0.9,
                0.9
            );
    }


    const depth =
        THREE.MathUtils.clamp(

            0.95 /
            eyeDistance,

            2.0,
            7.0

        );


    return {

        x: centerX,

        y: centerY,

        depth,

        yaw,

        pitch,

        roll,

        eyeDistance,

        eyeMidDepth

    };
}function smoothTracking(
    target
) {

    if (!target) {
        return;
    }


    const positionSmooth = 0.42;

    const rotationSmooth = 0.5;

    const depthSmooth = 0.32;


    smoothX +=
        (
            target.x -
            smoothX
        ) *
        positionSmooth;


    smoothY +=
        (
            target.y -
            smoothY
        ) *
        positionSmooth;


    smoothDepth +=
        (
            target.depth -
            smoothDepth
        ) *
        depthSmooth;


    smoothYaw +=
        (
            target.yaw -
            smoothYaw
        ) *
        rotationSmooth;


    smoothPitch +=
        (
            target.pitch -
            smoothPitch
        ) *
        rotationSmooth;


    smoothRoll +=
        (
            target.roll -
            smoothRoll
        ) *
        rotationSmooth;
}


function applyHeadTracking() {

    if (
        !currentModel ||
        !faceDetected
    ) {

        return;
    }


    const aspect =
        camera.aspect;


    const verticalFov =
        THREE.MathUtils.degToRad(
            camera.fov
        );


    const halfHeight =
        Math.tan(
            verticalFov * 0.5
        );


    const halfWidth =
        halfHeight *
        aspect;


    /*
     * Convert normalized face
     * coordinates into real 3D
     * camera coordinates.
     */

    const normalizedX =
        smoothX - 0.5;


    const normalizedY =
        smoothY - 0.5;


    /*
     * The depth value is deliberately
     * damped so the helmet does not
     * jump toward and away from camera.
     */

    const trackingDepth =
        THREE.MathUtils.clamp(

            smoothDepth,

            2.0,

            7.0

        );


    const worldX =
        normalizedX *
        halfWidth *
        trackingDepth *
        2;


    const worldY =
        -normalizedY *
        halfHeight *
        trackingDepth *
        2;


    /*
     * The model is placed in front of
     * the camera using actual 3D depth,
     * not just CSS/screen coordinates.
     */

    const worldZ =
        camera.position.z -
        trackingDepth;


    const targetPosition =
        new THREE.Vector3(
            worldX,
            worldY,
            worldZ
        );


    /*
     * User manual offsets are added
     * after the head position.
     */

    targetPosition.x +=
        modelBasePosition.x;

    targetPosition.y +=
        modelBasePosition.y;

    targetPosition.z +=
        modelBasePosition.z;


    /*
     * Apply movement with a small amount
     * of smoothing. This is much faster
     * than the previous heavy smoothing.
     */

    currentModel.position.lerp(
        targetPosition,
        0.55
    );


    /*
     * Preserve user's manual rotation
     * while adding head orientation.
     */

    const targetRotationX =
        modelBaseRotation.x +
        smoothPitch;


    const targetRotationY =
        modelBaseRotation.y +
        smoothYaw;


    const targetRotationZ =
        modelBaseRotation.z -
        smoothRoll;


    currentModel.rotation.x +=
        (
            targetRotationX -
            currentModel.rotation.x
        ) *
        0.55;


    currentModel.rotation.y +=
        (
            targetRotationY -
            currentModel.rotation.y
        ) *
        0.55;


    currentModel.rotation.z +=
        (
            targetRotationZ -
            currentModel.rotation.z
        ) *
        0.55;


    /*
     * Keep the manually selected model
     * size while tracking.
     */

    currentModel.scale.setScalar(
        modelBaseScale
    );
}


function updateFaceTracking(
    now
) {

    if (
        !trackingReady ||
        !faceLandmarker ||
        !el.video
    ) {

        return;
    }


    if (
        el.video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

        return;
    }


    /*
     * Do not run the expensive ML model
     * on every render frame.
     *
     * Detection runs around 30 FPS,
     * while Three.js still renders smoothly.
     */

    if (
        now -
        lastDetectionTime <
        detectionInterval
    ) {

        return;
    }


    lastDetectionTime =
        now;


    try {

        const result =
            faceLandmarker
                .detectForVideo(

                    el.video,

                    now

                );


        if (
            !result ||
            !result.faceLandmarks ||
            result.faceLandmarks.length === 0
        ) {

            faceDetected = false;

            return;
        }


        const landmarks =
            result.faceLandmarks[0];


        const values =
            calculateHeadValues(
                landmarks
            );


        if (!values) {

            faceDetected = false;

            return;
        }


        faceDetected = true;


        headX =
            values.x;

        headY =
            values.y;

        headDepth =
            values.depth;

        headYaw =
            values.yaw;

        headPitch =
            values.pitch;

        headRoll =
            values.roll;


        smoothTracking(
            values
        );


        applyHeadTracking();


    } catch (error) {

        console.error(
            "TRACKING FRAME ERROR:",
            error
        );
    }
}


async function startTracking() {

    if (
        !el.video ||
        !el.video.srcObject
    ) {

        status(
            "Open camera first."
        );

        return;
    }


    if (
        !(await createFaceTracker())
    ) {

        return;
    }


    trackingRunning =
        true;


    lastDetectionTime =
        0;


    if (testCube) {

        testCube.visible =
            false;
    }


    setButtonText(
        el.startTrackingButton,
        "TRACKING ON"
    );


    status(
        "Tracking active."
    );


    if (!trackingFrameId) {
        trackingFrameId =
            requestAnimationFrame(
                trackingLoop
            );
    }
}


function stopTracking() {

    trackingRunning =
        false;


    if (trackingFrameId) {

        cancelAnimationFrame(
            trackingFrameId
        );

        trackingFrameId =
            null;
    }


    if (testCube) {

        testCube.visible =
            true;
    }


    faceDetected =
        false;


    setButtonText(
        el.startTrackingButton,
        "START TRACKING"
    );


    status(
        "Tracking stopped."
    );
}


function trackingLoop(now) {

    trackingFrameId =
        requestAnimationFrame(
            trackingLoop
        );


    if (!trackingRunning) {
        return;
    }


    updateFaceTracking(
        now
    );


    renderScene();
}


function bindSlider(
    slider,
    callback
) {

    if (!slider) {
        return;
    }


    slider.addEventListener(
        "input",
        callback
    );
}


function updateCameraButtonState() {

    if (!el.openCameraButton) {
        return;
    }


    setButtonText(
        el.openCameraButton,
        cameraStream
            ? "CAMERA ON"
            : "OPEN CAMERA"
    );
}


async function capturePhoto() {

    if (
        !el.video ||
        !el.canvas
    ) {

        return;
    }


    const output =
        document.createElement(
            "canvas"
        );


    output.width =
        el.video.videoWidth ||
        window.innerWidth;


    output.height =
        el.video.videoHeight ||
        window.innerHeight;


    const context =
        output.getContext(
            "2d"
        );


    if (!context) {
        return;
    }


    context.drawImage(

        el.video,

        0,
        0,

        output.width,
        output.height

    );


    /*
     * Render the current 3D scene
     * on top of the camera image.
     */

    renderScene();


    context.drawImage(

        el.canvas,

        0,
        0,

        output.width,
        output.height

    );


    output.toBlob(
        (blob) => {

            if (!blob) {
                return;
            }


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;

            link.download =
                "azeez-ar-photo.png";


            link.click();


            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                },
                1000
            );

        },
        "image/png"
    );


    status(
        "Photo captured."
    );
      }function startRecording() {

    if (
        !el.canvas ||
        !el.video
    ) {

        return;
    }


    if (
        typeof MediaRecorder ===
        "undefined"
    ) {

        status(
            "Recording is not supported."
        );

        return;
    }


    try {

        renderScene();


        const canvasStream =
            el.canvas.captureStream(
                30
            );


        const tracks = [];


        canvasStream
            .getVideoTracks()
            .forEach(
                (track) =>
                    tracks.push(track)
            );


        if (cameraStream) {

            const audioTracks =
                cameraStream
                    .getAudioTracks();


            audioTracks.forEach(
                (track) =>
                    tracks.push(track)
            );
        }


        const combinedStream =
            new MediaStream(
                tracks
            );


        let mimeType =
            "video/webm;codecs=vp9";


        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "video/webm;codecs=vp8";
        }


        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "video/webm";
        }


        recorder =
            new MediaRecorder(

                combinedStream,

                {
                    mimeType,
                    videoBitsPerSecond:
                        6000000
                }

            );


        recordChunks = [];


        recorder.ondataavailable =
            (event) => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    recordChunks.push(
                        event.data
                    );
                }
            };


        recorder.onstop =
            () => {

                const blob =
                    new Blob(
                        recordChunks,
                        {
                            type:
                                recorder.mimeType
                        }
                    );


                const url =
                    URL.createObjectURL(
                        blob
                    );


                const link =
                    document.createElement(
                        "a"
                    );


                link.href =
                    url;

                link.download =
                    "azeez-ar-recording.webm";


                link.click();


                setTimeout(
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                    },
                    1500
                );


                status(
                    "Recording saved."
                );
            };


        recorder.start(
            100
        );


        recording = true;


        setButtonText(
            el.recordButton,
            "STOP RECORDING"
        );


        status(
            "Recording..."
        );


    } catch (error) {

        console.error(
            "RECORD ERROR:",
            error
        );

        status(
            "RECORD ERROR: " +
            error.message
        );
    }
}


function stopRecording() {

    if (
        !recorder ||
        recorder.state ===
        "inactive"
    ) {

        recording = false;

        return;
    }


    recorder.stop();


    recording = false;


    setButtonText(
        el.recordButton,
        "RECORD"
    );
}


function toggleRecording() {

    if (recording) {

        stopRecording();

    } else {

        startRecording();

    }
}


function exportGLB() {

    if (!currentModel) {

        status(
            "Load a 3D model first."
        );

        return;
    }


    try {

        const exporter =
            new GLTFExporter();


        exporter.parse(

            currentModel,

            (result) => {

                let blob;


                if (
                    result instanceof ArrayBuffer
                ) {

                    blob =
                        new Blob(
                            [result],
                            {
                                type:
                                    "model/gltf-binary"
                            }
                        );

                } else {

                    blob =
                        new Blob(
                            [
                                JSON.stringify(
                                    result
                                )
                            ],
                            {
                                type:
                                    "application/json"
                            }
                        );
                }


                const url =
                    URL.createObjectURL(
                        blob
                    );


                const link =
                    document.createElement(
                        "a"
                    );


                link.href =
                    url;

                link.download =
                    "azeez-ar-model.glb";


                link.click();


                setTimeout(
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                    },
                    1500
                );


                status(
                    "3D export complete."
                );

            },

            (error) => {

                console.error(
                    "EXPORT ERROR:",
                    error
                );

                status(
                    "EXPORT ERROR."
                );

            },

            {
                binary: true
            }

        );

    } catch (error) {

        console.error(
            "EXPORT ERROR:",
            error
        );

        status(
            "EXPORT ERROR: " +
            error.message
        );
    }
}


if (el.modelFileInput) {

    el.modelFileInput.addEventListener(
        "change",
        async (event) => {

            const file =
                event.target.files &&
                event.target.files[0];


            if (file) {

                await loadModelFile(
                    file
                );
            }


            event.target.value =
                "";
        }
    );
}


if (el.openCameraButton) {

    el.openCameraButton.addEventListener(
        "click",
        async () => {

            await startCamera();

            updateCameraButtonState();
        }
    );
}


if (el.startTrackingButton) {

    el.startTrackingButton.addEventListener(
        "click",
        async () => {

            if (trackingRunning) {

                stopTracking();

            } else {

                await startTracking();

            }
        }
    );
}


if (el.switchCameraButton) {

    el.switchCameraButton.addEventListener(
        "click",
        async () => {

            await switchCamera();

            updateCameraButtonState();
        }
    );
}


if (el.flipCameraButton) {

    el.flipCameraButton.addEventListener(
        "click",
        () => {

            toggleCameraFlip();

        }
    );
}


if (el.recordButton) {

    el.recordButton.addEventListener(
        "click",
        () => {

            toggleRecording();

        }
    );
}


if (el.captureButton) {

    el.captureButton.addEventListener(
        "click",
        () => {

            capturePhoto();

        }
    );
}


if (el.exportButton) {

    el.exportButton.addEventListener(
        "click",
        () => {

            exportGLB();

        }
    );
}


if (el.resetControlsButton) {

    el.resetControlsButton.addEventListener(
        "click",
        () => {

            resetModelControls();

        }
    );
}


if (el.hideControlsButton) {

    el.hideControlsButton.addEventListener(
        "click",
        () => {

            toggleControlsVisibility(
                false
            );

        }
    );
}


if (el.showControlsButton) {

    el.showControlsButton.addEventListener(
        "click",
        () => {

            toggleControlsVisibility(
                true
            );

        }
    );
}


bindSlider(
    el.scaleSlider,
    applyModelControls
);

bindSlider(
    el.xSlider,
    applyModelControls
);

bindSlider(
    el.ySlider,
    applyModelControls
);

bindSlider(
    el.zSlider,
    applyModelControls
);

bindSlider(
    el.rotateXSlider,
    applyModelControls
);

bindSlider(
    el.rotateYSlider,
    applyModelControls
);

bindSlider(
    el.rotateZSlider,
    applyModelControls
);


if (el.video) {

    el.video.setAttribute(
        "playsinline",
        ""
    );

    el.video.setAttribute(
        "autoplay",
        ""
    );

    el.video.muted =
        true;
}


toggleControlsVisibility(
    true
);


updateSliderLabels();

applyCameraOrientation();

updateCameraButtonState();


window.addEventListener(
    "beforeunload",
    () => {

        stopTracking();

        stopCamera();


        if (modelURL) {

            URL.revokeObjectURL(
                modelURL
            );

            modelURL = null;
        }
    }
);


status(
    "Ready. Press OPEN CAMERA."
);


console.log(
    "Azeez AR Head Tracker loaded."
);
