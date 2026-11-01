"""
GPU Resource Manager for RTX 3050 (4GB VRAM).
Tracks VRAM allocation, temperature, power, and loaded models in Ollama.
Ensures single-model residence in VRAM to prevent thrashing or OOM.
"""

import subprocess
import requests
from typing import Dict, Any, Optional
from local_ai.config.settings import settings

import warnings

try:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        import pynvml
    PYNVML_AVAILABLE = True
except ImportError:
    PYNVML_AVAILABLE = False


class GPUResourceManager:
    def __init__(self):
        self._nvml_initialized = False
        if PYNVML_AVAILABLE:
            try:
                pynvml.nvmlInit()
                self._handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                self._nvml_initialized = True
            except Exception:
                self._nvml_initialized = False

    def get_vram_info(self) -> Dict[str, Any]:
        """
        Returns VRAM total, used, free in MiB, plus GPU temperature and power.
        """
        if self._nvml_initialized:
            try:
                mem = pynvml.nvmlDeviceGetMemoryInfo(self._handle)
                temp = pynvml.nvmlDeviceGetTemperature(self._handle, pynvml.NVML_TEMPERATURE_GPU)
                power = pynvml.nvmlDeviceGetPowerUsage(self._handle) / 1000.0  # mW to W
                return {
                    "total_mb": round(mem.total / (1024 * 1024), 1),
                    "used_mb": round(mem.used / (1024 * 1024), 1),
                    "free_mb": round(mem.free / (1024 * 1024), 1),
                    "utilization_pct": round((mem.used / mem.total) * 100, 1),
                    "temperature_c": temp,
                    "power_w": round(power, 1),
                    "device_name": pynvml.nvmlDeviceGetName(self._handle)
                }
            except Exception:
                pass

        # Fallback to nvidia-smi
        try:
            cmd = "nvidia-smi --query-gpu=memory.total,memory.used,memory.free,temperature.gpu,power.draw --format=csv,noheader,nounits"
            res = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=2)
            if res.returncode == 0:
                parts = [p.strip() for p in res.stdout.strip().split(",")]
                if len(parts) >= 3:
                    total = float(parts[0])
                    used = float(parts[1])
                    free = float(parts[2])
                    temp = float(parts[3]) if len(parts) > 3 else 0.0
                    power = float(parts[4]) if len(parts) > 4 else 0.0
                    return {
                        "total_mb": total,
                        "used_mb": used,
                        "free_mb": free,
                        "utilization_pct": round((used / total) * 100, 1) if total > 0 else 0.0,
                        "temperature_c": temp,
                        "power_w": power,
                        "device_name": "NVIDIA GeForce RTX 3050 Laptop GPU"
                    }
        except Exception:
            pass

        return {
            "total_mb": 4096.0,
            "used_mb": 0.0,
            "free_mb": 4096.0,
            "utilization_pct": 0.0,
            "temperature_c": 0.0,
            "power_w": 0.0,
            "device_name": "NVIDIA RTX 3050 Laptop GPU (Unmonitored)"
        }

    def get_loaded_ollama_models(self) -> Dict[str, Any]:
        """
        Queries Ollama /api/ps to see which models are currently loaded in VRAM/RAM.
        """
        try:
            resp = requests.get(f"{settings.OLLAMA_BASE_URL}/api/ps", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("models", [])
                return {
                    "count": len(models),
                    "models": [
                        {
                            "name": m.get("name"),
                            "size_vram_mb": round(m.get("size_vram", 0) / (1024 * 1024), 1),
                            "size_mb": round(m.get("size", 0) / (1024 * 1024), 1),
                            "expires_at": m.get("expires_at")
                        }
                        for m in models
                    ]
                }
        except Exception as e:
            return {"count": 0, "models": [], "error": str(e)}
        return {"count": 0, "models": []}

    def unload_model(self, model_name: str) -> bool:
        """
        Unloads a model from Ollama memory by calling generate with keep_alive=0.
        """
        try:
            resp = requests.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={"model": model_name, "keep_alive": 0},
                timeout=5.0
            )
            return resp.status_code == 200
        except Exception:
            return False


gpu_manager = GPUResourceManager()
