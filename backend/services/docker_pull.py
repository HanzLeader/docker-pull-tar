# 标准库
import asyncio
import gzip
import hashlib
import json
import os
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any

# 第三方库
import base64
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3

# 本地模块
from models.schemas import DownloadStatus
from services.log_websocket import log_manager
from services.settings_store import SettingsStore

urllib3.disable_warnings()


@dataclass
class ImageInfo:
    registry: str
    repository: str
    image_name: str
    tag: str


@dataclass
class DownloadStats:
    total_size: int = 0
    downloaded_size: int = 0
    start_time: float = 0.0
    speeds: List[float] = field(default_factory=list)

    def get_avg_speed(self) -> float:
        if not self.speeds:
            return 0.0
        return sum(self.speeds[-10:]) / len(self.speeds[-10:])


class DockerPullService:
    """Docker 镜像下载服务"""

    def __init__(self):
        self.stop_event = threading.Event()
        self.progress_data = {}
        self.session = self._create_session()
        self.settings_store = SettingsStore()

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=5,
            backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "HEAD", "OPTIONS"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.timeout = (30, 300)
        return session

    def parse_image_input(self, image_input: str, custom_registry: Optional[str] = None) -> ImageInfo:
        """解析镜像输入"""
        if '/' in image_input and ('.' in image_input.split('/')[0] or ':' in image_input.split('/')[0]):
            registry, remainder = image_input.split('/', 1)
            parts = remainder.split('/')
            if len(parts) == 1:
                repo = ''
                img_tag = parts[0]
            else:
                repo = '/'.join(parts[:-1])
                img_tag = parts[-1]
            img, *tag_parts = img_tag.split(':')
            tag = tag_parts[0] if tag_parts else 'latest'
            repository = remainder.split(':')[0]
            return ImageInfo(registry, repository, img, tag)
        else:
            parts = image_input.split('/')
            if len(parts) == 1:
                repo = 'library'
                img_tag = parts[0]
            else:
                repo = '/'.join(parts[:-1])
                img_tag = parts[-1]
            img, *tag_parts = img_tag.split(':')
            tag = tag_parts[0] if tag_parts else 'latest'
            repository = f'{repo}/{img}'
            registry = custom_registry or 'registry-1.docker.io'
            return ImageInfo(registry, repository, img, tag)

    async def _send_log(self, level: str, message: str):
        await log_manager.send_log(level, message)

    async def _send_progress(self, data: dict):
        await log_manager.send_progress(data)

    def get_auth_head(self, registry: str, repository: str, username: Optional[str] = None, password: Optional[str] = None) -> Dict[str, str]:
        """获取认证头"""
        try:
            url = f'https://{registry}/v2/'
            resp = self.session.get(url, verify=False, timeout=30)

            if 'WWW-Authenticate' not in resp.headers:
                return {'Accept': 'application/vnd.docker.distribution.manifest.v2+json'}

            auth_url = resp.headers['WWW-Authenticate'].split('"')[1]
            reg_service = resp.headers['WWW-Authenticate'].split('"')[3]

            auth_req_url = f'{auth_url}?service={reg_service}&scope=repository:{repository}:pull'

            headers = {}
            if username and password:
                auth_string = f"{username}:{password}"
                encoded_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
                headers['Authorization'] = f'Basic {encoded_auth}'

            auth_resp = self.session.get(auth_req_url, headers=headers, verify=False, timeout=30)
            auth_resp.raise_for_status()
            access_token = auth_resp.json()['token']

            return {
                'Authorization': f'Bearer {access_token}',
                'Accept': ', '.join([
                    'application/vnd.docker.distribution.manifest.v2+json',
                    'application/vnd.docker.distribution.manifest.list.v2+json',
                    'application/vnd.oci.image.index.v1+json',
                    'application/vnd.oci.image.manifest.v1+json',
                ])
            }
        except Exception as e:
            return {'Accept': 'application/vnd.docker.distribution.manifest.v2+json'}

    async def download_image(
        self,
        package_name: str,
        tag: str,
        arch: str,
        registry: str,
        output_dir: str,
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> bool:
        """下载 Docker 镜像"""
        try:
            self.stop_event.clear()

            # 解析镜像信息
            full_image = f"{registry}/{package_name}"
            image_info = self.parse_image_input(full_image)
            image_info.tag = tag

            await self._send_log("info", f"🚀 开始下载 {image_info.repository}:{tag}")
            await self._send_log("info", f"📦 镜像源: {registry}")
            await self._send_log("info", f"📦 架构: {arch}")

            if username:
                await self._send_log("info", f"🔐 使用认证: {username}")

            # 准备输出目录
            safe_repo = image_info.repository.replace("/", "_").replace(":", "_")
            dir_name = f"{safe_repo}_{tag}_{arch}"
            output_path = Path(output_dir) / dir_name
            output_path.mkdir(parents=True, exist_ok=True)

            await self._send_log("info", f"📁 输出目录: {output_path}")

            # 获取认证 - 使用 asyncio.to_thread 避免阻塞事件循环
            auth_head = await asyncio.to_thread(self.get_auth_head, registry, image_info.repository, username, password)

            # 获取 manifest
            manifest_url = f'https://{registry}/v2/{image_info.repository}/manifests/{tag}'
            resp = await asyncio.to_thread(self.session.get, manifest_url, headers=auth_head, verify=False, timeout=60)

            if resp.status_code == 401:
                await self._send_log("error", "认证失败，请检查用户名密码")
                return False

            resp.raise_for_status()
            manifest = resp.json()

            # 处理多架构 manifest
            if 'manifests' in manifest:
                # 选择指定架构
                digest = None
                media_type = None
                for m in manifest['manifests']:
                    platform = m.get('platform', {})
                    if platform.get('architecture') == arch and platform.get('os') == 'linux':
                        digest = m.get('digest')
                        media_type = m.get('mediaType', 'application/vnd.docker.distribution.manifest.v2+json')
                        break

                if not digest:
                    await self._send_log("error", f"找不到架构 {arch} 的镜像")
                    return False

                await self._send_log("info", f"找到架构 {arch} 的 manifest: {digest[:20]}...")

                # 获取具体架构的 manifest - 使用正确的 Accept header
                arch_headers = auth_head.copy()
                arch_headers['Accept'] = media_type

                manifest_url = f'https://{registry}/v2/{image_info.repository}/manifests/{digest}'
                resp = await asyncio.to_thread(self.session.get, manifest_url, headers=arch_headers, verify=False, timeout=60)

                if resp.status_code != 200:
                    await self._send_log("error", f"获取架构 manifest 失败: {resp.status_code}")
                    return False

                resp.raise_for_status()
                manifest = resp.json()

            layers = manifest.get('layers', [])
            config_digest = manifest.get('config', {}).get('digest')

            if not layers:
                await self._send_log("error", "镜像没有层信息")
                return False

            total_layers = len(layers)
            await self._send_log("info", f"📦 共 {total_layers} 个层需要下载")

            # 初始化进度
            total_bytes = sum(l.get('size', 0) for l in layers)
            self.progress_data = {
                "totalLayers": total_layers,
                "currentLayer": 0,
                "downloadedBytes": 0,
                "totalBytes": total_bytes,
                "speed": 0,
                "layers": [{"digest": l['digest'][:12], "size": l.get('size', 0), "status": "waiting", "downloaded": 0, "total": l.get('size', 0)} for l in layers]
            }

            await self._send_progress(self.progress_data)
            await self._send_log("info", f"📦 镜像总大小: {self._format_size(total_bytes)}")

            # 下载层
            imgdir = str(output_path / 'layers')
            os.makedirs(imgdir, exist_ok=True)

            stats = DownloadStats()
            parentid = ''
            layer_json_map = {}
            content = [{'Config': '', 'RepoTags': [f'{image_info.repository}:{tag}'], 'Layers': []}]

            for idx, layer in enumerate(layers):
                if self.stop_event.is_set():
                    await self._send_log("warning", "下载已取消")
                    return False

                layer_digest = layer['digest']
                layer_size = layer.get('size', 0)

                # 更新进度
                self.progress_data["currentLayer"] = idx + 1
                self.progress_data["layers"][idx]["status"] = "downloading"
                await self._send_progress(self.progress_data)

                await self._send_log("info", f"⬇️ 下载 Layer {idx+1}/{total_layers}: {layer_digest[:12]} ({self._format_size(layer_size)})")

                # 创建层目录
                fake_layerid = hashlib.sha256((parentid + '\n' + layer_digest + '\n').encode('utf-8')).hexdigest()
                layerdir = f'{imgdir}/{fake_layerid}'
                os.makedirs(layerdir, exist_ok=True)
                layer_json_map[fake_layerid] = {"id": fake_layerid, "parent": parentid if parentid else None}
                parentid = fake_layerid

                # 下载层文件
                url = f'https://{registry}/v2/{image_info.repository}/blobs/{layer_digest}'
                save_path = f'{layerdir}/layer_gzip.tar'

                success = await self._download_layer(url, auth_head, save_path, layer_digest, layer_size, stats)

                if not success:
                    self.progress_data["layers"][idx]["status"] = "failed"
                    await self._send_progress(self.progress_data)
                    await self._send_log("error", f"❌ Layer {idx+1} 下载失败")
                    return False

                self.progress_data["layers"][idx]["status"] = "completed"
                self.progress_data["downloadedBytes"] = int(stats.downloaded_size)
                if stats.speeds:
                    self.progress_data["speed"] = int(stats.get_avg_speed())
                await self._send_progress(self.progress_data)

                await self._send_log("info", f"✅ Layer {idx+1} 完成")

            # 下载 config
            if config_digest:
                await self._send_log("info", "⬇️ 下载 Config 文件")
                config_filename = f'{config_digest[7:]}.json'
                config_path = os.path.join(imgdir, config_filename)
                config_url = f'https://{registry}/v2/{image_info.repository}/blobs/{config_digest}'

                def download_config():
                    resp = self.session.get(config_url, headers=auth_head, verify=False, timeout=60, stream=True)
                    resp.raise_for_status()
                    with open(config_path, 'wb') as f:
                        for chunk in resp.iter_content(chunk_size=65536):
                            f.write(chunk)

                await asyncio.to_thread(download_config)
                content[0]['Config'] = config_filename

            # 解压层文件并构建 manifest
            await self._send_log("info", "📦 正在处理层文件...")

            for fake_layerid in layer_json_map.keys():
                layerdir = f'{imgdir}/{fake_layerid}'
                gz_path = f'{layerdir}/layer_gzip.tar'
                tar_path = f'{layerdir}/layer.tar'

                if os.path.exists(gz_path):
                    with gzip.open(gz_path, 'rb') as gz, open(tar_path, 'wb') as file:
                        shutil.copyfileobj(gz, file)
                    os.remove(gz_path)

                json_path = f'{layerdir}/json'
                with open(json_path, 'w') as file:
                    json.dump(layer_json_map[fake_layerid], file)

                content[0]['Layers'].append(f'{fake_layerid}/layer.tar')

            # 写入 manifest.json
            manifest_path = os.path.join(imgdir, 'manifest.json')
            with open(manifest_path, 'w') as file:
                json.dump(content, file)

            # 写入 repositories
            repositories_path = os.path.join(imgdir, 'repositories')
            with open(repositories_path, 'w') as file:
                repo_name = image_info.repository if '/' in image_info.repository else image_info.image_name
                json.dump({repo_name: {tag: parentid}}, file)

            # 创建最终 tar 文件
            await self._send_log("info", "📦 正在打包镜像...")

            docker_tar = str(output_path / f'{safe_repo}_{tag}_{arch}.tar')
            import tarfile
            with tarfile.open(docker_tar, "w") as tar:
                tar.add(imgdir, arcname='/')

            # 清理 layers 目录
            shutil.rmtree(imgdir, ignore_errors=True)

            # 保存历史记录
            self._save_history(
                package_name, tag, arch, registry,
                f"{registry}/{image_info.repository}:{tag}",
                docker_tar
            )

            await self._send_log("success", f"✅ 下载完成！文件保存至: {docker_tar}")
            await self._send_log("info", f"💡 导入命令: docker load -i {docker_tar}")

            if stats.start_time > 0:
                elapsed = time.time() - stats.start_time
                avg_speed = stats.get_avg_speed()
                await self._send_log("info", f"📊 平均速度: {self._format_size(int(avg_speed))}/s，耗时: {elapsed:.1f}s")

            return True

        except Exception as e:
            await self._send_log("error", f"❌ 下载失败: {str(e)}")
            return False

    async def _download_layer(self, url: str, headers: Dict, save_path: str, digest: str, expected_size: int, stats: DownloadStats) -> bool:
        """下载单个层 - 使用线程池避免阻塞事件循环"""
        layer_idx = self.progress_data.get("currentLayer", 1) - 1

        def sync_download():
            sha256_hash = hashlib.sha256()
            downloaded = 0

            resp = self.session.get(url, headers=headers, verify=False, timeout=120, stream=True)
            resp.raise_for_status()

            total_size = int(resp.headers.get('content-length', expected_size))
            stats.total_size += total_size
            if stats.start_time == 0:
                stats.start_time = time.time()

            last_time = time.time()
            last_downloaded = 0

            with open(save_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    if self.stop_event.is_set():
                        return False, 0, 0

                    if chunk:
                        f.write(chunk)
                        sha256_hash.update(chunk)
                        downloaded += len(chunk)
                        stats.downloaded_size += len(chunk)

                        # 计算速度
                        current_time = time.time()
                        if current_time - last_time >= 0.5:
                            speed = (downloaded - last_downloaded) / (current_time - last_time)
                            stats.speeds.append(speed)
                            last_downloaded = downloaded
                            last_time = current_time

            actual_digest = f'sha256:{sha256_hash.hexdigest()}'
            return True, downloaded, total_size

        # 使用线程池执行下载，每隔一段时间检查进度
        loop = asyncio.get_event_loop()
        future = loop.run_in_executor(None, sync_download)

        # 定期检查进度并发送更新
        while not future.done():
            await asyncio.sleep(1.0)  # 每秒检查一次
            if not future.done():
                self.progress_data["downloadedBytes"] = int(stats.downloaded_size)
                self.progress_data["speed"] = int(stats.get_avg_speed())
                if layer_idx >= 0 and layer_idx < len(self.progress_data.get("layers", [])):
                    self.progress_data["layers"][layer_idx]["downloaded"] = stats.downloaded_size
                    self.progress_data["layers"][layer_idx]["total"] = expected_size
                await self._send_progress(self.progress_data)

        # 获取结果
        try:
            success, downloaded, total_size = future.result()
            if success:
                self.progress_data["downloadedBytes"] = int(stats.downloaded_size)
                self.progress_data["speed"] = int(stats.get_avg_speed())
                if layer_idx >= 0 and layer_idx < len(self.progress_data.get("layers", [])):
                    self.progress_data["layers"][layer_idx]["downloaded"] = downloaded
                    self.progress_data["layers"][layer_idx]["total"] = total_size
                await self._send_progress(self.progress_data)
            return success
        except Exception as e:
            await self._send_log("error", f"下载层失败: {str(e)}")
            return False

    def _format_size(self, size: int) -> str:
        """格式化大小"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f}{unit}"
            size /= 1024
        return f"{size:.1f}TB"

    def _save_history(self, package_name: str, tag: str, arch: str, registry: str, full_image: str, output_path: str):
        """保存下载历史"""
        import uuid
        from models.schemas import HistoryItem

        item = HistoryItem(
            id=str(uuid.uuid4()),
            packageName=package_name,
            tag=tag,
            arch=arch,
            mirror=registry,
            fullImage=full_image,
            status=DownloadStatus.completed,
            outputPath=output_path,
            downloadedAt=datetime.now(),
            size=self._format_size(os.path.getsize(output_path) if os.path.exists(output_path) else 0)
        )
        self.settings_store.add_history(item)

    def cancel(self):
        """取消下载"""
        self.stop_event.set()


# 全局下载服务实例
pull_service = DockerPullService()