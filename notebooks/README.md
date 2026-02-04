# Notebooks

This folder contains Jupyter notebooks for exploratory work.

## Quick start

1. Install dependencies:

```bash
cd notebooks
uv sync
```

2. Set API keys:

Create or update `notebooks/.env` (copy from `notebooks/.env.example`) and set:

- `OPENAI_API_KEY`
- `CARTESIA_API_KEY`
- `DEEPGRAM_API_KEY`

3. Launch Jupyter Notebook:

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

## Notebook categories

Voice exploration (TTS / S2S):
- `notebooks/tts_cartesia.ipynb`
- `notebooks/tts_deepgram.ipynb`
- `notebooks/tts_openai.ipynb`
- `notebooks/s2s_openai_realtime.ipynb`
