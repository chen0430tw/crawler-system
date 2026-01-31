// live2d-manager.js - 看板娘管理器
// 使用 stevenjoezhang/live2d-widget CDN，覆盖定位到右下角，支持拖动

// 加载 Live2D CDN 脚本
function loadLive2DScripts() {
    return new Promise((resolve, reject) => {
        // 加载 Live2D 核心库
        const script1 = document.createElement('script');
        script1.src = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/live2d.min.js';
        script1.onload = () => {
            // 加载 Live2D Widget（会创建 initWidget 函数和 #waifu 元素）
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.min.js';
            script2.onload = resolve;
            script2.onerror = reject;
            document.head.appendChild(script2);
        };
        script1.onerror = reject;
        document.head.appendChild(script1);

        // 加载 CDN 基础样式（我们的 live2d-styles.css 会覆盖定位）
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu.min.css';
        document.head.appendChild(link);
    });
}

// 初始化看板娘
function initLive2D() {
    loadLive2DScripts()
        .then(() => {
            if (typeof initWidget === 'function') {
                initWidget({
                    waifuPath: 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.json',
                    apiPath: 'https://live2d.fghrsh.net/api/',
                    tools: []  // 不显示工具栏
                });

                // CDN 脚本会创建 #waifu 元素，等它出现后覆盖定位并添加拖动功能
                waitForElement('#waifu', function(waifuEl) {
                    // 用 inline style 强制覆盖 CDN 的 left:0 定位到右下角
                    waifuEl.style.position = 'fixed';
                    waifuEl.style.right = '20px';
                    waifuEl.style.bottom = '60px';
                    waifuEl.style.left = 'auto';
                    waifuEl.style.zIndex = '500';
                    setupDrag(waifuEl);
                    console.log('看板娘加载完成');
                });
            } else {
                console.error('Live2D初始化失败：找不到initWidget函数');
            }
        })
        .catch(error => {
            console.error('加载Live2D脚本失败:', error);
        });
}

// 等待 CDN 创建的 DOM 元素出现
function waitForElement(selector, callback, maxAttempts) {
    maxAttempts = maxAttempts || 20;
    var attempts = 0;
    var timer = setInterval(function() {
        var el = document.querySelector(selector);
        attempts++;
        if (el) {
            clearInterval(timer);
            callback(el);
        } else if (attempts >= maxAttempts) {
            clearInterval(timer);
            console.warn('等待元素超时:', selector);
        }
    }, 300);
}

// 拖动功能
function setupDrag(el) {
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var origRight = 0;
    var origBottom = 0;

    el.addEventListener('mousedown', function(e) {
        // 忽略来自 canvas 内部的点击（让 Live2D 模型交互正常工作）
        if (e.target.tagName === 'CANVAS') return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        var rect = el.getBoundingClientRect();
        origRight = window.innerWidth - rect.right;
        origBottom = window.innerHeight - rect.bottom;
        el.classList.add('dragging');
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        e.preventDefault();
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        // right 减少 = 向右移, dx 正 = 鼠标向右
        var newRight = origRight - dx;
        var newBottom = origBottom - dy;
        // 限制不超出视窗
        var maxRight = window.innerWidth - el.offsetWidth;
        var maxBottom = window.innerHeight - el.offsetHeight;
        newRight = Math.max(0, Math.min(newRight, maxRight));
        newBottom = Math.max(0, Math.min(newBottom, maxBottom));
        el.style.right = newRight + 'px';
        el.style.bottom = newBottom + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            el.classList.remove('dragging');
        }
    });

    // 触摸支持（移动端）
    el.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'CANVAS') return;
        var touch = e.touches[0];
        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        var rect = el.getBoundingClientRect();
        origRight = window.innerWidth - rect.right;
        origBottom = window.innerHeight - rect.bottom;
        el.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        var touch = e.touches[0];
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        var newRight = origRight - dx;
        var newBottom = origBottom - dy;
        var maxRight = window.innerWidth - el.offsetWidth;
        var maxBottom = window.innerHeight - el.offsetHeight;
        newRight = Math.max(0, Math.min(newRight, maxRight));
        newBottom = Math.max(0, Math.min(newBottom, maxBottom));
        el.style.right = newRight + 'px';
        el.style.bottom = newBottom + 'px';
    }, { passive: true });

    document.addEventListener('touchend', function() {
        if (isDragging) {
            isDragging = false;
            el.classList.remove('dragging');
        }
    });
}

// 显示/隐藏看板娘（由设置页面的 toggle 开关调用）
function showLive2D() {
    var el = document.getElementById('waifu');
    if (el) el.style.display = '';
}

function hideLive2D() {
    var el = document.getElementById('waifu');
    if (el) el.style.display = 'none';
}

// 不自动初始化，由 toggle-assistant 开关控制
// 外部调用 initLive2D() 来启动
