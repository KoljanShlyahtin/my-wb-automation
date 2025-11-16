#!/usr/bin/env python3
"""
Скрипт для вычисления времени восхода и заката солнца.
Использует приближённые формулы из статьи на Wikipedia.
https://en.wikipedia.org/wiki/Sunrise_equation
"""

import sys
import json
from datetime import datetime, timedelta
import math

def format_time(dt):
    """Форматирует время в строку HH:MM."""
    if dt is None:
        return "--:--"
    return dt.strftime("%H:%M")

def get_sun_times(lat, lng):
    """
    Вычисляет приблизительное время восхода и заката солнца.
    Использует упрощённые формулы, основанные на:
    https://en.wikipedia.org/wiki/Sunrise_equation
    """
    # Константы
    PI = math.pi
    rad = PI / 180
    deg = 180 / PI

    # Текущая дата (UTC)
    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)

    # Julian Day Number (JD) для начала дня (00:00 UTC)
    a = (14 - today.month) // 12
    y = today.year + 4800 - a
    m = today.month + 12 * a - 3
    jd = today.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045

    # Julian Century (JC)
    jc = (jd - 2451545.0) / 36525

    # --- Вычисления для солнечного положения ---
    # Geometric Mean Longitude of the Sun (L)
    L = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
    if L < 0:
        L += 360

    # Geometric Mean Anomaly of the Sun (g)
    g = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)

    # Eccentricity of Earth's Orbit (e)
    e_orbit = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)

    # Equation of Center (C)
    C = math.sin(rad * g) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
    C += math.sin(rad * 2 * g) * (0.019993 - 0.000101 * jc)
    C += math.sin(rad * 3 * g) * 0.000289

    # True Longitude of the Sun (theta)
    theta = L + C

    # Apparent Longitude of the Sun (lambda)
    omega = 125.04 - 1934.136 * jc
    lam = theta - 0.00569 - 0.00478 * math.sin(rad * omega)

    # Obliquity of the Ecliptic (epsilon)
    eps0 = 23 + (26 + 21.448 / 60) / 60
    eps = eps0 - jc * (46.815 / 3600 - jc * (0.00059 / 3600 + jc * 0.001813 / 3600))

    # Right Ascension of the Sun (alpha)
    y_ra = math.cos(rad * eps) * math.sin(rad * lam)
    x_ra = math.cos(rad * lam)
    alpha = math.atan2(y_ra, x_ra) * deg
    if alpha < 0:
        alpha += 360

    # Declination of the Sun (delta)
    delta = math.asin(math.sin(rad * eps) * math.sin(rad * lam))

    # --- Вычисления для восхода/заката ---
    # Standard zenith angle for sunrise/sunset (90°50')
    zenith = 90 + 50.0/60
    zenith_rad = rad * zenith

    # Cosine of the hour angle (H)
    cos_H = (math.cos(zenith_rad) - math.sin(rad * lat) * math.sin(delta)) / (math.cos(rad * lat) * math.cos(delta))

    # Проверка, будет ли восход/закат
    if cos_H > 1:
        # Sun never rises
        return {"solarNoon": None, "nadir": None, "sunrise": None, "sunset": None, "error": "never_rises"}
    elif cos_H < -1:
        # Sun never sets
        return {"solarNoon": None, "nadir": None, "sunrise": None, "sunset": None, "error": "never_sets"}

    # Calculate H in degrees
    H = math.acos(cos_H) * deg

    # Local Mean Time of Solar Transit (Solar Noon in degrees)
    # This is an approximation. The full formula involves EOT (Equation of Time).
    # For a simple approximation, we'll use the longitude-based calculation.
    # Solar Noon (in Local Apparent Time) is when the sun crosses the local meridian.
    # The time difference from solar noon depends on the hour angle H.

    # A more precise way involves calculating the Equation of Time (EOT) and using it.
    # Simplified EOT (in minutes)
    # EOT = 9.87 * sin(2*B) - 7.53 * cos(B) - 1.5 * sin(B)
    # where B = 360*(dayOfYear-81)/365 in degrees
    day_of_year = today.timetuple().tm_yday
    B = 360 * (day_of_year - 81) / 365
    B_rad = rad * B
    EOT_simplified = 9.87 * math.sin(2 * B_rad) - 7.53 * math.cos(B_rad) - 1.5 * math.sin(B_rad)

    # Solar Noon in UTC (hours)
    # 12h (mean solar time) - EOT_minutes/60 - lng_degrees/15
    solar_noon_utc_hours = 12 - (EOT_simplified / 60) - (lng / 15.0)

    # Ensure the time is within 0-24
    solar_noon_utc_hours = solar_noon_utc_hours % 24

    # Time difference for sunrise/set in hours (H degrees / 15 deg per hour)
    time_diff_hours = H / 15.0

    # Sunrise and Sunset in UTC (hours)
    sunrise_utc_hours = solar_noon_utc_hours - time_diff_hours
    sunset_utc_hours = solar_noon_utc_hours + time_diff_hours

    # Adjust for day wrap-around
    # We need to calculate the full datetime object to handle day changes correctly
    def hours_to_datetime(base_date, hours_float):
        # Handle day wrap-around
        adjusted_date = base_date
        adjusted_hours = hours_float
        if adjusted_hours < 0:
            adjusted_date -= timedelta(days=1)
            adjusted_hours += 24
        elif adjusted_hours >= 24:
            adjusted_date += timedelta(days=1)
            adjusted_hours -= 24

        hours = int(adjusted_hours)
        minutes = int((adjusted_hours - hours) * 60)
        # Seconds are ignored for simplicity here
        # Create a new datetime object for the specific time
        return datetime.combine(adjusted_date.date(), datetime.min.time()).replace(hour=hours, minute=minutes)

    sunrise_dt = hours_to_datetime(today, sunrise_utc_hours)
    sunset_dt = hours_to_datetime(today, sunset_utc_hours)
    solarnoon_dt = hours_to_datetime(today, solar_noon_utc_hours)

    return {
        "solarNoon": solarnoon_dt,
        "nadir": solarnoon_dt - timedelta(hours=12), # Approximate nadir
        "sunrise": sunrise_dt,
        "sunset": sunset_dt
    }

# --- Main execution ---
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: get_sun_times.py <latitude> <longitude>"}))
        sys.exit(1)

    try:
        lat = float(sys.argv[1])
        lng = float(sys.argv[2])
    except ValueError:
        print(json.dumps({"error": "Invalid arguments. Must be numbers."}))
        sys.exit(1)

    times = get_sun_times(lat, lng)

    # Format the output for wb-rules (wb-rules expects timestamps or readable strings)
    # Using ISO format for dates/times which wb-rules can handle
    formatted_output = {}
    for key, value in times.items():
        if isinstance(value, datetime):
            formatted_output[key] = value.isoformat() + "Z" # Z indicates UTC
        else:
            formatted_output[key] = value # Pass through errors or other values

    print(json.dumps(formatted_output))
