# WizMap <a href="https://poloclub.github.io/wizmap/"><img align="right" src="../src/imgs/icon-wizmap.svg" height="38"></img></a>

[![build](https://github.com/poloclub/wizmap/actions/workflows/build.yml/badge.svg)](https://github.com/poloclub/wizmap/actions/workflows/build.yml)
[![license](https://img.shields.io/badge/License-MIT-success)](https://github.com/poloclub/wizmap/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/wizmap?color=red)](https://www.npmjs.com/package/wizmap)
[![pypi](https://img.shields.io/pypi/v/wizmap?color=blue)](https://pypi.python.org/pypi/wizmap)
[![colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1GNdmBnc5UA7OYBZPtHu244eiAN-0IMZA?usp=sharing)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/poloclub/wizmap/master?urlpath=lab/tree/example/imdb.ipynb)
[![arxiv badge](https://img.shields.io/badge/arXiv-2306.09328-red)](https://arxiv.org/abs/2306.09328)

<!-- [![DOI:10.1145/3491101.3519653](https://img.shields.io/badge/DOI-10.1145/3491101.3519653-blue)](https://doi.org/10.1145/3491101.3519653) -->

Exploring and interpreting large embeddings in your browser!

<table>
  <tr>
    <td colspan="3"><video width="100%" src='https://github.com/poloclub/wizmap/assets/15007159/26d26336-e611-4d00-b535-8837da59be82'></td>
  </tr>
  <tr></tr>
  <tr>
    <td><a href="https://poloclub.github.io/wizmap">🚀 Live Demo</a></td>
    <td><a href="https://youtu.be/8fJG87QVceQ">📺 Demo Video</a></td>
    <td><a href="https://arxiv.org/abs/2306.09328">📖 Research Paper</a></td>
  </tr>
</table>

## What is WizMap?

WizMap is a scalable interactive visualization tool to help you easily explore large machine learning embeddings. With a novel multi-resolution embedding summarization method and a familiar map-like interaction design, WizMap allows you to navigate and interpret embedding spaces with ease.

<table>
  <tr>
    <td>✅</td>
    <td>Scalable to <strong>millions</strong> of embedding point</td>
  </tr>
  <tr></tr>
  <tr>
    <td>✅</td>
    <td><strong>Multi-resolution</strong> embedding summaries</td>
  </tr>
  <tr></tr>
  <tr>
    <td>✅</td>
    <td><strong>Fast</strong> embedding search</td>
  </tr>
  <tr></tr>
    <tr>
    <td>✅</td>
    <td><strong>Multimodal</strong> data (text and image)</td>
  </tr>
  <tr></tr>
  <tr>
    <td>✅</td>
    <td>Animated <strong>embedding evolution</strong></td>
  </tr>
  <tr></tr>
  <tr>
    <td>✅</td>
    <td>Support <strong>computational notebooks</strong> (e.g., Jupyter, Colab, VS Code)</td>
  </tr>
  <tr></tr>
  <tr>
    <td>✅</td>
    <td><strong>Sharable URLs</strong></td>
  </tr>
  <tr></tr>
</table>

## WizMap Gallery

<table>
  <tr>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=diffusiondb"><img src="https://i.imgur.com/hTcu3rJ.jpg" width="100%"></a></td>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=diffusiondb"><img src="https://i.imgur.com/AYUEHWz.png" width="100%"></a></td>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=diffusiondb"><img src="https://i.imgur.com/iyBzqHQ.png" width="100%"></a></td>
  </tr>
  <tr></tr>
  <tr>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=diffusiondb">DiffusionDB Prompts + Images</a></td>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=acl-abstracts">ACL Paper Abstracts</a></td>
    <td><a href="https://poloclub.github.io/wizmap/?dataset=imdb">IMDB Review Comments</a></td>
  </tr>
  <tr></tr>
  <tr>
    <td>1.8M text + 1.8M images</a></td>
    <td>63k text</td>
    <td>25k text</td>
  </tr>
  <tr></tr>
  <tr>
    <td><code>CLIP</code> Embedding</td>
    <td><code>all-MiniLM-L6-v2</code> Embedding</td>
    <td><code>all-MiniLM-L6-v2</code> Embedding</td>
  </tr>
  <tr></tr>
</table>

[Submit a PR](https://github.com/poloclub/wizmap/pulls) to add your WizMap here! You can share your WizMap using a [unique URL](#share-my-wizmap).

## Web Demo

For a live web demo, visit: <https://poloclub.github.io/wizmap>.

## Get Started

Clone or download this repository:

```bash
git clone git@github.com:poloclub/wizmap.git
```

Install the dependencies:

```bash
npm install
```

Then run WizMap:

```bash
npm run dev
```

Navigate to [localhost:3000](https://localhost:3000). You should see WizMap running in your browser :)

## Use My Own Embeddings

To use WizMap with your embeddings, you first need to install the `wizmap` Python library.

```bash
pip install wizmap
```

Then take a look at this [notebook](./example/imdb.ipynb) for a detailed guide. If your dataset includes images, take a look at this [notebook](./example/diffusiondb-images.ipynb).

Spoiler alert: You'll be up and running with just two function calls from the `wizmap` library. These two JSON files contain pre-computed embedding summaries, distributions, and the original embedding data.

After generating the JSON files, you have two options to use WizMap.

1. **Browser**: You can click the folder icon on the bottom right of the [WizMap demo](https://poloclub.github.io/wizmap/) and enter the URLs to the JSON files in the pop-up window.
2. **Notebook**: If you are familiar with computational notebooks (e.g., Jupyter Notebook, VSCode Notebook, Colab), you can directly use WizMap in your favorite notebook platform with `wizmap.visualize()`.

## Share My WizMap

You can easily share your embedding maps with collaborators by copying the unique URL of WizMap from your browser. For example, the [URL below](https://poloclub.github.io/wizmap/?dataURL=https%3A%2F%2Fhuggingface.co%2Fdatasets%2Fxiaohk%2Fembeddings%2Fresolve%2Fmain%2Fimdb%2Fdata.ndjson&gridURL=https%3A%2F%2Fhuggingface.co%2Fdatasets%2Fxiaohk%2Fembeddings%2Fresolve%2Fmain%2Fimdb%2Fgrid.json) points to an IMDB embedding in WizMap.

```
https://poloclub.github.io/wizmap/?dataURL=https%3A%2F%2Fhuggingface.co%2Fdatasets%2Fxiaohk%2Fembeddings%2Fresolve%2Fmain%2Fimdb%2Fdata.ndjson&gridURL=https%3A%2F%2Fhuggingface.co%2Fdatasets%2Fxiaohk%2Fembeddings%2Fresolve%2Fmain%2Fimdb%2Fgrid.json
```

## Credits

WizMap is created by <a href='https://zijie.wang/' target='_blank'>Jay Wang</a>, <a href='http://fredhohman.com/' target='_blank'>Fred Hohman</a>, and <a href='https://poloclub.github.io/polochau/' target='_blank'>Polo Chau</a>.

## Citation

To learn more about WizMap, please read our [research paper](https://arxiv.org/abs/2306.09328) (published at [ACL'23 System Demonstration](https://2023.aclweb.org/program/accepted_system_demonstration/)).

```bibtex
@article{wangWizMapScalableInteractive2023,
  title = {{{WizMap}}: {{Scalable Interactive Visualization}} for {{Exploring Large Machine Learning Embeddings}}},
  shorttitle = {{{WizMap}}},
  author = {Wang, Zijie J. and Hohman, Fred and Chau, Duen Horng},
  year = {2023},
  url = {http://arxiv.org/abs/2306.09328},
  urldate = {2023-06-16},
  archiveprefix = {arxiv},
  journal = {arXiv 2306.09328}
}
```

## License

The software is available under the [MIT License](https://github.com/poloclub/wizmap/blob/master/LICENSE).

## Contact

If you have any questions, feel free to [open an issue](https://github.com/poloclub/wizmap/issues/new) or contact [Jay Wang](https://zijie.wang).
