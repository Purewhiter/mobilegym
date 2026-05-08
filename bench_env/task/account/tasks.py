"""
Account specialized task definitions.

覆盖注册、登录、改密、找回密码、验证码、设备信任、注销等账号流程。
"""
# -- Task Index (auto-generated, do not edit) --
# 5 tasks | L3×2  L4×3
#
# [L4] Railway12306LoginWithAccount     备忘录里标题为{noteTitle}的笔记记着铁路12306账号{username}的几个候选密码，帮我试出哪个能登录，并把笔记改成只保留正确密码
# [L3] Railway12306RegisterThenLogin    帮我注册一个新的铁路12306账号{username}，密码是{password}，姓名{name}，身份证{idNo}，手机号{phone}，邮箱{email}，然后登陆
# [L3] Railway12306ChangePassword       帮我把铁路12306的登录密码从{oldPassword}改成{newPassword}
# [L4] WechatAccountCancellation        帮我把微信账号注销掉
# [L4] Railway12306ForgotPasswordReset  帮我用手机号{accountPhone}和证件号{idNo}找回 12306 密码，把新密码设成{newPassword}，再用新密码登录一次
# -- End Task Index --


from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import Notes
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.railway12306.app import Railway12306
from bench_env.task.utils import (
    now_ms,
)

class Railway12306LoginWithAccount(BaseTask):
    """判定：12306 以目标用户名登录成功 + 笔记只保留正确密码。"""

    templates = [
        "备忘录里标题为{noteTitle}的笔记记着铁路12306账号{username}的几个候选密码，帮我试出哪个能登录，并把笔记改成只保留正确密码",
        "The note titled {noteTitle} contains several candidate passwords for Railway 12306 account {username}. Please try them to find which one works, then edit the note to keep only the correct password",
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "edit", "transfer"]
    apps = ["railway12306", "notes"]
    expected_changes = [
        "railway12306.isLoggedIn",
        "railway12306.loginUser",
        "railway12306.auth",
        "railway12306.lastLoginHint",
        "railway12306.account",
        "notes.notes",
    ]
    parameters = {
        "noteTitle": {"type": "string", "default": "12306账号密码", "description": "备忘录标题"},
        "username": {"type": "string", "default": "user_123", "description": "登录用户名"},
        "correctPassword": {"type": "string", "default": "123456", "description": "正确密码"},
        "otherPasswords": {"type": "string", "default": "111111,888888,password", "description": "错误密码列表（逗号分隔）"},
    }

    async def _post_sample(self, env: Any) -> None:
        state = await env.get_state()
        now = now_ms(state["os"])

        user = str(self.p.username)
        correct = str(self.p.correctPassword)
        others = [x.strip() for x in str(self.p.otherPasswords).split(",") if x.strip()]
        all_pwds = others + [correct]

        content = f"账号：{user}\n密码：\n" + "\n".join(all_pwds)

        await env.set_state({
            "apps": {
                "notes": {
                    "notes": [
                        {
                            "id": "note_12306_login",
                            "title": str(self.p.noteTitle),
                            "content": content,
                            "updatedAt": now,
                        }
                    ]
                },
                "railway12306": {
                    "isLoggedIn": False,
                    "loginUser": None,
                    "auth": {
                        "accounts": [
                            {"username": user, "password": correct, "phone": "13800000000", "email": f"{user}@example.com"},
                        ],
                        "loginAttempts": [],
                        "lastLoginHint": "",
                    },
                }
            }
        }, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"])
        notes = Notes(input.apps["notes"])
        note = notes.latest_note_by_title(str(self.p.noteTitle))
        note_content = str(note["content"]) if note else "(笔记不存在)"

        target_pwd = str(self.p.correctPassword)
        others = [x.strip() for x in str(self.p.otherPasswords).split(",") if x.strip()]
        has_correct = target_pwd in note_content
        has_others = any(bad in note_content for bad in others if bad and bad != target_pwd)
        note_ok = note is not None and has_correct and not has_others

        return [
            rail.check_login_success(str(self.p.username)),
            {
                "field": "notes.content.filtered",
                "expected": f"只保留正确密码 '{target_pwd}'",
                "actual": note_content[:200] if note else "(笔记不存在)",
                "passed": note_ok,
            },
        ]


class Railway12306RegisterThenLogin(BaseTask):
    """判定：12306 账号已创建（密码匹配）、已登录、profile 信息脱敏后正确。"""

    templates = [
        "帮我注册一个新的铁路12306账号{username}，密码是{password}，姓名{name}，身份证{idNo}，手机号{phone}，邮箱{email}，然后登陆",
        "Register a new Railway 12306 account {username} with password {password}, name {name}, ID number {idNo}, phone {phone}, email {email}, then log in",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create", "edit"]
    apps = ["railway12306"]
    expected_changes = [
        "isLoggedIn",
        "loginUser",
        "auth",
        "user",
        "passengers",
        "lastLoginHint",
        "userProfile",
        "account",
        "os.providers.sms",
        "os.notifications",
        "apps.sms",
    ]
    parameters = {
        "username": {"type": "string", "default": "new_user_001", "description": "注册用户名"},
        "password": {"type": "string", "default": "Reg2026x", "description": "注册密码"},
        "name": {"type": "string", "default": "张三", "description": "姓名"},
        "idNo": {"type": "string", "default": "110101199001011234", "description": "身份证号"},
        "phone": {"type": "string", "default": "13800000000", "description": "手机号"},
        "email": {"type": "string", "default": "new_user_001@example.com", "description": "邮箱"},
    }

    async def _prepare(self, env: Any) -> None:
        await env.set_state({
            "apps": {
                "railway12306": {
                    "isLoggedIn": False,
                    "loginUser": None,
                }
            }
        }, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"])
        return [
            rail.check_registration(
                username=str(self.p.username),
                password=str(self.p.password),
                name=str(self.p.name),
                phone=str(self.p.phone),
            ),
        ]


class Railway12306ChangePassword(BaseTask):
    """判定：loginUser 和 auth.accounts 中密码均已更新为新密码，且保持登录状态。"""

    templates = [
        "帮我把铁路12306的登录密码从{oldPassword}改成{newPassword}",
        "Change my Railway 12306 login password from {oldPassword} to {newPassword}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings", "edit"]
    apps = ["railway12306"]
    expected_changes = [
        "loginUser",
        "auth",
        "os.providers.sms.messagesByConversationId",
        "os.providers.sms.conversations",
        "os.notifications",
    ]
    parameters = {
        "oldPassword": {"type": "string", "default": "123456", "description": "原密码"},
        "newPassword": {"type": "string", "default": "Abc@5678", "description": "新密码"},
    }

    async def _post_sample(self, env: Any) -> None:
        await env.set_state({
            "apps": {
                "railway12306": {
                    "isLoggedIn": True,
                    "loginUser": {
                        "username": "user_123",
                        "password": str(self.p.oldPassword),
                    },
                    "auth": {
                        "accounts[username=user_123]": None,
                        "accounts[]": {
                            "username": "user_123",
                            "password": str(self.p.oldPassword),
                            "name": "测试用户",
                            "phone": "13812348520",
                            "idNo": "310101199501017821",
                            "email": "test@example.com",
                        },
                    },
                }
            }
        }, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"])
        return [
            rail.check_password_changed(str(self.p.newPassword)),
        ]


class WechatAccountCancellation(CriteriaTask):
    """判定：user.accountStatus 变为 cancelled。"""

    templates = [
        "帮我把微信账号注销掉",
        "Cancel my WeChat account",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    apps = ["wechat"]
    criteria = {"user.accountStatus": "cancelled"}
    expected_changes = ["user", "auth"]


class Railway12306ForgotPasswordReset(BaseTask):
    """注入：创建目标手机号的账号并设初始密码，清空登录状态。

    判定：密码已更新 + 验证码已验证（必经之路）+ 用新密码登录成功。
    """

    templates = [
        "帮我用手机号{accountPhone}和证件号{idNo}找回 12306 密码，把新密码设成{newPassword}，再用新密码登录一次",
        "Use phone number {accountPhone} and ID number {idNo} to recover my 12306 password, set the new password to {newPassword}, then log in once with the new password",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings", "edit"]
    apps = ["railway12306"]
    expected_changes = [
        "auth",
        "isLoggedIn",
        "loginUser",
        "lastLoginHint",
        "userProfile",
        "user",
        "account",
        "os.providers.sms",
        "os.notifications",
    ]
    parameters = {
        "accountPhone": {"type": "string", "default": "17366666695", "description": "账号手机号"},
        "idNo": {"type": "string", "default": "110101199001011234", "description": "证件号码"},
        "newPassword": {"type": "string", "default": "NewP@ssw0rd123", "description": "新密码"},
    }

    async def _post_sample(self, env: Any) -> None:
        phone = str(self.p.accountPhone)
        id_no = str(self.p.idNo)
        await env.set_state({
            "apps": {
                "railway12306": {
                    "isLoggedIn": False,
                    "loginUser": None,
                    "auth": {
                        f"accounts[phone={phone}]": None,
                        "accounts[]": {
                            "username": "user_" + phone,
                            "phone": phone,
                            "password": "railway_pwd_123",
                            "name": "Test User",
                            "idNo": id_no,
                            "email": "test@example.com",
                        },
                        "loginAttempts": [],
                        "resetVerification": None,
                        "resetVerificationAttempts": [],
                    }
                }
            }
        }, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"])
        phone = str(self.p.accountPhone)
        new_pwd = str(self.p.newPassword)
        acc = rail.account_by_phone(phone)
        pwd_now = str(acc["password"]) if acc else "(账号不存在)"
        pwd_updated = acc is not None and pwd_now == new_pwd

        reset_attempts = rail.auth["resetVerificationAttempts"]
        code_verified = any(
            str(item["phone"]) == phone and bool(item["ok"])
            for item in reset_attempts
        )

        login_user = rail.login_user
        logged_ok = (
            rail.is_logged_in
            and login_user is not None
            and str(login_user["password"]) == new_pwd
            and str(login_user["phone"]) == phone
        )
        return [
            {
                "field": "password_updated",
                "expected": new_pwd,
                "actual": pwd_now,
                "passed": pwd_updated,
            },
            {
                "field": "code_verified",
                "expected": f"phone={phone} 验证码已验证",
                "actual": f"已验证" if code_verified else "未完成验证",
                "passed": code_verified,
            },
            {
                "field": "logged_with_new_password",
                "expected": f"已登录 phone={phone} pwd={new_pwd}",
                "actual": (
                    f"loggedIn={rail.is_logged_in}, user={login_user['phone'] if login_user else '(无)'}"
                ),
                "passed": logged_ok,
            },
        ]

## 微信登录页面未完善，相关任务全部搁置

# class WechatWrongPasswordThenCaptchaLogin(BaseTask):
#     """
#     让Agent从备忘录读取候选密码，逐个尝试登录微信（期间触发安全验证），
#     成功后把笔记改成只留下正确密码。
#     """
#     templates = ["备忘录里有几个我用过的微信密码，但是我不确定哪个是现在用的，帮我试出哪个能登录，然后登陆微信，并把笔记改成只留下正确密码"]
#     scope = "S2"
#     objective = "operate"
#     composition = "transfer"
#     difficulty = "L3"
#     capabilities = ["search", "edit", "transfer"]
#     apps = ["wechat", "notes"]
#     expected_changes = [
#         "apps.wechat.auth",
#         "apps.notes.notes",
#     ]
#     parameters = {
#         "password": {"type": "string", "default": "wechat_pwd_123", "description": "正确密码"},
#         "otherPasswords": {"type": "string", "default": "abc123,qwerty,pass999", "description": "错误密码列表（逗号分隔）"},
#     }

#     async def _post_sample(self, env: Any) -> None:
#         state = await env.get_state()
#         device_id = _os_device_id(state["os"])
#         now = now_ms(state["os"])
#         auth = state["apps"]["wechat"]["auth"]
#         session_phone = auth["session"]["phone"]
#         user_phone = state["apps"]["wechat"]["user"]["phone"]
#         phone = str(session_phone or user_phone or "17366666695")
#         accounts = [account for account in auth["accounts"] if str(account["phone"]) != phone]
#         accounts.append({"phone": phone, "password": str(self.p.password), "createdAt": now, "activated": True, "failedAttempts": 0, "requireCaptcha": False})
#         trusted = dict(auth["trustedDevicesByPhone"])
#         trusted[phone] = [{"deviceId": device_id, "deviceName": device_id, "trustedAt": 0}]

#         others = [x.strip() for x in str(self.p.otherPasswords).split(",") if x.strip()]
#         all_pwds = others + [str(self.p.password)]
#         note_content = "\n".join(all_pwds)

#         await env.set_state({
#             "apps": {
#                 "wechat": {
#                     "auth": {
#                         "accounts": accounts,
#                         "session": {"loggedIn": False, "phone": None, "expiresAt": None, "currentDeviceId": device_id},
#                         "trustedDevicesByPhone": trusted,
#                         "loginAttempts": [],
#                         "pendingTrustDevice": None,
#                     }
#                 },
#                 "notes": {
#                     "notes": [
#                         {
#                             "id": "note_wechat_pwd",
#                             "title": "微信密码",
#                             "content": note_content,
#                             "updatedAt": now,
#                         }
#                     ]
#                 },
#             }
#         }, deep=True, reload=False)

#     def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
#         wechat = Wechat(input.apps["wechat"])
#         session = wechat.session
#         logged_in = bool(session.get("loggedIn"))
#         phone = str(session.get("phone") or wechat.user.get("phone") or "")
#         login_ok = logged_in and bool(phone)

#         notes = Notes(input.apps["notes"])
#         all_notes = notes.notes
#         target_pwd = str(self.p.password)
#         others = [x.strip() for x in str(self.p.otherPasswords).split(",") if x.strip()]
#         matched_note = next(
#             (n for n in all_notes if target_pwd in str(n.get("content") or "")),
#             None,
#         )
#         note_content = str(matched_note.get("content") or "") if matched_note else ""
#         has_correct = target_pwd in note_content
#         has_others = any(bad in note_content for bad in others if bad and bad != target_pwd)
#         note_ok = matched_note is not None and has_correct and not has_others

#         return [
#             {"field": "wechat.login.success", "expected": f"loggedIn with phone={phone}", "actual": f"loggedIn={logged_in}, phone={phone}", "passed": login_ok},
#             {"field": "notes.content.filtered", "expected": f"only correct password '{target_pwd}'", "actual": {"has_correct": has_correct, "has_others": has_others, "content": note_content[:200]}, "passed": note_ok},
#         ]


# class WechatNewDeviceLoginTrustThenVerifyInDeviceManagement(BaseTask):
#     templates = ["帮我用密码{password}登录手机号为{newDeviceLogin}的微信账号，如果出现设备识别提示就信任这台设备，并确认它已经出现在设备管理里"]
#     scope = "S1"
#     objective = "operate"
#     composition = "sequential"
#     difficulty = "L3"
#     capabilities = ["settings"]
#     apps = ["wechat"]
#     expected_changes = ["auth"]
#     parameters = {
#         "newDeviceLogin": {"type": "string", "default": "17366666695", "description": "登录手机号"},
#         "password": {"type": "string", "default": "wechat_pwd_123", "description": "密码"},
#     }

#     async def _post_sample(self, env: Any) -> None:
#         state = await env.get_state()
#         device_id = _os_device_id(state["os"])
#         phone = str(self.p.newDeviceLogin)
#         auth = state["apps"]["wechat"]["auth"]
#         accounts = list(auth["accounts"])
#         if not any(str(account["phone"]) == phone for account in accounts):
#             accounts.append({"phone": phone, "password": str(self.p.password), "createdAt": now_ms(state["os"]), "activated": True, "failedAttempts": 0, "requireCaptcha": False})
#         trusted = dict(auth["trustedDevicesByPhone"])
#         trusted[phone] = [{"deviceId": "old_device_x", "deviceName": "旧设备", "trustedAt": 0}]
#         await env.set_state({
#             "apps": {
#                 "wechat": {
#                     "auth": {
#                         "accounts": accounts,
#                         "session": {"loggedIn": False, "phone": None, "expiresAt": None, "currentDeviceId": device_id},
#                         "trustedDevicesByPhone": trusted,
#                         "loginAttempts": [],
#                         "pendingTrustDevice": None,
#                         "captcha": {"requiredAfterFailures": 3},
#                     }
#                 }
#             }
#         }, deep=True, reload=False)

#     def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
#         wechat = Wechat(input.apps["wechat"])
#         phone = str(self.p.newDeviceLogin)
#         attempts = wechat.login_attempts
#         prompted = any(str(item["phone"]) == phone and str(item["reason"]) == "untrusted_device" for item in attempts)
#         session = wechat.session
#         logged_ok = bool(session["loggedIn"]) and str(session["phone"]) == phone
#         device_id = _os_device_id(input.os)
#         trusted_list = (wechat.auth.get("trustedDevicesByPhone") or {}).get(phone, [])
#         trusted_ok = any(str(item["deviceId"]) == device_id for item in trusted_list)
#         pending_cleared = wechat.auth.get("pendingTrustDevice") is None
#         return [
#             {"field": "apps.wechat.auth.device_prompt.shown", "expected": True, "actual": prompted, "passed": prompted},
#             {"field": "apps.wechat.auth.session.loggedIn", "expected": phone, "actual": session, "passed": logged_ok},
#             {"field": "apps.wechat.auth.trustedDevices.contains_current", "expected": device_id, "actual": trusted_list, "passed": trusted_ok},
#             {"field": "apps.wechat.auth.pendingTrustDevice.cleared", "expected": True, "actual": wechat.auth.get("pendingTrustDevice"), "passed": pending_cleared},
#         ]


# class WechatVisitMeAndOpenAccountSecurityReloginIfExpired(BaseTask):
#     templates = ["帮我进入微信里的“账号与安全”页面；如果登录失效了，就用密码{password}重新登录后继续进入"]
#     scope = "S1"
#     objective = "operate"
#     composition = "sequential"
#     difficulty = "L3"
#     capabilities = ["settings"]
#     apps = ["wechat"]
#     expected_changes = ["auth"]
#     parameters = {
#         "_expireAfterSec": {"type": "int", "default": 2, "min": 1, "max": 10, "description": "内部登录失效秒数"},
#         "password": {"type": "string", "default": "wechat_pwd_123", "description": "微信登录密码"},
#     }

#     async def _post_sample(self, env: Any) -> None:
#         state = await env.get_state()
#         os_state = state["os"]
#         now = now_ms(os_state)
#         expires_at = now + int(self.p._expireAfterSec) * 1000
#         device_id = _os_device_id(os_state)
#         auth = state["apps"]["wechat"]["auth"]
#         phone = str(auth["session"]["phone"] or state["apps"]["wechat"]["user"]["phone"] or "17366666695")
#         accounts = list(auth["accounts"])
#         if not any(str(account["phone"]) == phone for account in accounts):
#             accounts.append({"phone": phone, "password": str(self.p.password), "createdAt": now, "activated": True, "failedAttempts": 0, "requireCaptcha": False})
#         trusted = dict(auth["trustedDevicesByPhone"])
#         trusted[phone] = [{"deviceId": device_id, "deviceName": device_id, "trustedAt": 0}]
#         await env.set_state({
#             "apps": {
#                 "wechat": {
#                     "auth": {
#                         "accounts": accounts,
#                         "session": {"loggedIn": True, "phone": phone, "expiresAt": expires_at, "currentDeviceId": device_id},
#                         "trustedDevicesByPhone": trusted,
#                         "loginAttempts": [],
#                         "captcha": {"requiredAfterFailures": 3},
#                         "pendingTrustDevice": None,
#                     }
#                 }
#             }
#         }, deep=True, reload=False)

#     def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
#         wechat = Wechat(input.apps["wechat"])
#         session = wechat.session
#         expired_at = session.get("lastExpiredAt")
#         expired_once = bool(expired_at)
#         logged_in = bool(session["loggedIn"])
#         path = str(input.route["path"]) if "path" in input.route else ""
#         on_target = path == "/settings/security"
#         relogin_success = any(
#             bool(item.get("ok"))
#             and str(item.get("reason")) == "ok"
#             and str(item.get("password")) == str(self.p.password)
#             for item in wechat.login_attempts
#         )
#         relogin_if_needed = (not expired_once) or relogin_success
#         return [
#             {"field": "route", "expected": "/settings/security", "actual": path, "passed": on_target},
#             {"field": "apps.wechat.auth.session.loggedIn", "expected": True, "actual": logged_in, "passed": logged_in},
#             {"field": "apps.wechat.auth.session.relogin_if_expired", "expected": True, "actual": {"expired": expired_once, "reloginSuccess": relogin_success}, "passed": relogin_if_needed},
#         ]


# class WechatRegisterNewAccountWithPhoneVerificationAndRealName(BaseTask):
#     templates = ["帮我用手机号{phoneNumber}注册一个新微信账号，昵称叫{nickname}，密码设成{password}，并完成实名认证：姓名{realName}、身份证{idNumber}"]
#     scope = "S1"
#     objective = "operate"
#     composition = "sequential"
#     difficulty = "L4"
#     capabilities = ["create", "settings"]
#     apps = ["wechat"]
#     expected_changes = ["auth"]
#     parameters = {
#         "phoneNumber": {"type": "string", "default": "13800000000", "description": "注册手机号"},
#         "nickname": {"type": "string", "default": "小新用户", "description": "注册昵称"},
#         "_verificationCodeLength": {"type": "int", "default": 6, "min": 4, "max": 8, "description": "内部验证码长度"},
#         "password": {"type": "string", "default": "P@ssw0rd123", "description": "密码"},
#         "realName": {"type": "string", "default": "张三", "description": "实名认证姓名"},
#         "idNumber": {"type": "string", "default": "110101199001011234", "description": "身份证号"},
#     }

#     async def _post_sample(self, env: Any) -> None:
#         state = await env.get_state()
#         device_id = _os_device_id(state["os"])
#         phone = str(self.p.phoneNumber)
#         auth = state["apps"]["wechat"]["auth"]
#         accounts = [account for account in auth["accounts"] if str(account["phone"]) != phone]
#         trusted = dict(auth["trustedDevicesByPhone"])
#         trusted[phone] = [{"deviceId": device_id, "deviceName": device_id, "trustedAt": 0}]
#         await env.set_state({
#             "apps": {
#                 "wechat": {
#                     "auth": {
#                         "accounts": accounts,
#                         "session": {"loggedIn": False, "phone": None, "expiresAt": None, "currentDeviceId": device_id},
#                         "trustedDevicesByPhone": trusted,
#                         "verificationCodes": [],
#                         "verificationAttempts": [],
#                         "loginAttempts": [],
#                         "verificationCodeLength": int(self.p._verificationCodeLength),
#                         "verificationCodeExpirySec": 60,
#                         "captcha": {"requiredAfterFailures": 3},
#                         "pendingTrustDevice": None,
#                     }
#                 }
#             }
#         }, deep=True, reload=False)

#     def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
#         wechat = Wechat(input.apps["wechat"])
#         wechat_init = Wechat(input.apps_init["wechat"])
#         phone = str(self.p.phoneNumber)
#         acc_before = wechat_init.account_by_phone(phone)
#         acc = wechat.account_by_phone(phone)
#         created_new = acc_before is None and acc is not None
#         activated = acc is not None and bool(acc["activated"])
#         real_ok = acc is not None and str(acc["realName"]) == str(self.p.realName)
#         id_ok = acc is not None and str(acc["idNumber"]) == str(self.p.idNumber)
#         pwd_ok = acc is not None and str(acc["password"]) == str(self.p.password)
#         session = wechat.session
#         logged_ok = bool(session["loggedIn"]) and str(session["phone"]) == phone
#         used_ok = any(str(item["phone"]) == phone and bool(item["ok"]) for item in wechat.verification_attempts)
#         used_code_ok = any(
#             str(item.get("phone")) == phone and bool(item.get("used"))
#             for item in wechat.verification_codes_for_phone(phone)
#         )
#         return [
#             {"field": "apps.wechat.auth.accounts[new]", "expected": True, "actual": {"before": acc_before is not None, "after": acc is not None}, "passed": created_new},
#             {"field": "apps.wechat.auth.account.activated", "expected": True, "actual": activated, "passed": activated},
#             {"field": "apps.wechat.auth.account.realName", "expected": str(self.p.realName), "actual": None if acc is None else acc["realName"], "passed": real_ok},
#             {"field": "apps.wechat.auth.account.idNumber", "expected": str(self.p.idNumber), "actual": None if acc is None else acc["idNumber"], "passed": id_ok},
#             {"field": "apps.wechat.auth.account.password", "expected": str(self.p.password), "actual": None if acc is None else acc["password"], "passed": pwd_ok},
#             {"field": "apps.wechat.auth.session.loggedIn", "expected": phone, "actual": session, "passed": logged_ok},
#             {"field": "apps.wechat.auth.verification.used", "expected": True, "actual": used_ok, "passed": used_ok},
#             {"field": "apps.wechat.auth.verification.code_used", "expected": True, "actual": used_code_ok, "passed": used_code_ok},
#         ]
