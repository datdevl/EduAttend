const API_URL = "https://script.google.com/macros/s/AKfycbzEhVFMu3C3b0jfpkDw4-yHIRGnAB4AgopNRCl0c1VdXyH5k4PBcqnXMPPVCeiWnX5x/exec";

// ===== TOAST =====
function showToast(msg, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = (type === "success" ? "✅ " : "❌ ") + msg;
    toast.className = `show ${type}`;
    setTimeout(() => { toast.className = ""; }, 3500);
}

// ===== FORMAT DATE =====
function formatDeadline(dt) {
    if (!dt) return "Không có deadline";
    const d = new Date(dt);
    return d.toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
}
function formatNow() {
    return new Date().toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
}

// ===== ADD TASK =====
async function addTask() {
    const task     = document.getElementById("taskInput").value.trim();
    const deadline = document.getElementById("deadlineInput").value;
    const btn      = document.getElementById("submitBtn");

    if (!task) { showToast("Vui lòng nhập nội dung nhiệm vụ!", "error"); return; }

    btn.classList.add("loading");
    btn.innerHTML = `<span>⏳</span> Đang gửi...`;

    const created = formatNow();

    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ task, created, deadline })
        });

        showToast("Nhiệm vụ đã được gửi thành công!");
        document.getElementById("taskInput").value = "";

        // vẽ canvas output
        drawTaskOnImage(task, deadline);

    } catch (err) {
        showToast("Lỗi kết nối: " + err.message, "error");
    }

    btn.classList.remove("loading");
    btn.innerHTML = `<span>🚀</span> Giao nhiệm vụ`;
}

// ===== DRAW IMAGE =====
function drawTaskOnImage(task, deadline) {
    const canvas = document.getElementById("biaCanvas");
    const ctx    = canvas.getContext("2d");
    const wrap   = document.getElementById("canvasWrap");

    const img = new Image();
    img.src   = "bia.png";

    img.onload = async function () {
        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Style
        ctx.font      = "bold 48px 'Courier New', monospace";
        ctx.fillStyle = "#1d4ed8";
        ctx.shadowColor = "rgba(37,99,235,0.3)";
        ctx.shadowBlur  = 12;

        const x         = canvas.width * 0.22;
        let y           = canvas.height * 0.28;
        const maxWidth  = canvas.width * 0.55;
        const maxHeight = canvas.height * 0.4;

        // Vị trí
        let locationText = "Đang xác định...";
        try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
            const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const d   = await geo.json();
            locationText = d.address.suburb || d.address.city_district || d.address.county || "Không rõ";
        } catch {
            locationText = "Không lấy được vị trí";
        }

        function wrapText(text, x, y, maxWidth, lineHeight, maxHeight) {
            const words = text.split(" ");
            let line    = "";
            const startY = y;
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + " ";
                if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                    ctx.fillText(line, x, y);
                    line = words[i] + " ";
                    y += lineHeight;
                } else {
                    line = testLine;
                }
                if (y - startY > maxHeight) { ctx.fillText("...", x, y); return y; }
            }
            ctx.fillText(line, x, y);
            return y;
        }

        ctx.fillStyle = "#1d4ed8";
        y = wrapText("NV: " + task, x, y, maxWidth, 55, maxHeight);

        y += 60;
        ctx.fillStyle = "#dc2626";
        y = wrapText("DEADLINE: " + formatDeadline(deadline), x, y, maxWidth, 55, maxHeight);

        y += 60;
        ctx.fillStyle = "#7c3aed";
        y = wrapText("GỬI: " + formatNow(), x, y, maxWidth, 55, maxHeight);

        y += 60;
        ctx.fillStyle = "#047857";
        wrapText("VỊ TRÍ: " + locationText, x, y, maxWidth, 55, maxHeight);

        wrap.style.display = "block";
        wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    img.onerror = () => showToast("Không tải được bia.png", "error");
}
