"""
app/journey/services/advancement_svc.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handles node advancement via cumulative XP thresholds.
"""

from __future__ import annotations
import json
from uuid import UUID

from supabase import Client
from app.core.constants import NODE_XP_THRESHOLDS, GameEvent


def evaluate_node_advancement(client: Client, user_id: str) -> None:
    """
    Evaluates total_xp against cumulative thresholds. If the current node's 
    threshold is met or exceeded, the node is shifted, and the next node is unlocked.
    Handles multi-node skips by looping until the threshold is no longer met.
    """
    # 1. Fetch total_xp
    profile_res = (
        client.table("journey_profiles")
        .select("total_xp")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not profile_res.data:
        return
    total_xp = profile_res.data.get("total_xp", 0)

    # 2. Fetch thresholds from system_flags, fallback to constants
    flags_res = (
        client.table("system_flags")
        .select("value")
        .eq("key", "node_xp_thresholds")
        .execute()
    )
    thresholds = NODE_XP_THRESHOLDS
    if flags_res.data and "value" in flags_res.data[0]:
        try:
            val = flags_res.data[0]["value"]
            if isinstance(val, str):
                thresholds = json.loads(val)
            elif isinstance(val, dict):
                thresholds = val
        except Exception:
            pass

    # Ordered sequence of nodes
    node_sequence = list(thresholds.keys())
    if not node_sequence:
        return

    # Loop to handle multi-node skips
    while True:
        # 3. Fetch CURRENT node
        curr_node_res = (
            client.table("journey_region_nodes")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "CURRENT")
            .execute()
        )
        
        current_node_id = None
        current_record = None

        if not curr_node_res.data:
            # Seed the very first node if none exist
            first_node = node_sequence[0]
            region_id = first_node.split("-")[0]
            
            # Upsert region 1 if it doesn't exist
            client.table("journey_regions").upsert(
                {"user_id": user_id, "region_id": region_id, "status": "CURRENT"}
            ).execute()
            
            # Insert first node
            insert_res = client.table("journey_region_nodes").insert({
                "user_id": user_id,
                "node_id": first_node,
                "region_id": region_id,
                "status": "CURRENT",
                "unlocked_at": "now()"
            }).execute()
            
            current_record = insert_res.data[0]
            current_node_id = first_node
            
            client.table("journey_events").insert({
                "user_id": user_id,
                "event_type": GameEvent.NODE_UNLOCKED.value,
                "payload": {"node_id": current_node_id, "action": "SEED"}
            }).execute()
        else:
            current_record = curr_node_res.data[0]
            current_node_id = current_record["node_id"]

        # 4. Check threshold
        threshold = thresholds.get(current_node_id)
        if threshold is None or total_xp < threshold:
            break # Not enough XP to advance, break the loop

        # Threshold crossed! Shift it.
        client.table("journey_region_nodes").update({
            "status": "SHIFTED",
            "shifted_at": "now()"
        }).eq("id", current_record["id"]).execute()

        client.table("journey_events").insert({
            "user_id": user_id,
            "event_type": GameEvent.NODE_SHIFTED.value,
            "payload": {"node_id": current_node_id, "xp_at_shift": total_xp}
        }).execute()

        # 5. Determine next node
        try:
            curr_idx = node_sequence.index(current_node_id)
            next_idx = curr_idx + 1
            if next_idx < len(node_sequence):
                next_node_id = node_sequence[next_idx]
                next_region_id = next_node_id.split("-")[0]
                
                # Unlock next node
                client.table("journey_region_nodes").insert({
                    "user_id": user_id,
                    "node_id": next_node_id,
                    "region_id": next_region_id,
                    "status": "CURRENT",
                    "unlocked_at": "now()"
                }).execute()

                client.table("journey_events").insert({
                    "user_id": user_id,
                    "event_type": GameEvent.NODE_UNLOCKED.value,
                    "payload": {"node_id": next_node_id}
                }).execute()

                # Check region transition
                curr_region_id = current_node_id.split("-")[0]
                if curr_region_id != next_region_id:
                    # Current region completed
                    client.table("journey_regions").update({
                        "status": "SHIFTED",
                        "shifted_at": "now()"
                    }).eq("user_id", user_id).eq("region_id", curr_region_id).execute()
                    
                    # Next region unlocked
                    client.table("journey_regions").upsert(
                        {"user_id": user_id, "region_id": next_region_id, "status": "CURRENT"}
                    ).execute()
                    
                    client.table("journey_events").insert({
                        "user_id": user_id,
                        "event_type": GameEvent.REGION_COMPLETED.value,
                        "payload": {"region_id": curr_region_id}
                    }).execute()
            else:
                # All nodes completed! Final node shifted.
                curr_region_id = current_node_id.split("-")[0]
                client.table("journey_regions").update({
                    "status": "SHIFTED",
                    "shifted_at": "now()"
                }).eq("user_id", user_id).eq("region_id", curr_region_id).execute()
                break # Reached the end, no more nodes to process

        except ValueError:
            break # Node not in sequence, stop
