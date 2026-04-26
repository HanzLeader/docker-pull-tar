# 标准库
import asyncio
import traceback
from pathlib import Path

# 第三方库
from fastapi import APIRouter

# 本地模块
from models.schemas import DownloadRequest, DownloadStatus
from services.log_websocket import log_manager
from services.docker_pull import pull_service

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

download_task = None


async def run_download_task(request: DownloadRequest):
    """执行下载任务"""
    global download_state

    download_state["status"] = DownloadStatus.downloading

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
            await log_manager.send_log("success", "下载完成！")
        else:
            download_state["status"] = DownloadStatus.failed
            await log_manager.send_log("error", "下载失败")

    except Exception as e:
        download_state["status"] = DownloadStatus.failed
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        await log_manager.send_log("error", f"下载异常: {error_msg}")
        print(f"Download error traceback:\n{traceback_str}")


@router.post("/download/start")
async def start_download(request: DownloadRequest):
    global download_state, download_task

    # 允许在失败/完成/取消后重新下载
    if download_state["status"] in [DownloadStatus.downloading, DownloadStatus.preparing]:
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

    await log_manager.send_log("info", f"开始下载 {request.packageName}:{request.tag or 'latest'}")
    await log_manager.send_log("info", f"镜像源: {request.mirror or 'docker.1ms.run'}")
    await log_manager.send_log("info", f"架构: {request.arch or 'amd64'}")

    if request.username:
        await log_manager.send_log("info", f"使用认证: {request.username}")

    # 使用 asyncio 创建后台任务
    download_task = asyncio.create_task(run_download_task(request))

    return {
        "status": "started",
        "packageName": request.packageName,
        "authEnabled": request.username is not None
    }


@router.post("/download/cancel")
async def cancel_download():
    global download_state, download_task

    if download_state["status"] in [DownloadStatus.downloading, DownloadStatus.preparing]:
        pull_service.cancel()
        download_state["status"] = DownloadStatus.cancelled

        if download_task:
            download_task.cancel()
            download_task = None

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