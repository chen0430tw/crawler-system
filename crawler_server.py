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

@app.route('/', methods=['GET'])
def index():
    """默认路由"""
    return jsonify({
        'message': '全息拉普拉斯互联网爬虫系统API服务',
        'version': '1.0.0',
        'endpoints': [
            '/api/submit - 提交爬虫任务',
            '/api/status/<task_id> - 获取任务状态',
            '/api/result/<task_id> - 获取任务结果',
            '/api/download/<task_id> - 下载任务结果文件',
            '/api/tasks - 列出所有任务',
            '/api/cancel/<task_id> - 取消任务',
            '/api/upload - 上传配置文件',
            '/health - 健康检查'
        ]
    })

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