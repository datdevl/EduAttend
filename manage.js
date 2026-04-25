const API_URL = "https://script.google.com/macros/s/AKfycbziGyVEP3Syw_HK6aVCpkCkFSVjhjTSeVLqAEkKD7x7x9JkRUciWmzIQT_6dycv5wN_5w/exec";

let allRows = [];

// ===== LOAD DATA =====
async function loadData() {
    try {
        const res  = await fetch(API_URL);
        const data = await res.json();
        allRows = data.slice(1).map((row, index) => ({
            content: row,
            sheetRow: index + 2
        })).reverse();

        renderTable(allRows);
    } catch (err) {
        document.getElementById("tableBody").innerHTML =
            `<tr><td colspan="9" style="text-align:center;padding:40px;color:#dc2626">❌ Lỗi: ${err.message}</td></tr>`;
    }
}

// ===== RENDER =====
function renderTable(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    document.getElementById("countLabel").textContent = `${rows.length} bản ghi`;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9">
            <div class="empty-state"><div class="icon">📭</div><div>Không có dữ liệu</div></div>
        </td></tr>`;
        return;
    }

    rows.forEach((item, index) => {
        const row = item.content;
        const realRow = item.sheetRow;

        const id       = row[0] || "—";
        const imgSrc   = row[1] || "";
        const time     = row[2] || "—";
        const location = row[3] || "—";
        const session  = row[4] || "—";
        const status   = row[5] || "—";
        const name     = row[6] || "Không rõ";

        const isOk = status === "✔" || status === "✅";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-num">${rows.length - index}</td>
            <td>
                ${imgSrc
                    ? `<img src="${imgSrc}" class="face-thumb" onclick="openModal('${imgSrc}')" title="Xem ảnh">`
                    : `<div style="width:48px;height:48px;background:var(--bg);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>`
                }
            </td>
            <td><span class="id-code">${id}</span></td>
            <td class="name-cell">${name}</td>
            <td style="font-size:13px;color:var(--muted)">${time}</td>
            <td style="font-size:13px;color:var(--muted)">${location}</td>
            <td style="font-size:13px">${session}</td>
            <td>
                <span class="badge ${isOk ? 'ok' : 'no'}">
                    ${isOk ? '✅ Có mặt' : '❌ Vắng'}
                </span>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-sm btn-ok" onclick="updateStatus(${realRow}, '✔')">✔</button>
                    <button class="btn-sm btn-no" onclick="updateStatus(${realRow}, '❌')">❌</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

// ===== FILTER =====
function filterTable() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const status = document.getElementById("filterStatus").value;

    const filtered = allRows.filter(item => {
        const row = item.content;
        const name     = (row[6] || "").toLowerCase();
        const id       = (row[0] || "").toLowerCase();
        const location = (row[3] || "").toLowerCase();
        const rowStatus = row[5] || "";

        const matchSearch = !search || name.includes(search) || id.includes(search) || location.includes(search);
        const matchStatus = !status ||
            (status === "ok" && (rowStatus === "✔" || rowStatus === "✅")) ||
            (status === "no" && rowStatus !== "✔" && rowStatus !== "✅");

        return matchSearch && matchStatus;
    });

    renderTable(filtered);
}

// ===== UPDATE STATUS =====
async function updateStatus(row, status) {
    try {
        const url = `${API_URL}?update=true&row=${row}&status=${encodeURIComponent(status)}`;
        await fetch(url, { method: "POST" });
        await loadData();
    } catch (err) {
        alert("❌ Lỗi cập nhật: " + err.message);
    }
}

// ===== IMAGE MODAL =====
function openModal(src) {
    document.getElementById("modalImg").src = src;
    document.getElementById("imgModal").classList.add("open");
}
function closeModal() {
    document.getElementById("imgModal").classList.remove("open");
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// init
loadData();
setInterval(loadData, 15000);
