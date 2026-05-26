import styles from "../../style/admin.module.css";

type AdminPaginationProps = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
};

const pageSizes = [10, 25, 50, 100];

export default function AdminPagination({
  page,
  size,
  totalElements,
  totalPages,
  loading = false,
  onPageChange,
  onSizeChange,
}: AdminPaginationProps) {
  const firstItem = totalElements === 0 ? 0 : page * size + 1;
  const lastItem = Math.min(totalElements, (page + 1) * size);
  const currentPage = totalPages === 0 ? 0 : page + 1;

  return (
    <div className={styles.paginationBar}>
      <p className={styles.paginationSummary}>
        {loading ? "Updating..." : `Showing ${firstItem}-${lastItem} of ${totalElements}`}
      </p>

      <div className={styles.paginationControls}>
        <select
          className={styles.select}
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value))}
          disabled={loading}
          aria-label="Rows per page"
        >
          {pageSizes.map((pageSize) => (
            <option value={pageSize} key={pageSize}>
              {pageSize} / page
            </option>
          ))}
        </select>

        <button
          className={styles.button}
          type="button"
          disabled={loading || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className={styles.paginationPage}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className={styles.button}
          type="button"
          disabled={loading || totalPages === 0 || page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
