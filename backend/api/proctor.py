"""
Frame-push proctoring module  (face-presence + multi-face only)
================================================================

Receives individual JPEG frames POSTed from the frontend, analyses
them with OpenCV, and accumulates cheating statistics.

Eye-tracking / gaze detection has been removed.  The only two signals
that matter are:
  1. Face not in frame  (no face detected)
  2. Multiple faces     (more than one person in frame)

Public API
----------
start_session()               -> str   create a new session, return UUID
push_frame(sid, jpeg_bytes)           analyse one frame and update counters
stop_session(sid)             -> dict  finalise and return the verdict
"""

import os
import queue
import cv2
import numpy as np
import threading
import uuid

# ── Cascade paths ─────────────────────────────────────────────────────────────
_ML_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'ML', 'FaceInFrame', 'Smart-Face-Detector',
)
_FACE_XML = os.path.join(_ML_DIR, 'haarcascade_frontalface_default.xml')

# ── Lenient cheating thresholds ───────────────────────────────────────────────
# Both values must be EXCEEDED before a flag is raised.
# This intentionally avoids false-positives for normal webcam use.
FACE_MISSING_THRESHOLD = 20.0   # face absent > 20 % of frames → flag
MULTI_FACE_THRESHOLD   =  5.0   # multiple faces > 5 % of frames → flag

# Weighted cheating score formula:
#   score = 0.55 * (face_not_pct / FACE_MISSING_THRESHOLD)
#         + 0.45 * (multi_face_pct / MULTI_FACE_THRESHOLD)
# cheating = score >= CHEAT_SCORE_THRESHOLD
CHEAT_SCORE_THRESHOLD = 1.0     # must trigger at least one full flag

# ── Session registry ──────────────────────────────────────────────────────────
_sessions: dict[str, '_Session'] = {}
_lock = threading.Lock()

# ── Load classifiers once at import time ──────────────────────────────────────
_face_cas    = cv2.CascadeClassifier(_FACE_XML)
_profile_cas = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_profileface.xml'
)

_MAX_WIDTH = 320  # downscale frames to this width before detection


# ── Helper functions ──────────────────────────────────────────────────────────

def _is_skin(frame_bgr, x, y, w, h, min_pct=0.20):
    roi = frame_bgr[y:y + h, x:x + w]
    if roi.size == 0:
        return False
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    m1  = cv2.inRange(hsv, np.array([0,  20, 40]), np.array([40, 255, 255]))
    m2  = cv2.inRange(hsv, np.array([160, 20, 40]), np.array([180, 255, 255]))
    return np.count_nonzero(m1 | m2) / (w * h) >= min_pct


def _valid_ar(w, h, lo=0.6, hi=1.3):
    return h > 0 and lo <= w / h <= hi


def _iou(a, b):
    xA, yA = max(a[0], b[0]), max(a[1], b[1])
    xB, yB = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    inter  = max(0, xB - xA) * max(0, yB - yA)
    union  = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union else 0


def _is_near_duplicate_face(a, b):
    """Return True when two detections almost certainly refer to the same face."""
    if _iou(a, b) >= 0.20:
        return True
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    acx, acy = ax + aw / 2.0, ay + ah / 2.0
    bcx, bcy = bx + bw / 2.0, by + bh / 2.0
    dist = ((acx - bcx) ** 2 + (acy - bcy) ** 2) ** 0.5
    amin = max(1.0, min((aw * aw + ah * ah) ** 0.5, (bw * bw + bh * bh) ** 0.5))
    area_ratio = (aw * ah) / max(1.0, bw * bh)
    return dist / amin <= 0.35 and 0.50 <= area_ratio <= 2.00


def _dedupe_faces(faces):
    if not faces:
        return []
    ordered = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    unique = []
    for f in ordered:
        if all(not _is_near_duplicate_face(f, u) for u in unique):
            unique.append(f)
    return unique


def _analyse_frame(frame_bgr, tracked: list):
    """
    Detect faces in one frame.
    Returns (new_tracked, face_count).
    face_count == 0  → no one in frame
    face_count == 1  → normal
    face_count >= 2  → multiple people
    """
    h_orig, w_orig = frame_bgr.shape[:2]
    scale = _MAX_WIDTH / w_orig if w_orig > _MAX_WIDTH else 1.0
    if scale < 1.0:
        small = cv2.resize(
            frame_bgr,
            (int(w_orig * scale), int(h_orig * scale)),
            interpolation=cv2.INTER_LINEAR,
        )
    else:
        small = frame_bgr

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    # ── Frontal face detection ────────────────────────────────────────────────
    # scaleFactor=1.1 catches more angles; minNeighbors=3 is lenient to reduce
    # false absences (e.g. when candidate tilts head slightly).
    raw_frontal = _face_cas.detectMultiScale(gray, 1.1, 3, minSize=(40, 40))
    faces: list[tuple] = [tuple(f) for f in raw_frontal] if len(raw_frontal) > 0 else []

    # ── Profile face detection ────────────────────────────────────────────────
    # Detects a second person who may be turned sideways.  Only added when it
    # does NOT overlap a confirmed frontal face (avoids double-counting).
    if not _profile_cas.empty():
        cols = gray.shape[1]
        for fp_arr, mirror in [
            (_profile_cas.detectMultiScale(gray, 1.2, 3, minSize=(40, 40)), False),
            (_profile_cas.detectMultiScale(cv2.flip(gray, 1), 1.2, 3, minSize=(40, 40)), True),
        ]:
            if len(fp_arr) > 0:
                for (x, y, w, h) in fp_arr:
                    pf = (cols - x - w, y, w, h) if mirror else (x, y, w, h)
                    if all(_iou(pf, ff) < 0.3 for ff in faces):
                        faces.append(pf)

    # Validate: aspect ratio + skin-tone check
    validated = [
        (x, y, w, h) for (x, y, w, h) in faces
        if _valid_ar(w, h) and _is_skin(small, x, y, w, h)
    ]
    validated = _dedupe_faces(validated)

    # ── Temporal tracking (require 2 consecutive detections to confirm a face) ─
    MIN_CONSECUTIVE = 2
    IOU_THRESHOLD   = 0.3
    new_tracked: list[dict] = []
    used = [False] * len(validated)
    for tf_item in tracked:
        best_score, best_i = 0, -1
        for i, vf in enumerate(validated):
            if used[i]:
                continue
            s = _iou(tf_item['box'], vf)
            if s > best_score:
                best_score, best_i = s, i
        if best_score >= IOU_THRESHOLD and best_i >= 0:
            used[best_i] = True
            new_tracked.append({'box': validated[best_i], 'cons': tf_item['cons'] + 1})
    for i, vf in enumerate(validated):
        if not used[i]:
            new_tracked.append({'box': vf, 'cons': 1})

    confirmed  = [t['box'] for t in new_tracked if t['cons'] >= MIN_CONSECUTIVE]
    face_count = len(confirmed)

    return new_tracked, face_count


# ── Session class ─────────────────────────────────────────────────────────────

_SENTINEL = object()  # signals the worker thread to stop


class _Session:
    def __init__(self, sid: str):
        self.sid               = sid
        self._lock             = threading.Lock()
        self._tracked: list[dict] = []
        self.total_frames      = 0
        self.no_face_frames    = 0
        self.multi_face_frames = 0
        self.frames_received   = 0

        self._q: queue.Queue = queue.Queue(maxsize=30)
        self._worker = threading.Thread(target=self._run, daemon=True)
        self._worker.start()

    def _run(self):
        # Require 2 consecutive multi-face detections before counting the event.
        # This absorbs single-frame detector jitter without obscuring real intrusions.
        _MULTI_STREAK_REQ = 2
        multi_streak = 0

        while True:
            item = self._q.get()
            if item is _SENTINEL:
                break
            jpeg_bytes = item
            arr   = np.frombuffer(jpeg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            new_tracked, face_count = _analyse_frame(frame, self._tracked)

            with self._lock:
                self._tracked = new_tracked
                self.total_frames += 1

                if face_count == 0:
                    self.no_face_frames += 1
                    multi_streak = 0
                elif face_count > 1:
                    multi_streak += 1
                    if multi_streak >= _MULTI_STREAK_REQ:
                        self.multi_face_frames += 1
                else:
                    multi_streak = 0

    def push(self, jpeg_bytes: bytes):
        with self._lock:
            self.frames_received += 1
        try:
            self._q.put_nowait(jpeg_bytes)
        except queue.Full:
            pass

    def _stop_worker(self):
        self._q.put(_SENTINEL)
        self._worker.join(timeout=5)

    def result(self) -> dict:
        with self._lock:
            tf = self.total_frames
            if tf == 0 or self.frames_received == 0:
                return {
                    'cheating': False,
                    'camera_available': False,
                    'face_not_in_frame_pct': 0.0,
                    'not_looking_pct': 0.0,    # kept for schema compat, always 0
                    'multi_face_pct': 0.0,
                    'total_frames': tf,
                    'flags': [],
                    'cheating_probability': None,
                    'provider': 'opencv',
                }

            face_not_pct = round(self.no_face_frames    / tf * 100, 1)
            multi_pct    = round(self.multi_face_frames / tf * 100, 1)

            flags = []
            if face_not_pct > FACE_MISSING_THRESHOLD:
                flags.append(f'Face absent {face_not_pct}% of the time')
            if multi_pct > MULTI_FACE_THRESHOLD:
                flags.append(f'Multiple people detected in {multi_pct}% of frames')

            # ── Lenient weighted cheating score ───────────────────────────────
            # Normalise each signal by its threshold.  A value of 1.0 means the
            # threshold has just been reached.  Overall score must hit 1.0 to
            # trigger the cheating flag — so both signals need to contribute
            # meaningfully, OR one must be very high on its own.
            face_norm  = face_not_pct / FACE_MISSING_THRESHOLD
            multi_norm = multi_pct    / MULTI_FACE_THRESHOLD
            cheat_score = 0.55 * face_norm + 0.45 * multi_norm
            cheating_probability = round(min(cheat_score, 2.0) / 2.0, 3)  # 0-1 range
            cheating = cheat_score >= CHEAT_SCORE_THRESHOLD

            return {
                'cheating':               cheating,
                'camera_available':       True,
                'face_not_in_frame_pct':  face_not_pct,
                'not_looking_pct':        0.0,   # removed — always 0 for schema compat
                'multi_face_pct':         multi_pct,
                'total_frames':           tf,
                'flags':                  flags,
                'cheating_probability':   cheating_probability,
                'provider':               'opencv',
            }


# ── Public API ────────────────────────────────────────────────────────────────

def start_session() -> str:
    sid = str(uuid.uuid4())
    with _lock:
        _sessions[sid] = _Session(sid)
    return sid


def push_frame(sid: str, jpeg_bytes: bytes) -> bool:
    """Push a JPEG frame for analysis. Returns False if session not found."""
    with _lock:
        session = _sessions.get(sid)
    if session is None:
        return False
    session.push(jpeg_bytes)
    return True


def stop_session(sid: str) -> dict | None:
    with _lock:
        session = _sessions.pop(sid, None)
    if session is None:
        return None
    session._stop_worker()
    return session.result()
