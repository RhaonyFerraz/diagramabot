@echo off
setlocal enabledelayedexpansion
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul

set RAYLIB_DIR=vendor\raylib-6.0_win64_msvc16
set CFLAGS=/nologo /W3 /O2 /MD /D_CRT_SECURE_NO_WARNINGS /I"%RAYLIB_DIR%\include" /I"src"
set LDFLAGS=/link /LIBPATH:"%RAYLIB_DIR%\lib" raylib.lib user32.lib gdi32.lib winmm.lib shell32.lib opengl32.lib

if not exist bin mkdir bin

echo Compilando DiagramaBot em C...
cl %CFLAGS% /Fe"bin\diagramabot.exe" src\main.c src\diagram.c src\renderer.c src\ui.c src\storage.c src\templates.c %LDFLAGS%

if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo  DiagramaBot compilado com sucesso em bin\diagramabot.exe!
    echo ========================================================
) else (
    echo [ERRO] Falha na compilacao!
)
