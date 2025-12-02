import os
import re
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd

# ================== CARGA DE CONFIG / DB ==================
load_dotenv()

DB_URL = os.getenv("DB_URL")
if not DB_URL:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "Capstone_rh")
    DB_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(">>> DB_URL =", DB_URL)

engine = create_engine(DB_URL)

app = FastAPI(title="Capstone RH Analytics API")

# ================== CORS ==================
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================== ENDPOINTS ==================


@app.get("/health")
def health_check():
    """Ping simple para ver si está viva la API y la DB."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        print("❌ ERROR_HEALTH_CHECK", e, flush=True)
        raise HTTPException(status_code=500, detail="DB no disponible")


@app.get("/dashboard/resumen")
def get_dashboard_resumen(period: str | None = None):
    """
    Resumen analítico para el dashboard.
    - Si no se pasa ?period=YYYY-MM, usa el mes actual.
    """
    try:
        # --- Normalizar período ---
        if not period or not re.match(r"^\d{4}-\d{2}$", period):
            hoy = date.today()
            period = f"{hoy.year:04d}-{hoy.month:02d}"

        year = int(period[:4])
        month = int(period[5:7])
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        with engine.connect() as conn:
            # ---------------- EMPLEADOS ----------------
            df_emp = pd.read_sql("SELECT id_empleado FROM empleados", conn)
            total_empleados = int(len(df_emp))

            df_con_vig_emp = pd.read_sql(
                text(
                    """
                    SELECT
                        e.id_empleado,
                        MAX(
                            CASE WHEN c.estado = 'vigente' THEN 1 ELSE 0 END
                        ) AS tiene_vigente
                    FROM empleados e
                    LEFT JOIN contrato c
                        ON c.id_empleado = e.id_empleado
                    GROUP BY e.id_empleado
                    """
                ),
                conn,
            )

            con_contrato_vigente = int(
                df_con_vig_emp["tiene_vigente"].fillna(0).astype(int).sum()
            )
            sin_contrato_vigente = max(total_empleados - con_contrato_vigente, 0)

            # ---------------- CONTRATOS ----------------
            df_con = pd.read_sql(
                "SELECT id_contrato, estado, sueldo_base_contrato, tipo FROM contrato",
                conn,
            )
            total_contratos = int(len(df_con))

            vigentes = 0
            sueldo_prom = 0.0
            sueldo_max = 0.0
            sueldo_min = 0.0
            por_tipo_vigentes: dict[str, int] = {}
            por_tipo_finiquitados: dict[str, int] = {}

            if not df_con.empty:
                # Normalizar estado a minúscula por si acaso
                df_con["estado"] = df_con["estado"].astype(str).str.lower()

                # Cuántos contratos están vigentes
                vigentes = int((df_con["estado"] == "vigente").sum())

                # Contratos vigentes
                df_vig = df_con[df_con["estado"] == "vigente"].copy()
                if not df_vig.empty:
                    df_vig["sueldo_base_contrato"] = (
                        pd.to_numeric(df_vig["sueldo_base_contrato"], errors="coerce")
                        .fillna(0)
                    )
                    sueldo_prom = float(df_vig["sueldo_base_contrato"].mean())
                    sueldo_max = float(df_vig["sueldo_base_contrato"].max())
                    sueldo_min = float(df_vig["sueldo_base_contrato"].min())

                    por_tipo_vig_raw = df_vig["tipo"].value_counts().to_dict()
                    por_tipo_vigentes = {
                        str(k): int(v) for k, v in por_tipo_vig_raw.items()
                    }

                # Contratos finiquitados
                df_fin = df_con[df_con["estado"] == "finiquitado"].copy()
                if not df_fin.empty:
                    por_tipo_fin_raw = df_fin["tipo"].value_counts().to_dict()
                    por_tipo_finiquitados = {
                        str(k): int(v) for k, v in por_tipo_fin_raw.items()
                    }

            # ---------------- LIQUIDACIONES (PERÍODO) ----------------
            df_liq = pd.read_sql(
                text(
                    """
                    SELECT periodo, sueldo_liquido
                    FROM liquidaciones
                    WHERE periodo = :period
                    """
                ),
                conn,
                params={"period": period},
            )

            if not df_liq.empty:
                df_liq["sueldo_liquido"] = pd.to_numeric(
                    df_liq["sueldo_liquido"], errors="coerce"
                ).fillna(0)

                cantidad_liq = int(len(df_liq))
                total_liquido = float(df_liq["sueldo_liquido"].sum())
                promedio_liquido = float(df_liq["sueldo_liquido"].mean())
                max_liquido = float(df_liq["sueldo_liquido"].max())
                min_liquido = float(df_liq["sueldo_liquido"].min())
            else:
                cantidad_liq = 0
                total_liquido = 0.0
                promedio_liquido = 0.0
                max_liquido = 0.0
                min_liquido = 0.0

            # ---------------- ASISTENCIA (PERÍODO) ----------------
            df_asistencia = pd.read_sql(
                text(
                    """
                    SELECT estado
                    FROM asistencia
                    WHERE fecha >= :start_date AND fecha < :end_date
                    """
                ),
                conn,
                params={"start_date": start_date, "end_date": end_date},
            )

            if not df_asistencia.empty:
                # Normalizar estado a minúsculas
                df_asistencia["estado"] = (
                    df_asistencia["estado"].astype(str).str.lower()
                )
                total_registros_asistencia = int(len(df_asistencia))
                por_estado_raw = df_asistencia["estado"].value_counts().to_dict()
                por_estado = {str(k): int(v) for k, v in por_estado_raw.items()}

                presentes = (
                    por_estado.get("presente", 0)
                    + por_estado.get("ok", 0)
                    + por_estado.get("asistencia", 0)
                )
                porcentaje_asistencia = round(
                    100.0 * presentes / total_registros_asistencia, 1
                )
            else:
                total_registros_asistencia = 0
                por_estado = {}
                porcentaje_asistencia = 0.0

            # ---------------- TRENDS: LIQUIDACIONES ÚLTIMOS 6 PERÍODOS ----------------
            df_trend = pd.read_sql(
                text(
                    """
                    SELECT periodo,
                           AVG(sueldo_liquido) AS promedio_liquido,
                           COUNT(*) AS cantidad
                    FROM liquidaciones
                    GROUP BY periodo
                    ORDER BY periodo DESC
                    LIMIT 6
                    """
                ),
                conn,
            )

            trends_liq = []
            if not df_trend.empty:
                df_trend["promedio_liquido"] = pd.to_numeric(
                    df_trend["promedio_liquido"], errors="coerce"
                ).fillna(0)
                df_trend_sorted = df_trend.sort_values("periodo")
                for _, row in df_trend_sorted.iterrows():
                    trends_liq.append(
                        {
                            "periodo": str(row["periodo"]).strip(),
                            "promedio_liquido": float(row["promedio_liquido"] or 0.0),
                            "cantidad": int(row["cantidad"] or 0),
                        }
                    )

        # ---------------- ARMAR RESPUESTA ----------------
        return {
            "empleados": {
                "total": total_empleados,
                "con_contrato_vigente": con_contrato_vigente,
                "sin_contrato_vigente": sin_contrato_vigente,
            },
            "contratos": {
                "total": total_contratos,
                "vigentes": vigentes,
                "sueldo_promedio": sueldo_prom,
                "sueldo_minimo": sueldo_min,
                "sueldo_maximo": sueldo_max,
                "por_tipo_vigentes": por_tipo_vigentes,
                "por_tipo_finiquitados": por_tipo_finiquitados,
            },
            "liquidaciones": {
                "periodo": period,
                "promedio_liquido": promedio_liquido,
                "cantidad": cantidad_liq,
                "total_liquido": total_liquido,
                "max_liquido": max_liquido,
                "min_liquido": min_liquido,
            },
            "asistencia": {
                "periodo": period,
                "total_registros": total_registros_asistencia,
                "por_estado": por_estado,
                "porcentaje_asistencia": porcentaje_asistencia,
            },
            "trends": {
                "liquidaciones_ultimos_6m": trends_liq,
            },
        }

    except Exception as e:
        print("❌ ERROR_GET_DASHBOARD_RESUMEN", e)
        raise HTTPException(
            status_code=500, detail="Error al generar resumen analítico."
        )
