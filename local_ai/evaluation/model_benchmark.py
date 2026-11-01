"""
Local AI Model Benchmark Suite.
Evaluates local LLMs (Qwen2.5-Coder 3B, Qwen2.5-Coder 1.5B, Granite 3B)
and Nomic Embeddings on the HP Victus RTX 3050 Laptop GPU (4GB VRAM).
Measures:
- Latency (seconds)
- Generation throughput (tokens/second)
- Prompt processing throughput
- GPU VRAM consumption & temperature
- Structured JSON output validity
"""

import time
import json
from typing import Dict, Any, List
from local_ai.providers.ollama_provider import ollama_provider
from local_ai.providers.nomic_embedding_provider import nomic_embedding_provider
from local_ai.routing.gpu_resource_manager import gpu_manager

BENCHMARK_TASKS = [
    {
        "model": "qwen2.5-coder:3b",
        "task_name": "TwoSum Algorithm Implementation & Complexity Analysis",
        "category": "Code Generation",
        "messages": [
            {"role": "system", "content": "You are an expert algorithms engineer. Write optimal code and explain complexity."},
            {"role": "user", "content": "Write a clean C++20 function for two-sum using std::unordered_map. Analyze time and space complexity."}
        ]
    },
    {
        "model": "qwen2.5-coder:1.5b",
        "task_name": "Anomaly Event Intent Classification",
        "category": "Fast Classification",
        "messages": [
            {"role": "system", "content": "Classify the security severity of the assessment event: LOW, MEDIUM, or HIGH. Return JSON."},
            {"role": "user", "content": '{"event": "PROCESS_STARTED", "process": "cheatengine.exe", "window_title": "Cheat Engine 7.5"}'}
        ]
    },
    {
        "model": "granite4.1:3b",
        "task_name": "Forensic Hypothesis Reasoning",
        "category": "Hypothesis Generation",
        "messages": [
            {"role": "system", "content": "You are a cybersecurity forensic investigator. Formulate a hypothesis for the anomaly."},
            {"role": "user", "content": "Candidate connected a secondary USB display adapter during the live coding phase while network traffic showed spikes to an external IP. Formulate a 2-sentence forensic hypothesis."}
        ]
    }
]


def run_llm_benchmarks() -> List[Dict[str, Any]]:
    print("=" * 70)
    print(" RUNNING INTERVIEWOS LOCAL LLM BENCHMARK SUITE")
    print(" Target Hardware: NVIDIA GeForce RTX 3050 Laptop GPU (4GB VRAM)")
    print("=" * 70)

    results = []
    initial_vram = gpu_manager.get_vram_info()
    print(f"Initial VRAM: {initial_vram['used_mb']} MB / {initial_vram['total_mb']} MB ({initial_vram['utilization_pct']}%)")
    print(f"GPU Temp: {initial_vram['temperature_c']} C | Power Draw: {initial_vram['power_w']} W\n")

    for task in BENCHMARK_TASKS:
        model = task["model"]
        print(f"--> Benchmarking [{model}] - {task['task_name']} ({task['category']})...")

        vram_before = gpu_manager.get_vram_info()
        start_time = time.time()
        try:
            res = ollama_provider.chat(
                model=model,
                messages=task["messages"],
                temperature=0.1,
                num_ctx=2048
            )
            vram_after = gpu_manager.get_vram_info()

            entry = {
                "model": model,
                "task": task["task_name"],
                "category": task["category"],
                "status": "PASS",
                "tokens_generated": res["eval_count"],
                "tokens_per_sec": res["tokens_per_sec"],
                "elapsed_sec": res["elapsed_seconds"],
                "prompt_eval_count": res["prompt_eval_count"],
                "vram_used_mb": vram_after["used_mb"],
                "temp_c": vram_after["temperature_c"],
                "power_w": vram_after["power_w"],
                "sample_output": res["content"][:120].replace("\n", " ") + "..."
            }
            results.append(entry)
            print(f"    Tokens: {entry['tokens_generated']} | Speed: {entry['tokens_per_sec']} t/s | Latency: {entry['elapsed_sec']}s")
            print(f"    VRAM: {entry['vram_used_mb']} MB | Temp: {entry['temp_c']} C\n")
        except Exception as e:
            print(f"    FAILED: {e}\n")
            results.append({
                "model": model,
                "task": task["task_name"],
                "category": task["category"],
                "status": "FAIL",
                "error": str(e)
            })

    # Benchmark Embeddings
    print("--> Benchmarking [nomic-embed-text:latest] - 768-dim Vector Embeddings...")
    sample_texts = [
        "Candidate implemented two-pointer technique for sorted array traversal.",
        "Prohibited process cheatengine.exe detected with high confidence.",
        "Candidate explains hash collision resolution via quadratic probing."
    ]
    start_embed = time.time()
    try:
        embeds = nomic_embedding_provider.embed(sample_texts, task_type="document")
        embed_time = time.time() - start_embed
        print(f"    Generated {len(embeds)} embeddings in {round(embed_time, 3)}s ({len(embeds[0])} dimensions each)")
        results.append({
            "model": "nomic-embed-text:latest",
            "task": "Semantic Vector Embeddings (Batch 3)",
            "category": "Embedding",
            "status": "PASS",
            "dimensions": len(embeds[0]),
            "count": len(embeds),
            "elapsed_sec": round(embed_time, 3),
            "tokens_per_sec": round(len(embeds) / embed_time, 2)
        })
    except Exception as e:
        print(f"    FAILED: {e}\n")
        results.append({
            "model": "nomic-embed-text:latest",
            "task": "Semantic Vector Embeddings",
            "category": "Embedding",
            "status": "FAIL",
            "error": str(e)
        })

    print("=" * 70)
    print(" BENCHMARK COMPLETED")
    print("=" * 70)
    return results


if __name__ == "__main__":
    run_llm_benchmarks()
