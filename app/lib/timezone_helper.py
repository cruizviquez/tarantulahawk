"""
Helper para timestamps en zona horaria de Ciudad de México (CDMX)
Mexico/Mexico_City = UTC-6 (o UTC-5 durante horario de verano)

Uso:
    from app.lib.timezone_helper import getNowCDMX, formatDateTimeCDMX
    now = getNowCDMX()
    print(formatDateTimeCDMX(now))  # "27/01/2026 14:30:45"
"""

from datetime import datetime, timezone
import pytz

# Zona horaria de Ciudad de México
MEXICO_CITY_TZ = pytz.timezone('America/Mexico_City')


def getNowCDMX() -> datetime:
    """
    Obtiene el timestamp actual en zona horaria de CDMX.
    
    Returns:
        datetime con zona horaria de Mexico/Mexico_City
    """
    return datetime.now(tz=MEXICO_CITY_TZ)


def toISOStringCDMX(dt: datetime = None) -> str:
    """
    Convierte una fecha a ISO string con la zona horaria de CDMX.
    
    Args:
        dt: Fecha a convertir (default: ahora)
    
    Returns:
        String ISO con offset de CDMX (ej: "2026-01-27T14:30:45-06:00")
    """
    if dt is None:
        dt = datetime.now(tz=MEXICO_CITY_TZ)
    elif dt.tzinfo is None:
        # Si no tiene zona horaria, asumimos que es UTC y la convertimos a CDMX
        dt = pytz.utc.localize(dt).astimezone(MEXICO_CITY_TZ)
    else:
        # Si ya tiene zona horaria, convertir a CDMX
        dt = dt.astimezone(MEXICO_CITY_TZ)
    
    return dt.isoformat()


def formatDateTimeCDMX(dt: datetime = None, format_str: str = "%d/%m/%Y %H:%M:%S") -> str:
    """
    Formatea una fecha/hora en CDMX para mostrar al usuario.
    
    Args:
        dt: Fecha a formatear (default: ahora)
        format_str: Formato deseado (default: "27/01/2026 14:30:45")
    
    Returns:
        String formateado
    """
    if dt is None:
        dt = datetime.now(tz=MEXICO_CITY_TZ)
    elif dt.tzinfo is None:
        dt = pytz.utc.localize(dt).astimezone(MEXICO_CITY_TZ)
    else:
        dt = dt.astimezone(MEXICO_CITY_TZ)
    
    return dt.strftime(format_str)


def formatDateCDMX(dt: datetime = None, format_str: str = "%d/%m/%Y") -> str:
    """
    Formatea solo la fecha en CDMX.
    
    Args:
        dt: Fecha a formatear (default: hoy)
        format_str: Formato deseado (default: "27/01/2026")
    
    Returns:
        String formateado
    """
    if dt is None:
        dt = datetime.now(tz=MEXICO_CITY_TZ)
    elif dt.tzinfo is None:
        dt = pytz.utc.localize(dt).astimezone(MEXICO_CITY_TZ)
    else:
        dt = dt.astimezone(MEXICO_CITY_TZ)
    
    return dt.strftime(format_str)


def getTimeCDMX() -> dict:
    """
    Obtiene la hora actual en CDMX como componentes separados.
    Útil para formularios.
    
    Returns:
        Dict con claves 'date', 'time', 'dateTime'
        Ejemplo: {
            'date': '2026-01-27',
            'time': '14:30',
            'dateTime': '2026-01-27T14:30'
        }
    """
    now = getNowCDMX()
    
    return {
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M'),
        'dateTime': now.strftime('%Y-%m-%dT%H:%M')
    }


def convertToUTCIfNeeded(dt: datetime) -> datetime:
    """
    Convierte un datetime a UTC si tiene zona horaria de CDMX.
    Útil para guardar en bases de datos que almacenan UTC.
    
    Args:
        dt: Fecha con posible zona horaria
    
    Returns:
        datetime en UTC
    """
    if dt.tzinfo is None:
        # Asumimos que es UTC
        return dt
    
    return dt.astimezone(pytz.utc)
