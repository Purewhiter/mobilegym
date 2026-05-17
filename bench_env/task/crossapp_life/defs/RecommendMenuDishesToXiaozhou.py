from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import day_time_ms, sim_today
from bench_env.task.wechat.app import Wechat


class RecommendMenuDishesToXiaozhou(BaseTask):
    """从相册菜单照片里按小周忌口推荐合适菜品并微信发送。"""

    templates = [
        "相册里有我之前拍的菜单，按小周刚说的不吃辣的那些要求，帮她挑几道能吃的菜，微信发给她。"
    ]
    apps = ["wechat", "gallery"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["image", "reasoning", "handoff"]
    expected_changes = ["wechat.chats[user.name=小周].messages"]

    photo_paths = [
        "/sdcard/DCIM/Camera/IMG_8131.jpg",
        "/sdcard/DCIM/Camera/IMG_8132.jpg",
    ]
    menus = [
        {
            "restaurant": "南城小馆",
            "photo_path": photo_paths[0],
            "dishes": [
                {"category": "热菜", "name": "小炒黄牛肉", "price": 58},
                {"category": "热菜", "name": "黑椒牛柳", "price": 62},
                {"category": "热菜", "name": "葱爆羊肉", "price": 68},
                {"category": "热菜", "name": "孜然羊肉", "price": 66},
                {"category": "热菜", "name": "辣子鸡", "price": 58},
                {"category": "热菜", "name": "水煮牛肉", "price": 68},
                {"category": "热菜", "name": "回锅肉", "price": 48},
                {"category": "热菜", "name": "农家小炒肉", "price": 48},
                {"category": "热菜", "name": "香肉丝", "price": 38},
                {"category": "热菜", "name": "宫保鸡丁", "price": 42},
                {"category": "热菜", "name": "麻婆豆腐", "price": 28},
                {"category": "热菜", "name": "家常豆腐", "price": 28},
                {"category": "热菜", "name": "干煸四季豆", "price": 32},
                {"category": "热菜", "name": "地三鲜", "price": 28},
                {"category": "热菜", "name": "酸辣土豆丝", "price": 22},
                {"category": "热菜", "name": "青椒肉丝", "price": 36},
                {"category": "热菜", "name": "韭菜炒蛋", "price": 26},
                {"category": "热菜", "name": "番茄炒蛋", "price": 26},
                {"category": "热菜", "name": "蒜苔西兰花", "price": 28},
                {"category": "热菜", "name": "清炒时蔬", "price": 28},
                {"category": "热菜", "name": "香菇油菜", "price": 26},
                {"category": "热菜", "name": "蚝油生菜", "price": 26},
                {"category": "热菜", "name": "手撕包菜", "price": 24},
                {"category": "热菜", "name": "糖醋里脊", "price": 48},
                {"category": "热菜", "name": "红烧肉", "price": 58},
                {"category": "热菜", "name": "啤酒鸭", "price": 58},
                {"category": "热菜", "name": "黄焖鸡块", "price": 48},
                {"category": "热菜", "name": "土豆烧牛腩", "price": 68},
                {"category": "热菜", "name": "香辣虾", "price": 68},
                {"category": "热菜", "name": "蒜蓉粉丝虾", "price": 58},
                {"category": "热菜", "name": "干锅花菜", "price": 36},
                {"category": "热菜", "name": "干锅肥肠", "price": 58},
                {"category": "热菜", "name": "麻辣香锅", "price": 76},
                {"category": "热菜", "name": "酸菜鱼", "price": 78},
                {"category": "热菜", "name": "毛血旺", "price": 68},
                {"category": "热菜", "name": "剁椒鱼头", "price": 98},
                {"category": "热菜", "name": "清蒸鲈鱼", "price": 88},
                {"category": "热菜", "name": "红烧鲫鱼", "price": 58},
                {"category": "热菜", "name": "清蒸多宝鱼", "price": 98},
                {"category": "热菜", "name": "糖醋排骨", "price": 58},
                {"category": "热菜", "name": "椒盐排骨", "price": 58},
                {"category": "热菜", "name": "炸鸡翅", "price": 36},
                {"category": "热菜", "name": "香酥鸭", "price": 58},
                {"category": "热菜", "name": "烤鱼（香辣/麻辣）", "price": 88},
                {"category": "热菜", "name": "铁板牛肉", "price": 68},
                {"category": "热菜", "name": "铁板鱿鱼", "price": 68},
                {"category": "热菜", "name": "风味茄子煲", "price": 36},
                {"category": "凉菜", "name": "拍黄瓜", "price": 18},
                {"category": "凉菜", "name": "凉拌木耳", "price": 18},
                {"category": "凉菜", "name": "凉拌海带丝", "price": 18},
                {"category": "凉菜", "name": "凉拌皮蛋", "price": 18},
                {"category": "凉菜", "name": "口水鸡", "price": 38},
                {"category": "凉菜", "name": "蒜泥白肉", "price": 38},
                {"category": "凉菜", "name": "夫妻肺片", "price": 48},
                {"category": "凉菜", "name": "麻辣牛肉", "price": 48},
                {"category": "凉菜", "name": "凉拌三丝", "price": 20},
                {"category": "凉菜", "name": "花生米", "price": 18},
                {"category": "汤类", "name": "番茄蛋花汤", "price": 18},
                {"category": "汤类", "name": "紫菜蛋花汤", "price": 18},
                {"category": "汤类", "name": "酸辣汤", "price": 20},
                {"category": "汤类", "name": "冬瓜排骨汤", "price": 28},
                {"category": "汤类", "name": "玉米排骨汤", "price": 28},
                {"category": "汤类", "name": "老母鸡汤", "price": 48},
                {"category": "汤类", "name": "菌菇汤", "price": 28},
                {"category": "汤类", "name": "鱼头豆腐汤", "price": 38},
                {"category": "汤类", "name": "蛤蜊冬瓜汤", "price": 28},
                {"category": "主食", "name": "米饭", "price": 2},
                {"category": "主食", "name": "手工水饺（猪肉白菜）", "price": 28},
                {"category": "主食", "name": "手工水饺（韭菜鸡蛋）", "price": 28},
                {"category": "主食", "name": "扬州炒饭", "price": 28},
                {"category": "主食", "name": "海鲜炒饭", "price": 36},
                {"category": "主食", "name": "蛋炒饭", "price": 22},
                {"category": "主食", "name": "番茄鸡蛋面", "price": 26},
                {"category": "主食", "name": "牛肉面", "price": 28},
                {"category": "主食", "name": "酸菜肉丝面", "price": 24},
                {"category": "主食", "name": "炒面", "price": 26},
                {"category": "主食", "name": "炒米粉", "price": 26},
                {"category": "主食", "name": "手工馒头（2个）", "price": 6},
                {"category": "主食", "name": "花卷（2个）", "price": 6},
                {"category": "主食", "name": "葱油饼", "price": 12},
                {"category": "主食", "name": "米线（酸辣/牛肉）", "price": 26},
                {"category": "主食", "name": "砂锅粥（皮蛋瘦肉）", "price": 28},
                {"category": "主食", "name": "白粥", "price": 8},
                {"category": "特色推荐", "name": "白切鸡", "price": 48},
                {"category": "特色推荐", "name": "招牌口水鸡", "price": 48},
                {"category": "特色推荐", "name": "秘制红烧肉", "price": 58},
                {"category": "特色推荐", "name": "干锅牛蛙", "price": 78},
                {"category": "特色推荐", "name": "特色烤鱼", "price": 88},
            ],
        },
        {
            "restaurant": "禾味家常菜",
            "photo_path": photo_paths[1],
            "dishes": [
                {"category": "热菜类", "name": "椒麻鸡", "price": 48},
                {"category": "热菜类", "name": "小炒牛肉", "price": 58},
                {"category": "热菜类", "name": "葱爆羊肉", "price": 66},
                {"category": "热菜类", "name": "黑椒牛柳", "price": 62},
                {"category": "热菜类", "name": "蒜蓉粉丝虾", "price": 56},
                {"category": "热菜类", "name": "清蒸鲈鱼", "price": 86},
                {"category": "热菜类", "name": "剁椒鱼头", "price": 96},
                {"category": "热菜类", "name": "香辣蟹", "price": 98},
                {"category": "热菜类", "name": "辣子鸡", "price": 56},
                {"category": "热菜类", "name": "麻婆豆腐", "price": 28},
                {"category": "热菜类", "name": "回锅肉", "price": 42},
                {"category": "热菜类", "name": "鱼香肉丝", "price": 36},
                {"category": "热菜类", "name": "宫保鸡丁", "price": 36},
                {"category": "热菜类", "name": "酸辣土豆丝", "price": 22},
                {"category": "热菜类", "name": "干煸四季豆", "price": 28},
                {"category": "热菜类", "name": "地三鲜", "price": 28},
                {"category": "热菜类", "name": "红烧茄子", "price": 26},
                {"category": "热菜类", "name": "家常豆腐", "price": 28},
                {"category": "热菜类", "name": "青椒炒蛋", "price": 24},
                {"category": "热菜类", "name": "农家小炒肉", "price": 48},
                {"category": "热菜类", "name": "梅菜扣肉", "price": 52},
                {"category": "热菜类", "name": "红烧排骨", "price": 58},
                {"category": "热菜类", "name": "糖醋里脊", "price": 46},
                {"category": "热菜类", "name": "咕噜肉", "price": 46},
                {"category": "热菜类", "name": "香菇滑鸡", "price": 46},
                {"category": "热菜类", "name": "水煮肉片", "price": 52},
                {"category": "时蔬类", "name": "清炒时蔬", "price": 26},
                {"category": "时蔬类", "name": "蒜蓉生菜", "price": 24},
                {"category": "时蔬类", "name": "蚝油生菜", "price": 26},
                {"category": "时蔬类", "name": "手撕包菜", "price": 24},
                {"category": "时蔬类", "name": "酸辣土豆丝", "price": 22},
                {"category": "时蔬类", "name": "干煸四季豆", "price": 28},
                {"category": "时蔬类", "name": "清炒空心菜", "price": 22},
                {"category": "时蔬类", "name": "蒜蓉空心菜", "price": 24},
                {"category": "时蔬类", "name": "清炒油麦菜", "price": 26},
                {"category": "时蔬类", "name": "蒜蓉油麦菜", "price": 26},
                {"category": "时蔬类", "name": "地三鲜", "price": 28},
                {"category": "时蔬类", "name": "红烧茄子", "price": 26},
                {"category": "时蔬类", "name": "西红柿炒蛋", "price": 26},
                {"category": "时蔬类", "name": "青椒炒蛋", "price": 24},
                {"category": "时蔬类", "name": "韭菜炒蛋", "price": 26},
                {"category": "时蔬类", "name": "香菇青菜", "price": 26},
                {"category": "时蔬类", "name": "上汤娃娃菜", "price": 28},
                {"category": "时蔬类", "name": "干锅花菜", "price": 28},
                {"category": "时蔬类", "name": "蒜蓉西兰花", "price": 28},
                {"category": "时蔬类", "name": "木耳炒山药", "price": 32},
                {"category": "时蔬类", "name": "酸辣白菜", "price": 22},
                {"category": "时蔬类", "name": "炝炒大白菜", "price": 22},
                {"category": "时蔬类", "name": "清炒莴笋丝", "price": 24},
                {"category": "时蔬类", "name": "素炒三丝", "price": 22},
                {"category": "时蔬类", "name": "清炒苦瓜", "price": 24},
                {"category": "主食类", "name": "鸡汤面", "price": 28},
                {"category": "主食类", "name": "牛肉面", "price": 32},
                {"category": "主食类", "name": "炒面", "price": 26},
                {"category": "主食类", "name": "海鲜炒面", "price": 36},
                {"category": "主食类", "name": "蛋炒饭", "price": 22},
                {"category": "主食类", "name": "扬州炒饭", "price": 28},
                {"category": "主食类", "name": "牛肉炒饭", "price": 32},
                {"category": "主食类", "name": "海鲜炒饭", "price": 38},
                {"category": "主食类", "name": "白米饭", "price": 2},
                {"category": "主食类", "name": "馒头（2个）", "price": 4},
                {"category": "汤类", "name": "鸡汤", "price": 28},
                {"category": "汤类", "name": "番茄蛋汤", "price": 22},
                {"category": "汤类", "name": "紫菜蛋汤", "price": 22},
                {"category": "汤类", "name": "酸辣汤", "price": 24},
                {"category": "汤类", "name": "冬瓜排骨汤", "price": 36},
                {"category": "汤类", "name": "莲藕排骨汤", "price": 38},
                {"category": "汤类", "name": "蘑菇鸡汤", "price": 38},
                {"category": "汤类", "name": "海带排骨汤", "price": 36},
                {"category": "汤类", "name": "鲫鱼豆腐汤", "price": 42},
                {"category": "汤类", "name": "蛤蜊冬瓜汤", "price": 38},
                {"category": "汤类", "name": "西湖牛肉羹", "price": 28},
                {"category": "汤类", "name": "皮蛋瘦肉粥", "price": 22},
                {"category": "汤类", "name": "小米粥", "price": 10},
            ],
        },
    ]
    acceptable_dish_groups = {
        "hot_vegetable": {
            "清炒时蔬",
            "香菇油菜",
            "蒜苔西兰花",
            "手撕包菜",
            "家常豆腐",
            "番茄炒蛋",
            "韭菜炒蛋",
        },
        "noodle_main": {"番茄鸡蛋面", "炒面"},
        "light_chicken": {"白切鸡"},
    }
    target_dish_names = ["清炒时蔬", "番茄鸡蛋面", "白切鸡"]

    @property
    def excluded_dish_keywords(self) -> list[str]:
        acceptable_names = set().union(*self.acceptable_dish_groups.values())
        keywords: list[str] = []
        for menu in self.menus:
            if menu["restaurant"] != "南城小馆":
                keywords.append(str(menu["restaurant"]))
            for dish in menu["dishes"]:
                name = str(dish["name"])
                if name not in acceptable_names and name not in keywords:
                    keywords.append(name)
        return keywords

    def xiaozhou_message_for_os(self, os_state: dict[str, Any]) -> str:
        return (
            "今晚还是去南城小馆吧？我胃不太舒服，辣的别点，"
            "牛羊肉和海鲜也先不碰。帮我挑个热素菜，"
            "主食想吃面，再来个清淡点的鸡肉菜。"
        )

    def photo_files_for_os(self, os_state: dict[str, Any]) -> list[dict[str, Any]]:
        today = sim_today(os_state)
        return [
            {
                "path": self.photo_paths[0],
                "createdAt": day_time_ms(today - datetime.timedelta(days=3), "19:42"),
                "modifiedAt": day_time_ms(today - datetime.timedelta(days=3), "19:42"),
            },
            {
                "path": self.photo_paths[1],
                "createdAt": day_time_ms(today - datetime.timedelta(days=2), "20:05"),
                "modifiedAt": day_time_ms(today - datetime.timedelta(days=2), "20:05"),
            },
        ]

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        today = sim_today(state["os"])
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_contact(
            name="小周",
            wxid="wxid_xiaozhou_menu",
        )
        wechat_state = Wechat(wechat_state).prepare_state_with_incoming_text(
            "小周",
            self.xiaozhou_message_for_os(state["os"]),
            message_id="xiaozhou_request_menu_dishes",
            timestamp=day_time_ms(today, "17:48"),
        )
        await env.set_state({"apps": {"wechat": wechat_state}}, deep=True, reload=False)
        await env.page.evaluate(
            """async ({files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                for (const file of files) {
                    const node = fs.stat(file.path);
                    if (!node || node.type !== 'file') continue;
                    const content = await fs.read(file.path);
                    await fs.write(file.path, content, {
                        mimeType: node.mimeType || 'image/jpeg',
                        createdAt: file.createdAt,
                        modifiedAt: file.modifiedAt,
                    });
                }
            }""",
            {"files": self.photo_files_for_os(state["os"])},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        checks = []
        for group_name, dishes in self.acceptable_dish_groups.items():
            checks.append(
                wechat.check_new_sent_any_of(
                    "小周",
                    sorted(dishes),
                    field=f"wechat.xiaozhou_menu_{group_name}",
                )
            )
        checks.append(
            wechat.check_new_sent_norm_excludes(
                "小周",
                *self.excluded_dish_keywords,
                field="wechat.xiaozhou_no_menu_distractors",
            )
        )
        return checks
