import { SearchBar, Selector } from 'antd-mobile'
import type { SelectorOption } from 'antd-mobile'
import './SearchFilters.css'

interface SearchFiltersProps {
  filterColumns?: number
  filterLabel?: string
  filterOptions: SelectorOption<string>[]
  filterValues: string[]
  multiple?: boolean
  onFilterChange: (values: string[]) => void
  onSearch?: (value: string) => void
  onSearchChange: (value: string) => void
  placeholder?: string
  searchValue: string
}

export function SearchFilters({
  filterColumns = 3,
  filterLabel = '活动筛选',
  filterOptions,
  filterValues,
  multiple = false,
  onFilterChange,
  onSearch,
  onSearchChange,
  placeholder = '搜索活动名称、地点或标签',
  searchValue,
}: SearchFiltersProps) {
  return (
    <section aria-label="搜索与筛选" className="search-filters">
      <SearchBar
        onChange={onSearchChange}
        onSearch={onSearch}
        placeholder={placeholder}
        value={searchValue}
      />
      <div className="search-filters__selector">
        <span className="search-filters__label">{filterLabel}</span>
        <Selector
          columns={filterColumns}
          multiple={multiple}
          onChange={onFilterChange}
          options={filterOptions}
          showCheckMark={false}
          value={filterValues}
        />
      </div>
    </section>
  )
}
