        row: pd.Series
    ) -> Dict[str, Any]:
        """
        Genera flags de revisión manual y alertas
        
        Criterios:
        - Revisión manual: baja confianza, múltiples triggers sin confirmación ML
        - Reclasificación: triggers indican inusual pero ML dice relevante
        """
        
        flags = {
            "requiere_revision_manual": False,
            "sugerir_reclasificacion": False,
            "alertas": []
        }
        
        # 1. Baja confianza
        if score_confianza < self.umbral_confianza_bajo:
            flags["requiere_revision_manual"] = True
            flags["alertas"].append({
                "tipo": "baja_confianza",
                "severidad": "warning",
                "mensaje": f"Confianza del modelo baja ({score_confianza:.1%}). Se recomienda revisión manual."
            })
        
        # 2. Múltiples triggers pero clasificación baja
        triggers_inusuales = [t for t in triggers if t.startswith("inusual_")]
        if len(triggers_inusuales) >= 2 and clasificacion == "relevante":
            flags["sugerir_reclasificacion"] = True
            flags["alertas"].append({
                "tipo": "sugerir_reclasificacion",
                "severidad": "info",
                "mensaje": f"Se detectaron {len(triggers_inusuales)} indicadores de riesgo. Considere reclasificar como 'inusual'.",
                "de": "relevante",
                "a": "inusual"
            })
        
        # 3. Efectivo alto sin ser preocupante
        if row.get('EsEfectivo', 0) == 1 and row.get('monto', 0) > 100000 and clasificacion != "preocupante":
            flags["alertas"].append({
                "tipo": "efectivo_alto",
                "severidad": "info",
                "mensaje": f"Operación en efectivo de ${row['monto']:,.2f}. Verificar documentación."
            })
        
        # 4. Internacional sin contexto
        if row.get('EsInternacional', 0) == 1:
            flags["alertas"].append({
                "tipo": "internacional",
                "severidad": "info",
                "mensaje": "Operación internacional. Validar país de origen/destino."
            })
        
        # 5. Primera operación alta
        if row.get('ops_6m', 1) == 1 and row.get('monto', 0) > 50000:
            flags["alertas"].append({
                "tipo": "primera_operacion_alta",
                "severidad": "warning",
                "mensaje": "Primera operación del cliente con monto significativo. Revisar KYC."
            })
        
        return flags
    
    def _generar_contexto_regulatorio(self, fraccion: str, monto: float) -> str:
        """Genera contexto regulatorio según la fracción"""
        
        UMA = 113.14
        
        contextos = {
            "XI_joyeria": {
                "nombre": "Fracción XI - Joyería, Piedras Preciosas y Metales",
                "umbral_aviso": 3210 * UMA,
                "umbral_efectivo": 3210 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "VIII_vehiculos": {
                "nombre": "Fracción VIII - Comercialización de Vehículos",
                "umbral_aviso": 6420 * UMA,
                "umbral_efectivo": 3210 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "V_inmuebles": {
                "nombre": "Fracción V - Inmuebles",
                "umbral_aviso": 8025 * UMA,
                "umbral_efectivo": 8025 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "XVI_activos_virtuales": {
                "nombre": "Fracción XVI - Activos Virtuales",
                "umbral_aviso": 210 * UMA,
                "umbral_efectivo": None,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables (2024)"
            }
        }
        
        if fraccion not in contextos:
            return "Actividad no regulada específicamente como Actividad Vulnerable."
        
        ctx = contextos[fraccion]
        umbral_aviso = ctx["umbral_aviso"]
        
        partes = [
            f"**{ctx['nombre']}**",
            f"\nUmbral de aviso: ${umbral_aviso:,.2f} MXN ({int(umbral_aviso/UMA)} UMA)"
        ]
        
        if ctx["umbral_efectivo"]:
            partes.append(f"\nLímite efectivo: ${ctx['umbral_efectivo']:,.2f} MXN ({int(ctx['umbral_efectivo']/UMA)} UMA)")
        
        partes.append(f"\nBase legal: {ctx['normativa']}")
        
        if monto >= umbral_aviso:
            partes.append(f"\n\n⚠️ Esta transacción **SUPERA** el umbral de aviso.")
        else:
            porcentaje = (monto / umbral_aviso) * 100
            partes.append(f"\n\nMonto representa el {porcentaje:.1f}% del umbral de aviso.")
        
        return "".join(partes)
    
    def _generar_acciones_sugeridas(
        self,
        clasificacion: str,
        origen: str,
        flags: Dict[str, Any],
        row: pd.Series
    ) -> List[str]:
        """Genera lista de acciones sugeridas para el analista"""
        
        acciones = []
        
        if clasificacion == "preocupante":
            acciones.append("📤 Preparar aviso a UIF (obligatorio)")
            acciones.append("🔍 Verificar documentación soporte completa")
            acciones.append("👤 Validar identidad del cliente y beneficiario final")
            
            if row.get('EsEfectivo', 0) == 1:
                acciones.append("💵 Documentar origen de efectivo")
        
        elif clasificacion == "inusual":
            acciones.append("📋 Documentar operación en expediente")
            acciones.append("🔍 Revisar perfil transaccional del cliente")
            acciones.append("⏰ Monitorear operaciones subsecuentes (30 días)")
        
        if flags.get("requiere_revision_manual"):
            acciones.append("👁️ **REVISIÓN MANUAL OBLIGATORIA** - Baja confianza del modelo")
        
        if flags.get("sugerir_reclasificacion"):
            acciones.append("⚠️ Considerar reclasificación a nivel superior")
        
        if row.get('EsInternacional', 0) == 1:
            acciones.append("🌍 Validar país de origen/destino en listas de países de alto riesgo")
        
        if row.get('ops_6m', 1) == 1:
            acciones.append("📝 Revisar expediente KYC del cliente")
        
        return acciones if acciones else ["✅ No se requieren acciones adicionales"]


# =====================================================
# EJEMPLO DE USO EN PORTAL
# =====================================================

def enriquecer_para_portal(df: pd.DataFrame, probabilidades_dict: Dict = None) -> pd.DataFrame:
    """
    Enriquece DataFrame con metadata de explicabilidad para mostrar en portal
    
    Args:
        df: DataFrame con resultados del modelo
        probabilidades_dict: {index: {clase: probabilidad}} (opcional)
    
    Returns:
        DataFrame con columnas adicionales para el portal
    """
    
    explainer = TransactionExplainer(umbral_confianza_bajo=0.65)
    
    metadata_list = []
    
    for idx, row in df.iterrows():
        # Obtener probabilidades si existen
        probas = probabilidades_dict.get(idx) if probabilidades_dict else None
        
        # Obtener triggers (desde columna razones o recalcular)
        razones_str = str(row.get('razones', ''))
        triggers = razones_str.split('; ') if razones_str else []
        
        # Generar explicación
        metadata = explainer.explicar_transaccion(row, probas, triggers)
        metadata_list.append(metadata)
    
    # Agregar columnas al DataFrame
    df['score_confianza'] = [m['score_confianza'] for m in metadata_list]
    df['nivel_confianza'] = [m['nivel_confianza'] for m in metadata_list]
    df['explicacion_principal'] = [m['explicacion_principal'] for m in metadata_list]
    df['requiere_revision_manual'] = [m['flags']['requiere_revision_manual'] for m in metadata_list]
    df['sugerir_reclasificacion'] = [m['flags']['sugerir_reclasificacion'] for m in metadata_list]
    df['num_alertas'] = [len(m['flags']['alertas']) for m in metadata_list]
    
    # Guardar metadata completa en JSON para frontend
    df['metadata_json'] = [metadata_list[i] for i in range(len(metadata_list))]
    
    return df


if __name__ == "__main__":
    # Test
    import json
    
    # Cargar ejemplo
    df_test = pd.DataFrame({
        'cliente_id': ['CLT001'],
        'monto': [120000],
        'clasificacion': ['relevante'],
        'origen': ['ml'],
        'fue_corregido_por_guardrail': [False],
        'tipo_operacion': ['transferencia_nacional'],
        'sector_actividad': ['joyeria_metales'],
        'fraccion': ['XI_joyeria'],
        'EsEfectivo': [0],
        'EsInternacional': [0],
        'es_nocturno': [1],
        'fin_de_semana': [0],
        'ops_6m': [1],
        'razones': ['Nocturno Finsemana Alto']
    })
    
    explainer = TransactionExplainer()
    
    metadata = explainer.explicar_transaccion(
        df_test.iloc[0],
        probabilidades={'relevante': 0.68, 'inusual': 0.25, 'preocupante': 0.07},
        triggers=['inusual_nocturno_finsemana_alto', 'inusual_monto_alto']
    )
    
    print("="*70)
    print("🧪 EJEMPLO DE EXPLICACIÓN COMPLETA")
    print("="*70)
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
