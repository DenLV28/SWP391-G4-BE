"""
ParkFlow — PaddleOCR license-plate microservice.

Wraps the local PaddleOCR repo (d:/FPT_ThNgwx/PaddleOCR-main) behind one HTTP
endpoint the staff Gate Control screen calls after an RFID tap auto-captures a
webcam frame:

    POST /ocr/plate   { "image": "<base64 JPEG/PNG, with or without data-URL prefix>" }
    →                 { "plate": "29C1-38383", "confidence": 0.97,
                        "rawTexts": [...], "engine": "paddleocr" }

`plate` is normalized to the app's canonical format (see LICENSE_PLATE_REGEX in
src/data/mockData.ts): 2 digits + 1-2 letters + 0-2 digits, dash, 4-5 digits.
An empty `plate` means "no plate found in frame" (not an error).

Run:  uvicorn app:app --host 0.0.0.0 --port 8868
"""

import base64
import logging
import threading
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ocr-service")

# ── PaddleOCR pipeline ────────────────────────────────────────────────────────
# Mobile det/rec models: fast enough for CPU-only gate stations, accurate enough
# for plates (Latin letters + digits). Doc-orientation / unwarping stages are
# for scanned documents — dead weight on webcam frames, so they're disabled.
PIPELINE_KWARGS = dict(
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="PP-OCRv5_mobile_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=True,
    device="cpu",
)

_pipeline = None

# PaddleOCR KHÔNG an toàn đa luồng.
#
# FastAPI chạy endpoint khai báo bằng `def` (đồng bộ) trên một threadpool, nên
# nhiều lượt quét cùng lúc — trạm cổng bắn OCR mỗi lần quẹt thẻ, chồng lên nút
# "Chụp & OCR" và ảnh tự chụp — sẽ gọi predict() song song trên CÙNG một đối
# tượng pipeline. Trạng thái nội bộ của nó hỏng dần, và service bắt đầu trả
# HTTP 500 cho những ảnh mà lúc mới khởi động vẫn đọc bình thường. Khởi động
# lại là hết, nhưng vài chục lượt quét sau lại hỏng tiếp.
#
# Khoá này ép mỗi lần chỉ một suy luận chạy. Trạm cổng quét tuần tự nên hầu như
# không phải chờ, đổi lại service không còn tự hỏng.
_lock = threading.Lock()


def get_pipeline():
    """Nạp pipeline một lần. Khoá kép để hai luồng không cùng dựng hai bản."""
    global _pipeline
    if _pipeline is None:
        with _lock:
            if _pipeline is None:
                from paddleocr import PaddleOCR  # slow import — deferred so /health works instantly

                log.info("Loading PaddleOCR pipeline (first run downloads models)…")
                _pipeline = PaddleOCR(**PIPELINE_KWARGS)
                log.info("PaddleOCR pipeline ready.")
    return _pipeline


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_pipeline()  # load at startup so the first RFID scan isn't slow
    yield


app = FastAPI(title="ParkFlow PaddleOCR service", lifespan=lifespan)

# The Vite dev server / staff stations call this cross-origin on the LAN.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Vietnamese plate assembly lives in plate_logic.py (pure stdlib, unit-testable
# without paddle installed).
from plate_logic import extract_plate


# ── HTTP endpoints ────────────────────────────────────────────────────────────
class OcrRequest(BaseModel):
    image: str  # base64, optionally prefixed with "data:image/...;base64,"


class RawText(BaseModel):
    text: str
    score: float


class OcrResponse(BaseModel):
    plate: str
    confidence: float | None
    rawTexts: list[RawText]
    engine: str = "paddleocr"


@app.get("/health")
def health():
    return {"status": "ok", "modelLoaded": _pipeline is not None}


# Bí danh dưới /ocr để frontend gọi được qua proxy của Vite. Khi mở app bằng
# ngrok (HTTPS), gọi thẳng http://localhost:8868 bị trình duyệt chặn vì mixed
# content; Vite chỉ proxy tiền tố /ocr nên health cũng phải nằm dưới đó.
@app.get("/ocr/health")
def ocr_health():
    return health()


# Cạnh dài tối đa của ảnh đưa vào suy luận.
#
# Trang cổng chụp nguyên khung webcam (canvas.toDataURL ở độ phân giải gốc của
# camera — có thể 1080p hoặc hơn). Ảnh càng lớn thì bộ nhận diện càng ngốn RAM
# và càng dễ ném lỗi native trên CPU, mà biển số thì không cần tới độ phân giải
# đó: 1280px chiều dài là quá đủ để đọc. Thu nhỏ trước khi suy luận vừa ổn định
# hơn vừa nhanh hơn.
MAX_INFER_SIDE = 1280


def shrink_for_inference(img: np.ndarray) -> np.ndarray:
    """Thu nhỏ ảnh về cạnh dài <= MAX_INFER_SIDE, giữ nguyên tỉ lệ."""
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= MAX_INFER_SIDE:
        return img
    scale = MAX_INFER_SIDE / float(longest)
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


@app.post("/ocr/plate", response_model=OcrResponse)
def ocr_plate(req: OcrRequest):
    payload = req.image.split(",", 1)[-1]  # tolerate a data-URL prefix
    try:
        img_bytes = base64.b64decode(payload, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Ảnh không phải base64 hợp lệ.")

    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Không giải mã được ảnh (cần JPEG/PNG).")

    h0, w0 = img.shape[:2]
    img = shrink_for_inference(img)
    h1, w1 = img.shape[:2]
    if (w1, h1) != (w0, h0):
        log.info("Thu nhỏ ảnh %dx%d → %dx%d trước khi nhận diện", w0, h0, w1, h1)

    # Một suy luận tại một thời điểm — xem chú thích ở _lock.
    #
    # THỬ LẠI MỘT LẦN khi predict ném lỗi. PaddlePaddle trên CPU thỉnh thoảng
    # ném "RuntimeError: Unknown exception" ở tầng native mà lần gọi ngay sau đó
    # lại chạy bình thường — bằng chứng: cùng bộ ảnh, tiến trình vừa khởi động
    # thì 14/14 đọc được. Thử lại một lần rẻ hơn nhiều so với bắt nhân viên
    # ở cổng bấm "Chụp & OCR" lại.
    result = None
    last_err = None
    for attempt in (1, 2):
        try:
            with _lock:
                result = get_pipeline().predict(img)
            break
        except Exception as exc:
            last_err = exc
            log.warning("predict lỗi (lần %d/2) trên ảnh %dx%d: %s", attempt, w1, h1, exc)

    if result is None:
        # KHÔNG dựng lại pipeline ở đây. Tạo đối tượng Python mới không sửa được
        # trạng thái native đã hỏng, mà lần nạp lại còn treo luôn tiến trình —
        # tệ hơn hẳn so với để nguyên. Phục hồi thật thì khởi động lại service.
        log.error("PaddleOCR predict thất bại sau 2 lần thử", exc_info=last_err)
        raise HTTPException(
            status_code=503,
            detail="Bộ nhận diện gặp lỗi. Thử bấm 'Chụp & OCR' lại; nếu vẫn lỗi, khởi động lại ocr-service.",
        )

    texts, scores, boxes = [], [], []
    for res in result:
        rec_texts = res.get("rec_texts") or []
        rec_scores = res.get("rec_scores") or []
        rec_polys = res.get("rec_polys")
        for i, text in enumerate(rec_texts):
            texts.append(str(text))
            scores.append(float(rec_scores[i]) if i < len(rec_scores) else 0.0)
            if rec_polys is not None and i < len(rec_polys):
                poly = np.asarray(rec_polys[i], dtype=float)
                xs, ys = poly[:, 0], poly[:, 1]
                boxes.append((xs.min(), ys.min(), xs.max(), float(ys.mean())))
            else:
                boxes.append(None)

    plate, confidence, _ = extract_plate(texts, scores, boxes)
    log.info("OCR read %d text(s) → plate=%r conf=%s", len(texts), plate, confidence)
    return OcrResponse(
        plate=plate,
        confidence=confidence,
        rawTexts=[RawText(text=t, score=round(s, 4)) for t, s in zip(texts, scores)],
    )
