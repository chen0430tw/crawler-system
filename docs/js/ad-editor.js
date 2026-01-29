// ad-editor.js - 广告编辑器实现

// 仅当按下特定键组合（Ctrl+Shift+A）时激活编辑模式
document.addEventListener('keydown', function(e) {
    // 检查是否按下Ctrl+Shift+A
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        toggleEditMode();
    }
});

// 在DOM加载完成后初始化编辑器
document.addEventListener('DOMContentLoaded', function() {
    // 创建编辑模式指示器
    createEditModeElements();
    
    // 初始化所有广告块为可编辑
    initializeEditableAds();
    
    // 创建编辑面板
    createEditPanel();
});

// 创建编辑模式相关元素
function createEditModeElements() {
    // 创建编辑模式指示器
    const editModeIndicator = document.createElement('div');
    editModeIndicator.className = 'edit-mode';
    editModeIndicator.textContent = '广告编辑模式已启用';
    document.body.appendChild(editModeIndicator);
    
    // 创建编辑模式按钮
    const editModeBtn = document.createElement('button');
    editModeBtn.className = 'edit-mode-btn';
    editModeBtn.innerHTML = '<i class="bi bi-pencil"></i>';
    editModeBtn.title = '切换广告编辑模式';
    editModeBtn.addEventListener('click', toggleEditMode);
    document.body.appendChild(editModeBtn);
}

// 初始化所有广告块为可编辑
function initializeEditableAds() {
    const adContainers = document.querySelectorAll('.sidebar-ad');
    
    adContainers.forEach(container => {
        // 将广告容器标记为可编辑
        container.classList.add('editable');
        
        // 添加点击事件监听器，仅在编辑模式下生效
        container.addEventListener('click', function(e) {
            if (document.body.classList.contains('edit-active')) {
                e.preventDefault();
                e.stopPropagation();
                openEditPanel(this);
            }
        });
    });
}

// 创建编辑面板
function createEditPanel() {
    const editOverlay = document.createElement('div');
    editOverlay.className = 'edit-overlay';
    
    const editPanel = document.createElement('div');
    editPanel.className = 'edit-panel';
    
    editPanel.innerHTML = `
        <div class="edit-panel-header">
            <h3>编辑广告内容</h3>
            <button class="edit-panel-close">&times;</button>
        </div>
        <div class="edit-panel-content">
            <div class="mb-3">
                <label for="ad-title" class="form-label">广告标题</label>
                <input type="text" id="ad-title" class="form-control">
            </div>
            <div class="mb-3">
                <label for="ad-icon" class="form-label">图标类名</label>
                <input type="text" id="ad-icon" class="form-control" placeholder="例如: bi-megaphone">
            </div>
            <div class="mb-3">
                <label for="ad-content" class="form-label">广告内容 (HTML)</label>
                <textarea id="ad-content" class="form-control" rows="8"></textarea>
            </div>
        </div>
        <div class="edit-panel-actions">
            <button class="btn btn-secondary cancel-edit">取消</button>
            <button class="btn btn-primary save-edit">保存</button>
        </div>
    `;
    
    editOverlay.appendChild(editPanel);
    document.body.appendChild(editOverlay);
    
    // 关闭按钮事件
    editPanel.querySelector('.edit-panel-close').addEventListener('click', closeEditPanel);
    editPanel.querySelector('.cancel-edit').addEventListener('click', closeEditPanel);
    
    // 保存按钮事件
    editPanel.querySelector('.save-edit').addEventListener('click', saveAdChanges);
    
    // 点击遮罩层关闭
    editOverlay.addEventListener('click', function(e) {
        if (e.target === editOverlay) {
            closeEditPanel();
        }
    });
}

// 当前正在编辑的广告元素
let currentEditingAd = null;

// 打开编辑面板
function openEditPanel(adElement) {
    // 保存当前正在编辑的广告元素
    currentEditingAd = adElement;
    
    // 获取广告内容
    const headerElement = adElement.querySelector('.sidebar-ad-header');
    const contentElement = adElement.querySelector('.ad-content');
    
    // 提取标题（去除图标）
    const titleText = headerElement.textContent.trim();
    
    // 提取图标类名
    const iconElement = headerElement.querySelector('i');
    const iconClass = iconElement ? iconElement.className : '';
    
    // 获取内容HTML
    const contentHtml = contentElement.innerHTML;
    
    // 填充表单
    const editPanel = document.querySelector('.edit-panel');
    editPanel.querySelector('#ad-title').value = titleText;
    editPanel.querySelector('#ad-icon').value = iconClass;
    editPanel.querySelector('#ad-content').value = contentHtml;
    
    // 显示编辑面板
    document.querySelector('.edit-overlay').style.display = 'flex';
}

// 关闭编辑面板
function closeEditPanel() {
    document.querySelector('.edit-overlay').style.display = 'none';
    currentEditingAd = null;
}

// 保存广告更改
function saveAdChanges() {
    if (!currentEditingAd) return;
    
    // 获取表单值
    const editPanel = document.querySelector('.edit-panel');
    const title = editPanel.querySelector('#ad-title').value;
    const iconClass = editPanel.querySelector('#ad-icon').value;
    const content = editPanel.querySelector('#ad-content').value;
    
    // 更新广告标题
    const headerElement = currentEditingAd.querySelector('.sidebar-ad-header');
    headerElement.innerHTML = `<i class="${iconClass}"></i> ${title}`;
    
    // 更新广告内容
    const contentElement = currentEditingAd.querySelector('.ad-content');
    contentElement.innerHTML = content;
    
    // 保存广告数据到本地存储
    saveAdToLocalStorage(currentEditingAd);
    
    // 关闭编辑面板
    closeEditPanel();
    
    // 显示保存成功提示
    showSaveNotification();
}

// 保存广告数据到本地存储
function saveAdToLocalStorage(adElement) {
    // 获取所有保存的广告
    let savedAds = JSON.parse(localStorage.getItem('savedAds') || '{}');
    
    // 生成广告ID（如果不存在）
    if (!adElement.id) {
        adElement.id = 'ad-' + Date.now();
    }
    
    // 保存广告数据
    savedAds[adElement.id] = {
        title: adElement.querySelector('.sidebar-ad-header').textContent.trim(),
        icon: adElement.querySelector('.sidebar-ad-header i').className,
        content: adElement.querySelector('.ad-content').innerHTML
    };
    
    // 更新本地存储
    localStorage.setItem('savedAds', JSON.stringify(savedAds));
}

// 显示保存成功通知
function showSaveNotification() {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.innerHTML = '<div class="save-msg"><i class="bi bi-check-circle"></i> 广告内容已保存</div>';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 2000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s, transform 0.3s;
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // 3秒后移除
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 切换编辑模式
function toggleEditMode() {
    const isActive = document.body.classList.toggle('edit-active');
    const indicator = document.querySelector('.edit-mode');
    
    if (isActive) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

// 从本地存储中加载保存的广告
function loadSavedAds() {
    const savedAds = JSON.parse(localStorage.getItem('savedAds') || '{}');
    
    // 遍历所有已保存的广告
    for (const [adId, adData] of Object.entries(savedAds)) {
        // 查找匹配的广告元素
        const adElement = document.getElementById(adId);
        if (adElement) {
            // 更新广告内容
            const headerElement = adElement.querySelector('.sidebar-ad-header');
            const contentElement = adElement.querySelector('.ad-content');
            
            if (headerElement && contentElement) {
                headerElement.innerHTML = `<i class="${adData.icon}"></i> ${adData.title}`;
                contentElement.innerHTML = adData.content;
            }
        }
    }
}

// 页面加载时恢复保存的广告
window.addEventListener('load', loadSavedAds);
