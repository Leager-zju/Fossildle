const encoder = new TextEncoder()

/**
 * 当日种子：排行的唯一权威来源。
 * 客户端拿到 seed 后用 generateSeededFossil 在本地复现同一枚化石；服务端则用它重算分数，
 * 因此客户端既不能伪造分数，也不能换图案、换日期或重复抽取。
 */
export async function dailySeed(secret: string, playerId: string, date: string, generatorVersion: number): Promise<number> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${playerId}|${date}|${generatorVersion}`)))
  return ((signature[0] << 24) | (signature[1] << 16) | (signature[2] << 8) | signature[3]) >>> 0
}
