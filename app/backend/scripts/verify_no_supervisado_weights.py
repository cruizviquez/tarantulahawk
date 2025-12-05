#!/usr/bin/env python3
"""
Simple script to verify `weights` exist in the no_supervisado bundle after persistence.
"""
import json
from pathlib import Path

try:
    import joblib
except Exception:
    joblib = None

BASE = Path(__file__).resolve().parent.parent
BUNDLE = BASE / 'outputs' / 'no_supervisado_bundle.pkl'
CONFIG = BASE / 'models' / 'config_modelos.json'

def load_bundle(p):
    if joblib:
        return joblib.load(p)
    import pickle
    with open(p, 'rb') as f:
        return pickle.load(f)

def main():
    if not BUNDLE.exists():
        print('Bundle not found:', BUNDLE)
        return 1
    b = load_bundle(BUNDLE)
    weights = b.get('weights')
    print('weights in bundle:', weights)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
