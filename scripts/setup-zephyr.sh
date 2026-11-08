#!/usr/bin/env bash
set -euo pipefail
zephyr_dir="${ZEPHYR_HOME:-$HOME/.cache/applyflow-zephyr}"
llama_commit=7d7f0287530bc8981690f361d8c1627dbae1c99a
model_revision=e4714d14e9652aa9658fa937732cceadc63ac42e
model_sha=20517055262b7b0aa3588042bb0e3dae24d0ba2ac6503b5dcddeefc94eb35aaa
mkdir -p "$zephyr_dir"
if [ ! -d "$zephyr_dir/llama.cpp/.git" ]; then
  git init "$zephyr_dir/llama.cpp"
  git -C "$zephyr_dir/llama.cpp" remote add origin https://github.com/ggml-org/llama.cpp.git
  git -C "$zephyr_dir/llama.cpp" fetch --depth 1 origin "$llama_commit"
  git -C "$zephyr_dir/llama.cpp" checkout --detach FETCH_HEAD
fi
if [ "$(git -C "$zephyr_dir/llama.cpp" rev-parse HEAD)" != "$llama_commit" ]; then
  echo 'Existing llama.cpp checkout has a different revision; use a clean ZEPHYR_HOME.' >&2
  exit 1
fi
cmake -S "$zephyr_dir/llama.cpp" -B "$zephyr_dir/llama.cpp/build" -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_UI=OFF
cmake --build "$zephyr_dir/llama.cpp/build" --target llama-server -j 2
if [ ! -f "$zephyr_dir/model.gguf" ] || ! printf '%s  %s\n' "$model_sha" "$zephyr_dir/model.gguf" | sha256sum -c --status; then
  curl --fail --location --retry 2 "https://huggingface.co/TheBloke/zephyr-7B-beta-GGUF/resolve/$model_revision/zephyr-7b-beta.Q3_K_M.gguf?download=true" -o "$zephyr_dir/model.gguf.part"
  printf '%s  %s\n' "$model_sha" "$zephyr_dir/model.gguf.part" | sha256sum -c
  mv "$zephyr_dir/model.gguf.part" "$zephyr_dir/model.gguf"
fi
printf '%s\n' 'Zephyr is ready. Run scripts/start-zephyr.sh.'
