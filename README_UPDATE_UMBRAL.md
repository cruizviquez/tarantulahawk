# Update Umbral Script

Use `app/backend/scripts/update_umbral.py` to update LFPIORPI umbrales for a specific fracción key.

Examples:

Dry run:

```bash
python3 app/backend/scripts/update_umbral.py --fraccion servicios_generales --aviso 2000 --efectivo 8000 --dry-run
```

Apply change:

```bash
python3 app/backend/scripts/update_umbral.py --fraccion servicios_generales --aviso 2000 --efectivo 8000
```

This script will update `app/backend/models/config_modelos.json`.
