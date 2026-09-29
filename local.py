#!/usr/bin/env python3
"""Fossildle 本地开发工具（Python 3.10+，仅标准库）。

python3 local.py                         开发服务器，支持热更新
python3 local.py dev --debug --open      开发日志并打开浏览器
python3 local.py build --debug           构建 dist，包含源码映射
python3 local.py preview --debug --open  构建并模拟 GitHub Pages
python3 local.py preview --skip-build    仅预览现有 dist，无需 Node
python3 local.py dev --unlock-all        开发服务器，并解锁全部结构图鉴

每次 dev 启动或重新构建会生成新的本地版本，浏览器首次载入该版本时清空游戏存档并允许重新抽取。
同版本刷新、热更新及 --skip-build 不再重置。仅影响本机/私网访问，不影响 GitHub Pages 正式站。
--unlock-all 只在 localhost 与私网地址生效，避免调试开关随构建产物公开。
"""

import argparse
import functools
import mimetypes
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.error import URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import urlopen
import webbrowser

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def log(message: str) -> None:
    print(f"[Fossildle] {message}", flush=True)


def port_number(value: str) -> int:
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("端口必须是整数。") from error
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("端口范围为 1～65535。")
    return port


def base_path(value: str) -> str:
    if value == "/":
        return value
    parts = value.strip("/").split("/")
    if not parts or any(not re.fullmatch(r"[A-Za-z0-9_.-]+", part) or part in (".", "..") for part in parts):
        raise argparse.ArgumentTypeError("子路径只能包含字母、数字、下划线、短横线和点，不能包含 ..。")
    return "/" + "/".join(parts) + "/"


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", nargs="?", choices=("dev", "build", "preview"), default="dev", help="默认 dev；preview 默认先重新构建")
    parser.add_argument("--host", choices=("127.0.0.1", "localhost", "0.0.0.0"), default="127.0.0.1", help="默认仅本机；0.0.0.0 可供局域网访问")
    parser.add_argument("--port", type=port_number, help="dev 默认 5173，preview 默认 4173；启动前自动停止该端口的 TCP 监听进程（包括其他项目）")
    parser.add_argument("--base-path", type=base_path, help="dev 默认 /，preview 默认 /Fossildle/；仅影响本地服务")
    parser.add_argument("--open", action="store_true", help="服务就绪后打开浏览器")
    parser.add_argument("--debug", action="store_true", help="dev 开启 Vite 日志；build/preview 构建生成 source map")
    parser.add_argument("--install", action="store_true", help="强制执行 npm ci 重装依赖；缺少依赖时自动安装")
    parser.add_argument("--skip-build", action="store_true", help="仅用于 preview，直接预览已有 dist")
    parser.add_argument("--unlock-all", action="store_true", help="解锁全部结构图鉴，默认关闭；仅在 localhost 与私网地址生效")
    args = parser.parse_args(argv)
    if args.skip_build and args.mode != "preview":
        parser.error("--skip-build 仅适用于 preview。")
    if args.skip_build and (args.debug or args.install or args.unlock_all):
        parser.error("--skip-build 不能与 --debug、--install 或 --unlock-all 同用；调试构建请移除 --skip-build。")
    if args.mode == "build" and (args.open or args.port is not None or args.base_path is not None or args.host != "127.0.0.1" or args.unlock_all):
        parser.error("build 只生成文件，不接受 --open、--host、--port、--base-path 或 --unlock-all；需要解锁全部图鉴请用 dev 或 preview。")
    args.port = args.port or (5173 if args.mode == "dev" else 4173)
    args.base_path = args.base_path or ("/" if args.mode == "dev" else "/Fossildle/")
    return args


def listening_pids(port: int) -> set[int]:
    tool = shutil.which("netstat" if os.name == "nt" else "lsof")
    if not tool:
        raise RuntimeError("无法检查端口：Windows 需要 netstat，macOS/Linux 需要 lsof。请安装相应系统工具后重试。")
    command = [tool, "-ano", "-p", "TCP"] if os.name == "nt" else [tool, "-nP", "-a", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=5)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"检查端口 {port} 超时，未终止任何进程。") from error
    if os.name != "nt" and result.returncode == 1 and not result.stdout.strip() and not result.stderr.strip():
        return set()
    if result.returncode != 0:
        raise RuntimeError(f"无法检查端口 {port}：{result.stderr.strip() or '系统工具执行失败'}")
    if os.name == "nt":
        pids = set()
        for line in result.stdout.splitlines():
            fields = line.split()
            if len(fields) == 5 and fields[0] == "TCP" and fields[3] == "LISTENING" and fields[1].rsplit(":", 1)[-1] == str(port) and fields[4].isdigit():
                pids.add(int(fields[4]))
        return pids
    return {int(line) for line in result.stdout.splitlines() if line.isdigit()}


def terminate_listener(pid: int, port: int, force: bool = False) -> None:
    if pid in (0, 1, os.getpid(), os.getppid()):
        raise RuntimeError(f"端口 {port} 由受保护进程 PID {pid} 占用，请改用 --port。")
    if pid not in listening_pids(port):
        return
    log(f"端口 {port} 被 PID {pid} 占用，{'强制结束' if force else '正在停止'}该监听进程……")
    try:
        if os.name == "nt":
            result = subprocess.run(["taskkill", "/PID", str(pid)] + (["/F"] if force else []), capture_output=True, text=True, timeout=5)
            if result.returncode and pid in listening_pids(port):
                raise RuntimeError(f"无法停止 PID {pid}：{result.stderr.strip() or result.stdout.strip()}")
        else:
            os.kill(pid, signal.SIGKILL if force else signal.SIGTERM)
    except ProcessLookupError:
        pass
    except PermissionError as error:
        raise RuntimeError(f"没有权限停止占用端口 {port} 的 PID {pid}；请手动停止它，或使用 --port。不会自动提权。") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"停止 PID {pid} 超时，未启动服务。") from error


def wait_for_port(port: int, timeout: float) -> set[int]:
    deadline = time.monotonic() + timeout
    while True:
        remaining = listening_pids(port)
        if not remaining or time.monotonic() >= deadline:
            return remaining
        time.sleep(0.15)


def release_port(port: int) -> None:
    pids = listening_pids(port)
    if not pids:
        return
    protected = pids & {0, 1, os.getpid(), os.getppid()}
    if protected:
        raise RuntimeError(f"端口 {port} 由受保护进程 {sorted(protected)} 占用，请改用 --port。")
    for pid in sorted(pids):
        terminate_listener(pid, port)
    remaining = wait_for_port(port, 3)
    if remaining - pids:
        raise RuntimeError(f"端口 {port} 被新进程重新占用，已停止自动清理。请关闭自动重启该服务的程序，或使用 --port。")
    for pid in sorted(remaining):
        terminate_listener(pid, port, force=True)
    if remaining and wait_for_port(port, 2):
        raise RuntimeError(f"端口 {port} 仍被占用，未启动服务。请手动检查，或使用 --port。")
    log(f"端口 {port} 已释放。")


def stop_process(process: subprocess.Popen) -> None:
    if os.name == "posix":
        for sig, timeout in ((signal.SIGINT, 4), (signal.SIGTERM, 2), (signal.SIGKILL, 2)):
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                break
            except PermissionError:
                if process.poll() is not None:
                    break
                process.send_signal(sig)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                continue
            # npm 可能先退出；已消失或不可访问的进程组无需再次清理。
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            break
    elif process.poll() is None:
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    process.wait()


def open_when_ready(url: str, process: subprocess.Popen, cancelled: threading.Event) -> None:
    for _ in range(100):
        if cancelled.is_set() or process.poll() is not None:
            return
        try:
            with urlopen(url, timeout=0.5) as response:
                if response.status == 200 and not cancelled.is_set() and process.poll() is None:
                    webbrowser.open(url)
                    return
        except (OSError, URLError):
            pass
        if cancelled.wait(0.2):
            return
    log(f"浏览器未自动打开，可手动访问 {url}")


def local_environment(unlock_all: bool = False) -> dict[str, str]:
    import uuid
    environment = os.environ.copy()
    environment["VITE_FOSSILDLE_LOCAL_BUILD"] = f"{time.time_ns():020d}-{uuid.uuid4().hex}"
    log("本地模式：载入此次版本时重置化石存档与身份，可重新抽取；同版本刷新不重置。")
    if unlock_all:
        environment["VITE_FOSSILDLE_UNLOCK_ALL"] = "1"
        log("已开启 --unlock-all：结构图鉴全部解锁（仅 localhost 与私网地址生效）。")
    return environment


def run(command: list[str], open_url: Optional[str] = None, *, reset_local: bool = False, unlock_all: bool = False) -> None:
    log("执行：" + " ".join(command))
    options = {"start_new_session": True} if os.name == "posix" else {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    process = subprocess.Popen(command, cwd=ROOT, env=local_environment(unlock_all) if reset_local else None, **options)
    cancelled = threading.Event()
    if open_url:
        threading.Thread(target=open_when_ready, args=(open_url, process, cancelled), daemon=True).start()
    try:
        result = process.wait()
    except BaseException:
        cancelled.set()
        stop_process(process)
        raise
    finally:
        cancelled.set()
    if result:
        raise subprocess.CalledProcessError(result, command)


def prepare_dependencies(force: bool = False) -> str:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        raise RuntimeError("未找到 Node.js/npm。请安装 Node.js 24 LTS 后重试。Python 不会替代前端构建工具。")
    version = subprocess.run([node, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version)
    if not match or tuple(map(int, match.groups())) < (22, 12, 0):
        raise RuntimeError(f"当前 Node.js {version} 不满足项目要求 >=22.12.0，推荐 Node.js 24 LTS。")
    log(f"项目目录：{ROOT}；Node.js {version}")
    if not (ROOT / "package-lock.json").is_file():
        raise RuntimeError("缺少 package-lock.json，无法进行可复现安装。请恢复锁文件。")
    installed = all((ROOT / "node_modules" / path).is_file() for path in ("vite/bin/vite.js", "typescript/bin/tsc"))
    if force or not installed:
        log("正在按锁文件安装依赖（包含构建所需的开发依赖）……")
        run([npm, "ci", "--include=dev", "--no-audit", "--no-fund"])
    return npm


def build(npm: str, debug: bool, unlock_all: bool = False) -> None:
    run([npm, "run", "build"] + (["--", "--sourcemap"] if debug else []), reset_local=True, unlock_all=unlock_all)
    if not (DIST / "index.html").is_file():
        raise RuntimeError("构建未生成 dist/index.html，已停止预览。")
    log(f"构建完成：{DIST}")
    if debug:
        log("已生成 source map，可在浏览器开发者工具 Sources 中定位 TS/TSX 源码；请勿将调试产物当作正式发布包。")


class PagesHandler(SimpleHTTPRequestHandler):
    """只暴露 dist 内的文件；不列目录，不为未知路径回退 index.html。"""

    def __init__(self, *args, directory: str, mount: str, **kwargs):
        self.root = Path(directory).resolve()
        self.mount = mount
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if self.mount != "/" and path == self.mount.rstrip("/"):
            self.send_response(301)
            self.send_header("Location", quote(self.mount, safe="/"))
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        if not path.startswith(self.mount):
            self.send_error(404, "Outside preview base path")
            return None
        relative = path[len(self.mount):]
        if "\\" in relative or "\x00" in relative or ".." in relative.split("/"):
            self.send_error(403, "Forbidden path")
            return None
        try:
            target = (self.root / relative).resolve()
            if target.is_dir():
                target = (target / "index.html").resolve()
            if not target.is_relative_to(self.root):
                self.send_error(403, "Forbidden path")
                return None
            stream = target.open("rb")
        except (OSError, ValueError, RuntimeError):
            self.send_error(404, "File not found")
            return None
        self.send_response(200)
        types = {".js": "application/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".map": "application/json"}
        self.send_header("Content-Type", types.get(target.suffix, mimetypes.guess_type(str(target))[0] or "application/octet-stream"))
        self.send_header("Content-Length", str(os.fstat(stream.fileno()).st_size))
        self.end_headers()
        return stream


def preview(args: argparse.Namespace) -> None:
    if not (DIST / "index.html").is_file():
        raise RuntimeError("没有可预览的构建产物。请去掉 --skip-build，或先运行 python3 local.py build。")
    handler = functools.partial(PagesHandler, directory=str(DIST), mount=args.base_path)
    release_port(args.port)
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
        url = f"http://{host}:{args.port}{args.base_path}"
        log(f"静态预览：{url}")
        log("模拟 Pages 子路径与 404 行为，无热更新；修改源码后需重新构建。Ctrl+C 停止。")
        if args.open:
            webbrowser.open(url)
        server.serve_forever(poll_interval=0.2)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    try:
        if args.host == "0.0.0.0":
            log("注意：服务将对局域网开放。手机访问需使用此电脑的局域网 IP；部分安全上下文功能可能不可用。")
        log("网页调试使用浏览器开发者工具；不同端口的本地藏馆互不共享，也不会影响线上收藏。")
        if args.mode == "preview" and args.skip_build:
            preview(args)
            return 0
        npm = prepare_dependencies(args.install)
        if args.mode == "dev":
            host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
            url = f"http://{host}:{args.port}{args.base_path}"
            log(f"开发模式（热更新）：{url}；Ctrl+C 停止。")
            command = [npm, "run", "dev", "--", "--host", args.host, "--port", str(args.port), "--strictPort", "--base", args.base_path]
            if args.debug:
                command.append("--debug")
            release_port(args.port)
            run(command, url if args.open else None, reset_local=True, unlock_all=args.unlock_all)
        else:
            build(npm, args.debug, args.unlock_all)
            if args.mode == "preview":
                preview(args)
        return 0
    except KeyboardInterrupt:
        log("已停止，收藏和构建文件均保留。")
        return 130
    except subprocess.CalledProcessError as error:
        log(f"命令失败，退出码 {error.returncode}；请检查上方构建或依赖安装日志。")
        return error.returncode if error.returncode > 0 else 1
    except (OSError, RuntimeError) as error:
        log(f"错误：{error}")
        if isinstance(error, OSError) and error.errno in (48, 98, 10048):
            log("端口清理后仍无法绑定，可能被重新占用或残留连接未释放；请重试或用 --port 指定其他端口。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
