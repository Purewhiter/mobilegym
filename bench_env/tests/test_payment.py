"""Payment suite offline judge tests."""

from __future__ import annotations

import copy
import datetime
import inspect
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.payment import tasks as payment_tasks
from bench_env.tests.conftest import make_judge_input


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}
TEST_TS = int(datetime.datetime(2026, 3, 27, 12, 0, 0).timestamp() * 1000)
BASE_OS_STATE = {
    "time": {"timestamp": TEST_TS},
    "providers": {"sms": {"conversations": [], "messagesByConversationId": {}}},
    "runningApps": [],
}


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(Path(ROOT, *parts).read_text(encoding="utf-8"))


ALIPAY_DEFAULTS = _load_json("apps", "Alipay", "data", "defaults.json")
WECHAT_DEFAULTS = _load_json("apps", "Wechat", "data", "defaults.json")
BILIBILI_DEFAULTS = _load_json("apps", "Bilibili", "data", "defaults.json")
RAILWAY_DEFAULTS = _load_json("apps", "Railway12306", "data", "defaults.json")


ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(payment_tasks, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == payment_tasks.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]


def _copy(value: Any) -> Any:
    return copy.deepcopy(value)


def _base_notes_state() -> dict[str, Any]:
    return {
        "notes": [],
        "todos": [],
        "folders": [{"id": "unfiled", "name": "未分类"}],
        "settings": {"notesViewMode": "grid", "showWordCount": True},
    }


def _today_ymd() -> str:
    return datetime.datetime.fromtimestamp(TEST_TS / 1000).date().isoformat()


def _tomorrow_ymd() -> str:
    return (datetime.datetime.fromtimestamp(TEST_TS / 1000).date() + datetime.timedelta(days=1)).isoformat()


def _make_input(
    *,
    apps_init: dict[str, Any],
    apps_curr: dict[str, Any],
    os_init: dict[str, Any] | None = None,
    os_curr: dict[str, Any] | None = None,
) -> Any:
    return make_judge_input(
        {"apps": apps_init, "os": _copy(os_init or BASE_OS_STATE)},
        {"apps": apps_curr, "os": _copy(os_curr or os_init or BASE_OS_STATE)},
        route=DEFAULT_ROUTE,
    )


def _append_note(state: dict[str, Any], *, title: str, content: str) -> dict[str, Any]:
    next_state = _copy(state)
    notes = next_state.setdefault("notes", [])
    notes.append(
        {
            "id": f"note_{len(notes) + 1}",
            "title": title,
            "content": content,
            "updatedAt": TEST_TS + len(notes) + 1,
            "folderId": "unfiled",
        }
    )
    return next_state


def _ensure_wechat_chat(state: dict[str, Any], contact_name: str) -> tuple[dict[str, Any], str]:
    contacts = state.setdefault("contacts", [])
    contact = next((item for item in contacts if str(item.get("name") or "") == contact_name), None)
    if contact is None:
        raise ValueError(f"wechat fixture missing contact: {contact_name}")
    wxid = str(contact["wxid"])
    chats = state.setdefault("chats", [])
    chat = next((item for item in chats if str(item.get("id") or "") == wxid), None)
    if chat is None:
        chat = {
            "id": wxid,
            "name": contact_name,
            "contactName": contact_name,
            "user": {"wxid": wxid, "name": contact_name},
            "isMuted": False,
            "isSticky": False,
            "isAlert": False,
            "messages": [],
        }
        chats.append(chat)
    return chat, wxid


def _append_wechat_text(
    state: dict[str, Any],
    *,
    contact_name: str,
    content: str,
    outgoing: bool,
) -> dict[str, Any]:
    next_state = _copy(state)
    chat, wxid = _ensure_wechat_chat(next_state, contact_name)
    sender = str(next_state.get("user", {}).get("wxid") or "") if outgoing else wxid
    messages = chat.setdefault("messages", [])
    messages.append(
        {
            "id": f"msg_{len(messages) + 1}",
            "type": "text",
            "content": content,
            "senderId": sender,
            "timestamp": TEST_TS + len(messages) + 1,
        }
    )
    return next_state


def _append_alipay_record(
    state: dict[str, Any],
    *,
    record_id: str,
    kind: str,
    delta: float,
    method_id: str,
    counterparty: str,
    timestamp: int,
    transfer_note: str | None = None,
    target_account: str | None = None,
    order_id: str | None = None,
) -> dict[str, Any]:
    next_state = _copy(state)
    record: dict[str, Any] = {
        "id": record_id,
        "counterpartyName": counterparty,
        "displayTitle": counterparty,
        "delta": float(delta),
        "timestamp": int(timestamp),
        "methodId": method_id,
        "kind": kind,
    }
    if transfer_note is not None:
        record["transferNote"] = transfer_note
    if target_account is not None:
        record["targetAccount"] = target_account
    if order_id is not None:
        record["orderId"] = order_id
    next_state.setdefault("transferRecords", [])
    next_state["transferRecords"] = [record, *next_state["transferRecords"]]
    return next_state


def _rail_order(
    *,
    order_id: str,
    status: str,
    date: str,
    from_station: str = "上海",
    to_station: str = "南京",
    train_no: str = "G1001",
    passenger: str = "赵宇轩",
    seat_type: str = "二等座",
    seat_no: str = "06车 15B号",
    price: float = 120.0,
    depart_time: str = "08:00",
    arrive_time: str = "09:25",
) -> dict[str, Any]:
    return {
        "id": order_id,
        "trainNo": train_no,
        "fromStation": from_station,
        "toStation": to_station,
        "departTime": depart_time,
        "arriveTime": arrive_time,
        "date": date,
        "status": status,
        "createTime": f"{date}T07:00:00.000Z",
        "tickets": [
            {
                "passengerName": passenger,
                "ticketType": "成人票",
                "seatType": seat_type,
                "seatNo": seat_no,
                "price": float(price),
            }
        ],
    }


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls: type[BaseTask]) -> None:
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls: type[BaseTask]) -> None:
        task = cls()
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_task_docstring_present(self, cls: type[BaseTask]) -> None:
        assert cls.__doc__ is not None
        assert cls.__doc__.strip()

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_meta_attrs(self, cls: type[BaseTask]) -> None:
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameters_have_defaults(self, cls: type[BaseTask]) -> None:
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer(self, cls: type[BaseTask]) -> None:
        # payment suite 当前无 AnswerTask，保留占位以防后续新增遗漏
        pass

    def test_multichannel_task_removed(self) -> None:
        assert not hasattr(payment_tasks, "AlipayTransferMultiChannel")

    def test_transfer_with_note_prompt_mentions_password(self) -> None:
        task = payment_tasks.TransferToContactWithNote()
        assert "我的密码是123456" in task.description


def _bind_multiple_cards_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["balance"] = {"total": 200.0}
    init_alipay["bankCards"] = [
        {"id": "ccb", "bankName": "建设银行储蓄卡", "cardNumber": "6227000000000005445", "last4": "5445", "bound": True, "available": 20000},
        {"id": "icbc", "bankName": "工商银行储蓄卡", "cardNumber": "6222000000000001234", "last4": "1234", "bound": False, "available": 500},
        {"id": "abc", "bankName": "农业银行储蓄卡", "cardNumber": "6228480000000006789", "last4": "6789", "bound": False, "available": 20000},
    ]
    init_alipay["transferRecords"] = []
    init_alipay["lastPaymentHint"] = ""
    curr_alipay = _copy(init_alipay)
    for card in curr_alipay["bankCards"]:
        card["bound"] = True
    target = str(task.p.targetAccount)
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="bind_tx_1",
        kind="transfer",
        delta=-float(task.p.amount1),
        method_id="ccb",
        counterparty=f"转账-{target}",
        target_account=target,
        transfer_note="第一笔",
        timestamp=TEST_TS + 1000,
    )
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="bind_tx_2",
        kind="transfer",
        delta=0.0,
        method_id="icbc",
        counterparty=f"转账-{target}",
        target_account=target,
        transfer_note="第二笔工行余额不足",
        timestamp=TEST_TS + 2000,
    )
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="bind_tx_3",
        kind="transfer",
        delta=-float(task.p.amount3),
        method_id="abc",
        counterparty=f"转账-{target}",
        target_account=target,
        transfer_note="第三笔",
        timestamp=TEST_TS + 3000,
    )
    init_notes = _base_notes_state()
    curr_notes = _append_note(
        init_notes,
        title=str(task.p.noteTitle),
        content="成功银行卡：建设银行储蓄卡（5445）、农业银行储蓄卡（6789）",
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "notes": init_notes},
        apps_curr={"alipay": curr_alipay, "notes": curr_notes},
    )


def _continuous_payments_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayContinuousPaymentsToContactsRecordBalances()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["balance"] = {"total": 2000.0}
    init_alipay["transferRecords"] = []
    curr_alipay = _copy(init_alipay)
    contacts = [
        str(task.p.contact1),
        str(task.p.contact2),
        str(task.p.contact3),
        str(task.p.contact4),
        str(task.p.contact5),
    ]
    amounts = [
        float(task.p.amount1),
        float(task.p.amount2),
        float(task.p.amount3),
        float(task.p.amount4),
        float(task.p.amount5),
    ]
    running = float(init_alipay["balance"]["total"])
    balances: list[float] = []
    for index, (contact, amount) in enumerate(zip(contacts, amounts, strict=True), start=1):
        curr_alipay = _append_alipay_record(
            curr_alipay,
            record_id=f"cont_tx_{index}",
            kind="transfer",
            delta=-amount,
            method_id="balance",
            counterparty=contact,
            target_account=contact,
            transfer_note="发工资",
            timestamp=TEST_TS + index * 1000,
        )
        running -= amount
        balances.append(running)
    curr_alipay["balance"]["total"] = balances[-1]
    init_notes = _base_notes_state()
    curr_notes = _append_note(
        init_notes,
        title=str(task.p.noteTitle),
        content="\n".join(f"第{i}次后余额：{balance:g}" for i, balance in enumerate(balances, start=1)),
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "notes": init_notes},
        apps_curr={"alipay": curr_alipay, "notes": curr_notes},
    )


def _continuous_payments_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayContinuousPaymentsToContactsRecordBalances()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["balance"] = {"total": 2000.0}
    init_alipay["transferRecords"] = []
    curr_alipay = _copy(init_alipay)
    contacts = [
        str(task.p.contact1),
        str(task.p.contact2),
        str(task.p.contact3),
        str(task.p.contact4),
        str(task.p.contact5),
    ]
    amounts = [
        float(task.p.amount1),
        float(task.p.amount2),
        float(task.p.amount3),
        float(task.p.amount4),
        float(task.p.amount5),
    ]
    running = float(init_alipay["balance"]["total"])
    recorded_balances: list[float] = []
    for index, (contact, amount) in enumerate(zip(contacts, amounts, strict=True), start=1):
        curr_alipay = _append_alipay_record(
            curr_alipay,
            record_id=f"cont_neg_tx_{index}",
            kind="transfer",
            delta=-amount,
            method_id="balance",
            counterparty=contact,
            target_account=contact,
            transfer_note="发工资",
            timestamp=TEST_TS + index * 1000,
        )
        running -= amount
        if index < 5:
            recorded_balances.append(running)
    curr_alipay["balance"]["total"] = running
    init_notes = _base_notes_state()
    curr_notes = _append_note(
        init_notes,
        title=str(task.p.noteTitle),
        content="\n".join(f"第{i}次后余额：{balance:g}" for i, balance in enumerate(recorded_balances, start=1)),
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "notes": init_notes},
        apps_curr={"alipay": curr_alipay, "notes": curr_notes},
    )


def _bind_multiple_cards_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["balance"] = {"total": 200.0}
    init_alipay["bankCards"] = [
        {"id": "ccb", "bankName": "建设银行储蓄卡", "cardNumber": "6227000000000005445", "last4": "5445", "bound": True, "available": 20000},
        {"id": "icbc", "bankName": "工商银行储蓄卡", "cardNumber": "6222000000000001234", "last4": "1234", "bound": False, "available": 500},
        {"id": "abc", "bankName": "农业银行储蓄卡", "cardNumber": "6228480000000006789", "last4": "6789", "bound": False, "available": 20000},
    ]
    init_alipay["transferRecords"] = []
    init_alipay["lastPaymentHint"] = ""
    curr_alipay = _copy(init_alipay)
    for card in curr_alipay["bankCards"]:
        card["bound"] = True
    target = str(task.p.targetAccount)
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="bind_neg_tx_1",
        kind="transfer",
        delta=-float(task.p.amount1),
        method_id="ccb",
        counterparty=f"转账-{target}",
        target_account=target,
        transfer_note="第一笔",
        timestamp=TEST_TS + 1000,
    )
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="bind_neg_tx_2",
        kind="transfer",
        delta=-float(task.p.amount2),
        method_id="icbc",
        counterparty=f"转账-{target}",
        target_account=target,
        transfer_note="第二笔",
        timestamp=TEST_TS + 2000,
    )
    init_notes = _base_notes_state()
    curr_notes = _append_note(
        init_notes,
        title=str(task.p.noteTitle),
        content="成功银行卡：建设银行储蓄卡（5445）、工商银行储蓄卡（1234）",
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "notes": init_notes},
        apps_curr={"alipay": curr_alipay, "notes": curr_notes},
    )


def _change_password_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayChangePaymentPasswordThenPay()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay.setdefault("userInfo", {})
    init_alipay["userInfo"]["paymentPassword"] = "000000"
    curr_alipay = _copy(init_alipay)
    curr_alipay["userInfo"]["paymentPassword"] = str(task.p.newPassword)
    curr_alipay = _append_alipay_record(
        curr_alipay,
        record_id="pwd_pay_1",
        kind="payment",
        delta=-float(task.p.amount),
        method_id="balance",
        counterparty=str(task.p.contact),
        timestamp=TEST_TS + 1000,
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay},
        apps_curr={"alipay": curr_alipay},
    )


def _change_password_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayChangePaymentPasswordThenPay()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay.setdefault("userInfo", {})
    init_alipay["userInfo"]["paymentPassword"] = "000000"
    curr_alipay = _copy(init_alipay)
    curr_alipay["userInfo"]["paymentPassword"] = str(task.p.newPassword)
    return task, _make_input(
        apps_init={"alipay": init_alipay},
        apps_curr={"alipay": curr_alipay},
    )


def _transfer_with_note_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.TransferToContactWithNote()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["transferRecords"] = []
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="transfer_with_note_1",
        kind="transfer",
        delta=-float(task.p.amount),
        method_id="balance",
        counterparty=str(task.p.name),
        target_account=str(task.p.name),
        transfer_note=str(task.p.note),
        timestamp=TEST_TS + 1000,
    )
    curr_alipay["balance"]["total"] = round(
        float(init_alipay["balance"]["total"]) - float(task.p.amount),
        2,
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay},
        apps_curr={"alipay": curr_alipay},
    )


def _transfer_with_note_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.TransferToContactWithNote()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    init_alipay["transferRecords"] = []
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="transfer_with_note_wrong_note",
        kind="transfer",
        delta=-float(task.p.amount),
        method_id="balance",
        counterparty=str(task.p.name),
        target_account=str(task.p.name),
        transfer_note="别的备注",
        timestamp=TEST_TS + 1000,
    )
    curr_alipay["balance"]["total"] = round(
        float(init_alipay["balance"]["total"]) - float(task.p.amount),
        2,
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay},
        apps_curr={"alipay": curr_alipay},
    )


def _subscribe_membership_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.SubscribeMembershipAutoRenewThenCancelInWechat()
    init_wechat = _copy(WECHAT_DEFAULTS)
    init_wechat["subscriptions"] = []
    curr_wechat = _copy(init_wechat)
    curr_wechat["subscriptions"] = [
        {
            "id": "sub_task_1",
            "membershipType": str(task.p.membershipType),
            "price": float(task.p.price),
            "billingCycle": str(task.p.billingCycle),
            "autoRenew": False,
            "createdAt": TEST_TS,
            "source": "哔哩哔哩",
        }
    ]
    init_bilibili = _copy(BILIBILI_DEFAULTS)
    curr_bilibili = _copy(init_bilibili)
    curr_bilibili["user"]["isVip"] = True
    curr_bilibili["user"]["vipExpireAt"] = TEST_TS + 30 * 24 * 60 * 60 * 1000
    return task, _make_input(
        apps_init={"wechat": init_wechat, "bilibili": init_bilibili},
        apps_curr={"wechat": curr_wechat, "bilibili": curr_bilibili},
    )


def _subscribe_membership_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.SubscribeMembershipAutoRenewThenCancelInWechat()
    init_wechat = _copy(WECHAT_DEFAULTS)
    init_wechat["subscriptions"] = []
    curr_wechat = _copy(init_wechat)
    curr_wechat["subscriptions"] = [
        {
            "id": "sub_task_2",
            "membershipType": str(task.p.membershipType),
            "price": float(task.p.price),
            "billingCycle": str(task.p.billingCycle),
            "autoRenew": True,
            "createdAt": TEST_TS,
            "source": "哔哩哔哩",
        }
    ]
    init_bilibili = _copy(BILIBILI_DEFAULTS)
    curr_bilibili = _copy(init_bilibili)
    curr_bilibili["user"]["isVip"] = True
    curr_bilibili["user"]["vipExpireAt"] = TEST_TS + 30 * 24 * 60 * 60 * 1000
    return task, _make_input(
        apps_init={"wechat": init_wechat, "bilibili": init_bilibili},
        apps_curr={"wechat": curr_wechat, "bilibili": curr_bilibili},
    )







def _transfer_notify_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayTransferAndNotify()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="notify_tx_1",
        kind="transfer",
        delta=-float(task.p.amount),
        method_id="balance",
        counterparty=str(task.p.alipay_contact),
        target_account=str(task.p.alipay_contact),
        transfer_note=str(task.p.note),
        timestamp=TEST_TS + 1000,
    )
    init_wechat = _copy(WECHAT_DEFAULTS)
    curr_wechat = _append_wechat_text(
        init_wechat,
        contact_name=str(task.p.contact),
        content=f"我刚给你转账{float(task.p.amount):g}元，记得查收。",
        outgoing=True,
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "wechat": init_wechat},
        apps_curr={"alipay": curr_alipay, "wechat": curr_wechat},
    )


def _transfer_notify_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.AlipayTransferAndNotify()
    init_alipay = _copy(ALIPAY_DEFAULTS)
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="notify_tx_neg_1",
        kind="transfer",
        delta=-float(task.p.amount),
        method_id="balance",
        counterparty=str(task.p.alipay_contact),
        target_account=str(task.p.alipay_contact),
        transfer_note=str(task.p.note),
        timestamp=TEST_TS + 1000,
    )
    init_wechat = _copy(WECHAT_DEFAULTS)
    curr_wechat = _append_wechat_text(
        init_wechat,
        contact_name=str(task.p.contact),
        content="晚点联系你。",
        outgoing=True,
    )
    return task, _make_input(
        apps_init={"alipay": init_alipay, "wechat": init_wechat},
        apps_curr={"alipay": curr_alipay, "wechat": curr_wechat},
    )


def _wechat_extract_positive() -> tuple[BaseTask, Any]:
    task = payment_tasks.WechatExtractAmountTransfer()
    amount = float(task.p.requestAmount)
    init_wechat = _copy(WECHAT_DEFAULTS)
    curr_wechat = _append_wechat_text(
        init_wechat,
        contact_name=str(task.p.contact),
        content=f"麻烦你转{amount:g}元给我。",
        outgoing=False,
    )
    curr_wechat = _append_wechat_text(
        curr_wechat,
        contact_name=str(task.p.contact),
        content=str(task.p.reply),
        outgoing=True,
    )
    init_alipay = _copy(ALIPAY_DEFAULTS)
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="extract_tx_1",
        kind="transfer",
        delta=-amount,
        method_id="balance",
        counterparty=str(task.p.alipay_contact),
        target_account=str(task.p.alipay_contact),
        transfer_note="按微信请求转账",
        timestamp=TEST_TS + 1000,
    )
    return task, _make_input(
        apps_init={"wechat": init_wechat, "alipay": init_alipay},
        apps_curr={"wechat": curr_wechat, "alipay": curr_alipay},
    )


def _wechat_extract_negative() -> tuple[BaseTask, Any]:
    task = payment_tasks.WechatExtractAmountTransfer()
    amount = float(task.p.requestAmount)
    init_wechat = _copy(WECHAT_DEFAULTS)
    curr_wechat = _append_wechat_text(
        init_wechat,
        contact_name=str(task.p.contact),
        content=f"麻烦你转{amount:g}元给我。",
        outgoing=False,
    )
    init_alipay = _copy(ALIPAY_DEFAULTS)
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="extract_tx_neg_1",
        kind="transfer",
        delta=-(amount + 5.0),
        method_id="balance",
        counterparty=str(task.p.alipay_contact),
        target_account=str(task.p.alipay_contact),
        transfer_note="转错金额",
        timestamp=TEST_TS + 1000,
    )
    return task, _make_input(
        apps_init={"wechat": init_wechat, "alipay": init_alipay},
        apps_curr={"wechat": curr_wechat, "alipay": curr_alipay},
    )


def _wechat_extract_missing_reply() -> tuple[BaseTask, Any]:
    task = payment_tasks.WechatExtractAmountTransfer()
    amount = float(task.p.requestAmount)
    init_wechat = _copy(WECHAT_DEFAULTS)
    curr_wechat = _append_wechat_text(
        init_wechat,
        contact_name=str(task.p.contact),
        content=f"麻烦你转{amount:g}元给我。",
        outgoing=False,
    )
    init_alipay = _copy(ALIPAY_DEFAULTS)
    curr_alipay = _append_alipay_record(
        init_alipay,
        record_id="extract_tx_no_reply_1",
        kind="transfer",
        delta=-amount,
        method_id="balance",
        counterparty=str(task.p.alipay_contact),
        target_account=str(task.p.alipay_contact),
        transfer_note="按微信请求转账",
        timestamp=TEST_TS + 1000,
    )
    return task, _make_input(
        apps_init={"wechat": init_wechat, "alipay": init_alipay},
        apps_curr={"wechat": curr_wechat, "alipay": curr_alipay},
    )


OFFLINE_JUDGE_TASK_NAMES = {
    "AlipayContinuousPaymentsToContactsRecordBalances",
    "AlipayBindMultipleCardsTransferAndRecordSuccessfulCards",
    "AlipayChangePaymentPasswordThenPay",
    "SubscribeMembershipAutoRenewThenCancelInWechat",
    "TransferToContactWithNote",
    "AlipayTransferAndNotify",
    "WechatExtractAmountTransfer",
}


OFFLINE_POSITIVE_CASES: list[tuple[str, Callable[[], tuple[BaseTask, Any]]]] = [
    ("AlipayContinuousPaymentsToContactsRecordBalances", _continuous_payments_positive),
    ("AlipayBindMultipleCardsTransferAndRecordSuccessfulCards", _bind_multiple_cards_positive),
    ("AlipayChangePaymentPasswordThenPay", _change_password_positive),
    ("SubscribeMembershipAutoRenewThenCancelInWechat", _subscribe_membership_positive),
    ("TransferToContactWithNote", _transfer_with_note_positive),
    ("AlipayTransferAndNotify", _transfer_notify_positive),
    ("WechatExtractAmountTransfer", _wechat_extract_positive),
]


OFFLINE_NEGATIVE_CASES: list[tuple[str, Callable[[], tuple[BaseTask, Any]]]] = [
    ("AlipayContinuousPaymentsToContactsRecordBalances", _continuous_payments_negative),
    ("AlipayBindMultipleCardsTransferAndRecordSuccessfulCards", _bind_multiple_cards_negative),
    ("AlipayChangePaymentPasswordThenPay", _change_password_negative),
    ("SubscribeMembershipAutoRenewThenCancelInWechat", _subscribe_membership_negative),
    ("TransferToContactWithNote", _transfer_with_note_negative),
    ("AlipayTransferAndNotify", _transfer_notify_negative),
    ("WechatExtractAmountTransfer", _wechat_extract_negative),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize("name,factory", OFFLINE_POSITIVE_CASES)
    def test_positive(self, name: str, factory: Callable[[], tuple[BaseTask, Any]]) -> None:
        task, inp = factory()
        result = task.evaluate(inp)
        assert result.success, f"positive case {name} failed: {result.issues}"

    @pytest.mark.parametrize("name,factory", OFFLINE_NEGATIVE_CASES)
    def test_negative(self, name: str, factory: Callable[[], tuple[BaseTask, Any]]) -> None:
        task, inp = factory()
        result = task.evaluate(inp)
        assert not result.success, f"negative case {name} unexpectedly passed"

    def test_wechat_extract_requires_reply(self) -> None:
        task, inp = _wechat_extract_missing_reply()
        result = task.evaluate(inp)
        assert not result.success

    def test_matrix_complete(self) -> None:
        pos_names = {name for name, _ in OFFLINE_POSITIVE_CASES}
        neg_names = {name for name, _ in OFFLINE_NEGATIVE_CASES}
        assert pos_names == OFFLINE_JUDGE_TASK_NAMES
        assert neg_names == OFFLINE_JUDGE_TASK_NAMES
