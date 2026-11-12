"""Download one public video into the invocation's owned workspace."""
from __future__ import annotations

import re
import os
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from .protocol import WorkerError


def video_url(value: str) -> str:
    if not isinstance(value, str):
        raise WorkerError("INVALID_VIDEO_URL", "Hãy nhập liên kết video hợp lệ.")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password or parsed.port:
        raise WorkerError("INVALID_VIDEO_URL", "Liên kết video phải là địa chỉ video HTTP(S) công khai.")
    host, path, query = parsed.hostname, parsed.path, parse_qs(parsed.query)
    if host == "youtu.be":
        identity = path.strip("/")
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        identity = query.get("v", [""])[0] if path == "/watch" else path.removeprefix("/shorts/").strip("/") if path.startswith("/shorts/") else ""
    else:
        identity = ""
    if re.fullmatch(r"[\w-]{11}", identity, re.ASCII):
        return f"https://www.youtube.com/watch?v={identity}"
    if host in {"bilibili.com", "www.bilibili.com", "m.bilibili.com"}:
        match = re.fullmatch(r"/video/(BV[\da-zA-Z]{10}|av\d+)/?", path)
        part = query.get("p", [""])[0]
        if match and (not part or re.fullmatch(r"[1-9]\d*", part)):
            return f"https://www.bilibili.com/video/{match[1]}/" + (f"?p={part}" if part else "")
    if host == "b23.tv" and re.fullmatch(r"/[\da-zA-Z]+/?", path):
        return f"https://b23.tv{path}"
    raise WorkerError("INVALID_VIDEO_URL", "Hãy nhập một liên kết video YouTube hoặc Bilibili.")


class VideoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        # Validate before following a short link; never fetch arbitrary targets.
        return super().redirect_request(request, response, code, message, headers, video_url(newurl))


class DownloadLog:
    def debug(self, message):
        print(message, file=sys.stderr)
    info = debug
    warning = debug
    error = debug


def download_video(url: str, work: Path, wire, *, proxy_port: int | None) -> tuple[Path, dict]:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils.networking import std_headers
    from backend.app.config import ffmpeg_binary
    from backend.app.v1.media import inspect_video

    if proxy_port is None or proxy_port == "":
        proxy_port = 0
    if type(proxy_port) is not int or not 0 <= proxy_port <= 65535:
        raise WorkerError("INVALID_CONFIG", "Cổng proxy HTTP cục bộ phải từ 1–65535; 0 hoặc để trống nghĩa là kết nối trực tiếp.")
    proxy = f"http://127.0.0.1:{proxy_port}" if proxy_port else ""
    url = video_url(url)
    wire.check_cancel()
    wire.progress(None, "Đang đọc liên kết video")
    if urlparse(url).hostname == "b23.tv":
        proxies = {"http": proxy, "https": proxy} if proxy else {}
        with build_opener(ProxyHandler(proxies), VideoRedirect()).open(Request(url, headers=std_headers), timeout=20) as response:
            url = video_url(response.url)
        if urlparse(url).hostname == "b23.tv":
            raise WorkerError("INVALID_VIDEO_URL", "Liên kết rút gọn Bilibili không trỏ tới video.")
    last_update = 0.0

    def admission(info, *, incomplete=False):
        wire.check_cancel()
        if info.get("is_live") or info.get("live_status") == "is_upcoming":
            raise WorkerError("UNSUPPORTED_MEDIA", "Chưa hỗ trợ phát trực tiếp hoặc video chưa được công bố.")

    def progress(event):
        nonlocal last_update
        wire.check_cancel()
        count = event.get("downloaded_bytes", 0)
        total = event.get("total_bytes") or event.get("total_bytes_estimate")
        stamp = time.monotonic()
        if stamp - last_update >= 0.4 or event.get("status") == "finished":
            last_update = stamp
            value = min(count / total, 1) if total else None
            wire.progress(value, "Đang tải video" if event.get("status") != "finished" else "Đang ghép và kiểm tra video")

    ffmpeg = shutil.which(ffmpeg_binary())
    if not ffmpeg:
        raise WorkerError("MEDIA_TOOLS_UNAVAILABLE", "Không tìm thấy FFmpeg nên không thể ghép video đã tải.")
    node = os.getenv("YOUDUB_NODE_PATH", "").strip()
    if node:
        if not Path(node).is_absolute() or not Path(node).is_file() or not os.access(node, os.X_OK):
            raise WorkerError("RUNTIME_UNAVAILABLE", "Đường dẫn Node.js riêng của YouDub không hợp lệ hoặc không thể thực thi.")
    elif os.getenv("YOUDUB_HARNESS_RUNTIME") == "1":
        raise WorkerError("RUNTIME_UNAVAILABLE", "Chưa cấu hình đường dẫn Node.js riêng của YouDub.")
    else:
        node = shutil.which("node") or "node"
    options = {
        # Original youdub/downloader.py also passes an explicit yt-dlp proxy URL.
        # The node owns this value; an empty string explicitly selects direct access.
        "proxy": proxy,
        "outtmpl": str(work / "source.%(ext)s"), "noplaylist": True,
        "allowed_extractors": ["youtube$", "bilibili$"],
        "format": "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]",
        "merge_output_format": "mp4", "ffmpeg_location": ffmpeg,
        "js_runtimes": {"node": {"path": node}},
        "retries": 0, "fragment_retries": 0, "extractor_retries": 0,
        "file_access_retries": 0, "socket_timeout": 20,
        "skip_unavailable_fragments": False, "ignoreerrors": False,
        "continuedl": False, "overwrites": False,
        "match_filter": admission, "progress_hooks": [progress], "logger": DownloadLog(),
        "quiet": True, "noprogress": True,
    }
    with YoutubeDL(options) as downloader:
        info = downloader.extract_info(url, download=True)
        wire.check_cancel()
        if not info or info.get("_type", "video") != "video":
            raise WorkerError("INVALID_MEDIA", "Liên kết không trả về một video duy nhất.")
        path = Path(downloader.prepare_filename(info)).resolve()
    if not path.is_relative_to(work.resolve()) or not path.is_file() or not path.stat().st_size:
        raise WorkerError("DOWNLOAD_MISSING", "Quá trình tải không tạo ra tệp video hoàn chỉnh.")
    media = inspect_video(path, wire.check_cancel)
    wire.progress(1, "Đã tải xong video")
    return path, {"sourceUrl": url, "title": info.get("title"), "durationMs": media["duration_ms"]}
