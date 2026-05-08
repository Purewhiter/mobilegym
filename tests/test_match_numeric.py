"""Tests for _match_numeric — the core AnswerTask numeric comparison logic."""

from bench_env.task.common_tasks import _match_numeric


class TestFalsePositivePrevention:
    """The original bug: expected=5 matched '5' inside '25'."""

    def test_no_substring_in_25(self):
        assert _match_numeric(5, "25个联系人") is False

    def test_no_substring_in_150(self):
        assert _match_numeric(5, "150条消息") is False

    def test_no_substring_in_bare_number(self):
        assert _match_numeric(5, "25") is False
        assert _match_numeric(2, "25") is False

    def test_no_12_in_2012(self):
        assert _match_numeric(12, "2012年") is False


class TestExactIntegerMatch:

    def test_standalone(self):
        assert _match_numeric(5, "5") is True

    def test_in_chinese(self):
        assert _match_numeric(5, "共5个好友") is True

    def test_large_number(self):
        assert _match_numeric(100, "共100条") is True

    def test_zero(self):
        assert _match_numeric(0, "没有找到，0条") is True

    def test_year(self):
        assert _match_numeric(2012, "2012年") is True

    def test_full_match(self):
        assert _match_numeric(25, "25") is True


class TestDecimalSupport:
    """Old code used r'\\d+' which couldn't match decimals at all."""

    def test_decimal_in_chinese(self):
        assert _match_numeric(4.5, "评分4.5分") is True

    def test_decimal_at_end(self):
        assert _match_numeric(4.5, "评分是4.5") is True

    def test_trailing_zero(self):
        assert _match_numeric(35.5, "票价35.50元") is True

    def test_integer_should_not_match_decimal(self):
        assert _match_numeric(4, "评分4.5分") is False


class TestNegativeNumbers:

    def test_negative_match(self):
        assert _match_numeric(-3, "温差-3度") is True

    def test_positive_should_not_match_negative(self):
        assert _match_numeric(3, "温差-3度") is False


class TestMultipleNumbers:

    def test_match_second_number(self):
        assert _match_numeric(5, "我找到了25个联系人，包含5个女性朋友") is True

    def test_no_match_among_multiple(self):
        assert _match_numeric(7, "我找到了25个联系人，包含5个女性朋友") is False


class TestEdgeCases:

    def test_empty_string(self):
        assert _match_numeric(5, "") is False

    def test_no_numbers_in_text(self):
        assert _match_numeric(5, "没有数字") is False

    def test_float_tolerance(self):
        assert _match_numeric(0.1 + 0.2, "结果是0.3") is True
