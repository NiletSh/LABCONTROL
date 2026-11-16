import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  primary?: boolean
  hideOnMobile?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  getId,
  caption,
  empty,
  resetKey,
  pageSize = 8,
  onRow,
}: {
  rows: T[]
  columns: Column<T>[]
  getId: (row: T) => string
  caption: string
  empty: string
  resetKey?: string
  pageSize?: number
  onRow?: (row: T) => void
}) {
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [resetKey])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  const slice = rows.slice(start, start + pageSize)
  const primary = columns.find((column) => column.primary) ?? columns[0]

  if (!rows.length) return <p className="empty">{empty}</p>

  return (
    <div>
      <div className="table-scroll">
        <table className="data">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.id} scope="col">{column.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={getId(row)}
                className={onRow ? 'is-clickable' : undefined}
                onClick={onRow ? () => onRow(row) : undefined}
              >
                {columns.map((column) => <td key={column.id}>{column.cell(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-list">
        {slice.map((row) => (
          <article
            key={getId(row)}
            className={onRow ? 'record-card is-clickable' : 'record-card'}
            onClick={onRow ? () => onRow(row) : undefined}
          >
            <header>{primary.cell(row)}</header>
            <dl>
              {columns.filter((column) => column !== primary && !column.hideOnMobile).map((column) => (
                <div key={column.id}>
                  <dt>{column.header}</dt>
                  <dd>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {pages > 1 ? (
        <div className="pager">
          <p>{start + 1}–{Math.min(start + pageSize, rows.length)} de {rows.length}</p>
          <div className="pager-actions">
            <Button type="button" variant="secondary" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Página anterior">
              <ChevronLeft size={18} />
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Página siguiente">
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
