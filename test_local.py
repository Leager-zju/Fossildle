import contextlib
import functools
import importlib.util
import io
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fossildle_local", ROOT / "local.py")
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


class ArgumentsTest(unittest.TestCase):
    def test_defaults(self):
        args = local.parse_args([])
        self.assertEqual((args.mode, args.port, args.base_path), ("dev", 5173, "/"))
        args = local.parse_args(["preview"])
        self.assertEqual((args.port, args.base_path), (4173, "/Fossildle/"))

    def test_custom_base_and_port(self):
        args = local.parse_args(["preview", "--base-path", "example/site", "--port", "8090"])
        self.assertEqual((args.base_path, args.port), ("/example/site/", 8090))

    def test_invalid_combinations(self):
        for args in (["--port", "0"], ["--port", "65536"], ["--port", "abc"], ["build", "--skip-build"], ["build", "--open"], ["preview", "--skip-build", "--debug"], ["preview", "--skip-build", "--install"], ["--base-path", "../secret"], ["--base-path", "https://example.com"]):
            with self.subTest(args=args), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                local.parse_args(args)

    def test_debug_build_adds_sourcemap(self):
        with mock.patch.object(local, "run") as run:
            with mock.patch.object(Path, "is_file", return_value=True):
                local.build("npm", True)
            run.assert_called_once_with(["npm", "run", "build", "--", "--sourcemap"], reset_local=True)

    def test_local_environment_changes_without_mutating_parent(self):
        before = os.environ.get("VITE_FOSSILDLE_LOCAL_BUILD")
        first = local.local_environment()["VITE_FOSSILDLE_LOCAL_BUILD"]
        second = local.local_environment()["VITE_FOSSILDLE_LOCAL_BUILD"]
        self.assertRegex(first, r"^\d{20}-[a-f0-9]{32}$")
        self.assertNotEqual(first, second)
        self.assertLess(first, second)
        self.assertEqual(os.environ.get("VITE_FOSSILDLE_LOCAL_BUILD"), before)

    def test_skip_build_does_not_require_node(self):
        with mock.patch.object(local, "prepare_dependencies") as prepare, mock.patch.object(local, "preview") as preview:
            self.assertEqual(local.main(["preview", "--skip-build"]), 0)
            prepare.assert_not_called()
            preview.assert_called_once()

    def test_old_node_version_rejected(self):
        with mock.patch.object(local.shutil, "which", return_value="/fake/node"), mock.patch.object(local.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="v20.0.0\n")):
            with self.assertRaisesRegex(RuntimeError, "不满足项目要求"):
                local.prepare_dependencies()

    def test_build_failure_stops_preview(self):
        with mock.patch.object(local, "prepare_dependencies", return_value="npm"), mock.patch.object(local, "build", side_effect=subprocess.CalledProcessError(2, ["npm"])), mock.patch.object(local, "preview") as preview:
            self.assertEqual(local.main(["preview"]), 2)
            preview.assert_not_called()


class PortReleaseTest(unittest.TestCase):
    def test_free_port_does_not_stop_processes(self):
        with mock.patch.object(local, "listening_pids", return_value=set()), mock.patch.object(local, "terminate_listener") as stop:
            local.release_port(5173)
            stop.assert_not_called()

    def test_graceful_shutdown_without_force(self):
        with mock.patch.object(local, "listening_pids", return_value={90123}), mock.patch.object(local, "terminate_listener") as stop, mock.patch.object(local, "wait_for_port", return_value=set()):
            local.release_port(5173)
            stop.assert_called_once_with(90123, 5173)

    def test_stubborn_listener_is_forced(self):
        with mock.patch.object(local, "listening_pids", return_value={90123}), mock.patch.object(local, "terminate_listener") as stop, mock.patch.object(local, "wait_for_port", side_effect=[{90123}, set()]):
            local.release_port(5173)
            self.assertEqual(stop.call_args_list, [mock.call(90123, 5173), mock.call(90123, 5173, force=True)])

    def test_restarted_service_is_not_killed_repeatedly(self):
        with mock.patch.object(local, "listening_pids", return_value={90123}), mock.patch.object(local, "terminate_listener") as stop, mock.patch.object(local, "wait_for_port", return_value={90124}):
            with self.assertRaisesRegex(RuntimeError, "新进程重新占用"):
                local.release_port(5173)
            stop.assert_called_once_with(90123, 5173)

    def test_protects_self_before_stopping_anything(self):
        with mock.patch.object(local, "listening_pids", return_value={os.getpid(), 90123}), mock.patch.object(local, "terminate_listener") as stop:
            with self.assertRaisesRegex(RuntimeError, "受保护进程"):
                local.release_port(5173)
            stop.assert_not_called()

    @unittest.skipUnless(os.name == "posix", "POSIX 信号测试")
    def test_permission_failure_is_explicit(self):
        with mock.patch.object(local, "listening_pids", return_value={90123}), mock.patch.object(local.os, "kill", side_effect=PermissionError):
            with self.assertRaisesRegex(RuntimeError, "没有权限"):
                local.terminate_listener(90123, 5173)

    @unittest.skipUnless(os.name == "posix", "lsof 参数测试")
    def test_lsof_only_selects_tcp_listeners(self):
        result = subprocess.CompletedProcess([], 0, stdout="90123\n90123\n90124\n", stderr="")
        with mock.patch.object(local.shutil, "which", return_value="/usr/sbin/lsof"), mock.patch.object(local.subprocess, "run", return_value=result) as run:
            self.assertEqual(local.listening_pids(5173), {90123, 90124})
            self.assertEqual(run.call_args.args[0], ["/usr/sbin/lsof", "-nP", "-a", "-t", "-iTCP:5173", "-sTCP:LISTEN"])

    def test_build_does_not_release_port(self):
        with mock.patch.object(local, "prepare_dependencies", return_value="npm"), mock.patch.object(local, "build"), mock.patch.object(local, "release_port") as release:
            self.assertEqual(local.main(["build"]), 0)
            release.assert_not_called()

    def test_dev_releases_selected_port_before_start(self):
        calls = []
        with mock.patch.object(local, "prepare_dependencies", return_value="npm"), mock.patch.object(local, "release_port", side_effect=lambda port: calls.append(("release", port))), mock.patch.object(local, "run", side_effect=lambda *_args, **_kwargs: calls.append(("start", None))):
            self.assertEqual(local.main(["dev", "--port", "5199"]), 0)
            self.assertEqual(calls, [("release", 5199), ("start", None)])

    def test_failed_release_prevents_start(self):
        with mock.patch.object(local, "prepare_dependencies", return_value="npm"), mock.patch.object(local, "release_port", side_effect=RuntimeError("端口无法释放")), mock.patch.object(local, "run") as run:
            self.assertEqual(local.main(["dev"]), 1)
            run.assert_not_called()


class QuietHandler(local.PagesHandler):
    def log_message(self, *_args):
        pass


class PagesServerTest(unittest.TestCase):
    def setUp(self):
        results = ROOT / "test-results"
        results.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=results)
        directory = Path(self.temp.name)
        self.dist = directory / "dist"
        self.dist.mkdir()
        (self.dist / "index.html").write_text('<html><script src="./assets/app.js"></script></html>', encoding="utf-8")
        (self.dist / "assets").mkdir()
        (self.dist / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")
        (self.dist / "assets" / "app.js.map").write_text('{"version":3}', encoding="utf-8")
        (directory / "private.txt").write_text("not public", encoding="utf-8")
        handler = functools.partial(QuietHandler, directory=str(self.dist), mount="/Fossildle/")
        self.server = local.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def assert_status(self, path, status):
        with self.assertRaises(HTTPError) as error:
            urlopen(self.url + path, timeout=2)
        self.assertEqual(error.exception.code, status)
        error.exception.close()

    def test_mount_redirect_and_hash_entry(self):
        with urlopen(self.url + "/Fossildle", timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertTrue(response.url.endswith("/Fossildle/"))
            self.assertIn(b"./assets/app.js", response.read())

    def test_assets_headers_and_head(self):
        with urlopen(Request(self.url + "/Fossildle/assets/app.js", method="HEAD"), timeout=2) as response:
            self.assertEqual(response.headers["Content-Type"], "application/javascript")
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertGreater(int(response.headers["Content-Length"]), 0)
            self.assertEqual(response.read(), b"")
        with urlopen(self.url + "/Fossildle/assets/app.js.map", timeout=2) as response:
            self.assertEqual(response.headers["Content-Type"], "application/json")

    def test_no_spa_fallback_or_directory_listing(self):
        for path in ("/", "/Fossildle/cabinet", "/Fossildle/assets/", "/Fossildle/assets/missing.js", "/Fossildlex/"):
            with self.subTest(path=path):
                self.assert_status(path, 404)

    def test_blocks_traversal(self):
        for path in ("/Fossildle/%2e%2e/private.txt", "/Fossildle/..%5cprivate.txt", "/Fossildle/%00", "/Fossildle//etc/passwd"):
            with self.subTest(path=path):
                self.assert_status(path, 403)

    def test_blocks_symlink_escape(self):
        try:
            (self.dist / "leak.txt").symlink_to(Path(self.temp.name) / "private.txt")
        except OSError:
            self.skipTest("此系统不支持创建符号链接")
        self.assert_status("/Fossildle/leak.txt", 403)


@unittest.skipUnless(os.name == "posix", "Ctrl+C 集成测试适用于 macOS/Linux")
class LiveServerTest(unittest.TestCase):
    def check_server(self, mode, port=None):
        if port is None:
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
        command = [sys.executable, str(ROOT / "local.py"), mode, "--port", str(port), "--base-path", "/Fossildle/"]
        if mode == "preview":
            command.append("--skip-build")
        results = ROOT / "test-results"
        results.mkdir(exist_ok=True)
        with tempfile.TemporaryFile(dir=results) as output:
            process = subprocess.Popen(command, cwd=ROOT.parent, stdout=output, stderr=output, start_new_session=True)
            try:
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline and process.poll() is None:
                    try:
                        with urlopen(f"http://127.0.0.1:{port}/Fossildle/", timeout=0.5) as response:
                            body = response.read()
                            self.assertEqual(response.status, 200)
                            self.assertIn(b"Fossildle", body)
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    output.seek(0)
                    self.fail(output.read().decode("utf-8", errors="replace"))
            finally:
                if process.poll() is None:
                    process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    self.fail("Ctrl+C 未能正常停止服务")
            output.seek(0)
            self.assertEqual(process.returncode, 130, output.read().decode("utf-8", errors="replace"))
            with socket.socket() as probe:
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0, "脚本退出后仍有子进程占用端口")

    def check_occupied_server(self, mode):
        code = "import socket,time; s=socket.socket(); s.bind(('127.0.0.1',0)); s.listen(); print(s.getsockname()[1],flush=True); time.sleep(60)"
        blocker = subprocess.Popen([sys.executable, "-u", "-c", code], stdout=subprocess.PIPE, text=True, cwd=ROOT)
        try:
            port = int(blocker.stdout.readline())
            self.check_server(mode, port=port)
            blocker.wait(timeout=5)
            self.assertEqual(blocker.returncode, -signal.SIGTERM)
        finally:
            if blocker.poll() is None:
                blocker.kill()
                blocker.wait()
            blocker.stdout.close()

    @unittest.skipUnless((ROOT / "node_modules" / "vite" / "bin" / "vite.js").is_file(), "未安装前端依赖")
    def test_dev_replaces_occupied_port(self):
        self.check_occupied_server("dev")

    @unittest.skipUnless((ROOT / "dist" / "index.html").is_file(), "尚未生成构建产物")
    def test_preview_replaces_occupied_port(self):
        self.check_occupied_server("preview")

    @unittest.skipUnless((ROOT / "node_modules" / "vite" / "bin" / "vite.js").is_file(), "未安装前端依赖")
    def test_dev_start_and_stop_from_other_directory(self):
        self.check_server("dev")

    @unittest.skipUnless((ROOT / "dist" / "index.html").is_file(), "尚未生成构建产物")
    def test_preview_start_and_stop_from_other_directory(self):
        self.check_server("preview")


if __name__ == "__main__":
    unittest.main()
