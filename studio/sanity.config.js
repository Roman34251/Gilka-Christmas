import {defineConfig,defineType,defineField} from 'sanity'
import {structureTool} from 'sanity/structure'
const product=defineType({
 name:'product',title:'Товар',type:'document',
 fields:[
   defineField({name:'name',title:'Назва',type:'string',validation:r=>r.required()}),
   defineField({name:'category',title:'Категорія для фільтра',type:'string',validation:r=>r.required()}),
   defineField({name:'price',title:'Ціна у гривнях',type:'number',validation:r=>r.required().positive().precision(2)}),
   defineField({name:'detail',title:'Опис, матеріал і розмір',type:'text'}),
   defineField({name:'gallery',title:'Фото у порядку показу',description:'Перше фото є обкладинкою товару.',type:'array',of:[{type:'image'}],validation:r=>r.required().min(1)})
 ],preview:{select:{title:'name',subtitle:'category',media:'gallery.0'}}
})
export default defineConfig({name:'shop',title:'Гілка свята',projectId:process.env.SANITY_STUDIO_PROJECT_ID,dataset:process.env.SANITY_STUDIO_DATASET||'production',plugins:[structureTool()],schema:{types:[product]}})
