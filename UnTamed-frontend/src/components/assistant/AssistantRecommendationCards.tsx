import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { ChatAssistantRecommendation } from "../../types/assistant";
import styles from "../../style/chat-assistant-widget.module.css";

type AssistantRecommendationCardsProps = {
  recommendations?: ChatAssistantRecommendation[];
  onNavigate?: (id: string) => void;
};

function formatPrice(value: ChatAssistantRecommendation["price"]) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numberValue)) return `${numberValue.toFixed(2)} TND`;
  return `${value} TND`;
}

function iconFor(item: ChatAssistantRecommendation) {
  const blob = `${item.title} ${item.location ?? ""} ${item.difficulty ?? ""}`.toLowerCase();
  if (blob.includes("climb")) return "C";
  if (blob.includes("bird")) return "B";
  if (blob.includes("heritage") || blob.includes("culture") || blob.includes("village")) return "H";
  if (blob.includes("camp")) return "T";
  if (blob.includes("beach") || blob.includes("sea") || blob.includes("coast") || blob.includes("water")) return "W";
  if (blob.includes("desert") || blob.includes("douz")) return "D";
  if (blob.includes("hike") || blob.includes("trek") || blob.includes("mountain")) return "M";
  return "A";
}

function RecommendationThumb({ item }: { item: ChatAssistantRecommendation }) {
  const [failed, setFailed] = useState(false);

  if (item.imageUrl && !failed) {
    return (
      <img
        className={styles.recommendationImage}
        src={item.imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className={styles.recommendationIcon} aria-hidden="true">{iconFor(item)}</span>;
}

export default function AssistantRecommendationCards({ recommendations = [], onNavigate }: AssistantRecommendationCardsProps) {
  const navigate = useNavigate();
  if (!recommendations.length) return null;

  return (
    <div className={styles.recommendationList}>
      {recommendations.slice(0, 5).map((item) => {
        const priceLabel = formatPrice(item.price);
        return (
          <button
            key={item.id}
            type="button"
            className={styles.recommendationCard}
            aria-label={`Open ${item.title}`}
            onClick={() => {
              onNavigate?.(item.id);
              navigate(`/activities/${item.id}`);
            }}
          >
            <RecommendationThumb item={item} />
            <span className={styles.recommendationBody}>
              <strong>{item.title}</strong>
              <span className={styles.recommendationMeta}>
                {item.difficulty && <em>{item.difficulty}</em>}
                {priceLabel && <span>{priceLabel}</span>}
              </span>
              {item.location && <span className={styles.recommendationLocation}>{item.location}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
