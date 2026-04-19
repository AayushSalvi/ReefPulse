from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from app.core.config import settings
from app.ml.model_registry import load_model_b
from app.schemas.anomaly import AnomalyRequest, AnomalyResponse, DrivingVariable


class AnomalyService:
    def __init__(self) -> None:
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = load_model_b()
        return self._model

    def score_request(self, request: AnomalyRequest) -> AnomalyResponse:
        feature_names, state_vector = request.to_feature_vector()
        return self.score(state_vector=state_vector, feature_names=feature_names)

    def score(
        self,
        *,
        state_vector: Sequence[float],
        feature_names: Sequence[str] | None = None,
    ) -> AnomalyResponse:
        values = [float(value) for value in state_vector]
        resolved_feature_names = list(feature_names or [f"feature_{index + 1}" for index in range(len(values))])
        reconstruction_result = self.model.reconstruct(values)

        squared_errors = []
        driving_variables: list[DrivingVariable] = []
        for feature_name, observed, reconstructed in zip(
            resolved_feature_names,
            values,
            reconstruction_result.reconstruction,
        ):
            absolute_error = abs(observed - reconstructed)
            reconstruction_error = absolute_error**2
            squared_errors.append(reconstruction_error)
            driving_variables.append(
                DrivingVariable(
                    feature=feature_name,
                    reconstruction_error=reconstruction_error,
                    absolute_error=absolute_error,
                    observed_value=observed,
                    reconstructed_value=reconstructed,
                )
            )

        anomaly_score = sum(squared_errors) / max(1, len(squared_errors))
        severity = self._severity(anomaly_score)

        return AnomalyResponse(
            anomaly_score=anomaly_score,
            threshold=settings.model_b_threshold,
            high_threshold=settings.model_b_high_threshold,
            is_anomaly=anomaly_score >= settings.model_b_threshold,
            severity=severity,
            model_source=reconstruction_result.model_source,
            feature_names=resolved_feature_names,
            reconstruction=reconstruction_result.reconstruction,
            latent_mean=reconstruction_result.latent_mean,
            latent_logvar=reconstruction_result.latent_logvar,
            driving_variables=sorted(
                driving_variables,
                key=lambda item: item.reconstruction_error,
                reverse=True,
            ),
        )

    @staticmethod
    def _severity(anomaly_score: float) -> str:
        if anomaly_score >= settings.model_b_high_threshold:
            return "high"
        if anomaly_score >= settings.model_b_threshold:
            return "elevated"
        return "normal"


@lru_cache(maxsize=1)
def get_anomaly_service() -> AnomalyService:
    return AnomalyService()


anomaly_service = get_anomaly_service()
