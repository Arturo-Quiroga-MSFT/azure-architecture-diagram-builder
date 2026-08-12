"""
Generate the post-3 blog banner (Concept A) with FLUX.2-pro on Azure AI Foundry,
then bake in crisp title text with PIL.

- FLUX.2-pro via the BFL service provider API (Entra ID auth).
- Base image is generated WITHOUT text (avoids garbled AI text), then the title
  and subtitle are composited on top for perfect legibility.

Run from the FLUX-2 project env (has httpx/azure-identity/pillow):
    cd /Users/arturoquiroga/REPOSITORIES/FLUX-2 && \
    uv run python /Users/arturoquiroga/REPOSITORIES/AZURE-DIAGRAMS/scripts/gen-post3-banner.py
"""

import base64
import io
from pathlib import Path

import httpx
from azure.identity import DefaultAzureCredential
from PIL import Image, ImageDraw, ImageFont

# ── Azure AI Foundry / FLUX.2-pro config ───────────────────────────────────
ENDPOINT = "https://r2d2-foundry-001.services.ai.azure.com"
BFL_API_PATH = "/providers/blackforestlabs/v1/flux-2-pro"
API_VERSION = "preview"

WIDTH, HEIGHT = 1536, 864  # 16:9, multiples of 32

OUT_DIR = Path(
    "/Users/arturoquiroga/REPOSITORIES/AZURE-DIAGRAMS/blog-post/post-3-agent-ready/pictures"
)
BASE_PATH = OUT_DIR / "Banner-base.png"
BANNER_PATH = OUT_DIR / "Banner.png"

# ── Concept A prompt (no text baked by FLUX; text added via PIL below) ──────
PROMPT = (
    "A wide cinematic technology banner, dark navy background with deep teal and "
    "azure-blue glow. On the LEFT, a luminous hand-drawn cloud architecture blueprint "
    "on a dark whiteboard: sketchy nodes, boxes and connection lines glowing in cyan "
    "and electric blue. Bright flowing light streams travel LEFT TO RIGHT across the "
    "center, made of glowing particles and thin data lines. On the RIGHT, the streams "
    "converge into a sleek, minimal AI agent concept: a glowing abstract hexagonal AI "
    "core node radiating light, surrounded by floating rounded chat/message UI panels "
    "and thin node-graph lines, all in azure blue and teal. Subtle circuit and "
    "node-graph motifs, soft bokeh, volumetric light, high contrast, premium "
    "enterprise tech aesthetic, clean negative space in the upper area. No robot, no "
    "robot mascot, no android figure, no humanoid, no character, no faces. No text, no "
    "words, no letters, no typography. Ultra sharp, 8k, professional."
)


def get_token() -> str:
    cred = DefaultAzureCredential()
    return cred.get_token("https://cognitiveservices.azure.com/.default").token


def generate_base() -> None:
    url = f"{ENDPOINT}{BFL_API_PATH}?api-version={API_VERSION}"
    payload = {
        "model": "FLUX.2-pro",
        "prompt": PROMPT,
        "width": WIDTH,
        "height": HEIGHT,
        "safety_tolerance": 2,
        "output_format": "png",
    }
    print(f"Generating base with FLUX.2-pro ({WIDTH}x{HEIGHT})...")
    with httpx.Client(timeout=180) as client:
        resp = client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {get_token()}",
                "Content-Type": "application/json",
            },
        )
        if not resp.is_success:
            print(f"HTTP {resp.status_code}: {resp.text[:500]}")
            resp.raise_for_status()
    result = resp.json()
    if "image" in result:
        img_b64 = result["image"]
    elif "data" in result and result["data"]:
        img_b64 = result["data"][0].get("b64_json") or result["data"][0].get("image")
    else:
        raise RuntimeError(f"Unexpected response keys: {list(result.keys())}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.open(io.BytesIO(base64.b64decode(img_b64)))
    img.save(BASE_PATH)
    print(f"Base saved: {BASE_PATH}  ({img.size[0]}x{img.size[1]})")


# ── Text overlay ───────────────────────────────────────────────────────────
FONT = "/System/Library/Fonts/Avenir Next.ttc"  # 0=Bold, 2=DemiBold, 5=Medium


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size, index=index)


def text_shadow(draw, xy, text, fnt, fill, shadow="#04122b", off=3, anchor="mm"):
    draw.text((xy[0] + off, xy[1] + off), text, font=fnt, fill=shadow, anchor=anchor)
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor)


def compose() -> None:
    img = Image.open(BASE_PATH).convert("RGBA")
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Top gradient scrim for title legibility
    scrim_h = int(h * 0.46)
    for y in range(scrim_h):
        a = int(150 * (1 - y / scrim_h))
        draw.line([(0, y), (w, y)], fill=(4, 10, 30, a))

    cx = w / 2
    f_title = font(84, index=0)      # Bold
    f_sub = font(30, index=5)        # Medium
    f_tag = font(23, index=2)        # DemiBold

    text_shadow(draw, (cx, int(h * 0.20)), "Beyond the Canvas", f_title, "#FFFFFF")
    text_shadow(
        draw, (cx, int(h * 0.315)),
        "The Azure Architecture Diagram Builder Becomes Agent-Ready",
        f_sub, "#FFD633", off=2,
    )
    text_shadow(
        draw, (cx, int(h * 0.435)),
        "Architecture Chat   \u2022   Blueprints   \u2022   13 Models   \u2022   MCP for Agents",
        f_tag, "#FFD633", off=1,
    )

    result = Image.alpha_composite(img, overlay).convert("RGB")
    result.save(BANNER_PATH, "PNG", quality=95)
    print(f"Banner saved: {BANNER_PATH}  ({result.size[0]}x{result.size[1]})")


if __name__ == "__main__":
    # Reuse the existing FLUX base if present; only regenerate when missing.
    if not BASE_PATH.exists():
        generate_base()
    compose()
