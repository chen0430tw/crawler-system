document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const generateBtn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');
    const clearBtn = document.getElementById('clearBtn');
    const uploadArea = document.getElementById('uploadArea');
    const browseBtn = document.getElementById('browseBtn');
    const resultFile = document.getElementById('resultFile');
    
    // 修改：分离URL输入框和URL结果列表的引用
    const urlInput = document.getElementById('urlInput'); // 配置面板中的URL输入文本区域
    const urlListElement = document.querySelector('#content .list-group'); // URL结果列表容器
    
    // 标签页引用
    const resultTabs = document.getElementById('resultTabs');
    
    // 内容展示区引用
    const contentPreview = document.getElementById('contentPreview');
    const categoryList = document.getElementById('categoryList');
    const categoryContent = document.getElementById('categoryContent');
    const statisticsContent = document.getElementById('statisticsContent');
    
    // 存储爬虫结果
    let crawlerResults = null;
    let selectedUrlIndex = null;
    let selectedCategoryId = null;
    
    // 创建模态框元素
    createImageModal();
    
    // 生成配置文件
    generateBtn.addEventListener('click', function() {
        const urlList = urlInput.value.split('\n')
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
        urlInput.value = '';
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
                console.log("开始解析JSON文件");
                const rawContent = e.target.result;
                console.log("文件内容预览:", rawContent.substring(0, 200) + "...");
                
                crawlerResults = JSON.parse(rawContent);
                console.log("解析成功，开始处理结果", crawlerResults);
                processResults(crawlerResults);
                
                // 自动切换到内容标签页
                const contentTab = document.getElementById('content-tab');
                contentTab.click();
            } catch (error) {
                console.error("解析JSON失败:", error);
                alert('无法解析结果文件: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    
    // 处理爬虫结果 - 修改版
    function processResults(results) {
        if (!results) {
            console.error("结果为空或格式不正确");
            return;
        }
        
        console.log("处理爬虫结果:", results);  // 添加调试输出
        
        // 处理URL列表
        if (results.content && Array.isArray(results.content)) {
            console.log("发现内容数组，长度:", results.content.length);
            renderUrlList(results.content);
        } else {
            console.error("内容数组不存在或格式错误:", results.content);
            if (urlListElement) {
                urlListElement.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">结果文件格式错误：未找到内容数组</p></div>';
            }
        }
        
        // 处理分类结果 - 修改部分，确保所有分类都被处理
        if (results.categories) {
            console.log("发现分类信息, 键数量:", Object.keys(results.categories).length);
            // 打印详细的分类信息以便调试
            Object.keys(results.categories).forEach(key => {
                const category = results.categories[key];
                console.log(`分类 ${key} 包含项目数量:`, category.items ? category.items.length : 0);
            });
            renderCategoryList(results.categories);
        } else {
            console.error("分类信息不存在或格式错误");
            if (categoryList) {
                categoryList.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">未找到分类信息</p></div>';
            }
        }
        
        // 处理统计信息
        if (results.statistics) {
            console.log("发现统计信息");
            renderStatistics(results.statistics);
        } else {
            console.error("统计信息不存在或格式错误");
            if (statisticsContent) {
                statisticsContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">未找到统计信息</p></div>';
            }
        }
    }
    
    // 渲染URL列表
    function renderUrlList(contentList) {
        if (!urlListElement) {
            console.error("URL列表元素未找到!");
            return;
        }
        
        console.log("渲染URL列表到元素:", urlListElement.tagName, urlListElement.id, urlListElement.className);
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
            if (urlListElement.firstChild) {
                urlListElement.firstChild.classList.add('active');
                selectedUrlIndex = 0;
                renderContentPreview(contentList[0]);
            }
        }
    }
    
    // 渲染内容预览
    function renderContentPreview(item) {
        if (!contentPreview) {
            console.error("内容预览元素未找到!");
            return;
        }
        
        if (!item) {
            contentPreview.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">未选择内容</p></div>';
            return;
        }
        
        console.log("渲染内容:", item.title, "内容长度:", item.content ? item.content.length : 0);
        
        const div = document.createElement('div');
        div.innerHTML = `
            <h4 class="content-title">${item.title || '无标题'}</h4>
            <div class="content-info">
                <div class="url-info">URL: <a href="${item.url}" target="_blank">${item.url}</a></div>
                <div class="status-info">状态: ${item.status || '未知'}</div>
            </div>
            <div class="content-body">
                ${item.content && item.content.includes('<') ? 
                    // HTML内容
                    item.content : 
                    // 纯文本内容或空内容
                    (item.content ? `<pre>${item.content}</pre>` : '<div class="text-muted">内容为空</div>')}
            </div>
        `;
        
        contentPreview.innerHTML = '';
        contentPreview.appendChild(div);
        
        // 内容渲染后设置图片点击事件
        setTimeout(setupImageClickHandlers, 100);
    }
    
    // 渲染分类列表 - 修改版
    function renderCategoryList(categories) {
        if (!categoryList) {
            console.error("分类列表元素未找到!");
            return;
        }
        
        categoryList.innerHTML = '';
        
        const categoryIds = Object.keys(categories);
        console.log("待渲染的分类IDs:", categoryIds);
        
        if (categoryIds.length === 0) {
            categoryList.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">没有分类结果</p></div>';
            return;
        }
        
        categoryIds.forEach(catId => {
            const category = categories[catId];
            console.log(`正在渲染分类 ${catId}, 项目数量:`, category.items ? category.items.length : 0);
            
            const div = document.createElement('div');
            div.className = 'list-group-item category-item';
            div.innerHTML = `
                <div class="category-title">分类 ${catId}</div>
                <div class="category-count">${category.items ? category.items.length : 0} 个页面</div>
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
            if (categoryList.firstChild) {
                categoryList.firstChild.classList.add('active');
                selectedCategoryId = categoryIds[0];
                renderCategoryItems(categories[categoryIds[0]]);
            }
        }
    }
    
    // 渲染分类内容 - 修改版
    function renderCategoryItems(category) {
        if (!categoryContent) {
            console.error("分类内容元素未找到!");
            return;
        }
        
        if (!category || !category.items) {
            categoryContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">无分类内容</p></div>';
            return;
        }
        
        console.log(`渲染分类 ${category.id} 的内容, 包含 ${category.items.length} 个项目`);
        
        const div = document.createElement('div');
        div.innerHTML = `
            <h4 class="mb-4">分类 ${category.id} (${category.items.length} 个页面)</h4>
            <div class="category-content">
                ${category.items.map(item => `
                    <div class="category-item-preview">
                        <h5>${item.title || '无标题'}</h5>
                        <div class="item-url">${item.url}</div>
                        <div>
                            ${(item.keywords && item.keywords.length > 0) ? 
                                item.keywords.map(kw => `<span class="keyword">${kw}</span>`).join('') : 
                                '<span class="text-muted">无关键词</span>'}
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
        if (!statisticsContent) {
            console.error("统计内容元素未找到!");
            return;
        }
        
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
    
    // 添加启动时的调试信息
    console.log("DOM已加载完成");
    console.log("URL输入框元素:", urlInput ? urlInput.tagName : "未找到");
    console.log("URL列表元素:", urlListElement ? urlListElement.tagName : "未找到");
    console.log("分类列表元素:", categoryList ? categoryList.tagName : "未找到");
    console.log("分类内容元素:", categoryContent ? categoryContent.tagName : "未找到");
});

// 创建模态框元素
function createImageModal() {
    // 检查是否已存在模态框
    if (document.getElementById('imageModal')) return;
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.className = 'image-modal';
    
    // 创建图片容器
    const modalImg = document.createElement('img');
    modalImg.id = 'modalImage';
    modalImg.className = 'image-modal-content';
    modal.appendChild(modalImg);
    
    // 点击模态框关闭
    modal.addEventListener('click', function() {
        modal.classList.remove('show');
    });
    
    // 添加到页面
    document.body.appendChild(modal);
    
    return {modal, modalImg};
}

// 设置图片点击事件 - 在渲染内容预览后调用
function setupImageClickHandlers() {
    console.log("设置图片点击事件处理");
    
    // 确保模态框存在
    if (!document.getElementById('imageModal')) {
        createImageModal();
    }
    
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    // 获取所有内容区域内的图片
    const images = document.querySelectorAll('.content-body img');
    console.log(`找到 ${images.length} 张图片`);
    
    // 为每个图片添加点击事件
    images.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log("图片被点击:", this.src);
            
            // 设置模态框图片源
            modalImg.src = this.src;
            
            // 显示模态框
            modal.classList.add('show');
        });
    });
}