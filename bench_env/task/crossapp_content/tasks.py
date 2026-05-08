"""
Cross-app Content & Social tasks.
"""
# -- Task Index (auto-generated, do not edit) --
# 39 tasks | L2×5  L3×14  L4×20
#
# [L2] SpotifyNowPlayingToWechat            把 Spotify 当前播放的歌加入喜欢，再把歌名微信发给{contact}
# [L2] BilibiliRankingToWechat              看看B站{partition}区排行榜第{rank}名是什么视频，把标题微信发给{contact}
# [L2] RedbookSearchTitleToWechat           在小红书搜'{keyword}'，把第一篇笔记的标题微信发给{contact}
# [L2] SmsContentForwardToWechat            把{sender}最新发来的短信内容在微信发给{contact}
# [L3] SpotifyTodayNthPlayToRedbook         查看我今天在 Spotify 听的第{nth}首歌，在小红书发一篇推荐笔记，标题或正文包含歌名和艺人
# [L3] BilibiliSearchUpFollowersToSms       在B站搜UP主{up_name}，查一下粉丝数，发短信给{phone}告知
# [L3] WechatReadingBestBookToWechat        帮我在微信读书{category}分类下找推荐值最高的书，把书名和推荐值微信发给{contact}
# [L3] WechatReadingCompareToWechat         在微信读书比较《{book1}》和《{book2}》哪本评分高，把更好的那本推荐给{contact}
# [L3] WechatReadingStatsToWechat           查微信读书最近一周内阅读时长最多的一天是哪天读了多久，告诉微信好友{contact}
# [L3] RedbookAuthorFollowersToWechat       在小红书搜'{keyword}'，关注第一篇笔记的作者，并将作者名字和粉丝数微信发给{contact}
# [L4] XLatestPostToReddit_WithTitleFormat  把 X 用户 {user} 最新一条推文的文字内容，以"{user}:"开头发到 Reddit 的 r/{subreddit}。
# [L3] RedbookFollowingNoteCountToSms       查小红书我关注的'{username}'发了多少篇笔记，发短信告诉{contact}
# [L3] SpotifySongToWechatAndNotes          在Spotify搜{artist}，把搜索结果第一首歌名微信发给{contact}，再写到笔记里
# [L3] WechatReadingBestToNotesAndWechat    帮我在微信读书找{category}分类下推荐值最高的书，在笔记记下书名和推荐值，推荐给微信好友{contact}
# [L3] BilibiliRankingToRedbookAndX         看看B站{partition}区排行第一名是什么视频，在小红书发一篇推荐，再在X上也发一条推文分享
# [L4] SpotifySongFullDetailsToRedbook      在Spotify搜'{song}'查下是谁唱的、几分钟，在小红书发一篇听歌笔记把这些写进去
# [L4] WechatReadingCompareBooksToRedbook   在微信读书比较《{book1}》和《{book2}》的推荐值，在小红书发一篇笔记介绍推荐值更高的那本书的书名、推荐值和字数
# [L4] BilibiliTripleLikeThenMoments        在B站{partition}排行榜找到第{rank}名给它一键三连，然后发个纯文字朋友圈推荐这个视频
# [L4] RedbookFavoriteThenMoments           在小红书搜'{keyword}'收藏第一篇笔记，然后发朋友圈分享这篇笔记的标题
# [L4] SpotifyNowPlayingToMoments           把 Spotify 正在播放的歌名和歌手发一条微信朋友圈，文案里带上{mood}
# [L4] RedbookDmThenWechatReport            给小红书上我关注的'{username}'发私信'{message}'，然后在微信告诉{contact}已经联系他了
# [L4] SpotifyToRedbookToWechat             在Spotify搜{artist}，把搜索结果第一首歌在小红书发一篇推荐笔记，再把歌名发给微信好友{contact}
# [L4] WechatReadingNotesWechatPlan         在微信读书搜'{book}'，查看它的推荐值，在笔记里写一条包含书名和推荐值的读书计划，然后把这本书推荐给{contact}
# [L4] BilibiliUpToSpotifyConditional       看B站{partition}排行榜第一名视频的UP主是谁，在Spotify搜这个UP主有没有歌，有就把搜索结果第一首歌名在微信发给{contact}，没有就告诉TA没找到
# [L4] NotesContentToRedbookAndX            在笔记里写一段关于{topic}的想法，然后分别在小红书和X上发布出来
# [L4] DailyLogToMoments                    把我笔记里最新两条笔记简单汇总一下，发一条朋友圈。
# [L4] CulturalChecklistToRedbook           看看Spotify我今天最早听的那首歌是什么，再看看微信读书热搜第一本书叫什么，在笔记里记一份'今日文化清单'，然后在小红书发一篇笔记分享
# [L4] EbayCheapToRedbook                   帮我在 eBay 看看{product}里最便宜的那款，然后发一篇小红书商品推荐笔记。
# [L2] SpotifySaveCurrentSongToNotes        把 Spotify 正在播放的歌名和歌手记到笔记里
# [L3] SpotifyShareSearchResults            在Spotify搜{keyword}，把歌曲搜索结果里前{n}个歌名微信发给{contact}
# [L3] WechatReadingShareBookList           把微信读书书架前{n}本书的名字微信发给{contact}
# [L3] WechatReadingAddShelfShare           把微信读书的《{book}》加入书架，再把书名微信发给{contact}
# [L3] ReadingPlanToNotes                   看看微信读书里我正在读的书，然后在笔记里制定一个本周的阅读计划。
# [L4] NotesBestToRedbook                   在笔记里找到带"{keyword}"的那条笔记，把它发到小红书。
# [L4] RedbookResearchToNotes               在小红书搜索{keyword}，把点赞最多的前{n}篇笔记的标题整理记到备忘录里。
# [L4] RedbookCommentAndShare               在小红书搜{keyword}，给第一篇笔记评论"{comment}"，再把标题微信发给{contact}
# [L4] RedbookPopularityCheckToWechat       在小红书搜{keyword}，看看第一篇笔记有多少赞——超过{threshold}个就把标题和赞数微信发给{contact}说'值得看'，没超过就发'热度一般'
# [L4] FileManagerSendFileToWechatContact   找出同一张图片在两个目录下的两份不同文件名副本，并把这两个文件名分别发给微信联系人{contact}
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
    capabilities = ["query", "social", "transfer"]
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
    capabilities = ["query", "transfer"]
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
    capabilities = ["search", "query", "transfer"]
    parameters = {"keyword": REDBOOK_KEYWORD_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES + ["redbook.history"]

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


class SmsContentForwardToWechat(BaseTask):
    templates = [
        "把{sender}最新发来的短信内容在微信发给{contact}",
        "Forward the latest SMS from {sender} to WeChat contact {contact}",
    ]
    apps = ["sms", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["query", "transfer"]
    parameters = {
        "sender": {
            "type": "enum",
            "values": {"中国联通": "中国联通", "中国电信": "中国电信", "华为云": "华为云"},
            "default": "中国联通",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["os.providers.sms.conversations"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        content = sms.latest_incoming_content_from(self.p.sender)
        return [wechat.check_new_sent_contains(self.p.contact, content, field="sms_forward")]


class SpotifyTodayNthPlayToRedbook(BaseTask):
    templates = [
        "查看我今天在 Spotify 听的第{nth}首歌，在小红书发一篇推荐笔记，标题或正文包含歌名和艺人",
    ]
    apps = ["spotify", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "create", "transfer"]
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


class BilibiliSearchUpFollowersToSms(BaseTask):
    templates = ["在B站搜UP主{up_name}，查一下粉丝数，发短信给{phone}告知"]
    apps = ["bilibili", "sms"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "query", "transfer"]
    parameters = {
        "up_name": {
            "type": "enum",
            "values": {"流光视界": "流光视界", "小白工坊志": "小白工坊志"},
            "default": "流光视界",
        },
        "phone": {
            "type": "enum",
            "values": {"张三": "张三", "李四": "李四", "王五": "王五"},
            "default": "张三",
        },
    }
    expected_changes = SMS_SEND_CHANGES + ["apps.bilibili.user.searchHistory"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        followers = Bilibili.author_follower_display(self.p.up_name)
        return [sms.check_new_sent_to(self.p.phone, followers, field="sms_bili_followers")]


class WechatReadingBestBookToWechat(BaseTask):
    templates = ["帮我在微信读书{category}分类下找推荐值最高的书，把书名和推荐值微信发给{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "query", "transfer"]
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


class WechatReadingCompareToWechat(BaseTask):
    templates = ["在微信读书比较《{book1}》和《{book2}》哪本评分高，把更好的那本推荐给{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "reasoning", "transfer"]
    parameters = {
        "book1": WECHAT_READING_BOOK_PARAM,
        "book2": {
            "type": "enum",
            "values": {"理想国": "理想国"},
            "default": "理想国",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        winner = wr.higher_rated_book(self.p.book1, self.p.book2)
        return [wechat.check_new_sent_contains(self.p.contact, str(winner["title"]), field="higher_rated_book")]


class WechatReadingStatsToWechat(BaseTask):
    templates = ["查微信读书最近一周内阅读时长最多的一天是哪天读了多久，告诉微信好友{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "transfer"]
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
    capabilities = ["search", "query", "social", "transfer"]
    parameters = {"keyword": REDBOOK_KEYWORD_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = [
        "redbook.user.followings",
        "redbook.user.following",
        "redbook.entities",
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
    capabilities = ["query", "create", "social", "transfer"]
    parameters = {
        "user": {"type": "string", "default": "elonmusk"},
        "subreddit": {
            "type": "enum",
            "values": {"China_irl": "China_irl", "Games": "Games", "Music": "Music", "OtherSide": "OtherSide"},
            "default": "China_irl",
        },
    }
    expected_changes = [
        "reddit.userCommentsByPostId", "reddit.createDraft",
        "reddit.posts", "reddit.userPosts", "reddit.postVotes",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        x_app = X(input.apps_init["x"])
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])

        # 1) 从 X 找到该用户最新推文内容
        user_lower = self.p.user.lower().lstrip("@")
        tweet_content = ""
        for post in x_app.posts:
            aid = str(post.get("authorId") or "").lower()
            # authorId 格式为 "u_elonmusk"，去掉 "u_" 前缀比较
            if aid.removeprefix("u_") == user_lower or user_lower in aid:
                tweet_content = str(post.get("content") or "").strip()
                break

        # 2) 从 Reddit 找用户新发布的内容，验证包含 "{user}:" 前缀和推文内容
        prefix = self.p.user.strip() + ":"
        return [
            reddit.check_new_post_or_comment_contains(
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
    capabilities = ["query", "transfer"]
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


class SpotifySongToWechatAndNotes(BaseTask):
    templates = [
        "在Spotify搜{artist}，把搜索结果第一首歌名微信发给{contact}，再写到笔记里",
        "Search for {artist} on Spotify, send the first song's title to {contact} on WeChat, and also write it in Notes",
    ]
    apps = ["spotify", "wechat", "notes"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "create", "transfer"]
    parameters = {"artist": SPOTIFY_ARTIST_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = ["spotify.searchHistory"] + WECHAT_SEND_CHANGES + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        results = spotify.resolve_search_results(self.p.artist, limit=1)
        if not results:
            _skip = f"no search result for {self.p.artist}"
            return [
                {"field": "wechat_song", "expected": "song title", "actual": _skip, "passed": False},
                {"field": "notes_song", "expected": "song title", "actual": _skip, "passed": False},
            ]
        track_title = str(results[0]["title"])
        return [
            wechat.check_new_sent_contains(self.p.contact, track_title, field="wechat_song"),
            notes.check_latest_contains(track_title, field="notes_song"),
        ]


class WechatReadingBestToNotesAndWechat(BaseTask):
    templates = [
        "帮我在微信读书找{category}分类下推荐值最高的书，在笔记记下书名和推荐值，推荐给微信好友{contact}",
        "Find the highest-rated book in the {category} category on WeChat Reading, write the title and recommendation score in Notes, then recommend it to {contact} on WeChat",
    ]
    apps = ["wechat_reading", "notes", "wechat"]
    scope = "S3"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "query", "create", "transfer"]
    parameters = {"category": WECHAT_READING_CATEGORY_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        data_cats = WECHAT_READING_UI_TO_DATA.get(self.p.category, [self.p.category])
        books = [b for b in wr.store if str(b.get("category")) in data_cats]
        if not books:
            raise ValueError(f"No books in UI category '{self.p.category}'")
        books.sort(key=lambda b: float(b.get("rating") or 0), reverse=True)
        book = books[0]
        rv = str(book.get("recommendedValue", ""))
        return [
            notes.check_latest_contains(str(book["title"]), rv, field="best_book_note"),
            wechat.check_new_sent_contains(self.p.contact, str(book["title"]), field="best_book_wechat"),
        ]


class BilibiliRankingToRedbookAndX(BaseTask):
    templates = [
        "看看B站{partition}区排行第一名是什么视频，在小红书发一篇推荐，再在X上也发一条推文分享",
        "Check what the #1 video is in Bilibili's {partition} ranking, post a recommendation on RedNote, and also share it as a tweet on X",
    ]
    apps = ["bilibili", "redbook", "x"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "create", "transfer"]
    parameters = {"partition": BILIBILI_PARTITION_PARAM}
    expected_changes = REDBOOK_PUBLISH_CHANGES + X_POST_CHANGES + ["apps.bilibili.activeVideoId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        title = Bilibili.ranking_title(self.p.partition, 1)
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        x_app = X(input.apps["x"], init=input.apps_init["x"])
        return [
            rb.check_note_published(
                content_keywords=(title,),
                field="redbook_post",
            ),
            x_app.check_new_post_contains(title, field="x_post"),
        ]


class SpotifySongFullDetailsToRedbook(BaseTask):
    templates = ["在Spotify搜'{song}'查下是谁唱的、几分钟，在小红书发一篇听歌笔记把这些写进去"]
    apps = ["spotify", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "query", "create", "transfer"]
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


class WechatReadingCompareBooksToRedbook(BaseTask):
    templates = ["在微信读书比较《{book1}》和《{book2}》的推荐值，在小红书发一篇笔记介绍推荐值更高的那本书的书名、推荐值和字数"]
    apps = ["wechat_reading", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "create"]
    parameters = {
        "book1": {"type": "enum", "values": {"纳瓦尔宝典": "纳瓦尔宝典", "中国通史": "中国通史"}, "default": "纳瓦尔宝典"},
        "book2": {"type": "enum", "values": {"原则": "原则", "明朝那些事儿": "明朝那些事儿"}, "default": "原则"},
    }
    expected_changes = REDBOOK_PUBLISH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        winner = wr.higher_recommended_book(self.p.book1, self.p.book2)
        title = str(winner["title"])
        rv = str(winner["recommendedValue"])
        raw_words = str(int(winner["totalWords"]))
        words = format_words(int(winner["totalWords"]))
        return [
            rb.check_note_published(
                content_keywords=(title, rv),
                content_pred=lambda content, _w=words, _raw=raw_words: (
                    _w in str(content) or _raw in str(content)
                ),
                field="redbook_compare_books",
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
    capabilities = ["social", "create", "transfer"]
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
            wechat.check_new_moment_with(title, field="moment_share"),
            wechat.check_new_moment_no_images(),
        ]


class RedbookFavoriteThenMoments(BaseTask):
    templates = [
        "在小红书搜'{keyword}'收藏第一篇笔记，然后发朋友圈分享这篇笔记的标题",
        "Search '{keyword}' on RedNote, favorite the first note, then post its title in a WeChat Moments update",
    ]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "social", "create"]
    parameters = {"keyword": REDBOOK_KEYWORD_PARAM}
    expected_changes = WECHAT_MOMENT_CHANGES + ["redbook.user", "redbook.entities", "redbook.history"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        note = rb.first_search_note(self.p.keyword)
        return [
            rb.check_note_collected(str(note["id"]), field="note_collected"),
            wechat.check_new_moment_contains(
                str(note["title"]),
                field="moment_share",
            ),
        ]


class SpotifyNowPlayingToMoments(BaseTask):
    templates = [
        "把 Spotify 正在播放的歌名和歌手发一条微信朋友圈，文案里带上{mood}",
        "Post a WeChat Moments update with the song name and artist currently playing on Spotify, and include {mood} in the caption",
    ]
    apps = ["spotify", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "create", "transfer"]
    parameters = {
        "mood": {
            "type": "enum",
            "values": {
                "好听到循环": "好听到循环",
                "今日单曲循环": "今日单曲循环",
                "宝藏歌曲推荐": "宝藏歌曲推荐",
            },
            "default": "好听到循环",
        },
    }
    expected_changes = WECHAT_MOMENT_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify_init = Spotify(input.apps_init["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        track = spotify_init.current_track
        if not track:
            raise ValueError("任务设计错误：spotify.currentTrack 为空。")
        return [
            wechat.check_new_moment_contains(
                str(track["title"]),
                str(track["artist"]),
                str(self.p.mood),
                field="spotify_moment",
            ),
            wechat.check_new_moment_no_images(),
        ]


class RedbookDmThenWechatReport(BaseTask):
    templates = ["给小红书上我关注的'{username}'发私信'{message}'，然后在微信告诉{contact}已经联系他了"]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social", "transfer"]
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


class SpotifyToRedbookToWechat(BaseTask):
    templates = ["在Spotify搜{artist}，把搜索结果第一首歌在小红书发一篇推荐笔记，再把歌名发给微信好友{contact}"]
    apps = ["spotify", "redbook", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "create", "transfer"]
    parameters = {"artist": SPOTIFY_ARTIST_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = REDBOOK_PUBLISH_CHANGES + WECHAT_SEND_CHANGES + ["spotify.searchHistory"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps["spotify"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        results = spotify.resolve_search_results(self.p.artist, limit=1)
        if not results:
            _skip = f"no search result for {self.p.artist}"
            return [
                {"field": "redbook_song", "expected": "song title", "actual": _skip, "passed": False},
                {"field": "wechat_song", "expected": "song title", "actual": _skip, "passed": False},
            ]
        track_title = str(results[0]["title"])
        return [
            rb.check_note_published(
                content_keywords=(track_title,),
                field="redbook_song",
            ),
            wechat.check_new_sent_contains(self.p.contact, track_title, field="wechat_song"),
        ]


class WechatReadingNotesWechatPlan(BaseTask):
    templates = ["在微信读书搜'{book}'，查看它的推荐值，在笔记里写一条包含书名和推荐值的读书计划，然后把这本书推荐给{contact}"]
    apps = ["wechat_reading", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "query", "create", "transfer"]
    parameters = {"book": WECHAT_READING_BOOK_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wr = WechatReading(input.apps["wechat_reading"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        book = wr.require_book_by_title(self.p.book)
        rv = str(book.get("recommendedValue", ""))
        return [
            notes.check_latest_contains(str(book["title"]), rv, field="reading_plan"),
            wechat.check_new_sent_contains(self.p.contact, str(book["title"]), field="wechat_book"),
        ]


class BilibiliUpToSpotifyConditional(BaseTask):
    templates = ["看B站{partition}排行榜第一名视频的UP主是谁，在Spotify搜这个UP主有没有歌，有就把搜索结果第一首歌名在微信发给{contact}，没有就告诉TA没找到"]
    apps = ["bilibili", "spotify", "wechat"]
    scope = "S3"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "transfer"]
    parameters = {"partition": BILIBILI_PARTITION_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = WECHAT_SEND_CHANGES + ["apps.bilibili.activeVideoId", "spotify.searchHistory"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        keyword = Bilibili.ranking_creator_keyword(self.p.partition, 1)
        results = spotify.resolve_search_results(keyword, limit=1)
        matched = [t for t in results if norm(str(t["artist"])) == norm(keyword)]
        if matched:
            track_title = str(matched[0]["title"])
            if track_title:
                return [wechat.check_new_sent_contains(self.p.contact, track_title, field="conditional_song")]
        return [
            wechat.check_new_sent_any_of(
                self.p.contact,
                ["没找到", "没有找到", "未找到", "搜不到"],
                field="conditional_no_result",
            )
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
    capabilities = ["create", "transfer"]
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
    capabilities = ["query", "reasoning", "social", "transfer"]
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
    capabilities = ["query", "create", "transfer"]
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
    capabilities = ["search", "create", "transfer"]
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
    capabilities = ["query", "create", "transfer"]
    expected_changes = NOTES_CREATE_CHANGES + ["apps.spotify"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps_init["spotify"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        track = spotify.current_track
        return [notes.check_latest_contains(track["title"], track["artist"])]


class SpotifyShareSearchResults(BaseTask):
    templates = [
        "在Spotify搜{keyword}，把歌曲搜索结果里前{n}个歌名微信发给{contact}",
        "Search for {keyword} on Spotify, then send the first {n} song titles in search results to {contact} on WeChat",
    ]
    apps = ["spotify", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "transfer"]
    parameters = {
        "keyword": {"type": "string", "default": "周杰伦"},
        "n": {"type": "int", "default": 3},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["spotify.searchHistory"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        spotify = Spotify(input.apps["spotify"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        n = int(self.p.n)
        results = spotify.resolve_search_results(self.p.keyword, limit=n)
        matched = [str(t["title"]) for t in results[:n]] if results else []
        actual = wechat.joined_new_texts_to(self.p.contact)
        return [
            {
                "field": "sent_search_results",
                "expected": matched,
                "actual": actual or "(none)",
                "passed": bool(actual) and bool(matched) and count_titles_in_text(actual, matched) == len(matched),
            }
        ]


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
    capabilities = ["query", "transfer", "reasoning"]
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


class WechatReadingAddShelfShare(BaseTask):
    templates = ["把微信读书的《{book}》加入书架，再把书名微信发给{contact}"]
    apps = ["wechat_reading", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "edit", "transfer"]
    parameters = {
        "book": {
            "type": "string",
            "default": "三体",
            "sampler": WechatReading.sample_book_title_not_on_shelf,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = ["wechat_reading.shelf", "wechat_reading.bookProgress", "wechat_reading.allProgressBookIds", "wechat_reading.readingBookIds", "wechat.chats"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reading = WechatReading(input.apps["wechat_reading"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        book = reading.require_book_by_title(self.p.book)
        on_shelf = reading.is_book_on_shelf(str(book["id"]))
        return [
            {
                "field": "book_on_shelf",
                "expected": f"《{self.p.book}》on shelf",
                "actual": "on shelf" if on_shelf else "not on shelf",
                "passed": on_shelf,
            },
            wechat.check_new_sent_to(self.p.contact, self.p.book, field="share"),
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
    capabilities = ["query", "create", "transfer"]
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


class NotesBestToRedbook(BaseTask):
    templates = [
        '在笔记里找到带"{keyword}"的那条笔记，把它发到小红书。',
        'Find the note containing "{keyword}" in Notes, then post it on RedNote.',
    ]
    apps = ["notes", "redbook"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["create", "transfer"]
    parameters = {"keyword": {"type": "enum", "values": {"购物清单": "购物清单", "杭州旅行": "杭州旅行", "租房待办": "租房待办", "阅读摘抄": "阅读摘抄"}, "default": "购物清单"}}
    expected_changes = REDBOOK_PUBLISH_CHANGES + ["os.clipboard"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps_init["notes"])
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        target = notes.find_note_with_keywords([self.p.keyword])
        if not target:
            raise ValueError(f"No note containing '{self.p.keyword}' found in Notes")
        expected_title = str(target.get("title") or "")
        expected_content = str(target.get("content") or "")
        check_text = expected_content if expected_content else expected_title
        lines = [ln.strip() for ln in check_text.splitlines() if ln.strip()]
        return [
            rb.check_note_published(
                content_lines=tuple(lines),
                new_only=True,
                allow_draft=True,
                field="post_best",
            )
        ]


class RedbookResearchToNotes(BaseTask):
    templates = [
        "在小红书搜索{keyword}，把点赞最多的前{n}篇笔记的标题整理记到备忘录里。",
        "Search for {keyword} on RedNote, then write the titles of the top {n} most-liked notes into Notes.",
    ]
    apps = ["redbook", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "create", "transfer"]
    parameters = {
        "keyword": {"type": "string", "default": "OOTD"},
        "n": {"type": "int", "default": 2},
    }
    expected_changes = NOTES_CREATE_CHANGES + ["redbook.history"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rb = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        targets = [
            str(note.get("title") or "")
            for note in rb.sorted_search_notes(self.p.keyword, "likes")[: self.p.n]
            if str(note.get("title") or "")
        ]
        if not targets:
            raise ValueError(f"No notes matching keyword '{self.p.keyword}' found in Redbook")
        return [
            notes.check_latest_norm_contains(*targets, field="research_note")
        ]


class RedbookCommentAndShare(BaseTask):
    templates = [
        '在小红书搜{keyword}，给第一篇笔记评论"{comment}"，再把标题微信发给{contact}',
        'Search for {keyword} on RedNote, comment "{comment}" on the first note, then send the title to {contact}',
    ]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "social", "transfer"]
    parameters = {
        "keyword": {"type": "string", "default": "探店"},
        "comment": {"type": "string", "default": "看起来不错"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = ["redbook.entities", "redbook.user", "redbook.history", "wechat.chats"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        redbook = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        note = redbook.first_search_note(self.p.keyword)
        return [
            redbook.check_note_commented(
                note["id"],
                self.p.comment,
                redbook.user_id,
                field="comment_added",
            ),
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                str(note["title"]),
                field="share",
                last_only=True,
            ),
        ]


class RedbookPopularityCheckToWechat(BaseTask):
    templates = [
        "在小红书搜{keyword}，看看第一篇笔记有多少赞——超过{threshold}个就把标题和赞数微信发给{contact}说'值得看'，没超过就发'热度一般'",
    ]
    apps = ["redbook", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "query", "reasoning", "transfer"]
    parameters = {
        "keyword": {"type": "string", "default": "探店"},
        "threshold": {
            "type": "enum",
            "values": {"50": 50, "100": 100, "200": 200},
            "default": 100,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["redbook.history"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        redbook = Redbook(input.apps["redbook"], init=input.apps_init["redbook"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        note = redbook.first_search_note(self.p.keyword)
        likes_raw = note["likes"]
        likes_num = redbook.count_value(likes_raw)
        threshold = int(self.p.threshold)
        if likes_num >= threshold:
            return [
                wechat.check_new_sent_norm_contains(
                    self.p.contact,
                    str(note["title"]),
                    "值得看",
                    field="popularity_branch",
                )
            ]
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                "热度一般",
                field="popularity_branch",
            )
        ]


class FileManagerSendFileToWechatContact(BaseTask):
    """
        两个文件名副本分别是：
    - /sdcard/Download/downloaded_image.jpg
    - /sdcard/Pictures/downloaded_image_copy.jpg
    """
    templates = [
        "找出同一张图片在两个目录下的两份不同文件名副本，并把这两个文件名分别发给微信联系人{contact}",
        "Find two copies of the same image with different filenames in two different directories, and send both filenames to WeChat contact {contact}",
    ]
    apps = ["file_manager", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["query", "social", "transfer"]
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
    capabilities = ["create", "social", "transfer"]
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
