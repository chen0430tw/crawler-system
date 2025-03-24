#!/usr/bin/env python3
"""
全息拉普拉斯互联网爬虫系统 - 本地爬虫脚本
使用方法:
1. 从网页界面下载配置文件 crawler_config.json
2. 将配置文件放在本脚本同一目录
3. 运行脚本: python crawler.py
4. 脚本会生成结果文件 crawler_results.json
5. 将结果文件上传到网页界面查看分析结果
"""

import os
import sys
import json
import time
import logging
import argparse
import hashlib
import re
import random
import numpy as np
from datetime import datetime
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor

try:
    import requests
    from bs4 import BeautifulSoup
    import nltk
    nltk.download('punkt_tab')
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from nltk.stem import WordNetLemmatizer
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
except ImportError:
    print("缺少必要的库。请运行以下命令安装依赖:")
    print("pip install requests beautifulsoup4 nltk scikit-learn")
    sys.exit(1)

# 创建自定义JSON编码器，处理NumPy类型
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("crawler.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Crawler")

# 确保NLTK资源可用
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
    nltk.data.find('corpora/wordnet')
except LookupError:
    print("下载NLTK资源...")
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('wordnet')


class WebCrawler:
    """网页爬虫类，负责下载和解析网页"""
    
    def __init__(self, max_workers=3, max_retries=3, timeout=30):
        """
        初始化爬虫
        
        参数:
            max_workers: 最大并发数
            max_retries: 最大重试次数
            timeout: 请求超时时间(秒)
        """
        self.max_workers = max_workers
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.visited_urls = set()
        
        # 设置随机用户代理
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
        ]
        
    def _get_random_user_agent(self):
        """获取随机用户代理"""
        return random.choice(self.user_agents)
        
    def _get_random_delay(self, min_delay=1, max_delay=3):
        """获取随机延迟时间"""
        return random.uniform(min_delay, max_delay)
        
    def download_page(self, url, retry_count=0):
        """
        下载网页内容
        
        参数:
            url: 网页URL
            retry_count: 当前重试次数
            
        返回:
            (html_content, status_code) 元组，失败返回 (None, status_code)
        """
        if retry_count >= self.max_retries:
            logger.error(f"达到最大重试次数 {self.max_retries}，放弃URL: {url}")
            return None, 0
            
        # 添加随机延迟防止被封
        time.sleep(self._get_random_delay())
        
        try:
            headers = {
                'User-Agent': self._get_random_user_agent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            # 如果URL不以http开头，添加协议
            if not url.startswith(('http://', 'https://')):
                url = 'http://' + url
                
            response = self.session.get(url, headers=headers, timeout=self.timeout)
            status_code = response.status_code
            
            if status_code == 200:
                # 检查内容类型
                content_type = response.headers.get('Content-Type', '')
                
                # 允许处理HTML和PDF等内容
                if 'text/html' in content_type or 'application/xhtml+xml' in content_type:
                    return response.text, status_code
                elif 'application/pdf' in content_type:
                    # 标记为PDF并返回内容
                    logger.info(f"检测到PDF文件: {url}")
                    return f"PDF_CONTENT_{url}", status_code
                else:
                    logger.warning(f"不支持的内容类型: {url}, 内容类型: {content_type}")
                    return f"UNSUPPORTED_CONTENT_{content_type}", status_code
            elif status_code in [403, 429]:
                # 可能被反爬，增加延迟后重试
                retry_delay = self._get_random_delay(3, 10)
                logger.warning(f"可能被反爬，状态码: {status_code}，等待 {retry_delay:.2f} 秒后重试: {url}")
                time.sleep(retry_delay)
                return self.download_page(url, retry_count + 1)
            else:
                logger.error(f"下载失败，状态码: {status_code}, URL: {url}")
                return None, status_code
                
        except requests.exceptions.Timeout:
            logger.warning(f"请求超时: {url}，正在重试 ({retry_count + 1}/{self.max_retries})")
            return self.download_page(url, retry_count + 1)
            
        except requests.exceptions.ConnectionError:
            logger.warning(f"连接错误: {url}，正在重试 ({retry_count + 1}/{self.max_retries})")
            time.sleep(self._get_random_delay(2, 5))
            return self.download_page(url, retry_count + 1)
            
        except Exception as e:
            logger.error(f"下载出错: {url}, 错误: {str(e)}")
            return None, 0
    
    def parse_html(self, html_content, url):
        """
        解析HTML内容
        
        参数:
            html_content: HTML内容字符串
            url: 原始URL（用于解析相对链接）
            
        返回:
            (title, content, links) 元组
        """
        if not html_content:
            return None, None, []
            
        # 处理PDF或其他不支持的内容
        if isinstance(html_content, str) and html_content.startswith("PDF_CONTENT_"):
            return f"PDF文件: {url}", f"这是一个PDF文件，无法直接显示内容。下载链接: {url}", []
        
        if isinstance(html_content, str) and html_content.startswith("UNSUPPORTED_CONTENT_"):
            content_type = html_content.replace("UNSUPPORTED_CONTENT_", "")
            return f"不支持的内容: {url}", f"这是一个{content_type}类型的文件，无法直接显示内容。下载链接: {url}", []
            
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 提取标题
            title = soup.title.text.strip() if soup.title else "无标题"
            
            # 提取正文内容（简单实现，可优化）
            content_tags = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article'])
            content = "\n".join([tag.text.strip() for tag in content_tags])
            
            # 提取链接
            links = []
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                # 将相对URL转为绝对URL
                absolute_url = urljoin(url, href)
                # 排除锚点链接和JavaScript链接
                if not href.startswith('#') and not href.startswith('javascript:'):
                    links.append(absolute_url)
                    
            return title, content, links
            
        except Exception as e:
            logger.error(f"解析HTML出错: {url}, 错误: {str(e)}")
            return None, None, []
    
    def crawl(self, url, depth=1):
        """
        爬取网页，支持深度爬取
        
        参数:
            url: 起始URL
            depth: 爬取深度
            
        返回:
            爬取结果字典
        """
        if depth <= 0 or url in self.visited_urls:
            return {}
            
        self.visited_urls.add(url)
        result = {url: {'depth': 0, 'title': None, 'content': None, 'links': [], 'status': None}}
            
        # 下载页面
        html_content, status_code = self.download_page(url)
        result[url]['status'] = status_code
        
        # 解析内容
        if html_content:
            title, content, links = self.parse_html(html_content, url)
            result[url]['title'] = title
            result[url]['content'] = content
            result[url]['links'] = links
            result[url]['html'] = html_content
            
            # 如果需要继续深度爬取
            if depth > 1:
                child_results = {}
                # 限制爬取链接数量，避免过多请求
                for child_url in links[:min(10, len(links))]:
                    # 只爬取同域名下的链接
                    if self._is_same_domain(url, child_url) and child_url not in self.visited_urls:
                        child_result = self.crawl(child_url, depth - 1)
                        if child_result:
                            for k, v in child_result.items():
                                v['depth'] = result[url]['depth'] + 1
                                child_results[k] = v
                
                result.update(child_results)
                
        return result
        
    def batch_crawl(self, urls, depth=1):
        """
        批量爬取多个URL
        
        参数:
            urls: URL列表
            depth: 爬取深度
            
        返回:
            爬取结果字典
        """
        results = {}
        futures = []
        
        # 提交所有任务
        for url in urls:
            if url not in self.visited_urls:
                futures.append(self.executor.submit(self.crawl, url, depth))
        
        # 收集结果
        for future in futures:
            try:
                result = future.result()
                results.update(result)
            except Exception as e:
                logger.error(f"爬取任务失败: {str(e)}")
                
        return results
    
    def _is_same_domain(self, url1, url2):
        """检查两个URL是否属于同一域名"""
        domain1 = urlparse(url1).netloc
        domain2 = urlparse(url2).netloc
        return domain1 == domain2
        
    def close(self):
        """关闭资源"""
        self.executor.shutdown(wait=True)
        self.session.close()


class DataProcessor:
    """数据处理类，负责清洗和分类网页内容"""
    
    def __init__(self):
        """初始化处理器"""
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        
    def clean_html(self, html_content, base_url=None):
        """
        清洗HTML内容，移除导航栏、广告、页脚等，并转换相对URL为绝对URL
        
        参数:
            html_content: 原始HTML内容
            base_url: HTML内容的基础URL，用于转换相对URL
            
        返回:
            清洗后的HTML内容
        """
        if not html_content:
            return ""
        
        # 处理特殊内容类型
        if isinstance(html_content, str) and (html_content.startswith("PDF_CONTENT_") or
                                             html_content.startswith("UNSUPPORTED_CONTENT_")):
            return html_content
        
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 移除常见噪声元素
            noise_tags = [
                'script', 'style', 'nav', 'footer', 'header', 'aside',
                'iframe', 'noscript', 'meta', 'svg'
            ]
            
            for tag in noise_tags:
                for element in soup.find_all(tag):
                    element.decompose()
            
            # 移除常见广告和导航区域(基于常见类名和ID)
            ad_classes = [
                'ad', 'ads', 'advertisement', 'banner', 'social',
                'sidebar', 'footer', 'header', 'nav', 'menu'
            ]
            
            for cls in ad_classes:
                for element in soup.find_all(class_=re.compile(cls, re.I)):
                    element.decompose()
                for element in soup.find_all(id=re.compile(cls, re.I)):
                    element.decompose()
            
            # 如果提供了基础URL，将所有相对URL转换为绝对URL
            if base_url:
                # 转换图片链接
                for img in soup.find_all('img', src=True):
                    img['src'] = urljoin(base_url, img['src'])
                
                # 转换CSS链接
                for link in soup.find_all('link', href=True):
                    link['href'] = urljoin(base_url, link['href'])
                
                # 转换超链接
                for a in soup.find_all('a', href=True):
                    a['href'] = urljoin(base_url, a['href'])
                
                # 转换其他可能的相对URL资源
                for elem in soup.find_all(src=True):
                    elem['src'] = urljoin(base_url, elem['src'])
                
                for elem in soup.find_all(href=True):
                    elem['href'] = urljoin(base_url, elem['href'])
            
            # 保留主要内容区域
            main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile('content|article|post|body', re.I))
            
            if main_content:
                # 只保留主要内容区
                clean_html = str(main_content)
            else:
                # 如果找不到主要内容区，则使用整个body
                body = soup.find('body')
                clean_html = str(body) if body else str(soup)
            
            return clean_html
            
        except Exception as e:
            logger.error(f"清洗HTML出错: {str(e)}")
            return html_content
    
    def extract_text_from_html(self, html_content):
        """
        从HTML提取纯文本
        
        参数:
            html_content: HTML内容
            
        返回:
            提取的纯文本
        """
        if not html_content:
            return ""
            
        # 处理特殊内容类型
        if isinstance(html_content, str) and (html_content.startswith("PDF_CONTENT_") or
                                             html_content.startswith("UNSUPPORTED_CONTENT_")):
            if html_content.startswith("PDF_CONTENT_"):
                url = html_content.replace("PDF_CONTENT_", "")
                return f"这是一个PDF文件，无法直接显示内容。下载链接: {url}"
            else:
                content_type = html_content.replace("UNSUPPORTED_CONTENT_", "")
                return f"这是一个{content_type}类型的文件，无法直接显示内容。"
            
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 提取所有文本，保留基本格式
            text_parts = []
            
            # 处理标题
            for i in range(1, 7):
                for heading in soup.find_all(f'h{i}'):
                    text = heading.get_text(strip=True)
                    if text:
                        text_parts.append(f"{'#' * i} {text}\n")
            
            # 处理段落
            for p in soup.find_all('p'):
                text = p.get_text(strip=True)
                if text:
                    text_parts.append(f"{text}\n")
            
            # 处理列表
            for ul in soup.find_all('ul'):
                for li in ul.find_all('li'):
                    text = li.get_text(strip=True)
                    if text:
                        text_parts.append(f"- {text}\n")
            
            for ol in soup.find_all('ol'):
                for i, li in enumerate(ol.find_all('li'), 1):
                    text = li.get_text(strip=True)
                    if text:
                        text_parts.append(f"{i}. {text}\n")
            
            # 如果上面的提取结果为空，则提取所有文本
            if not text_parts:
                text = soup.get_text(separator='\n', strip=True)
                text_parts = [text]
            
            return '\n'.join(text_parts)
            
        except Exception as e:
            logger.error(f"提取文本出错: {str(e)}")
            return ""
    
    def clean_text(self, text):
        """
        清洗文本，移除特殊字符、标点符号等
        
        参数:
            text: 原始文本
            
        返回:
            清洗后的文本
        """
        if not text:
            return ""
            
        try:
            # 转换为小写
            text = text.lower()
            
            # 移除URL
            text = re.sub(r'https?://\S+|www\.\S+', '', text)
            
            # 移除HTML标签残留
            text = re.sub(r'<.*?>', '', text)
            
            # 移除非字母数字字符（保留空格和换行）
            text = re.sub(r'[^\w\s\n]', '', text)
            
            # 移除多余空白字符
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text
            
        except Exception as e:
            logger.error(f"清洗文本出错: {str(e)}")
            return text
    
    def preprocess_text(self, text):
        """
        文本预处理（用于分类）
        
        参数:
            text: 原始文本
            
        返回:
            预处理后的文本
        """
        if not text:
            return ""
            
        try:
            # 清洗文本
            text = self.clean_text(text)
            
            # 尝试使用nltk进行分词
            try:
                tokens = word_tokenize(text)
                
                # 移除停用词和短单词
                tokens = [token for token in tokens if token not in self.stop_words and len(token) > 2]
                
                # 词形还原
                tokens = [self.lemmatizer.lemmatize(token) for token in tokens]
                
                # 重新组合为文本
                preprocessed_text = ' '.join(tokens)
                
                return preprocessed_text
            except LookupError as e:
                # 如果缺少NLTK资源，使用简单的空格分词作为回退
                logger.warning(f"NLTK资源缺失，使用简单分词: {str(e)}")
                
                # 简单分词
                tokens = text.split()
                
                # 移除短单词
                tokens = [token for token in tokens if len(token) > 2]
                
                return ' '.join(tokens)
                
        except Exception as e:
            logger.error(f"预处理文本出错: {str(e)}")
            # 返回原始文本作为回退
            return text
    
    def extract_keywords(self, text, top_n=10):
        """
        提取文本关键词
        
        参数:
            text: 文本内容
            top_n: 返回的关键词数量
            
        返回:
            关键词列表
        """
        if not text:
            return []
            
        try:
            # 尝试使用NLTK
            try:
                # 预处理文本
                preprocessed_text = self.preprocess_text(text)
                
                # 分词
                tokens = word_tokenize(preprocessed_text)
                
                # 计算词频
                word_freq = {}
                for token in tokens:
                    if token in word_freq:
                        word_freq[token] += 1
                    else:
                        word_freq[token] = 1
                
                # 选择频率最高的词作为关键词
                keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
                
                return [keyword for keyword, _ in keywords]
                
            except LookupError as e:
                # 如果缺少NLTK资源，使用简单的方法提取关键词
                logger.warning(f"NLTK资源缺失，使用简单关键词提取: {str(e)}")
                
                # 简单分词
                tokens = text.lower().split()
                
                # 移除短单词
                tokens = [token for token in tokens if len(token) > 2]
                
                # 计算词频
                word_freq = {}
                for token in tokens:
                    if token in word_freq:
                        word_freq[token] += 1
                    else:
                        word_freq[token] = 1
                
                # 选择频率最高的词作为关键词
                keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
                
                return [keyword for keyword, _ in keywords]
                
        except Exception as e:
            logger.error(f"提取关键词出错: {str(e)}")
            return []
    
    def classify_content(self, content_list, n_clusters=5):
        """
        对内容进行分类
        
        参数:
            content_list: 内容列表
            n_clusters: 分类数量
            
        返回:
            分类结果字典，键为分类ID，值为该分类中的内容索引列表
        """
        if not content_list or len(content_list) < n_clusters:
            return {0: list(range(len(content_list)))}
            
        try:
            # 预处理所有文本
            try:
                preprocessed_texts = [self.preprocess_text(text) for text in content_list]
                
                # 使用TF-IDF向量化文本
                vectorizer = TfidfVectorizer(max_features=1000)
                X = vectorizer.fit_transform(preprocessed_texts)
                
                # 使用K-Means聚类
                kmeans = KMeans(n_clusters=min(n_clusters, len(content_list)), random_state=42)
                kmeans.fit(X)
                
                # 获取聚类结果
                labels = kmeans.labels_
                
                # 整理分类结果
                clusters = {}
                for i, label in enumerate(labels):
                    label_int = int(label)  # 确保标签是Python原生整数
                    if label_int not in clusters:
                        clusters[label_int] = []
                    clusters[label_int].append(i)
                    
                return clusters
                
            except LookupError as e:
                # NLTK问题，使用简单分类
                logger.warning(f"NLTK相关错误，使用简单分类: {str(e)}")
                
                # 平均分配到n_clusters组
                n = len(content_list)
                actual_clusters = min(n_clusters, n)
                
                # 如果数据太少，就分成一组
                if n <= actual_clusters:
                    return {0: list(range(n))}
                    
                # 简单分组 - 平均分配
                clusters = {}
                items_per_cluster = n // actual_clusters
                remainder = n % actual_clusters
                
                start = 0
                for i in range(actual_clusters):
                    # 为前remainder个组多分配一个元素
                    count = items_per_cluster + (1 if i < remainder else 0)
                    clusters[i] = list(range(start, start + count))
                    start += count
                    
                return clusters
                
        except Exception as e:
            logger.error(f"分类内容出错: {str(e)}")
            # 返回单一分类作为回退
            return {0: list(range(len(content_list)))}
    
    def format_content(self, content, format_type='txt'):
        """
        格式化内容
        
        参数:
            content: 内容文本
            format_type: 格式类型，'txt'或'html'
            
        返回:
            格式化后的内容
        """
        if not content:
            return ""
            
        # 处理特殊内容类型
        if isinstance(content, str) and (content.startswith("PDF_CONTENT_") or
                                        content.startswith("UNSUPPORTED_CONTENT_")):
            if content.startswith("PDF_CONTENT_"):
                url = content.replace("PDF_CONTENT_", "")
                return f"这是一个PDF文件，无法直接显示内容。下载链接: {url}"
            else:
                content_type = content.replace("UNSUPPORTED_CONTENT_", "")
                return f"这是一个{content_type}类型的文件，无法直接显示内容。"
            
        if format_type.lower() == 'txt':
            # 确保纯文本格式
            return self.extract_text_from_html(content) if '<' in content and '>' in content else content
            
        elif format_type.lower() == 'html':
            # 如果内容已经是HTML，清洗它
            if '<' in content and '>' in content:
                return self.clean_html(content)
            
            # 如果是纯文本，转为HTML
            else:
                html_parts = ['<!DOCTYPE html>', '<html>', '<head><meta charset="UTF-8"></head>', '<body>']
                
                # 分段处理
                paragraphs = content.split('\n\n')
                for p in paragraphs:
                    if p.strip():
                        # 检查是否是标题（以#开头）
                        if p.strip().startswith('#'):
                            level = 0
                            for char in p:
                                if char == '#':
                                    level += 1
                                else:
                                    break
                            level = min(level, 6)  # h1-h6
                            title_text = p[level:].strip()
                            html_parts.append(f'<h{level}>{title_text}</h{level}>')
                        else:
                            html_parts.append(f'<p>{p.strip()}</p>')
                
                html_parts.extend(['</body>', '</html>'])
                return '\n'.join(html_parts)
                
        else:
            logger.warning(f"不支持的格式类型: {format_type}")
            return content


class StorageManager:
    """存储管理类，负责保存爬取结果"""
    
    def __init__(self, base_dir='./crawled_data'):
        """
        初始化存储管理器
        
        参数:
            base_dir: 基础存储目录
        """
        self.base_dir = base_dir
        self._ensure_base_dir()
        
    def _ensure_base_dir(self):
        """确保基础目录存在"""
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            logger.info(f"创建基础目录: {self.base_dir}")
            
    def _get_domain_dir(self, url):
        """
        获取URL对应的域名目录
        
        参数:
            url: 网页URL
            
        返回:
            域名目录路径
        """
        parsed_url = urlparse(url)
        domain = parsed_url.netloc
        
        # 创建域名目录
        domain_dir = os.path.join(self.base_dir, domain)
        if not os.path.exists(domain_dir):
            os.makedirs(domain_dir)
            
        return domain_dir
        
    def _get_url_filename(self, url, format_type):
        """
        生成URL对应的文件名
        
        参数:
            url: 网页URL
            format_type: 文件格式（txt或html）
            
        返回:
            完整文件路径
        """
        # 提取URL路径部分
        parsed_url = urlparse(url)
        path = parsed_url.path.strip('/')
        
        # 处理路径为空的情况（网站首页）
        if not path:
            path = 'index'
        
        # 处理过长的路径
        if len(path) > 50:
            # 使用哈希值缩短文件名
            path_hash = hashlib.md5(path.encode()).hexdigest()[:10]
            path = f"{path[:30]}_{path_hash}"
            
        # 替换不合法的文件名字符
        path = path.replace('/', '_').replace('\\', '_').replace(':', '_').replace('*', '_')
        path = path.replace('?', '_').replace('"', '_').replace('<', '_').replace('>', '_')
        path = path.replace('|', '_')
        
        # 添加时间戳防止文件名冲突
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # 生成文件名
        filename = f"{path}_{timestamp}.{format_type}"
        
        # 获取域名目录
        domain_dir = self._get_domain_dir(url)
        
        return os.path.join(domain_dir, filename)
    
    def save_content(self, url, content, format_type='txt', metadata=None):
        """
        保存内容到文件
        
        参数:
            url: 网页URL
            content: 网页内容
            format_type: 文件格式（txt或html）
            metadata: 元数据字典
            
        返回:
            保存的文件路径
        """
        if not content:
            logger.warning(f"内容为空，不保存: {url}")
            return None
            
        try:
            # 获取文件路径
            file_path = self._get_url_filename(url, format_type)
            
            # 写入内容
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            logger.info(f"保存内容到: {file_path}")
            
            # 如果有元数据，保存元数据
            if metadata:
                meta_path = f"{os.path.splitext(file_path)[0]}.meta.json"
                with open(meta_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, ensure_ascii=False, indent=2)
                    
                logger.info(f"保存元数据到: {meta_path}")
                
            return file_path
            
        except Exception as e:
            logger.error(f"保存内容失败: {url}, 错误: {str(e)}")
            return None
    
    def save_batch_content(self, content_dict, format_type='txt'):
        """
        批量保存内容
        
        参数:
            content_dict: URL到内容的字典映射
            format_type: 文件格式（txt或html）
            
        返回:
            保存的文件路径列表
        """
        saved_paths = []
        
        for url, data in content_dict.items():
            content = data.get('content', '')
            metadata = {
                'title': data.get('title', ''),
                'url': url,
                'crawl_time': datetime.now().isoformat(),
                'depth': data.get('depth', 0),
                'links': data.get('links', [])
            }
            
            path = self.save_content(url, content, format_type, metadata)
            if path:
                saved_paths.append(path)
                
        return saved_paths


def calculate_statistics(all_results, processed_content, categorized_content, task_info):
    """
    计算统计数据
    
    参数:
        all_results: 所有爬取结果
        processed_content: 处理后的内容
        categorized_content: 分类结果
        task_info: 任务信息
        
    返回:
        统计数据字典
    """
    statistics = {
        "totalUrls": len(all_results),
        "categoriesCount": len(categorized_content),
        "successRate": round(len(processed_content) / max(1, len(all_results)) * 100, 2),
        "statusCounts": {},
        "domainCounts": {}
    }
    
    # 计算状态码统计
    for url, data in all_results.items():
        status = data.get("status", 0)
        status_str = str(status)  # 确保键是字符串，避免JSON序列化问题
        if status_str in statistics["statusCounts"]:
            statistics["statusCounts"][status_str] += 1
        else:
            statistics["statusCounts"][status_str] = 1
    
    # 计算域名统计
    for url in all_results.keys():
        domain = urlparse(url).netloc
        if domain in statistics["domainCounts"]:
            statistics["domainCounts"][domain] += 1
        else:
            statistics["domainCounts"][domain] = 1
    
    # 计算平均爬取时间
    if "start_time" in task_info and "end_time" in task_info:
        total_time = task_info["end_time"] - task_info["start_time"]
        statistics["avgCrawlTime"] = round(total_time / max(1, len(processed_content)), 2)
    else:
        statistics["avgCrawlTime"] = 0
    
    return statistics


def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='全息拉普拉斯互联网爬虫系统')
    parser.add_argument('-c', '--config', type=str, default='crawler_config.json', help='配置文件路径')
    parser.add_argument('-o', '--output', type=str, default='crawler_results.json', help='结果输出文件路径')
    parser.add_argument('-v', '--verbose', action='store_true', help='输出详细日志')
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 读取配置文件
    try:
        with open(args.config, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except FileNotFoundError:
        logger.error(f"配置文件不存在: {args.config}")
        print(f"错误: 配置文件不存在: {args.config}")
        print("请先从网页界面生成并下载配置文件")
        return
    except json.JSONDecodeError:
        logger.error(f"配置文件格式错误: {args.config}")
        print(f"错误: 配置文件格式错误: {args.config}")
        return
    
    # 提取配置
    urls = config.get('urls', [])
    depth = config.get('depth', 2)
    format_type = config.get('format', 'html')
    concurrency = config.get('concurrency', 3)
    
    if not urls:
        logger.error("配置文件中未找到有效URL")
        print("错误: 配置文件中未找到有效URL")
        return
    
    print(f"将爬取 {len(urls)} 个URL，深度为 {depth}，存储格式为 {format_type}")
    
    # 记录开始时间
    start_time = time.time()
    task_info = {
        "start_time": start_time,
        "urls": urls,
        "depth": depth,
        "format": format_type,
        "concurrency": concurrency
    }
    
    # 初始化爬虫、处理器和存储管理器
    crawler = WebCrawler(max_workers=concurrency)
    processor = DataProcessor()
    storage = StorageManager(base_dir='./crawled_data')
    
    try:
        # 批量爬取
        print("开始爬取...")
        all_results = crawler.batch_crawl(urls, depth)
        print(f"爬取完成，共获取 {len(all_results)} 个页面")
        
        # 处理结果
        processed_content = []
        
        print("处理爬取内容...")
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
                    # 正常的HTML内容 - 注意这里传入了URL作为base_url
                    clean_html = processor.clean_html(html_content, url)
                    
                    # 提取文本或格式化HTML
                    if format_type == "txt":
                        clean_content = processor.extract_text_from_html(clean_html)
                    else:
                        clean_content = clean_html
                        
                # 提取关键词（对于所有内容类型）
                keywords = []
                if content:
                    keywords = processor.extract_keywords(content)
                
                # 存储内容
                metadata = {
                    "title": title or "无标题",
                    "url": url,
                    "depth": data.get("depth", 0),
                    "crawl_time": datetime.now().isoformat(),
                    "keywords": keywords,
                    "content_type": "pdf" if isinstance(html_content, str) and html_content.startswith("PDF_CONTENT_") else "html"
                }
                
                file_path = storage.save_content(
                    url, 
                    clean_content, 
                    format_type, 
                    metadata
                )
                
                # 构造处理后的内容对象
                processed_item = {
                    "url": url,
                    "title": title or "无标题",
                    "content": clean_content,
                    "keywords": keywords,
                    "file_path": file_path,
                    "depth": data.get("depth", 0),
                    "format": format_type,
                    "status": status
                }
                
                processed_content.append(processed_item)
        
        # 内容分类
        print("对内容进行分类...")
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
        
        # 记录结束时间
        end_time = time.time()
        task_info["end_time"] = end_time
        task_info["duration"] = end_time - start_time
        
        # 计算统计数据
        statistics = calculate_statistics(all_results, processed_content, categorized_content, task_info)
        
        # 构造结果
        result = {
            "task_info": task_info,
            "content": processed_content,
            "categories": categorized_content,
            "statistics": statistics
        }
        
        # 保存结果
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        print(f"爬取完成！结果已保存到 {args.output}")
        print(f"总共爬取 {len(all_results)} 个页面，成功率 {statistics['successRate']}%")
        print(f"用时 {task_info['duration']:.2f} 秒")
        print("请将结果文件上传到网页界面查看详细分析")
        
    except KeyboardInterrupt:
        print("\n爬取被用户中断")
    except Exception as e:
        logger.error(f"爬取过程出错: {str(e)}")
        print(f"错误: {str(e)}")
    finally:
        # 关闭资源
        crawler.close()


if __name__ == "__main__":
    main()