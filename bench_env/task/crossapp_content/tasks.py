"""
Cross-app Content & Social tasks.
"""
# -- Task Index (auto-generated, do not edit) --
# 21 tasks | L2×4  L3×7  L4×10
#
# [L2] SpotifyNowPlayingToWechat            把 Spotify 当前播放的歌加入喜欢，再把歌名微信发给{contact}
# [L3] BilibiliRankingToWechat              看看B站{partition}区排行榜第{rank}名是什么视频，把标题微信发给{contact}
# [L3] RedbookSearchTitleToWechat           在小红书搜'{keyword}'，把第一篇笔记的标题微信发给{contact}
# [L4] SpotifyTodayNthPlayToRedbook         查看我今天在 Spotify 听的第{nth}首歌，在小红书发一篇推荐笔记，标题或正文包含歌名和艺人
# [L3] WechatReadingBestBookToWechat        帮我在微信读书{category}分类下找推荐值最高的书，把书名和推荐值微信发给{contact}
# [L4] WechatReadingStatsToWechat           查微信读书最近一周内阅读时长最多的一天是哪天读了多久，告诉微信好友{contact}
# [L3] RedbookAuthorFollowersToWechat       在小红书搜'{keyword}'，关注第一篇笔记的作者，并将作者名字和粉丝数微信发给{contact}
# [L4] XLatestPostToReddit_WithTitleFormat  把 X 用户 {user} 最新一条推文的文字内容，以"{user}:"开头发到 Reddit 的 r/{subreddit}。
# [L4] RedbookFollowingNoteCountToSms       查小红书我关注的'{username}'发了多少篇笔记，发短信告诉{contact}
# [L4] SpotifySongFullDetailsToRedbook      在Spotify搜'{song}'查下是谁唱的、几分钟，在小红书发一篇听歌笔记把这些写进去
# [L3] BilibiliTripleLikeThenMoments        在B站{partition}排行榜找到第{rank}名给它一键三连，然后发个纯文字朋友圈推荐这个视频
# [L2] RedbookDmThenWechatReport            给小红书上我关注的'{username}'发私信'{message}'，然后在微信告诉{contact}已经联系他了
# [L2] NotesContentToRedbookAndX            在笔记里写一段关于{topic}的想法，然后分别在小红书和X上发布出来
# [L4] DailyLogToMoments                    把我笔记里最新两条笔记简单汇总一下，发一条朋友圈。
# [L4] CulturalChecklistToRedbook           看看Spotify我今天最早听的那首歌是什么，再看看微信读书热搜第一本书叫什么，在笔记里记一份'今日文化清单'，然后在小红书发一篇笔记分享
# [L3] EbayCheapToRedbook                   帮我在 eBay 看看{product}里最便宜的那款，然后发一篇小红书商品推荐笔记。
# [L2] SpotifySaveCurrentSongToNotes        把 Spotify 正在播放的歌名和歌手记到笔记里
# [L3] WechatReadingShareBookList           把微信读书书架前{n}本书的名字微信发给{contact}
# [L4] ReadingPlanToNotes                   看看微信读书里我正在读的书，然后在笔记里制定一个本周的阅读计划。
# [L4] FileManagerSendFileToWechatContact   我有一张图片分别在两个目录下各有一张不同名的副本，帮我找出他们，并把这两个文件名发给微信联系人{contact}
# [L4] NotesToWechatAndRedbook              把包含"{text_keyword}"的内容记到笔记后，再用微信同步发给{contact}，并发布一条对应的小红书笔记。
# -- End Task Index --


from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import match_track_duration
from bench_env.task.bilibili.app import BILIBILI_PARTITION_PARAM, Bilibili
from bench_env.task.ebay.app import EBAY_SEARCH_CHANGES, EBAY_SEARCH_QUERY_PARAM, Ebay
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.redbook.app import REDBOOK_FOLLOWING_USER_PARAM, REDBOOK_KEYWORD_PARAM, REDBOOK_PUBLISH_CHANGES, Redbook
from bench_env.task.reddit.app import Reddit
from bench_env.task.sms.app import SMS_RECIPIENT_PARAM, SMS_SEND_CHANGES, sms_from_input
from bench_env.task.spotify.app import SPOTIFY_ARTIST_PARAM, SPOTIFY_QUERY_CHANGES, Spotify
from bench_env.task.utils import count_titles_in_text, norm, to_simplified
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_MOMENT_CHANGES, WECHAT_SEND_CHANGES, Wechat
from bench_env.task.wechat_reading.app import (
    WECHAT_READING_BOOK_PARAM,
    WECHAT_READING_CATEGORY_PARAM,
    WECHAT_READING_UI_TO_DATA,
    WechatReading,
    format_words,
)
from bench_env.task.x.app import X, X_POST_CHANGES



class SpotifyNowPlayingToWechat(BaseTask):
    templates = [
        "把 Spotify 当前播放的歌加入喜欢，再把歌名微信发给{contact}",
        "Add the currently playing song on Spotify to liked songs, then send the song name to {contact} on WeChat",
    ]
    apps = ["spotify", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["extract", "social", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = ["apps.spotify"] + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify_init = Spotify(input.apps_init["spotify"])
        spotify = Spotify(input.apps["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        title = spotify_init.current_track_title
        if not title:
            raise ValueError("任务设计错误：spotify.currentTrack 为空。")
        return [
            spotify.check_in_liked(title, field="spotify_liked"),
            wechat.check_new_sent_contains(self.p.contact, title, field="spotify_now_playing"),
        ]


class BilibiliRankingToWechat(BaseTask):
    templates = [
        "看看B站{partition}区排行榜第{rank}名是什么视频，把标题微信发给{contact}",
        "帮我查B站{partition}分区排行榜第{rank}名叫什么，发给微信的{contact}",
        "Check what the #{rank} video is on Bilibili's {partition} ranking, then send its title to {contact} on WeChat",
        "Look up the #{rank} ranked video in Bilibili's {partition} section and send the title to {contact} via WeChat",
    ]
    apps = ["bilibili", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["extract", "handoff"]
    parameters = {
        "partition": BILIBILI_PARTITION_PARAM,
        "rank": {"type": "int", "default": 1},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["apps.bilibili.activeVideoId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        title = Bilibili.ranking_title(self.p.partition, int(self.p.rank))
        return [wechat.check_new_sent_contains(self.p.contact, title, field="bili_ranking_title")]


class RedbookSearchTitleToWechat(BaseTask):
    templates = ["在小红书搜'{keyword}'，把第一篇笔记的标题微信发给{contact}"]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "handoff"]
    parameters = {"keyword": REDBOOK_KEYWORD_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES + ["redbook.searchHistory", "redbook.history"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        note = rb.first_search_note(self.p.keyword)
        return [
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                str(note["title"]),
                field="redbook_title_share",
                last_only=True,
            )
        ]
class SpotifyTodayNthPlayToRedbook(BaseTask):
    templates = [
        "查看我今天在 Spotify 听的第{nth}首歌，在小红书发一篇推荐笔记，标题或正文包含歌名和艺人",
    ]
    apps = ["spotify", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "handoff"]
    parameters = {
        "nth": {
            "type": "enum",
            "values": {"一": 1, "二": 2, "三": 3},
            "default": 1,
        },
    }
    expected_changes = ["apps.spotify"] + REDBOOK_PUBLISH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps_init["spotify"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        # 保留自然用户话术“今天第 n 首”，但 judge 仍按最近播放页可见顺序近似。
        track = spotify.nth_today_play(int(self.p.nth))
        song_title = str(track["title"])
        artist = str(track["artist"])
        # 任务要求"标题或正文包含歌名和艺人"，用 text_keywords 在 title+desc 合并文本中检查
        return [
            rb.check_note_published(
                text_keywords=(song_title, artist),
                new_only=True,
                field="redbook_today_nth_play",
            )
        ]
class WechatReadingBestBookToWechat(BaseTask):
    templates = ["帮我在微信读书{category}分类下找推荐值最高的书，把书名和推荐值微信发给{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "handoff"]
    parameters = {"category": WECHAT_READING_CATEGORY_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        data_cats = WECHAT_READING_UI_TO_DATA.get(self.p.category, [self.p.category])
        books = [b for b in wr.store if str(b.get("category")) in data_cats]
        if not books:
            raise ValueError(f"No books in UI category '{self.p.category}'")
        books.sort(key=lambda b: float(b.get("rating") or 0), reverse=True)
        book = books[0]
        rv = str(book.get("recommendedValue", ""))
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                str(book["title"]),
                rv,
                field="best_book_share",
            )
        ]
class WechatReadingStatsToWechat(BaseTask):
    templates = ["查微信读书最近一周内阅读时长最多的一天是哪天读了多久，告诉微信好友{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        date_value, minutes = wr.best_reading_day_and_duration(input.os)
        labels = WechatReading.date_labels(date_value, input.os)
        return [
            wechat.check_new_sent_any_of(
                self.p.contact,
                labels,
                str(minutes),
                field="reading_stats",
            )
        ]


class RedbookAuthorFollowersToWechat(BaseTask):
    templates = [
        "在小红书搜'{keyword}'，关注第一篇笔记的作者，并将作者名字和粉丝数微信发给{contact}",
    ]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "social", "handoff"]
    parameters = {"keyword": REDBOOK_KEYWORD_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = [
        "redbook.searchHistory",
        "redbook.user.followingIds",
        "redbook.history",
    ] + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        author = rb.note_author(rb.first_search_note(self.p.keyword))
        author_name = str(author["name"])
        followers = str(author["followers"])
        return [
            rb.check_following(str(author["id"]), field="redbook_following"),
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                author_name,
                followers,
                field="redbook_author_followers",
            ),
        ]


class XLatestPostToReddit_WithTitleFormat(BaseTask):
    templates = [
        '把 X 用户 {user} 最新一条推文的文字内容，以"{user}:"开头发到 Reddit 的 r/{subreddit}。',
        "Post the text content of X user {user}'s latest tweet to Reddit's r/{subreddit}, starting with \"{user}:\".",
    ]
    apps = ["x", "reddit"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "social", "handoff"]
    parameters = {
        "user": {"type": "string", "default": "elonmusk"},
        "subreddit": {
            "type": "enum",
            "values": {"China_irl": "China_irl", "Games": "Games", "Music": "Music", "OtherSide": "OtherSide"},
            "default": "China_irl",
        },
    }
    expected_changes = [
        "reddit.comments", "reddit.createDraft",
        "reddit.posts", "reddit.user.postIds", "reddit.user.postVotes", "reddit.user.commentIds",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        x_app = X(input.apps_init["x"])
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])

        # 1) 从 X 找到该用户最新推文内容
        user_lower = self.p.user.lower().lstrip("@")
        if not user_lower:
            raise RuntimeError("任务设计错误：X user 不能为空")

        tweet_content = ""
        for post in x_app.view_posts():
            aid = str(post.get("authorId") or "").lower()
            # authorId 格式为 "u_elonmusk"，去掉 "u_" 前缀比较
            if aid.removeprefix("u_") == user_lower or user_lower in aid:
                tweet_content = str(post.get("content") or "").strip()
                break
        if not tweet_content:
            raise RuntimeError(f"任务设计错误：未找到 X 用户 {self.p.user} 的非空推文")

        # 2) 从 Reddit 找用户新发布的内容，验证包含 "{user}:" 前缀和推文内容
        prefix = self.p.user.strip() + ":"
        return [
            reddit.check_new_content_contains(
                prefix,
                tweet_content,
                subreddit=str(self.p.subreddit).strip(),
                field="reddit_post",
                normalize_match=True,
            )
        ]


class RedbookFollowingNoteCountToSms(BaseTask):
    templates = [
        "查小红书我关注的'{username}'发了多少篇笔记，发短信告诉{contact}",
        "Check how many notes '{username}' (someone I follow on RedNote) has posted, and send the count to {contact} via SMS",
    ]
    apps = ["redbook", "sms"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "handoff"]
    parameters = {
        "username": REDBOOK_FOLLOWING_USER_PARAM,
        "contact": {
            "type": "enum",
            "values": {"张三": "张三", "李四": "李四", "王五": "王五"},
            "default": "张三",
        },
    }
    expected_changes = SMS_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        sms = sms_from_input(input)
        count = rb.followed_user_note_count(self.p.username)
        return [
            sms.check_new_sent_contains_number(
                self.p.contact,
                count,
                field="redbook_note_count",
            )
        ]
class SpotifySongFullDetailsToRedbook(BaseTask):
    templates = ["在Spotify搜'{song}'查下是谁唱的、几分钟，在小红书发一篇听歌笔记把这些写进去"]
    apps = ["spotify", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "extract", "create", "handoff"]
    parameters = {"song": {"type": "enum", "values": {"搁浅": "搁浅", "修炼爱情": "修炼爱情"}, "default": "搁浅"}}
    expected_changes = REDBOOK_PUBLISH_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps["spotify"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        track = spotify.track_by_title(self.p.song)
        artist = str(track["artist"])
        artist_simp = to_simplified(artist)
        duration = str(track["duration"])
        return [
            rb.check_note_published(
                content_pred=lambda content: (
                    artist_simp in to_simplified(str(content))
                    and match_track_duration(duration, str(content))
                ),
                field="song_full_details",
            )
        ]
class BilibiliTripleLikeThenMoments(BaseTask):
    templates = [
        "在B站{partition}排行榜找到第{rank}名给它一键三连，然后发个纯文字朋友圈推荐这个视频",
        "Find the #{rank} video on Bilibili's {partition} ranking, give it a triple-like (like + coin + favorite), then post a Moments with pure texts to recommend it",
    ]
    apps = ["bilibili", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["social", "create", "handoff"]
    parameters = {"partition": BILIBILI_PARTITION_PARAM, "rank": {"type": "int", "default": 1}}
    expected_changes = WECHAT_MOMENT_CHANGES + ["apps.bilibili.activeVideoId", "apps.bilibili.user"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        bili = Bilibili(input.apps["bilibili"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        entry = Bilibili.ranking_entry(self.p.partition, int(self.p.rank))
        title = str(entry["title"])
        bvid = str(entry["id"])
        return [
            bili.check_liked_bvid(bvid, video_title=title, field="liked"),
            bili.check_coined_bvid(bvid, video_title=title, field="coined"),
            bili.check_favored_bvid(bvid, video_title=title, field="favored"),
            wechat.check_new_moment_contains(title, field="moment_share"),
            wechat.check_new_moment_no_images(),
        ]
class RedbookDmThenWechatReport(BaseTask):
    templates = ["给小红书上我关注的'{username}'发私信'{message}'，然后在微信告诉{contact}已经联系他了"]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["social", "handoff"]
    parameters = {
        "username": REDBOOK_FOLLOWING_USER_PARAM,
        "message": {"type": "string", "default": "你好呀"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["redbook.chats"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        return [
            rb.check_chat_sent_to(self.p.username, self.p.message, field="redbook_dm"),
            wechat.check_new_sent_any_of(
                self.p.contact,
                ["已经联系", "已联系", "联系过", "已经私信", "已私信"],
                self.p.username,
                field="wechat_report",
            ),
        ]
class NotesContentToRedbookAndX(BaseTask):
    templates = [
        "在笔记里写一段关于{topic}的想法，然后分别在小红书和X上发布出来",
        "Write some thoughts about {topic} in Notes, then post them on both RedNote and X",
    ]
    apps = ["notes", "redbook", "x"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["create", "handoff"]
    parameters = {"topic": {"type": "string", "default": "AI代理"}}
    expected_changes = NOTES_CREATE_CHANGES + REDBOOK_PUBLISH_CHANGES + X_POST_CHANGES + ["os.clipboard"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        x_app = X(input.apps["x"], init=input.apps_init["x"])
        latest = notes.latest_note
        if latest is None:
            raise ValueError("任务设计错误：notes.latest_note 为空。")
        content = str(latest.get("content") or "")
        return [
            notes.check_latest_contains(self.p.topic, field="notes_content"),
            rb.check_note_published(content_pred=lambda text: content and content in str(text), field="redbook_sync"),
            x_app.check_new_post_contains(content, field="x_sync"),
        ]


class DailyLogToMoments(BaseTask):
    templates = [
        "把我笔记里最新两条笔记简单汇总一下，发一条朋友圈。",
        "Summarize the two most recent notes in my Notes app and post a WeChat Moments update about them.",
    ]
    apps = ["notes", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "social", "handoff"]
    parameters = {}
    expected_changes = WECHAT_MOMENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        latest_notes = notes.latest_n_notes(2)
        if len(latest_notes) < 2:
            raise ValueError("Insufficient notes: need at least 2 notes for DailyLogToMoments task")
        title1 = str(latest_notes[0].get("title") or latest_notes[0].get("content") or "").strip()
        title2 = str(latest_notes[1].get("title") or latest_notes[1].get("content") or "").strip()
        return [wechat.check_new_moment_contains(title1, title2, field="daily_log")]


class CulturalChecklistToRedbook(BaseTask):
    templates = ["看看Spotify我今天最早听的那首歌是什么，再看看微信读书热搜第一本书叫什么，在笔记里记一份'今日文化清单'，然后在小红书发一篇笔记分享"]
    apps = ["spotify", "wechat_reading", "notes", "redbook"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "handoff"]
    parameters = {}
    expected_changes = NOTES_CREATE_CHANGES + REDBOOK_PUBLISH_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify_init = Spotify(input.apps_init["spotify"])
        wr_init = WechatReading(input.apps_init["wechat_reading"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        # 这里的“今天最早听的那首歌”同样采用最近播放页可见顺序的近似判定。
        song = str(spotify_init.nth_today_play(1)["title"])
        book = wr_init.first_hot_search_title()
        return [
            notes.check_latest_contains(song, book, field="cultural_note"),
            rb.check_note_published(
                content_keywords=(song, book),
                field="cultural_redbook",
            ),
        ]


class EbayCheapToRedbook(BaseTask):
    templates = ["帮我在 eBay 看看{product}里最便宜的那款，然后发一篇小红书商品推荐笔记。"]
    apps = ["ebay", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "create", "handoff"]
    parameters = {"product": EBAY_SEARCH_QUERY_PARAM}
    expected_changes = EBAY_SEARCH_CHANGES + REDBOOK_PUBLISH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        top = ebay.cheapest_product(query=self.p.product)
        snapshot = ebay.find_latest_snapshot(query=self.p.product, sort_option="priceLow")

        return [
            {
                "field": "ebay_search",
                "expected": f"{self.p.product}/priceLow",
                "actual": snapshot,
                "passed": snapshot is not None,
            },
            rb.check_note_published(
                text_keywords=(str(top.title),),
                field="product_recommendation",
            ),
        ]


class SpotifySaveCurrentSongToNotes(BaseTask):
    templates = [
        "把 Spotify 正在播放的歌名和歌手记到笔记里",
        "Write down the song name and artist of what's currently playing on Spotify into Notes",
    ]
    apps = ["spotify", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["extract", "create", "handoff"]
    expected_changes = NOTES_CREATE_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps_init["spotify"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        track = spotify.current_track
        return [notes.check_latest_contains(track["title"], track["artist"])]
class WechatReadingShareBookList(BaseTask):
    templates = [
        "把微信读书书架前{n}本书的名字微信发给{contact}",
        "Send the names of the first {n} books on my WeChat Reading bookshelf to {contact}",
    ]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "handoff", "reasoning"]
    parameters = {
        "n": {"type": "int", "default": 3},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reading = WechatReading(input.apps["wechat_reading"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        titles = [
            str(reading.require_store_book(str(item["bookId"]))["title"])
            for item in reading.shelf[: int(self.p.n)]
        ]
        actual = wechat.joined_new_texts_to(self.p.contact)
        return [
            {
                "field": "sent_book_list",
                "expected": titles,
                "actual": actual or "(none)",
                "passed": bool(actual) and count_titles_in_text(actual, titles) == len(titles),
            }
        ]
class ReadingPlanToNotes(BaseTask):
    """
    新增笔记包含正在读的书即可
    """
    templates = [
        "看看微信读书里我正在读的书，然后在笔记里制定一个本周的阅读计划。",
        "Check what books I'm currently reading on WeChat Reading, then create a weekly reading plan in Notes.",
    ]
    apps = ["wechat_reading", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "handoff"]
    parameters = {}
    expected_changes = NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        target_books = set(wr.reading_book_titles())
        if not target_books:
            raise ValueError("No books found in WechatReading")
        note = notes.latest_note
        if not note:
            return [{"field": "plan_note", "expected": "Create note", "actual": "No notes", "passed": False}]
        content = f'{note.get("title", "")} {note.get("content", "")}'.lower()
        passed_plan = "计划" in content or "plan" in content
        missing_books = [book for book in target_books if book.lower() not in content]
        passed_books = len(missing_books) == 0
        actual_info = content
        if missing_books:
            actual_info = f"Missing: {', '.join(missing_books)}. Content: {content[:50]}..."
        return [
            {
                "field": "plan_note",
                "expected": f"Note with '计划' and books: {', '.join(target_books)}",
                "actual": actual_info,
                "passed": passed_books and passed_plan,
            }
        ]
class FileManagerSendFileToWechatContact(BaseTask):
    """
        两个文件名副本分别是：
    - /sdcard/Download/downloaded_image.jpg
    - /sdcard/Pictures/downloaded_image_copy.jpg
    """
    templates = [
        "我有一张图片分别在两个目录下各有一张不同名的副本，帮我找出他们，并把这两个文件名发给微信联系人{contact}",
        "I have two copies of the same image with different filenames in two different directories, and send both filenames to WeChat contact {contact}",
    ]
    apps = ["file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "social", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        # 使用完整文件名（含扩展名），避免 "downloaded_image" 是 "downloaded_image_copy.jpg" 子串的误判
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                "downloaded_image.jpg",
                "downloaded_image_copy.jpg",
                field="wechat_file_names",
            ),
        ]


class NotesToWechatAndRedbook(BaseTask):
    templates = ['把包含"{text_keyword}"的内容记到笔记后，再用微信同步发给{contact}，并发布一条对应的小红书笔记。']
    apps = ["notes", "wechat", "redbook"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "social", "handoff"]
    parameters = {
        "text_keyword": {"type": "string", "default": "今天心情很好"},
        "contact": {"type": "string", "default": "王芳", "source": "apps.wechat.contacts[name]"},
    }
    expected_changes = NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES + REDBOOK_PUBLISH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        xn = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        has_note = any(
            str(self.p.text_keyword) in (str(n.get("title") or "") + str(n.get("content") or ""))
            for n in xn.notes
        )
        init_has_note = any(
            str(self.p.text_keyword) in (str(n.get("title") or "") + str(n.get("content") or ""))
            for n in xn.init.notes
        )
        message_check = wechat.check_new_sent_to(self.p.contact, str(self.p.text_keyword), field="wechat")
        return [
            {
                "field": "notes",
                "expected": self.p.text_keyword,
                "actual": "已写入" if has_note else "未写入",
                "passed": has_note and not init_has_note,
            },
            message_check,
            rb.check_note_published(
                text_keywords=(str(self.p.text_keyword),),
                new_only=True,
                allow_draft=True,
                field="redbook",
            ),
        ]
