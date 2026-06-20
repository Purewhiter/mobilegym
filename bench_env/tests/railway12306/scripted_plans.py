"""Scripted validation plans for Railway 12306 tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    enter,
    grounded_answer,
    grounded_answer_repeatable,
    home,
    swipe,
    tap_trigger,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def trigger_param(trigger_id: str, param: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def open_railway() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("铁路12306", summary="launch Railway 12306"),
        wait(0.8, summary="wait for Railway 12306 home"),
    ]


def train_card(train_no: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"rounded-lg") and contains(@class,"shadow-sm") '
        f'and .//span[normalize-space()="{train_no}"]]//div[contains(@class,"w-[66px]")])[1]',
        summary=summary or f"expand train {train_no}",
    )


def visible_button(text: str, *, summary: str | None = None) -> Step:
    return click_selector(f'button:has-text("{text}"):visible', summary=summary or f"tap {text}")


def visible_text_row(text: str, *, summary: str | None = None) -> Step:
    return click_selector(f'xpath=(//*[normalize-space()="{text}" or .//*[normalize-space()="{text}"]])[last()]', summary=summary or f"tap row {text}")


def station_result(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"cursor-pointer") and ./span[1][normalize-space()="{name}"]])[1]',
        summary=summary or f"select station {name}",
    )


def passenger_row(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'xpath=(//div[contains(@class,"border-b") and contains(@class,"items-center") '
        f'and .//span[normalize-space()="{name}"]])[1]',
        summary=summary or f"select passenger {name}",
    )


def passenger_done(*, summary: str = "confirm selected passengers") -> Step:
    return click_selector(
        'xpath=(//button[normalize-space()="完成" or normalize-space()="Done" '
        'or .//*[normalize-space()="完成" or normalize-space()="Done"]])[1]',
        summary=summary,
    )


def date_cell(date_value: str, *, summary: str | None = None) -> Step:
    day = "{date_day}" if "{" in date_value else str(int(date_value.rsplit("-", 1)[1]))
    return click_selector(
        f'xpath=(//div[contains(@class,"cursor-pointer") and .//span[normalize-space()="{day}"]])[1]',
        summary=summary or f"select date {date_value}",
    )


def select_station(trigger_id: str, station: str) -> list[Step]:
    return [
        tap_trigger(trigger_id, summary=f"open station picker for {station}"),
        type_text(station, selector="input:visible", clear=True, summary=f"search station {station}"),
        wait(0.4, summary="wait for station search results"),
        station_result(station),
        wait(0.3, summary="wait after station select"),
    ]


def select_date(date_value: str) -> list[Step]:
    return [
        tap_trigger("home.dateSelect", summary=f"open date picker for {date_value}"),
        date_cell(date_value),
        wait(0.3, summary="wait after date select"),
    ]


def query_route(from_station: str, to_station: str, date_value: str) -> list[Step]:
    return [
        *open_railway(),
        *select_station("home.stationSelect.from", from_station),
        *select_station("home.stationSelect.to", to_station),
        *select_date(date_value),
        tap_trigger("home.queryResult", summary="query train tickets"),
        wait(1.5, summary="wait for train results"),
    ]


def query_default_route(date_value: str) -> list[Step]:
    return [
        *open_railway(),
        *select_date(date_value),
        tap_trigger("home.queryResult", summary="query default Shanghai to Nanjing tickets"),
        wait(1.5, summary="wait for train results"),
    ]


def open_my_account() -> list[Step]:
    return [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.account", summary="open account page"),
        wait(0.3, summary="wait for account page"),
    ]


def open_passenger_manager() -> list[Step]:
    return [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.passengers", summary="open passenger manager"),
        wait(0.3, summary="wait for passenger list"),
    ]


def choose_passenger(name: str) -> list[Step]:
    return [
        passenger_row(name, summary=f"select passenger {name}"),
        passenger_done(),
        wait(0.4, summary="wait for order confirm"),
    ]


def submit_order() -> list[Step]:
    return [
        swipe([500, 720], [500, 280], summary="scroll order confirmation toward submit button"),
        wait(0.2, summary="wait after order confirmation scroll"),
        swipe([500, 720], [500, 280], summary="scroll order confirmation to submit button"),
        wait(0.2, summary="wait after order confirmation scroll"),
        visible_button("提交订单", summary="submit order"),
        wait(1.5, summary="wait for pending order page"),
    ]


def book_visible_train(train_no: str, seat_type: str, passenger_name: str) -> list[Step]:
    return [
        train_card(train_no),
        click_selector(
            f'[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary=f"book {seat_type} on {train_no}",
        ),
        wait(0.5, summary="wait for order confirm page"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *choose_passenger(passenger_name),
        *submit_order(),
    ]


def add_new_passenger(name: str, id_no: str, phone: str) -> list[Step]:
    return [
        tap_trigger("passengers.addPassenger", summary="open add passenger page"),
        wait(0.3, summary="wait for add passenger page"),
        type_text(name, selector="input:visible >> nth=0", clear=True, summary=f"enter passenger name {name}"),
        type_text(id_no, selector="input:visible >> nth=1", clear=True, summary="enter passenger ID"),
        back(summary="dismiss keyboard before passenger phone"),
        swipe([500, 720], [500, 330], summary="scroll add passenger form to phone field"),
        wait(0.2, summary="wait after scrolling to phone field"),
        type_text(
            phone,
            selector=(
                'input[placeholder="填写乘车人手机号码"]:visible, '
                'input[placeholder="Enter passenger mobile number"]:visible'
            ),
            clear=True,
            summary="enter passenger phone",
        ),
        back(summary="dismiss keyboard before submitting passenger form"),
        visible_button("提交", summary="submit passenger form"),
        wait(0.3, summary="wait for passenger confirmation dialog"),
        visible_button("确定", summary="confirm new passenger"),
        wait(0.5, summary="wait for passenger selector"),
    ]


def open_answer_after_route(*values: str, summary: str) -> list[Step]:
    return [
        *grounded_answer(*values, summary=summary),
    ]


def answer_choice(value: str, *, summary: str) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("答题卡", summary="open AnswerSheet app"),
        wait(0.8, summary="wait for answer sheet UI"),
        click_selector(
            f'xpath=(//div[@data-scroll-container="sheet-form"]//button[normalize-space()="{value}"])[1]',
            summary=f"select answer choice {value}",
        ),
        click_selector(
            'div[data-hide-on-keyboard] button.w-full.bg-blue-500:visible',
            summary=summary,
        ),
    ]


PLANS: dict[str, list[Step]] = {
    "railway12306.OpenAllApps": [
        *open_railway(),
        swipe([850, 620], [70, 620], summary="swipe service grid left to next page"),
        wait(0.2, summary="wait after service grid swipe"),
        swipe([850, 620], [70, 620], summary="swipe service grid left to all apps overscroll"),
        wait(0.8, summary="wait for all apps page"),
        complete(),
    ],
    "railway12306.OpenServicePhone": [
        *open_railway(),
        click_selector('div:has-text("温馨服务"):visible', summary="open customer service phone page"),
        *grounded_answer("{area_code}", summary="answer service phone area code"),
        complete(),
    ],
    "railway12306.OpenInvoice": [
        *open_railway(),
        tap_trigger("tab.orders", summary="open Orders tab"),
        tap_trigger("orders.invoice", summary="open invoice page"),
        tap_trigger("invoice.invoiceHeaders", summary="open invoice header manager"),
        tap_trigger("invoice.addHeader", summary="open add invoice header"),
        type_text("{name}", selector="input:visible >> nth=0", clear=True, summary="enter invoice header name"),
        type_text("91310000MA1K000000", selector="input:visible >> nth=1", clear=True, summary="enter tax number"),
        click_selector(
            'xpath=(//span[normalize-space()="设为默认抬头" or normalize-space()="Set as default"]/following-sibling::button)[1]',
            summary="turn off default invoice header switch",
        ),
        visible_button("保存", summary="save invoice header"),
        wait(0.4, summary="wait after saving invoice header"),
        back(summary="return to invoice home"),
        tap_trigger("invoice.emailSettings", summary="open invoice email settings"),
        type_text("{email}", selector="input:visible", clear=True, summary="enter invoice email"),
        visible_button("保存", summary="save invoice email"),
        wait(0.3, summary="wait for email success dialog"),
        visible_button("确定", summary="confirm email saved"),
        complete(),
    ],
    "railway12306.CheckPassengerCount": [
        *grounded_answer("{answer}", summary="answer passenger count"),
        complete(),
    ],
    "railway12306.CheckDefaultPassengerName": [
        *grounded_answer("{answer}", summary="answer default passenger name"),
        complete(),
    ],
    "railway12306.CheckStudentVerify": [
        *open_my_account(),
        tap_trigger("account.studentVerify", summary="open student qualification page"),
        *grounded_answer("{answer_from}", "{answer_to}", summary="answer student discount route"),
        complete(),
    ],
    "railway12306.CheckRecentTripCities": [
        *grounded_answer_repeatable("{city1}", "{city2}", "{city3}", summary="answer recent trip cities"),
        complete(),
    ],
    "railway12306.CheckIdVerificationStatus": [
        *open_railway(),
        tap_trigger("tab.my", summary="open My tab"),
        tap_trigger("my.settings", summary="open settings"),
        tap_trigger("settings.idVerify", summary="open ID verification page"),
        *answer_choice("核验成功", summary="answer ID verification status"),
        complete(),
    ],
    "railway12306.BuyReturnTicketFromLatestOrder": [
        *query_route("上海", "杭州", "{date}"),
        train_card("{return_train}", summary="expand return train"),
        wait(0.3, summary="wait for return train detail expansion"),
        swipe([500, 780], [500, 500], summary="scroll expanded return train to book button"),
        wait(0.2, summary="wait after scrolling expanded return train"),
        click_selector('[data-trigger="trainDetail.book"]:visible', summary="book visible return train"),
        wait(0.5, summary="wait for order confirm page"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *choose_passenger("{name}"),
        *submit_order(),
        complete(),
    ],
    "railway12306.FindTrainByDate": [
        *grounded_answer("{answer}", summary="answer train by date"),
        complete(),
    ],
    "railway12306.CheckTicketPriceByDate": [
        *grounded_answer("{answer}", summary="answer ticket price"),
        complete(),
    ],
    "railway12306.QueryAndCheckRoute": [
        *query_route("{from_station}", "{to_station}", "{date}"),
        *grounded_answer("{answer_train}", summary="answer latest train"),
        complete(),
    ],
    "railway12306.BuyTicketForPassenger": [
        *query_default_route("{date}"),
        *book_visible_train("{train_no}", "{seat_type}", "{name}"),
        complete(),
    ],
    "railway12306.BuyTicketsForTwoPassengers": [
        *query_default_route("{date}"),
        train_card("{train_no}"),
        click_selector(
            '[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary="book requested seat",
        ),
        wait(0.5, summary="wait for order confirm page"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        passenger_row("{name}", summary="select first passenger"),
        passenger_row("{name2}", summary="select second passenger"),
        passenger_done(),
        wait(0.4, summary="wait for order confirm"),
        *submit_order(),
        complete(),
    ],
    "railway12306.BuyTicketForNewPassenger": [
        *query_default_route("{date}"),
        train_card("{train_no}"),
        click_selector(
            '[data-trigger="trainDetail.book"][data-trigger-params*=\'"seat":"{seat_type}"\']:visible',
            summary="book requested seat",
        ),
        wait(0.5, summary="wait for order confirm page"),
        tap_trigger("orderConfirm.passengers", summary="open passenger selector"),
        wait(0.4, summary="wait for passenger selector"),
        *add_new_passenger("{name}", "{id_no}", "{phone}"),
        swipe([500, 720], [500, 320], summary="scroll passenger selector to newly added passenger"),
        wait(0.2, summary="wait after passenger selector scroll"),
        *choose_passenger("{name}"),
        *submit_order(),
        complete(),
    ],
    "railway12306.QueryFastestTrainDetails": [
        *query_route("{from_station}", "{to_station}", "{date}"),
        *grounded_answer(
            "{answer_train}",
            "{answer_duration}",
            "{answer_from}",
            "{answer_arrive}",
            summary="answer fastest train details",
        ),
        complete(),
    ],
}
