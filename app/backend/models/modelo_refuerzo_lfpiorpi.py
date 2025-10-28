
# ===================================================================
# ARCHIVO 3: modelo_refuerzo_lfpiorpi.py
# ===================================================================
"""
Reinforcement Learning Model - Q-Learning
"""

import os, json, logging, joblib, warnings
import numpy as np
import pandas as pd
from collections import defaultdict



warnings.filterwarnings("ignore")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config_modelos.json")

def discretizar_estado(row, n_states=25):
    monto = row.get("monto", 0)
    risk = row.get("MontoAlto", 0) * 2 + row.get("SectorAltoRiesgo", 0)
    monto_bin = min(int(monto / 25_000), n_states - 1)
    monto_bin = min(monto_bin + risk, n_states - 1)
    return monto_bin

def calcular_recompensa(row, action):
    clase_real = row.get("clasificacion_lfpiorpi", "relevante")
    accion_map = {"relevante": 0, "inusual": 1, "preocupante": 2}
    accion_esperada = accion_map[clase_real]
    
    if action == accion_esperada:
        return 15
    elif clase_real == "preocupante" and action != 2:
        return -35
    elif clase_real == "inusual" and action == 0:
        return -12
    else:
        return -5

def main():
    print(f"\n{'='*70}")
    print("🤖 MODELO DE REFUERZO")
    print(f"{'='*70}\n")
    
    with open(CONFIG_PATH, "r") as f:
        cfg = json.load(f)
    
    dataset_path = cfg["dataset"]["path"]
    df = pd.read_csv(dataset_path)
    
    episodios = 800
    alpha = 0.3
    gamma = 0.9
    epsilon = 0.4
    epsilon_min = 0.02
    decay_rate = 0.995
    n_states = 25
    
    print(f"Episodios: {episodios}")
    print(f"Estados: {n_states}\n")
    
    q_table = defaultdict(lambda: np.zeros(3))
    rewards_history = []
    
    for ep in range(episodios):
        total_reward = 0
        df_shuffled = df.sample(frac=1, random_state=ep).reset_index(drop=True)
        
        for _, row in df_shuffled.iterrows():
            state = discretizar_estado(row, n_states)
            
            if np.random.random() < epsilon:
                action = np.random.choice([0, 1, 2])
            else:
                action = np.argmax(q_table[state])
            
            reward = calcular_recompensa(row, action)
            next_state = max(0, min(state + np.random.randint(-1, 2), n_states - 1))
            
            q_table[state][action] += alpha * (
                reward + gamma * np.max(q_table[next_state]) - q_table[state][action]
            )
            
            total_reward += reward
        
        rewards_history.append(total_reward)
        epsilon = max(epsilon_min, epsilon * decay_rate)
        
        if ep % 100 == 0:
            avg = np.mean(rewards_history[-100:]) if len(rewards_history) >= 100 else np.mean(rewards_history)
            print(f"  Episodio {ep}/{episodios} | Reward: {avg:,.0f}")
    
    avg_final = np.mean(rewards_history[-100:])
    
    print(f"\n{'='*70}")
    print(f"✅ Completado")
    print(f"📊 Reward promedio: {avg_final:,.0f}")
    print(f"🔢 Estados: {len(q_table)}")
    print(f"{'='*70}\n")
    
    joblib.dump(dict(q_table), "backend/outputs/modelo_refuerzo_th.pkl")
    
    metrics = {
        "reward_promedio": float(avg_final),
        "episodios": episodios,
        "estados_explorados": len(q_table)
    }
    
    with open("backend/outputs/metricas_refuerzo.json", "w") as f:
        json.dump(metrics, f, indent=4)
    
    print("✅ Modelo guardado: backend/outputs/modelo_refuerzo_th.pkl\n")

if __name__ == "__main__":
    main()
