# EduAttend — Hệ Thống Điểm Danh Thông Minh
**CNTT 19-07 · ĐH Đại Nam**

Hệ thống điểm danh bằng Face ID với AI nhận diện khuôn mặt, chạy 100% trên browser — không cần backend, deploy trực tiếp lên GitHub Pages.

---

## 🚀 Deploy lên GitHub Pages (5 bước)

### Bước 1: Tạo repo GitHub
- Vào github.com → New repository
- Đặt tên: `eduattend` (hoặc tên bất kỳ)
- Chọn **Public**
- Nhấn **Create repository**

### Bước 2: Upload toàn bộ file
Upload các file sau vào repo:
```
index.html
faceID.html
dashboard.html
manage.html
face.js
app.js
dashboard.js
manage.js
bia.png          ← file ảnh bìa của bạn
```

### Bước 3: Bật GitHub Pages
- Vào repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: **main** / **(root)**
- Nhấn **Save**

### Bước 4: Truy cập
Sau ~1 phút, website sẽ chạy tại:
```
https://[username].github.io/[repo-name]/
```

### Bước 5: (Quan trọng) Download model face-api.js
Vì GitHub Pages là static, bạn cần download model AI về local:

1. Tải thư mục model tại: https://github.com/vladmandic/face-api/tree/master/model
2. Tải các file:
   - `tiny_face_detector_model-weights_manifest.json`
   - `tiny_face_detector_model-shard1`
   - `face_landmark_68_tiny_model-weights_manifest.json`
   - `face_landmark_68_tiny_model-shard1`
   - `face_recognition_model-weights_manifest.json`
   - `face_recognition_model-shard1`
   - `face_recognition_model-shard2`
   - `face_expression_recognition_model-weights_manifest.json`
   - `face_expression_recognition_model-shard1`
3. Tạo thư mục `model/` trong repo và upload các file trên vào đó
4. Trong `face.js`, đổi dòng:
   ```js
   const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
   ```
   Thành:
   ```js
   const MODEL_URL = "./model";
   ```

> **Lưu ý**: Nếu không download model về, hệ thống vẫn chạy được nhờ CDN jsdelivr, nhưng cần kết nối internet.

---

## 🧠 Cách nhận diện khuôn mặt hoạt động

```
Camera → face-api.js detect khuôn mặt → Tạo 128-dim descriptor
    ↓
Load ảnh sinh viên từ Google Sheet → Tạo descriptor tham chiếu
    ↓
So sánh euclidean distance (ngưỡng 0.5)
    ↓
Match → Điểm danh với tên SV | No match → Ghi nhận MSV
    ↓
Gửi ảnh + thời gian + GPS lên Google Sheet
```

---

## 📁 Cấu trúc file

| File | Mô tả |
|------|-------|
| `index.html` | Trang chủ + giao nhiệm vụ |
| `faceID.html` | Giao diện quét Face ID |
| `face.js` | Logic nhận diện khuôn mặt (face-api.js) |
| `dashboard.html` | Dashboard xem nhiệm vụ + countdown |
| `dashboard.js` | Logic dashboard |
| `manage.html` | Quản lý điểm danh (bảng + search) |
| `manage.js` | Logic quản lý |
| `app.js` | Logic giao nhiệm vụ |
| `bia.png` | Ảnh bìa để in nhiệm vụ |
| `model/` | Thư mục chứa model AI (tự download) |

---

## ⚙️ Cài đặt Google Sheet API

Cập nhật 2 URL trong code:

**app.js & dashboard.js** (nhiệm vụ):
```js
const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

**face.js & manage.js** (điểm danh):
```js
const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

---

## 🎯 Tính năng

- ✅ Nhận diện khuôn mặt AI (face-api.js, chạy trên browser)
- ✅ So sánh khuôn mặt với CSDL Google Sheet
- ✅ Realtime face detection với landmarks
- ✅ Lấy vị trí GPS tự động
- ✅ Dashboard countdown deadline
- ✅ Bảng quản lý điểm danh với search/filter
- ✅ Giao diện Modern/Minimalist responsive
- ✅ Không cần backend, chạy GitHub Pages
