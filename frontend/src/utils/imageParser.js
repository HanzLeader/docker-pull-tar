/**
 * 解析用户输入的镜像包名，生成完整镜像地址
 * 输入格式: nginx, nginx:latest, nginx:1.25, bitnami/nginx, bitnami/nginx:1.25
 */

export function parseImageInput(input, mirrorRegistry = 'docker.1ms.run') {
  if (!input || !input.trim()) {
    return null
  }

  input = input.trim()

  let name = input
  let tag = 'latest'

  if (input.includes(':')) {
    const parts = input.split(':')
    name = parts[0]
    tag = parts[1] || 'latest'
  }

  let repository = ''
  let imageName = name

  if (name.includes('/')) {
    const parts = name.split('/')
    repository = parts.slice(0, -1).join('/')
    imageName = parts[parts.length - 1]
  } else {
    repository = 'library'
  }

  const fullImage = `${mirrorRegistry}/${repository}/${imageName}:${tag}`
  const apiRepository = repository === 'library' ? `library/${imageName}` : name.split(':')[0]

  return {
    packageName: imageName,
    repository: apiRepository,
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