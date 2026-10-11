// Family data. One entry per person; one entry per union (marriage / partnership).
// Dates are ISO (YYYY-MM-DD); a bare year is fine when the day is unknown.
// `surname` is the surname at birth (used for the family-of-origin tint); `married` is the name taken by marriage,
// `changed` a surname adopted for another reason. Either one is what the box shows; the tooltip keeps the birth surname.
// Leave `died` out for living people. A union's `year` may be omitted; it is then placed just before the first child.
// A union that ended takes `ended` (date) and `endedHow` ('divorced' | 'widowed' | ...), and optionally `separated`.
// `ended: true` means it ended on an unknown date. `type: 'partnership'` for an unmarried partnership.
// A union may list a single partner when the other is unknown, or none, to group siblings whose parents are unknown. A person may omit `surname` when it is unknown.
// `approx: true` on a union marks its `year` as a guess. A person with no death date but a known fate takes `diedText` (e.g. 'WWI') and `note`.

const PEOPLE = [
  // No dates yet; the page estimates their position from Ružica's birth and marks it "c.".
  { id: 'vasul-jeftin', first: 'Vasul', surname: 'Jeftin',
    diedText: 'WWI', diedPlace: 'Galicia', note: 'Killed in World War I as a soldier of the Austro-Hungarian army.' },
  { id: 'marija-ekl', first: 'Marija', surname: 'Ekl', married: 'Pilauer',
    note: 'Jeftin by her first marriage; took the name Pilauer on remarrying.' },
  { id: 'hugo-pilauer', first: 'Hugo', surname: 'Pilauer' },
  { id: 'zivojin-1913', first: 'Živojin', surname: 'Milosavljević',
    born: '1913-07-10', bornPlace: 'Bata, Hungary',
    died: '1990-10-20' },
  { id: 'ruzica-1914', first: 'Ružica', surname: 'Jeftin', married: 'Milosavljević',
    born: '1914-07-20', bornPlace: 'Banatska Palanka',
    died: '2000-04-03', diedPlace: 'Belgrade, Serbia' },
  { id: 'dimitrije-kostic', first: 'Dimitrije', surname: 'Kostić', bornPlace: 'Leskovac, Serbia' },
  { id: 'vidosava-andjelkovic', first: 'Vidosava', surname: 'Anđelković', married: 'Kostić',
    bornPlace: 'Pirot, Serbia' },  // given as "Pirot, Leskovac" — CONFIRM which town
  { id: 'sreten-kostic', first: 'Sreten', surname: 'Kostić', bornPlace: 'Pirot, Serbia' },
  { id: 'marija-kostic', first: 'Marija', surname: 'Stojanović', married: 'Kostić', note: 'Maiden name Stojanović is probable, not confirmed.' },
  { id: 'deska-stojanovic', first: 'Deska', surname: 'Stojanović' },
  { id: 'brother-stojanovic', first: 'Brother', surname: 'Stojanović', note: 'First name not yet known.' },
  { id: 'agatula', first: 'Agatula', note: 'Greek.' },
  { id: 'olivera-kostic', first: 'Olivera', surname: 'Kostić' },
  { id: 'zivka-kostic', first: 'Živka', surname: 'Kostić' },
  { id: 'spasa-zivkovic', first: 'Spasa', surname: 'Živković' },
  { id: 'trajka-zivkovic', first: 'Trajka', surname: 'Živković', note: 'Maiden name not yet known.' },
  { id: 'danilo-zivkovic', first: 'Danilo', surname: 'Živković' },
  { id: 'julka-zivkovic', first: 'Julka', surname: 'Živković', note: 'Husband and married surname not yet known.' },
  // Julka's sons; surname unknown until the husband is identified
  { id: 'bosko-julka', first: 'Boško' },
  { id: 'vladimir-julka', first: 'Vladimir' },
  { id: 'vuce-julka', first: 'Vuče' },
  { id: 'dara-zivkovic', first: 'Dara', surname: 'Živković' },
  { id: 'aleksandar-zivkovic', first: 'Aleksandar', surname: 'Živković' },
  { id: 'suzana-zivkovic', first: 'Suzana', surname: 'Živković', note: 'Maiden name not yet known.' },
  { id: 'stojan-zivkovic', first: 'Stojan', surname: 'Živković' },
  { id: 'djordje-zivkovic', first: 'Đorđe', surname: 'Živković' },
  { id: 'svetislav-1910', first: 'Svetislav', surname: 'Živković',
    born: '1910-04-25', bornPlace: 'Niš, Serbia',
    died: '1984-01-03', diedPlace: 'Belgrade, Serbia' },
  { id: 'novka-1912', first: 'Novka', surname: 'Kostić', married: 'Živković',
    born: '1912-01-12', bornPlace: 'Pirot, Serbia',
    died: '1999-01-28', diedPlace: 'Belgrade, Serbia' },
  { id: 'nadezda-1934', first: 'Nadežda', surname: 'Živković',
    born: '1934-11-04', bornPlace: 'Niš, Serbia',
    died: '2022-02', diedPlace: 'Melbourne, Australia',
    note: 'Rašić by marriage; later changed her surname back to Živković.' },
  { id: 'gojko-rasic', first: 'Gojko', surname: 'Rašić' },
  { id: 'michelle-1972', first: 'Michelle', surname: 'Rašić', changed: 'Živković',
    born: '1972-04-10', bornPlace: 'Melbourne, Australia' },
  { id: 'vidosava-1936', first: 'Vidosava', surname: 'Živković', married: 'Radulović',
    born: '1936-06-17', bornPlace: 'Niš, Serbia',
    died: '2024-04-09', diedPlace: 'Canberra, Australia' },
  { id: 'milos-radulovic', first: 'Miloš', surname: 'Radulović' },
  { id: 'giselle-1963', first: 'Giselle', surname: 'Radulović',
    born: '1963-09-17', bornPlace: 'Canberra, Australia' },
  { id: 'danka-1941', first: 'Danka', surname: 'Živković',
    born: '1941-12-01', bornPlace: 'Belgrade, Serbia',
    died: '2016-01-26', diedPlace: 'Fiuggi Fonte, Italy' },
  { id: 'sinisa-joksic', first: 'Siniša', surname: 'Joksić' },
  { id: 'giulio-bagagli', first: 'Giulio', surname: 'Bagagli' },
  { id: 'giorgio-1977', first: 'Giorgio', surname: 'Bagagli',
    born: '1977-04-16', bornPlace: 'Alatri, Italy' },
  { id: 'francesca-paris', first: 'Francesca', surname: 'Paris' },
  { id: 'giulia-bagagli', first: 'Giulia', surname: 'Bagagli' },
  { id: 'dragan-1940', first: 'Dragan', surname: 'Milosavljević',
    born: '1940-10-05', bornPlace: 'Belgrade, Serbia' },
  { id: 'milica-1943', first: 'Milica', surname: 'Živković', married: 'Milosavljević',
    born: '1943-10-22', bornPlace: 'Niš, Serbia' },
  { id: 'zoran-1969', first: 'Zoran', surname: 'Milosavljević',
    born: '1969-07-01', bornPlace: 'Belgrade, Serbia' },
  { id: 'milos-1976', first: 'Miloš', surname: 'Milosavljević',
    born: '1976-10-14', bornPlace: 'Belgrade, Serbia' },
  { id: 'jelena-1979', first: 'Jelena', surname: 'Veselić', married: 'Veselić Milosavljević',
    born: '1979-04-25', bornPlace: 'Belgrade, Serbia' },
  { id: 'katarina-2008', first: 'Katarina', surname: 'Milosavljević',
    born: '2008-09-08', bornPlace: 'Belgrade, Serbia' },
  { id: 'petar-2011', first: 'Petar', surname: 'Milosavljević',
    born: '2011-07-24', bornPlace: 'Belgrade, Serbia' },
  { id: 'aleksandar-2013', first: 'Aleksandar', surname: 'Milosavljević',
    born: '2013-06-12', bornPlace: 'Belgrade, Serbia' },
];

const UNIONS = [
  { id: 'u-vasul-marija', partners: ['vasul-jeftin', 'marija-ekl'], children: ['ruzica-1914'] },  // marriage date unknown
  { id: 'u-marija-hugo', partners: ['marija-ekl', 'hugo-pilauer'], year: 1920, approx: true, children: [] },  // after WWI; exact date unknown
  { id: 'u-zivojin-ruzica', partners: ['zivojin-1913', 'ruzica-1914'], children: ['dragan-1940'] },  // marriage date unknown
  { id: 'u-spasa-trajka', partners: ['spasa-zivkovic', 'trajka-zivkovic'],
    children: ['svetislav-1910', 'danilo-zivkovic', 'julka-zivkovic', 'dara-zivkovic', 'aleksandar-zivkovic'] },  // marriage date unknown; birth order unknown except Svetislav
  { id: 'u-julka-unknown', partners: ['julka-zivkovic'],  // husband unknown: single-partner union
    children: ['bosko-julka', 'vladimir-julka', 'vuce-julka'] },
  { id: 'u-aleksandar-suzana', partners: ['aleksandar-zivkovic', 'suzana-zivkovic'],
    children: ['stojan-zivkovic', 'djordje-zivkovic'] },  // marriage date unknown
  { id: 'u-dimitrije-vidosava', partners: ['dimitrije-kostic', 'vidosava-andjelkovic'],
    children: ['novka-1912', 'sreten-kostic'] },  // marriage date unknown
  { id: 'u-stojanovic-parents', partners: [],  // parents unknown; groups the Stojanović siblings
    children: ['marija-kostic', 'deska-stojanovic', 'brother-stojanovic'] },
  { id: 'u-brother-agatula', partners: ['brother-stojanovic', 'agatula'], children: [] },  // marriage date unknown
  { id: 'u-sreten-marija', partners: ['sreten-kostic', 'marija-kostic'],
    children: ['olivera-kostic', 'zivka-kostic'] },  // marriage date unknown
  { id: 'u-svetislav-novka', partners: ['svetislav-1910', 'novka-1912'],
    date: '1934-02-08', place: 'Niš, Serbia',
    children: ['nadezda-1934', 'vidosava-1936', 'danka-1941', 'milica-1943'] },
  { id: 'u-vidosava-milos', partners: ['vidosava-1936', 'milos-radulovic'], children: ['giselle-1963'] },  // marriage date unknown
  { id: 'u-nadezda-gojko', partners: ['nadezda-1934', 'gojko-rasic'],
    ended: true, endedHow: 'divorced', children: ['michelle-1972'] },  // dates unknown
  { id: 'u-danka-sinisa', partners: ['danka-1941', 'sinisa-joksic'],
    place: 'Belgrade, Serbia', ended: true, endedHow: 'divorced', children: [] },  // dates unknown
  { id: 'u-danka-giulio', partners: ['danka-1941', 'giulio-bagagli'], type: 'partnership',
    ended: true, endedHow: 'divorced', children: ['giorgio-1977'] },  // dates unknown
  { id: 'u-giorgio-francesca', partners: ['giorgio-1977', 'francesca-paris'],
    ended: true, endedHow: 'divorced', children: ['giulia-bagagli'] },  // dates unknown
  { id: 'u-dragan-milica', partners: ['dragan-1940', 'milica-1943'],
    date: '1967-12-09', place: 'Belgrade, Serbia', children: ['zoran-1969', 'milos-1976'] },
  { id: 'u-milos-jelena', partners: ['milos-1976', 'jelena-1979'],
    date: '2008-05-03', place: 'Belgrade, Serbia',
    separated: '2024-10', ended: '2026', endedHow: 'divorced',
    children: ['katarina-2008', 'petar-2011', 'aleksandar-2013'] },
];
