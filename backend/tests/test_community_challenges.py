"""API tests for community feed and challenges (SQLite-backed)."""

from __future__ import annotations

import os

from fastapi.testclient import TestClient

from app.main import app

# Presigned URL signing works without real AWS credentials.
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")

client = TestClient(app)
PREFIX = "/api/v1"


def test_community_posts_list() -> None:
    r = client.get(f"{PREFIX}/community/posts")
    assert r.status_code == 200
    data = r.json()
    assert "posts" in data
    assert "total" in data
    assert isinstance(data["posts"], list)
    assert data["total"] >= len(data["posts"])
    assert data.get("has_more") is False
    assert "next_cursor" in data


def test_community_post_filter_tag() -> None:
    r = client.get(f"{PREFIX}/community/posts", params={"tag": "fish"})
    assert r.status_code == 200
    for p in r.json()["posts"]:
        assert "fish" in p["tags"]


def test_community_pagination_and_cursor() -> None:
    r0 = client.get(f"{PREFIX}/community/posts", params={"sort": "recent", "limit": 2, "offset": 0})
    assert r0.status_code == 200
    d0 = r0.json()
    assert d0["total"] >= 5
    assert len(d0["posts"]) == 2
    assert d0["has_more"] is True
    assert d0["next_cursor"]

    r1 = client.get(
        f"{PREFIX}/community/posts",
        params={"sort": "recent", "limit": 2, "cursor": d0["next_cursor"]},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    ids0 = {p["id"] for p in d0["posts"]}
    ids1 = {p["id"] for p in d1["posts"]}
    assert ids0.isdisjoint(ids1)


def test_community_fts_search() -> None:
    r = client.get(f"{PREFIX}/community/posts", params={"species_query": "Leopard", "use_fts": True})
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["posts"]]
    assert "s2" in ids


def test_community_like_unlike_and_comment() -> None:
    pid = "s2"
    r0 = client.post(f"{PREFIX}/community/posts/{pid}/like")
    assert r0.status_code == 200
    body0 = r0.json()
    assert body0["likes"] >= 413
    assert body0["liked_by_you"] is True

    r_dup = client.post(f"{PREFIX}/community/posts/{pid}/like")
    assert r_dup.status_code == 200
    assert r_dup.json()["likes"] == body0["likes"]
    assert r_dup.json()["liked_by_you"] is True

    r1 = client.post(
        f"{PREFIX}/community/posts/{pid}/comments",
        json={"text": "Nice sighting!"},
    )
    assert r1.status_code == 201
    cid = r1.json()["id"]
    assert r1.json()["text"] == "Nice sighting!"
    assert r1.json()["author"] == "You"

    r2 = client.get(f"{PREFIX}/community/posts/{pid}/comments")
    assert r2.status_code == 200
    page = r2.json()
    assert "comments" in page
    assert any(c["text"] == "Nice sighting!" for c in page["comments"])

    r_del = client.delete(f"{PREFIX}/community/posts/{pid}/like")
    assert r_del.status_code == 200
    assert r_del.json()["liked_by_you"] is False
    assert r_del.json()["likes"] == body0["likes"] - 1

    r_rm = client.delete(f"{PREFIX}/community/posts/{pid}/comments/{cid}")
    assert r_rm.status_code == 204


def test_community_presign_validation() -> None:
    bad = client.post(
        f"{PREFIX}/community/media/presign",
        json={"filename": "x.gif", "content_type": "image/gif", "size_bytes": 1024},
    )
    assert bad.status_code == 422

    ok = client.post(
        f"{PREFIX}/community/media/presign",
        json={"filename": "a.jpg", "content_type": "image/jpeg", "size_bytes": 1024},
    )
    assert ok.status_code == 200
    data = ok.json()
    assert "upload_url" in data and "object_key" in data and "public_url" in data


def test_community_create_post_uses_account() -> None:
    r = client.post(
        f"{PREFIX}/community/posts",
        json={
            "species": "Test wrasse",
            "location_id": "la-jolla-shores",
            "location_name": "La Jolla Shores",
            "text": "Automated test sighting.",
            "tags": ["test"],
        },
    )
    assert r.status_code == 201
    p = r.json()
    assert p["author"] == "You"
    assert p["username"] == "you"


def test_challenges_list_and_trophy() -> None:
    r = client.get(f"{PREFIX}/challenges", params={"user_id": "demo"})
    assert r.status_code == 200
    challenges = r.json()
    assert len(challenges) >= 6
    assert any(c["id"] == "kelp-quiet" and c["completed"] for c in challenges)

    t = client.get(f"{PREFIX}/challenges/me/trophy", params={"user_id": "demo"})
    assert t.status_code == 200
    body = t.json()
    assert body["points"] == 80
    assert body["tier"]["id"] == "bronze"


def test_challenges_progress_unknown() -> None:
    r = client.post(
        f"{PREFIX}/challenges/me/progress",
        params={"user_id": "demo"},
        json={"challenge_id": "nope", "mark_complete": True},
    )
    assert r.status_code == 404
