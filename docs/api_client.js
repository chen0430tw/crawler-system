// api_client.js - 全息拉普拉斯互联网爬虫系统API客户端

// 配置API基础URL - 使用相对路径，这样在Nginx代理后也能正常工作
const API_BASE_URL = '/api';

// API接口客户端
const ApiClient = {
    /**
     * 提交爬虫任务
     * @param {Object} config 爬虫配置
     * @returns {Promise} 任务提交结果
     */
    submitTask: async function(config) {
        try {
            const response = await fetch(`${API_BASE_URL}/submit`, {
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
            console.error('提交任务出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取任务状态
     * @param {string} taskId 任务ID
     * @returns {Promise} 任务状态
     */
    getTaskStatus: async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/status/${taskId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务状态失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取任务状态出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取任务结果
     * @param {string} taskId 任务ID
     * @returns {Promise} 任务结果
     */
    getTaskResult: async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/result/${taskId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务结果失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取任务结果出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取任务结果下载链接
     * @param {string} taskId 任务ID
     * @returns {string} 下载链接
     */
    getDownloadLink: function(taskId) {
        return `${API_BASE_URL}/download/${taskId}`;
    },
    
    /**
     * 获取任务列表
     * @returns {Promise} 任务列表
     */
    getTasks: async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取任务列表失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取任务列表出错:', error);
            throw error;
        }
    },
    
    /**
     * 取消任务
     * @param {string} taskId 任务ID
     * @returns {Promise} 取消结果
     */
    cancelTask: async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/cancel/${taskId}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '取消任务失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('取消任务出错:', error);
            throw error;
        }
    },
    
    /**
     * 上传配置文件
     * @param {File} file 配置文件
     * @returns {Promise} 上传结果
     */
    uploadConfig: async function(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '上传配置文件失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('上传配置文件出错:', error);
            throw error;
        }
    },
    
    /**
     * 检查服务器健康状态
     * @returns {Promise} 健康状态
     */
    checkHealth: async function() {
        try {
            const response = await fetch('/health');
            
            if (!response.ok) {
                throw new Error('服务器健康检查失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('健康检查出错:', error);
            throw error;
        }
    },
    
    /**
     * 提交爬取维基百科的任务
     * @param {Object} config 爬虫配置
     * @returns {Promise} 任务提交结果
     */
    submitWikiTask: async function(config) {
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
                throw new Error(errorData.error || '提交维基百科爬取任务失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('提交维基百科爬取任务出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取维基百科页面内容
     * @param {string} url 维基百科页面URL或页面标题
     * @param {Object} options 选项(如语言版本等)
     * @returns {Promise} 页面内容
     */
    getWikiPage: async function(url, options = {}) {
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            
            if (url.includes('wikipedia.org')) {
                params.append('url', url);
            } else {
                params.append('title', url);
                
                if (options.language) {
                    params.append('language', options.language);
                }
            }
            
            if (options.format) {
                params.append('format', options.format);
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/page?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科页面失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科页面出错:', error);
            throw error;
        }
    },
    
    /**
     * 搜索维基百科内容
     * @param {string} query 搜索关键词
     * @param {Object} options 选项(如语言版本、结果数量限制等)
     * @returns {Promise} 搜索结果
     */
    searchWiki: async function(query, options = {}) {
        try {
            // 构建查询参数
            const params = new URLSearchParams({
                query: query
            });
            
            if (options.language) {
                params.append('language', options.language);
            }
            
            if (options.limit) {
                params.append('limit', options.limit);
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/search?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '搜索维基百科失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('搜索维基百科出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取维基百科分类页面及其内容
     * @param {string} category 分类名称或URL
     * @param {Object} options 选项(如深度、语言版本等)
     * @returns {Promise} 分类内容
     */
    getWikiCategory: async function(category, options = {}) {
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            
            if (category.includes('wikipedia.org')) {
                params.append('url', category);
            } else {
                params.append('category', category);
                
                if (options.language) {
                    params.append('language', options.language);
                }
            }
            
            if (options.depth !== undefined) {
                params.append('depth', options.depth);
            }
            
            if (options.format) {
                params.append('format', options.format);
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/category?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科分类失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科分类出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取随机维基百科页面
     * @param {Object} options 选项(如数量、语言版本等)
     * @returns {Promise} 随机页面列表
     */
    getRandomWikiPages: async function(options = {}) {
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            
            if (options.count) {
                params.append('count', options.count);
            }
            
            if (options.language) {
                params.append('language', options.language);
            }
            
            if (options.namespace !== undefined) {
                params.append('namespace', options.namespace);
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/random?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取随机维基百科页面失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取随机维基百科页面出错:', error);
            throw error;
        }
    },
    
    /**
     * 提取维基百科页面的信息框(Infobox)
     * @param {string} url 维基百科页面URL或页面标题
     * @param {Object} options 选项(如语言版本等)
     * @returns {Promise} Infobox数据
     */
    getWikiInfobox: async function(url, options = {}) {
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            
            if (url.includes('wikipedia.org')) {
                params.append('url', url);
            } else {
                params.append('title', url);
                
                if (options.language) {
                    params.append('language', options.language);
                }
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/infobox?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科信息框失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科信息框出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取两个维基百科页面之间的最短路径(类似六度分隔)
     * @param {string} source 源页面URL或标题
     * @param {string} target 目标页面URL或标题
     * @param {Object} options 选项(如语言版本、最大深度等)
     * @returns {Promise} 页面路径
     */
    getWikiPathBetween: async function(source, target, options = {}) {
        try {
            // 构建请求体
            const requestBody = {
                source: source,
                target: target
            };
            
            if (options.language) {
                requestBody.language = options.language;
            }
            
            if (options.maxDepth) {
                requestBody.maxDepth = options.maxDepth;
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '计算维基百科页面路径失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('计算维基百科页面路径出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取维基百科解析树
     * 构建某个分类下的主题树状结构
     * @param {string} rootCategory 根分类名称或URL
     * @param {Object} options 选项(如深度、语言版本等)
     * @returns {Promise} 分类树
     */
    getWikiCategoryTree: async function(rootCategory, options = {}) {
        try {
            // 构建请求体
            const requestBody = {
                rootCategory: rootCategory
            };
            
            if (options.language) {
                requestBody.language = options.language;
            }
            
            if (options.depth !== undefined) {
                requestBody.depth = options.depth;
            }
            
            if (options.includePages !== undefined) {
                requestBody.includePages = options.includePages;
            }
            
            const response = await fetch(`${API_BASE_URL}/wiki/category-tree`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科分类树失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科分类树出错:', error);
            throw error;
        }
    },
    
    /**
     * 下载整个维基百科任务结果
     * @param {string} taskId 任务ID
     * @param {string} format 下载格式(json, csv, html)
     * @returns {string} 下载URL
     */
    getWikiResultDownloadLink: function(taskId, format = 'json') {
        return `${API_BASE_URL}/wiki/download/${taskId}?format=${format}`;
    },
    
    /**
     * 获取维基百科爬取统计信息
     * @returns {Promise} 统计信息
     */
    getWikiStats: async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/stats`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科统计信息失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科统计信息出错:', error);
            throw error;
        }
    },
    
    /**
     * 获取维基百科可用语言列表
     * @returns {Promise} 语言列表
     */
    getWikiLanguages: async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/languages`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取维基百科语言列表失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取维基百科语言列表出错:', error);
            throw error;
        }
    },
    
    /**
     * 取消维基百科爬取任务
     * @param {string} taskId 任务ID
     * @returns {Promise} 取消结果
     */
    cancelWikiTask: async function(taskId) {
        try {
            const response = await fetch(`${API_BASE_URL}/wiki/cancel/${taskId}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '取消维基百科爬取任务失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('取消维基百科爬取任务出错:', error);
            throw error;
        }
    }
};

// 导出API客户端
window.ApiClient = ApiClient;
