"""
Frame-push proctoring module.

Instead of opening the webcam itself (which conflicts with the browser's
getUserMedia), this module receives individual JPEG frames POSTed from the
frontend, analyses them with OpenCV, and accumulates cheating statistics.

Public API
----------
start_session()               -> str   create a new session, return UUID
push_frame(sid, jpeg_bytes)           analyse one frame and update counters
stop_session(sid)             -> dict  finalise and return the verdict
"""

import os
import cv2
import numpy as np
import threading
import uuid

# ── Cascade paths ─────────────────────────────────────────────────────────────
_ML_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'ML', 'FaceInFrame', 'Smart-Face-Detector',
)
_FACE_XML  = os.path.join(_ML_DIR, 'haarcascade_frontalface_default.xml')
_EYE_XML   = os.path.join(_ML_DIR, 'haarcascade_eye.xml')

# ── Thresholds ────────────────────────────────────────────────────────────────
FACE_MISSING_THRESHOLD = 15.0
LOOK_AWAY_THRESHOLD    = 20.0
MULTI_FACE_THRESHOLD   =  5.0

# ── Session registry ──────────────────────────────────────────────────────────
_sessions: dict[str, '_Session'] = {}
_lock = threading.Lock()

# ── Load classifiers once at import time ──────────────────────────────────────
_face_cas    = cv2.CascadeClassifier(_FACE_XML)
_eye_cas     = cv2.CascadeClassifier(_EYE_XML)
_profile_cas = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')


# ── Helper functions ──────────────────────────────────────────────────────────

def _detect_gaze(eye_roi_gray):
    h, w = eye_roi_gray.shape
    equalized = cv2.equalizeHist(eye_roi_gray)
    blurred   = cv2.GaussianBlur(equalized, (7, 7), 0)
    threshold = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 3,
    )
    contours, _ = cv2.findContours(threshold, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return ('center', 'center')
    largest = max(contours, key=cv2.contourArea)
    M = cv2.moments(largest)
    if M['m00'] == 0:
        return ('center', 'center')
    px = int(M['m10'] / M['m00'])
    py = int(M['m01'] / M['m00'])
    rx, ry = px / w, py / h
    h_dir = 'right' if rx < 0.38 else ('left' if rx > 0.62 else 'center')
    v_dir = 'up'    if ry < 0.35 else ('down' if ry > 0.65 else 'center')
    return (h_dir, v_dir)


def _is_skin(frame_bgr, x, y, w, h, min_pct=0.30):
    roi = frame_bgr[y:y+h, x:x+w]
    if roi.size == 0:
        return False
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    m1  = cv2.inRange(hsv, np.array([0,  20, 40]), np.array([40, 255, 255]))
    m2  = cv2.inRange(hsv, np.array([160, 20, 40]), np.array([180, 255, 255]))
    return np.count_nonzero(m1 | m2) / (w * h) >= min_pct


def _valid_ar(w, h, lo=0.6, hi=1.2):
    return h > 0 and lo <= w / h <= hi


def _iou(a, b):
    xA, yA = max(a[0], b[0]), max(a[1], b[1])
    xB, yB = min(a[0]+a[2], b[0]+b[2]), min(a[1]+a[3], b[1]+b[3])
    inter  = max(0, xB-xA) * max(0, yB-yA)
    union  = a[2]*a[3] + b[2]*b[3] - inter
    return inter / union if union else 0


def _analyse_frame(frame_bgr, tracked: list):
    """Run face + gaze detection on one decoded frame. Returns (new_tracked, face_count, is_away)."""
    gray  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    faces = _face_cas.detectMultiScale(gray, 1.1, 6, minSize=(60, 60), maxSize=(400, 400))

    if len(faces) == 0 and not _profile_cas.empty():
        faces = _profile_cas.detectMultiScale(gray, 1.1, 6, minSize=(60, 60))
        if len(faces) == 0:
            flipped = cv2.flip(gray, 1)
            ff2 = _profile_cas.detectMultiScale(flipped, 1.1, 6, minSize=(60, 60))
            if len(ff2) > 0:
                cols = gray.shape[1]
                faces = tuple((cols - x - w, y, w, h) for (x, y, w, h) in ff2)

    validated = [
        (x, y, w, h) for (x, y, w, h) in faces
        if _valid_ar(w, h) and _is_skin(frame_bgr, x, y, w, h)
    ]

    MIN_CONSECUTIVE = 3
    IOU_THRESHOLD   = 0.3
    new_tracked: list[dict] = []
    used = [False] * len(validated)
    for tf_item in tracked:
        best_score, best_i = 0, -1
        for i, vf in enumerate(validated):
            if used[i]: continue
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

    is_away = False
    if face_count > 0:
        x, y, w, h = confirmed[0]
        roi_gray = gray[y:y + h//2, x:x+w]
        eyes = _eye_cas.detectMultiScale(roi_gray, 1.1, 3, minSize=(18, 18))
        if len(eyes) > 0:
            h_votes, v_votes = [], []
            for (ex, ey, ew, eh) in eyes:
                roi = roi_gray[ey:ey+eh, ex:ex+ew]
                if roi.size > 0:
                    hd, vd = _detect_gaze(roi)
                    h_votes.append(hd)
                    v_votes.append(vd)
            gaze_h = next((d for d in ('left', 'right') if h_votes.count(d) > h_votes.count('center')), 'center')
            gaze_v = next((d for d in ('up', 'down') if v_votes.count(d) > v_votes.count('center')), 'center')
            is_away = gaze_h != 'center' or gaze_v != 'center'
        else:
            is_away = True

    return new_tracked, face_count, is_away


# ── Session class ─────────────────────────────────────────────────────────────

class _Session:
    def __init__(self, sid: str):
        self.sid                 = sid
        self._lock               = threading.Lock()
        self._tracked: list[dict] = []
        self.total_frames        = 0
        self.no_face_frames      = 0
        self.looking_away_frames = 0
        self.multi_face_frames   = 0
        self.frames_received     = 0

    def push(self, jpeg_bytes: bytes):
        arr   = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return
        with self._lock:
            self.frames_received += 1
            new_tracked, face_count, is_away = _analyse_frame(frame, self._tracked)
            self._tracked = new_tracked
            self.total_frames += 1
            if face_count == 0:
                self.no_face_frames += 1
            else:
                if face_count > 1:
                    self.multi_face_frames += 1
                if is_away:
                    self.looking_away_frames += 1

    def result(self) -> dict:
        with self._lock:
            tf = self.total_frames
            if tf == 0 or self.frames_received == 0:
                return {
                    'cheating': False, 'camera_available': False,
                    'face_not_in_frame_pct': 0.0, 'not_looking_pct': 0.0,
                    'multi_face_pct': 0.0, 'total_frames': tf, 'flags': [],
                }
            face_not_pct = round(self.no_face_frames / tf * 100, 1)
            multi_pct    = round(self.multi_face_frames / tf * 100, 1)
            ff           = tf - self.no_face_frames
            away_pct     = round(self.looking_away_frames / ff * 100, 1) if ff > 0 else 0.0
            flags = []
            if face_not_pct > FACE_MISSING_THRESHOLD:
                flags.append(f'Face absent {face_not_pct}% of the time')
            if away_pct > LOOK_AWAY_THRESHOLD:
                flags.append(f'Not looking at screen {away_pct}% of the time')
            if multi_pct > MULTI_FACE_THRESHOLD:
                flags.append(f'Multiple people detected in {multi_pct}% of frames')
            return {
                'cheating': bool(flags), 'camera_available': True,
                'face_not_in_frame_pct': face_not_pct, 'not_looking_pct': away_pct,
                'multi_face_pct': multi_pct, 'total_frames': tf, 'flags': flags,
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
    return session.result()
