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

# 强制控制台输出使用UTF-8
if sys.platform == 'win32':
    # 为Windows环境设置UTF-8编码
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("crawler.log", encoding='utf-8'),  # 指定文件使用UTF-8编码
        logging.StreamHandler(sys.stdout)  # 使用已配置为UTF-8的标准输出
    ]
)
logger = logging.getLogger("Crawler")

# 确保NLTK资源可用
def ensure_nltk_resources():
    """检查并确保所需的NLTK资源可用，只在必要时下载"""
    resources = [
        ('tokenizers/punkt_tab', 'punkt_tab'),  # 特殊资源
        ('tokenizers/punkt', 'punkt'),
        ('corpora/stopwords', 'stopwords'),
        ('corpora/wordnet', 'wordnet')
    ]
    
    missing_resources = []
    
    # 检查哪些资源缺失
    for path, package in resources:
        try:
            nltk.data.find(path)
            logger.info(f"NLTK资源已存在: {package}")
        except LookupError:
            missing_resources.append(package)
    
    # 只下载缺失的资源
    if missing_resources:
        logger.info(f"下载缺失的NLTK资源: {', '.join(missing_resources)}")
        for package in missing_resources:
            try:
                print(f"下载NLTK资源: {package}...")
                nltk.download(package, quiet=False)
                print(f"已成功下载: {package}")
            except Exception as e:
                logger.error(f"下载NLTK资源 {package} 失败: {str(e)}")
                print(f"错误: 无法下载 {package}, 详情: {str(e)}")
    else:
        logger.info("所有必需的NLTK资源已安装")

# 替换原代码中的导入和NLTK资源检查部分
try:
    import requests
    from bs4 import BeautifulSoup
    import nltk
    
    # 统一使用ensure_nltk_resources函数进行资源检查和下载
    # 不再单独调用nltk.download('punkt_tab')
    ensure_nltk_resources()
    
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from nltk.stem import WordNetLemmatizer
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
except ImportError:
    print("缺少必要的库。请运行以下命令安装依赖:")
    print("pip install requests beautifulsoup4 nltk scikit-learn")
    sys.exit(1)


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
        """获取随机用户代理，模拟现代浏览器"""
        modern_user_agents = [
            # Chrome
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            # Firefox
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            # Safari
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
            # Edge
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        ]
        return random.choice(modern_user_agents)

    def _get_random_delay(self, min_delay=1, max_delay=3):
        """获取随机延迟时间"""
        return random.uniform(min_delay, max_delay)
        
    def download_page(self, url, retry_count=0):
        """
        下载网页内容，改进维基百科处理
        """
        if retry_count >= self.max_retries:
            logger.error(f"达到最大重试次数 {self.max_retries}，放弃URL: {url}")
            return None, 0
            
        # 添加随机延迟防止被封
        time.sleep(self._get_random_delay())
        
        try:
            # 使用现代浏览器的请求头
            headers = {
                'User-Agent': self._get_random_user_agent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,ko;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'DNT': '1'
            }
            
            # 针对维基百科的特殊处理
            if 'wikipedia.org' in url:
                if 'zh.wikipedia.org' in url:
                    # 将语言设置为中文优先
                    headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
                elif 'ja.wikipedia.org' in url:
                    # 将语言设置为日文优先
                    headers['Accept-Language'] = 'ja;q=0.9,en;q=0.8,zh;q=0.7'
                elif 'ko.wikipedia.org' in url:
                    # 将语言设置为韩文优先
                    headers['Accept-Language'] = 'ko;q=0.9,en;q=0.8,zh;q=0.7'
                
                # 添加一些前端浏览请求常见参数
                headers['Referer'] = 'https://www.google.com/'
                
            # 如果URL不以http开头，添加协议
            if not url.startswith(('http://', 'https://')):
                url = 'http://' + url
                
            response = self.session.get(url, headers=headers, timeout=self.timeout)
            status_code = response.status_code
            
            if status_code == 200:
                # 检查内容类型
                content_type = response.headers.get('Content-Type', '')
                
                # 如果是网页内容
                if 'text/html' in content_type or 'application/xhtml+xml' in content_type:
                    # 使用改进的编码检测和处理
                    html_content = self._modern_browser_decode(response, url)
                    
                    # 针对维基百科，保存全量原始HTML
                    if 'wikipedia.org' in url:
                        logger.info(f"处理维基百科页面: {url}, 内容长度: {len(html_content)}")
                        
                        # 检查内容长度是否充分
                        if len(html_content) < 1000:
                            logger.warning(f"维基百科内容异常短: {len(html_content)} 字符")
                            
                            # 再次尝试，使用不同的解码方式
                            try:
                                html_content = response.text
                                logger.info(f"使用response.text重试，获取到内容长度: {len(html_content)}")
                            except Exception as e:
                                logger.error(f"使用response.text获取内容失败: {str(e)}")
                    
                    return html_content, status_code
                    
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

    def _modern_browser_decode(self, response, url):
        """
        模拟现代浏览器的编码检测和解码流程
        """
        from urllib.parse import urlparse
        
        # 步骤1: 尝试从HTTP头部获取编码信息
        content_type = response.headers.get('Content-Type', '').lower()
        http_encoding = None
        if 'charset=' in content_type:
            http_encoding = content_type.split('charset=')[-1].split(';')[0].strip()
            logger.info(f"HTTP头部声明的编码: {http_encoding}")
        
        # 步骤2: 提取HTML标签中的编码声明
        meta_encoding = self._extract_meta_encoding(response.content)
        if meta_encoding:
            logger.info(f"Meta标签中声明的编码: {meta_encoding}")
        
        # 步骤3: 使用chardet进行编码检测
        import chardet
        detected = chardet.detect(response.content)
        detected_encoding = detected.get('encoding')
        confidence = detected.get('confidence', 0)
        logger.info(f"Chardet检测编码: {detected_encoding} (置信度: {confidence:.2f})")
        
        # 特殊处理日韩文字的网站
        domain = urlparse(url).netloc.lower()
        is_japanese = any(jp_domain in domain for jp_domain in ['jp', 'nhk.or.jp', 'yahoo.co.jp'])
        is_korean = any(kr_domain in domain for kr_domain in ['kr', 'line.me', 'naver.com'])
        
        # 步骤4: 确定最终使用的编码（优先级：HTTP头部 > HTML meta > 特定域规则 > 检测结果）
        final_encoding = None
        
        # 特殊处理日韩网站
        if is_japanese and not (http_encoding or meta_encoding):
            # 日语网站常用编码
            encodings_to_try = ['shift-jis', 'euc-jp', 'iso-2022-jp', 'utf-8']
            for enc in encodings_to_try:
                try:
                    decoded = response.content.decode(enc, errors='strict')
                    final_encoding = enc
                    logger.info(f"日语网站使用的编码: {enc}")
                    break
                except UnicodeDecodeError:
                    continue
        
        elif is_korean and not (http_encoding or meta_encoding):
            # 韩语网站常用编码
            encodings_to_try = ['euc-kr', 'cp949', 'iso-2022-kr', 'utf-8']
            for enc in encodings_to_try:
                try:
                    decoded = response.content.decode(enc, errors='strict')
                    final_encoding = enc
                    logger.info(f"韩语网站使用的编码: {enc}")
                    break
                except UnicodeDecodeError:
                    continue
        
        # 如果特定规则未解决，按照现代浏览器优先级处理
        if not final_encoding:
            final_encoding = http_encoding or meta_encoding or detected_encoding or 'utf-8'
        
        # 步骤5: 使用确定的编码进行解码
        try:
            decoded_content = response.content.decode(final_encoding, errors='replace')
            logger.info(f"最终使用的编码: {final_encoding}")
        except (UnicodeDecodeError, LookupError):
            # 如果解码失败，回退到utf-8
            logger.warning(f"使用 {final_encoding} 解码失败，回退到utf-8")
            decoded_content = response.content.decode('utf-8', errors='replace')
        
        # 步骤6: 修复BOM问题
        if decoded_content.startswith('\ufeff'):
            decoded_content = decoded_content[1:]
            logger.info("移除了文本开头的BOM标记")
        
        # 步骤7: 检查解码质量
        replacement_char_count = decoded_content.count('\ufffd')
        if replacement_char_count > 0:
            replacement_ratio = replacement_char_count / len(decoded_content)
            logger.warning(f"解码结果包含 {replacement_char_count} 个替换字符 (比例: {replacement_ratio:.2%})")
            
            # 如果替换字符过多，可能是编码错误，尝试额外的处理
            if replacement_ratio > 0.1:  # 超过10%的字符是替换字符
                logger.warning("替换字符比例过高，尝试备用编码方案")
                # 列出常见编码，按优先级排序
                backup_encodings = ['utf-8', 'shift-jis', 'euc-jp', 'euc-kr', 'cp949', 'gb18030', 'big5']
                for enc in backup_encodings:
                    if enc != final_encoding:  # 避免重复尝试相同的编码
                        try:
                            test_decoded = response.content.decode(enc, errors='strict')
                            # 如果能成功解码且替换字符更少
                            if test_decoded.count('\ufffd') < replacement_char_count:
                                decoded_content = test_decoded
                                logger.info(f"切换到备用编码 {enc} 后替换字符减少")
                                break
                        except (UnicodeDecodeError, LookupError):
                            continue
        
        return decoded_content
    
    def _extract_meta_encoding(self, content):
        """
        从HTML内容中提取meta标签中声明的编码
        """
        import re
        
        # 常规charset声明
        charset_pattern = re.compile(b'<meta[^>]*charset=[\'"]*([^\'">/]+)[\'"/>]', re.IGNORECASE)
        
        # HTTP-EQUIV声明
        http_equiv_pattern = re.compile(b'<meta[^>]*http-equiv=[\'"]content-type[\'"][^>]*content=[\'"][^"\']*charset=([^\'"]+)[\'"]', re.IGNORECASE)
        
        # 反向顺序的HTTP-EQUIV
        reverse_http_equiv_pattern = re.compile(b'<meta[^>]*content=[\'"][^"\']*charset=([^\'"]+)[\'"][^>]*http-equiv=[\'"]content-type[\'"]', re.IGNORECASE)
        
        # HTML5风格
        html5_pattern = re.compile(b'<meta[^>]*charset=[\'"]([^\'"]+)[\'"]', re.IGNORECASE)
        
        # 检查所有模式
        for pattern in [charset_pattern, http_equiv_pattern, reverse_http_equiv_pattern, html5_pattern]:
            match = pattern.search(content)
            if match:
                detected = match.group(1).decode('ascii', errors='ignore')
                # 规范化编码名称
                return self._normalize_encoding_name(detected)
        
        return None
    
    def _normalize_encoding_name(self, encoding):
        """
        规范化编码名称，处理常见别名
        """
        if not encoding:
            return None
            
        # 将编码名称转为小写并移除特殊字符
        normalized = encoding.lower().strip().replace('-', '').replace('_', '')
        
        # 编码别名映射
        encoding_aliases = {
            'ascii': 'ascii',
            'usascii': 'ascii',
            'utf8': 'utf-8',
            'utf16': 'utf-16',
            'utf16le': 'utf-16-le',
            'utf16be': 'utf-16-be',
            'latin1': 'iso-8859-1',
            'latin2': 'iso-8859-2',
            'iso88591': 'iso-8859-1',
            'iso88592': 'iso-8859-2',
            'shiftjis': 'shift-jis',
            'sjis': 'shift-jis',
            'mskanji': 'shift-jis',
            'windows31j': 'shift-jis',
            'eucjp': 'euc-jp',
            'gb2312': 'gb18030',  # 使用超集
            'gb18030': 'gb18030',
            'gbk': 'gb18030',  # 使用超集
            'big5': 'big5',
            'big5hkscs': 'big5',
            'euckr': 'euc-kr',
            'cp949': 'cp949',
            'windows949': 'cp949',
            'ksc56011987': 'euc-kr',
            'ksc5601': 'euc-kr'
        }
        
        return encoding_aliases.get(normalized, encoding)

    def _extract_meta_encoding(self, content):
        """从HTML内容中提取meta标签中声明的编码"""
        import re
        charset_pattern = re.compile(b'<meta[^>]*charset=[\'"]*([^\'">/]+)[\'"/>]', re.IGNORECASE)
        content_type_pattern = re.compile(b'<meta[^>]*content=[\'"][^"\']*charset=([^\'"]+)[\'"]', re.IGNORECASE)
        
        match = charset_pattern.search(content)
        if match:
            return match.group(1).decode('ascii', errors='ignore')
        
        match = content_type_pattern.search(content)
        if match:
            return match.group(1).decode('ascii', errors='ignore')
        
        return None

    def parse_html(self, html_content, url):
        """
        解析HTML内容，包括提取内嵌媒体
        
        参数:
            html_content: HTML内容字符串
            url: 原始URL（用于解析相对链接）
            
        返回:
            (title, content, links) 元组，media信息存储在content中
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
            
            # 提取内嵌媒体内容
            media = extract_embedded_media(html_content, url)
            
            # 将媒体信息添加到内容中
            if media:
                media_content = "\n\n嵌入的媒体内容:\n"
                
                if "youtube" in media:
                    media_content += "\nYouTube视频:\n"
                    for youtube_url in media["youtube"]:
                        media_content += f"- {youtube_url}\n"
                
                if "twitter" in media:
                    media_content += "\nTwitter内容:\n"
                    for twitter_url in media["twitter"]:
                        media_content += f"- {twitter_url}\n"
                
                if "vimeo" in media:
                    media_content += "\nVimeo视频:\n"
                    for vimeo_url in media["vimeo"]:
                        media_content += f"- {vimeo_url}\n"
                
                if "instagram" in media:
                    media_content += "\nInstagram内容:\n"
                    for instagram_url in media["instagram"]:
                        media_content += f"- {instagram_url}\n"
                
                if "other_embedded" in media:
                    media_content += "\n其他嵌入内容:\n"
                    for other_url in media["other_embedded"]:
                        media_content += f"- {other_url}\n"
                
                # 将媒体内容附加到原内容后
                content += media_content
                    
            return title, content, links
            
        except Exception as e:
            logger.error(f"解析HTML出错: {url}, 错误: {str(e)}")
            return None, None, []

    def _parse_wikipedia(self, soup, url):
        """
        专门处理维基百科页面
        
        参数:
            soup: BeautifulSoup对象
            url: 原始URL
        
        返回:
            (title, content, links) 元组
        """
        # 提取标题
        title = soup.find(id="firstHeading").text.strip() if soup.find(id="firstHeading") else soup.title.text.strip() if soup.title else "无标题"
        
        # 提取正文 - 维基百科的主要内容在id为"mw-content-text"的div中
        content_div = soup.find(id="mw-content-text")
        
        if not content_div:
            logger.warning(f"无法找到维基百科主要内容区域: {url}")
            return title, "无法提取维基百科内容", []
        
        # 提取段落，保留标题结构
        content_parts = []
        
        # 添加导言
        intro_paragraphs = content_div.select(".mw-parser-output > p")
        for p in intro_paragraphs:
            if p.text.strip():
                # 检查是否是参考文献或其他不相关段落
                if not any(cls in p.get("class", []) for cls in ["mw-empty-elt"]):
                    content_parts.append(p.text.strip())
                    
        # 提取各章节（跳过目录、参考文献等）
        for section in content_div.select(".mw-parser-output > h2, .mw-parser-output > h3"):
            # 获取章节标题
            section_title = section.find("span", class_="mw-headline")
            if section_title:
                # 排除不需要的章节如"参考文献"、"外部链接"等
                if section_title.text.strip() not in ["参考文献", "参考", "引用", "外部链接", "参见", "脚注", "注释"]:
                    content_parts.append(f"\n## {section_title.text.strip()}")
                    
                    # 获取该章节的段落
                    next_elem = section.next_sibling
                    while next_elem and next_elem.name not in ["h2", "h3"]:
                        if next_elem.name == "p" and next_elem.text.strip():
                            content_parts.append(next_elem.text.strip())
                        next_elem = next_elem.next_sibling
        
        # 提取链接
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            # 处理维基百科内部链接
            if href.startswith('/wiki/') and ':' not in href:  # 排除如File:、Special:等特殊页面
                href = f"https://{urlparse(url).netloc}{href}"
                links.append(href)
            # 处理外部链接
            elif href.startswith(('http://', 'https://')):
                links.append(href)
        
        content = "\n\n".join(content_parts)
        
        return title, content, links

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


def extract_embedded_media(html_content, base_url=None):
    """
    从HTML内容中提取内嵌的媒体内容（YouTube视频、Twitter帖子等）
    
    参数:
        html_content: HTML内容
        base_url: 基础URL，用于解析相对链接
        
    返回:
        媒体内容字典，格式为 {类型: [链接列表]}
    """
    if not html_content:
        return {}
        
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        media = {
            "youtube": [],
            "twitter": [],
            "vimeo": [],
            "instagram": [],
            "other_embedded": []
        }
        
        # 提取YouTube视频 (iframe方式)
        for iframe in soup.find_all('iframe'):
            src = iframe.get('src', '')
            if not src:
                continue
                
            # 转换相对URL为绝对URL
            if base_url and not (src.startswith('http://') or src.startswith('https://')):
                src = urljoin(base_url, src)
                
            # 检测YouTube
            if 'youtube.com/embed/' in src or 'youtube-nocookie.com/embed/' in src:
                media["youtube"].append(src)
            # 检测Vimeo
            elif 'player.vimeo.com/video/' in src:
                media["vimeo"].append(src)
            # 其他iframe嵌入
            else:
                media["other_embedded"].append(src)
        
        # 提取Twitter帖子 (常见的嵌入方式)
        for div in soup.find_all('div', class_=lambda c: c and ('twitter-tweet' in c or 'twitter-timeline' in c)):
            # 寻找Twitter链接
            for a in div.find_all('a'):
                href = a.get('href', '')
                if 'twitter.com' in href and not href in media["twitter"]:
                    media["twitter"].append(href)
        
        # 提取Twitter链接 (另一种方式)
        for blockquote in soup.find_all('blockquote', class_=lambda c: c and 'twitter-tweet' in c):
            for a in blockquote.find_all('a'):
                href = a.get('href', '')
                if 'twitter.com' in href and not href in media["twitter"]:
                    media["twitter"].append(href)
        
        # 提取Instagram帖子
        for blockquote in soup.find_all('blockquote', class_=lambda c: c and 'instagram-media' in c):
            for a in blockquote.find_all('a'):
                href = a.get('href', '')
                if 'instagram.com/p/' in href and not href in media["instagram"]:
                    media["instagram"].append(href)
        
        # 移除空列表
        for k in list(media.keys()):
            if not media[k]:
                del media[k]
                
        return media
        
    except Exception as e:
        logger.error(f"提取媒体内容出错: {str(e)}")
        return {}


class WikipediaAPICrawler:
    """
    基于官方 MediaWiki API 的爬虫类
    直接使用 requests 调用 API，无需额外依赖
    """

    # 支持的语言列表
    SUPPORTED_LANGUAGES = {
        'zh': '中文',
        'en': 'English',
        'ja': '日本語',
        'ko': '한국어',
        'fr': 'Français',
        'de': 'Deutsch',
        'es': 'Español',
        'ru': 'Русский'
    }

    def __init__(self, language='zh', user_agent='HolographicLaplacianCrawler/1.0', base_url=None):
        """
        初始化 Wikipedia API 爬虫

        参数:
            language: 维基百科语言版本 (默认中文)
            user_agent: 用户代理标识
            base_url: 自定义 API 基础 URL (用于测试模式)
        """
        self.language = language
        self.user_agent = user_agent
        self.base_url = base_url  # 如果设置了 base_url，使用它替代默认 Wikipedia API
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': user_agent
        })
        mode = "测试模式" if base_url else "正常模式"
        logger.info(f"WikipediaAPICrawler 初始化完成，语言: {language}, 模式: {mode}")

    def _get_api_url(self):
        """获取当前语言的 API URL"""
        if self.base_url:
            return self.base_url
        return f"https://{self.language}.wikipedia.org/w/api.php"

    def set_language(self, language):
        """切换语言版本"""
        if language in self.SUPPORTED_LANGUAGES:
            self.language = language
            logger.info(f"已切换到 {self.SUPPORTED_LANGUAGES[language]} 维基百科")
            return True
        else:
            logger.warning(f"不支持的语言: {language}")
            return False

    def search(self, query, limit=10):
        """
        搜索维基百科页面

        参数:
            query: 搜索关键词
            limit: 返回结果数量限制

        返回:
            搜索结果列表
        """
        try:
            params = {
                'action': 'query',
                'list': 'search',
                'srsearch': query,
                'srlimit': limit,
                'format': 'json'
            }
            response = self.session.get(self._get_api_url(), params=params, timeout=10)
            data = response.json()

            results = []
            if 'query' in data and 'search' in data['query']:
                for item in data['query']['search']:
                    title = item['title']
                    results.append({
                        'title': title,
                        'snippet': item.get('snippet', '').replace('<span class="searchmatch">', '').replace('</span>', ''),
                        'page_id': item['pageid'],
                        'url': f"https://{self.language}.wikipedia.org/wiki/{title.replace(' ', '_')}"
                    })

            logger.info(f"搜索 '{query}' 找到 {len(results)} 个结果")
            return results

        except Exception as e:
            logger.error(f"搜索维基百科出错: {str(e)}")
            return []

    def get_page(self, title):
        """
        获取维基百科页面详细内容

        参数:
            title: 页面标题

        返回:
            页面信息字典，包含标题、摘要、全文、链接、分类等
        """
        try:
            # 获取页面内容和元信息
            # 注意：不要设置 exintro 参数，因为它是一个标志参数
            # 只要存在就会生效（无论值是什么），导致只返回引言部分
            params = {
                'action': 'query',
                'titles': title,
                'prop': 'extracts|info|categories|links',
                'explaintext': True,  # 返回纯文本而非 HTML
                'inprop': 'url',
                'cllimit': 50,
                'pllimit': 100,
                'format': 'json'
            }
            response = self.session.get(self._get_api_url(), params=params, timeout=15)
            data = response.json()

            pages = data.get('query', {}).get('pages', {})
            if not pages:
                return None

            page_data = list(pages.values())[0]

            # 检查页面是否存在
            if 'missing' in page_data:
                logger.warning(f"页面不存在: {title}")
                return None

            # 获取摘要（简介）
            summary_params = {
                'action': 'query',
                'titles': title,
                'prop': 'extracts',
                'exintro': True,
                'explaintext': True,
                'format': 'json'
            }
            summary_response = self.session.get(self._get_api_url(), params=summary_params, timeout=10)
            summary_data = summary_response.json()
            summary_pages = summary_data.get('query', {}).get('pages', {})
            summary = list(summary_pages.values())[0].get('extract', '') if summary_pages else ''

            # 构造结果
            result = {
                'title': page_data.get('title', title),
                'pageid': page_data.get('pageid'),
                'url': page_data.get('fullurl', f"https://{self.language}.wikipedia.org/wiki/{title.replace(' ', '_')}"),
                'summary': summary[:1000] if summary else '',
                'text': page_data.get('extract', ''),
                'categories': [cat['title'].replace('Category:', '') for cat in page_data.get('categories', [])],
                'links': [link['title'] for link in page_data.get('links', [])][:100],
                'sections': self._get_sections(title),
                'language': self.language,
                'timestamp': datetime.now().isoformat()
            }

            logger.info(f"获取页面成功: {title}, 内容长度: {len(result['text'])}")
            return result

        except Exception as e:
            logger.error(f"获取页面出错: {title}, 错误: {str(e)}")
            return None

    def _get_sections(self, title):
        """提取页面章节结构"""
        try:
            params = {
                'action': 'parse',
                'page': title,
                'prop': 'sections',
                'format': 'json'
            }
            response = self.session.get(self._get_api_url(), params=params, timeout=10)
            data = response.json()

            sections = []
            for section in data.get('parse', {}).get('sections', []):
                sections.append({
                    'title': section.get('line', ''),
                    'level': int(section.get('level', 0)) - 1,
                    'index': section.get('index', '')
                })

            return sections

        except Exception as e:
            logger.error(f"获取章节结构出错: {str(e)}")
            return []

    def get_category_members(self, category_name, depth=0, max_pages=50):
        """
        获取分类下的所有页面

        参数:
            category_name: 分类名称 (不含 "Category:" 前缀)
            depth: 递归深度 (0 表示只获取当前分类)
            max_pages: 最大页面数量

        返回:
            页面列表
        """
        try:
            # 使用 MediaWiki API 获取分类成员
            import requests
            api_url = f"https://{self.language}.wikipedia.org/w/api.php"

            pages = []
            subcategories = []

            params = {
                'action': 'query',
                'list': 'categorymembers',
                'cmtitle': f'Category:{category_name}',
                'cmlimit': min(max_pages, 500),
                'format': 'json'
            }

            response = requests.get(api_url, params=params, timeout=15)
            data = response.json()

            if 'query' in data and 'categorymembers' in data['query']:
                for member in data['query']['categorymembers']:
                    if member['ns'] == 0:  # 普通页面
                        pages.append({
                            'title': member['title'],
                            'pageid': member['pageid']
                        })
                    elif member['ns'] == 14 and depth > 0:  # 子分类
                        subcategories.append(member['title'].replace('Category:', ''))

            # 递归获取子分类
            if depth > 0 and subcategories:
                remaining = max_pages - len(pages)
                for subcat in subcategories[:5]:  # 限制子分类数量
                    if remaining <= 0:
                        break
                    sub_pages = self.get_category_members(subcat, depth - 1, remaining)
                    pages.extend(sub_pages)
                    remaining -= len(sub_pages)

            logger.info(f"分类 '{category_name}' 找到 {len(pages)} 个页面")
            return pages[:max_pages]

        except Exception as e:
            logger.error(f"获取分类成员出错: {category_name}, 错误: {str(e)}")
            return []

    def batch_get_pages(self, titles, callback=None):
        """
        批量获取多个页面

        参数:
            titles: 页面标题列表
            callback: 进度回调函数 (current, total, title)

        返回:
            页面内容列表
        """
        results = []
        total = len(titles)

        for i, title in enumerate(titles):
            if callback:
                callback(i + 1, total, title)

            page_data = self.get_page(title)
            if page_data:
                results.append(page_data)

            # 添加延迟，避免请求过快
            time.sleep(0.5)

        logger.info(f"批量获取完成，成功 {len(results)}/{total} 个页面")
        return results

    def get_random_pages(self, count=5):
        """
        获取随机页面

        参数:
            count: 页面数量

        返回:
            随机页面列表
        """
        try:
            params = {
                'action': 'query',
                'list': 'random',
                'rnnamespace': 0,
                'rnlimit': count,
                'format': 'json'
            }

            response = self.session.get(self._get_api_url(), params=params, timeout=10)
            data = response.json()

            pages = []
            if 'query' in data and 'random' in data['query']:
                for item in data['query']['random']:
                    title = item['title']
                    pages.append({
                        'title': title,
                        'page_id': item['id'],
                        'url': f"https://{self.language}.wikipedia.org/wiki/{title.replace(' ', '_')}",
                        'snippet': ''  # 随机页面没有摘要
                    })

            logger.info(f"获取 {len(pages)} 个随机页面")
            return pages

        except Exception as e:
            logger.error(f"获取随机页面出错: {str(e)}")
            return []


class ZhihuZhuanlanCrawler:
    """
    知乎专栏爬虫类
    通过知乎专栏 API 获取专栏和文章信息
    """

    def __init__(self, delay=1.0, base_url=None):
        """
        初始化知乎专栏爬虫

        参数:
            delay: 请求间隔时间（秒），避免被封
            base_url: 自定义 API 基础 URL (用于测试模式)
        """
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://zhuanlan.zhihu.com/',
            'Origin': 'https://zhuanlan.zhihu.com'
        })
        self.base_url = base_url if base_url else 'https://zhuanlan.zhihu.com/api'
        mode = "测试模式" if base_url else "正常模式"
        logger.info(f"ZhihuZhuanlanCrawler 初始化完成, 模式: {mode}")

    def _request(self, url, params=None):
        """发送请求并处理响应"""
        try:
            time.sleep(self.delay)  # 请求间隔
            response = self.session.get(url, params=params, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"请求失败: {url}, 错误: {str(e)}")
            return None

    def get_column_info(self, column_slug):
        """
        获取专栏基本信息

        参数:
            column_slug: 专栏标识 (如 URL https://zhuanlan.zhihu.com/passer 中的 "passer")

        返回:
            专栏信息字典
        """
        url = f'{self.base_url}/columns/{column_slug}'
        data = self._request(url)

        if not data:
            return None

        result = {
            'slug': column_slug,
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'intro': data.get('intro', ''),
            'articles_count': data.get('articlesCount', 0),
            'followers_count': data.get('followersCount', 0),
            'author': {
                'name': data.get('creator', {}).get('name', ''),
                'url_token': data.get('creator', {}).get('urlToken', ''),
                'avatar': data.get('creator', {}).get('avatar', {}).get('url', '')
            },
            'url': f'https://zhuanlan.zhihu.com/{column_slug}',
            'image_url': data.get('imageUrl', ''),
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"获取专栏信息成功: {result['title']}")
        return result

    def get_column_posts(self, column_slug, limit=20, offset=0):
        """
        获取专栏文章列表

        参数:
            column_slug: 专栏标识
            limit: 每页数量 (最大 20)
            offset: 偏移量

        返回:
            文章列表
        """
        url = f'{self.base_url}/columns/{column_slug}/articles'
        params = {
            'limit': min(limit, 20),
            'offset': offset
        }

        data = self._request(url, params)

        if not data:
            return []

        posts = []
        items = data.get('data', []) if isinstance(data, dict) else data

        for item in items:
            post = {
                'id': item.get('id', ''),
                'title': item.get('title', ''),
                'excerpt': item.get('excerpt', ''),
                'url': item.get('url', ''),
                'created': item.get('created', ''),
                'updated': item.get('updated', ''),
                'voteup_count': item.get('voteupCount', 0),
                'comment_count': item.get('commentCount', 0),
                'author': item.get('author', {}).get('name', '')
            }
            posts.append(post)

        logger.info(f"获取专栏 '{column_slug}' 文章列表，共 {len(posts)} 篇")
        return posts

    def get_all_column_posts(self, column_slug, max_posts=100):
        """
        获取专栏所有文章

        参数:
            column_slug: 专栏标识
            max_posts: 最大文章数量

        返回:
            所有文章列表
        """
        all_posts = []
        offset = 0
        limit = 20

        while len(all_posts) < max_posts:
            posts = self.get_column_posts(column_slug, limit=limit, offset=offset)
            if not posts:
                break

            all_posts.extend(posts)
            offset += limit

            if len(posts) < limit:
                break

        logger.info(f"获取专栏 '{column_slug}' 所有文章，共 {len(all_posts)} 篇")
        return all_posts[:max_posts]

    def get_post(self, post_id):
        """
        获取单篇文章详情

        参数:
            post_id: 文章 ID

        返回:
            文章详情字典
        """
        url = f'{self.base_url}/posts/{post_id}'
        data = self._request(url)

        if not data:
            return None

        # 清理 HTML 内容，提取纯文本
        content_html = data.get('content', '')
        content_text = self._html_to_text(content_html)

        result = {
            'id': data.get('id', ''),
            'title': data.get('title', ''),
            'content': content_text,
            'content_html': content_html,
            'excerpt': data.get('excerpt', ''),
            'url': data.get('url', ''),
            'created': data.get('created', ''),
            'updated': data.get('updated', ''),
            'voteup_count': data.get('voteupCount', 0),
            'comment_count': data.get('commentCount', 0),
            'author': {
                'name': data.get('author', {}).get('name', ''),
                'url_token': data.get('author', {}).get('urlToken', ''),
                'bio': data.get('author', {}).get('bio', '')
            },
            'column': {
                'slug': data.get('column', {}).get('slug', ''),
                'title': data.get('column', {}).get('title', '')
            },
            'topics': [t.get('name', '') for t in data.get('topics', [])],
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"获取文章成功: {result['title']}")
        return result

    def _html_to_text(self, html_content):
        """将 HTML 转换为纯文本"""
        if not html_content:
            return ''

        try:
            soup = BeautifulSoup(html_content, 'html.parser')

            # 移除脚本和样式
            for tag in soup(['script', 'style', 'noscript']):
                tag.decompose()

            # 获取文本
            text = soup.get_text(separator='\n', strip=True)

            # 清理多余空行
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)

        except Exception as e:
            logger.error(f"HTML 转文本出错: {str(e)}")
            return html_content

    def search_columns(self, keyword, limit=10):
        """
        搜索知乎专栏（通过知乎搜索 API）

        参数:
            keyword: 搜索关键词
            limit: 结果数量限制

        返回:
            专栏搜索结果列表
        """
        try:
            url = 'https://www.zhihu.com/api/v4/search_v3'
            params = {
                't': 'column',
                'q': keyword,
                'correction': 1,
                'offset': 0,
                'limit': limit
            }

            data = self._request(url, params)

            if not data or 'data' not in data:
                return []

            results = []
            for item in data.get('data', []):
                obj = item.get('object', {})
                if obj:
                    results.append({
                        'slug': obj.get('id', ''),
                        'title': obj.get('title', ''),
                        'description': obj.get('description', ''),
                        'articles_count': obj.get('articles_count', 0),
                        'followers_count': obj.get('followers', 0)
                    })

            logger.info(f"搜索专栏 '{keyword}'，找到 {len(results)} 个结果")
            return results

        except Exception as e:
            logger.error(f"搜索专栏出错: {str(e)}")
            return []

    def batch_get_posts(self, post_ids, callback=None):
        """
        批量获取文章详情

        参数:
            post_ids: 文章 ID 列表
            callback: 进度回调函数

        返回:
            文章详情列表
        """
        results = []
        total = len(post_ids)

        for i, post_id in enumerate(post_ids):
            if callback:
                callback(i + 1, total, post_id)

            post_data = self.get_post(post_id)
            if post_data:
                results.append(post_data)

        logger.info(f"批量获取完成，成功 {len(results)}/{total} 篇文章")
        return results


class MoegirlCrawler:
    """
    萌娘百科爬虫类
    基于 MediaWiki API，与 Wikipedia 类似
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or 'https://zh.moegirl.org.cn/api.php'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'HolographicLaplacianCrawler/1.0'
        })
        logger.info(f"MoegirlCrawler 初始化完成")

    def search(self, query, limit=10):
        """搜索萌娘百科"""
        try:
            params = {
                'action': 'query',
                'list': 'search',
                'srsearch': query,
                'srlimit': limit,
                'format': 'json'
            }
            response = self.session.get(self.base_url, params=params, timeout=15)
            data = response.json()

            results = []
            if 'query' in data and 'search' in data['query']:
                for item in data['query']['search']:
                    results.append({
                        'title': item['title'],
                        'snippet': item.get('snippet', '').replace('<span class="searchmatch">', '').replace('</span>', ''),
                        'pageid': item['pageid']
                    })
            return results
        except Exception as e:
            logger.error(f"搜索萌娘百科出错: {str(e)}")
            return []

    def get_page(self, title):
        """获取页面内容"""
        try:
            params = {
                'action': 'query',
                'titles': title,
                'prop': 'extracts|info|categories',
                'explaintext': True,
                'inprop': 'url',
                'format': 'json'
            }
            response = self.session.get(self.base_url, params=params, timeout=15)
            data = response.json()

            pages = data.get('query', {}).get('pages', {})
            if not pages:
                return None

            page_data = list(pages.values())[0]
            if 'missing' in page_data:
                return None

            return {
                'title': page_data.get('title', title),
                'pageid': page_data.get('pageid'),
                'url': page_data.get('fullurl', f"https://zh.moegirl.org.cn/{title}"),
                'text': page_data.get('extract', ''),
                'categories': [c['title'] for c in page_data.get('categories', [])],
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取萌娘百科页面出错: {str(e)}")
            return None


class BilibiliCrawler:
    """
    哔哩哔哩爬虫类
    获取视频信息、UP主信息等
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or 'https://api.bilibili.com'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com'
        })
        logger.info("BilibiliCrawler 初始化完成")

    def get_video_info(self, bvid):
        """获取视频信息"""
        try:
            url = f"{self.base_url}/x/web-interface/view"
            params = {'bvid': bvid}
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if data.get('code') != 0:
                return None

            video = data.get('data', {})
            return {
                'bvid': video.get('bvid'),
                'aid': video.get('aid'),
                'title': video.get('title'),
                'desc': video.get('desc'),
                'duration': video.get('duration'),
                'owner': {
                    'mid': video.get('owner', {}).get('mid'),
                    'name': video.get('owner', {}).get('name'),
                    'face': video.get('owner', {}).get('face')
                },
                'stat': {
                    'view': video.get('stat', {}).get('view'),
                    'danmaku': video.get('stat', {}).get('danmaku'),
                    'reply': video.get('stat', {}).get('reply'),
                    'favorite': video.get('stat', {}).get('favorite'),
                    'coin': video.get('stat', {}).get('coin'),
                    'share': video.get('stat', {}).get('share'),
                    'like': video.get('stat', {}).get('like')
                },
                'pubdate': video.get('pubdate'),
                'tname': video.get('tname'),
                'pic': video.get('pic'),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取B站视频信息出错: {str(e)}")
            return None

    def search_video(self, keyword, page=1, page_size=20):
        """搜索视频"""
        try:
            url = f"{self.base_url}/x/web-interface/search/type"
            params = {
                'search_type': 'video',
                'keyword': keyword,
                'page': page,
                'page_size': page_size
            }
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if data.get('code') != 0:
                return []

            results = []
            for item in data.get('data', {}).get('result', []):
                results.append({
                    'bvid': item.get('bvid'),
                    'title': item.get('title', '').replace('<em class="keyword">', '').replace('</em>', ''),
                    'author': item.get('author'),
                    'play': item.get('play'),
                    'description': item.get('description')
                })
            return results
        except Exception as e:
            logger.error(f"搜索B站视频出错: {str(e)}")
            return []

    def get_user_info(self, mid):
        """获取UP主信息"""
        try:
            url = f"{self.base_url}/x/space/acc/info"
            params = {'mid': mid}
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if data.get('code') != 0:
                return None

            user = data.get('data', {})
            return {
                'mid': user.get('mid'),
                'name': user.get('name'),
                'face': user.get('face'),
                'sign': user.get('sign'),
                'level': user.get('level'),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取B站用户信息出错: {str(e)}")
            return None


class GitHubCrawler:
    """
    GitHub 爬虫类
    获取仓库、文件、用户等信息
    """

    def __init__(self, base_url=None, token=None):
        self.base_url = base_url or 'https://api.github.com'
        self.session = requests.Session()
        headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'HolographicLaplacianCrawler/1.0'
        }
        if token:
            headers['Authorization'] = f'token {token}'
        self.session.headers.update(headers)
        logger.info("GitHubCrawler 初始化完成")

    def get_repo(self, owner, repo):
        """获取仓库信息"""
        try:
            url = f"{self.base_url}/repos/{owner}/{repo}"
            response = self.session.get(url, timeout=15)
            if response.status_code != 200:
                return None

            data = response.json()
            return {
                'name': data.get('name'),
                'full_name': data.get('full_name'),
                'description': data.get('description'),
                'html_url': data.get('html_url'),
                'language': data.get('language'),
                'stargazers_count': data.get('stargazers_count'),
                'forks_count': data.get('forks_count'),
                'open_issues_count': data.get('open_issues_count'),
                'topics': data.get('topics', []),
                'created_at': data.get('created_at'),
                'updated_at': data.get('updated_at'),
                'owner': {
                    'login': data.get('owner', {}).get('login'),
                    'avatar_url': data.get('owner', {}).get('avatar_url')
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取GitHub仓库信息出错: {str(e)}")
            return None

    def get_readme(self, owner, repo):
        """获取仓库 README"""
        try:
            url = f"{self.base_url}/repos/{owner}/{repo}/readme"
            response = self.session.get(url, timeout=15)
            if response.status_code != 200:
                return None

            data = response.json()
            import base64
            content = base64.b64decode(data.get('content', '')).decode('utf-8')
            return {
                'name': data.get('name'),
                'path': data.get('path'),
                'content': content,
                'html_url': data.get('html_url'),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取GitHub README出错: {str(e)}")
            return None

    def search_repos(self, query, sort='stars', page=1, per_page=10):
        """搜索仓库"""
        try:
            url = f"{self.base_url}/search/repositories"
            params = {'q': query, 'sort': sort, 'page': page, 'per_page': per_page}
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            results = []
            for item in data.get('items', []):
                results.append({
                    'full_name': item.get('full_name'),
                    'description': item.get('description'),
                    'html_url': item.get('html_url'),
                    'language': item.get('language'),
                    'stargazers_count': item.get('stargazers_count'),
                    'forks_count': item.get('forks_count')
                })
            return results
        except Exception as e:
            logger.error(f"搜索GitHub仓库出错: {str(e)}")
            return []


class WeiboCrawler:
    """
    微博爬虫类
    获取用户微博、热搜等
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or 'https://m.weibo.cn/api'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        })
        logger.info("WeiboCrawler 初始化完成")

    def get_user_info(self, uid):
        """获取用户信息"""
        try:
            url = f"{self.base_url}/container/getIndex"
            params = {'type': 'uid', 'value': uid}
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if data.get('ok') != 1:
                return None

            user = data.get('data', {}).get('userInfo', {})
            return {
                'id': user.get('id'),
                'screen_name': user.get('screen_name'),
                'description': user.get('description'),
                'followers_count': user.get('followers_count'),
                'follow_count': user.get('follow_count'),
                'statuses_count': user.get('statuses_count'),
                'profile_image_url': user.get('profile_image_url'),
                'verified': user.get('verified'),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取微博用户信息出错: {str(e)}")
            return None

    def get_user_weibos(self, uid, page=1):
        """获取用户微博列表"""
        try:
            url = f"{self.base_url}/container/getIndex"
            params = {
                'type': 'uid',
                'value': uid,
                'containerid': f'107603{uid}',
                'page': page
            }
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if data.get('ok') != 1:
                return []

            weibos = []
            for card in data.get('data', {}).get('cards', []):
                if card.get('card_type') == 9:
                    mblog = card.get('mblog', {})
                    weibos.append({
                        'id': mblog.get('id'),
                        'text': mblog.get('text', '').replace('<br />', '\n'),
                        'created_at': mblog.get('created_at'),
                        'reposts_count': mblog.get('reposts_count'),
                        'comments_count': mblog.get('comments_count'),
                        'attitudes_count': mblog.get('attitudes_count'),
                        'source': mblog.get('source')
                    })
            return weibos
        except Exception as e:
            logger.error(f"获取微博列表出错: {str(e)}")
            return []

    def get_hot_search(self):
        """获取微博热搜"""
        try:
            url = "https://weibo.com/ajax/side/hotSearch"
            response = self.session.get(url, timeout=15)
            data = response.json()

            if data.get('ok') != 1:
                return []

            results = []
            for item in data.get('data', {}).get('realtime', []):
                results.append({
                    'word': item.get('word'),
                    'num': item.get('num'),
                    'rank': item.get('rank'),
                    'category': item.get('category')
                })
            return results
        except Exception as e:
            logger.error(f"获取微博热搜出错: {str(e)}")
            return []


class YouTubeCrawler:
    """
    YouTube 爬虫类
    使用 YouTube Data API 获取视频信息
    """

    def __init__(self, api_key=None, base_url=None):
        self.api_key = api_key
        self.base_url = base_url or 'https://www.googleapis.com/youtube/v3'
        self.session = requests.Session()
        logger.info("YouTubeCrawler 初始化完成")

    def search_videos(self, query, max_results=10):
        """搜索视频"""
        try:
            url = f"{self.base_url}/search"
            params = {
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': max_results,
                'key': self.api_key
            }
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            results = []
            for item in data.get('items', []):
                snippet = item.get('snippet', {})
                results.append({
                    'video_id': item.get('id', {}).get('videoId'),
                    'title': snippet.get('title'),
                    'description': snippet.get('description'),
                    'channel_title': snippet.get('channelTitle'),
                    'published_at': snippet.get('publishedAt'),
                    'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url')
                })
            return results
        except Exception as e:
            logger.error(f"搜索YouTube视频出错: {str(e)}")
            return []

    def get_video_info(self, video_id):
        """获取视频详情"""
        try:
            url = f"{self.base_url}/videos"
            params = {
                'part': 'snippet,statistics,contentDetails',
                'id': video_id,
                'key': self.api_key
            }
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if not data.get('items'):
                return None

            item = data['items'][0]
            snippet = item.get('snippet', {})
            stats = item.get('statistics', {})
            content = item.get('contentDetails', {})

            return {
                'video_id': video_id,
                'title': snippet.get('title'),
                'description': snippet.get('description'),
                'channel_title': snippet.get('channelTitle'),
                'channel_id': snippet.get('channelId'),
                'published_at': snippet.get('publishedAt'),
                'tags': snippet.get('tags', []),
                'view_count': int(stats.get('viewCount', 0)),
                'like_count': int(stats.get('likeCount', 0)),
                'comment_count': int(stats.get('commentCount', 0)),
                'duration': content.get('duration'),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取YouTube视频信息出错: {str(e)}")
            return None

    def get_channel_info(self, channel_id):
        """获取频道信息"""
        try:
            url = f"{self.base_url}/channels"
            params = {
                'part': 'snippet,statistics',
                'id': channel_id,
                'key': self.api_key
            }
            response = self.session.get(url, params=params, timeout=15)
            data = response.json()

            if not data.get('items'):
                return None

            item = data['items'][0]
            snippet = item.get('snippet', {})
            stats = item.get('statistics', {})

            return {
                'channel_id': channel_id,
                'title': snippet.get('title'),
                'description': snippet.get('description'),
                'custom_url': snippet.get('customUrl'),
                'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url'),
                'subscriber_count': int(stats.get('subscriberCount', 0)),
                'video_count': int(stats.get('videoCount', 0)),
                'view_count': int(stats.get('viewCount', 0)),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取YouTube频道信息出错: {str(e)}")
            return None


class TiebaCrawler:
    """
    百度贴吧爬虫类
    获取贴吧帖子和评论
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or 'https://tieba.baidu.com'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*'
        })
        logger.info("TiebaCrawler 初始化完成")

    def get_forum_info(self, forum_name):
        """获取贴吧信息"""
        try:
            url = f"{self.base_url}/f"
            params = {'kw': forum_name, 'ie': 'utf-8'}
            response = self.session.get(url, params=params, timeout=15)

            soup = BeautifulSoup(response.text, 'html.parser')

            # 提取贴吧信息
            title = soup.find('a', class_='card_title_fname')
            member_num = soup.find('span', class_='card_menNum')
            post_num = soup.find('span', class_='card_infoNum')

            return {
                'name': forum_name,
                'title': title.get_text(strip=True) if title else forum_name,
                'member_count': member_num.get_text(strip=True) if member_num else '0',
                'post_count': post_num.get_text(strip=True) if post_num else '0',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取贴吧信息出错: {str(e)}")
            return None

    def get_forum_posts(self, forum_name, page=1):
        """获取贴吧帖子列表"""
        try:
            url = f"{self.base_url}/f"
            params = {'kw': forum_name, 'ie': 'utf-8', 'pn': (page - 1) * 50}
            response = self.session.get(url, params=params, timeout=15)

            soup = BeautifulSoup(response.text, 'html.parser')
            posts = []

            for item in soup.find_all('li', class_='j_thread_list'):
                title_elem = item.find('a', class_='j_th_tit')
                author_elem = item.find('span', class_='tb_icon_author')
                reply_elem = item.find('span', class_='threadlist_rep_num')

                if title_elem:
                    posts.append({
                        'title': title_elem.get_text(strip=True),
                        'url': self.base_url + title_elem.get('href', ''),
                        'author': author_elem.get_text(strip=True) if author_elem else '',
                        'reply_count': reply_elem.get_text(strip=True) if reply_elem else '0'
                    })

            return posts
        except Exception as e:
            logger.error(f"获取贴吧帖子列表出错: {str(e)}")
            return []

    def get_post_detail(self, post_id):
        """获取帖子详情"""
        try:
            url = f"{self.base_url}/p/{post_id}"
            response = self.session.get(url, timeout=15)

            soup = BeautifulSoup(response.text, 'html.parser')

            title = soup.find('h1', class_='core_title_txt')
            content_elem = soup.find('div', class_='d_post_content')
            author_elem = soup.find('a', class_='p_author_name')

            return {
                'post_id': post_id,
                'title': title.get_text(strip=True) if title else '',
                'content': content_elem.get_text(strip=True) if content_elem else '',
                'author': author_elem.get_text(strip=True) if author_elem else '',
                'url': url,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取帖子详情出错: {str(e)}")
            return None


class ArxivCrawler:
    """
    arXiv 论文爬虫类
    使用 arXiv API 获取学术论文
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or 'http://export.arxiv.org/api/query'
        self.session = requests.Session()
        logger.info("ArxivCrawler 初始化完成")

    def search_papers(self, query, max_results=10, start=0):
        """搜索论文"""
        try:
            params = {
                'search_query': f'all:{query}',
                'start': start,
                'max_results': max_results,
                'sortBy': 'relevance',
                'sortOrder': 'descending'
            }
            response = self.session.get(self.base_url, params=params, timeout=30)

            soup = BeautifulSoup(response.text, 'xml')
            papers = []

            for entry in soup.find_all('entry'):
                authors = [author.find('name').text for author in entry.find_all('author')]
                categories = [cat.get('term') for cat in entry.find_all('category')]

                papers.append({
                    'arxiv_id': entry.find('id').text.split('/')[-1] if entry.find('id') else '',
                    'title': entry.find('title').text.strip() if entry.find('title') else '',
                    'summary': entry.find('summary').text.strip() if entry.find('summary') else '',
                    'authors': authors,
                    'categories': categories,
                    'published': entry.find('published').text if entry.find('published') else '',
                    'updated': entry.find('updated').text if entry.find('updated') else '',
                    'pdf_url': entry.find('link', {'title': 'pdf'}).get('href') if entry.find('link', {'title': 'pdf'}) else ''
                })

            return papers
        except Exception as e:
            logger.error(f"搜索arXiv论文出错: {str(e)}")
            return []

    def get_paper_by_id(self, arxiv_id):
        """通过ID获取论文详情"""
        try:
            params = {'id_list': arxiv_id}
            response = self.session.get(self.base_url, params=params, timeout=30)

            soup = BeautifulSoup(response.text, 'xml')
            entry = soup.find('entry')

            if not entry:
                return None

            authors = [author.find('name').text for author in entry.find_all('author')]
            categories = [cat.get('term') for cat in entry.find_all('category')]

            return {
                'arxiv_id': arxiv_id,
                'title': entry.find('title').text.strip() if entry.find('title') else '',
                'summary': entry.find('summary').text.strip() if entry.find('summary') else '',
                'authors': authors,
                'categories': categories,
                'published': entry.find('published').text if entry.find('published') else '',
                'updated': entry.find('updated').text if entry.find('updated') else '',
                'pdf_url': entry.find('link', {'title': 'pdf'}).get('href') if entry.find('link', {'title': 'pdf'}) else '',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取arXiv论文详情出错: {str(e)}")
            return None

    def get_recent_papers(self, category='cs.AI', max_results=10):
        """获取特定领域的最新论文"""
        try:
            params = {
                'search_query': f'cat:{category}',
                'start': 0,
                'max_results': max_results,
                'sortBy': 'submittedDate',
                'sortOrder': 'descending'
            }
            response = self.session.get(self.base_url, params=params, timeout=30)

            soup = BeautifulSoup(response.text, 'xml')
            papers = []

            for entry in soup.find_all('entry'):
                authors = [author.find('name').text for author in entry.find_all('author')]

                papers.append({
                    'arxiv_id': entry.find('id').text.split('/')[-1] if entry.find('id') else '',
                    'title': entry.find('title').text.strip() if entry.find('title') else '',
                    'summary': entry.find('summary').text.strip()[:500] + '...' if entry.find('summary') else '',
                    'authors': authors[:5],  # 只取前5个作者
                    'published': entry.find('published').text if entry.find('published') else ''
                })

            return papers
        except Exception as e:
            logger.error(f"获取最新arXiv论文出错: {str(e)}")
            return []


class DocsCrawler:
    """
    软件文档爬虫类
    支持爬取各类技术文档
    """

    def __init__(self, base_url=None):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        logger.info("DocsCrawler 初始化完成")

    def crawl_docs_page(self, url):
        """爬取文档页面"""
        try:
            response = self.session.get(url, timeout=30)
            soup = BeautifulSoup(response.text, 'html.parser')

            # 尝试提取主要内容
            main_content = (
                soup.find('main') or
                soup.find('article') or
                soup.find('div', class_=re.compile(r'content|docs|documentation', re.I)) or
                soup.find('div', id=re.compile(r'content|docs|documentation', re.I))
            )

            title = soup.find('h1')

            # 提取导航链接（用于爬取更多页面）
            nav_links = []
            nav = soup.find('nav') or soup.find('aside') or soup.find('div', class_=re.compile(r'sidebar|nav|menu', re.I))
            if nav:
                for link in nav.find_all('a', href=True):
                    href = link.get('href')
                    if href and not href.startswith(('#', 'javascript:', 'mailto:')):
                        nav_links.append({
                            'text': link.get_text(strip=True),
                            'url': urljoin(url, href)
                        })

            return {
                'url': url,
                'title': title.get_text(strip=True) if title else '',
                'content': main_content.get_text(strip=True) if main_content else '',
                'html': str(main_content) if main_content else '',
                'nav_links': nav_links[:50],  # 限制链接数量
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"爬取文档页面出错: {str(e)}")
            return None

    def search_docs(self, site_url, query):
        """搜索文档（通过站内搜索或Google）"""
        try:
            # 尝试常见的站内搜索路径
            search_paths = ['/search', '/docs/search', '/_search', '/api/search']

            for path in search_paths:
                search_url = urljoin(site_url, path)
                try:
                    response = self.session.get(search_url, params={'q': query}, timeout=15)
                    if response.status_code == 200:
                        # 简单解析搜索结果
                        soup = BeautifulSoup(response.text, 'html.parser')
                        results = []
                        for link in soup.find_all('a', href=True)[:20]:
                            text = link.get_text(strip=True)
                            if text and query.lower() in text.lower():
                                results.append({
                                    'title': text,
                                    'url': urljoin(site_url, link.get('href'))
                                })
                        if results:
                            return results
                except:
                    continue

            return []
        except Exception as e:
            logger.error(f"搜索文档出错: {str(e)}")
            return []


# ===================================
# 爬虫中台 CrawlerHub
# 统一管理所有平台爬虫
# ===================================

class CrawlerHub:
    """
    爬虫中台类
    统一管理所有平台爬虫的注册、获取和配置
    """

    # 支持的平台列表
    SUPPORTED_PLATFORMS = {
        'wikipedia': {
            'name': 'Wikipedia',
            'name_cn': '维基百科',
            'crawler_class': 'WikipediaAPICrawler',
            'description': '维基百科API爬虫，支持多语言'
        },
        'zhihu': {
            'name': 'Zhihu Zhuanlan',
            'name_cn': '知乎专栏',
            'crawler_class': 'ZhihuZhuanlanCrawler',
            'description': '知乎专栏爬虫'
        },
        'moegirl': {
            'name': 'Moegirl',
            'name_cn': '萌娘百科',
            'crawler_class': 'MoegirlCrawler',
            'description': '萌娘百科MediaWiki爬虫'
        },
        'bilibili': {
            'name': 'Bilibili',
            'name_cn': '哔哩哔哩',
            'crawler_class': 'BilibiliCrawler',
            'description': 'B站视频/用户爬虫'
        },
        'github': {
            'name': 'GitHub',
            'name_cn': 'GitHub',
            'crawler_class': 'GitHubCrawler',
            'description': 'GitHub仓库/代码爬虫'
        },
        'weibo': {
            'name': 'Weibo',
            'name_cn': '微博',
            'crawler_class': 'WeiboCrawler',
            'description': '微博用户/热搜爬虫'
        },
        'youtube': {
            'name': 'YouTube',
            'name_cn': 'YouTube',
            'crawler_class': 'YouTubeCrawler',
            'description': 'YouTube视频/频道爬虫'
        },
        'tieba': {
            'name': 'Tieba',
            'name_cn': '百度贴吧',
            'crawler_class': 'TiebaCrawler',
            'description': '百度贴吧爬虫'
        },
        'arxiv': {
            'name': 'arXiv',
            'name_cn': 'arXiv论文',
            'crawler_class': 'ArxivCrawler',
            'description': 'arXiv学术论文爬虫'
        },
        'docs': {
            'name': 'Documentation',
            'name_cn': '软件文档',
            'crawler_class': 'DocsCrawler',
            'description': '通用文档爬虫'
        }
    }

    def __init__(self, test_mode=False, mock_base_url=None):
        """
        初始化爬虫中台

        参数:
            test_mode: 是否启用测试模式（使用模拟数据）
            mock_base_url: 测试模式下的模拟API基础URL
        """
        self.test_mode = test_mode
        self.mock_base_url = mock_base_url or 'http://localhost:5000'
        self._crawlers = {}
        self._configs = {}

        logger.info(f"CrawlerHub 初始化完成，测试模式: {test_mode}")

    def get_supported_platforms(self):
        """获取所有支持的平台列表"""
        return list(self.SUPPORTED_PLATFORMS.keys())

    def get_platform_info(self, platform):
        """获取平台信息"""
        return self.SUPPORTED_PLATFORMS.get(platform)

    def _get_base_url(self, platform):
        """获取平台的API基础URL（测试模式下返回模拟URL）"""
        if self.test_mode:
            return f"{self.mock_base_url}/mock/{platform}"
        return None  # 使用默认URL

    def get_crawler(self, platform, **kwargs):
        """
        获取指定平台的爬虫实例

        参数:
            platform: 平台名称
            **kwargs: 传递给爬虫构造函数的额外参数

        返回:
            爬虫实例
        """
        if platform not in self.SUPPORTED_PLATFORMS:
            raise ValueError(f"不支持的平台: {platform}，支持的平台: {list(self.SUPPORTED_PLATFORMS.keys())}")

        # 如果已有缓存的实例且配置相同，直接返回
        cache_key = f"{platform}_{hash(frozenset(kwargs.items()))}"
        if cache_key in self._crawlers:
            return self._crawlers[cache_key]

        # 创建新实例
        platform_info = self.SUPPORTED_PLATFORMS[platform]
        crawler_class = globals().get(platform_info['crawler_class'])

        if not crawler_class:
            raise RuntimeError(f"找不到爬虫类: {platform_info['crawler_class']}")

        # 设置base_url（测试模式）
        base_url = self._get_base_url(platform)
        if base_url:
            kwargs['base_url'] = base_url

        # 创建实例
        crawler = crawler_class(**kwargs)
        self._crawlers[cache_key] = crawler

        return crawler

    def set_platform_config(self, platform, config):
        """
        设置平台配置

        参数:
            platform: 平台名称
            config: 配置字典
        """
        if platform not in self.SUPPORTED_PLATFORMS:
            raise ValueError(f"不支持的平台: {platform}")
        self._configs[platform] = config

    def get_platform_config(self, platform):
        """获取平台配置"""
        return self._configs.get(platform, {})

    def set_test_mode(self, enabled, mock_base_url=None):
        """
        设置测试模式

        参数:
            enabled: 是否启用测试模式
            mock_base_url: 模拟API基础URL
        """
        self.test_mode = enabled
        if mock_base_url:
            self.mock_base_url = mock_base_url
        # 清空缓存的爬虫实例，以便重新创建
        self._crawlers.clear()
        logger.info(f"测试模式已{'启用' if enabled else '禁用'}")

    def crawl(self, platform, method, *args, **kwargs):
        """
        统一爬取接口

        参数:
            platform: 平台名称
            method: 要调用的方法名
            *args, **kwargs: 方法参数

        返回:
            爬取结果
        """
        crawler = self.get_crawler(platform)

        if not hasattr(crawler, method):
            raise AttributeError(f"爬虫 {platform} 没有方法: {method}")

        func = getattr(crawler, method)
        return func(*args, **kwargs)

    def batch_crawl(self, tasks):
        """
        批量爬取

        参数:
            tasks: 任务列表，每个任务是一个字典:
                {
                    'platform': 'wikipedia',
                    'method': 'get_page',
                    'args': ['Python'],
                    'kwargs': {'language': 'zh'}
                }

        返回:
            结果列表
        """
        results = []
        for task in tasks:
            try:
                result = self.crawl(
                    task['platform'],
                    task['method'],
                    *task.get('args', []),
                    **task.get('kwargs', {})
                )
                results.append({
                    'task': task,
                    'success': True,
                    'data': result
                })
            except Exception as e:
                logger.error(f"批量爬取任务失败: {task}, 错误: {str(e)}")
                results.append({
                    'task': task,
                    'success': False,
                    'error': str(e)
                })
        return results

    def get_status(self):
        """获取爬虫中台状态"""
        return {
            'test_mode': self.test_mode,
            'mock_base_url': self.mock_base_url,
            'supported_platforms': self.get_supported_platforms(),
            'active_crawlers': list(self._crawlers.keys()),
            'configs': self._configs,
            'timestamp': datetime.now().isoformat()
        }

    def close(self):
        """关闭所有爬虫连接"""
        for crawler in self._crawlers.values():
            if hasattr(crawler, 'close'):
                crawler.close()
            elif hasattr(crawler, 'session'):
                crawler.session.close()
        self._crawlers.clear()
        logger.info("CrawlerHub 已关闭所有连接")


class DataProcessor:
    """数据处理类，负责清洗和分类网页内容"""
    
    def __init__(self):
        """初始化处理器"""
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        
    def clean_html(self, html_content, base_url=None):
        """
        清洗HTML内容，移除导航栏、广告、页脚等，但保留媒体内容的引用
    
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
            
            # 提取内嵌媒体内容（在删除前）
            media = extract_embedded_media(html_content, base_url)
    
            # 先提取 <noscript> 标签内的内容，因为后面会删除这些标签
            noscript_content = "\n".join(tag.get_text(strip=True) for tag in soup.find_all("noscript"))
            
            # 移除常见噪声元素
            noise_tags = [
                'script', 'style', 'nav', 'footer', 'header', 'aside',
                'noscript', 'meta', 'svg'
            ]
            # 注意：这里不再删除iframe，以保留视频嵌入
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
            
            # 添加媒体内容的引用（如果有）
            if media:
                media_html = '<div class="embedded-media-references">\n'
                
                if "youtube" in media:
                    media_html += '<h3>内嵌YouTube视频：</h3>\n<ul>\n'
                    for url in media["youtube"]:
                        media_html += f'<li><a href="{url}" target="_blank">{url}</a></li>\n'
                    media_html += '</ul>\n'
                
                if "twitter" in media:
                    media_html += '<h3>内嵌Twitter内容：</h3>\n<ul>\n'
                    for url in media["twitter"]:
                        media_html += f'<li><a href="{url}" target="_blank">{url}</a></li>\n'
                    media_html += '</ul>\n'
                
                if "vimeo" in media:
                    media_html += '<h3>内嵌Vimeo视频：</h3>\n<ul>\n'
                    for url in media["vimeo"]:
                        media_html += f'<li><a href="{url}" target="_blank">{url}</a></li>\n'
                    media_html += '</ul>\n'
                
                if "instagram" in media:
                    media_html += '<h3>内嵌Instagram内容：</h3>\n<ul>\n'
                    for url in media["instagram"]:
                        media_html += f'<li><a href="{url}" target="_blank">{url}</a></li>\n'
                    media_html += '</ul>\n'
                
                if "other_embedded" in media:
                    media_html += '<h3>其他内嵌内容：</h3>\n<ul>\n'
                    for url in media["other_embedded"]:
                        media_html += f'<li><a href="{url}" target="_blank">{url}</a></li>\n'
                    media_html += '</ul>\n'
                
                media_html += '</div>'
                clean_html += media_html
            
            # 将 <noscript> 标签中的内容追加到清洗后的HTML末尾
            if noscript_content:
                clean_html += "\n" + noscript_content
            
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
        # 创建带时间戳的子目录
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.run_dir = os.path.join(base_dir, f"run_{timestamp}")
        self._ensure_base_dir()
        
    def _ensure_base_dir(self):
        """确保基础目录和运行目录存在"""
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            logger.info(f"创建基础目录: {self.base_dir}")
            
        # 确保运行子目录存在
        if not os.path.exists(self.run_dir):
            os.makedirs(self.run_dir)
            logger.info(f"创建运行目录: {self.run_dir}")
            
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
        
        # 创建域名目录 (在运行子目录下)
        domain_dir = os.path.join(self.run_dir, domain)
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
        
        # 生成文件名 (不再需要时间戳，因为已经在目录中包含了)
        filename = f"{path}.{format_type}"
        
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
        
    def get_run_directory(self):
        """
        获取当前运行的目录路径
        
        返回:
            当前运行的目录路径
        """
        return self.run_dir

# ---------------------------
# 都市传说判断算法模块
# ---------------------------
class UrbanLegendAnalyzer:
    """都市传说分析器，用于检测和评估爬取内容中的都市传说"""
    
    def __init__(self):
        """初始化都市传说分析器"""
        # 默认阈值
        self.thresholds = {
            'confirmed_J': 1.8,
            'suspect_J': 1.3,
            'lag': 2.0,
            # 内容特征阈值
            'keyword_score': 0.7,
            'credibility_score': 0.5
        }
    
    def urban_legend_judge_seo(self, 
                               theta_values, 
                               y_values, 
                               time_array, 
                               seo_factor, 
                               alpha_seo=0.5, 
                               thresholds=None):
        """
        考虑 SEO 因素的都市传说识别函数
        
        参数：
        ----------
        theta_values : 1D array-like
            议题热度序列
        y_values : 1D array-like
            反制信息强度序列
        time_array : 1D array-like
            时间序列，与上面两个序列一一对应
        seo_factor : float
            SEO 因子（越大越说明帖子在搜索引擎中的排名或曝光越高）
        alpha_seo : float
            SEO 放大系数，用于决定 SEO 对最终 J 值的影响
        thresholds : dict
            包含 'confirmed_J', 'suspect_J', 'lag' 等判定阈值
        
        返回：
        ----------
        label : str
            "✅ 已确认都市传说" / "⚠️ 疑似都市传说" / "🟢 普通帖子"
        details : dict
            具体计算结果，用于后续分析
        """

        if thresholds is None:
            thresholds = self.thresholds

        theta_max = np.max(theta_values)
        y_max = np.max(y_values)
        epsilon = 1e-6
        J = theta_max / (y_max + epsilon)
        # SEO 修正后的传播指数
        J_SEO = J * (1 + alpha_seo * seo_factor)

        # 计算议题热度的局部峰值数量（简单方法）
        num_peaks_theta = 0
        for i in range(1, len(theta_values) - 1):
            if theta_values[i] > theta_values[i-1] and theta_values[i] > theta_values[i+1]:
                num_peaks_theta += 1

        # 计算反制延迟：取最大值对应时间的差值
        t_theta_max = time_array[np.argmax(theta_values)]
        t_y_max = time_array[np.argmax(y_values)]
        lag_time = abs(t_y_max - t_theta_max)

        # 判断逻辑
        label = "🟢 普通帖子"
        if J_SEO > thresholds['confirmed_J'] and lag_time > thresholds['lag'] and num_peaks_theta >= 2:
            label = "✅ 已确认都市传说"
        elif J_SEO > thresholds['suspect_J'] and lag_time > thresholds['lag']:
            label = "⚠️ 疑似都市传说"

        details = {
            'theta_max': theta_max,
            'y_max': y_max,
            'J_raw': J,
            'J_SEO': J_SEO,
            'seo_factor': seo_factor,
            'num_peaks_theta': num_peaks_theta,
            'lag_time': lag_time,
            'thresholds': thresholds
        }

        return label, details
    
    def analyze_content(self, content, url, metadata=None):
        """
        分析爬取的内容是否为都市传说
        
        参数:
            content: 网页内容文本
            url: 网页URL
            metadata: 元数据信息（可选）
            
        返回:
            分析结果字典
        """
        if not content:
            return {
                'label': "🔄 无法分析",
                'details': {"reason": "内容为空"},
                'url': url,
                'analysis_time': datetime.now().isoformat()
            }
            
        try:
            # 这里是简化的分析过程，实际应用中需要根据内容特征提取热度和反制信息
            
            # 基于内容长度和复杂度的简单估计
            content_length = len(content)
            # 字符数 / 1000 作为简单的SEO因子（越长的文章可能越受欢迎）
            seo_factor = min(5.0, content_length / 1000)
            
            # 简单模拟热度和反制序列
            # 在实际应用中，这些应该从历史数据中提取
            t = np.linspace(0, 20, 100)
            
            # 使用内容指标构造合成的热度曲线
            # 这里采用随机值+内容长度因素作为演示
            # 实际应用应该基于真实的传播数据
            noise = np.random.normal(0, 0.1, len(t))
            theta_t = 1.0 + 0.5 * np.sin(t/2) + 0.3 * np.sin(t) + noise + (content_length / 50000)
            
            # 反制信息曲线，通常稍微滞后于热度曲线
            y_t = 0.8 + 0.4 * np.sin((t-1.5)/2) + 0.2 * np.sin(t-1.5) + np.random.normal(0, 0.1, len(t))
            
            # 提取关键词特征
            # 简单示例：检查一些常见的都市传说关键词
            urban_legend_keywords = [
                "震惊", "秘密", "不为人知", "揭秘", "惊人真相", "官方掩盖", 
                "不会告诉你", "医生不会告诉你", "政府隐瞒", "阴谋论",
                "绝密", "转发", "扩散", "注意"
            ]
            
            keyword_count = sum(1 for keyword in urban_legend_keywords if keyword in content)
            keyword_score = min(1.0, keyword_count / 5)  # 最多5个关键词就算满分
            
            # 调整SEO因子加入关键词得分
            seo_factor = seo_factor * (1 + keyword_score)
            
            # 调用都市传说判断函数
            label, details = self.urban_legend_judge_seo(theta_t, y_t, t, seo_factor)
            
            # 添加额外的内容分析指标
            details.update({
                'content_length': content_length,
                'keyword_score': keyword_score,
                'keyword_count': keyword_count,
                'matched_keywords': [kw for kw in urban_legend_keywords if kw in content]
            })
            
            # 构造最终结果
            result = {
                'label': label,
                'details': details,
                'url': url,
                'analysis_time': datetime.now().isoformat()
            }
            
            # 如果有元数据，加入一些关键元数据
            if metadata:
                result['metadata'] = {
                    'title': metadata.get('title', ''),
                    'keywords': metadata.get('keywords', []),
                    'crawl_time': metadata.get('crawl_time', '')
                }
            
            return result
            
        except Exception as e:
            logger.error(f"分析内容出错: {url}, 错误: {str(e)}")
            return {
                'label': "🔄 分析失败",
                'details': {"error": str(e)},
                'url': url,
                'analysis_time': datetime.now().isoformat()
            }
    
    def batch_analyze(self, content_list):
        """
        批量分析多个内容
        
        参数:
            content_list: 内容列表，每项应包含content和url
            
        返回:
            分析结果列表
        """
        results = []
        
        for item in content_list:
            content = item.get('content', '')
            url = item.get('url', '')
            metadata = item.get('metadata', None)
            
            result = self.analyze_content(content, url, metadata)
            results.append(result)
            
        return results

class APIConnector:
    """与后端API连接的类，用于上传爬虫结果和获取配置"""
    
    def __init__(self, api_base_url=None, api_key=None):
        """
        初始化API连接器
        
        参数:
            api_base_url: API基础URL
            api_key: API密钥（可选）
        """
        # 默认API地址
        self.api_base_url = api_base_url or "https://api.holograplaplace.com"
        self.api_key = api_key
        self.session = requests.Session()
        
        # 如果有API密钥，添加到请求头
        if self.api_key:
            self.session.headers.update({
                "Authorization": f"Bearer {self.api_key}"
            })
        
        # 设置通用请求头
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "HologramLaplace-Crawler/1.0"
        })
    
    def get_configuration(self, config_id=None):
        """
        从服务器获取爬虫配置
        
        参数:
            config_id: 配置ID（可选）
            
        返回:
            配置字典
        """
        try:
            # 如果提供了配置ID，获取特定配置
            if config_id:
                response = self.session.get(f"{self.api_base_url}/api/crawler/config/{config_id}")
            else:
                # 否则获取默认配置
                response = self.session.get(f"{self.api_base_url}/api/crawler/config/default")
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"获取配置失败: {str(e)}")
            # 返回基本配置作为回退
            return {
                "urls": [],
                "depth": 2,
                "format": "html",
                "concurrency": 3
            }
    
    def upload_results(self, results, task_id=None):
        """
        上传爬取结果到服务器
        
        参数:
            results: 爬取结果字典
            task_id: 任务ID（可选）
            
        返回:
            成功返回True，失败返回False
        """
        try:
            # 准备上传数据
            payload = {
                "results": results,
                "task_id": task_id,
                "timestamp": datetime.now().isoformat(),
                "client_info": {
                    "version": "1.0",
                    "platform": platform.system(),
                    "python_version": platform.python_version()
                }
            }
            
            # 发送POST请求
            response = self.session.post(
                f"{self.api_base_url}/api/crawler/results",
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"结果上传成功，服务器返回: {result}")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"上传结果失败: {str(e)}")
            return False
    
    def get_media_info(self, media_url):
        """
        获取媒体内容的额外信息
        
        参数:
            media_url: 媒体URL（YouTube、Twitter等）
            
        返回:
            媒体信息字典
        """
        try:
            # 准备请求数据
            payload = {
                "url": media_url
            }
            
            # 发送请求
            response = self.session.post(
                f"{self.api_base_url}/api/media/info",
                json=payload
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"获取媒体信息失败: {str(e)}")
            # 返回基本信息作为回退
            media_type = "unknown"
            if "youtube.com" in media_url or "youtu.be" in media_url:
                media_type = "youtube"
            elif "twitter.com" in media_url:
                media_type = "twitter"
            elif "vimeo.com" in media_url:
                media_type = "vimeo"
            elif "instagram.com" in media_url:
                media_type = "instagram"
                
            return {
                "url": media_url,
                "type": media_type,
                "title": None,
                "thumbnail": None,
                "author": None,
                "publish_date": None
            }
    
    def report_error(self, error_info):
        """
        向服务器报告错误
        
        参数:
            error_info: 错误信息字典
            
        返回:
            成功返回True，失败返回False
        """
        try:
            # 准备错误信息
            payload = {
                "error": error_info,
                "timestamp": datetime.now().isoformat(),
                "client_info": {
                    "version": "1.0",
                    "platform": platform.system(),
                    "python_version": platform.python_version()
                }
            }
            
            # 发送错误报告
            response = self.session.post(
                f"{self.api_base_url}/api/crawler/error",
                json=payload
            )
            
            response.raise_for_status()
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"报告错误失败: {str(e)}")
            return False


# 在main函数中添加API集成
def main_with_api():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='全息拉普拉斯互联网爬虫系统')
    parser.add_argument('-c', '--config', type=str, default='crawler_config.json', help='配置文件路径')
    parser.add_argument('-o', '--output', type=str, default='crawler_results.json', help='结果输出文件路径')
    parser.add_argument('-v', '--verbose', action='store_true', help='输出详细日志')
    parser.add_argument('-a', '--api', action='store_true', help='使用API获取配置并上传结果')
    parser.add_argument('-u', '--api-url', type=str, help='API基础URL')
    parser.add_argument('-k', '--api-key', type=str, help='API密钥')
    parser.add_argument('-t', '--task-id', type=str, help='任务ID')
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 初始化API连接器（如果启用了API）
    api = None
    if args.api:
        api = APIConnector(api_base_url=args.api_url, api_key=args.api_key)
    
    # 获取配置
    config = None
    if api and args.api:
        # 从API获取配置
        print("从API获取配置...")
        config = api.get_configuration(args.task_id)
        print(f"成功获取API配置，包含 {len(config.get('urls', []))} 个URL")
    else:
        # 从本地文件获取配置
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
        logger.error("配置中未找到有效URL")
        print("错误: 配置中未找到有效URL")
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
    
    # 将运行目录记录到任务信息中
    task_info["run_directory"] = storage.get_run_directory()
    
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
                
                # 提取媒体内容信息
                media = {}
                if html_content and not isinstance(html_content, str) and not (html_content.startswith("PDF_CONTENT_") or html_content.startswith("UNSUPPORTED_CONTENT_")):
                    media = extract_embedded_media(html_content, url)
                    if media and api:
                        # 获取媒体的额外信息
                        for media_type, urls_list in media.items():
                            for i, media_url in enumerate(urls_list):
                                media_info = api.get_media_info(media_url)
                                # 用更详细的信息替换原始URL
                                media[media_type][i] = media_info
                    
                    # 将媒体信息添加到元数据
                    if media:
                        metadata["embedded_media"] = media
                
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
                    "status": status,
                    "embedded_media": media if media else None
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
        
        # 保存结果到运行目录
        result_path = os.path.join(storage.get_run_directory(), args.output)
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        # 另外在当前目录下也保存一份结果
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        # 如果启用了API，上传结果
        if api and args.api:
            print("上传结果到API...")
            success = api.upload_results(result, args.task_id)
            if success:
                print("结果上传成功！")
            else:
                print("警告: 结果上传失败，请稍后手动上传或检查网络连接")
        
        print(f"爬取完成！结果已保存到:")
        print(f" - {result_path}")
        print(f" - {os.path.abspath(args.output)} (复制)")
        print(f"数据文件保存在: {storage.get_run_directory()}")
        print(f"总共爬取 {len(all_results)} 个页面，成功率 {statistics['successRate']}%")
        print(f"用时 {task_info['duration']:.2f} 秒")
        
        if not (api and args.api):
            print("请将结果文件上传到网页界面查看详细分析")
        
    except KeyboardInterrupt:
        print("\n爬取被用户中断")
        # 报告中断错误
        if api and args.api:
            api.report_error({
                "type": "keyboard_interrupt",
                "message": "用户中断爬取",
                "task_id": args.task_id
            })
    except Exception as e:
        logger.error(f"爬取过程出错: {str(e)}")
        print(f"错误: {str(e)}")
        # 报告其他错误
        if api and args.api:
            api.report_error({
                "type": "exception",
                "message": str(e),
                "traceback": traceback.format_exc(),
                "task_id": args.task_id
            })
    finally:
        # 关闭资源
        crawler.close()

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
    
    # 将运行目录记录到任务信息中
    task_info["run_directory"] = storage.get_run_directory()
    
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
        
        # 保存结果 (将结果也保存到运行目录下)
        result_path = os.path.join(storage.get_run_directory(), args.output)
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        # 另外在当前目录下也保存一份结果，这样用户仍然可以在当前目录找到最新的结果
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        print(f"爬取完成！结果已保存到:")
        print(f" - {result_path}")
        print(f" - {os.path.abspath(args.output)} (复制)")
        print(f"数据文件保存在: {storage.get_run_directory()}")
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

def main_with_urban_legend():
    """集成都市传说分析功能的主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='全息拉普拉斯互联网爬虫系统')
    parser.add_argument('-c', '--config', type=str, default='crawler_config.json', help='配置文件路径')
    parser.add_argument('-o', '--output', type=str, default='crawler_results.json', help='结果输出文件路径')
    parser.add_argument('-v', '--verbose', action='store_true', help='输出详细日志')
    parser.add_argument('-u', '--urban-legend', action='store_true', help='启用都市传说分析')
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
    
    # 如果启用都市传说分析，初始化分析器
    urban_legend_analyzer = None
    if args.urban_legend:
        print("启用都市传说分析功能")
        urban_legend_analyzer = UrbanLegendAnalyzer()
    
    # 记录开始时间
    start_time = time.time()
    task_info = {
        "start_time": start_time,
        "urls": urls,
        "depth": depth,
        "format": format_type,
        "concurrency": concurrency,
        "urban_legend_enabled": args.urban_legend
    }
    
    # 初始化爬虫、处理器和存储管理器
    crawler = WebCrawler(max_workers=concurrency)
    processor = DataProcessor()
    storage = StorageManager(base_dir='./crawled_data')
    
    # 将运行目录记录到任务信息中
    task_info["run_directory"] = storage.get_run_directory()
    
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
                
                # 提取媒体内容信息
                media = {}
                if html_content and not isinstance(html_content, str) and not (html_content.startswith("PDF_CONTENT_") or html_content.startswith("UNSUPPORTED_CONTENT_")):
                    media = extract_embedded_media(html_content, url)
                
                # 都市传说分析（如果启用）
                urban_legend_result = None
                if args.urban_legend and urban_legend_analyzer and clean_content:
                    metadata = {
                        'title': title,
                        'keywords': keywords,
                        'crawl_time': datetime.now().isoformat()
                    }
                    urban_legend_result = urban_legend_analyzer.analyze_content(clean_content, url, metadata)
                    logger.info(f"都市传说分析结果 {url}: {urban_legend_result['label']}")
                
                # 存储内容
                metadata = {
                    "title": title or "无标题",
                    "url": url,
                    "depth": data.get("depth", 0),
                    "crawl_time": datetime.now().isoformat(),
                    "keywords": keywords,
                    "content_type": "pdf" if isinstance(html_content, str) and html_content.startswith("PDF_CONTENT_") else "html"
                }
                
                # 将媒体信息添加到元数据
                if media:
                    metadata["embedded_media"] = media
                    
                # 将都市传说分析结果添加到元数据
                if urban_legend_result:
                    metadata["urban_legend"] = urban_legend_result
                
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
                    "status": status,
                    "embedded_media": media if media else None
                }
                
                # 添加都市传说分析结果
                if urban_legend_result:
                    processed_item["urban_legend"] = urban_legend_result
                
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
        
        # 如果启用了都市传说分析，添加相关统计
        if args.urban_legend and urban_legend_analyzer:
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
        
        # 保存结果 (将结果也保存到运行目录下)
        result_path = os.path.join(storage.get_run_directory(), args.output)
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        # 另外在当前目录下也保存一份结果，这样用户仍然可以在当前目录找到最新的结果
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
        
        print(f"爬取完成！结果已保存到:")
        print(f" - {result_path}")
        print(f" - {os.path.abspath(args.output)} (复制)")
        print(f"数据文件保存在: {storage.get_run_directory()}")
        print(f"总共爬取 {len(all_results)} 个页面，成功率 {statistics['successRate']}%")
        print(f"用时 {task_info['duration']:.2f} 秒")
        
        # 如果启用了都市传说分析，显示分析结果统计
        if args.urban_legend and "urban_legend" in statistics:
            ul_stats = statistics["urban_legend"]
            print("\n都市传说分析结果:")
            print(f" - 已确认都市传说: {ul_stats['confirmed_count']} 篇")
            print(f" - 疑似都市传说: {ul_stats['suspect_count']} 篇")
            print(f" - 普通内容: {ul_stats['normal_count']} 篇")
            if ul_stats['failed_count'] > 0:
                print(f" - 分析失败: {ul_stats['failed_count']} 篇")
        
        print("请将结果文件上传到网页界面查看详细分析")
        
    except KeyboardInterrupt:
        print("\n爬取被用户中断")
    except Exception as e:
        logger.error(f"爬取过程出错: {str(e)}")
        print(f"错误: {str(e)}")
    finally:
        # 关闭资源
        crawler.close()

# 在文件末尾添加调用
if __name__ == "__main__":
    # 如果需要启用API功能，取消下面一行的注释并注释掉main()调用
    # main_with_api()
    # 要使用带都市传说分析的版本，取消下面一行的注释，并注释掉上面的main()调用
    main_with_urban_legend()

    #main()
