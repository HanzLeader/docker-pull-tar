# 标准库
import asyncio
from pathlib import Path

# 第三方库
from fastapi import APIRouter, BackgroundTasks

# 本地模块
from ..models.schemas import DownloadRequest, DownloadStatus
from ..services.log_websocket import log_manager
from ..services.docker_pull import pull_service

router = APIRouter(prefix="/api", tags=["download"])

download_state = {
    "status": DownloadStatus.idle,
    "packageName": "",
    "username": None,
    "password": None,
    "progress": {
        "currentLayer": 0,
        "totalLayers": 0,
        "downloadedBytes": 0,
        "totalBytes": 0,
        "speed": 0,
        "layers": []
    }
}


async def run_download(request: DownloadRequest):
    """执行下载任务"""
    download_state["status"] = DownloadStatus.downloading
    download_state["packageName"] = request.packageName

    try:
        success = await pull_service.download_image(
            package_name=request.packageName,
            tag=request.tag or "latest",
            arch=request.arch or "amd64",
            registry=request.mirror or "docker.1ms.run",
            output_dir=request.outputDir or str(Path.home() / "Downloads"),
            username=request.username,
            password=request.password
        )

        if success:
            download_state["status"] = DownloadStatus.completed
        else:
            download_state["status"] = DownloadStatus.failed

    except Exception as e:
        download_state["status"] = DownloadStatus.failed
        await log_manager.send_log("error", f"下载异常: {str(e)}")


@router.post("/download/start")
async def start_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    global download_state

    if download_state["status"] not in [DownloadStatus.idle, DownloadStatus.completed, DownloadStatus.failed, DownloadStatus.cancelled]:
        return {"error": "已有下载任务进行中"}

    # 重置状态
    download_state["status"] = DownloadStatus.preparing
    download_state["packageName"] = request.packageName
    download_state["username"] = request.username
    download_state["password"] = request.password
    download_state["progress"] = {
        "currentLayer": 0,
        "totalLayers": 0,
        "downloadedBytes": 0,
        "totalBytes": 0,
        "speed": 0,
        "layers": []
    }

    await log_manager.send_log("info", f"开始下载 {request.packageName}:{request.tag}")

    if request.username:
        await log_manager.send_log("info", f"使用认证: {request.username}")

    # 在后台启动下载任务
    background_tasks.add_task(run_download, request)

    return {
        "status": "started",
        "packageName": request.packageName,
        "authEnabled": request.username is not None
    }


@router.post("/download/cancel")
async def cancel_download():
    global download_state

    if download_state["status"] in [DownloadStatus.downloading, DownloadStatus.preparing]:
        pull_service.cancel()
        download_state["status"] = DownloadStatus.cancelled
        await log_manager.send_log("warning", "下载已取消")
        return {"status": "cancelled"}

    # 重置为 idle 状态
    download_state["status"] = DownloadStatus.idle
    return {"status": "idle"}


@router.get("/download/status")
async def get_download_status():
    return {
        "status": download_state["status"],
        "packageName": download_state["packageName"],
        **download_state["progress"]
    }