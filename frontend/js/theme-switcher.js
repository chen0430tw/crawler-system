// theme-switcher.js - 主题切换器实现

// 创建全局图表实例存储对象
window.chartInstances = {};

document.addEventListener('DOMContentLoaded', function() {
    // 获取主题选择器和图标元素
    const themeSelector = document.getElementById('theme-selector');
    const themeIcon = document.querySelector('.theme-icon');
    
    // 主题图标映射
    const themeIcons = {
        'theme-default': '☀️',
        'theme-dark': '🌙',
        'theme-blue': '🌊',
        'theme-purple': '🔮',
        'theme-green': '🌿'
    };
    
    // 从本地存储中加载保存的主题
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
        themeSelector.value = savedTheme;
    }
    
    // 为主题选择器添加事件监听器
    themeSelector.addEventListener('change', function() {
        const selectedTheme = this.value;
        applyTheme(selectedTheme);
        
        // 保存选择的主题到本地存储
        localStorage.setItem('selectedTheme', selectedTheme);
    });
    
    // 应用主题到页面
    function applyTheme(themeName) {
        // 移除所有主题类
        document.body.classList.remove(
            'theme-default', 
            'theme-dark', 
            'theme-blue', 
            'theme-purple', 
            'theme-green'
        );
        
        // 添加选择的主题类
        document.body.classList.add(themeName);
        
        // 更新主题图标
        themeIcon.textContent = themeIcons[themeName] || '☀️';
        
        // 发出主题变更事件，供其他脚本响应
        const themeChangeEvent = new CustomEvent('themeChanged', {
            detail: { theme: themeName }
        });
        document.dispatchEvent(themeChangeEvent);
    }
    
    // 监听系统主题变更（如系统切换深色/浅色模式）
    const systemDarkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 如果用户未手动选择过主题，则根据系统设置选择
    if (!localStorage.getItem('selectedTheme')) {
        const initialTheme = systemDarkModeQuery.matches ? 'theme-dark' : 'theme-default';
        applyTheme(initialTheme);
        themeSelector.value = initialTheme;
    }
    
    // 当系统主题变更时，如果用户没有手动选择主题，则跟随系统变更
    systemDarkModeQuery.addEventListener('change', function(e) {
        if (!localStorage.getItem('selectedTheme')) {
            const newTheme = e.matches ? 'theme-dark' : 'theme-default';
            applyTheme(newTheme);
            themeSelector.value = newTheme;
        }
    });
});

// 为图表添加主题响应支持
document.addEventListener('themeChanged', function(e) {
    // 使用修改后的方法访问图表实例
    if (window.Chart && window.chartInstances) {
        // 遍历存储的图表实例
        Object.values(window.chartInstances).forEach(chart => {
            if (chart && typeof chart.update === 'function') {
                updateChartTheme(chart, e.detail.theme);
            }
        });
    }
});

// 更新图表主题
function updateChartTheme(chart, themeName) {
    if (!chart) return;
    
    // 检查图表类型
    const chartType = chart.config.type;
    
    // 定义不同主题的图表颜色
    const themeColors = {
        'theme-default': {
            backgroundColor: ['#0d6efd', '#ffc107', '#28a745', '#6c757d'],
            borderColor: ['#0d6efd', '#ffc107', '#28a745', '#6c757d'],
            grid: '#e0e0e0',
            text: '#333333'
        },
        'theme-dark': {
            backgroundColor: ['#3d8bfd', '#ffc107', '#5cb85c', '#adb5bd'],
            borderColor: ['#3d8bfd', '#ffc107', '#5cb85c', '#adb5bd'],
            grid: '#444444',
            text: '#f0f0f0'
        },
        'theme-blue': {
            backgroundColor: ['#0066cc', '#ffc107', '#28a745', '#5c88b9'],
            borderColor: ['#0066cc', '#ffc107', '#28a745', '#5c88b9'],
            grid: '#c5d9f1',
            text: '#14385e'
        },
        'theme-purple': {
            backgroundColor: ['#6f42c1', '#ffc107', '#28a745', '#9a6dd7'],
            borderColor: ['#6f42c1', '#ffc107', '#28a745', '#9a6dd7'],
            grid: '#e1d2f6',
            text: '#4a154b'
        },
        'theme-green': {
            backgroundColor: ['#198754', '#ffc107', '#dc3545', '#5cb085'],
            borderColor: ['#198754', '#ffc107', '#dc3545', '#5cb085'],
            grid: '#c3e6d6',
            text: '#0e503c'
        }
    };
    
    // 获取当前主题的颜色
    const colors = themeColors[themeName] || themeColors['theme-default'];
    
    // 根据图表类型应用不同的更新
    if (chartType === 'pie' || chartType === 'doughnut') {
        // 更新饼图颜色
        chart.data.datasets.forEach((dataset, i) => {
            dataset.backgroundColor = colors.backgroundColor;
            dataset.borderColor = colors.borderColor;
        });
    } else if (chartType === 'bar' || chartType === 'line') {
        // 更新柱状图/折线图数据集颜色
        chart.data.datasets.forEach((dataset, i) => {
            // 使用循环颜色，确保每个数据集有不同颜色
            const colorIndex = i % colors.backgroundColor.length;
            dataset.backgroundColor = colors.backgroundColor[colorIndex];
            dataset.borderColor = colors.borderColor[colorIndex];
        });
    } else if (chartType === 'radar') {
        // 雷达图特殊处理
        chart.data.datasets.forEach((dataset, i) => {
            const colorIndex = i % colors.backgroundColor.length;
            dataset.backgroundColor = `${colors.backgroundColor[colorIndex]}80`; // 添加透明度
            dataset.borderColor = colors.borderColor[colorIndex];
        });
    }
    
    // 更新图表选项中的颜色
    if (chart.options && chart.options.scales) {
        // 更新网格线颜色
        if (chart.options.scales.x) {
            chart.options.scales.x.grid = chart.options.scales.x.grid || {};
            chart.options.scales.x.grid.color = colors.grid;
            chart.options.scales.x.ticks = chart.options.scales.x.ticks || {};
            chart.options.scales.x.ticks.color = colors.text;
        }
        
        if (chart.options.scales.y) {
            chart.options.scales.y.grid = chart.options.scales.y.grid || {};
            chart.options.scales.y.grid.color = colors.grid;
            chart.options.scales.y.ticks = chart.options.scales.y.ticks || {};
            chart.options.scales.y.ticks.color = colors.text;
        }
    }
    
    // 更新图例颜色
    if (chart.options && chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels = chart.options.plugins.legend.labels || {};
        chart.options.plugins.legend.labels.color = colors.text;
    }
    
    // 更新标题颜色
    if (chart.options && chart.options.plugins && chart.options.plugins.title) {
        chart.options.plugins.title.color = colors.text;
    }
    
    // 更新图表
    try {
        chart.update();
    } catch (error) {
        console.warn('更新图表时发生错误:', error);
    }
}