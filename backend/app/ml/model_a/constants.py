"""Model A (State Forecaster) constants."""

LOOKBACK_DAYS = 30
HORIZON_DAYS = 14
N_CHANNELS = 4

CHANNEL_NAMES: tuple[str, ...] = (
    "temp_c",
    "salinity",
    "oxygen_ml_l",
    "chlorophyll_a",
)

FEATURE_COLUMNS: tuple[str, ...] = (
    "station_id",
    "Date",
    "lat",
    "lon",
    "temp_c",
    "salinity",
    "oxygen_ml_l",
    "chlorophyll_a",
)
