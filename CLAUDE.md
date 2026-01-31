# CLAUDE.md

## Project Overview

全息拉普拉斯互联网爬虫系统 - Multi-platform web crawler with visual UI.
Backend: Flask (Python 3.11). Frontend: Vanilla JS + Bootstrap 5. Deployment: Docker + Nginx.

## Project Structure

```
backend/
  crawler.py          # All crawler classes + data processing (~4300 lines)
  crawler_server.py   # Flask API server + route handlers (~3300 lines)
  requirements.txt
  tasks.json          # Runtime task persistence (do not commit with task data)

frontend/
  index.html          # Single page app
  script.js           # Main UI logic (~5600 lines)
  api_client.js       # API client (ApiClient object)
  ui-manager.js       # UI component management
  language-manager.js # i18n
  styles.css
  css/                # Theme, background, live2d styles
  js/                 # Ad, background, theme, live2d managers

docs/                 # GitHub Pages mirror of frontend/ (keep in sync)
```

## Key Classes (backend/crawler.py)

- `WebCrawler` (line ~124) - Generic web crawler
- `WikipediaAPICrawler` (line ~919) - Wikipedia API
- `ZhihuZhuanlanCrawler` (line ~1238) - Zhihu
- `MoegirlCrawler` (line ~1525) - Moegirl wiki
- `BilibiliCrawler` (line ~1600) - Bilibili
- `GitHubCrawler` (line ~1711) - GitHub
- `WeiboCrawler` (line ~1806) - Weibo
- `YouTubeCrawler` (line ~1907) - YouTube
- `TiebaCrawler` (line ~2022) - Baidu Tieba
- `ArxivCrawler` (line ~2115) - arXiv papers
- `DocsCrawler` (line ~2223) - Generic docs
- `CrawlerHub` (line ~2315) - Unified dispatcher for all crawlers
- `DataProcessor` (line ~2563) - NLP, keyword extraction, TF-IDF
- `StorageManager` (line ~3044) - Result file I/O
- `UrbanLegendAnalyzer` (line ~3211) - Conspiracy detection

## Critical Rules

### General
- This project uses Chinese comments and log messages. Follow existing style.
- No database. All persistence is via tasks.json and file system.
- JSON encoding uses `NumpyEncoder` for NumPy types. Always use it when serializing results.

### Backend
- All API routes are in `crawler_server.py`, prefixed with `/api/`.
- Each platform crawler has its own factory function (e.g., `get_wiki_crawler()`).
- Tasks run in background threads via `ThreadPoolExecutor`.
- Always call `save_tasks()` after modifying `tasks` or `wiki_tasks` dicts.
- Flask app uses `CORS(app)` - do not add per-route CORS decorators.
- File uploads limited to 16MB (`MAX_CONTENT_LENGTH`).
- Use `logger` (not `print`) for all backend logging.

### Frontend
- No build step. Plain JS, no bundler, no npm.
- `ApiClient` in `api_client.js` is the single point for all API calls.
- `API_BASE_URL` is configurable via localStorage for GitHub Pages deployment.
- Chart.js and ECharts are loaded via CDN in index.html.
- All DOM manipulation happens inside `DOMContentLoaded` callback in script.js.

### When Modifying Code
- If you change a function signature, update ALL callers in the same commit.
- If you add a new API route in crawler_server.py, also add the corresponding method in frontend/api_client.js.
- If you modify frontend/, mirror the same changes to docs/ (GitHub Pages).
- If you add a new crawler class, register it in CrawlerHub and add its routes in crawler_server.py.
- If you change CSS class names, search both .html and .js files for usage.

### Testing & Verification
- Backend: `cd backend && python -c "from crawler import *; from crawler_server import app; print('OK')"` to verify imports.
- Frontend: Open index.html in browser, no build needed.
- Docker: `docker-compose up --build` to test full stack.
- Health check endpoint: `GET /health` should return 200.

## Common Patterns

### Adding a new API endpoint
1. Add route function in `crawler_server.py`
2. Add corresponding `ApiClient` method in `frontend/api_client.js`
3. Copy updated `api_client.js` to `docs/api_client.js`
4. Add UI trigger in `frontend/script.js` if needed

### Adding a new crawler
1. Create class in `backend/crawler.py` following existing pattern (inherit structure)
2. Add to imports in `crawler_server.py` (line ~21)
3. Register in `CrawlerHub` class
4. Add API routes in `crawler_server.py`
5. Add mock endpoints if needed

## Do Not
- Do not introduce npm, webpack, or any JS build tooling.
- Do not replace file-based storage with a database without explicit request.
- Do not modify tasks.json schema without updating both load_tasks() and save_tasks().
- Do not add Python dependencies without adding them to requirements.txt.
- Do not forget to sync frontend/ changes to docs/.
