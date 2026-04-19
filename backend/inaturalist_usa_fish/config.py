"""Configuration constants for iNaturalist fish queries (default region: California, US)."""

# * Base URL for iNaturalist API v1.
API_BASE_URL = "https://api.inaturalist.org/v1"

# * Verified 2026-04-18 via GET /v1/places/autocomplete?q=United+States (slug united-states).
DEFAULT_US_PLACE_ID = 1

# * Verified 2026-04-18 via GET /v1/places/autocomplete?q=California (slug california-us).
DEFAULT_CA_PLACE_ID = 14

# * Default region filter for searches (California).
DEFAULT_PLACE_ID = DEFAULT_CA_PLACE_ID

# * Actinopterygii (ray-finned) + Chondrichthyes (cartilaginous); descendants included by API.
DEFAULT_FISH_TAXON_IDS = (47178, 196614)

# * Identifiable HTTP User-Agent for public API etiquette.
DEFAULT_USER_AGENT = "inaturalist-usa-fish/0.1 (+https://github.com/)"

# * iNaturalist per_page upper bound for observations index.
MAX_PER_PAGE = 200
