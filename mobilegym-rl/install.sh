pip install vllm==0.17.0
pip install -e ./verl --no-deps
pip install -e ./rllm-model-gateway
pip install -e .
pip install accelerate dill peft pybind11 pylatexenc torchdata wandb tensorboard swanlab \
    "tensordict>=0.8.0,<=0.10.0,!=0.9.0" \
    "transformers>=4.55.0,<5.0.0" "ray[default]>=2.41.0" \
    torchvision qwen-vl-utils

# pip install flash-attn==2.8.1 --no-build-isolation
pip install "https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.1/flash_attn-2.8.1+cu12torch2.10cxx11abiTRUE-cp312-cp312-linux_x86_64.whl"

pip install -r ../bench_env/requirements.txt
python -m playwright install chromium