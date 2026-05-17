from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import Wechat


class InspectionReportToWechat(BaseTask):
    """读本地巡检文件，按指定日期和处理状态分支把结果转发微信。"""

    templates = [
        "打开文件里的 Download/巡检记录，查看昨天的巡检情况。如果还有没处理的异常，把设备编号和异常项微信发给老板，同时也同步给今天的巡检人；如果都已处理或正常，就微信告诉今天的巡检人昨天巡检正常。"
    ]
    apps = ["file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "handoff"]
    inspector_by_weekday = {
        0: ("周一", "张伟"),
        1: ("周二", "王芳"),
        2: ("周三", "李娜"),
        3: ("周四", "陈静"),
        4: ("周五", "杨杰"),
        5: ("周六", "刘浪"),
        6: ("周日", "黄勇"),
    }

    def inspector_for_date(self, day: datetime.date) -> str:
        return self.inspector_by_weekday[day.weekday()][1]

    def inspector_for_os(self, os_state: dict[str, Any], *, day_offset: int = 0) -> str:
        day = sim_today(os_state) - datetime.timedelta(days=day_offset)
        return self.inspector_for_date(day)

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        inspector = self.inspector_for_os(input.os)
        return [
            "wechat.chats[user.name=Boss].messages",
            f"wechat.chats[user.name={inspector}].messages",
        ]

    def seed_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        seed_dir = "/sdcard/Download/巡检记录"
        today = sim_today(os_state)
        yesterday = today - datetime.timedelta(days=1)
        today_inspector = self.inspector_for_os(os_state)
        yesterday_inspector = self.inspector_for_os(os_state, day_offset=1)
        historical_patterns = [
            (
                "08:40",
                "CAM-09",
                "正常",
                "无",
                "李娜",
                "监控区",
                "回放抽查 6 段，录像连续",
                "抽查前夜录像和实时预览，画面亮度、时间叠加和存储索引一致。",
                "记录到日检表，等待晚班复核摄像头遮挡情况。",
            ),
            (
                "13:30",
                "UPS-16",
                "已恢复",
                "电池温度偏高",
                "陈静",
                "电源间",
                "最高 38.4 摄氏度，复测 35.8 摄氏度",
                "清理进风口滤网，复测电池柜顶部和下层托盘温度。",
                "把读数贴到 UPS 复核页，晚班继续观察负载变化。",
            ),
            (
                "17:45",
                "NET-04",
                "异常",
                "端口丢包",
                "黄勇",
                "网络机柜",
                "端口 3/17 丢包 1.8%，端口 3/18 正常",
                "替换短跳线后再次压测，丢包仍偶发，已登记交换机端口号。",
                "网络组安排次日窗口复查链路，两端标签暂不更换。",
            ),
            (
                "09:05",
                "AC-22",
                "正常",
                "无",
                today_inspector,
                "空调区",
                "出风 18.6 摄氏度，回风 24.1 摄氏度",
                "检查滤网、冷凝水排水和压缩机运行声音，未见明显波动。",
                "维持自动模式，午后根据机柜温度再看一次曲线。",
            ),
            (
                "14:15",
                "DB-11",
                "异常",
                "备份延迟",
                "张伟",
                "数据库机柜",
                "备份队列延迟 24 分钟",
                "核对计划任务、磁盘剩余空间和备份服务器连接，延迟仍在扩大。",
                "数据库组先保留现场日志，夜间窗口再调整并发任务。",
            ),
            (
                "18:20",
                "TEMP-02",
                "已恢复",
                "温湿度探头离线",
                "王芳",
                "环境监测区",
                "离线 7 分钟，恢复后湿度 46%",
                "重新插拔探头网关并确认平台恢复曲线，告警状态已消除。",
                "把探头编号贴到交接单，后续观察同一网关下其他探头。",
            ),
        ]
        records: list[tuple[datetime.date, str, str, str, str, str, str, str, str, str]] = []
        for offset in range(14, 1, -1):
            day = today - datetime.timedelta(days=offset)
            start = offset % len(historical_patterns)
            for shift_index in range(3):
                time, device, status, issue, inspector, area, reading, action, remark = historical_patterns[
                    (start + shift_index) % len(historical_patterns)
                ]
                records.append((day, time, device, status, issue, inspector, area, reading, action, remark))

        yesterday_records = [
            (
                yesterday,
                "09:10",
                "AC-22",
                "正常",
                "无",
                yesterday_inspector,
                "空调区",
                "出风 18.7 摄氏度，回风 24.2 摄氏度",
                "查看冷通道挡板、排水管和主机运行声音，机柜前后温差稳定。",
                "晚班按常规复看趋势曲线，未调整空调模式。",
            ),
            (
                yesterday,
                "10:20",
                "UPS-17",
                "异常",
                "电池温度偏高",
                yesterday_inspector,
                "电源间",
                "顶部探头 38.9 摄氏度，下层托盘 36.6 摄氏度",
                "记录电池柜编号，检查风扇和进风口，安排午前复测。",
                "保留上午读数，便于和后续复测结果对照。",
            ),
            (
                yesterday,
                "11:40",
                "UPS-17",
                "已处理",
                "电池温度偏高",
                yesterday_inspector,
                "电源间",
                "复测 35.7 摄氏度，风扇转速恢复",
                "清理进风口并确认风扇运行，温度回到日常范围。",
                "电源间下午继续观察负载变化。",
            ),
            (
                yesterday,
                "13:30",
                "TEMP-02",
                "异常",
                "温湿度探头离线",
                yesterday_inspector,
                "环境监测区",
                "离线 8 分钟，湿度曲线中断",
                "检查探头网关和端口指示灯，记录离线时间段。",
                "下午复测同一探头和相邻端口。",
            ),
            (
                yesterday,
                "14:40",
                "TEMP-02",
                "已处理",
                "温湿度探头离线",
                yesterday_inspector,
                "环境监测区",
                "湿度 46%，曲线恢复连续",
                "重新插拔探头网关并核对平台曲线，离线告警消除。",
                "晚班继续观察同一网关下其他探头。",
            ),
            (
                yesterday,
                "15:20",
                "NET-04",
                "异常",
                "端口丢包",
                yesterday_inspector,
                "网络机柜",
                "端口 3/17 丢包 1.4%，邻近端口正常",
                "更换短跳线并重新压测，业务侧暂无明显报错。",
                "网络组记录端口编号，等待窗口继续观察链路。",
            ),
            (
                yesterday,
                "18:10",
                "DB-11",
                "异常",
                "备份延迟",
                yesterday_inspector,
                "数据库机柜",
                "备份队列延迟 29 分钟，任务仍在排队",
                "核对计划任务和备份服务器连接，队列未恢复到日常范围。",
                "数据库组保留任务日志，后续窗口继续处理。",
            ),
        ]

        today_records = [
            (
                today,
                "09:10",
                "AC-22",
                "正常",
                "无",
                today_inspector,
                "空调区",
                "出风 18.9 摄氏度，回风 24.0 摄氏度",
                "查看空调主机、排水管和机柜前后温差，曲线与昨日早班接近。",
                "午后继续观察机柜上沿温度，冷通道挡板保持原位。",
            ),
            (
                today,
                "10:20",
                "UPS-17",
                "异常",
                "电池温度偏高",
                today_inspector,
                "电源间",
                "顶部探头 39.1 摄氏度，下层托盘 36.8 摄氏度",
                "记录电池柜编号，安排午间复测风扇和进风口。",
                "保留上午读数，复测结果写入同日后续记录。",
            ),
            (
                today,
                "11:40",
                "UPS-17",
                "已处理",
                "电池温度偏高",
                today_inspector,
                "电源间",
                "复测 35.9 摄氏度，风扇转速恢复",
                "清理进风口并检查电池柜风扇，复测后温度回落。",
                "保留两次读数，电源间午后维持观察。",
            ),
            (
                today,
                "13:30",
                "TEMP-02",
                "异常",
                "温湿度探头离线",
                today_inspector,
                "环境监测区",
                "离线 6 分钟，湿度曲线中断",
                "检查探头网关和端口指示灯，记录离线时间段。",
                "等待下午复测同一探头。",
            ),
            (
                today,
                "14:40",
                "TEMP-02",
                "已处理",
                "温湿度探头离线",
                today_inspector,
                "环境监测区",
                "湿度 45%，曲线恢复连续",
                "重新插拔探头网关并核对平台曲线，离线告警消除。",
                "环境监测区晚班继续看同一网关。",
            ),
            (
                today,
                "15:20",
                "PDU-03",
                "异常",
                "供电监控读数波动",
                today_inspector,
                "电源间",
                "A 路电流短时跳变 0.8A，B 路稳定",
                "核对 PDU 面板读数和平台曲线，暂未调整供电接入。",
                "电源组保留曲线截图，晚班继续观察波动范围。",
            ),
            (
                today,
                "18:10",
                "CAM-09",
                "异常",
                "录像索引延迟",
                today_inspector,
                "监控区",
                "回放索引较实时画面延后 12 分钟",
                "抽查录像连续性和存储服务器连接，实时预览正常。",
                "弱电组保留索引截图，晚间窗口继续复核。",
            ),
        ]
        records.extend(yesterday_records)
        records.extend(today_records)
        record_content = "\n\n".join(
            (
                f"日期：{date.isoformat()}\n"
                f"时间：{time}\n"
                f"巡检人：{inspector}\n"
                f"区域：{area}\n"
                f"设备编号：{device}\n"
                f"状态：{status}\n"
                f"异常项：{issue}\n"
                f"读数：{reading}\n"
                f"处理记录：{action}\n"
                f"复核备注：{remark}"
            )
            for date, time, device, status, issue, inspector, area, reading, action, remark in records
        )
        roster = "\n".join(
            f"{label}：{person}"
            for _, (label, person) in sorted(self.inspector_by_weekday.items())
        )
        return [
            {
                "path": f"{seed_dir}/巡检记录.txt",
                "content": f"机房巡检记录\n\n{record_content}",
                "mimeType": "text/plain",
            },
            {
                "path": f"{seed_dir}/值班表.txt",
                "content": f"本周巡检人安排\n\n{roster}\n",
                "mimeType": "text/plain",
            },
            {
                "path": f"{seed_dir}/历史巡检.txt",
                "content": (
                    "班组交接摘录\n\n"
                    f"日期：{(today - datetime.timedelta(days=7)).isoformat()}\n"
                    "时间：19:30\n"
                    "设备编号：DB-03\n"
                    "状态：异常\n"
                    "异常项：备份失败\n"
                    "值班人：周强\n"
                    "处理记录：数据库组导出任务日志，保留备份队列截图。\n\n"
                    f"日期：{(today - datetime.timedelta(days=2)).isoformat()}\n"
                    "时间：20:10\n"
                    "设备编号：UPS-16\n"
                    "状态：已恢复\n"
                    "异常项：电池温度偏高\n"
                    "值班人：陈静\n"
                    "处理记录：清理滤网后温度回落，交接时保留两次复测读数。\n"
                ),
                "mimeType": "text/plain",
            },
            {
                "path": f"{seed_dir}/设备清单.txt",
                "content": (
                    "UPS-17 电源间\n"
                    "UPS-16 电源间\n"
                    "BAT-02 电源间\n"
                    "PDU-03 电源间\n"
                    "NET-04 网络机柜\n"
                    "DB-11 数据库机柜\n"
                    "AC-22 空调区\n"
                    "CAM-09 监控区\n"
                    "TEMP-02 环境监测区\n"
                ),
                "mimeType": "text/plain",
            },
        ]

    async def _prepare(self, env: Any) -> None:
        seed_dir = "/sdcard/Download/巡检记录"
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
            {"dirPath": seed_dir, "files": self.seed_files_for_os(state["os"])},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        inspector = self.inspector_for_os(input.os)
        previous_inspector = self.inspector_for_os(input.os, day_offset=1)
        return [
            wechat.check_new_sent_norm_contains(
                "Boss",
                "NET-04",
                "端口丢包",
                "DB-11",
                "备份延迟",
                field="inspection_report_share_boss",
            ),
            wechat.check_new_sent_norm_excludes(
                "Boss",
                "UPS-17",
                "电池温度偏高",
                "TEMP-02",
                "温湿度探头离线",
                "PDU-03",
                "供电监控读数波动",
                "CAM-09",
                "录像索引延迟",
                field="inspection_report_excludes_resolved_boss",
            ),
            wechat.check_new_sent_norm_contains(
                inspector,
                "NET-04",
                "端口丢包",
                "DB-11",
                "备份延迟",
                field="inspection_report_share_inspector",
            ),
            wechat.check_new_sent_norm_excludes(
                inspector,
                "UPS-17",
                "电池温度偏高",
                "TEMP-02",
                "温湿度探头离线",
                "PDU-03",
                "供电监控读数波动",
                "CAM-09",
                "录像索引延迟",
                field="inspection_report_excludes_resolved_inspector",
            ),
            wechat.check_no_new_sent_to(
                previous_inspector,
                field="inspection_report_not_sent_to_previous_inspector",
                summary="昨天遗留异常应同步给今天的巡检人",
            ),
        ]
