#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generar_dataset_pld_mexico_prod_lfpiorpi.py
- Genera dataset sintético con 4 columnas (lo que sube el cliente en el SaaS)
- Además, genera automáticamente un archivo ENRICHED (listo para ML) y etiquetado
- Para entrenamiento: el 'sector_actividad' se puede fijar o usar "random"
Uso:
  python app/backend/generators/generar_dataset_pld_mexico_prod_lfpiorpi.py 100000 random
  python app/backend/generators/generar_dataset_pld_mexico_prod_lfpiorpi.py 50000 joyeria_metales
"""
import os, sys, random
import numpy as np
import pandas as pd
from faker import Faker
from datetime import datetime, timedelta

from pathlib import Path

THIS = Path(__file__).resolve()                 # .../app/backend/api/utils/generar_dataset...
BASE_DIR = THIS.parents[2]                      # .../app/backend   (2 niveles arriba de utils)
CONFIG_PATH = str(BASE_DIR / "models" / "config_modelos.json")  # .../app/backend/models/config_modelos.json
UTILS_DIR = os.path.join(BASE_DIR, "utils")

# (opcional) sanity check para ver qué está usando en tu consola
print(f"[generador] CONFIG_PATH -> {CONFIG_PATH} | exists={Path(CONFIG_PATH).exists()}")


sys.path.append(UTILS_DIR)
from validador_enriquecedor import procesar_archivo

fake = Faker('es_MX')
Faker.seed(42)
np.random.seed(42)
random.seed(42)

TIPOS_OPERACION = ["efectivo","tarjeta","transferencia_nacional","transferencia_internacional"]
TIPO_WEIGHTS = {"efectivo":0.25,"tarjeta":0.35,"transferencia_nacional":0.30,"transferencia_internacional":0.10}

TARGET_DIST = {"relevante": 0.72, "inusual": 0.21, "preocupante": 0.07}

def generar_cliente_id():
    return f"CLT{random.randint(10000,99999)}"

def generar_fecha(dias_atras: int = 365) -> datetime:
    inicio = datetime.now() - timedelta(days=dias_atras)
    return inicio + timedelta(days=random.randint(0, dias_atras))

def monto_por_clase(clase: str, tipo_op: str) -> float:
    if clase=="preocupante":
        # montos altos, forzando a que cumplan reglas duras probables
        opciones = [np.random.uniform(170_000, 5_000_000)]
        if tipo_op=="efectivo":
            opciones += [np.random.uniform(165_000, 169_999), np.random.uniform(150_000, 164_999)]
        return round(random.choice(opciones), 2)
    elif clase=="inusual":
        opciones = [
            np.random.uniform(100_000, 169_999),
            np.random.uniform(80_000, 150_000) if tipo_op=="transferencia_internacional" else np.random.uniform(100_000, 169_999),
            np.random.uniform(100_000, 164_999) if tipo_op=="efectivo" else np.random.uniform(100_000, 150_000),
        ]
        return round(random.choice(opciones), 2)
    else:
        opciones = [np.random.uniform(100, 10_000), np.random.uniform(10_000, 50_000), np.random.uniform(50_000, 99_999)]
        return round(random.choice(opciones), 2)

def generar(n: int):
    n_rel = int(n*TARGET_DIST["relevante"]); n_inu = int(n*TARGET_DIST["inusual"]); n_pre = n-n_rel-n_inu
    registros = []
    pool_clientes = [generar_cliente_id() for _ in range(max(1000, int(n*0.3)))]
    for clase, cantidad in [("relevante", n_rel), ("inusual", n_inu), ("preocupante", n_pre)]:
        for _ in range(cantidad):
            tipo_op = random.choices(list(TIPO_WEIGHTS.keys()), weights=list(TIPO_WEIGHTS.values()))[0]
            registros.append({
                "cliente_id": random.choice(pool_clientes),
                "monto": monto_por_clase(clase, tipo_op),
                "fecha": generar_fecha().strftime("%Y-%m-%d"),
                "tipo_operacion": tipo_op,
                "_clase_interna": clase
            })
    df = pd.DataFrame(registros).sample(frac=1, random_state=42).reset_index(drop=True)
    return df

def guardar_base(df: pd.DataFrame, nombre: str):
    os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
    out_base = os.path.join(BASE_DIR, "uploads", f"{nombre}.csv")
    df[["cliente_id","monto","fecha","tipo_operacion"]].to_csv(out_base, index=False, encoding="utf-8")
    # También guardo versión con _clase_interna para validación offline
    df.to_csv(os.path.join(BASE_DIR, "uploads", f"{nombre}_validation.csv"), index=False, encoding="utf-8")
    return out_base

def main():
    if len(sys.argv)<2:
        print("\nUso: python app/backend/api/uitls/generar_dataset_pld_mexico_prod_lfpiorpi.py <n> [sector_actividad|random]\n")
        sys.exit(1)
    n = int(sys.argv[1]); sector = sys.argv[2] if len(sys.argv)>=3 else "random"
    df = generar(n)
    nombre = f"dataset_pld_lfpiorpi_{n}"
    base_csv = guardar_base(df, nombre)
    print(f"✅ Archivo base (4 columnas) guardado en: {base_csv}")
    # Enriquecer (y etiquetar consistente) con el validador
    enriched_path = procesar_archivo(base_csv, sector, CONFIG_PATH)
    print(f"✅ Archivo enriched (ML ready) guardado en: {enriched_path}")
    print("\nListo.\n")

if __name__=="__main__":
    main()
