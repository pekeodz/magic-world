# Đưa Magic World lên Firebase + GitHub Pages

## A. Firebase (lưu nhân vật lên đám mây)
1. Vào https://console.firebase.google.com → Add project → đặt tên (vd. magic-world) → tắt Google Analytics cũng được → Create.
2. Build → Authentication → Get started → tab Sign-in method → bật **Google** → chọn email hỗ trợ → Save.
3. Build → Firestore Database → Create database → chọn vùng gần (asia-southeast1) → Start in **production mode**.
4. Firestore → tab **Rules** → xóa hết, dán nội dung file `firestore.rules` → Publish.
5. Project settings (bánh răng) → Your apps → bấm biểu tượng **</>** (Web) → đặt tên → Register app → copy khối `firebaseConfig`.
6. Mở `js/firebase-config.js`, dán 6 giá trị (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) vào.
7. Authentication → Settings → **Authorized domains** → Add domain → thêm `TEN-GITHUB-CUA-BAN.github.io`.

apiKey của Firebase để công khai trên GitHub là bình thường — bảo mật nằm ở Rules ở bước 4.

## B. GitHub Pages
Cách 1 – kéo thả trên web (dễ nhất)
1. https://github.com/new → đặt tên repo (vd. magic-world) → Public → Create repository.
2. Bấm "uploading an existing file" → kéo **toàn bộ nội dung bên trong** thư mục magic-world (index.html, js, assets, ...) vào → Commit changes.
3. Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save.
4. Đợi 1–2 phút, game ở: https://TEN-GITHUB-CUA-BAN.github.io/magic-world/

Cách 2 – dùng git
    cd magic-world
    git init
    git add .
    git commit -m "Magic World"
    git branch -M main
    git remote add origin https://github.com/TEN-GITHUB-CUA-BAN/magic-world.git
    git push -u origin main
Cập nhật về sau:
    git add .
    git commit -m "cap nhat"
    git push

## Kiểm tra
Mở link game → màn hình chính có ô "Đăng nhập Google". Đăng nhập, tạo nhân vật, chơi một lúc,
rồi mở Firestore → Data sẽ thấy collection `players`.
Lỗi "Tên miền chưa được thêm" = làm lại bước A7.
