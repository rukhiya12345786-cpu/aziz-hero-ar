import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

import {
    FilesetResolver,
    FaceLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";


const $ = (id) =>
    document.getElementById(id);


const el = {

    video:
        $("video"),

    canvas:
        $("canvas"),

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
        el.status.textContent =
            message;
    }

    console.log(
        "[Azeez AR]",
        message
    );
}


function degreesToRadians(value) {

    return THREE.MathUtils.degToRad(
        Number(value) || 0
    );
}


/* =========================
   THREE.JS
========================= */

let scene = null;
let camera = null;
let renderer = null;

let modelRoot = null;
let currentModel = null;

let testCube = null;


/* =========================
   CAMERA
========================= */

let cameraStream = null;

let facingMode =
    "user";

let cameraFlipped =
    false;


/* =========================
   FACE TRACKING
========================= */

let faceLandmarker = null;

let trackingReady =
    false;

let trackingRunning =
    false;

let faceDetected =
    false;

let lastVideoTime =
    -1;

let trackingFrameId =
    null;


/* =========================
   HEAD VALUES
========================= */

let headX =
    0.5;

let headY =
    0.5;

let headDepth =
    1;

let headYaw =
    0;

let headPitch =
    0;

let headRoll =
    0;


let smoothX =
    0.5;

let smoothY =
    0.5;

let smoothDepth =
    1;

let smoothYaw =
    0;

let smoothPitch =
    0;

let smoothRoll =
    0;


let headFaceWidth =
    0.28;

let headFaceHeight =
    0.38;


/* =========================
   GREEN FACE OVERLAY
========================= */

let landmarkCanvas =
    null;

let landmarkContext =
    null;

let landmarkVisible =
    true;

let lastLandmarks =
    null;


/* =========================
   HEAD OCCLUDER
========================= */

let faceOccluder =
    null;

let faceOccluderMaterial =
    null;


/* =========================
   RECORDING
========================= */

let recorder =
    null;

let recordChunks =
    [];

let recording =
    false;


/* =========================
   MODEL
========================= */

let modelURL =
    null;


/* =========================
   FACE LANDMARK INDICES
========================= */

const GREEN_POINTS = [

    10,
    338,
    297,
    332,
    284,
    251,
    389,
    356,
    454,
    323,
    361,
    288,
    397,
    365,
    379,
    378,
    400,
    377,
    152,
    148,
    176,
    149,
    150,
    136,
    172,
    58,
    132,
    93,
    234,
    127,
    162,
    21,
    54,
    103,
    67,
    109,

    33,
    133,
    362,
    263,

    1,
    4,

    61,
    291,

    70,
    300,

    107,
    336,

    159,
    386,

    145,
    374
];


/* =========================
   CREATE THREE.JS
========================= */

function createRenderer() {

    if (!el.canvas) {

        throw new Error(
            "Canvas element not found."
        );
    }


    renderer =
        new THREE.WebGLRenderer({

            canvas:
                el.canvas,

            alpha:
                true,

            antialias:
                true,

            preserveDrawingBuffer:
                true

        });


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
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


    renderer.autoClear =
        true;
}


/* =========================
   CREATE SCENE
========================= */

function createScene() {

    scene =
        new THREE.Scene();


    camera =
        new THREE.PerspectiveCamera(

            45,

            window.innerWidth /
                Math.max(
                    window.innerHeight,
                    1
                ),

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


    scene.add(
        modelRoot
    );


    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            1.5
        );


    scene.add(
        ambient
    );


    const light =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );


    light.position.set(
        2,
        3,
        5
    );


    scene.add(
        light
    );
}


/* =========================
   TEST CUBE
========================= */

function createTestCube() {

    const geometry =
        new THREE.BoxGeometry(
            0.45,
            0.45,
            0.45
        );


    const material =
        new THREE.MeshStandardMaterial({

            color:
                0x1683ff,

            roughness:
                0.45,

            metalness:
                0.1

        });


    testCube =
        new THREE.Mesh(
            geometry,
            material
        );


    testCube.name =
        "TestCube";


    testCube.visible =
        true;


    modelRoot.add(
        testCube
    );
}


/* =========================
   GREEN LANDMARK CANVAS
========================= */

function createLandmarkCanvas() {

    landmarkCanvas =
        document.createElement(
            "canvas"
        );


    landmarkCanvas.id =
        "faceLandmarkCanvas";


    landmarkCanvas.style.position =
        "fixed";


    landmarkCanvas.style.left =
        "0";


    landmarkCanvas.style.top =
        "0";


    landmarkCanvas.style.width =
        "100%";


    landmarkCanvas.style.height =
        "100%";


    landmarkCanvas.style.pointerEvents =
        "none";


    landmarkCanvas.style.zIndex =
        "20";


    document.body.appendChild(
        landmarkCanvas
    );


    landmarkContext =
        landmarkCanvas.getContext(
            "2d"
        );


    resizeLandmarkCanvas();
}


function resizeLandmarkCanvas() {

    if (!landmarkCanvas) {
        return;
    }


    const ratio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    landmarkCanvas.width =
        Math.floor(
            window.innerWidth *
            ratio
        );


    landmarkCanvas.height =
        Math.floor(
            window.innerHeight *
            ratio
        );


    landmarkContext.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );
}


/* =========================
   DRAW GREEN DOTS
========================= */

function drawFaceLandmarks(
    landmarks
) {

    if (
        !landmarkContext ||
        !landmarkCanvas
    ) {
        return;
    }


    landmarkContext.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );


    if (
        !landmarkVisible ||
        !landmarks
    ) {
        return;
    }


    const width =
        window.innerWidth;

    const height =
        window.innerHeight;


    /*
     * Green dots.
     */

    landmarkContext.fillStyle =
        "#00ff00";


    for (
        let i = 0;
        i < landmarks.length;
        i++
    ) {

        const point =
            landmarks[i];


        if (!point) {
            continue;
        }


        const x =
            point.x *
            width;


        const y =
            point.y *
            height;


        landmarkContext.beginPath();


        landmarkContext.arc(
            x,
            y,
            1.8,
            0,
            Math.PI * 2
        );


        landmarkContext.fill();
    }


    /*
     * Larger green points on important
     * face/head landmarks.
     */

    landmarkContext.fillStyle =
        "#00ff44";


    for (
        const index of GREEN_POINTS
    ) {

        const point =
            landmarks[index];


        if (!point) {
            continue;
        }


        const x =
            point.x *
            width;


        const y =
            point.y *
            height;


        landmarkContext.beginPath();


        landmarkContext.arc(
            x,
            y,
            3,
            0,
            Math.PI * 2
        );


        landmarkContext.fill();
    }
}


/* =========================
   INVISIBLE HEAD OCCLUDER
========================= */

function createFaceOccluder() {

    const geometry =
        new THREE.SphereGeometry(
            1,
            32,
            20
        );


    faceOccluderMaterial =
        new THREE.MeshBasicMaterial({

            color:
                0x000000,

            colorWrite:
                false,

            depthWrite:
                true,

            depthTest:
                true,

            transparent:
                true,

            opacity:
                0,

            side:
                THREE.DoubleSide

        });


    faceOccluder =
        new THREE.Mesh(
            geometry,
            faceOccluderMaterial
        );


    faceOccluder.name =
        "InvisibleHeadOccluder";


    faceOccluder.renderOrder =
        0;


    faceOccluder.frustumCulled =
        false;


    faceOccluder.visible =
        false;


    scene.add(
        faceOccluder
    );
}


/* =========================
   RESIZE
========================= */

function resizeRenderer() {

    if (
        !renderer ||
        !camera
    ) {
        return;
    }


    const width =
        window.innerWidth;


    const height =
        window.innerHeight;


    camera.aspect =
        width /
        Math.max(
            height,
            1
        );


    camera.updateProjectionMatrix();


    renderer.setSize(
        width,
        height,
        false
    );


    resizeLandmarkCanvas();
}


/* =========================
   RENDER LOOP
========================= */

function renderLoop() {

    requestAnimationFrame(
        renderLoop
    );


    if (
        renderer &&
        scene &&
        camera
    ) {

        renderer.render(
            scene,
            camera
        );
    }
}


/* =========================
   INITIAL START
========================= */

window.addEventListener(
    "resize",
    resizeRenderer
);


try {

    createRenderer();

    createScene();

    createTestCube();

    createLandmarkCanvas();

    createFaceOccluder();

    resizeRenderer();

    status(
        "Camera and 3D system ready."
    );

    renderLoop();

} catch (error) {

    console.error(
        error
    );


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


        modelRoot.remove(
            child
        );


        child.traverse(
            (object) => {

                if (object.geometry) {

                    object.geometry.dispose();
                }


                if (object.material) {

                    const materials =
                        Array.isArray(
                            object.material
                        )
                            ? object.material
                            : [object.material];


                    materials.forEach(
                        (material) => {

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
                        }
                    );
                }
            }
        );
    }


    currentModel =
        null;


    testCube =
        null;
}


/* =========================
   MODEL CENTER AND FIT
========================= */

function centerAndFitModel(
    object
) {

    const box =
        new THREE.Box3()
            .setFromObject(
                object
            );


    const size =
        box.getSize(
            new THREE.Vector3()
        );


    const center =
        box.getCenter(
            new THREE.Vector3()
        );


    object.position.sub(
        center
    );


    const maxSize =
        Math.max(
            size.x,
            size.y,
            size.z
        );


    if (
        Number.isFinite(
            maxSize
        ) &&
        maxSize > 0
    ) {

        const targetSize =
            1.8;


        const fitScale =
            targetSize /
            maxSize;


        object.scale.multiplyScalar(
            fitScale
        );
    }


    object.traverse(
        (child) => {

            if (
                child.isMesh
            ) {

                child.frustumCulled =
                    false;


                child.castShadow =
                    false;


                child.receiveShadow =
                    false;


                if (
                    child.material
                ) {

                    const materials =
                        Array.isArray(
                            child.material
                        )
                            ? child.material
                            : [child.material];


                    materials.forEach(
                        (material) => {

                            material.side =
                                THREE.DoubleSide;

                            material.depthTest =
                                true;

                            material.depthWrite =
                                true;

                            material.needsUpdate =
                                true;
                        }
                    );
                }
            }
        }
    );


    object.position.set(
        0,
        0,
        0
    );


    object.rotation.set(
        0,
        0,
        0
    );
}


/* =========================
   ADD LOADED MODEL
========================= */

function addLoadedModel(
    object
) {

    clearCurrentModel();


    currentModel =
        object;


    modelRoot.add(
        currentModel
    );


    centerAndFitModel(
        currentModel
    );


    /*
     * Hide test cube.
     */

    if (testCube) {

        testCube.visible =
            false;
    }


    /*
     * Reset sliders.
     */

    const defaults = {

        scaleSlider:
            "1",

        xSlider:
            "0",

        ySlider:
            "0",

        zSlider:
            "0",

        rotateXSlider:
            "0",

        rotateYSlider:
            "0",

        rotateZSlider:
            "0"

    };


    Object.entries(
        defaults
    ).forEach(
        ([id, value]) => {

            const input =
                $(id);


            if (input) {

                input.value =
                    value;
            }
        }
    );


    currentModel.visible =
        true;


    applyModelControls();


    status(
        "3D model loaded."
    );
}


/* =========================
   LOAD GLB / GLTF / OBJ / STL
========================= */

async function loadModelFile(
    file
) {

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

            modelURL =
                null;
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

                    color:
                        0xffffff,

                    roughness:
                        0.5,

                    metalness:
                        0.05,

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
                "Unsupported 3D format. Use GLB, GLTF, OBJ or STL."
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


/* =========================
   CAMERA ORIENTATION
========================= */

function applyCameraOrientation() {

    if (
        !el.video ||
        !el.canvas
    ) {
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


    /*
     * Keep green tracking points
     * aligned with the camera.
     */

    if (landmarkCanvas) {

        landmarkCanvas.style.transform =
            transform;
    }
}


/* =========================
   STOP CAMERA
========================= */

function stopCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                (track) => {

                    track.stop();
                }
            );


        cameraStream =
            null;
    }


    if (el.video) {

        el.video.srcObject =
            null;
    }
}


/* =========================
   START CAMERA
========================= */

async function startCamera() {

    if (!el.video) {

        status(
            "Camera error: video element not found."
        );

        return;
    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        status(
            "Camera API is not available."
        );

        return;
    }


    try {

        stopCamera();


        cameraStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            ideal:
                                facingMode
                        },

                        width: {
                            ideal:
                                1280
                        },

                        height: {
                            ideal:
                                720
                        },

                        frameRate: {
                            ideal:
                                30,

                            max:
                                30
                        }

                    },

                    audio:
                        true

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
            "CAMERA ERROR: " +
            error.message
        );
    }
}


/* =========================
   SWITCH CAMERA
========================= */

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


/* =========================
   FLIP CAMERA
========================= */

function toggleCameraFlip() {

    cameraFlipped =
        !cameraFlipped;


    applyCameraOrientation();


    status(
        cameraFlipped
            ? "Camera flipped."
            : "Camera normal."
    );
}


/* =========================
   MODEL CONTROLS
========================= */

function applyModelControls() {

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


    /*
     * Store manual values.
     */

    currentModel.userData.manualScale =
        scale;


    currentModel.userData.manualX =
        x;


    currentModel.userData.manualY =
        y;


    currentModel.userData.manualZ =
        z;


    currentModel.userData.manualRX =
        degreesToRadians(rx);


    currentModel.userData.manualRY =
        degreesToRadians(ry);


    currentModel.userData.manualRZ =
        degreesToRadians(rz);


    /*
     * If tracking is not running,
     * still make the model visible
     * and place it at the manual position.
     */

    if (!trackingRunning) {

        currentModel.position.set(
            x,
            -y,
            z
        );


        currentModel.rotation.set(
            degreesToRadians(rx),
            degreesToRadians(ry),
            degreesToRadians(rz)
        );
    }


    currentModel.scale.setScalar(
        scale
    );


    updateSliderLabels();
}


/* =========================
   SLIDER LABELS
========================= */

function updateSliderLabels() {

    const pairs = [

        [
            "scaleSlider",
            "scaleValue"
        ],

        [
            "xSlider",
            "xValue"
        ],

        [
            "ySlider",
            "yValue"
        ],

        [
            "zSlider",
            "zValue"
        ],

        [
            "rotateXSlider",
            "rotateXValue"
        ],

        [
            "rotateYSlider",
            "rotateYValue"
        ],

        [
            "rotateZSlider",
            "rotateZValue"
        ]

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


/* =========================
   RESET CONTROLS
========================= */

function resetModelControls() {

    const defaults = {

        scaleSlider:
            "1",

        xSlider:
            "0",

        ySlider:
            "0",

        zSlider:
            "0",

        rotateXSlider:
            "0",

        rotateYSlider:
            "0",

        rotateZSlider:
            "0"

    };


    Object.entries(
        defaults
    ).forEach(
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
        }function createFaceTracker() {

    if (trackingReady) {
        return true;
    }


    status(
        "Loading face tracking..."
    );


    return FilesetResolver
        .forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        )
        .then(
            (vision) => {

                return FaceLandmarker
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
                                0.5,

                            minFacePresenceConfidence:
                                0.5,

                            minTrackingConfidence:
                                0.5,

                            outputFaceBlendshapes:
                                false,

                            outputFacialTransformationMatrixes:
                                true

                        }
                    );
            }
        )
        .then(
            (tracker) => {

                faceLandmarker =
                    tracker;


                trackingReady =
                    true;


                status(
                    "Face tracking ready."
                );


                return true;
            }
        )
        .catch(
            (error) => {

                console.error(
                    "FACE TRACKER ERROR:",
                    error
                );


                trackingReady =
                    false;


                status(
                    "FACE MODEL ERROR: " +
                    error.message
                );


                return false;
            }
        );
}


/* =========================
   LANDMARK HELPERS
========================= */

function getLandmark(
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

    const left =
        getLandmark(
            landmarks,
            234
        );


    const right =
        getLandmark(
            landmarks,
            454
        );


    const top =
        getLandmark(
            landmarks,
            10
        );


    const bottom =
        getLandmark(
            landmarks,
            152
        );


    const nose =
        getLandmark(
            landmarks,
            1
        );


    const leftEye =
        getLandmark(
            landmarks,
            33
        );


    const rightEye =
        getLandmark(
            landmarks,
            263
        );


    if (
        !left ||
        !right ||
        !top ||
        !bottom ||
        !nose ||
        !leftEye ||
        !rightEye
    ) {

        return false;
    }


    /*
     * Face center.
     */

    const centerX =
        (
            left.x +
            right.x
        ) * 0.5;


    const centerY =
        (
            top.y +
            bottom.y
        ) * 0.5;


    /*
     * Face size.
     */

    const faceWidth =
        Math.max(
            Math.abs(
                right.x -
                left.x
            ),
            0.01
        );


    const faceHeight =
        Math.max(
            Math.abs(
                bottom.y -
                top.y
            ),
            0.01
        );


    headX =
        centerX;


    headY =
        centerY;


    headFaceWidth =
        faceWidth;


    headFaceHeight =
        faceHeight;


    /*
     * Estimate depth from face size.
     */

    headDepth =
        THREE.MathUtils.clamp(
            0.42 /
            faceWidth,
            0.65,
            4.5
        );


    /*
     * Horizontal head rotation.
     */

    const noseOffset =
        nose.x -
        centerX;


    headYaw =
        THREE.MathUtils.clamp(
            noseOffset *
            2.8,
            -1.15,
            1.15
        );


    /*
     * Vertical head rotation.
     */

    const noseVertical =
        nose.y -
        centerY;


    headPitch =
        THREE.MathUtils.clamp(
            (
                noseVertical /
                faceHeight
            ) * 1.8,
            -0.75,
            0.75
        );


    /*
     * Head roll.
     */

    const eyeDX =
        rightEye.x -
        leftEye.x;


    const eyeDY =
        rightEye.y -
        leftEye.y;


    headRoll =
        Math.atan2(
            eyeDY,
            eyeDX
        );


    return true;
}


/* =========================
   SMOOTH TRACKING
========================= */

function smoothTrackingValues() {

    const positionSmooth =
        0.30;


    const rotationSmooth =
        0.28;


    smoothX +=
        (
            headX -
            smoothX
        ) *
        positionSmooth;


    smoothY +=
        (
            headY -
            smoothY
        ) *
        positionSmooth;


    smoothDepth +=
        (
            headDepth -
            smoothDepth
        ) *
        positionSmooth;


    smoothYaw +=
        (
            headYaw -
            smoothYaw
        ) *
        rotationSmooth;


    smoothPitch +=
        (
            headPitch -
            smoothPitch
        ) *
        rotationSmooth;


    smoothRoll +=
        (
            headRoll -
            smoothRoll
        ) *
        rotationSmooth;
}


/* =========================
   HEAD WORLD POSITION
========================= */

function getHeadWorldPosition() {

    if (!camera) {

        return new THREE.Vector3();
    }


    const depth =
        Math.max(
            smoothDepth,
            0.55
        );


    /*
     * Convert camera coordinates
     * to Three.js world coordinates.
     */

    const ndcX =
        (
            smoothX -
            0.5
        ) * 2;


    const ndcY =
        -(
            smoothY -
            0.5
        ) * 2;


    const point =
        new THREE.Vector3(
            ndcX,
            ndcY,
            0
        );


    point.unproject(
        camera
    );


    const direction =
        point
            .sub(
                camera.position
            )
            .normalize();


    return camera.position
        .clone()
        .add(
            direction.multiplyScalar(
                depth
            )
        );
}


/* =========================
   UPDATE INVISIBLE HEAD
========================= */

function updateHeadOccluder(
    headPosition
) {

    if (!faceOccluder) {
        return;
    }


    faceOccluder.position.copy(
        headPosition
    );


    faceOccluder.rotation.set(
        smoothPitch,
        smoothYaw,
        smoothRoll
    );


    /*
     * The invisible sphere represents
     * the physical head volume.
     */

    const width =
        THREE.MathUtils.clamp(
            headFaceWidth *
            smoothDepth *
            3.2,
            0.28,
            2.2
        );


    const height =
        THREE.MathUtils.clamp(
            headFaceHeight *
            smoothDepth *
            2.9,
            0.38,
            2.6
        );


    const depth =
        THREE.MathUtils.clamp(
            width *
            0.95,
            0.35,
            2.0
        );


    faceOccluder.scale.set(
        width,
        height,
        depth
    );


    faceOccluder.visible =
        faceDetected;


    faceOccluder.renderOrder =
        0;
}


/* =========================
   APPLY HEAD TRACKING
========================= */

function applyHeadTracking() {

    if (
        !currentModel ||
        !faceDetected
    ) {

        return;
    }


    const headPosition =
        getHeadWorldPosition();


    const manualX =
        Number(
            el.xSlider
                ? el.xSlider.value
                : 0
        );


    const manualY =
        Number(
            el.ySlider
                ? el.ySlider.value
                : 0
        );


    const manualZ =
        Number(
            el.zSlider
                ? el.zSlider.value
                : 0
        );


    /*
     * Position:
     *
     * X = left/right
     * Y = up/down
     * Z = front/back
     *
     * Negative Z moves the model
     * farther behind the head.
     */

    currentModel.position.set(

        headPosition.x +
            manualX,

        headPosition.y -
            manualY,

        headPosition.z +
            manualZ

    );


    const manualRX =
        degreesToRadians(
            Number(
                el.rotateXSlider
                    ? el.rotateXSlider.value
                    : 0
            )
        );


    const manualRY =
        degreesToRadians(
            Number(
                el.rotateYSlider
                    ? el.rotateYSlider.value
                    : 0
            )
        );


    const manualRZ =
        degreesToRadians(
            Number(
                el.rotateZSlider
                    ? el.rotateZSlider.value
                    : 0
            )
        );


    /*
     * Head rotation + manual rotation.
     */

    currentModel.rotation.set(

        smoothPitch +
            manualRX,

        smoothYaw +
            manualRY,

        smoothRoll +
            manualRZ

    );


    const scale =
        Number(
            el.scaleSlider
                ? el.scaleSlider.value
                : 1
        );


    currentModel.scale.setScalar(
        scale
    );


    /*
     * Model must render after
     * the invisible head depth.
     */

    currentModel.renderOrder =
        1;


    currentModel.traverse(
        (child) => {

            if (
                child.isMesh &&
                child.material
            ) {

                const materials =
                    Array.isArray(
                        child.material
                    )
                        ? child.material
                        : [child.material];


                materials.forEach(
                    (material) => {

                        material.depthTest =
                            true;

                        material.depthWrite =
                            true;

                        material.needsUpdate =
                            true;
                    }
                );
            }
        }
    );


    updateHeadOccluder(
        headPosition
    );
}


/* =========================
   PROCESS FACE RESULT
========================= */

function processFaceResult(
    result
) {

    if (
        !result ||
        !result.faceLandmarks ||
        result.faceLandmarks.length === 0
    ) {

        faceDetected =
            false;


        lastLandmarks =
            null;


        drawFaceLandmarks(
            null
        );


        if (faceOccluder) {

            faceOccluder.visible =
                false;
        }


        return;
    }


    const landmarks =
        result.faceLandmarks[0];


    if (
        !landmarks ||
        landmarks.length < 468
    ) {

        faceDetected =
            false;

        return;
    }


    lastLandmarks =
        landmarks;


    faceDetected =
        calculateHeadValues(
            landmarks
        );


    if (!faceDetected) {

        return;
    }


    smoothTrackingValues();


    /*
     * This is the green dots overlay.
     */

    drawFaceLandmarks(
        landmarks
    );


    /*
     * This moves the 3D model
     * with the head.
     */

    applyHeadTracking();
}


/* =========================
   DETECT CURRENT VIDEO FRAME
========================= */

function detectFaceFrame() {

    if (
        !faceLandmarker ||
        !trackingReady ||
        !el.video
    ) {

        return;
    }


    if (
        el.video.readyState <
        2
    ) {

        return;
    }


    const currentTime =
        el.video.currentTime;


    if (
        currentTime ===
        lastVideoTime
    ) {

        return;
    }


    lastVideoTime =
        currentTime;


    try {

        const timestamp =
            Math.round(
                performance.now()
            );


        const result =
            faceLandmarker.detectForVideo(
                el.video,
                timestamp
            );


        processFaceResult(
            result
        );


    } catch (error) {

        console.error(
            "TRACKING FRAME ERROR:",
            error
        );
    }
}


/* =========================
   TRACKING LOOP
========================= */

function trackingLoop() {

    if (
        !trackingRunning
    ) {

        return;
    }


    detectFaceFrame();


    trackingFrameId =
        requestAnimationFrame(
            trackingLoop
        );
}


/* =========================
   START TRACKING
========================= */

async function startTracking() {

    if (
        !el.video
    ) {

        status(
            "Video element not found."
        );

        return;
    }


    if (
        !cameraStream
    ) {

        await startCamera();
    }


    const ready =
        await createFaceTracker();


    if (!ready) {

        return;
    }


    trackingRunning =
        true;


    lastVideoTime =
        -1;


    if (trackingFrameId) {

        cancelAnimationFrame(
            trackingFrameId
        );
    }


    trackingLoop();


    status(
        "Face tracking started. Green dots are active."
    );
}


/* =========================
   STOP TRACKING
========================= */

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


    faceDetected =
        false;


    lastLandmarks =
        null;


    drawFaceLandmarks(
        null
    );


    if (faceOccluder) {

        faceOccluder.visible =
            false;
    }


    status(
        "Face tracking stopped."
    );
}/* =========================
   RECORDING
========================= */

function getRecordingStream() {

    if (!el.canvas) {
        return null;
    }

    const canvasStream =
        el.canvas.captureStream(30);

    if (
        cameraStream &&
        cameraStream.getAudioTracks().length > 0
    ) {

        cameraStream
            .getAudioTracks()
            .forEach(
                (track) => {

                    canvasStream.addTrack(
                        track
                    );
                }
            );
    }

    return canvasStream;
}


function startRecording() {

    if (recording) {
        return;
    }


    const stream =
        getRecordingStream();


    if (!stream) {

        status(
            "Recording error: canvas stream unavailable."
        );

        return;
    }


    recordChunks =
        [];


    let mimeType =
        "";


    const types = [

        "video/webm;codecs=vp9",

        "video/webm;codecs=vp8",

        "video/webm"

    ];


    for (
        const type of types
    ) {

        if (
            MediaRecorder.isTypeSupported(
                type
            )
        ) {

            mimeType =
                type;

            break;
        }
    }


    try {

        recorder =
            mimeType
                ? new MediaRecorder(
                    stream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    stream
                );


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
            saveRecording;


        recorder.onerror =
            (event) => {

                console.error(
                    "RECORDER ERROR:",
                    event
                );


                recording =
                    false;


                setRecordButtonText(
                    "START RECORDING"
                );


                status(
                    "Recording error."
                );
            };


        recorder.start(
            200
        );


        recording =
            true;


        setRecordButtonText(
            "STOP RECORDING"
        );


        status(
            "Recording started."
        );


    } catch (error) {

        console.error(
            error
        );


        status(
            "Recording error: " +
            error.message
        );
    }
}


function stopRecording() {

    if (
        !recorder ||
        !recording
    ) {

        return;
    }


    recorder.stop();


    recording =
        false;


    setRecordButtonText(
        "START RECORDING"
    );


    status(
        "Preparing recording..."
    );
}


function saveRecording() {

    if (
        !recordChunks.length
    ) {

        status(
            "No recording data."
        );

        return;
    }


    const blob =
        new Blob(
            recordChunks,
            {
                type:
                    "video/webm"
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


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );


    recordChunks =
        [];


    status(
        "Recording saved."
    );
}


function toggleRecording() {

    if (recording) {

        stopRecording();

    } else {

        startRecording();
    }
}


/* =========================
   PHOTO CAPTURE
========================= */

function capturePhoto() {

    if (!el.video) {

        status(
            "Photo error: video unavailable."
        );

        return;
    }


    const width =
        el.video.videoWidth ||
        window.innerWidth;


    const height =
        el.video.videoHeight ||
        window.innerHeight;


    const photoCanvas =
        document.createElement(
            "canvas"
        );


    photoCanvas.width =
        width;


    photoCanvas.height =
        height;


    const context =
        photoCanvas.getContext(
            "2d"
        );


    /*
     * Draw camera image.
     */

    if (cameraFlipped) {

        context.save();

        context.translate(
            width,
            0
        );

        context.scale(
            -1,
            1
        );

        context.drawImage(
            el.video,
            0,
            0,
            width,
            height
        );

        context.restore();

    } else {

        context.drawImage(
            el.video,
            0,
            0,
            width,
            height
        );
    }


    /*
     * Draw Three.js overlay.
     */

    if (el.canvas) {

        context.drawImage(
            el.canvas,
            0,
            0,
            width,
            height
        );
    }


    /*
     * Draw green landmarks.
     * They are included in the photo
     * while tracking is active.
     */

    if (
        landmarkCanvas &&
        landmarkVisible
    ) {

        context.drawImage(
            landmarkCanvas,
            0,
            0,
            width,
            height
        );
    }


    photoCanvas.toBlob(
        (blob) => {

            if (!blob) {

                status(
                    "Photo capture failed."
                );

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


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                },
                1000
            );


            status(
                "Photo captured."
            );

        },
        "image/png"
    );
}


/* =========================
   CONTROLS VISIBILITY
========================= */

function hideControls() {

    if (
        el.appControls
    ) {

        el.appControls.style.display =
            "none";
    }


    if (
        el.showControlsButton
    ) {

        el.showControlsButton.style.display =
            "block";
    }


    status(
        "Controls hidden."
    );
}


function showControls() {

    if (
        el.appControls
    ) {

        el.appControls.style.display =
            "";
    }


    if (
        el.showControlsButton
    ) {

        el.showControlsButton.style.display =
            "";
    }


    status(
        "Controls visible."
    );
}


/* =========================
   LANDMARK TOGGLE
========================= */

function toggleLandmarks() {

    landmarkVisible =
        !landmarkVisible;


    if (!landmarkVisible) {

        drawFaceLandmarks(
            null
        );


        status(
            "Green face dots hidden."
        );


        return;
    }


    if (
        lastLandmarks
    ) {

        drawFaceLandmarks(
            lastLandmarks
        );
    }


    status(
        "Green face dots visible."
    );
}


/* =========================
   SET BUTTON TEXT
========================= */

function setRecordButtonText(
    text
) {

    if (
        el.recordButton
    ) {

        el.recordButton.textContent =
            text;
    }
}


/* =========================
   BUTTON EVENTS
========================= */

function setupEvents() {

    if (
        el.openCameraButton
    ) {

        el.openCameraButton.addEventListener(
            "click",
            async () => {

                await startCamera();
            }
        );
    }


    if (
        el.startTrackingButton
    ) {

        el.startTrackingButton.addEventListener(
            "click",
            async () => {

                if (
                    trackingRunning
                ) {

                    stopTracking();

                } else {

                    await startTracking();
                }
            }
        );
    }


    if (
        el.switchCameraButton
    ) {

        el.switchCameraButton.addEventListener(
            "click",
            async () => {

                await switchCamera();
            }
        );
    }


    if (
        el.flipCameraButton
    ) {

        el.flipCameraButton.addEventListener(
            "click",
            () => {

                toggleCameraFlip();
            }
        );
    }


    if (
        el.recordButton
    ) {

        el.recordButton.addEventListener(
            "click",
            () => {

                toggleRecording();
            }
        );
    }


    if (
        el.captureButton
    ) {

        el.captureButton.addEventListener(
            "click",
            () => {

                capturePhoto();
            }
        );
    }


    if (
        el.modelFileInput
    ) {

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
            }
        );
    }


    if (
        el.resetControlsButton
    ) {

        el.resetControlsButton.addEventListener(
            "click",
            () => {

                resetModelControls();
            }
        );
    }


    if (
        el.hideControlsButton
    ) {

        el.hideControlsButton.addEventListener(
            "click",
            () => {

                hideControls();
            }
        );
    }


    if (
        el.showControlsButton
    ) {

        el.showControlsButton.addEventListener(
            "click",
            () => {

                showControls();
            }
        );
    }


    const sliders = [

        el.scaleSlider,

        el.xSlider,

        el.ySlider,

        el.zSlider,

        el.rotateXSlider,

        el.rotateYSlider,

        el.rotateZSlider

    ];


    sliders.forEach(
        (slider) => {

            if (!slider) {
                return;
            }


            slider.addEventListener(
                "input",
                () => {

                    applyModelControls();
                }
            );
        }
    );


    /*
     * Double tap / click on the
     * status area toggles green dots.
     */

    if (
        el.status
    ) {

        el.status.addEventListener(
            "dblclick",
            () => {

                toggleLandmarks();
            }
        );
    }
}


/* =========================
   OPTIONAL KEYBOARD CONTROLS
========================= */

window.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "r" ||
            event.key === "R"
        ) {

            toggleRecording();
        }


        if (
            event.key === "c" ||
            event.key === "C"
        ) {

            capturePhoto();
        }


        if (
            event.key === "l" ||
            event.key === "L"
        ) {

            toggleLandmarks();
        }
    }
);


/* =========================
   PAGE VISIBILITY
========================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden &&
            recording
        ) {

            /*
             * Do not automatically stop
             * recording. The browser decides
             * how the media stream behaves.
             */

            return;
        }
    }
);/* =========================
   GLB EXPORT
========================= */

function exportCurrentModel() {

    if (!currentModel) {

        status(
            "Export error: no 3D model loaded."
        );

        return;
    }


    status(
        "Preparing GLB export..."
    );


    const exporter =
        new GLTFExporter();


    /*
     * Clone the model so the live
     * tracking scene is not changed.
     */

    const exportRoot =
        currentModel.clone(
            true
        );


    /*
     * Apply the current visual
     * transformation to the clone.
     */

    exportRoot.position.set(
        0,
        0,
        0
    );


    exportRoot.rotation.set(
        0,
        0,
        0
    );


    exportRoot.scale.setScalar(
        1
    );


    exporter.parse(

        exportRoot,

        (result) => {

            try {

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

                    const json =
                        JSON.stringify(
                            result
                        );


                    blob =
                        new Blob(
                            [json],
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


                document.body.appendChild(
                    link
                );


                link.click();


                link.remove();


                setTimeout(
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                    },
                    1000
                );


                status(
                    "3D model exported."
                );


            } catch (error) {

                console.error(
                    "EXPORT SAVE ERROR:",
                    error
                );


                status(
                    "EXPORT ERROR: " +
                    error.message
                );
            }
        },


        (error) => {

            console.error(
                "EXPORT ERROR:",
                error
            );


            status(
                "EXPORT ERROR: " +
                (
                    error &&
                    error.message
                        ? error.message
                        : "Unable to export model."
                )
            );
        },


        {
            binary:
                true,

            onlyVisible:
                false,

            trs:
                false
        }

    );
}


/* =========================
   EXPORT BUTTON
========================= */

function setupExport() {

    if (
        !el.exportButton
    ) {

        return;
    }


    el.exportButton.addEventListener(
        "click",
        () => {

            exportCurrentModel();
        }
    );
}


/* =========================
   CAMERA CLEANUP
========================= */

window.addEventListener(
    "beforeunload",
    () => {

        stopTracking();

        stopCamera();


        if (modelURL) {

            URL.revokeObjectURL(
                modelURL
            );

            modelURL =
                null;
        }
    }
);


/* =========================
   MODEL DRAG SUPPORT
========================= */

let pointerDown =
    false;

let pointerStartX =
    0;

let pointerStartY =
    0;


function setupModelPointerControls() {

    if (!el.canvas) {
        return;
    }


    el.canvas.addEventListener(
        "pointerdown",
        (event) => {

            if (!currentModel) {
                return;
            }


            pointerDown =
                true;


            pointerStartX =
                event.clientX;


            pointerStartY =
                event.clientY;


            try {

                el.canvas.setPointerCapture(
                    event.pointerId
                );

            } catch (error) {
                console.warn(error);
            }
        }
    );


    el.canvas.addEventListener(
        "pointermove",
        (event) => {

            if (
                !pointerDown ||
                !currentModel
            ) {

                return;
            }


            const dx =
                event.clientX -
                pointerStartX;


            const dy =
                event.clientY -
                pointerStartY;


            pointerStartX =
                event.clientX;


            pointerStartY =
                event.clientY;


            /*
             * Manual drag is only applied
             * when face tracking is not active.
             */

            if (
                !trackingRunning
            ) {

                const currentX =
                    Number(
                        el.xSlider
                            ? el.xSlider.value
                            : 0
                    );


                const currentY =
                    Number(
                        el.ySlider
                            ? el.ySlider.value
                            : 0
                    );


                if (
                    el.xSlider
                ) {

                    el.xSlider.value =
                        String(
                            currentX +
                            dx *
                            0.005
                        );
                }


                if (
                    el.ySlider
                ) {

                    el.ySlider.value =
                        String(
                            currentY +
                            dy *
                            0.005
                        );
                }


                applyModelControls();
            }
        }
    );


    el.canvas.addEventListener(
        "pointerup",
        (event) => {

            pointerDown =
                false;


            try {

                el.canvas.releasePointerCapture(
                    event.pointerId
                );

            } catch (error) {
                console.warn(error);
            }
        }
    );


    el.canvas.addEventListener(
        "pointercancel",
        () => {

            pointerDown =
                false;
        }
    );
}


/* =========================
   TRACKING BUTTON TEXT
========================= */

function updateTrackingButtonText() {

    if (
        !el.startTrackingButton
    ) {

        return;
    }


    el.startTrackingButton.textContent =
        trackingRunning
            ? "STOP TRACKING"
            : "START TRACKING";
}


/* =========================
   OPEN CAMERA BUTTON TEXT
========================= */

function updateCameraButtonText() {

    if (
        !el.openCameraButton
    ) {

        return;
    }


    el.openCameraButton.textContent =
        cameraStream
            ? "CAMERA ON"
            : "OPEN CAMERA";
}


/* =========================
   MAIN UI UPDATE
========================= */

setInterval(
    () => {

        updateTrackingButtonText();

        updateCameraButtonText();

    },
    500
);


/* =========================
   FINAL INITIALIZATION
========================= */

try {

    setupEvents();

    setupExport();

    setupModelPointerControls();

    updateSliderLabels();

    updateTrackingButtonText();

    updateCameraButtonText();


    if (
        el.showControlsButton
    ) {

        el.showControlsButton.style.display =
            "none";
    }


    /*
     * Keep green face dots available
     * whenever tracking is active.
     */

    landmarkVisible =
        true;


    /*
     * Initial test cube is visible
     * until a real model is loaded.
     */

    if (testCube) {

        testCube.visible =
            true;
    }


    status(
        "Azeez AR ready. Open camera to begin."
    );


} catch (error) {

    console.error(
        "INITIALIZATION ERROR:",
        error
    );


    status(
        "INIT ERROR: " +
        error.message
    );
}
