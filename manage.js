/**
 * manage.js — Quản lý điểm danh
 * Sheet1 cột: [0]=FaceID [1]=Image(URL/base64) [2]=Time [3]=Location [4]=Session [5]=Status [6]=Name
 */
const MANAGE_API = "https://script.google.com/macros/s/AKfycbziGyVEP3Syw_HK6aVCpkCkFSVjhjTSeVLqAEkKD7x7x9JkRUciWmzIQT_6dycv5wN_5w/exec";

let allRows = [];
let selectedDateKey = "all";
let studentRoster = [];
const MORNING_START_MIN = 6 * 60;
const MORNING_END_MIN   = 7 * 60 + 5;
const AFTER_START_MIN   = 11 * 60 + 45;
const AFTER_END_MIN     = 13 * 60;

function normalizeSession(sessionText, hour) {
    const s = (sessionText || "").toLowerCase();
    if (s.includes("sáng")) return "morning";
    if (s.includes("chiều")) return "afternoon";
    if (hour >= 6 && hour <= 10) return "morning";
    if (hour >= 11 && hour <= 17) return "afternoon";
    return "unknown";
}

function parseViDateTime(raw) {
    const v = (raw || "").toString().trim();
    // Dạng thường gặp: "26/04/2026, 06:50:15"
    const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
        // Fallback: thử parse trực tiếp (ISO hoặc format trình duyệt hỗ trợ)
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
        return null;
    }
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || 0);
    return new Date(year, month - 1, day, hour, minute, second);
}

function getPunctualStatus(timeText, sessionText) {
    const dt = parseViDateTime(timeText);
    // Không cho trạng thái "không rõ giờ" theo yêu cầu: mặc định xem là 🟠 Trễ
    if (!dt) return { key: "late", label: "🟠 Trễ", cls: "late" };
    const mins = dt.getHours() * 60 + dt.getMinutes();
    const session = normalizeSession(sessionText, dt.getHours());

    if (session === "morning") {
        if (mins >= MORNING_START_MIN && mins <= MORNING_END_MIN) return { key: "onTime", label: "🟢Kịp", cls: "ok" };
        if (mins > MORNING_END_MIN) return { key: "late", label: "🟠 Trễ", cls: "late" };
        return { key: "early", label: "🟢Kịp", cls: "ok" };
    }
    if (session === "afternoon") {
        if (mins >= AFTER_START_MIN && mins <= AFTER_END_MIN) return { key: "onTime", label: "🟢Kịp", cls: "ok" };
        if (mins > AFTER_END_MIN) return { key: "late", label: "🟠 Trễ", cls: "late" };
        return { key: "early", label: "🟢Kịp", cls: "ok" };
    }
    // Không rõ buổi -> mặc định 🟠 Trễ
    return { key: "late", label: "🟠 Trễ", cls: "late" };
}

function formatDateKey(timeText) {
    const dt = parseViDateTime(timeText);
    return dt ? dt.toLocaleDateString("vi-VN") : "Chưa có thời gian";
}
function extractDateFromFaceID(faceID) {
    const v = (faceID || "").toString();
    // IT1907-ddmmyyHHMMSS
    const m = v.match(/-(\d{2})(\d{2})(\d{2})\d{6}$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = 2000 + Number(m[3]);
    const dt = new Date(year, month - 1, day);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("vi-VN");
}
function getDateKeyFromRow(row) {
    const time = (row[2] || "").toString();
    const fromTime = formatDateKey(time);
    if (fromTime !== "Chưa có thời gian") return fromTime;
    return extractDateFromFaceID(row[0]) || "Chưa có thời gian";
}
function renderDateTabs(rows) {
    const box = document.getElementById("dateTabs");
    if (!box) return;
    const keys = [...new Set(rows.map(i => getDateKeyFromRow(i.content)).filter(k => k !== "Chưa có thời gian"))];
    const today = new Date().toLocaleDateString("vi-VN");
    const hasSelected = selectedDateKey === "all" || keys.includes(selectedDateKey);
    if (!hasSelected) selectedDateKey = keys.includes(today) ? today : "all";

    box.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = `date-tab ${selectedDateKey === "all" ? "active" : ""}`;
    allBtn.textContent = `Tất cả (${rows.length})`;
    allBtn.onclick = () => { selectedDateKey = "all"; filterTable(); };
    box.appendChild(allBtn);

    keys.forEach(k => {
        const count = rows.filter(i => getDateKeyFromRow(i.content) === k).length;
        const btn = document.createElement("button");
        btn.className = `date-tab ${selectedDateKey === k ? "active" : ""}`;
        btn.textContent = `${k} (${count})`;
        btn.onclick = () => { selectedDateKey = k; filterTable(); };
        box.appendChild(btn);
    });
}

// ===== LOAD =====
async function loadData() {
    document.getElementById("countLbl").textContent = "Đang tải...";
    try {
        const [resSheet1, resSheet2] = await Promise.all([
            fetch(MANAGE_API),
            fetch(MANAGE_API + "?sheet=2")
        ]);
        const data = await resSheet1.json();
        const studentsData = await resSheet2.json().catch(() => []);

        // Sheet1: dòng 0 là header, bỏ qua
        allRows = data.slice(1)
            .map((row, i) => ({ content: row, sheetRow: i + 2 })) // +2 vì bỏ header
            .reverse(); // mới nhất lên đầu

        // Sheet2: B=MSV, C=Tên
        studentRoster = Array.isArray(studentsData)
            ? studentsData.slice(1).map(r => ({
                msv: (r[1] || "").toString().trim(),
                name: (r[2] || "").toString().trim()
              })).filter(s => s.name)
            : [];

        renderDateTabs(allRows);
        filterTable();
    } catch (err) {
        document.getElementById("tableBody").innerHTML =
            `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--danger)">❌ Lỗi: ${err.message}</td></tr>`;
        document.getElementById("countLbl").textContent = "Lỗi kết nối";
    }
}

// ===== RENDER =====
function renderTable(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    // Đếm stats
    const today = new Date().toLocaleDateString("vi-VN");
    let okCount = 0, noCount = 0, todayCount = 0;
    let lateCount = 0;

    rows.forEach(item => {
        const row = item.content;
        const status = (row[5] || "").toString().trim();
        const time   = (row[2] || "").toString();
        const session = (row[4] || "").toString();
        const normalizedStatusKey = normalizeStoredStatus(status, time, session).key;
        const isOk   = normalizedStatusKey === "onTime";
        if (isOk) okCount++;
        else noCount++;
        if (getDateKeyFromRow(row) === today) todayCount++;
        if (normalizedStatusKey === "late") lateCount++;
    });

    document.getElementById("sTotal").textContent = rows.length;
    document.getElementById("sOk").textContent    = okCount;
    document.getElementById("sNo").textContent    = lateCount;
    document.getElementById("sToday").textContent = todayCount;
    document.getElementById("countLbl").textContent = `${rows.length} bản ghi`;
    updateAttendanceStats(rows);

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ico">📭</div><div>Chưa có dữ liệu điểm danh</div></div></td></tr>`;
        return;
    }

    let lastDateKey = "";
    rows.forEach((item, index) => {
        const row     = item.content;
        const realRow = item.sheetRow;

        // Đúng theo cấu trúc Sheet1
        const faceID   = (row[0] || "—").toString();
        const imgSrc   = (row[1] || "").toString();
        const time     = (row[2] || "—").toString();
        const location = (row[3] || "—").toString();
        const session  = (row[4] || "—").toString();
        const status   = (row[5] || "—").toString().trim();
        const name     = (row[6] || "Không rõ").toString();

        const normalizedStatus = normalizeStoredStatus(status, time, session);
        const punctual = normalizedStatus;
        const dateKey = getDateKeyFromRow(row);
        const displayDate = dateKey === "Chưa có thời gian" ? "Chưa có thời gian (dữ liệu cũ/lỗi định dạng)" : dateKey;

        if (dateKey !== lastDateKey) {
            const gtr = document.createElement("tr");
            gtr.innerHTML = `<td colspan="8" style="background:var(--surface2);font-weight:700;color:var(--accent);">📅 Ngày ${displayDate}</td>`;
            tbody.appendChild(gtr);
            lastDateKey = dateKey;
        }

        // Kiểm tra imgSrc có phải URL hay base64 hợp lệ
        const hasImg = imgSrc && imgSrc.length > 10 &&
            (imgSrc.startsWith("http") || imgSrc.startsWith("data:image"));

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-num">${rows.length - index}</td>
            <td>
                ${hasImg
                    ? `<img src="${imgSrc}" class="face-thumb" loading="lazy"
                            onclick="openModal('${imgSrc.startsWith('data') ? '[base64]' : imgSrc}')"
                            onerror="this.outerHTML='<div class=face-placeholder>👤</div>'">`
                    : `<div class="face-placeholder">👤</div>`}
            </td>
            <td><span class="mono">${faceID}</span></td>
            <td class="name-cell">${name}</td>
            <td class="meta-cell">${time}</td>
            <td class="meta-cell">${location}<br><span style="color:var(--accent);font-weight:600;">${session}</span></td>
            <td><span class="badge ${punctual.cls}">${punctual.label}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-sm btn-ok" onclick="updateStatus(${realRow},'✅', this)">✔</button>
                    <button class="btn-sm btn-no" onclick="updateStatus(${realRow},'❌', this)">✕</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function updateAttendanceStats(currentRows) {
    const totalStudents = studentRoster.length;
    const statDate = selectedDateKey === "all"
        ? new Date().toLocaleDateString("vi-VN")
        : selectedDateKey;

    const rowsForDate = allRows.filter(item => getDateKeyFromRow(item.content) === statDate);
    const presentSet = new Set();
    rowsForDate.forEach(item => {
        const row = item.content;
        const name = (row[6] || "").toString().trim();
        const status = (row[5] || "").toString().trim();
        const time = (row[2] || "").toString();
        const session = (row[4] || "").toString();
        const key = normalizeStoredStatus(status, time, session).key;
        if (name && (key === "onTime" || key === "late")) presentSet.add(name.toLowerCase());
    });

    const presentCount = presentSet.size;
    const absentCount = Math.max(totalStudents - presentCount, 0);
    const pct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    const sAbsent = document.getElementById("sAbsent");
    const sStudents = document.getElementById("sStudents");
    if (sAbsent) sAbsent.textContent = absentCount;
    if (sStudents) sStudents.textContent = totalStudents;

    const donut = document.getElementById("donutChart");
    const donutPct = document.getElementById("donutPct");
    const lgPresent = document.getElementById("lgPresent");
    const lgAbsent = document.getElementById("lgAbsent");
    const lgDate = document.getElementById("lgDate");

    if (donut) donut.style.setProperty("--p", String(pct));
    if (donutPct) donutPct.textContent = `${pct}%`;
    if (lgPresent) lgPresent.textContent = String(presentCount);
    if (lgAbsent) lgAbsent.textContent = String(absentCount);
    if (lgDate) lgDate.textContent = statDate;
}

// ===== FILTER =====
function filterTable() {
    const q      = document.getElementById("searchInput").value.toLowerCase();
    const fStat  = document.getElementById("filterStatus").value;

    renderDateTabs(allRows);
    const filtered = allRows.filter(item => {
        const row    = item.content;
        const name   = (row[6] || "").toLowerCase();
        const faceID = (row[0] || "").toLowerCase();
        const loc    = (row[3] || "").toLowerCase();
        const time   = (row[2] || "").toString();
        const session= (row[4] || "").toString();
        const status = (row[5] || "").toString().trim();
        const punctual = normalizeStoredStatus(status, time, session).key;
        const dateKey = getDateKeyFromRow(row);

        const matchQ = !q || name.includes(q) || faceID.includes(q) || loc.includes(q);
        const matchS = !fStat
            || (fStat === "ok" && punctual === "onTime")
            || (fStat === "late" && punctual === "late");
        const matchD = selectedDateKey === "all" || dateKey === selectedDateKey;

        return matchQ && matchS && matchD;
    });

    renderTable(filtered);
}

// ===== UPDATE STATUS =====
async function updateStatus(row, status, btnEl) {
    try {
        if (btnEl) {
            btnEl.classList.add("is-saving");
            setTimeout(() => btnEl.classList.remove("is-saving"), 280);
        }
        const url = `${MANAGE_API}?update=true&row=${row}&status=${encodeURIComponent(status)}`;
        await fetch(url, { method: "POST" });
        await loadData();
    } catch (err) {
        alert("❌ Lỗi cập nhật: " + err.message);
    }
}

function normalizeStoredStatus(status, time, session) {
    const s = (status || "").toLowerCase();
    if (s === "❌" || s.includes("🟠 Trễ") || s.includes("tre")) return { key: "late", label: "🟠 Trễ", cls: "late" };
    if (s === "✔" || s === "✅" || s.includes("☑") || s.includes("dung gio") || s.includes("🟢Kịp") || s.includes("kip")) {
        if (s === "✅" || s === "✔" || s.includes("☑") || s.includes("🟢Kịp") || s.includes("kip")) {
            return { key: "onTime", label: "🟢Kịp", cls: "ok" };
        }
        const punctual = getPunctualStatus(time, session);
        return punctual.key === "onTime"
            ? { key: "onTime", label: "🟢Kịp", cls: "ok" }
            : { key: "late", label: "🟠 Trễ", cls: "late" };
    }
    // Các trạng thái cũ/khác -> quy về 🟠 Trễ để không còn "không rõ giờ"
    return { key: "late", label: "🟠 Trễ", cls: "late" };
}

// ===== MODAL =====
function openModal(src) {
    if (src === "[base64]") { alert("Ảnh base64 — xem trong Google Sheet"); return; }
    document.getElementById("modalImg").src = src;
    document.getElementById("imgModal").classList.add("open");
}
function closeModal() { document.getElementById("imgModal").classList.remove("open"); }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// Init
loadData();
setInterval(loadData, 15000);
