from __future__ import annotations

from pathlib import Path

from bench_env.task.registry import TaskRegistry


ROOT = Path(__file__).resolve().parents[3]


EXPECTED_RECLASSIFIED_TASKS = {
    "calendar.CreateEventWithAlarmAndConfirm",
    "crossapp_commerce.AlipayThankTopIncomeTransfer",
    "crossapp_commerce.AlipayYearCompareTopExpenseToWechat",
    "crossapp_commerce.BillTypeYearSummaryToWechat",
    "crossapp_commerce.MonthCompareThenExplainToNote",
    "crossapp_commerce.Top3ExpenseSummaryToWechat",
    "crossapp_content.BilibiliRankAuthorLastNovToWechat",
    "crossapp_content.BilibiliRankTop3FolderAndWechat",
    "crossapp_content.FavoriteWaterSceneryPhotos",
    "crossapp_content.RedbookAuthorTopCollectToWechat",
    "crossapp_content.RedbookTopLikedToNotes",
    "crossapp_content.RedbookUserBestWorstToNotes",
    "crossapp_content.RedbookUserTopCollectToWechat",
    "crossapp_content.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist",
    "crossapp_content.WeeklyReadingAndLikedSpotifySongsToMoment",
    "crossapp_life.OpenedFridgeFoodsToMom",
    "crossapp_life.RailwayEarliestGTrainToWechat",
    "crossapp_life.RailwayMyAccountToWechat",
    "crossapp_life.RailwayTomorrowMomBookingToWechat",
    "crossapp_life.RealisticTrip001",
    "crossapp_life.RecommendMenuDishesToXiaozhou",
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
    "crossapp_life.WeatherFirstNonRainyToCalendarAndSms",
    "crossapp_life.WeekendShanghaiTripIfClearAndFree",
    "crossapp_work.CountCurrentLogErrorsToWechat",
    "crossapp_work.CountOpenWorkOrdersFromPhotosToWechat",
    "crossapp_work.InspectionReportToWechat",
    "crossapp_work.OrganizeMeetingMaterialsToWechat",
    "crossapp_work.OrganizePdfReportsToWechat",
    "crossapp_work.OrganizeReimbursementPhotosToWechat",
    "crossapp_work.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms",
    "crossapp_work.SubmitRequestedAttachmentsToBoss",
    "crossapp_work.TencentMeetingKeywordLongestParticipationToNotes",
    "crossapp_work.TencentMeetingLongestPlannedToWechat",
    "file_manager.CleanObsoleteHandoffFiles",
    "file_manager.CreateKeepFolderAndDeleteRawLogs",
    "file_manager.RenameEvidenceFilesByDate",
    "launcher.ChangeWallpaperAndAddWidget",
    "launcher.DesktopAppsToFolder",
    "map.NorthResearchInstituteAnswer",
}


def test_hard_and_derived_tasks_are_reclassified() -> None:
    registry = TaskRegistry()
    suites = set(registry.list_suites(include_generated=False))

    assert "hard" not in suites
    assert "derived" not in suites
    assert "launcher" in suites

    for task_id in EXPECTED_RECLASSIFIED_TASKS:
        registry.get_by_id(task_id)


def test_splits_do_not_reference_hard_or_derived_suites() -> None:
    split_dir = ROOT / "bench_env" / "splits"
    stale_lines: list[str] = []
    for path in sorted(split_dir.glob("*.txt")):
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith(("hard.", "derived.")):
                stale_lines.append(f"{path.relative_to(ROOT)}:{lineno}:{stripped}")

    assert stale_lines == []
