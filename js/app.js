import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

import {
    FilesetResolver,
    FaceLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";


const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const landmarkCanvas =
    document.getElementById("faceLandmarkCanvas");

const statusBox =
    document.getElementById("status");


const openCameraButton =
    document.getElementById("openCameraButton");

const frontCameraButton =
    document.getElementById("frontCameraButton");

const backCameraButton =
    document.getElementById("backCameraButton");

const flipCameraButton =
    document.getElementById("flipCameraButton");

const startTrackingButton =
    document.getElementById("startTrackingButton");

const stopTrackingButton =
    document.getElementById("stopTrackingButton");

const greenDotsButton =
    document.getElementById("greenDotsButton");

const faceMeshButton =
    document.getElementById("faceMeshButton");

const recordButton =
    document.getElementById("recordButton");

const captureButton =
    document.getElementById("captureButton");


const modelFileInput =
    document.getElementById("modelFileInput");

const exportButton =
    document.getElementById("exportButton");

const resetControlsButton =
    document.getElementById("resetControlsButton");

const hideAllButton =
    document.getElementById("hideAllButton");

const showAllButton =
    document.getElementById("showAllButton");

const controlPanel =
    document.getElementById("controlPanel");

const showControlsButton =
    document.getElementById("showControlsButton");


const scaleSlider =
    document.getElementById("scaleSlider");

const xSlider =
    document.getElementById("xSlider");

const ySlider =
    document.getElementById("ySlider");

const zSlider =
    document.getElementById("zSlider");

const rotateXSlider =
    document.getElementById("rotateXSlider");

const rotateYSlider =
    document.getElementById("rotateYSlider");

const rotateZSlider =
    document.getElementById("rotateZSlider");


const headXSlider =
    document.getElementById("headXSlider");

const headYSlider =
    document.getElementById("headYSlider");

const headZSlider =
    document.getElementById("headZSlider");

const headDepthSlider =
    document.getElementById("headDepthSlider");

const headPitchSlider =
    document.getElementById("headPitchSlider");

const headYawSlider =
    document.getElementById("headYawSlider");

const headRollSlider =
    document.getElementById("headRollSlider");


const scaleValue =
    document.getElementById("scaleValue");

const xValue =
    document.getElementById("xValue");

const yValue =
    document.getElementById("yValue");

const zValue =
    document.getElementById("zValue");

const rotateXValue =
    document.getElementById("rotateXValue");

const rotateYValue =
    document.getElementById("rotateYValue");

const rotateZValue =
    document.getElementById("rotateZValue");


const headXValue =
    document.getElementById("headXValue");

const headYValue =
    document.getElementById("headYValue");

const headZValue =
    document.getElementById("headZValue");

const headDepthValue =
    document.getElementById("headDepthValue");

const headPitchValue =
    document.getElementById("headPitchValue");

const headYawValue =
    document.getElementById("headYawValue");

const headRollValue =
    document.getElementById("headRollValue");


let cameraStream = null;
let cameraFacing = "user";
let cameraFlipped = false;

let trackingRunning = false;
let greenDotsEnabled = false;
let faceMeshEnabled = false;

let faceLandmarker = null;
let faceLandmarkerReady = false;

let lastVideoTime = -1;

let mediaRecorder = null;
let recordedChunks = [];
let recording = false;

let modelRoot = null;
let modelSource = null;

let scene = null;
let threeCamera = null;
let renderer = null;

let occluder = null;
let faceMeshObject = null;

let compositeCanvas = null;
let compositeContext = null;

let smoothHeadPosition =
    new THREE.Vector3();

let smoothHeadQuaternion =
    new THREE.Quaternion();

let hasHeadPosition = false;
let hasHeadRotation = false;

let renderAnimationId = null;
let trackingAnimationId = null;


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


function setStatus(message) {

    if (statusBox) {
        statusBox.textContent = message;
    }
}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function degreesToRadians(value) {

    return value * Math.PI / 180;
}


function radiansToDegrees(value) {

    return value * 180 / Math.PI;
}


function updateSliderText() {

    scaleValue.textContent =
        Number(scaleSlider.value).toFixed(2);

    xValue.textContent =
        Number(xSlider.value).toFixed(2);

    yValue.textContent =
        Number(ySlider.value).toFixed(2);

    zValue.textContent =
        Number(zSlider.value).toFixed(2);

    rotateXValue.textContent =
        Number(rotateXSlider.value).toFixed(0) + "°";

    rotateYValue.textContent =
        Number(rotateYSlider.value).toFixed(0) + "°";

    rotateZValue.textContent =
        Number(rotateZSlider.value).toFixed(0) + "°";


    headXValue.textContent =
        Number(headXSlider.value).toFixed(2);

    headYValue.textContent =
        Number(headYSlider.value).toFixed(2);

    headZValue.textContent =
        Number(headZSlider.value).toFixed(2);

    headDepthValue.textContent =
        Number(headDepthSlider.value).toFixed(2);

    headPitchValue.textContent =
        Number(headPitchSlider.value).toFixed(0) + "°";

    headYawValue.textContent =
        Number(headYawSlider.value).toFixed(0) + "°";

    headRollValue.textContent =
        Number(headRollSlider.value).toFixed(0) + "°";
}


function applyCameraFlip() {

    const transform =
        cameraFlipped
            ? "scaleX(-1)"
            : "scaleX(1)";

    video.style.transform = transform;

    canvas.style.transform = transform;

    landmarkCanvas.style.transform = transform;
}


function hideGreenOverlay() {

    landmarkCanvas.style.display = "none";
}


function showGreenOverlay() {

    if (
        trackingRunning &&
        greenDotsEnabled
    ) {
        landmarkCanvas.style.display = "block";
    } else {
        landmarkCanvas.style.display = "none";
    }
}


function clearLandmarkCanvas() {

    const context =
        landmarkCanvas.getContext("2d");

    context.clearRect(
        0,
        0,
        landmarkCanvas.width,
        landmarkCanvas.height
    );
}


function resizeCanvases() {

    const width =
        video.videoWidth ||
        window.innerWidth;

    const height =
        video.videoHeight ||
        window.innerHeight;


    if (
        landmarkCanvas.width !== width ||
        landmarkCanvas.height !== height
    ) {

        landmarkCanvas.width = width;
        landmarkCanvas.height = height;
    }


    if (compositeCanvas) {

        if (
            compositeCanvas.width !== width ||
            compositeCanvas.height !== height
        ) {

            compositeCanvas.width = width;
            compositeCanvas.height = height;
        }
    }
}


function createThreeScene() {

    scene = new THREE.Scene();


    threeCamera =
        new THREE.PerspectiveCamera(
            45,
            window.innerWidth /
            window.innerHeight,
            0.01,
            100
        );


    threeCamera.position.set(
        0,
        0,
        8
    );


    renderer =
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
        window.innerHeight,
        false
    );


    renderer.outputColorSpace =
        THREE.SRGBColorSpace;


    renderer.setClearColor(
        0x000000,
        0
    );


    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            1.6
        );

    scene.add(ambientLight);


    const mainLight =
        new THREE.DirectionalLight(
            0xffffff,
            2.2
        );

    mainLight.position.set(
        2,
        4,
        6
    );

    scene.add(mainLight);


    const fillLight =
        new THREE.DirectionalLight(
            0xffffff,
            1.1
        );

    fillLight.position.set(
        -3,
        1,
        4
    );

    scene.add(fillLight);


    createOccluder();

    createCompositeCanvas();


    window.addEventListener(
        "resize",
        resizeRenderer
    );


    renderLoop();
}


function resizeRenderer() {

    if (
        !renderer ||
        !threeCamera
    ) {
        return;
    }


    const width =
        window.innerWidth;

    const height =
        window.innerHeight;


    threeCamera.aspect =
        width / height;

    threeCamera.updateProjectionMatrix();


    renderer.setSize(
        width,
        height,
        false
    );


    resizeCanvases();
}


function createCompositeCanvas() {

    compositeCanvas =
        document.createElement("canvas");


    compositeCanvas.width =
        video.videoWidth ||
        window.innerWidth;

    compositeCanvas.height =
        video.videoHeight ||
        window.innerHeight;


    compositeContext =
        compositeCanvas.getContext(
            "2d",
            {
                alpha: false
            }
        );
}


function createOccluder() {

    const geometry =
        new THREE.SphereGeometry(
            1,
            32,
            24
        );


    const material =
        new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: true,
            depthTest: true,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });


    occluder =
        new THREE.Mesh(
            geometry,
            material
        );


    occluder.visible = false;

    occluder.renderOrder = 0;

    scene.add(occluder);
}


function renderLoop() {

    renderAnimationId =
        requestAnimationFrame(
            renderLoop
        );


    if (
        !renderer ||
        !scene ||
        !threeCamera
    ) {
        return;
    }


    renderer.render(
        scene,
        threeCamera
    );


    if (recording) {
        drawRecordingFrame();
    }
}


function drawRecordingFrame() {

    if (
        !compositeCanvas ||
        !compositeContext
    ) {
        return;
    }


    resizeCanvases();


    const width =
        compositeCanvas.width;

    const height =
        compositeCanvas.height;


    compositeContext.clearRect(
        0,
        0,
        width,
        height
    );


    compositeContext.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    compositeContext.drawImage(
        canvas,
        0,
        0,
        width,
        height
    );


    if (
        trackingRunning &&
        greenDotsEnabled
    ) {

        compositeContext.drawImage(
            landmarkCanvas,
            0,
            0,
            width,
            height
        );
    }
}


async function createFaceLandmarker() {

    if (faceLandmarkerReady) {
        return true;
    }


    setStatus(
        "Loading face tracking model..."
    );


    try {

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
            );


        faceLandmarker =
            await FaceLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                        delegate: "GPU"
                    },

                    runningMode: "VIDEO",

                    numFaces: 1,

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


        faceLandmarkerReady = true;


        setStatus(
            "Face tracking model ready."
        );


        return true;

    } catch (error) {

        console.error(
            "FACE MODEL ERROR:",
            error
        );


        faceLandmarkerReady = false;


        setStatus(
            "FACE MODEL ERROR: " +
            error.message
        );


        return false;
    }
}


async function startCamera(
    facingMode = cameraFacing
) {

    try {

        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            cameraStream = null;
        }


        setStatus(
            "Opening camera..."
        );


        cameraFacing =
            facingMode;


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
                    }
                },

                audio: true
            });


        video.srcObject =
            cameraStream;


        await video.play();


        resizeCanvases();


        applyCameraFlip();


        setStatus(
            "Camera ready."
        );


    } catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        setStatus(
            "CAMERA ERROR: " +
            error.message
        );
    }
            }function applyModelControls() {

    if (!modelRoot) {
        return;
    }

    const scale =
        Number(scaleSlider.value);

    modelRoot.scale.set(
        scale,
        scale,
        scale
    );


    modelRoot.position.x =
        Number(xSlider.value);

    modelRoot.position.y =
        Number(ySlider.value);

    modelRoot.position.z =
        Number(zSlider.value);


    modelRoot.rotation.x =
        degreesToRadians(
            Number(rotateXSlider.value)
        );

    modelRoot.rotation.y =
        degreesToRadians(
            Number(rotateYSlider.value)
        );

    modelRoot.rotation.z =
        degreesToRadians(
            Number(rotateZSlider.value)
        );
}


function applyHeadManualControls() {

    if (!modelRoot) {
        return;
    }

    if (!trackingRunning) {

        modelRoot.position.x =
            Number(headXSlider.value) +
            Number(xSlider.value);

        modelRoot.position.y =
            Number(headYSlider.value) +
            Number(ySlider.value);

        modelRoot.position.z =
            Number(headZSlider.value) +
            Number(zSlider.value);


        modelRoot.rotation.x =
            degreesToRadians(
                Number(headPitchSlider.value) +
                Number(rotateXSlider.value)
            );

        modelRoot.rotation.y =
            degreesToRadians(
                Number(headYawSlider.value) +
                Number(rotateYSlider.value)
            );

        modelRoot.rotation.z =
            degreesToRadians(
                Number(headRollSlider.value) +
                Number(rotateZSlider.value)
            );
    }
}


function removeCurrentModel() {

    if (!modelRoot) {
        return;
    }


    modelRoot.traverse(
        object => {

            if (!object.isMesh) {
                return;
            }


            if (object.geometry) {
                object.geometry.dispose();
            }


            if (object.material) {

                if (Array.isArray(object.material)) {

                    object.material.forEach(
                        material => {
                            disposeMaterial(material);
                        }
                    );

                } else {

                    disposeMaterial(
                        object.material
                    );
                }
            }
        }
    );


    scene.remove(modelRoot);

    modelRoot = null;
    modelSource = null;
}


function disposeMaterial(material) {

    if (!material) {
        return;
    }


    const textureNames = [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "aoMap",
        "emissiveMap",
        "alphaMap",
        "bumpMap",
        "displacementMap",
        "clearcoatMap",
        "clearcoatNormalMap",
        "clearcoatRoughnessMap",
        "transmissionMap",
        "thicknessMap",
        "sheenColorMap",
        "sheenRoughnessMap"
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


function prepareModel(object) {

    if (!object) {
        return null;
    }


    object.traverse(
        child => {

            if (!child.isMesh) {
                return;
            }


            child.frustumCulled = false;

            child.renderOrder = 1;


            if (child.material) {

                if (Array.isArray(child.material)) {

                    child.material.forEach(
                        material => {
                            material.depthTest = true;
                            material.depthWrite = true;
                        }
                    );

                } else {

                    child.material.depthTest = true;
                    child.material.depthWrite = true;
                }
            }
        }
    );


    return object;
}


function addModelToScene(object, sourceName) {

    if (!object) {
        return;
    }


    removeCurrentModel();


    modelRoot =
        prepareModel(object);


    modelSource =
        sourceName || "model";


    scene.add(modelRoot);


    applyModelControls();


    setStatus(
        "3D model loaded."
    );
}


async function loadGLBFile(file) {

    return new Promise(
        (resolve, reject) => {

            const loader =
                new GLTFLoader();


            const url =
                URL.createObjectURL(file);


            loader.load(
                url,

                gltf => {

                    URL.revokeObjectURL(url);

                    resolve(
                        gltf.scene
                    );
                },

                undefined,

                error => {

                    URL.revokeObjectURL(url);

                    reject(error);
                }
            );
        }
    );
}


async function loadGLTFFile(file) {

    return new Promise(
        (resolve, reject) => {

            const loader =
                new GLTFLoader();


            const url =
                URL.createObjectURL(file);


            loader.load(
                url,

                gltf => {

                    URL.revokeObjectURL(url);

                    resolve(
                        gltf.scene
                    );
                },

                undefined,

                error => {

                    URL.revokeObjectURL(url);

                    reject(error);
                }
            );
        }
    );
}


async function loadOBJFile(file) {

    return new Promise(
        (resolve, reject) => {

            const loader =
                new OBJLoader();


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    try {

                        const object =
                            loader.parse(
                                event.target.result
                            );

                        resolve(object);

                    } catch (error) {

                        reject(error);
                    }
                };


            reader.onerror =
                () => {
                    reject(
                        new Error(
                            "Unable to read OBJ file."
                        )
                    );
                };


            reader.readAsText(file);
        }
    );
}


async function loadSTLFile(file) {

    return new Promise(
        (resolve, reject) => {

            const loader =
                new STLLoader();


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    try {

                        const geometry =
                            loader.parse(
                                event.target.result
                            );


                        geometry.computeVertexNormals();


                        const material =
                            new THREE.MeshStandardMaterial({
                                color: 0xffffff,
                                metalness: 0.15,
                                roughness: 0.65
                            });


                        const mesh =
                            new THREE.Mesh(
                                geometry,
                                material
                            );


                        resolve(mesh);

                    } catch (error) {

                        reject(error);
                    }
                };


            reader.onerror =
                () => {
                    reject(
                        new Error(
                            "Unable to read STL file."
                        )
                    );
                };


            reader.readAsArrayBuffer(file);
        }
    );
}


async function importModelFile(file) {

    if (!file) {
        return;
    }


    const fileName =
        file.name.toLowerCase();


    try {

        setStatus(
            "Loading 3D model..."
        );


        let object = null;


        if (
            fileName.endsWith(".glb")
        ) {

            object =
                await loadGLBFile(file);

        } else if (
            fileName.endsWith(".gltf")
        ) {

            object =
                await loadGLTFFile(file);

        } else if (
            fileName.endsWith(".obj")
        ) {

            object =
                await loadOBJFile(file);

        } else if (
            fileName.endsWith(".stl")
        ) {

            object =
                await loadSTLFile(file);

        } else {

            throw new Error(
                "Unsupported 3D model format."
            );
        }


        addModelToScene(
            object,
            file.name
        );


    } catch (error) {

        console.error(
            "MODEL IMPORT ERROR:",
            error
        );


        setStatus(
            "MODEL IMPORT ERROR: " +
            error.message
        );
    }
}


function resetModelControls() {

    scaleSlider.value = "1";

    xSlider.value = "0";
    ySlider.value = "0";
    zSlider.value = "0";

    rotateXSlider.value = "0";
    rotateYSlider.value = "0";
    rotateZSlider.value = "0";


    headXSlider.value = "0";
    headYSlider.value = "0";
    headZSlider.value = "0";

    headDepthSlider.value = "1";

    headPitchSlider.value = "0";
    headYawSlider.value = "0";
    headRollSlider.value = "0";


    smoothHeadPosition.set(
        0,
        0,
        0
    );


    smoothHeadQuaternion.identity();


    hasHeadPosition = false;
    hasHeadRotation = false;


    updateSliderText();


    if (modelRoot) {
        applyModelControls();
    }


    setStatus(
        "Model controls reset."
    );
}


function hideSliderRow(rowId) {

    const row =
        document.getElementById(rowId);

    if (!row) {
        return;
    }


    row.classList.add(
        "hiddenRow"
    );
}


function showSliderRow(rowId) {

    const row =
        document.getElementById(rowId);

    if (!row) {
        return;
    }


    row.classList.remove(
        "hiddenRow"
    );
}


function hideAllSliderRows() {

    document
        .querySelectorAll(
            ".sliderRow"
        )
        .forEach(
            row => {
                row.classList.add(
                    "hiddenRow"
                );
            }
        );
}


function showAllSliderRows() {

    document
        .querySelectorAll(
            ".sliderRow"
        )
        .forEach(
            row => {
                row.classList.remove(
                    "hiddenRow"
                );
            }
        );
}


function hideAllControls() {

    controlPanel.classList.add(
        "hidden"
    );


    showControlsButton.classList.add(
        "visible"
    );


    setStatus(
        "Controls hidden."
    );
}


function showAllControls() {

    controlPanel.classList.remove(
        "hidden"
    );


    showControlsButton.classList.remove(
        "visible"
    );


    showAllSliderRows();


    setStatus(
        "Controls visible."
    );
}


function toggleGreenDots() {

    greenDotsEnabled =
        !greenDotsEnabled;


    greenDotsButton.textContent =
        greenDotsEnabled
            ? "GREEN DOTS: ON"
            : "GREEN DOTS: OFF";


    if (greenDotsEnabled) {

        greenDotsButton.classList.add(
            "greenButton"
        );

    } else {

        greenDotsButton.classList.remove(
            "greenButton"
        );
    }


    showGreenOverlay();


    if (!greenDotsEnabled) {
        clearLandmarkCanvas();
    }
}


function toggleFaceMesh() {

    faceMeshEnabled =
        !faceMeshEnabled;


    faceMeshButton.textContent =
        faceMeshEnabled
            ? "FACE MESH: ON"
            : "FACE MESH: OFF";


    if (faceMeshObject) {

        faceMeshObject.visible =
            faceMeshEnabled;
    }
}


function updateManualSliderValues() {

    updateSliderText();


    if (!trackingRunning) {
        applyHeadManualControls();
    }


    if (modelRoot) {

        if (!trackingRunning) {
            applyModelControls();
        }
    }
}


function setupSliderEvents() {

    const sliders = [

        scaleSlider,
        xSlider,
        ySlider,
        zSlider,

        rotateXSlider,
        rotateYSlider,
        rotateZSlider,

        headXSlider,
        headYSlider,
        headZSlider,
        headDepthSlider,

        headPitchSlider,
        headYawSlider,
        headRollSlider
    ];


    sliders.forEach(
        slider => {

            slider.addEventListener(
                "input",
                updateManualSliderValues
            );
        }
    );
}


function setupHideButtons() {

    document
        .querySelectorAll(
            ".hideRowButton"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const rowId =
                            button.dataset.hide;

                        hideSliderRow(
                            rowId
                        );
                    }
                );
            }
        );
}


function setupCameraButtons() {

    openCameraButton.addEventListener(
        "click",
        () => {
            startCamera(
                cameraFacing
            );
        }
    );


    frontCameraButton.addEventListener(
        "click",
        () => {
            cameraFlipped = false;
            applyCameraFlip();

            startCamera("user");
        }
    );


    backCameraButton.addEventListener(
        "click",
        () => {
            cameraFlipped = false;
            applyCameraFlip();

            startCamera("environment");
        }
    );


    flipCameraButton.addEventListener(
        "click",
        () => {

            cameraFlipped =
                !cameraFlipped;

            applyCameraFlip();
        }
    );
}


function setupModelButtons() {

    modelFileInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files &&
                event.target.files[0];

            importModelFile(file);
        }
    );


    resetControlsButton.addEventListener(
        "click",
        resetModelControls
    );
}


function setupControlButtons() {

    hideAllButton.addEventListener(
        "click",
        hideAllControls
    );


    showAllButton.addEventListener(
        "click",
        showAllControls
    );


    showControlsButton.addEventListener(
        "click",
        showAllControls
    );
}


function setupTrackingButtons() {

    startTrackingButton.addEventListener(
        "click",
        startTracking
    );


    stopTrackingButton.addEventListener(
        "click",
        stopTracking
    );


    greenDotsButton.addEventListener(
        "click",
        toggleGreenDots
    );


    faceMeshButton.addEventListener(
        "click",
        toggleFaceMesh
    );
}


function initializeApplication() {

    updateSliderText();

    createThreeScene();

    setupSliderEvents();

    setupHideButtons();

    setupCameraButtons();

    setupModelButtons();

    setupControlButtons();

    setupTrackingButtons();


    hideGreenOverlay();


    setStatus(
        "Azeez AR ready. Open camera to begin."
    );
}


initializeApplication();function getLandmarkPoint(
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


function calculateHeadData(
    landmarks
) {

    const leftSide =
        getLandmarkPoint(
            landmarks,
            234
        );

    const rightSide =
        getLandmarkPoint(
            landmarks,
            454
        );

    const top =
        getLandmarkPoint(
            landmarks,
            10
        );

    const bottom =
        getLandmarkPoint(
            landmarks,
            152
        );

    const nose =
        getLandmarkPoint(
            landmarks,
            1
        );

    const leftEye =
        getLandmarkPoint(
            landmarks,
            33
        );

    const rightEye =
        getLandmarkPoint(
            landmarks,
            263
        );


    if (
        !leftSide ||
        !rightSide ||
        !top ||
        !bottom ||
        !nose ||
        !leftEye ||
        !rightEye
    ) {
        return null;
    }


    const centerX =
        (
            leftSide.x +
            rightSide.x
        ) * 0.5;


    const centerY =
        (
            top.y +
            bottom.y
        ) * 0.5;


    const faceWidth =
        Math.max(
            0.001,
            Math.abs(
                rightSide.x -
                leftSide.x
            )
        );


    const faceHeight =
        Math.max(
            0.001,
            Math.abs(
                bottom.y -
                top.y
            )
        );


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
        Math.max(
            0.001,
            Math.abs(
                rightEye.x -
                leftEye.x
            )
        );


    const roll =
        Math.atan2(
            rightEye.y - leftEye.y,
            rightEye.x - leftEye.x
        );


    const yawRatio =
        (
            nose.x -
            eyeCenterX
        ) / eyeDistance;


    const pitchRatio =
        (
            nose.y -
            eyeCenterY
        ) / eyeDistance;


    const yaw =
        clamp(
            yawRatio * 1.15,
            -1.25,
            1.25
        );


    const pitch =
        clamp(
            pitchRatio * 0.85,
            -1.0,
            1.0
        );


    return {
        centerX,
        centerY,
        faceWidth,
        faceHeight,
        yaw,
        pitch,
        roll
    };
}


function normalizedToWorld(
    normalizedX,
    normalizedY,
    depth
) {

    if (!threeCamera) {
        return new THREE.Vector3();
    }


    const ndcX =
        normalizedX * 2 - 1;


    const ndcY =
        -(normalizedY * 2 - 1);


    const point =
        new THREE.Vector3(
            ndcX,
            ndcY,
            0.5
        );


    point.unproject(
        threeCamera
    );


    const direction =
        point
            .sub(
                threeCamera.position
            )
            .normalize();


    return threeCamera.position
        .clone()
        .add(
            direction.multiplyScalar(
                depth
            )
        );
}


function calculateHeadWorldPosition(
    headData
) {

    const cameraDistance =
        Number(
            headDepthSlider.value
        );


    const depth =
        clamp(
            cameraDistance * 3.2,
            1.5,
            12
        );


    return normalizedToWorld(
        headData.centerX,
        headData.centerY,
        depth
    );
}


function calculateHeadRotation(
    headData
) {

    const quaternion =
        new THREE.Quaternion();


    const euler =
        new THREE.Euler(
            headData.pitch,
            headData.yaw,
            headData.roll,
            "XYZ"
        );


    quaternion.setFromEuler(
        euler
    );


    return quaternion;
}


function smoothPosition(
    target
) {

    if (!hasHeadPosition) {

        smoothHeadPosition.copy(
            target
        );

        hasHeadPosition = true;

        return;
    }


    smoothHeadPosition.lerp(
        target,
        0.30
    );
}


function smoothRotation(
    target
) {

    if (!hasHeadRotation) {

        smoothHeadQuaternion.copy(
            target
        );

        hasHeadRotation = true;

        return;
    }


    smoothHeadQuaternion.slerp(
        target,
        0.28
    );
}


function updateOccluder(
    headData,
    worldPosition
) {

    if (!occluder) {
        return;
    }


    const width =
        clamp(
            headData.faceWidth * 10,
            0.75,
            3.8
        );


    const height =
        clamp(
            headData.faceHeight * 8.5,
            0.95,
            4.0
        );


    const depth =
        clamp(
            headData.faceWidth * 7,
            0.8,
            3.0
        );


    occluder.visible =
        trackingRunning;


    occluder.position.copy(
        worldPosition
    );


    occluder.scale.set(
        width,
        height,
        depth
    );


    const rotation =
        calculateHeadRotation(
            headData
        );


    occluder.quaternion.copy(
        rotation
    );


    occluder.renderOrder = 0;
}


function updateTrackedModel(
    headData
) {

    if (!modelRoot) {
        return;
    }


    const targetPosition =
        calculateHeadWorldPosition(
            headData
        );


    const targetRotation =
        calculateHeadRotation(
            headData
        );


    smoothPosition(
        targetPosition
    );


    smoothRotation(
        targetRotation
    );


    const manualX =
        Number(
            xSlider.value
        );


    const manualY =
        Number(
            ySlider.value
        );


    const manualZ =
        Number(
            zSlider.value
        );


    const headOffsetX =
        Number(
            headXSlider.value
        );


    const headOffsetY =
        Number(
            headYSlider.value
        );


    const headOffsetZ =
        Number(
            headZSlider.value
        );


    modelRoot.position.set(
        smoothHeadPosition.x +
        manualX +
        headOffsetX,

        smoothHeadPosition.y +
        manualY +
        headOffsetY,

        smoothHeadPosition.z +
        manualZ +
        headOffsetZ
    );


    const manualRotation =
        new THREE.Euler(
            degreesToRadians(
                Number(
                    rotateXSlider.value
                )
            ),

            degreesToRadians(
                Number(
                    rotateYSlider.value
                )
            ),

            degreesToRadians(
                Number(
                    rotateZSlider.value
                )
            ),

            "XYZ"
        );


    const manualQuaternion =
        new THREE.Quaternion()
            .setFromEuler(
                manualRotation
            );


    const trackingQuaternion =
        smoothHeadQuaternion.clone();


    const finalQuaternion =
        trackingQuaternion.multiply(
            manualQuaternion
        );


    const pitchAdjustment =
        degreesToRadians(
            Number(
                headPitchSlider.value
            )
        );


    const yawAdjustment =
        degreesToRadians(
            Number(
                headYawSlider.value
            )
        );


    const rollAdjustment =
        degreesToRadians(
            Number(
                headRollSlider.value
            )
        );


    const headAdjustment =
        new THREE.Quaternion()
            .setFromEuler(
                new THREE.Euler(
                    pitchAdjustment,
                    yawAdjustment,
                    rollAdjustment,
                    "XYZ"
                )
            );


    finalQuaternion.multiply(
        headAdjustment
    );


    modelRoot.quaternion.copy(
        finalQuaternion
    );


    const modelScale =
        Number(
            scaleSlider.value
        );


    modelRoot.scale.set(
        modelScale,
        modelScale,
        modelScale
    );


    modelRoot.traverse(
        object => {

            if (object.isMesh) {
                object.renderOrder = 1;
            }
        }
    );


    updateOccluder(
        headData,
        smoothHeadPosition
    );
}


function drawGreenDots(
    landmarks
) {

    if (
        !greenDotsEnabled ||
        !trackingRunning
    ) {
        clearLandmarkCanvas();
        return;
    }


    const context =
        landmarkCanvas.getContext("2d");


    const width =
        landmarkCanvas.width;


    const height =
        landmarkCanvas.height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    context.fillStyle =
        "#00ff55";


    GREEN_POINTS.forEach(
        index => {

            const point =
                landmarks[index];


            if (!point) {
                return;
            }


            const x =
                point.x * width;


            const y =
                point.y * height;


            context.beginPath();

            context.arc(
                x,
                y,
                3.5,
                0,
                Math.PI * 2
            );

            context.fill();
        }
    );


    landmarkCanvas.style.display =
        "block";
}


function createFaceMeshObject() {

    if (faceMeshObject) {
        return;
    }


    const geometry =
        new THREE.BufferGeometry();


    const material =
        new THREE.PointsMaterial({
            color: 0x00ff66,
            size: 0.025,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.85
        });


    faceMeshObject =
        new THREE.Points(
            geometry,
            material
        );


    faceMeshObject.visible =
        faceMeshEnabled;


    faceMeshObject.renderOrder =
        2;


    scene.add(
        faceMeshObject
    );
}


function updateFaceMesh(
    landmarks
) {

    if (!faceMeshObject) {
        createFaceMeshObject();
    }


    const positions =
        new Float32Array(
            landmarks.length * 3
        );


    for (
        let index = 0;
        index < landmarks.length;
        index++
    ) {

        const point =
            landmarks[index];


        const x =
            (point.x - 0.5) * 6;


        const y =
            -(point.y - 0.5) * 6;


        const z =
            -point.z * 3;


        positions[index * 3] =
            x;

        positions[index * 3 + 1] =
            y;

        positions[index * 3 + 2] =
            z;
    }


    const geometry =
        faceMeshObject.geometry;


    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );


    geometry.computeBoundingSphere();


    faceMeshObject.visible =
        faceMeshEnabled;
}


function hideFaceMesh() {

    if (faceMeshObject) {
        faceMeshObject.visible = false;
    }
}


function processFaceResult(
    result
) {

    if (
        !result ||
        !result.faceLandmarks ||
        result.faceLandmarks.length === 0
    ) {

        hasHeadPosition = false;
        hasHeadRotation = false;

        if (occluder) {
            occluder.visible = false;
        }

        if (modelRoot) {
            modelRoot.visible = true;
        }

        clearLandmarkCanvas();

        hideFaceMesh();

        setStatus(
            "Tracking: no face detected."
        );

        return;
    }


    const landmarks =
        result.faceLandmarks[0];


    const headData =
        calculateHeadData(
            landmarks
        );


    if (!headData) {
        return;
    }


    drawGreenDots(
        landmarks
    );


    if (faceMeshEnabled) {

        updateFaceMesh(
            landmarks
        );

    } else {

        hideFaceMesh();
    }


    updateTrackedModel(
        headData
    );


    if (modelRoot) {
        modelRoot.visible = true;
    }


    setStatus(
        "Face tracking active."
    );
}


async function trackingLoop() {

    if (!trackingRunning) {
        return;
    }


    if (
        !video ||
        video.readyState < 2
    ) {

        trackingAnimationId =
            requestAnimationFrame(
                trackingLoop
            );

        return;
    }


    if (!faceLandmarkerReady) {

        const ready =
            await createFaceLandmarker();


        if (!ready) {

            trackingRunning = false;

            return;
        }
    }


    if (
        video.currentTime !==
        lastVideoTime
    ) {

        lastVideoTime =
            video.currentTime;


        try {

            const result =
                faceLandmarker.detectForVideo(
                    video,
                    performance.now()
                );


            processFaceResult(
                result
            );

        } catch (error) {

            console.error(
                "FACE TRACKING ERROR:",
                error
            );


            setStatus(
                "TRACKING ERROR: " +
                error.message
            );
        }
    }


    trackingAnimationId =
        requestAnimationFrame(
            trackingLoop
        );
}


async function startTracking() {

    if (
        !cameraStream ||
        !video.srcObject
    ) {

        setStatus(
            "Open the camera first."
        );

        return;
    }


    if (trackingRunning) {
        return;
    }


    const ready =
        await createFaceLandmarker();


    if (!ready) {
        return;
    }


    createFaceMeshObject();


    trackingRunning = true;

    lastVideoTime = -1;

    hasHeadPosition = false;
    hasHeadRotation = false;


    showGreenOverlay();


    setStatus(
        "Starting face tracking..."
    );


    if (trackingAnimationId) {

        cancelAnimationFrame(
            trackingAnimationId
        );
    }


    trackingAnimationId =
        requestAnimationFrame(
            trackingLoop
        );
}


function stopTracking() {

    trackingRunning = false;


    if (trackingAnimationId) {

        cancelAnimationFrame(
            trackingAnimationId
        );

        trackingAnimationId = null;
    }


    hasHeadPosition = false;
    hasHeadRotation = false;


    clearLandmarkCanvas();


    hideGreenOverlay();


    if (occluder) {
        occluder.visible = false;
    }


    if (faceMeshObject) {
        faceMeshObject.visible = false;
    }


    setStatus(
        "Face tracking stopped."
    );
        }// ==================== PART 4 ====================

let trackingActive = false;
let trackingRAF = 0;

const trackingState = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  scale: 1
};

function smoothTracking(current, target, amount = 0.18) {
  return current + (target - current) * amount;
}

function applyHeadTracking() {
  if (!modelRoot || !trackingActive) return;

  modelRoot.position.x = smoothTracking(
    modelRoot.position.x,
    trackingState.x,
    0.20
  );

  modelRoot.position.y = smoothTracking(
    modelRoot.position.y,
    trackingState.y,
    0.20
  );

  modelRoot.position.z = smoothTracking(
    modelRoot.position.z,
    trackingState.z,
    0.20
  );

  modelRoot.rotation.x = smoothTracking(
    modelRoot.rotation.x,
    trackingState.pitch,
    0.20
  );

  modelRoot.rotation.y = smoothTracking(
    modelRoot.rotation.y,
    trackingState.yaw,
    0.20
  );

  modelRoot.rotation.z = smoothTracking(
    modelRoot.rotation.z,
    trackingState.roll,
    0.20
  );

  const s = smoothTracking(
    modelRoot.scale.x,
    trackingState.scale,
    0.20
  );

  modelRoot.scale.setScalar(s);
}

async function updateFaceTracking() {
  if (!trackingActive || !faceLandmarker || !video) return;

  if (video.readyState < 2) {
    trackingRAF = requestAnimationFrame(updateFaceTracking);
    return;
  }

  try {
    const now = performance.now();

    let result = null;

    if (
      typeof faceLandmarker.detectForVideo === "function"
    ) {
      result = faceLandmarker.detectForVideo(video, now);
    }

    if (
      result &&
      result.faceLandmarks &&
      result.faceLandmarks.length > 0
    ) {
      const points = result.faceLandmarks[0];

      const head = getHeadValues(points);

      if (head) {
        trackingState.x = head.x;
        trackingState.y = head.y;
        trackingState.z = head.z;

        trackingState.yaw = head.yaw;
        trackingState.pitch = head.pitch;
        trackingState.roll = head.roll;

        trackingState.scale = head.scale;

        applyHeadTracking();

        if (trackingStatus) {
          trackingStatus.textContent = "TRACKING";
          trackingStatus.style.color = "#00ff88";
        }
      }
    } else {
      if (trackingStatus) {
        trackingStatus.textContent = "FACE NOT FOUND";
        trackingStatus.style.color = "#ffcc00";
      }
    }
  } catch (error) {
    console.error("Face tracking error:", error);

    if (trackingStatus) {
      trackingStatus.textContent = "TRACKING ERROR";
      trackingStatus.style.color = "#ff4444";
    }
  }

  trackingRAF = requestAnimationFrame(updateFaceTracking);
}

async function startTracking() {
  if (trackingActive) return;

  if (!video || video.readyState < 2) {
    await startCamera();
  }

  try {
    if (!faceLandmarker) {
      await createFaceTracker();
    }

    trackingActive = true;

    if (trackingStatus) {
      trackingStatus.textContent = "STARTING...";
      trackingStatus.style.color = "#00ccff";
    }

    cancelAnimationFrame(trackingRAF);
    trackingRAF = requestAnimationFrame(updateFaceTracking);

    if (trackButton) {
      trackButton.textContent = "STOP TRACKING";
    }
  } catch (error) {
    console.error("Unable to start face tracking:", error);

    trackingActive = false;

    if (trackingStatus) {
      trackingStatus.textContent = "TRACKING ERROR";
      trackingStatus.style.color = "#ff4444";
    }
  }
}

function stopTracking() {
  trackingActive = false;

  cancelAnimationFrame(trackingRAF);
  trackingRAF = 0;

  if (trackButton) {
    trackButton.textContent = "START TRACKING";
  }

  if (trackingStatus) {
    trackingStatus.textContent = "TRACKING OFF";
    trackingStatus.style.color = "#ffffff";
  }
}

function toggleTracking() {
  if (trackingActive) {
    stopTracking();
  } else {
    startTracking();
  }
}

if (trackButton) {
  trackButton.addEventListener("click", toggleTracking);
}

// Keep tracking state updated with the render loop.
function trackingRenderUpdate() {
  if (trackingActive) {
    applyHeadTracking();
  }
}

// ==================== CAMERA + TRACKING SYNC ====================

if (video) {
  video.addEventListener("loadedmetadata", () => {
    if (trackingActive) {
      cancelAnimationFrame(trackingRAF);
      trackingRAF = requestAnimationFrame(updateFaceTracking);
    }
  });
}

// ==================== MODEL VISIBILITY ====================

if (visibilityButton) {
  visibilityButton.addEventListener("click", () => {
    if (!modelRoot) return;

    modelRoot.visible = !modelRoot.visible;

    visibilityButton.textContent =
      modelRoot.visible ? "HIDE MODEL" : "SHOW MODEL";
  });
}

// ==================== RESET TRACKING ====================

if (resetButton) {
  resetButton.addEventListener("click", () => {
    trackingState.x = 0;
    trackingState.y = 0;
    trackingState.z = 0;

    trackingState.yaw = 0;
    trackingState.pitch = 0;
    trackingState.roll = 0;

    trackingState.scale = 1;

    if (modelRoot) {
      modelRoot.position.set(0, 0, 0);
      modelRoot.rotation.set(0, 0, 0);
      modelRoot.scale.setScalar(1);
    }
  });
}

// ==================== FINAL TRACKING HOOK ====================

function updateTrackingFrame() {
  if (!trackingActive) return;

  applyHeadTracking();
}

// ==================== PART 4 END ====================// ==================== PART 5 ====================

let mediaRecorder = null;
let recordedChunks = [];
let recordingActive = false;

function getRecordingStream() {
  const canvasStream = renderer.domElement.captureStream(30);

  if (video && video.srcObject) {
    const audioTracks = video.srcObject.getAudioTracks();

    audioTracks.forEach(track => {
      canvasStream.addTrack(track);
    });
  }

  return canvasStream;
}

function startRecording() {
  if (recordingActive) return;

  try {
    const stream = getRecordingStream();

    recordedChunks = [];

    let options = {};

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      options.mimeType = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options.mimeType = "video/webm";
    }

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = saveRecording;

    mediaRecorder.start(1000);

    recordingActive = true;

    if (recordButton) {
      recordButton.textContent = "STOP RECORDING";
      recordButton.style.background = "#ff2222";
    }

    if (recordingStatus) {
      recordingStatus.textContent = "RECORDING";
      recordingStatus.style.color = "#ff3333";
    }

  } catch (error) {
    console.error("Recording error:", error);

    if (recordingStatus) {
      recordingStatus.textContent = "RECORDING ERROR";
    }
  }
}

function stopRecording() {
  if (!mediaRecorder || !recordingActive) return;

  try {
    mediaRecorder.stop();
  } catch (error) {
    console.error(error);
  }

  recordingActive = false;

  if (recordButton) {
    recordButton.textContent = "START RECORDING";
    recordButton.style.background = "";
  }

  if (recordingStatus) {
    recordingStatus.textContent = "READY";
    recordingStatus.style.color = "#ffffff";
  }
}

function saveRecording() {
  if (!recordedChunks.length) return;

  const blob = new Blob(
    recordedChunks,
    { type: "video/webm" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download =
    "Azeez-AR-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".webm";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);

  recordedChunks = [];
}

function toggleRecording() {
  if (recordingActive) {
    stopRecording();
  } else {
    startRecording();
  }
}

if (recordButton) {
  recordButton.addEventListener(
    "click",
    toggleRecording
  );
}

// ==================== CAMERA SWITCH ====================

async function switchCamera() {
  if (!video) return;

  try {
    const currentStream = video.srcObject;

    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    usingFrontCamera = !usingFrontCamera;

    await startCamera();

  } catch (error) {
    console.error("Camera switch error:", error);
  }
}

if (cameraSwitchButton) {
  cameraSwitchButton.addEventListener(
    "click",
    switchCamera
  );
}

// ==================== CAMERA FLIP ====================

let cameraFlipped = false;

function toggleCameraFlip() {
  cameraFlipped = !cameraFlipped;

  if (!video) return;

  if (cameraFlipped) {
    video.style.transform = "scaleX(-1)";
  } else {
    video.style.transform = "scaleX(1)";
  }
}

if (flipButton) {
  flipButton.addEventListener(
    "click",
    toggleCameraFlip
  );
}

// ==================== MODEL IMPORT ====================

function triggerModelImport() {
  if (modelInput) {
    modelInput.value = "";
    modelInput.click();
  }
}

if (importButton) {
  importButton.addEventListener(
    "click",
    triggerModelImport
  );
}

// ==================== MODEL EXPORT ====================

function exportCurrentModel() {
  if (!modelRoot) return;

  try {
    const data = {
      position: {
        x: modelRoot.position.x,
        y: modelRoot.position.y,
        z: modelRoot.position.z
      },

      rotation: {
        x: modelRoot.rotation.x,
        y: modelRoot.rotation.y,
        z: modelRoot.rotation.z
      },

      scale: {
        x: modelRoot.scale.x,
        y: modelRoot.scale.y,
        z: modelRoot.scale.z
      }
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "Azeez-AR-model-settings.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error("Model export error:", error);
  }
}

if (exportButton) {
  exportButton.addEventListener(
    "click",
    exportCurrentModel
  );
}

// ==================== ANIMATION LOOP ====================

function finalAnimationLoop() {
  requestAnimationFrame(finalAnimationLoop);

  trackingRenderUpdate();

  if (typeof controls !== "undefined" && controls) {
    controls.update();
  }

  renderer.render(scene, camera);
}

if (
  typeof renderer !== "undefined" &&
  typeof scene !== "undefined" &&
  typeof camera !== "undefined"
) {
  finalAnimationLoop();
}

// ==================== WINDOW RESIZE ====================

window.addEventListener("resize", () => {
  if (!camera || !renderer) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
});

// ==================== PAGE CLEANUP ====================

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(trackingRAF);

  if (mediaRecorder && recordingActive) {
    try {
      mediaRecorder.stop();
    } catch (error) {}
  }

  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => {
      track.stop();
    });
  }
});

// ==================== APP READY ====================

window.addEventListener("load", () => {
  if (trackingStatus) {
    trackingStatus.textContent = "READY";
    trackingStatus.style.color = "#ffffff";
  }

  console.log("AZEEZ AR APP READY");
});

// ==================== PART 5 END ====================
