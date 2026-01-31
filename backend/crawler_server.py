#!/usr/bin/env python3
"""
全息拉普拉斯互联网爬虫系统 - 后端服务器
运行方式: python crawler_server.py
"""

import os
import sys
import json
import time
import uuid
import logging
import threading
import traceback
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 导入爬虫模块
from crawler import (
    WebCrawler,
    DataProcessor,
    StorageManager,
    UrbanLegendAnalyzer,
    WikipediaAPICrawler,
    ZhihuZhuanlanCrawler,
    MoegirlCrawler,
    BilibiliCrawler,
    GitHubCrawler,
    WeiboCrawler,
    YouTubeCrawler,
    TiebaCrawler,
    ArxivCrawler,
    DocsCrawler,
    CrawlerHub,
    calculate_statistics,
    NumpyEncoder
)

# 创建日志设置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("crawler_server.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("CrawlerServer")

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置文件上传路径
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
RESULTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
TASKS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tasks.json')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 限制上传大小为16MB

# 任务持久化函数
def load_tasks():
    """从文件加载任务列表"""
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"从文件加载了 {len(data.get('tasks', {}))} 个任务")
                return data.get('tasks', {}), data.get('wiki_tasks', {}), data.get('wiki_stats', {
                    'total_pages_fetched': 0,
                    'total_searches': 0,
                    'total_tasks': 0,
                    'languages_used': {},
                    'last_activity': None
                })
        except Exception as e:
            logger.error(f"加载任务文件失败: {e}")
    return {}, {}, {
        'total_pages_fetched': 0,
        'total_searches': 0,
        'total_tasks': 0,
        'languages_used': {},
        'last_activity': None
    }

def save_tasks():
    """保存任务列表到文件"""
    try:
        with open(TASKS_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'tasks': tasks,
                'wiki_tasks': wiki_tasks,
                'wiki_stats': wiki_stats
            }, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"保存任务文件失败: {e}")

# 存储爬虫任务状态 - 从文件加载
tasks, wiki_tasks, wiki_stats = load_tasks()

# 任务状态定义
TASK_STATUS = {
    'PENDING': '等待中',
    'RUNNING': '运行中',
    'COMPLETED': '已完成',
    'FAILED': '失败',
    'CANCELLED': '已取消'
}

# 添加静态文件服务
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('api/') or path == 'health':
        # 跳过API路由
        return {"error": "Not found"}, 404
    try:
        return send_from_directory('../frontend', path)
    except:
        # 如果文件不存在，返回index.html（用于SPA路由）
        return send_from_directory('../frontend', 'index.html')

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'json', 'txt'}

def run_crawler_task(task_id, config):
    """
    在后台线程运行爬虫任务
    
    参数:
        task_id: 任务ID
        config: 爬虫配置
    """
    try:
        # 更新任务状态为运行中
        tasks[task_id]['status'] = TASK_STATUS['RUNNING']
        tasks[task_id]['start_time'] = datetime.now().isoformat()
        
        # 提取配置
        urls = config.get('urls', [])
        depth = config.get('depth', 2)
        format_type = config.get('format', 'html')
        concurrency = config.get('concurrency', 3)
        enable_urban_legend = config.get('enable_urban_legend', True)
        proxy = config.get('proxy')  # 代理服务器
        use_browser = config.get('use_browser', False)  # 浏览器模式

        logger.info(f"任务 {task_id} 开始运行，爬取 {len(urls)} 个URL，深度为 {depth}")
        if proxy:
            logger.info(f"任务 {task_id} 使用代理: {proxy}")
        if use_browser:
            logger.info(f"任务 {task_id} 启用浏览器模式")

        # 更新任务详情
        tasks[task_id]['details'] = {
            'urls_count': len(urls),
            'depth': depth,
            'format': format_type,
            'concurrency': concurrency,
            'urban_legend_enabled': enable_urban_legend,
            'proxy': proxy,
            'use_browser': use_browser
        }

        # 初始化爬虫组件
        crawler = WebCrawler(max_workers=concurrency, use_browser=use_browser, proxy=proxy)
        processor = DataProcessor()
        storage = StorageManager(base_dir=os.path.join(RESULTS_FOLDER, task_id))
        
        # 可选：初始化都市传说分析器
        urban_legend_analyzer = None
        if enable_urban_legend:
            urban_legend_analyzer = UrbanLegendAnalyzer()
        
        # 记录开始时间
        start_time = time.time()
        task_info = {
            "task_id": task_id,
            "start_time": start_time,
            "urls": urls,
            "depth": depth,
            "format": format_type,
            "concurrency": concurrency,
            "urban_legend_enabled": enable_urban_legend
        }
        
        # 批量爬取
        all_results = crawler.batch_crawl(urls, depth)
        
        # 更新任务状态
        tasks[task_id]['progress'] = 30
        tasks[task_id]['details']['crawled_pages'] = len(all_results)
        logger.info(f"任务 {task_id} 爬取完成，共获取 {len(all_results)} 个页面")
        
        # 处理结果
        processed_content = []
        
        for url, data in all_results.items():
            # 提取内容
            title = data.get("title")
            content = data.get("content")
            html_content = data.get("html")
            status = data.get("status")
            
            # 跳过无效内容
            if not content and not html_content:
                continue
                
            # 处理HTML内容
            if html_content:
                # 检查是否是PDF或其他特殊内容
                if isinstance(html_content, str) and (html_content.startswith("PDF_CONTENT_") or 
                                                     html_content.startswith("UNSUPPORTED_CONTENT_")):
                    clean_content = content  # 使用parse_html生成的描述性内容
                else:
                    # 正常的HTML内容
                    clean_html = processor.clean_html(html_content, url)
                    
                    # 提取文本或格式化HTML
                    if format_type == "txt":
                        clean_content = processor.extract_text_from_html(clean_html)
                    else:
                        clean_content = clean_html
                        
                # 提取关键词
                keywords = []
                if content:
                    keywords = processor.extract_keywords(content)
                
                # 提取媒体内容信息
                media = {}
                if html_content and not isinstance(html_content, str) and not (html_content.startswith("PDF_CONTENT_") or html_content.startswith("UNSUPPORTED_CONTENT_")):
                    media = processor.extract_embedded_media(html_content, url) if hasattr(processor, 'extract_embedded_media') else {}
                
                # 都市传说分析
                urban_legend_result = None
                if enable_urban_legend and urban_legend_analyzer and clean_content:
                    metadata = {
                        'title': title,
                        'keywords': keywords,
                        'crawl_time': datetime.now().isoformat()
                    }
                    urban_legend_result = urban_legend_analyzer.analyze_content(clean_content, url, metadata)
                
                # 构造内容对象
                processed_item = {
                    "url": url,
                    "title": title or "无标题",
                    "content": clean_content,
                    "keywords": keywords,
                    "depth": data.get("depth", 0),
                    "format": format_type,
                    "status": status,
                    "embedded_media": media if media else None
                }
                
                # 添加都市传说分析结果
                if urban_legend_result:
                    processed_item["urban_legend"] = urban_legend_result
                
                processed_content.append(processed_item)
        
        # 更新任务状态
        tasks[task_id]['progress'] = 60
        tasks[task_id]['details']['processed_pages'] = len(processed_content)
        logger.info(f"任务 {task_id} 内容处理完成，共处理 {len(processed_content)} 个页面")
        
        # 内容分类
        categorized_content = {}
        if processed_content:
            # 提取纯文本用于分类
            text_contents = [item.get("content", "") for item in processed_content]
            
            # 确定分类数量
            cluster_count = min(5, max(2, len(processed_content) // 3))
            
            # 执行分类
            clusters = processor.classify_content(text_contents, cluster_count)
            
            # 整理分类结果
            for cluster_id, indices in clusters.items():
                category_items = [processed_content[idx] for idx in indices]
                categorized_content[str(cluster_id)] = {
                    "id": cluster_id,
                    "items": category_items
                }
        
        # 更新任务状态
        tasks[task_id]['progress'] = 80
        tasks[task_id]['details']['categories_count'] = len(categorized_content)
        logger.info(f"任务 {task_id} 分类完成，共 {len(categorized_content)} 个分类")
        
        # 记录结束时间
        end_time = time.time()
        task_info["end_time"] = end_time
        task_info["duration"] = end_time - start_time
        
        # 计算统计数据
        statistics = calculate_statistics(all_results, processed_content, categorized_content, task_info)
        
        # 如果启用了都市传说分析，添加相关统计
        if enable_urban_legend and urban_legend_analyzer:
            urban_legend_stats = {
                "confirmed_count": 0,
                "suspect_count": 0,
                "normal_count": 0,
                "failed_count": 0
            }
            
            for item in processed_content:
                if "urban_legend" in item:
                    label = item["urban_legend"]["label"]
                    if "已确认都市传说" in label:
                        urban_legend_stats["confirmed_count"] += 1
                    elif "疑似都市传说" in label:
                        urban_legend_stats["suspect_count"] += 1
                    elif "普通帖子" in label:
                        urban_legend_stats["normal_count"] += 1
                    else:
                        urban_legend_stats["failed_count"] += 1
            
            statistics["urban_legend"] = urban_legend_stats
        
        # 构造结果
        result = {
            "task_info": task_info,
            "content": processed_content,
            "categories": categorized_content,
            "statistics": statistics
        }
        
        # 保存结果
        result_file = os.path.join(RESULTS_FOLDER, f"{task_id}/crawler_results.json")
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        # 更新任务状态为完成
        tasks[task_id]['status'] = TASK_STATUS['COMPLETED']
        tasks[task_id]['progress'] = 100
        tasks[task_id]['end_time'] = datetime.now().isoformat()
        tasks[task_id]['result_file'] = result_file
        tasks[task_id]['details']['success_rate'] = statistics['successRate']
        tasks[task_id]['details']['duration'] = task_info['duration']

        logger.info(f"任务 {task_id} 成功完成，用时 {task_info['duration']:.2f} 秒")

    except Exception as e:
        logger.error(f"任务 {task_id} 出错: {str(e)}")
        logger.error(traceback.format_exc())

        # 更新任务状态为失败
        tasks[task_id]['status'] = TASK_STATUS['FAILED']
        tasks[task_id]['end_time'] = datetime.now().isoformat()
        tasks[task_id]['error'] = str(e)
        tasks[task_id]['traceback'] = traceback.format_exc()
    finally:
        # 关闭资源
        if 'crawler' in locals():
            crawler.close()
        # 保存任务状态
        save_tasks()

@app.route('/api/submit', methods=['POST'])
def submit_task():
    """接收爬虫配置并启动任务"""
    try:
        # 检查是否获取到配置数据
        if not request.json:
            return jsonify({'error': '未接收到配置数据'}), 400
        
        config = request.json
        
        # 验证配置
        if 'urls' not in config or not config['urls']:
            return jsonify({'error': '配置中未包含URLs'}), 400
        
        # 创建任务ID
        task_id = str(uuid.uuid4())
        
        # 初始化任务状态
        tasks[task_id] = {
            'id': task_id,
            'status': TASK_STATUS['PENDING'],
            'progress': 0,
            'created_at': datetime.now().isoformat(),
            'config': config
        }
        save_tasks()  # 持久化任务

        # 启动后台线程执行爬虫任务
        thread = threading.Thread(
            target=run_crawler_task,
            args=(task_id, config)
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"已提交新任务，ID: {task_id}")
        
        return jsonify({
            'task_id': task_id,
            'status': tasks[task_id]['status'],
            'message': '任务已提交'
        }), 202
        
    except Exception as e:
        logger.error(f"提交任务出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """获取任务状态"""
    if task_id not in tasks:
        return jsonify({'error': '任务不存在'}), 404
    
    task = tasks[task_id]
    
    response = {
        'id': task['id'],
        'status': task['status'],
        'progress': task['progress'],
        'created_at': task['created_at']
    }
    
    # 添加可选字段
    for field in ['start_time', 'end_time', 'details', 'error']:
        if field in task:
            response[field] = task[field]
    
    return jsonify(response)

@app.route('/api/result/<task_id>', methods=['GET'])
def get_task_result(task_id):
    """获取任务结果"""
    if task_id not in tasks:
        return jsonify({'error': '任务不存在'}), 404
    
    task = tasks[task_id]
    
    if task['status'] != TASK_STATUS['COMPLETED']:
        return jsonify({
            'error': '任务尚未完成',
            'status': task['status'],
            'progress': task['progress']
        }), 400
    
    result_file = task.get('result_file')
    if not result_file or not os.path.exists(result_file):
        return jsonify({'error': '结果文件不存在'}), 404
    
    try:
        with open(result_file, 'r', encoding='utf-8') as f:
            result = json.load(f)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"读取结果文件出错: {str(e)}")
        return jsonify({'error': f'读取结果文件出错: {str(e)}'}), 500

@app.route('/api/download/<task_id>', methods=['GET'])
def download_result(task_id):
    """下载任务结果文件"""
    if task_id not in tasks:
        return jsonify({'error': '任务不存在'}), 404
    
    task = tasks[task_id]
    
    if task['status'] != TASK_STATUS['COMPLETED']:
        return jsonify({
            'error': '任务尚未完成',
            'status': task['status'],
            'progress': task['progress']
        }), 400
    
    result_file = task.get('result_file')
    if not result_file or not os.path.exists(result_file):
        return jsonify({'error': '结果文件不存在'}), 404
    
    # 返回结果文件下载
    return send_from_directory(
        os.path.dirname(result_file),
        os.path.basename(result_file),
        as_attachment=True,
        download_name=f"crawler_results_{task_id}.json"
    )

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    """列出所有任务"""
    task_list = []
    
    for task_id, task in tasks.items():
        task_info = {
            'id': task['id'],
            'status': task['status'],
            'progress': task['progress'],
            'created_at': task['created_at']
        }
        
        # 添加可选字段
        for field in ['start_time', 'end_time', 'details']:
            if field in task:
                task_info[field] = task[field]
        
        task_list.append(task_info)
    
    # 按创建时间降序排序
    task_list.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify(task_list)

@app.route('/api/cancel/<task_id>', methods=['POST'])
def cancel_task(task_id):
    """取消任务（仅适用于等待中的任务）"""
    if task_id not in tasks:
        return jsonify({'error': '任务不存在'}), 404
    
    task = tasks[task_id]
    
    if task['status'] == TASK_STATUS['PENDING']:
        task['status'] = TASK_STATUS['FAILED']
        task['error'] = '任务被用户取消'
        save_tasks()  # 持久化
        return jsonify({'message': '任务已取消'})
    else:
        return jsonify({
            'error': '无法取消非等待中的任务',
            'status': task['status']
        }), 400

@app.route('/api/upload', methods=['POST'])
def upload_config():
    """上传配置文件"""
    # 检查是否有文件上传
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    
    file = request.files['file']
    
    # 检查文件名是否为空
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    # 检查文件类型
    if file and allowed_file(file.filename):
        # 安全地获取文件名
        filename = secure_filename(file.filename)
        # 生成保存路径
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        # 保存文件
        file.save(save_path)
        
        try:
            # 读取配置文件
            with open(save_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            return jsonify({
                'message': '配置文件上传成功',
                'config': config
            })
        except Exception as e:
            logger.error(f"读取配置文件出错: {str(e)}")
            return jsonify({'error': f'读取配置文件出错: {str(e)}'}), 500
    else:
        return jsonify({'error': '不允许的文件类型'}), 400

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'time': datetime.now().isoformat(),
        'tasks_count': len(tasks),
        'active_tasks': sum(1 for task in tasks.values() if task['status'] == TASK_STATUS['RUNNING'])
    })


# ==================== Wikipedia API 路由 ====================

# 全局 Wikipedia 爬虫实例缓存
wiki_crawlers = {}
wiki_crawlers_test = {}  # 测试模式爬虫缓存

def get_wiki_crawler(language='zh', test_mode=False):
    """获取或创建指定语言的 Wikipedia 爬虫实例"""
    if test_mode:
        if language not in wiki_crawlers_test:
            # 使用本地模拟 API
            wiki_crawlers_test[language] = WikipediaAPICrawler(
                language=language,
                base_url='http://localhost:5000/mock/wiki/api.php'
            )
        return wiki_crawlers_test[language]
    else:
        if language not in wiki_crawlers:
            wiki_crawlers[language] = WikipediaAPICrawler(language=language)
        return wiki_crawlers[language]


@app.route('/api/wiki/search', methods=['GET'])
def wiki_search():
    """
    搜索维基百科
    参数:
        q: 搜索关键词
        lang: 语言 (默认 zh)
        limit: 结果数量 (默认 10)
    """
    query = request.args.get('q', '')
    language = request.args.get('lang', 'zh')
    limit = int(request.args.get('limit', 10))

    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400

    try:
        crawler = get_wiki_crawler(language)
        results = crawler.search(query, limit=limit)

        # 更新统计
        global wiki_stats
        wiki_stats['total_searches'] += 1
        wiki_stats['last_activity'] = datetime.now().isoformat()
        wiki_stats['languages_used'][language] = wiki_stats['languages_used'].get(language, 0) + 1

        return jsonify({
            'query': query,
            'language': language,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"Wikipedia 搜索出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/page', methods=['GET'])
def wiki_get_page():
    """
    获取维基百科页面详情
    参数:
        title: 页面标题
        url: 或者提供完整的维基百科URL
        lang: 语言 (默认 zh)
    """
    title = request.args.get('title', '')
    url = request.args.get('url', '')
    language = request.args.get('lang', 'zh')

    # 如果提供了URL，从URL中提取标题
    if url and not title:
        import urllib.parse
        # 解析 URL 如 https://zh.wikipedia.org/wiki/艾萨克·牛顿
        if '/wiki/' in url:
            title = urllib.parse.unquote(url.split('/wiki/')[-1])
            # 从URL中提取语言
            if '.wikipedia.org' in url:
                lang_match = url.split('.wikipedia.org')[0].split('//')[-1]
                if lang_match and len(lang_match) <= 3:
                    language = lang_match

    if not title:
        return jsonify({'error': '请提供页面标题或URL'}), 400
        return jsonify({'error': '请提供页面标题'}), 400

    try:
        crawler = get_wiki_crawler(language)
        page_data = crawler.get_page(title)

        if not page_data:
            return jsonify({'error': f'页面不存在: {title}'}), 404

        return jsonify(page_data)
    except Exception as e:
        logger.error(f"获取 Wikipedia 页面出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/category', methods=['GET'])
def wiki_get_category():
    """
    获取维基百科分类下的页面
    参数:
        name: 分类名称 (不含 Category: 前缀)
        lang: 语言 (默认 zh)
        depth: 递归深度 (默认 0)
        limit: 最大页面数 (默认 50)
    """
    category_name = request.args.get('name', '')
    language = request.args.get('lang', 'zh')
    depth = int(request.args.get('depth', 0))
    limit = int(request.args.get('limit', 50))

    if not category_name:
        return jsonify({'error': '请提供分类名称'}), 400

    try:
        crawler = get_wiki_crawler(language)
        pages = crawler.get_category_members(category_name, depth=depth, max_pages=limit)
        return jsonify({
            'category': category_name,
            'language': language,
            'depth': depth,
            'pages': pages,
            'count': len(pages)
        })
    except Exception as e:
        logger.error(f"获取 Wikipedia 分类出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/category-tree', methods=['GET', 'POST'])
def wiki_get_category_tree():
    """
    获取维基百科分类树结构
    参数:
        name/category/rootCategory: 根分类名称 (不含 Category: 前缀)
        lang/language: 语言 (默认 zh)
        depth: 递归深度 (默认 2)
        include_pages: 是否包含页面 (默认 true)
    """
    import requests as req

    # 支持 GET 和 POST
    if request.method == 'POST':
        data = request.get_json() or {}
        category_name = data.get('rootCategory') or data.get('category') or data.get('name', '')
        language = data.get('language') or data.get('lang', 'zh')
        depth = int(data.get('depth', 2))
        include_pages = data.get('includePages', data.get('include_pages', True))
    else:
        category_name = request.args.get('category') or request.args.get('name') or request.args.get('rootCategory', '')
        language = request.args.get('lang') or request.args.get('language', 'zh')
        depth = int(request.args.get('depth', 2))
        include_pages = request.args.get('include_pages', '1') in ['1', 'true', 'True']

    if not category_name:
        return jsonify({'error': '请提供分类名称'}), 400

    try:
        api_url = f"https://{language}.wikipedia.org/w/api.php"
        logger.info(f"开始获取分类树: category={category_name}, lang={language}, depth={depth}")

        # Wikipedia API 要求必须有 User-Agent
        headers = {
            'User-Agent': 'CrawlerSystem/1.0 (Educational Project; https://github.com/crawler-system)',
            'Accept': 'application/json'
        }

        # 递归构建分类树
        def build_tree(cat_name, current_depth, max_children=15):
            node = {
                'name': cat_name,
                'type': 'category',
                'children': [],
                'pages': []
            }

            if current_depth <= 0:
                return node

            # 获取分类成员 - 使用 cmtype 分别获取子分类和页面
            # 先获取子分类
            subcat_params = {
                'action': 'query',
                'list': 'categorymembers',
                'cmtitle': f'Category:{cat_name}',
                'cmtype': 'subcat',  # 只获取子分类
                'cmlimit': max_children,
                'format': 'json'
            }

            try:
                response = req.get(api_url, params=subcat_params, headers=headers, timeout=15)
                response.raise_for_status()
                data = response.json()

                members = data.get('query', {}).get('categorymembers', [])
                logger.info(f"分类 '{cat_name}' 获取到 {len(members)} 个子分类")

                if members:
                    for member in members:
                        # 移除 Category: 或 分类: 前缀
                        subcat_name = member['title']
                        for prefix in ['Category:', '分类:', 'category:']:
                            if subcat_name.startswith(prefix):
                                subcat_name = subcat_name[len(prefix):]
                                break

                        child_node = build_tree(subcat_name, current_depth - 1, max_children)
                        node['children'].append(child_node)
                else:
                    logger.info(f"分类 '{cat_name}' 没有子分类，API响应: {data}")

            except Exception as e:
                logger.error(f"获取分类 {cat_name} 子分类失败: {str(e)}")
                node['error'] = str(e)

            # 如果需要包含页面
            if include_pages:
                page_params = {
                    'action': 'query',
                    'list': 'categorymembers',
                    'cmtitle': f'Category:{cat_name}',
                    'cmtype': 'page',  # 只获取页面
                    'cmlimit': 20,
                    'format': 'json'
                }

                try:
                    response = req.get(api_url, params=page_params, headers=headers, timeout=15)
                    data = response.json()

                    if 'query' in data and 'categorymembers' in data['query']:
                        for member in data['query']['categorymembers']:
                            node['pages'].append({
                                'title': member['title'],
                                'pageid': member['pageid']
                            })
                except Exception as e:
                    logger.warning(f"获取分类 {cat_name} 页面失败: {str(e)}")

            return node

        tree = build_tree(category_name, depth)

        return jsonify({
            'root': tree,
            'language': language,
            'depth': depth
        })

    except Exception as e:
        logger.error(f"获取 Wikipedia 分类树出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/path', methods=['POST'])
def wiki_find_path():
    """
    查找两个维基百科页面之间的链接路径
    使用双向 BFS 优化搜索速度
    参数 (JSON):
        source: 源页面标题
        target: 目标页面标题
        language: 语言 (默认 zh)
    """
    import requests as req
    import time

    data = request.get_json() or {}
    source = data.get('source', '')
    target = data.get('target', '')
    language = data.get('language', 'zh')

    if not source or not target:
        return jsonify({'error': '请提供源页面和目标页面'}), 400

    try:
        api_url = f"https://{language}.wikipedia.org/w/api.php"

        # Wikipedia API 要求必须有 User-Agent
        headers = {
            'User-Agent': 'CrawlerSystem/1.0 (Educational Project; https://github.com/crawler-system)',
            'Accept': 'application/json'
        }

        start_time = time.time()
        max_time = 60  # 最多搜索60秒
        max_pages = 100  # 最多访问100个页面
        pages_visited = 0
        request_delay = 0.5  # 每个请求间隔0.5秒，防止被封

        def get_links(page_title):
            """获取页面的链接"""
            time.sleep(request_delay)  # 请求间隔
            params = {
                'action': 'query',
                'titles': page_title,
                'prop': 'links',
                'pllimit': 50,  # 每个页面只取50个链接
                'format': 'json'
            }
            try:
                response = req.get(api_url, params=params, headers=headers, timeout=5)
                result = response.json()
                pages = result.get('query', {}).get('pages', {})
                for page_data in pages.values():
                    return [link.get('title', '') for link in page_data.get('links', [])]
            except:
                pass
            return []

        # 双向 BFS
        from collections import deque

        # 前向搜索（从source开始）
        forward_visited = {source: [source]}
        forward_queue = deque([source])

        # 反向搜索（从target开始）- 使用 linkshere 获取指向该页面的链接
        backward_visited = {target: [target]}
        backward_queue = deque([target])

        stop_reason = None

        while (forward_queue or backward_queue) and pages_visited < max_pages:
            # 检查时间限制
            elapsed = time.time() - start_time
            if elapsed > max_time:
                stop_reason = 'timeout'
                break

            # 前向搜索一步
            if forward_queue:
                current = forward_queue.popleft()
                pages_visited += 1

                for link in get_links(current):
                    if link in backward_visited:
                        # 找到交汇点
                        forward_path = forward_visited[current] + [link]
                        backward_path = backward_visited[link]
                        full_path = forward_path[:-1] + backward_path[::-1]
                        return jsonify({
                            'found': True,
                            'path': full_path,
                            'length': len(full_path),
                            'source': source,
                            'target': target,
                            'pages_searched': pages_visited
                        })

                    if link not in forward_visited and len(forward_visited[current]) < 3:
                        forward_visited[link] = forward_visited[current] + [link]
                        forward_queue.append(link)

                        # 直接命中目标
                        if link == target:
                            return jsonify({
                                'found': True,
                                'path': forward_visited[link],
                                'length': len(forward_visited[link]),
                                'source': source,
                                'target': target,
                                'pages_searched': pages_visited
                            })

        # 未找到路径
        elapsed = round(time.time() - start_time, 2)

        if stop_reason == 'timeout':
            message = f'搜索超时（{elapsed}秒），已搜索 {pages_visited} 个页面'
        elif pages_visited >= max_pages:
            message = f'已达到页面上限（{max_pages}页），未找到路径'
            stop_reason = 'page_limit'
        else:
            message = f'搜索完成，未找到从 "{source}" 到 "{target}" 的路径'
            stop_reason = 'not_found'

        return jsonify({
            'found': False,
            'path': [],
            'message': message,
            'stop_reason': stop_reason,
            'source': source,
            'target': target,
            'pages_searched': pages_visited,
            'time_spent': elapsed,
            'suggestion': '建议尝试更相关的页面，或使用英文维基百科（链接更密集）'
        })

    except Exception as e:
        logger.error(f"查找页面路径出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/random', methods=['GET'])
def wiki_random_pages():
    """
    获取随机维基百科页面
    参数:
        lang: 语言 (默认 zh)
        count: 数量 (默认 5)
    """
    language = request.args.get('lang', 'zh')
    count = int(request.args.get('count', 5))

    try:
        crawler = get_wiki_crawler(language)
        pages = crawler.get_random_pages(count=count)
        return jsonify({
            'language': language,
            'pages': pages,
            'count': len(pages)
        })
    except Exception as e:
        logger.error(f"获取随机 Wikipedia 页面出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/batch', methods=['POST'])
def wiki_batch_pages():
    """
    批量获取维基百科页面
    请求体:
        titles: 页面标题列表
        lang: 语言 (默认 zh)
    """
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    titles = request.json.get('titles', [])
    language = request.json.get('lang', 'zh')

    if not titles:
        return jsonify({'error': '请提供页面标题列表'}), 400

    if len(titles) > 20:
        return jsonify({'error': '一次最多获取 20 个页面'}), 400

    try:
        crawler = get_wiki_crawler(language)
        pages = crawler.batch_get_pages(titles)
        return jsonify({
            'language': language,
            'requested': len(titles),
            'success': len(pages),
            'pages': pages
        })
    except Exception as e:
        logger.error(f"批量获取 Wikipedia 页面出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/languages', methods=['GET'])
def wiki_languages():
    """获取支持的维基百科语言列表"""
    return jsonify({
        'languages': WikipediaAPICrawler.SUPPORTED_LANGUAGES
    })


# ==================== Wiki 异步任务 API ====================

def run_wiki_task(task_id, config):
    """
    在后台线程运行 Wiki 爬取任务
    """
    global wiki_stats
    task = wiki_tasks[task_id]

    try:
        task['status'] = TASK_STATUS['RUNNING']
        task['start_time'] = datetime.now().isoformat()

        language = config.get('language', 'zh')
        crawler = get_wiki_crawler(language)

        results = []
        titles = config.get('titles', [])
        urls = config.get('urls', [])

        # 合并 titles 和从 URLs 提取的标题
        all_titles = list(titles)
        for url in urls:
            if '/wiki/' in url:
                import urllib.parse
                title = urllib.parse.unquote(url.split('/wiki/')[-1])
                all_titles.append(title)

        total = len(all_titles)

        for i, title in enumerate(all_titles):
            if task.get('cancelled'):
                task['status'] = TASK_STATUS['CANCELLED']
                save_tasks()  # 持久化
                return

            try:
                page_data = crawler.get_page(title)
                if page_data:
                    results.append(page_data)
                    wiki_stats['total_pages_fetched'] += 1
            except Exception as e:
                logger.warning(f"获取页面失败 {title}: {str(e)}")

            task['progress'] = int((i + 1) / total * 100)
            time.sleep(0.5)  # 避免请求过快

        # 保存结果
        result_file = os.path.join(RESULTS_FOLDER, f"wiki_task_{task_id}.json")
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump({
                'task_id': task_id,
                'config': config,
                'results': results,
                'count': len(results),
                'timestamp': datetime.now().isoformat()
            }, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)

        task['status'] = TASK_STATUS['COMPLETED']
        task['result_file'] = result_file
        task['result_count'] = len(results)
        task['end_time'] = datetime.now().isoformat()

        # 更新统计
        wiki_stats['total_tasks'] += 1
        wiki_stats['last_activity'] = datetime.now().isoformat()
        wiki_stats['languages_used'][language] = wiki_stats['languages_used'].get(language, 0) + 1

        logger.info(f"Wiki 任务完成: {task_id}, 获取 {len(results)} 个页面")
        save_tasks()  # 持久化

    except Exception as e:
        task['status'] = TASK_STATUS['FAILED']
        task['error'] = str(e)
        task['end_time'] = datetime.now().isoformat()
        logger.error(f"Wiki 任务失败 {task_id}: {str(e)}")
        save_tasks()  # 持久化


@app.route('/api/wiki/submit', methods=['POST'])
def wiki_submit_task():
    """
    提交 Wiki 批量爬取任务
    参数 (JSON):
        titles: 页面标题列表
        urls: 页面 URL 列表
        language: 语言 (默认 zh)
    """
    try:
        data = request.get_json() or {}

        titles = data.get('titles', [])
        urls = data.get('urls', [])

        if not titles and not urls:
            return jsonify({'error': '请提供页面标题或URL列表'}), 400

        task_id = str(uuid.uuid4())

        wiki_tasks[task_id] = {
            'id': task_id,
            'status': TASK_STATUS['PENDING'],
            'progress': 0,
            'created_at': datetime.now().isoformat(),
            'config': data,
            'cancelled': False
        }
        save_tasks()  # 持久化

        # 启动后台线程
        thread = threading.Thread(
            target=run_wiki_task,
            args=(task_id, data)
        )
        thread.daemon = True
        thread.start()

        logger.info(f"已提交 Wiki 任务: {task_id}")

        return jsonify({
            'task_id': task_id,
            'status': wiki_tasks[task_id]['status'],
            'message': '任务已提交'
        }), 202

    except Exception as e:
        logger.error(f"提交 Wiki 任务出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/status/<task_id>', methods=['GET'])
def wiki_get_task_status(task_id):
    """获取 Wiki 任务状态"""
    if task_id not in wiki_tasks:
        return jsonify({'error': '任务不存在'}), 404

    task = wiki_tasks[task_id]

    response = {
        'id': task['id'],
        'status': task['status'],
        'progress': task['progress'],
        'created_at': task['created_at']
    }

    for field in ['start_time', 'end_time', 'error', 'result_count']:
        if field in task:
            response[field] = task[field]

    return jsonify(response)


@app.route('/api/wiki/result/<task_id>', methods=['GET'])
def wiki_get_task_result(task_id):
    """获取 Wiki 任务结果"""
    if task_id not in wiki_tasks:
        return jsonify({'error': '任务不存在'}), 404

    task = wiki_tasks[task_id]

    if task['status'] != TASK_STATUS['COMPLETED']:
        return jsonify({
            'error': '任务尚未完成',
            'status': task['status'],
            'progress': task['progress']
        }), 400

    result_file = task.get('result_file')
    if not result_file or not os.path.exists(result_file):
        return jsonify({'error': '结果文件不存在'}), 404

    try:
        with open(result_file, 'r', encoding='utf-8') as f:
            result = json.load(f)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'读取结果出错: {str(e)}'}), 500


@app.route('/api/wiki/cancel/<task_id>', methods=['POST'])
def wiki_cancel_task(task_id):
    """取消 Wiki 任务"""
    if task_id not in wiki_tasks:
        return jsonify({'error': '任务不存在'}), 404

    task = wiki_tasks[task_id]

    if task['status'] in [TASK_STATUS['COMPLETED'], TASK_STATUS['FAILED'], TASK_STATUS['CANCELLED']]:
        return jsonify({'error': '任务已结束，无法取消'}), 400

    task['cancelled'] = True
    task['status'] = TASK_STATUS['CANCELLED']
    task['end_time'] = datetime.now().isoformat()
    save_tasks()  # 持久化

    return jsonify({
        'message': '任务已取消',
        'task_id': task_id
    })


@app.route('/api/wiki/tasks', methods=['GET'])
def wiki_list_tasks():
    """列出所有 Wiki 任务"""
    task_list = []

    for task_id, task in wiki_tasks.items():
        task_info = {
            'id': task['id'],
            'status': task['status'],
            'progress': task['progress'],
            'created_at': task['created_at']
        }

        for field in ['start_time', 'end_time', 'result_count']:
            if field in task:
                task_info[field] = task[field]

        task_list.append(task_info)

    task_list.sort(key=lambda x: x['created_at'], reverse=True)

    return jsonify(task_list)


@app.route('/api/wiki/download/<task_id>', methods=['GET'])
def wiki_download_result(task_id):
    """下载 Wiki 任务结果"""
    if task_id not in wiki_tasks:
        return jsonify({'error': '任务不存在'}), 404

    task = wiki_tasks[task_id]

    if task['status'] != TASK_STATUS['COMPLETED']:
        return jsonify({'error': '任务尚未完成'}), 400

    result_file = task.get('result_file')
    if not result_file or not os.path.exists(result_file):
        return jsonify({'error': '结果文件不存在'}), 404

    format_type = request.args.get('format', 'json')

    if format_type == 'json':
        return send_from_directory(
            os.path.dirname(result_file),
            os.path.basename(result_file),
            as_attachment=True,
            download_name=f"wiki_results_{task_id}.json"
        )
    elif format_type == 'txt':
        # 转换为文本格式
        try:
            with open(result_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            text_content = []
            for page in data.get('results', []):
                text_content.append(f"# {page.get('title', '未知标题')}")
                text_content.append(f"URL: {page.get('url', '')}")
                text_content.append(f"\n{page.get('text', page.get('summary', ''))}\n")
                text_content.append("=" * 50 + "\n")

            from flask import Response
            return Response(
                '\n'.join(text_content),
                mimetype='text/plain; charset=utf-8',
                headers={'Content-Disposition': f'attachment; filename=wiki_results_{task_id}.txt'}
            )
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': f'不支持的格式: {format_type}'}), 400


@app.route('/api/wiki/extract', methods=['POST'])
def wiki_extract_info():
    """
    提取维基百科页面结构化信息
    参数 (JSON):
        url: 页面 URL
        title: 页面标题 (与 url 二选一)
        language: 语言 (默认 zh)
    """
    data = request.get_json() or {}
    url = data.get('url', '')
    title = data.get('title', '')
    language = data.get('language', 'zh')

    # 从 URL 提取标题
    if url and not title:
        if '/wiki/' in url:
            import urllib.parse
            title = urllib.parse.unquote(url.split('/wiki/')[-1])
            # 尝试从 URL 提取语言
            if '.wikipedia.org' in url:
                lang_match = url.split('.wikipedia.org')[0].split('//')[-1]
                if lang_match and len(lang_match) <= 5:
                    language = lang_match

    if not title:
        return jsonify({'error': '请提供页面 URL 或标题'}), 400

    try:
        crawler = get_wiki_crawler(language)
        page_data = crawler.get_page(title)

        if not page_data:
            return jsonify({'error': f'页面不存在: {title}'}), 404

        # 提取结构化信息
        extracted = {
            'title': page_data.get('title', title),
            'url': page_data.get('url', ''),
            'summary': page_data.get('summary', ''),
            'sections': page_data.get('sections', []),
            'categories': page_data.get('categories', []),
            'links': page_data.get('links', [])[:50],
            'language': language,
            'word_count': len(page_data.get('text', '')),
            'extracted_at': datetime.now().isoformat()
        }

        return jsonify(extracted)

    except Exception as e:
        logger.error(f"提取 Wiki 信息出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/infobox', methods=['GET'])
def wiki_get_infobox():
    """
    获取维基百科页面信息框
    参数:
        title: 页面标题
        url: 页面 URL (与 title 二选一)
        lang: 语言 (默认 zh)
    """
    import requests as req

    title = request.args.get('title', '')
    url = request.args.get('url', '')
    language = request.args.get('lang', 'zh')

    # 从 URL 提取标题
    if url and not title:
        if '/wiki/' in url:
            import urllib.parse
            title = urllib.parse.unquote(url.split('/wiki/')[-1])
            if '.wikipedia.org' in url:
                lang_match = url.split('.wikipedia.org')[0].split('//')[-1]
                if lang_match and len(lang_match) <= 5:
                    language = lang_match

    if not title:
        return jsonify({'error': '请提供页面标题或 URL'}), 400

    try:
        api_url = f"https://{language}.wikipedia.org/w/api.php"

        # Wikipedia API 要求必须有 User-Agent
        headers = {
            'User-Agent': 'CrawlerSystem/1.0 (Educational Project; https://github.com/crawler-system)',
            'Accept': 'application/json'
        }

        # 获取页面 HTML 以提取 infobox
        params = {
            'action': 'parse',
            'page': title,
            'prop': 'text',
            'format': 'json'
        }

        response = req.get(api_url, params=params, headers=headers, timeout=15)
        data = response.json()

        if 'error' in data:
            return jsonify({'error': data['error'].get('info', '获取页面失败')}), 404

        html_content = data.get('parse', {}).get('text', {}).get('*', '')

        # 简单提取 infobox 信息 (基于常见的 infobox 类名)
        from html.parser import HTMLParser

        infobox_data = {
            'title': title,
            'has_infobox': False,
            'fields': {}
        }

        # 检查是否有 infobox
        if 'infobox' in html_content.lower():
            infobox_data['has_infobox'] = True

            # 使用正则提取表格行
            import re

            # 匹配 infobox 中的 th 和 td
            pattern = r'<tr[^>]*>.*?<th[^>]*>(.*?)</th>.*?<td[^>]*>(.*?)</td>.*?</tr>'
            matches = re.findall(pattern, html_content, re.DOTALL | re.IGNORECASE)

            for label, value in matches[:20]:  # 限制字段数量
                # 清理 HTML 标签
                label_clean = re.sub(r'<[^>]+>', '', label).strip()
                value_clean = re.sub(r'<[^>]+>', '', value).strip()

                if label_clean and value_clean:
                    infobox_data['fields'][label_clean] = value_clean

        return jsonify(infobox_data)

    except Exception as e:
        logger.error(f"获取 Wiki infobox 出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/wiki/stats', methods=['GET'])
def wiki_get_stats():
    """获取 Wiki 爬虫统计信息"""
    global wiki_stats

    # 计算任务统计
    task_stats = {
        'total': len(wiki_tasks),
        'pending': 0,
        'running': 0,
        'completed': 0,
        'failed': 0,
        'cancelled': 0
    }

    for task in wiki_tasks.values():
        status = task['status']
        if status == TASK_STATUS['PENDING']:
            task_stats['pending'] += 1
        elif status == TASK_STATUS['RUNNING']:
            task_stats['running'] += 1
        elif status == TASK_STATUS['COMPLETED']:
            task_stats['completed'] += 1
        elif status == TASK_STATUS['FAILED']:
            task_stats['failed'] += 1
        elif status == TASK_STATUS['CANCELLED']:
            task_stats['cancelled'] += 1

    return jsonify({
        'pages_fetched': wiki_stats['total_pages_fetched'],
        'searches_performed': wiki_stats['total_searches'],
        'tasks': task_stats,
        'languages_used': wiki_stats['languages_used'],
        'last_activity': wiki_stats['last_activity'],
        'supported_languages': list(WikipediaAPICrawler.SUPPORTED_LANGUAGES.keys())
    })


# ==================== 知乎专栏 API 路由 ====================

# 全局知乎专栏爬虫实例
zhihu_crawler = None
zhihu_crawler_test = None  # 测试模式爬虫

def get_zhihu_crawler(test_mode=False):
    """获取或创建知乎专栏爬虫实例"""
    global zhihu_crawler, zhihu_crawler_test
    if test_mode:
        if zhihu_crawler_test is None:
            # 使用本地模拟 API
            zhihu_crawler_test = ZhihuZhuanlanCrawler(
                delay=0.1,  # 测试模式减少延迟
                base_url='http://localhost:5000/mock/zhihu/api'
            )
        return zhihu_crawler_test
    else:
        if zhihu_crawler is None:
            zhihu_crawler = ZhihuZhuanlanCrawler(delay=1.0)
        return zhihu_crawler


@app.route('/api/zhihu/column', methods=['GET'])
def zhihu_get_column():
    """
    获取知乎专栏信息
    参数:
        slug: 专栏标识 (如 URL zhuanlan.zhihu.com/passer 中的 passer)
    """
    slug = request.args.get('slug', '')

    if not slug:
        return jsonify({'error': '请提供专栏标识 (slug)'}), 400

    try:
        crawler = get_zhihu_crawler()
        column_info = crawler.get_column_info(slug)

        if not column_info:
            return jsonify({'error': f'专栏不存在或无法访问: {slug}'}), 404

        return jsonify(column_info)
    except Exception as e:
        logger.error(f"获取知乎专栏出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zhihu/column/posts', methods=['GET'])
def zhihu_get_column_posts():
    """
    获取知乎专栏文章列表
    参数:
        slug: 专栏标识
        limit: 每页数量 (默认 20，最大 20)
        offset: 偏移量 (默认 0)
    """
    slug = request.args.get('slug', '')
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))

    if not slug:
        return jsonify({'error': '请提供专栏标识 (slug)'}), 400

    try:
        crawler = get_zhihu_crawler()
        posts = crawler.get_column_posts(slug, limit=limit, offset=offset)

        return jsonify({
            'slug': slug,
            'offset': offset,
            'limit': limit,
            'posts': posts,
            'count': len(posts)
        })
    except Exception as e:
        logger.error(f"获取知乎专栏文章列表出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zhihu/column/all', methods=['GET'])
def zhihu_get_all_column_posts():
    """
    获取知乎专栏所有文章
    参数:
        slug: 专栏标识
        max: 最大文章数 (默认 100)
    """
    slug = request.args.get('slug', '')
    max_posts = int(request.args.get('max', 100))

    if not slug:
        return jsonify({'error': '请提供专栏标识 (slug)'}), 400

    if max_posts > 500:
        return jsonify({'error': '最大文章数不能超过 500'}), 400

    try:
        crawler = get_zhihu_crawler()
        posts = crawler.get_all_column_posts(slug, max_posts=max_posts)

        return jsonify({
            'slug': slug,
            'posts': posts,
            'count': len(posts)
        })
    except Exception as e:
        logger.error(f"获取知乎专栏所有文章出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zhihu/post', methods=['GET'])
def zhihu_get_post():
    """
    获取知乎文章详情
    参数:
        id: 文章 ID
    """
    post_id = request.args.get('id', '')

    if not post_id:
        return jsonify({'error': '请提供文章 ID'}), 400

    try:
        crawler = get_zhihu_crawler()
        post_data = crawler.get_post(post_id)

        if not post_data:
            return jsonify({'error': f'文章不存在: {post_id}'}), 404

        return jsonify(post_data)
    except Exception as e:
        logger.error(f"获取知乎文章出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zhihu/search', methods=['GET'])
def zhihu_search_columns():
    """
    搜索知乎专栏
    参数:
        q: 搜索关键词
        limit: 结果数量 (默认 10)
    """
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 10))

    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400

    try:
        crawler = get_zhihu_crawler()
        results = crawler.search_columns(query, limit=limit)

        return jsonify({
            'query': query,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"搜索知乎专栏出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zhihu/batch', methods=['POST'])
def zhihu_batch_posts():
    """
    批量获取知乎文章
    请求体:
        ids: 文章 ID 列表
    """
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    post_ids = request.json.get('ids', [])

    if not post_ids:
        return jsonify({'error': '请提供文章 ID 列表'}), 400

    if len(post_ids) > 20:
        return jsonify({'error': '一次最多获取 20 篇文章'}), 400

    try:
        crawler = get_zhihu_crawler()
        posts = crawler.batch_get_posts(post_ids)

        return jsonify({
            'requested': len(post_ids),
            'success': len(posts),
            'posts': posts
        })
    except Exception as e:
        logger.error(f"批量获取知乎文章出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ==================== 萌娘百科 API 路由 ====================

moegirl_crawler = None
moegirl_crawler_test = None

def get_moegirl_crawler(test_mode=False):
    global moegirl_crawler, moegirl_crawler_test
    if test_mode:
        if moegirl_crawler_test is None:
            moegirl_crawler_test = MoegirlCrawler(base_url='http://localhost:5000/mock/moegirl/api.php')
        return moegirl_crawler_test
    if moegirl_crawler is None:
        moegirl_crawler = MoegirlCrawler()
    return moegirl_crawler

@app.route('/api/moegirl/search', methods=['GET'])
def moegirl_search():
    """搜索萌娘百科"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_moegirl_crawler()
        results = crawler.search(query)
        return jsonify({'query': query, 'results': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/moegirl/page', methods=['GET'])
def moegirl_page():
    """获取萌娘百科页面"""
    title = request.args.get('title', '')
    if not title:
        return jsonify({'error': '请提供页面标题'}), 400
    try:
        crawler = get_moegirl_crawler()
        page = crawler.get_page(title)
        if not page:
            return jsonify({'error': f'页面不存在: {title}'}), 404
        return jsonify(page)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 哔哩哔哩 API 路由 ====================

bilibili_crawler = None
bilibili_crawler_test = None

def get_bilibili_crawler(test_mode=False):
    global bilibili_crawler, bilibili_crawler_test
    if test_mode:
        if bilibili_crawler_test is None:
            bilibili_crawler_test = BilibiliCrawler(base_url='http://localhost:5000/mock/bilibili')
        return bilibili_crawler_test
    if bilibili_crawler is None:
        bilibili_crawler = BilibiliCrawler()
    return bilibili_crawler

@app.route('/api/bilibili/video', methods=['GET'])
def bilibili_video():
    """获取B站视频信息"""
    bvid = request.args.get('bvid', '')
    if not bvid:
        return jsonify({'error': '请提供视频 BVID'}), 400
    try:
        crawler = get_bilibili_crawler()
        video = crawler.get_video_info(bvid)
        if not video:
            return jsonify({'error': f'视频不存在: {bvid}'}), 404
        return jsonify(video)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bilibili/search', methods=['GET'])
def bilibili_search():
    """搜索B站视频"""
    keyword = request.args.get('q', '')
    if not keyword:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_bilibili_crawler()
        results = crawler.search_video(keyword)
        return jsonify({'query': keyword, 'results': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bilibili/user', methods=['GET'])
def bilibili_user():
    """获取B站用户信息"""
    mid = request.args.get('mid', '')
    if not mid:
        return jsonify({'error': '请提供用户 MID'}), 400
    try:
        crawler = get_bilibili_crawler()
        user = crawler.get_user_info(mid)
        if not user:
            return jsonify({'error': f'用户不存在: {mid}'}), 404
        return jsonify(user)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== GitHub API 路由 ====================

github_crawler = None
github_crawler_test = None

def get_github_crawler(test_mode=False):
    global github_crawler, github_crawler_test
    if test_mode:
        if github_crawler_test is None:
            github_crawler_test = GitHubCrawler(base_url='http://localhost:5000/mock/github')
        return github_crawler_test
    if github_crawler is None:
        github_crawler = GitHubCrawler()
    return github_crawler

@app.route('/api/github/repo', methods=['GET'])
def github_repo():
    """获取 GitHub 仓库信息"""
    owner = request.args.get('owner', '')
    repo = request.args.get('repo', '')
    if not owner or not repo:
        return jsonify({'error': '请提供 owner 和 repo'}), 400
    try:
        crawler = get_github_crawler()
        repo_info = crawler.get_repo(owner, repo)
        if not repo_info:
            return jsonify({'error': f'仓库不存在: {owner}/{repo}'}), 404
        return jsonify(repo_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github/readme', methods=['GET'])
def github_readme():
    """获取 GitHub 仓库 README"""
    owner = request.args.get('owner', '')
    repo = request.args.get('repo', '')
    if not owner or not repo:
        return jsonify({'error': '请提供 owner 和 repo'}), 400
    try:
        crawler = get_github_crawler()
        readme = crawler.get_readme(owner, repo)
        if not readme:
            return jsonify({'error': f'README 不存在'}), 404
        return jsonify(readme)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github/search', methods=['GET'])
def github_search():
    """搜索 GitHub 仓库"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_github_crawler()
        results = crawler.search_repos(query)
        return jsonify({'query': query, 'results': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 微博 API 路由 ====================

weibo_crawler = None
weibo_crawler_test = None

def get_weibo_crawler(test_mode=False):
    global weibo_crawler, weibo_crawler_test
    if test_mode:
        if weibo_crawler_test is None:
            weibo_crawler_test = WeiboCrawler(base_url='http://localhost:5000/mock/weibo/api')
        return weibo_crawler_test
    if weibo_crawler is None:
        weibo_crawler = WeiboCrawler()
    return weibo_crawler

@app.route('/api/weibo/user', methods=['GET'])
def weibo_user():
    """获取微博用户信息"""
    uid = request.args.get('uid', '')
    if not uid:
        return jsonify({'error': '请提供用户 UID'}), 400
    try:
        crawler = get_weibo_crawler()
        user = crawler.get_user_info(uid)
        if not user:
            return jsonify({'error': f'用户不存在: {uid}'}), 404
        return jsonify(user)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weibo/posts', methods=['GET'])
def weibo_posts():
    """获取用户微博列表"""
    uid = request.args.get('uid', '')
    if not uid:
        return jsonify({'error': '请提供用户 UID'}), 400
    try:
        crawler = get_weibo_crawler()
        posts = crawler.get_user_weibos(uid)
        return jsonify({'uid': uid, 'posts': posts, 'count': len(posts)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weibo/hot', methods=['GET'])
def weibo_hot():
    """获取微博热搜"""
    try:
        crawler = get_weibo_crawler()
        hot = crawler.get_hot_search()
        return jsonify({'hot': hot, 'count': len(hot)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== YouTube API 路由 ====================

youtube_crawler = None
youtube_crawler_test = None

def get_youtube_crawler(test_mode=False, api_key=None):
    global youtube_crawler, youtube_crawler_test
    if test_mode:
        if youtube_crawler_test is None:
            youtube_crawler_test = YouTubeCrawler(base_url='http://localhost:5000/mock/youtube')
        return youtube_crawler_test
    if youtube_crawler is None:
        youtube_crawler = YouTubeCrawler(api_key=api_key)
    return youtube_crawler

@app.route('/api/youtube/video', methods=['GET'])
def youtube_video():
    """获取 YouTube 视频信息"""
    video_id = request.args.get('id', '')
    if not video_id:
        return jsonify({'error': '请提供视频 ID'}), 400
    try:
        crawler = get_youtube_crawler()
        video = crawler.get_video_info(video_id)
        if not video:
            return jsonify({'error': f'视频不存在: {video_id}'}), 404
        return jsonify(video)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/search', methods=['GET'])
def youtube_search():
    """搜索 YouTube 视频"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_youtube_crawler()
        results = crawler.search_videos(query)
        return jsonify({'query': query, 'results': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/channel', methods=['GET'])
def youtube_channel():
    """获取 YouTube 频道信息"""
    channel_id = request.args.get('id', '')
    if not channel_id:
        return jsonify({'error': '请提供频道 ID'}), 400
    try:
        crawler = get_youtube_crawler()
        channel = crawler.get_channel_info(channel_id)
        if not channel:
            return jsonify({'error': f'频道不存在: {channel_id}'}), 404
        return jsonify(channel)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 贴吧 API 路由 ====================

tieba_crawler = None
tieba_crawler_test = None

def get_tieba_crawler(test_mode=False):
    global tieba_crawler, tieba_crawler_test
    if test_mode:
        if tieba_crawler_test is None:
            tieba_crawler_test = TiebaCrawler(base_url='http://localhost:5000/mock/tieba')
        return tieba_crawler_test
    if tieba_crawler is None:
        tieba_crawler = TiebaCrawler()
    return tieba_crawler

@app.route('/api/tieba/forum', methods=['GET'])
def tieba_forum():
    """获取贴吧信息"""
    name = request.args.get('name', '')
    if not name:
        return jsonify({'error': '请提供贴吧名称'}), 400
    try:
        crawler = get_tieba_crawler()
        forum = crawler.get_forum_info(name)
        if not forum:
            return jsonify({'error': f'贴吧不存在: {name}'}), 404
        return jsonify(forum)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tieba/posts', methods=['GET'])
def tieba_posts():
    """获取贴吧帖子列表"""
    name = request.args.get('name', '')
    if not name:
        return jsonify({'error': '请提供贴吧名称'}), 400
    try:
        crawler = get_tieba_crawler()
        posts = crawler.get_forum_posts(name)
        return jsonify({'name': name, 'posts': posts, 'count': len(posts)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tieba/post', methods=['GET'])
def tieba_post_detail():
    """获取帖子详情"""
    post_id = request.args.get('id', '')
    if not post_id:
        return jsonify({'error': '请提供帖子 ID'}), 400
    try:
        crawler = get_tieba_crawler()
        post = crawler.get_post_detail(post_id)
        if not post:
            return jsonify({'error': f'帖子不存在: {post_id}'}), 404
        return jsonify(post)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== arXiv API 路由 ====================

arxiv_crawler = None
arxiv_crawler_test = None

def get_arxiv_crawler(test_mode=False):
    global arxiv_crawler, arxiv_crawler_test
    if test_mode:
        if arxiv_crawler_test is None:
            arxiv_crawler_test = ArxivCrawler(base_url='http://localhost:5000/mock/arxiv/api/query')
        return arxiv_crawler_test
    if arxiv_crawler is None:
        arxiv_crawler = ArxivCrawler()
    return arxiv_crawler

@app.route('/api/arxiv/search', methods=['GET'])
def arxiv_search():
    """搜索 arXiv 论文"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_arxiv_crawler()
        papers = crawler.search_papers(query)
        return jsonify({'query': query, 'papers': papers, 'count': len(papers)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/arxiv/paper', methods=['GET'])
def arxiv_paper():
    """获取 arXiv 论文详情"""
    arxiv_id = request.args.get('id', '')
    if not arxiv_id:
        return jsonify({'error': '请提供论文 arXiv ID'}), 400
    try:
        crawler = get_arxiv_crawler()
        paper = crawler.get_paper_by_id(arxiv_id)
        if not paper:
            return jsonify({'error': f'论文不存在: {arxiv_id}'}), 404
        return jsonify(paper)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/arxiv/recent', methods=['GET'])
def arxiv_recent():
    """获取最新 arXiv 论文"""
    category = request.args.get('category', 'cs.AI')
    limit = int(request.args.get('limit', 10))
    try:
        crawler = get_arxiv_crawler()
        papers = crawler.get_recent_papers(category=category, max_results=limit)
        return jsonify({'category': category, 'papers': papers, 'count': len(papers)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 文档爬虫 API 路由 ====================

@app.route('/api/docs/crawl', methods=['GET'])
def docs_crawl():
    """爬取文档页面"""
    url = request.args.get('url', '')
    if not url:
        return jsonify({'error': '请提供文档URL'}), 400
    try:
        crawler = DocsCrawler()
        result = crawler.crawl_docs_page(url)
        if not result:
            return jsonify({'error': f'无法爬取: {url}'}), 404
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 爬虫中台 API 路由 ====================

# 全局爬虫中台实例
crawler_hub = None

def get_crawler_hub(test_mode=False):
    """获取或创建爬虫中台实例"""
    global crawler_hub
    if crawler_hub is None:
        crawler_hub = CrawlerHub(test_mode=test_mode, mock_base_url='http://localhost:5000')
    elif crawler_hub.test_mode != test_mode:
        crawler_hub.set_test_mode(test_mode)
    return crawler_hub


@app.route('/api/hub/status', methods=['GET'])
def hub_status():
    """获取爬虫中台状态"""
    try:
        hub = get_crawler_hub()
        return jsonify(hub.get_status())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/hub/platforms', methods=['GET'])
def hub_platforms():
    """获取支持的平台列表"""
    try:
        hub = get_crawler_hub()
        platforms = []
        for key in hub.get_supported_platforms():
            info = hub.get_platform_info(key)
            platforms.append({
                'key': key,
                'name': info['name'],
                'name_cn': info['name_cn'],
                'description': info['description']
            })
        return jsonify({'platforms': platforms, 'count': len(platforms)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/hub/crawl', methods=['POST'])
def hub_crawl():
    """
    通过爬虫中台执行爬取
    请求体:
        platform: 平台名称
        method: 方法名
        args: 位置参数列表 (可选)
        kwargs: 关键字参数字典 (可选)
        test_mode: 是否使用测试模式 (可选)
    """
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    platform = request.json.get('platform', '')
    method = request.json.get('method', '')
    args = request.json.get('args', [])
    kwargs = request.json.get('kwargs', {})
    test_mode = request.json.get('test_mode', False)

    if not platform or not method:
        return jsonify({'error': '请提供 platform 和 method'}), 400

    try:
        hub = get_crawler_hub(test_mode=test_mode)
        result = hub.crawl(platform, method, *args, **kwargs)
        return jsonify({
            'platform': platform,
            'method': method,
            'test_mode': test_mode,
            'result': result
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except AttributeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"爬虫中台爬取出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hub/batch', methods=['POST'])
def hub_batch_crawl():
    """
    通过爬虫中台批量爬取
    请求体:
        tasks: 任务列表
        test_mode: 是否使用测试模式 (可选)
    """
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    tasks = request.json.get('tasks', [])
    test_mode = request.json.get('test_mode', False)

    if not tasks:
        return jsonify({'error': '请提供任务列表'}), 400

    try:
        hub = get_crawler_hub(test_mode=test_mode)
        results = hub.batch_crawl(tasks)
        return jsonify({
            'test_mode': test_mode,
            'total': len(tasks),
            'success': sum(1 for r in results if r['success']),
            'results': results
        })
    except Exception as e:
        logger.error(f"爬虫中台批量爬取出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hub/test', methods=['POST'])
def hub_set_test_mode():
    """
    设置爬虫中台测试模式
    请求体:
        enabled: 是否启用测试模式
    """
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    enabled = request.json.get('enabled', False)

    try:
        hub = get_crawler_hub()
        hub.set_test_mode(enabled)
        return jsonify({
            'message': f"测试模式已{'启用' if enabled else '禁用'}",
            'test_mode': hub.test_mode
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== 测试模式 API 路由 ====================

@app.route('/api/test/wiki/search', methods=['GET'])
def test_wiki_search():
    """使用模拟数据测试 Wikipedia 搜索"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400

    try:
        crawler = get_wiki_crawler(language='zh', test_mode=True)
        results = crawler.search(query, limit=10)
        return jsonify({
            'mode': 'test',
            'query': query,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"测试 Wikipedia 搜索出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/wiki/page', methods=['GET'])
def test_wiki_page():
    """使用模拟数据测试获取 Wikipedia 页面"""
    title = request.args.get('title', '')
    if not title:
        return jsonify({'error': '请提供页面标题'}), 400

    try:
        crawler = get_wiki_crawler(language='zh', test_mode=True)
        page_data = crawler.get_page(title)
        if not page_data:
            return jsonify({'error': f'页面不存在: {title}'}), 404
        page_data['mode'] = 'test'
        return jsonify(page_data)
    except Exception as e:
        logger.error(f"测试获取 Wikipedia 页面出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/zhihu/column', methods=['GET'])
def test_zhihu_column():
    """使用模拟数据测试获取知乎专栏"""
    slug = request.args.get('slug', '')
    if not slug:
        return jsonify({'error': '请提供专栏标识'}), 400

    try:
        crawler = get_zhihu_crawler(test_mode=True)
        column_info = crawler.get_column_info(slug)
        if not column_info:
            return jsonify({'error': f'专栏不存在: {slug}'}), 404
        column_info['mode'] = 'test'
        return jsonify(column_info)
    except Exception as e:
        logger.error(f"测试获取知乎专栏出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/zhihu/post', methods=['GET'])
def test_zhihu_post():
    """使用模拟数据测试获取知乎文章"""
    post_id = request.args.get('id', '')
    if not post_id:
        return jsonify({'error': '请提供文章 ID'}), 400

    try:
        crawler = get_zhihu_crawler(test_mode=True)
        post_data = crawler.get_post(post_id)
        if not post_data:
            return jsonify({'error': f'文章不存在: {post_id}'}), 404
        post_data['mode'] = 'test'
        return jsonify(post_data)
    except Exception as e:
        logger.error(f"测试获取知乎文章出错: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/', methods=['GET'])
def index():
    """默认路由"""
    return jsonify({
        'message': '全息拉普拉斯互联网爬虫系统API服务',
        'version': '1.2.0',
        'endpoints': [
            '/api/submit - 提交爬虫任务',
            '/api/status/<task_id> - 获取任务状态',
            '/api/result/<task_id> - 获取任务结果',
            '/api/download/<task_id> - 下载任务结果文件',
            '/api/tasks - 列出所有任务',
            '/api/cancel/<task_id> - 取消任务',
            '/api/upload - 上传配置文件',
            '/api/wiki/search - 搜索维基百科',
            '/api/wiki/page - 获取维基百科页面',
            '/api/wiki/category - 获取分类页面',
            '/api/wiki/random - 获取随机页面',
            '/api/wiki/batch - 批量获取页面',
            '/api/wiki/languages - 获取支持的语言',
            '/api/zhihu/column - 获取知乎专栏信息',
            '/api/zhihu/column/posts - 获取专栏文章列表',
            '/api/zhihu/column/all - 获取专栏所有文章',
            '/api/zhihu/post - 获取文章详情',
            '/api/zhihu/search - 搜索知乎专栏',
            '/api/zhihu/batch - 批量获取文章',
            '/health - 健康检查'
        ]
    })


# ==================== 模拟测试 API (Mock API for Testing) ====================

# 模拟 Wikipedia 数据
MOCK_WIKI_DATA = {
    'pages': {
        'Python': {
            'pageid': 23862,
            'title': 'Python',
            'extract': 'Python是一种广泛使用的解释型、高级和通用的编程语言。Python的设计哲学强调代码的可读性和简洁的语法。Python支持多种编程范型，包括结构化、过程化、反射式、面向对象和函数式编程。',
            'url': 'https://zh.wikipedia.org/wiki/Python',
            'categories': ['编程语言', '脚本语言', '面向对象的编程语言'],
            'links': ['编程语言', '解释型语言', '面向对象编程'],
            'sections': [
                {'title': '历史', 'level': 1, 'text': 'Python由吉多·范罗苏姆创造，第一版发布于1991年。'},
                {'title': '特性', 'level': 1, 'text': 'Python是一种多范型编程语言，支持面向对象、命令式、函数式编程。'},
                {'title': '语法', 'level': 1, 'text': 'Python使用缩进来表示代码块，而不是使用大括号。'}
            ]
        },
        '人工智能': {
            'pageid': 12345,
            'title': '人工智能',
            'extract': '人工智能（英语：Artificial Intelligence，缩写为AI）亦称人工智慧、机器智能，指由人制造出来的机器所表现出来的智能。',
            'url': 'https://zh.wikipedia.org/wiki/人工智能',
            'categories': ['人工智能', '计算机科学'],
            'links': ['机器学习', '深度学习', '神经网络'],
            'sections': [
                {'title': '定义', 'level': 1, 'text': '人工智能的定义可以分为两部分。'},
                {'title': '历史', 'level': 1, 'text': '人工智能的研究始于20世纪50年代。'}
            ]
        },
        '机器学习': {
            'pageid': 67890,
            'title': '机器学习',
            'extract': '机器学习是人工智能的一个分支，是一门多领域交叉学科，涉及概率论、统计学、算法复杂度理论等多门学科。',
            'url': 'https://zh.wikipedia.org/wiki/机器学习',
            'categories': ['机器学习', '人工智能', '统计学'],
            'links': ['深度学习', '神经网络', '监督学习'],
            'sections': []
        }
    },
    'categories': {
        '编程语言': [
            {'title': 'Python', 'pageid': 23862},
            {'title': 'Java', 'pageid': 11111},
            {'title': 'JavaScript', 'pageid': 22222}
        ],
        '人工智能': [
            {'title': '机器学习', 'pageid': 67890},
            {'title': '深度学习', 'pageid': 33333},
            {'title': '自然语言处理', 'pageid': 44444}
        ]
    }
}

# 模拟知乎专栏数据
MOCK_ZHIHU_DATA = {
    'columns': {
        'test-column': {
            'slug': 'test-column',
            'title': '测试专栏',
            'description': '这是一个用于测试的知乎专栏',
            'intro': '专栏简介内容',
            'articlesCount': 3,
            'followersCount': 1234,
            'creator': {
                'name': '测试作者',
                'urlToken': 'test-author',
                'avatar': {'url': 'https://example.com/avatar.jpg'}
            },
            'imageUrl': 'https://example.com/column.jpg'
        },
        'tech-column': {
            'slug': 'tech-column',
            'title': '技术分享',
            'description': '分享技术文章和编程经验',
            'intro': '专注于技术领域的专栏',
            'articlesCount': 5,
            'followersCount': 5678,
            'creator': {
                'name': '技术达人',
                'urlToken': 'tech-master',
                'avatar': {'url': 'https://example.com/tech-avatar.jpg'}
            },
            'imageUrl': 'https://example.com/tech-column.jpg'
        }
    },
    'posts': {
        'test-column': [
            {
                'id': '100001',
                'title': '第一篇测试文章',
                'excerpt': '这是文章摘要内容...',
                'url': 'https://zhuanlan.zhihu.com/p/100001',
                'created': '2025-01-15T10:00:00',
                'updated': '2025-01-15T12:00:00',
                'voteupCount': 100,
                'commentCount': 20,
                'author': {'name': '测试作者'}
            },
            {
                'id': '100002',
                'title': '第二篇测试文章',
                'excerpt': '另一篇文章的摘要...',
                'url': 'https://zhuanlan.zhihu.com/p/100002',
                'created': '2025-01-16T10:00:00',
                'updated': '2025-01-16T12:00:00',
                'voteupCount': 150,
                'commentCount': 30,
                'author': {'name': '测试作者'}
            },
            {
                'id': '100003',
                'title': '第三篇测试文章',
                'excerpt': '第三篇文章摘要内容...',
                'url': 'https://zhuanlan.zhihu.com/p/100003',
                'created': '2025-01-17T10:00:00',
                'updated': '2025-01-17T12:00:00',
                'voteupCount': 200,
                'commentCount': 40,
                'author': {'name': '测试作者'}
            }
        ],
        'tech-column': [
            {
                'id': '200001',
                'title': 'Python 入门教程',
                'excerpt': 'Python 是一门简单易学的编程语言...',
                'url': 'https://zhuanlan.zhihu.com/p/200001',
                'created': '2025-01-10T10:00:00',
                'updated': '2025-01-10T12:00:00',
                'voteupCount': 500,
                'commentCount': 100,
                'author': {'name': '技术达人'}
            }
        ]
    },
    'articles': {
        '100001': {
            'id': '100001',
            'title': '第一篇测试文章',
            'content': '<p>这是第一篇测试文章的完整内容。</p><p>包含多个段落和丰富的文字描述。</p><h2>第一章</h2><p>章节内容...</p>',
            'excerpt': '这是文章摘要内容...',
            'url': 'https://zhuanlan.zhihu.com/p/100001',
            'created': '2025-01-15T10:00:00',
            'updated': '2025-01-15T12:00:00',
            'voteupCount': 100,
            'commentCount': 20,
            'author': {'name': '测试作者', 'urlToken': 'test-author', 'bio': '专栏作者'},
            'column': {'slug': 'test-column', 'title': '测试专栏'},
            'topics': [{'name': '测试'}, {'name': '技术'}]
        },
        '200001': {
            'id': '200001',
            'title': 'Python 入门教程',
            'content': '<p>Python 是一门简单易学的编程语言。</p><h2>安装 Python</h2><p>首先需要下载并安装 Python...</p><h2>Hello World</h2><p>print("Hello, World!")</p>',
            'excerpt': 'Python 是一门简单易学的编程语言...',
            'url': 'https://zhuanlan.zhihu.com/p/200001',
            'created': '2025-01-10T10:00:00',
            'updated': '2025-01-10T12:00:00',
            'voteupCount': 500,
            'commentCount': 100,
            'author': {'name': '技术达人', 'urlToken': 'tech-master', 'bio': '技术分享者'},
            'column': {'slug': 'tech-column', 'title': '技术分享'},
            'topics': [{'name': 'Python'}, {'name': '编程'}]
        }
    }
}

# 模拟萌娘百科数据
MOCK_MOEGIRL_DATA = {
    'pages': {
        '初音未来': {
            'pageid': 1001,
            'title': '初音未来',
            'extract': '初音未来（初音ミク，Hatsune Miku）是CRYPTON FUTURE MEDIA以Yamaha的VOCALOID系列语音合成程序为基础开发的音源库。',
            'url': 'https://zh.moegirl.org.cn/初音未来',
            'categories': ['VOCALOID角色', '虚拟歌手']
        },
        '原神': {
            'pageid': 1002,
            'title': '原神',
            'extract': '《原神》是由米哈游开发的一款开放世界冒险游戏。游戏发生在一个被称作「提瓦特」的幻想世界。',
            'url': 'https://zh.moegirl.org.cn/原神',
            'categories': ['游戏', '米哈游']
        }
    }
}

# 模拟哔哩哔哩数据
MOCK_BILIBILI_DATA = {
    'videos': {
        'BV1xx411c7mD': {
            'bvid': 'BV1xx411c7mD',
            'aid': 170001,
            'title': '【原神】璃月港日出延时摄影',
            'desc': '在璃月港拍摄的日出延时摄影作品',
            'duration': 180,
            'owner': {'mid': 123456, 'name': '测试UP主', 'face': 'https://example.com/face.jpg'},
            'stat': {'view': 100000, 'danmaku': 500, 'reply': 200, 'favorite': 1000, 'coin': 500, 'share': 100, 'like': 5000},
            'pubdate': 1704067200,
            'tname': '生活',
            'pic': 'https://example.com/cover.jpg'
        },
        'BV1GJ411x7h7': {
            'bvid': 'BV1GJ411x7h7',
            'aid': 170002,
            'title': 'Python 教程：从入门到精通',
            'desc': '最全面的 Python 编程教程',
            'duration': 3600,
            'owner': {'mid': 789012, 'name': '编程导师', 'face': 'https://example.com/face2.jpg'},
            'stat': {'view': 500000, 'danmaku': 2000, 'reply': 1000, 'favorite': 10000, 'coin': 5000, 'share': 2000, 'like': 20000},
            'pubdate': 1704153600,
            'tname': '科技',
            'pic': 'https://example.com/cover2.jpg'
        }
    },
    'users': {
        '123456': {
            'mid': 123456,
            'name': '测试UP主',
            'face': 'https://example.com/face.jpg',
            'sign': '热爱生活，热爱分享',
            'level': 6
        }
    }
}

# 模拟 GitHub 数据
MOCK_GITHUB_DATA = {
    'repos': {
        'torvalds/linux': {
            'name': 'linux',
            'full_name': 'torvalds/linux',
            'description': 'Linux kernel source tree',
            'html_url': 'https://github.com/torvalds/linux',
            'language': 'C',
            'stargazers_count': 180000,
            'forks_count': 55000,
            'open_issues_count': 300,
            'topics': ['linux', 'kernel', 'operating-system'],
            'created_at': '2011-09-04T22:48:12Z',
            'updated_at': '2025-01-29T10:00:00Z',
            'owner': {'login': 'torvalds', 'avatar_url': 'https://avatars.githubusercontent.com/u/1024025'}
        },
        'python/cpython': {
            'name': 'cpython',
            'full_name': 'python/cpython',
            'description': 'The Python programming language',
            'html_url': 'https://github.com/python/cpython',
            'language': 'Python',
            'stargazers_count': 60000,
            'forks_count': 28000,
            'open_issues_count': 7000,
            'topics': ['python', 'cpython', 'programming-language'],
            'created_at': '2017-02-10T19:23:51Z',
            'updated_at': '2025-01-29T10:00:00Z',
            'owner': {'login': 'python', 'avatar_url': 'https://avatars.githubusercontent.com/u/1525981'}
        }
    },
    'readmes': {
        'torvalds/linux': {
            'name': 'README',
            'path': 'README',
            'content': '# Linux kernel\n\nThis is the Linux kernel source code.\n\n## Building\n\nTo build the kernel, run `make`.',
            'html_url': 'https://github.com/torvalds/linux/blob/master/README'
        }
    }
}

# 模拟微博数据
MOCK_WEIBO_DATA = {
    'users': {
        '1234567890': {
            'id': 1234567890,
            'screen_name': '测试用户',
            'description': '这是一个测试账号',
            'followers_count': 10000,
            'follow_count': 500,
            'statuses_count': 1000,
            'profile_image_url': 'https://example.com/avatar.jpg',
            'verified': True
        }
    },
    'weibos': {
        '1234567890': [
            {
                'id': 'M001',
                'text': '今天天气真好，出门散步！#生活日常#',
                'created_at': '刚刚',
                'reposts_count': 10,
                'comments_count': 20,
                'attitudes_count': 100,
                'source': 'iPhone客户端'
            },
            {
                'id': 'M002',
                'text': '分享一个好用的编程技巧...',
                'created_at': '1小时前',
                'reposts_count': 50,
                'comments_count': 30,
                'attitudes_count': 200,
                'source': 'Android客户端'
            }
        ]
    },
    'hot': [
        {'word': '热搜话题1', 'num': 1000000, 'rank': 1, 'category': '娱乐'},
        {'word': '热搜话题2', 'num': 800000, 'rank': 2, 'category': '社会'},
        {'word': '热搜话题3', 'num': 600000, 'rank': 3, 'category': '科技'}
    ]
}

# 模拟 YouTube 数据
MOCK_YOUTUBE_DATA = {
    'videos': {
        'dQw4w9WgXcQ': {
            'video_id': 'dQw4w9WgXcQ',
            'title': 'Rick Astley - Never Gonna Give You Up',
            'description': 'The official video for Rick Astley\'s Never Gonna Give You Up',
            'channel_title': 'Rick Astley',
            'channel_id': 'UCuAXFkgsw1L7xaCfnd5JJOw',
            'published_at': '2009-10-25T06:57:33Z',
            'tags': ['music', '80s', 'classic'],
            'view_count': 1500000000,
            'like_count': 15000000,
            'comment_count': 3000000,
            'duration': 'PT3M33S'
        },
        'jNQXAC9IVRw': {
            'video_id': 'jNQXAC9IVRw',
            'title': 'Me at the zoo',
            'description': 'The first video on YouTube',
            'channel_title': 'jawed',
            'channel_id': 'UC4QobU6STFB0P71PMvOGN5A',
            'published_at': '2005-04-23T20:31:52Z',
            'tags': ['zoo', 'elephants', 'first'],
            'view_count': 300000000,
            'like_count': 12000000,
            'comment_count': 2000000,
            'duration': 'PT0M19S'
        }
    },
    'channels': {
        'UCuAXFkgsw1L7xaCfnd5JJOw': {
            'channel_id': 'UCuAXFkgsw1L7xaCfnd5JJOw',
            'title': 'Rick Astley',
            'description': 'Official YouTube channel of Rick Astley',
            'custom_url': '@RickAstleyYT',
            'thumbnail': 'https://example.com/rick.jpg',
            'subscriber_count': 5000000,
            'video_count': 50,
            'view_count': 2000000000
        }
    }
}

# 模拟贴吧数据
MOCK_TIEBA_DATA = {
    'forums': {
        '原神': {
            'name': '原神',
            'title': '原神吧',
            'member_count': '3000万',
            'post_count': '5亿'
        },
        'Python': {
            'name': 'Python',
            'title': 'Python吧',
            'member_count': '100万',
            'post_count': '500万'
        }
    },
    'posts': {
        '原神': [
            {'title': '4.5版本更新公告', 'url': '/p/123456', 'author': '官方账号', 'reply_count': '10000'},
            {'title': '新角色强度分析', 'url': '/p/123457', 'author': '攻略组', 'reply_count': '5000'},
            {'title': '今日抽卡分享', 'url': '/p/123458', 'author': '路人甲', 'reply_count': '200'}
        ],
        'Python': [
            {'title': 'Python入门指南', 'url': '/p/234567', 'author': '大神', 'reply_count': '1000'},
            {'title': '爬虫框架对比', 'url': '/p/234568', 'author': '技术宅', 'reply_count': '500'}
        ]
    },
    'post_details': {
        '123456': {
            'post_id': '123456',
            'title': '4.5版本更新公告',
            'content': '亲爱的旅行者们，4.5版本「光影流金」将于xx月xx日正式上线...',
            'author': '官方账号',
            'url': 'https://tieba.baidu.com/p/123456'
        }
    }
}

# 模拟 arXiv 数据
MOCK_ARXIV_DATA = {
    'papers': {
        '2401.12345': {
            'arxiv_id': '2401.12345',
            'title': 'Attention Is All You Need: A Survey',
            'summary': 'This paper presents a comprehensive survey of Transformer architectures and their applications in natural language processing, computer vision, and beyond.',
            'authors': ['John Smith', 'Jane Doe', 'Alice Johnson'],
            'categories': ['cs.CL', 'cs.LG'],
            'published': '2024-01-15T00:00:00Z',
            'updated': '2024-01-20T00:00:00Z',
            'pdf_url': 'https://arxiv.org/pdf/2401.12345'
        },
        '2401.67890': {
            'arxiv_id': '2401.67890',
            'title': 'Large Language Models: A Deep Dive',
            'summary': 'We explore the architecture, training, and capabilities of large language models, with a focus on recent developments in the field.',
            'authors': ['Bob Wilson', 'Carol Lee'],
            'categories': ['cs.AI', 'cs.CL'],
            'published': '2024-01-18T00:00:00Z',
            'updated': '2024-01-22T00:00:00Z',
            'pdf_url': 'https://arxiv.org/pdf/2401.67890'
        }
    },
    'recent': {
        'cs.AI': [
            {'arxiv_id': '2501.00001', 'title': 'Recent Advances in AI', 'authors': ['AI Researcher'], 'published': '2025-01-28T00:00:00Z'},
            {'arxiv_id': '2501.00002', 'title': 'Neural Network Optimization', 'authors': ['Deep Learner'], 'published': '2025-01-27T00:00:00Z'}
        ],
        'cs.CL': [
            {'arxiv_id': '2501.00003', 'title': 'Multilingual NLP', 'authors': ['NLP Expert'], 'published': '2025-01-28T00:00:00Z'}
        ]
    }
}


@app.route('/mock/wiki/api.php', methods=['GET'])
def mock_wiki_api():
    """模拟 Wikipedia MediaWiki API"""
    action = request.args.get('action', '')
    format_type = request.args.get('format', 'json')

    if action == 'query':
        list_type = request.args.get('list', '')
        prop = request.args.get('prop', '')

        # 搜索 API
        if list_type == 'search':
            query = request.args.get('srsearch', '')
            limit = int(request.args.get('srlimit', 10))
            results = []
            for title, page in MOCK_WIKI_DATA['pages'].items():
                if query.lower() in title.lower() or query.lower() in page['extract'].lower():
                    results.append({
                        'title': title,
                        'pageid': page['pageid'],
                        'snippet': page['extract'][:100]
                    })
            return jsonify({'query': {'search': results[:limit]}})

        # 随机页面 API
        if list_type == 'random':
            count = int(request.args.get('rnlimit', 5))
            import random
            pages = list(MOCK_WIKI_DATA['pages'].values())
            random.shuffle(pages)
            results = [{'title': p['title'], 'id': p['pageid']} for p in pages[:count]]
            return jsonify({'query': {'random': results}})

        # 分类成员 API
        if list_type == 'categorymembers':
            cat_title = request.args.get('cmtitle', '').replace('Category:', '')
            members = MOCK_WIKI_DATA['categories'].get(cat_title, [])
            results = [{'title': m['title'], 'pageid': m['pageid'], 'ns': 0} for m in members]
            return jsonify({'query': {'categorymembers': results}})

        # 页面内容 API
        titles = request.args.get('titles', '')
        if titles and titles in MOCK_WIKI_DATA['pages']:
            page = MOCK_WIKI_DATA['pages'][titles]
            page_data = {
                str(page['pageid']): {
                    'pageid': page['pageid'],
                    'title': page['title'],
                    'extract': page['extract'],
                    'fullurl': page['url'],
                    'categories': [{'title': f"Category:{c}"} for c in page['categories']],
                    'links': [{'title': l} for l in page['links']]
                }
            }
            return jsonify({'query': {'pages': page_data}})

    if action == 'parse':
        page_title = request.args.get('page', '')
        if page_title in MOCK_WIKI_DATA['pages']:
            page = MOCK_WIKI_DATA['pages'][page_title]
            return jsonify({
                'parse': {
                    'title': page['title'],
                    'sections': [{'line': s['title'], 'level': str(s['level'] + 1), 'index': str(i)}
                                for i, s in enumerate(page['sections'])]
                }
            })

    return jsonify({'error': 'Unknown action'}), 400


@app.route('/mock/zhihu/api/columns/<slug>', methods=['GET'])
def mock_zhihu_column(slug):
    """模拟知乎专栏信息 API"""
    if slug in MOCK_ZHIHU_DATA['columns']:
        return jsonify(MOCK_ZHIHU_DATA['columns'][slug])
    return jsonify({'error': 'Column not found'}), 404


@app.route('/mock/zhihu/api/columns/<slug>/articles', methods=['GET'])
def mock_zhihu_column_posts(slug):
    """模拟知乎专栏文章列表 API"""
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))

    if slug in MOCK_ZHIHU_DATA['posts']:
        posts = MOCK_ZHIHU_DATA['posts'][slug]
        return jsonify({'data': posts[offset:offset + limit]})
    return jsonify({'data': []})


@app.route('/mock/zhihu/api/posts/<post_id>', methods=['GET'])
def mock_zhihu_post(post_id):
    """模拟知乎文章详情 API"""
    if post_id in MOCK_ZHIHU_DATA['articles']:
        return jsonify(MOCK_ZHIHU_DATA['articles'][post_id])
    return jsonify({'error': 'Post not found'}), 404


# ==================== 萌娘百科模拟 API ====================

@app.route('/mock/moegirl/api.php', methods=['GET'])
def mock_moegirl_api():
    """模拟萌娘百科 MediaWiki API"""
    action = request.args.get('action', '')

    if action == 'query':
        list_type = request.args.get('list', '')

        if list_type == 'search':
            query = request.args.get('srsearch', '')
            results = []
            for title, page in MOCK_MOEGIRL_DATA['pages'].items():
                if query.lower() in title.lower() or query.lower() in page['extract'].lower():
                    results.append({
                        'title': title,
                        'pageid': page['pageid'],
                        'snippet': page['extract'][:100]
                    })
            return jsonify({'query': {'search': results}})

        titles = request.args.get('titles', '')
        if titles and titles in MOCK_MOEGIRL_DATA['pages']:
            page = MOCK_MOEGIRL_DATA['pages'][titles]
            return jsonify({'query': {'pages': {
                str(page['pageid']): {
                    'pageid': page['pageid'],
                    'title': page['title'],
                    'extract': page['extract'],
                    'fullurl': page['url'],
                    'categories': [{'title': c} for c in page['categories']]
                }
            }}})

    return jsonify({'error': 'Unknown action'}), 400


# ==================== 哔哩哔哩模拟 API ====================

@app.route('/mock/bilibili/x/web-interface/view', methods=['GET'])
def mock_bilibili_video():
    """模拟B站视频信息 API"""
    bvid = request.args.get('bvid', '')
    if bvid in MOCK_BILIBILI_DATA['videos']:
        return jsonify({'code': 0, 'data': MOCK_BILIBILI_DATA['videos'][bvid]})
    return jsonify({'code': -404, 'message': 'Video not found'})

@app.route('/mock/bilibili/x/web-interface/search/type', methods=['GET'])
def mock_bilibili_search():
    """模拟B站搜索 API"""
    keyword = request.args.get('keyword', '')
    results = []
    for bvid, video in MOCK_BILIBILI_DATA['videos'].items():
        if keyword.lower() in video['title'].lower():
            results.append({
                'bvid': bvid,
                'title': video['title'],
                'author': video['owner']['name'],
                'play': video['stat']['view'],
                'description': video['desc']
            })
    return jsonify({'code': 0, 'data': {'result': results}})

@app.route('/mock/bilibili/x/space/acc/info', methods=['GET'])
def mock_bilibili_user():
    """模拟B站用户信息 API"""
    mid = request.args.get('mid', '')
    if mid in MOCK_BILIBILI_DATA['users']:
        return jsonify({'code': 0, 'data': MOCK_BILIBILI_DATA['users'][mid]})
    return jsonify({'code': -404, 'message': 'User not found'})


# ==================== GitHub 模拟 API ====================

@app.route('/mock/github/repos/<owner>/<repo>', methods=['GET'])
def mock_github_repo(owner, repo):
    """模拟 GitHub 仓库 API"""
    key = f'{owner}/{repo}'
    if key in MOCK_GITHUB_DATA['repos']:
        return jsonify(MOCK_GITHUB_DATA['repos'][key])
    return jsonify({'message': 'Not Found'}), 404

@app.route('/mock/github/repos/<owner>/<repo>/readme', methods=['GET'])
def mock_github_readme(owner, repo):
    """模拟 GitHub README API"""
    key = f'{owner}/{repo}'
    if key in MOCK_GITHUB_DATA['readmes']:
        readme = MOCK_GITHUB_DATA['readmes'][key]
        import base64
        return jsonify({
            'name': readme['name'],
            'path': readme['path'],
            'content': base64.b64encode(readme['content'].encode()).decode(),
            'html_url': readme['html_url']
        })
    return jsonify({'message': 'Not Found'}), 404

@app.route('/mock/github/search/repositories', methods=['GET'])
def mock_github_search():
    """模拟 GitHub 搜索 API"""
    query = request.args.get('q', '')
    items = []
    for key, repo in MOCK_GITHUB_DATA['repos'].items():
        if query.lower() in repo['name'].lower() or query.lower() in (repo['description'] or '').lower():
            items.append(repo)
    return jsonify({'items': items})


# ==================== 微博模拟 API ====================

@app.route('/mock/weibo/api/container/getIndex', methods=['GET'])
def mock_weibo_container():
    """模拟微博容器 API"""
    uid = request.args.get('value', '')
    containerid = request.args.get('containerid', '')

    if uid in MOCK_WEIBO_DATA['users']:
        if containerid and containerid.startswith('107603'):
            # 返回微博列表
            weibos = MOCK_WEIBO_DATA['weibos'].get(uid, [])
            cards = [{'card_type': 9, 'mblog': w} for w in weibos]
            return jsonify({'ok': 1, 'data': {'cards': cards}})
        else:
            # 返回用户信息
            return jsonify({'ok': 1, 'data': {'userInfo': MOCK_WEIBO_DATA['users'][uid]}})

    return jsonify({'ok': 0, 'message': 'User not found'})


# ==================== YouTube 模拟 API ====================

@app.route('/mock/youtube/videos', methods=['GET'])
def mock_youtube_video():
    """模拟 YouTube 视频 API"""
    video_id = request.args.get('id', '')
    if video_id in MOCK_YOUTUBE_DATA['videos']:
        video = MOCK_YOUTUBE_DATA['videos'][video_id]
        return jsonify({'items': [{
            'id': video_id,
            'snippet': {
                'title': video['title'],
                'description': video['description'],
                'channelTitle': video['channel_title'],
                'channelId': video['channel_id'],
                'publishedAt': video['published_at'],
                'tags': video.get('tags', [])
            },
            'statistics': {
                'viewCount': str(video['view_count']),
                'likeCount': str(video['like_count']),
                'commentCount': str(video['comment_count'])
            },
            'contentDetails': {'duration': video['duration']}
        }]})
    return jsonify({'items': []})


@app.route('/mock/youtube/search', methods=['GET'])
def mock_youtube_search():
    """模拟 YouTube 搜索 API"""
    query = request.args.get('q', '').lower()
    results = []
    for vid, video in MOCK_YOUTUBE_DATA['videos'].items():
        if query in video['title'].lower() or query in video['description'].lower():
            results.append({
                'id': {'videoId': vid},
                'snippet': {
                    'title': video['title'],
                    'description': video['description'],
                    'channelTitle': video['channel_title'],
                    'publishedAt': video['published_at'],
                    'thumbnails': {'high': {'url': 'https://example.com/thumb.jpg'}}
                }
            })
    return jsonify({'items': results})


@app.route('/mock/youtube/channels', methods=['GET'])
def mock_youtube_channel():
    """模拟 YouTube 频道 API"""
    channel_id = request.args.get('id', '')
    if channel_id in MOCK_YOUTUBE_DATA['channels']:
        channel = MOCK_YOUTUBE_DATA['channels'][channel_id]
        return jsonify({'items': [{
            'snippet': {
                'title': channel['title'],
                'description': channel['description'],
                'customUrl': channel['custom_url'],
                'thumbnails': {'high': {'url': channel['thumbnail']}}
            },
            'statistics': {
                'subscriberCount': str(channel['subscriber_count']),
                'videoCount': str(channel['video_count']),
                'viewCount': str(channel['view_count'])
            }
        }]})
    return jsonify({'items': []})


# ==================== 贴吧模拟 API ====================

@app.route('/mock/tieba/f', methods=['GET'])
def mock_tieba_forum():
    """模拟贴吧论坛页面"""
    kw = request.args.get('kw', '')
    if kw in MOCK_TIEBA_DATA['forums']:
        forum = MOCK_TIEBA_DATA['forums'][kw]
        posts = MOCK_TIEBA_DATA['posts'].get(kw, [])
        # 返回模拟的HTML
        html = f'''
        <html><body>
        <a class="card_title_fname">{forum['title']}</a>
        <span class="card_menNum">{forum['member_count']}</span>
        <span class="card_infoNum">{forum['post_count']}</span>
        <ul>
        '''
        for post in posts:
            html += f'''
            <li class="j_thread_list">
                <a class="j_th_tit" href="{post['url']}">{post['title']}</a>
                <span class="tb_icon_author">{post['author']}</span>
                <span class="threadlist_rep_num">{post['reply_count']}</span>
            </li>
            '''
        html += '</ul></body></html>'
        return html
    return '<html><body>贴吧不存在</body></html>', 404


@app.route('/mock/tieba/p/<post_id>', methods=['GET'])
def mock_tieba_post(post_id):
    """模拟贴吧帖子详情页面"""
    if post_id in MOCK_TIEBA_DATA['post_details']:
        post = MOCK_TIEBA_DATA['post_details'][post_id]
        html = f'''
        <html><body>
        <h1 class="core_title_txt">{post['title']}</h1>
        <div class="d_post_content">{post['content']}</div>
        <a class="p_author_name">{post['author']}</a>
        </body></html>
        '''
        return html
    return '<html><body>帖子不存在</body></html>', 404


# ==================== arXiv 模拟 API ====================

@app.route('/mock/arxiv/api/query', methods=['GET'])
def mock_arxiv_api():
    """模拟 arXiv API"""
    search_query = request.args.get('search_query', '')
    id_list = request.args.get('id_list', '')

    # 按 ID 查询
    if id_list:
        if id_list in MOCK_ARXIV_DATA['papers']:
            paper = MOCK_ARXIV_DATA['papers'][id_list]
            xml = f'''<?xml version="1.0" encoding="UTF-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
                <entry>
                    <id>http://arxiv.org/abs/{paper['arxiv_id']}</id>
                    <title>{paper['title']}</title>
                    <summary>{paper['summary']}</summary>
                    <published>{paper['published']}</published>
                    <updated>{paper['updated']}</updated>
                    {''.join(f'<author><name>{a}</name></author>' for a in paper['authors'])}
                    {''.join(f'<category term="{c}"/>' for c in paper['categories'])}
                    <link title="pdf" href="{paper['pdf_url']}"/>
                </entry>
            </feed>'''
            return xml, 200, {'Content-Type': 'application/xml'}
        return '<?xml version="1.0"?><feed></feed>', 200, {'Content-Type': 'application/xml'}

    # 搜索查询
    if search_query:
        query = search_query.replace('all:', '').replace('cat:', '').lower()
        results = []

        # 搜索所有论文
        for paper_id, paper in MOCK_ARXIV_DATA['papers'].items():
            if query in paper['title'].lower() or query in paper['summary'].lower():
                results.append(paper)

        # 检查分类搜索
        if 'cat:' in search_query:
            cat = search_query.split('cat:')[1].split()[0] if 'cat:' in search_query else ''
            if cat in MOCK_ARXIV_DATA['recent']:
                for p in MOCK_ARXIV_DATA['recent'][cat]:
                    results.append({
                        'arxiv_id': p['arxiv_id'],
                        'title': p['title'],
                        'summary': '',
                        'authors': p['authors'],
                        'categories': [cat],
                        'published': p['published'],
                        'updated': p['published'],
                        'pdf_url': f"https://arxiv.org/pdf/{p['arxiv_id']}"
                    })

        entries = ''
        for paper in results:
            entries += f'''
                <entry>
                    <id>http://arxiv.org/abs/{paper['arxiv_id']}</id>
                    <title>{paper['title']}</title>
                    <summary>{paper.get('summary', '')}</summary>
                    <published>{paper['published']}</published>
                    <updated>{paper.get('updated', paper['published'])}</updated>
                    {''.join(f'<author><name>{a}</name></author>' for a in paper['authors'])}
                    {''.join(f'<category term="{c}"/>' for c in paper.get('categories', []))}
                    <link title="pdf" href="{paper.get('pdf_url', '')}"/>
                </entry>
            '''
        xml = f'<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">{entries}</feed>'
        return xml, 200, {'Content-Type': 'application/xml'}


# ==================== 测试路由 (新增平台) ====================

@app.route('/api/test/moegirl/search', methods=['GET'])
def test_moegirl_search():
    """测试萌娘百科搜索"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_moegirl_crawler(test_mode=True)
        results = crawler.search(query)
        return jsonify({'mode': 'test', 'query': query, 'results': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test/bilibili/video', methods=['GET'])
def test_bilibili_video():
    """测试B站视频"""
    bvid = request.args.get('bvid', '')
    if not bvid:
        return jsonify({'error': '请提供 BVID'}), 400
    try:
        crawler = get_bilibili_crawler(test_mode=True)
        video = crawler.get_video_info(bvid)
        if not video:
            return jsonify({'error': f'视频不存在: {bvid}'}), 404
        video['mode'] = 'test'
        return jsonify(video)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test/github/repo', methods=['GET'])
def test_github_repo():
    """测试 GitHub 仓库"""
    owner = request.args.get('owner', '')
    repo = request.args.get('repo', '')
    if not owner or not repo:
        return jsonify({'error': '请提供 owner 和 repo'}), 400
    try:
        crawler = get_github_crawler(test_mode=True)
        repo_info = crawler.get_repo(owner, repo)
        if not repo_info:
            return jsonify({'error': f'仓库不存在'}), 404
        repo_info['mode'] = 'test'
        return jsonify(repo_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test/weibo/user', methods=['GET'])
def test_weibo_user():
    """测试微博用户"""
    uid = request.args.get('uid', '')
    if not uid:
        return jsonify({'error': '请提供 UID'}), 400
    try:
        crawler = get_weibo_crawler(test_mode=True)
        user = crawler.get_user_info(uid)
        if not user:
            return jsonify({'error': f'用户不存在'}), 404
        user['mode'] = 'test'
        return jsonify(user)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/youtube/video', methods=['GET'])
def test_youtube_video():
    """测试 YouTube 视频"""
    video_id = request.args.get('id', '')
    if not video_id:
        return jsonify({'error': '请提供视频 ID'}), 400
    try:
        crawler = get_youtube_crawler(test_mode=True)
        video = crawler.get_video_info(video_id)
        if not video:
            return jsonify({'error': f'视频不存在'}), 404
        video['mode'] = 'test'
        return jsonify(video)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/tieba/forum', methods=['GET'])
def test_tieba_forum():
    """测试贴吧信息"""
    name = request.args.get('name', '')
    if not name:
        return jsonify({'error': '请提供贴吧名称'}), 400
    try:
        crawler = get_tieba_crawler(test_mode=True)
        forum = crawler.get_forum_info(name)
        if not forum:
            return jsonify({'error': f'贴吧不存在'}), 404
        forum['mode'] = 'test'
        return jsonify(forum)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/arxiv/search', methods=['GET'])
def test_arxiv_search():
    """测试 arXiv 搜索"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': '请提供搜索关键词'}), 400
    try:
        crawler = get_arxiv_crawler(test_mode=True)
        papers = crawler.search_papers(query)
        return jsonify({'mode': 'test', 'query': query, 'papers': papers, 'count': len(papers)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/hub/crawl', methods=['POST'])
def test_hub_crawl():
    """测试爬虫中台爬取"""
    if not request.json:
        return jsonify({'error': '请提供请求数据'}), 400

    platform = request.json.get('platform', '')
    method = request.json.get('method', '')
    args = request.json.get('args', [])
    kwargs = request.json.get('kwargs', {})

    if not platform or not method:
        return jsonify({'error': '请提供 platform 和 method'}), 400

    try:
        hub = get_crawler_hub(test_mode=True)
        result = hub.crawl(platform, method, *args, **kwargs)
        return jsonify({
            'mode': 'test',
            'platform': platform,
            'method': method,
            'result': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # 获取端口，默认为5000
    port = int(os.environ.get('PORT', 5000))
    
    # 打印启动信息
    print(f"全息拉普拉斯互联网爬虫系统服务器启动在端口 {port}...")
    print(f"上传目录: {UPLOAD_FOLDER}")
    print(f"结果目录: {RESULTS_FOLDER}")
    print("按Ctrl+C停止服务器")
    
    # 启动Flask应用
    app.run(host='0.0.0.0', port=port, debug=False)