"""Simplified SM-2 style scheduling (quality 0–5)."""

from datetime import datetime, timedelta


def schedule_review(
    quality: int,
    *,
    repetitions: int,
    ease_factor: float,
    interval_days: float,
) -> tuple[int, float, float, datetime]:
    """
    Returns (new_repetitions, new_ease, new_interval_days, new_due_at).
    quality < 3: lapse — reset repetition chain.
    """
    q = max(0, min(5, quality))
    ef = ease_factor
    if q < 3:
        reps = 0
        interval = 0.0
        due = datetime.utcnow() + timedelta(days=1)
        ef = max(1.3, ef - 0.2)
        return reps, ef, interval, due

    if repetitions == 0:
        new_interval = 1.0
    elif repetitions == 1:
        new_interval = 6.0
    else:
        new_interval = max(1.0, round(interval_days * ef))

    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ef = max(1.3, ef)
    reps = repetitions + 1
    due = datetime.utcnow() + timedelta(days=new_interval)
    return reps, ef, float(new_interval), due
