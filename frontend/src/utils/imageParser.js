/**
 * 解析用户输入的镜像包名，生成完整镜像地址
 *
 * 输入格式支持：
 * 1. nginx / nginx:latest -> 自动拼接默认镜像源的 library/nginx
 * 2. bitnami/nginx:1.25 -> 自动拼接默认镜像源的 bitnami/nginx
 * 3. registrylibrary.com.cn/lamboegg/ind-uc-ext-front:tag -> 使用用户指定的 registry
 * 4. registrylibrary.com.cn:5000/lamboegg/ind-uc-ext-front:tag -> 支持指定端口
 */

export function parseImageInput(input, mirrorRegistry = 'docker.1ms.run') {
  if (!input || !input.trim()) {
    return null
  }

  input = input.trim()

  // 检查是否包含 registry（地址中有 . 或 :端口号 且在第一个 / 之前）
  const firstSlashIndex = input.indexOf('/')

  // 检测 registry 部分：第一个 / 之前，且包含 . 或 :数字（端口）
  const potentialRegistry = input.substring(0, firstSlashIndex)
  const hasRegistry = firstSlashIndex > 0 && (
    potentialRegistry.includes('.') ||
    /:\d+$/.test(potentialRegistry)  // 匹配端口格式 :5000
  )

  let registry = mirrorRegistry
  let repository = ''
  let tag = 'latest'
  let remaining = input

  if (hasRegistry) {
    // 用户输入了完整地址，提取 registry（可能包含端口）
    registry = potentialRegistry
    remaining = input.substring(firstSlashIndex + 1)
  }

  // 分离 tag（: 后面是版本号，不在 registry 部分）
  // 找最后一个 :，但要确保它不在 registry 部分
  const colonIndex = remaining.lastIndexOf(':')
  if (colonIndex > 0 && !remaining.substring(0, colonIndex).includes('/')) {
    // : 后面没有 /，说明这是 tag 分隔符
    repository = remaining.substring(0, colonIndex)
    tag = remaining.substring(colonIndex + 1) || 'latest'
  } else if (colonIndex > 0) {
    // 正常处理：最后一个 : 是 tag
    repository = remaining.substring(0, colonIndex)
    tag = remaining.substring(colonIndex + 1) || 'latest'
  } else {
    repository = remaining
    tag = 'latest'
  }

  // 如果 repository 不含 /，则添加 library/
  if (!repository.includes('/')) {
    repository = `library/${repository}`
  }

  const fullImage = `${registry}/${repository}:${tag}`
  const imageName = repository.split('/').pop()

  return {
    packageName: imageName,
    repository: repository,
    fullImage,
    tag,
    registry: registry
  }
}