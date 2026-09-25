/* =====================================================
   AZIZ FACE AR — APP.JS
   PART 1 / 5
===================================================== */

import * as THREE from
"https://esm.sh/three@0.180.0";

import { GLTFLoader } from
"https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

import { OBJLoader } from
"https://esm.sh/three@0.180.0/examples/jsm/loaders/OBJLoader.js";

import { FBXLoader } from
"https://esm.sh/three@0.180.0/examples/jsm/loaders/FBXLoader.js";

import { STLLoader } from
"https://esm.sh/three@0.180.0/examples/jsm/loaders/STLLoader.js";

import { GLTFExporter } from
"https://esm.sh/three@0.180.0/examples/jsm/exporters/GLTFExporter.js";

import { OBJExporter } from
"https://esm.sh/three@0.180.0/examples/jsm/exporters/OBJExporter.js";

import { STLExporter } from
"https://esm.sh/three@0.180.0/examples/jsm/exporters/STLExporter.js";

import {
    FaceLandmarker,
    FilesetResolver
} from
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";


/* ---------- ELEMENTS ---------- */

const video =
    document.getElementById("camera");

const canvas =
    document.getElementById("threeCanvas");

const status =
    document.getElementById("status");

const cameraButton =
    document.getElementById("cameraButton");

const switchCameraButton =
    document.getElementById("switchCameraButton");


/* ---------- STATUS ---------- */

function setStatus(text) {

    console.log("[AZIZ AR]", text);

    if (status) {
        status.textContent = text;
    }
}


/* ---------- CAMERA ---------- */

let cameraStream = null;

let cameraFacing = "user";


async function startCamera() {

    try {

        setStatus("Starting Camera...");


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

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


        video.srcObject =
            cameraStream;


        await video.play();


        updateMirror();


        setStatus(
            cameraFacing === "user"
                ? "Front Camera ON"
                : "Back Camera ON"
        );


        startFaceTracking();


    } catch (error) {

        console.error(error);

        setStatus(
            "Camera Error"
        );
    }
}


function updateMirror() {

    if (!video) return;


    video.classList.toggle(
        "camera-mirrored",
        cameraFacing === "user"
    );
}


if (cameraButton) {

    cameraButton.onclick =
        startCamera;
}


/* ---------- CAMERA SWITCH ---------- */

if (switchCameraButton) {

    switchCameraButton.onclick =
        async function () {

            cameraFacing =
                cameraFacing === "user"
                    ? "environment"
                    : "user";


            switchCameraButton.textContent =
                cameraFacing === "user"
                    ? "Back Camera"
                    : "Front Camera";


            await startCamera();
        };
}


/* ---------- THREE.JS ---------- */

const renderer =
    new THREE.WebGLRenderer({

        canvas,

        alpha: true,

        antialias: true,

        preserveDrawingBuffer: true
    });


renderer.setPixelRatio(
    Math.min(
        devicePixelRatio || 1,
        2
    )
);


renderer.setSize(
    innerWidth,
    innerHeight
);


renderer.outputColorSpace =
    THREE.SRGBColorSpace;


const scene =
    new THREE.Scene();


const threeCamera =
    new THREE.PerspectiveCamera(
        45,
        innerWidth / innerHeight,
        0.01,
        100
    );


threeCamera.position.z = 5;


/* ---------- LIGHT ---------- */

scene.add(
    new THREE.AmbientLight(
        0xffffff,
        2
    )
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


scene.add(light);


/* ---------- MODEL ROOT ---------- */

const modelRoot =
    new THREE.Group();

scene.add(
    modelRoot
);


let currentModel = null;


/* ---------- DEFAULT CUBE ---------- */

const cube =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            1,
            1,
            1
        ),

        new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            roughness: 0.45,
            metalness: 0.15
        })
    );


modelRoot.add(cube);

currentModel = cube;


/* ---------- RENDER ---------- */

function render() {

    requestAnimationFrame(
        render
    );

    renderer.render(
        scene,
        threeCamera
    );
}


render();


/* ---------- RESIZE ---------- */

addEventListener(
    "resize",
    function () {

        threeCamera.aspect =
            innerWidth /
            innerHeight;

        threeCamera.updateProjectionMatrix();

        renderer.setSize(
            innerWidth,
            innerHeight
        );
    }
);


/* ---------- FACE TRACKING ---------- */

let faceLandmarker = null;

let trackingStarted = false;

let lastVideoTime = -1;


async function createFaceTracker() {

    if (faceLandmarker) {
        return faceLandmarker;
    }


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
                                "./models/face_landmarker.task",

                            delegate:
                                "GPU"
                        },

                        runningMode:
                            "VIDEO",

                        numFaces: 1,

                        minFaceDetectionConfidence:
                            0.5,

                        minFacePresenceConfidence:
                            0.5,

                        minTrackingConfidence:
                            0.5
                    }
                );


        setStatus(
            "Face Tracking Ready"
        );


        return faceLandmarker;


    } catch (error) {

        console.error(
            "Face tracker:",
            error
        );


        setStatus(
            "Face Tracking Error"
        );


        return null;
    }
}


/* ---------- TRACK LOOP ---------- */

async function startFaceTracking() {

    if (trackingStarted) {
        return;
    }


    trackingStarted = true;


    const tracker =
        await createFaceTracker();


    if (!tracker) {

        trackingStarted = false;

        return;
    }


    function loop() {

        if (
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime
        ) {

            lastVideoTime =
                video.currentTime;


            try {

                const result =
                    tracker.detectForVideo(
                        video,
                        performance.now()
                    );


                if (
                    result.faceLandmarks &&
                    result.faceLandmarks.length
                ) {

                    setStatus(
                        "FACE DETECTED"
                    );

                    updateFace(
                        result
                    );

                } else {

                    setStatus(
                        "FACE NOT DETECTED"
                    );
                }


            } catch (error) {

                console.error(
                    "Tracking:",
                    error
                );
            }
        }


        requestAnimationFrame(
            loop
        );
    }


    loop();
}


/* ---------- FACE POSITION ---------- */

function updateFace(result) {

    if (!currentModel) {
        return;
    }


    const face =
        result.faceLandmarks[0];


    if (!face) {
        return;
    }


    const nose =
        face[1];


    if (!nose) {
        return;
    }


    const x =
        (nose.x - 0.5) * -2;


    const y =
        (0.5 - nose.y) * 2;


    currentModel.position.x +=
        (
            x -
            currentModel.position.x
        ) * 0.15;


    currentModel.position.y +=
        (
            y -
            currentModel.position.y
        ) * 0.15;
}


/* =====================================================
   PART 1 / 5 END
===================================================== *//* =====================================================
   AZIZ FACE AR — APP.JS
   PART 2 / 5
========================================================= */


/* ---------- 3D CONTROLS ---------- */

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

const scaleInput =
    document.getElementById("scale");


function updateModelControls() {

    if (!currentModel) {
        return;
    }


    if (posX) {
        currentModel.position.x =
            Number(posX.value);
    }


    if (posY) {
        currentModel.position.y =
            Number(posY.value);
    }


    if (posZ) {
        currentModel.position.z =
            Number(posZ.value);
    }


    if (rotX) {
        currentModel.rotation.x =
            THREE.MathUtils.degToRad(
                Number(rotX.value)
            );
    }


    if (rotY) {
        currentModel.rotation.y =
            THREE.MathUtils.degToRad(
                Number(rotY.value)
            );
    }


    if (rotZ) {
        currentModel.rotation.z =
            THREE.MathUtils.degToRad(
                Number(rotZ.value)
            );
    }


    if (scaleInput) {
        const value =
            Number(scaleInput.value);

        if (value > 0) {
            currentModel.scale.setScalar(
                value
            );
        }
    }
}


/* ---------- SLIDER EVENTS ---------- */

[
    posX,
    posY,
    posZ,
    rotX,
    rotY,
    rotZ,
    scaleInput
].forEach(function (input) {

    if (input) {

        input.addEventListener(
            "input",
            updateModelControls
        );
    }
});


/* ---------- RESET MODEL CONTROLS ---------- */

function resetModelControls() {

    if (posX) posX.value = 0;
    if (posY) posY.value = 0;
    if (posZ) posZ.value = 0;

    if (rotX) rotX.value = 0;
    if (rotY) rotY.value = 0;
    if (rotZ) rotZ.value = 0;

    if (scaleInput) {
        scaleInput.value = 1;
    }


    updateModelControls();
}


/* ---------- IMPORT 3D ---------- */

const import3DInput =
    document.getElementById(
        "import3DInput"
    );


if (import3DInput) {

    import3DInput.addEventListener(
        "change",
        async function () {

            const file =
                import3DInput.files[0];


            if (!file) {
                return;
            }


            setStatus(
                "Loading 3D Model..."
            );


            try {

                const name =
                    file.name.toLowerCase();


                let object =
                    null;


                /* ----- GLB / GLTF ----- */

                if (
                    name.endsWith(".glb") ||
                    name.endsWith(".gltf")
                ) {

                    const loader =
                        new GLTFLoader();


                    const buffer =
                        await readFileAsArrayBuffer(
                            file
                        );


                    const result =
                        await new Promise(
                            function (
                                resolve,
                                reject
                            ) {

                                loader.parse(
                                    buffer,
                                    "",
                                    resolve,
                                    reject
                                );
                            }
                        );


                    object =
                        result.scene;
                }


                /* ----- OBJ ----- */

                else if (
                    name.endsWith(".obj")
                ) {

                    const loader =
                        new OBJLoader();


                    const text =
                        await readFileAsText(
                            file
                        );


                    object =
                        loader.parse(
                            text
                        );
                }


                /* ----- FBX ----- */

                else if (
                    name.endsWith(".fbx")
                ) {

                    const loader =
                        new FBXLoader();


                    const buffer =
                        await readFileAsArrayBuffer(
                            file
                        );


                    object =
                        loader.parse(
                            buffer,
                            ""
                        );
                }


                /* ----- STL ----- */

                else if (
                    name.endsWith(".stl")
                ) {

                    const loader =
                        new STLLoader();


                    const buffer =
                        await readFileAsArrayBuffer(
                            file
                        );


                    const geometry =
                        loader.parse(
                            buffer
                        );


                    const material =
                        new THREE.MeshStandardMaterial({
                            color: 0xcccccc,
                            roughness: 0.5,
                            metalness: 0.1
                        });


                    object =
                        new THREE.Mesh(
                            geometry,
                            material
                        );
                }


                else {

                    throw new Error(
                        "Unsupported 3D format"
                    );
                }


                if (!object) {

                    throw new Error(
                        "3D model could not be loaded"
                    );
                }


                /* ----- REMOVE OLD MODEL ----- */

                removeCurrentModel();


                /* ----- ADD NEW MODEL ----- */

                currentModel =
                    object;


                modelRoot.add(
                    currentModel
                );


                /* ----- CENTER & SCALE ----- */

                centerModel(
                    currentModel
                );


                /* ----- RESET UI ----- */

                resetModelControls();


                setStatus(
                    "3D Model Loaded"
                );


            } catch (error) {

                console.error(
                    "3D Import Error:",
                    error
                );


                setStatus(
                    "3D Model Error"
                );
            }


            import3DInput.value =
                "";
        }
    );
}


/* ---------- DEFAULT MODEL POSITION ---------- */

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

    currentModel.scale.setScalar(
        1
    );
}


/* ---------- MODEL BUTTON ---------- */

const modelButton =
    document.getElementById(
        "modelButton"
    );


const controlsPanel =
    document.getElementById(
        "modelControls"
    );


if (
    modelButton &&
    controlsPanel
) {

    modelButton.addEventListener(
        "click",
        function () {

            controlsPanel.classList.toggle(
                "hidden"
            );
        }
    );
}


/* =====================================================
   PART 2 / 5 END
========================================================= *//* =====================================================
   AZIZ FACE AR — APP.JS
   PART 3 / 5
========================================================= */


/* ---------- EXPORT BUTTONS ---------- */

const export3DButton =
    document.getElementById("export3DButton");


function downloadBlob(blob, filename) {

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}


/* ---------- GLB / GLTF EXPORT ---------- */

async function exportGLTF(binary) {

    if (!currentModel) {

        setStatus(
            "No 3D Model"
        );

        return;
    }


    const exporter =
        new GLTFExporter();


    try {

        const result =
            await new Promise(
                function (
                    resolve,
                    reject
                ) {

                    exporter.parse(
                        currentModel,
                        resolve,
                        reject,
                        {
                            binary: binary,
                            onlyVisible: true
                        }
                    );
                }
            );


        if (binary) {

            const blob =
                new Blob(
                    [result],
                    {
                        type:
                            "model/gltf-binary"
                    }
                );

            downloadBlob(
                blob,
                "aziz-model.glb"
            );

        } else {

            const json =
                JSON.stringify(
                    result,
                    null,
                    2
                );


            const blob =
                new Blob(
                    [json],
                    {
                        type:
                            "application/json"
                    }
                );


            downloadBlob(
                blob,
                "aziz-model.gltf"
            );
        }


        setStatus(
            binary
                ? "GLB Exported"
                : "GLTF Exported"
        );


    } catch (error) {

        console.error(
            "GLTF Export Error:",
            error
        );


        setStatus(
            "GLTF Export Error"
        );
    }
}


/* ---------- OBJ EXPORT ---------- */

function exportOBJ() {

    if (!currentModel) {

        setStatus(
            "No 3D Model"
        );

        return;
    }


    try {

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
            "aziz-model.obj"
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


/* ---------- STL EXPORT ---------- */

function exportSTL() {

    if (!currentModel) {

        setStatus(
            "No 3D Model"
        );

        return;
    }


    try {

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
            "aziz-model.stl"
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


/* ---------- EXPORT MENU ---------- */

if (export3DButton) {

    export3DButton.addEventListener(
        "click",
        async function () {

            if (!currentModel) {

                setStatus(
                    "No 3D Model"
                );

                return;
            }


            const choice =
                prompt(
                    "Export format:\n\n" +
                    "1 = GLB\n" +
                    "2 = GLTF\n" +
                    "3 = OBJ\n" +
                    "4 = STL"
                );


            if (!choice) {
                return;
            }


            if (choice === "1") {

                await exportGLTF(
                    true
                );

            } else if (choice === "2") {

                await exportGLTF(
                    false
                );

            } else if (choice === "3") {

                exportOBJ();

            } else if (choice === "4") {

                exportSTL();

            } else {

                setStatus(
                    "Invalid Export Format"
                );
            }
        }
    );
}


/* ---------- PHOTO CAPTURE ---------- */

const photoButton =
    document.getElementById(
        "photoButton"
    );


function capturePhoto() {

    if (!video) {
        return;
    }


    const output =
        document.createElement(
            "canvas"
        );


    output.width =
        video.videoWidth ||
        innerWidth;


    output.height =
        video.videoHeight ||
        innerHeight;


    const ctx =
        output.getContext(
            "2d"
        );


    if (!ctx) {
        return;
    }


    /* Camera */

    ctx.save();


    if (cameraFacing === "user") {

        ctx.translate(
            output.width,
            0
        );

        ctx.scale(
            -1,
            1
        );
    }


    ctx.drawImage(
        video,
        0,
        0,
        output.width,
        output.height
    );


    ctx.restore();


    /* 3D overlay */

    const canvasWidth =
        canvas.width;


    const canvasHeight =
        canvas.height;


    if (
        canvasWidth > 0 &&
        canvasHeight > 0
    ) {

        ctx.drawImage(
            canvas,
            0,
            0,
            output.width,
            output.height
        );
    }


    output.toBlob(
        function (blob) {

            if (!blob) {
                return;
            }


            downloadBlob(
                blob,
                "aziz-ar-photo.jpg"
            );


            setStatus(
                "Photo Saved"
            );
        },
        "image/jpeg",
        0.95
    );
}


if (photoButton) {

    photoButton.addEventListener(
        "click",
        capturePhoto
    );
}


/* =====================================================
   PART 3 / 5 END
========================================================= *//* =====================================================
   AZIZ FACE AR — APP.JS
   PART 4 / 5
========================================================= */


/* ---------- VIDEO RECORDING ---------- */

const recordButton =
    document.getElementById(
        "recordButton"
    );


let mediaRecorder = null;

let recordedChunks = [];

let recordingCanvas = null;

let recordingContext = null;

let recordingAnimation = null;

let recordingStream = null;


/* ---------- RECORDING CANVAS ---------- */

function createRecordingCanvas() {

    if (recordingCanvas) {
        return;
    }


    recordingCanvas =
        document.createElement(
            "canvas"
        );


    recordingCanvas.width =
        video.videoWidth ||
        innerWidth;


    recordingCanvas.height =
        video.videoHeight ||
        innerHeight;


    recordingContext =
        recordingCanvas.getContext(
            "2d"
        );
}


/* ---------- DRAW RECORDING FRAME ---------- */

function drawRecordingFrame() {

    if (
        !recordingCanvas ||
        !recordingContext
    ) {
        return;
    }


    const width =
        recordingCanvas.width;


    const height =
        recordingCanvas.height;


    recordingContext.clearRect(
        0,
        0,
        width,
        height
    );


    /* CAMERA */

    recordingContext.save();


    if (cameraFacing === "user") {

        recordingContext.translate(
            width,
            0
        );

        recordingContext.scale(
            -1,
            1
        );
    }


    recordingContext.drawImage(
        video,
        0,
        0,
        width,
        height
    );


    recordingContext.restore();


    /* 3D MODEL */

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


/* ---------- START RECORDING ---------- */

async function startRecording() {

    try {

        if (!video.srcObject) {

            setStatus(
                "Start Camera First"
            );

            return;
        }


        createRecordingCanvas();


        recordingCanvas.width =
            video.videoWidth ||
            innerWidth;


        recordingCanvas.height =
            video.videoHeight ||
            innerHeight;


        const canvasStream =
            recordingCanvas.captureStream(
                30
            );


        const audioTracks =
            cameraStream
                ? cameraStream.getAudioTracks()
                : [];


        recordingStream =
            new MediaStream();


        canvasStream
            .getVideoTracks()
            .forEach(
                function (track) {

                    recordingStream.addTrack(
                        track
                    );
                }
            );


        audioTracks.forEach(
            function (track) {

                recordingStream.addTrack(
                    track
                );
            }
        );


        recordedChunks = [];


        let mimeType =
            "";


        if (
            MediaRecorder.isTypeSupported(
                "video/webm;codecs=vp9,opus"
            )
        ) {

            mimeType =
                "video/webm;codecs=vp9,opus";

        } else if (
            MediaRecorder.isTypeSupported(
                "video/webm;codecs=vp8,opus"
            )
        ) {

            mimeType =
                "video/webm;codecs=vp8,opus";

        } else if (
            MediaRecorder.isTypeSupported(
                "video/webm"
            )
        ) {

            mimeType =
                "video/webm";
        }


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    recordingStream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    recordingStream
                );


        mediaRecorder.ondataavailable =
            function (event) {

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
            function () {

                if (
                    recordingAnimation
                ) {

                    cancelAnimationFrame(
                        recordingAnimation
                    );

                    recordingAnimation =
                        null;
                }


                const blob =
                    new Blob(
                        recordedChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "video/webm"
                        }
                    );


                downloadBlob(
                    blob,
                    "aziz-ar-video.webm"
                );


                setStatus(
                    "Video Saved"
                );


                if (recordingStream) {

                    recordingStream
                        .getTracks()
                        .forEach(
                            function (track) {
                                track.stop();
                            }
                        );
                }


                recordingStream =
                    null;
            };


        mediaRecorder.start(
            1000
        );


        drawRecordingFrame();


        if (recordButton) {

            recordButton.textContent =
                "Stop Recording";
        }


        setStatus(
            "RECORDING..."
        );


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


/* ---------- STOP RECORDING ---------- */

function stopRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state !==
            "inactive"
    ) {

        mediaRecorder.stop();


        if (recordButton) {

            recordButton.textContent =
                "Record Video";
        }
    }
}


/* ---------- RECORD BUTTON ---------- */

if (recordButton) {

    recordButton.addEventListener(
        "click",
        function () {

            if (
                mediaRecorder &&
                mediaRecorder.state ===
                    "recording"
            ) {

                stopRecording();

            } else {

                startRecording();
            }
        }
    );
}


/* ---------- AUDIO RECORDING ---------- */

const audioButton =
    document.getElementById(
        "audioButton"
    );


let audioRecorder = null;

let audioChunks = [];


async function startAudioRecording() {

    try {

        const audioStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks = [];


        audioRecorder =
            new MediaRecorder(
                audioStream
            );


        audioRecorder.ondataavailable =
            function (event) {

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
            function () {

                const blob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                audioRecorder.mimeType ||
                                "audio/webm"
                        }
                    );


                downloadBlob(
                    blob,
                    "aziz-audio.webm"
                );


                setStatus(
                    "Audio Saved"
                );


                audioStream
                    .getTracks()
                    .forEach(
                        function (track) {
                            track.stop();
                        }
                    );
            };


        audioRecorder.start();


        if (audioButton) {

            audioButton.textContent =
                "Stop Audio";
        }


        setStatus(
            "AUDIO RECORDING..."
        );


    } catch (error) {

        console.error(
            "Audio Error:",
            error
        );


        setStatus(
            "Microphone Error"
        );
    }
}


/* ---------- STOP AUDIO ---------- */

function stopAudioRecording() {

    if (
        audioRecorder &&
        audioRecorder.state !==
            "inactive"
    ) {

        audioRecorder.stop();


        if (audioButton) {

            audioButton.textContent =
                "Record Audio";
        }
    }
}


/* ---------- AUDIO BUTTON ---------- */

if (audioButton) {

    audioButton.addEventListener(
        "click",
        function () {

            if (
                audioRecorder &&
                audioRecorder.state ===
                    "recording"
            ) {

                stopAudioRecording();

            } else {

                startAudioRecording();
            }
        }
    );
}


/* =====================================================
   PART 4 / 5 END
========================================================= *//* =====================================================
   AZIZ FACE AR — APP.JS
   PART 5 / 5
========================================================= */


/* ---------- RESET BUTTON ---------- */

const resetButton =
    document.getElementById(
        "resetButton"
    );


function resetAll() {

    /* Stop video recording */

    if (
        mediaRecorder &&
        mediaRecorder.state !==
            "inactive"
    ) {

        mediaRecorder.stop();
    }


    /* Stop audio recording */

    if (
        audioRecorder &&
        audioRecorder.state !==
            "inactive"
    ) {

        audioRecorder.stop();
    }


    /* Reset camera */

    cameraFacing =
        "user";


    if (switchCameraButton) {

        switchCameraButton.textContent =
            "Back Camera";
    }


    updateMirror();


    /* Reset model */

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

        currentModel.scale.setScalar(
            1
        );
    }


    resetModelControls();


    setStatus(
        "AR Reset"
    );
}


/* ---------- RESET EVENT ---------- */

if (resetButton) {

    resetButton.addEventListener(
        "click",
        resetAll
    );
}


/* ---------- KEYBOARD SHORTCUTS ---------- */

addEventListener(
    "keydown",
    function (event) {

        /*
         * Do not interfere with
         * text inputs.
         */

        const target =
            event.target;


        if (
            target &&
            (
                target.tagName ===
                    "INPUT" ||
                target.tagName ===
                    "TEXTAREA"
            )
        ) {

            return;
        }


        /* R = Reset */

        if (
            event.key.toLowerCase()
            === "r"
        ) {

            resetAll();
        }


        /* P = Photo */

        if (
            event.key.toLowerCase()
            === "p"
        ) {

            capturePhoto();
        }


        /* V = Video */

        if (
            event.key.toLowerCase()
            === "v"
        ) {

            if (
                mediaRecorder &&
                mediaRecorder.state ===
                    "recording"
            ) {

                stopRecording();

            } else {

                startRecording();
            }
        }
    }
);


/* ---------- INITIAL STATUS ---------- */

setStatus(
    "AZIZ AR READY"
);


/* ---------- SAFETY CHECK ---------- */

console.log(
    "AZIZ FACE AR APP.JS LOADED"
);

console.log(
    "Camera:",
    !!video
);

console.log(
    "Three Canvas:",
    !!canvas
);

console.log(
    "Model:",
    !!currentModel
);

console.log(
    "Face Tracking:",
    "MediaPipe Ready"
);


/* =====================================================
   PART 5 / 5 END
========================================================= */
