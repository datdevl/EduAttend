// ============================================================
// face.js — Nhận diện khuôn mặt với face-api.js
// Chạy 100% trên browser, không cần backend
// Sử dụng TinyFaceDetector + FaceRecognitionNet
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbziGyVEP3Syw_HK6aVCpkCkFSVjhjTSeVLqAEkKD7x7x9JkRUciWmzIQT_6dycv5wN_5w/exec";

// =========== CDN Models (không cần host) ===========
// Dùng jsdelivr để load model weights của face-api.js
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const scanFrame = document.getElementById("scanFrame");
const scanBtn = document.getElementById("scanBtn");
const modelStatus = document.getElementById("modelStatus");
const progressFill = document.getElementById("progressFill");
const camDot = document.getElementById("camDot");
const camStatus = document.getElementById("camStatus");

let modelsLoaded = false;
let knownFaces = []; // [{label, descriptor, name}]
let detectionLoop = null;

// =========== 1. LOAD MODELS ===========
async function loadModels() {
    try {
        updateProgress(10, "Tải TinyFaceDetector...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        updateProgress(40, "Tải FaceLandmark68Net...");
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);

        updateProgress(70, "Tải FaceRecognitionNet...");
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        updateProgress(90, "Tải FaceExpression...");
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

        updateProgress(100, "Sẵn sàng!");
        modelsLoaded = true;

        setTimeout(() => {
            modelStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;color:#16a34a;font-weight:600;font-size:13px;">
                    <span>✅</span> Model AI đã tải xong — Sẵn sàng nhận diện
                </div>`;
            scanBtn.disabled = false;
            startDetectionLoop();
        }, 500);

    } catch (err) {
        console.error("Lỗi tải model:", err);
        modelStatus.innerHTML = `<div style="color:#dc2626;font-size:13px;">❌ Lỗi tải model: ${err.message}</div>`;
    }
}

function updateProgress(pct, msg) {
    progressFill.style.width = pct + "%";
    modelStatus.querySelector("div:first-child") && (modelStatus.querySelector("div:first-child").textContent = msg);
}

// =========== 2. CAMERA ===========
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" }
        });
        video.srcObject = stream;

        video.addEventListener("loadedmetadata", () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            camDot.className = "dot live";
            camStatus.textContent = "Camera đang chạy";
        });
    } catch (err) {
        camDot.className = "dot denied";
        camStatus.textContent = "Không mở được camera";
        console.error(err);
    }
}

// =========== 3. REALTIME DETECTION LOOP ===========
function startDetectionLoop() {
    if (detectionLoop) return;
    detectionLoop = setInterval(async () => {
        if (!video.videoWidth || !modelsLoaded) return;

        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 });

        const detections = await faceapi
            .detectAllFaces(video, options)
            .withFaceLandmarks(true)
            .withFaceExpressions();

        // resize về kích thước video
        const resized = faceapi.resizeResults(detections, {
            width: video.videoWidth,
            height: video.videoHeight
        });

        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        if (resized.length > 0) {
            scanFrame.classList.add("active");

            // vẽ box & landmarks
            faceapi.draw.drawDetections(overlay, resized);
            faceapi.draw.drawFaceLandmarks(overlay, resized);

            // vẽ nhãn cảm xúc
            resized.forEach(d => {
                const box = d.detection.box;
                const topExp = Object.entries(d.expressions)
                    .sort((a, b) => b[1] - a[1])[0];
                const label = topExp ? `${emojiEmotion(topExp[0])} ${(topExp[1]*100).toFixed(0)}%` : "";
                overlayCtx.fillStyle = "#2563eb";
                overlayCtx.font = "bold 13px 'DM Sans', sans-serif";
                overlayCtx.fillText(label, box.x, box.y > 16 ? box.y - 6 : box.y + 20);
            });
        } else {
            scanFrame.classList.remove("active");
        }
    }, 120);
}

function emojiEmotion(e) {
    const map = { happy:"😊", sad:"😢", angry:"😠", surprised:"😮", neutral:"😐", fearful:"😨", disgusted:"🤢" };
    return map[e] || "😐";
}

// =========== 4. LOAD KNOWN FACES FROM GOOGLE SHEET ===========
// Khi quét, ta sẽ lấy ảnh sinh viên từ Sheet rồi tạo descriptor để so sánh
async function loadKnownFaces() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        const rows = data.slice(1); // bỏ header

        knownFaces = [];

        for (const row of rows) {
            // row[1] = base64 ảnh, row[0] = faceID/customID, row[6] = tên
            const imgSrc = row[1];
            const name   = row[6] || "Không rõ";
            const id     = row[0];

            if (!imgSrc || !name) continue;

            try {
                const img = await faceapi.fetchImage(imgSrc).catch(() => null);
                if (!img) continue;

                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });
                const detection = await faceapi
                    .detectSingleFace(img, options)
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

                if (detection) {
                    knownFaces.push({
                        id,
                        name,
                        descriptor: detection.descriptor
                    });
                }
            } catch {}
        }

        console.log(`✅ Đã load ${knownFaces.length} khuôn mặt đã biết`);
    } catch (err) {
        console.warn("Không load được khuôn mặt đã biết:", err);
    }
}

// =========== 5. SCAN & RECOGNIZE ===========
async function scanFace() {
    const msv = document.getElementById("msvInput").value.trim();

    if (!msv) {
        showResult("error", "⚠️", "Thiếu MSV", "Vui lòng nhập 3 số cuối mã sinh viên.");
        return;
    }
    if (!modelsLoaded) {
        showResult("error", "⏳", "Chưa sẵn sàng", "Model AI chưa tải xong, vui lòng đợi.");
        return;
    }
    if (!video.videoWidth) {
        showResult("error", "📷", "Camera chưa sẵn sàng", "Vui lòng cấp quyền camera.");
        return;
    }

    // sound
    document.getElementById("scanSound").play().catch(()=>{});

    scanBtn.disabled = true;
    scanBtn.innerHTML = `<span>⏳</span> Đang nhận diện...`;
    camDot.className = "dot scanning";
    camStatus.textContent = "Đang quét...";

    try {
        // Chụp frame từ video
        const snapCanvas = document.createElement("canvas");
        snapCanvas.width = video.videoWidth;
        snapCanvas.height = video.videoHeight;
        const sctx = snapCanvas.getContext("2d");
        sctx.drawImage(video, 0, 0);

        // Detect khuôn mặt trong frame hiện tại
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 });
        const detection = await faceapi
            .detectSingleFace(snapCanvas, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        if (!detection) {
            showResult("error", "😶", "Không phát hiện khuôn mặt",
                "Hãy nhìn thẳng vào camera, đảm bảo đủ ánh sáng.");
            resetScanBtn();
            return;
        }

        // Lấy thông tin
        const time     = getTime();
        const location = await getLocation();
        const session  = getSession();

        // Vẽ thông tin lên ảnh chụp
        const size = Math.min(snapCanvas.width, snapCanvas.height);
        const square = document.createElement("canvas");
        square.width = square.height = size;
        const sqCtx = square.getContext("2d");
        sqCtx.drawImage(snapCanvas, (snapCanvas.width-size)/2, (snapCanvas.height-size)/2, size, size, 0, 0, size, size);
        sqCtx.fillStyle = "rgba(0,0,0,0.5)";
        sqCtx.fillRect(0, size-80, size, 80);
        sqCtx.fillStyle = "#ffffff";
        sqCtx.font = "bold 14px monospace";
        sqCtx.fillText(`⏰ ${time}`, 12, size-56);
        sqCtx.fillText(`📍 ${location}`, 12, size-36);
        sqCtx.fillText(`📅 Buổi ${session}`, 12, size-12);

        const imgData = square.toDataURL("image/jpeg", 0.85);

        // ===== SO SÁNH KHUÔN MẶT =====
        let matchedName = null;
        let matchedId   = null;
        let bestDist    = Infinity;

        if (knownFaces.length > 0) {
            for (const known of knownFaces) {
                const dist = faceapi.euclideanDistance(detection.descriptor, known.descriptor);
                if (dist < bestDist) {
                    bestDist = dist;
                    matchedName = known.name;
                    matchedId   = known.id;
                }
            }
            // ngưỡng 0.5: nếu > 0.5 thì coi là không nhận ra
            if (bestDist > 0.5) {
                matchedName = null;
                matchedId   = null;
            }
        }

        // Tạo custom ID mới cho lần điểm danh này
        const now  = new Date();
        const d    = String(now.getDate()).padStart(2,'0');
        const m    = String(now.getMonth()+1).padStart(2,'0');
        const y    = String(now.getFullYear()).slice(-2);
        const hh   = String(now.getHours()).padStart(2,'0');
        const mm   = String(now.getMinutes()).padStart(2,'0');
        const ss   = String(now.getSeconds()).padStart(2,'0');
        const customID = `IT1907-${d}${m}${y}${hh}${mm}${ss}`;

        // ===== GỬI LÊN GOOGLE SHEET =====
        const formData = new FormData();
        formData.append("faceID", customID);
        formData.append("image", imgData);
        formData.append("time", time);
        formData.append("location", location);
        formData.append("session", session);
        formData.append("status", "✔");
        formData.append("msvLast3", msv);
        if (matchedName) formData.append("matchedName", matchedName);
        formData.append("faceDistance", bestDist.toFixed(4));

        const res  = await fetch(API_URL, { method: "POST", body: formData });
        const data = await res.json();

        const displayName = matchedName || data.name || "Sinh viên";
        const confidence  = matchedName ? `${Math.round((1-bestDist)*100)}%` : "N/A";

        if (matchedName) {
            showResult("success", "✅", `${displayName} — Điểm danh thành công!`,
                `🕒 ${time}\n📍 ${location}\n📅 Buổi ${session}\n🎯 Độ chính xác: ${confidence}`);
        } else {
            showResult("success", "📋", `Ghi nhận thành công (MSV: ${msv})`,
                `Khuôn mặt chưa có trong CSDL.\n🕒 ${time}\n📍 ${location}\n📅 Buổi ${session}`);
        }

        camDot.className = "dot granted";
        camStatus.textContent = "Điểm danh xong";

    } catch (err) {
        console.error(err);
        showResult("error", "❌", "Lỗi hệ thống", err.message);
        camDot.className = "dot live";
        camStatus.textContent = "Camera đang chạy";
    }

    resetScanBtn();
}

function resetScanBtn() {
    scanBtn.disabled = false;
    scanBtn.innerHTML = `<span>🎭</span> Quét khuôn mặt`;
}

// =========== HELPERS ===========
function showResult(type, icon, name, meta) {
    const box = document.getElementById("resultBox");
    box.className = `result-box ${type}`;
    box.style.display = "block";
    document.getElementById("resultIcon").textContent = icon;
    document.getElementById("resultName").textContent = name;
    document.getElementById("resultMeta").style.whiteSpace = "pre-line";
    document.getElementById("resultMeta").textContent = meta;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function getTime() {
    return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}
function getSession() {
    return new Date().getHours() < 12 ? "Sáng" : "Chiều";
}
async function getLocation() {
    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
        const d   = await geo.json();
        return d.address.suburb || d.address.city_district || d.address.county || "Không rõ";
    } catch {
        return "Không lấy được vị trí";
    }
}

// =========== INIT ===========
(async () => {
    await startCamera();
    // Đợi face-api.js load xong (script defer)
    const waitFaceApi = () => new Promise(res => {
        const check = () => typeof faceapi !== "undefined" ? res() : setTimeout(check, 100);
        check();
    });
    await waitFaceApi();
    await loadModels();
    // Load known faces ngầm (không block UI)
    loadKnownFaces();
})();
