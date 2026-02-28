import importlib
import os
import sys
import types
import unittest

from fastapi.testclient import TestClient


class RunnerStartApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("LIVEKIT_API_KEY", "devkey")
        os.environ.setdefault("LIVEKIT_API_SECRET", "secret")
        os.environ.setdefault("LIVEKIT_URL", "ws://transport-server:7880")

        fake_bot_module = types.ModuleType("bot")

        async def fake_bot(_runner_args):
            return None

        fake_bot_module.bot = fake_bot
        sys.modules["bot"] = fake_bot_module

        if "runner" in sys.modules:
            cls.runner_module = importlib.reload(sys.modules["runner"])
        else:
            import runner as runner_module

            cls.runner_module = runner_module

        cls.client = TestClient(cls.runner_module.app)

    def test_missing_room_name_returns_400(self):
        response = self.client.post("/start", json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json().get("error"),
            "room_name is required and must be a non-empty string",
        )

    def test_invalid_room_name_type_returns_400(self):
        response = self.client.post("/start", json={"room_name": 1234})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json().get("error"),
            "room_name is required and must be a non-empty string",
        )

    def test_non_object_body_returns_400(self):
        response = self.client.post("/start", json=[])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "request body must be a JSON object")

    def test_malformed_json_returns_400(self):
        response = self.client.post(
            "/start",
            content="{",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "request body must be valid JSON")

    def test_explicit_bot_identity_echoed(self):
        room_name = "runner-test-room"
        bot_identity = "bot_runner_test_identity"
        response = self.client.post(
            "/start",
            json={
                "room_name": room_name,
                "bot_identity": bot_identity,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload.get("room_name"), room_name)
        self.assertEqual(payload.get("bot_identity"), bot_identity)


if __name__ == "__main__":
    unittest.main()
