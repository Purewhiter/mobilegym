import logging
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

# Default format
DEFAULT_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
DATE_FORMAT = "%H:%M:%S"

_configured = False
_file_handler_paths: set[str] = set()


def configure_logging(
    level: int = logging.DEBUG,
    format_str: str = DEFAULT_FORMAT,
    date_format: str = DATE_FORMAT,
    quiet: bool = False,
) -> None:
    """
    Configure global logging.
    
    Args:
        level: Logging level (e.g. logging.INFO)
        format_str: Log message format
        date_format: Date format
        quiet: If True, set level to WARNING (overrides level arg)
    """
    global _configured
    if _configured:
        return

    if quiet:
        level = logging.WARNING

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(format_str, datefmt=date_format))
    
    root = logging.getLogger("bench_env")
    root.setLevel(level)
    root.addHandler(handler)
    root.propagate = False  # Don't propagate to root logger if it has other handlers
    
    _configured = True


def add_log_file(log_path: str | Path) -> None:
    """Attach a file handler to bench_env root logger.

    Safe to call multiple times; duplicate paths are ignored.
    """
    p = str(Path(log_path).expanduser().resolve())
    if p in _file_handler_paths:
        return

    root = logging.getLogger("bench_env")
    # Keep format consistent with console output.
    handler = logging.FileHandler(p, encoding="utf-8")
    handler.setFormatter(logging.Formatter(DEFAULT_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(handler)
    _file_handler_paths.add(p)


def get_logger(name: str | None = None) -> logging.Logger:
    """
    Get a logger instance.

    - If `name` is None/empty: returns `bench_env` logger.
    - If `name` is provided: uses it as-is (typically pass `__name__`).
    """
    if not name:
        return logging.getLogger("bench_env")
    return logging.getLogger(name)


class TqdmLoggingHandler(logging.StreamHandler):
    """StreamHandler that routes output through tqdm.write().

    This prevents log messages from corrupting the tqdm progress bar.
    tqdm.write() clears the current bar line, prints the message,
    then redraws the bar — so both coexist cleanly.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            from tqdm import tqdm
            msg = self.format(record)
            tqdm.write(msg, file=self.stream)
            self.flush()
        except Exception:
            self.handleError(record)


@contextmanager
def tqdm_logging_redirect():
    """Temporarily replace the console StreamHandler with TqdmLoggingHandler.

    Usage::

        with tqdm_logging_redirect():
            for item in tqdm(items):
                logger.info("processing %s", item)

    On exit, the original handler is restored.
    """
    root = logging.getLogger("bench_env")

    # Find the first stdout/stderr StreamHandler (i.e. the console handler).
    # Skip TqdmLoggingHandler to guard against nested calls.
    original_handler = None
    for h in root.handlers:
        if (isinstance(h, logging.StreamHandler)
                and not isinstance(h, (logging.FileHandler, TqdmLoggingHandler))):
            original_handler = h
            break

    if original_handler is None:
        # No console handler found — nothing to redirect
        yield
        return

    tqdm_handler = TqdmLoggingHandler(stream=original_handler.stream)
    tqdm_handler.setFormatter(original_handler.formatter)
    tqdm_handler.setLevel(original_handler.level)

    root.removeHandler(original_handler)
    root.addHandler(tqdm_handler)
    try:
        yield
    finally:
        root.removeHandler(tqdm_handler)
        root.addHandler(original_handler)
