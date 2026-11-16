@echo off
rem ACCESS serverini ishga tushiradi (birinchi marta kutubxonalarni o'rnatadi).
cd /d "%~dp0"
if not exist node_modules (
  echo Kutubxonalar o'rnatilmoqda...
  call npm install --no-audit --no-fund || goto :error
)
call npm start
goto :eof

:error
echo.
echo Xato yuz berdi. Node.js 22.13 yoki undan yangi versiya o'rnatilganini tekshiring.
pause
