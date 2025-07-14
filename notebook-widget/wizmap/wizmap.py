import numpy as np
import random
import html
import base64
import pkgutil
import ndjson
import json

from os.path import join
from tqdm import tqdm
from IPython.display import display_html
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer
from quadtreed3 import Quadtree, Node
from scipy.sparse import csr_matrix
from sklearn.neighbors import KernelDensity
from typing import Tuple, TypedDict, Literal


class JsonPointContentConfig(TypedDict):
    """Config for json point.

    Args:
        textKey (str): The key for the text, e.g., 'text' or 't'.
        groupLabels (list[int] | None): A list of group labels. Each data point has a
        group label. If a point's group label is in this list, wizmap will use
        json parser to parse the data point's text content. If it is None, wizmap
        will apply json parsing to all data points.
        imageKey (str | None): The key for the image content, e.g., 'image' or 'i'.
        imageURLPrefix (str | None): The prefix for the image URL, e.g.,
        'https://example.com/images/'.
        largeImageKey (str | None): The key for the large image content, e.g.,
        'large_image' or 'li'. The image will be shown in the floating window after
        clicking on the point.
        largeImageURLPrefix (str | None): The prefix for the large image URL, e.g.,
        'https://example.com/large_images/'.
        linkFieldKeys (list[str] | None): A list of field keys for the link content,
        e.g., ['link1', 'link2']. The parameter tells WizMap to render the value of
        these keys as clickable links in the floating window.
    """

    textKey: str
    groupLabels: list[int] | None
    imageKey: str | None
    imageURLPrefix: str | None
    largeImageKey: str | None
    largeImageURLPrefix: str | None
    linkFieldKeys: list[str] | None


def generate_contour_dict(
    xs: list[float],
    ys: list[float],
    grid_size: int = 200,
    max_sample: int = 100000,
    random_seed: int = 202355,
    labels: list[int] | None = None,
    group_names: list[str] | None = None,
    times: list[str] | None = None,
    time_format: str | None = None,
) -> dict:
    """Generate a grid dictionary object that encodes the contour plot of the
    projected embedding space.

    Args:
        xs ([float]): A list of x coordinates of projected points
        ys ([float]): A list of y coordinates of projected points
        grid_size (int, optional): The resolution of the grid. Defaults to 200.
        max_sample (int, optional): Max number of samples to compute KDE from.
            Defaults to 100000.
        random_seed (int, optional): Seed for the random state. Defaults to 202355.
        labels ([int]): A list of category labels of projected points. Labels
            must be consecutive integers starting from 0. Defaults to None.
        group_names ([str]): Category names associated with the given labels.
            For example, the group name of label i is group_names[i]. Defaults
            to None.
        times ([str]): A list of times associated with data points. Defaults to None.
        time_format (str): strptime format string to parse the time string in times.

    Returns:
        dict: A dictionary object encodes the contour plot.
    """
    projected_emb = np.stack((xs, ys), axis=1)

    x_min, x_max = np.min(xs), np.max(xs)
    y_min, y_max = np.min(ys), np.max(ys)

    x_gap = x_max - x_min
    y_gap = y_max - y_min

    if x_gap > y_gap:
        # Expand the larger range to leave some padding in the plots
        x_min -= x_gap / 50
        x_max += x_gap / 50
        x_gap = x_max - x_min

        # Regulate the 2D grid to be a square
        y_min -= (x_gap - y_gap) / 2
        y_max += (x_gap - y_gap) / 2
    else:
        # Expand the larger range to leave some padding in the plots
        y_min -= y_gap / 50
        y_max += y_gap / 50
        y_gap = y_max - y_min

        # Regulate the 2D grid to be a square
        x_min -= (y_gap - x_gap) / 2
        x_max += (y_gap - x_gap) / 2

    # Estimate on a 2D grid
    grid_xs = np.linspace(x_min, x_max, grid_size)
    grid_ys = np.linspace(y_min, y_max, grid_size)
    xx, yy = np.meshgrid(grid_xs, grid_ys)

    grid = np.vstack([xx.ravel(), yy.ravel()]).transpose()

    # Compute the bandwidth using Silverman's rule
    sample_size = min(max_sample, len(xs))
    n = sample_size
    d = projected_emb.shape[1]
    bw = (n * (d + 2) / 4.0) ** (-1.0 / (d + 4))

    # We use a random sample to fit the KDE for faster run time
    rng = np.random.default_rng(random_seed)
    random_indexes = rng.choice(
        range(projected_emb.shape[0]),
        min(projected_emb.shape[0], sample_size),
        replace=False,
    )

    kde = KernelDensity(kernel="gaussian", bandwidth=bw)
    kde.fit(projected_emb[random_indexes, :])

    # Sklearn
    log_density = kde.score_samples(grid)
    log_density = np.exp(log_density)
    grid_density = np.reshape(log_density, xx.shape)

    # Export the density dict
    x_min, x_max, y_min, y_max = float(x_min), float(x_max), float(y_min), float(y_max)

    grid_density_json = {
        "grid": grid_density.astype(float).round(4).tolist(),
        "xRange": [x_min, x_max],
        "yRange": [y_min, y_max],
        "padded": True,
        "sampleSize": sample_size,
        "totalPointSize": len(xs),
    }

    # Add group grids if labels are given
    if labels is not None and group_names is not None:
        if len(set(labels)) != len(group_names):
            raise IndexError(
                "Number of unique labels must be the same as the length as group_names."
            )

        if len(labels) != len(xs):
            raise IndexError("Number of labels must be the same as number of points.")

        grid_density_json["groupGrids"] = {}
        grid_density_json["groupTotalPointSizes"] = {}
        grid_density_json["groupNames"] = group_names

        for cur_label, name in enumerate(group_names):
            cur_xs = []
            cur_ys = []

            for i, label in enumerate(labels):
                if label == cur_label:
                    cur_xs.append(xs[i])
                    cur_ys.append(ys[i])

            cur_projected_emb = np.stack((cur_xs, cur_ys), axis=1)

            # Estimate on a 2D grid
            grid_xs = np.linspace(x_min, x_max, grid_size)
            grid_ys = np.linspace(y_min, y_max, grid_size)
            xx, yy = np.meshgrid(grid_xs, grid_ys)

            grid = np.vstack([xx.ravel(), yy.ravel()]).transpose()

            # Compute the bandwidth using Silverman's rule
            sample_size = min(max_sample, len(cur_xs))
            n = sample_size
            d = cur_projected_emb.shape[1]
            bw = (n * (d + 2) / 4.0) ** (-1.0 / (d + 4))

            # We use a random sample to fit the KDE for faster run time
            rng = np.random.default_rng(random_seed)
            random_indexes = rng.choice(
                range(cur_projected_emb.shape[0]),
                min(cur_projected_emb.shape[0], sample_size),
                replace=False,
            )

            kde = KernelDensity(kernel="gaussian", bandwidth=bw)
            kde.fit(cur_projected_emb[random_indexes, :])

            # Sklearn
            log_density = kde.score_samples(grid)
            log_density = np.exp(log_density)
            grid_density = np.reshape(log_density, xx.shape)

            # Register this group
            grid_density_json["groupGrids"][name] = (
                grid_density.astype(float).round(4).tolist()
            )
            grid_density_json["groupTotalPointSizes"][name] = cur_projected_emb.shape[0]

    # Add time grids if times are given
    if times is not None:
        if len(times) != len(xs):
            raise IndexError("Number of times must be the same as number of points.")

        grid_density_json["timeGrids"] = {}
        grid_density_json["timeCounter"] = {}
        grid_density_json["timeFormat"] = time_format

        unique_times = set(times)

        for cur_time in unique_times:
            cur_xs = []
            cur_ys = []

            for i, time in enumerate(times):
                if time == cur_time:
                    cur_xs.append(xs[i])
                    cur_ys.append(ys[i])

            cur_projected_emb = np.stack((cur_xs, cur_ys), axis=1)

            # Estimate on a 2D grid
            grid_xs = np.linspace(x_min, x_max, grid_size)
            grid_ys = np.linspace(y_min, y_max, grid_size)
            xx, yy = np.meshgrid(grid_xs, grid_ys)

            grid = np.vstack([xx.ravel(), yy.ravel()]).transpose()

            # Compute the bandwidth using Silverman's rule
            sample_size = min(max_sample, len(cur_xs))
            n = sample_size
            d = cur_projected_emb.shape[1]
            bw = (n * (d + 2) / 4.0) ** (-1.0 / (d + 4))

            # We use a random sample to fit the KDE for faster run time
            rng = np.random.default_rng(random_seed)
            random_indexes = rng.choice(
                range(cur_projected_emb.shape[0]),
                min(cur_projected_emb.shape[0], sample_size),
                replace=False,
            )

            kde = KernelDensity(kernel="gaussian", bandwidth=bw)
            kde.fit(cur_projected_emb[random_indexes, :])

            # Sklearn
            log_density = kde.score_samples(grid)
            log_density = np.exp(log_density)
            grid_density = np.reshape(log_density, xx.shape)

            # Register this time group
            grid_density_json["timeGrids"][cur_time] = (
                grid_density.astype(float).round(4).tolist()
            )
            grid_density_json["timeCounter"][cur_time] = cur_projected_emb.shape[0]

    return grid_density_json


def top_n_idx_sparse(matrix: csr_matrix, n: int) -> np.ndarray:
    """Return indices of top n values in each row of a sparse matrix
    Retrieved from:
        https://github.com/MaartenGr/BERTopic/blob/master/bertopic/_bertopic.py#L2801
    Arguments:
        matrix: The sparse matrix from which to get the top n indices per row
        n: The number of highest values to extract from each row
    Returns:
        indices: The top n indices per row
    """
    indices = []
    for le, ri in zip(matrix.indptr[:-1], matrix.indptr[1:]):
        n_row_pick = min(n, ri - le)
        values = matrix.indices[
            le + np.argpartition(matrix.data[le:ri], -n_row_pick)[-n_row_pick:]
        ]
        values = [
            values[index] if len(values) >= index + 1 else None for index in range(n)
        ]
        indices.append(values)
    return np.array(indices)


def top_n_values_sparse(matrix: csr_matrix, indices: np.ndarray) -> np.ndarray:
    """Return the top n values for each row in a sparse matrix
    Arguments:
        matrix: The sparse matrix from which to get the top n indices per row
        indices: The top n indices per row
    Returns:
        top_values: The top n scores per row
    """
    top_values = []
    for row in range(indices.shape[0]):
        scores = np.array(
            [matrix[row, c] if c is not None else 0 for c in indices[row, :]]
        )
        top_values.append(scores)
    return np.array(top_values)


def merge_leaves_before_level(root: Node, target_level: int) -> Tuple[list, list, dict]:
    """
    Merge all nodes to their parents until the tree is target_level tall (modify
    root in-place) and extract all data from leaf nodes before or at the target_level.

    Args:
        root (Node): Root node
        target_level (int): Target level

    Returns:
        csr_row_indexes (list): Row indexes for the sparse matrix. Each row is
            a leaf node.
        csr_column_indexes (list): Column indexes for the sparse matrix. Each column
            is a prompt ID.
        row_node_map (dict): A dictionary map row index to the leaf node.
    """

    x0, y0, x1, y1 = root.position
    step_size = (x1 - x0) / (2**target_level)

    # Find all leaves at or before the target level
    row_pos_map = {}
    stack = [root]

    # We create a sparse matrix by (data, (row index, column index))
    csr_row_indexes, csr_column_indexes = [], []

    # In the multiplication sparse matrix, each row represents a tile / collection,
    # and each column represents a prompt ID
    cur_r = 0

    while len(stack) > 0:
        cur_node = stack.pop()

        if cur_node.level >= target_level:
            # A new traverse here to concatenate all the prompts from its subtree,
            # and to merge it with its children
            local_stack = [cur_node]
            subtree_data = []

            while len(local_stack) > 0:
                local_node = local_stack.pop()

                if len(local_node.children) == 0:
                    # Leaf node
                    subtree_data.extend(local_node.data)
                else:
                    for c in local_node.children[::-1]:
                        if c is not None:
                            local_stack.append(c)

            # Detach all the children and get their data
            cur_node.children = []
            cur_node.data = subtree_data

            # Register this node in a dictionary for faster access
            row_pos_map[cur_r] = list(map(lambda x: round(x, 3), cur_node.position))

            # Collect the prompt IDs
            for d in cur_node.data:
                csr_row_indexes.append(cur_r)
                csr_column_indexes.append(d["pid"])

            # Move on to the next tile / collection
            cur_r += 1

        else:
            if len(cur_node.children) == 0:
                # Leaf node => it means this leaf is before the target level
                # We need to adjust the node's position so that it has the same
                # size as leaf nodes at the target_level
                x, y = cur_node.data[0]["x"], cur_node.data[0]["y"]
                xi, yi = int((x - x0) // step_size), int((y - y0) // step_size)

                # Find the bounding box of current level of this leaf node
                xi0, yi0 = x0 + xi * step_size, y0 + yi * step_size
                xi1, yi1 = xi0 + step_size, yi0 + step_size
                row_pos_map[cur_r] = list(
                    map(lambda x: round(x, 3), [xi0, yi0, xi1, yi1])
                )

                # Collect the prompt IDs
                for d in cur_node.data:
                    csr_row_indexes.append(cur_r)
                    csr_column_indexes.append(d["pid"])

                # Move on to the next tile / collection
                cur_r += 1

            else:
                for c in cur_node.children[::-1]:
                    if c is not None:
                        stack.append((c))

    return csr_row_indexes, csr_column_indexes, row_pos_map


def get_tile_topics(count_mat, row_pos_map, ngrams, top_k=10):
    """Get the top-k important keywords from all rows in the count_mat.

    Args:
        count_mat (csr_mat): A count matrix
        row_pos_map (dict): A dictionary that maps row index to the corresponding
            leaf node's location in the quadtree
        ngrams (list[str]): Feature names in the count_mat
        top_k (int): Number of keywords to extract
    """

    # Compute tf-idf score
    t_tf_idf_model = TfidfTransformer()
    t_tf_idf = t_tf_idf_model.fit_transform(count_mat)

    # Get words with top scores for each tile
    indices = top_n_idx_sparse(t_tf_idf, top_k)
    scores = top_n_values_sparse(t_tf_idf, indices)

    sorted_indices = np.argsort(scores, 1)
    indices = np.take_along_axis(indices, sorted_indices, axis=1)
    scores = np.take_along_axis(scores, sorted_indices, axis=1)

    # Store these keywords
    tile_topics = []

    for r in row_pos_map:
        word_scores = [
            (ngrams[word_index], round(score, 4))
            if word_index is not None and score > 0
            else ("", 0.00001)
            for word_index, score in zip(indices[r][::-1], scores[r][::-1])
        ]

        tile_topics.append({"w": word_scores, "p": row_pos_map[r]})

    return tile_topics


def extract_level_topics(
    root: Node,
    count_mat: csr_matrix,
    texts: list[str],
    ngrams: list[str],
    min_level=None,
    max_level=None,
):
    """Extract topics for all leaf nodes at all levels of the quadtree.

    Args:
        root (Noe): Quadtree node
        count_mat (csr_matrix): Count vector for the corpus
        texts (list[str]): A list of all the embeddings' texts
        ngrams (list[str]): n-gram list for the count vectorizer
    """

    level_tile_topics = {}

    if min_level is None:
        min_level = 0

    if max_level is None:
        max_level = root.height

    for level in tqdm(list(range(max_level, min_level - 1, -1))):
        # Create a sparse matrix
        csr_row_indexes, csr_column_indexes, row_node_map = merge_leaves_before_level(
            root, level
        )

        csr_data = [1 for _ in range(len(csr_row_indexes))]
        tile_mat = csr_matrix(
            (csr_data, (csr_row_indexes, csr_column_indexes)),
            shape=(len(texts), len(texts)),
        )

        # Transform the count matrix
        new_count_mat = tile_mat @ count_mat

        # Compute t-tf-idf scores and extract keywords
        tile_topics = get_tile_topics(new_count_mat, row_node_map, ngrams)

        level_tile_topics[level] = tile_topics

    return level_tile_topics


def select_topic_levels(
    max_zoom_scale,
    svg_width,
    svg_height,
    x_domain,
    y_domain,
    tree_extent,
    ideal_tile_width=35,
):
    """
    Automatically determine the min and max topic levels needed for the visualization.

    Args:
        max_zoom_scale (float): Max zoom scale level
        svg_width (int): SVG width
        svg_height (int): SVG height
        x_domain ([float, float]): [x min, x max]
        y_domain ([float, float]): [y min, y max]
        tree_extent ([[float, float], [float, float]]): The extent of the tree
        ideal_tile_width (int, optional): Optimal tile width in pixel. Defaults to 35.
    """

    svg_length = max(svg_width, svg_height)
    world_length = max(x_domain[1] - x_domain[0], y_domain[1] - y_domain[0])
    tree_to_world_scale = (tree_extent[1][0] - tree_extent[0][0]) / world_length

    scale = 1
    selected_levels = []

    while scale <= max_zoom_scale:
        best_level = 1

        # Check if 'np.inf' exists (NumPy 2.0+) and use it instead of deprecated 'np.Infinity'
        best_tile_width_diff = np.inf if hasattr(np, "inf") else np.Infinity

        for l in range(1, 21):
            tile_num = 2**l
            svg_scaled_length = scale * svg_length * tree_to_world_scale
            tile_width = svg_scaled_length / tile_num

            if abs(tile_width - ideal_tile_width) < best_tile_width_diff:
                best_tile_width_diff = abs(tile_width - ideal_tile_width)
                best_level = l

        selected_levels.append(best_level)
        scale += 0.5

    return np.min(selected_levels), np.max(selected_levels)


def generate_topic_dict(
    xs: list[float],
    ys: list[float],
    texts: list[str],
    max_zoom_scale=30,
    svg_width=1000,
    svg_height=1000,
    ideal_tile_width=35,
    stop_words: list[str] | Literal["english"] = "english",
):
    """Generate a topic dictionary object that encodes the topics of different
    regions in the embedding map across scales.

    Args:
        xs ([float]): A list of x coordinates of projected points
        ys ([float]): A list of y coordinates of projected points
        texts ([str]): A list of documents associated with points
        max_zoom_scale (float): The maximal zoom scale (default to zoom x 30)
        svg_width (float): The approximate size of the wizmap window
        svg_height (float): The approximate size of the wizmap window
        stop_words (list[str] | Literal["english"]): Stop words for the count vectorizer.

    Returns:
        dict: A dictionary object encodes the contour plot.
    """
    data = []

    # Create data array
    for i, x in enumerate(xs):
        cur_data = {
            "x": x,
            "y": ys[i],
            "pid": i,
        }
        data.append(cur_data)

    # Build the quadtree
    tree = Quadtree()
    tree.add_all_data(data)

    # Build the count matrix
    root = tree.get_node_representation()

    cv = CountVectorizer(stop_words=stop_words, ngram_range=(1, 1))
    count_mat = cv.fit_transform(texts)
    ngrams = cv.get_feature_names_out()

    xs = [d["x"] for d in data]
    ys = [d["y"] for d in data]
    x_domain = [np.min(xs), np.max(xs)]
    y_domain = [np.min(ys), np.max(ys)]

    # Get suggestions of quadtree levels to extract
    min_level, max_level = select_topic_levels(
        max_zoom_scale,
        svg_width,
        svg_height,
        x_domain,
        y_domain,
        tree.extent(),
        ideal_tile_width,
    )

    # Generate topics
    level_tile_topics = extract_level_topics(
        root, count_mat, texts, ngrams, min_level=min_level, max_level=max_level
    )

    # Create a dictionary to store the topics at different scale levels
    data_dict = {
        "extent": tree.extent(),
        "data": {},
        "range": [
            float(x_domain[0]),
            float(y_domain[0]),
            float(x_domain[1]),
            float(y_domain[1]),
        ],
    }

    for cur_level in range(min_level, max_level + 1):
        cur_topics = level_tile_topics[cur_level]
        data_dict["data"][cur_level] = []

        for topic in cur_topics:
            # Get the topic name
            name = "-".join([p[0] for p in topic["w"][:4]])
            x = (topic["p"][0] + topic["p"][2]) / 2
            y = (topic["p"][1] + topic["p"][3]) / 2
            cur_data = {"x": round(x, 3), "y": round(y, 3), "n": name, "l": cur_level}
            data_dict["data"][cur_level].append([round(x, 3), round(y, 3), name])

    return data_dict


def generate_grid_dict(
    xs: list[float],
    ys: list[float],
    texts: list[str],
    embedding_name="My Embedding",
    grid_size=200,
    max_sample=100000,
    random_seed=202355,
    max_zoom_scale=30,
    svg_width=1000,
    svg_height=1000,
    ideal_tile_width=35,
    labels: list[int] | None = None,
    group_names: list[str] | None = None,
    times: list[str] | None = None,
    time_format: str | None = None,
    image_label: int | None = None,
    image_url_prefix: str | None = None,
    opacity: float | None = None,
    stop_words: list[str] | Literal["english"] = "english",
    json_point_content_config: JsonPointContentConfig | None = None,
):
    """Generate a grid dictionary object that encodes the contour plot and the
    associated topics of different regions on the projected embedding space.

    Args:
        xs ([float]): A list of x coordinates of projected points
        ys ([float]): A list of y coordinates of projected points
        texts ([str]): A list of documents associated with points
        embeddingName (str): Custom name of this embedding map
        grid_size (int, optional): The resolution of the grid. Defaults to 200
        max_sample (int, optional): Max number of samples to compute KDE from.
            Defaults to 100000
        random_seed (int, optional): Seed for the random state. Defaults to 202355
        max_zoom_scale (float): The maximal zoom scale (default to zoom x 30)
        svg_width (float): The approximate size of the wizmap window
        svg_height (float): The approximate size of the wizmap window
        ideal_tile_width (float): The ideal tile width in pixels
        labels ([int]): A list of category labels of projected points. Labels
            must be consecutive integers starting from 0. Defaults to None.
        group_names ([str]): Category names associated with the given labels.
            For example, the group name of label i is group_names[i]. Defaults
            to None.
        times ([str]): A list of times associated with data points. Defaults to None.
        time_format (str): strptime format string to parse the time string in times
        image_label (int): The label corresponds to an image point
        image_url_prefix (str): The url prefix for all image texts
        opacity (float): The opacity of data points. If it is None, WizMap will
            dynamically adjust the opacity values. Defaults to None.
        stop_words (list[str] | Literal["english"]): A set of stop words to filter out when generating topics.
        json_point_content_config (JsonPointContentConfig | None): Config for json point.
            A json point can include both image and text, etc.

    Returns:
        dict: A dictionary object encodes the grid data.
    """
    print("Start generating contours...")
    contour_dict = generate_contour_dict(
        xs,
        ys,
        grid_size=grid_size,
        max_sample=max_sample,
        random_seed=random_seed,
        labels=labels,
        group_names=group_names,
        times=times,
        time_format=time_format,
    )

    print("Start generating multi-level summaries...")
    # If the user uses json point, we need to extract the text content first
    if json_point_content_config is not None:
        real_texts = [
            json.loads(d)[json_point_content_config["textKey"]] for d in texts
        ]
    else:
        real_texts = texts
    topic_dict = generate_topic_dict(
        xs,
        ys,
        real_texts,
        max_zoom_scale=max_zoom_scale,
        svg_width=svg_width,
        svg_height=svg_height,
        ideal_tile_width=ideal_tile_width,
        stop_words=stop_words,
    )

    # Add meta data to the final output
    grid_dict = contour_dict
    grid_dict["topic"] = topic_dict
    grid_dict["embeddingName"] = embedding_name

    if opacity is not None:
        grid_dict["opacity"] = opacity

    # Create a config for image points
    if image_label is not None:
        image_config: dict[str, int | str | None] = {"imageGroup": image_label}

        if image_url_prefix is not None:
            image_config["imageURLPrefix"] = image_url_prefix

        grid_dict["image"] = image_config

    if json_point_content_config is not None:
        grid_dict["jsonPoint"] = json_point_content_config

    return grid_dict


def generate_data_list(
    xs: list[float],
    ys: list[float],
    texts: list[str],
    times: list[str] | None = None,
    labels: list[int] | None = None,
) -> list[list]:
    """Generate a list of data points.

    Args:
        xs (list[float]): A list of x coordinates of projected points
        ys (list[float]): A list of y coordinates of projected points
        texts (list[str]): A list of documents associated with points
        times (list[str], optional): A list of timestamps associated with points.
            Defaults to [].
        labels (list[int], optional): A list of category labels associated
            with points. Defaults to [].

    Returns:
        list[list]: A list of data points.
    """
    print("Start generating data list...")

    data_list = []

    for i, x in enumerate(xs):
        cur_row = [x, ys[i], texts[i]]

        if times is not None:
            cur_row.append(times[i])

            if labels is not None:
                cur_row.append(labels[i])

        else:
            if labels is not None:
                cur_row.append("")
                cur_row.append(labels[i])

        data_list.append(cur_row)

    return data_list


def save_json_files(
    data_list: list,
    grid_dict: dict,
    output_dir="./",
    data_json_name="data.ndjson",
    grid_json_name="grid.json",
):
    """Save the dictionary and list as json files.

    Args:
        data_list (list): The data list.
        grid_dict (dict): The grid dictionary.
        output_dir (str, optional): Folder to save the two json files.
            Defaults to './'.
        data_json_name (str, optional): Filename of the data json file.
            Defaults to 'data.ndjson'.
        grid_json_name (str, optional): Filename of the grid json file.
            Defaults to 'grid.json'.
    """
    with open(join(output_dir, data_json_name), "w", encoding="utf8") as fp:
        ndjson.dump(data_list, fp)

    with open(join(output_dir, grid_json_name), "w", encoding="utf8") as fp:
        json.dump(grid_dict, fp)


def _make_html(data_url, grid_url):
    """
    Function to create an HTML string to bundle WizMap's html, css, and js.
    We use base64 to encode the js so that we can use inline defer for <script>

    We add another script to pass Python data as inline json, and dispatch an
    event to transfer the data

    Args:
        data_url(str): URL to the data json file
        grid_url(str): URL to the grid json file

    Return:
        HTML code with deferred JS code in base64 format
    """
    # HTML template for WizMap widget
    html_top = """<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>WizMap</title><style>html {font-size: 16px;-moz-osx-font-smoothing: grayscale;-webkit-font-smoothing: antialiased;text-rendering: optimizeLegibility;-webkit-text-size-adjust: 100%;-moz-text-size-adjust: 100%;scroll-behavior: smooth;}html, body {position: relative;width: 100%;height: 100%;overscroll-behavior: none;}body {margin: 0px;padding: 0px;box-sizing: border-box;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;color: hsl(0, 0%, 29%);font-size: 1em;font-weight: 400;line-height: 1.5;}*, ::after, ::before {box-sizing: inherit;}a {color: rgb(0, 100, 200);text-decoration: none;}a:hover {text-decoration: underline;}a:visited {color: rgb(0, 80, 160);}label {display: block;}input, select, textarea {font-family: inherit;font-size: inherit;-webkit-padding: 0 0;padding: 0;margin: 0 0 0 0;box-sizing: border-box;border: 1px solid #ccc;border-radius: 2px;}input:disabled {color: #ccc;}button {all: unset;outline: none;cursor: pointer;}</style>"""
    html_bottom = """</head><body><div id="app"></div></body></html>"""

    # Read the bundled JS file
    js_b = pkgutil.get_data(__name__, "wizmap.js")

    # Read local JS file (for development only)
    # with open("./wizmap.js", "r") as fp:
    #     js_string = fp.read()
    # js_b = bytes(js_string, encoding="utf-8")

    # Encode the JS & CSS with base 64
    js_base64 = base64.b64encode(js_b).decode("utf-8")

    # Pass data into JS by using another script to dispatch an event
    messenger_js = f"""
        (function() {{
            const event = new Event('wizmapData');
            event.dataURL = '{data_url}';
            event.gridURL = '{grid_url}';
            document.dispatchEvent(event);
        }}())
    """
    messenger_js = messenger_js.encode()
    messenger_js_base64 = base64.b64encode(messenger_js).decode("utf-8")

    # Inject the JS to the html template
    html_str = (
        html_top
        + """<script defer src='data:text/javascript;base64,{}'></script>""".format(
            js_base64
        )
        + """<script defer src='data:text/javascript;base64,{}'></script>""".format(
            messenger_js_base64
        )
        + html_bottom
    )

    return html.escape(html_str)


def visualize(data_url, grid_url, height=700):
    """
    Render WizMap in the output cell.

    Args:
        data_url(str): URL to the data json file
        grid_url(str): URL to the grid json file
        width(int): Width of the main visualization window
        height(int): Height of the whole window

    Return:
        HTML code with deferred JS code in base64 format
    """
    html_str = _make_html(data_url, grid_url)

    # Randomly generate an ID for the iframe to avoid collision
    iframe_id = "wizmap-iframe-" + str(int(random.random() * 1e8))

    iframe = f"""
        <iframe
            srcdoc="{html_str}"
            frameBorder="0"
            width="100%"
            height="{height}px"
            id="{iframe_id}"
            style="border: 1px solid hsl(0, 0%, 90%); border-radius: 5px;">
        </iframe>
    """

    # Display the iframe
    display_html(iframe, raw=True)
