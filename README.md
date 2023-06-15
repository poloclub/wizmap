# WizMap <a href="https://poloclub.github.io/wizmap/"><img align="right" src="./src/imgs/icon-wizmap.svg" height="38"></img></a>

[![build](https://github.com/poloclub/wizmap/actions/workflows/build.yml/badge.svg)](https://github.com/poloclub/wizmap/actions/workflows/build.yml)
[![license](https://img.shields.io/badge/License-MIT-success)](https://github.com/poloclub/wizmap/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/wizmap?color=red)](https://www.npmjs.com/package/wizmap)
[![pypi](https://img.shields.io/pypi/v/wizmap?color=blue)](https://pypi.python.org/pypi/wizmap)
[![colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1GNdmBnc5UA7OYBZPtHu244eiAN-0IMZA?usp=sharing)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/poloclub/wizmap/master?urlpath=lab/tree/example/imdb.ipynb)


<!-- [![arxiv badge](https://img.shields.io/badge/arXiv-2209.09227-red)](https://arxiv.org/abs/2209.09227) -->
<!-- [![DOI:10.1145/3491101.3519653](https://img.shields.io/badge/DOI-10.1145/3491101.3519653-blue)](https://doi.org/10.1145/3491101.3519653) -->

Exploring and interpreting large embeddings in your browser!

<table>
  <tr>
    <td colspan="2"><a href="https://poloclub.github.io/timbertrek"><img src='https://i.imgur.com/U5LqUi4.png'></a></td>
  </tr>
  <tr></tr>
  <tr>
    <td><a href="https://poloclub.github.io/wizmap">🚀 Live Demo</a></td>
    <td><a href="https://youtu.be/8fJG87QVceQ">📺 Demo Video</a></td>
  </tr>
</table>


## What is WizMap?

WizMap is a scalable interactive visualization tool to help you easily explore large machine learning embeddings. With a novel multi-resolution embedding summarization method and a familiar map-like interaction design, WizMap allows you to navigate and interpret embedding spaces with ease.

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

Then take a look at this [notebook](./example/acl-abstracts.ipynb) for a detailed guide. Spoiler alert: You'll be up and running with just two function calls from the `wizmap` library. These two JSON files contain pre-computed embedding summaries, distributions, and the original embedding data.

After generating the JSON files, you have two options to use WizMap.

1. **Browser**: You can click the folder icon on the bottom right of the [WizMap demo](https://poloclub.github.io/wizmap/) and enter the URLs to the JSON files in the pop-up window.
2. **Notebook**: If you are familiar with computational notebooks (e.g., Jupyter Notebook, VSCode Notebook, Colab), you can directly use WizMap in your favorite notebook platform with `wizmap.visualize()`.

## Credits

WizMap is created by <a href='https://zijie.wang/' target='_blank'>Jay Wang</a>, <a href='http://fredhohman.com/' target='_blank'>Fred Hohman</a>, and <a href='https://poloclub.github.io/polochau/' target='_blank'>Polo Chau</a>.


## License

The software is available under the [MIT License](https://github.com/poloclub/wizmap/blob/master/LICENSE).

## Contact

If you have any questions, feel free to [open an issue](https://github.com/poloclub/wizmap/issues/new) or contact [Jay Wang](https://zijie.wang).
