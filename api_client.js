// api_client.js - 全息拉普拉斯互联网爬虫系统API客户端

// 配置API基础URL
const API_BASE_URL = 'http://localhost:5000/api'; // 默认本地开发地址，部署时需要修改

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
            const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
            
            if (!response.ok) {
                throw new Error('服务器健康检查失败');
            }
            
            return await response.json();
        } catch (error) {
            console.error('健康检查出错:', error);
            throw error;
        }
    }
};

// 导出API客户端
window.ApiClient = ApiClient;