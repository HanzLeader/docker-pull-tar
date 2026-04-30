# 标准库
import uuid
from datetime import datetime

# 第三方库
from fastapi import APIRouter

# 本地模块
from models.schemas import HistoryItem
from services.settings_store import SettingsStore

router = APIRouter(prefix="/api", tags=["history"])

@router.get("/history")
async def get_history():
    # 每次请求都创建新实例，确保读取最新的配置文件
    store = SettingsStore()
    return store.get_history()

@router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    store = SettingsStore()
    return {"success": store.delete_history(item_id)}

@router.delete("/history")
async def clear_history():
    store = SettingsStore()
    return {"success": store.clear_history()}