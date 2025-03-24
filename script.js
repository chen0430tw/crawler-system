document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const generateBtn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');
    const clearBtn = document.getElementById('clearBtn');
    const uploadArea = document.getElementById('uploadArea');
    const browseBtn = document.getElementById('browseBtn');
    const resultFile = document.getElementById('resultFile');
    
    // 标签页引用
    const resultTabs = document.getElementById('resultTabs');
    
    // 内容展示区引用
    const urlListElement = document.getElementById('urlList');
    const contentPreview = document.getElementById('contentPreview');
    const categoryList = document.getElementById('categoryList');
    const categoryContent = document.getElementById('categoryContent');
    const statisticsContent = document.getElementById('statisticsContent');
    
    // 存储爬虫结果
    let crawlerResults = null;
    let selectedUrlIndex = null;
    let selectedCategoryId = null;
    
    // 生成配置文件
    generateBtn.addEventListener('click', function() {
        const urlList = document.getElementById('urlList').value.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
        
        if (urlList.length === 0) {
            alert('请输入至少一个URL');
            return;
        }
        
        const crawlDepth = document.getElementById('crawlDepth').value;
        const storageFormat = document.querySelector('input[name="storageFormat"]:checked').value;
        const concurrency = document.getElementById('concurrency').value;
        
        const config = {
            urls: urlList,
            depth: parseInt(crawlDepth),
            format: storageFormat,
            concurrency: parseInt(concurrency),
            timestamp: new Date().toISOString()
        };
        
        const configBlob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(configBlob);
        
        downloadLink.href = url;
        downloadLink.classList.remove('d-none');
        
        // 自动下载
        setTimeout(() => {
            downloadLink.click();
            URL.revokeObjectURL(url);
        }, 100);
    });
    
    // 清除输入
    clearBtn.addEventListener('click', function() {
        document.getElementById('urlList').value = '';
        document.getElementById('crawlDepth').value = '2';
        document.getElementById('formatHtml').checked = true;
        document.getElementById('concurrency').value = '3';
        downloadLink.classList.add('d-none');
    });
    
    // 文件上传区域拖放功能
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        uploadArea.classList.add('dragover');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('dragover');
    }
    
    // 处理文件拖放
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // 处理文件选择
    uploadArea.addEventListener('click', function() {
        resultFile.click();
    });
    
    browseBtn.addEventListener('click', function() {
        resultFile.click();
    });
    
    resultFile.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    // 处理上传的文件
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            alert('请上传JSON格式的爬虫结果文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                crawlerResults = JSON.parse(e.target.result);
                processResults(crawlerResults);
                
                // 自动切换到内容标签页
                const contentTab = document.getElementById('content-tab');
                contentTab.click();
            } catch (error) {
                alert('无法解析结果文件: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    
    // 处理爬虫结果
    function processResults(results) {
        if (!results) return;
        
        // 处理URL列表
        if (results.content && Array.isArray(results.content)) {
            renderUrlList(results.content);
        }
        
        // 处理分类结果
        if (results.categories) {
            renderCategoryList(results.categories);
        }
        
        // 处理统计信息
        if (results.statistics) {
            renderStatistics(results.statistics);
        }
    }
    
    // 渲染URL列表
    function renderUrlList(contentList) {
        urlListElement.innerHTML = '';
        
        if (contentList.length === 0) {
            urlListElement.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">没有抓取到内容</p></div>';
            return;
        }
        
        contentList.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'list-group-item url-item';
            div.innerHTML = `
                <div class="url-title">${item.title || '无标题'}</div>
                <div class="url-path">${item.url}</div>
            `;
            
            div.addEventListener('click', function() {
                // 移除所有active类
                document.querySelectorAll('.url-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                // 添加active类到当前项
                div.classList.add('active');
                
                // 设置选中索引并显示内容
                selectedUrlIndex = index;
                renderContentPreview(item);
            });
            
            urlListElement.appendChild(div);
        });
        
        // 默认选中第一项
        if (contentList.length > 0) {
            urlListElement.firstChild.classList.add('active');
            selectedUrlIndex = 0;
            renderContentPreview(contentList[0]);
        }
    }
    
    // 渲染内容预览
    function renderContentPreview(item) {
        if (!item) {
            contentPreview.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">未选择内容</p></div>';
            return;
        }
        
        const div = document.createElement('div');
        div.innerHTML = `
            <h4 class="content-title">${item.title || '无标题'}</h4>
            <div class="content-body">
                ${item.format === 'html' || (item.content && item.content.includes('<')) ? 
                    item.content : 
                    `<pre>${item.content}</pre>`}
            </div>
        `;
        
        contentPreview.innerHTML = '';
        contentPreview.appendChild(div);
    }
    
    // 渲染分类列表
    function renderCategoryList(categories) {
        categoryList.innerHTML = '';
        
        const categoryIds = Object.keys(categories);
        
        if (categoryIds.length === 0) {
            categoryList.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">没有分类结果</p></div>';
            return;
        }
        
        categoryIds.forEach(catId => {
            const category = categories[catId];
            const div = document.createElement('div');
            div.className = 'list-group-item category-item';
            div.innerHTML = `
                <div class="category-title">分类 ${catId}</div>
                <div class="category-count">${category.items.length} 个页面</div>
            `;
            
            div.addEventListener('click', function() {
                // 移除所有active类
                document.querySelectorAll('.category-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                // 添加active类到当前项
                div.classList.add('active');
                
                // 设置选中分类并显示内容
                selectedCategoryId = catId;
                renderCategoryItems(category);
            });
            
            categoryList.appendChild(div);
        });
        
        // 默认选中第一项
        if (categoryIds.length > 0) {
            categoryList.firstChild.classList.add('active');
            selectedCategoryId = categoryIds[0];
            renderCategoryItems(categories[categoryIds[0]]);
        }
    }
    
    // 渲染分类内容
    function renderCategoryItems(category) {
        if (!category || !category.items) {
            categoryContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">无分类内容</p></div>';
            return;
        }
        
        const div = document.createElement('div');
        div.innerHTML = `
            <h4 class="mb-4">分类 ${category.id} (${category.items.length} 个页面)</h4>
            <div class="category-content">
                ${category.items.map(item => `
                    <div class="category-item-preview">
                        <h5>${item.title || '无标题'}</h5>
                        <div class="item-url">${item.url}</div>
                        <div>
                            ${(item.keywords || []).map(kw => `<span class="keyword">${kw}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        categoryContent.innerHTML = '';
        categoryContent.appendChild(div);
    }
    
    // 渲染统计信息
    function renderStatistics(stats) {
        if (!stats) {
            statisticsContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">无统计信息</p></div>';
            return;
        }
        
        const div = document.createElement('div');
        div.className = 'stats-container';
        div.innerHTML = `
            <div class="stats-card">
                <div class="stats-title">总体统计</div>
                <div class="stats-row">
                    <div class="stats-label">已爬取URL:</div>
                    <div class="stats-value">${stats.totalUrls || 0}</div>
                </div>
                <div class="stats-row">
                    <div class="stats-label">分类数:</div>
                    <div class="stats-value">${stats.categoriesCount || 0}</div>
                </div>
                <div class="stats-row">
                    <div class="stats-label">成功率:</div>
                    <div class="stats-value">${stats.successRate || 0}%</div>
                </div>
                <div class="stats-row">
                    <div class="stats-label">平均爬取时间:</div>
                    <div class="stats-value">${stats.avgCrawlTime || 0}秒</div>
                </div>
            </div>
            
            <div class="stats-card">
                <div class="stats-title">HTTP状态统计</div>
                ${Object.entries(stats.statusCounts || {}).map(([status, count]) => `
                    <div class="stats-row">
                        <div class="stats-label">${status}:</div>
                        <div class="stats-value">${count}</div>
                    </div>
                `).join('') || '<div class="text-muted">无状态码统计</div>'}
            </div>
            
            <div class="stats-card">
                <div class="stats-title">域名统计</div>
                ${Object.entries(stats.domainCounts || {}).map(([domain, count]) => `
                    <div class="stats-row">
                        <div class="stats-label">${domain}:</div>
                        <div class="stats-value">${count}</div>
                    </div>
                `).join('') || '<div class="text-muted">无域名统计</div>'}
            </div>
        `;
        
        statisticsContent.innerHTML = '';
        statisticsContent.appendChild(div);
    }
});