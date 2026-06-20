"""Scripted validation plans for Account tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    home,
    tap_trigger,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def visible_trigger(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def visible_action(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def scroll_main_down(*, summary: str) -> Step:
    return {
        "op": "swipe",
        "point1": [500, 820],
        "point2": [500, 260],
        "duration_ms": 360,
        "summary": summary,
    }


def note_card(title: str) -> str:
    return f'button:has-text("{title}"):visible'


def login_button() -> Step:
    return click_selector('xpath=//button[normalize-space()="登录"]', summary="submit Railway login")


def register_form_input(index: int) -> str:
    return f'xpath=(//input[not(@type="hidden")])[{index}]'


def open_railway_login() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("铁路12306", summary="open Railway 12306"),
        wait(0.8, summary="wait for Railway login page"),
    ]


def railway_login(username: str, password: str) -> list[Step]:
    return [
        type_text(
            username,
            selector='input[placeholder="用户名/邮箱/手机号码"]:visible',
            clear=True,
            summary="enter Railway username",
        ),
        type_text(
            password,
            selector='input[placeholder="登录密码"]:visible',
            clear=True,
            summary="enter Railway password",
        ),
        back(summary="dismiss Railway login keyboard"),
        wait(0.3, summary="wait for login button to return"),
        login_button(),
        wait(0.8, summary="wait for Railway login result"),
    ]


def open_prepared_note() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("备忘录", summary="open Notes"),
        wait(0.8, summary="wait for Notes list"),
        click_selector(note_card("{noteTitle}"), summary="open prepared account note"),
        wait(0.5, summary="wait for note editor"),
    ]


def keep_only_correct_password_note() -> list[Step]:
    return [
        *open_prepared_note(),
        type_text(
            "账号：{username}\n密码：\n{correctPassword}",
            selector="textarea:visible",
            clear=True,
            summary="rewrite note with only the correct password",
        ),
        back(summary="dismiss Notes keyboard"),
        wait(1.2, summary="wait for Notes autosave"),
        click_selector('button[aria-label="返回"]:visible', summary="leave note editor"),
        wait(0.5, summary="wait for Notes list"),
    ]


def register_then_verify() -> list[Step]:
    return [
        *open_railway_login(),
        click_selector('xpath=//button[normalize-space()="注册"]', summary="open Railway registration"),
        wait(0.5, summary="wait for registration form"),
        type_text("{username}", selector=register_form_input(1), clear=True, summary="enter registration username"),
        type_text("{password}", selector=register_form_input(2), clear=True, summary="enter registration password"),
        type_text("{password}", selector=register_form_input(3), clear=True, summary="confirm registration password"),
        back(summary="dismiss registration keyboard before scrolling to passenger fields"),
        wait(0.3, summary="wait for keyboard dismiss before passenger fields"),
        scroll_main_down(summary="scroll registration form to passenger fields"),
        type_text("{name}", selector=register_form_input(4), clear=True, summary="enter passenger name"),
        type_text("{idNo}", selector=register_form_input(5), clear=True, summary="enter ID number"),
        back(summary="dismiss registration keyboard before scrolling to contact fields"),
        wait(0.3, summary="wait for keyboard dismiss before contact fields"),
        scroll_main_down(summary="scroll registration form to contact fields"),
        type_text("{phone}", selector=register_form_input(6), clear=True, summary="enter phone number"),
        back(summary="dismiss phone keyboard before entering email"),
        wait(0.3, summary="wait for keyboard dismiss before email"),
        type_text("{email}", selector=register_form_input(7), clear=True, summary="enter email"),
        back(summary="dismiss registration keyboard"),
        wait(0.3, summary="wait for registration keyboard dismiss"),
        click_selector('xpath=//button[normalize-space()="下一步"]', summary="submit registration form"),
        wait(0.4, summary="wait for registration confirmation"),
        click_selector('xpath=//button[normalize-space()="确认"]', summary="confirm registration details"),
        wait(0.6, summary="wait for SMS verification page"),
        click_selector('xpath=//button[normalize-space()="发送注册短信"]', summary="open SMS registration message"),
        wait(1.0, summary="wait for SMS compose"),
        click_selector("button.bg-app-primary:visible", summary="send 999 registration SMS"),
        wait(0.8, summary="wait for SMS conversation"),
        back(summary="return from SMS to Railway verification"),
        wait(2.0, summary="wait for Railway verification SMS"),
        type_text("111111", selector='input[placeholder="请输入验证码"]:visible', clear=True, summary="enter deterministic registration code"),
        back(summary="dismiss registration-code keyboard"),
        wait(0.3, summary="wait for registration-code keyboard dismiss"),
        click_selector('xpath=//button[normalize-space()="完成注册"]', summary="complete Railway registration"),
        wait(1.2, summary="wait for registration completion"),
    ]


def open_change_password() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("铁路12306", summary="open Railway 12306"),
        wait(0.6, summary="wait for Railway home"),
        visible_trigger("tab.my", summary="open Railway My tab"),
        wait(0.3, summary="wait for My tab"),
        visible_trigger("my.settings", summary="open Railway settings"),
        wait(0.3, summary="wait for settings"),
        visible_trigger("settings.changePassword", summary="open change password"),
        wait(0.4, summary="wait for change password page"),
    ]


def change_railway_password() -> list[Step]:
    return [
        *open_change_password(),
        type_text("{oldPassword}", selector='input[placeholder="请输入原密码"]:visible', clear=True, summary="enter old password"),
        type_text("{newPassword}", selector='input[placeholder=\'字母、数字或"_"组合，6-30位\']:visible', clear=True, summary="enter new password"),
        type_text("{newPassword}", selector='input[placeholder="请再次输入密码"]:visible', clear=True, summary="confirm new password"),
        click_selector('xpath=//button[contains(normalize-space(),"获取验证码")]', summary="request change-password SMS code"),
        wait(0.5, summary="wait for deterministic SMS code"),
        type_text("111111", selector='input[placeholder="输入获取的短信验证码"]:visible', clear=True, summary="enter deterministic SMS code"),
        click_selector('xpath=//button[normalize-space()="确定"]', summary="submit password change"),
        wait(1.8, summary="wait for password change completion"),
    ]


def forgot_password_reset() -> list[Step]:
    return [
        *open_railway_login(),
        click_selector('xpath=//button[normalize-space()="忘记密码？"]', summary="open forgot-password page"),
        wait(0.4, summary="wait for forgot-password page"),
        type_text("{accountPhone}", selector='input[placeholder="输入使用的手机号码"]:visible', clear=True, summary="enter account phone"),
        type_text("{idNo}", selector='input[placeholder="请准确完整填写"]:visible', clear=True, summary="enter ID number"),
        type_text("{newPassword}", selector='input[placeholder=\'字母、数字或"_"组合，6-30位\']:visible', clear=True, summary="enter reset password"),
        type_text("{newPassword}", selector='input[placeholder="请再次输入密码"]:visible', clear=True, summary="confirm reset password"),
        click_selector('xpath=//button[contains(normalize-space(),"获取验证码")]', summary="request reset SMS code"),
        wait(0.5, summary="wait for deterministic reset code"),
        type_text("111111", selector='input[placeholder="输入获取的短信验证码"]:visible', clear=True, summary="enter deterministic reset code"),
        back(summary="dismiss reset-code keyboard"),
        wait(0.3, summary="wait for reset-code keyboard dismiss"),
        click_selector('xpath=//button[normalize-space()="提交"]', summary="submit password reset"),
        wait(0.8, summary="wait for login page after reset"),
        *railway_login("{accountPhone}", "{newPassword}"),
    ]


def cancel_wechat_account() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("微信", summary="open WeChat"),
        wait(0.6, summary="wait for WeChat"),
        tap_trigger("tab.me", summary="open WeChat Me tab"),
        wait(0.3, summary="wait for Me tab"),
        tap_trigger("me.settings.open", summary="open WeChat settings"),
        wait(0.3, summary="wait for settings"),
        tap_trigger("settings.security.open", summary="open account security"),
        wait(0.3, summary="wait for account security"),
        tap_trigger("securityCenter.open", summary="open security center"),
        wait(0.3, summary="wait for security center"),
        tap_trigger("account.delete.open", summary="open account deletion"),
        wait(0.3, summary="wait for deletion page"),
        scroll_main_down(summary="scroll account deletion page to agreement"),
        click_selector("button.w-4.h-4:visible", summary="agree to deletion notice"),
        visible_trigger("account.delete.apply", summary="apply for account deletion"),
        wait(0.4, summary="wait for data warning"),
        tap_trigger("account.delete.next", summary="continue deletion warning"),
        wait(0.4, summary="wait for important reminder"),
        scroll_main_down(summary="scroll important reminder to final confirmation"),
        visible_trigger("account.delete.confirm", summary="confirm account cancellation"),
        wait(0.5, summary="wait for cancellation state"),
    ]


PLANS: dict[str, list[Step]] = {
    "account.Railway12306LoginWithAccount": [
        *keep_only_correct_password_note(),
        *open_railway_login(),
        *railway_login("{username}", "{correctPassword}"),
        complete(),
    ],
    "account.Railway12306RegisterThenLogin": [
        *register_then_verify(),
        complete(),
    ],
    "account.Railway12306ChangePassword": [
        *change_railway_password(),
        complete(),
    ],
    "account.WechatAccountCancellation": [
        *cancel_wechat_account(),
        complete(),
    ],
    "account.Railway12306ForgotPasswordReset": [
        *forgot_password_reset(),
        complete(),
    ],
}
