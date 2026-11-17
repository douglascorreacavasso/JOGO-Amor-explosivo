@echo off
chcp 65001 >nul
title AMOR EXPLOSIVO
cd /d "%~dp0"
echo.
echo   Iniciando o Amor Explosivo...
echo   (o navegador abre sozinho; no celular use o link do GitHub Pages)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ferramentas\servidor_local.ps1"
if errorlevel 1 pause
