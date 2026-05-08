"""
WeChat task definitions.

Each task is a class inheriting from BaseTask (or its subclasses).
"""
# -- Task Index (auto-generated, do not edit) --
# 35 tasks | L1×7  L2×9  L3×14  L4×5
#
# [L1] OpenMyQRCode                                       打开微信我的二维码页面
# [L1] OpenRadarAddFriend                                 打开微信雷达加好友页面
# [L1] OpenNewFriends                                     打开微信好友添加验证记录页面
# [L2] OpenBlacklist                                      打开微信通讯录黑名单页面
# [L3] FaceToFaceGroupWithPin                             在微信面对面建群里输入密码 {pin}
# [L1] ToggleFriendConfirmation                           {toggle}微信加好友验证
# [L2] ToggleWechatSports                                 {toggle}微信运动功能
# [L2] ToggleDiscoverEntry                                {toggle}微信发现页的{entry}入口
# [L2] ToggleMobileAutoPlayMomentsVideo                   {toggle}微信移动网络下朋友圈视频自动播放
# [L3] SetAddMeSearch                                     设置微信添加好友时仅能通过微信号搜索到我
# [L2] SetMomentsVisibleRange                             设置微信朋友查看我朋友圈的范围为{range}可见
# [L2] ToggleStrangerViewMoments                          {toggle}微信允许陌生人查看十条朋友圈
# [L3] DisableWechatSportsLeaderboard                     开启微信运动功能但是关闭加入步数排行榜
# [L1] EnableDarkMode                                     开启微信深色模式
# [L1] ReadContactsTotal                                  看看我微信通讯录里有多少个好友？
# [L2] SetPatText                                         设置微信拍一拍昵称为'{text}'
# [L3] PostMomentsText                                    发一条朋友圈，内容为'{content}'
# [L3] PostMomentsTextWithCity                            发一条朋友圈，内容为'{content}'，定位到 {location}
# [L3] ScenicPhotoToMomentsWithPhrase                     把{time_hint}拍的{place_name}照片发到朋友圈，配文带上{required_phrase}
# [L1] ReadMyWxid                                         帮我看看微信里我的微信号是多少
# [L2] SetSignature                                       把微信里的个性签名改成{text}
# [L2] SetNotificationSound                               把微信的消息提示音改成{sound}
# [L3] SendMessageToContact                               在微信里给{contact}发一条消息：{content}
# [L3] BlacklistContact                                   把微信里的{contact}加入黑名单
# [L3] DeauthorizeApp                                     取消微信对{app_name}的授权
# [L3] ReadContactRegion                                  帮我看看微信里{contact}是哪里人
# [L3] SetFriendChatOnly                                  把微信联系人{contact}的权限改成仅聊天
# [L3] ReadStepsLeaderboardTop                            打开微信运动功能，然后看看谁走的步数最多
# [L4] ConditionalReplyToBoss                             在微信里看看Boss之前有没有问过关于{keyword}的消息，有的话给他发{yes_reply}，没有就发{no_reply}
# [L4] PostMomentFromChat                                 看看微信里{contact}最近给我发了什么消息，把那条消息的内容原封不动发到朋友圈
# [L4] BlacklistThenNotify                                在微信里把{target}拉黑，然后给{notify_to}发消息说我把{target}拉黑了
# [L4] CompareStepsAndMessage                             在微信运动里看看{contact1}和{contact2}今天谁的步数更多，把“{content}”发给那个人，并告诉我是谁
# [L4] StarAndRestrictFriend                              把微信联系人{contact}设为星标好友，不让他看我的朋友圈，也不看他朋友圈
# [L3] SendAndReadReply                                   在微信里给{contact}发一句「{message}」，看看对方怎么回复的，把回复告诉我
# [L3] WechatModifyAppPermissionsByRevokingAuthorization  帮我在微信里取消对应用{authorizedAppName}的授权
# -- End Task Index --


from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask, AnswerTask, build_answer_checks
from bench_env.task.judge import JudgeInput
from bench_env.task.wechat.app import Wechat


# =============================================================================
# Route tasks (navigate to specific page)
# =============================================================================


class OpenMyQRCode(CriteriaTask):
    """打开微信我的二维码"""
    templates = [
        "打开微信我的二维码页面",
        "Open the My QR Code page in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/me/qrcode"}
    optimal_paths = [[
        "tab.me",
        "me.qrcode.open",
    ]]


class OpenRadarAddFriend(CriteriaTask):
    """打开雷达加好友页面"""
    templates = [
        "打开微信雷达加好友页面",
        "Open the Radar Add Friend page in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/radar"}
    optimal_paths = [[
        "home.menu.plus.open",
        "plusMenu.addFriend.open",
        "addFriend.radar.open",
    ]]


class OpenNewFriends(CriteriaTask):
    """打开新的朋友页面"""
    templates = [
        "打开微信好友添加验证记录页面",
        "Open the friend request history page in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/new-friends"}
    optimal_paths = [[
        "tab.contacts",
        "contacts.newFriends.open",
    ]]


class OpenBlacklist(CriteriaTask):
    """打开通讯录黑名单"""
    templates = [
        "打开微信通讯录黑名单页面",
        "Open the Contacts blacklist page in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["nav"]
    criteria = {"route": "/settings/privacy/blacklist"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
        "settings.privacy.blacklist.open",
    ]]


class FaceToFaceGroupWithPin(CriteriaTask):
    """进入面对面建群并输入密码"""
    templates = [
        "在微信面对面建群里输入密码 {pin}",
        "Enter the PIN {pin} on the WeChat Face-to-Face Group page",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav"]
    parameters = {
        "pin": {
            "type": "string",
            "pattern": r"\d{4}",
            "default": "2345",
            "description": "四位数字 PIN"
        }
    }
    optimal_paths = [[
        "home.menu.plus.open",
        "plusMenu.addFriend.open",
        "addFriend.faceToFace.open",
        {"id": "faceToFace.join.open", "params": {"pin": "2345"}},
    ]]
    criteria = {"route": "/face-to-face-group/join?pin={pin}"}


# =============================================================================
# Setting tasks (toggle a single setting)
# =============================================================================


class ToggleFriendConfirmation(CriteriaTask):
    """开关加好友验证"""
    templates = [
        "{toggle}微信加好友验证",
        "在微信中设置加我为好友时{toggle}验证",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"需要开启": True, "不需要开启": False},
            "default": "不需要开启",
        },
    }
    criteria = {"settings.privacy.friendConfirmation": "{toggle}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ToggleWechatSports(CriteriaTask):
    """开关微信运动功能"""
    templates = [
        "{toggle}微信运动功能",
        "把微信运动{toggle}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": "开启",
        },
    }
    criteria = {"settings.accessibility.wechatSports.enabled": "{toggle}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.accessibility.open",
        {"id": "settings.accessibility.item.open", "params": {"id": "wechatSports"}},
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ToggleDiscoverEntry(CriteriaTask):
    """开关发现页功能入口"""
    templates = [
        "{toggle}微信发现页的{entry}入口",
        "在微信发现页管理里把{entry}{toggle}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]
    parameters = {
        "entry": {
            "type": "enum",
            "values": {
                "朋友圈": "moments",
                "视频号": "channels",
                "直播": "live",
                "扫一扫": "scan",
                "听一听": "listen",
                "看一看": "topStories",
                "搜一搜": "search",
                "附近的人": "nearby",
                "游戏": "games",
            },
            "default": "朋友圈",
            "description": "发现页功能入口",
        },
        "toggle": {
            "type": "bool",
            "values": {"关闭": False, "开启": True},
            "default": "关闭",
        },
    }
    criteria = {"settings.discover.{entry}.visible": "{toggle}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.discover.open",
        {"id": "settings.discover.item.open", "params": {"id": "moments"}},
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ToggleMobileAutoPlayMomentsVideo(CriteriaTask):
    """开关移动网络下朋友圈视频自动播放"""
    templates = [
        "{toggle}微信移动网络下朋友圈视频自动播放",
        "把微信移动网络自动播放朋友圈视频{toggle}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": "关闭",
        },
    }
    criteria = {"settings.general.mobileAutoPlay": "{toggle}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.media.open",
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


# =============================================================================
# Criteria tasks (multiple conditions)
# =============================================================================


class SetAddMeSearch(CriteriaTask):
    """设置添加方式仅允许微信号搜索"""
    templates = [
        "设置微信添加好友时仅能通过微信号搜索到我",
        "Set WeChat so that others can only find me by searching my WeChat ID",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    criteria = {
        "settings.privacy.addMeMethods.searchByPhone": False,
        "settings.privacy.addMeMethods.searchByWxid": True,
    }
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
        "settings.privacy.addMe.open",
    ]]


class SetMomentsVisibleRange(CriteriaTask):
    """设置朋友圈可见范围"""
    templates = ["设置微信朋友查看我朋友圈的范围为{range}可见"]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "range": {
            "type": "enum",
            "values": ["最近三天", "最近一个月", "最近半年", "全部"],
            "default": "最近半年",
            "description": "朋友圈可见范围"
        }
    }
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
        "settings.privacy.moments.open",
        "settings.privacy.moments.menu.range.open",
    ]]
    criteria = {"settings.privacy.momentsRange": "{range}"}


class ToggleStrangerViewMoments(CriteriaTask):
    """开关陌生人查看朋友圈"""
    templates = [
        "{toggle}微信允许陌生人查看十条朋友圈",
        "在微信里把允许陌生人查看十条朋友圈{toggle}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": "关闭",
        },
    }
    criteria = {"settings.privacy.momentsStrangerTen": "{toggle}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.privacy.friends.open",
        "settings.privacy.moments.open",
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class DisableWechatSportsLeaderboard(CriteriaTask):
    """关闭微信运动排行榜"""
    templates = [
        "开启微信运动功能但是关闭加入步数排行榜",
        "Enable WeChat Sports but disable joining the Step Ranking",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]
    criteria = {
        "settings.accessibility.wechatSports.enabled": True,
        "settings.accessibility.wechatSports.joinLeaderboard": False,
    }
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.accessibility.open",
        {"id": "settings.accessibility.item.open", "params": {"id": "wechatSports"}},
        "wechatSports.privacy.open",
    ]]


class EnableDarkMode(CriteriaTask):
    """开启微信深色模式"""
    templates = [
        "开启微信深色模式",
        "Enable dark mode in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    criteria = {
        "settings.general.followSystem": False,
        "settings.general.darkMode": True,
    }
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.darkMode.open",
    ]]


# =============================================================================
# Custom tasks (complex logic)
# =============================================================================


class ReadContactsTotal(AnswerTask):
    """查询微信好友总数"""
    templates = ["看看我微信通讯录里有多少个好友？"]
    apps = ["wechat"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer_fields = [{"type": "number", "label": "好友总数"}]
    optimal_paths = [["tab.contacts"]]
    answer = (".contacts", len)

class SetPatText(CriteriaTask):
    """设置拍一拍文本"""
    templates = [
        "设置微信拍一拍昵称为'{text}'",
        "Set the WeChat Poke suffix text to '{text}'",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "text": {
            "type": "string",
            "default": "并笑了一下",
            "description": "拍一拍后缀文本"
        }
    }
    optimal_paths = [[
        "tab.me",
        "profile.detail.open",
        "profile.pat.open",
    ]]
    criteria = {"user.pat": "{text}"}


class PostMomentsText(CriteriaTask):
    """发布文字朋友圈"""
    templates = [
        "发一条朋友圈，内容为'{content}'",
        "Post a Moment with the text '{content}'",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["create"]
    parameters = {
        "content": {
            "type": "string",
            "default": "Hello World!",
            "description": "朋友圈文本内容"
        }
    }
    optimal_paths = [[
        "tab.discover",
        "discover.moments.open",
        "moments.post.open.longPress",
    ]]
    expected_changes = ["moments[+1]"]
    criteria = {
        "moments[0].content": "{content}",
        "moments[0].images": lambda imgs: not imgs,  # 无图片
    }


class PostMomentsTextWithCity(CriteriaTask):
    """发布带定位的文字朋友圈"""
    templates = [
        "发一条朋友圈，内容为'{content}'，定位到 {location}",
        "Post a Moment with the text '{content}', tagged at {location}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["create"]
    parameters = {
        "content": {
            "type": "string",
            "default": "Hello World!",
            "description": "朋友圈文本内容"
        },
        "location": {
            "type": "string",
            "default": "北京市",
            "description": "定位城市"
        }
    }
    optimal_paths = [[
        "tab.discover",
        "discover.moments.open",
        "moments.post.open.longPress",
        "postMoment.selectLocation.open",
    ]]
    expected_changes = ["moments[+1]"]
    criteria = {
        "moments[0].content": "{content}",
        "moments[0].images": lambda imgs: not imgs,
        "moments[0].location": "{location}",
    }


class ScenicPhotoToMomentsWithPhrase(BaseTask):
    templates = ["把{time_hint}拍的{place_name}照片发到朋友圈，配文带上{required_phrase}"]
    apps = ["wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["social", "transfer"]
    parameters = {
        "time_hint": {"type": "string", "default": "上周"},
        "place_name": {"type": "string", "default": "颐和园万寿山"},
        "required_phrase": {"type": "string", "default": "春天真好"},
        "_photo_path": {
            "type": "string",
            "default": "/sdcard/DCIM/Camera/IMG_20260320_yiheyuan_wanshoushan.jpg",
        },
    }
    expected_changes = ["moments[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        phrase_check = wechat.check_new_moment_with(
            str(self.p.required_phrase),
            field="moment_phrase",
        )
        moments = wechat.new_moments_by_me()
        moment = moments[0] if moments else None
        images = list((moment or {}).get("images") or [])
        has_expected_image = str(self.p._photo_path) in [str(item) for item in images]
        return [
            phrase_check,
            {
                "field": "moment_scenic_photo",
                "expected": {
                    "time_hint": self.p.time_hint,
                    "place_name": self.p.place_name,
                    "photo_path": self.p._photo_path,
                },
                "actual": {"images": images, "content": str((moment or {}).get("content") or "")},
                "passed": moment is not None and has_expected_image,
            },
        ]


# =============================================================================
# New tasks
# =============================================================================


class ReadMyWxid(AnswerTask):
    """查询自己的微信号。"""
    templates = ["帮我看看微信里我的微信号是多少",
     "在微信里看一下我的微信号是多少"]
    apps = ["wechat"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav", "query"]
    answer_fields = [{"type": "text", "label": "微信号"}]
    optimal_paths = [[
        "tab.me",
        "profile.detail.open",
        "profile.wxid.open",
    ]]
    answer = ".user.wxid"


class SetSignature(CriteriaTask):
    """设置个性签名。"""
    templates = [
        "把微信里的个性签名改成{text}",
        "帮我把微信个性签名改成{text}",
        "Change my WeChat signature to {text}",
        "Set my WeChat signature to {text}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "edit"]
    parameters = {
        "text": {
            "type": "enum",
            "values": ["享受每一天", "在路上", "今天也要加油"],
            "default": "享受每一天",
            "description": "新的个性签名",
        }
    }
    criteria = {"user.signature": "{text}"}
    optimal_paths = [[
        "tab.me",
        "profile.detail.open",
        "profile.signature.open",
    ]]


class SetNotificationSound(CriteriaTask):
    """设置消息提示音。"""
    templates = [
        "把微信的消息提示音改成{sound}",
        "帮我把微信消息提示音设为{sound}",
        "Change the WeChat notification sound to {sound}",
        "Set the WeChat notification sound to {sound}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]
    parameters = {
        "sound": {
            "type": "enum",
            "values": ["积木", "可爱", "空灵", "俏皮", "清脆", "灵动", "优雅"],
            "default": "积木",
            "description": "消息提示音",
        }
    }
    criteria = {"settings.notifications.notificationSound": "{sound}"}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.notifications.open",
        "settings.notifications.sound.open",
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class SendMessageToContact(BaseTask):
    """给联系人发送消息。"""
    templates = [
        "在微信里给{contact}发一条消息：{content}",
        "帮我在微信里发消息给{contact}，内容是{content}",
        "Send a message to {contact} in WeChat: {content}",
        "In WeChat, send {contact} this message: {content}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "edit"]
    parameters = {
        "contact": {
            "type": "enum",
            "values": ["blank.", "张伟", "Boss"],
            "default": "张伟",
            "description": "消息接收人",
        },
        "content": {
            "type": "string",
            "default": "周末见",
            "description": "消息内容",
        },
    }
    expected_changes = ["chats[user.name={contact}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_sent_to(
                self.p.contact,
                self.p.content,
                field="send_message",
            )
        ]


class BlacklistContact(CriteriaTask):
    """把联系人加入黑名单。"""
    templates = [
        "把微信里的{contact}加入黑名单",
        "帮我在微信里把{contact}拉黑",
        "Add {contact} to the blacklist in WeChat",
        "Block {contact} in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]
    parameters = {
        "contact": {
            "type": "string",
            "sampler": Wechat.sample_friend_name,
            "default": "刘浪",
            "description": "要拉黑的联系人",
        }
    }
    criteria = {"contacts[name={contact}].isBlacklisted": True}


class DeauthorizeApp(CriteriaTask):
    """解除第三方授权。"""
    templates = [
        "取消微信对{app_name}的授权",
        "把{app_name}的微信授权关掉",
        "Revoke WeChat authorization for {app_name}",
        "Remove {app_name}'s WeChat authorization",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["nav", "settings"]
    parameters = {
        "app_name": {
            "type": "string",
            "source": "apps.wechat.authorizedApps[name]",
            "default": "拼多多",
            "description": "已授权应用名称",
        }
    }
    criteria = {"authorizedApps[name={app_name}]": None}


class ReadContactRegion(AnswerTask):
    """读取联系人地区。"""
    templates = ["帮我看看微信里{contact}是哪里人", "查一下微信联系人{contact}的地区"]
    apps = ["wechat"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["nav", "query"]
    answer_fields = [{"type": "text", "label": "地区", "hint": "如：浙江 杭州"}]
    parameters = {
        "contact": {
            "type": "string",
            "source": "apps.wechat.contacts[name]",
            "default": "blank.",
            "description": "联系人名称",
        }
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wc = Wechat(input.apps_init["wechat"])
        contact = wc.find_contact(str(self.p.contact))
        region = (contact or {}).get("region", "") or ""
        answer_text = str(input.answer or "")
        # region 可能是 "中国 杭州"、"广东 深圳"、"马达加斯加" 等
        # 完整匹配或空格后的城市部分匹配均算通过
        parts = [region] + region.split()
        passed = any(p and p in answer_text for p in parts)
        return [{
            "field": "answer.地区",
            "expected": region,
            "actual": input.answer,
            "passed": passed,
        }]


class SetFriendChatOnly(CriteriaTask):
    """把联系人权限改成仅聊天。"""
    templates = [
        "把微信联系人{contact}的权限改成仅聊天",
        "帮我把微信里{contact}设成仅聊天",
        "Set the permissions for WeChat contact {contact} to Chat Only",
        "Change {contact}'s permission to Chat Only in WeChat",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]
    parameters = {
        "contact": {
            "type": "string",
            "sampler": Wechat.sample_friend_name,
            "default": "blank.",
            "description": "联系人名称",
        }
    }
    criteria = {"contacts[name={contact}].permissionMode": "chatOnly"}


class ReadStepsLeaderboardTop(CriteriaTask):
    """开启微信运动并回答排行榜第一名。"""
    templates = ["打开微信运动功能，然后看看谁走的步数最多", "帮我打开微信运动功能，看排行榜第一名是谁"]
    apps = ["wechat"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings", "query"]
    answer_fields = [{"type": "text", "label": "步数最多的人"}]
    criteria = {"settings.accessibility.wechatSports.enabled": True}
    optimal_paths = [[
        "tab.me",
        "me.settings.open",
        "settings.general.open",
        "settings.general.accessibility.open",
        "settings.accessibility.wechatSports.open",
        "settings.accessibility.wechatSports.enable.submit",
        "wechatSports.open",
        "wechatSports.leaderboard.open",
    ]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)

    def get_answer(self, input: JudgeInput) -> Any:
        wechat = Wechat(input.apps_init["wechat"])
        return wechat.top_stepper()[0]


class ConditionalReplyToBoss(BaseTask):
    """根据 Boss 历史消息做条件回复。"""
    templates = [
        "在微信里看看Boss之前有没有问过关于{keyword}的消息，有的话给他发{yes_reply}，没有就发{no_reply}",
        "检查一下微信里Boss的聊天记录，如果有{keyword}相关消息，就发送{yes_reply}，没有就发送{no_reply}",
        "In WeChat, check if Boss has previously asked about {keyword}. If yes, send him {yes_reply}; if not, send {no_reply}",
        "Check Boss's chat history in WeChat for messages about {keyword} — send {yes_reply} if found, otherwise send {no_reply}",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning", "edit"]
    parameters = {
        "keyword": {
            "type": "string",
            "default": "项目进度",
            "description": "需要检查的关键词",
        },
        "yes_reply": {
            "type": "string",
            "default": "上次的项目一切顺利",
            "description": "命中关键词时的回复",
        },
        "no_reply": {
            "type": "string",
            "default": "项目进展正常",
            "description": "未命中关键词时的回复",
        },
    }
    expected_changes = ["chats[user.name=Boss]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat_init = Wechat(input.apps_init["wechat"])
        has_keyword = any(
            self.p.keyword in text for text in wechat_init.received_texts_from("Boss")
        )
        expected_reply = self.p.yes_reply if has_keyword else self.p.no_reply
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_sent_to(
                "Boss",
                expected_reply,
                field="conditional_reply",
            )
        ]


class PostMomentFromChat(BaseTask):
    """把聊天内容转发为朋友圈。"""
    templates = [
        "看看微信里{contact}最近给我发了什么消息，把那条消息的内容原封不动发到朋友圈",
        "读一下微信里{contact}最新发来的消息，然后把那句话原封不动发到朋友圈",
        "Check what {contact} recently sent me in WeChat, then post that exact message to Moments",
        "Read {contact}'s latest message to me in WeChat and post it verbatim to Moments",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "create"]
    parameters = {
        "contact": {
            "type": "enum",
            "values": ["blank.", "张伟"],
            "default": "张伟",
            "description": "消息来源联系人",
        }
    }
    expected_changes = ["moments[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat_init = Wechat(input.apps_init["wechat"])
        source_text = wechat_init.last_received_text_from(self.p.contact)
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_new_moment_with(source_text, field="moment_from_chat"),
            wechat.check_new_moment_no_images(),
        ]


class BlacklistThenNotify(BaseTask):
    """拉黑联系人后通知另一个人。"""
    templates = [
        "在微信里把{target}拉黑，然后给{notify_to}发消息说我把{target}拉黑了",
        "先在微信里把{target}加入黑名单，再告诉{notify_to}我把{target}拉黑了",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["nav", "settings", "edit"]
    parameters = {
        "target": {"type": "string", "default": "刘浪", "description": "要拉黑的联系人"},
        "notify_to": {"type": "string", "default": "张伟", "description": "通知对象"},
        "_pair": {
            "sampler": Wechat.sample_two_friend_names,
            "fields": {"target": "target", "notify_to": "notify_to"},
        },
    }
    expected_changes = [
        "contacts[name={target}]",
        "chats[user.name={notify_to}]",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            wechat.check_blacklisted(self.p.target),
            wechat.check_new_sent_to(
                self.p.notify_to, self.p.target, "拉黑",
                field="notify_message",
            ),
        ]


class CompareStepsAndMessage(BaseTask):
    """比较两人步数并给赢家发消息，同时回答赢家是谁。"""
    templates = [
        "在微信运动里看看{contact1}和{contact2}今天谁的步数更多，把“{content}”发给那个人，并告诉我是谁",
        "在微信运动里比较一下{contact1}和{contact2}今天谁走得更多，给走得多的人发“{content}”，再告诉我是谁",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["query", "reasoning", "edit"]
    answer_fields = [
        {"type": "choice", "label": "步数更多的人",
         "options": ["{contact1}", "{contact2}"]}
    ]
    parameters = {
        "contact1": {
            "type": "string",
            "default": "李娜",
            "description": "联系人1",
        },
        "contact2": {
            "type": "string",
            "default": "杨杰",
            "description": "联系人2",
        },
        "_step_pair": {
            "sampler": Wechat.sample_diff_steps_pair,
            "fields": {"contact1": "contact1", "contact2": "contact2"},
        },
        "content": {
            "type": "string",
            "default": "今天运动量不错，继续加油！",
            "description": "鼓励消息内容",
        },
    }
    expected_changes = ["chats"]

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        wechat = Wechat(input.apps_init["wechat"])
        steps1 = wechat.contact_steps(self.p.contact1)
        steps2 = wechat.contact_steps(self.p.contact2)
        winner = self.p.contact1 if steps1 > steps2 else self.p.contact2
        wxid = wechat.find_contact_wxid(winner)
        return [f"chats[id={wxid}]"] if wxid else ["chats"]

    async def _prepare(self, env):
        await env.set_state(
            {"apps": {"wechat": {"settings": {"accessibility": {"wechatSports": {"enabled": True}}}}}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        steps1 = wechat.contact_steps(self.p.contact1)
        steps2 = wechat.contact_steps(self.p.contact2)
        winner = self.p.contact1 if steps1 > steps2 else self.p.contact2
        checks = [
            wechat.check_new_sent_to(
                winner,
                self.p.content,
                field="encourage_winner",
            )
        ]
        checks.extend(build_answer_checks(winner, input.answer))
        return checks


class StarAndRestrictFriend(CriteriaTask):
    """星标好友并限制朋友圈权限。"""
    templates = [
        "把微信联系人{contact}设为星标好友，不让他看我的朋友圈，也不看他朋友圈",
        "把微信里的{contact}加为星标好友，不看他朋友圈，也不让他看我的朋友圈",
        "Star the WeChat contact {contact}, hide my Moments from them, and hide their Moments from me",
        "Set {contact} as a starred friend in WeChat, and block Moments sharing in both directions",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["nav", "settings"]
    parameters = {
        "contact": {
            "type": "string",
            "sampler": Wechat.sample_friend_name,
            "default": "blank.",
            "description": "联系人名称",
        }
    }
    criteria = {
        "contacts[name={contact}].isStarred": True,
        "contacts[name={contact}].hideMyMoments": True,
        "contacts[name={contact}].hideTheirMoments": True,
    }


class SendAndReadReply(BaseTask):
    """验证 Agent 是否给联系人发了消息、等到自动回复后正确报告了回复内容。

    判定两个独立目标：
    ① sent_message — 使用 Wechat.check_new_sent_to 验证新消息包含 {message}
    ② answer — 使用 build_answer_checks 验证 Agent 回答包含实际回复内容

    注意：联系人需配置 aiConfig.enabled=true（mock 模式返回随机短句）。
    回复内容在任务执行后才生成，judge 从 state 中读取实际回复做 ground truth。
    若 Agent 发了消息但未等到回复就作答，answer check 自然 fail。
    """

    templates = [
        "在微信里给{contact}发一句「{message}」，看看对方怎么回复的，把回复告诉我",
        "帮我在微信给{contact}发「{message}」，等对方回了把回复内容告诉我",
    ]
    apps = ["wechat"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["edit", "query"]
    answer_fields = [{"type": "text", "label": "对方的回复内容"}]
    parameters = {
        "contact": {
            "type": "enum",
            "values": ["blank.", "张伟", "陈静"],
            "default": "张伟",
            "description": "消息接收人（需有自动回复）",
        },
        "message": {
            "type": "string",
            "default": "在吗",
            "description": "发送的消息内容",
        },
    }
    expected_changes = ["chats[user.name={contact}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        replies = wechat.new_received_texts_from(self.p.contact)
        reply_text = replies[-1] if replies else ""
        answer_checks = (
            build_answer_checks(reply_text, input.answer)
            if reply_text
            else [{
                "field": "answer",
                "expected": "回复内容",
                "actual": str(input.answer or "") or "(none)",
                "passed": False,
            }]
        )
        return [
            wechat.check_new_sent_to(
                self.p.contact, self.p.message, field="sent_message"
            ),
            *answer_checks,
        ]


class WechatModifyAppPermissionsByRevokingAuthorization(CriteriaTask):
    templates = [
        "帮我在微信里取消对应用{authorizedAppName}的授权",
        "Revoke the authorization for the app {authorizedAppName} in WeChat",
    ]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["wechat"]
    criteria = {
        "authorizedApps[name={authorizedAppName}]": None,
    }
    parameters = {
        "authorizedAppName": {"type": "string", "source": "apps.wechat.authorizedApps[name]", "default": "拼多多", "description": "第三方授权应用名称"},
    }
