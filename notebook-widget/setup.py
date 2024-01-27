#!/usr/bin/env python

"""The setup script."""

from json import loads, load
from setuptools import setup, find_packages
from pathlib import Path
import os

with open("README.md", "r") as readme_file:
    readme = readme_file.read()

requirements = ["numpy", "ipython", "tqdm", "quadtreed3", "ndjson", "scikit-learn"]

test_requirements = []

# Read the version from package.json
package_json_path = "./package.json"

# Read the package.json file
with open(package_json_path, "r", encoding="utf8") as f:
    package_json = load(f)
    version = package_json["version"]

setup(
    author="Jay Wang",
    author_email="jayw@zijie.wang",
    python_requires=">=3.6",
    platforms="Linux, Mac OS X, Windows",
    keywords=[
        "Jupyter",
        "JupyterLab",
        "JupyterLab3",
        "Machine Learning",
        "Visualization",
        "Interactive Visualization",
        "Embeddings",
    ],
    classifiers=[
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Framework :: Jupyter",
        "Framework :: Jupyter :: JupyterLab",
        "Framework :: Jupyter :: JupyterLab :: 3",
    ],
    description="A Python package to run WizMap in your computational notebooks.",
    install_requires=requirements,
    license="MIT license",
    long_description=readme,
    long_description_content_type="text/markdown",
    include_package_data=True,
    name="wizmap",
    packages=find_packages(include=["wizmap", "wizmap.*"]),
    test_suite="tests",
    tests_require=test_requirements,
    url="https://github.com/poloclub/wizmap",
    version=version,
    zip_safe=False,
)
