# 标准库
import json
import os
from pathlib import Path
from typing import Optional

# 本地模块
from models.schemas import ConfigData, MirrorSource, HistoryItem, Settings


class SettingsStore:
    """用户配置存储服务，管理设置、镜像源和历史记录。"""

    def __init__(self):
        self.config_dir = Path(os.environ.get("APPDATA", Path.home())) / "docker-pull-tar"
        self.config_file = self.config_dir / "config.json"
        self._ensure_config_dir()
        self._load_config()

    def _ensure_config_dir(self):
        """确保配置目录存在。"""
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _get_default_mirrors(self) -> list[dict]:
        """返回默认镜像源列表。"""
        return [
            {"id": "dockerhub", "name": "Docker Hub", "registry": "registry-1.docker.io", "isDefault": False},
            {"id": "1ms", "name": "1ms.run", "registry": "docker.1ms.run", "isDefault": True},
            {"id": "daocloud", "name": "DaoCloud", "registry": "docker.m.daocloud.io", "isDefault": False},
            {"id": "xuanyuan", "name": "轩辕", "registry": "docker.xuanyuan.me", "isDefault": False},
        ]

    def _load_config(self):
        """加载配置文件，失败时使用默认配置。"""
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.config = ConfigData(**data)
            except (json.JSONDecodeError, ValueError):
                # 解析失败时使用默认配置
                self.config = ConfigData(mirrors=[MirrorSource(**m) for m in self._get_default_mirrors()])
        else:
            self.config = ConfigData(mirrors=[MirrorSource(**m) for m in self._get_default_mirrors()])
            self._save_config()

    def _save_config(self):
        """保存配置到文件。"""
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(self.config.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def get_settings(self) -> Settings:
        """获取用户设置。"""
        return self.config.settings

    def update_settings(self, settings: Settings) -> Settings:
        """更新用户设置并保存。"""
        self.config.settings = settings
        self._save_config()
        return self.config.settings

    def get_mirrors(self) -> list[MirrorSource]:
        """获取镜像源列表。"""
        return self.config.mirrors

    def add_mirror(self, mirror: MirrorSource) -> MirrorSource:
        """添加新镜像源。"""
        self.config.mirrors.append(mirror)
        self._save_config()
        return mirror

    def update_mirror(self, mirror_id: str, mirror: MirrorSource) -> Optional[MirrorSource]:
        """更新指定镜像源。"""
        for i, m in enumerate(self.config.mirrors):
            if m.id == mirror_id:
                self.config.mirrors[i] = mirror
                self._save_config()
                return mirror
        return None

    def delete_mirror(self, mirror_id: str) -> bool:
        """删除指定镜像源。"""
        self.config.mirrors = [m for m in self.config.mirrors if m.id != mirror_id]
        self._save_config()
        return True

    def set_default_mirror(self, mirror_id: str) -> bool:
        """设置默认镜像源。"""
        for m in self.config.mirrors:
            m.isDefault = (m.id == mirror_id)
        default_registry = next((m.registry for m in self.config.mirrors if m.isDefault), "docker.1ms.run")
        self.config.settings.defaultMirror = default_registry
        self._save_config()
        return True

    def get_history(self) -> list[HistoryItem]:
        """获取下载历史记录。"""
        return self.config.history

    def add_history(self, item: HistoryItem) -> HistoryItem:
        """添加历史记录，超过100条时保留最新。"""
        self.config.history.append(item)
        if len(self.config.history) > 100:
            self.config.history = self.config.history[-100:]
        self._save_config()
        return item

    def delete_history(self, item_id: str) -> bool:
        """删除指定历史记录。"""
        self.config.history = [h for h in self.config.history if h.id != item_id]
        self._save_config()
        return True

    def clear_history(self) -> bool:
        """清空所有历史记录。"""
        self.config.history = []
        self._save_config()
        return True