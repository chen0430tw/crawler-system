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
        
        // 确保阴谋论标签页存在
        addConspiracyTab();
        
        // 处理URL列表
        if (results.content && Array.isArray(results.content)) {
            console.log("发现内容数组，长度:", results.content.length);
            renderUrlList(results.content);
            
            // 处理阴谋论检测内容
            renderConspiracyList(results.content);
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
    
    // 修改渲染内容预览函数，添加阴谋论检测信息展示
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
        console.log("阴谋论检测信息:", item.urban_legend);
        
        // 构建阴谋论检测信息HTML
        let urbanLegendHtml = '';
        if (item.urban_legend) {
            const legend = item.urban_legend;
            let statusClass = '';
            let statusIcon = '';
            
            // 根据检测结果设置不同的样式
            if (legend.label.includes('已确认')) {
                statusClass = 'conspiracy-confirmed';
                statusIcon = '<i class="bi bi-exclamation-triangle-fill"></i>';
            } else if (legend.label.includes('疑似')) {
                statusClass = 'conspiracy-suspect';
                statusIcon = '<i class="bi bi-question-circle-fill"></i>';
            } else {
                statusClass = 'conspiracy-normal';
                statusIcon = '<i class="bi bi-check-circle-fill"></i>';
            }
            
            urbanLegendHtml = `
                <div class="urban-legend-info ${statusClass}">
                    <div class="urban-legend-header">
                        ${statusIcon} ${legend.label}
                    </div>
                    <div class="urban-legend-details">
                        <div class="details-row">
                            <span class="details-label">分析时间:</span>
                            <span class="details-value">${legend.analysis_time || '未知'}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">J值 (原始):</span>
                            <span class="details-value">${legend.details ? legend.details.J_raw.toFixed(4) : '未知'}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">J值 (SEO):</span>
                            <span class="details-value">${legend.details ? legend.details.J_SEO.toFixed(4) : '未知'}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">滞后时间:</span>
                            <span class="details-value">${legend.details ? legend.details.lag_time.toFixed(2) : '未知'} 秒</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">θ峰值数量:</span>
                            <span class="details-value">${legend.details ? legend.details.num_peaks_theta : '未知'}</span>
                        </div>
                    </div>
                    <div class="urban-legend-thresholds">
                        <div class="threshold-title">判定阈值:</div>
                        <div class="threshold-row">
                            <span class="threshold-label">已确认阈值:</span>
                            <span class="threshold-value">${legend.details && legend.details.thresholds ? legend.details.thresholds.confirmed_J : '未知'}</span>
                        </div>
                        <div class="threshold-row">
                            <span class="threshold-label">疑似阈值:</span>
                            <span class="threshold-value">${legend.details && legend.details.thresholds ? legend.details.thresholds.suspect_J : '未知'}</span>
                        </div>
                        <div class="threshold-row">
                            <span class="threshold-label">滞后阈值:</span>
                            <span class="threshold-value">${legend.details && legend.details.thresholds ? legend.details.thresholds.lag : '未知'}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            urbanLegendHtml = '<div class="urban-legend-none">无阴谋论检测信息</div>';
        }
        
        const div = document.createElement('div');
        div.innerHTML = `
            <h4 class="content-title">${item.title || '无标题'}</h4>
            <div class="content-info">
                <div class="url-info">URL: <a href="${item.url}" target="_blank">${item.url}</a></div>
                <div class="status-info">状态: ${item.status || '未知'}</div>
            </div>
            
            ${urbanLegendHtml}
            
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
    
    // 修改处理爬虫结果的统计信息部分，添加阴谋论统计
    function renderStatistics(stats) {
        if (!statisticsContent) {
            console.error("统计内容元素未找到!");
            return;
        }
        
        if (!stats) {
            statisticsContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">无统计信息</p></div>';
            return;
        }
        
        // 构建阴谋论统计HTML
        let urbanLegendStatsHtml = '';
        if (stats.urban_legend) {
            urbanLegendStatsHtml = `
                <div class="stats-card">
                    <div class="stats-title">阴谋论检测统计</div>
                    <div class="stats-row">
                        <div class="stats-label">已确认阴谋论:</div>
                        <div class="stats-value conspiracy-confirmed-text">${stats.urban_legend.confirmed_count || 0}</div>
                    </div>
                    <div class="stats-row">
                        <div class="stats-label">疑似阴谋论:</div>
                        <div class="stats-value conspiracy-suspect-text">${stats.urban_legend.suspect_count || 0}</div>
                    </div>
                    <div class="stats-row">
                        <div class="stats-label">正常内容:</div>
                        <div class="stats-value conspiracy-normal-text">${stats.urban_legend.normal_count || 0}</div>
                    </div>
                    <div class="stats-row">
                        <div class="stats-label">检测失败:</div>
                        <div class="stats-value">${stats.urban_legend.failed_count || 0}</div>
                    </div>
                    <div class="stats-row conspiracy-percentage">
                        <div class="stats-label">阴谋论比例:</div>
                        <div class="stats-value">${((stats.urban_legend.confirmed_count + stats.urban_legend.suspect_count) / stats.totalUrls * 100).toFixed(2)}%</div>
                    </div>
                </div>
            `;
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
            
            ${urbanLegendStatsHtml}
            
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
        
        // 添加阴谋论统计图表
        if (stats.urban_legend) {
            setTimeout(() => {
                renderConspiracyChart(stats.urban_legend);
            }, 100);
        }
    }
    
    // 添加阴谋论统计图表
    function renderConspiracyChart(urbanLegendStats) {
        // 先检查是否已存在图表容器，如果存在则移除
        const existingChart = document.getElementById('conspiracyChartContainer');
        if (existingChart) {
            existingChart.remove();
        }
        
        // 创建图表容器
        const chartContainer = document.createElement('div');
        chartContainer.className = 'stats-card';
        chartContainer.id = 'conspiracyChartContainer'; // 添加ID以便后续检查
        chartContainer.innerHTML = `
            <div class="stats-title">阴谋论检测分布</div>
            <div style="height: 300px; position: relative;">
                <canvas id="conspiracyChart"></canvas>
            </div>
        `;
        
        statisticsContent.appendChild(chartContainer);
        
        // 使用Chart.js绘制饼图
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('conspiracyChart').getContext('2d');
            
            // 检查是否已存在Chart实例，如果存在则销毁
            if (window.conspiracyPieChart instanceof Chart) {
                window.conspiracyPieChart.destroy();
            }
            
            window.conspiracyPieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['已确认阴谋论', '疑似阴谋论', '正常内容', '检测失败'],
                    datasets: [{
                        data: [
                            urbanLegendStats.confirmed_count || 0,
                            urbanLegendStats.suspect_count || 0,
                            urbanLegendStats.normal_count || 0,
                            urbanLegendStats.failed_count || 0
                        ],
                        backgroundColor: [
                            '#dc3545', // 红色 - 已确认
                            '#ffc107', // 黄色 - 疑似
                            '#28a745', // 绿色 - 正常
                            '#6c757d'  // 灰色 - 失败
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        } else {
            console.error("Chart.js 未找到，无法绘制图表");
            document.getElementById('conspiracyChartContainer').innerHTML = '<div class="text-muted">需要Chart.js支持才能显示图表</div>';
        }
    }
    
    // 添加阴谋论标签页
    function addConspiracyTab() {
        // 检查是否已存在该标签页
        if (document.getElementById('conspiracy-tab')) return;
        
        // 创建标签页导航项
        const tabItem = document.createElement('li');
        tabItem.className = 'nav-item';
        tabItem.innerHTML = `<a class="nav-link" id="conspiracy-tab" data-bs-toggle="tab" href="#conspiracy">阴谋论检测</a>`;
        
        // 添加到标签页导航
        const resultTabs = document.getElementById('resultTabs');
        if (resultTabs) {
            // 插入到统计标签页之前
            const statsTab = document.getElementById('stats-tab');
            const statsTabParent = statsTab.parentNode;
            statsTabParent.insertBefore(tabItem, statsTab);
        }
        
        // 创建标签页内容区域
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-pane fade';
        tabContent.id = 'conspiracy';
        tabContent.innerHTML = `
            <div class="row">
                <div class="col-md-3">
                    <div class="list-group" id="conspiracyList">
                        <div class="empty-message text-center py-5">
                            <p class="text-muted">请先上传爬虫结果文件</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-9">
                    <div id="conspiracyContent">
                        <div class="empty-message text-center py-5">
                            <p class="text-muted">选择左侧项目查看检测结果</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到标签页内容区
        const tabContainer = document.querySelector('.tab-content');
        if (tabContainer) {
            const statsPane = document.getElementById('stats');
            tabContainer.insertBefore(tabContent, statsPane);
        }
    }
    
    // 渲染阴谋论检测列表
    function renderConspiracyList(contentList) {
        const conspiracyList = document.getElementById('conspiracyList');
        if (!conspiracyList) {
            console.error("阴谋论列表元素未找到!");
            return;
        }
        
        conspiracyList.innerHTML = '';
        
        if (contentList.length === 0) {
            conspiracyList.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">没有检测内容</p></div>';
            return;
        }
        
        // 过滤有阴谋论检测信息的内容并分类
        const confirmedList = [];
        const suspectList = [];
        const normalList = [];
        
        contentList.forEach((item, index) => {
            if (item.urban_legend) {
                const label = item.urban_legend.label;
                if (label.includes('已确认')) {
                    confirmedList.push({item, index});
                } else if (label.includes('疑似')) {
                    suspectList.push({item, index});
                } else {
                    normalList.push({item, index});
                }
            }
        });
        
        // 添加分组标题：已确认阴谋论
        if (confirmedList.length > 0) {
            const confirmedHeader = document.createElement('div');
            confirmedHeader.className = 'list-group-item conspiracy-group-header conspiracy-confirmed';
            confirmedHeader.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> 已确认阴谋论 (${confirmedList.length})`;
            conspiracyList.appendChild(confirmedHeader);
            
            // 添加已确认阴谋论项目
            confirmedList.forEach(({item, index}) => {
                addConspiracyListItem(conspiracyList, item, index, 'conspiracy-confirmed');
            });
        }
        
        // 添加分组标题：疑似阴谋论
        if (suspectList.length > 0) {
            const suspectHeader = document.createElement('div');
            suspectHeader.className = 'list-group-item conspiracy-group-header conspiracy-suspect';
            suspectHeader.innerHTML = `<i class="bi bi-question-circle-fill"></i> 疑似阴谋论 (${suspectList.length})`;
            conspiracyList.appendChild(suspectHeader);
            
            // 添加疑似阴谋论项目
            suspectList.forEach(({item, index}) => {
                addConspiracyListItem(conspiracyList, item, index, 'conspiracy-suspect');
            });
        }
        
        // 添加分组标题：正常内容
        if (normalList.length > 0) {
            const normalHeader = document.createElement('div');
            normalHeader.className = 'list-group-item conspiracy-group-header conspiracy-normal';
            normalHeader.innerHTML = `<i class="bi bi-check-circle-fill"></i> 正常内容 (${normalList.length})`;
            conspiracyList.appendChild(normalHeader);
            
            // 添加正常内容项目
            normalList.forEach(({item, index}) => {
                addConspiracyListItem(conspiracyList, item, index, 'conspiracy-normal');
            });
        }
        
        // 如果没有任何检测结果
        if (confirmedList.length === 0 && suspectList.length === 0 && normalList.length === 0) {
            conspiracyList.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">没有阴谋论检测结果</p></div>';
        }
    }
    
    // 添加阴谋论列表项
    function addConspiracyListItem(container, item, index, className) {
        const div = document.createElement('div');
        div.className = `list-group-item conspiracy-item ${className}`;
        div.dataset.index = index;
        
        div.innerHTML = `
            <div class="conspiracy-item-title">${item.title || '无标题'}</div>
            <div class="conspiracy-item-url">${item.url}</div>
            <div class="conspiracy-item-score">
                J值: ${item.urban_legend.details ? item.urban_legend.details.J_raw.toFixed(4) : 'N/A'}
            </div>
        `;
        
        div.addEventListener('click', function() {
            // 移除所有active类
            document.querySelectorAll('.conspiracy-item').forEach(el => {
                el.classList.remove('active');
            });
            
            // 添加active类到当前项
            div.classList.add('active');
            
            // 显示详细检测结果
            renderConspiracyDetail(item);
        });
        
        container.appendChild(div);
    }
    
    // 渲染阴谋论详细信息
    function renderConspiracyDetail(item) {
        const conspiracyContent = document.getElementById('conspiracyContent');
        if (!conspiracyContent) {
            console.error("阴谋论详情元素未找到!");
            return;
        }
        
        if (!item || !item.urban_legend) {
            conspiracyContent.innerHTML = '<div class="empty-message text-center py-5"><p class="text-muted">无检测信息</p></div>';
            return;
        }
        
        const legend = item.urban_legend;
        let statusClass = '';
        let statusText = '';
        
        // 根据检测结果设置不同的样式和文本
        if (legend.label.includes('已确认')) {
            statusClass = 'conspiracy-confirmed';
            statusText = '已确认阴谋论';
        } else if (legend.label.includes('疑似')) {
            statusClass = 'conspiracy-suspect';
            statusText = '疑似阴谋论';
        } else {
            statusClass = 'conspiracy-normal';
            statusText = '正常内容';
        }
        
        // 创建详情HTML
        const div = document.createElement('div');
        div.className = 'conspiracy-detail';
        div.innerHTML = `
            <div class="conspiracy-detail-header ${statusClass}">
                <h4>${statusText}</h4>
                <div class="conspiracy-detail-title">${item.title || '无标题'}</div>
                <div class="conspiracy-detail-url">
                    <a href="${item.url}" target="_blank">${item.url}</a>
                </div>
            </div>
            
            <div class="conspiracy-detail-body">
                <div class="conspiracy-metrics">
                    <h5>检测指标</h5>
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <div class="metric-label">J值 (原始)</div>
                            <div class="metric-value ${getValueClass(legend.details.J_raw, legend.details.thresholds.confirmed_J, legend.details.thresholds.suspect_J)}">
                                ${legend.details.J_raw.toFixed(4)}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">J值 (SEO)</div>
                            <div class="metric-value">
                                ${legend.details.J_SEO.toFixed(4)}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">滞后时间</div>
                            <div class="metric-value ${legend.details.lag_time > legend.details.thresholds.lag ? 'value-warning' : ''}">
                                ${legend.details.lag_time.toFixed(2)} 秒
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">θ峰值数量</div>
                            <div class="metric-value">
                                ${legend.details.num_peaks_theta}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">θ最大值</div>
                            <div class="metric-value">
                                ${legend.details.theta_max.toFixed(4)}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">y最大值</div>
                            <div class="metric-value">
                                ${legend.details.y_max.toFixed(4)}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">SEO因子</div>
                            <div class="metric-value">
                                ${legend.details.seo_factor.toFixed(2)}
                            </div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">内容长度</div>
                            <div class="metric-value">
                                ${legend.details.content_length} 字符
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="conspiracy-thresholds">
                    <h5>判定阈值</h5>
                    <div class="thresholds-grid">
                        <div class="threshold-item">
                            <div class="threshold-label">已确认阈值 (J)</div>
                            <div class="threshold-value">${legend.details.thresholds.confirmed_J}</div>
                        </div>
                        <div class="threshold-item">
                            <div class="threshold-label">疑似阈值 (J)</div>
                            <div class="threshold-value">${legend.details.thresholds.suspect_J}</div>
                        </div>
                        <div class="threshold-item">
                            <div class="threshold-label">滞后阈值</div>
                            <div class="threshold-value">${legend.details.thresholds.lag} 秒</div>
                        </div>
                        <div class="threshold-item">
                            <div class="threshold-label">关键词分数阈值</div>
                            <div class="threshold-value">${legend.details.thresholds.keyword_score}</div>
                        </div>
                        <div class="threshold-item">
                            <div class="threshold-label">可信度分数阈值</div>
                            <div class="threshold-value">${legend.details.thresholds.credibility_score}</div>
                        </div>
                    </div>
                </div>
                
                <div class="conspiracy-keywords">
                    <h5>关键词分析</h5>
                    <div class="keyword-stats">
                        <div class="keyword-stat-item">
                            <div class="keyword-stat-label">关键词分数</div>
                            <div class="keyword-stat-value">${legend.details.keyword_score}</div>
                        </div>
                        <div class="keyword-stat-item">
                            <div class="keyword-stat-label">关键词数量</div>
                            <div class="keyword-stat-value">${legend.details.keyword_count}</div>
                        </div>
                    </div>
                    <div class="keyword-list">
                        ${legend.details.matched_keywords && legend.details.matched_keywords.length > 0 ? 
                            legend.details.matched_keywords.map(kw => `<span class="keyword">${kw}</span>`).join('') : 
                            '<span class="text-muted">无匹配关键词</span>'}
                    </div>
                </div>
                
                <div class="conspiracy-analysis-info">
                    <div class="analysis-time">分析时间: ${legend.analysis_time}</div>
                    <div class="analysis-url">分析URL: ${legend.url}</div>
                </div>
            </div>
        `;
        
        conspiracyContent.innerHTML = '';
        conspiracyContent.appendChild(div);
        
        // 添加检测图表
        setTimeout(() => {
            renderConspiracyDetailChart(legend.details, conspiracyContent);
        }, 100);
    }
    
    // 获取值的样式类
    function getValueClass(value, confirmedThreshold, suspectThreshold) {
        if (value >= confirmedThreshold) return 'value-danger';
        if (value >= suspectThreshold) return 'value-warning';
        return 'value-normal';
    }
    
    // 渲染阴谋论检测详情图表
    function renderConspiracyDetailChart(details, container) {
        if (!details) return;
        
        // 检查是否已存在图表容器，如果存在则移除
        const existingChart = document.getElementById('conspiracyDetailChartContainer');
        if (existingChart) {
            existingChart.remove();
        }
        
        // 创建图表容器
        const chartDiv = document.createElement('div');
        chartDiv.className = 'conspiracy-chart-container';
        chartDiv.id = 'conspiracyDetailChartContainer'; // 添加ID以便后续检查
        chartDiv.innerHTML = `
            <h5>检测指标可视化</h5>
            <canvas id="conspiracyDetailChart"></canvas>
        `;
        
        container.appendChild(chartDiv);
        
        // 使用Chart.js绘制雷达图
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('conspiracyDetailChart').getContext('2d');
            
            // 检查是否已存在Chart实例，如果存在则销毁
            if (window.conspiracyRadarChart instanceof Chart) {
                window.conspiracyRadarChart.destroy();
            }
            
            window.conspiracyRadarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['J值 (原始)', 'J值 (SEO)', '滞后时间', 'θ峰值数量', 'θ最大值', 'y最大值'],
                    datasets: [{
                        label: '当前值',
                        data: [
                            details.J_raw,
                            details.J_SEO,
                            details.lag_time,
                            details.num_peaks_theta,
                            details.theta_max,
                            details.y_max
                        ],
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgb(54, 162, 235)',
                        pointBackgroundColor: 'rgb(54, 162, 235)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(54, 162, 235)'
                    }, {
                        label: '阈值标准',
                        data: [
                            details.thresholds.confirmed_J,
                            details.thresholds.confirmed_J * 3.5, // SEO阈值估算
                            details.thresholds.lag,
                            25, // 峰值数量参考值
                            2.2, // θ最大值参考值
                            1.5  // y最大值参考值
                        ],
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgb(255, 99, 132)',
                        pointBackgroundColor: 'rgb(255, 99, 132)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(255, 99, 132)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
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