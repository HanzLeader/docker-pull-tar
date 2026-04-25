from fastapi import APIRouter
from models.schemas import HistoryItem
from services.settings_store import SettingsStore
import uuid
from datetime import datetime

router = APIRouter(prefix="/api", tags=["history"])
store = SettingsStore()

@router.get("/history")
async def get_history():
    return store.get_history()

@router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    return {"success": store.delete_history(item_id)}

@router.delete("/history")
async def clear_history():
    return {"success": store.clear_history()}