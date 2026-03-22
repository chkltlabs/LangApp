def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_public_settings(client):
    r = client.get("/api/settings/public")
    assert r.status_code == 200
    j = r.json()
    assert "lang_target" in j
    assert "lang_ui" in j
    assert "lang_target_locale" in j
    assert "cefr_level" in j
    assert "has_fast_model" in j


def test_openapi(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert r.json()["info"]["title"] == "LangApp"
