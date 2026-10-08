import * as THREE from "three";

const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const statusEl = document.getElementById("status");

const startCameraBtn = document.getElementById("startCameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const mirrorBtn = document.getElementById("mirrorBtn");
const resetBtn = document.getElementById("resetBtn");

let stream = null;
let currentFacingMode = "user";
let mirrorEnabled = false;
let cameraStarted = false;

/* --------------------------------------------------
   THREE.JS
-------------------------------------------------- */

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const arCamera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
);

arCamera.position.set(0, 0, 5);

/* --------------------------------------------------
   LIGHTING
-------------------------------------------------- */

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.8
);

scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(
    0xffffff,
    2.0
);

mainLight.position.set(
    0,
    2,
    5
);

scene.add(mainLight);

/* --------------------------------------------------
   ROOT GROUP
   Future 4-person models will be added here.
-------------------------------------------------- */

const arRoot = new THREE.Group();

scene.add(arRoot);

/* --------------------------------------------------
   CAMERA STATUS
-------------------------------------------------- */

function setStatus(text) {
    if (statusEl) {
        statusEl.textContent = text;
    }
}

/* --------------------------------------------------
   VIDEO MIRROR
-------------------------------------------------- */

function updateMirror() {

    if (!video) return;

    if (mirrorEnabled) {
        video.style.transform = "scaleX(-1)";
        mirrorBtn.textContent = "MIRROR: ON";
    } else {
        video.style.transform = "scaleX(1)";
        mirrorBtn.textContent = "MIRROR: OFF";
    }
}

/* --------------------------------------------------
   START CAMERA
-------------------------------------------------- */

async function startCamera() {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            setStatus("Camera API unavailable");
            return;
        }

        if (stream) {

            stream.getTracks().forEach(track => {
                track.stop();
            });

            stream = null;
        }

        setStatus("Starting Camera...");

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: currentFacingMode
                },
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: true
        });

        video.srcObject = stream;

        await video.play();

        cameraStarted = true;

        updateMirror();

        setStatus("Camera Working");

    } catch (error) {

        console.error("Camera error:", error);

        setStatus(
            "Camera Error: " +
            (error.message || "Unknown error")
        );
    }
}

/* --------------------------------------------------
   SWITCH FRONT / BACK CAMERA
-------------------------------------------------- */

async function switchCamera() {

    if (currentFacingMode === "user") {
        currentFacingMode = "environment";
    } else {
        currentFacingMode = "user";
    }

    await startCamera();
}

/* --------------------------------------------------
   MIRROR BUTTON
-------------------------------------------------- */

function toggleMirror() {

    mirrorEnabled = !mirrorEnabled;

    updateMirror();
}

/* --------------------------------------------------
   BUTTON EVENTS
-------------------------------------------------- */

if (startCameraBtn) {
    startCameraBtn.addEventListener(
        "click",
        startCamera
    );
}

if (switchCameraBtn) {
    switchCameraBtn.addEventListener(
        "click",
        switchCamera
    );
}

if (mirrorBtn) {
    mirrorBtn.addEventListener(
        "click",
        toggleMirror
    );
}

/* --------------------------------------------------
   RESET
-------------------------------------------------- */

if (resetBtn) {

    resetBtn.addEventListener(
        "click",
        () => {

            mirrorEnabled = false;

            updateMirror();

            setStatus(
                cameraStarted
                    ? "Camera Working"
                    : "Camera Off"
            );
        }
    );
}

/* --------------------------------------------------
   RESIZE
-------------------------------------------------- */

function resizeRenderer() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(
        width,
        height
    );

    arCamera.aspect =
        width / height;

    arCamera.updateProjectionMatrix();
}

window.addEventListener(
    "resize",
    resizeRenderer
);

window.addEventListener(
    "orientationchange",
    () => {
        setTimeout(
            resizeRenderer,
            150
        );
    }
);

/* --------------------------------------------------
   ANIMATION LOOP
-------------------------------------------------- */

function animate() {

    requestAnimationFrame(
        animate
    );

    renderer.render(
        scene,
        arCamera
    );
}

animate();

/* --------------------------------------------------
   INITIAL STATE
-------------------------------------------------- */

updateMirror();

setStatus("Camera Off");

console.log(
    "Azeez AI AR - app.js P1 loaded"
);/* ==================================================
   P2 — 4 PERSON FACE TRACKING
================================================== */

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

/* --------------------------------------------------
   LANDMARK CANVAS
-------------------------------------------------- */

const landmarkCanvas =
    document.getElementById("landmarkCanvas");

const landmarkCtx =
    landmarkCanvas.getContext("2d");

const showLandmarksBtn =
    document.getElementById("showLandmarksBtn");

let showLandmarks = false;

/* --------------------------------------------------
   MEDIAPIPE
-------------------------------------------------- */

let faceLandmarker = null;
let faceTrackingReady = false;
let lastVideoTime = -1;

const MAX_PERSONS = 4;

let trackedFaces = [];

/* --------------------------------------------------
   LANDMARK CANVAS SIZE
-------------------------------------------------- */

function resizeLandmarkCanvas() {

    if (!landmarkCanvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    landmarkCanvas.width =
        Math.floor(width * dpr);

    landmarkCanvas.height =
        Math.floor(height * dpr);

    landmarkCanvas.style.width =
        width + "px";

    landmarkCanvas.style.height =
        height + "px";

    landmarkCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

resizeLandmarkCanvas();

window.addEventListener(
    "resize",
    resizeLandmarkCanvas
);

/* --------------------------------------------------
   MEDIAPIPE INITIALIZATION
-------------------------------------------------- */

async function initializeFaceTracking() {

    try {

        setStatus("Loading Face Tracking...");

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
            );

        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath:
                            "../models/face_landmarker.task",

                        delegate: "GPU"
                    },

                    runningMode: "VIDEO",

                    numFaces: MAX_PERSONS,

                    minFaceDetectionConfidence:
                        0.5,

                    minFacePresenceConfidence:
                        0.5,

                    minTrackingConfidence:
                        0.5,

                    outputFaceBlendshapes:
                        true,

                    outputFacialTransformationMatrixes:
                        true
                }
            );

        faceTrackingReady = true;

        setStatus(
            cameraStarted
                ? "Camera + Face Tracking Ready"
                : "Face Tracking Ready"
        );

        console.log(
            "Face Landmarker ready"
        );

    } catch (error) {

        console.error(
            "Face tracking error:",
            error
        );

        faceTrackingReady = false;

        setStatus(
            "Face Tracking Error"
        );
    }
}

/* --------------------------------------------------
   START FACE TRACKING AFTER CAMERA
-------------------------------------------------- */

const originalStartCamera =
    startCamera;

startCamera = async function () {

    await originalStartCamera();

    if (
        cameraStarted &&
        !faceTrackingReady
    ) {
        await initializeFaceTracking();
    }
};

/* --------------------------------------------------
   DRAW LANDMARKS
-------------------------------------------------- */

function drawFaceLandmarks(
    landmarks,
    personIndex
) {

    if (!landmarkCtx) return;

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    /*
       Video uses object-fit: cover.
       Convert normalized face coordinates
       into the visible camera area.
    */

    const videoWidth =
        video.videoWidth || 1;

    const videoHeight =
        video.videoHeight || 1;

    const videoRatio =
        videoWidth / videoHeight;

    const screenRatio =
        width / height;

    let drawWidth;
    let drawHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (screenRatio > videoRatio) {

        drawWidth = width;
        drawHeight =
            width / videoRatio;

        offsetY =
            (height - drawHeight) / 2;

    } else {

        drawHeight = height;
        drawWidth =
            height * videoRatio;

        offsetX =
            (width - drawWidth) / 2;
    }

    /*
       Each person's landmark dots are drawn
       with a different size so we can see
       multiple faces separately.
    */

    for (
        let i = 0;
        i < landmarks.length;
        i++
    ) {

        const point =
            landmarks[i];

        let x =
            offsetX +
            point.x * drawWidth;

        let y =
            offsetY +
            point.y * drawHeight;

        /*
           Mirror only the landmark display
           when the camera preview is mirrored.
        */

        if (mirrorEnabled) {
            x = width - x;
        }

        landmarkCtx.beginPath();

        landmarkCtx.arc(
            x,
            y,
            2.2,
            0,
            Math.PI * 2
        );

        landmarkCtx.fillStyle =
            "#00ff66";

        landmarkCtx.fill();
    }
}

/* --------------------------------------------------
   CLEAR LANDMARKS
-------------------------------------------------- */

function clearLandmarks() {

    if (!landmarkCtx) return;

    landmarkCtx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );
}

/* --------------------------------------------------
   FACE TRACKING LOOP
-------------------------------------------------- */

function processFaceTracking() {

    requestAnimationFrame(
        processFaceTracking
    );

    if (
        !faceTrackingReady ||
        !faceLandmarker ||
        !cameraStarted ||
        video.readyState < 2
    ) {
        return;
    }

    if (
        video.currentTime ===
        lastVideoTime
    ) {
        return;
    }

    lastVideoTime =
        video.currentTime;

    try {

        const result =
            faceLandmarker.detectForVideo(
                video,
                performance.now()
            );

        if (
            !result ||
            !result.faceLandmarks
        ) {

            trackedFaces = [];

            clearLandmarks();

            return;
        }

        trackedFaces =
            result.faceLandmarks
                .slice(
                    0,
                    MAX_PERSONS
                );

        clearLandmarks();

        if (showLandmarks) {

            for (
                let personIndex = 0;
                personIndex <
                trackedFaces.length;
                personIndex++
            ) {

                drawFaceLandmarks(
                    trackedFaces[personIndex],
                    personIndex
                );
            }
        }

        /*
           These values will be used in P3/P4
           to attach separate 3D models to
           separate tracked people.
        */

        window.azizTrackedFaces =
            trackedFaces;

        window.azizFaceResult =
            result;

        if (
            trackedFaces.length > 0
        ) {

            setStatus(
                "Tracking " +
                trackedFaces.length +
                " Person" +
                (
                    trackedFaces.length === 1
                        ? ""
                        : "s"
                )
            );

        } else {

            setStatus(
                "Searching for Face..."
            );
        }

    } catch (error) {

        console.error(
            "Face detection frame error:",
            error
        );
    }
}

/* --------------------------------------------------
   LANDMARK BUTTON
-------------------------------------------------- */

if (showLandmarksBtn) {

    showLandmarksBtn.addEventListener(
        "click",
        () => {

            showLandmarks =
                !showLandmarks;

            showLandmarksBtn.textContent =
                showLandmarks
                    ? "LANDMARKS: ON"
                    : "LANDMARKS: OFF";

            if (!showLandmarks) {
                clearLandmarks();
            }
        }
    );
}

/* --------------------------------------------------
   START TRACKING LOOP
-------------------------------------------------- */

processFaceTracking();

console.log(
    "Azeez AI AR - P2 loaded"
); /* ==================================================
    P3 — 4 PERSON / ANY FORMAT MODEL LOADER
 ================================================== */

import { GLTFLoader } from
    "three/addons/loaders/GLTFLoader.js";

import { OBJLoader } from
    "three/addons/loaders/OBJLoader.js";

import { FBXLoader } from
    "three/addons/loaders/FBXLoader.js";


/* --------------------------------------------------
   PERSON MODEL DATA
-------------------------------------------------- */

const personModels = [
    {
        model: null,
        fileName: "",
        format: "",
        visible: false
    },
    {
        model: null,
        fileName: "",
        format: "",
        visible: false
    },
    {
        model: null,
        fileName: "",
        format: "",
        visible: false
    },
    {
        model: null,
        fileName: "",
        format: "",
        visible: false
    }
];


/* --------------------------------------------------
   LOADERS
-------------------------------------------------- */

const gltfLoader =
    new GLTFLoader();

const objLoader =
    new OBJLoader();

const fbxLoader =
    new FBXLoader();


/* --------------------------------------------------
   MODEL ROOT GROUPS
-------------------------------------------------- */

const personRoots = [];

for (
    let i = 0;
    i < 4;
    i++
) {

    const root =
        new THREE.Group();

    root.visible = false;

    root.name =
        "Person_" +
        (i + 1) +
        "_ModelRoot";

    arRoot.add(root);

    personRoots.push(root);
}


/* --------------------------------------------------
   STATUS ELEMENTS
-------------------------------------------------- */

const personStatusElements = [
    document.getElementById("person1Status"),
    document.getElementById("person2Status"),
    document.getElementById("person3Status"),
    document.getElementById("person4Status")
];


/* --------------------------------------------------
   FILE INPUTS
-------------------------------------------------- */

const personInputs = [
    document.getElementById("person1Model"),
    document.getElementById("person2Model"),
    document.getElementById("person3Model"),
    document.getElementById("person4Model")
];


/* --------------------------------------------------
   CLEAR BUTTONS
-------------------------------------------------- */

const personClearButtons = [
    document.getElementById("person1Clear"),
    document.getElementById("person2Clear"),
    document.getElementById("person3Clear"),
    document.getElementById("person4Clear")
];


/* --------------------------------------------------
   UPDATE STATUS
-------------------------------------------------- */

function updatePersonStatus(
    personIndex,
    message
) {

    const element =
        personStatusElements[
            personIndex
        ];

    if (element) {
        element.textContent =
            message;
    }
}


/* --------------------------------------------------
   DISPOSE MODEL
-------------------------------------------------- */

function disposeObject(
    object
) {

    if (!object) return;

    object.traverse(
        child => {

            if (child.geometry) {

                child.geometry.dispose();
            }

            if (child.material) {

                if (
                    Array.isArray(
                        child.material
                    )
                ) {

                    child.material.forEach(
                        material => {
                            disposeMaterial(
                                material
                            );
                        }
                    );

                } else {

                    disposeMaterial(
                        child.material
                    );
                }
            }
        }
    );
}


/* --------------------------------------------------
   DISPOSE MATERIAL
-------------------------------------------------- */

function disposeMaterial(
    material
) {

    if (!material) return;

    const textureNames = [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "emissiveMap",
        "aoMap",
        "alphaMap",
        "bumpMap",
        "displacementMap"
    ];

    textureNames.forEach(
        name => {

            const texture =
                material[name];

            if (
                texture &&
                texture.dispose
            ) {
                texture.dispose();
            }
        }
    );

    if (material.dispose) {
        material.dispose();
    }
}


/* --------------------------------------------------
   REMOVE OLD MODEL
-------------------------------------------------- */

function clearPersonModel(
    personIndex
) {

    const root =
        personRoots[
            personIndex
        ];

    if (!root) return;

    while (
        root.children.length > 0
    ) {

        const child =
            root.children[0];

        root.remove(child);

        disposeObject(child);
    }

    personModels[
        personIndex
    ].model = null;

    personModels[
        personIndex
    ].fileName = "";

    personModels[
        personIndex
    ].format = "";

    personModels[
        personIndex
    ].visible = false;

    root.visible = false;

    updatePersonStatus(
        personIndex,
        "No filter selected"
    );
}


/* --------------------------------------------------
   PREPARE MODEL
-------------------------------------------------- */

function prepareModel(
    model,
    personIndex
) {

    if (!model) return;

    model.traverse(
        child => {

            if (
                child.isMesh
            ) {

                child.frustumCulled =
                    false;

                if (child.material) {

                    if (
                        Array.isArray(
                            child.material
                        )
                    ) {

                        child.material.forEach(
                            material => {

                                material.needsUpdate =
                                    true;
                            }
                        );

                    } else {

                        child.material.needsUpdate =
                            true;
                    }
                }
            }
        }
    );

    /*
       Every imported model starts from
       a neutral local transform.
       Head tracking will control the
       final transform in P4.
    */

    model.position.set(
        0,
        0,
        0
    );

    model.rotation.set(
        0,
        0,
        0
    );

    model.scale.set(
        1,
        1,
        1
    );

    personRoots[
        personIndex
    ].add(model);

    personRoots[
        personIndex
    ].visible = false;
}


/* --------------------------------------------------
   DETECT FILE FORMAT
-------------------------------------------------- */

function getFileExtension(
    file
) {

    const name =
        file.name.toLowerCase();

    const parts =
        name.split(".");

    if (
        parts.length < 2
    ) {
        return "";
    }

    return parts[
        parts.length - 1
    ];
}


/* --------------------------------------------------
   LOAD GLB / GLTF
-------------------------------------------------- */

function loadGLTFModel(
    file,
    personIndex
) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(
                    file
                );

            gltfLoader.load(
                url,

                gltf => {

                    URL.revokeObjectURL(
                        url
                    );

                    resolve(
                        gltf.scene
                    );
                },

                undefined,

                error => {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(error);
                }
            );
        }
    );
}


/* --------------------------------------------------
   LOAD OBJ
-------------------------------------------------- */

function loadOBJModel(
    file,
    personIndex
) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(
                    file
                );

            objLoader.load(
                url,

                object => {

                    URL.revokeObjectURL(
                        url
                    );

                    resolve(
                        object
                    );
                },

                undefined,

                error => {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(error);
                }
            );
        }
    );
}


/* --------------------------------------------------
   LOAD FBX
-------------------------------------------------- */

function loadFBXModel(
    file,
    personIndex
) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(
                    file
                );

            fbxLoader.load(
                url,

                object => {

                    URL.revokeObjectURL(
                        url
                    );

                    resolve(
                        object
                    );
                },

                undefined,

                error => {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(error);
                }
            );
        }
    );
}


/* --------------------------------------------------
   LOAD ANY SUPPORTED FORMAT
-------------------------------------------------- */

async function loadPersonModel(
    personIndex,
    file
) {

    if (!file) return;

    const extension =
        getFileExtension(
            file
        );

    if (
        ![
            "glb",
            "gltf",
            "obj",
            "fbx"
        ].includes(extension)
    ) {

        updatePersonStatus(
            personIndex,
            "Unsupported format"
        );

        return;
    }


    updatePersonStatus(
        personIndex,
        "Loading " +
        file.name +
        "..."
    );


    /*
       Remove the previous model first.
    */

    clearPersonModel(
        personIndex
    );


    try {

        let model = null;


        /* GLB / GLTF */

        if (
            extension === "glb" ||
            extension === "gltf"
        ) {

            model =
                await loadGLTFModel(
                    file,
                    personIndex
                );
        }


        /* OBJ */

        else if (
            extension === "obj"
        ) {

            model =
                await loadOBJModel(
                    file,
                    personIndex
                );
        }


        /* FBX */

        else if (
            extension === "fbx"
        ) {

            model =
                await loadFBXModel(
                    file,
                    personIndex
                );
        }


        if (!model) {

            throw new Error(
                "Model could not be loaded"
            );
        }


        prepareModel(
            model,
            personIndex
        );


        personModels[
            personIndex
        ].model = model;

        personModels[
            personIndex
        ].fileName =
            file.name;

        personModels[
            personIndex
        ].format =
            extension.toUpperCase();

        personModels[
            personIndex
        ].visible = true;


        /*
           Model is loaded but hidden until
           a corresponding person is detected.
        */

        personRoots[
            personIndex
        ].visible = false;


        updatePersonStatus(
            personIndex,

            "Loaded: " +
            file.name
        );


        console.log(
            "Person " +
            (personIndex + 1) +
            " model loaded:",
            extension.toUpperCase(),
            file.name
        );


    } catch (error) {

        console.error(
            "Model loading error:",
            error
        );

        clearPersonModel(
            personIndex
        );

        updatePersonStatus(
            personIndex,

            "Load failed: " +
            file.name
        );
    }
}


/* --------------------------------------------------
   FILE INPUT EVENTS
-------------------------------------------------- */

for (
    let i = 0;
    i < personInputs.length;
    i++
) {

    const input =
        personInputs[i];

    if (!input) continue;


    input.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files &&
                event.target.files[0];

            if (!file) return;

            await loadPersonModel(
                i,
                file
            );

            /*
               Allow selecting the same
               file again later.
            */

            event.target.value = "";
        }
    );
}


/* --------------------------------------------------
   CLEAR EVENTS
-------------------------------------------------- */

for (
    let i = 0;
    i < personClearButtons.length;
    i++
) {

    const button =
        personClearButtons[i];

    if (!button) continue;

    button.addEventListener(
        "click",
        () => {

            clearPersonModel(
                i
            );
        }
    );
}


/* --------------------------------------------------
   PUBLIC MODEL DATA
-------------------------------------------------- */

window.azizPersonModels =
    personModels;

window.azizPersonRoots =
    personRoots;

window.azizLoadPersonModel =
    loadPersonModel;

window.azizClearPersonModel =
    clearPersonModel;


/* --------------------------------------------------
   P3 READY
-------------------------------------------------- */

console.log(
    "Azeez AI AR - P3 loaded"
);

console.log(
    "4 person model slots ready"
);

console.log(
    "Supported formats: GLB, GLTF, OBJ, FBX"
);/* ==================================================
   P4 — 4 PERSON HEAD ATTACHMENT
================================================== */

const headFitBtn =
    document.getElementById("headFitBtn");

const posXInput =
    document.getElementById("posX");

const posYInput =
    document.getElementById("posY");

const posZInput =
    document.getElementById("posZ");

const scaleInput =
    document.getElementById("scale");

const rotXInput =
    document.getElementById("rotX");

const rotYInput =
    document.getElementById("rotY");

const rotZInput =
    document.getElementById("rotZ");


let headFitEnabled = true;


/* --------------------------------------------------
   MANUAL MODEL SETTINGS
-------------------------------------------------- */

const modelSettings = {

    x: 0,
    y: 0,
    z: 0,

    scale: 1,

    rotX: 0,
    rotY: 0,
    rotZ: 0
};


/* --------------------------------------------------
   UPDATE RANGE OUTPUTS
-------------------------------------------------- */

function updateRangeOutput(
    input,
    outputId,
    suffix = ""
) {

    if (!input) return;

    const output =
        document.getElementById(
            outputId
        );

    if (!output) return;

    output.textContent =
        input.value + suffix;
}


/* --------------------------------------------------
   READ MANUAL SETTINGS
-------------------------------------------------- */

function updateModelSettings() {

    modelSettings.x =
        parseFloat(
            posXInput?.value || 0
        );

    modelSettings.y =
        parseFloat(
            posYInput?.value || 0
        );

    modelSettings.z =
        parseFloat(
            posZInput?.value || 0
        );

    modelSettings.scale =
        parseFloat(
            scaleInput?.value || 1
        );

    modelSettings.rotX =
        parseFloat(
            rotXInput?.value || 0
        ) *
        Math.PI /
        180;

    modelSettings.rotY =
        parseFloat(
            rotYInput?.value || 0
        ) *
        Math.PI /
        180;

    modelSettings.rotZ =
        parseFloat(
            rotZInput?.value || 0
        ) *
        Math.PI /
        180;


    updateRangeOutput(
        posXInput,
        "posXValue"
    );

    updateRangeOutput(
        posYInput,
        "posYValue"
    );

    updateRangeOutput(
        posZInput,
        "posZValue"
    );

    updateRangeOutput(
        scaleInput,
        "scaleValue"
    );

    updateRangeOutput(
        rotXInput,
        "rotXValue",
        "°"
    );

    updateRangeOutput(
        rotYInput,
        "rotYValue",
        "°"
    );

    updateRangeOutput(
        rotZInput,
        "rotZValue",
        "°"
    );
}


/* --------------------------------------------------
   RANGE EVENTS
-------------------------------------------------- */

[
    posXInput,
    posYInput,
    posZInput,
    scaleInput,
    rotXInput,
    rotYInput,
    rotZInput

].forEach(
    input => {

        if (!input) return;

        input.addEventListener(
            "input",
            updateModelSettings
        );
    }
);


updateModelSettings();


/* --------------------------------------------------
   FACE CENTER
-------------------------------------------------- */

function getFaceCenter(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length === 0
    ) {
        return null;
    }


    /*
       Nose / central face area.
       MediaPipe landmark 1 is the
       main nose region.
    */

    const nose =
        landmarks[1] ||
        landmarks[4] ||
        landmarks[0];


    if (!nose) {
        return null;
    }


    return {
        x: nose.x,
        y: nose.y,
        z: nose.z
    };
}


/* --------------------------------------------------
   FACE SIZE
-------------------------------------------------- */

function getFaceSize(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length < 10
    ) {
        return 0.15;
    }


    const left =
        landmarks[234];

    const right =
        landmarks[454];

    if (!left || !right) {
        return 0.15;
    }


    const dx =
        right.x -
        left.x;

    const dy =
        right.y -
        left.y;


    const size =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    return Math.max(
        size,
        0.05
    );
}


/* --------------------------------------------------
   FACE ROTATION
-------------------------------------------------- */

function getFaceRotation(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length < 455
    ) {

        return {
            x: 0,
            y: 0,
            z: 0
        };
    }


    const nose =
        landmarks[1];

    const left =
        landmarks[234];

    const right =
        landmarks[454];

    const forehead =
        landmarks[10];

    const chin =
        landmarks[152];


    if (
        !nose ||
        !left ||
        !right ||
        !forehead ||
        !chin
    ) {

        return {
            x: 0,
            y: 0,
            z: 0
        };
    }


    /*
       Roll:
       line between left/right eyes.
    */

    const roll =
        Math.atan2(
            right.y - left.y,
            right.x - left.x
        );


    /*
       Pitch:
       forehead -> chin direction.
    */

    const verticalDistance =
        Math.abs(
            chin.y -
            forehead.y
        );


    const noseVertical =
        Math.abs(
            nose.y -
            forehead.y
        );


    let pitchRatio =
        noseVertical /
        Math.max(
            verticalDistance,
            0.001
        );


    pitchRatio =
        Math.max(
            0,
            Math.min(
                1,
                pitchRatio
            )
        );


    const pitch =
        (
            pitchRatio -
            0.5
        ) *
        1.8;


    /*
       Yaw:
       nose position relative to
       left/right face width.
    */

    const centerX =
        (
            left.x +
            right.x
        ) / 2;


    const faceWidth =
        Math.max(
            Math.abs(
                right.x -
                left.x
            ),
            0.001
        );


    const yaw =
        (
            nose.x -
            centerX
        ) /
        faceWidth *
        2.2;


    return {
        x: pitch,
        y: yaw,
        z: -roll
    };
}


/* --------------------------------------------------
   CONVERT FACE POSITION TO THREE.JS
-------------------------------------------------- */

function faceToWorld(
    landmarks
) {

    const center =
        getFaceCenter(
            landmarks
        );

    if (!center) {
        return null;
    }


    /*
       Convert normalized camera
       coordinates into AR world space.
    */

    const x =
        (
            center.x -
            0.5
        ) * 5.0;


    const y =
        (
            0.5 -
            center.y
        ) * 5.0;


    /*
       MediaPipe Z is relative depth.
       Keep the multiplier moderate so
       movement remains stable.
    */

    const z =
        -center.z * 5.0;


    return {
        x,
        y,
        z
    };
}


/* --------------------------------------------------
   APPLY MODEL TRANSFORM
-------------------------------------------------- */

function applyPersonTransform(
    personIndex,
    landmarks
) {

    if (
        !window.azizPersonRoots
    ) {
        return;
    }


    const root =
        window.azizPersonRoots[
            personIndex
        ];


    const modelData =
        window.azizPersonModels[
            personIndex
        ];


    if (
        !root ||
        !modelData ||
        !modelData.model
    ) {

        if (root) {
            root.visible = false;
        }

        return;
    }


    const worldPosition =
        faceToWorld(
            landmarks
        );


    if (!worldPosition) {

        root.visible = false;

        return;
    }


    const rotation =
        getFaceRotation(
            landmarks
        );


    const faceSize =
        getFaceSize(
            landmarks
        );


    /*
       Automatic head fitting.
       This gives every person's model
       its own size based on their face.
    */

    let automaticScale =
        faceSize * 8.0;


    automaticScale =
        Math.max(
            automaticScale,
            0.15
        );


    automaticScale =
        Math.min(
            automaticScale,
            8
        );


    if (!headFitEnabled) {
        automaticScale = 1;
    }


    const finalScale =
        automaticScale *
        modelSettings.scale;


    root.position.set(

        worldPosition.x +
        modelSettings.x,

        worldPosition.y +
        modelSettings.y,

        worldPosition.z +
        modelSettings.z
    );


    root.rotation.set(

        rotation.x +
        modelSettings.rotX,

        rotation.y +
        modelSettings.rotY,

        rotation.z +
        modelSettings.rotZ
    );


    root.scale.set(
        finalScale,
        finalScale,
        finalScale
    );


    root.visible = true;
}


/* --------------------------------------------------
   UPDATE ALL FOUR PEOPLE
-------------------------------------------------- */

function updateAllPersonModels() {

    const faces =
        window.azizTrackedFaces ||
        [];


    /*
       Hide unused person slots.
    */

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const root =
            window.azizPersonRoots?.[i];

        const modelData =
            window.azizPersonModels?.[i];


        if (!root) continue;


        if (
            i >= faces.length ||
            !modelData ||
            !modelData.model
        ) {

            root.visible = false;

            continue;
        }


        applyPersonTransform(
            i,
            faces[i]
        );
    }
}


/* --------------------------------------------------
   HEAD FIT BUTTON
-------------------------------------------------- */

if (headFitBtn) {

    headFitBtn.addEventListener(
        "click",
        () => {

            headFitEnabled =
                !headFitEnabled;


            headFitBtn.textContent =
                headFitEnabled
                    ? "HEAD FIT: ON"
                    : "HEAD FIT: OFF";
        }
    );
}


/* --------------------------------------------------
   MODEL UPDATE LOOP
-------------------------------------------------- */

function personModelLoop() {

    requestAnimationFrame(
        personModelLoop
    );

    updateAllPersonModels();
}

personModelLoop();


/* --------------------------------------------------
   P4 READY
-------------------------------------------------- */

console.log(
    "Azeez AI AR - P4 loaded"
);

console.log(
    "4-person head attachment active"
);
