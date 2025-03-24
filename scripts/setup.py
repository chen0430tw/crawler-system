#!/usr/bin/env python3
"""
全息拉普拉斯互联网爬虫系统 - 安装脚本
安装方法: python setup.py install
"""

from setuptools import setup, find_packages

setup(
    name="holographic-laplacian-crawler",
    version="1.0.0",
    description="基于全息拉普拉斯互联网图的爬虫系统",
    author="430",
    author_email="example@example.com",
    url="https://github.com/yourusername/crawler-system",
    packages=find_packages(),
    py_modules=["crawler"],
    include_package_data=True,
    install_requires=[
        "requests>=2.26.0",
        "beautifulsoup4>=4.10.0",
        "nltk>=3.6.5",
        "scikit-learn>=1.0.1",
    ],
    entry_points={
        "console_scripts": [
            "hlcrawler=crawler:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Console",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Topic :: Internet :: WWW/HTTP",
    ],
    python_requires=">=3.7",
)