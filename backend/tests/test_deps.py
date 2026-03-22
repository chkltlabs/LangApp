def test_api_key_rejects_wrong(client_with_api_key):
    r = client_with_api_key.get("/api/srs/decks", headers={"X-API-Key": "nope"})
    assert r.status_code == 401


def test_api_key_accepts_good(client_with_api_key):
    r = client_with_api_key.get("/api/srs/decks", headers={"X-API-Key": "secret-test-key"})
    assert r.status_code == 200
