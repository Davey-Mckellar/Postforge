@echo off
cd /d C:\Users\mckel\postforge
git add src/app/layout.tsx
git commit -m "chore: add Google Search Console HTML tag verification"
git push
echo.
echo Done - verification meta tag deployed!
pause
