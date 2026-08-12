"""Scripted validation plans for cross-app commerce tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    assert_text,
    assert_visible,
    awake,
    back,
    complete,
    home,
    swipe_up,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_param(trigger_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def open_app(app: str, *, summary: str | None = None) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake(app, summary=summary or f"open {app}"),
        wait(0.8, summary=f"wait for {app} foreground"),
    ]


def open_alipay_balance() -> list[Step]:
    """Alipay → My tab → balance page (total balance + latest three records)."""
    return [
        *open_app("支付宝", summary="open Alipay"),
        tap_trigger("tab.my", summary="open Alipay My tab"),
        wait(0.4, summary="wait for My tab"),
        tap_trigger("balance.open", summary="open Alipay balance page"),
        wait(0.6, summary="wait for balance page"),
    ]


def open_alipay_bills() -> list[Step]:
    """Alipay → My tab → bills page (month summary cards + transaction list)."""
    return [
        *open_app("支付宝", summary="open Alipay"),
        tap_trigger("tab.my", summary="open Alipay My tab"),
        wait(0.4, summary="wait for My tab"),
        tap_trigger("bill.open", summary="open Alipay bills page"),
        wait(0.6, summary="wait for bills list"),
    ]


def scroll_bills(times: int) -> list[Step]:
    """Best-effort vertical scrolls to browse the bills list (norm_0_1000)."""
    return [swipe_up(summary=f"browse bills list {i + 1}/{times}") for i in range(times)]


def swipe_bill_tabs_left() -> Step:
    """Scroll the bills quick-tab row so far-right tabs (e.g. 订单) become tappable."""
    return {
        "op": "swipe",
        "selector": 'div.overflow-x-auto:has(button[data-trigger="bill.tab.all"])',
        "start_fraction": 0.9,
        "end_fraction": 0.3,
        "y_fraction": 0.5,
        "summary": "scroll bills quick tabs left",
    }


def bill_row(title: str, amount: str) -> str:
    """XPath for one bills-list row anchored on its display title AND signed amount.

    Both values come from the fixed Alipay defaults.json (row amounts render
    as ``delta.toFixed(2)``, e.g. ``-2500.00``); anchoring on the row button
    keeps the assert from matching page-level ancestor containers.
    """
    return (
        'xpath=//button[@data-trigger="bill.detail.open"]'
        f'[.//div[normalize-space(.)="{title}"]]'
        f'[.//div[normalize-space(.)="{amount}"]]'
    )


def assert_cheapest_fan_card() -> Step:
    """Evidence assert: the cheapest 电风扇 card (title + price) is on screen.

    The suite's live test pins {query}="电风扇"; in the fixed products.json the
    cheapest fan — which happens to also be the cheapest 全新 fan — is
    "Dyson 电风扇 电子产品 241" at ¥90.34 (free shipping). Hardcoding the
    screen strings matches this plan file's test-injected style; after the
    price-low sort this card is the first result, so it sits in the viewport.
    """
    return assert_visible(
        'xpath=//div[@data-trigger="search.item.open"]'
        '[.//h3[normalize-space(.)="Dyson 电风扇 电子产品 241"]]'
        '[.//div[contains(normalize-space(.),"90.34")]]',
        summary="assert cheapest fan card (title + ¥90.34) on results",
    )


def create_note(title: str, content: str) -> list[Step]:
    return [
        *open_app("笔记", summary="open Notes"),
        click_selector('button[aria-label="新建笔记"]:visible', summary="open new note editor"),
        wait(0.4, summary="wait for note editor"),
        type_text(title, selector='input[placeholder="标题"]', clear=True, summary="type note title"),
        type_text(content, selector="textarea:visible", clear=True, summary="type note content"),
        back(summary="dismiss note keyboard"),
        wait(1.2, summary="wait for note autosave"),
    ]


def send_wechat_message(content: str, *, contact: str = "{contact}") -> list[Step]:
    return [
        *open_app("微信", summary="open WeChat"),
        tap_trigger("search.open", summary="open WeChat search"),
        wait(0.3, summary="wait for WeChat search"),
        type_text(contact, selector="input:visible", clear=True, summary="search target WeChat contact"),
        wait(0.4, summary="wait for WeChat search results"),
        trigger_param("chat.open", "id", "{contact_wxid}", summary="open target WeChat chat"),
        wait(0.4, summary="wait for chat page"),
        type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
        click_selector("button.bg-app-primary:visible", summary="send WeChat message"),
        wait(0.6, summary="wait for WeChat send"),
    ]


def post_wechat_moment(content: str) -> list[Step]:
    return [
        *open_app("微信", summary="open WeChat"),
        tap_trigger("tab.discover", summary="open WeChat Discover tab"),
        wait(0.3, summary="wait for Discover"),
        tap_trigger("discover.moments.open", summary="open Moments"),
        wait(0.5, summary="wait for Moments"),
        tap_trigger("moments.menu.camera.open", summary="open Moments camera menu"),
        wait(0.3, summary="wait for camera menu"),
        tap_trigger("moments.post.open.fromAlbum", summary="open Moments media picker"),
        wait(0.8, summary="wait for media picker"),
        click_selector("div.grid button.absolute.top-2.right-2:visible", summary="select first media item"),
        wait(0.3, summary="wait for media selection"),
        tap_trigger("moments.post.open.fromMediaPicker", summary="continue to Moments composer"),
        wait(0.8, summary="wait for Moments composer"),
        type_text(content, selector="textarea:visible", clear=True, summary="type Moment text"),
        tap_action("moments.post.submit", summary="submit Moment"),
        wait(0.8, summary="wait for Moment post"),
    ]


def ebay_search_sample() -> list[Step]:
    return [
        *open_app("eBay", summary="open eBay"),
        tap_trigger("home.search.open", summary="open eBay search"),
        wait(0.5, summary="wait for search input"),
        click_selector('div.cursor-pointer:has-text("{query}"):visible', summary="run prepared eBay search"),
        wait(1.0, summary="wait for eBay search results"),
    ]


def ebay_rerun_sample() -> list[Step]:
    return [
        click_selector("div.cursor-text:visible", summary="reopen eBay search input"),
        wait(0.3, summary="wait for search input"),
        click_selector('div.cursor-pointer:has-text("{query}"):visible', summary="rerun prepared eBay search"),
        wait(1.0, summary="wait for second eBay search"),
    ]


def ebay_sort_price_low() -> list[Step]:
    return [
        click_selector('button:has-text("排序"):visible', summary="open eBay sort sheet"),
        wait(0.3, summary="wait for sort sheet"),
        click_selector(
            'xpath=//div[@role="dialog"]//div[contains(@class,"cursor-pointer") and .//span[normalize-space()="最低价 + 运费优先"]]',
            summary="choose lowest price plus shipping sort",
        ),
        wait(0.8, summary="wait for price-low sort snapshot"),
    ]


def ebay_filter_new() -> list[Step]:
    return [
        click_selector('button:has-text("筛选条件"):visible', summary="open eBay filters"),
        wait(0.3, summary="wait for filter drawer"),
        click_selector(
            'xpath=//div[contains(@class,"cursor-pointer") and .//span[normalize-space()="物品状况"]]',
            summary="open condition filter",
        ),
        wait(0.3, summary="wait for condition filter"),
        click_selector(
            'xpath=//div[contains(@class,"cursor-pointer") and .//span[normalize-space()="全新"]]',
            summary="select new condition",
        ),
        wait(0.2, summary="wait for condition selection"),
        click_selector('xpath=(//button[contains(.,"显示")])[last()]', summary="close condition subfilter"),
        wait(0.3, summary="wait for main filter drawer"),
        click_selector('xpath=(//button[contains(.,"显示")])[last()]', summary="apply eBay filters"),
        wait(0.9, summary="wait for filtered search snapshot"),
    ]


def ebay_new_search() -> list[Step]:
    return [
        *ebay_search_sample(),
        *ebay_filter_new(),
        # Price-low sort so the judge's cheapest-全新 product becomes the first
        # card: under the default best-match order it is buried mid-list, which
        # would make the on-screen evidence assert unverifiable. The judges of
        # all three consumers only require a snapshot with condition=全新 (sort
        # unconstrained), so the extra sort cannot break them.
        *ebay_sort_price_low(),
    ]


def ebay_price_low_search() -> list[Step]:
    return [
        *ebay_search_sample(),
        *ebay_sort_price_low(),
    ]


PLANS: dict[str, list[Step]] = {
    "crossapp_commerce.AlipayBalanceToWechat": [
        *open_alipay_balance(),
        # Evidence assert: the injected {wechat_message} is a full sentence with
        # no standalone balance param to reference, but the balance is the fixed
        # defaults.json total (100023.46) and the page renders it with en-US
        # thousands separators — hardcoding the screen string is acceptable.
        assert_text("100,023.46", summary="assert Alipay total balance on screen"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayMonthlySpendToWechat": [
        # Current-month card at the top of the bills page shows the 支出 total.
        *open_alipay_bills(),
        # Evidence assert (structural): the current-month 支出 total is summed
        # over relative-timestamp records, so its value shifts with the run
        # date — certify the primary (current-month) card's expense amount
        # element instead of a hardcoded number.
        assert_visible(
            'xpath=(//div[@data-month-key])[1]'
            '//div[div[normalize-space(.)="支出"]]/div[contains(@class,"font-medium")]',
            summary="assert current-month expense total on bills page",
        ),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayRecentTransactionsToNotes": [
        *open_alipay_bills(),
        *scroll_bills(1),
        *create_note("最近5笔交易", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayLowestPriceToNotes": [
        *ebay_price_low_search(),
        *create_note("eBay最低价", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayProductShareToWechat": [
        *ebay_new_search(),
        # Evidence assert: the judge checks the message for the cheapest-全新
        # product's title and total price — certify that card on screen first.
        assert_cheapest_fan_card(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayLargestExpenseToNotes": [
        *open_alipay_bills(),
        *scroll_bills(4),
        *create_note("最大支出", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayDualItemCompareToNotes": [
        *ebay_price_low_search(),
        *ebay_rerun_sample(),
        *create_note("eBay比价", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.AlipayLargestExpenseToMoments": [
        *open_alipay_bills(),
        *scroll_bills(4),
        # Evidence assert: the all-history largest expense is the fixed
        # 2026-01-15 transfer (转账-正中(刘沐辰) -2500.00); four browse swipes
        # park the 2026-01 bill group in the viewport.
        assert_visible(
            bill_row("转账-正中(刘沐辰)", "-2500.00"),
            summary="assert largest expense row on bills list",
        ),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
    "crossapp_commerce.AlipayMonthlyToNotesAndWechat": [
        *open_alipay_bills(),
        *create_note("本月支出", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.EbayBalanceDiffToNotes": [
        *ebay_new_search(),
        # Evidence assert: the note must carry this product's title and price.
        assert_cheapest_fan_card(),
        *open_alipay_balance(),
        # Evidence assert (structural): this task injects a seeded random
        # balance (5000–10000) via _post_sample, so the exact digits cannot be
        # hardcoded here — certify the balance headline element renders a real
        # thousands-formatted amount (rules out the "****" hidden state).
        # No backslash classes: Playwright's CSS string parser eats "\d".
        assert_visible(
            'div.text-4xl.font-bold:text-matches("^[0-9][0-9,]*[.][0-9][0-9]$")',
            summary="assert injected Alipay balance amount on balance page",
        ),
        *create_note("购买后余额", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayDualItemBalanceToNotes": [
        *ebay_price_low_search(),
        # Evidence assert: item1 = item2 = 电风扇 in the live test, so one
        # price-low search covers both; the note's prices both come from this
        # first card.
        assert_cheapest_fan_card(),
        *open_alipay_balance(),
        # Evidence assert: no balance injection here — the fixed defaults.json
        # total renders as "100,023.46".
        assert_text("100,023.46", summary="assert Alipay total balance on screen"),
        *create_note("两个商品余额", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.FullShoppingDecisionFlow": [
        *ebay_new_search(),
        # Evidence assert: note + WeChat message both reference the cheapest
        # 全新 product found here.
        assert_cheapest_fan_card(),
        *open_alipay_balance(),
        # Evidence assert: no balance injection here — the fixed defaults.json
        # total renders as "100,023.46".
        assert_text("100,023.46", summary="assert Alipay total balance on screen"),
        *create_note("购物决策", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayShareBillDetail": [
        # Latest bill is the first row of the current-month card.
        *open_alipay_bills(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.FinancialReportToNotes": [
        # Balance page shows the total plus the latest three records (one stop).
        *open_alipay_balance(),
        swipe_up(summary="browse balance record list"),
        *create_note("支付宝财务记录", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayPriceBelowBudgetToNotes": [
        *ebay_price_low_search(),
        *create_note("预算记录", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.AlipayThankTopIncomeTransfer": [
        *open_alipay_bills(),
        tap_trigger("bill.tab.transfer", summary="switch bills to transfer tab"),
        wait(0.5, summary="wait for transfer bills"),
        *scroll_bills(3),
        *create_note("转账收入统计", "{note_content}"),
        *send_wechat_message("{wechat_message}", contact="若溪"),
        complete(),
    ],
    "crossapp_commerce.AlipayYearCompareTopExpenseToWechat": [
        *open_alipay_bills(),
        *scroll_bills(8),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.BillTypeYearSummaryToWechat": [
        *open_alipay_bills(),
        swipe_bill_tabs_left(),
        tap_trigger("bill.tab.order", summary="switch bills to order tab"),
        wait(0.5, summary="wait for order bills"),
        *scroll_bills(3),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.MonthCompareThenExplainToNote": [
        *open_alipay_bills(),
        *scroll_bills(2),
        *create_note("月度花销对比", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.Top3ExpenseSummaryToWechat": [
        *open_alipay_bills(),
        # Evidence asserts (aggregate answer): the top-3 verdict is never
        # rendered as one string — certify the three participating expense rows
        # instead (fixed defaults data; ranks stable while the sim date stays
        # ~30 days clear of the 2026-02 absolute-dated records). #2 (-200.00)
        # and #3 (-168.00) sit inside the current-month card's first screen;
        # #1 (-520.00, 14 days ago) lives in the previous-month group, so
        # browse down before certifying it.
        assert_visible(
            bill_row("转账-正中(刘沐辰)", "-200.00"),
            summary="assert #2 expense row on screen",
        ),
        assert_visible(
            bill_row("美团", "-168.00"),
            summary="assert #3 expense row on screen",
        ),
        *scroll_bills(1),
        assert_visible(
            bill_row("转账-浩杰(李浩杰)", "-520.00"),
            summary="assert #1 expense row after browse",
        ),
        *scroll_bills(2),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
}
