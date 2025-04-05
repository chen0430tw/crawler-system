// UI管理脚本 - 整合设置和界面控制功能

document.addEventListener('DOMContentLoaded', function() {
    // 初始化设置
    initializeSettings();
    // 初始化标签页切换
    initializeTabs();
    // 检查服务器状态
    checkServerStatus();
});

/**
 * 初始化设置面板功能
 */
function initializeSettings() {
    // 基础设置选项
    const settingsElements = {
        // 主题设置
        themeSelector: document.getElementById('theme-selector'),
        // 背景选项
        bgOptions: document.querySelectorAll('.bg-option'),
        customBgUpload: document.getElementById('custom-bg-upload'),
        // 透明度设置
        opacityOptions: document.querySelectorAll('.opacity-option'),
        // 毛玻璃效果
        glassEffectToggle: document.getElementById('glass-effect-toggle'),
        // 界面元素显示控制
        toggleAssistant: document.getElementById('toggle-assistant'),
        toggleAnnouncements: document.getElementById('toggle-announcements'),
        toggleRecommendations: document.getElementById('toggle-recommendations'),
        // 侧边栏区域
        assistantSection: document.getElementById('assistantSection'),
        announcementSection: document.getElementById('announcementSection'),
        recommendationSection: document.getElementById('recommendationSection'),
        sidebarExtras: document.getElementById('sidebarExtras')
    };
    
    // 初始化从本地存储加载设置
    loadSettings(settingsElements);
    
    // 绑定设置事件
    bindSettingsEvents(settingsElements);
}

/**
 * 从本地存储加载设置
 */
function loadSettings(elements) {
    // 加载主题
    const savedTheme = localStorage.getItem('theme') || 'theme-default';
    if (elements.themeSelector) {
        elements.themeSelector.value = savedTheme;
        applyTheme(savedTheme);
    }
    
    // 加载背景
    const savedBg = localStorage.getItem('background') || 'bg-image-none';
    if (elements.bgOptions) {
        applyBackground(savedBg);
        elements.bgOptions.forEach(option => {
            if (option.dataset.bg === savedBg) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    // 加载透明度
    const savedOpacity = localStorage.getItem('opacity') || 'content-opacity-100';
    if (elements.opacityOptions) {
        applyOpacity(savedOpacity);
        elements.opacityOptions.forEach(option => {
            if (option.dataset.opacity === savedOpacity) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    // 加载毛玻璃效果
    const glassEffect = localStorage.getItem('glassEffect') === 'true';
    if (elements.glassEffectToggle) {
        elements.glassEffectToggle.checked = glassEffect;
        applyGlassEffect(glassEffect);
    }
    
    // 加载界面元素显示设置
    const showAssistant = localStorage.getItem('showAssistant') === 'true';
    const showAnnouncements = localStorage.getItem('showAnnouncements') === 'true';
    const showRecommendations = localStorage.getItem('showRecommendations') === 'true';
    
    if (elements.toggleAssistant) {
        elements.toggleAssistant.checked = showAssistant;
    }
    if (elements.toggleAnnouncements) {
        elements.toggleAnnouncements.checked = showAnnouncements;
    }
    if (elements.toggleRecommendations) {
        elements.toggleRecommendations.checked = showRecommendations;
    }
    
    // 应用元素显示状态
    updateSectionsVisibility(elements, showAssistant, showAnnouncements, showRecommendations);
}

/**
 * 绑定设置事件
 */
function bindSettingsEvents(elements) {
    // 主题切换
    if (elements.themeSelector) {
        elements.themeSelector.addEventListener('change', function() {
            const theme = this.value;
            applyTheme(theme);
            localStorage.setItem('theme', theme);
        });
    }
    
    // 背景切换
    if (elements.bgOptions) {
        elements.bgOptions.forEach(option => {
            option.addEventListener('click', function() {
                const bg = this.dataset.bg;
                elements.bgOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                applyBackground(bg);
                localStorage.setItem('background', bg);
            });
        });
    }
    
    // 自定义背景上传
    if (elements.customBgUpload) {
        elements.customBgUpload.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const customBgUrl = e.target.result;
                    document.body.style.backgroundImage = `url(${customBgUrl})`;
                    document.body.classList.add('custom-bg');
                    
                    // 更新背景选项状态
                    elements.bgOptions.forEach(opt => opt.classList.remove('active'));
                    const customOption = document.querySelector('.bg-option[data-bg="bg-image-custom"]');
                    if (customOption) {
                        customOption.classList.add('active');
                    }
                    
                    localStorage.setItem('background', 'bg-image-custom');
                    localStorage.setItem('customBackground', customBgUrl);
                };
                
                reader.readAsDataURL(file);
            }
        });
    }
    
    // 透明度切换
    if (elements.opacityOptions) {
        elements.opacityOptions.forEach(option => {
            option.addEventListener('click', function() {
                const opacity = this.dataset.opacity;
                elements.opacityOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                applyOpacity(opacity);
                localStorage.setItem('opacity', opacity);
            });
        });
    }
    
    // 毛玻璃效果切换
    if (elements.glassEffectToggle) {
        elements.glassEffectToggle.addEventListener('change', function() {
            const enabled = this.checked;
            applyGlassEffect(enabled);
            localStorage.setItem('glassEffect', enabled);
        });
    }
    
    // 界面元素显示切换
    if (elements.toggleAssistant) {
        elements.toggleAssistant.addEventListener('change', function() {
            const show = this.checked;
            localStorage.setItem('showAssistant', show);
            updateSectionsVisibility(elements, 
                show, 
                elements.toggleAnnouncements ? elements.toggleAnnouncements.checked : false, 
                elements.toggleRecommendations ? elements.toggleRecommendations.checked : false
            );
        });
    }
    
    if (elements.toggleAnnouncements) {
        elements.toggleAnnouncements.addEventListener('change', function() {
            const show = this.checked;
            localStorage.setItem('showAnnouncements', show);
            updateSectionsVisibility(elements, 
                elements.toggleAssistant ? elements.toggleAssistant.checked : false,
                show, 
                elements.toggleRecommendations ? elements.toggleRecommendations.checked : false
            );
        });
    }
    
    if (elements.toggleRecommendations) {
        elements.toggleRecommendations.addEventListener('change', function() {
            const show = this.checked;
            localStorage.setItem('showRecommendations', show);
            updateSectionsVisibility(elements, 
                elements.toggleAssistant ? elements.toggleAssistant.checked : false,
                elements.toggleAnnouncements ? elements.toggleAnnouncements.checked : false,
                show
            );
        });
    }
}

/**
 * 初始化标签页切换功能
 */
function initializeTabs() {
    // 任务列表标签页点击时刷新列表
    const tasksTab = document.getElementById('tasks-tab');
    if (tasksTab) {
        tasksTab.addEventListener('shown.bs.tab', function() {
            if (typeof refreshTaskList === 'function') {
                refreshTaskList();
            }
        });
    }
}

/**
 * 应用主题
 */
function applyTheme(theme) {
    // 移除所有主题类
    document.body.classList.remove(
        'theme-default', 
        'theme-dark', 
        'theme-blue', 
        'theme-purple', 
        'theme-green'
    );
    
    // 添加选中的主题类
    document.body.classList.add(theme);
    
    // 触发主题变更事件
    const event = new CustomEvent('themeChanged', { detail: { theme } });
    document.dispatchEvent(event);
}

/**
 * 应用背景
 */
function applyBackground(bg) {
    // 移除所有背景类
    document.body.classList.remove(
        'bg-image-none',
        'bg-image-anime1',
        'bg-image-anime2',
        'bg-image-abstract',
        'bg-image-landscape',
        'bg-image-tech',
        'custom-bg'
    );
    
    // 清除自定义背景图片
    document.body.style.backgroundImage = '';
    
    // 对于自定义背景单独处理
    if (bg === 'bg-image-custom') {
        const customBgUrl = localStorage.getItem('customBackground');
        if (customBgUrl) {
            document.body.style.backgroundImage = `url(${customBgUrl})`;
            document.body.classList.add('custom-bg');
        }
    } else {
        // 添加选中的背景类
        document.body.classList.add(bg);
    }
}

/**
 * 应用透明度
 */
function applyOpacity(opacity) {
    // 移除所有透明度类
    document.body.classList.remove(
        'content-opacity-100',
        'content-opacity-90',
        'content-opacity-80',
        'content-opacity-70'
    );
    
    // 添加选中的透明度类
    document.body.classList.add(opacity);
}

/**
 * 应用毛玻璃效果
 */
function applyGlassEffect(enabled) {
    if (enabled) {
        document.body.classList.add('glass-effect');
    } else {
        document.body.classList.remove('glass-effect');
    }
}

/**
 * 更新侧边栏区域显示状态
 */
function updateSectionsVisibility(elements, showAssistant, showAnnouncements, showRecommendations) {
    if (elements.assistantSection) {
        if (showAssistant) {
            elements.assistantSection.classList.remove('d-none');
        } else {
            elements.assistantSection.classList.add('d-none');
        }
    }
    
    if (elements.announcementSection) {
        if (showAnnouncements) {
            elements.announcementSection.classList.remove('d-none');
        } else {
            elements.announcementSection.classList.add('d-none');
        }
    }
    
    if (elements.recommendationSection) {
        if (showRecommendations) {
            elements.recommendationSection.classList.remove('d-none');
        } else {
            elements.recommendationSection.classList.add('d-none');
        }
    }
    
    // 更新整个附加区域的显示状态
    if (elements.sidebarExtras) {
        const hasVisibleExtras = 
            (elements.assistantSection && !elements.assistantSection.classList.contains('d-none')) || 
            (elements.announcementSection && !elements.announcementSection.classList.contains('d-none')) || 
            (elements.recommendationSection && !elements.recommendationSection.classList.contains('d-none'));
        
        if (hasVisibleExtras) {
            elements.sidebarExtras.classList.remove('d-none');
        } else {
            elements.sidebarExtras.classList.add('d-none');
        }
    }
}

/**
 * 检查服务器状态
 */
function checkServerStatus() {
    const statusIndicator = document.getElementById('serverStatusIndicator');
    
    if (!statusIndicator) {
        return;
    }
    
    // 尝试调用健康检查API
    ApiClient.checkHealth()
        .then(health => {
            console.log("服务器状态:", health);
            
            // 更新状态指示器
            statusIndicator.classList.remove('bg-secondary', 'bg-danger');
            statusIndicator.classList.add('bg-success');
            statusIndicator.setAttribute('title', `服务器正常 - 活跃任务: ${health.active_tasks || 0}`);
        })
        .catch(error => {
            console.error("服务器连接失败:", error);
            
            // 更新状态指示器
            statusIndicator.classList.remove('bg-secondary', 'bg-success');
            statusIndicator.classList.add('bg-danger');
            statusIndicator.setAttribute('title', '服务器连接失败或未运行');
            
            // 提示用户
            if (!window.serverErrorShown) {
                window.serverErrorShown = true;
                
                Swal.fire({
                    icon: 'warning',
                    title: '服务器连接失败',
                    text: '无法连接到爬虫后端服务器，请确保服务器已启动。某些功能可能无法使用。',
                    confirmButtonText: '我知道了',
                    footer: '<a href="https://github.com/yourusername/crawler-system/wiki/troubleshooting" target="_blank">查看故障排除指南</a>'
                });
            }
        });
}

// 导出设置管理函数，供其他模块使用
window.UIManager = {
    applyTheme,
    applyBackground,
    applyOpacity,
    applyGlassEffect,
    checkServerStatus
};