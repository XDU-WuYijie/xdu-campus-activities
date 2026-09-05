import { describe, expect, it } from 'vitest'
import {
  getCategorySlug,
  getKnownCategorySlug,
  resolveCategoryName,
} from './categorySlug'

describe('category slug', () => {
  it('uses stable readable slugs for built-in categories', () => {
    expect(getKnownCategorySlug('创新实践')).toBe('innovation-practice')
    expect(resolveCategoryName('competition-training')).toBe('竞赛训练')
  })

  it('uses a stable ID fallback for dynamic categories', () => {
    const category = {
      id: '9007199254740993',
      name: '机器人社',
      sortNo: 9,
      tags: [],
    }

    expect(getCategorySlug(category)).toBe('category-9007199254740993')
    expect(
      resolveCategoryName('category-9007199254740993', [category]),
    ).toBe('机器人社')
  })
})
