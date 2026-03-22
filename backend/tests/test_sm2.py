from datetime import datetime, timedelta

from app.srs.sm2 import schedule_review


def test_schedule_lapse_resets():
    reps, ef, interval, due = schedule_review(
        2,
        repetitions=5,
        ease_factor=2.5,
        interval_days=10.0,
    )
    assert reps == 0
    assert interval == 0.0
    assert ef == 2.3
    assert due <= datetime.utcnow() + timedelta(days=2)


def test_schedule_first_success():
    reps, ef, interval, due = schedule_review(
        4,
        repetitions=0,
        ease_factor=2.5,
        interval_days=0.0,
    )
    assert reps == 1
    assert interval == 1.0


def test_schedule_second_success():
    reps, ef, interval, due = schedule_review(
        4,
        repetitions=1,
        ease_factor=2.5,
        interval_days=1.0,
    )
    assert reps == 2
    assert interval == 6.0


def test_schedule_third_uses_ef():
    reps, ef, interval, due = schedule_review(
        4,
        repetitions=2,
        ease_factor=2.5,
        interval_days=6.0,
    )
    assert reps == 3
    assert interval == float(max(1.0, round(6.0 * 2.5)))


def test_quality_clamped():
    schedule_review(-1, repetitions=0, ease_factor=2.5, interval_days=0.0)
    schedule_review(9, repetitions=0, ease_factor=2.5, interval_days=0.0)
