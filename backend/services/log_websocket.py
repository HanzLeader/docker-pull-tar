import asyncio
import json
from datetime import datetime
from typing import Set
from fastapi import WebSocket

class LogWebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def send_log(self, level: str, message: str):
        log_data = {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        for connection in self.active_connections:
            try:
                await connection.send_json(log_data)
            except Exception:
                pass

    async def send_progress(self, progress_data: dict):
        data = {
            "type": "progress",
            **progress_data
        }
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                pass

log_manager = LogWebSocketManager()