// ad-manager.js - 自定义广告组件管理

document.addEventListener('DOMContentLoaded', function() {
    // 广告数据 - 在实际应用中，这些数据可以从API获取
    const adData = [
        {
            id: 'ad1',
            type: 'announcement',
            title: '公告',
            icon: 'bi-megaphone',
            content: `
                <p><strong>新版本发布!</strong> 全息拉普拉斯互联网爬虫系统3.0现已推出</p>
                <p>新功能包括更强大的阴谋论检测算法和多语言支持。</p>
                <a href="#" class="btn btn-sm btn-primary mt-2">了解更多</a>
            `
        },
        {
            id: 'ad2',
            type: 'product',
            title: '推荐阅读',
            icon: 'bi-book',
            content: `
                <p>《全息拉普拉斯理论与互联网拓扑分析》</p>
                <p class="small text-muted">探索互联网节点关系的前沿研究方法</p>
                <a href="#" class="btn btn-sm btn-outline-primary mt-2">查看详情</a>
            `
        },
        {
            id: 'ad3',
            type: 'tool',
            title: '相关工具',
            icon: 'bi-tools',
            content: `
                <p><strong>全息节点分析器</strong></p>
                <p class="small">互联网拓扑结构可视化工具</p>
                <a href="#" class="btn btn-sm btn-outline-success mt-2">免费下载</a>
            `
        },
        {
            id: 'ad4',
            type: 'course',
            title: '在线课程',
            icon: 'bi-mortarboard',
            content: `
                <p>互联网爬虫与数据分析实战课程</p>
                <p class="small text-muted"><i class="bi bi-star-fill text-warning"></i> 4.8 (126人评价)</p>
                <a href="#" class="btn btn-sm btn-danger mt-2">立即报名</a>
            `
        }
    ];
    
    // 广告位容器选择器
    const adContainers = document.querySelectorAll('.sidebar-ad');
    
    // 初始化广告位
    initializeAds();
    
    // 定期轮换广告
    setInterval(rotateAds, 120000); // 2分钟轮换一次
    
    // 初始化广告位
    function initializeAds() {
        if (adContainers.length === 0) return;
        
        // 获取之前显示的广告ID，确保不重复
        const shownAdIds = getShownAdIds();
        
        // 筛选出未显示过的广告
        let availableAds = adData.filter(ad => !shownAdIds.includes(ad.id));
        
        // 如果没有未显示的广告，则重置
        if (availableAds.length === 0) {
            availableAds = adData;
            clearShownAdIds();
        }
        
        // 为每个广告位设置内容
        adContainers.forEach((container, index) => {
            // 获取随机广告
            if (availableAds.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableAds.length);
                const ad = availableAds[randomIndex];
                
                // 从可用广告中移除已使用的
                availableAds.splice(randomIndex, 1);
                
                // 设置广告内容
                setAdContent(container, ad);
                
                // 记录已显示的广告
                addShownAdId(ad.id);
            }
        });
    }
    
    // 轮换广告内容
    function rotateAds() {
        if (adContainers.length === 0) return;
        
        // 获取新的随机广告
        const availableAds = [...adData]; // 复制广告数据
        
        // 为每个广告位轮换内容
        adContainers.forEach(container => {
            if (availableAds.length > 0) {
                // 获取当前广告ID
                const currentAdId = container.dataset.adId;
                
                // 筛选不同于当前的广告
                const differentAds = availableAds.filter(ad => ad.id !== currentAdId);
                
                if (differentAds.length > 0) {
                    // 随机选择一个不同的广告
                    const randomIndex = Math.floor(Math.random() * differentAds.length);
                    const newAd = differentAds[randomIndex];
                    
                    // 从可用广告中移除已使用的
                    const adIndex = availableAds.findIndex(ad => ad.id === newAd.id);
                    if (adIndex !== -1) {
                        availableAds.splice(adIndex, 1);
                    }
                    
                    // 设置新的广告内容，带动画效果
                    fadeAdContent(container, newAd);
                    
                    // 记录已显示的广告
                    addShownAdId(newAd.id);
                }
            }
        });
    }
    
    // 设置广告内容
    function setAdContent(container, ad) {
        // 设置容器的广告ID
        container.dataset.adId = ad.id;
        
        // 创建广告头部
        const headerDiv = container.querySelector('.sidebar-ad-header') || document.createElement('div');
        headerDiv.className = 'sidebar-ad-header';
        headerDiv.innerHTML = `<i class="${ad.icon}"></i> ${ad.title}`;
        
        // 创建广告内容
        const contentDiv = container.querySelector('.ad-content') || document.createElement('div');
        contentDiv.className = 'ad-content';
        contentDiv.innerHTML = ad.content;
        
        // 清空容器并添加新内容
        container.innerHTML = '';
        container.appendChild(headerDiv);
        container.appendChild(contentDiv);
    }
    
    // 带淡入淡出效果的广告内容更新
    function fadeAdContent(container, ad) {
        // 淡出效果
        container.style.opacity = '0';
        
        // 在淡出后更新内容
        setTimeout(() => {
            setAdContent(container, ad);
            
            // 淡入效果
            container.style.opacity = '1';
        }, 500);
    }
    
    // 本地存储管理 - 记录已显示的广告
    function getShownAdIds() {
        const idsString = localStorage.getItem('shownAdIds');
        return idsString ? JSON.parse(idsString) : [];
    }
    
    function addShownAdId(id) {
        const ids = getShownAdIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem('shownAdIds', JSON.stringify(ids));
        }
    }
    
    function clearShownAdIds() {
        localStorage.removeItem('shownAdIds');
    }
    
    // 响应主题变化事件
    document.addEventListener('themeChanged', function() {
        // 为广告容器添加过渡效果
        adContainers.forEach(container => {
            container.style.transition = 'background-color 0.3s, border-color 0.3s';
        });
    });
});
