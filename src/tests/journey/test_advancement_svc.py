import pytest
from unittest.mock import MagicMock, call
from app.journey.services.advancement_svc import evaluate_node_advancement

class MockResponse:
    def __init__(self, data):
        self.data = data

def test_evaluate_node_advancement_seed_if_no_history():
    client = MagicMock()
    # Mock profile fetch
    client.table().select().eq().single().execute.return_value = MockResponse({"total_xp": 50})
    # Mock flags
    client.table().select().eq().execute.return_value = MockResponse(None)
    # Mock no current node
    client.table().select().eq().eq().execute.return_value = MockResponse([])
    
    evaluate_node_advancement(client, "user-123")
    
    # Assert upsert for region 1 and insert for node 1-1
    client.table("journey_regions").upsert.assert_called_once_with(
        {"user_id": "user-123", "region_id": "1", "status": "CURRENT"}
    )
    # Insert node
    assert client.table("journey_region_nodes").insert.call_count >= 1

def test_evaluate_node_advancement_idempotent():
    client = MagicMock()
    # Mock total_xp
    client.table().select().eq().single().execute.return_value = MockResponse({"total_xp": 50})
    # Mock current node
    client.table().select().eq().eq().execute.side_effect = [
        MockResponse([{"id": "rec-1", "node_id": "1-1", "status": "CURRENT"}]),
        MockResponse([]) # Should break out
    ]
    
    evaluate_node_advancement(client, "user-123")
    # Because XP (50) is less than threshold for 1-1 (100), no updates should happen
    client.table("journey_region_nodes").update.assert_not_called()

def test_evaluate_node_advancement_single_threshold_cross():
    client = MagicMock()
    client.table().select().eq().single().execute.return_value = MockResponse({"total_xp": 150})
    client.table().select().eq().eq().execute.side_effect = [
        MockResponse([{"id": "rec-1", "node_id": "1-1", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-2", "node_id": "1-2", "status": "CURRENT"}])
    ]
    
    evaluate_node_advancement(client, "user-123")
    # Should update 1-1 to SHIFTED
    client.table("journey_region_nodes").update.assert_any_call({
        "status": "SHIFTED", "shifted_at": "now()"
    })

def test_evaluate_node_advancement_multi_skip():
    client = MagicMock()
    # 500 XP is enough to cross 1-1 (100), 1-2 (200), 1-3 (350), but not 1-4 (500, wait, it is exactly 500 so it crosses 1-4 too?)
    client.table().select().eq().single().execute.return_value = MockResponse({"total_xp": 550})
    
    # Provide the current node over multiple loops
    client.table().select().eq().eq().execute.side_effect = [
        MockResponse([{"id": "rec-1", "node_id": "1-1", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-2", "node_id": "1-2", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-3", "node_id": "1-3", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-4", "node_id": "1-4", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-5", "node_id": "1-5", "status": "CURRENT"}])
    ]
    
    evaluate_node_advancement(client, "user-123")
    
    # Update should be called at least 4 times for the multi-skip
    assert client.table("journey_region_nodes").update.call_count >= 4

def test_evaluate_node_advancement_region_cascade():
    client = MagicMock()
    # Cross 1-5 to 2-1
    client.table().select().eq().single().execute.return_value = MockResponse({"total_xp": 950})
    client.table().select().eq().eq().execute.side_effect = [
        MockResponse([{"id": "rec-5", "node_id": "1-5", "status": "CURRENT"}]),
        MockResponse([{"id": "rec-6", "node_id": "2-1", "status": "CURRENT"}])
    ]
    
    evaluate_node_advancement(client, "user-123")
    
    # Should see region 1 shifted
    client.table("journey_regions").update.assert_any_call({
        "status": "SHIFTED", "shifted_at": "now()"
    })
    # Should see region 2 upserted
    client.table("journey_regions").upsert.assert_any_call({
        "user_id": "user-123", "region_id": "2", "status": "CURRENT"
    })

