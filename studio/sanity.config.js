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
      description:
        "Однаковий для всіх розмірів однієї моделі та виконання. Артикул кожного розміру залишається окремим.",
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
      name: "priceAdjustment",
      type: "string",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "treePriceAdjustment",
      type: "string",
      hidden: true,
      readOnly: true,
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
    defineField({
      name: "marketplaceGallery",
      title: "Додаткові фото для маркетплейсів",
      description: "Зберігаються в Sanity та додаються до товарних фідів. Галерея сайту використовує поле вище.",
      type: "array",
      of: [{ type: "image" }],
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "category", media: "gallery.0" },
  },
});
const deliveryTier = defineType({
  name: "deliveryTier",
  title: "Доставка для Monomarket",
  type: "document",
  description:
    "Додається до ціни лише в прайсі Monomarket. На сайті не показується. Якщо документів немає, діють стандартні значення.",
  fields: [
    defineField({
      name: "category",
      title: "Категорія",
      type: "string",
      description: "Порожньо — ялинки.",
      options: { list: [
        { title: "Ялинки", value: "trees" },
        { title: "Вінки", value: "wreaths" },
        { title: "Різдвяні прикраси", value: "decor" },
      ] },
    }),
    defineField({
      name: "maxMeters",
      title: "Точний розмір (м)",
      description: "Порожньо — одна ціна доставки для всієї категорії.",
      type: "number",
      validation: (r) => r.positive(),
    }),
    defineField({
      name: "price",
      title: "Доставка, грн",
      type: "number",
      validation: (r) => r.required().min(0),
    }),
  ],
  orderings: [
    {
      title: "За висотою",
      name: "byMeters",
      by: [{ field: "maxMeters", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "maxMeters", subtitle: "price", category: "category" },
    prepare: ({ title, subtitle, category }) => ({
      title: ({ wreaths: "Вінки", decor: "Прикраси" }[category] || "Ялинки") + (title ? " · " + title.toLocaleString("uk-UA") + " м" : " — усі розміри"),
      subtitle: subtitle + " грн",
    }),
  },
});
export default defineConfig({
  name: "shop",
  title: "Гілка свята",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool()],
  schema: { types: [product, deliveryTier] },
});
