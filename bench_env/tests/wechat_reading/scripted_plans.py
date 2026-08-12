"""Scripted validation plans for WeChat Reading tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_text,
    back,
    complete,
    enter,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def trigger_param(trigger_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, value: str, *, param: str, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_search_result(book_title: str, book_id: str) -> list[Step]:
    return [
        trigger_visible("search.open", summary="open WeChat Reading search"),
        type_text(book_title, selector="input:visible", clear=True, summary=f"search for {book_title}"),
        wait(0.5, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        trigger_param("book.detail.open", book_id, param="bookId", summary=f"open book detail {book_id}"),
        wait(0.4, summary="wait for book detail"),
    ]


def open_reader_from_bookshelf(book_id: str) -> list[Step]:
    return [
        trigger_visible("tab.bookshelf", summary="open Bookshelf tab"),
        trigger_param("reader.open", book_id, param="bookId", summary=f"open reader for shelf book {book_id}"),
        wait(0.8, summary="wait for reader"),
    ]


def show_reader_menu() -> Step:
    return {"op": "click", "point": [500, 500], "summary": "tap reader center to show menu"}


def drag_reader_progress(percent: int) -> Step:
    return {
        "op": "drag",
        "selector": "[data-task-progress]:visible",
        "start_fraction": 0.02,
        "end_fraction": percent / 100,
        "y_fraction": 0.5,
        "end_space": "layout",
        "duration_ms": 500,
        "summary": f"drag reader progress slider to {percent}%",
    }


def drag_font_size(font_size: int) -> Step:
    stops = [16, 17, 18, 19, 20, 22, 24, 27, 30, 33, 36, 40]
    index = stops.index(font_size)
    return {
        "op": "drag",
        "selector": "[data-task-fontsize]:visible",
        "start_fraction": 0.02,
        "end_fraction": index / (len(stops) - 1),
        "y_fraction": 0.5,
        "end_space": "layout",
        "duration_ms": 500,
        "summary": f"drag reader font size slider to {font_size}",
    }


def set_reader_progress(book_id: str, percent: int) -> list[Step]:
    return [
        *open_reader_from_bookshelf(book_id),
        show_reader_menu(),
        trigger_visible("reader.progress.open", summary="open reader progress panel"),
        wait(0.3, summary="wait for progress panel"),
        drag_reader_progress(percent),
        wait(0.3, summary="wait for progress update"),
    ]


def add_book_from_search(book_title: str, book_id: str) -> list[Step]:
    return [
        *open_search_result(book_title, book_id),
        action_param("bookDetail.item.shelf.add.submit", book_id, param="bookId", summary=f"add book {book_id} to shelf"),
        wait(0.3, summary="wait for shelf add"),
    ]


def select_shelf_books(*book_ids: str) -> list[Step]:
    steps: list[Step] = [
        trigger_visible("tab.bookshelf", summary="open Bookshelf tab"),
        trigger_visible("bookshelf.select.enter.tap", summary="enter bookshelf select mode"),
        wait(0.3, summary="wait for select mode"),
    ]
    for book_id in book_ids:
        steps.append(
            action_param("bookshelf.item.select.toggle", book_id, param="bookId", summary=f"select shelf book {book_id}")
        )
    return steps


def remove_selected_books(*book_ids: str) -> list[Step]:
    return [
        *select_shelf_books(*book_ids),
        trigger_visible("bookshelf.modal.confirm_remove.open", summary="open remove confirmation"),
        action_visible("bookshelf.removeSelected.submit", summary="confirm removing selected shelf books"),
        wait(0.4, summary="wait for shelf removal"),
    ]


def set_page_turn_simulation() -> list[Step]:
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.pageTurn.open", summary="open page turn settings"),
        action_visible("settings.pageTurnStyle.select.simulation", summary="select simulated page turn"),
        wait(0.2, summary="wait for page turn update"),
    ]


PLANS: dict[str, list[Step]] = {
    "wechat_reading.CheckCoinBalance": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("wallet.coins.open", summary="open coin wallet page"),
        wait(0.4, summary="wait for coin balance page"),
        # 余额大字在屏（number matcher：50 与屏显 50.00 数值相等）
        assert_answer("{answer}", summary="assert coin balance on screen"),
        *grounded_answer("{answer}", summary="answer coin balance"),
        complete(),
    ],
    "wechat_reading.CheckHotSearchRank": [
        trigger_visible("search.open", summary="open WeChat Reading search"),
        wait(0.4, summary="wait for hot search list"),
        # 热搜榜第 {rank} 名书名在榜单首屏可见
        assert_answer("{answer}", summary="assert hot search title on screen"),
        *grounded_answer("{answer}", summary="answer hot search title"),
        complete(),
    ],
    "wechat_reading.CheckBookRating": [
        # bookId 20 = 测试固定参数《活着》
        *open_search_result("{book_title}", "20"),
        # 详情页"微信读书推荐值 92%"（number matcher 容忍 % 后缀）
        assert_answer("{answer}", summary="assert book recommendation value on screen"),
        *grounded_answer("{answer}", summary="answer book recommendation value"),
        complete(),
    ],
    "wechat_reading.AddBookToShelf": [
        *add_book_from_search("三体", "19"),
        complete(),
    ],
    "wechat_reading.ManageShelf": [
        *remove_selected_books("4"),
        complete(),
    ],
    "wechat_reading.SearchBookAuthor": [
        # bookId 20 = 测试固定参数《活着》
        *open_search_result("{book_title}", "20"),
        # 详情页作者行"余华 >"在屏
        assert_answer("{answer}", summary="assert book author on screen"),
        *grounded_answer("{answer}", summary="answer book author"),
        complete(),
    ],
    "wechat_reading.TogglePrivateReading": [
        *select_shelf_books("4"),
        trigger_visible("bookshelf.modal.private.open", summary="open private reading confirmation"),
        action_visible("bookshelf.privateReading.enable.submit", summary="enable private reading"),
        wait(0.4, summary="wait for private reading update"),
        complete(),
    ],
    "wechat_reading.EditProfileName": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("profile.edit.open", summary="open profile editor"),
        type_text(
            "{new_name}",
            selector='[data-action="profile.edit.name.input"]:visible',
            clear=True,
            summary="type new profile name",
        ),
        enter(summary="commit inline profile name input"),
        complete(),
    ],
    "wechat_reading.SetDarkMode": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.darkMode.open", summary="open dark mode settings"),
        action_visible("settings.darkMode.select.dark", summary="select dark mode"),
        complete(),
    ],
    "wechat_reading.FindAudiobookPlays": [
        # bookId audio_18 = 测试固定参数《红楼梦》有声版
        *open_search_result("{book_title}", "audio_18"),
        # 有声书详情页"听过 25万次"在屏（text matcher 规整化包含）
        assert_answer("{answer}", summary="assert audiobook play count on screen"),
        *grounded_answer("{answer}", summary="answer audiobook play count"),
        complete(),
    ],
    "wechat_reading.AnalyzeReadingHabit": [
        trigger_visible("myReading.open.week", summary="open weekly reading stats"),
        wait(0.5, summary="wait for weekly stats page"),
        # 答案（星期几）需综合最近 7 天记录推理，窗口可跨自然周，周视图单屏
        # 不直接给出该结论文本；断"阅读时长分布"图表卡可见作为读屏证据。
        assert_text("阅读时长分布", summary="assert weekly duration chart visible"),
        *grounded_choice_answer("{answer}", summary="answer longest reading weekday"),
        complete(),
    ],
    "wechat_reading.CheckCalendarMonthReading": [
        # 首页 heroCarousel 挂载后 scrollLeft=128，月阅读卡被滚出视口
        # （hit-test 不允许隐式滚动），改从 Me 页进周视图再切月 Tab。
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("myReading.open.week", summary="open reading stats"),
        wait(0.5, summary="wait for reading stats page"),
        # 统计页 Tab 未打 data-trigger，用精确文本选择器切到月视图
        click_selector('button:text-is("月"):visible', summary="switch to month view"),
        wait(0.4, summary="wait for month view"),
        # 月视图默认当前月；任务参数固定 2026-01（records 里该月为绝对日期）。
        # 上/下月切换按钮未打 data-trigger，用日期导航区结构选择器定位；
        # 当前月 2026-08 → 点"上一月"7 次（sim 时间漂移到下个月后需 +1）。
        *[
            click_selector(
                "div.flex.items-center.gap-2 > button:nth-child(1):visible",
                summary=f"go to previous month ({i + 1}/7)",
            )
            for i in range(7)
        ],
        wait(0.4, summary="wait for 2026-01 stats"),
        # 计数类答案：断带语义标签的证据行"阅读{answer}天"，防纯短数字误匹配
        assert_text("阅读{answer}天", summary="assert monthly reading day count on screen"),
        *grounded_answer("{answer}", summary="answer month reading day count"),
        complete(),
    ],
    "wechat_reading.CompareBookLengths": [
        # 先进《活着》(bookId 20) 详情核对字数：92000 → 屏显"9.2万字"
        *open_search_result("{book2}", "20"),
        assert_text("9.2万字", summary="assert book2 word count on screen"),
        back(summary="back to search page"),
        # 返回搜索页（重置为热搜态）后直接重搜《三体》(bookId 19)：
        # 800000 → 屏显"80.0万字"，字数更多 → 加入书架
        type_text("{book1}", selector="input:visible", clear=True, summary="search for book1"),
        wait(0.5, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        trigger_param("book.detail.open", "19", param="bookId", summary="open book detail 19"),
        wait(0.4, summary="wait for book detail"),
        assert_text("80.0万字", summary="assert book1 word count on screen"),
        action_param("bookDetail.item.shelf.add.submit", "19", param="bookId", summary="add book 19 to shelf"),
        wait(0.3, summary="wait for shelf add"),
        *grounded_choice_answer("{book1}", summary="answer thicker book"),
        complete(),
    ],
    "wechat_reading.FindHighestRatedBookInCategory": [
        trigger_visible("categories.open", summary="open category list"),
        wait(0.4, summary="wait for category list"),
        trigger_param("category.detail.open", "{category}", param="categoryName", summary="open category detail"),
        wait(0.4, summary="wait for category detail"),
        # 答案书名（评分最高者）在分类书籍列表首屏可见
        assert_answer("{answer}", summary="assert highest rated book title on screen"),
        *grounded_answer("{answer}", summary="answer highest rated category book"),
        complete(),
    ],
    "wechat_reading.ConfigureReaderSettings": [
        *open_reader_from_bookshelf("4"),
        show_reader_menu(),
        trigger_visible("reader.typography.open", summary="open typography panel"),
        wait(0.3, summary="wait for typography panel"),
        drag_font_size(24),
        wait(0.3, summary="wait for font size update"),
        back(summary="close reader tool panel"),
        wait(0.2, summary="wait for reader tool close"),
        back(summary="return to bookshelf"),
        wait(0.3, summary="wait for bookshelf"),
        *set_page_turn_simulation(),
        complete(),
    ],
    "wechat_reading.UnfollowUser": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("following.open.following", summary="open following list"),
        action_param("following.item.unfollow.toggle", "user_508", param="userId", summary="unfollow user 508"),
        complete(),
    ],
    "wechat_reading.SetProfileVisibility": [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        trigger_visible("settings.privacy.profile.open", summary="open profile privacy settings"),
        action_visible("settings.profilePrivacy.visibility.select.self", summary="select self-only profile visibility"),
        complete(),
    ],
    "wechat_reading.ReadBookProgress": [
        *set_reader_progress("60", 20),
        complete(),
    ],
    "wechat_reading.OrganizeShelfByRecommendation": [
        *remove_selected_books("4", "30", "65", "66", "67"),
        complete(),
    ],
    "wechat_reading.AddBookAndReadTo": [
        # bookId 19 = 测试固定参数《三体》
        *add_book_from_search("{book_title}", "19"),
        # hybrid 无 answer_fields（不能用 assert_answer）；断详情页按钮文案
        # 变为"已加入书架"作为加架成功的状态证据。
        assert_text("已加入书架", summary="assert book added to shelf"),
        trigger_param("reader.open", "19", param="bookId", summary="open reader for added book"),
        wait(0.8, summary="wait for added book reader"),
        show_reader_menu(),
        trigger_visible("reader.progress.open", summary="open reader progress panel"),
        wait(0.3, summary="wait for progress panel"),
        drag_reader_progress(20),
        wait(0.3, summary="wait for progress update"),
        complete(),
    ],
    "wechat_reading.FindLowestProgressAndRead": [
        *set_reader_progress("60", 50),
        complete(),
    ],
    "wechat_reading.PrivacyAndThemeBundle": [
        *open_reader_from_bookshelf("4"),
        show_reader_menu(),
        trigger_visible("reader.theme.open", summary="open reader theme panel"),
        wait(0.3, summary="wait for theme panel"),
        click_selector('div[data-task-theme] button:nth-of-type(2):visible', summary="select yellow reader theme color"),
        wait(0.2, summary="wait for theme update"),
        back(summary="close reader tool panel"),
        wait(0.2, summary="wait for reader tool close"),
        back(summary="return to bookshelf"),
        wait(0.3, summary="wait for bookshelf"),
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        action_visible("settings.privacy.requireFollowRequest.toggle", summary="enable follow request privacy"),
        back(summary="return to settings"),
        trigger_visible("settings.pageTurn.open", summary="open page turn settings"),
        action_visible("settings.pageTurnStyle.select.simulation", summary="select simulated page turn"),
        complete(),
    ],
}
