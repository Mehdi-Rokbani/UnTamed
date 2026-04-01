import type { Difficulty } from "../../types/activity";
import styles from "../../style/ActiveFilterChips.module.css";

type CategoryOption = {
  id: string;
  label: string;
};

type Props = {
  addressInput: string;
  selectedAddressId: string | null;
  dateFrom: string;
  dateTo: string;
  difficulty: Difficulty | "All";
  categoryIds: string[];
  minPrice: string;
  maxPrice: string;
  categories: CategoryOption[];
  onClearAddress: () => void;
  onClearDateFrom: () => void;
  onClearDateTo: () => void;
  onClearDifficulty: () => void;
  onRemoveCategory: (id: string) => void;
  onClearMinPrice: () => void;
  onClearMaxPrice: () => void;
  onClearAll: () => void;
};

export function ActiveFilterChips({
  addressInput,
  selectedAddressId,
  dateFrom,
  dateTo,
  difficulty,
  categoryIds,
  minPrice,
  maxPrice,
  categories,
  onClearAddress,
  onClearDateFrom,
  onClearDateTo,
  onClearDifficulty,
  onRemoveCategory,
  onClearMinPrice,
  onClearMaxPrice,
  onClearAll,
}: Props) {
  const categoryChips = categoryIds
    .map((id) => {
      const found = categories.find((item) => item.id === id);
      return found ? { id, label: found.label } : null;
    })
    .filter(Boolean) as { id: string; label: string }[];

  const chips = [
    (addressInput.trim() || selectedAddressId) && {
      key: "address",
      label: addressInput.trim(),
      onClear: onClearAddress,
    },
    dateFrom && {
      key: "dateFrom",
      label: `From: ${dateFrom}`,
      onClear: onClearDateFrom,
    },
    dateTo && {
      key: "dateTo",
      label: `To: ${dateTo}`,
      onClear: onClearDateTo,
    },
    difficulty !== "All" && {
      key: "difficulty",
      label: difficulty,
      onClear: onClearDifficulty,
    },
    minPrice && {
      key: "minPrice",
      label: `Min ${minPrice}`,
      onClear: onClearMinPrice,
    },
    maxPrice && {
      key: "maxPrice",
      label: `Max ${maxPrice}`,
      onClear: onClearMaxPrice,
    },
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[];

  const hasAnything = chips.length > 0 || categoryChips.length > 0;
  if (!hasAnything) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <button key={chip.key} type="button" className={styles.chip} onClick={chip.onClear}>
            <span>{chip.label}</span>
            <span className={styles.x}>×</span>
          </button>
        ))}

        {categoryChips.map((chip) => (
          <button
            key={`cat-${chip.id}`}
            type="button"
            className={styles.chip}
            onClick={() => onRemoveCategory(chip.id)}
          >
            <span>{chip.label}</span>
            <span className={styles.x}>×</span>
          </button>
        ))}
      </div>

      <button type="button" className={styles.clearAll} onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}