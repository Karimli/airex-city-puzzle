@echo off
rem AIREX City Puzzle — kioskda Google Chrome-u tam ekran (kiosk rejimi) açır.
rem Windows açılanda avtomatik işə düşsün deyə: Win+R -> shell:startup -> bu faylı ora kopyalayın.
rem Chrome kiosk rejimi adi profildə işləyir: nəticələr və növbə brauzer bağlansa da silinmir.

set "URL=https://karimli.github.io/airex-city-puzzle/"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome tapilmadi. Zehmet olmasa Chrome-u qurun.
  pause
  exit /b 1
)

rem Windows açılan kimi şəbəkə hələ hazır olmaya bilər — bir az gözlə
timeout /t 10 /nobreak >nul

start "" "%CHROME%" --kiosk --no-first-run --disable-pinch --overscroll-history-navigation=0 --disable-session-crashed-bubble --disable-features=Translate "%URL%"
