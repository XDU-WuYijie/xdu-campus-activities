import { describe, expect, it } from 'vitest'
import {
  getCategoryPathSegment,
  resolveCategoryName,
} from './categoryRoute'

const category = {
  id: '9007199254740993',
  name: '创新实践',
  sortNo: 4,
  tags: [],
}

describe('category route', () => {
  it('uses the stable category ID without a name mapping', () => {
    expect(getCategoryPathSegment(category)).toBe('9007199254740993')
  })

  it('resolves the display name from API category data', () => {
    expect(
      resolveCategoryName('9007199254740993', [category]),
    ).toBe('创新实践')
    expect(resolveCategoryName('missing', [category])).toBeUndefined()
  })
})
