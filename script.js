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
    
    // 添加运行按钮引用
    const runBtn = document.getElementById('runBtn');
    
    // 标签页引用
    const resultTabs = document.getElementById('resultTabs');
    
    // 内容展示区引用
    const contentPreview = document.getElementById('contentPreview');
    const categoryList = document.getElementById('categoryList');
    const categoryContent = document.getElementById('categoryContent');
    const statisticsContent = document.getElementById('statisticsContent');
    
    // 添加任务列表引用
    const taskListContainer = document.getElementById('taskList');
    
    // 存储爬虫结果
    let crawlerResults = null;
    let selectedUrlIndex = null;
    let selectedCategoryId = null;
    
    // 添加当前任务ID和状态轮询计时器
    let currentTaskId = null;
    let statusPollInterval = null;
    
    // 创建模态框元素
    createImageModal();
    createTaskModal();
    
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
            enable_urban_legend: true,
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
    
    // 运行爬虫任务（直接运行而非下载配置）
    if (runBtn) {
        runBtn.addEventListener('click', function() {
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
                enable_urban_legend: true,
                timestamp: new Date().toISOString()
            };
            
            // 显示提交中提示
            Swal.fire({
                title: '提交任务中',
                text: '正在提交爬虫任务，请稍候...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // 提交任务
            ApiClient.submitTask(config)
                .then(response => {
                    Swal.close();
                    
                    // 保存当前任务ID
                    currentTaskId = response.task_id;
                    
                    // 显示任务已提交提示
                    Swal.fire({
                        icon: 'success',
                        title: '任务已提交',
                        text: `任务ID: ${currentTaskId}`,
                        confirmButtonText: '查看任务状态'
                    }).then(() => {
                        // 切换到任务列表标签页
                        document.getElementById('tasks-tab').click();
                        
                        // 开始轮询任务状态
                        startPollingTaskStatus(currentTaskId);
                        
                        // 刷新任务列表
                        refreshTaskList();
                    });
                })
                .catch(error => {
                    Swal.fire({
                        icon: 'error',
                        title: '提交失败',
                        text: error.message || '提交任务时发生错误'
                    });
                });
        });
    }
    
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
    
    // 开始轮询任务状态
    function startPollingTaskStatus(taskId) {
        // 先清除现有的轮询计时器
        if (statusPollInterval) {
            clearInterval(statusPollInterval);
        }
        
        // 立即获取一次状态
        getTaskStatus(taskId);
        
        // 设置轮询计时器
        statusPollInterval = setInterval(() => {
            getTaskStatus(taskId);
        }, 3000); // 每3秒轮询一次
    }
    
    // 停止轮询任务状态
    function stopPollingTaskStatus() {
        if (statusPollInterval) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
        }
    }
    
    // 获取任务状态
    function getTaskStatus(taskId) {
        ApiClient.getTaskStatus(taskId)
            .then(response => {
                // 更新任务列表中的任务状态
                updateTaskInList(response);
                
                // 如果任务已完成或失败，停止轮询
                if (response.status === '已完成' || response.status === '失败') {
                    stopPollingTaskStatus();
                    
                    // 如果任务完成，提示可以查看结果
                    if (response.status === '已完成') {
                        // 只在第一次发现任务完成时显示提示
                        if (currentTaskId === taskId) {
                            Swal.fire({
                                icon: 'success',
                                title: '任务完成',
                                text: '爬虫任务已完成，可以查看结果',
                                confirmButtonText: '查看结果'
                            }).then(() => {
                                loadTaskResult(taskId);
                            });
                            
                            // 清除当前任务ID，避免重复提示
                            currentTaskId = null;
                        }
                    }
                }
            })
            .catch(error => {
                console.error('获取任务状态失败:', error);
            });
    }
    
    // 加载任务结果
    function loadTaskResult(taskId) {
        Swal.fire({
            title: '加载结果中',
            text: '正在加载爬虫结果，请稍候...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        ApiClient.getTaskResult(taskId)
            .then(result => {
                Swal.close();
                
                // 保存结果
                crawlerResults = result;
                
                // 处理结果
                processResults(result);
                
                // 切换到内容标签页
                document.getElementById('content-tab').click();
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: '加载失败',
                    text: error.message || '加载任务结果时发生错误'
                });
            });
    }
    
    // 刷新任务列表
    function refreshTaskList() {
        // 显示加载指示器
        if (taskListContainer) {
            taskListContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"><span class="visually-hidden">加载中...</span></div><p class="mt-2">获取任务列表中...</p></div>';
        }
        
        ApiClient.getTasks()
            .then(tasks => {
                renderTaskList(tasks);
            })
            .catch(error => {
                if (taskListContainer) {
                    taskListContainer.innerHTML = `<div class="alert alert-danger" role="alert">获取任务列表失败: ${error.message}</div>`;
                }
                console.error('获取任务列表失败:', error);
            });
    }
    
    // 渲染任务列表
    function renderTaskList(tasks) {
        if (!taskListContainer) {
            console.error("任务列表容器未找到!");
            return;
        }
        
        if (tasks.length === 0) {
            taskListContainer.innerHTML = '<div class="text-center py-5"><p class="text-muted">暂无任务</p></div>';
            return;
        }
        
        let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>' +
            '<th>任务ID</th>' +
            '<th>状态</th>' +
            '<th>进度</th>' +
            '<th>创建时间</th>' +
            '<th>完成时间</th>' +
            '<th>操作</th>' +
            '</tr></thead><tbody>';
        
        tasks.forEach(task => {
            const taskId = task.id;
            const shortId = taskId.substring(0, 8) + '...'; // 显示缩短的任务ID
            
            // 根据状态设置不同的样式
            let statusClass = '';
            let progressHtml = '';
            
            switch (task.status) {
                case '运行中':
                    statusClass = 'text-primary';
                    progressHtml = `<div class="progress" style="height: 20px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                            role="progressbar" style="width: ${task.progress}%;" 
                            aria-valuenow="${task.progress}" aria-valuemin="0" aria-valuemax="100">
                            ${task.progress}%
                        </div>
                    </div>`;
                    break;
                case '已完成':
                    statusClass = 'text-success';
                    progressHtml = `<div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-success" 
                            role="progressbar" style="width: 100%;" 
                            aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                            100%
                        </div>
                    </div>`;
                    break;
                case '失败':
                    statusClass = 'text-danger';
                    progressHtml = '<span class="badge bg-danger">失败</span>';
                    break;
                case '等待中':
                    statusClass = 'text-warning';
                    progressHtml = '<span class="badge bg-warning">等待中</span>';
                    break;
                default:
                    progressHtml = `<span>${task.progress}%</span>`;
            }
            
            // 创建时间和完成时间格式化
            const createdAt = new Date(task.created_at).toLocaleString();
            const endTime = task.end_time ? new Date(task.end_time).toLocaleString() : '-';
            
            // 操作按钮
            let actionButtons = '';
            
            if (task.status === '已完成') {
                actionButtons = `
                    <button class="btn btn-sm btn-primary view-result-btn" data-task-id="${taskId}">查看结果</button>
                    <a href="${ApiClient.getDownloadLink(taskId)}" class="btn btn-sm btn-success">下载结果</a>
                `;
            } else if (task.status === '等待中') {
                actionButtons = `<button class="btn btn-sm btn-danger cancel-task-btn" data-task-id="${taskId}">取消任务</button>`;
            } else if (task.status === '失败') {
                actionButtons = `<button class="btn btn-sm btn-info task-error-btn" data-task-id="${taskId}">查看错误</button>`;
            } else {
                actionButtons = `<button class="btn btn-sm btn-info task-details-btn" data-task-id="${taskId}">查看详情</button>`;
            }
            
            html += `<tr id="task-row-${taskId}">
                <td title="${taskId}">${shortId}</td>
                <td class="${statusClass}">${task.status}</td>
                <td>${progressHtml}</td>
                <td>${createdAt}</td>
                <td>${endTime}</td>
                <td>${actionButtons}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        
        // 添加刷新按钮
        html += '<div class="text-center mt-3">' +
            '<button id="refresh-tasks-btn" class="btn btn-outline-secondary">' +
            '<i class="bi bi-arrow-clockwise"></i> 刷新列表' +
            '</button></div>';
        
        taskListContainer.innerHTML = html;
        
        // 为操作按钮添加事件监听
        document.querySelectorAll('.view-result-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const taskId = this.getAttribute('data-task-id');
                loadTaskResult(taskId);
            });
        });
        
        document.querySelectorAll('.cancel-task-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const taskId = this.getAttribute('data-task-id');
                cancelTask(taskId);
            });
        });
        
        document.querySelectorAll('.task-error-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const taskId = this.getAttribute('data-task-id');
                showTaskError(taskId);
            });
        });
        
        document.querySelectorAll('.task-details-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const taskId = this.getAttribute('data-task-id');
                showTaskDetails(taskId);
            });
        });
        
        // 为刷新按钮添加事件监听
        const refreshBtn = document.getElementById('refresh-tasks-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshTaskList);
        }
    }
    
    // 更新任务列表中的任务状态
    function updateTaskInList(task) {
        const taskRow = document.getElementById(`task-row-${task.id}`);
        if (!taskRow) return;
        
        // 更新状态单元格
        const statusCell = taskRow.querySelector('td:nth-child(2)');
        if (statusCell) {
            // 清除原有样式类
            statusCell.className = '';
            
            // 根据状态设置样式
            switch (task.status) {
                case '运行中':
                    statusCell.classList.add('text-primary');
                    break;
                case '已完成':
                    statusCell.classList.add('text-success');
                    break;
                case '失败':
                    statusCell.classList.add('text-danger');
                    break;
                case '等待中':
                    statusCell.classList.add('text-warning');
                    break;
            }
            
            statusCell.textContent = task.status;
        }
        
        // 更新进度单元格
        const progressCell = taskRow.querySelector('td:nth-child(3)');
        if (progressCell) {
            let progressHtml = '';
            
            switch (task.status) {
                case '运行中':
                    progressHtml = `<div class="progress" style="height: 20px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                            role="progressbar" style="width: ${task.progress}%;" 
                            aria-valuenow="${task.progress}" aria-valuemin="0" aria-valuemax="100">
                            ${task.progress}%
                        </div>
                    </div>`;
                    break;
                case '已完成':
                    progressHtml = `<div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-success" 
                            role="progressbar" style="width: 100%;" 
                            aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                            100%
                        </div>
                    </div>`;
                    break;
                case '失败':
                    progressHtml = '<span class="badge bg-danger">失败</span>';
                    break;
                case '等待中':
                    progressHtml = '<span class="badge bg-warning">等待中</span>';
                    break;
                default:
                    progressHtml = `<span>${task.progress}%</span>`;
            }
            
            progressCell.innerHTML = progressHtml;
        }
        
        // 更新完成时间
        const endTimeCell = taskRow.querySelector('td:nth-child(5)');
        if (endTimeCell && task.end_time) {
            endTimeCell.textContent = new Date(task.end_time).toLocaleString();
        }
        
        // 更新操作按钮
        const actionCell = taskRow.querySelector('td:nth-child(6)');
        if (actionCell) {
            let actionButtons = '';
            
            if (task.status === '已完成') {
                actionButtons = `
                    <button class="btn btn-sm btn-primary view-result-btn" data-task-id="${task.id}">查看结果</button>
                    <a href="${ApiClient.getDownloadLink(task.id)}" class="btn btn-sm btn-success">下载结果</a>
                `;
                
                actionCell.innerHTML = actionButtons;
                
                // 为新添加的按钮绑定事件
                actionCell.querySelector('.view-result-btn').addEventListener('click', function() {
                    loadTaskResult(task.id);
                });
            } else if (task.status === '失败' && actionCell.querySelector('.task-error-btn') === null) {
                actionButtons = `<button class="btn btn-sm btn-info task-error-btn" data-task-id="${task.id}">查看错误</button>`;
                
                actionCell.innerHTML = actionButtons;
                
                // 为新添加的按钮绑定事件
                actionCell.querySelector('.task-error-btn').addEventListener('click', function() {
                    showTaskError(task.id);
                });
            }
        }
    }
    
    // 取消任务
    function cancelTask(taskId) {
        Swal.fire({
            title: '确认取消',
            text: '确定要取消这个任务吗？',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '确定',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                ApiClient.cancelTask(taskId)
                    .then(response => {
                        Swal.fire({
                            icon: 'success',
                            title: '已取消',
                            text: response.message || '任务已取消'
                        });
                        
                        // 刷新任务列表
                        refreshTaskList();
                    })
                    .catch(error => {
                        Swal.fire({
                            icon: 'error',
                            title: '取消失败',
                            text: error.message || '取消任务时发生错误'
                        });
                    });
            }
        });
    }
    
    // 显示任务错误
    function showTaskError(taskId) {
        ApiClient.getTaskStatus(taskId)
            .then(task => {
                if (task.error) {
                    Swal.fire({
                        title: '任务错误',
                        html: `<div class="text-danger">${task.error}</div>
                              ${task.traceback ? `<div class="mt-3"><strong>错误详情:</strong>
                              <pre class="text-start bg-light p-2 mt-2" style="max-height: 300px; overflow-y: auto;">${task.traceback}</pre></div>` : ''}`,
                        width: 800
                    });
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: '无错误信息',
                        text: '未找到此任务的错误信息'
                    });
                }
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: '获取错误信息失败',
                    text: error.message || '获取任务错误信息时发生错误'
                });
            });
    }
    
    // 显示任务详情
    function showTaskDetails(taskId) {
        ApiClient.getTaskStatus(taskId)
            .then(task => {
                const details = task.details || {};
                const htmlContent = `
                    <div class="task-details">
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>任务ID:</strong></div>
                            <div class="col-6 text-start">${task.id}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>状态:</strong></div>
                            <div class="col-6 text-start">${task.status}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>进度:</strong></div>
                            <div class="col-6 text-start">${task.progress}%</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>爬取URL数量:</strong></div>
                            <div class="col-6 text-start">${details.urls_count || '-'}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>爬取深度:</strong></div>
                            <div class="col-6 text-start">${details.depth || '-'}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>创建时间:</strong></div>
                            <div class="col-6 text-start">${task.created_at ? new Date(task.created_at).toLocaleString() : '-'}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>开始时间:</strong></div>
                            <div class="col-6 text-start">${task.start_time ? new Date(task.start_time).toLocaleString() : '-'}</div>
                        </div>
                        ${details.crawled_pages !== undefined ? `
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>已爬取页面:</strong></div>
                            <div class="col-6 text-start">${details.crawled_pages}</div>
                        </div>
                        ` : ''}
                        ${details.processed_pages !== undefined ? `
                        <div class="row mb-3">
                            <div class="col-6 text-start"><strong>已处理页面:</strong></div>
                            <div class="col-6 text-start">${details.processed_pages}</div>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                Swal.fire({
                    title: '任务详情',
                    html: htmlContent,
                    width: 600
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: '获取任务详情失败',
                    text: error.message || '获取任务详情时发生错误'
                });
            });
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
    
    // 创建图片模态框元素
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
    
    // 创建任务模态框
    function createTaskModal() {
        // 检查是否已存在模态框
        if (document.getElementById('taskModal')) return;
        
        // 创建Bootstrap模态框
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'taskModal';
        modal.tabIndex = '-1';
        modal.setAttribute('aria-labelledby', 'taskModalLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="taskModalLabel">任务详情</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="taskModalBody">
                        <!-- 任务详情内容将动态填充 -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
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
    
    // 检查服务器状态
    function checkServerStatus() {
        ApiClient.checkHealth()
            .then(health => {
                console.log("服务器状态:", health);
                // 可以在界面上显示服务器状态
                const statusIndicator = document.getElementById('serverStatusIndicator');
                if (statusIndicator) {
                    statusIndicator.classList.remove('bg-danger');
                    statusIndicator.classList.add('bg-success');
                    statusIndicator.setAttribute('title', `服务器正常 - 活跃任务: ${health.active_tasks}`);
                }
            })
            .catch(error => {
                console.error("服务器连接失败:", error);
                // 显示服务器错误状态
                const statusIndicator = document.getElementById('serverStatusIndicator');
                if (statusIndicator) {
                    statusIndicator.classList.remove('bg-success');
                    statusIndicator.classList.add('bg-danger');
                    statusIndicator.setAttribute('title', '服务器连接失败');
                }
                
                // 如果是首次加载，显示警告
                if (!window.serverErrorShown) {
                    window.serverErrorShown = true;
                    Swal.fire({
                        icon: 'warning',
                        title: '服务器连接失败',
                        text: '无法连接到爬虫后端服务器，部分功能可能无法使用。请确保服务器已启动。',
                        confirmButtonText: '我知道了'
                    });
                }
            });
    }
    
    // 添加启动时的初始化逻辑
    console.log("DOM已加载完成");
    console.log("URL输入框元素:", urlInput ? urlInput.tagName : "未找到");
    console.log("URL列表元素:", urlListElement ? urlListElement.tagName : "未找到");
    console.log("分类列表元素:", categoryList ? categoryList.tagName : "未找到");
    console.log("分类内容元素:", categoryContent ? categoryContent.tagName : "未找到");
    
    // 检查服务器连接状态
    checkServerStatus();
    
    // 如果存在任务列表标签页，初始化任务列表
    if (document.getElementById('tasks-tab')) {
        document.getElementById('tasks-tab').addEventListener('click', function() {
            refreshTaskList();
        });
    }
});