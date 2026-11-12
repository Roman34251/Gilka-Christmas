// Branch lookup for checkout: Nova Poshta (public API, no key) and Ukrposhta (public post-index service).
const NP = "https://api.novaposhta.ua/v2.0/json/";
const UKR = "https://index.ukrposhta.ua/endpoints-for-apps/index.php?method=";
const REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const out = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function np(calledMethod, methodProperties) {
  const r = await fetch(NP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: "",
      modelName: "AddressGeneral",
      calledMethod,
      methodProperties,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error("np");
  return data.data;
}

export async function npCities(q) {
  const data = await np("searchSettlements", {
    CityName: q,
    Limit: "12",
    Page: "1",
  });
  return (data[0]?.Addresses || [])
    .filter((a) => Number(a.Warehouses) > 0 && a.DeliveryCity)
    .map((a) => ({ ref: a.DeliveryCity, name: a.Present }));
}

// Branch types only (no parcel lockers): post office, cargo office, post office with weight limits.
const BRANCH_TYPES = [
  "841339c7-591a-42e2-8233-7a0a00f0ed6f",
  "9a68df70-0267-42a8-bb5c-37f427e36ee4",
  "6f8c7162-4b72-4b0a-88e5-906948c6a92f",
];

export async function npBranches(cityRef) {
  const parts = await Promise.all(
    BRANCH_TYPES.map((type) =>
      np("getWarehouses", {
        CityRef: cityRef,
        TypeOfWarehouseRef: type,
        Limit: "1000",
        Page: "1",
      }),
    ),
  );
  return parts
    .flat()
    .filter(
      (w) =>
        w.WarehouseStatus !== "Archive" &&
        !/^(поштомат|склад)/i.test(w.Description || "") &&
        !/фулфілмент/i.test(w.Description || ""),
    )
    .map((w) => ({ ref: w.Ref, number: w.Number, name: w.Description }))
    .filter((w, i, all) => all.findIndex((x) => x.ref === w.ref) === i)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export async function ukrOffice(index) {
  const r = await fetch(UKR + "get_postoffices_by_postindex&pi=" + index, {
    // the service rejects requests without a User-Agent (Workers send none by default)
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; shop-checkout)",
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("ukr");
  if (!text.trim()) return null;
  const data = JSON.parse(text);
  const list = [].concat(data.Entry || []);
  const o = list.find((e) => String(e.LOCK_CODE) === "0") || list[0];
  if (!o) return null;
  return {
    index: String(o.POSTINDEX || index),
    name: String(o.PO_SHORT || ""),
    address: String(o.ADDRESS || ""),
    city: String(o.PDCITY_UA || o.CITY_UA || ""),
  };
}

export async function carrierApi(url) {
  const q = (url.searchParams.get("q") || "").trim();
  try {
    if (url.pathname === "/api/np/cities") {
      if (q.length < 2 || q.length > 60) return out([]);
      return out(await npCities(q));
    }
    if (url.pathname === "/api/np/branches") {
      const city = url.searchParams.get("city") || "";
      if (!REF.test(city)) return out({ error: "Невідоме місто" }, 400);
      return out(await npBranches(city));
    }
    if (url.pathname === "/api/ukr/office") {
      const index = url.searchParams.get("index") || "";
      if (!/^\d{5}$/.test(index))
        return out({ error: "Індекс має 5 цифр" }, 400);
      const office = await ukrOffice(index);
      return office
        ? out(office)
        : out({ error: "Відділення з таким індексом не знайдено" }, 404);
    }
  } catch {
    return out(
      { error: "Сервіс перевізника тимчасово недоступний. Спробуйте ще раз." },
      502,
    );
  }
  return out({ error: "Не знайдено" }, 404);
}
