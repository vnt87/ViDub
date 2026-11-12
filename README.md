<p align="center">
  <img src="site/assets/youdub-logo.svg" alt="YouDub" width="520" />
</p>

# YouDub Desktop

Không gian làm việc bản địa hóa video mã nguồn mở: nhập video, nhận dạng, dịch và nhân bản giọng gốc từng câu, rồi tạo phụ đề và video lồng tiếng hoàn chỉnh.

[English](README.en.md) · [Trang web và nghe thử](https://liuzhao1225.github.io/YouDub-webui/) · [Tải bản mới nhất](https://github.com/liuzhao1225/YouDub-webui/releases/latest) · [Cài đặt và nâng cấp](docs/upgrade.md) · [Cộng đồng](#cộng-đồng)

## Ví dụ kết quả

Demo mặc định là bài phỏng vấn Jensen Huang được tạo ngày 2026-10-09: nhân bản giọng gốc từng câu, giữ phụ đề tiếng Trung và âm thanh nền, độ dài đầy đủ khoảng 59 giây. Liên kết video gốc chỉ dùng để ghi nguồn ví dụ; không gian làm việc hỗ trợ cả liên kết video lẫn nhập tệp cục bộ.

### 1. Phỏng vấn Jensen Huang · hiệu quả mới nhất

[Video gốc](https://www.youtube.com/shorts/TbotsRXyRME) · YouTube Shorts · Anh -> Trung

<table>
<tr><th>Tiếng Anh gốc</th><th>Bản lồng tiếng tiếng Trung</th></tr>
<tr>
<td>

https://github.com/user-attachments/assets/befd11ca-e720-4faa-b4e0-d89bfe73df87

</td>
<td>

https://github.com/user-attachments/assets/60d5dbb0-f346-4c14-adad-2d0c481ac4fb

</td>
</tr>
</table>

### 2. Ví dụ lịch sử: How much YT paid me for 129 million shorts views

[Video gốc](https://www.youtube.com/watch?v=ii9Kh4XkA5g) · video ngang dài trên YouTube · Anh -> Trung · Dưới đây là đoạn cắt 40 giây đầu; bản đầy đủ có thể tải tại Release [`demo-assets`](https://github.com/liuzhao1225/YouDub-webui/releases/tag/demo-assets)

<table>
<tr><th>Tiếng Anh gốc</th><th>Bản lồng tiếng tiếng Trung</th></tr>
<tr>
<td>

https://github.com/user-attachments/assets/bd02936f-cf3c-4e4b-85b5-0410d38f69f5

</td>
<td>

https://github.com/user-attachments/assets/158de60a-7de4-4ddf-b3d8-478d0423aee6

</td>
</tr>
</table>

### 3. Me at the zoo

[Video gốc](https://www.youtube.com/watch?v=jNQXAC9IVRw) · Anh → Trung · 19 giây

[Nghe thử đổi qua lại Anh/Trung trên trang web](https://liuzhao1225.github.io/YouDub-webui/?demo=zoo#demo). Nút "Xem ví dụ trên trang web" trong không gian làm việc và trang chuẩn bị môi trường mở trang web để nghe thử. Gói cài đặt chỉ giữ video gốc của bài phỏng vấn Jensen Huang, có thể dùng trực tiếp làm đầu vào quy trình cục bộ.

## Có thể làm gì

| Chế độ đầu ra | Nội dung tạo ra |
| --- | --- |
| Giọng gốc + phụ đề | Giữ nguyên âm thanh gốc, tạo và ghi phụ đề ngôn ngữ đích vào video |
| Lồng tiếng | Tạo giọng lồng tiếng ngôn ngữ đích, có thể giữ âm thanh nền đã tách |
| Phụ đề + lồng tiếng | Xuất video lồng tiếng có phụ đề, có thể chọn căn chỉnh cưỡng bức theo giọng nói |

- **Nhân bản giọng gốc từng câu.** Mỗi câu dịch dùng đoạn âm thanh của đúng câu gốc làm tham chiếu, giữ quan hệ một-một giữa câu và âm thanh tham chiếu.
- **Hiển thị phụ đề.** Tách dòng theo dấu phẩy, dấu ngắt tiếng Trung và các dấu tương tự, gộp các đoạn quá ngắn, ẩn dấu phân cách ở cuối đoạn phụ đề.
- **Quản lý tác vụ.** Xem ảnh bìa, tiến độ từng bước, lỗi và sản phẩm; hỗ trợ hủy, thử lại, tạo lại, phát và tải xuống.

Không gian làm việc cho phép chọn video và quy trình, đồng thời hiển thị các tùy chọn nhanh do nút khai báo. Ngôn ngữ, mô hình, thiết bị, giọng và tham số phụ đề được lưu trong nút quy trình; nhà cung cấp mô hình, môi trường cục bộ và việc cài đặt mô hình được quản lý trong phần Cài đặt.

## Ảnh giao diện

Không gian làm việc: nhập video, chọn ngôn ngữ và nội dung đầu ra.

![Không gian làm việc YouDub: nhập video, ngôn ngữ gốc và đích, tùy chọn lồng tiếng và phụ đề](docs/images/workbench.jpg)

<details>
<summary>Xem thư viện tác vụ và chi tiết tác vụ</summary>

Thư viện tác vụ: ảnh bìa video, trạng thái xử lý và các tác vụ đã có.

![Thư viện tác vụ YouDub: ảnh bìa video và các tác vụ đã hoàn tất](docs/images/task-library.jpg)

Chi tiết tác vụ: xem trước sản phẩm, các bước xử lý, âm thanh lồng tiếng và tải phụ đề.

![Chi tiết tác vụ YouDub: video hoàn chỉnh có phụ đề tiếng Trung, tám bước đã hoàn tất và tệp đã tạo](docs/images/task-detail.jpg)

</details>

## Tải và sử dụng

[Cài đặt Windows EXE](https://github.com/liuzhao1225/YouDub-webui/releases/latest/download/YouDub-windows-x64-Setup.exe) · [macOS DMG](https://github.com/liuzhao1225/YouDub-webui/releases/latest/download/YouDub-macOS-arm64.dmg) · [Ghi chú phiên bản và bản portable](https://github.com/liuzhao1225/YouDub-webui/releases/latest)

Lần khởi động đầu tiên chuẩn bị môi trường chạy cơ bản; mô hình và phụ thuộc suy luận cần thiết được chuẩn bị theo quy trình. Yêu cầu cài đặt và cách nâng cấp xem [hướng dẫn cài đặt](docs/upgrade.md).

1. Trong lần cấu hình đầu tiên hoặc tại **Cài đặt → Mô hình**, thêm nhà cung cấp, khóa và mô hình dịch.
2. Trong **Không gian làm việc**, nhập video, chọn quy trình và điều chỉnh tùy chọn nút, rồi làm theo hướng dẫn để chuẩn bị tài nguyên cần thiết và tạo tác vụ.
3. Trong **Thư viện**, theo dõi tiến độ, phát hoặc tải kết quả.

## Cộng đồng

Nhóm trao đổi QQ: `618246010`

<p align="center">
  <img src="apps/web/public/qq-group-618246010.jpg" alt="Mã QR nhóm trao đổi QQ của YouDub" width="220" />
</p>

## Chạy YouDub Desktop từ mã nguồn

YouDub cung cấp dịch video, lồng tiếng, điều phối quy trình và duyệt thủ công, sử dụng Electron và framework DeepSeek Harness đã được cắt gọn. Khi phát triển, hãy bắt đầu từ [mục lục tài liệu](apps/harness/docs/README.md), [kiến trúc](apps/harness/docs/ARCHITECTURE.md) và [chạy cục bộ](apps/harness/docs/DEVELOPMENT.md).

Cần Node.js `^22.19.0 || >=24.0.0`, npm, Git và công cụ build của nền tảng; lần đầu clone thì khởi tạo submodule. Tại thư mục gốc của kho, chạy:

```bash
npm ci --registry=https://registry.npmmirror.com
npm --prefix apps/web ci --registry=https://registry.npmmirror.com
npm --prefix apps/harness ci --registry=https://registry.npmmirror.com
npm run build:framework
npm run build:youdub
npm start
```

`npm start` và `npm run dev` cùng khởi động một ứng dụng Electron; `npm run build:desktop` là bí danh của `build:youdub` và tạo bản phát triển. `npm run package:desktop -- --dir` tạo ứng dụng độc lập; gói cài đặt chính thức, ký và phát hành xem [quy trình phát hành](docs/releasing.md). Gỡ lỗi trên trình duyệt, thư mục dữ liệu riêng và build lại sau khi sửa xem [phát triển cục bộ](apps/harness/docs/DEVELOPMENT.md).

Lần khởi động đầu tiên, chọn ngôn ngữ giao diện và thư mục cài đặt dữ liệu, rồi chuẩn bị tài nguyên chạy và cấu hình mô hình dịch trên trang. Ứng dụng dùng môi trường Python, mô hình và cấu hình riêng; việc dịch gọi qua dịch vụ mô hình của Harness, dùng giao thức và tham số mô hình của nhà cung cấp đã cấu hình. Trạng thái chuẩn bị môi trường cơ bản và tài nguyên của từng quy trình được hiển thị riêng.

Việc chạy từ mã nguồn của các bản đã phát hành, vỏ desktop Swift/C# và quy trình phát hành xem [ghi chú trước khi cải tạo](https://github.com/liuzhao1225/YouDub-webui/blob/711e40e8e69d2c6f2065f15aecc90550dcbf695d/README.md#main-版本源码运行). Nguồn và phạm vi giữ lại của Harness xem [ghi chú mã nguồn](vendor/deepseek-harness/README.md).

## Everything is a plugin

YouDub dùng runtime plugin Cordis để lắp ráp tác vụ, quy trình, phụ đề, lồng tiếng, tài nguyên và các trang nghiệp vụ. Cửa sổ desktop, kết nối, cấu hình mô hình, LLM, tiến trình con, Jobs và quản lý plugin tái sử dụng mã framework được giữ lại; ứng dụng dùng điểm khởi động và thư mục chạy riêng. [Tổ hợp sản phẩm](apps/harness/cordis.patch.yml) xác định dịch vụ và trang hiện tại.

```text
YouDub Electron → Desktop Host ← Connection ← Trang YouDub
                         ↓
                 Plugin quy trình và tác vụ YouDub
                         ↓
                 LLM / Subprocess / Jobs
                         ↓
                 Dịch / xử lý media bằng Python
```

Giao diện dùng Harness Renderer, Slots, Layout, Store, chủ đề, ngôn ngữ và các điều khiển chung, kết nối với các thành phần nghiệp vụ YouDub, canvas React Flow và hiệu ứng màn hình đầu. Phân công trách nhiệm và ánh xạ mã nguồn xem [kiến trúc](apps/harness/docs/ARCHITECTURE.md), [phát triển giao diện](apps/harness/docs/FRONTEND-DEVELOPMENT.md) và [phát triển backend và quy trình](apps/harness/docs/BACKEND-DEVELOPMENT.md).

## Cài đặt và phát triển plugin

Quản lý plugin trong trang **Mở rộng** của ứng dụng; cài đặt, bật/tắt và gỡ cài đặt do PluginManager của Harness thực hiện. Nút, nhà cung cấp và trang tuân theo hợp đồng nghiệp vụ của YouDub; cách tích hợp và ví dụ cho Host, Client và Python độc lập xem [phát triển backend và mở rộng](apps/harness/docs/BACKEND-DEVELOPMENT.md). Hiện chưa có chợ plugin trực tuyến YouDub nào được phát hành.

## Phạm vi hiện tại

- **Tách câu tiếng Anh.** Sau khi Whisper nhận dạng, dùng NLTK Punkt để chỉnh các câu hoàn chỉnh, và dùng mốc thời gian theo từ để xác định phạm vi âm thanh gốc; kết quả nhận dạng gốc được giữ lại.
- Quy trình mặc định nhận video cục bộ, FFmpeg kiểm tra và xử lý các luồng âm thanh/hình thực tế; không đặt giới hạn độ dài, dung lượng, độ phân giải hay tốc độ khung hình.
- Thư mục ngôn ngữ hiện có tiếng Anh, tiếng Trung và tiếng Nhật; khả năng cụ thể phụ thuộc vào nhà cung cấp. Căn chỉnh Qwen tùy chọn hỗ trợ tiếng Anh và tiếng Trung.
- Quy trình nút hỗ trợ rẽ nhánh, hợp nhất và hiệu chỉnh thủ công, thực thi tuần tự theo từng slot; khi chờ người xác nhận, slot được giải phóng. Bật/tắt plugin có hiệu lực sau khi khởi động lại. Chưa hỗ trợ thay thế nóng, chợ plugin, vòng lặp và worker phân tán; sẽ bổ sung khi có nhu cầu.
- Plugin quy trình cục bộ, Client và Python đã được kiểm chứng; việc cài đặt plugin từ xa qua GitHub/npm chưa được nghiệm thu.
- HTTP hiện tại là `/api/v2`, hỗ trợ tạo lại tác vụ từ một bước chỉ định. Điểm vào HTTP FastAPI / v1 cũ đã được gỡ bỏ. Tải liên kết đi qua `media.download/v1` vào luồng tác vụ hiện có, hỗ trợ liên kết video đơn của YouTube, Shorts, Bilibili và b23.tv; dùng yt-dlp, Node.js và FFmpeg, giữ chất lượng video gốc và không đặt giới hạn thời lượng hay dung lượng.

Nâng cấp từ phiên bản cũ và di chuyển dữ liệu, hãy đọc trước [hướng dẫn chạy](docs/design/cordis-plugin-runtime.md#1-安装与配置). Kết quả nghiệm thu tác vụ thật, di chuyển và phạm vi chưa xác minh được ghi tại [nghiệm thu di chuyển](https://github.com/liuzhao1225/YouDub-webui/blob/c92b670f079428eed40ca6ab7bdfd69e3328fef4/docs/design/cordis-plugin-migration.md), [nghiệm thu tách câu](docs/validation/asr-punkt-sentences-2026-10-09.json) và [nghiệm thu hiển thị phụ đề](docs/validation/subtitle-display-2026-10-09.json).

## Phát triển và kiểm thử

```bash
npm run typecheck
npm test
npm run test:backend
npm --prefix apps/web test
npm run lint:web
npm run build:youdub
npm --prefix apps/harness test
```

```text
apps/harness/      Điểm vào ứng dụng Electron, plugin Host/Client và công cụ phát triển
vendor/deepseek-harness/source/  Bản fork framework Harness đang dùng
packages/builtin/test/helpers/  Bộ dữ liệu kiểm thử nghiệp vụ, sản phẩm được khởi động bởi Harness Host
packages/sdk/      Hợp đồng dịch vụ công khai, workflow và operation
packages/builtin/  Dịch vụ nền, engine tác vụ chung, workflow và cầu nối mô hình
backend/workers/   Tính toán Python và cầu nối giao dịch SQLite
backend/app/       Định dạng mô hình, media, thông tin xác thực và dữ liệu lịch sử
apps/web/          Thành phần nghiệp vụ dùng lại, logic phía client, liên kết React và trang
fixtures/plugins/  Ví dụ plugin Host/Client/Python độc lập
submodule/demucs/   Submodule mã nguồn Demucs
```

Hoan nghênh đóng góp qua Issue / PR để cải thiện trải nghiệm cài đặt, thích ứng mô hình, tối ưu phụ đề và căn chỉnh âm thanh-hình, hoặc cung cấp plugin nguồn/quy trình độc lập. Thư mục `docs/` giữ các tài liệu thiết kế lịch sử; hướng dẫn phát triển hiện hành là README này và [hướng dẫn phát triển Desktop](apps/harness/docs/DEVELOPMENT.md).

## Giấy phép mã nguồn mở

Dự án dùng Apache License 2.0, xem chi tiết tại [LICENSE](LICENSE).

Gương trong nước: [AtomGit](https://atomgit.com/liuzhao1225/YouDub-webui), được đồng bộ một chiều từ [kho chính trên GitHub](https://github.com/liuzhao1225/YouDub-webui). Release, Issue và PR được quản lý trên GitHub.

Tác giả: [刘朝 Zhao Liu](https://liuzhao1225.github.io/) · [GitHub](https://github.com/liuzhao1225) · [Bilibili 黑纹白斑马](https://space.bilibili.com/1263732318)

[Star History](https://www.star-history.com/?repos=liuzhao1225%2FYouDub-webui&type=date&legend=top-left)
