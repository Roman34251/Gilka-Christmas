import test from 'node:test';
import assert from 'node:assert/strict';
import {groupModels,modelVariants,productUrl} from './catalog.mjs';
import {validateOrder} from './commerce.mjs';
const items=[
 {id:'small',name:'Ялинка 1 м',modelCode:'tree-green',modelName:'Ялинка зелена',category:'trees',sizeMeters:1,sizeLabel:'1 м',price:100,available:false},
 {id:'large',name:'Ялинка 2 м',modelCode:'tree-green',modelName:'Ялинка зелена',category:'trees',sizeMeters:2,sizeLabel:'2 м',price:240.75,available:true},
 {id:'blue',name:'Ялинка блакитна 2 м',modelCode:'tree-blue',category:'trees',sizeMeters:2,price:300,available:true},
 {id:'legacy',name:'Товар без групи',category:'decor',price:20,available:true},
];
test('catalogue groups sizes but preserves colours and legacy products',()=>{
 const cards=groupModels(items);
 assert.equal(cards.length,3);
 const green=cards.find(p=>p.modelCode==='tree-green');
 assert.equal(green.price,240.75);assert.equal(green.available,true);assert.equal(green.priceFrom,true);
 assert.equal(productUrl(green),'/product/large');
 assert.deepEqual(modelVariants(items,items[1]).map(p=>p.id),['small','large']);
 assert.equal(items[0].price,100);
});
test('selected size is charged using its own server price; unavailable size rejected',()=>{
 const body={consent:true,payment:'cod',delivery:'novaposhta',customer:{name:'Тест Покупець',phone:'0960000000',city:'Київ',point:'1'},lines:[{id:'large',quantity:2,price:1}]};
 const order=validateOrder(body,items);
 assert.equal(order.amount,48150);assert.equal(order.lines[0].name,'Ялинка 2 м');assert.equal(order.lines[0].id,'large');
 assert.throws(()=>validateOrder({...body,lines:[{id:'small',quantity:1}]},items));
 const both=validateOrder({...body,lines:[{id:'large',quantity:1},{id:'blue',quantity:1}]},items);
 assert.equal(both.lines.length,2);assert.equal(both.amount,54075);
});
test('all unavailable sizes remain unavailable with their minimum price',()=>{
 const grouped=groupModels(items.slice(0,2).map(p=>({...p,available:false})));
 assert.equal(grouped[0].price,100);assert.equal(grouped[0].available,false);
});
