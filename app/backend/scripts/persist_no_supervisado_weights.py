#!/usr/bin/env python3
"""
Persist No-supervisado weights into the PKL bundle from config.
Usage:
    python scripts/persist_no_supervisado_weights.py --source bundle|config
"""
import argparse
import json
from pathlib import Path
try:
    import joblib
except Exception:
    joblib = None
import pickle

BASE = Path(__file__).resolve().parent.parent
BUNDLE = BASE / 'outputs' / 'no_supervisado_bundle.pkl'
CONFIG = BASE / 'models' / 'config_modelos.json'


def load_config_weights():
    if not CONFIG.exists():
        raise FileNotFoundError('Config not found: ' + str(CONFIG))
    cfg = json.load(open(CONFIG, 'r', encoding='utf-8'))
    return cfg.get('modelos', {}).get('no_supervisado', {}).get('weights', None)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', type=str, default=str(BUNDLE), help='Path to no_supervisado bundle')
    parser.add_argument('--config', type=str, default=str(CONFIG), help='Path to config json')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to bundle')
    args = parser.parse_args()

    bundle_path = Path(args.bundle)
    if not bundle_path.exists():
        print('Bundle not found:', bundle_path)
        return 1

    cfg_path = Path(args.config)
    if not cfg_path.exists():
        print('Config not found:', cfg_path)
        return 1

    if joblib:
        b = joblib.load(bundle_path)
    else:
        with open(bundle_path, 'rb') as f:
            b = pickle.load(f)
    print('Current bundle weights:', b.get('weights'))

    weights = load_config_weights()
    if not weights:
        print('No weights in config; exiting')
        return 1

    print('Weights to write:', weights)
    if args.dry_run:
        print('Dry run - not writing')
        return 0

    b['weights'] = weights
    if joblib:
        joblib.dump(b, bundle_path)
    else:
        with open(bundle_path, 'wb') as f:
            pickle.dump(b, f)
    print('Bundle updated with weights', weights)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
