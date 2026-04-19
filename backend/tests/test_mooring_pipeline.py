from app.pipelines.ingest_mooring import infer_site_from_filename, s3_key_for_file
from app.pipelines.process_mooring import classify_depth_level, normalize_coordinates, parse_filename


def test_infer_site_from_filename() -> None:
    assert infer_site_from_filename("OS_CCE1_17_D_CTD.nc") == "CCE1"


def test_s3_key_for_file() -> None:
    assert s3_key_for_file("OS_CCE2_16_D_OXYGEN.nc") == "raw/moorings/cce2/OS_CCE2_16_D_OXYGEN.nc"


def test_parse_filename() -> None:
    site_code, deployment_id, file_type = parse_filename("OS_CCE1_17_D_CTD.nc")
    assert site_code == "CCE1"
    assert deployment_id == "CCE1-17"
    assert file_type == "CTD"


def test_classify_depth_level() -> None:
    assert classify_depth_level(15.0) == "shallow"
    assert classify_depth_level(50.0) == "mid"
    assert classify_depth_level(150.0) == "deep"


def test_normalize_coordinates_swaps_invalid_latitude() -> None:
    latitude, longitude = normalize_coordinates(-120.811083, 34.301677)
    assert latitude == 34.301677
    assert longitude == -120.811083
