from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from pathlib import Path


class DownloadStatus(str, Enum):
    idle = "idle"
    preparing = "preparing"
    downloading = "downloading"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class MirrorSource(BaseModel):
    id: str
    name: str
    registry: str
    isDefault: bool = False


class Settings(BaseModel):
    defaultOutputDir: str = str(Path.home() / "Downloads")
    defaultArch: str = "amd64"
    defaultMirror: str = "docker.1ms.run"
    downloadWorkers: int = Field(default=4, ge=1, le=16)
    # Docker Registry 认证
    registryUsername: Optional[str] = None
    registryPassword: Optional[str] = None


class DownloadRequest(BaseModel):
    packageName: str
    tag: Optional[str] = "latest"
    arch: Optional[str] = None
    mirror: Optional[str] = None
    outputDir: Optional[str] = None
    # 认证信息（可选，用于私有仓库）
    username: Optional[str] = None
    password: Optional[str] = None


class DownloadProgress(BaseModel):
    status: DownloadStatus
    packageName: str
    currentLayer: int
    totalLayers: int
    downloadedBytes: int
    totalBytes: int
    speed: float
    layers: List[Dict[str, Any]]


class HistoryItem(BaseModel):
    id: str
    packageName: str
    tag: str
    arch: str
    mirror: str
    fullImage: str
    status: DownloadStatus
    outputPath: Optional[str] = None
    downloadedAt: Optional[datetime] = None
    size: Optional[str] = None
    error: Optional[str] = None


class ConfigData(BaseModel):
    version: str = "1.0"
    settings: Settings = Settings()
    mirrors: List[MirrorSource] = Field(default_factory=list)
    history: List[HistoryItem] = Field(default_factory=list)


class LogMessage(BaseModel):
    type: str = "log"
    level: str
    message: str
    timestamp: datetime