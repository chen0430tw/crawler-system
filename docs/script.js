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
        
                // 重置文件输入控件，确保可以再次上传同一个文件
                resultFile.value = "";
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
            <h4 class="content-title">
                ${item.title || '无标题'}
                <div class="float-end">
                    <button class="btn btn-sm btn-outline-primary download-html-btn" data-content-id="${item.url}">
                        <i class="bi bi-file-earmark-code"></i> 下载HTML
                    </button>
                    <button class="btn btn-sm btn-outline-secondary download-txt-btn" data-content-id="${item.url}">
                        <i class="bi bi-file-earmark-text"></i> 下载TXT
                    </button>
                </div>
            </h4>
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

        // 添加下载按钮事件处理
        const htmlBtn = contentPreview.querySelector('.download-html-btn');
        const txtBtn = contentPreview.querySelector('.download-txt-btn');
        
        if (htmlBtn) {
            htmlBtn.addEventListener('click', function() {
                downloadContent(item, 'html');
            });
        }
        
        if (txtBtn) {
            txtBtn.addEventListener('click', function() {
                downloadContent(item, 'txt');
            });
        }
        
        // 内容渲染后设置图片点击事件
        setTimeout(setupImageClickHandlers, 100);

        // 添加下载内容的函数
        function downloadContent(item, format) {
            if (!item || !item.content) {
                alert('没有内容可下载');
                return;
            }
            
            let content = item.content;
            let filename = generateFilename(item.title || '无标题', format);
            let mimeType = 'text/plain';
            
            if (format === 'html') {
                // 如果内容不是HTML格式，转换为简单的HTML
                if (!content.includes('<')) {
                    content = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${item.title || '无标题'}</title>
        </head>
        <body>
            <h1>${item.title || '无标题'}</h1>
            <div>${content.replace(/\n/g, '<br>')}</div>
            <div>URL: <a href="${item.url}">${item.url}</a></div>
        </body>
        </html>`;
                }
                mimeType = 'text/html';
            } else {
                // 如果内容是HTML格式，提取纯文本
                if (content.includes('<')) {
                    // 创建临时元素来提取文本
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = content;
                    content = tempDiv.textContent || tempDiv.innerText || '';
                }
            }
            
            // 创建Blob并下载
            const blob = new Blob([content], {type: mimeType});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
        
        // 生成文件名
        function generateFilename(title, format) {
            // 清理标题中的特殊字符
            const cleanTitle = title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            return `${cleanTitle}_${timestamp}.${format}`;
        }

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
        
        // 获取初始URL列表
        let initialUrlsHtml = '';
        if (crawlerResults && crawlerResults.task_info && crawlerResults.task_info.urls) {
            const initialUrls = crawlerResults.task_info.urls;
            initialUrlsHtml = `
                <div class="stats-card">
                    <div class="stats-title">起始爬取地址</div>
                    <div class="initial-urls-list">
                        ${initialUrls.map((url, index) => `
                            <div class="stats-row url-row">
                                <div class="url-number">${index + 1}</div>
                                <div class="initial-url">${url}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
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
            
            ${initialUrlsHtml}
            
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

// 1. 在现有的DOM加载事件中添加维基百科相关初始化
    // 初始化维基百科功能
    initWikipediaFunctions();
    
    // 如果是第一次访问，显示维基百科功能介绍
    if (!localStorage.getItem('wikiFeatureIntroShown')) {
        setTimeout(() => {
            Swal.fire({
                title: '新功能: 维基百科专用爬取',
                html: `
                    <div class="text-start">
                        <p>全息拉普拉斯互联网爬虫系统现已添加维基百科专用爬取功能，包括:</p>
                        <ul>
                            <li>维基百科页面搜索与爬取</li>
                            <li>分类爬取与分析</li>
                            <li>页面关系可视化</li>
                            <li>多语言版本支持</li>
                        </ul>
                        <p>点击导航栏中的"维基百科"标签页开始使用。</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: '了解了'
            });
            
            localStorage.setItem('wikiFeatureIntroShown', 'true');
            initWikiVisualization, 1000;
        }, 2000);
    }

// 2. 添加维基百科功能初始化函数
function initWikipediaFunctions() {
    // 获取维基百科搜索表单
    const wikiSearchForm = document.getElementById('wiki-search-form');
    
    if (wikiSearchForm) {
        wikiSearchForm.addEventListener('submit', function(e) {
            // 阻止表单默认提交行为
            e.preventDefault();
            
            // 获取搜索关键词
            const query = document.getElementById('wiki-search-input').value.trim();
            
            if (query) {
                searchWikipedia(query);
            }
        });
    }
    
    // 绑定随机页面按钮点击事件
    const randomPagesBtn = document.getElementById('wiki-random-pages-btn');
    if (randomPagesBtn) {
        randomPagesBtn.addEventListener('click', function() {
            const count = document.getElementById('wiki-random-count').value || 5;
            getRandomWikipediaPages(count);
        });
    }
}
    
    // 绑定分类爬取表单提交事件
    const wikiCategoryForm = document.getElementById('wiki-category-form');
    if (wikiCategoryForm) {
        wikiCategoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('wiki-category-input').value.trim();
            const depth = document.getElementById('wiki-category-depth').value;
            if (category) {
                crawlWikipediaCategory(category, depth);
            }
        });
    }
    
    // 绑定随机页面按钮点击事件
    const randomPagesBtn = document.getElementById('wiki-random-pages-btn');
    if (randomPagesBtn) {
        randomPagesBtn.addEventListener('click', function() {
            const count = document.getElementById('wiki-random-count').value || 5;
            getRandomWikipediaPages(count);
        });
    }
    
    // 初始化语言选择器
    initWikiLanguageSelector();

// 3. 创建维基百科标签页和内容区域
function createWikipediaTab() {
    // 创建标签页导航项
    const tabItem = document.createElement('li');
    tabItem.className = 'nav-item';
    tabItem.innerHTML = `<a class="nav-link" id="wiki-tab" data-bs-toggle="tab" href="#wiki">维基百科</a>`;
    
    // 添加到标签页导航
    const resultTabs = document.getElementById('resultTabs');
    if (resultTabs) {
        resultTabs.appendChild(tabItem);
    }
    
    // 创建标签页内容区域
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-pane fade';
    tabContent.id = 'wiki';
    
    // 创建维基百科内容
    tabContent.innerHTML = `
        <div class="row">
            <div class="col-md-12 mb-4">
                <div class="card">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs" id="wikiSubTabs">
                            <li class="nav-item">
                                <a class="nav-link active" id="wiki-search-tab" data-bs-toggle="tab" href="#wiki-search">搜索</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" id="wiki-category-tab" data-bs-toggle="tab" href="#wiki-category">分类爬取</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" id="wiki-results-tab" data-bs-toggle="tab" href="#wiki-results">爬取结果</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" id="wiki-visualize-tab" data-bs-toggle="tab" href="#wiki-visualize">可视化</a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="tab-content">
                            <!-- 搜索标签页 -->
                            <div class="tab-pane fade show active" id="wiki-search">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="wiki-language-container mb-3">
                                            <label for="wiki-language-selector" class="form-label">维基百科语言版本</label>
                                            <select id="wiki-language-selector" class="form-select">
                                                <option value="zh" selected>中文</option>
                                                <option value="en">英文</option>
                                                <option value="ja">日文</option>
                                                <option value="ko">韩文</option>
                                                <option value="fr">法文</option>
                                                <option value="de">德文</option>
                                                <option value="es">西班牙文</option>
                                                <option value="ru">俄文</option>
                                            </select>
                                        </div>
                                        <form id="wiki-search-form">
                                            <div class="input-group">
                                                <input type="text" id="wiki-search-input" class="form-control" placeholder="输入维基百科搜索关键词">
                                                <button type="submit" class="btn btn-primary">搜索</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div id="wiki-search-results">
                                            <div class="text-center py-5">
                                                <p class="text-muted">输入关键词搜索维基百科</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="card">
                                            <div class="card-header">
                                                <h5 class="mb-0">获取随机页面</h5>
                                            </div>
                                            <div class="card-body">
                                                <div class="input-group">
                                                    <select id="wiki-random-count" class="form-select" style="max-width: 100px;">
                                                        <option value="1">1页</option>
                                                        <option value="3" selected>3页</option>
                                                        <option value="5">5页</option>
                                                        <option value="10">10页</option>
                                                    </select>
                                                    <button id="wiki-random-pages-btn" class="btn btn-secondary">获取随机页面</button>
                                                </div>
                                                <div id="wiki-random-results" class="mt-3">
                                                    <!-- 随机页面结果将显示在这里 -->
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 分类爬取标签页 -->
                            <div class="tab-pane fade" id="wiki-category">
                                <div class="row">
                                    <div class="col-md-12">
                                        <form id="wiki-category-form">
                                            <div class="mb-3">
                                                <label for="wiki-category-input" class="form-label">分类名称或URL</label>
                                                <input type="text" id="wiki-category-input" class="form-control" placeholder="例如: Category:计算机科学 或 https://zh.wikipedia.org/wiki/Category:计算机科学">
                                            </div>
                                            <div class="mb-3">
                                                <label for="wiki-category-depth" class="form-label">爬取深度</label>
                                                <select id="wiki-category-depth" class="form-select">
                                                    <option value="0">0 (只爬取当前分类)</option>
                                                    <option value="1" selected>1 (爬取当前分类和子分类)</option>
                                                    <option value="2">2 (爬取到子分类的子分类)</option>
                                                    <option value="3">3 (深度爬取，慎用)</option>
                                                </select>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">筛选选项</label>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" id="wiki-filter-games" checked>
                                                    <label class="form-check-label" for="wiki-filter-games">排除游戏相关内容</label>
                                                </div>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" id="wiki-filter-wiki" checked>
                                                    <label class="form-check-label" for="wiki-filter-wiki">排除维基百科自身相关内容</label>
                                                </div>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" id="wiki-include-pages" checked>
                                                    <label class="form-check-label" for="wiki-include-pages">包含页面内容(不仅爬取分类)</label>
                                                </div>
                                            </div>
                                            <div class="d-grid gap-2">
                                                <button type="submit" class="btn btn-primary">开始爬取</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                                <div class="row mt-4">
                                    <div class="col-md-12">
                                        <div id="wiki-category-progress" class="d-none">
                                            <h5>爬取进度</h5>
                                            <div class="progress mb-3">
                                                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                                            </div>
                                            <div class="crawl-stats">
                                                <div class="row">
                                                    <div class="col-md-3">
                                                        <div class="stat-item">
                                                            <div class="stat-label">分类页面:</div>
                                                            <div class="stat-value" id="wiki-stat-categories">0</div>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <div class="stat-item">
                                                            <div class="stat-label">内容页面:</div>
                                                            <div class="stat-value" id="wiki-stat-pages">0</div>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <div class="stat-item">
                                                            <div class="stat-label">待处理:</div>
                                                            <div class="stat-value" id="wiki-stat-queue">0</div>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <div class="stat-item">
                                                            <div class="stat-label">用时:</div>
                                                            <div class="stat-value" id="wiki-stat-time">0s</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-center mt-3">
                                                <button id="wiki-cancel-crawl-btn" class="btn btn-danger">取消爬取</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 爬取结果标签页 -->
                            <div class="tab-pane fade" id="wiki-results">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="alert alert-info">
                                            <i class="bi bi-info-circle"></i> 这里显示最近的维基百科爬取任务结果
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-12">
                                        <div id="wiki-task-list">
                                            <div class="text-center py-5">
                                                <p class="text-muted">加载维基百科任务列表中...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-4">
                                    <div class="col-md-12">
                                        <div id="wiki-result-detail" class="d-none">
                                            <h4 id="wiki-result-title">结果详情</h4>
                                            <div class="result-stats mb-3">
                                                <span class="badge bg-primary" id="wiki-result-categories">分类: 0</span>
                                                <span class="badge bg-success" id="wiki-result-pages">页面: 0</span>
                                                <span class="badge bg-info" id="wiki-result-time">用时: 0s</span>
                                            </div>
                                            <div class="result-actions mb-3">
                                                <div class="btn-group">
                                                    <button class="btn btn-outline-primary" id="wiki-download-json-btn">下载JSON</button>
                                                    <button class="btn btn-outline-primary" id="wiki-download-csv-btn">下载CSV</button>
                                                    <button class="btn btn-outline-primary" id="wiki-download-html-btn">下载HTML</button>
                                                </div>
                                            </div>
                                            <div id="wiki-result-content">
                                                <div class="text-center py-5">
                                                    <p class="text-muted">选择一个任务查看详情</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 可视化标签页 -->
                            <div class="tab-pane fade" id="wiki-visualize">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="alert alert-info">
                                            <i class="bi bi-info-circle"></i> 可视化维基百科数据结构和关系
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="card mb-3">
                                            <div class="card-header">
                                                <h5 class="mb-0">分类树</h5>
                                            </div>
                                            <div class="card-body">
                                                <div class="mb-3">
                                                    <label for="wiki-tree-root" class="form-label">根分类</label>
                                                    <div class="input-group">
                                                        <input type="text" id="wiki-tree-root" class="form-control" placeholder="例如: 计算机科学">
                                                        <button id="wiki-tree-generate-btn" class="btn btn-primary">生成</button>
                                                    </div>
                                                </div>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" id="wiki-tree-include-pages" checked>
                                                    <label class="form-check-label" for="wiki-tree-include-pages">包含页面</label>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="card mb-3">
                                            <div class="card-header">
                                                <h5 class="mb-0">页面关系</h5>
                                            </div>
                                            <div class="card-body">
                                                <div class="mb-3">
                                                    <label for="wiki-path-source" class="form-label">源页面</label>
                                                    <input type="text" id="wiki-path-source" class="form-control" placeholder="例如: 人工智能">
                                                </div>
                                                <div class="mb-3">
                                                    <label for="wiki-path-target" class="form-label">目标页面</label>
                                                    <input type="text" id="wiki-path-target" class="form-control" placeholder="例如: 机器学习">
                                                </div>
                                                <button id="wiki-path-find-btn" class="btn btn-primary">查找路径</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-8">
                                        <div class="card">
                                            <div class="card-header">
                                                <h5 class="mb-0">可视化结果</h5>
                                            </div>
                                            <div class="card-body">
                                                <div id="wiki-visualization-container" style="height: 600px;">
                                                    <div class="text-center py-5">
                                                        <p class="text-muted">从左侧选择可视化选项</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加到标签页内容区
    const tabContainer = document.querySelector('.tab-content');
    if (tabContainer) {
        tabContainer.appendChild(tabContent);
    }
}

// 4. 初始化维基百科语言选择器
function initWikiLanguageSelector() {
    // 获取语言选择器元素
    const langSelector = document.getElementById('wiki-language-selector');
    if (!langSelector) return;
    
    // 获取可用的维基百科语言列表
    ApiClient.getWikiLanguages()
        .then(languages => {
            // 清空当前选项
            langSelector.innerHTML = '';
            
            // 添加默认语言选项
            const defaultLanguages = [
                { code: 'zh', name: '中文' },
                { code: 'en', name: '英文' },
                { code: 'ja', name: '日文' },
                { code: 'ko', name: '韩文' },
                { code: 'fr', name: '法文' },
                { code: 'de', name: '德文' },
                { code: 'es', name: '西班牙文' },
                { code: 'ru', name: '俄文' }
            ];
            
            // 如果API返回了语言列表，使用API的数据
            if (languages && languages.length > 0) {
                languages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.code;
                    option.textContent = lang.name;
                    langSelector.appendChild(option);
                });
                
                // 设置默认选中语言为中文
                langSelector.value = 'zh';
            } else {
                // 否则使用默认语言列表
                defaultLanguages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.code;
                    option.textContent = lang.name;
                    langSelector.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('获取维基百科语言列表失败:', error);
            
            // 发生错误时使用默认语言列表
            const defaultLanguages = [
                { code: 'zh', name: '中文' },
                { code: 'en', name: '英文' },
                { code: 'ja', name: '日文' },
                { code: 'ko', name: '韩文' },
                { code: 'fr', name: '法文' },
                { code: 'de', name: '德文' },
                { code: 'es', name: '西班牙文' },
                { code: 'ru', name: '俄文' }
            ];
            
            defaultLanguages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.code;
                option.textContent = lang.name;
                langSelector.appendChild(option);
            });
        });
}

// 5. 搜索维基百科
function searchWikipedia(query) {
    // 获取搜索结果容器
    const resultsContainer = document.getElementById('wiki-search-results');
    if (!resultsContainer) return;
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 显示加载中状态
    resultsContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">搜索中，请稍候...</p>
        </div>
    `;
    
    // 调用API搜索维基百科
    ApiClient.searchWiki(query, { language: language, limit: 10 })
        .then(results => {
            // 如果没有结果
            if (!results || results.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i> 未找到与"${query}"相关的结果
                    </div>
                `;
                return;
            }
            
            // 构建搜索结果HTML
            let resultsHtml = `
                <h5>搜索结果: "${query}"</h5>
                <div class="list-group">
            `;
            
            // 添加每个搜索结果
            results.forEach(result => {
                resultsHtml += `
                    <div class="list-group-item list-group-item-action">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${result.title}</h5>
                            <small>ID: ${result.page_id}</small>
                        </div>
                        <p class="mb-1">${result.snippet || '无摘要'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <a href="${result.url}" target="_blank" class="btn btn-sm btn-outline-primary">查看原页面</a>
                            <button class="btn btn-sm btn-primary fetch-wiki-page" data-url="${result.url}">抓取内容</button>
                        </div>
                    </div>
                `;
            });
            
            resultsHtml += `</div>`;
            
            // 添加获取所有结果的按钮
            resultsHtml += `
                <div class="text-center mt-3">
                    <button id="fetch-all-results-btn" class="btn btn-success">抓取所有结果</button>
                </div>
            `;
            
            // 显示结果
            resultsContainer.innerHTML = resultsHtml;
            
            // 绑定抓取按钮事件
            document.querySelectorAll('.fetch-wiki-page').forEach(button => {
                button.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    fetchWikipediaPage(url);
                });
            });
            
            // 绑定抓取所有结果按钮事件
            document.getElementById('fetch-all-results-btn').addEventListener('click', function() {
                fetchAllWikipediaResults(results);
            });
        })
        .catch(error => {
            resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 搜索失败: ${error.message || '未知错误'}
                </div>
            `;
        });
}

// 6. 抓取单个维基百科页面
function fetchWikipediaPage(url) {
    // 显示提交中提示
    Swal.fire({
        title: '提交任务中',
        text: '正在提交维基百科页面抓取任务，请稍候...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 配置爬取任务
    const config = {
        type: 'wikipedia_page',
        url: url,
        language: language,
        options: {
            format: 'html'
        }
    };
    
    // 提交任务
    ApiClient.submitWikiTask(config)
        .then(response => {
            Swal.close();
            
            // 显示任务已提交提示
            Swal.fire({
                icon: 'success',
                title: '任务已提交',
                text: `任务ID: ${response.task_id}`,
                confirmButtonText: '查看任务状态'
            }).then(() => {
                // 切换到维基百科结果标签页
                document.getElementById('wiki-results-tab').click();
                
                // 刷新任务列表
                refreshWikiTaskList();
            });
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: '提交失败',
                text: error.message || '提交任务时发生错误'
            });
        });
}

// 7. 抓取所有搜索结果
function fetchAllWikipediaResults(results) {
    // 显示确认对话框
    Swal.fire({
        title: '确认抓取',
        text: `确定要抓取所有 ${results.length} 个搜索结果吗？`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '确认',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            // 显示提交中提示
            Swal.fire({
                title: '提交任务中',
                text: '正在提交批量抓取任务，请稍候...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // 获取选中的语言
            const language = document.getElementById('wiki-language-selector').value || 'zh';
            
            // 提取URL列表
            const urls = results.map(result => result.url);
            
            // 配置爬取任务
            const config = {
                type: 'wikipedia_batch',
                urls: urls,
                language: language,
                options: {
                    format: 'html',
                    depth: 0  // 只抓取页面本身，不抓取链接
                }
            };
            
            // 提交任务
            ApiClient.submitWikiTask(config)
                .then(response => {
                    Swal.close();
                    
                    // 显示任务已提交提示
                    Swal.fire({
                        icon: 'success',
                        title: '批量任务已提交',
                        text: `任务ID: ${response.task_id}`,
                        confirmButtonText: '查看任务状态'
                    }).then(() => {
                        // 切换到维基百科结果标签页
                        document.getElementById('wiki-results-tab').click();
                        
                        // 刷新任务列表
                        refreshWikiTaskList();
                    });
                })
                .catch(error => {
                    Swal.fire({
                        icon: 'error',
                        title: '提交失败',
                        text: error.message || '提交任务时发生错误'
                    });
                });
        }
    });
}

// 8. 获取随机维基百科页面（继续）
function getRandomWikipediaPages(count) {
    // 获取随机页面结果容器
    const resultsContainer = document.getElementById('wiki-random-results');
    if (!resultsContainer) return;
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 显示加载中状态
    resultsContainer.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <span class="ms-2">获取随机页面中...</span>
        </div>
    `;
    
    // 调用API获取随机维基百科页面
    ApiClient.getRandomWikiPages({ count: count, language: language })
        .then(pages => {
            // 如果没有结果
            if (!pages || pages.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i> 未能获取随机页面
                    </div>
                `;
                return;
            }
            
            // 构建结果HTML
            let resultsHtml = `<div class="list-group">`;
            
            // 添加每个随机页面
            pages.forEach(page => {
                resultsHtml += `
                    <div class="list-group-item list-group-item-action">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${page.title}</h5>
                            <small>ID: ${page.page_id}</small>
                        </div>
                        <p class="mb-1">${page.snippet || '无摘要'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <a href="${page.url}" target="_blank" class="btn btn-sm btn-outline-primary">查看原页面</a>
                            <button class="btn btn-sm btn-primary fetch-wiki-page" data-url="${page.url}">抓取内容</button>
                        </div>
                    </div>
                `;
            });
            
            resultsHtml += `</div>`;
            
            // 添加批量抓取按钮
            resultsHtml += `
                <div class="text-center mt-3">
                    <button id="fetch-all-random-btn" class="btn btn-success">抓取所有随机页面</button>
                </div>
            `;
            
            // 显示结果
            resultsContainer.innerHTML = resultsHtml;
            
            // 绑定抓取按钮事件
            document.querySelectorAll('#wiki-random-results .fetch-wiki-page').forEach(button => {
                button.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    fetchWikipediaPage(url);
                });
            });
            
            // 绑定抓取所有随机页面按钮事件
            document.getElementById('fetch-all-random-btn').addEventListener('click', function() {
                fetchAllWikipediaResults(pages);
            });
        })
        .catch(error => {
            resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 获取随机页面失败: ${error.message || '未知错误'}
                </div>
            `;
        });
}

// 9. 爬取维基百科分类
function crawlWikipediaCategory(category, depth) {
    // 获取分类爬取进度容器
    const progressContainer = document.getElementById('wiki-category-progress');
    if (!progressContainer) return;
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 获取筛选选项
    const filterGames = document.getElementById('wiki-filter-games').checked;
    const filterWiki = document.getElementById('wiki-filter-wiki').checked;
    const includePages = document.getElementById('wiki-include-pages').checked;
    
    // 显示进度容器
    progressContainer.classList.remove('d-none');
    
    // 重置进度条和统计数据
    const progressBar = progressContainer.querySelector('.progress-bar');
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', 0);
    
    document.getElementById('wiki-stat-categories').textContent = '0';
    document.getElementById('wiki-stat-pages').textContent = '0';
    document.getElementById('wiki-stat-queue').textContent = '0';
    document.getElementById('wiki-stat-time').textContent = '0s';
    
    // 开始计时
    const startTime = new Date();
    const updateTime = () => {
        const elapsed = Math.floor((new Date() - startTime) / 1000);
        document.getElementById('wiki-stat-time').textContent = `${elapsed}s`;
    };
    
    // 定时更新时间
    const timeInterval = setInterval(updateTime, 1000);
    
    // 准备爬取配置
    let categoryName = category;
    
    // 如果输入是URL，提取分类名称
    if (category.startsWith('http')) {
        const urlParts = category.split('/');
        categoryName = urlParts[urlParts.length - 1];
        
        // 处理URL编码
        categoryName = decodeURIComponent(categoryName);
    }
    
    // 如果不是以Category:开头，添加前缀
    if (!categoryName.startsWith('Category:')) {
        categoryName = `Category:${categoryName}`;
    }
    
    // 配置爬取任务
    const config = {
        type: 'wikipedia_category',
        category: categoryName,
        language: language,
        depth: parseInt(depth),
        options: {
            filter_games: filterGames,
            filter_wiki: filterWiki,
            include_pages: includePages,
            format: 'html'
        }
    };
    
    // 显示提交中提示
    Swal.fire({
        title: '提交任务中',
        text: '正在提交维基百科分类爬取任务，请稍候...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // 提交任务
    ApiClient.submitWikiTask(config)
        .then(response => {
            Swal.close();
            
            const taskId = response.task_id;
            
            // 显示任务已提交提示
            Swal.fire({
                icon: 'success',
                title: '任务已提交',
                text: `维基百科分类爬取任务ID: ${taskId}`,
                confirmButtonText: '监控进度'
            }).then(() => {
                // 开始监控任务进度
                monitorWikiCategoryCrawlProgress(taskId, {
                    progressBar,
                    updateStats: (stats) => {
                        if (stats.categories !== undefined) 
                            document.getElementById('wiki-stat-categories').textContent = stats.categories;
                        if (stats.pages !== undefined) 
                            document.getElementById('wiki-stat-pages').textContent = stats.pages;
                        if (stats.queue !== undefined) 
                            document.getElementById('wiki-stat-queue').textContent = stats.queue;
                    },
                    onComplete: () => {
                        clearInterval(timeInterval);
                        
                        // 显示完成提示
                        Swal.fire({
                            icon: 'success',
                            title: '爬取完成',
                            text: '维基百科分类爬取任务已完成',
                            confirmButtonText: '查看结果'
                        }).then(() => {
                            // 切换到结果标签页
                            document.getElementById('wiki-results-tab').click();
                            
                            // 刷新任务列表
                            refreshWikiTaskList();
                            
                            // 加载当前任务结果
                            loadWikiTaskResult(taskId);
                        });
                    },
                    onError: (error) => {
                        clearInterval(timeInterval);
                        
                        Swal.fire({
                            icon: 'error',
                            title: '爬取失败',
                            text: `任务失败: ${error.message || '未知错误'}`,
                            confirmButtonText: '确定'
                        });
                    }
                });
            });
        })
        .catch(error => {
            clearInterval(timeInterval);
            progressContainer.classList.add('d-none');
            
            Swal.fire({
                icon: 'error',
                title: '提交失败',
                text: error.message || '提交任务时发生错误'
            });
        });
    
    // 绑定取消按钮事件
    document.getElementById('wiki-cancel-crawl-btn').addEventListener('click', function() {
        cancelWikiTask(config.task_id);
        clearInterval(timeInterval);
    });
}

// 10. 监控维基百科分类爬取进度
function monitorWikiCategoryCrawlProgress(taskId, options) {
    const { progressBar, updateStats, onComplete, onError } = options;
    
    // 定义进度轮询函数
    const pollProgress = () => {
        ApiClient.getWikiTaskStatus(taskId)
            .then(response => {
                // 更新进度条
                const progress = response.progress || 0;
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
                
                // 更新统计数据
                if (response.details) {
                    updateStats({
                        categories: response.details.categories_count || 0,
                        pages: response.details.pages_count || 0,
                        queue: response.details.queue_size || 0
                    });
                }
                
                // 检查任务状态
                if (response.status === '已完成') {
                    // 任务完成
                    if (onComplete) onComplete(response);
                } else if (response.status === '失败') {
                    // 任务失败
                    if (onError) onError({ message: response.error || '任务执行失败' });
                } else {
                    // 任务仍在进行中，继续轮询
                    setTimeout(pollProgress, 2000);
                }
            })
            .catch(error => {
                console.error('获取任务状态失败:', error);
                // 出错后继续轮询，但延长间隔
                setTimeout(pollProgress, 5000);
            });
    };
    
    // 开始轮询进度
    pollProgress();
}

// 11. 取消维基百科任务
function cancelWikiTask(taskId) {
    if (!taskId) return;
    
    Swal.fire({
        title: '确认取消',
        text: '确定要取消这个维基百科爬取任务吗？',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            ApiClient.cancelWikiTask(taskId)
                .then(response => {
                    Swal.fire({
                        icon: 'success',
                        title: '已取消',
                        text: response.message || '任务已取消'
                    });
                    
                    // 隐藏进度容器
                    const progressContainer = document.getElementById('wiki-category-progress');
                    if (progressContainer) {
                        progressContainer.classList.add('d-none');
                    }
                    
                    // 刷新任务列表
                    refreshWikiTaskList();
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

// 12. 刷新维基百科任务列表
function refreshWikiTaskList() {
    const taskListContainer = document.getElementById('wiki-task-list');
    if (!taskListContainer) return;
    
    // 显示加载指示器
    taskListContainer.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">获取维基百科任务列表中...</p>
        </div>
    `;
    
    // 获取维基百科任务列表
    ApiClient.getWikiTasks()
        .then(tasks => {
            if (!tasks || tasks.length === 0) {
                taskListContainer.innerHTML = `
                    <div class="text-center py-5">
                        <p class="text-muted">暂无维基百科爬取任务</p>
                    </div>
                `;
                return;
            }
            
            // 构建任务列表HTML
            let html = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>类型</th>
                                <th>状态</th>
                                <th>进度</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // 添加每个任务行
            tasks.forEach(task => {
                const taskId = task.id;
                const shortId = taskId.substring(0, 8) + '...';
                
                // 根据状态设置不同的样式
                let statusClass = '';
                let progressHtml = '';
                
                switch (task.status) {
                    case '运行中':
                        statusClass = 'text-primary';
                        progressHtml = `
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                    role="progressbar" style="width: ${task.progress}%;" 
                                    aria-valuenow="${task.progress}" aria-valuemin="0" aria-valuemax="100">
                                    ${task.progress}%
                                </div>
                            </div>
                        `;
                        break;
                    case '已完成':
                        statusClass = 'text-success';
                        progressHtml = `
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar bg-success" 
                                    role="progressbar" style="width: 100%;" 
                                    aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                                    100%
                                </div>
                            </div>
                        `;
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
                
                // 任务类型
                let taskType = '';
                if (task.details && task.details.type) {
                    switch (task.details.type) {
                        case 'wikipedia_page':
                            taskType = '单页面爬取';
                            break;
                        case 'wikipedia_batch':
                            taskType = '批量页面爬取';
                            break;
                        case 'wikipedia_category':
                            taskType = '分类爬取';
                            break;
                        default:
                            taskType = task.details.type;
                    }
                }
                
                // 创建时间
                const createdAt = new Date(task.created_at).toLocaleString();
                
                // 操作按钮
                let actionButtons = '';
                
                if (task.status === '已完成') {
                    actionButtons = `
                        <button class="btn btn-sm btn-primary view-wiki-result-btn" data-task-id="${taskId}">查看结果</button>
                        <button class="btn btn-sm btn-success download-wiki-result-btn" data-task-id="${taskId}">下载结果</button>
                    `;
                } else if (task.status === '等待中') {
                    actionButtons = `
                        <button class="btn btn-sm btn-danger cancel-wiki-task-btn" data-task-id="${taskId}">取消任务</button>
                    `;
                } else if (task.status === '失败') {
                    actionButtons = `
                        <button class="btn btn-sm btn-info wiki-task-error-btn" data-task-id="${taskId}">查看错误</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn btn-sm btn-info wiki-task-details-btn" data-task-id="${taskId}">查看详情</button>
                    `;
                }
                
                html += `
                    <tr id="wiki-task-row-${taskId}">
                        <td title="${taskId}">${shortId}</td>
                        <td>${taskType}</td>
                        <td class="${statusClass}">${task.status}</td>
                        <td>${progressHtml}</td>
                        <td>${createdAt}</td>
                        <td>${actionButtons}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
                <div class="text-center mt-3">
                    <button id="refresh-wiki-tasks-btn" class="btn btn-outline-secondary">
                        <i class="bi bi-arrow-clockwise"></i> 刷新列表
                    </button>
                </div>
            `;
            
            // 显示任务列表
            taskListContainer.innerHTML = html;
            
            // 绑定按钮事件
            bindWikiTaskButtonEvents();
        })
        .catch(error => {
            taskListContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 获取任务列表失败: ${error.message || '未知错误'}
                </div>
                <div class="text-center mt-3">
                    <button id="refresh-wiki-tasks-btn" class="btn btn-outline-secondary">
                        <i class="bi bi-arrow-clockwise"></i> 刷新列表
                    </button>
                </div>
            `;
            
            // 绑定刷新按钮事件
            const refreshBtn = document.getElementById('refresh-wiki-tasks-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', refreshWikiTaskList);
            }
        });
}

// 13. 绑定维基百科任务按钮事件
function bindWikiTaskButtonEvents() {
    // 绑定查看结果按钮事件
    document.querySelectorAll('.view-wiki-result-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            loadWikiTaskResult(taskId);
        });
    });
    
    // 绑定下载结果按钮事件
    document.querySelectorAll('.download-wiki-result-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            downloadWikiTaskResult(taskId);
        });
    });
    
    // 绑定取消任务按钮事件
    document.querySelectorAll('.cancel-wiki-task-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            cancelWikiTask(taskId);
        });
    });
    
    // 绑定查看错误按钮事件
    document.querySelectorAll('.wiki-task-error-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            showWikiTaskError(taskId);
        });
    });
    
    // 绑定查看详情按钮事件
    document.querySelectorAll('.wiki-task-details-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            showWikiTaskDetails(taskId);
        });
    });
    
    // 绑定刷新按钮事件
    const refreshBtn = document.getElementById('refresh-wiki-tasks-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshWikiTaskList);
    }
}

// 14. 加载维基百科任务结果
function loadWikiTaskResult(taskId) {
    // 获取结果详情容器
    const resultDetail = document.getElementById('wiki-result-detail');
    const resultContent = document.getElementById('wiki-result-content');
    if (!resultDetail || !resultContent) return;
    
    // 显示详情区域
    resultDetail.classList.remove('d-none');
    
    // 显示加载中状态
    resultContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">加载维基百科爬取结果中...</p>
        </div>
    `;
    
    // 获取任务结果
    ApiClient.getWikiTaskResult(taskId)
        .then(result => {
            // 更新结果标题和统计
            document.getElementById('wiki-result-title').textContent = `爬取结果: ${result.task_info?.title || '维基百科内容'}`;
            document.getElementById('wiki-result-categories').textContent = `分类: ${result.statistics?.categories_count || 0}`;
            document.getElementById('wiki-result-pages').textContent = `页面: ${result.statistics?.pages_count || 0}`;
            document.getElementById('wiki-result-time').textContent = `用时: ${result.task_info?.duration?.toFixed(2) || 0}s`;
            
            // 绑定下载按钮事件
            document.getElementById('wiki-download-json-btn').addEventListener('click', function() {
                downloadWikiTaskResult(taskId, 'json');
            });
            
            document.getElementById('wiki-download-csv-btn').addEventListener('click', function() {
                downloadWikiTaskResult(taskId, 'csv');
            });
            
            document.getElementById('wiki-download-html-btn').addEventListener('click', function() {
                downloadWikiTaskResult(taskId, 'html');
            });
            
            // 显示结果内容
            displayWikiResult(result, resultContent);
        })
        .catch(error => {
            resultContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 加载结果失败: ${error.message || '未知错误'}
                </div>
            `;
        });
}

// 15. 显示维基百科结果内容
function displayWikiResult(result, container) {
    if (!result || !result.content || !Array.isArray(result.content)) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> 未找到有效的爬取结果内容
            </div>
        `;
        return;
    }
    
    // 创建分类和内容显示区域
    let html = `
        <div class="wiki-result-container">
            <ul class="nav nav-tabs" id="wikiResultTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="wiki-content-tab" data-bs-toggle="tab" data-bs-target="#wiki-content-tab-pane" type="button" role="tab" aria-controls="wiki-content-tab-pane" aria-selected="true">内容页面</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="wiki-categories-tab" data-bs-toggle="tab" data-bs-target="#wiki-categories-tab-pane" type="button" role="tab" aria-controls="wiki-categories-tab-pane" aria-selected="false">分类页面</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="wiki-analysis-tab" data-bs-toggle="tab" data-bs-target="#wiki-analysis-tab-pane" type="button" role="tab" aria-controls="wiki-analysis-tab-pane" aria-selected="false">数据分析</button>
                </li>
            </ul>
            
            <div class="tab-content" id="wikiResultTabContent">
                <!-- 内容页面 -->
                <div class="tab-pane fade show active" id="wiki-content-tab-pane" role="tabpanel" aria-labelledby="wiki-content-tab" tabindex="0">
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="list-group wiki-page-list">
    `;
    
    // 筛选并添加内容页面
    const contentPages = result.content.filter(item => !item.url.includes('Category:') && !item.url.includes('Special:'));
    
    if (contentPages.length === 0) {
        html += `
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 未找到内容页面
                                </div>
        `;
    } else {
        contentPages.forEach((item, index) => {
            html += `
                                <a href="#" class="list-group-item list-group-item-action wiki-page-item" data-index="${index}" data-type="content">
                                    <div class="wiki-page-title">${item.title || '无标题'}</div>
                                    <div class="wiki-page-url">${item.url}</div>
                                </a>
            `;
        });
    }
    
    html += `
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div id="wiki-page-preview">
                                <div class="text-center py-5">
                                    <p class="text-muted">选择左侧页面查看内容</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 分类页面 -->
                <div class="tab-pane fade" id="wiki-categories-tab-pane" role="tabpanel" aria-labelledby="wiki-categories-tab" tabindex="0">
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="list-group wiki-category-list">
    `;
    
    // 筛选并添加分类页面
    const categoryPages = result.content.filter(item => item.url.includes('Category:'));
    
    if (categoryPages.length === 0) {
        html += `
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 未找到分类页面
                                </div>
        `;
    } else {
        categoryPages.forEach((item, index) => {
            html += `
                                <a href="#" class="list-group-item list-group-item-action wiki-page-item" data-index="${index}" data-type="category">
                                    <div class="wiki-page-title">${item.title || '无标题'}</div>
                                    <div class="wiki-page-url">${item.url}</div>
                                </a>
            `;
        });
    }
    
    html += `
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div id="wiki-category-preview">
                                <div class="text-center py-5">
                                    <p class="text-muted">选择左侧分类查看内容</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 数据分析 -->
                <div class="tab-pane fade" id="wiki-analysis-tab-pane" role="tabpanel" aria-labelledby="wiki-analysis-tab" tabindex="0">
                    <div class="row mt-3">
                        <div class="col-md-12">
                            <div class="card mb-3">
                                <div class="card-header">
                                    <h5 class="mb-0">内容统计</h5>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <canvas id="wikiContentTypeChart"></canvas>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="stats-table">
                                                <div class="stats-row">
                                                    <div class="stats-label">总页面数:</div>
                                                    <div class="stats-value">${result.content.length}</div>
                                                </div>
                                                <div class="stats-row">
                                                    <div class="stats-label">内容页面:</div>
                                                    <div class="stats-value">${contentPages.length}</div>
                                                </div>
                                                    <div class="stats-row">
                                                    <div class="stats-label">分类页面:</div>
                                                    <div class="stats-value">${categoryPages.length}</div>
                                                </div>
                                                <div class="stats-row">
                                                    <div class="stats-label">特殊页面:</div>
                                                    <div class="stats-value">${result.content.filter(item => item.url.includes('Special:')).length}</div>
                                                </div>
                                                <div class="stats-row">
                                                    <div class="stats-label">平均内容长度:</div>
                                                    <div class="stats-value">${Math.round(contentPages.reduce((sum, item) => sum + (item.content ? item.content.length : 0), 0) / Math.max(1, contentPages.length))} 字符</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="card mb-3">
                                <div class="card-header">
                                    <h5 class="mb-0">关键词分析</h5>
                                </div>
                                <div class="card-body">
                                    <div id="wikiKeywordsCloud" style="height: 300px;"></div>
                                </div>
                            </div>
                            
                            <div class="card">
                                <div class="card-header">
                                    <h5 class="mb-0">链接关系</h5>
                                </div>
                                <div class="card-body">
                                    <div class="text-center mb-3">
                                        <button id="generate-wiki-graph-btn" class="btn btn-primary">生成关系图谱</button>
                                    </div>
                                    <div id="wikiLinkGraph" style="height: 400px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 显示结果内容
    container.innerHTML = html;
    
    // 保存结果数据，用于后续展示
    container.dataset.resultData = JSON.stringify(result);
    
    // 绑定页面项目点击事件
    document.querySelectorAll('.wiki-page-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 更新选中状态
            document.querySelectorAll('.wiki-page-item').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
            
            // 获取页面索引和类型
            const index = parseInt(this.getAttribute('data-index'));
            const type = this.getAttribute('data-type');
            
            // 显示页面内容
            const resultData = JSON.parse(container.dataset.resultData);
            
            if (type === 'content') {
                displayWikiPageContent(contentPages[index], 'wiki-page-preview');
            } else if (type === 'category') {
                displayWikiCategoryContent(categoryPages[index], 'wiki-category-preview');
            }
        });
    });
    
    // 绑定生成图谱按钮事件
    const graphBtn = document.getElementById('generate-wiki-graph-btn');
    if (graphBtn) {
        graphBtn.addEventListener('click', function() {
            generateWikiLinkGraph(result);
        });
    }
    
    // 渲染内容类型饼图
    renderWikiContentTypeChart(result);
    
    // 渲染关键词云
    renderWikiKeywordsCloud(result);
}

// 16. 显示维基百科页面内容
function displayWikiPageContent(page, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !page) return;
    
    let contentHtml = '';
    
    // 处理HTML内容
    if (page.content && page.content.includes('<')) {
        // 是HTML内容，需要进行安全处理
        const sanitizedHtml = sanitizeHtml(page.content);
        
        contentHtml = `
            <div class="wiki-page-container">
                <h4 class="wiki-page-header">${page.title || '无标题'}</h4>
                <div class="wiki-page-url mb-3">
                    <a href="${page.url}" target="_blank">${page.url}</a>
                </div>
                <div class="keywords-container mb-3">
                    ${page.keywords && page.keywords.length > 0 ? 
                        page.keywords.map(kw => `<span class="keyword">${kw}</span>`).join('') : 
                        '<span class="text-muted">无关键词</span>'}
                </div>
                <div class="wiki-page-actions mb-3">
                    <button class="btn btn-sm btn-outline-primary extract-wiki-page-btn" data-url="${page.url}">提取结构化信息</button>
                    <button class="btn btn-sm btn-outline-secondary download-wiki-page-btn" data-url="${page.url}">下载页面</button>
                </div>
                <div class="wiki-page-content">
                    ${sanitizedHtml}
                </div>
            </div>
        `;
    } else {
        // 纯文本内容
        contentHtml = `
            <div class="wiki-page-container">
                <h4 class="wiki-page-header">${page.title || '无标题'}</h4>
                <div class="wiki-page-url mb-3">
                    <a href="${page.url}" target="_blank">${page.url}</a>
                </div>
                <div class="keywords-container mb-3">
                    ${page.keywords && page.keywords.length > 0 ? 
                        page.keywords.map(kw => `<span class="keyword">${kw}</span>`).join('') : 
                        '<span class="text-muted">无关键词</span>'}
                </div>
                <div class="wiki-page-actions mb-3">
                    <button class="btn btn-sm btn-outline-primary extract-wiki-page-btn" data-url="${page.url}">提取结构化信息</button>
                    <button class="btn btn-sm btn-outline-secondary download-wiki-page-btn" data-url="${page.url}">下载页面</button>
                </div>
                <div class="wiki-page-content">
                    <pre>${page.content || '无内容'}</pre>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = contentHtml;
    
    // 绑定提取结构化信息按钮事件
    container.querySelector('.extract-wiki-page-btn').addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        extractWikiPageStructuredInfo(url, page);
    });
    
    // 绑定下载页面按钮事件
    container.querySelector('.download-wiki-page-btn').addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        downloadWikiPage(url, page);
    });
}

// 17. 显示维基百科分类内容
function displayWikiCategoryContent(category, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !category) return;
    
    // 查找分类下的子分类和页面链接
    let subCategories = [];
    let pages = [];
    
    // 简单解析HTML内容提取链接
    if (category.content && category.content.includes('<')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = category.content;
        
        // 查找子分类
        const categoryLinksDiv = tempDiv.querySelector('#mw-subcategories');
        if (categoryLinksDiv) {
            const categoryLinks = categoryLinksDiv.querySelectorAll('a');
            categoryLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.includes('Category:')) {
                    subCategories.push({
                        title: link.textContent,
                        url: 'https://' + category.url.split('/')[2] + href
                    });
                }
            });
        }
        
        // 查找页面
        const pagesDiv = tempDiv.querySelector('#mw-pages');
        if (pagesDiv) {
            const pageLinks = pagesDiv.querySelectorAll('a');
            pageLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.includes('/wiki/') && !href.includes(':')) {
                    pages.push({
                        title: link.textContent,
                        url: 'https://' + category.url.split('/')[2] + href
                    });
                }
            });
        }
    }
    
    // 构建分类内容HTML
    let contentHtml = `
        <div class="wiki-category-container">
            <h4 class="wiki-category-header">${category.title || '无标题'}</h4>
            <div class="wiki-category-url mb-3">
                <a href="${category.url}" target="_blank">${category.url}</a>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5 class="mb-0">子分类 (${subCategories.length})</h5>
                        </div>
                        <div class="card-body">
                            ${subCategories.length > 0 ? 
                                `<div class="list-group">
                                    ${subCategories.map(cat => `
                                        <a href="${cat.url}" target="_blank" class="list-group-item list-group-item-action">
                                            <i class="bi bi-folder"></i> ${cat.title}
                                        </a>
                                    `).join('')}
                                </div>` : 
                                '<div class="text-muted">无子分类</div>'}
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5 class="mb-0">页面 (${pages.length})</h5>
                        </div>
                        <div class="card-body">
                            ${pages.length > 0 ? 
                                `<div class="list-group">
                                    ${pages.map(page => `
                                        <a href="${page.url}" target="_blank" class="list-group-item list-group-item-action">
                                            <i class="bi bi-file-text"></i> ${page.title}
                                        </a>
                                    `).join('')}
                                </div>` : 
                                '<div class="text-muted">无页面</div>'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">分类操作</h5>
                </div>
                <div class="card-body">
                    <button class="btn btn-primary crawl-sub-categories-btn" data-category="${category.title}">爬取子分类</button>
                    <button class="btn btn-outline-primary crawl-pages-btn" data-category="${category.title}">爬取页面</button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = contentHtml;
    
    // 绑定爬取子分类按钮事件
    container.querySelector('.crawl-sub-categories-btn').addEventListener('click', function() {
        const categoryName = this.getAttribute('data-category');
        document.getElementById('wiki-category-tab').click();
        document.getElementById('wiki-category-input').value = categoryName;
        document.getElementById('wiki-category-depth').value = "1";
    });
    
    // 绑定爬取页面按钮事件
    container.querySelector('.crawl-pages-btn').addEventListener('click', function() {
        const categoryName = this.getAttribute('data-category');
        // 将所有页面URL添加到爬取配置
        const urls = pages.map(page => page.url);
        if (urls.length > 0) {
            // 前往主界面的URL输入区
            document.getElementById('urlInput').value = urls.join('\n');
            document.getElementById('resultTabs').querySelector('a[href="#upload"]').click();
            
            // 显示提示
            Swal.fire({
                icon: 'success',
                title: '页面已添加',
                text: `已将 ${urls.length} 个页面添加到URL列表，您可以点击"运行爬虫"开始抓取`,
                confirmButtonText: '确定'
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: '无页面',
                text: '当前分类下没有页面可供爬取',
                confirmButtonText: '确定'
            });
        }
    });
}

// 18. 提取维基百科页面结构化信息
function extractWikiPageStructuredInfo(url, page) {
    Swal.fire({
        title: '提取中',
        text: '正在提取页面结构化信息，请稍候...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // 调用API提取结构化信息
    ApiClient.extractWikiStructuredInfo(url)
        .then(result => {
            Swal.close();
            
            // 显示结构化信息
            Swal.fire({
                title: '结构化信息',
                html: generateStructuredInfoHtml(result),
                width: 800,
                confirmButtonText: '关闭',
                showCloseButton: true
            });
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: '提取失败',
                text: error.message || '提取结构化信息时发生错误',
                confirmButtonText: '确定'
            });
        });
    
    // 生成结构化信息HTML
    function generateStructuredInfoHtml(data) {
        if (!data) return '<div class="alert alert-warning">未能提取到结构化信息</div>';
        
        let html = `<div class="structured-info">`;
        
        // 添加Infobox信息
        if (data.infobox && Object.keys(data.infobox).length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h5 class="mb-0">信息框 (Infobox)</h5>
                    </div>
                    <div class="card-body p-0">
                        <table class="table table-sm table-striped mb-0">
                            <tbody>
            `;
            
            for (const [key, value] of Object.entries(data.infobox)) {
                html += `
                    <tr>
                        <td class="fw-bold" style="width: 30%;">${key}</td>
                        <td>${typeof value === 'string' ? value : JSON.stringify(value)}</td>
                    </tr>
                `;
            }
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        // 添加分类信息
        if (data.categories && data.categories.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h5 class="mb-0">分类</h5>
                    </div>
                    <div class="card-body">
                        <div class="d-flex flex-wrap">
            `;
            
            data.categories.forEach(category => {
                html += `<span class="badge bg-secondary me-2 mb-2">${category}</span>`;
            });
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 添加段落信息
        if (data.sections && data.sections.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h5 class="mb-0">内容结构</h5>
                    </div>
                    <div class="card-body p-0">
                        <ul class="list-group list-group-flush">
            `;
            
            data.sections.forEach(section => {
                html += `
                    <li class="list-group-item">
                        <div class="fw-bold">${section.title || '引言'}</div>
                        <div class="text-muted small">${section.paragraphs.length} 个段落</div>
                    </li>
                `;
            });
            
            html += `
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // 添加链接信息
        if (data.links && data.links.length > 0) {
            html += `
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">主要链接</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
            `;
            
            // 显示前20个链接
            const displayLinks = data.links.slice(0, 20);
            displayLinks.forEach(link => {
                html += `
                    <div class="col-md-6 mb-2">
                        <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 100%;">
                            ${link.text || link.url}
                        </a>
                    </div>
                `;
            });
            
            html += `
                        </div>
                        ${data.links.length > 20 ? `<div class="text-muted small mt-2">显示 ${displayLinks.length} / ${data.links.length} 个链接</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        return html;
    }
}

// 19. 下载维基百科页面
function downloadWikiPage(url, page) {
    if (!page || !page.content) {
        Swal.fire({
            icon: 'error',
            title: '下载失败',
            text: '页面内容为空',
            confirmButtonText: '确定'
        });
        return;
    }
    
    // 格式化文件名
    const filename = (page.title || 'wiki_page').replace(/[^\w\s]/gi, '').replace(/\s+/g, '_') + '.html';
    
    // 创建完整的HTML文档
    let fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${page.title || '维基百科页面'}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
                a { color: #0645ad; text-decoration: none; }
                a:hover { text-decoration: underline; }
                .metadata { background: #f8f9fa; padding: 10px; border: 1px solid #ddd; margin-bottom: 20px; }
                .metadata p { margin: 5px 0; }
                .keywords { margin-top: 10px; }
                .keyword { display: inline-block; background: #e0f0ff; padding: 2px 8px; border-radius: 12px; margin-right: 5px; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <div class="metadata">
                <h1>${page.title || '无标题'}</h1>
                <p><strong>URL:</strong> <a href="${page.url}">${page.url}</a></p>
                <p><strong>爬取时间:</strong> ${new Date().toLocaleString()}</p>
                ${page.keywords && page.keywords.length > 0 ? 
                    `<div class="keywords">
                        <strong>关键词:</strong> 
                        ${page.keywords.map(kw => `<span class="keyword">${kw}</span>`).join('')}
                    </div>` : ''}
            </div>
            <div class="content">
                ${page.content}
            </div>
        </body>
        </html>
    `;
    
    // 创建并下载Blob
    const blob = new Blob([fullHtml], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// 20. 下载维基百科任务结果
function downloadWikiTaskResult(taskId, format = 'json') {
    // 获取下载链接
    const downloadUrl = ApiClient.getWikiDownloadLink(taskId, format);
    
    // 创建临时链接并点击
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.target = '_blank';
    a.download = `wiki_result_${taskId.substring(0, 8)}.${format}`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
    }, 100);
}

// 21. 显示维基百科任务错误
function showWikiTaskError(taskId) {
    ApiClient.getWikiTaskStatus(taskId)
        .then(task => {
            if (task.error) {
                Swal.fire({
                    title: '任务错误',
                    html: `<div class="text-danger">${task.error}</div>
                          ${task.traceback ? `<div class="mt-3"><strong>错误详情:</strong>
                          <pre class="text-start bg-light p-2 mt-2" style="max-height: 300px; overflow-y: auto;">${task.traceback}</pre></div>` : ''}`,
                    width: 800,
                    confirmButtonText: '关闭'
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: '无错误信息',
                    text: '未找到此任务的错误信息',
                    confirmButtonText: '确定'
                });
            }
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: '获取错误信息失败',
                text: error.message || '获取任务错误信息时发生错误',
                confirmButtonText: '确定'
            });
        });
}

// 22. 显示维基百科任务详情
function showWikiTaskDetails(taskId) {
    ApiClient.getWikiTaskStatus(taskId)
        .then(task => {
            const details = task.details || {};
            const htmlContent = `
                <div class="task-details">
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>任务ID:</strong></div>
                        <div class="col-6 text-start">${task.id}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>任务类型:</strong></div>
                        <div class="col-6 text-start">${details.type || '未知'}</div>
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
                        <div class="col-6 text-start"><strong>语言版本:</strong></div>
                        <div class="col-6 text-start">${details.language || 'zh'}</div>
                    </div>
                    ${details.category ? `
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>爬取分类:</strong></div>
                        <div class="col-6 text-start">${details.category}</div>
                    </div>
                    ` : ''}
                    ${details.depth !== undefined ? `
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>爬取深度:</strong></div>
                        <div class="col-6 text-start">${details.depth}</div>
                    </div>
                    ` : ''}
                    ${details.categories_count !== undefined ? `
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>分类数量:</strong></div>
                        <div class="col-6 text-start">${details.categories_count}</div>
                    </div>
                    ` : ''}
                    ${details.pages_count !== undefined ? `
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>页面数量:</strong></div>
                        <div class="col-6 text-start">${details.pages_count}</div>
                    </div>
                    ` : ''}
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>创建时间:</strong></div>
                        <div class="col-6 text-start">${task.created_at ? new Date(task.created_at).toLocaleString() : '-'}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>开始时间:</strong></div>
                        <div class="col-6 text-start">${task.start_time ? new Date(task.start_time).toLocaleString() : '-'}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6 text-start"><strong>结束时间:</strong></div>
                        <div class="col-6 text-start">${task.end_time ? new Date(task.end_time).toLocaleString() : '-'}</div>
                    </div>
                </div>
            `;
            
            Swal.fire({
                title: '任务详情',
                html: htmlContent,
                width: 600,
                confirmButtonText: '关闭'
            });
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: '获取任务详情失败',
                text: error.message || '获取任务详情时发生错误',
                confirmButtonText: '确定'
            });
        });
}

// 23. 渲染维基百科内容类型饼图
function renderWikiContentTypeChart(result) {
    if (!window.Chart) {
        console.error('Chart.js未加载');
        return;
    }
    
    // 获取画布上下文
    const ctx = document.getElementById('wikiContentTypeChart');
    if (!ctx) return;
    
    // 计算内容类型计数
    const contentPages = result.content.filter(item => !item.url.includes('Category:') && !item.url.includes('Special:'));
    const categoryPages = result.content.filter(item => item.url.includes('Category:'));
    const specialPages = result.content.filter(item => item.url.includes('Special:'));
    
    // 创建图表实例
    const chart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['内容页面', '分类页面', '特殊页面'],
            datasets: [{
                data: [contentPages.length, categoryPages.length, specialPages.length],
                backgroundColor: [
                    '#36a2eb',  // 蓝色 - 内容页面
                    '#ff6384',  // 红色 - 分类页面
                    '#ffcd56'   // 黄色 - 特殊页面
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
    
    // 保存图表实例以便后续更新
    window.wikiContentTypeChart = chart;
}

// 24. 渲染维基百科关键词云（继续）
function renderWikiKeywordsCloud(result) {
    // 获取容器
    const container = document.getElementById('wikiKeywordsCloud');
    if (!container) return;
    
    // 收集所有关键词并计算频率
    const keywordFrequency = {};
    result.content.forEach(item => {
        if (item.keywords && Array.isArray(item.keywords)) {
            item.keywords.forEach(keyword => {
                keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
            });
        }
    });
    
    // 如果没有关键词
    if (Object.keys(keywordFrequency).length === 0) {
        container.innerHTML = '<div class="text-center py-3"><p class="text-muted">没有关键词数据</p></div>';
        return;
    }
    
    // 格式化关键词云数据
    const cloudData = Object.entries(keywordFrequency).map(([keyword, frequency]) => ({
        tag: keyword,
        weight: frequency
    }));
    
    // 如果有jQCloud库，使用它来渲染关键词云
    if (typeof $ !== 'undefined' && $.fn.jQCloud) {
        // 清空容器
        $(container).empty();
        
        // 渲染关键词云
        $(container).jQCloud(cloudData, {
            width: container.clientWidth,
            height: 300,
            colors: ["#36a2eb", "#ff6384", "#4bc0c0", "#ffcd56", "#9966ff"]
        });
    } else {
        // 备用方案：使用简单的方式显示关键词
        let html = '<div class="keyword-cloud-fallback">';
        
        // 按频率排序
        cloudData.sort((a, b) => b.weight - a.weight);
        
        // 只显示前50个关键词
        const displayKeywords = cloudData.slice(0, 50);
        
        // 找出最大和最小频率
        const maxFreq = Math.max(...displayKeywords.map(kw => kw.weight));
        const minFreq = Math.min(...displayKeywords.map(kw => kw.weight));
        
        // 计算字体大小范围
        const fontSizeRange = {min: 12, max: 36};
        
        // 渲染关键词
        displayKeywords.forEach(item => {
            // 计算字体大小
            const fontSize = minFreq === maxFreq ? 
                fontSizeRange.min :
                fontSizeRange.min + (fontSizeRange.max - fontSizeRange.min) * (item.weight - minFreq) / (maxFreq - minFreq);
                
            html += `<span class="keyword-cloud-item" style="font-size: ${fontSize}px;">${item.tag}</span>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
}

// 25. 生成维基百科链接关系图
function generateWikiLinkGraph(result) {
    // 获取图表容器
    const container = document.getElementById('wikiLinkGraph');
    if (!container) return;
    
    // 显示加载中状态
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">生成关系图谱中...</p>
        </div>
    `;
    
    // 分析页面间的链接关系
    setTimeout(() => {
        // 构建节点和链接数据
        const nodes = [];
        const links = [];
        const nodeMap = new Map(); // 用于快速查找节点索引
        
        // 首先添加所有页面作为节点
        result.content.forEach((page, index) => {
            if (!page.url) return;
            
            const node = {
                id: index,
                name: page.title || '无标题',
                url: page.url,
                type: page.url.includes('Category:') ? 'category' : 'page',
                value: 1 // 初始值
            };
            
            nodes.push(node);
            nodeMap.set(page.url, index);
        });
        
        // 然后分析页面内容中的链接，建立连接关系
        result.content.forEach((page, sourceIndex) => {
            if (!page.content) return;
            
            // 简单的链接提取
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = page.content;
            
            // 获取所有链接
            const links = tempDiv.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (!href) return;
                
                // 构建完整URL
                let fullUrl;
                if (href.startsWith('http')) {
                    fullUrl = href;
                } else if (href.startsWith('/wiki/')) {
                    // 相对URL，转为绝对URL
                    const baseUrl = new URL(page.url);
                    fullUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
                } else {
                    return; // 忽略其他类型的链接
                }
                
                // 检查目标URL是否在我们的节点列表中
                const targetIndex = nodeMap.get(fullUrl);
                if (targetIndex !== undefined && targetIndex !== sourceIndex) {
                    // 添加连接
                    links.push({
                        source: sourceIndex,
                        target: targetIndex,
                        value: 1 // 连接强度
                    });
                    
                    // 增加目标节点的值（表示被引用次数）
                    nodes[targetIndex].value++;
                }
            });
        });
        
        // 如果有可视化库（如D3.js、ECharts等），使用它们来渲染关系图
        if (typeof echarts !== 'undefined') {
            // 使用ECharts渲染图谱
            const myChart = echarts.init(container);
            
            const option = {
                title: {
                    text: '维基百科页面关系图谱',
                    subtext: `共 ${nodes.length} 个节点, ${links.length} 个连接`,
                    left: 'center'
                },
                tooltip: {
                    formatter: function(params) {
                        if (params.dataType === 'node') {
                            return `<div>${params.data.name}</div>`;
                        } else {
                            return `<div>${nodes[params.data.source].name} → ${nodes[params.data.target].name}</div>`;
                        }
                    }
                },
                legend: {
                    data: ['页面', '分类'],
                    orient: 'vertical',
                    right: 10,
                    top: 20
                },
                series: [{
                    name: '关系图谱',
                    type: 'graph',
                    layout: 'force',
                    data: nodes.map(node => ({
                        id: node.id,
                        name: node.name,
                        value: node.value,
                        symbolSize: 10 + Math.min(node.value * 3, 20),
                        category: node.type === 'category' ? 1 : 0,
                        label: {
                            show: node.value > 2 // 只显示重要节点的标签
                        }
                    })),
                    links: links,
                    categories: [
                        { name: '页面' },
                        { name: '分类' }
                    ],
                    roam: true,
                    force: {
                        repulsion: 100,
                        edgeLength: 30
                    },
                    emphasis: {
                        focus: 'adjacency',
                        lineStyle: {
                            width: 4
                        }
                    }
                }]
            };
            
            myChart.setOption(option);
            
            // 保存图表实例
            window.wikiLinkGraph = myChart;
            
            // 添加窗口大小变化时的自适应调整
            window.addEventListener('resize', function() {
                myChart.resize();
            });
        } else {
            // 备用方案：显示简单的统计信息
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> 需要ECharts库来渲染关系图谱
                </div>
                <div class="text-center">
                    <p>节点总数: ${nodes.length}</p>
                    <p>连接总数: ${links.length}</p>
                    <p>页面数: ${nodes.filter(n => n.type === 'page').length}</p>
                    <p>分类数: ${nodes.filter(n => n.type === 'category').length}</p>
                </div>
            `;
        }
    }, 500); // 使用setTimeout让UI有机会显示加载状态
}

// 26. 生成维基百科分类树
function generateWikiCategoryTree(rootCategory) {
    // 获取可视化容器
    const container = document.getElementById('wiki-visualization-container');
    if (!container) return;
    
    // 获取是否包含页面
    const includePages = document.getElementById('wiki-tree-include-pages').checked;
    
    // 显示加载中状态
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">正在获取维基百科分类结构，请稍候...</p>
        </div>
    `;
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 调用API获取分类树
    ApiClient.getWikiCategoryTree(rootCategory, {
        language: language,
        include_pages: includePages,
        depth: 2
    })
        .then(result => {
            if (!result || !result.root) {
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i> 未能获取分类树
                    </div>
                `;
                return;
            }
            
            // 渲染分类树
            renderCategoryTree(result, container);
        })
        .catch(error => {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 获取分类树失败: ${error.message || '未知错误'}
                </div>
            `;
        });
    
    // 渲染分类树
    function renderCategoryTree(treeData, container) {
        // 如果有ECharts库
        if (typeof echarts !== 'undefined') {
            // 使用ECharts渲染树形图
            const myChart = echarts.init(container);
            
            // 转换数据格式为ECharts树图所需的格式
            function convertToEChartsTree(node) {
                const result = {
                    name: node.name,
                    value: node.type,
                    children: []
                };
                
                // 添加子分类
                if (node.children && node.children.length > 0) {
                    result.children = node.children.map(child => convertToEChartsTree(child));
                }
                
                // 添加页面
                if (node.pages && node.pages.length > 0) {
                    node.pages.forEach(page => {
                        result.children.push({
                            name: page.title,
                            value: 'page'
                        });
                    });
                }
                
                return result;
            }
            
            const treeDataForECharts = convertToEChartsTree(treeData.root);
            
            const option = {
                title: {
                    text: `维基百科分类树: ${treeData.root.name}`,
                    left: 'center'
                },
                tooltip: {
                    formatter: function(params) {
                        return `<div>${params.data.name}</div>`;
                    }
                },
                series: [{
                    type: 'tree',
                    data: [treeDataForECharts],
                    top: '10%',
                    left: '8%',
                    bottom: '22%',
                    right: '20%',
                    symbolSize: 7,
                    label: {
                        position: 'left',
                        verticalAlign: 'middle',
                        align: 'right',
                        fontSize: 12
                    },
                    leaves: {
                        label: {
                            position: 'right',
                            verticalAlign: 'middle',
                            align: 'left'
                        }
                    },
                    initialTreeDepth: 2,
                    expandAndCollapse: true,
                    animationDuration: 550,
                    animationDurationUpdate: 750
                }]
            };
            
            myChart.setOption(option);
            
            // 保存图表实例
            window.wikiCategoryTreeChart = myChart;
            
            // 添加窗口大小变化时的自适应调整
            window.addEventListener('resize', function() {
                myChart.resize();
            });
        } else {
            // 备用方案：显示简单的分类树
            function renderSimpleTree(node, level = 0) {
                const indent = '&nbsp;'.repeat(level * 4);
                let html = `<div class="tree-node" style="padding-left: ${level * 20}px;">`;
                
                // 添加节点图标和名称
                html += `<i class="bi bi-folder"></i> ${node.name}`;
                
                // 添加子节点
                if (node.children && node.children.length > 0) {
                    html += '<div class="tree-children">';
                    node.children.forEach(child => {
                        html += renderSimpleTree(child, level + 1);
                    });
                    html += '</div>';
                }
                
                // 添加页面
                if (includePages && node.pages && node.pages.length > 0) {
                    html += '<div class="tree-pages">';
                    node.pages.forEach(page => {
                        html += `<div class="tree-page" style="padding-left: ${(level + 1) * 20}px;"><i class="bi bi-file-text"></i> ${page.title}</div>`;
                    });
                    html += '</div>';
                }
                
                html += '</div>';
                return html;
            }
            
            container.innerHTML = `
                <div class="simple-tree-container">
                    <h4>维基百科分类树: ${treeData.root.name}</h4>
                    <div class="simple-tree">
                        ${renderSimpleTree(treeData.root)}
                    </div>
                </div>
            `;
        }
    }
}

// 27. 查找维基百科页面路径
function findWikiPagePath(sourcePage, targetPage) {
    // 获取可视化容器
    const container = document.getElementById('wiki-visualization-container');
    if (!container) return;
    
    // 获取选中的语言
    const language = document.getElementById('wiki-language-selector').value || 'zh';
    
    // 显示加载中状态
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">正在查找页面路径，这可能需要一些时间...</p>
        </div>
    `;
    
    // 调用API查找路径
    ApiClient.findWikiPagePath(sourcePage, targetPage, { language: language })
        .then(result => {
            if (!result || !result.path || result.path.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i> 未能找到从"${sourcePage}"到"${targetPage}"的路径
                    </div>
                `;
                return;
            }
            
            // 渲染路径
            renderPagePath(result, container);
        })
        .catch(error => {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-circle"></i> 查找路径失败: ${error.message || '未知错误'}
                </div>
            `;
        });
    
    // 渲染页面路径
    function renderPagePath(pathData, container) {
        // 如果有ECharts库
        if (typeof echarts !== 'undefined') {
            // 使用ECharts渲染路径图
            const myChart = echarts.init(container);
            
            // 准备节点和链接数据
            const nodes = pathData.path.map((page, index) => ({
                id: index,
                name: page.title,
                value: index === 0 || index === pathData.path.length - 1 ? 2 : 1,
                category: index === 0 ? 0 : (index === pathData.path.length - 1 ? 1 : 2)
            }));
            
            const links = [];
            for (let i = 0; i < pathData.path.length - 1; i++) {
                links.push({
                    source: i,
                    target: i + 1
                });
            }
            
            const option = {
                title: {
                    text: `维基百科页面路径: ${sourcePage} → ${targetPage}`,
                    subtext: `路径长度: ${pathData.path.length - 1} 步`,
                    left: 'center'
                },
                tooltip: {
                    formatter: function(params) {
                        return `<div>${params.data.name}</div>`;
                    }
                },
                legend: {
                    data: ['起点', '终点', '中间节点'],
                    orient: 'vertical',
                    right: 10,
                    top: 20
                },
                series: [{
                    name: '页面路径',
                    type: 'graph',
                    layout: 'force',
                    data: nodes.map(node => ({
                        id: node.id,
                        name: node.name,
                        value: node.value,
                        symbolSize: node.value === 2 ? 20 : 15,
                        category: node.category,
                        label: {
                            show: true
                        }
                    })),
                    links: links,
                    categories: [
                        { name: '起点' },
                        { name: '终点' },
                        { name: '中间节点' }
                    ],
                    roam: true,
                    force: {
                        repulsion: 100,
                        edgeLength: 100
                    },
                    lineStyle: {
                        color: 'source',
                        curveness: 0.3
                    },
                    emphasis: {
                        focus: 'adjacency',
                        lineStyle: {
                            width: 4
                        }
                    }
                }]
            };
            
            myChart.setOption(option);
            
            // 保存图表实例
            window.wikiPagePathChart = myChart;
            
            // 添加窗口大小变化时的自适应调整
            window.addEventListener('resize', function() {
                myChart.resize();
            });
        } else {
            // 备用方案：显示简单的路径
            let html = `
                <div class="wiki-path-container">
                    <h4>从 "${sourcePage}" 到 "${targetPage}" 的路径</h4>
                    <p>路径长度: ${pathData.path.length - 1} 步</p>
                    <div class="wiki-path">
            `;
            
            pathData.path.forEach((page, index) => {
                html += `
                    <div class="wiki-path-node">
                        <div class="wiki-path-icon">
                            ${index === 0 ? '<i class="bi bi-house-fill"></i>' : 
                              (index === pathData.path.length - 1 ? '<i class="bi bi-flag-fill"></i>' : 
                               `<span class="step-number">${index}</span>`)}
                        </div>
                        <div class="wiki-path-content">
                            <div class="wiki-path-title">${page.title}</div>
                            <div class="wiki-path-url">
                                <a href="${page.url}" target="_blank">${page.url}</a>
                            </div>
                        </div>
                    </div>
                `;
                
                // 添加连接线（除了最后一个节点）
                if (index < pathData.path.length - 1) {
                    html += '<div class="wiki-path-connector"><i class="bi bi-arrow-down"></i></div>';
                }
            });
            
            html += `
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        }
    }
}

// 28. HTML内容安全过滤函数
function sanitizeHtml(html) {
    if (!html) return '';
    
    // 创建临时元素
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 移除所有脚本标签
    const scripts = tempDiv.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // 移除所有iframe标签
    const iframes = tempDiv.querySelectorAll('iframe');
    iframes.forEach(iframe => iframe.remove());
    
    // 移除on*事件属性
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
        // 获取所有属性
        const attributes = el.attributes;
        const attributesToRemove = [];
        
        // 收集需要移除的属性
        for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            if (attr.name.startsWith('on')) {
                attributesToRemove.push(attr.name);
            }
            // 移除javascript:协议
            if (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
                attributesToRemove.push(attr.name);
            }
        }
        
        // 移除收集的属性
        attributesToRemove.forEach(attrName => {
            el.removeAttribute(attrName);
        });
    });
    
    return tempDiv.innerHTML;
}

// 29. 为API客户端添加维基百科相关接口
if (window.ApiClient) {
    // 搜索维基百科
    ApiClient.searchWiki = async function(query, options = {}) {
        try {
            const params = new URLSearchParams({
                query: query,
                language: options.language || 'zh',
                limit: options.limit || 10
            });
            
            const response = await fetch(`${API_BASE_URL}/wiki/search?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '搜索失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('搜索维基百科出错:', error);
            throw error;
        }
    };
    
    // 获取随机维基百科页面
    ApiClient.getRandomWikiPages = async function(options = {}) {
        try {
            const params = new URLSearchParams({
                count: options.count || 5,
                language: options.language || 'zh'
            });
            
            const response = await fetch(`${API_BASE_URL}/wiki/random?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取随机页面失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取随机维基百科页面出错:', error);
            throw error;
        }
    };
    
    // 提交维基百科爬取任务
    ApiClient.submitWikiTask = async function(config) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '提交任务失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('提交维基百科爬取任务出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科爬取任务状态
    ApiClient.getWikiTaskStatus = async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/status/${taskId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务状态失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科任务状态出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科爬取任务结果
    ApiClient.getWikiTaskResult = async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/result/${taskId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务结果失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科任务结果出错:', error);
            throw error;
        }
    };
    
    // 取消维基百科爬取任务
    ApiClient.cancelWikiTask = async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/cancel/${taskId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '取消任务失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('取消维基百科任务出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科任务列表
    ApiClient.getWikiTasks = async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/tasks`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务列表失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科任务列表出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科下载链接
    ApiClient.getWikiDownloadLink = function(taskId, format = 'json') {
        return `${API_BASE_URL}/wiki/download/${taskId}?format=${format}`;
    };
    
    // 提取维基百科页面结构化信息
    ApiClient.extractWikiStructuredInfo = async function(url) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '提取结构化信息失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('提取维基百科结构化信息出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科支持的语言列表
    ApiClient.getWikiLanguages = async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/languages`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取语言列表失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科语言列表出错:', error);
            throw error;
        }
    };
    
    // 获取维基百科分类树（继续）
    ApiClient.getWikiCategoryTree = async function(rootCategory, options = {}) {
        try {
            const params = new URLSearchParams({
                category: rootCategory,
                language: options.language || 'zh',
                depth: options.depth || 2,
                include_pages: options.include_pages ? 1 : 0
            });
            
            const response = await fetch(`${API_BASE_URL}/wiki/category-tree?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取分类树失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科分类树出错:', error);
            throw error;
        }
    };
    
    // 查找维基百科页面路径
    ApiClient.findWikiPagePath = async function(sourcePage, targetPage, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source: sourcePage,
                    target: targetPage,
                    language: options.language || 'zh'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '查找路径失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('查找维基百科页面路径出错:', error);
            throw error;
        }
    };
}

// 30. 绑定维基百科可视化界面事件
function initWikiVisualization() {
    // 分类树生成按钮
    const treeGenerateBtn = document.getElementById('wiki-tree-generate-btn');
    if (treeGenerateBtn) {
        treeGenerateBtn.addEventListener('click', function() {
            const rootCategory = document.getElementById('wiki-tree-root').value.trim();
            if (rootCategory) {
                generateWikiCategoryTree(rootCategory);
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: '请输入根分类',
                    text: '请输入要生成树的分类名称',
                    confirmButtonText: '确定'
                });
            }
        });
    }
    
    // 页面路径查找按钮
    const pathFindBtn = document.getElementById('wiki-path-find-btn');
    if (pathFindBtn) {
        pathFindBtn.addEventListener('click', function() {
            const sourcePage = document.getElementById('wiki-path-source').value.trim();
            const targetPage = document.getElementById('wiki-path-target').value.trim();
            
            if (sourcePage && targetPage) {
                findWikiPagePath(sourcePage, targetPage);
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: '输入不完整',
                    text: '请输入源页面和目标页面',
                    confirmButtonText: '确定'
                });
            }
        });
    }
}

});
