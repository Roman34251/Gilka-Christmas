import { defineConfig, defineType, defineField } from "sanity";
import { structureTool } from "sanity/structure";
const product = defineType({
  name: "product",
  title: "Товар",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Назва",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Адреса сторінки товару",
      type: "slug",
      options: { source: "name", maxLength: 80 },
      description: "Якщо не заповнено, сайт використає ідентифікатор товару.",
    }),
    defineField({
      name: "category",
      title: "Категорія",
      type: "string",
      options: {
        list: [
          { title: "Ялинки", value: "trees" },
          { title: "Різдвяні прикраси", value: "decor" },
          { title: "Вінки", value: "wreaths" },
          { title: "Новорічні смаколики (ікра)", value: "treats" },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "sku", title: "Артикул", type: "string" }),
    defineField({
      name: "modelCode",
      title: "Спільний код моделі",
      type: "string",
      description: "Однаковий для всіх розмірів однієї моделі та виконання. Артикул кожного розміру залишається окремим.",
    }),
    defineField({
      name: "modelName",
      title: "Назва моделі без розміру",
      type: "string",
    }),
    defineField({
      name: "sizeMeters",
      title: "Розмір у метрах",
      description: "Висота ялинки, довжина гірлянди або діаметр вінка.",
      type: "number",
      validation: (r) => r.positive(),
    }),
    defineField({
      name: "sizeLabel",
      title: "Розмір для показу на сайті",
      type: "string",
    }),
    defineField({
      name: "price",
      title: "Ціна у гривнях",
      type: "number",
      validation: (r) => r.required().positive().precision(2),
    }),
    defineField({
      name: "oldPrice",
      title: "Попередня ціна (лише реальна)",
      type: "number",
      validation: (r) => r.positive().precision(2),
    }),
    defineField({
      name: "available",
      title: "Є в наявності",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "detail",
      title: "Опис",
      type: "text",
      description:
        "Матеріал, розміри, комплектація. Для ікри: вид, виробник, склад, вага, термін придатності, температура зберігання.",
    }),
    defineField({
      name: "specifications",
      title: "Характеристики",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "label",
              title: "Назва характеристики",
              type: "string",
              validation: (r) => r.required(),
            },
            {
              name: "value",
              title: "Значення",
              type: "string",
              validation: (r) => r.required(),
            },
          ],
        },
      ],
    }),
    defineField({
      name: "gallery",
      title: "Фото у порядку показу",
      description:
        "Використовуйте реальні фото товару. Перше фото — обкладинка.",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
      validation: (r) => r.required().min(1),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "category", media: "gallery.0" },
  },
});
export default defineConfig({
  name: "shop",
  title: "Гілка свята",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool()],
  schema: { types: [product] },
});
