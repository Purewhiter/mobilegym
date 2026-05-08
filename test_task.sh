#!/usr/bin/env bash

set -euo pipefail

: "${MOBILE_GYM_ENV_URL:=http://localhost:3000}"
: "${AUTOGLM_BASE_URL:=http://14.103.173.234:8001/v1}"
: "${YUNWU_BASE_URL:=https://yunwu.ai/v1}"
: "${YUNWU_API_KEY:?Please export YUNWU_API_KEY before running test_task.sh}"

python -m bench_env.run --task-id x.ReplyAndRetweetSamePost \
    --env-url "http://localhost:3000" \
    --agent human \
    --eval-mode grounded

python -m bench_env.run --suite ebay --parallel 8 \
    --isolation pages --env-url "${MOBILE_GYM_ENV_URL}" \
    --model-base-url "${YUNWU_BASE_URL}" \
    --model-api-key "${YUNWU_API_KEY}" \
    --model-name gemini-3-pro-preview --headless --agent generic_v2

python -m bench_env.run \
    --task-id clock.CountAlarms \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm

python -m bench_env.run \
    --task-id clock.CountAlarms \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8001/v1 \
    --model-name gui-owl \
    --agent gui_owl

python -m bench_env.run \
    --task-id clock.CountAlarms \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8001/v1 \
    --model-name UI-Venus-1.5-8B \
    --agent venus \
    --eval-mode grounded \
    --loop-detect 5

python -m bench_env.run \
    --env-url http://localhost:4173 \
    --model-base-url http://127.0.0.1:8003/v1 \
    --model-name autoglm \
    --agent autoglm \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 32 \
    --isolation browsers \
    --headless \
    --proxy http://127.0.0.1:7890 \
    --runs-dir runs/autoglm_grounded_loop_detect_8

python -m bench_env.run \
    --env-url http://localhost:4173 \
    --model-base-url http://127.0.0.1:8001/v1 \
    --model-name gelab-zero \
    --agent gelab \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 32 \
    --isolation browsers \
    --headless \
    --proxy http://127.0.0.1:7890 \
    --runs-dir runs/autoglm_grounded_loop_detect_8

python -m bench_env.run \
    --env-url https://localhost:4180 \
    --model-base-url http://127.0.0.1:8001/v1 \
    --model-name UI-Venus-1.5-2B \
    --agent venus \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 64 \
    --browsers 4 \
    --isolation pages \
    --headless \
    --proxy http://127.0.0.1:7890 \
    --runs-dir runs/uivenus-2b_grounded_loop_detect_8 \
    --monitor

python -m bench_env.run \
    --env-url http://localhost:4173 \
    --model-base-url http://127.0.0.1:8004/v1 \
    --model-name gui-owl \
    --agent gui_owl \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 64 \
    --isolation browsers \
    --headless \
    --proxy http://127.0.0.1:7890 \
    --runs-dir runs/guiowl_grounded_loop_detect_8 \
    --monitor

python -m bench_env.run \
    --env-url https://localhost:4180 \
    --model-base-url http://127.0.0.1:8003/v1 \
    --model-name qwen3-vl-4b-10s \
    --agent generic_v2 \
    --eval-mode grounded \
    --loop-detect 8 \
    --parallel 64 \
    --isolation browsers \
    --headless \
    --proxy http://127.0.0.1:7890 \
    --runs-dir runs/qwen3-vl-4b-10s_grounded_loop_detect_8 \
    --monitor

python -m bench_env.run \
  --task-ids redbook.CheckFirstChatLastMessage,redbook.CheckFollowingUserNoteCount,redbook.CollectFeedNoteAndDMAuthor,redbook.LikeFeedNoteAndReportLikes,redbook.PublishAndShareToFollowing,redbook.SearchFirstNoteAuthorTopLikedTitle,crossapp_content.RedbookDmThenWechatReport,crossapp_content.RedbookFollowingNoteCountToSms,crossapp_content.RedbookSearchTitleToWechat,hard.RedbookAuthorTopCollectToWechat,hard.RedbookTopLikedToNotes,hard.RedbookUserBestWorstToNotes,hard.RedbookUserTopCollectToWechat \
  --agent generic_v2 \
  --model-name gemini-3.1-pro-preview \
  --model-base-url https://yunwu.ai/v1 \
  --model-api-key "${YUNWU_API_KEY}" \
  --env-url https://localhost:4183 \
  --headless \
  --proxy http://127.0.0.1:8890 \
  --delay-after-action 1.0 \
  --loop-detect 20 \
  --runs-dir runs/gemini_red \
  --eval-mode grounded
