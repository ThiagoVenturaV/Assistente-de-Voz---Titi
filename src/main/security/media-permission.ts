export function allowsAudioPermissionCheck(
  permission: string,
  isMainFrame: boolean,
  mediaType: string | undefined,
  trustedRenderer: boolean
): boolean {
  return permission === 'media'
    && isMainFrame
    && mediaType === 'audio'
    && trustedRenderer
}

export function allowsAudioPermissionRequest(
  permission: string,
  mediaTypes: readonly string[] | undefined,
  trustedRenderer: boolean
): boolean {
  return permission === 'media'
    && trustedRenderer
    && mediaTypes?.length === 1
    && mediaTypes[0] === 'audio'
}
