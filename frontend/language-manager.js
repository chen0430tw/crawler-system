// 多语言支持脚本

// 创建语言文本映射
const languageTexts = {
    // 页面标题和头部
    'header': {
        'zh': '全息拉普拉斯互联网爬虫系统',
        'en': 'Holographic Laplace Internet Crawler System'
    },
    'server-status': {
        'zh': '服务器状态:',
        'en': 'Server Status:'
    },
    'language': {
        'zh': '语言',
        'en': 'Language'
    },
    'settings': {
        'zh': '设置',
        'en': 'Settings'
    },
    
    // 设置菜单
    'theme-settings': {
        'zh': '主题',
        'en': 'Theme'
    },
    'theme-default': {
        'zh': '默认主题',
        'en': 'Default Theme'
    },
    'theme-dark': {
        'zh': '深色主题',
        'en': 'Dark Theme'
    },
    'theme-blue': {
        'zh': '蓝色主题',
        'en': 'Blue Theme'
    },
    'theme-purple': {
        'zh': '紫色主题',
        'en': 'Purple Theme'
    },
    'theme-green': {
        'zh': '绿色主题',
        'en': 'Green Theme'
    },
    'background-settings': {
        'zh': '背景',
        'en': 'Background'
    },
    'upload-custom-bg': {
        'zh': '上传自定义背景',
        'en': 'Upload Custom Background'
    },
    'opacity-settings': {
        'zh': '内容透明度',
        'en': 'Content Opacity'
    },
    'glass-effect': {
        'zh': '启用毛玻璃效果',
        'en': 'Enable Glass Effect'
    },
    'interface-elements': {
        'zh': '界面元素',
        'en': 'Interface Elements'
    },
    'show-assistant': {
        'zh': '显示小助手',
        'en': 'Show Assistant'
    },
    'show-announcements': {
        'zh': '显示公告',
        'en': 'Show Announcements'
    },
    'show-recommendations': {
        'zh': '显示推荐',
        'en': 'Show Recommendations'
    },
    
    // 爬虫配置面板
    'crawler-config': {
        'zh': '爬虫配置',
        'en': 'Crawler Configuration'
    },
    'url-list': {
        'zh': 'URL列表',
        'en': 'URL List'
    },
    'url-placeholder': {
        'zh': '输入URL，每行一个，例如: https://example.com',
        'en': 'Enter URLs, one per line, e.g.: https://example.com'
    },
    'crawl-depth': {
        'zh': '爬取深度',
        'en': 'Crawl Depth'
    },
    'depth-1': {
        'zh': '1级 (只爬取输入页面)',
        'en': 'Level 1 (input pages only)'
    },
    'depth-2': {
        'zh': '2级 (包含链接页面)',
        'en': 'Level 2 (including linked pages)'
    },
    'depth-3': {
        'zh': '3级 (包含二级链接)',
        'en': 'Level 3 (including second-level links)'
    },
    'storage-format': {
        'zh': '存储格式',
        'en': 'Storage Format'
    },
    'format-txt': {
        'zh': 'TXT 格式',
        'en': 'TXT Format'
    },
    'format-html': {
        'zh': 'HTML 格式',
        'en': 'HTML Format'
    },
    'concurrency': {
        'zh': '并发数',
        'en': 'Concurrency'
    },
    'concurrency-low': {
        'zh': '1 (低)',
        'en': '1 (Low)'
    },
    'concurrency-medium': {
        'zh': '3 (中)',
        'en': '3 (Medium)'
    },
    'concurrency-high': {
        'zh': '5 (高)',
        'en': '5 (High)'
    },
    'run-crawler': {
        'zh': '运行爬虫',
        'en': 'Run Crawler'
    },
    'generate-config': {
        'zh': '生成配置文件',
        'en': 'Generate Config File'
    },
    'download-config': {
        'zh': '下载配置文件',
        'en': 'Download Config File'
    },
    'clear-input': {
        'zh': '清除输入',
        'en': 'Clear Input'
    },
    
    // 使用说明
    'user-guide': {
        'zh': '使用说明',
        'en': 'User Guide'
    },
    'guide-1': {
        'zh': '在URL列表中输入要爬取的网站地址',
        'en': 'Enter website URLs in the URL list'
    },
    'guide-2': {
        'zh': '设置爬取深度和存储格式',
        'en': 'Set crawl depth and storage format'
    },
    'guide-3': {
        'zh': '点击"运行爬虫"直接开始爬取',
        'en': 'Click "Run Crawler" to start crawling'
    },
    'guide-4': {
        'zh': '或者点击"生成配置文件"并下载',
        'en': 'Or click "Generate Config File" and download'
    },
    'guide-5': {
        'zh': '查看"任务列表"标签页跟踪任务进度',
        'en': 'Check the "Task List" tab to track progress'
    },
    'guide-6': {
        'zh': '爬取完成后，可在结果标签页查看分析',
        'en': 'After completion, view results in result tabs'
    },
    
    // 小助手组件
    'assistant': {
        'zh': '小助手',
        'en': 'Assistant'
    },
    'assistant-intro': {
        'zh': '我是你的爬虫助手！有任何问题可以问我哦~',
        'en': 'I\'m your crawler assistant! Feel free to ask me anything~'
    },
    'change-model': {
        'zh': '换装',
        'en': 'Change Model'
    },
    'dialog': {
        'zh': '对话',
        'en': 'Chat'
    },
    
    // 公告组件
    'announcement': {
        'zh': '公告',
        'en': 'Announcement'
    },
    'new-version': {
        'zh': '新版本发布! 全息拉普拉斯互联网爬虫系统3.0现已推出',
        'en': 'New version released! Holographic Laplace Internet Crawler System 3.0 is now available'
    },
    'new-features': {
        'zh': '新功能包括更强大的阴谋论检测算法和多语言支持。',
        'en': 'New features include enhanced conspiracy detection algorithms and multilingual support.'
    },
    'learn-more': {
        'zh': '了解更多',
        'en': 'Learn More'
    },
    
    // 推荐阅读组件
    'recommended': {
        'zh': '推荐阅读',
        'en': 'Recommended Reading'
    },
    'book-title': {
        'zh': '《全息拉普拉斯理论与互联网拓扑分析》',
        'en': '"Holographic Laplace Theory and Internet Topology Analysis"'
    },
    'book-desc': {
        'zh': '探索互联网节点关系的前沿研究方法',
        'en': 'Explore cutting-edge methods for analyzing internet node relationships'
    },
    'view-details': {
        'zh': '查看详情',
        'en': 'View Details'
    },
    
    // 标签页
    'upload-tab': {
        'zh': '上传结果',
        'en': 'Upload Results'
    },
    'tasks-tab': {
        'zh': '任务列表',
        'en': 'Task List'
    },
    'content-tab': {
        'zh': '抓取内容',
        'en': 'Crawled Content'
    },
    'category-tab': {
        'zh': '分类结果',
        'en': 'Category Results'
    },
    'conspiracy-tab': {
        'zh': '阴谋论检测',
        'en': 'Conspiracy Detection'
    },
    'stats-tab': {
        'zh': '统计信息',
        'en': 'Statistics'
    },
    
    // 上传区域
    'upload-title': {
        'zh': '上传爬虫结果文件',
        'en': 'Upload Crawler Result File'
    },
    'drop-files': {
        'zh': '拖放结果文件到此处或点击选择文件',
        'en': 'Drop result files here or click to select'
    },
    'select-file': {
        'zh': '选择文件',
        'en': 'Select File'
    },
    
    // 空状态消息
    'no-results': {
        'zh': '请先上传爬虫结果文件或运行爬虫任务',
        'en': 'Please upload a crawler result file or run a crawler task first'
    },
    'select-left': {
        'zh': '选择左侧链接查看内容',
        'en': 'Select a link on the left to view content'
    },
    'select-category': {
        'zh': '选择左侧分类查看内容',
        'en': 'Select a category on the left to view content'
    },
    'select-item': {
        'zh': '选择左侧项目查看检测结果',
        'en': 'Select an item on the left to view detection results'
    },
    
    // 页脚
    'footer': {
        'zh': '全息拉普拉斯互联网爬虫系统 ©; 2023-2025',
        'en': 'Holographic Laplace Internet Crawler System ©; 2023-2025'
    }
};

// 获取当前语言
function getCurrentLanguage() {
    return localStorage.getItem('selectedLanguage') || 'zh';
}

// 全局锁变量，防止递归调用
let isApplyingLanguage = false;

// 更新语言菜单选择状态
function updateLanguageMenuSelection(lang) {
    const langLinks = document.querySelectorAll('.dropdown-item[data-lang]');
    langLinks.forEach(link => {
        if (link.getAttribute('data-lang') === lang) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// 应用语言设置（异步执行，防止阻塞，并对每项加 try…catch 保护）
function applyLanguage(lang) {
    if (isApplyingLanguage) return;
    isApplyingLanguage = true;
    
    setTimeout(() => {
        const elementsToTranslate = [
            { selector: 'h1', key: 'header' },
            { selector: '#server-status-text', key: 'server-status' },
            { selector: '#languageDropdown', key: 'language' },
            { selector: '#settingsDropdown', key: 'settings' },
            
            // 设置菜单
            { selector: '.settings-dropdown .dropdown-header:nth-of-type(1)', key: 'theme-settings' },
            { selector: '#theme-selector option[value="theme-default"]', key: 'theme-default' },
            { selector: '#theme-selector option[value="theme-dark"]', key: 'theme-dark' },
            { selector: '#theme-selector option[value="theme-blue"]', key: 'theme-blue' },
            { selector: '#theme-selector option[value="theme-purple"]', key: 'theme-purple' },
            { selector: '#theme-selector option[value="theme-green"]', key: 'theme-green' },
            { selector: '.settings-dropdown .dropdown-header:nth-of-type(2)', key: 'background-settings' },
            { selector: '.settings-dropdown label.btn', key: 'upload-custom-bg' },
            { selector: '.settings-dropdown .dropdown-header:nth-of-type(3)', key: 'opacity-settings' },
            { selector: 'label[for="glass-effect-toggle"]', key: 'glass-effect' },
            { selector: '.settings-dropdown .dropdown-header:nth-of-type(4)', key: 'interface-elements' },
            { selector: 'label[for="toggle-assistant"]', key: 'show-assistant' },
            { selector: 'label[for="toggle-announcements"]', key: 'show-announcements' },
            { selector: 'label[for="toggle-recommendations"]', key: 'show-recommendations' },
            
            // 爬虫配置
            { selector: '.accordion-button[data-bs-target="#collapseConfig"]', key: 'crawler-config' },
            { selector: 'label[for="urlInput"]', key: 'url-list' },
            { selector: '#urlInput', key: 'url-placeholder', attr: 'placeholder' },
            { selector: 'label[for="crawlDepth"]', key: 'crawl-depth' },
            { selector: '#crawlDepth option:nth-child(1)', key: 'depth-1' },
            { selector: '#crawlDepth option:nth-child(2)', key: 'depth-2' },
            { selector: '#crawlDepth option:nth-child(3)', key: 'depth-3' },
            { selector: '#storage-format-label', key: 'storage-format' },
            { selector: 'label[for="formatTxt"]', key: 'format-txt' },
            { selector: 'label[for="formatHtml"]', key: 'format-html' },
            { selector: 'label[for="concurrency"]', key: 'concurrency' },
            { selector: '#concurrency option:nth-child(1)', key: 'concurrency-low' },
            { selector: '#concurrency option:nth-child(2)', key: 'concurrency-medium' },
            { selector: '#concurrency option:nth-child(3)', key: 'concurrency-high' },
            { selector: '#runBtn', key: 'run-crawler' },
            { selector: '#generateBtn', key: 'generate-config' },
            { selector: '#downloadLink', key: 'download-config' },
            { selector: '#clearBtn', key: 'clear-input' },
            
            // 使用说明
            { selector: '.accordion-button[data-bs-target="#collapseGuide"]', key: 'user-guide' },
            { selector: '#user-guide li:nth-child(1)', key: 'guide-1' },
            { selector: '#user-guide li:nth-child(2)', key: 'guide-2' },
            { selector: '#user-guide li:nth-child(3)', key: 'guide-3' },
            { selector: '#user-guide li:nth-child(4)', key: 'guide-4' },
            { selector: '#user-guide li:nth-child(5)', key: 'guide-5' },
            { selector: '#user-guide li:nth-child(6)', key: 'guide-6' },
            
            // 小助手区域
            { selector: '#assistantSection .card-header h5', key: 'assistant' },
            { selector: '#assistantSection p', key: 'assistant-intro' },
            { selector: '.change-model-btn', key: 'change-model' },
            { selector: '.toggle-dialog-btn', key: 'dialog' },
            
            // 公告区域
            { selector: '#announcementSection .card-header h5', key: 'announcement' },
            { selector: '#announcementSection p:first-of-type', key: 'new-version' },
            { selector: '#announcementSection p:nth-of-type(2)', key: 'new-features' },
            { selector: '#announcementSection a.btn', key: 'learn-more' },
            
            // 推荐阅读区域
            { selector: '#recommendationSection .card-header h5', key: 'recommended' },
            { selector: '#recommendationSection p:first-of-type', key: 'book-title' },
            { selector: '#recommendationSection p.small', key: 'book-desc' },
            { selector: '#recommendationSection a.btn', key: 'view-details' },
            
            // 标签页
            { selector: '#upload-tab', key: 'upload-tab' },
            { selector: '#tasks-tab', key: 'tasks-tab' },
            { selector: '#content-tab', key: 'content-tab' },
            { selector: '#category-tab', key: 'category-tab' },
            { selector: '#conspiracy-tab', key: 'conspiracy-tab' },
            { selector: '#stats-tab', key: 'stats-tab' },
            
            // 上传区域
            { selector: '#upload h5', key: 'upload-title' },
            { selector: '#uploadArea p', key: 'drop-files' },
            { selector: '#browseBtn', key: 'select-file' },
            
            // 空状态消息
            { selector: '.empty-message p', key: 'no-results' },
            { selector: '#content .empty-message p', key: 'select-left' },
            { selector: '#category .empty-message p', key: 'select-category' },
            { selector: '#conspiracy .empty-message p', key: 'select-item' },
            
            // 页脚
            { selector: 'footer .text-muted', key: 'footer' }
        ];
        
        elementsToTranslate.forEach(item => {
            try {
                const elements = document.querySelectorAll(item.selector);
                elements.forEach(element => {
                    const translation = languageTexts[item.key] ? languageTexts[item.key][lang] : "";
                    if (translation) {
                        if (item.attr) {
                            element.setAttribute(item.attr, translation);
                        } else {
                            element.textContent = translation;
                        }
                    }
                });
            } catch (error) {
                console.warn(`翻译错误 (${item.key}):`, error);
            }
        });
        
        updateLanguageMenuSelection(lang);
        isApplyingLanguage = false;
    }, 0);
}

// 设置语言（避免重复设置）
function setLanguage(lang) {
    if (getCurrentLanguage() === lang) return;
    localStorage.setItem('selectedLanguage', lang);
    updateLanguageMenuSelection(lang);
    applyLanguage(lang);
    
    const event = new CustomEvent('languageChanged', { detail: { language: lang } });
    document.dispatchEvent(event);
}

// 初始化语言切换器
function initLanguageManager() {
    const langLinks = document.querySelectorAll('.dropdown-item[data-lang]');
    langLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const lang = this.getAttribute('data-lang');
            setLanguage(lang);
        });
    });
    
    // 初始应用当前语言
    applyLanguage(getCurrentLanguage());
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initLanguageManager();
    
    let mutationTimeout;
    const observer = new MutationObserver(function(mutations, obs) {
        if (mutationTimeout) {
            clearTimeout(mutationTimeout);
        }
        mutationTimeout = setTimeout(() => {
            obs.disconnect();
            applyLanguage(getCurrentLanguage());
            obs.observe(document.body, { childList: true, subtree: true });
        }, 300);
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// 导出语言管理函数
window.LanguageManager = {
    getCurrentLanguage,
    setLanguage,
    applyLanguage
};
