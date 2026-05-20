@echo off
cd /d C:\Users\mckel\postforge
git add src/middleware.ts
git commit -m "fix: ungate sitemap.xml and robots.txt in middleware"
git push
echo.
echo Done - sitemap fix deployed!
pause
