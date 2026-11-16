@echo off
rem Kiosk ekranini to'liq ekran rejimida ochadi (server ishlab turgan bo'lishi kerak: start.bat).
rem Bir nechta kiosk bo'lsa, manzil oxiriga ?kiosk=ID qo'shing (ID admin paneldagi kiosk nuqtasida ko'rsatiladi).
set "URL=http://127.0.0.1:3100/"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

rem --use-fake-ui-for-media-stream: mikrofon ruxsati so'ralmasdan beriladi
rem --autoplay-policy=...: javob ovozi birinchi bosishsiz ham chiqadi
start "" "%CHROME%" --kiosk "%URL%" --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --noerrdialogs --disable-pinch --overscroll-history-navigation=0 --disable-session-crashed-bubble
