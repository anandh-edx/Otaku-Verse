import type { AnimeMedia } from './types'

const ENDPOINT = 'https://graphql.anilist.co'
const FIELDS = `id title{romaji english native} synonyms coverImage{large extraLarge} description(asHtml:false) genres episodes status season seasonYear averageScore siteUrl`

export class AniListError extends Error {
  constructor(message: string, public kind: 'rate_limit' | 'network' | 'api') { super(message) }
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch { throw new AniListError('Could not reach AniList. Check your connection and retry.', 'network') }
  if (res.status === 429) {
    const wait = res.headers.get('Retry-After')
    throw new AniListError(`AniList rate limit hit. Try again${wait ? ` in ${wait}s` : ' in a minute'}.`, 'rate_limit')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) throw new AniListError(json?.errors?.[0]?.message ?? 'AniList returned an error.', 'api')
  return json.data as T
}

export async function searchAnime(search: string, page = 1): Promise<{ items: AnimeMedia[]; hasNext: boolean }> {
  const q = `query($s:String,$p:Int){Page(page:$p,perPage:20){pageInfo{hasNextPage} media(search:$s,type:ANIME,sort:SEARCH_MATCH,isAdult:false){${FIELDS}}}}`
  const d = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AnimeMedia[] } }>(q, { s: search, p: page })
  return { items: d.Page.media, hasNext: d.Page.pageInfo.hasNextPage }
}
export async function trendingAnime(): Promise<AnimeMedia[]> {
  const q = `query{Page(page:1,perPage:20){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){${FIELDS}}}}`
  return (await gql<{ Page: { media: AnimeMedia[] } }>(q, {})).Page.media
}
export async function getAnime(id: number): Promise<AnimeMedia | null> {
  const q = `query($id:Int){Media(id:$id,type:ANIME){${FIELDS}}}`
  return (await gql<{ Media: AnimeMedia | null }>(q, { id })).Media
}
export const animeTitle = (m: AnimeMedia) => m.title.english || m.title.romaji || m.title.native || 'Untitled'
