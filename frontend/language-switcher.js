// language-switcher.js - 语言切换功能实现

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
    
    // 背景设置
    'bg-settings': {
        'zh': '背景设置',
        'en': 'Background Settings'
    },
    'select-bg': {
        'zh': '选择背景',
        'en': 'Select Background'
    },
    'no-bg': {
        'zh': '无背景',
        'en': 'No Background'
    },
    'anime1': {
        'zh': '动漫1',
        'en': 'Anime 1'
    },
    'anime2': {
        'zh': '动漫2',
        'en': 'Anime 2'
    },
    'abstract': {
        'zh': '抽象',
        'en': 'Abstract'
    },
    'landscape': {
        'zh': '风景',
        'en': 'Landscape'
    },
    'tech': {
        'zh': '科技',
        'en': 'Technology'
    },
    'custom': {
        'zh': '自定义',
        'en': 'Custom'
    },
    'upload-custom-bg': {
        'zh': '上传自定义背景',
        'en': 'Upload Custom Background'
    },
    'content-opacity': {
        'zh': '内容透明度',
        'en': 'Content Opacity'
    },
    'glass-effect': {
        'zh': '启用毛玻璃效果',
        'en': 'Enable Glass Effect'
    },
    
    // 助手和广告
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
        'zh': '全息拉普拉斯互联网爬虫系统',
        'en': 'Holographic Laplace Internet Crawler System'
    },
    
    // 语言切换器
    'language': {
        'zh': '语言',
        'en': 'Language'
    },
    'chinese': {
        'zh': '中文',
        'en': 'Chinese'
    },
    'english': {
        'zh': '英文',
        'en': 'English'
    }
};

// 获取当前语言
function getCurrentLanguage() {
    return localStorage.getItem('selectedLanguage') || 'zh';
}

// 设置语言
function setLanguage(lang) {
    localStorage.setItem('selectedLanguage', lang);
    applyLanguage(lang);
}

// 应用语言设置
function applyLanguage(lang) {
    // 选择器和文本的映射
    const elementsToTranslate = [
        { selector: 'h1', key: 'header' },
        { selector: '#server-status-text', key: 'server-status' },
        { selector: '#crawler-config-header', key: 'crawler-config' },
        { selector: 'label[for="urlInput"]', key: 'url-list' },
        { selector: '#urlInput', key: 'url-placeholder', attr: 'placeholder' },
        { selector: 'label[for="crawlDepth"]', key: 'crawl-depth' },
        { selector: '#crawlDepth option:nth-child(1)', key: 'depth-1' },
        { selector: '#crawlDepth option:nth-child(2)', key: 'depth-2' },
        { selector: '#crawlDepth option:nth-child(3)', key: 'depth-3' },
        { selector: '.form-label:contains("存储格式"), .form-label:contains("Storage Format")', key: 'storage-format' },
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
        { selector: '#user-guide-header', key: 'user-guide' },
        { selector: '#user-guide li:nth-child(1)', key: 'guide-1' },
        { selector: '#user-guide li:nth-child(2)', key: 'guide-2' },
        { selector: '#user-guide li:nth-child(3)', key: 'guide-3' },
        { selector: '#user-guide li:nth-child(4)', key: 'guide-4' },
        { selector: '#user-guide li:nth-child(5)', key: 'guide-5' },
        { selector: '#user-guide li:nth-child(6)', key: 'guide-6' },
        { selector: '#bg-settings-header', key: 'bg-settings' },
        { selector: '#select-bg-text', key: 'select-bg' },
        { selector: '#bg-option-none', key: 'no-bg', attr: 'title' },
        { selector: '#bg-option-anime1', key: 'anime1', attr: 'title' },
        { selector: '#bg-option-anime2', key: 'anime2', attr: 'title' },
        { selector: '#bg-option-abstract', key: 'abstract', attr: 'title' },
        { selector: '#bg-option-landscape', key: 'landscape', attr: 'title' },
        { selector: '#bg-option-tech', key: 'tech', attr: 'title' },
        { selector: '#custom-bg-option', key: 'custom', attr: 'title' },
        { selector: '.image-upload-label', key: 'upload-custom-bg' },
        { selector: '#opacity-text', key: 'content-opacity' },
        { selector: 'label[for="glass-effect-toggle"]', key: 'glass-effect' },
        { selector: '#assistant-header', key: 'assistant' },
        { selector: '#assistant-intro', key: 'assistant-intro' },
        { selector: '.change-model-btn', key: 'change-model' },
        { selector: '.toggle-dialog-btn', key: 'dialog' },
        { selector: '#announcement-header', key: 'announcement' },
        { selector: '#new-version-text', key: 'new-version' },
        { selector: '#new-features-text', key: 'new-features' },
        { selector: '#learn-more-btn', key: 'learn-more' },
        { selector: '#recommended-header', key: 'recommended' },
        { selector: '#book-title', key: 'book-title' },
        { selector: '#book-desc', key: 'book-desc' },
        { selector: '#view-details-btn', key: 'view-details' },
        { selector: '#upload-tab', key: 'upload-tab' },
        { selector: '#tasks-tab', key: 'tasks-tab' },
        { selector: '#content-tab', key: 'content-tab' },
        { selector: '#category-tab', key: 'category-tab' },
        { selector: '#conspiracy-tab', key: 'conspiracy-tab' },
        { selector: '#stats-tab', key: 'stats-tab' },
        { selector: '#upload-title', key: 'upload-title' },
        { selector: '#drop-files-text', key: 'drop-files' },
        { selector: '#browseBtn', key: 'select-file' },
        { selector: '.empty-message p', key: 'no-results' },
        { selector: '#content-empty-message', key: 'select-left' },
        { selector: '#category-empty-message', key: 'select-category' },
        { selector: '#conspiracy-empty-message', key: 'select-item' },
        { selector: '.footer-text', key: 'footer' },
        { selector: '#language-text', key: 'language' },
        { selector: '#chinese-option', key: 'chinese' },
        { selector: '#english-option', key: 'english' }
    ];

    // 遍历元素并翻译
    elementsToTranslate.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        if (elements.length > 0) {
            elements.forEach(element => {
                const translation = languageTexts[item.key] ? languageTexts[item.key][lang] : null;
                if (translation) {
                    if (item.attr) {
                        element.setAttribute(item.attr, translation);
                    } else {
                        element.textContent = translation;
                    }
                }
            });
        }
    });

    // 更新语言选择器的显示
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.value = lang;
    }

    // 发出语言变更事件
    const languageChangeEvent = new CustomEvent('languageChanged', {
        detail: { language: lang }
    });
    document.dispatchEvent(languageChangeEvent);
}

// 初始化语言切换器
function initLanguageSwitcher() {
    // 创建语言选择器下拉菜单（如果不存在）
    if (!document.getElementById('language-switcher')) {
        const headerControls = document.querySelector('header .d-flex.align-items-center');
        
        if (headerControls) {
            // 创建语言切换容器
            const languageSwitcher = document.createElement('div');
            languageSwitcher.id = 'language-switcher';
            languageSwitcher.className = 'language-switcher me-4';
            
            // 添加语言图标和标签
            languageSwitcher.innerHTML = `
                <span id="language-icon" class="language-icon">🌐</span>
                <span id="language-text" class="me-2">语言</span>
                <select id="language-selector" class="form-select form-select-sm">
                    <option id="chinese-option" value="zh">中文</option>
                    <option id="english-option" value="en">英文</option>
                </select>
            `;
            
            // 在主题选择器之前插入语言选择器
            const themeSwitcher = document.querySelector('.theme-switcher');
            if (themeSwitcher) {
                headerControls.insertBefore(languageSwitcher, themeSwitcher);
            } else {
                headerControls.prepend(languageSwitcher);
            }
            
            // 添加事件监听器
            const languageSelector = document.getElementById('language-selector');
            if (languageSelector) {
                languageSelector.addEventListener('change', function() {
                    setLanguage(this.value);
                });
                
                // 设置初始值
                languageSelector.value = getCurrentLanguage();
            }
        }
    }
    
    // 应用当前语言
    applyLanguage(getCurrentLanguage());
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化语言切换器
    initLanguageSwitcher();
    
    // 监听主题变更事件，确保语言设置在主题变更后仍然生效
    document.addEventListener('themeChanged', function() {
        // 延迟应用语言设置，确保主题变更完成
        setTimeout(() => {
            applyLanguage(getCurrentLanguage());
        }, 100);
    });
});
