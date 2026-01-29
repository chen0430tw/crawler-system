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
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 限制上传大小为16MB

# 存储爬虫任务状态
tasks = {}

# 任务状态定义
TASK_STATUS = {
    'PENDING': '等待中',
    'RUNNING': '运行中',
    'COMPLETED': '已完成',
    'FAILED': '失败'
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
        
        logger.info(f"任务 {task_id} 开始运行，爬取 {len(urls)} 个URL，深度为 {depth}")
        
        # 更新任务详情
        tasks[task_id]['details'] = {
            'urls_count': len(urls),
            'depth': depth,
            'format': format_type,
            'concurrency': concurrency,
            'urban_legend_enabled': enable_urban_legend
        }
        
        # 初始化爬虫组件
        crawler = WebCrawler(max_workers=concurrency)
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
        lang: 语言 (默认 zh)
    """
    title = request.args.get('title', '')
    language = request.args.get('lang', 'zh')

    if not title:
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