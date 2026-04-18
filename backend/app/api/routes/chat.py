from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query")
def query_agent() -> dict[str, object]:
    return {
        "message": "Chat endpoint scaffolded.",
        "next_step": "Route user questions into your retrieval + model orchestration layer.",
    }
