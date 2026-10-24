# Magic World

Web game nhập vai hầm ngục 2D (HTML5 Canvas, JavaScript thuần, không cần build).

## Chạy thử
- Mở bằng một web server tĩnh (vd. `python3 -m http.server`) rồi vào `http://localhost:8000`.
  Mở trực tiếp file `index.html` bằng `file://` sẽ không tải được `assets/tiles.json`.
- GitHub Pages: đẩy toàn bộ thư mục này lên repo, bật Pages cho nhánh chính.

## Cấu trúc
- `js/data.js`  – dữ liệu: class, kỹ năng, quái, boss, vùng đất, item, độ hiếm, công thức XP.
- `js/core.js`  – tải asset, lưu game (localStorage), sinh item, tính chỉ số.
- `js/world.js` – sinh hầm ngục ngẫu nhiên, tầng boss, thị trấn, vẽ bản đồ.
- `js/game.js`  – vòng lặp game, di chuyển, chiến đấu, kỹ năng, AI quái, boss, loot, render.
- `js/ui.js`    – giao diện: tạo nhân vật, HUD, túi đồ, kỹ năng, cửa hàng, lò rèn, cảm ứng.
- `tools/gen_heroes.py` – script tạo sprite 5 class từ bộ "Nhan vat mac dinh" (Pillow).

## Chỉnh nhanh
- Cân bằng quái/boss: `MONSTERS`, `BOSSES`, `floorScale()` trong `data.js`.
- Thêm kỹ năng: thêm vào `SKILLS` và danh sách `skills` của class (4 chủ động + 2 bị động).
- Tốc độ lên cấp: `xpNeed()`.

## Bản quyền hình ảnh
Toàn bộ sprite/tile lấy từ các bộ Liberated Pixel Cup (LPC) và OpenGameArt trong source gốc,
giấy phép CC-BY-SA 3.0 / GPL 3.0 / OGA-BY. Khi phát hành phải giữ ghi công tác giả — xem thư mục `credits/`.
