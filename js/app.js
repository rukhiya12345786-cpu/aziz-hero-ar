import * as THREE from "three";

/* =====================================================
   AZEEZ AI AR — NEW BUILD
   P1: CAMERA + THREE.JS + MODEL CONTROLS
===================================================== */

const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const statusEl = document.getElementById("status");

/* -----------------------------------------------------
   BUTTONS
----------------------------------------------------- */

const startCameraBtn =
    document.getElementById("startCameraBtn");

const switchCameraBtn =
    document.getElementById("switchCameraBtn");

const mirrorBtn =
    document.getElementById("mirrorBtn");

const resetBtn =
    document.getElementById("resetBtn");

const hideUiBtn =
    document.getElementById("hideUiBtn");

const hideControlsBtn =
    document.getElementById("hideControlsBtn");

const showLandmarksBtn =
    document.getElementById("showLandmarksBtn");

const headFitBtn =
    document.getElementById("headFitBtn");


/* =====================================================
   CAMERA
===================================================== */

let cameraStream = null;

let cameraFacing = "user";

let mirrorEnabled = false;

let cameraRunning = false;


/* -----------------------------------------------------
   STATUS
----------------------------------------------------- */

function setStatus(message) {

    if (statusEl) {
        statusEl.textContent = message;
    }

    console.log("[STATUS]", message);
}


/* -----------------------------------------------------
   CAMERA MIRROR
----------------------------------------------------- */

function updateCameraMirror() {

    if (!video) return;

    if (mirrorEnabled) {

        video.style.transform =
            "scaleX(-1)";

        if (mirrorBtn) {
            mirrorBtn.textContent =
                "MIRROR: ON";
        }

    } else {

        video.style.transform =
            "scaleX(1)";

        if (mirrorBtn) {
            mirrorBtn.textContent =
                "MIRROR: OFF";
        }
    }
}


/* -----------------------------------------------------
   STOP CAMERA
----------------------------------------------------- */

function stopCamera() {

    if (!cameraStream) return;

    cameraStream
        .getTracks()
        .forEach(track => {
            track.stop();
        });

    cameraStream = null;

    if (video) {
        video.srcObject = null;
    }

    cameraRunning = false;
}


/* -----------------------------------------------------
   START CAMERA
----------------------------------------------------- */

async function startCamera() {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            setStatus(
                "Camera API unavailable"
            );

            return;
        }


        setStatus(
            "Starting Camera..."
        );


        stopCamera();


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: {
                            ideal:
                                cameraFacing
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


        if (!video) {

            throw new Error(
                "Camera video element missing"
            );
        }


        video.srcObject =
            cameraStream;


        await video.play();


        cameraRunning = true;


        updateCameraMirror();


        setStatus(
            "Camera Working"
        );


        console.log(
            "Camera started:",
            cameraFacing
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );

        cameraRunning = false;

        setStatus(
            "Camera Error"
        );
    }
}


/* -----------------------------------------------------
   START CAMERA BUTTON
----------------------------------------------------- */

if (startCameraBtn) {

    startCameraBtn.addEventListener(
        "click",
        startCamera
    );
}


/* -----------------------------------------------------
   SWITCH FRONT / BACK
----------------------------------------------------- */

if (switchCameraBtn) {

    switchCameraBtn.addEventListener(
        "click",
        async () => {

            if (
                cameraFacing === "user"
            ) {

                cameraFacing =
                    "environment";

            } else {

                cameraFacing =
                    "user";
            }


            await startCamera();
        }
    );
}


/* -----------------------------------------------------
   MIRROR BUTTON
----------------------------------------------------- */

if (mirrorBtn) {

    mirrorBtn.addEventListener(
        "click",
        () => {

            mirrorEnabled =
                !mirrorEnabled;

            updateCameraMirror();
        }
    );
}


/* =====================================================
   THREE.JS
===================================================== */

const renderer =
    new THREE.WebGLRenderer({

        canvas: canvas,

        alpha: true,

        antialias: true,

        preserveDrawingBuffer: true
    });


renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio || 1,
        2
    )
);


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);


renderer.outputColorSpace =
    THREE.SRGBColorSpace;


const scene =
    new THREE.Scene();


const arCamera =
    new THREE.PerspectiveCamera(
        45,
        window.innerWidth /
        window.innerHeight,
        0.01,
        1000
    );


arCamera.position.set(
    0,
    0,
    5
);


/* -----------------------------------------------------
   LIGHTS
----------------------------------------------------- */

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        2
    );

scene.add(
    ambientLight
);


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

scene.add(
    keyLight
);


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

scene.add(
    fillLight
);


/* -----------------------------------------------------
   AR ROOT
----------------------------------------------------- */

const arRoot =
    new THREE.Group();

scene.add(
    arRoot
);


/* =====================================================
   MODEL CONTROL VALUES
===================================================== */

const modelControls = {

    x: 0,

    y: 0,

    z: 0,

    size: 1,

    width: 1,

    height: 1,

    rotX: 0,

    rotY: 0,

    rotZ: 0,

    headFit: true
};


/* =====================================================
   SLIDER HELPERS
===================================================== */

function getNumber(
    id,
    fallback
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    const value =
        parseFloat(
            element.value
        );

    return Number.isFinite(value)
        ? value
        : fallback;
}


function setOutput(
    id,
    value,
    suffix = ""
) {

    const output =
        document.getElementById(id);

    if (!output) return;

    output.textContent =
        value + suffix;
}


/* =====================================================
   READ ALL MODEL CONTROLS
===================================================== */

function readModelControls() {

    modelControls.x =
        getNumber(
            "posX",
            0
        );

    modelControls.y =
        getNumber(
            "posY",
            0
        );

    modelControls.z =
        getNumber(
            "posZ",
            0
        );

    modelControls.size =
        getNumber(
            "scale",
            1
        );

    /*
       Width and Height use the same
       main scale initially if their
       dedicated sliders are not yet
       present.
    */

    modelControls.width =
        getNumber(
            "modelWidth",
            1
        );

    modelControls.height =
        getNumber(
            "modelHeight",
            1
        );

    modelControls.rotX =
        THREE.MathUtils.degToRad(
            getNumber(
                "rotX",
                0
            )
        );

    modelControls.rotY =
        THREE.MathUtils.degToRad(
            getNumber(
                "rotY",
                0
            )
        );

    modelControls.rotZ =
        THREE.MathUtils.degToRad(
            getNumber(
                "rotZ",
                0
            )
        );


    /* Outputs */

    setOutput(
        "posXValue",
        getNumber("posX", 0)
    );

    setOutput(
        "posYValue",
        getNumber("posY", 0)
    );

    setOutput(
        "posZValue",
        getNumber("posZ", 0)
    );

    setOutput(
        "scaleValue",
        getNumber("scale", 1)
    );

    setOutput(
        "modelWidthValue",
        getNumber("modelWidth", 1)
    );

    setOutput(
        "modelHeightValue",
        getNumber("modelHeight", 1)
    );

    setOutput(
        "rotXValue",
        getNumber("rotX", 0),
        "°"
    );

    setOutput(
        "rotYValue",
        getNumber("rotY", 0),
        "°"
    );

    setOutput(
        "rotZValue",
        getNumber("rotZ", 0),
        "°"
    );
}


/* -----------------------------------------------------
   SLIDER LISTENERS
----------------------------------------------------- */

const controlIds = [

    "posX",
    "posY",
    "posZ",

    "scale",

    "modelWidth",
    "modelHeight",

    "rotX",
    "rotY",
    "rotZ"
];


controlIds.forEach(
    id => {

        const element =
            document.getElementById(id);

        if (!element) return;

        element.addEventListener(
            "input",
            readModelControls
        );
    }
);


readModelControls();


/* =====================================================
   HEAD FIT
===================================================== */

if (headFitBtn) {

    headFitBtn.addEventListener(
        "click",
        () => {

            modelControls.headFit =
                !modelControls.headFit;


            headFitBtn.textContent =
                modelControls.headFit
                    ? "HEAD FIT: ON"
                    : "HEAD FIT: OFF";
        }
    );
}


/* =====================================================
   LANDMARK BUTTON
===================================================== */

let landmarksVisible = false;


if (showLandmarksBtn) {

    showLandmarksBtn.addEventListener(
        "click",
        () => {

            landmarksVisible =
                !landmarksVisible;


            showLandmarksBtn.textContent =
                landmarksVisible
                    ? "LANDMARKS: ON"
                    : "LANDMARKS: OFF";
        }
    );
}


/* =====================================================
   HIDE UI
===================================================== */

let uiHidden = false;


if (hideUiBtn) {

    hideUiBtn.addEventListener(
        "click",
        () => {

            uiHidden =
                !uiHidden;


            const controls =
                document.getElementById(
                    "controls"
                );

            const topBar =
                document.getElementById(
                    "topBar"
                );


            if (controls) {

                controls.classList.toggle(
                    "ui-hidden",
                    uiHidden
                );
            }


            if (topBar) {

                topBar.classList.toggle(
                    "ui-hidden",
                    uiHidden
                );
            }
        }
    );
}


/* =====================================================
   HIDE CONTROLS
===================================================== */

let controlsHidden = false;


if (hideControlsBtn) {

    hideControlsBtn.addEventListener(
        "click",
        () => {

            controlsHidden =
                !controlsHidden;


            const controls =
                document.getElementById(
                    "controls"
                );


            if (controls) {

                controls.classList.toggle(
                    "ui-hidden",
                    controlsHidden
                );
            }
        }
    );
}


/* =====================================================
   RESET
===================================================== */

if (resetBtn) {

    resetBtn.addEventListener(
        "click",
        () => {

            const defaults = {

                posX: 0,

                posY: 0,

                posZ: 0,

                scale: 1,

                modelWidth: 1,

                modelHeight: 1,

                rotX: 0,

                rotY: 0,

                rotZ: 0
            };


            Object.entries(
                defaults
            ).forEach(
                ([id, value]) => {

                    const input =
                        document.getElementById(
                            id
                        );

                    if (input) {
                        input.value =
                            value;
                    }
                }
            );


            modelControls.headFit =
                true;


            if (headFitBtn) {

                headFitBtn.textContent =
                    "HEAD FIT: ON";
            }


            readModelControls();


            setStatus(
                cameraRunning
                    ? "Camera Working"
                    : "Camera Off"
            );
        }
    );
}


/* =====================================================
   RESIZE
===================================================== */

function resizeApp() {

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;


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
    resizeApp
);


window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            resizeApp,
            200
        );
    }
);


/* =====================================================
   RENDER LOOP
===================================================== */

function renderLoop() {

    requestAnimationFrame(
        renderLoop
    );


    renderer.render(
        scene,
        arCamera
    );
}


renderLoop();


/* =====================================================
   INITIAL STATE
===================================================== */

updateCameraMirror();

setStatus(
    "Camera Off"
);


console.log(
    "AZEEZ AI AR NEW P1 READY"
);/* =====================================================
   AZEEZ AI AR — NEW BUILD
   P2: 4-PERSON FACE TRACKING
===================================================== */

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =====================================================
   TRACKING SETTINGS
===================================================== */

const MAX_PERSONS = 4;

let faceLandmarker = null;

let faceTrackingReady = false;

let lastVideoTime = -1;

let trackedFaces = [];

let faceTrackingStarted = false;


/* =====================================================
   LANDMARK CANVAS
===================================================== */

const landmarkCanvas =
    document.getElementById(
        "landmarkCanvas"
    );

const landmarkContext =
    landmarkCanvas
        ? landmarkCanvas.getContext("2d")
        : null;


/* =====================================================
   LANDMARK RESIZE
===================================================== */

function resizeLandmarkCanvas() {

    if (
        !landmarkCanvas ||
        !landmarkContext
    ) {
        return;
    }


    const width =
        window.innerWidth;

    const height =
        window.innerHeight;


    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    landmarkCanvas.width =
        Math.floor(
            width * dpr
        );


    landmarkCanvas.height =
        Math.floor(
            height * dpr
        );


    landmarkCanvas.style.width =
        width + "px";


    landmarkCanvas.style.height =
        height + "px";


    landmarkContext.setTransform(
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


/* =====================================================
   CLEAR LANDMARKS
===================================================== */

function clearLandmarks() {

    if (
        !landmarkCanvas ||
        !landmarkContext
    ) {
        return;
    }


    landmarkContext.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );
}


/* =====================================================
   INITIALIZE MEDIAPIPE
===================================================== */

async function initializeFaceTracking() {

    if (faceTrackingStarted) {
        return;
    }


    faceTrackingStarted = true;


    try {

        setStatus(
            "Loading Face Tracking..."
        );


        const vision =
            await FilesetResolver
                .forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
                );


        faceLandmarker =
            await FaceLandmarker
                .createFromOptions(
                    vision,
                    {

                        baseOptions: {

                            modelAssetPath:
                                "../models/face_landmarker.task",

                            delegate:
                                "GPU"
                        },


                        runningMode:
                            "VIDEO",


                        numFaces:
                            MAX_PERSONS,


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


        faceTrackingReady =
            true;


        console.log(
            "MediaPipe Face Landmarker READY"
        );


        setStatus(
            cameraRunning
                ? "Face Tracking Ready"
                : "Face Tracker Ready"
        );


    } catch (error) {

        console.error(
            "FACE TRACKING ERROR:",
            error
        );


        faceTrackingReady =
            false;


        faceTrackingStarted =
            false;


        setStatus(
            "Face Tracking Error"
        );
    }
}


/* =====================================================
   WAIT FOR CAMERA THEN START TRACKING
===================================================== */

function trackingCameraWatcher() {

    requestAnimationFrame(
        trackingCameraWatcher
    );


    if (
        !cameraRunning ||
        !video ||
        video.readyState < 2
    ) {
        return;
    }


    if (
        !faceTrackingReady &&
        !faceTrackingStarted
    ) {

        initializeFaceTracking();

        return;
    }


    if (
        !faceTrackingReady ||
        !faceLandmarker
    ) {
        return;
    }


    processFaceFrame();
}


trackingCameraWatcher();


/* =====================================================
   VIDEO → SCREEN COORDINATES
===================================================== */

function videoPointToScreen(
    point
) {

    if (!video) {
        return {
            x: 0,
            y: 0
        };
    }


    const screenWidth =
        window.innerWidth;

    const screenHeight =
        window.innerHeight;


    const videoWidth =
        video.videoWidth || 1;

    const videoHeight =
        video.videoHeight || 1;


    const videoRatio =
        videoWidth /
        videoHeight;


    const screenRatio =
        screenWidth /
        screenHeight;


    let displayWidth;

    let displayHeight;

    let offsetX = 0;

    let offsetY = 0;


    /*
       Match CSS object-fit: cover.
    */

    if (
        screenRatio >
        videoRatio
    ) {

        displayWidth =
            screenWidth;

        displayHeight =
            screenWidth /
            videoRatio;

        offsetY =
            (
                screenHeight -
                displayHeight
            ) / 2;

    } else {

        displayHeight =
            screenHeight;

        displayWidth =
            screenHeight *
            videoRatio;

        offsetX =
            (
                screenWidth -
                displayWidth
            ) / 2;
    }


    let x =
        offsetX +
        point.x *
        displayWidth;


    const y =
        offsetY +
        point.y *
        displayHeight;


    if (mirrorEnabled) {
        x =
            screenWidth - x;
    }


    return {
        x,
        y
    };
}


/* =====================================================
   DRAW LANDMARKS
===================================================== */

function drawOneFace(
    landmarks,
    personIndex
) {

    if (
        !landmarkContext ||
        !landmarks
    ) {
        return;
    }


    /*
       Only draw a small subset of
       important landmarks.

       This keeps the phone responsive
       when 4 people are present.
    */

    const importantPoints = [

        10,
        33,
        133,
        159,
        145,

        263,
        362,
        386,
        374,

        1,

        61,
        291,

        199,
        152,

        234,
        454
    ];


    for (
        const index
        of importantPoints
    ) {

        const point =
            landmarks[index];


        if (!point) {
            continue;
        }


        const screenPoint =
            videoPointToScreen(
                point
            );


        landmarkContext.beginPath();


        landmarkContext.arc(
            screenPoint.x,
            screenPoint.y,
            3,
            0,
            Math.PI * 2
        );


        landmarkContext.fillStyle =
            "#00ff66";


        landmarkContext.fill();
    }
}


/* =====================================================
   DRAW ALL FACES
===================================================== */

function drawAllLandmarks() {

    clearLandmarks();


    if (
        !landmarksVisible ||
        trackedFaces.length === 0
    ) {
        return;
    }


    for (
        let i = 0;
        i < trackedFaces.length;
        i++
    ) {

        drawOneFace(
            trackedFaces[i],
            i
        );
    }
}


/* =====================================================
   FACE CENTER
===================================================== */

function getTrackedFaceCenter(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length === 0
    ) {
        return null;
    }


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


/* =====================================================
   FACE SIZE
===================================================== */

function getTrackedFaceSize(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length < 455
    ) {
        return 0.15;
    }


    const left =
        landmarks[234];

    const right =
        landmarks[454];


    if (
        !left ||
        !right
    ) {
        return 0.15;
    }


    const dx =
        right.x -
        left.x;


    const dy =
        right.y -
        left.y;


    return Math.max(
        Math.sqrt(
            dx * dx +
            dy * dy
        ),
        0.03
    );
}


/* =====================================================
   FACE ROTATION
===================================================== */

function getTrackedFaceRotation(
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


    const left =
        landmarks[234];

    const right =
        landmarks[454];

    const forehead =
        landmarks[10];

    const chin =
        landmarks[152];

    const nose =
        landmarks[1];


    if (
        !left ||
        !right ||
        !forehead ||
        !chin ||
        !nose
    ) {

        return {

            x: 0,

            y: 0,

            z: 0
        };
    }


    /*
       Head roll.
    */

    const roll =
        Math.atan2(
            right.y -
            left.y,

            right.x -
            left.x
        );


    /*
       Head yaw.
    */

    const faceCenter =
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
            faceCenter
        ) /
        faceWidth *
        2.0;


    /*
       Head pitch.
    */

    const faceHeight =
        Math.max(
            Math.abs(
                chin.y -
                forehead.y
            ),
            0.001
        );


    const noseHeight =
        (
            nose.y -
            forehead.y
        ) /
        faceHeight;


    const pitch =
        (
            noseHeight -
            0.5
        ) * 1.8;


    return {

        x: pitch,

        y: yaw,

        z: -roll
    };
}


/* =====================================================
   PROCESS ONE VIDEO FRAME
===================================================== */

function processFaceFrame() {

    if (
        !faceLandmarker ||
        !video ||
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
            faceLandmarker
                .detectForVideo(
                    video,
                    performance.now()
                );


        if (
            !result ||
            !result.faceLandmarks
        ) {

            trackedFaces =
                [];

            window.azizTrackedFaces =
                trackedFaces;

            clearLandmarks();

            return;
        }


        trackedFaces =
            result.faceLandmarks
                .slice(
                    0,
                    MAX_PERSONS
                );


        /*
           Public data for P3/P4.
        */

        window.azizTrackedFaces =
            trackedFaces;


        window.azizFaceResult =
            result;


        /*
           Face count.
        */

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


        drawAllLandmarks();


    } catch (error) {

        console.error(
            "Face frame error:",
            error
        );
    }
}


/* =====================================================
   GLOBAL TRACKING DATA
===================================================== */

window.azizTracking = {

    get faces() {
        return trackedFaces;
    },

    get count() {
        return trackedFaces.length;
    },

    get ready() {
        return faceTrackingReady;
    },

    get faceLandmarker() {
        return faceLandmarker;
    },

    getFaceCenter:
        getTrackedFaceCenter,

    getFaceSize:
        getTrackedFaceSize,

    getFaceRotation:
        getTrackedFaceRotation
};


/* =====================================================
   P2 READY
===================================================== */

console.log(
    "AZEEZ AI AR NEW P2 READY"
);

console.log(
    "Maximum tracked people:",
    MAX_PERSONS
);/* =====================================================
   AZEEZ AI AR — NEW BUILD
   P3: 4 PERSON / ANY FORMAT MODEL LOADER
===================================================== */

import { GLTFLoader } from
    "three/addons/loaders/GLTFLoader.js";

import { OBJLoader } from
    "three/addons/loaders/OBJLoader.js";

import { FBXLoader } from
    "three/addons/loaders/FBXLoader.js";


/* =====================================================
   MODEL DATA
===================================================== */

const personModelData = [];

for (let i = 0; i < 4; i++) {

    personModelData.push({

        model: null,

        fileName: "",

        format: "",

        loaded: false,

        root: null
    });
}


/* =====================================================
   PERSON ROOTS
===================================================== */

const personModelRoots = [];

for (let i = 0; i < 4; i++) {

    const root =
        new THREE.Group();

    root.name =
        "PERSON_" +
        (i + 1) +
        "_MODEL";

    root.visible = false;

    arRoot.add(root);

    personModelRoots.push(root);

    personModelData[i].root =
        root;
}


/* =====================================================
   LOADERS
===================================================== */

const gltfLoader =
    new GLTFLoader();

const objLoader =
    new OBJLoader();

const fbxLoader =
    new FBXLoader();


/* =====================================================
   HTML ELEMENTS
===================================================== */

const personFileInputs = [

    document.getElementById(
        "person1Model"
    ),

    document.getElementById(
        "person2Model"
    ),

    document.getElementById(
        "person3Model"
    ),

    document.getElementById(
        "person4Model"
    )
];


const personClearButtons = [

    document.getElementById(
        "person1Clear"
    ),

    document.getElementById(
        "person2Clear"
    ),

    document.getElementById(
        "person3Clear"
    ),

    document.getElementById(
        "person4Clear"
    )
];


const personStatusElements = [

    document.getElementById(
        "person1Status"
    ),

    document.getElementById(
        "person2Status"
    ),

    document.getElementById(
        "person3Status"
    ),

    document.getElementById(
        "person4Status"
    )
];


/* =====================================================
   STATUS
===================================================== */

function setPersonStatus(
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


/* =====================================================
   FILE EXTENSION
===================================================== */

function getModelExtension(
    file
) {

    if (!file) {
        return "";
    }


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


/* =====================================================
   REMOVE OLD MODEL
===================================================== */

function disposeMaterial(
    material
) {

    if (!material) {
        return;
    }


    const textures = [

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


    for (
        const name
        of textures
    ) {

        const texture =
            material[name];


        if (
            texture &&
            texture.dispose
        ) {

            texture.dispose();
        }
    }


    if (material.dispose) {
        material.dispose();
    }
}


function disposeObject(
    object
) {

    if (!object) {
        return;
    }


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


/* =====================================================
   CLEAR ONE PERSON
===================================================== */

function clearPersonModel(
    personIndex
) {

    const root =
        personModelRoots[
            personIndex
        ];


    if (!root) {
        return;
    }


    while (
        root.children.length > 0
    ) {

        const child =
            root.children[0];


        root.remove(
            child
        );


        disposeObject(
            child
        );
    }


    personModelData[
        personIndex
    ].model = null;


    personModelData[
        personIndex
    ].fileName = "";


    personModelData[
        personIndex
    ].format = "";


    personModelData[
        personIndex
    ].loaded = false;


    root.visible = false;


    setPersonStatus(
        personIndex,
        "No filter selected"
    );


    console.log(
        "Person " +
        (personIndex + 1) +
        " cleared"
    );
}


/* =====================================================
   PREPARE MODEL
===================================================== */

function prepareImportedModel(
    model
) {

    if (!model) {
        return;
    }


    model.traverse(
        child => {

            if (
                child.isMesh
            ) {

                child.frustumCulled =
                    false;


                if (
                    child.material
                ) {

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

                        child.material
                            .needsUpdate =
                            true;
                    }
                }
            }
        }
    );


    /*
       Neutral starting transform.
       P4 will control this model.
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
}


/* =====================================================
   LOAD GLB / GLTF
===================================================== */

function loadGLTFFile(
    file
) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(
                    file
                );


            gltfLoader.load(

                url,

                result => {

                    URL.revokeObjectURL(
                        url
                    );


                    if (
                        result &&
                        result.scene
                    ) {

                        resolve(
                            result.scene
                        );

                    } else {

                        reject(
                            new Error(
                                "GLTF scene missing"
                            )
                        );
                    }
                },


                undefined,


                error => {

                    URL.revokeObjectURL(
                        url
                    );


                    reject(
                        error
                    );
                }
            );
        }
    );
}


/* =====================================================
   LOAD OBJ
===================================================== */

function loadOBJFile(
    file
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


                    reject(
                        error
                    );
                }
            );
        }
    );
}


/* =====================================================
   LOAD FBX
===================================================== */

function loadFBXFile(
    file
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


                    reject(
                        error
                    );
                }
            );
        }
    );
}


/* =====================================================
   LOAD MODEL FOR PERSON
===================================================== */

async function importPersonModel(
    personIndex,
    file
) {

    if (!file) {
        return;
    }


    const extension =
        getModelExtension(
            file
        );


    const supported =
        [
            "glb",
            "gltf",
            "obj",
            "fbx"
        ];


    if (
        !supported.includes(
            extension
        )
    ) {

        setPersonStatus(
            personIndex,
            "Unsupported format"
        );

        return;
    }


    /*
       Clear previous model first.
    */

    clearPersonModel(
        personIndex
    );


    setPersonStatus(
        personIndex,
        "Loading..."
    );


    try {

        let model = null;


        /* ---------------------------------------------
           GLB / GLTF
        --------------------------------------------- */

        if (
            extension === "glb" ||
            extension === "gltf"
        ) {

            model =
                await loadGLTFFile(
                    file
                );
        }


        /* ---------------------------------------------
           OBJ
        --------------------------------------------- */

        else if (
            extension === "obj"
        ) {

            model =
                await loadOBJFile(
                    file
                );
        }


        /* ---------------------------------------------
           FBX
        --------------------------------------------- */

        else if (
            extension === "fbx"
        ) {

            model =
                await loadFBXFile(
                    file
                );
        }


        if (!model) {

            throw new Error(
                "Model is empty"
            );
        }


        prepareImportedModel(
            model
        );


        const root =
            personModelRoots[
                personIndex
            ];


        root.add(
            model
        );


        root.visible =
            false;


        personModelData[
            personIndex
        ].model =
            model;


        personModelData[
            personIndex
        ].fileName =
            file.name;


        personModelData[
            personIndex
        ].format =
            extension.toUpperCase();


        personModelData[
            personIndex
        ].loaded =
            true;


        setPersonStatus(
            personIndex,

            "Loaded: " +
            file.name
        );


        console.log(
            "MODEL LOADED",
            "Person:",
            personIndex + 1,
            "Format:",
            extension.toUpperCase(),
            "File:",
            file.name
        );


    } catch (error) {

        console.error(
            "MODEL LOAD ERROR:",
            error
        );


        clearPersonModel(
            personIndex
        );


        setPersonStatus(
            personIndex,

            "Load failed"
        );
    }
}


/* =====================================================
   FILE INPUT EVENTS
===================================================== */

personFileInputs.forEach(
    (
        input,
        personIndex
    ) => {

        if (!input) {
            return;
        }


        input.addEventListener(
            "change",
            async event => {

                const file =
                    event.target.files &&
                    event.target.files[0];


                if (!file) {
                    return;
                }


                await importPersonModel(
                    personIndex,
                    file
                );


                /*
                   Allows selecting the
                   same file again.
                */

                event.target.value =
                    "";
            }
        );
    }
);


/* =====================================================
   CLEAR BUTTON EVENTS
===================================================== */

personClearButtons.forEach(
    (
        button,
        personIndex
    ) => {

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            () => {

                clearPersonModel(
                    personIndex
                );
            }
        );
    }
);


/* =====================================================
   PUBLIC MODEL DATA
===================================================== */

window.azizPersonModels =
    personModelData;


window.azizPersonRoots =
    personModelRoots;


window.azizImportPersonModel =
    importPersonModel;


window.azizClearPersonModel =
    clearPersonModel;


/* =====================================================
   P3 READY
===================================================== */

console.log(
    "AZEEZ AI AR NEW P3 READY"
);

console.log(
    "Person 1-4 model slots ready"
);

console.log(
    "Supported:",
    "GLB / GLTF / OBJ / FBX"
);/* =====================================================
   AZEEZ AI AR — NEW BUILD
   P4: 4-PERSON MODEL ATTACHMENT + FULL CONTROLS
===================================================== */


/* =====================================================
   EXTRA MODEL CONTROLS
===================================================== */

const modelControlState = {

    x: 0,
    y: 0,
    z: 0,

    size: 1,

    width: 1,
    height: 1,

    rotX: 0,
    rotY: 0,
    rotZ: 0,

    headFit: true
};


/* =====================================================
   MODEL CONTROL ELEMENTS
===================================================== */

const modelControlInputs = {

    x:
        document.getElementById("posX"),

    y:
        document.getElementById("posY"),

    z:
        document.getElementById("posZ"),

    size:
        document.getElementById("scale"),

    width:
        document.getElementById("modelWidth"),

    height:
        document.getElementById("modelHeight"),

    rotX:
        document.getElementById("rotX"),

    rotY:
        document.getElementById("rotY"),

    rotZ:
        document.getElementById("rotZ")
};


/* =====================================================
   READ CONTROL VALUE
===================================================== */

function readControlValue(
    element,
    fallback
) {

    if (!element) {
        return fallback;
    }


    const value =
        parseFloat(
            element.value
        );


    if (
        !Number.isFinite(value)
    ) {

        return fallback;
    }


    return value;
}


/* =====================================================
   UPDATE MODEL CONTROL STATE
===================================================== */

function updateFullModelControls() {

    modelControlState.x =
        readControlValue(
            modelControlInputs.x,
            0
        );


    modelControlState.y =
        readControlValue(
            modelControlInputs.y,
            0
        );


    modelControlState.z =
        readControlValue(
            modelControlInputs.z,
            0
        );


    modelControlState.size =
        readControlValue(
            modelControlInputs.size,
            1
        );


    modelControlState.width =
        readControlValue(
            modelControlInputs.width,
            1
        );


    modelControlState.height =
        readControlValue(
            modelControlInputs.height,
            1
        );


    modelControlState.rotX =
        THREE.MathUtils.degToRad(
            readControlValue(
                modelControlInputs.rotX,
                0
            )
        );


    modelControlState.rotY =
        THREE.MathUtils.degToRad(
            readControlValue(
                modelControlInputs.rotY,
                0
            )
        );


    modelControlState.rotZ =
        THREE.MathUtils.degToRad(
            readControlValue(
                modelControlInputs.rotZ,
                0
            )
        );
}


/* =====================================================
   SLIDER OUTPUT
===================================================== */

function updateControlOutput(
    inputId,
    outputId,
    suffix = ""
) {

    const input =
        document.getElementById(
            inputId
        );


    const output =
        document.getElementById(
            outputId
        );


    if (
        !input ||
        !output
    ) {
        return;
    }


    output.textContent =
        input.value +
        suffix;
}


/* =====================================================
   UPDATE ALL OUTPUTS
===================================================== */

function updateAllControlOutputs() {

    updateControlOutput(
        "posX",
        "posXValue"
    );


    updateControlOutput(
        "posY",
        "posYValue"
    );


    updateControlOutput(
        "posZ",
        "posZValue"
    );


    updateControlOutput(
        "scale",
        "scaleValue"
    );


    updateControlOutput(
        "modelWidth",
        "modelWidthValue"
    );


    updateControlOutput(
        "modelHeight",
        "modelHeightValue"
    );


    updateControlOutput(
        "rotX",
        "rotXValue",
        "°"
    );


    updateControlOutput(
        "rotY",
        "rotYValue",
        "°"
    );


    updateControlOutput(
        "rotZ",
        "rotZValue",
        "°"
    );
}


/* =====================================================
   CONNECT EXISTING SLIDERS
===================================================== */

Object.values(
    modelControlInputs
).forEach(
    input => {

        if (!input) {
            return;
        }


        input.addEventListener(
            "input",
            () => {

                updateFullModelControls();

                updateAllControlOutputs();
            }
        );
    }
);


updateFullModelControls();

updateAllControlOutputs();


/* =====================================================
   HEAD FIT BUTTON
===================================================== */

const fullHeadFitButton =
    document.getElementById(
        "headFitBtn"
    );


if (fullHeadFitButton) {

    fullHeadFitButton.addEventListener(
        "click",
        () => {

            modelControlState.headFit =
                !modelControlState.headFit;


            fullHeadFitButton.textContent =
                modelControlState.headFit
                    ? "HEAD FIT: ON"
                    : "HEAD FIT: OFF";
        }
    );
}


/* =====================================================
   FACE CENTER
===================================================== */

function getModelFaceCenter(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length === 0
    ) {
        return null;
    }


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


/* =====================================================
   FACE SIZE
===================================================== */

function getModelFaceSize(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length < 455
    ) {

        return 0.15;
    }


    const left =
        landmarks[234];

    const right =
        landmarks[454];


    if (
        !left ||
        !right
    ) {

        return 0.15;
    }


    const dx =
        right.x -
        left.x;


    const dy =
        right.y -
        left.y;


    return Math.max(
        Math.sqrt(
            dx * dx +
            dy * dy
        ),
        0.03
    );
}


/* =====================================================
   FACE ROTATION
===================================================== */

function getModelFaceRotation(
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


    const left =
        landmarks[234];

    const right =
        landmarks[454];

    const forehead =
        landmarks[10];

    const chin =
        landmarks[152];

    const nose =
        landmarks[1];


    if (
        !left ||
        !right ||
        !forehead ||
        !chin ||
        !nose
    ) {

        return {

            x: 0,
            y: 0,
            z: 0
        };
    }


    /*
       LEFT / RIGHT head rotation
    */

    const faceCenterX =
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
            faceCenterX
        ) /
        faceWidth *
        2.2;


    /*
       HEAD TILT
    */

    const roll =
        Math.atan2(
            right.y -
            left.y,

            right.x -
            left.x
        );


    /*
       UP / DOWN head rotation
    */

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


    const pitch =
        (
            noseVertical -
            0.5
        ) * 1.8;


    return {

        x: pitch,

        y: yaw,

        z: -roll
    };
}


/* =====================================================
   FACE → THREE WORLD
===================================================== */

function faceToModelWorld(
    landmarks
) {

    const center =
        getModelFaceCenter(
            landmarks
        );


    if (!center) {
        return null;
    }


    /*
       Convert normalized MediaPipe
       coordinates to Three.js space.
    */

    const worldX =
        (
            center.x -
            0.5
        ) * 5;


    const worldY =
        (
            0.5 -
            center.y
        ) * 5;


    /*
       Keep face depth stable.
       The manual Z slider controls
       front/back placement.
    */

    const worldZ =
        -center.z * 2.5;


    return {

        x: worldX,

        y: worldY,

        z: worldZ
    };
}


/* =====================================================
   AUTO HEAD SCALE
===================================================== */

function calculateHeadScale(
    landmarks
) {

    const faceSize =
        getModelFaceSize(
            landmarks
        );


    /*
       Base automatic head size.
    */

    let scale =
        faceSize * 7.5;


    scale =
        THREE.MathUtils.clamp(
            scale,
            0.10,
            10
        );


    return scale;
}


/* =====================================================
   APPLY MODEL TO ONE PERSON
===================================================== */

function attachModelToPerson(
    personIndex,
    landmarks
) {

    const roots =
        window.azizPersonRoots ||
        window.azizPersonModels;


    const models =
        window.azizPersonModels;


    /*
       P3 stores roots inside
       azizPersonModels and also
       creates public roots.
    */

    const root =
        window.azizPersonRoots
            ? window.azizPersonRoots[
                personIndex
            ]
            : models?.[
                personIndex
            ]?.root;


    const modelData =
        models?.[
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


    const world =
        faceToModelWorld(
            landmarks
        );


    if (!world) {

        root.visible = false;

        return;
    }


    const faceRotation =
        getModelFaceRotation(
            landmarks
        );


    /*
       Automatic size follows the
       person's face.
    */

    let automaticScale =
        calculateHeadScale(
            landmarks
        );


    if (
        !modelControlState.headFit
    ) {

        automaticScale = 1;
    }


    /*
       Main SIZE slider.
    */

    const finalSize =
        automaticScale *
        modelControlState.size;


    /*
       Width and Height are independent.
    */

    const finalXScale =
        finalSize *
        modelControlState.width;


    const finalYScale =
        finalSize *
        modelControlState.height;


    const finalZScale =
        finalSize;


    /* -----------------------------------------------
       POSITION
    ------------------------------------------------ */

    root.position.set(

        world.x +
        modelControlState.x,

        world.y +
        modelControlState.y,

        world.z +
        modelControlState.z
    );


    /* -----------------------------------------------
       ROTATION
    ------------------------------------------------ */

    root.rotation.set(

        faceRotation.x +
        modelControlState.rotX,

        faceRotation.y +
        modelControlState.rotY,

        faceRotation.z +
        modelControlState.rotZ
    );


    /* -----------------------------------------------
       SCALE
    ------------------------------------------------ */

    root.scale.set(

        finalXScale,

        finalYScale,

        finalZScale
    );


    root.visible = true;
}


/* =====================================================
   HIDE UNUSED PERSON MODELS
===================================================== */

function hideUnusedPersonModels(
    activeCount
) {

    const roots =
        window.azizPersonRoots;


    if (!roots) {
        return;
    }


    for (
        let i = activeCount;
        i < 4;
        i++
    ) {

        if (roots[i]) {

            roots[i].visible =
                false;
        }
    }
}


/* =====================================================
   UPDATE ALL FOUR MODELS
===================================================== */

function updateFourPersonModels() {

    const faces =
        window.azizTrackedFaces ||
        [];


    const models =
        window.azizPersonModels ||
        [];


    hideUnusedPersonModels(
        faces.length
    );


    /*
       Person 1 → model slot 1
       Person 2 → model slot 2
       Person 3 → model slot 3
       Person 4 → model slot 4
    */

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const face =
            faces[i];


        const model =
            models[i];


        if (
            !face ||
            !model ||
            !model.model
        ) {

            if (
                window.azizPersonRoots &&
                window.azizPersonRoots[i]
            ) {

                window.azizPersonRoots[
                    i
                ].visible = false;
            }

            continue;
        }


        attachModelToPerson(
            i,
            face
        );
    }
}


/* =====================================================
   MODEL UPDATE LOOP
===================================================== */

function modelAttachmentLoop() {

    requestAnimationFrame(
        modelAttachmentLoop
    );


    updateFourPersonModels();
}


modelAttachmentLoop();


/* =====================================================
   RESET MODEL CONTROLS
===================================================== */

function resetFullModelControls() {

    const defaults = {

        posX: 0,

        posY: 0,

        posZ: 0,

        scale: 1,

        modelWidth: 1,

        modelHeight: 1,

        rotX: 0,

        rotY: 0,

        rotZ: 0
    };


    Object.entries(
        defaults
    ).forEach(
        ([id, value]) => {

            const input =
                document.getElementById(
                    id
                );


            if (input) {
                input.value =
                    value;
            }
        }
    );


    modelControlState.headFit =
        true;


    if (fullHeadFitButton) {

        fullHeadFitButton.textContent =
            "HEAD FIT: ON";
    }


    updateFullModelControls();

    updateAllControlOutputs();
}


/* =====================================================
   RESET BUTTON
===================================================== */

if (resetBtn) {

    resetBtn.addEventListener(
        "click",
        () => {

            resetFullModelControls();


            setStatus(
                cameraRunning
                    ? "Camera Working"
                    : "Camera Off"
            );
        }
    );
}


/* =====================================================
   PUBLIC MODEL CONTROL API
===================================================== */

window.azizModelControls =
    modelControlState;


window.azizUpdateModels =
    updateFourPersonModels;


window.azizResetModelControls =
    resetFullModelControls;


/* =====================================================
   P4 READY
===================================================== */

console.log(
    "AZEEZ AI AR NEW P4 READY"
);

console.log(
    "4-person model attachment active"
);

console.log(
    "Size / Width / Height / X / Y / Z / Rotation ready"
);
