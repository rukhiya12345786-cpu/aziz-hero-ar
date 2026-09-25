// ======================================================
// AZIZ HERO AR
// app.js — PART 1 / 5
// CAMERA + THREE.JS BASE
// ======================================================

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";

import { STLLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/STLLoader.js";


// ======================================================
// HTML ELEMENTS
// ======================================================

const video = document.getElementById("camera");
const canvas = document.getElementById("threeCanvas");
const statusBox = document.getElementById("status");

const cameraButton =
    document.getElementById("cameraButton");

const switchCameraButton =
    document.getElementById("switchCameraButton");

const photoButton =
    document.getElementById("photoButton");

const recordButton =
    document.getElementById("recordButton");

const audioButton =
    document.getElementById("audioButton");

const import3DButton =
    document.getElementById("import3DButton");

const import3DInput =
    document.getElementById("import3DInput");

const modelButton =
    document.getElementById("modelButton");

const export3DButton =
    document.getElementById("export3DButton");

const resetButton =
    document.getElementById("resetButton");

const sideControls =
    document.getElementById("sideControls");


// ======================================================
// CAMERA STATE
// ======================================================

let cameraFacing = "user";
let cameraStream = null;


// ======================================================
// THREE.JS STATE
// ======================================================

let scene;
let threeCamera;
let renderer;

let currentModel = null;
let defaultCube = null;


// ======================================================
// STATUS
// ======================================================

function setStatus(message) {
    if (statusBox) {
        statusBox.textContent = message;
    }
}


// ======================================================
// THREE.JS INITIALIZATION
// ======================================================

function initThree() {

    scene = new THREE.Scene();

    threeCamera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.01,
        1000
    );

    threeCamera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({
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


    // ==================================================
    // LIGHTS
    // ==================================================

    const ambientLight =
        new THREE.AmbientLight(0xffffff, 2);

    scene.add(ambientLight);


    const directionalLight =
        new THREE.DirectionalLight(0xffffff, 3);

    directionalLight.position.set(2, 4, 5);

    scene.add(directionalLight);


    // ==================================================
    // DEFAULT TEST CUBE
    // ==================================================

    const geometry =
        new THREE.BoxGeometry(1, 1, 1);

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x2196f3,
            roughness: 0.45,
            metalness: 0.1
        });

    defaultCube =
        new THREE.Mesh(
            geometry,
            material
        );

    defaultCube.position.set(0, 0, 0);

    scene.add(defaultCube);

    currentModel = defaultCube;


    setStatus("Three.js Ready");


    animate();
}


// ======================================================
// ANIMATION LOOP
// ======================================================

function animate() {

    requestAnimationFrame(animate);

    if (defaultCube && currentModel === defaultCube) {
        defaultCube.rotation.y += 0.01;
        defaultCube.rotation.x += 0.003;
    }

    if (renderer && scene && threeCamera) {
        renderer.render(
            scene,
            threeCamera
        );
    }
}


// ======================================================
// CAMERA START
// ======================================================

async function startCamera() {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            setStatus(
                "Camera API not supported"
            );

            return;
        }


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => track.stop());

            cameraStream = null;
        }


        setStatus("Opening Camera...");


        cameraStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: cameraFacing
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


        video.srcObject = cameraStream;

        video.muted = true;

        video.playsInline = true;

        await video.play();


        setStatus(
            cameraFacing === "user"
                ? "Front Camera Ready"
                : "Back Camera Ready"
        );

    } catch (error) {

        console.error(
            "Camera Error:",
            error
        );

        setStatus(
            "Camera Error: " +
            (error.name || "Unknown")
        );

        alert(
            "Camera Error: " +
            (error.name || "Unknown")
        );
    }
}


// ======================================================
// CAMERA BUTTON
// ======================================================

if (cameraButton) {

    cameraButton.addEventListener(
        "click",
        () => {
            startCamera();
        }
    );
}


// ======================================================
// FRONT / BACK CAMERA SWITCH
// ======================================================

if (switchCameraButton) {

    switchCameraButton.addEventListener(
        "click",
        async () => {

            cameraFacing =
                cameraFacing === "user"
                    ? "environment"
                    : "user";

            await startCamera();
        }
    );
}


// ======================================================
// WINDOW RESIZE
// ======================================================

function resizeThree() {

    if (!renderer || !threeCamera) {
        return;
    }

    threeCamera.aspect =
        window.innerWidth /
        window.innerHeight;

    threeCamera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}


window.addEventListener(
    "resize",
    resizeThree
);


// ======================================================
// BASIC BUTTON TEST CONNECTIONS
// ======================================================

if (photoButton) {

    photoButton.addEventListener(
        "click",
        () => {
            setStatus("Photo button ready");
        }
    );
}


if (recordButton) {

    recordButton.addEventListener(
        "click",
        () => {
            setStatus("Video recording button ready");
        }
    );
}


if (audioButton) {

    audioButton.addEventListener(
        "click",
        () => {
            setStatus("Audio recording button ready");
        }
    );
}


if (import3DButton) {

    import3DButton.addEventListener(
        "click",
        () => {

            if (import3DInput) {
                import3DInput.click();
            }
        }
    );
}


if (modelButton) {

    modelButton.addEventListener(
        "click",
        () => {
            setStatus("3D model controls ready");
        }
    );
}


if (export3DButton) {

    export3DButton.addEventListener(
        "click",
        () => {
            setStatus("3D export button ready");
        }
    );
}


if (resetButton) {

    resetButton.addEventListener(
        "click",
        () => {

            if (currentModel) {

                currentModel.position.set(
                    0,
                    0,
                    0
                );

                currentModel.rotation.set(
                    0,
                    0,
                    0
                );

                currentModel.scale.set(
                    1,
                    1,
                    1
                );
            }

            setStatus("3D Reset");
        }
    );
}


// ======================================================
// START THREE.JS
// ======================================================

initThree();

setStatus("AZIZ HERO AR READY");// ======================================================
// AZIZ HERO AR
// app.js — PART 2 / 5
// 3D MODEL CONTROLS + IMPORT
// ======================================================


// ======================================================
// MODEL CONTROL ELEMENTS
// ======================================================

const modelPanel =
    document.getElementById("modelPanel");

const posX =
    document.getElementById("posX");

const posY =
    document.getElementById("posY");

const posZ =
    document.getElementById("posZ");

const rotX =
    document.getElementById("rotX");

const rotY =
    document.getElementById("rotY");

const rotZ =
    document.getElementById("rotZ");

const scaleControl =
    document.getElementById("scale");

const zoomInButton =
    document.getElementById("zoomInButton");

const zoomOutButton =
    document.getElementById("zoomOutButton");

const hideControlsButton =
    document.getElementById("hideControlsButton");


// ======================================================
// MODEL PANEL
// ======================================================

if (modelButton && modelPanel) {

    modelButton.addEventListener(
        "click",
        () => {

            const isHidden =
                modelPanel.style.display === "none";

            modelPanel.style.display =
                isHidden ? "block" : "none";

        }
    );
}


// ======================================================
// UPDATE MODEL POSITION
// ======================================================

function updateModelPosition() {

    if (!currentModel) {
        return;
    }

    currentModel.position.x =
        Number(posX?.value || 0);

    currentModel.position.y =
        Number(posY?.value || 0);

    currentModel.position.z =
        Number(posZ?.value || 0);
}


// ======================================================
// UPDATE MODEL ROTATION
// ======================================================

function updateModelRotation() {

    if (!currentModel) {
        return;
    }

    currentModel.rotation.x =
        THREE.MathUtils.degToRad(
            Number(rotX?.value || 0)
        );

    currentModel.rotation.y =
        THREE.MathUtils.degToRad(
            Number(rotY?.value || 0)
        );

    currentModel.rotation.z =
        THREE.MathUtils.degToRad(
            Number(rotZ?.value || 0)
        );
}


// ======================================================
// UPDATE MODEL SCALE
// ======================================================

function updateModelScale() {

    if (!currentModel) {
        return;
    }

    const value =
        Number(scaleControl?.value || 1);

    currentModel.scale.set(
        value,
        value,
        value
    );
}


// ======================================================
// SLIDER EVENTS
// ======================================================

if (posX) {
    posX.addEventListener(
        "input",
        updateModelPosition
    );
}

if (posY) {
    posY.addEventListener(
        "input",
        updateModelPosition
    );
}

if (posZ) {
    posZ.addEventListener(
        "input",
        updateModelPosition
    );
}

if (rotX) {
    rotX.addEventListener(
        "input",
        updateModelRotation
    );
}

if (rotY) {
    rotY.addEventListener(
        "input",
        updateModelRotation
    );
}

if (rotZ) {
    rotZ.addEventListener(
        "input",
        updateModelRotation
    );
}

if (scaleControl) {
    scaleControl.addEventListener(
        "input",
        updateModelScale
    );
}


// ======================================================
// RESET MODEL CONTROLS
// ======================================================

function resetModelControls() {

    if (posX) posX.value = 0;
    if (posY) posY.value = 0;
    if (posZ) posZ.value = 0;

    if (rotX) rotX.value = 0;
    if (rotY) rotY.value = 0;
    if (rotZ) rotZ.value = 0;

    if (scaleControl) {
        scaleControl.value = 1;
    }

    updateModelPosition();
    updateModelRotation();
    updateModelScale();
}


// ======================================================
// 3D MODEL CLEANUP
// ======================================================

function removeCurrentModel() {

    if (!currentModel) {
        return;
    }

    if (currentModel !== defaultCube) {

        scene.remove(
            currentModel
        );

        currentModel.traverse(
            object => {

                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {

                    if (Array.isArray(object.material)) {

                        object.material.forEach(
                            material => {

                                if (material.map) {
                                    material.map.dispose();
                                }

                                material.dispose();
                            }
                        );

                    } else {

                        if (object.material.map) {
                            object.material.map.dispose();
                        }

                        object.material.dispose();
                    }
                }
            }
        );
    }

    currentModel = null;
}


// ======================================================
// PREPARE IMPORTED MODEL
// ======================================================

function prepareModel(model) {

    if (!model) {
        return;
    }

    removeCurrentModel();


    if (defaultCube) {

        scene.remove(
            defaultCube
        );

        defaultCube.geometry.dispose();

        defaultCube.material.dispose();

        defaultCube = null;
    }


    currentModel = model;


    // Center model
    const box =
        new THREE.Box3().setFromObject(
            currentModel
        );

    const center =
        box.getCenter(
            new THREE.Vector3()
        );

    currentModel.position.sub(
        center
    );


    // Fit model to reasonable size
    const size =
        box.getSize(
            new THREE.Vector3()
        );

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

        const targetSize = 2;

        const fitScale =
            targetSize / maxSize;

        currentModel.scale.set(
            fitScale,
            fitScale,
            fitScale
        );
    }


    scene.add(
        currentModel
    );


    resetModelControls();


    setStatus(
        "3D Model Loaded"
    );
}


// ======================================================
// GLTF / GLB LOADER
// ======================================================

const gltfLoader =
    new GLTFLoader();


// ======================================================
// LOAD GLB / GLTF
// ======================================================

function loadGLTFModel(file) {

    const reader =
        new FileReader();


    reader.onload = event => {

        const data =
            event.target.result;


        gltfLoader.parse(
            data,
            "",
            gltf => {

                if (
                    !gltf ||
                    !gltf.scene
                ) {

                    setStatus(
                        "Invalid GLB / GLTF"
                    );

                    return;
                }


                prepareModel(
                    gltf.scene
                );
            },

            error => {

                console.error(
                    "GLTF Error:",
                    error
                );

                setStatus(
                    "GLB / GLTF Load Error"
                );
            }
        );
    };


    reader.onerror = () => {

        setStatus(
            "Could not read 3D file"
        );
    };


    reader.readAsArrayBuffer(
        file
    );
}


// ======================================================
// LOAD OBJ
// ======================================================

function loadOBJModel(file) {

    const reader =
        new FileReader();


    reader.onload = event => {

        try {

            const loader =
                new OBJLoader();

            const object =
                loader.parse(
                    event.target.result
                );

            prepareModel(
                object
            );

        } catch (error) {

            console.error(
                "OBJ Error:",
                error
            );

            setStatus(
                "OBJ Load Error"
            );
        }
    };


    reader.onerror = () => {

        setStatus(
            "Could not read OBJ"
        );
    };


    reader.readAsText(
        file
    );
}


// ======================================================
// LOAD STL
// ======================================================

function loadSTLModel(file) {

    const reader =
        new FileReader();


    reader.onload = event => {

        try {

            const loader =
                new STLLoader();

            const geometry =
                loader.parse(
                    event.target.result
                );


            geometry.computeVertexNormals();


            const material =
                new THREE.MeshStandardMaterial({
                    color: 0xdddddd,
                    metalness: 0.1,
                    roughness: 0.5
                });


            const mesh =
                new THREE.Mesh(
                    geometry,
                    material
                );


            prepareModel(
                mesh
            );

        } catch (error) {

            console.error(
                "STL Error:",
                error
            );

            setStatus(
                "STL Load Error"
            );
        }
    };


    reader.onerror = () => {

        setStatus(
            "Could not read STL"
        );
    };


    reader.readAsArrayBuffer(
        file
    );
}


// ======================================================
// IMPORT FILE EVENT
// ======================================================

if (import3DInput) {

    import3DInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];


            if (!file) {
                return;
            }


            const name =
                file.name.toLowerCase();


            setStatus(
                "Loading " + file.name
            );


            if (
                name.endsWith(".glb") ||
                name.endsWith(".gltf")
            ) {

                loadGLTFModel(
                    file
                );

            } else if (
                name.endsWith(".obj")
            ) {

                loadOBJModel(
                    file
                );

            } else if (
                name.endsWith(".stl")
            ) {

                loadSTLModel(
                    file
                );

            } else if (
                name.endsWith(".fbx")
            ) {

                setStatus(
                    "FBX import is not enabled yet"
                );

                alert(
                    "FBX import needs an FBX loader. GLB, GLTF, OBJ and STL are supported."
                );

            } else {

                setStatus(
                    "Unsupported 3D file"
                );
            }


            // Allow selecting the same file again
            event.target.value = "";
        }
    );
}


// ======================================================
// ZOOM BUTTONS
// ======================================================

if (zoomInButton) {

    zoomInButton.addEventListener(
        "click",
        () => {

            if (!currentModel) {
                return;
            }

            currentModel.scale.multiplyScalar(
                1.15
            );

            if (scaleControl) {
                scaleControl.value =
                    currentModel.scale.x;
            }
        }
    );
}


if (zoomOutButton) {

    zoomOutButton.addEventListener(
        "click",
        () => {

            if (!currentModel) {
                return;
            }

            currentModel.scale.multiplyScalar(
                0.87
            );

            if (scaleControl) {
                scaleControl.value =
                    currentModel.scale.x;
            }
        }
    );
}


// ======================================================
// HIDE / SHOW SIDE CONTROLS
// ======================================================

if (hideControlsButton) {

    hideControlsButton.addEventListener(
        "click",
        () => {

            if (!sideControls) {
                return;
            }


            const hidden =
                sideControls.style.display === "none";


            sideControls.style.display =
                hidden ? "flex" : "none";


            hideControlsButton.textContent =
                hidden ? "◀" : "▶";
        }
    );
        }// ======================================================
// AZIZ HERO AR
// app.js — PART 3 / 5
// PHOTO + MODEL POSITION + CAMERA COMPOSITING
// ======================================================


// ======================================================
// PHOTO CAPTURE
// ======================================================

function capturePhoto() {

    if (!video || !canvas) {
        setStatus("Camera or 3D canvas not found");
        return;
    }


    if (!video.videoWidth || !video.videoHeight) {

        setStatus("Open camera first");

        alert("Please open the camera first.");

        return;
    }


    const photoCanvas =
        document.createElement("canvas");


    photoCanvas.width =
        video.videoWidth;

    photoCanvas.height =
        video.videoHeight;


    const ctx =
        photoCanvas.getContext("2d");


    if (!ctx) {
        setStatus("Photo canvas error");
        return;
    }


    // --------------------------------------------------
    // Draw camera
    // --------------------------------------------------

    ctx.drawImage(
        video,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
    );


    // --------------------------------------------------
    // Draw 3D model
    // --------------------------------------------------

    if (canvas.width > 0 && canvas.height > 0) {

        ctx.drawImage(
            canvas,
            0,
            0,
            photoCanvas.width,
            photoCanvas.height
        );
    }


    // --------------------------------------------------
    // Download photo
    // --------------------------------------------------

    photoCanvas.toBlob(
        blob => {

            if (!blob) {

                setStatus(
                    "Photo creation failed"
                );

                return;
            }


            const url =
                URL.createObjectURL(blob);


            const link =
                document.createElement("a");


            link.href = url;

            link.download =
                "aziz-hero-photo.png";


            document.body.appendChild(
                link
            );

            link.click();

            link.remove();


            setTimeout(
                () => {
                    URL.revokeObjectURL(url);
                },
                1000
            );


            setStatus(
                "Photo Saved"
            );
        },
        "image/png"
    );
}


// ======================================================
// PHOTO BUTTON
// ======================================================

if (photoButton) {

    photoButton.addEventListener(
        "click",
        capturePhoto
    );
}


// ======================================================
// MOVE MODEL TO FACE POSITION
// ======================================================

function moveModelToFace(
    x,
    y,
    z = 0
) {

    if (!currentModel) {
        return;
    }


    // Keep movement gentle
    const targetX =
        THREE.MathUtils.clamp(
            Number(x) || 0,
            -2,
            2
        );


    const targetY =
        THREE.MathUtils.clamp(
            Number(y) || 0,
            -2,
            2
        );


    const targetZ =
        THREE.MathUtils.clamp(
            Number(z) || 0,
            -3,
            3
        );


    currentModel.position.x =
        targetX;


    currentModel.position.y =
        targetY;


    currentModel.position.z =
        targetZ;
}


// ======================================================
// FACE MODEL HELPER
// ======================================================

function resetModelToCenter() {

    if (!currentModel) {
        return;
    }


    currentModel.position.set(
        0,
        0,
        0
    );


    currentModel.rotation.set(
        0,
        0,
        0
    );
}


// ======================================================
// PAGE VISIBILITY
// ======================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden &&
            cameraStream
        ) {

            cameraStream
                .getTracks()
                .forEach(
                    track => track.enabled = false
                );

        } else if (
            !document.hidden &&
            cameraStream
        ) {

            cameraStream
                .getTracks()
                .forEach(
                    track => track.enabled = true
                );
        }
    }
);


// ======================================================
// CAMERA CLEANUP
// ======================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (!cameraStream) {
            return;
        }


        cameraStream
            .getTracks()
            .forEach(
                track => track.stop()
            );
    }
);


// ======================================================
// CAMERA VIDEO EVENTS
// ======================================================

if (video) {

    video.addEventListener(
        "loadedmetadata",
        () => {

            setStatus(
                cameraFacing === "user"
                    ? "Front Camera Ready"
                    : "Back Camera Ready"
            );
        }
    );


    video.addEventListener(
        "playing",
        () => {

            setStatus(
                cameraFacing === "user"
                    ? "Front Camera Running"
                    : "Back Camera Running"
            );
        }
    );


    video.addEventListener(
        "error",
        () => {

            setStatus(
                "Camera video error"
            );
        }
    );
}


// ======================================================
// MODEL PANEL INITIAL STATE
// ======================================================

if (modelPanel) {

    modelPanel.style.display = "none";
}


// ======================================================
// INITIAL STATUS
// ======================================================

setStatus(
    "AZIZ HERO AR READY"
);// ======================================================
// AZIZ HERO AR
// app.js — PART 4 / 5
// MEDIAPIPE FACE TRACKING + VIDEO RECORDING
// ======================================================


// ======================================================
// MEDIAPIPE IMPORT
// ======================================================

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


// ======================================================
// FACE TRACKING STATE
// ======================================================

let faceLandmarker = null;

let faceTrackingReady = false;

let faceTrackingRunning = false;


// ======================================================
// INITIALIZE FACE LANDMARKER
// ======================================================

async function initFaceTracking() {

    try {

        setStatus(
            "Loading Face Tracking..."
        );


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
                            "./models/face_landmarker.task"
                    },

                    runningMode: "VIDEO",

                    numFaces: 1,

                    minFaceDetectionConfidence: 0.5,

                    minFacePresenceConfidence: 0.5,

                    minTrackingConfidence: 0.5,

                    outputFaceBlendshapes: false,

                    outputFacialTransformationMatrixes: false
                }
            );


        faceTrackingReady = true;


        setStatus(
            "Face Tracking Ready"
        );


        startFaceTracking();

    } catch (error) {

        console.error(
            "Face Tracking Error:",
            error
        );


        faceTrackingReady = false;


        setStatus(
            "Face Tracking Error"
        );
    }
}


// ======================================================
// FACE TRACKING LOOP
// ======================================================

function startFaceTracking() {

    if (faceTrackingRunning) {
        return;
    }


    faceTrackingRunning = true;


    requestAnimationFrame(
        faceTrackingLoop
    );
}


// ======================================================
// FACE TRACKING
// ======================================================

function faceTrackingLoop() {

    if (!faceTrackingRunning) {
        return;
    }


    requestAnimationFrame(
        faceTrackingLoop
    );


    if (
        !faceLandmarker ||
        !video ||
        video.readyState < 2 ||
        !video.videoWidth
    ) {

        return;
    }


    try {

        const now =
            performance.now();


        const result =
            faceLandmarker.detectForVideo(
                video,
                now
            );


        if (
            !result ||
            !result.faceLandmarks ||
            result.faceLandmarks.length === 0
        ) {

            return;
        }


        const landmarks =
            result.faceLandmarks[0];


        if (
            !landmarks ||
            landmarks.length === 0
        ) {

            return;
        }


        // Nose landmark
        const nose =
            landmarks[1];


        if (!nose) {
            return;
        }


        // Convert normalized coordinates
        // to Three.js coordinates.

        const faceX =
            (nose.x - 0.5) * 4;


        const faceY =
            -(nose.y - 0.5) * 3;


        // Only move imported 3D model.
        // Default cube stays centered.

        if (
            currentModel &&
            currentModel !== defaultCube
        ) {

            currentModel.position.x =
                THREE.MathUtils.lerp(
                    currentModel.position.x,
                    faceX,
                    0.08
                );


            currentModel.position.y =
                THREE.MathUtils.lerp(
                    currentModel.position.y,
                    faceY,
                    0.08
                );
        }

    } catch (error) {

        console.error(
            "Face Tracking Loop Error:",
            error
        );
    }
}


// ======================================================
// VIDEO RECORDING STATE
// ======================================================

let mediaRecorder = null;

let recordedChunks = [];

let recordingCanvas = null;

let recordingContext = null;

let recordingAnimation = null;

let recordingStream = null;


// ======================================================
// CREATE RECORDING CANVAS
// ======================================================

function createRecordingCanvas() {

    if (!recordingCanvas) {

        recordingCanvas =
            document.createElement("canvas");

        recordingContext =
            recordingCanvas.getContext("2d");
    }


    const width =
        video.videoWidth ||
        1280;


    const height =
        video.videoHeight ||
        720;


    recordingCanvas.width =
        width;


    recordingCanvas.height =
        height;


    return recordingCanvas;
}


// ======================================================
// DRAW RECORDING FRAME
// ======================================================

function drawRecordingFrame() {

    if (
        !recordingContext ||
        !recordingCanvas
    ) {

        return;
    }


    const width =
        recordingCanvas.width;


    const height =
        recordingCanvas.height;


    // Camera
    if (
        video &&
        video.readyState >= 2
    ) {

        recordingContext.drawImage(
            video,
            0,
            0,
            width,
            height
        );
    }


    // 3D canvas
    if (
        canvas &&
        canvas.width > 0 &&
        canvas.height > 0
    ) {

        recordingContext.drawImage(
            canvas,
            0,
            0,
            width,
            height
        );
    }


    recordingAnimation =
        requestAnimationFrame(
            drawRecordingFrame
        );
}


// ======================================================
// START VIDEO RECORDING
// ======================================================

async function startVideoRecording() {

    if (!cameraStream) {

        setStatus(
            "Open camera first"
        );

        alert(
            "Please open the camera first."
        );

        return;
    }


    try {

        createRecordingCanvas();


        const canvasStream =
            recordingCanvas.captureStream(
                30
            );


        const tracks =
            [
                ...canvasStream.getVideoTracks()
            ];


        // Add camera audio if available
        const audioTracks =
            cameraStream.getAudioTracks();


        if (audioTracks.length > 0) {

            tracks.push(
                audioTracks[0]
            );
        }


        recordingStream =
            new MediaStream(
                tracks
            );


        recordedChunks = [];


        let mimeType =
            "video/webm;codecs=vp9,opus";


        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "video/webm;codecs=vp8,opus";
        }


        if (
            !MediaRecorder.isTypeSupported(
                mimeType
            )
        ) {

            mimeType =
                "video/webm";
        }


        mediaRecorder =
            new MediaRecorder(
                recordingStream,
                {
                    mimeType: mimeType
                }
            );


        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    recordedChunks.push(
                        event.data
                    );
                }
            };


        mediaRecorder.onstop =
            saveVideoRecording;


        drawRecordingFrame();


        mediaRecorder.start();


        setStatus(
            "🔴 Recording..."
        );


        if (recordButton) {

            recordButton.textContent =
                "⏹️";
        }

    } catch (error) {

        console.error(
            "Recording Error:",
            error
        );


        setStatus(
            "Recording Error"
        );
    }
}


// ======================================================
// STOP VIDEO RECORDING
// ======================================================

function stopVideoRecording() {

    if (
        !mediaRecorder ||
        mediaRecorder.state === "inactive"
    ) {

        return;
    }


    mediaRecorder.stop();


    if (recordingAnimation) {

        cancelAnimationFrame(
            recordingAnimation
        );

        recordingAnimation = null;
    }


    if (recordButton) {

        recordButton.textContent =
            "🎥";
    }


    setStatus(
        "Saving Video..."
    );
}


// ======================================================
// SAVE VIDEO
// ======================================================

function saveVideoRecording() {

    if (
        !recordedChunks ||
        recordedChunks.length === 0
    ) {

        setStatus(
            "No video recorded"
        );

        return;
    }


    const blob =
        new Blob(
            recordedChunks,
            {
                type: "video/webm"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");


    link.href = url;


    link.download =
        "aziz-hero-video.webm";


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


    setStatus(
        "Video Saved"
    );
}


// ======================================================
// RECORD BUTTON
// ======================================================

if (recordButton) {

    recordButton.addEventListener(
        "click",
        () => {

            if (
                mediaRecorder &&
                mediaRecorder.state === "recording"
            ) {

                stopVideoRecording();

            } else {

                startVideoRecording();
            }
        }
    );
}


// ======================================================
// START FACE TRACKING
// ======================================================

initFaceTracking();// ======================================================
// AZIZ HERO AR
// app.js — PART 5 / 5
// AUDIO RECORDING + 3D EXPORT + FINAL SETUP
// ======================================================


// ======================================================
// AUDIO RECORDING STATE
// ======================================================

let audioRecorder = null;

let audioChunks = [];

let audioStream = null;


// ======================================================
// START AUDIO RECORDING
// ======================================================

async function startAudioRecording() {

    try {

        audioStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });


        audioChunks = [];


        audioRecorder =
            new MediaRecorder(
                audioStream
            );


        audioRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            };


        audioRecorder.onstop =
            saveAudioRecording;


        audioRecorder.start();


        setStatus(
            "🔴 Audio Recording..."
        );


        if (audioButton) {

            audioButton.textContent =
                "⏹️";
        }

    } catch (error) {

        console.error(
            "Audio Recording Error:",
            error
        );


        setStatus(
            "Microphone Error"
        );


        alert(
            "Microphone Error: " +
            (error.name || "Unknown")
        );
    }
}


// ======================================================
// STOP AUDIO RECORDING
// ======================================================

function stopAudioRecording() {

    if (
        !audioRecorder ||
        audioRecorder.state === "inactive"
    ) {

        return;
    }


    audioRecorder.stop();


    if (audioButton) {

        audioButton.textContent =
            "🎙️";
    }


    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track => track.stop()
            );
    }


    setStatus(
        "Saving Audio..."
    );
}


// ======================================================
// SAVE AUDIO
// ======================================================

function saveAudioRecording() {

    if (
        !audioChunks ||
        audioChunks.length === 0
    ) {

        setStatus(
            "No audio recorded"
        );

        return;
    }


    const blob =
        new Blob(
            audioChunks,
            {
                type: "audio/webm"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");


    link.href = url;


    link.download =
        "aziz-hero-audio.webm";


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


    setStatus(
        "Audio Saved"
    );
}


// ======================================================
// AUDIO BUTTON
// ======================================================

if (audioButton) {

    audioButton.addEventListener(
        "click",
        () => {

            if (
                audioRecorder &&
                audioRecorder.state === "recording"
            ) {

                stopAudioRecording();

            } else {

                startAudioRecording();
            }
        }
    );
}


// ======================================================
// GLTF EXPORTER
// ======================================================

async function exportGLB() {

    if (!currentModel) {

        setStatus(
            "No 3D model to export"
        );

        return;
    }


    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/GLTFExporter.js"
            );


        const GLTFExporter =
            module.GLTFExporter;


        const exporter =
            new GLTFExporter();


        exporter.parse(
            currentModel,
            result => {

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
                                    result,
                                    null,
                                    2
                                )
                            ],
                            {
                                type:
                                    "model/gltf+json"
                            }
                        );
                }


                downloadBlob(
                    blob,
                    "aziz-hero-model.glb"
                );


                setStatus(
                    "GLB Exported"
                );
            },

            error => {

                console.error(
                    "GLB Export Error:",
                    error
                );


                setStatus(
                    "GLB Export Error"
                );
            },

            {
                binary: true
            }
        );

    } catch (error) {

        console.error(
            "GLTF Exporter Error:",
            error
        );


        setStatus(
            "GLB Exporter Error"
        );
    }
}


// ======================================================
// GLTF EXPORT
// ======================================================

async function exportGLTF() {

    if (!currentModel) {

        setStatus(
            "No 3D model to export"
        );

        return;
    }


    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/GLTFExporter.js"
            );


        const GLTFExporter =
            module.GLTFExporter;


        const exporter =
            new GLTFExporter();


        exporter.parse(
            currentModel,
            result => {

                const blob =
                    new Blob(
                        [
                            JSON.stringify(
                                result,
                                null,
                                2
                            )
                        ],
                        {
                            type:
                                "model/gltf+json"
                        }
                    );


                downloadBlob(
                    blob,
                    "aziz-hero-model.gltf"
                );


                setStatus(
                    "GLTF Exported"
                );
            },

            error => {

                console.error(
                    "GLTF Export Error:",
                    error
                );


                setStatus(
                    "GLTF Export Error"
                );
            },

            {
                binary: false
            }
        );

    } catch (error) {

        console.error(
            "GLTF Exporter Error:",
            error
        );


        setStatus(
            "GLTF Exporter Error"
        );
    }
}


// ======================================================
// OBJ EXPORT
// ======================================================

async function exportOBJ() {

    if (!currentModel) {

        setStatus(
            "No 3D model to export"
        );

        return;
    }


    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/OBJExporter.js"
            );


        const OBJExporter =
            module.OBJExporter;


        const exporter =
            new OBJExporter();


        const result =
            exporter.parse(
                currentModel
            );


        const blob =
            new Blob(
                [result],
                {
                    type:
                        "text/plain"
                }
            );


        downloadBlob(
            blob,
            "aziz-hero-model.obj"
        );


        setStatus(
            "OBJ Exported"
        );

    } catch (error) {

        console.error(
            "OBJ Export Error:",
            error
        );


        setStatus(
            "OBJ Export Error"
        );
    }
}


// ======================================================
// STL EXPORT
// ======================================================

async function exportSTL() {

    if (!currentModel) {

        setStatus(
            "No 3D model to export"
        );

        return;
    }


    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/STLExporter.js"
            );


        const STLExporter =
            module.STLExporter;


        const exporter =
            new STLExporter();


        const result =
            exporter.parse(
                currentModel,
                {
                    binary: false
                }
            );


        const blob =
            new Blob(
                [result],
                {
                    type:
                        "model/stl"
                }
            );


        downloadBlob(
            blob,
            "aziz-hero-model.stl"
        );


        setStatus(
            "STL Exported"
        );

    } catch (error) {

        console.error(
            "STL Export Error:",
            error
        );


        setStatus(
            "STL Export Error"
        );
    }
}


// ======================================================
// DOWNLOAD HELPER
// ======================================================

function downloadBlob(
    blob,
    filename
) {

    if (!blob) {
        return;
    }


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");


    link.href = url;

    link.download = filename;


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
}


// ======================================================
// EXPORT BUTTON
// ======================================================

if (export3DButton) {

    export3DButton.addEventListener(
        "click",
        async () => {

            if (!currentModel) {

                setStatus(
                    "No 3D model loaded"
                );

                return;
            }


            const choice =
                prompt(
                    "Export format:\n\n1 = GLB\n2 = GLTF\n3 = OBJ\n4 = STL\n\nEnter 1, 2, 3 or 4:"
                );


            if (choice === "1") {

                await exportGLB();

            } else if (choice === "2") {

                await exportGLTF();

            } else if (choice === "3") {

                await exportOBJ();

            } else if (choice === "4") {

                await exportSTL();

            } else {

                setStatus(
                    "Export cancelled"
                );
            }
        }
    );
}


// ======================================================
// FINAL RESET
// ======================================================

if (resetButton) {

    resetButton.addEventListener(
        "click",
        () => {

            resetModelControls();

            setStatus(
                "3D Controls Reset"
            );
        }
    );
}


// ======================================================
// FINAL STARTUP MESSAGE
// ======================================================

setTimeout(
    () => {

        if (
            statusBox &&
            !statusBox.textContent.includes(
                "Error"
            )
        ) {

            setStatus(
                "AZIZ HERO AR READY"
            );
        }

    },
    500
);


// ======================================================
// FINAL CLEANUP
// ======================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }


        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }


        if (recordingAnimation) {

            cancelAnimationFrame(
                recordingAnimation
            );
        }
    }
);


// ======================================================
// END OF APP.JS
// ======================================================
