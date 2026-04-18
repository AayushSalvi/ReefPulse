from fastapi import APIRouter

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts() -> dict[str, object]:
    return {
        "message": "Alerts endpoint scaffolded.",
        "next_step": "Wire SNS/EventBridge or your queue/worker flow here.",
    }
