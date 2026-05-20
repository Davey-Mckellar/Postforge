@echo off
echo ========================================
echo  bbGPT SEO Fix Deploy
echo ========================================
cd /d C:\Users\mckel\postforge
echo.
echo Current git status:
git status
echo.
echo Staging all changes...
git add src/middleware.ts src/app/ai-developer-alex/page.tsx src/app/sitemap.ts public/robots.txt
echo.
echo Committing...
git commit -m "fix: ungate SEO pages in middleware + add /ai-developer-alex page, sitemap, robots.txt

- middleware.ts: add public route exceptions for all SEO landing pages
  (/chatgpt-alternative, /claude-alternative, /gemini-alternative,
  /perplexity-alternative, /ai-chat-credits, /ai-developer-alex)
- src/app/ai-developer-alex/page.tsx: new SEO page targeting AI developer queries
- src/app/sitemap.ts: dynamic sitemap covering all public pages
- public/robots.txt: allow crawling, point to sitemap"
echo.
echo Pushing to origin...
git push
echo.
echo ========================================
echo  Done! Vercel will auto-deploy in ~60s
echo ========================================
pause
