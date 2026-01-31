// live2d-manager.js - 看板娘管理器
// 使用 stevenjoezhang/live2d-widget 的 autoload.js

// Live2D 配置
var live2dConfig = {
    waifuPath: 'https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.json',
    cdnPath: 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/',
    tools: ['hitokoto', 'asteroids', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
    drag: true,
    logLevel: 'error'
};

// 加载 Live2D autoload 脚本
function loadLive2DScript() {
    return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 初始化看板娘
function initLive2D() {
    // 设置全局配置供 autoload.js 使用
    window.live2d_settings = live2dConfig;

    loadLive2DScript()
        .then(function() {
            // autoload.js 会自动初始化，等待 #waifu 元素出现后调整位置
            waitForElement('#waifu', function(waifuEl) {
                // 覆盖定位到右下角
                waifuEl.style.position = 'fixed';
                waifuEl.style.right = '20px';
                waifuEl.style.bottom = '60px';
                waifuEl.style.left = 'auto';
                waifuEl.style.zIndex = '500';
                console.log('看板娘加载完成');
            });
        })
        .catch(function(error) {
            console.error('加载Live2D脚本失败:', error);
            // 回退到手动加载方式
            loadLive2DManual();
        });
}

// 手动加载方式（回退方案）
function loadLive2DManual() {
    var script1 = document.createElement('script');
    script1.src = 'https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/live2d.min.js';
    script1.onload = function() {
        var script2 = document.createElement('script');
        script2.src = 'https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu-tips.js';
        script2.onload = function() {
            if (typeof initWidget === 'function') {
                initWidget({
                    waifuPath: live2dConfig.waifuPath,
                    cdnPath: live2dConfig.cdnPath,
                    tools: live2dConfig.tools
                });
                waitForElement('#waifu', function(waifuEl) {
                    waifuEl.style.position = 'fixed';
                    waifuEl.style.right = '20px';
                    waifuEl.style.bottom = '60px';
                    waifuEl.style.left = 'auto';
                    waifuEl.style.zIndex = '500';
                    if (live2dConfig.drag) {
                        setupDrag(waifuEl);
                    }
                    console.log('看板娘加载完成（手动模式）');
                });
            }
        };
        document.head.appendChild(script2);
    };
    document.head.appendChild(script1);

    // 加载样式
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/waifu.css';
    document.head.appendChild(link);
}

// 等待 DOM 元素出现
function waitForElement(selector, callback, maxAttempts) {
    maxAttempts = maxAttempts || 30;
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
    }, 200);
}

// 拖动功能（回退方案使用）
function setupDrag(el) {
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var origRight = 0;
    var origBottom = 0;

    el.addEventListener('mousedown', function(e) {
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
        var newRight = origRight - dx;
        var newBottom = origBottom - dy;
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

    // 触摸支持
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

// 显示/隐藏看板娘
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
