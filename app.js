/**
 * app.js — Giao nhiệm vụ + Vẽ ảnh bìa
 * Fix: Canvas luôn hiện sau khi giao nhiệm vụ xong
 */
const TASK_API_URL = "https://script.google.com/macros/s/AKfycbzEhVFMu3C3b0jfpkDw4-yHIRGnAB4AgopNRCl0c1VdXyH5k4PBcqnXMPPVCeiWnX5x/exec";
const TASK_API_ENDPOINT = TASK_API_URL + "?task=1";

// ===== TOAST =====
function showToast(msg, type = "success") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.style.cssText = `position:fixed;bottom:32px;right:32px;padding:14px 22px;
            border-radius:12px;font-size:14px;font-weight:600;z-index:9999;
            transform:translateY(80px);opacity:0;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);
            display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,0.18);
            font-family:'DM Sans',sans-serif;color:#fff;max-width:320px;`;
        document.body.appendChild(toast);
    }
    toast.style.background = type === "success" ? "#16a34a"
                           : type === "error"   ? "#dc2626"
                           : "#2563eb";
    toast.textContent = (type === "success" ? "✅ " : type === "error" ? "❌ " : "ℹ️ ") + msg;
    toast.style.transform = "translateY(0)";
    toast.style.opacity   = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.transform = "translateY(80px)";
        toast.style.opacity   = "0";
    }, 3500);
}

// ===== FORMAT =====
function formatDeadline(dt) {
    if (!dt) return "Chưa đặt deadline";
    const d = new Date(dt);
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 || 12;
    return `${h12}:${m} ${ampm} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatNow() {
    const d = new Date();
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0'), s = String(d.getSeconds()).padStart(2,'0');
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 || 12;
    return `${h12}:${m}:${s} ${ampm} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ===== ADD TASK =====
async function addTask() {
    const taskInput     = document.getElementById("taskInput");
    const deadlineInput = document.getElementById("deadlineInput");
    const submitBtn     = document.getElementById("submitBtn");

    const task     = taskInput.value.trim();
    const deadline = deadlineInput.value;

    if (!task) {
        showToast("Vui lòng nhập nội dung nhiệm vụ!", "error");
        taskInput.focus();
        return;
    }

    // Loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spin-icon">⏳</span> Đang gửi...`;
    }

    const created = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

    try {
        await fetch(TASK_API_ENDPOINT, {
            method: "POST",
            body: JSON.stringify({ task, created, deadline })
        });
        showToast("Nhiệm vụ đã được gửi thành công!");
    } catch (err) {
        showToast("Lưu thất bại: " + err.message, "error");
    }

    // Reset nút
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>🚀</span> Giao nhiệm vụ`;
    }

    // ===== VẼ ẢNH BÌA =====
    // Luôn gọi vẽ ngay dù API thành công hay không
    await drawTaskOnImage(task, deadline);
}

// ===== DRAW BIA.PNG =====
async function drawTaskOnImage(task, deadline) {
    const canvas = document.getElementById("biaCanvas");
    if (!canvas) { console.error("Không tìm thấy #biaCanvas"); return; }

    const wrap = document.getElementById("canvasWrap");

    // Hiện wrap trước (tránh layout bị ẩn)
    if (wrap) {
        wrap.style.display = "block";
        wrap.style.opacity = "0";
        wrap.style.transition = "opacity 0.5s ease";
    }

    return new Promise(async (resolve) => {
        const ctx = canvas.getContext("2d");
        const img = new Image();

        // Thử load bia.png — nếu fail thì vẽ nền tự tạo
        img.crossOrigin = "anonymous";
        img.src = "bia.png?" + Date.now(); // cache bust

        const onDraw = async () => {
            canvas.width  = img.naturalWidth  || 1200;
            canvas.height = img.naturalHeight || 675;

            if (img.naturalWidth) {
                ctx.drawImage(img, 0, 0);
            } else {
                // Fallback: vẽ nền gradient nếu không load được bia.png
                const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                grad.addColorStop(0, "#0f172a");
                grad.addColorStop(1, "#1e3a5f");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Grid lines
                ctx.strokeStyle = "rgba(37,99,235,0.2)";
                ctx.lineWidth = 1;
                for (let x = 0; x < canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
                for (let y = 0; y < canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

                // Logo text
                ctx.fillStyle = "rgba(37,99,235,0.6)";
                ctx.font = "bold 48px monospace";
                ctx.textAlign = "center";
                ctx.fillText("CNTT 19-07", canvas.width/2, 80);
                ctx.fillStyle = "rgba(37,99,235,0.3)";
                ctx.font = "24px monospace";
                ctx.fillText("ĐH ĐẠI NAM", canvas.width/2, 116);
                ctx.textAlign = "left";
            }

            // ===== LẤY VỊ TRÍ =====
            let locationText = "Đang xác định...";
            try {
                const pos = await new Promise((r, j) =>
                    navigator.geolocation.getCurrentPosition(r, j, { timeout: 5000 }));
                const geo = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
                );
                const gData = await geo.json();
                locationText = gData.address.suburb || gData.address.city_district || gData.address.county || "Không rõ";
            } catch {
                locationText = "Dai Nam University";
            }

            // ===== STYLE =====
            const x = canvas.width * 0.22;
            let   y = canvas.height * 0.28;
            const maxWidth  = canvas.width * 0.55;
            const lineH     = 52;
            const maxHeight = canvas.height * 0.42;

            function wrapText(text, cx, cy, mw, lh, mxh) {
                const words = text.split(" ");
                let line = "", startY = cy;
                for (const word of words) {
                    const test = line + word + " ";
                    if (ctx.measureText(test).width > mw && line) {
                        ctx.fillText(line.trim(), cx, cy);
                        line = word + " ";
                        cy += lh;
                    } else { line = test; }
                    if (cy - startY > mxh) { ctx.fillText("...", cx, cy); return cy; }
                }
                ctx.fillText(line.trim(), cx, cy);
                return cy;
            }

            // Shadow chung
            ctx.shadowBlur = 10;

            // NHIỆM VỤ
            ctx.font = "bold 48px 'Courier New', monospace";
            ctx.fillStyle  = "#1d4ed8";
            ctx.shadowColor = "rgba(37,99,235,0.5)";
            y = wrapText("NV: " + task, x, y, maxWidth, lineH, maxHeight);

            // DEADLINE
            y += 58;
            ctx.fillStyle  = "#dc2626";
            ctx.shadowColor = "rgba(220,38,38,0.5)";
            y = wrapText("DEADLINE: " + formatDeadline(deadline), x, y, maxWidth, lineH, maxHeight);

            // THỜI GIAN GỬI
            y += 58;
            ctx.fillStyle  = "#7c3aed";
            ctx.shadowColor = "rgba(124,58,237,0.5)";
            y = wrapText("GỬI: " + formatNow(), x, y, maxWidth, lineH, maxHeight);

            // VỊ TRÍ
            y += 58;
            ctx.fillStyle  = "#047857";
            ctx.shadowColor = "rgba(4,120,87,0.5)";
            wrapText("VỊ TRÍ: " + locationText, x, y, maxWidth, lineH, maxHeight);

            ctx.shadowBlur = 0;

            // Hiện canvas với animation
            if (wrap) {
                requestAnimationFrame(() => {
                    wrap.style.opacity = "1";
                    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
                });
            }
            resolve();
        };

        img.onload  = onDraw;
        img.onerror = () => {
            console.warn("bia.png không load được, dùng nền tự tạo");
            img.naturalWidth = 0;
            onDraw();
        };

        // Timeout fallback: nếu 4 giây chưa load thì tự vẽ
        setTimeout(() => {
            if (!canvas.width) {
                img.naturalWidth = 0;
                onDraw();
            }
        }, 4000);
    });
}
