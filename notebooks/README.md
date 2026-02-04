# Notebooks

This folder contains Jupyter notebooks for exploratory work.

## Quick start

1. Install dependencies:

```bash
cd notebooks
uv sync
```

Note: Qwen TTS requires Python 3.10+ (via `accelerate`). This repo is pinned to Python 3.10 for a single, uniform env.

2. Set API keys:

Create or update `notebooks/.env` (copy from `notebooks/.env.example`) and set:

- `OPENAI_API_KEY`
- `CARTESIA_API_KEY`
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) for Gemini Live

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
- Audio outputs and run manifests are written to `notebooks/outputs/` with timestamps. This folder is gitignored.

## Notebook categories

Voice exploration (TTS / S2S):
- `notebooks/tts_cartesia.ipynb`
- `notebooks/tts_deepgram.ipynb`
- `notebooks/tts_openai.ipynb`
- `notebooks/tts_qwen.ipynb`
- `notebooks/s2s_openai_realtime.ipynb`
- `notebooks/s2s_gemini_live.ipynb`
