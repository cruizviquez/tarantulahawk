def calcular_score_ebr(
        self,
        row: pd.Series,
        triggers: Optional[list] = None
    ) -> float:
        """
        Calcula un índice EBR (Enfoque Basado en Riesgos) en [0, 1] para una transacción.

        Factores principales:
        1) Monto y redondez
        2) Tipo de operación (efectivo / internacional / nacional)
        3) Temporalidad (nocturno / fin de semana) solo en combinación con efectivo/internacional
        4) Comportamiento histórico 6M (frecuencia, desvío vs promedio)
        5) Contexto (sector alto riesgo, acumulación 6M, bursts, guardrails)

        Este score NO reemplaza al modelo ML, lo complementa y se muestra siempre al usuario.
        """

        if triggers is None:
            triggers = []

        # Valores base
        monto = float(row.get("monto", 0.0))
        es_efectivo = int(row.get("EsEfectivo", 0))
        es_internacional = int(row.get("EsInternacional", 0))
        es_monto_redondo = int(row.get("es_monto_redondo", 0))
        sector_riesgo = int(row.get("SectorAltoRiesgo", 0))

        es_nocturno = int(row.get("es_nocturno", 0))
        fin_semana = int(row.get("fin_de_semana", 0))

        ops_6m = int(row.get("ops_6m", 0))
        monto_6m = float(row.get("monto_6m", 0.0))
        ratio_vs_prom = float(row.get("ratio_vs_promedio", 1.0))
        monto_std_6m = float(row.get("monto_std_6m", 0.0))
        freq_mensual = float(row.get("frecuencia_mensual", 1.0))

        fraccion = str(row.get("fraccion", "_"))
        umbral_aviso = self._get_umbral_mxn(fraccion, "aviso_UMA") or 0.0

        posible_burst = int(row.get("posible_burst", 0))

        # Score base neutro
        score = 0.0

        # ===== FACTOR 1: MONTO (peso 25%) =====
        factor_monto = 0.0

        if umbral_aviso > 0:
            if monto >= umbral_aviso:
                factor_monto = 1.0
            elif monto >= umbral_aviso * 0.7:
                factor_monto = 0.8
            elif monto >= umbral_aviso * 0.4:
                factor_monto = 0.5
            elif monto >= umbral_aviso * 0.2:
                factor_monto = 0.3
            else:
                factor_monto = 0.1 if monto > 0 else 0.0
        else:
            # Sin fracción conocida, usar umbrales fijos
            if monto >= 250_000:
                factor_monto = 1.0
            elif monto >= 150_000:
                factor_monto = 0.8
            elif monto >= 50_000:
                factor_monto = 0.5
            elif monto >= 10_000:
                factor_monto = 0.3
            else:
                factor_monto = 0.1 if monto > 0 else 0.0

        # Bonus por monto redondo en efectivo
        if es_efectivo == 1 and es_monto_redondo == 1 and monto > 50_000:
            factor_monto = min(factor_monto + 0.2, 1.0)

        score += 0.25 * factor_monto

        # ===== FACTOR 2: TIPO DE OPERACIÓN (peso 25%) =====
        factor_tipo = 0.0

        if es_efectivo == 1 and es_internacional == 1:
            # efectivo + internacional = máximo cuidado
            factor_tipo = 1.0
        elif es_efectivo == 1:
            factor_tipo = 0.8
        elif es_internacional == 1:
            factor_tipo = 0.7
        else:
            factor_tipo = 0.2  # nacional / tarjeta

        score += 0.25 * factor_tipo

        # ===== FACTOR 3: TEMPORAL (peso 10%) =====
        factor_temporal = 0.0

        # Solo damos peso real si se combina con efectivo o internacional
        if (es_nocturno == 1 or fin_semana == 1) and (es_efectivo == 1 or es_internacional == 1):
            if es_nocturno == 1 and fin_semana == 1:
                factor_temporal = 1.0
            else:
                factor_temporal = 0.6
        else:
            # Operaciones nocturnas de nómina / clearing no suman casi nada
            factor_temporal = 0.1 if (es_nocturno == 1 or fin_semana == 1) else 0.0

        score += 0.10 * factor_temporal

        # ===== FACTOR 4: COMPORTAMIENTO HISTÓRICO (peso 25%) =====
        factor_patron = 0.0

        # Frecuencia mensual 6M (histórico Supabase)
        if freq_mensual <= 1:
            factor_patron += 0.0   # cliente esporádico
        elif freq_mensual <= 5:
            factor_patron += 0.3   # cliente ocasional
        elif freq_mensual <= 10:
            factor_patron += 0.6   # cliente regular
        else:
            factor_patron += 0.9   # cliente con mucha frecuencia: posible patrón

        # Desviación fuerte del promedio
        if ratio_vs_prom > 5.0:
            factor_patron = max(factor_patron, 1.0)
        elif ratio_vs_prom > 3.0:
            factor_patron = max(factor_patron, 0.8)
        elif ratio_vs_prom > 2.0:
            factor_patron = max(factor_patron, 0.5)

        # Primera operación grande en 6M
        if ops_6m == 1 and monto > 100_000:
            factor_patron = max(factor_patron, 0.7)

        # Comportamiento errático (alta variabilidad)
        if monto_std_6m > 0 and monto > 0:
            cv = monto_std_6m / monto  # coeficiente de variación
            if cv > 1.0:
                factor_patron = max(factor_patron, 0.5)

        score += 0.25 * min(factor_patron, 1.0)

        # ===== FACTOR 5: CONTEXTO / GIRO Y ACUMULACIÓN (peso 15%) =====
        factor_contexto = 0.0

        # Sector alto riesgo (LFPIORPI actividades vulnerables)
        if sector_riesgo == 1:
            if monto > 100_000:
                factor_contexto = 1.0
            else:
                factor_contexto = 0.7

        # Acumulación 6M cercana o por encima de umbral
        if umbral_aviso > 0:
            if monto_6m >= umbral_aviso:
                factor_contexto = max(factor_contexto, 1.0)
            elif monto_6m >= umbral_aviso * 0.7:
                factor_contexto = max(factor_contexto, 0.8)

        # Bursts de operaciones
        if posible_burst == 1:
            factor_contexto = max(factor_contexto, 0.7)

        score += 0.15 * min(factor_contexto, 1.0)

        # ===== BOOST POR TRIGGERS / GUARDA RIELES =====
        n_triggers_inusuales = len([t for t in triggers if t.startswith("inusual_")])

        if any(t.startswith("guardrail_") for t in triggers):
            # Guardrail normativo → score mínimo alto
            score = max(score, 0.9)
        elif n_triggers_inusuales >= 3:
            score = min(score + 0.10, 1.0)
        elif n_triggers_inusuales >= 2:
            score = min(score + 0.05, 1.0)

        # Normalizar a [0, 1]
        return float(max(0.0, min(score, 1.0)))
