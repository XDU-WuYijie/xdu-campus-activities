export type EntityId = string

export type ApiDateTime = string

export interface ApiResult<T> {
  success: boolean
  errorMsg: string | null
  data: T | null
  total: number | null
}

export interface PageResult<T> {
  items: T[]
  total: number
}
