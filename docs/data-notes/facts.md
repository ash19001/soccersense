# Data notes: blimp facts

Checked on 2026-11-11 for `app/data/facts.ts`.

## Method

- Ideas came from general football knowledge, not from "fun fact" lists, and never from another
  game. Each was then looked up in the source given in the code: the current English Wikipedia
  article (read through its API on 2026-11-11) for 59 of them, and the Smith Art Gallery and
  Museum's own object page for the Stirling ball. A fact went in only when the source states it
  plainly. All text is reworded.
- Where sources disagree on a detail, the fact keeps only the part they share (see the table).
- Anything that could be overtaken says when it held: "as of 2026" when the current article
  confirms it today, "then a record" for crowds since beaten or likely to be, or a past-tense
  event in its year ("In 2015 ...").
- Nothing about betting, injuries, deaths, disasters or politics, and nothing that laughs at a
  team. Variety: 11 facts on the women's game; stadiums, kits, balls, rules, origins and records
  from the 1540s to 2026.
- Sign rules are enforced by `facts.test.ts`: at most 110 characters, printable ASCII, no
  quotation marks, ends with `.` or `!`.

## One line per fact

All Wikipedia sources are `https://en.wikipedia.org/wiki/<title>`.

| day | id                                | source                                 | care taken                                                                           |
| --- | --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | penalty-kick-inventor             | Penalty kick (association football)    | Proposed by McCrum in 1890, approved by IFAB 2 June 1891                             |
| 2   | first-international               | 1872 Scotland v England football match | "Official": earlier England v Scotland games in 1870-72 are not recognised           |
| 3   | dick-kerr-ladies-goodison         | Dick, Kerr Ladies F.C.                 | 53,000 inside; the larger crowd locked out is left out                               |
| 4   | pickles-the-dog                   | Pickles (dog)                          | Accounts differ on garden or car wheel, so only "south London" and the newspaper     |
| 5   | allianz-arena-colours             | Allianz Arena                          | Article: first with a full colour-changing exterior                                  |
| 6   | two-balls-1930-final              | 1930 FIFA World Cup final              | FIFA's compromise over who provided the ball                                         |
| 7   | rogerio-ceni-goals                | Rogério Ceni                           | Totals vary (129 to 131), so "more than 100"                                         |
| 8   | carli-lloyd-hat-trick             | Carli Lloyd                            | 2015 final v Japan                                                                   |
| 9   | goal-nets-inventor                | John Alexander Brodie                  | Invented 1889; "most proud" is in the article                                        |
| 10  | juventus-stripes                  | Juventus FC                            | No year given: Juventus says 1903, Notts County's article says 1901                  |
| 11  | first-floodlit-match              | Bramall Lane                           | 14 October 1878                                                                      |
| 12  | matthews-first-ballon-dor         | Ballon d'Or                            | Aged 41 years 321 days                                                               |
| 13  | first-womens-world-cup-80-minutes | 1991 FIFA Women's World Cup            | 80 minutes for that edition only                                                     |
| 14  | braga-quarry-stadium              | Estádio Municipal de Braga             | One goal backdrop is the quarry's rock wall                                          |
| 15  | chilavert-hat-trick               | José Luis Chilavert                    | "First known", as the article says                                                   |
| 16  | cards-traffic-lights              | Ken Aston                              | Kensington High Street lights; first used at the 1970 World Cup                      |
| 17  | sheffield-fc-oldest               | Sheffield F.C.                         | "Recognised by FIFA", not simply "oldest"                                            |
| 18  | olimpico-corner-goal              | Olympic goal                           | 2 October 1924 v Uruguay, the Olympic champions                                      |
| 19  | lyon-champions-league             | Olympique Lyonnais Féminin             | Record 8, as of 2026                                                                 |
| 20  | white-horse-final                 | 1923 FA Cup final                      | Billie was one of several mounted police horses, so "helped"                         |
| 21  | throw-in-own-goal                 | Throw-in                               | Laws of the Game, Law 15                                                             |
| 22  | pele-thousandth-goal              | Pelé                                   | 19 November 1969 v Vasco da Gama                                                     |
| 23  | lisbon-lions-local                | Lisbon Lions                           | 13 of 15 within 10 miles; the popular "all within 30 miles" claim avoided            |
| 24  | kazuyoshi-miura                   | Kazuyoshi Miura                        | Age and record as of 2026, as the article states                                     |
| 25  | first-fa-cup-final                | 1871–72 FA Cup                         | 16 March 1872                                                                        |
| 26  | arsenal-red-shirts                | Arsenal F.C.                           | No year: the donation came "soon after" the 1886 founding                            |
| 27  | christine-sinclair-goals          | Christine Sinclair                     | Retired in 2023; record as of 2026                                                   |
| 28  | panenka-penalty                   | Panenka penalty                        | Winning kick of the Euro 1976 final shoot-out                                        |
| 29  | yellow-wall                       | Westfalenstadion                       | 24,454 is the current terrace capacity                                               |
| 30  | lucien-laurent-first-goal         | Lucien Laurent                         | 13 July 1930                                                                         |
| 31  | preston-invincibles               | Preston North End F.C.                 | League and FA Cup both unbeaten                                                      |
| 32  | ada-hegerberg-ballon-dor          | Ada Hegerberg                          | First Ballon d'Or Féminin                                                            |
| 33  | telstar-ball                      | Adidas Telstar                         | 32 panels; pattern for visibility on black and white TV                              |
| 34  | everton-at-anfield                | Anfield                                | Everton there 1884-1891; Liverpool formed 1892                                       |
| 35  | barbados-own-goal                 | Barbados 4–2 Grenada                   | 1994 Caribbean Cup rule; no one mocked                                               |
| 36  | kristine-lilly-caps               | Kristine Lilly                         | 354 caps, record as of 2026                                                          |
| 37  | cruyff-turn                       | Cruyff turn                            | v Sweden, 1974 group stage                                                           |
| 38  | real-madrid-first-five            | Real Madrid CF                         | 1956 to 1960                                                                         |
| 39  | world-cup-willie                  | 1966 FIFA World Cup                    | Lion in a Union Jack jersey                                                          |
| 40  | begovic-goal                      | Asmir Begović                          | 97.5 yards v Southampton; no "longest goal" claim, that record has since changed     |
| 41  | ac-milan-english-name             | AC Milan                               | Article: English spelling kept in honour of its English origins                      |
| 42  | japan-womens-world-cup            | 2011 FIFA Women's World Cup            |                                                                                      |
| 43  | stirling-oldest-football          | smithmuseum.scot (object page)         | Dates and discovery stories vary, so only "almost 500 years old", as the museum says |
| 44  | matthews-knighted                 | Stanley Matthews                       | Knighted 1 January 1965; last league game 6 February 1965                            |
| 45  | ynwa-carousel                     | You'll Never Walk Alone                | Title written without quotation marks for the sign                                   |
| 46  | azteca-three-world-cups           | Estadio Azteca                         | 1970, 1986, 2026                                                                     |
| 47  | panyee-floating-pitch             | Panyee FC                              | Built by village children, inspired by the 1986 World Cup                            |
| 48  | mane-fastest-hat-trick            | Sadio Mané                             | In 2015; not called a current record                                                 |
| 49  | euro-2022-crowd                   | UEFA Women's Euro 2022 final           | "Then a record" for any Euros match                                                  |
| 50  | west-ham-ironworks                | Thames Ironworks F.C.                  | Founded 1895                                                                         |
| 51  | nottingham-forest-europe          | Nottingham Forest F.C.                 | 2 European Cups, 1 league title                                                      |
| 52  | brian-deane-first-goal            | Brian Deane                            | 15 August 1992 v Manchester United                                                   |
| 53  | marta-world-cup-goals             | Marta (footballer)                     | 17 goals, as of 2026                                                                 |
| 54  | higuita-scorpion-kick             | René Higuita                           | 6 September 1995 v England                                                           |
| 55  | fa-founded-1863                   | Freemasons' Tavern                     | 26 October 1863                                                                      |
| 56  | camp-nou-womens-crowd             | FC Barcelona Femení                    | "Then a record"                                                                      |
| 57  | just-fontaine-13-goals            | Just Fontaine                          | Not called a current record                                                          |
| 58  | champions-league-anthem           | UEFA Champions League Anthem           | Tony Britten, 1992                                                                   |
| 59  | brazil-every-world-cup            | Brazil at the FIFA World Cup           | Includes 2026                                                                        |
| 60  | tottenham-hotspur-schoolboys      | Tottenham Hotspur F.C.                 | 5 September 1882                                                                     |

## Considered and left out

- Fastest World Cup goal (Hakan Sukur, 2002): the player later became a politician.
- Denmark at Euro 1992: their late call-up came from a war.
- Estadio Hernando Siles altitude: tied up in a political row over altitude bans.
- Arbroath 36-0 Bon Accord: makes fun of the losing side.
- Women's FA ban of 1921, Leicester 2016 odds: politics and betting.
- Wembley arch height, Maracana 1950 crowd, Hampden 1937 crowd: figures vary between sources.
- Klose's World Cup goal record, youngest World Cup winner: could not confirm they survived 2026.
