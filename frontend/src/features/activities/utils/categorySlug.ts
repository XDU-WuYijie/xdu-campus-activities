import type { ActivityCategory } from '../model'

const CATEGORY_SLUGS: Readonly<Record<string, string>> = {
  学术讲座: 'academic-lectures',
  就业指导: 'career-guidance',
  竞赛训练: 'competition-training',
  创新实践: 'innovation-practice',
  文艺活动: 'arts-and-culture',
  体育活动: 'sports',
  志愿公益: 'volunteering',
  社团活动: 'student-clubs',
}

const CATEGORY_NAMES = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([name, slug]) => [slug, name]),
)

export function getCategorySlug(category: ActivityCategory): string {
  return CATEGORY_SLUGS[category.name] ?? `category-${category.id}`
}

export function getKnownCategorySlug(name: string): string | undefined {
  return CATEGORY_SLUGS[name]
}

export function resolveCategoryName(
  slug: string,
  categories: ActivityCategory[] = [],
): string | undefined {
  const knownName = CATEGORY_NAMES[slug]
  if (knownName) {
    return knownName
  }

  return categories.find(
    (category) => getCategorySlug(category) === slug,
  )?.name
}
