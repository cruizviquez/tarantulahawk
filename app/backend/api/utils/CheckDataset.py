import pandas as pd

df = pd.read_csv("uploads/enriched/dataset_pld_lfpiorpi_150000_enriched_v2.csv")
# Verificar columnas nuevas V2
nuevas_cols_v2 = [
    'fin_de_semana', 'es_nocturno', 'es_monto_redondo',
    'monto_max_6m', 'monto_std_6m',
    'ops_relativas', 'diversidad_operaciones', 'concentracion_temporal',
    'ratio_vs_promedio', 'posible_burst'
]

assert all(col in df.columns for col in nuevas_cols_v2), "Faltan columnas V2"
print(f"✅ Dataset V2 validado: {len(df)} filas, {len(df.columns)} columnas")
