# Notebooks

This folder contains Jupyter notebooks for exploratory work.

## Quick start

1. Install dependencies:

```bash
cd notebooks
uv sync
```

2. Launch Jupyter Notebook:

```bash
uv run jupyter notebook
```

Optional: launch JupyterLab instead.

```bash
uv run jupyter lab
```

## Notes

- The virtual environment lives in `notebooks/.venv` and is ignored by git.
- Store notebooks (`*.ipynb`) directly in this folder.
