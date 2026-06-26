import sys
import os
import uuid
from dotenv import load_dotenv

sys.path.append(os.path.join(os.getcwd(), 'src'))
load_dotenv(os.path.join('src', '.env.local'))
load_dotenv(os.path.join('src', '.env'))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

from app.api.v1.dependencies import CurrentUserID
from app.api.v1.dependencies import DBClient

def override_current_user():
    return uuid.UUID("00000000-0000-0000-0000-000000000001")

app.dependency_overrides[CurrentUserID] = override_current_user

response = client.get("/api/v1/journey/overview")
print("STATUS:", response.status_code)
print("BODY:", response.text)
