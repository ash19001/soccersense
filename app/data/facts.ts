/**
 * The daily fact on the home screen's blimp sign. One a day, in a fixed cycle that repeats after
 * 60 days. Every fact was checked against the source given with it; see docs/data-notes/facts.md.
 *
 * Text rules (the sign scrolls it in capitals): one sentence, at most 110 characters, plain
 * ASCII, no quotation marks, digits for numbers, ends with a full stop or an exclamation mark.
 * Anything that could be overtaken carries its year.
 */

export interface Fact {
  /** Stable kebab-case id. */
  id: string;
  /** The sentence shown on the sign. */
  text: string;
  /** The page the fact was checked against. */
  source: string;
}

const WIKI = "https://en.wikipedia.org/wiki/";

export const FACTS: readonly Fact[] = [
  {
    id: "penalty-kick-inventor",
    text: "The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh, and arrived in 1891.",
    source: `${WIKI}Penalty_kick_(association_football)`,
  },
  {
    id: "first-international",
    text: "The first official international, Scotland v England in Glasgow in 1872, finished 0-0.",
    source: `${WIKI}1872_Scotland_v_England_football_match`,
  },
  {
    id: "dick-kerr-ladies-goodison",
    text: "On Boxing Day 1920, 53,000 fans packed Goodison Park to watch Dick, Kerr Ladies play St Helens Ladies.",
    source: `${WIKI}Dick,_Kerr_Ladies_F.C.`,
  },
  {
    id: "pickles-the-dog",
    text: "In 1966 a dog called Pickles found the stolen World Cup trophy wrapped in newspaper in south London!",
    source: `${WIKI}Pickles_(dog)`,
  },
  {
    id: "allianz-arena-colours",
    text: "Munich's Allianz Arena was the first stadium in the world whose whole outside can change colour.",
    source: `${WIKI}Allianz_Arena`,
  },
  {
    id: "two-balls-1930-final",
    text: "The 1930 World Cup final used 2 balls: Argentina's in the first half and Uruguay's in the second.",
    source: `${WIKI}1930_FIFA_World_Cup_final`,
  },
  {
    id: "rogerio-ceni-goals",
    text: "Brazilian goalkeeper Rogerio Ceni scored more than 100 goals, most of them free kicks and penalties.",
    source: `${WIKI}Rog%C3%A9rio_Ceni`,
  },
  {
    id: "carli-lloyd-hat-trick",
    text: "Carli Lloyd scored a hat-trick in the first 16 minutes of the 2015 Women's World Cup final.",
    source: `${WIKI}Carli_Lloyd`,
  },
  {
    id: "goal-nets-inventor",
    text: "Goal nets were invented in 1889 by John Brodie, a Liverpool engineer who called them his proudest idea.",
    source: `${WIKI}John_Alexander_Brodie`,
  },
  {
    id: "juventus-stripes",
    text: "Juventus wear black and white stripes because a fan in Nottingham once sent them Notts County shirts.",
    source: `${WIKI}Juventus_FC`,
  },
  {
    id: "first-floodlit-match",
    text: "Bramall Lane in Sheffield staged the world's first floodlit football match, way back in 1878.",
    source: `${WIKI}Bramall_Lane`,
  },
  {
    id: "matthews-first-ballon-dor",
    text: "England winger Stanley Matthews won the very first Ballon d'Or, in 1956, at the age of 41.",
    source: `${WIKI}Ballon_d%27Or`,
  },
  {
    id: "first-womens-world-cup-80-minutes",
    text: "At the first Women's World Cup, in China in 1991, every match lasted 80 minutes instead of 90.",
    source: `${WIKI}1991_FIFA_Women%27s_World_Cup`,
  },
  {
    id: "braga-quarry-stadium",
    text: "Braga's stadium in Portugal was carved into an old quarry, with a wall of bare rock behind one goal.",
    source: `${WIKI}Est%C3%A1dio_Municipal_de_Braga`,
  },
  {
    id: "chilavert-hat-trick",
    text: "In 1999 Paraguay's Jose Luis Chilavert became the first goalkeeper known to score a hat-trick.",
    source: `${WIKI}Jos%C3%A9_Luis_Chilavert`,
  },
  {
    id: "cards-traffic-lights",
    text: "Ken Aston thought up yellow and red cards at a London traffic light; they began at the 1970 World Cup.",
    source: `${WIKI}Ken_Aston`,
  },
  {
    id: "sheffield-fc-oldest",
    text: "Sheffield FC, founded in 1857, is recognised by FIFA as the oldest football club in the world.",
    source: `${WIKI}Sheffield_F.C.`,
  },
  {
    id: "olimpico-corner-goal",
    text: "A goal straight from a corner is called an olimpico, after Argentina's Cesareo Onzari scored one in 1924.",
    source: `${WIKI}Olympic_goal`,
  },
  {
    id: "lyon-champions-league",
    text: "As of 2026, Lyon have won the Women's Champions League a record 8 times.",
    source: `${WIKI}Olympique_Lyonnais_F%C3%A9minin`,
  },
  {
    id: "white-horse-final",
    text: "A police horse named Billie helped clear the pitch at the first FA Cup final at Wembley, in 1923.",
    source: `${WIKI}1923_FA_Cup_final`,
  },
  {
    id: "throw-in-own-goal",
    text: "You cannot score straight from a throw-in; throw it into your own net and the other team gets a corner.",
    source: `${WIKI}Throw-in`,
  },
  {
    id: "pele-thousandth-goal",
    text: "Pele scored his 1,000th goal from a penalty at the Maracana in 1969.",
    source: `${WIKI}Pel%C3%A9`,
  },
  {
    id: "lisbon-lions-local",
    text: "Most of Celtic's 1967 European Cup winning squad were born within 10 miles of Celtic Park.",
    source: `${WIKI}Lisbon_Lions`,
  },
  {
    id: "kazuyoshi-miura",
    text: "As of 2026, Japan's Kazuyoshi Miura, aged 59, is the oldest professional footballer in the world.",
    source: `${WIKI}Kazuyoshi_Miura`,
  },
  {
    id: "first-fa-cup-final",
    text: "The first FA Cup final was played at Kennington Oval in 1872, and Wanderers won it 1-0.",
    source: `${WIKI}1871%E2%80%9372_FA_Cup`,
  },
  {
    id: "arsenal-red-shirts",
    text: "Arsenal wear red thanks to Nottingham Forest, who sent the newly formed club a kit and a ball.",
    source: `${WIKI}Arsenal_F.C.`,
  },
  {
    id: "christine-sinclair-goals",
    text: "Canada's Christine Sinclair scored 190 international goals, more than any man or woman, as of 2026.",
    source: `${WIKI}Christine_Sinclair`,
  },
  {
    id: "panenka-penalty",
    text: "Antonin Panenka won Euro 1976 for Czechoslovakia with a cheeky chipped penalty in the shoot-out.",
    source: `${WIKI}Panenka_penalty`,
  },
  {
    id: "yellow-wall",
    text: "Dortmund's Yellow Wall holds 24,454 standing fans, the biggest terrace in European football.",
    source: `${WIKI}Westfalenstadion`,
  },
  {
    id: "lucien-laurent-first-goal",
    text: "France's Lucien Laurent scored the first ever World Cup goal, a volley against Mexico in 1930.",
    source: `${WIKI}Lucien_Laurent`,
  },
  {
    id: "preston-invincibles",
    text: "Preston North End won the first Football League, in 1888-89, without losing a single match.",
    source: `${WIKI}Preston_North_End_F.C.`,
  },
  {
    id: "ada-hegerberg-ballon-dor",
    text: "Norway's Ada Hegerberg won the first women's Ballon d'Or, in 2018.",
    source: `${WIKI}Ada_Hegerberg`,
  },
  {
    id: "telstar-ball",
    text: "The 1970 World Cup ball had 32 black and white panels to help it show up on black and white TV.",
    source: `${WIKI}Adidas_Telstar`,
  },
  {
    id: "everton-at-anfield",
    text: "Anfield was Everton's home first; Liverpool were formed in 1892 to fill it after Everton moved out.",
    source: `${WIKI}Anfield`,
  },
  {
    id: "barbados-own-goal",
    text: "In 1994 Barbados scored an own goal on purpose, because a golden goal in extra time counted double.",
    source: `${WIKI}Barbados_4%E2%80%932_Grenada`,
  },
  {
    id: "kristine-lilly-caps",
    text: "USA midfielder Kristine Lilly won 354 caps, the most of any footballer in history, as of 2026.",
    source: `${WIKI}Kristine_Lilly`,
  },
  {
    id: "cruyff-turn",
    text: "Johan Cruyff first showed the world his famous turn against Sweden at the 1974 World Cup.",
    source: `${WIKI}Cruyff_turn`,
  },
  {
    id: "real-madrid-first-five",
    text: "Real Madrid won each of the first 5 European Cups, from 1956 to 1960.",
    source: `${WIKI}Real_Madrid_CF`,
  },
  {
    id: "world-cup-willie",
    text: "The first World Cup mascot was World Cup Willie, a cartoon lion in a Union Jack shirt, in 1966.",
    source: `${WIKI}1966_FIFA_World_Cup`,
  },
  {
    id: "begovic-goal",
    text: "In 2013 Stoke goalkeeper Asmir Begovic scored from 97.5 yards out, just 13 seconds into a game.",
    source: `${WIKI}Asmir_Begovi%C4%87`,
  },
  {
    id: "ac-milan-english-name",
    text: "AC Milan was founded in 1899 by Englishman Herbert Kilpin, which is why it uses Milan, not Milano.",
    source: `${WIKI}AC_Milan`,
  },
  {
    id: "japan-womens-world-cup",
    text: "In 2011 Japan became the first Asian team to win the Women's World Cup.",
    source: `${WIKI}2011_FIFA_Women%27s_World_Cup`,
  },
  {
    id: "stirling-oldest-football",
    text: "The oldest known football, found behind panelling at Stirling Castle, is almost 500 years old.",
    source: "https://www.smithmuseum.scot/objects/the-worlds-oldest-football/",
  },
  {
    id: "matthews-knighted",
    text: "Stanley Matthews was knighted in 1965 while still a player, and played his last league game aged 50.",
    source: `${WIKI}Stanley_Matthews`,
  },
  {
    id: "ynwa-carousel",
    text: "You'll Never Walk Alone, sung on the Kop at Anfield, comes from the 1945 musical Carousel.",
    source: `${WIKI}You%27ll_Never_Walk_Alone`,
  },
  {
    id: "azteca-three-world-cups",
    text: "In 2026 Mexico City's Estadio Azteca became the first stadium to host games at 3 World Cups.",
    source: `${WIKI}Estadio_Azteca`,
  },
  {
    id: "panyee-floating-pitch",
    text: "Children on Koh Panyee in Thailand built a floating football pitch from scrap wood and fishing rafts.",
    source: `${WIKI}Panyee_FC`,
  },
  {
    id: "mane-fastest-hat-trick",
    text: "In 2015 Sadio Mane scored a Premier League hat-trick in just 2 minutes and 56 seconds.",
    source: `${WIKI}Sadio_Man%C3%A9`,
  },
  {
    id: "euro-2022-crowd",
    text: "In 2022, 87,192 fans saw England win the Women's Euro final at Wembley, then a record for any Euros match.",
    source: `${WIKI}UEFA_Women%27s_Euro_2022_final`,
  },
  {
    id: "west-ham-ironworks",
    text: "West Ham began in 1895 as Thames Ironworks, the works team of a London shipyard.",
    source: `${WIKI}Thames_Ironworks_F.C.`,
  },
  {
    id: "nottingham-forest-europe",
    text: "Nottingham Forest are the only club in Europe with more European Cups than league titles.",
    source: `${WIKI}Nottingham_Forest_F.C.`,
  },
  {
    id: "brian-deane-first-goal",
    text: "Brian Deane scored the first ever Premier League goal, for Sheffield United, in August 1992.",
    source: `${WIKI}Brian_Deane`,
  },
  {
    id: "marta-world-cup-goals",
    text: "As of 2026, Brazil's Marta holds the Women's World Cup scoring record, with 17 goals.",
    source: `${WIKI}Marta_(footballer)`,
  },
  {
    id: "higuita-scorpion-kick",
    text: "Colombia keeper Rene Higuita cleared a cross with a scorpion kick, heels over his head, at Wembley in 1995.",
    source: `${WIKI}Ren%C3%A9_Higuita`,
  },
  {
    id: "fa-founded-1863",
    text: "The Football Association first met in 1863 at the Freemasons' Tavern in London.",
    source: `${WIKI}Freemasons%27_Tavern`,
  },
  {
    id: "camp-nou-womens-crowd",
    text: "In 2022, 91,648 fans watched Barcelona play Wolfsburg at Camp Nou, then a record for a women's match.",
    source: `${WIKI}FC_Barcelona_Femen%C3%AD`,
  },
  {
    id: "just-fontaine-13-goals",
    text: "France's Just Fontaine scored 13 goals in just 6 games at the 1958 World Cup.",
    source: `${WIKI}Just_Fontaine`,
  },
  {
    id: "champions-league-anthem",
    text: "The Champions League anthem, written in 1992, is based on Handel's Zadok the Priest.",
    source: `${WIKI}UEFA_Champions_League_Anthem`,
  },
  {
    id: "brazil-every-world-cup",
    text: "Brazil are the only nation to have played at every men's World Cup, as of 2026.",
    source: `${WIKI}Brazil_at_the_FIFA_World_Cup`,
  },
  {
    id: "tottenham-hotspur-schoolboys",
    text: "Tottenham Hotspur were founded in 1882 by a group of schoolboys from the Hotspur Cricket Club.",
    source: `${WIKI}Tottenham_Hotspur_F.C.`,
  },
];

/**
 * The fact for a game day. Day 1 (2026-11-10) is the first fact; the list then repeats. Any
 * integer works, including 0 and negative days; a non-integer is rounded down and anything that
 * is not a finite number counts as day 1.
 */
export function factForDay(day: number): Fact {
  const n = Number.isFinite(day) ? Math.floor(day) : 1;
  const count = FACTS.length;
  const index = (((n - 1) % count) + count) % count;
  return FACTS[index]!;
}
