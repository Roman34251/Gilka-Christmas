import { render } from './render.jsx'
import template from './public/index.html'

const demoProducts = [
  ['ruby', 'Куля «Гранат»', 'Кулі', 290, 'Рубінове скло з виразними рельєфними гранями. Діаметр 8 см.'],
  ['drop', 'Підвіска «Крапля»', 'Підвіски', 340, 'Золотиста підвіска видовженої форми. Висота 12 см.'],
  ['star', 'Зірка «Вечірня»', 'Зірки', 260, 'П’ятипроменева зірка кольору шампанського. Ширина 9 см.'],
  ['spruce', 'Підвіска «Смерека»', 'Підвіски', 310, 'Ялинка з хвилястим рельєфом у хвойному відтінку. Висота 10 см.'],
].map(([id, name, category, price, detail], index) => ({
  id, name, category, price, detail,
  image: '/art/' + index + '.svg',
  images: ['/art/' + index + '.svg'],
}))

async function loadProducts(env) {
  if (!env.SANITY_PROJECT_ID) return demoProducts

  const dataset = env.SANITY_DATASET || 'production'
  const url = new URL(
    'https://' + env.SANITY_PROJECT_ID + '.api.sanity.io/v2025-02-19/data/query/' + dataset,
  )
  url.searchParams.set('query', [
    '*[_type == "product" && defined(price) && defined(name)] | order(name) {',
    '"id": _id, name, category, price, detail, "images": gallery[].asset->url',
    '}',
  ].join(' '))
  url.searchParams.set('perspective', 'published')

  const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error('Sanity returned ' + response.status)

  const { result } = await response.json()
  if (!Array.isArray(result)) throw new Error('Invalid Sanity catalogue response')

  return result.map(product => {
    const images = (product.images || []).filter(Boolean)
    return { ...product, images, image: images[0] || '/art/0.svg' }
  })
}

function reply(request, body, status, type, extraHeaders = {}) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      // Опубліковані в Sanity зміни підтягуються після оновлення сторінки.
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply(request, 'Method not allowed', 405, 'text/plain', { Allow: 'GET, HEAD' })
    }

    const path = new URL(request.url).pathname
    if (path !== '/' && path !== '/api/products') {
      const asset = await env.ASSETS.fetch(request)
      if (asset.status !== 404) return asset
      return reply(request, 'Сторінку не знайдено', 404, 'text/plain; charset=utf-8')
    }

    try {
      const items = await loadProducts(env)
      if (path === '/api/products') {
        return reply(request, JSON.stringify(items), 200, 'application/json; charset=utf-8')
      }

      const data = {
        items,
        email: env.ORDER_EMAIL || '',
        demo: !env.SANITY_PROJECT_ID,
      }
      // Екранування захищає JSON script від закриття текстом товару.
      const model = JSON.stringify(data).replaceAll('<', '\\u003c')
      const html = template
        .replace('<!--app-->', () => render(data))
        .replace('/*model*/', () => model)
      return reply(request, html, 200, 'text/html; charset=utf-8')
    } catch (error) {
      console.error('Catalogue request failed:', error.message)
      if (path === '/api/products') {
        return reply(request, JSON.stringify({ error: 'Каталог тимчасово недоступний' }),
          503, 'application/json; charset=utf-8', { 'Retry-After': '30' })
      }
      return reply(request, 'Каталог тимчасово недоступний. Оновіть сторінку.',
        503, 'text/plain; charset=utf-8', { 'Retry-After': '30' })
    }
  },
}
