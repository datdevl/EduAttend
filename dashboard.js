const API_URL = "https://script.google.com/macros/s/AKfycbzEhVFMu3C3b0jfpkDw4-yHIRGnAB4AgopNRCl0c1VdXyH5k4PBcqnXMPPVCeiWnX5x/exec";

let countdownList = [];

// ===== CLOCK =====
function updateClock() {
    document.getElementById("clock").textContent =
        new Date().toLocaleTimeString("vi-VN", { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ===== FORMAT COUNTDOWN =====
function formatCountdown(ms) {
    if (ms <= 0) return "Đã hết hạn";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 24) {
        const days = Math.floor(h / 24);
        return `${days}d ${h % 24}h ${m}m`;
    }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function countdownClass(ms) {
    if (ms <= 0) return "expired";
    if (ms < 3600000) return "danger";       // < 1h
    if (ms < 86400000) return "warning";     // < 24h
    return "";
}

// ===== LOAD TASKS =====
async function loadTasks() {
    try {
        const res  = await fetch(API_URL);
        const data = await res.json();
        const rows = data.slice(1).reverse();

        const urgentList = document.getElementById("urgentList");
        const taskList   = document.getElementById("taskList");
        urgentList.innerHTML = "";
        taskList.innerHTML   = "";

        countdownList = [];
        let urgentCount = 0, expiredCount = 0, todayCount = 0;
        const now = new Date();

        if (rows.length === 0) {
            taskList.innerHTML = `<div class="empty-state"><div class="icon">📭</div><div>Chưa có nhiệm vụ nào</div></div>`;
        }

        rows.forEach((row, i) => {
            const task     = row[0] || "Không có tiêu đề";
            const created  = row[1] || "";
            const deadline = new Date(row[2]);
            const diff     = deadline - now;
            const isValid  = !isNaN(deadline.getTime());
            const cdId     = "cd_" + i;

            countdownList.push({ id: cdId, deadline });

            const isUrgent  = isValid && diff > 0 && diff < 3 * 86400000;
            const isExpired = isValid && diff <= 0;
            const isToday   = isValid && diff > 0 && diff < 86400000;

            if (isUrgent) urgentCount++;
            if (isExpired) expiredCount++;
            if (isToday) todayCount++;

            const item = document.createElement("div");
            item.className = `task-item${isUrgent ? " urgent" : ""}`;
            item.innerHTML = `
                <div>
                    <div class="task-name">${task}</div>
                    <div class="task-meta">
                        <span>📅 Giao: ${created}</span>
                        <span>⏰ Deadline: ${isValid ? deadline.toLocaleString("vi-VN") : "Không có"}</span>
                    </div>
                </div>
                <div class="countdown ${isValid ? countdownClass(diff) : "expired"}" id="${cdId}">
                    ${isValid ? formatCountdown(diff) : "—"}
                </div>`;

            if (isUrgent) {
                urgentList.appendChild(item.cloneNode(true));
            }
            taskList.appendChild(item);
        });

        // stats
        document.getElementById("statTotal").textContent   = rows.length;
        document.getElementById("statUrgent").textContent  = urgentCount;
        document.getElementById("statToday").textContent   = todayCount;
        document.getElementById("statExpired").textContent = expiredCount;
        document.getElementById("totalCount").textContent  = rows.length;
        document.getElementById("urgentCount").textContent = urgentCount;

        const urgentSection = document.getElementById("urgentSection");
        urgentSection.style.display = urgentCount > 0 ? "block" : "none";

    } catch (err) {
        console.error("Lỗi load:", err);
        document.getElementById("taskList").innerHTML =
            `<div class="empty-state"><div class="icon">❌</div><div>Lỗi kết nối: ${err.message}</div></div>`;
    }
}

// ===== REALTIME COUNTDOWN =====
function updateCountdowns() {
    const now = new Date();
    countdownList.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        const diff = item.deadline - now;
        el.textContent = formatCountdown(diff);
        el.className = "countdown " + countdownClass(diff);
    });
}
setInterval(updateCountdowns, 1000);

// init
loadTasks();
setInterval(loadTasks, 30000);
