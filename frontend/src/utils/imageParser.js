/**
 * 解析用户输入的镜像包名，生成完整镜像地址
 * 输入格式:
 * - nginx (自动添加 library/)
 * - nginx:latest
 * - bitnami/nginx (保留完整路径)
 * - bitnami/nginx:1.25
 * - lamboegg/ind-uc-ext-front:202604232113 (私有仓库完整路径)
 */

export function parseImageInput(input, mirrorRegistry = 'docker.1ms.run') {
  if (!input || !input.trim()) {
    return null
  }

  input = input.trim()

  let name = input
  let tag = 'latest'

  // 分离 tag
  const colonIndex = input.lastIndexOf(':')
  // 检查 : 是否在 / 后面（排除端口格式如 registry.com:5000）
  const slashIndex = input.lastIndexOf('/')

  if (colonIndex > slashIndex) {
    name = input.substring(0, colonIndex)
    tag = input.substring(colonIndex + 1) || 'latest'
  }

  // 判断是否包含组织路径
  let repository = ''
  let imageName = name

  if (name.includes('/')) {
    // 包含组织路径，如 bitnami/nginx 或 lamboegg/ind-uc-ext-front
    repository = name
    imageName = name.split('/').pop()
  } else {
    // 不含组织路径，默认为官方镜像 library/
    repository = `library/${name}`
    imageName = name
  }

  const fullImage = `${mirrorRegistry}/${repository}:${tag}`

  return {
    packageName: imageName,
    repository: repository,  // 完整的 repository 路径，用于 API 调用
    fullImage,
    tag,
    registry: mirrorRegistry
  }
}

export function formatImageDisplay(parsed) {
  if (!parsed) return ''
  if (parsed.repository === 'library') {
    return `${parsed.packageName}:${parsed.tag}`
  }
  return `${parsed.repository}/${parsed.packageName}:${parsed.tag}`
}