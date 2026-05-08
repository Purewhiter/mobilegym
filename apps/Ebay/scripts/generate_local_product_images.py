import base64
import json
import os
import pathlib
import re
import time
from typing import Dict, Tuple

import requests


WORKSPACE = pathlib.Path(r"C:\7\mobile-gym")
PRODUCTS_JSON = WORKSPACE / "apps" / "Ebay" / "data" / "products.json"
OUT_DIR = WORKSPACE / "public" / "ebay-images"
API_BASE = os.environ.get("YUNWU_BASE_URL", "https://yunwu.ai/v1").rstrip("/")
API_KEY = os.environ.get("YUNWU_API_KEY", "")
MODEL = os.environ.get("YUNWU_IMAGE_MODEL", "gpt-image-1")
SIZE = os.environ.get("YUNWU_IMAGE_SIZE", "1024x1024")
SLEEP_S = float(os.environ.get("YUNWU_IMAGE_SLEEP_S", "1.0"))


def slugify_brand(brand: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", brand.lower()).strip("-")
    return s or "unknown"


def collect_type_brand_pairs() -> Dict[Tuple[str, str], dict]:
    data = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    pairs: Dict[Tuple[str, str], dict] = {}
    for item in data:
        t = str(item.get("typeId", "")).strip()
        b = str(item.get("brand", "")).strip()
        if not t or not b:
            continue
        key = (t, b)
        if key in pairs:
            continue
        pairs[key] = {
            "typeId": t,
            "typeLabel": str(item.get("typeLabel", "")).strip(),
            "brand": b,
            "categoryLabel": str(item.get("categoryLabel", "")).strip(),
        }
    return pairs


def generate_one(prompt: str) -> bytes:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "size": SIZE,
    }
    r = requests.post(
        f"{API_BASE}/images/generations",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    r.raise_for_status()
    data = r.json().get("data", [])
    if not data:
        raise RuntimeError("No image data returned")
    b64 = data[0].get("b64_json")
    if not b64:
        raise RuntimeError("No b64_json in response")
    return base64.b64decode(b64)


def main() -> None:
    if not API_KEY:
        raise RuntimeError("YUNWU_API_KEY is required")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pairs = collect_type_brand_pairs()
    total = len(pairs)
    done = 0
    skipped = 0
    failed = 0

    for idx, ((type_id, brand), meta) in enumerate(sorted(pairs.items()), start=1):
        out_name = f"{type_id}__{slugify_brand(brand)}.png"
        out_path = OUT_DIR / out_name
        if out_path.exists() and out_path.stat().st_size > 0:
            skipped += 1
            print(f"[{idx}/{total}] skip {out_name}")
            continue

        type_label = meta["typeLabel"] or type_id
        category_label = meta["categoryLabel"] or "ecommerce"
        prompt = (
            f"Photorealistic ecommerce product photo of a {brand} {type_label} "
            f"({category_label}), single product centered, clean plain white studio background, "
            "soft studio lighting, highly detailed, no people, no text, no logo watermark."
        )

        ok = False
        for attempt in range(1, 4):
            try:
                image_bytes = generate_one(prompt)
                out_path.write_bytes(image_bytes)
                done += 1
                ok = True
                print(f"[{idx}/{total}] ok {out_name} (attempt {attempt})")
                break
            except Exception as e:
                print(f"[{idx}/{total}] fail {out_name} attempt {attempt}: {e}")
                time.sleep(2.5 * attempt)
        if not ok:
            failed += 1
        time.sleep(SLEEP_S)

    print(f"finished: generated={done}, skipped={skipped}, failed={failed}, total={total}")


if __name__ == "__main__":
    main()

