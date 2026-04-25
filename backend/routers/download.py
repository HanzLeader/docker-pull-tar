from fastapi import APIRouter
from models.schemas import DownloadRequest, DownloadStatus
from services.log_websocket import log_manager
import asyncio

router = APIRouter(prefix="/api", tags=["download"])

download_state = {
    "status": DownloadStatus.idle,
    "packageName": "",
    "progress": {
        "currentLayer": 0,
        "totalLayers": 0,
        "downloadedBytes": 0,
        "totalBytes": 0,
        "speed": 0,
        "layers": []
    }
}

download_task = None

@router.post("/download/start")
async def start_download(request: DownloadRequest):
    global download_task, download_state

    if download_state["status"] != DownloadStatus.idle:
        return {"error": "已有下载任务进行中"}

    download_state["status"] = DownloadStatus.preparing
    download_state["packageName"] = request.packageName

    await log_manager.send_log("info", f"开始下载 {request.packageName}:{request.tag}")

    return {"status": "started", "packageName": request.packageName}

@router.post("/download/cancel")
async def cancel_download():
    global download_state

    if download_state["status"] in [DownloadStatus.downloading, DownloadStatus.preparing]:
        download_state["status"] = DownloadStatus.cancelled
        await log_manager.send_log("warning", "下载已取消")
        return {"status": "cancelled"}

    return {"status": "idle"}

@router.get("/download/status")
async def get_download_status():
    return {
        "status": download_state["status"],
        "packageName": download_state["packageName"],
        **download_state["progress"]
    }