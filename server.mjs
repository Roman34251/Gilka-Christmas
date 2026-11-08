import {render} from "./build/render.mjs"
import {createServer} from 'node:http'
import {readFileSync,existsSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {ornament} from './art.mjs'
import {fileURLToPath} from 'node:url'
import {loadEnvFile} from 'node:process'
process.chdir(fileURLToPath(new URL('.',import.meta.url)))
if (existsSync('.env')) loadEnvFile('.env')
const db=new DatabaseSync('catalog.sqlite')
db.exec('CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY,name TEXT,category TEXT,price INTEGER,detail TEXT,image TEXT)')
const seeds=[
 ['ruby','Куля «Гранат»','Кулі',290,'Рубінове скло з виразними рельєфними гранями. Діаметр 8 см.'],
 ['drop','Підвіска «Крапля»','Підвіски',340,'Золотиста підвіска видовженої форми. Висота 12 см.'],
 ['star','Зірка «Вечірня»','Зірки',260,'П’ятипроменева зірка кольору шампанського. Ширина 9 см.'],
 ['spruce','Підвіска «Смерека»','Підвіски',310,'Ялинка з хвилястим рельєфом у хвойному відтінку. Висота 10 см.']]
seeds.forEach((p,i)=>db.prepare('INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?)').run(...p,'/art/'+i+'.svg'))
async function products(){
 if(!process.env.SANITY_PROJECT_ID)return db.prepare('SELECT * FROM products ORDER BY rowid').all().map(p=>({...p,images:[p.image]}))
 const query='*[_type=="product" && defined(price) && defined(name)]|order(name){ "id":_id,name,category,price,detail,"images":gallery[].asset->url }'
 const url=new URL('https://'+process.env.SANITY_PROJECT_ID+'.api.sanity.io/v2025-02-19/data/query/'+(process.env.SANITY_DATASET||'production'))
 url.searchParams.set('query',query)
 url.searchParams.set('perspective','published')
 const r=await fetch(url,{signal:AbortSignal.timeout(6000)})
 if(!r.ok)throw Error('CMS')
 return (await r.json()).result.map(p=>({...p,image:p.images?.[0]||'/art/0.svg'}))
}
const files={'/style.css':'text/css','/shop.js':'text/javascript','/hero.jpg':'image/jpeg'}
const template=readFileSync('public/index.html','utf8')
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname
 function send(status,type,body){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff'});res.end(body)}
 try{
 if(files[path]&&existsSync('public'+path))return send(200,files[path],readFileSync('public'+path))
 if(/^\/art\/[0-3]\.svg$/.test(path))return send(200,'image/svg+xml',ornament(Number(path[5])))
 if(path!=='/'&&path!=='/api/products')return send(404,'text/plain; charset=utf-8','Сторінку не знайдено')
 const items=await products()
 if(path==='/api/products')return send(200,'application/json',JSON.stringify(items))
 const data={items,email:process.env.ORDER_EMAIL||'',demo:!process.env.SANITY_PROJECT_ID}
 const model=JSON.stringify(data).replaceAll('<','\\u003c')
 send(200,'text/html; charset=utf-8',template.replace('<!--app-->',()=>render(data)).replace('/*model*/',()=>model))
 }catch(e){console.error(e.message);send(503,'text/plain; charset=utf-8','Каталог тимчасово недоступний. Оновіть сторінку.')}
})
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Гілка свята — порт '+server.address().port))

