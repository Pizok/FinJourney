import pytest
from unittest.mock import AsyncMock, patch

from app.api.v1.profile import save_baselines
from app.api.v1.dependencies import CurrentUser

@pytest.mark.asyncio
async def test_save_baselines_triggers_advancement(mocker):
    """
    Tests that completing the baselines setup explicitly calls 
    the journey advancement engine to seed the first region and node.
    """
    # 1. Mock dependencies
    user = CurrentUser(user_id="test-user", level=1)
    
    # Mock the DB client and its chain of calls
    mock_execute = AsyncMock(return_value=None)
    mock_eq = mocker.MagicMock()
    mock_eq.execute = mock_execute
    mock_update = mocker.MagicMock(return_value=mock_eq)
    mock_delete = mocker.MagicMock(return_value=mock_eq)
    mock_insert = mocker.MagicMock(return_value=mock_execute)
    
    # Mock table method to return appropriate chained mocks
    mock_table = mocker.MagicMock()
    def table_side_effect(table_name):
        mock_chain = mocker.MagicMock()
        mock_chain.delete = mocker.MagicMock(return_value=mock_eq)
        mock_chain.insert = mocker.MagicMock(return_value=mock_execute)
        mock_chain.update = mocker.MagicMock(return_value=mock_eq)
        return mock_chain
        
    mock_table.side_effect = table_side_effect
    
    mock_db = mocker.MagicMock()
    mock_db.table = mock_table
    
    # Mock evaluate_node_advancement
    mock_evaluate = AsyncMock()
    mocker.patch("app.journey.services.advancement_svc.evaluate_node_advancement", new=mock_evaluate)
    
    # Payload
    payload = {
        "incomeEntries": [{"id": "1", "label": "Salary", "amount": 5000}],
        "fixedCostEntries": [{"id": "2", "label": "Rent", "amount": 1000}],
        "savingsTarget": 500
    }
    
    # 2. Execute
    response = await save_baselines(user, mock_db, payload)
    
    # 3. Assertions
    assert response == {"success": True, "data": {}}
    
    # Assert the engine was called exactly once with the correct arguments
    mock_evaluate.assert_called_once_with(mock_db, "test-user")


@pytest.mark.asyncio
async def test_save_baselines_advancement_failure_is_caught(mocker):
    """
    Tests that a failure in the journey engine seeding does not break 
    the successful onboarding response.
    """
    user = CurrentUser(user_id="test-user", level=1)
    
    mock_execute = AsyncMock(return_value=None)
    mock_eq = mocker.MagicMock()
    mock_eq.execute = mock_execute
    
    mock_table = mocker.MagicMock()
    def table_side_effect(table_name):
        mock_chain = mocker.MagicMock()
        mock_chain.delete = mocker.MagicMock(return_value=mock_eq)
        mock_chain.insert = mocker.MagicMock(return_value=mock_execute)
        mock_chain.update = mocker.MagicMock(return_value=mock_eq)
        return mock_chain
        
    mock_table.side_effect = table_side_effect
    
    mock_db = mocker.MagicMock()
    mock_db.table = mock_table
    
    # Mock evaluate_node_advancement to throw an error
    mock_evaluate = AsyncMock(side_effect=Exception("Database seeding error"))
    mocker.patch("app.journey.services.advancement_svc.evaluate_node_advancement", new=mock_evaluate)
    
    payload = {
        "incomeEntries": [],
        "fixedCostEntries": [],
        "savingsTarget": 0
    }
    
    # Execute - should not raise exception
    response = await save_baselines(user, mock_db, payload)
    
    # It should still return success for the profile save
    assert response == {"success": True, "data": {}}
    mock_evaluate.assert_called_once_with(mock_db, "test-user")
