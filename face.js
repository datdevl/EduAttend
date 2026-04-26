/**
 * ============================================================
 * FACE.JS — HỆ THỐNG ĐIỂM DANH AI - DNU IT1907
 * Fix: % khớp đúng | Đánh giá trạng thái | Ghi Sheet1 đầy đủ
 * Sheet2 cấu trúc: A=STT, B=MSV, C=TênSV, D=FACE(URL ảnh), E=ID
 * Sheet1 ghi: FaceID | Image | Time | Location | Session | Status | Name
 * ============================================================
 */

// ===== CẤU HÌNH =====
const FACE_API_URL  = "https://script.google.com/macros/s/AKfycbziGyVEP3Syw_HK6aVCpkCkFSVjhjTSeVLqAEkKD7x7x9JkRUciWmzIQT_6dycv5wN_5w/exec";
const MODEL_URL     = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const FACE_THRESHOLD = 0.50; // Ngưỡng nhận diện — dist < 0.5 là khớp

// ===== DOM ELEMENTS =====
const video       = document.getElementById("video");
const overlay     = document.getElementById("overlay");
const overlayCtx  = overlay.getContext("2d");
const scanFrame   = document.getElementById("scanFrame");
const scanBtn     = document.getElementById("scanBtn");
const modelStatus = document.getElementById("modelStatus");
const progressFill= document.getElementById("progressFill");
const camDot      = document.getElementById("camDot");
const camStatus   = document.getElementById("camStatus");

// ===== STATE =====
let modelsLoaded = false;
let knownFaces   = []; // [{msv, id, name, faceUrl, descriptor?}] — từ Sheet2
let detectionLoop = null;
let knownFacesLoaded = false;

// =====================================================
// 1. LOAD MODELS AI
// =====================================================
async function loadModels() {
    try {
        setProgress(10, "Tải TinyFaceDetector...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        setProgress(40, "Tải FaceLandmark68Tiny...");
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);

        setProgress(70, "Tải FaceRecognition...");
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        setProgress(90, "Tải FaceExpression...");
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

        setProgress(100, "Sẵn sàng!");
        modelsLoaded = true;

        setTimeout(() => {
            modelStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;
                    background:linear-gradient(135deg,#f0fdf4,#dcfce7);
                    border:1px solid #86efac;border-radius:10px;
                    color:#15803d;font-weight:600;font-size:13px;">
                    ✅ Model AI sẵn sàng
                    <span id="knownCount" style="margin-left:auto;font-weight:400;color:#166534;font-size:12px;">Đang tải CSDL...</span>
                </div>`;
            scanBtn.disabled = false;
            startDetectionLoop();
        }, 400);

    } catch (err) {
        modelStatus.innerHTML = `<div style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:10px;font-size:13px;">❌ Lỗi tải model: ${err.message}</div>`;
    }
}

function setProgress(pct, msg) {
    if (progressFill) progressFill.style.width = pct + "%";
    const el = modelStatus && modelStatus.querySelector("div:first-child");
    if (el) el.textContent = msg;
}

// =====================================================
// 2. CAMERA
// =====================================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            overlay.width  = video.videoWidth;
            overlay.height = video.videoHeight;
            camDot.className = "dot live";
            camStatus.textContent = "Camera đang chạy";
            video.play();
        };
    } catch {
        camDot.className = "dot denied";
        camStatus.textContent = "Không mở được camera";
    }
}

// =====================================================
// 3. REALTIME DETECTION LOOP — chữ KHÔNG ngược
// =====================================================
function startDetectionLoop() {
    if (detectionLoop) return;
    detectionLoop = setInterval(async () => {
        if (!modelsLoaded || !video.videoWidth || video.paused) return;

        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
        const dets = await faceapi
            .detectAllFaces(video, opts)
            .withFaceLandmarks(true)
            .withFaceExpressions();

        const resized = faceapi.resizeResults(dets, { width: video.videoWidth, height: video.videoHeight });

        // Save → flip (khớp với CSS mirror của video) → vẽ → restore
        overlayCtx.save();
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        overlayCtx.translate(overlay.width, 0);
        overlayCtx.scale(-1, 1);

        if (resized.length > 0) {
            scanFrame && scanFrame.classList.add("active");
            faceapi.draw.drawDetections(overlay, resized);
            faceapi.draw.drawFaceLandmarks(overlay, resized);

            resized.forEach(d => {
                const box    = d.detection.box;
                const topExp = Object.entries(d.expressions).sort((a,b) => b[1]-a[1])[0];
                const label  = `${emojiMap(topExp[0])} ${(topExp[1]*100).toFixed(0)}%`;

                // Nền nhãn
                overlayCtx.fillStyle = "rgba(0,0,0,0.55)";
                overlayCtx.beginPath();
                overlayCtx.roundRect(box.x, box.y - 28, Math.max(label.length*9, 100), 24, 6);
                overlayCtx.fill();

                overlayCtx.fillStyle = "#ffffff";
                overlayCtx.font = "bold 13px Arial";
                overlayCtx.fillText(label, box.x + 5, box.y - 10);
            });

            updateLiveStatus(resized[0]);
        } else {
            scanFrame && scanFrame.classList.remove("active");
            updateLiveStatus(null);
        }

        overlayCtx.restore();
    }, 100);
}

// =====================================================
// 4. PANEL TRẠNG THÁI REALTIME (bên phải)
// =====================================================
function getFaceBrightness(box) {
    try {
        const tmp = document.createElement("canvas");
        tmp.width = tmp.height = 32;
        const tc = tmp.getContext("2d");
        tc.drawImage(video, Math.max(0,box.x), Math.max(0,box.y),
            Math.min(box.width, video.videoWidth), Math.min(box.height, video.videoHeight), 0, 0, 32, 32);
        const px = tc.getImageData(0,0,32,32).data;
        let s = 0;
        for (let i=0; i<px.length; i+=4) s += px[i]*0.299 + px[i+1]*0.587 + px[i+2]*0.114;
        return s/(32*32);
    } catch { return 128; }
}

function updateLiveStatus(det) {
    const el = document.getElementById("liveStatus");
    if (!el) return;
    if (!det) {
        el.innerHTML = `
            <div class="ls-row warn">😶 Không phát hiện khuôn mặt</div>
            <div class="ls-row muted">Nhìn thẳng vào camera, đảm bảo đủ ánh sáng</div>`;
        return;
    }
    const box        = det.detection.box;
    const brightness = getFaceBrightness(box);
    const centerX    = box.x + box.width / 2;
    const offsetRatio = Math.abs(centerX - video.videoWidth / 2) / (video.videoWidth / 2);
    const topExp     = Object.entries(det.expressions).sort((a,b)=>b[1]-a[1])[0];
    const lightOk    = brightness >= 45 && brightness <= 215;
    const angleOk    = offsetRatio <= 0.35;
    const sizeOk     = box.width >= 80;
    const allOk      = lightOk && angleOk && sizeOk;
    const bPct       = Math.min(brightness/255*100, 100).toFixed(0);

    el.innerHTML = `
        <div class="ls-row ${allOk?'ok':'warn'}" style="font-weight:700;font-size:13px;">
            ${allOk ? '✅ Sẵn sàng quét!' : '⚠️ Chưa tối ưu'}
        </div>
        <div class="ls-row ${lightOk?'ok':'warn'}">
            💡 Ánh sáng: <b>${brightness<45?'Thiếu sáng':brightness>215?'Quá sáng':'Tốt'}</b>
            <div class="ls-bar"><span style="width:${bPct}%;background:${lightOk?'#22c55e':'#f59e0b'}"></span></div>
        </div>
        <div class="ls-row ${angleOk?'ok':'warn'}">
            📐 Góc nhìn: <b>${angleOk?'Thẳng ✅':'Lệch – xoay lại ⚠️'}</b>
        </div>
        <div class="ls-row ${sizeOk?'ok':'warn'}">
            📏 Khoảng cách: <b>${sizeOk?'Phù hợp ✅':'Lại gần hơn ⚠️'}</b>
        </div>
        <div class="ls-row muted">
            ${emojiMap(topExp[0])} Cảm xúc: <b>${emotionVI(topExp[0])}</b> (${(topExp[1]*100).toFixed(0)}%)
        </div>`;
}

// =====================================================
// 5. LOAD KNOWN FACES TỪ SHEET2
// Sheet2 cột: A=STT | B=MSV | C=TênSV | D=FACE_URL | E=ID
// =====================================================
async function loadKnownFaces() {
    try {
        knownFacesLoaded = false;
        const countEl = document.getElementById("knownCount");
        if (countEl) countEl.textContent = "Đang tải CSDL...";
        // Ưu tiên lấy Sheet2; nếu Apps Script chưa hỗ trợ sheet param thì fallback Sheet1
        let data = [];
        try {
            const res2 = await fetch(FACE_API_URL + "?sheet=2");
            data = await res2.json();
        } catch {
            data = [];
        }
        if (!Array.isArray(data) || data.length === 0) {
            const res1 = await fetch(FACE_API_URL);
            data = await res1.json();
        }
        knownFaces = [];
        let totalProfiles = 0;

        const rows = Array.isArray(data) ? data : [];

        // Nhận diện schema:
        // - Sheet2: [STT, MSV, TênSV, FACE_URL/filename, ID]
        // - Sheet1: [FaceID, Image(URL), Time, Location, Session, Status, Name]
        const isLikelySheet2 = rows.some(r =>
            Array.isArray(r) &&
            r.length >= 4 &&
            /\d{6,}/.test((r[1] || "").toString()) &&
            (r[2] || "").toString().trim() !== ""
        );

        for (const row of rows) {
            if (!Array.isArray(row)) continue;

            let msv = "";
            let id = "";
            let name = "";
            let faceUrl = "";

            if (isLikelySheet2) {
                // Sheet2 format
                msv = (row[1] || "").toString().trim();
                name = (row[2] || "").toString().trim();
                faceUrl = (row[3] || "").toString().trim();
                id = (row[4] || "").toString().trim();
            } else {
                // Sheet1 format fallback
                msv = "";
                name = (row[6] || "").toString().trim();
                faceUrl = (row[1] || "").toString().trim();
                id = "";
            }

            // Bỏ các dòng header/rác và URL không hợp lệ
            if (!name || !faceUrl) continue;
            if (!/^https?:\/\//i.test(faceUrl) && !/^data:image\//i.test(faceUrl)) continue;
            knownFaces.push({ msv, id, name, faceUrl, descriptor: null });
            totalProfiles++;
            if (countEl) countEl.textContent = `Đang tải CSDL... ${totalProfiles} hồ sơ`;
        }

        if (countEl) countEl.textContent = `${totalProfiles} hồ sơ CSDL sẵn sàng`;
        knownFacesLoaded = true;
        console.log(`✅ Loaded ${totalProfiles} profiles from CSDL`);
    } catch (err) {
        console.warn("Không load được CSDL:", err);
        const el = document.getElementById("knownCount");
        if (el) el.textContent = "Không kết nối được CSDL";
        knownFacesLoaded = false;
    }
}

// =====================================================
// 6. SCAN FACE — SO SÁNH + GHI SHEET1
// Sheet1 ghi theo thứ tự: FaceID | Image | Time | Location | Session | Status | Name
// =====================================================
async function scanFace() {
    const msv = document.getElementById("msvInput").value.trim();
    if (!msv)              { showResult("error","⚠️","Thiếu MSV","Nhập 3 số cuối mã sinh viên."); return; }
    if (!modelsLoaded)     { showResult("error","⏳","Chưa sẵn sàng","Model AI đang tải, vui lòng đợi."); return; }
    if (!video.videoWidth) { showResult("error","📷","Camera chưa sẵn sàng","Cấp quyền camera."); return; }

    document.getElementById("scanSound")?.play().catch(()=>{});
    scanBtn.disabled = true;
    scanBtn.innerHTML = `<span class="spin">⏳</span> Đang xử lý AI...`;
    camDot.className  = "dot scanning";
    camStatus.textContent = "Đang quét...";

    try {
        // Đảm bảo có CSDL ảnh gốc để AI so sánh trước khi quét
        if (!knownFacesLoaded || knownFaces.length === 0) {
            await loadKnownFaces();
        }
        if (knownFaces.length === 0) {
            showResult("error", "📚", "Chưa có dữ liệu CSDL", "Không tìm thấy hồ sơ trong Sheet2 để đối chiếu.");
            resetBtn(); return;
        }

        // ── A. CHỤP FRAME ──
        const snap = document.createElement("canvas");
        snap.width = video.videoWidth; snap.height = video.videoHeight;
        snap.getContext("2d").drawImage(video, 0, 0);

        // ── B. DETECT ──
        const det = await faceapi
            .detectSingleFace(snap, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor()
            .withFaceExpressions();

        if (!det) {
            showResult("error","😶","Không phát hiện khuôn mặt","Nhìn thẳng, đảm bảo đủ ánh sáng.");
            resetBtn(); return;
        }

        // ── C. ĐÁNH GIÁ TRẠNG THÁI ──
        const box         = det.detection.box;
        const brightness  = getFaceBrightness(box);
        const offsetRatio = Math.abs((box.x+box.width/2) - snap.width/2) / (snap.width/2);
        const topExp      = Object.entries(det.expressions).sort((a,b)=>b[1]-a[1])[0];
        const lightOk     = brightness >= 45 && brightness <= 215;
        const angleOk     = offsetRatio <= 0.35;
        const sizeOk      = box.width >= 80;
        const qualityOk   = lightOk && angleOk && sizeOk;

        // ── D. TRA CỨU ĐÚNG HỒ SƠ THEO 3 SỐ CUỐI MSV/ID ──
        const inputLast3 = normalizeLast3(msv);
        const targetRecord = knownFaces.find(k =>
            normalizeLast3(k.msv) === inputLast3 || normalizeLast3(k.id) === inputLast3
        );

        if (!targetRecord) {
            showResult("warning", "📋", `MSV ...${msv} chưa có trong CSDL`, "Không tìm thấy hồ sơ trùng 3 số cuối MSV/ID trong Sheet2.");
            resetBtn(); return;
        }

        const targetDescriptor = await getDescriptorFromRecord(targetRecord);
        if (!targetDescriptor) {
            showResult("error", "🖼️", "Không đọc được ảnh FACE gốc", `Hồ sơ ${targetRecord.name} có link FACE không hợp lệ hoặc chưa cấp quyền Drive.`);
            resetBtn(); return;
        }

        // ── E. SO SÁNH 1-1 ẢNH QUÉT VS ẢNH GỐC CỦA HỒ SƠ ──
        const bestMatch = {
            name: targetRecord.name,
            msv: targetRecord.msv,
            id: targetRecord.id,
            distance: faceapi.euclideanDistance(det.descriptor, targetDescriptor)
        };
        const isMatch = bestMatch.distance < FACE_THRESHOLD;

        // ── F. TÍNH % ĐỘ KHỚP (ĐÃ FIX — dist gần 0 = 100%) ──
        // Nếu khớp:  confidence = (threshold - dist) / threshold * 30 + 70  → khoảng [70–100]
        // Nếu không: confidence = (1 - dist).clamp(0,65)  → khoảng [0–65]
        let confidence;
        if (isMatch) {
            confidence = Math.round(70 + ((FACE_THRESHOLD - bestMatch.distance) / FACE_THRESHOLD) * 30);
        } else {
            confidence = Math.max(0, Math.min(65, Math.round((1 - bestMatch.distance) * 100)));
        }

        // ── G. LẤY INFO ──
        const time     = getTime();
        const location = await getLocation();
        const session  = new Date().getHours() < 12 ? "Sáng" : "Chiều";

        // ── H. TẠO ẢNH CÓ WATERMARK (đúng chiều, không bị ngược) ──
        const size   = Math.min(snap.width, snap.height);
        const sq     = document.createElement("canvas");
        sq.width = sq.height = size;
        const sqc = sq.getContext("2d");

        // Flip ngang để ảnh đúng chiều (camera front bị ngược raw)
        sqc.save();
        sqc.translate(size, 0); sqc.scale(-1, 1);
        sqc.drawImage(snap, (snap.width-size)/2, (snap.height-size)/2, size, size, 0, 0, size, size);
        sqc.restore();

        // Watermark bar
        sqc.fillStyle = "rgba(0,0,0,0.68)";
        sqc.fillRect(0, size-108, size, 108);

        sqc.fillStyle = "#ffffff";
        sqc.font = "bold 15px 'Courier New', monospace";
        sqc.fillText(`⏰ ${time}`, 14, size-86);
        sqc.fillText(`📍 ${location}`, 14, size-64);
        sqc.fillText(`📅 ${session} | MSV: ...${msv}`, 14, size-42);
        sqc.fillText(`👤 ${isMatch ? bestMatch.name : "Chưa nhận ra"} | ${confidence}%`, 14, size-18);

        // Badge chất lượng
        sqc.fillStyle = qualityOk ? "rgba(22,163,74,0.92)" : "rgba(217,119,6,0.92)";
        sqc.fillRect(size-170, size-108, 170, 32);
        sqc.fillStyle = "#fff"; sqc.font = "bold 12px monospace";
        sqc.fillText(qualityOk ? "✅ Chất lượng tốt" : "⚠️ Chất lượng thấp", size-166, size-86);

        const imgBase64 = sq.toDataURL("image/jpeg", 0.88);

        // ── I. TẠO CUSTOM ID ──
        const n = new Date();
        const customID = `IT1907-${p(n.getDate())}${p(n.getMonth()+1)}${String(n.getFullYear()).slice(-2)}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;

        // ── J. GỬI LÊN SHEET1 (đúng thứ tự cột) ──
        // Apps Script nhận: faceID | image | time | location | session | status | name
        const fd = new FormData();
        fd.append("faceID",      customID);
        fd.append("image",       imgBase64);          // Apps Script lưu lên Drive rồi ghi URL vào Sheet1 cột B
        fd.append("time",        time);
        fd.append("location",    location);
        fd.append("session",     session);
        fd.append("status",      isMatch ? "✔" : "⚠"); // quản lý nhìn rõ đã khớp hay chưa
        fd.append("name",        bestMatch.name || `MSV-${msv}`);  // cột G = Name
        // Extra info (Apps Script có thể bỏ qua nếu không dùng)
        fd.append("msvLast3",    msv);
        fd.append("matchedMsv",  bestMatch.msv || "");
        fd.append("compareMode", "MSV_ID_EXACT");
        fd.append("confidence",  confidence + "%");
        fd.append("matched",     isMatch ? "true" : "false");
        fd.append("distance",    bestMatch.distance === Infinity ? "N/A" : bestMatch.distance.toFixed(4));
        fd.append("emotion",     emotionVI(topExp[0]) + " (" + (topExp[1]*100).toFixed(0) + "%)");
        fd.append("quality",     qualityOk ? "Tốt" : "Thấp");

        const apiRes  = await fetch(FACE_API_URL, { method: "POST", body: fd });
        const apiData = await apiRes.json().catch(() => ({}));

        // ── K. HIỂN THỊ KẾT QUẢ ──
        const nameDisplay  = bestMatch.name || (apiData.name || `MSV ...${msv}`);
        const emoLine      = `${emojiMap(topExp[0])} Cảm xúc: ${emotionVI(topExp[0])} (${(topExp[1]*100).toFixed(0)}%)`;
        const qualLine     = [
            lightOk  ? "💡 Ánh sáng tốt" : "💡 Ánh sáng kém",
            angleOk  ? "📐 Góc đúng"     : "📐 Góc lệch",
            sizeOk   ? "📏 Khoảng cách OK":"📏 Quá xa"
        ].join("  |  ");

        if (isMatch) {
            showResult("success", "✅",
                `Xin chào, ${nameDisplay}!`,
                `🎯 Độ khớp khuôn mặt: ${confidence}%\n🕒 ${time}\n📍 ${location}\n📅 Buổi ${session}\n${emoLine}\n${qualLine}\n✔ Đã lưu vào hệ thống`);
        } else {
            showResult("warning", "📋",
                `MSV: ...${msv} không khớp khuôn mặt`,
                `⚠️ Đã tìm thấy hồ sơ ${nameDisplay} nhưng khuôn mặt không trùng ảnh gốc (${confidence}%)\n🕒 ${time}\n📍 ${location}\n📅 Buổi ${session}\n${emoLine}\n${qualLine}\n✔ Đã lưu vào hệ thống`);
        }

        camDot.className = "dot granted";
        camStatus.textContent = "Điểm danh xong";

    } catch (err) {
        console.error(err);
        showResult("error", "❌", "Lỗi hệ thống", err.message);
        camDot.className = "dot live";
        camStatus.textContent = "Camera đang chạy";
    }

    resetBtn();
}

// =====================================================
// HELPERS
// =====================================================
function p(n) { return String(n).padStart(2, '0'); }
function normalizeLast3(v) {
    const digits = (v || "").toString().replace(/\D/g, "");
    return digits.slice(-3);
}
function buildFaceImageCandidates(rawUrl) {
    const u = (rawUrl || "").toString().trim();
    if (!u) return [];
    if (/^data:image\//i.test(u)) return [u];

    const out = [u];

    // Hỗ trợ link Google Drive thường gặp:
    // - https://drive.google.com/file/d/FILE_ID/view
    // - https://drive.google.com/open?id=FILE_ID
    // - https://drive.google.com/uc?id=FILE_ID
    const idMatch = u.match(/\/file\/d\/([^/]+)/i)
        || u.match(/[?&]id=([^&]+)/i)
        || u.match(/\/d\/([^/]+)/i);
    const fileId = idMatch ? idMatch[1] : "";

    if (fileId) {
        out.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
        out.push(`https://drive.google.com/uc?export=view&id=${fileId}`);
        out.push(`https://lh3.googleusercontent.com/d/${fileId}=s1000`);
    }

    return [...new Set(out)];
}
function extractDriveFileId(url) {
    const u = (url || "").toString();
    const idMatch = u.match(/\/file\/d\/([^/]+)/i)
        || u.match(/[?&]id=([^&]+)/i)
        || u.match(/\/d\/([^/]+)/i);
    return idMatch ? idMatch[1] : "";
}
function isGoogleDriveUrl(url) {
    return /drive\.google\.com/i.test((url || "").toString());
}
async function getDescriptorFromRecord(record) {
    if (!record || !record.faceUrl) return null;
    if (record.descriptor) return record.descriptor;

    let img = null;
    const isDrive = isGoogleDriveUrl(record.faceUrl);

    // Link Drive: lấy qua proxy API để tránh CORS
    if (isDrive) {
        const fid = extractDriveFileId(record.faceUrl);
        if (fid) {
            const dataUrl = await fetchFaceDataUrlViaApi(fid);
            if (dataUrl) img = await faceapi.fetchImage(dataUrl).catch(() => null);
        }
    }

    // Link không phải Drive: thử trực tiếp
    if (!img) {
        const candidates = buildFaceImageCandidates(record.faceUrl);
        for (const candidateUrl of candidates) {
            img = await faceapi.fetchImage(candidateUrl).catch(() => null);
            if (img) break;
        }
    }
    if (!img) return null;

    const det = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
    if (!det) return null;

    record.descriptor = det.descriptor; // cache để lần sau nhanh hơn
    return det.descriptor;
}
async function fetchFaceDataUrlViaApi(fileId) {
    try {
        const u = `${FACE_API_URL}?proxyImage=1&id=${encodeURIComponent(fileId)}`;
        const r = await fetch(u);
        const j = await r.json().catch(() => null);
        if (j && j.success && /^data:image\//i.test(j.dataUrl || "")) return j.dataUrl;
    } catch {}
    return null;
}

function resetBtn() {
    scanBtn.disabled = false;
    scanBtn.innerHTML = `<span>🎭</span> Quét khuôn mặt`;
    if (camDot.className !== "dot granted") camDot.className = "dot live";
}

function showResult(type, icon, title, msg) {
    const box = document.getElementById("resultBox");
    if (!box) return;
    box.className = `result-box ${type}`;
    box.style.display = "block";
    document.getElementById("resultIcon").textContent = icon;
    document.getElementById("resultName").textContent = title;
    const m = document.getElementById("resultMeta");
    m.style.whiteSpace = "pre-line";
    m.textContent = msg;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function getTime() {
    return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

async function getLocation() {
    try {
        const pos = await new Promise((r,j) =>
            navigator.geolocation.getCurrentPosition(r, j, { timeout: 5000 }));
        const d = await (await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        )).json();
        return d.address.suburb || d.address.city_district || d.address.county || "DNU";
    } catch { return "Dai Nam University"; }
}

function emojiMap(e) {
    return {happy:"😊",sad:"😢",angry:"😠",surprised:"😮",neutral:"😐",fearful:"😨",disgusted:"🤢"}[e] || "😐";
}
function emotionVI(e) {
    return {happy:"Vui vẻ",sad:"Buồn",angry:"Tức giận",surprised:"Ngạc nhiên",neutral:"Bình thường",fearful:"Sợ hãi",disgusted:"Khó chịu"}[e] || "Bình thường";
}

// =====================================================
// INIT
// =====================================================
(async function init() {
    await startCamera();
    await new Promise(r => { const c = () => typeof faceapi !== "undefined" ? r() : setTimeout(c, 150); c(); });
    await loadModels();
    loadKnownFaces(); // chạy ngầm
})();
