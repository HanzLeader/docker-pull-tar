# 标准库
import uuid

# 第三方库
from fastapi import APIRouter, HTTPException

# 本地模块
from ..models.schemas import Settings, MirrorSource
from ..services.settings_store import SettingsStore

router = APIRouter(prefix="/api", tags=["settings"])
store = SettingsStore()

@router.get("/settings")
async def get_settings() -> Settings:
    """获取用户设置。"""
    return store.get_settings()

@router.post("/settings")
async def update_settings(settings: Settings) -> Settings:
    """更新用户设置。"""
    return store.update_settings(settings)

@router.get("/mirrors")
async def get_mirrors() -> list[MirrorSource]:
    """获取镜像源列表。"""
    return store.get_mirrors()

@router.post("/mirrors")
async def add_mirror(mirror: MirrorSource) -> MirrorSource:
    """添加新镜像源。"""
    if not mirror.id:
        mirror.id = f"custom-{uuid.uuid4().hex[:8]}"
    return store.add_mirror(mirror)

@router.put("/mirrors/{mirror_id}")
async def update_mirror(mirror_id: str, mirror: MirrorSource) -> MirrorSource:
    """更新指定镜像源。"""
    result = store.update_mirror(mirror_id, mirror)
    if not result:
        raise HTTPException(status_code=404, detail="镜像源不存在")
    return result

@router.delete("/mirrors/{mirror_id}")
async def delete_mirror(mirror_id: str) -> dict[str, bool]:
    """删除指定镜像源。"""
    return {"success": store.delete_mirror(mirror_id)}

@router.post("/mirrors/{mirror_id}/default")
async def set_default_mirror(mirror_id: str) -> dict[str, bool]:
    """设置默认镜像源。"""
    return {"success": store.set_default_mirror(mirror_id)}