// Nigerian states with 3 LGA groups each. Each group is a cluster of 3 LGAs
// sharing a geographic/administrative proximity, used for pricing delivery.

export type LgaGroup = {
  label: string; // e.g. "Katsina–Jibia–Dutsin-Ma"
  lgas: string[]; // ["Katsina", "Jibia", "Dutsin-Ma"]
};

export const NIGERIA_LGA_GROUPS: Record<string, LgaGroup[]> = {
  Katsina: [
    { label: "Katsina–Jibia–Dutsin-Ma", lgas: ["Katsina", "Jibia", "Dutsin-Ma"] },
    { label: "Funtua–Malumfashi–Bakori", lgas: ["Funtua", "Malumfashi", "Bakori"] },
    { label: "Daura–Mashi–Kankia", lgas: ["Daura", "Mashi", "Kankia"] },
  ],
  Kaduna: [
    { label: "Kaduna–Chikun–Kajuru", lgas: ["Kaduna", "Chikun", "Kajuru"] },
    { label: "Kafanchan–Jema'a–Zangon Kataf", lgas: ["Kafanchan", "Jema'a", "Zangon Kataf"] },
    { label: "Zaria–Sabon Gari–Makarfi", lgas: ["Zaria", "Sabon Gari", "Makarfi"] },
  ],
  Kano: [
    { label: "Kano–Kumbotso–Gwale", lgas: ["Kano", "Kumbotso", "Gwale"] },
    { label: "Rano–Doguwa–Karaye", lgas: ["Rano", "Doguwa", "Karaye"] },
    { label: "Bichi–Danbatta–Gwarzo", lgas: ["Bichi", "Danbatta", "Gwarzo"] },
  ],
  Sokoto: [
    { label: "Sokoto–Wamakko–Kware", lgas: ["Sokoto", "Wamakko", "Kware"] },
    { label: "Wurno–Gwadabawa–Illela", lgas: ["Wurno", "Gwadabawa", "Illela"] },
    { label: "Bodinga–Yabo–Shagari", lgas: ["Bodinga", "Yabo", "Shagari"] },
  ],
  Jigawa: [
    { label: "Dutse–Birnin Kudu–Kiyawa", lgas: ["Dutse", "Birnin Kudu", "Kiyawa"] },
    { label: "Hadejia–Birniwa–Kafin Hausa", lgas: ["Hadejia", "Birniwa", "Kafin Hausa"] },
    { label: "Gumel–Kazaure–Ringim", lgas: ["Gumel", "Kazaure", "Ringim"] },
  ],
  Kebbi: [
    { label: "Birnin Kebbi–Kalgo–Bunza", lgas: ["Birnin Kebbi", "Kalgo", "Bunza"] },
    { label: "Zuru–Yauri–Ngaski", lgas: ["Zuru", "Yauri", "Ngaski"] },
    { label: "Argungu–Augie–Dandi", lgas: ["Argungu", "Augie", "Dandi"] },
  ],
  Zamfara: [
    { label: "Gusau–Tsafe–Bungudu", lgas: ["Gusau", "Tsafe", "Bungudu"] },
    { label: "Kaura Namoda–Shinkafi–Zurmi", lgas: ["Kaura Namoda", "Shinkafi", "Zurmi"] },
    { label: "Gummi–Talata Mafara–Bakura", lgas: ["Gummi", "Talata Mafara", "Bakura"] },
  ],
  Niger: [
    { label: "Minna–Paikoro–Chanchaga", lgas: ["Minna", "Paikoro", "Chanchaga"] },
    { label: "Bida–Lavun–Gbako", lgas: ["Bida", "Lavun", "Gbako"] },
    { label: "Kontagora–Rijau–Magama", lgas: ["Kontagora", "Rijau", "Magama"] },
  ],
  Kwara: [
    { label: "Ilorin–Asa–Moro", lgas: ["Ilorin", "Asa", "Moro"] },
    { label: "Offa–Omu Aran–Ifelodun", lgas: ["Offa", "Omu Aran", "Ifelodun"] },
    { label: "Kaiama–Baruten–Edu", lgas: ["Kaiama", "Baruten", "Edu"] },
  ],
  Kogi: [
    { label: "Lokoja–Kabba–Bunu", lgas: ["Lokoja", "Kabba", "Bunu"] },
    { label: "Idah–Anyigba–Ankpa", lgas: ["Idah", "Anyigba", "Ankpa"] },
    { label: "Okene–Adavi–Okehi", lgas: ["Okene", "Adavi", "Okehi"] },
  ],
  Benue: [
    { label: "Makurdi–Guma–Gboko", lgas: ["Makurdi", "Guma", "Gboko"] },
    { label: "Otukpo–Oju–Apa", lgas: ["Otukpo", "Oju", "Apa"] },
    { label: "Katsina-Ala–Kwande–Vandeikya", lgas: ["Katsina-Ala", "Kwande", "Vandeikya"] },
  ],
  Nasarawa: [
    { label: "Lafia–Akwanga–Wamba", lgas: ["Lafia", "Akwanga", "Wamba"] },
    { label: "Keffi–Karu–Toto", lgas: ["Keffi", "Karu", "Toto"] },
    { label: "Nasarawa–Doma–Keana", lgas: ["Nasarawa", "Doma", "Keana"] },
  ],
  Plateau: [
    { label: "Jos–Bassa–Barkin Ladi", lgas: ["Jos", "Bassa", "Barkin Ladi"] },
    { label: "Pankshin–Mangu–Kanam", lgas: ["Pankshin", "Mangu", "Kanam"] },
    { label: "Shendam–Wase–Langtang", lgas: ["Shendam", "Wase", "Langtang"] },
  ],
  Bauchi: [
    { label: "Bauchi–Toro–Alkaleri", lgas: ["Bauchi", "Toro", "Alkaleri"] },
    { label: "Azare–Katagum–Zaki", lgas: ["Azare", "Katagum", "Zaki"] },
    { label: "Darazo–Ningi–Misau", lgas: ["Darazo", "Ningi", "Misau"] },
  ],
  Borno: [
    { label: "Maiduguri–Jere–Bama", lgas: ["Maiduguri", "Jere", "Bama"] },
    { label: "Biu–Gwoza–Hawul", lgas: ["Biu", "Gwoza", "Hawul"] },
    { label: "Monguno–Kukawa–Mobbar", lgas: ["Monguno", "Kukawa", "Mobbar"] },
  ],
  Adamawa: [
    { label: "Yola–Fufore–Song", lgas: ["Yola", "Fufore", "Song"] },
    { label: "Mubi–Michika–Madagali", lgas: ["Mubi", "Michika", "Madagali"] },
    { label: "Numan–Ganye–Jada", lgas: ["Numan", "Ganye", "Jada"] },
  ],
  Taraba: [
    { label: "Jalingo–Lau–Zing", lgas: ["Jalingo", "Lau", "Zing"] },
    { label: "Wukari–Takum–Donga", lgas: ["Wukari", "Takum", "Donga"] },
    { label: "Bali–Gashaka–Sardauna", lgas: ["Bali", "Gashaka", "Sardauna"] },
  ],
  Yobe: [
    { label: "Damaturu–Gujba–Gulani", lgas: ["Damaturu", "Gujba", "Gulani"] },
    { label: "Gashua–Bade–Jakusko", lgas: ["Gashua", "Bade", "Jakusko"] },
    { label: "Potiskum–Fune–Nangere", lgas: ["Potiskum", "Fune", "Nangere"] },
  ],
  Gombe: [
    { label: "Gombe–Akko–Kwami", lgas: ["Gombe", "Akko", "Kwami"] },
    { label: "Kaltungo–Billiri–Shongom", lgas: ["Kaltungo", "Billiri", "Shongom"] },
    { label: "Bajoga–Funakaye–Dukku", lgas: ["Bajoga", "Funakaye", "Dukku"] },
  ],
  Lagos: [
    { label: "Ikeja–Alimosho–Agege", lgas: ["Ikeja", "Alimosho", "Agege"] },
    { label: "Lagos Island–Surulere–Apapa", lgas: ["Lagos Island", "Surulere", "Apapa"] },
    { label: "Epe–Ikorodu–Kosofe", lgas: ["Epe", "Ikorodu", "Kosofe"] },
  ],
  Oyo: [
    { label: "Ibadan–Oluyole–Ido", lgas: ["Ibadan", "Oluyole", "Ido"] },
    { label: "Oyo–Afijio–Atiba", lgas: ["Oyo", "Afijio", "Atiba"] },
    { label: "Iseyin–Saki–Ogbomosho", lgas: ["Iseyin", "Saki", "Ogbomosho"] },
  ],
  Ogun: [
    { label: "Abeokuta–Obafemi Owode–Odeda", lgas: ["Abeokuta", "Obafemi Owode", "Odeda"] },
    { label: "Sagamu–Ijebu Ode–Ikenne", lgas: ["Sagamu", "Ijebu Ode", "Ikenne"] },
    { label: "Ilaro–Ota–Yewa", lgas: ["Ilaro", "Ota", "Yewa"] },
  ],
  Ondo: [
    { label: "Akure–Idanre–Ifedore", lgas: ["Akure", "Idanre", "Ifedore"] },
    { label: "Owo–Akoko–Ikare", lgas: ["Owo", "Akoko", "Ikare"] },
    { label: "Okitipupa–Ilaje–Irele", lgas: ["Okitipupa", "Ilaje", "Irele"] },
  ],
  Osun: [
    { label: "Osogbo–Olorunda–Irepodun", lgas: ["Osogbo", "Olorunda", "Irepodun"] },
    { label: "Ile-Ife–Ilesa–Oriade", lgas: ["Ile-Ife", "Ilesa", "Oriade"] },
    { label: "Iwo–Ejigbo–Ola Oluwa", lgas: ["Iwo", "Ejigbo", "Ola Oluwa"] },
  ],
  Ekiti: [
    { label: "Ado–Irepodun–Ifelodun", lgas: ["Ado", "Irepodun", "Ifelodun"] },
    { label: "Ikole–Oye–Ido-Osi", lgas: ["Ikole", "Oye", "Ido-Osi"] },
    { label: "Ikere–Emure–Ise", lgas: ["Ikere", "Emure", "Ise"] },
  ],
  Enugu: [
    { label: "Enugu–Nkanu East–Isi Uzo", lgas: ["Enugu", "Nkanu East", "Isi Uzo"] },
    { label: "Nsukka–Igbo Eze–Udenu", lgas: ["Nsukka", "Igbo Eze", "Udenu"] },
    { label: "Awgu–Udi–Oji River", lgas: ["Awgu", "Udi", "Oji River"] },
  ],
  Anambra: [
    { label: "Awka–Anaocha–Njikoka", lgas: ["Awka", "Anaocha", "Njikoka"] },
    { label: "Onitsha–Ogbaru–Oyi", lgas: ["Onitsha", "Ogbaru", "Oyi"] },
    { label: "Nnewi–Aguata–Ihiala", lgas: ["Nnewi", "Aguata", "Ihiala"] },
  ],
  Abia: [
    { label: "Umuahia–Ikwuano–Isiala Ngwa", lgas: ["Umuahia", "Ikwuano", "Isiala Ngwa"] },
    { label: "Ohafia–Arochukwu–Bende", lgas: ["Ohafia", "Arochukwu", "Bende"] },
    { label: "Aba–Obingwa–Ukwa", lgas: ["Aba", "Obingwa", "Ukwa"] },
  ],
  Imo: [
    { label: "Owerri–Mbaitoli–Ngor Okpala", lgas: ["Owerri", "Mbaitoli", "Ngor Okpala"] },
    { label: "Orlu–Ideato–Nkwerre", lgas: ["Orlu", "Ideato", "Nkwerre"] },
    { label: "Okigwe–Ehime Mbano–Obowo", lgas: ["Okigwe", "Ehime Mbano", "Obowo"] },
  ],
  Ebonyi: [
    { label: "Abakaliki–Ebonyi–Izzi", lgas: ["Abakaliki", "Ebonyi", "Izzi"] },
    { label: "Onueke–Ezza–Ikwo", lgas: ["Onueke", "Ezza", "Ikwo"] },
    { label: "Afikpo–Ohaozara–Ivo", lgas: ["Afikpo", "Ohaozara", "Ivo"] },
  ],
  Rivers: [
    { label: "Port Harcourt–Obio/Akpor–Okrika", lgas: ["Port Harcourt", "Obio/Akpor", "Okrika"] },
    { label: "Bori–Khana–Gokana", lgas: ["Bori", "Khana", "Gokana"] },
    { label: "Ahoada–Degema–Omuma", lgas: ["Ahoada", "Degema", "Omuma"] },
  ],
  Delta: [
    { label: "Asaba–Ika–Oshimili", lgas: ["Asaba", "Ika", "Oshimili"] },
    { label: "Ughelli–Sapele–Ethiope", lgas: ["Ughelli", "Sapele", "Ethiope"] },
    { label: "Warri–Patani–Isoko", lgas: ["Warri", "Patani", "Isoko"] },
  ],
  "Akwa Ibom": [
    { label: "Uyo–Etinan–Itu", lgas: ["Uyo", "Etinan", "Itu"] },
    { label: "Ikot Ekpene–Abak–Essien Udim", lgas: ["Ikot Ekpene", "Abak", "Essien Udim"] },
    { label: "Eket–Oron–Ikot Abasi", lgas: ["Eket", "Oron", "Ikot Abasi"] },
  ],
  Edo: [
    { label: "Benin City–Oredo–Ikpoba Okha", lgas: ["Benin City", "Oredo", "Ikpoba Okha"] },
    { label: "Auchi–Etsako–Akoko Edo", lgas: ["Auchi", "Etsako", "Akoko Edo"] },
    { label: "Irrua–Esan–Igueben", lgas: ["Irrua", "Esan", "Igueben"] },
  ],
  "Cross River": [
    { label: "Calabar–Akpabuyo–Bakassi", lgas: ["Calabar", "Akpabuyo", "Bakassi"] },
    { label: "Ikom–Boki–Yakurr", lgas: ["Ikom", "Boki", "Yakurr"] },
    { label: "Ogoja–Obudu–Yala", lgas: ["Ogoja", "Obudu", "Yala"] },
  ],
  Bayelsa: [
    { label: "Yenagoa–Kolokuma–Opokuma", lgas: ["Yenagoa", "Kolokuma", "Opokuma"] },
    { label: "Brass–Nembe–Ogbia", lgas: ["Brass", "Nembe", "Ogbia"] },
    { label: "Sagama–Ekeremor–Southern Ijaw", lgas: ["Sagama", "Ekeremor", "Southern Ijaw"] },
  ],
};

export const NIGERIA_STATE_NAMES = Object.keys(NIGERIA_LGA_GROUPS).sort();

/**
 * Flat list of all LGAs for a state, derived from its three groups. Used in
 * places that still need a simple array (e.g. address forms).
 */
export function lgasForState(state: string): string[] {
  const groups = NIGERIA_LGA_GROUPS[state] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  groups.forEach((g) => {
    g.lgas.forEach((l) => {
      if (!seen.has(l)) {
        seen.add(l);
        out.push(l);
      }
    });
  });
  return out;
}

// Back-compat: some older code imported `NIGERIA_STATES` as a state→LGA map.
export const NIGERIA_STATES: Record<string, string[]> = Object.fromEntries(
  NIGERIA_STATE_NAMES.map((s) => [s, lgasForState(s)]),
);
