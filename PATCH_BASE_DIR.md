# Fix BASE_DIR not defined

Add this line after line 49 in `app/backend/api/enhanced_main_api.py`:

```python
# Define base directory for file operations  
BASE_DIR = Path(__file__).resolve().parent.parent
```

Insert between:
- Line 49: `PricingTier = None  # final fallback; will use local calcular_costo`
- Line 51: `# Internal modules (from your existing code)`

This will resolve the NameError causing the 500 error when archiving files.
