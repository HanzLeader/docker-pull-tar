@echo off
chcp 65001 > nul
echo ========================================
echo   Docker Pull Tar Electron 打包脚本
echo ========================================
echo.

:: 检查 Python
echo [1/6] 检查 Python 环境...
python --version
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

:: 检查 Node.js
echo.
echo [2/6] 检查 Node.js 环境...
node --version
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 安装 Python 依赖
echo.
echo [3/6] 安装 Python 后端依赖...
cd backend
pip install -r requirements.txt --quiet
pip install pyinstaller --quiet
cd ..

:: 安装前端依赖
echo.
echo [4/6] 安装前端依赖...
cd frontend
if not exist "node_modules" (
    npm install
)
cd ..

:: 打包 Python 后端
echo.
echo [5/6] 打包 Python 后端为独立 exe...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
pyinstaller backend.spec --clean --noconfirm
if errorlevel 1 (
    echo.
    echo 错误: Python 后端打包失败！
    pause
    exit /b 1
)

:: 复制 backend.exe 到 backend-dist
if not exist "backend-dist" mkdir "backend-dist"
copy /Y "dist\backend.exe" "backend-dist\backend.exe" > nul
echo 已复制 backend.exe 到 backend-dist/

:: 打包 Electron 前端
echo.
echo [6/6] 打包 Electron 应用...
cd frontend
npm run electron:build
if errorlevel 1 (
    echo.
    echo 错误: Electron 打包失败！
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo   打包完成！
echo ========================================
echo.
echo 安装包位置: frontend\dist-electron
echo.
echo 请查看 frontend\dist-electron 目录中的安装程序
echo.
pause