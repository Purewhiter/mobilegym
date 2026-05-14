from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import Wechat


class CountCurrentLogErrorsToWechat(BaseTask):
    templates = [
        "打开文件管理器，查看 Download/排障包 里的所有当前日志文件，统计这些日志里 ERROR 一共出现了多少次，把次数微信发给老板。"
    ]
    apps = ["file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "search", "reasoning", "handoff"]
    expected_changes = ["wechat.chats[user.name=Boss].messages"]

    seed_dir = "/sdcard/Download/排障包"

    def seed_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        current_log_day = sim_today(os_state) - datetime.timedelta(days=1)
        current_date = current_log_day.isoformat()
        archive_date = (current_log_day - datetime.timedelta(days=38)).isoformat()
        return [
            {
                "path": f"{self.seed_dir}/app.log",
                "content": f"""{current_date} 09:00:01 INFO app started env=prod node=api-01
{current_date} 09:00:07 WARN cache warmup slow bucket=user-profile elapsed=1840ms
{current_date} 09:01:13 ERROR payment webhook failed order=P260425001 code=TIMEOUT retry=1
{current_date} 09:03:41 INFO worker picked job=invoice-sync batch=502
{current_date} 09:04:08 ERROR invoice sync failed batch=502 reason=db_deadlock retry=1
{current_date} 09:04:52 ERROR invoice sync failed batch=502 reason=db_deadlock retry=2
{current_date} 09:05:36 INFO invoice sync recovered batch=502
{current_date} 09:08:19 ERROR order callback failed order=P260425014 upstream=crm status=502
{current_date} 09:10:44 WARN queue lag topic=notify depth=3812
{current_date} 09:11:03 ERROR notify push failed user=U19027 channel=wechat code=TOKEN_EXPIRED
{current_date} 09:14:55 INFO scheduled cleanup started
{current_date} 09:15:22 ERROR cleanup skipped file=/tmp/report.tmp reason=permission_denied
{current_date} 09:17:49 ERROR metrics exporter failed endpoint=/metrics errno=ECONNRESET
{current_date} 09:20:01 INFO app heartbeat ok
{current_date} 09:23:18 ERROR payment webhook failed order=P260425033 code=TIMEOUT retry=1
{current_date} 09:24:09 INFO payment webhook recovered order=P260425033
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/network.log",
                "content": f"""{current_date} 09:00:02 INFO net monitor started interface=eth0
{current_date} 09:02:11 ERROR upstream api-gateway connection refused host=10.20.3.8 port=8443
{current_date} 09:02:16 ERROR upstream api-gateway connection refused host=10.20.3.8 port=8443 retry=2
{current_date} 09:02:35 WARN failover selected host=10.20.3.9
{current_date} 09:06:44 ERROR dns lookup failed name=crm.internal.local server=10.1.0.53
{current_date} 09:09:27 INFO vpn tunnel stable peer=ops-shanghai
{current_date} 09:13:02 ERROR tls handshake failed peer=billing.internal.local reason=certificate_expired
{current_date} 09:18:40 WARN packet loss interface=eth0 loss=3.1%
{current_date} 09:19:04 ERROR route update rejected destination=10.44.0.0/16 reason=conflict
{current_date} 09:21:11 INFO dns lookup recovered name=crm.internal.local
{current_date} 09:25:36 ERROR upstream callback latency exceeded service=notify p95=4810ms
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/system/boot.log",
                "content": f"""{current_date} 08:58:01 INFO kernel boot completed version=6.1.42
{current_date} 08:58:09 INFO service registry loaded entries=128
{current_date} 08:58:17 ERROR service audit-agent failed to start exit=1
{current_date} 08:58:23 WARN service audit-agent restarting attempt=1
{current_date} 08:58:31 ERROR service audit-agent failed to start exit=1
{current_date} 08:59:05 INFO service audit-agent started
{current_date} 09:00:18 ERROR disk quota check failed mount=/var/log reason=io_timeout
{current_date} 09:03:06 WARN memory pressure cgroup=worker high=87%
{current_date} 09:07:44 ERROR watchdog missed heartbeat service=report-renderer
{current_date} 09:16:52 INFO watchdog heartbeat restored service=report-renderer
{current_date} 09:22:10 ERROR config reload failed file=/etc/app/routing.yaml reason=parse_error
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/system/auth.log",
                "content": f"""{current_date} 09:01:22 INFO login accepted user=ops.li ip=10.8.0.17
{current_date} 09:04:58 WARN login retry user=svc_report ip=10.8.0.31
{current_date} 09:05:01 ERROR login denied user=svc_report reason=bad_secret ip=10.8.0.31
{current_date} 09:05:28 ERROR token refresh failed user=svc_report reason=secret_expired
{current_date} 09:06:03 INFO secret rotated user=svc_report
{current_date} 09:07:19 INFO login accepted user=svc_report ip=10.8.0.31
{current_date} 09:12:33 ERROR permission check failed user=ops.zhang resource=/finance/export action=read
{current_date} 09:19:15 WARN session nearing expiry user=ops.li
{current_date} 09:26:42 ERROR mfa callback failed user=ops.wang provider=sms status=429
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/system/debug.log",
                "content": f"""{current_date} 09:00:00 DEBUG feature flag reportPipeline=true
{current_date} 09:05:00 INFO diagnostic marker ERR_CODE_SAMPLE is a label, not an error line
{current_date} 09:10:00 WARN simulated failure marker ignored by current run
{current_date} 09:15:00 DEBUG trace completed span=render_preview
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/archive/old_app.log",
                "content": f"""{archive_date} 01:00:01 ERROR legacy payment timeout
{archive_date} 01:00:09 ERROR legacy callback failed
{archive_date} 01:01:10 ERROR old invoice batch failed
{archive_date} 01:02:31 ERROR old notification token expired
{archive_date} 01:04:00 ERROR old metrics exporter failed
{archive_date} 01:05:41 ERROR old cleanup permission denied
{archive_date} 01:06:27 ERROR old queue consumer crashed
{archive_date} 01:08:12 ERROR old cache rebuild failed
{archive_date} 01:09:55 ERROR old report renderer timeout
{archive_date} 01:11:43 ERROR old gateway returned 502
{archive_date} 01:13:20 ERROR old route conflict
{archive_date} 01:15:08 ERROR old auth callback failed
""",
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/README.txt",
                "content": (
                    "排障包说明\n\n"
                    f"本目录由 {current_date} 09:30 导出，当前批次包含应用、网络、系统和鉴权日志。\n"
                    "archive 为上月复盘归档，保留原始文件名，供趋势对比。\n"
                    "若看到 ERROR_TIMEOUT 或 ERROR_AUTH，请先对照 error_codes.txt 确认含义。\n"
                ),
                "mimeType": "text/plain",
            },
            {
                "path": f"{self.seed_dir}/error_codes.txt",
                "content": (
                    "错误码速查\n\n"
                    "ERROR_TIMEOUT：上游接口 30 秒无响应，通常伴随 retry 字段。\n"
                    "ERROR_AUTH：凭据过期或签名校验失败，请检查密钥轮换记录。\n"
                    "ERROR_RENDER：报表模板渲染失败，常见于字段缺失。\n"
                ),
                "mimeType": "text/plain",
            },
        ]

    @staticmethod
    def _error_count(file: dict[str, Any]) -> int:
        return str(file["content"]).count("ERROR")

    @staticmethod
    def _is_current_log_path(path: str) -> bool:
        return path.endswith(".log") and "/archive/" not in path

    def expected_error_count_for_os(self, os_state: dict[str, Any]) -> int:
        return sum(
            self._error_count(file)
            for file in self.seed_files_for_os(os_state)
            if self._is_current_log_path(str(file["path"]))
        )

    def archive_error_count_for_os(self, os_state: dict[str, Any]) -> int:
        return sum(
            self._error_count(file)
            for file in self.seed_files_for_os(os_state)
            if str(file["path"]).endswith(".log") and "/archive/" in str(file["path"])
        )

    def non_log_error_count_for_os(self, os_state: dict[str, Any]) -> int:
        return sum(
            self._error_count(file)
            for file in self.seed_files_for_os(os_state)
            if not str(file["path"]).endswith(".log")
        )

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        await env.page.evaluate(
            """async ({dirPath, files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                if (fs.exists(dirPath)) {
                    await fs.delete(dirPath);
                }
                await fs.mkdir(dirPath);
                for (const file of files) {
                    await fs.write(file.path, file.content, {mimeType: file.mimeType || 'text/plain'});
                }
            }""",
            {"dirPath": self.seed_dir, "files": self.seed_files_for_os(state["os"])},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_sent_contains_number(
                "Boss",
                self.expected_error_count_for_os(input.os_init),
                field="wechat.boss_error_count",
            ),
        ]
