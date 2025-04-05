// live2d-manager.js - 看板娘管理器

// 加载必要的Live2D脚本
function loadLive2DScripts() {
    return new Promise((resolve, reject) => {
        // 加载Live2D核心库
        const script1 = document.createElement('script');
        script1.src = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/live2d.min.js';
        script1.onload = () => {
            // 加载Live2D Widget
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.min.js';
            script2.onload = resolve;
            script2.onerror = reject;
            document.head.appendChild(script2);
        };
        script1.onerror = reject;
        document.head.appendChild(script1);
        
        // 加载CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu.min.css';
        document.head.appendChild(link);
    });
}

// 初始化看板娘
function initLive2D() {
    // 检查是否有Live2D容器
    const container = document.getElementById('live2d-widget');
    if (!container) return;
    
    // 加载脚本
    loadLive2DScripts()
        .then(() => {
            // 初始化对话框
            initLive2DDialog();
            
            // 配置参数
            const config = {
                waifuPath: 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.json',
                apiPath: 'https://live2d.fghrsh.net/api/',
                tools: []  // 不显示工具栏
            };
            
            // 启动Live2D
            if (typeof initWidget === 'function') {
                initWidget(config, container);
                
                // 添加样式以固定位置
                const canvasElement = container.querySelector('canvas');
                if (canvasElement) {
                    canvasElement.style.position = 'absolute';
                    canvasElement.style.left = '50%';
                    canvasElement.style.bottom = '0';
                    canvasElement.style.transform = 'translateX(-50%)';
                }
                
                // 添加事件监听器
                setupLive2DControls();
            } else {
                console.error('Live2D初始化失败：找不到initWidget函数');
                showFallbackMessage();
            }
        })
        .catch(error => {
            console.error('加载Live2D脚本失败:', error);
            showFallbackMessage();
        });
}

// 初始化对话框
function initLive2DDialog() {
    const container = document.getElementById('live2d-widget');
    if (!container) return;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'live2d-dialog';
    dialog.textContent = '你好，我是你的爬虫助手！';
    container.appendChild(dialog);
    
    // 创建输入框
    const inputContainer = document.createElement('div');
    inputContainer.className = 'live2d-input-container';
    inputContainer.innerHTML = `
        <div class="input-group input-group-sm">
            <input type="text" class="form-control" placeholder="和我聊天吧...">
            <button class="btn btn-primary" type="button">发送</button>
        </div>
    `;
    container.parentNode.appendChild(inputContainer);
    
    // 添加输入框事件
    const inputField = inputContainer.querySelector('input');
    const sendButton = inputContainer.querySelector('button');
    
    sendButton.addEventListener('click', function() {
        sendMessage(inputField.value);
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage(inputField.value);
        }
    });
    
    // 显示初始对话
    setTimeout(() => {
        showDialog('你好，我是你的爬虫助手！有什么可以帮你的吗？');
    }, 1000);
}

// 设置看板娘控制按钮
function setupLive2DControls() {
    // 更换模型按钮
    const changeModelBtn = document.querySelector('.change-model-btn');
    if (changeModelBtn) {
        changeModelBtn.addEventListener('click', function() {
            if (typeof loadOtherModel === 'function') {
                loadOtherModel();
                showDialog('换了一身新衣服，好看吗？');
            }
        });
    }
    
    // 对话按钮
    const toggleDialogBtn = document.querySelector('.toggle-dialog-btn');
    if (toggleDialogBtn) {
        toggleDialogBtn.addEventListener('click', function() {
            const inputContainer = document.querySelector('.live2d-input-container');
            if (inputContainer) {
                const isShowing = inputContainer.classList.toggle('show');
                
                if (isShowing) {
                    showDialog('想和我聊点什么呢？');
                    const inputField = inputContainer.querySelector('input');
                    if (inputField) {
                        inputField.focus();
                    }
                } else {
                    showDialog('下次再聊吧~');
                }
            }
        });
    }
}

// 显示对话框消息
function showDialog(message, duration = 4000) {
    const dialog = document.querySelector('.live2d-dialog');
    if (!dialog) return;
    
    // 设置消息
    dialog.textContent = message;
    
    // 显示对话框
    dialog.classList.add('show');
    
    // 自动隐藏
    clearTimeout(window.dialogTimeout);
    window.dialogTimeout = setTimeout(() => {
        dialog.classList.remove('show');
    }, duration);
}

// 发送消息并获取回复
function sendMessage(message) {
    if (!message || message.trim() === '') return;
    
    // 清除输入框
    const inputField = document.querySelector('.live2d-input-container input');
    if (inputField) {
        inputField.value = '';
    }
    
    // 显示用户消息
    showDialog(`你: ${message}`, 2000);
    
    // 简单的回复逻辑
    setTimeout(() => {
        const reply = getReply(message);
        showDialog(reply);
    }, 2000);
}

// 简单的回复生成逻辑
function getReply(message) {
    message = message.toLowerCase();
    
    // 检查关键词并返回相应回复
    if (message.includes('你好') || message.includes('嗨') || message.includes('hi') || message.includes('hello')) {
        return '你好呀！很高兴见到你~';
    }
    
    if (message.includes('名字') || message.includes('叫什么')) {
        return '我叫小拉拉，是全息拉普拉斯爬虫系统的助手！';
    }
    
    if (message.includes('爬虫') || message.includes('抓取') || message.includes('网页')) {
        return '要爬取网页很简单哦！只需在左侧输入URL，设置好爬取深度，然后点击"运行爬虫"按钮就可以了~';
    }
    
    if (message.includes('阴谋论') || message.includes('都市传说') || message.includes('检测')) {
        return '我们的系统可以分析网页内容，检测其中可能的阴谋论和都市传说成分。这是基于全息拉普拉斯互联网图理论呢！';
    }
    
    if (message.includes('设置') || message.includes('背景') || message.includes('主题')) {
        return '你可以在左侧面板中调整主题和背景设置，选择自己喜欢的风格哦~';
    }
    
    if (message.includes('谢谢') || message.includes('感谢')) {
        return '不客气，能帮到你我很开心！';
    }
    
    if (message.includes('拜拜') || message.includes('再见') || message.includes('goodbye')) {
        return '再见啦，有需要随时找我哦！';
    }
    
    // 默认回复
    const defaultReplies = [
        '嗯，这个问题很有趣呢~',
        '让我想想怎么回答好...',
        '你的问题太高深了，我还在学习中呢',
        '或许你可以尝试使用爬虫系统的其他功能？',
        '有关爬虫的问题我最拿手啦！',
        '你知道吗？本系统基于全息拉普拉斯互联网图理论哦！',
        '需要帮忙的话，随时告诉我~'
    ];
    
    return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
}

// 显示备用消息（加载失败时）
function showFallbackMessage() {
    const container = document.getElementById('live2d-widget');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="bi bi-emoji-smile" style="font-size: 3rem; color: var(--primary-color);"></i>
            <p class="mt-3">看板娘加载失败，请检查网络连接</p>
        </div>
    `;
}

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保页面其他部分已加载
    setTimeout(initLive2D, 1000);
});

// 主题变更时调整看板娘容器样式
document.addEventListener('themeChanged', function(e) {
    const container = document.querySelector('.live2d-widget-container');
    if (container) {
        // 透明度轻微变化，使背景适应主题
        container.style.backgroundColor = `rgba(var(--bg-rgb, 248, 249, 250), 0.5)`;
    }
});