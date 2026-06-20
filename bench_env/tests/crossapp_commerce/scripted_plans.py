"""Scripted validation plans for cross-app commerce tasks."""

from __future__ import annotations

from bench_env.agent.scripted import Step, awake, back, complete, home, tap_action, tap_trigger, type_text, wait


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
    ]


def ebay_price_low_search() -> list[Step]:
    return [
        *ebay_search_sample(),
        *ebay_sort_price_low(),
    ]


PLANS: dict[str, list[Step]] = {
    "crossapp_commerce.AlipayBalanceToWechat": [
        *open_app("支付宝", summary="open Alipay for balance"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayMonthlySpendToWechat": [
        *open_app("支付宝", summary="open Alipay for monthly spend"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayRecentTransactionsToNotes": [
        *open_app("支付宝", summary="open Alipay for recent transactions"),
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
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayLargestExpenseToNotes": [
        *open_app("支付宝", summary="open Alipay bills"),
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
        *open_app("支付宝", summary="open Alipay bills"),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
    "crossapp_commerce.AlipayMonthlyToNotesAndWechat": [
        *open_app("支付宝", summary="open Alipay monthly spend"),
        *create_note("本月支出", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.EbayBalanceDiffToNotes": [
        *ebay_new_search(),
        *open_app("支付宝", summary="open Alipay balance"),
        *create_note("购买后余额", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayDualItemBalanceToNotes": [
        *ebay_price_low_search(),
        *create_note("两个商品余额", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.FullShoppingDecisionFlow": [
        *ebay_new_search(),
        *open_app("支付宝", summary="open Alipay balance"),
        *create_note("购物决策", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.AlipayShareBillDetail": [
        *open_app("支付宝", summary="open Alipay latest bill"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.FinancialReportToNotes": [
        *open_app("支付宝", summary="open Alipay financial report"),
        *create_note("支付宝财务记录", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.EbayPriceBelowBudgetToNotes": [
        *ebay_price_low_search(),
        *create_note("预算记录", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.AlipayThankTopIncomeTransfer": [
        *open_app("支付宝", summary="open Alipay transfer income"),
        *create_note("转账收入统计", "{note_content}"),
        *send_wechat_message("{wechat_message}", contact="若溪"),
        complete(),
    ],
    "crossapp_commerce.AlipayYearCompareTopExpenseToWechat": [
        *open_app("支付宝", summary="open Alipay yearly top expenses"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.BillTypeYearSummaryToWechat": [
        *open_app("支付宝", summary="open Alipay bill type summary"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_commerce.MonthCompareThenExplainToNote": [
        *open_app("支付宝", summary="open Alipay monthly comparison"),
        *create_note("月度花销对比", "{note_content}"),
        complete(),
    ],
    "crossapp_commerce.Top3ExpenseSummaryToWechat": [
        *open_app("支付宝", summary="open Alipay recent top expenses"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
}
