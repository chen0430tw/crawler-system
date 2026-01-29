// background-manager.js - 更新版背景管理器

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM已加载完成，初始化背景管理器...");
    
    loadColorThiefScript()
        .then(() => console.log("ColorThief库加载成功"))
        .catch(err => console.warn("ColorThief库加载失败，将使用备选算法", err));

    initBackgroundSettings();
    loadBackgroundSettings();
});

// 动态加载ColorThief库
function loadColorThiefScript() {
    return new Promise((resolve, reject) => {
        if (window.ColorThief) {
            resolve(window.ColorThief);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.min.js';
        script.onload = () => resolve(window.ColorThief);
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });
}

// 添加颜色提取功能到上传控件
function addColorExtractionToUpload(uploadElement) {
    if (!uploadElement) {
        console.error("上传元素不存在!");
        return;
    }
    
    if (uploadElement.dataset.listenerAdded === "true") return;
    
    uploadElement.addEventListener('change', function() {
        console.log("上传控件变更事件触发");
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                extractColorsAndAdjustTheme(e.target.result);
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
    uploadElement.dataset.listenerAdded = "true";
    console.log("已添加颜色提取功能到上传控件");
}

// 初始化背景设置控件
function initBackgroundSettings() {
    console.log("初始化背景设置控件");
    const bgOptions = document.querySelectorAll('.bg-option');
    if (bgOptions.length > 0) {
        console.log(`找到 ${bgOptions.length} 个背景选项`);
        bgOptions.forEach(option => {
            option.addEventListener('click', function() {
                bgOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                const bgClass = this.getAttribute('data-bg');
                console.log(`选择背景: ${bgClass}`);
                setBodyBackground(bgClass);
                updateBackgroundPreview();
                saveBackgroundSettings();
            });
        });
    } else {
        console.warn("未找到背景选项元素");
    }
    
    const opacityOptions = document.querySelectorAll('.opacity-option');
    if (opacityOptions.length > 0) {
        console.log(`找到 ${opacityOptions.length} 个透明度选项`);
        opacityOptions.forEach(option => {
            option.addEventListener('click', function() {
                opacityOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                const opacityClass = this.getAttribute('data-opacity');
                console.log(`选择透明度: ${opacityClass}`);
                setContentOpacity(opacityClass);
                saveBackgroundSettings();
            });
        });
    } else {
        console.warn("未找到透明度选项元素");
    }
    
    const glassToggle = document.getElementById('glass-effect-toggle');
    if (glassToggle) {
        console.log("找到毛玻璃效果开关");
        glassToggle.addEventListener('change', function() {
            console.log(`毛玻璃效果: ${this.checked ? '开启' : '关闭'}`);
            setGlassEffect(this.checked);
            saveBackgroundSettings();
        });
    } else {
        console.warn("未找到毛玻璃效果开关");
    }
    
    // 自定义背景上传事件 - 修复版
    const customBgUpload = document.getElementById('custom-bg-upload');
    if (customBgUpload) {
        console.log("找到自定义背景上传元素");
        addColorExtractionToUpload(customBgUpload);
        
        customBgUpload.addEventListener('change', function(e) {
            console.log("自定义背景上传变更事件触发");
            const file = e.target.files[0];
            if (file) {
                console.log(`选择文件: ${file.name}, 大小: ${file.size}`);
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    console.log("文件读取完成，准备设置背景");
                    
                    // 获取图片数据URL
                    const imageUrl = event.target.result;
                    
                    // 设置自定义背景
                    setCustomBackground(imageUrl);
                    
                    // 激活自定义背景选项
                    const bgOptions = document.querySelectorAll('.bg-option');
                    bgOptions.forEach(opt => opt.classList.remove('active'));
                    const customOption = document.querySelector('.bg-option[data-bg="bg-image-custom"]');
                    if (customOption) {
                        console.log("激活自定义背景选项");
                        customOption.classList.add('active');
                    }
                    
                    // 更新背景预览
                    updateBackgroundPreview();
                    
                    // 保存设置
                    saveBackgroundSettings();
                };
                
                reader.readAsDataURL(file);
                
                // 清空输入控件的值，确保可以再次选择相同的文件
                this.value = '';
            }
        });
        
        // 处理拖放事件
        customBgUpload.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        
        customBgUpload.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                if (file.type.match('image.*')) {
                    this.files = e.dataTransfer.files;
                    this.dispatchEvent(new Event('change'));
                }
            }
        });
        
        // 重要：为了确保能够重复选择同一文件
        customBgUpload.addEventListener('click', function() {
            // 清空input的值，这样即使选择相同文件也会触发change事件
            this.value = '';
        });
    } else {
        console.error("未找到自定义背景上传元素 (ID: custom-bg-upload)");
        // 尝试使用其他选择器
        const uploadInput = document.querySelector('input[type="file"][accept*="image"]');
        if (uploadInput) {
            console.log("使用备选选择器找到上传元素", uploadInput.id);
            addColorExtractionToUpload(uploadInput);
        }
    }
    
    updateBackgroundPreview();
}

// 提取颜色并应用主题
function extractColorsAndAdjustTheme(imageUrl) {
    console.log("正在从图片提取颜色...");
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    
    img.onload = function() {
        console.log("图片加载完成，开始提取颜色");
        if (window.ColorThief) {
            try {
                const colorThief = new ColorThief();
                const dominantColor = colorThief.getColor(img);
                console.log("主要颜色:", dominantColor);
                applyThemeFromColor(dominantColor[0], dominantColor[1], dominantColor[2]);
                return;
            } catch (error) {
                console.warn("ColorThief提取颜色失败，使用备选算法:", error);
            }
        }
        
        console.log("使用Canvas提取平均颜色");
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < imageData.length; i += 4) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
        }
        const pixelCount = size * size;
        r = Math.floor(r / pixelCount);
        g = Math.floor(g / pixelCount);
        b = Math.floor(b / pixelCount);
        console.log("Canvas提取的平均颜色:", [r, g, b]);
        applyThemeFromColor(r, g, b);
    };
    
    img.onerror = function(err) {
        console.error("加载图片失败:", err);
    };
}

// RGB转HSL
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s, l };
}

// 根据RGB颜色应用主题
function applyThemeFromColor(r, g, b) {
    const { h, s, l } = rgbToHsl(r, g, b);
    let newTheme;
    if (l < 0.3) {
        newTheme = 'theme-dark';
    } else {
        if (h >= 180 && h <= 240) {
            newTheme = 'theme-blue';
        } else if ((h >= 270 && h <= 300) || (h >= 0 && h <= 30 && s < 0.3)) {
            newTheme = 'theme-purple';
        } else if (h >= 90 && h <= 160) {
            newTheme = 'theme-green';
        } else {
            newTheme = 'theme-default';
        }
    }
    console.log(`颜色: RGB(${r},${g},${b}), HSL(${h},${(s*100).toFixed(0)}%,${(l*100).toFixed(0)}%), 选择主题: ${newTheme}`);
    document.body.classList.remove('theme-default', 'theme-dark', 'theme-blue', 'theme-purple', 'theme-green');
    document.body.classList.add(newTheme);
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        themeSelector.value = newTheme;
        console.log("主题选择器已更新为:", newTheme);
    }
    localStorage.setItem('theme', newTheme);
    console.log("主题已保存到本地存储");
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
    console.log("themeChanged事件已触发");
    document.body.style.setProperty('--bg-accent-color', `rgb(${r}, ${g}, ${b})`);
    fixLayout();
}

// 修复页面布局（内联样式覆盖外部CSS）
function fixLayout() {
    document.querySelectorAll('.container-fluid').forEach(container => {
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
    });
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    if (header) {
        header.style.width = '100%';
        header.style.padding = '15px 0';
    }
    if (footer) {
        footer.style.width = '100%';
        footer.style.padding = '15px 0';
    }
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    console.log("页面布局已修复");
}

// 设置背景样式 - 修复版
function setBodyBackground(bgClass) {
    console.log(`设置背景类: ${bgClass}`);
    document.body.classList.remove(
        'bg-image-none',
        'bg-image-anime1',
        'bg-image-anime2',
        'bg-image-abstract',
        'bg-image-landscape',
        'bg-image-tech',
        'bg-image-custom'
    );
    
    // 清除背景图片样式
    document.body.style.backgroundImage = '';
    
    // 添加选中的背景类
    document.body.classList.add(bgClass);
    
    // 如果是"无背景"选项，同时恢复默认主题
    if (bgClass === 'bg-image-none') {
        // 恢复默认主题
        document.body.classList.remove('theme-dark', 'theme-blue', 'theme-purple', 'theme-green');
        document.body.classList.add('theme-default');
        
        // 更新主题选择器
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.value = 'theme-default';
        }
        
        // 设置默认主题的背景颜色
        document.body.style.backgroundColor = '#f8f9fa';
        
        // 保存默认主题到本地存储
        localStorage.setItem('theme', 'theme-default');
        
        // 触发主题变更事件
        document.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: 'theme-default' } 
        }));
        
        console.log("点击了无背景按钮，已恢复默认主题");
    } else if (bgClass === 'bg-image-custom') {
        // 对于自定义背景，从本地存储中加载
        const customBgUrl = localStorage.getItem('customBackground');
        if (customBgUrl) {
            // 先清空背景再设置，确保即使URL相同也会重新加载
            setTimeout(() => {
                document.body.style.backgroundImage = `url("${customBgUrl}")`;
            }, 10);
        }
    }
}

// 设置自定义背景 - 修复版
function setCustomBackground(imageUrl) {
    console.log("设置自定义背景");
    
    // 保存到本地存储
    localStorage.setItem('customBackground', imageUrl);
    
    // 先移除其他背景类
    document.body.classList.remove(
        'bg-image-none',
        'bg-image-anime1',
        'bg-image-anime2',
        'bg-image-abstract',
        'bg-image-landscape',
        'bg-image-tech'
    );
    
    // 添加自定义背景类
    document.body.classList.add('bg-image-custom');
    
    // 强制设置背景图片，即使是相同的URL也会重新应用
    document.body.style.backgroundImage = '';
    // 使用setTimeout确保先清除背景再设置新背景，强制浏览器重新渲染
    setTimeout(() => {
        document.body.style.backgroundImage = `url("${imageUrl}")`;
        console.log("背景图片已设置: url(...)");
    }, 10);
    
    // 更新UI状态
    const customOption = document.querySelector('.bg-option[data-bg="bg-image-custom"]');
    if (customOption) {
        document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('active'));
        customOption.classList.add('active');
    }
    
    // 保存设置
    localStorage.setItem('background', 'bg-image-custom');
    const settings = {
        background: 'bg-image-custom',
        opacity: Array.from(document.body.classList).find(cls => cls.startsWith('content-opacity-')) || 'content-opacity-100',
        glassEffect: document.body.classList.contains('glass-effect')
    };
    localStorage.setItem('backgroundSettings', JSON.stringify(settings));
    
    console.log("背景已设置并保存");
    
    // 提取颜色并应用主题 - 直接调用函数
    extractColorsAndAdjustTheme(imageUrl);
    
    // 立即修复布局
    fixLayout();
}

// 设置内容透明度
function setContentOpacity(opacityClass) {
    console.log(`设置内容透明度: ${opacityClass}`);
    document.body.classList.remove('content-opacity-100','content-opacity-90','content-opacity-80','content-opacity-70');
    document.body.classList.add(opacityClass);
}

// 设置毛玻璃效果
function setGlassEffect(enabled) {
    console.log(`设置毛玻璃效果: ${enabled ? '开启' : '关闭'}`);
    if (enabled) {
        document.body.classList.add('glass-effect');
    } else {
        document.body.classList.remove('glass-effect');
    }
}

// 更新背景预览
function updateBackgroundPreview() {
    const preview = document.getElementById('bg-preview');
    if (!preview) {
        console.log("未找到背景预览元素");
        return;
    }
    
    console.log("更新背景预览");
    const currentBg = Array.from(document.body.classList).find(cls => cls.startsWith('bg-image-'));
    if (currentBg === 'bg-image-custom') {
        const customBg = localStorage.getItem('customBackground');
        if (customBg) {
            preview.style.backgroundImage = `url(${customBg})`;
        }
    } else if (currentBg) {
        const bodyStyles = getComputedStyle(document.body);
        preview.style.backgroundImage = bodyStyles.backgroundImage;
    } else {
        preview.style.backgroundImage = 'none';
    }
}

// 保存背景设置到本地存储
function saveBackgroundSettings() {
    const currentBg = Array.from(document.body.classList).find(cls => cls.startsWith('bg-image-'));
    const currentOpacity = Array.from(document.body.classList).find(cls => cls.startsWith('content-opacity-'));
    const glassEffect = document.body.classList.contains('glass-effect');
    const settings = {
        background: currentBg || 'bg-image-none',
        opacity: currentOpacity || 'content-opacity-100',
        glassEffect: glassEffect
    };
    localStorage.setItem('backgroundSettings', JSON.stringify(settings));
    console.log("背景设置已保存:", settings);
}

// 从本地存储加载背景设置
function loadBackgroundSettings() {
    console.log("从本地存储加载背景设置");
    try {
        const settings = JSON.parse(localStorage.getItem('backgroundSettings') || '{}');
        console.log("加载的设置:", settings);
        
        if (settings.background) {
            setBodyBackground(settings.background);
            const bgOption = document.querySelector(`.bg-option[data-bg="${settings.background}"]`);
            if (bgOption) {
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('active'));
                bgOption.classList.add('active');
            }
            if (settings.background === 'bg-image-custom') {
                const customBg = localStorage.getItem('customBackground');
                if (customBg) {
                    // 强制重新应用背景图片
                    document.body.style.backgroundImage = '';
                    setTimeout(() => {
                        document.body.style.backgroundImage = `url(${customBg})`;
                        console.log("已加载自定义背景");
                    }, 10);
                    
                    // 如果有自定义背景，提取颜色并应用主题
                    extractColorsAndAdjustTheme(customBg);
                }
            }
        }
        
        if (settings.opacity) {
            setContentOpacity(settings.opacity);
            const opacityOption = document.querySelector(`.opacity-option[data-opacity="${settings.opacity}"]`);
            if (opacityOption) {
                document.querySelectorAll('.opacity-option').forEach(opt => opt.classList.remove('active'));
                opacityOption.classList.add('active');
            }
        }
        
        if (settings.glassEffect !== undefined) {
            setGlassEffect(settings.glassEffect);
            const glassToggle = document.getElementById('glass-effect-toggle');
            if (glassToggle) {
                glassToggle.checked = settings.glassEffect;
            }
        }
        
        updateBackgroundPreview();
    } catch (error) {
        console.error("加载背景设置出错:", error);
    }
}

// 当主题更改时更新背景预览
document.addEventListener('themeChanged', function(e) {
    console.log("主题已更改，更新背景预览");
    setTimeout(updateBackgroundPreview, 100);
    
    // 如果当前背景设置为"无背景"，则需要更新背景颜色
    if (document.body.classList.contains('bg-image-none')) {
        const newTheme = e.detail.theme;
        const bgColors = {
            'theme-default': '#f8f9fa',
            'theme-dark': '#2a2a2a',
            'theme-blue': '#e6f2ff',
            'theme-purple': '#f5f0fa',
            'theme-green': '#e6f7ef'
        };
        
        // 应用新主题对应的背景颜色
        document.body.style.backgroundColor = bgColors[newTheme] || '#f8f9fa';
        console.log(`主题已更改为${newTheme}，更新无背景模式颜色: ${bgColors[newTheme] || '#f8f9fa'}`);
    }
});

// 将关键函数绑定到全局，方便在控制台直接调用进行测试
window.loadColorThiefScript = loadColorThiefScript;
window.extractColorsAndAdjustTheme = extractColorsAndAdjustTheme;
window.setCustomBackground = setCustomBackground;

// 导出背景管理器API供其他模块使用
window.BackgroundManager = {
    setBodyBackground,
    setCustomBackground,
    setContentOpacity,
    setGlassEffect,
    loadBackgroundSettings,
    saveBackgroundSettings,
    extractColorsAndAdjustTheme
};