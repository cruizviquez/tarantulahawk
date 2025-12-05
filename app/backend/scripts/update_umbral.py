#!/usr/bin/env python3
"""
Update or add a specific LFPIORPI umbral entry for a given fracción key.
Usage:
  python update_umbral.py --fraccion servicios_generales --aviso 2000 --efectivo 8000
"""
import argparse
import json
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--fraccion', required=True)
    p.add_argument('--aviso', type=float, required=False)
    p.add_argument('--efectivo', type=float, required=False)
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    CONFIG = Path('app/backend/models/config_modelos.json')
    if not CONFIG.exists():
        print('Config file not found:', CONFIG)
        return 1

    cfg = json.load(open(CONFIG, 'r', encoding='utf-8'))
    umbrales = cfg.setdefault('lfpiorpi', {}).setdefault('umbrales', {})
    fr = args.fraccion
    u = umbrales.get(fr, {})

    if args.aviso is not None:
        u['aviso_UMA'] = int(args.aviso)
    if args.efectivo is not None:
        u['efectivo_max_UMA'] = int(args.efectivo)

    if not args.dry_run:
        umbrales[fr] = u
        cfg['lfpiorpi']['umbrales'] = umbrales
        with open(CONFIG, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
        print('Updated fraccion', fr, 'with umbral', u)
    else:
        print('Dry-run: would update fraccion', fr, 'with', u)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
