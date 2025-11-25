#!/usr/bin/env python3
import pickle
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    model_path = Path(__file__).parent / "outputs" / "modelo_ensemble_stack.pkl"
    print(f"Loading model from: {model_path}")
    print(f"File exists: {model_path.exists()}")

    with open(model_path, 'rb') as f:
        bundle = pickle.load(f)

    print('Keys in bundle:', list(bundle.keys()))
    for key, value in bundle.items():
        print(f'{key}: {type(value)}')
        if hasattr(value, '__len__') and not isinstance(value, str):
            try:
                print(f'  Length: {len(value)}')
            except:
                pass

except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()