import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(frontendRoot, 'src')
const errors = []
let checkedModules = 0

const componentCollections = [
  'components/layout',
  'components/ui',
  'pages',
]

const featureLayers = new Set([
  'api',
  'components',
  'hooks',
  'model',
  'providers',
  'types',
  'utils',
])

function displayPath(path) {
  return relative(frontendRoot, path)
}

function checkModuleCollection(relativePath) {
  const collectionPath = join(srcRoot, relativePath)

  for (const entry of readdirSync(collectionPath, { withFileTypes: true })) {
    const entryPath = join(collectionPath, entry.name)

    if (entry.isFile()) {
      if (entry.name !== 'index.ts') {
        errors.push(`${displayPath(entryPath)}：集合根级只允许 index.ts`)
      }
      continue
    }

    if (!entry.isDirectory()) {
      errors.push(`${displayPath(entryPath)}：不支持此文件类型`)
      continue
    }

    if (!/^[A-Z][A-Za-z0-9]*$/.test(entry.name)) {
      errors.push(`${displayPath(entryPath)}：模块目录必须使用 PascalCase`)
    }

    if (!existsSync(join(entryPath, 'index.ts'))) {
      errors.push(`${displayPath(entryPath)}：缺少公共导出 index.ts`)
    }

    const implementationNames = [
      `${entry.name}.ts`,
      `${entry.name}.tsx`,
    ]
    if (!implementationNames.some((name) => existsSync(join(entryPath, name)))) {
      errors.push(
        `${displayPath(entryPath)}：缺少与目录同名的 .ts 或 .tsx 实现`,
      )
    }

    checkedModules += 1
  }
}

function checkFeatures() {
  const featuresPath = join(srcRoot, 'features')

  for (const domain of readdirSync(featuresPath, { withFileTypes: true })) {
    const domainPath = join(featuresPath, domain.name)

    if (!domain.isDirectory()) {
      errors.push(`${displayPath(domainPath)}：features 根级只允许业务域目录`)
      continue
    }

    if (!/^[a-z][A-Za-z0-9]*$/.test(domain.name)) {
      errors.push(`${displayPath(domainPath)}：业务域目录必须使用 lowerCamelCase`)
    }

    if (!existsSync(join(domainPath, 'index.ts'))) {
      errors.push(`${displayPath(domainPath)}：缺少业务域公共导出 index.ts`)
    }

    for (const entry of readdirSync(domainPath, { withFileTypes: true })) {
      const entryPath = join(domainPath, entry.name)

      if (entry.isFile()) {
        if (entry.name !== 'index.ts') {
          errors.push(
            `${displayPath(entryPath)}：业务实现应放入职责子目录`,
          )
        }
        continue
      }

      if (!entry.isDirectory()) {
        errors.push(`${displayPath(entryPath)}：不支持此文件类型`)
        continue
      }

      if (!featureLayers.has(entry.name)) {
        errors.push(
          `${displayPath(entryPath)}：未知职责目录，请先更新架构约定`,
        )
      }

      if (!existsSync(join(entryPath, 'index.ts'))) {
        errors.push(`${displayPath(entryPath)}：缺少职责层公共导出 index.ts`)
      }
    }

    checkedModules += 1
  }
}

for (const collection of componentCollections) {
  checkModuleCollection(collection)
}
checkFeatures()

if (errors.length > 0) {
  console.error('前端目录结构检查失败：')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`前端目录结构检查通过，共检查 ${checkedModules} 个模块。`)
