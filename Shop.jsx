import React,{useState,useRef,useEffect} from 'react'
import {Header,Hero} from './Brand'
const money=n=>new Intl.NumberFormat('uk-UA').format(n)+' ₴'
export default function Shop({items,email,demo}){
 const [filter,filterBy]=useState(''),[panel,select]=useState(null),[photo,setPhoto]=useState(0)
 const [cart,setCart]=useState({}),[ready,setReady]=useState(false),[message,notify]=useState('')
 const dialog=useRef(null)
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('hilka-cart')||'{}');setCart(Object.fromEntries(items.filter(p=>Number.isInteger(saved?.[p.id])&&saved[p.id]>0).map(p=>[p.id,Math.min(99,saved[p.id])]))) }catch{}setReady(true)},[])
 useEffect(()=>{if(ready){try{localStorage.setItem('hilka-cart',JSON.stringify(cart))}catch{}}},[ready,cart])
 useEffect(()=>{if(!message)return;const t=setTimeout(()=>notify(''),2800);return ()=>clearTimeout(t)},[message])
 function open(id){select(id);setPhoto(0);if(!dialog.current.open)dialog.current.showModal()}
 function change(id,delta){setCart(old=>({...old,[id]:Math.max(0,Math.min(99,(old[id]||0)+delta))}))}
 const visible=items.filter(p=>!filter||p.category===filter),lines=items.filter(p=>cart[p.id]>0)
 const total=lines.reduce((n,p)=>n+p.price*cart[p.id],0)
 const orderText=lines.map(p=>p.name+' × '+cart[p.id]+' — '+money(p.price*cart[p.id])).join('\n')+'\nРазом '+money(total)
 const selected=items.find(p=>p.id===panel)
 return <><a className="skip" href="#catalog">Перейти до каталогу</a><Header open={open} totalCount={lines.reduce((n,p)=>n+cart[p.id],0)}/><main><Hero/>
 <section id="catalog" className="section"><p className="label">КАТАЛОГ</p><div className="sectionhead"><h2>Ялинкові прикраси</h2><small aria-live="polite">Товарів: {visible.length}</small></div>
 <div className="filters">{['',...new Set(items.map(p=>p.category).filter(Boolean))].map(c=><button key={c} aria-pressed={filter===c} onClick={()=>filterBy(c)}>{c||'Усі прикраси'}</button>)}</div>
 <div className="grid">{visible.map(p=><article key={p.id}><button className="product" onClick={()=>open(p.id)}><img loading="lazy" src={p.image} alt={p.name}/><span>{p.category}</span><strong>{p.name}</strong></button><div className="buyline"><b>{money(p.price)}</b><button aria-label={'Додати до кошика: '+p.name} onClick={()=>{change(p.id,1);notify(p.name+' у кошику')}}>＋</button></div></article>)}</div>{!visible.length&&<p>Колекція готується.</p>}</section>
 <section id="order" className="order section"><p className="label">ЗАМОВЛЕННЯ</p><h2>Як замовити</h2><p>Додайте улюблені прикраси до кошика й оберіть кількість. {email&&!demo?'Надішліть список продавцю, щоб погодити доставку й оплату.':'У цій версії магазину можна зібрати та скопіювати свій список прикрас.'}</p></section></main>
 <footer>Гілка свята <a href="#catalog">До каталогу ↑</a></footer>
 <dialog ref={dialog} aria-labelledby="modal-title" onClose={()=>select(null)}><button className="close" aria-label="Закрити" onClick={()=>dialog.current.close()}>×</button>{selected?<><img className="detailpic" src={selected.images?.[photo]||selected.image} alt={selected.name}/>{selected.images?.length>1&&<div className="filters">{selected.images.map((_,i)=><button key={i} aria-pressed={photo===i} onClick={()=>setPhoto(i)}>Фото {i+1}</button>)}</div>}<p className="label">{selected.category}</p><h2 id="modal-title">{selected.name}</h2><p>{selected.detail}</p><button className="solid" onClick={()=>{change(selected.id,1);open('cart')}}>До кошика · {money(selected.price)}</button></>:panel==='cart'?<><h2 id="modal-title">Ваш кошик</h2>{lines.length?<>{lines.map(p=><div className="row" key={p.id}><img src={p.image} alt=""/><div><strong>{p.name}</strong><div><button aria-label={'Зменшити кількість '+p.name} onClick={()=>change(p.id,-1)}>−</button> {cart[p.id]} <button aria-label={'Збільшити кількість '+p.name} disabled={cart[p.id]>=99} onClick={()=>change(p.id,1)}>+</button></div></div><b>{money(p.price*cart[p.id])}</b></div>)}<h3>Разом {money(total)}</h3>{demo&&<p>Демонстраційні товари й ціни.</p>}{email&&!demo&&<a className="solid" href={'mailto:'+email+'?subject='+encodeURIComponent('Замовлення прикрас')+'&body='+encodeURIComponent(orderText)}>Надіслати замовлення поштою</a>}<button className="solid" onClick={async()=>{try{await navigator.clipboard.writeText(orderText);notify('Список скопійовано')}catch{notify('Скопіюйте список із кошика вручну')}}}>Скопіювати список</button></>:<><p>Оберіть першу прикрасу для своєї колекції.</p><a className="solid" href="#catalog" onClick={()=>dialog.current.close()}>Обрати прикраси</a></>}</>:null}{dialog.current?.open&&<p role="status">{message}</p>}</dialog><div className={'toast '+(message&&!panel?'show':'')} role="status">{!panel&&message}</div></>
}
